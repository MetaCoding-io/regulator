/**
 * The unit's trajectory: its path through `UNIT_TRANSITIONS`, with the why of each step.
 *
 * The path is read, not inferred (#162). The execution store appends one line to the unit's status history for
 * every transition it writes, with the trigger, so the moves a unit made are those lines, in that order, and the
 * fold's work is to put beside each one the record that says why: the attempt, the verdict, the recovery decision,
 * the obligation. The three moves that leave no other record (reintegrated, reintegration refused, a dispatch
 * refused) are their own lines and are placed where the history has them. Where the history and the records
 * disagree, a record with no line or a line with no record, the trajectory says so in `problem`.
 *
 * A unit whose moves were written before the history existed has none, or one that begins partway through its
 * life. For such a unit the path is reconstructed from the records as it was before #162: a reducer over the
 * attempts, verdicts, decisions and obligations in time order, applying the table at each step and placing the
 * three record-less moves at the record that follows. The trajectory says which it did (`basis`), and every step
 * whose move was inferred says so (`source`).
 *
 * Every step carries its *why* as the records state it — the rule the router applied, the reasons the verdict
 * carries, the obligation the unit waited on — never a reading of the transcript or the repository. The control
 * room steps through these; the CLI could print them.
 */
import type {
  AttemptRecord, BudgetLedger, ObligationState, RecoveryDecision, TechnicalVerdict, UnitRecord, UnitStatus, UnitTransition, UnitTransitionRecord, UnitTransitionStep, UnitTrigger,
} from "@metacoding.io/regulator-protocol";
import { UNIT_TRANSITIONS, assertNever, unitReason, unitTransition, unitTransitions } from "@metacoding.io/regulator-protocol";
import { UNIT_STATUS_HISTORY_FILE } from "./paths.js";
import { REGULATOR_FOR } from "./spans.js";

/** What a step read from the history cites. */
const UNIT_STATUS_HISTORY = UNIT_STATUS_HISTORY_FILE;

export interface TrajectoryInput {
  unit: UnitRecord;
  attempts: readonly AttemptRecord[];
  decisions: readonly RecoveryDecision[];
  verdicts: readonly TechnicalVerdict[];
  /** The obligations that name the unit. */
  obligations: readonly ObligationState[];
  budgets?: readonly BudgetLedger[];
  /** The policy's attempt ceiling for the unit type, when the caller knows it. */
  attemptCeiling?: number;
  /** The unit's status history, as the store wrote it (`ExecutionStore.listTransitions`). Absent or partial for a unit older than the history: the path is then reconstructed. */
  history?: readonly UnitTransitionRecord[];
}

export type TrajectoryEvent =
  | "contracted" | "attempt-started" | "attempt-ended" | "re-audit" | "decision" | "obligation-opened" | "obligation-closed" | "reintegration" | "recorded";

export interface TrajectoryStep {
  /** 1-based position in the trajectory. */
  index: number;
  at: string;
  event: TrajectoryEvent;
  /** One line: what happened. */
  title: string;
  from: UnitStatus;
  to: UnitStatus;
  /** The row of the table this step took, when it moved the unit; a step that leaves the status alone has none. */
  transition?: UnitTrigger;
  by?: UnitTransitionStep;
  /** Where a step that moved the unit got its move: a line of the status history, or the reconstruction from the records for a unit that has no history. */
  source?: "history" | "reconstructed";
  /** The registry record whose work this step is, when a record says. */
  regulator?: string;
  attempt?: number;
  /** Why, as the records state it. */
  why: string[];
  /** The ids of the records this step is read from. */
  cites: string[];
}

export interface UnitTrajectory {
  steps: TrajectoryStep[];
  /** Where the path ends. */
  final: UnitStatus;
  /** What the path was taken from: the status history the store wrote, or a reconstruction from the records for a unit whose moves predate it. */
  basis: "history" | "reconstructed";
  /** Set when the history and the records disagree, the path ends where the unit record does not, or (reconstructing) a step needed a move the table does not declare. */
  problem?: string;
}

/** The moves that leave no record but their line of the history: no attempt, verdict or decision is written with them. */
const RECORDLESS: ReadonlySet<UnitTrigger> = new Set<UnitTrigger>(["reintegrated", "reintegration-refused", "dispatch-refused"]);
const RECONSTRUCTED = "reconstructed: this unit has no status history for this move (it was written before the store kept one, #162), so it is placed here from the records beside it";

const REGULATOR = {
  contractGate: "reg.control.work-contract-gate.v1",
  lease: "reg.coordination.unit-lease.v1",
  closeout: REGULATOR_FOR.run_checks!,
  reportGate: "reg.control.result-report-gate.v1",
  budget: REGULATOR_FOR.budget!,
  pause: "reg.algedonic.pause-gate.v1",
  router: REGULATOR_FOR.decision!,
  obligations: REGULATOR_FOR.obligation!,
  reintegration: "reg.coordination.reintegration.v1",
  trial: "reg.audit.pre-merge-trial.v1",
  lifecycle: "reg.control.unit-lifecycle.v1",
} as const;

const WAITS_ON: Partial<Record<RecoveryDecision["action"], string>> = {
  retry: "the loop spends the next attempt, with the hint",
  repair: "the loop spends the next attempt, with the hint",
  abort: "the loop released the lease and removed the worktree",
  escalate: "an algedonic signal went to S5 with the evidence; the unit waits on the consumer the routing policy names",
  remediate: "the loop cannot remediate on its own; an obligation is opened for the consumer the routing policy names",
  replan: "a replan is a new contract version, not a retry; an obligation is opened for the consumer the routing policy names",
  clarify: "the question is owed to the consumer the routing policy names; the unit waits for the answer",
  pause: "the unit waits for the consumer the routing policy names",
};

interface Pending {
  rank: number;
  at: string;
  apply: () => void;
}

function verdictWhy(v: TechnicalVerdict): string[] {
  const lines = [`S3* verdict ${v.verdict} at revision ${v.revision.slice(0, 7)}, over ${v.evidence.length} evidence record(s)`];
  if (v.satisfied.length) lines.push(`satisfied: ${v.satisfied.join(", ")}`);
  if (v.failed.length) lines.push(`failed: ${v.failed.join(", ")}`);
  if (v.contradicted.length) lines.push(`contradicted: ${v.contradicted.join(", ")}`);
  if (v.missing.length) lines.push(`missing: ${v.missing.join(", ")}`);
  if (v.stale.length) lines.push(`stale: ${v.stale.join(", ")}`);
  if (v.awaitingAcceptance.length) lines.push(`awaiting a person's acceptance: ${v.awaitingAcceptance.join(", ")}`);
  for (const r of v.reasons) lines.push(r);
  return lines;
}

/** The unit's path, read from its status history with the why from its records; reconstructed from the records for a unit that has no history. */
export function unitTrajectory(input: TrajectoryInput): UnitTrajectory {
  const { unit } = input;
  const history = input.history ?? [];
  // A history is the unit's whole path when it starts where every unit starts. One that is empty for a unit that has
  // moved, or that begins partway, belongs to a unit older than the history: nothing is read from it, and the path is
  // reconstructed whole, as before #162, so one unit is never half read and half inferred.
  const recorded = history.length ? history[0]!.from === "contracted" : unit.status === "contracted";
  const steps: TrajectoryStep[] = [];
  let status: UnitStatus = "contracted";
  let problem: string | undefined;
  let cursor = 0;
  const ended = new Set<number>();
  const verdictBefore = new Map<number, TechnicalVerdict>();
  let lastEndedAt = "";

  type Step = Omit<TrajectoryStep, "index" | "from" | "to" | "source"> & { to?: UnitStatus; on?: UnitTrigger };
  const describe = (line: UnitTransitionRecord, n: number): string => `line ${n} of the status history (${line.on}: ${line.from} → ${line.to} at ${line.at})`;

  /** Take a line of the history as a step: the move is the line's, and the rest is whatever record explains it. */
  const take = (line: UnitTransitionRecord, step: Omit<Step, "to" | "on">): void => {
    if (line.from !== status) problem ??= `${describe(line, cursor)} leaves ${line.from}, and the line before it left the unit ${status}: a line is missing, or one was written around the store`;
    steps.push({ index: steps.length + 1, from: line.from, to: line.to, ...step, transition: line.on, ...(unitTransition(line.from, line.on) ? { by: unitTransition(line.from, line.on)!.by } : {}), source: "history" });
    status = line.to;
  };
  /** A line that is its own record: the three moves nothing else writes down. */
  const takeRecordless = (line: UnitTransitionRecord): void => {
    const row = unitTransition(line.from, line.on);
    take(line, {
      at: line.at, event: line.on === "dispatch-refused" ? "recorded" : "reintegration", title: line.on === "reintegrated" ? "reintegrated: closed" : line.on === "reintegration-refused" ? "reintegration refused" : `${line.on}: ${line.to}`,
      regulator: line.on === "reintegrated" ? REGULATOR.reintegration : line.on === "reintegration-refused" ? REGULATOR.trial : REGULATOR.lease,
      why: [...(row ? [row.description] : []), ...("reason" in line ? [line.reason] : [])], cites: [UNIT_STATUS_HISTORY],
    });
  };
  /** A line the records do not explain: taken, because the store wrote it, and said. */
  const takeUnexplained = (line: UnitTransitionRecord): void => {
    problem ??= `${describe(line, cursor)} has no record beside it: the store wrote the transition, and the attempt, verdict or decision that should say why is missing`;
    take(line, { at: line.at, event: "recorded", title: `${line.on}: ${line.to}`, regulator: REGULATOR.lifecycle, why: [unitTransition(line.from, line.on)?.description ?? "a transition the table does not declare", ...("reason" in line ? [line.reason] : [])], cites: [UNIT_STATUS_HISTORY] });
  };
  /** The record-less lines at the head of what is unread, up to a time: placed where the history has them. */
  const flushRecordless = (until?: string): void => {
    while (cursor < history.length && RECORDLESS.has(history[cursor]!.on) && (until === undefined || history[cursor]!.at <= until)) takeRecordless(history[cursor++]!);
  };

  const push = (step: Step): void => {
    const { to: _to, on, ...rest } = step;
    if (recorded) {
      flushRecordless(step.at);
      if (on === undefined) { steps.push({ index: steps.length + 1, from: status, to: status, ...rest }); return; }
      const at = history.findIndex((line, i) => i >= cursor && line.on === on);
      if (at === -1) {
        // The record exists and the transition does not: say so once, and show the record where it falls without moving the unit.
        problem ??= `step ${steps.length + 1} (${step.title}) is a record of ${on}, and the status history has no ${on} after its line ${cursor}: the record was written and the transition was not`;
        steps.push({ index: steps.length + 1, from: status, to: status, ...rest });
        return;
      }
      while (cursor < at) { const line = history[cursor++]!; if (RECORDLESS.has(line.on)) takeRecordless(line); else takeUnexplained(line); }
      take(history[cursor++]!, rest);
      return;
    }
    // No history to read: the move is inferred from the record, through the table.
    const from = status;
    let to = step.to ?? from;
    let transition: UnitTransition | undefined;
    if (on !== undefined) {
      transition = unitTransition(from, on);
      if (!transition) {
        // The loop could not have taken this from here: say so once, then follow the records anyway so the rest still reads.
        const declared = unitTransitions(from, to);
        problem ??= `step ${steps.length + 1} (${step.title}) takes ${on} from ${from}, which the loop does not declare (from ${from} it declares ${UNIT_TRANSITIONS.filter((t) => t.from === from).map((t) => t.on).join(", ") || "nothing"}): a record is missing or a status was written around the loop`;
        transition = declared[0];
      } else to = transition.to;
    }
    steps.push({ index: steps.length + 1, from, to, ...rest, ...(transition ? { transition: transition.on, by: transition.by, source: "reconstructed" as const } : {}) });
    status = to;
  };

  /** Reconstruction only. A unit verified at its HEAD is not closed until the trial merge lands; a record that needs it blocked first means the trial refused it. */
  const settleReintegration = (at: string, why: string[], cites: string[]): void => {
    if (recorded || status !== "reported") return;
    push({ at, event: "reintegration", title: "reintegration refused", on: "reintegration-refused", regulator: REGULATOR.trial, why: [...(why.length ? why : ["the record of the refusal is the decision that followed it"]), RECONSTRUCTED], cites });
  };

  const pending: Pending[] = [];
  pending.push({ rank: 0, at: unit.createdAt, apply: () => push({
    at: unit.createdAt, event: "contracted", title: `contracted: ${unit.contract.id} v${unit.contract.version}`, regulator: REGULATOR.contractGate,
    why: [
      `the work contract passed the gate and was recorded; the unit is of type ${unit.unitType} under workload ${unit.workload.name} v${unit.workload.version}`, "a refused contract records no unit, so a unit that exists was accepted",
      ...(recorded ? [] : [history.length
        ? `this unit's status history begins partway (its first line leaves ${history[0]!.from}, not contracted): its earlier moves were written before the store kept a history (#162), so the whole path below is reconstructed from the attempt, verdict, decision and obligation records, and the history is not read`
        : "this unit has no status history: its moves were written before the store kept one (#162), so the path below is reconstructed from the attempt, verdict, decision and obligation records"]),
    ],
    cites: [`${unit.contract.id} v${unit.contract.version}`],
  }) });

  for (const a of input.attempts) {
    pending.push({ rank: 1, at: a.startedAt, apply: () => {
      const decision = input.decisions.filter((d) => d.attempt === a.attempt - 1 && d.decidedAt <= a.startedAt).at(-1);
      const answered = input.obligations.filter((o) => (o.concern === "interaction" || o.concern === "recovery-decision") && o.status === "resolved" && (o.closedAt ?? "") > lastEndedAt && (o.closedAt ?? "") <= a.startedAt).at(-1);
      const why: string[] = [`attempt ${a.attempt}${input.attemptCeiling ? ` of ${input.attemptCeiling}` : ""} under contract ${unit.contract.id} v${a.contractVersion}`];
      const cites: string[] = [];
      let regulator: string = REGULATOR.contractGate;
      if (a.attempt === 1 && !decision && !answered) why.push("the contract gate and the progression veto let it through: the lease was acquired and the worktree opened");
      if (decision) {
        why.push(`routed under ${decision.policy.name} v${decision.policy.version}: ${decision.cause} → ${decision.action} (occurrence ${decision.occurrence}) — ${decision.rationale}`);
        if (decision.hint) why.push(`the attempt was told: ${decision.hint}`);
        cites.push(decision.id);
        regulator = REGULATOR.router;
      }
      if (answered) {
        why.push(`${answered.concern === "interaction" ? "the question" : "the obligation"} ${answered.id.slice(0, 8)} (${answered.subject}) was resolved by ${answered.closedBy ?? "someone"} as ${answered.disposition ?? "resolved"}${answered.rationale ? `: ${answered.rationale}` : ""}; the attempt carries the answer`);
        cites.push(answered.id);
        regulator = REGULATOR.obligations;
      }
      if (a.attempt > 1 && !decision && !answered) why.push("a further attempt under the same contract version; no decision or answer is recorded before it");
      settleReintegration(a.startedAt, [], []);
      push({ at: a.startedAt, event: "attempt-started", title: `attempt ${a.attempt} started`, on: "dispatch", attempt: a.attempt, regulator, why, cites: [...cites, ...(a.sessionId ? [`session ${a.sessionId}`] : [])] });
    } });
    pending.push({ rank: 3, at: a.endedAt, apply: () => {
      ended.add(a.attempt);
      lastEndedAt = a.endedAt;
      const verdict = verdictBefore.get(a.attempt);
      const budget = input.budgets?.find((b) => b.attempt === a.attempt);
      const why: string[] = [];
      const cites: string[] = verdict ? [verdict.id] : [];
      let regulator: string | undefined;
      switch (a.outcome) {
        case "reported":
          why.push("report_result honoured the contract and the host's checks passed at the committed revision");
          if (verdict) why.push(...verdictWhy(verdict));
          regulator = REGULATOR.closeout;
          break;
        case "check-failure":
          why.push("the report was valid, and the host's checks refused closeout");
          if (verdict) why.push(...verdictWhy(verdict)); else if (a.detail) why.push(a.detail);
          regulator = REGULATOR.closeout;
          break;
        case "invalid-report":
          why.push(`the result report does not honour the contract${a.detail ? `: ${a.detail}` : ""}`);
          regulator = REGULATOR.reportGate;
          break;
        case "no-report":
          why.push("the session ended without calling report_result; the loop reads the report, never the worktree, so there is nothing to close on");
          if (a.detail) why.push(a.detail);
          break;
        case "budget-exhausted":
          why.push(`the budget guard halted the attempt${budget?.exhausted ? ` on ${budget.exhausted.dimension} at ${budget.exhausted.at}` : ""}${a.detail ? `: ${a.detail}` : ""}`);
          if (budget) why.push(`consumed ${budget.consumed.tokens} of ${budget.ceiling.tokens} tokens, ${budget.consumed.turns} of ${budget.ceiling.turns} turns`);
          regulator = REGULATOR.budget;
          break;
        case "paused":
          why.push(`the session asked a person and no answer came${a.detail ? `: ${a.detail}` : ""}; the unit waits on that obligation, and nothing is routed`);
          regulator = REGULATOR.pause;
          break;
        case "error":
          why.push(`the dispatch failed${a.detail ? `: ${a.detail}` : ""}`);
          break;
        default:
          assertNever(a.outcome, "attempt outcome");
      }
      push({ at: a.endedAt, event: "attempt-ended", title: `attempt ${a.attempt} ended: ${a.outcome}`, on: a.outcome === "reported" ? "verified" : "attempt-failed", attempt: a.attempt, ...(regulator ? { regulator } : {}), why, cites });
    } });
  }

  for (const v of input.verdicts) {
    pending.push({ rank: 2, at: v.at, apply: () => {
      if (!ended.has(v.attempt)) { verdictBefore.set(v.attempt, v); return; }
      // A verdict after the attempt ended is a re-audit (`regulator unit close`): no attempt is spent, and the verdict alone moves the unit.
      push({
        at: v.at, event: "re-audit", title: `re-audited without an attempt: ${v.verdict}`, on: v.verdict === "pass" ? "re-verified" : "re-audit-refused", attempt: v.attempt, regulator: REGULATOR.closeout,
        why: ["a blocked unit was re-audited without spending an attempt: a person accepted a criterion, or the missing evidence could be produced", ...verdictWhy(v)], cites: [v.id],
      });
    } });
  }

  for (const d of input.decisions) {
    pending.push({ rank: 4, at: d.decidedAt, apply: () => {
      settleReintegration(d.decidedAt, d.evidence.filter((e) => e.startsWith("unit: reintegration:")), [d.id]);
      const why = [d.rationale, ...d.evidence.map((e) => `evidence: ${e}`)];
      if (d.hint) why.push(`hint for the next attempt: ${d.hint}`);
      if (d.question) why.push(`question: ${d.question}`);
      const applied = WAITS_ON[d.action];
      if (applied) why.push(applied);
      const on: UnitTrigger | undefined = d.action === "abort" ? "abort" : d.action === "retry" || d.action === "repair" ? undefined : "routed-waiting";
      push({ at: d.decidedAt, event: "decision", title: `routed: ${d.cause} → ${d.action}`, ...(on ? { on } : {}), attempt: d.attempt, regulator: REGULATOR.router, why, cites: [d.id] });
    } });
  }

  for (const o of input.obligations) {
    for (const h of o.history) {
      if (h.type === "obligation-opened") {
        pending.push({ rank: 5, at: h.at, apply: () => push({
          at: h.at, event: "obligation-opened", title: `owed to ${o.consumer}: ${o.concern}`, regulator: REGULATOR.obligations,
          why: [`${o.subject}`, `${o.concern} at ${o.severity}, opened by ${o.openedBy} for ${o.consumer}${o.blocks ? "; while open it vetoes dispatch and close" : "; it does not hold the unit"}`, ...(o.question ? [`question: ${o.question}`] : []), `from ${o.sources.join(", ")}`],
          cites: [o.id],
        }) });
      } else if (h.type === "obligation-resolved" || h.type === "obligation-escalated" || h.type === "obligation-superseded") {
        pending.push({ rank: 6, at: h.at, apply: () => push({
          at: h.at, event: "obligation-closed", title: `${h.type.slice("obligation-".length)} by ${h.by}: ${o.concern}`, regulator: REGULATOR.obligations,
          why: [`${o.subject}`, h.type === "obligation-resolved" ? `${h.disposition}: ${h.rationale}` : `→ ${h.successor.slice(0, 8)}: ${h.rationale}`, ...(o.blocks ? ["the veto it carried is lifted"] : [])],
          cites: [o.id, h.id],
        }) });
      }
    }
  }

  pending.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.rank - b.rank));
  for (const p of pending) p.apply();

  if (recorded) {
    // What is left of the history after the last record: the record-less moves are themselves, and anything else is a transition no record explains.
    while (cursor < history.length) { const line = history[cursor++]!; if (RECORDLESS.has(line.on)) takeRecordless(line); else takeUnexplained(line); }
    if (status !== unit.status) problem ??= `the status history ends ${status} and the unit record says ${unit.status}: a transition reached one and not the other, or the record was written around the store`;
    return { steps, final: status, basis: "history", ...(problem ? { problem } : {}) };
  }

  // Reconstruction's tail: what the record says beyond the last record that says why. Reintegration left no record of its own, and a
  // dispatch refused before any attempt left only the unit's reason; both are one declared move from where the fold stopped.
  if (status !== unit.status) {
    const declared = unitTransitions(status, unit.status).filter((t) => RECORDLESS.has(t.on));
    const row = declared.length === 1 ? declared[0] : declared.find((t) => ((unitReason(unit) ?? "").startsWith("reintegration:") ? t.on === "reintegration-refused" : t.on === "dispatch-refused"));
    if (row) {
      push({
        at: unit.updatedAt, event: row.on === "reintegrated" ? "reintegration" : "recorded", title: row.on === "reintegrated" ? "reintegrated: closed" : `${row.on}: ${unit.status}`, on: row.on,
        regulator: row.on === "reintegrated" ? REGULATOR.reintegration : row.on === "reintegration-refused" ? REGULATOR.trial : REGULATOR.lease,
        why: [row.description, ...(unit.status === "blocked" ? [unit.reason] : []), RECONSTRUCTED], cites: ["unit.json"],
      });
    } else {
      problem ??= `the replay ends ${status} but the record says ${unit.status}: no record-less transition joins them, so a record is missing or a status was written around the loop`;
    }
  }
  return { steps, final: status, basis: "reconstructed", ...(problem ? { problem } : {}) };
}
