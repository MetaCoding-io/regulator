/**
 * The S3 loop: contract → dispatch → verify → route → close.
 *
 *   contract   check the contract; refuse dispatch if it cannot be honoured
 *   dispatch   record the unit, take the lease and worktree (lesson 05), run a
 *              session under the workload's profile and the policy's budget and
 *              model route for the unit type; a blocked unit may be re-dispatched
 *              under the same contract version while attempts remain
 *   verify     read the result report the unit wrote — never the diff — check
 *              it against the exact contract version; then run the workload's
 *              checks for the unit type with the harness's own runner against
 *              the committed revision, record the evidence, and derive the
 *              technical verdict (lesson 09). The report's claims satisfy nothing.
 *   route      a blocked unit gets the recovery policy's action (lesson 08)
 *   close      reintegrate, release
 *
 * The loop is generic: nothing here knows the workload is software; the
 * checks it runs are the ones the workload names.
 *
 * Pi-free. The one Pi-shaped thing, running a session, is injected as a
 * `Dispatcher`, so the loop is tested without a model and driven with one.
 */
import { randomUUID } from "node:crypto";
import path from "node:path";
import { bindEvidence, runHostChecks, summarizeVerdict, technicalVerdict } from "@metacoding/vsm-pi-checks";
import {
  ATTEMPT_ACTIONS, AuditLog, ExecutionStore, LeaseHeldError, UNITS_RELATIVE_DIR, WORKTREES_RELATIVE_DIR, appendSignal, ceilingFor, checkContract, checkResultReport, readSignals, routeBlockedUnit, routeFor,
  type ContractProblem, type ReportProblem,
} from "@metacoding/vsm-pi-core";
import type {
  AlgedonicSignal, AuditFinding, EvidenceRecord, ModelRoute, OperationalSignal, PolicyDefinition, RecoveryDecision, RecoveryPolicy, ResultReport, TechnicalVerdict, UnitType,
  WorkContract, WorkloadDefinition,
} from "@metacoding/vsm-pi-protocol";
import type { Exec } from "./exec.js";
import { abandonUnit, finishUnit, resumeUnit, startUnit } from "./unit.js";
import { unitTypeOf } from "./workload.js";
import { headRevision, isClean } from "./worktree.js";

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
  | { status: "blocked"; reason: "lease-held" | "dispatch-error" | "no-report" | "invalid-report" | "budget-exhausted" | "check-failure" | "conflict" | "dirty-base" | "wrong-branch"; problems?: ReportProblem[]; detail?: string; verdict?: TechnicalVerdict };

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
  const report = await store.getReport(contract.unitId, contract.version, attemptNumber);
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
  // verify — the harness's own checks against the committed revision; the report's claims satisfy nothing
  const audit = await auditUnit(exec, { repo: options.repo, contract, unitType, report, attempt: attemptNumber, now });
  if (audit.verdict.verdict !== "pass") {
    // The attempt record carries the reasons: that is what the router's hint is built from.
    const summary = summarizeVerdict(audit.verdict);
    const detail = `${summary} — ${audit.verdict.reasons.join("; ")}`;
    await store.recordAttempt({ ...attempt, endedAt: stamp(), outcome: "check-failure", detail });
    await store.setStatus(contract.unitId, "blocked", `audit refused closeout: ${summary}`);
    return { status: "blocked", reason: "check-failure", detail, verdict: audit.verdict };
  }
  await store.recordAttempt({ ...attempt, endedAt: stamp(), outcome: "reported" });
  return closeVerifiedUnit(exec, { repo: options.repo, contract, report, now });
}

async function closeVerifiedUnit(exec: Exec, options: { repo: string; contract: WorkContract; report: ResultReport; now: () => number }): Promise<RunUnitOutcome> {
  const { contract, report, now } = options;
  const store = new ExecutionStore(options.repo, now);
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

export interface AuditOutcome {
  verdict: TechnicalVerdict;
  /** The records this audit produced (none when the worktree was dirty: nothing binds to a revision then). */
  records: EvidenceRecord[];
  revision: string;
}

/**
 * verify — S3*'s deterministic layer, run by the orchestrator. Runs the
 * checks the workload names for the unit type against the unit's worktree at
 * its committed revision, appends every result to the audit log as evidence
 * bound to that revision, and derives the technical verdict from all the
 * evidence the log holds that is fresh for it — plus human acceptances for
 * the criteria no check can observe. A dirty worktree is inconclusive by
 * construction: evidence about an uncommitted tree binds to nothing.
 *
 * A verdict other than pass is also an audit finding on the audit channel,
 * S3* → S3, so the read model shows it next to the unit.
 */
export async function auditUnit(exec: Exec, options: { repo: string; contract: WorkContract; unitType: UnitType; report: ResultReport; attempt: number; now?: () => number }): Promise<AuditOutcome> {
  const now = options.now ?? Date.now;
  const { contract, report, unitType } = options;
  const unitId = contract.unitId;
  const worktree = path.join(options.repo, WORKTREES_RELATIVE_DIR, unitId);
  const log = new AuditLog(options.repo);
  const clean = await isClean(exec, worktree);
  const revision = await headRevision(exec, worktree);
  let records: EvidenceRecord[] = [];
  if (clean) {
    const results = await runHostChecks(exec, { cwd: worktree, checks: unitType.checks, fileRefs: report.evidence.filter((e) => e.class === "file").map((e) => e.ref) });
    records = bindEvidence(results, { unitId, attempt: options.attempt, contract: { id: contract.id, version: contract.version }, expectations: contract.expectedEvidence, revision, now });
    for (const record of records) await log.appendEvidence(record);
  }
  const held = await log.forUnit(unitId);
  let verdict = technicalVerdict({ contract, report, records: held.evidence, acceptances: held.acceptances, unitId, attempt: options.attempt, revision, now });
  if (!clean) verdict = { ...verdict, verdict: "inconclusive", reasons: [`the worktree has uncommitted changes: evidence cannot be bound to revision ${revision.slice(0, 7)}`, ...verdict.reasons] };
  await log.appendVerdict(verdict);
  if (verdict.verdict !== "pass") {
    const finding: AuditFinding = {
      id: verdict.id, timestamp: verdict.at, source: "S3*", kind: "audit-finding", channel: "audit", destination: "S3",
      severity: verdict.verdict === "fail" ? "blocking" : "advisory", subject: `unit ${unitId}: closeout refused (${verdict.verdict})`, unit: unitId,
      invariant: "INV-003", observation: verdict.reasons.join("; ") || summarizeVerdict(verdict),
      evidence: records.map((r) => ({ class: r.class, ref: r.check, observation: r.observation.split("\n")[0] ?? "", sourceRevision: revision })),
      suggestedAction: verdict.verdict === "fail" ? "repair: the checks fail at the committed revision" : "produce the missing evidence, or a human accepts the criteria no check can observe, then `regulator unit close`",
    };
    await appendSignal(options.repo, finding);
  }
  return { verdict, records, revision };
}

/**
 * close — re-audit a unit blocked at verification without spending an attempt,
 * and close it if the verdict is now pass. This is how a unit proceeds after a
 * human accepts a criterion no check can observe, or after evidence that was
 * missing for an environmental reason can be produced. The attempt history is
 * untouched: a re-audit is not an attempt.
 */
export async function closeUnit(exec: Exec, options: { repo: string; unitId: string; workload: WorkloadDefinition; now?: () => number }): Promise<RunUnitOutcome> {
  const now = options.now ?? Date.now;
  const store = new ExecutionStore(options.repo, now);
  const unit = await store.getUnit(options.unitId);
  if (!unit) throw new Error(`no unit "${options.unitId}"`);
  const problems: ContractProblem[] = [];
  if (unit.status !== "blocked") problems.push({ path: "status", message: `unit "${unit.unitId}" is ${unit.status}; only a blocked unit is re-audited` });
  const contract = await store.getContract(unit.unitId, unit.contract.version);
  const report = await store.getReport(unit.unitId, unit.contract.version, unit.attempts);
  const unitType = unitTypeOf(options.workload, unit.unitType);
  if (!contract) problems.push({ path: "contract", message: `contract ${unit.contract.id} v${unit.contract.version} is missing from the store` });
  if (!report) problems.push({ path: "report", message: `attempt ${unit.attempts} wrote no report; there is nothing to audit` });
  if (!unitType) problems.push({ path: "unitType", message: `"${unit.unitType}" is not a unit type of workload ${options.workload.name}` });
  if (problems.length || !contract || !report || !unitType) return { status: "refused", problems };
  const audit = await auditUnit(exec, { repo: options.repo, contract, unitType, report, attempt: unit.attempts, now });
  if (audit.verdict.verdict !== "pass") {
    const detail = summarizeVerdict(audit.verdict);
    await store.setStatus(unit.unitId, "blocked", `audit refused closeout: ${detail}`);
    return { status: "blocked", reason: "check-failure", detail, verdict: audit.verdict };
  }
  return closeVerifiedUnit(exec, { repo: options.repo, contract, report, now });
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
