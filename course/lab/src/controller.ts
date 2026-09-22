/**
 * The S3 loop (lesson 06, budgets added in lesson 07): contract → dispatch → close.
 *
 *   contract   check the contract; refuse dispatch if it cannot be honoured
 *   dispatch   record the unit, take the lease and worktree (lesson 05), run a
 *              session under the workload's profile and the policy's budget and
 *              model route for the unit type; a blocked unit may be re-dispatched
 *              under the same contract version while attempts remain
 *   close      read the result report the unit wrote — never the diff — check
 *              it against the exact contract version, reintegrate, release
 *
 * Verify (harness-run checks) and route (the recovery lattice) are lessons
 * 08–09; where they would go, this loop records what happened and stops.
 * The loop is generic: nothing here knows the workload is software.
 *
 * Pi-free. The one Pi-shaped thing, running a session, is injected as a
 * `Dispatcher`, so the loop is tested without a model and driven with one.
 */
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  ATTEMPT_ACTIONS, ExecutionStore, LeaseHeldError, UNITS_RELATIVE_DIR, appendSignal, ceilingFor, checkContract, checkResultReport, readSignals, routeBlockedUnit, routeFor,
  type ContractProblem, type ReportProblem,
} from "@metacoding/vsm-pi-core";
import type { AlgedonicSignal, ModelRoute, OperationalSignal, PolicyDefinition, RecoveryDecision, RecoveryPolicy, ResultReport, WorkContract, WorkloadDefinition } from "@metacoding/vsm-pi-protocol";
import type { Exec } from "./exec.js";
import { abandonUnit, finishUnit, resumeUnit, startUnit } from "./unit.js";
import { unitTypeOf } from "./workload.js";

export interface DispatchRequest {
  unitId: string;
  worktree: string;
  contract: WorkContract;
  /** Absolute path of the immutable contract file the session loads. */
  contractPath: string;
  /** The capability profile the workload declares for this unit type. */
  profile: string;
  /** Which attempt this is, from the unit record. */
  attempt: number;
  /** The models the policy routes this unit type to, primary first. */
  route: ModelRoute;
  /** Absolute path of the policy file the session meters itself against. */
  policyPath: string;
  /** What the recovery router told this attempt about the previous one, when there was one. */
  hint?: string;
}

export type Dispatcher = (request: DispatchRequest) => Promise<{ sessionId?: string }>;

export interface RunUnitOptions {
  repo: string;
  contract: WorkContract;
  workload: WorkloadDefinition;
  policy: PolicyDefinition;
  policyPath: string;
  dispatcher: Dispatcher;
  owner: string;
  now?: () => number;
  ttlMs?: number;
  /** Carried into the dispatch request: the router's hint for this attempt. */
  hint?: string;
}

export type RunUnitOutcome =
  | { status: "refused"; problems: ContractProblem[] }
  | { status: "closed"; report: ResultReport; sha: string; signals: number }
  | { status: "blocked"; reason: "lease-held" | "dispatch-error" | "no-report" | "invalid-report" | "budget-exhausted" | "conflict" | "dirty-base" | "wrong-branch"; problems?: ReportProblem[]; detail?: string };

export async function runUnit(exec: Exec, options: RunUnitOptions): Promise<RunUnitOutcome> {
  const now = options.now ?? Date.now;
  const stamp = () => new Date(now()).toISOString();
  const { contract, workload, policy } = options;

  // contract
  const problems = checkContract(contract);
  if (contract.workload.name !== workload.name || contract.workload.version !== workload.version) {
    problems.push({ path: "workload", message: `contract is for workload ${contract.workload.name} v${contract.workload.version}; the instance runs ${workload.name} v${workload.version}` });
  }
  const unitType = unitTypeOf(workload, contract.unitType);
  if (!unitType) problems.push({ path: "unitType", message: `"${contract.unitType}" is not a unit type of workload ${workload.name}` });
  const ceiling = ceilingFor(policy, contract.unitType);
  const store = new ExecutionStore(options.repo, now);
  const existing = await store.getUnit(contract.unitId);
  if (existing) {
    // A further attempt: only for a blocked unit, under the same contract version, within the attempt ceiling.
    if (existing.status !== "blocked") problems.push({ path: "unitId", message: `unit "${contract.unitId}" exists and is ${existing.status}` });
    else if (existing.contract.id !== contract.id || existing.contract.version !== contract.version) {
      problems.push({ path: "version", message: `unit "${contract.unitId}" runs under ${existing.contract.id} v${existing.contract.version}; a new contract version is a replan (lesson 08), not a retry` });
    } else if (existing.attempts >= ceiling.attempts) {
      problems.push({ path: "attempts", message: `unit "${contract.unitId}" has used its ${ceiling.attempts} attempt(s); S3 must decide something other than trying again` });
    }
  }
  if (problems.length || !unitType) return { status: "refused", problems };

  // dispatch
  if (!existing) await store.createUnit(contract);
  const attemptNumber = (existing?.attempts ?? 0) + 1;
  const contractPath = path.join(options.repo, UNITS_RELATIVE_DIR, contract.unitId, `contract.v${contract.version}.json`);
  let worktree: string;
  try {
    const lifecycle = existing ? resumeUnit : startUnit;
    const started = await lifecycle(exec, {
      repo: options.repo, unitId: contract.unitId, owner: options.owner, now,
      ...(options.ttlMs === undefined ? {} : { ttlMs: options.ttlMs }),
    });
    worktree = started.worktree.path;
  } catch (error) {
    const detail = (error as Error).message;
    await store.setStatus(contract.unitId, "blocked", detail);
    return { status: "blocked", reason: error instanceof LeaseHeldError ? "lease-held" : "dispatch-error", detail };
  }
  await store.setStatus(contract.unitId, "dispatched");
  const startedAt = stamp();
  let sessionId: string | undefined;
  try {
    ({ sessionId } = await options.dispatcher({
      unitId: contract.unitId, worktree, contract, contractPath, profile: unitType.profile,
      attempt: attemptNumber, route: routeFor(policy, contract.unitType), policyPath: options.policyPath,
      ...(options.hint === undefined ? {} : { hint: options.hint }),
    }));
  } catch (error) {
    const detail = (error as Error).message;
    await store.recordAttempt({ unitId: contract.unitId, contractVersion: contract.version, startedAt, endedAt: stamp(), outcome: "error", detail });
    await store.setStatus(contract.unitId, "blocked", `dispatch error: ${detail}`);
    return { status: "blocked", reason: "dispatch-error", detail };
  }

  // close — from the report the unit wrote, never from the domain
  const attempt = { unitId: contract.unitId, contractVersion: contract.version, startedAt, ...(sessionId === undefined ? {} : { sessionId }) };
  const report = await store.getReport(contract.unitId, contract.version);
  const ledger = await store.getBudget(contract.unitId, attemptNumber);
  if (!report && ledger?.exhausted) {
    const detail = `${ledger.exhausted.dimension} ceiling crossed at ${ledger.exhausted.at} (${ledger.consumed.tokens} tokens, ${ledger.consumed.turns} turns)`;
    await store.recordAttempt({ ...attempt, endedAt: stamp(), outcome: "budget-exhausted", detail });
    await store.setStatus(contract.unitId, "blocked", `budget exhausted: ${ledger.exhausted.dimension}`);
    return { status: "blocked", reason: "budget-exhausted", detail };
  }
  if (!report) {
    await store.recordAttempt({ ...attempt, endedAt: stamp(), outcome: "no-report" });
    await store.setStatus(contract.unitId, "blocked", "the unit ended without calling report_result");
    return { status: "blocked", reason: "no-report" };
  }
  const reportProblems = checkResultReport(contract, report);
  if (reportProblems.length) {
    await store.recordAttempt({ ...attempt, endedAt: stamp(), outcome: "invalid-report", detail: reportProblems.map((p) => p.message).join("; ") });
    await store.setStatus(contract.unitId, "blocked", "the result report does not honour the contract");
    return { status: "blocked", reason: "invalid-report", problems: reportProblems };
  }
  await store.recordAttempt({ ...attempt, endedAt: stamp(), outcome: "reported" });
  await store.setStatus(contract.unitId, "reported");
  const signals = await emitReportSignals(options.repo, contract, report, now);

  const finished = await finishUnit(exec, { repo: options.repo, unitId: contract.unitId, now });
  if (!finished.result.merged) {
    await store.setStatus(contract.unitId, "blocked", `reintegration: ${finished.result.reason}`);
    return { status: "blocked", reason: finished.result.reason, ...(finished.signal ? { detail: finished.signal.observation } : {}) };
  }
  await store.setStatus(contract.unitId, "closed");
  return { status: "closed", report, sha: finished.result.sha, signals };
}

/**
 * What the report says that planning did not allocate becomes regulatory
 * information for S3: an emergent decision whose consequence is high, and
 * every deviation. Lesson 08 routes these; until then they are recorded.
 */
async function emitReportSignals(repo: string, contract: WorkContract, report: ResultReport, now: () => number): Promise<number> {
  const signals: OperationalSignal[] = [];
  const base = {
    source: "S1" as const, kind: "operational-signal" as const, channel: "signal" as const, destination: "S3" as const,
    unit: contract.unitId, timestamp: new Date(now()).toISOString(),
  };
  for (const decision of report.emergentDecisions) {
    if (decision.consequenceIfWrong !== "high") continue;
    signals.push({
      ...base, id: randomUUID(), severity: "advisory", subject: `${contract.id} v${contract.version}: emergent decision`,
      observation: `${decision.subject}: ${decision.choiceOrQuestion} (not allocated by the contract; consequence if wrong: high)`,
      evidence: report.evidence,
    });
  }
  for (const deviation of report.deviations) {
    signals.push({
      ...base, id: randomUUID(), severity: "blocking", subject: `${contract.id} v${contract.version}: ${deviation.kind} deviation${deviation.ref ? ` (${deviation.ref})` : ""}`,
      observation: deviation.description, evidence: report.evidence,
    });
  }
  for (const signal of signals) await appendSignal(repo, signal);
  return signals.length;
}

/**
 * route — S3 decides what a blocked unit gets. Classifies the failure from
 * the records, applies the versioned recovery policy, records the decision
 * immutably, and *applies* only what the loop can apply on its own:
 *
 *   abort      release the lease, remove the worktree; the unit is aborted
 *   escalate   an algedonic signal to S5 with the evidence; the unit stays blocked
 *   others     recorded; retry/repair are applied by `driveUnit`, replan/
 *              remediate/clarify/pause wait for a decision from outside the loop
 */
export async function routeUnit(exec: Exec, options: { repo: string; unitId: string; policy: PolicyDefinition; recovery: RecoveryPolicy; now?: () => number }): Promise<RecoveryDecision | undefined> {
  const now = options.now ?? Date.now;
  const store = new ExecutionStore(options.repo, now);
  const unit = await store.getUnit(options.unitId);
  if (!unit) throw new Error(`no unit "${options.unitId}"`);
  const decision = await routeBlockedUnit(store, {
    policy: options.recovery, unitId: options.unitId, attemptCeiling: ceilingFor(options.policy, unit.unitType).attempts,
    signals: await readSignals(options.repo), now,
  });
  if (!decision) return undefined;
  if (decision.action === "abort") {
    await abandonUnit(exec, { repo: options.repo, unitId: options.unitId, now });
    await store.setStatus(options.unitId, "aborted", `aborted under ${decision.policy.name} v${decision.policy.version}: ${decision.cause}`);
  } else if (decision.action === "escalate") {
    const signal: AlgedonicSignal = {
      id: decision.id, timestamp: decision.decidedAt, source: "S3", kind: "algedonic-signal", channel: "algedonic", destination: "S5",
      severity: "blocking", subject: `unit ${options.unitId}: recovery policy exhausted`, unit: options.unitId,
      observation: `${decision.rationale}. Evidence: ${decision.evidence.join("; ") || "none recorded"}`,
      evidence: [{ class: "file", ref: `.regulator/units/${options.unitId}/decisions.ndjson` }],
      requiresHumanAttention: true,
    };
    await appendSignal(options.repo, signal);
    await store.setStatus(options.unitId, "blocked", `escalated to S5: ${decision.cause} (${decision.policy.name} v${decision.policy.version})`);
  } else if (!ATTEMPT_ACTIONS.has(decision.action)) {
    await store.setStatus(options.unitId, "blocked", `awaiting ${decision.action}: ${decision.cause} (${decision.policy.name} v${decision.policy.version})`);
  }
  return decision;
}

export interface DriveUnitOptions extends Omit<RunUnitOptions, "hint"> {
  recovery: RecoveryPolicy;
}

export type DriveUnitOutcome = {
  final: RunUnitOutcome;
  decisions: RecoveryDecision[];
};

/**
 * The autoloop: run, and while the router says retry or repair, run again
 * with its hint. Stops at the first decision the loop cannot apply itself,
 * or when the unit closes or is refused.
 */
export async function driveUnit(exec: Exec, options: DriveUnitOptions): Promise<DriveUnitOutcome> {
  const decisions: RecoveryDecision[] = [];
  let hint: string | undefined;
  for (;;) {
    const outcome = await runUnit(exec, { ...options, ...(hint === undefined ? {} : { hint }) });
    if (outcome.status !== "blocked") return { final: outcome, decisions };
    const decision = await routeUnit(exec, { repo: options.repo, unitId: options.contract.unitId, policy: options.policy, recovery: options.recovery, ...(options.now ? { now: options.now } : {}) });
    if (!decision) return { final: outcome, decisions };
    decisions.push(decision);
    if (!ATTEMPT_ACTIONS.has(decision.action)) return { final: outcome, decisions };
    hint = decision.hint;
  }
}
