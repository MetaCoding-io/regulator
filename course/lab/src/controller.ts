/**
 * The S3 loop, first slice (lesson 06): contract → dispatch → close.
 *
 *   contract   check the contract; refuse dispatch if it cannot be honoured
 *   dispatch   record the unit, take the lease and worktree (lesson 05), run a
 *              session under the workload's profile for the unit type
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
  ExecutionStore, LeaseHeldError, UNITS_RELATIVE_DIR, appendSignal, checkContract, checkResultReport,
  type ContractProblem, type ReportProblem,
} from "@metacoding/vsm-pi-core";
import type { OperationalSignal, ResultReport, WorkContract, WorkloadDefinition } from "@metacoding/vsm-pi-protocol";
import type { Exec } from "./exec.js";
import { finishUnit, startUnit } from "./unit.js";
import { unitTypeOf } from "./workload.js";

export interface DispatchRequest {
  unitId: string;
  worktree: string;
  contract: WorkContract;
  /** Absolute path of the immutable contract file the session loads. */
  contractPath: string;
  /** The capability profile the workload declares for this unit type. */
  profile: string;
}

export type Dispatcher = (request: DispatchRequest) => Promise<{ sessionId?: string }>;

export interface RunUnitOptions {
  repo: string;
  contract: WorkContract;
  workload: WorkloadDefinition;
  dispatcher: Dispatcher;
  owner: string;
  now?: () => number;
  ttlMs?: number;
}

export type RunUnitOutcome =
  | { status: "refused"; problems: ContractProblem[] }
  | { status: "closed"; report: ResultReport; sha: string; signals: number }
  | { status: "blocked"; reason: "lease-held" | "dispatch-error" | "no-report" | "invalid-report" | "conflict" | "dirty-base" | "wrong-branch"; problems?: ReportProblem[]; detail?: string };

export async function runUnit(exec: Exec, options: RunUnitOptions): Promise<RunUnitOutcome> {
  const now = options.now ?? Date.now;
  const stamp = () => new Date(now()).toISOString();
  const { contract, workload } = options;

  // contract
  const problems = checkContract(contract);
  if (contract.workload.name !== workload.name || contract.workload.version !== workload.version) {
    problems.push({ path: "workload", message: `contract is for workload ${contract.workload.name} v${contract.workload.version}; the instance runs ${workload.name} v${workload.version}` });
  }
  const unitType = unitTypeOf(workload, contract.unitType);
  if (!unitType) problems.push({ path: "unitType", message: `"${contract.unitType}" is not a unit type of workload ${workload.name}` });
  if (problems.length || !unitType) return { status: "refused", problems };

  // dispatch
  const store = new ExecutionStore(options.repo, now);
  await store.createUnit(contract);
  const contractPath = path.join(options.repo, UNITS_RELATIVE_DIR, contract.unitId, `contract.v${contract.version}.json`);
  let worktree: string;
  try {
    const started = await startUnit(exec, {
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
    ({ sessionId } = await options.dispatcher({ unitId: contract.unitId, worktree, contract, contractPath, profile: unitType.profile }));
  } catch (error) {
    const detail = (error as Error).message;
    await store.recordAttempt({ unitId: contract.unitId, contractVersion: contract.version, startedAt, endedAt: stamp(), outcome: "error", detail });
    await store.setStatus(contract.unitId, "blocked", `dispatch error: ${detail}`);
    return { status: "blocked", reason: "dispatch-error", detail };
  }

  // close — from the report the unit wrote, never from the domain
  const attempt = { unitId: contract.unitId, contractVersion: contract.version, startedAt, ...(sessionId === undefined ? {} : { sessionId }) };
  const report = await store.getReport(contract.unitId, contract.version);
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
