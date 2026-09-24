/**
 * The recovery router (lesson 08): S3's answer to "attempt one failed".
 *
 *   classifyFailure    what happened, normalized to one cause from what the
 *                      orchestrator recorded (attempt outcome, block reason),
 *                      what the session observed (tool and provider failures),
 *                      and what S2 signalled (oscillation, conflict)
 *   decideRecovery     which action the versioned policy names for this cause
 *                      on its Nth occurrence — with the attempt ceiling as the
 *                      hard stop: an action that needs another attempt when
 *                      none remain becomes `escalate`
 *   routeBlockedUnit   both, over the execution store, recording the decision
 *                      immutably with the policy version that produced it
 *
 * Pi-free and git-free. It decides; applying the decision is the loop's job.
 */
import { randomUUID } from "node:crypto";
import type {
  AttemptRecord, FailureCause, FailureObservation, RecoveryAction, RecoveryDecision, RecoveryPolicy, UnitRecord, VsmMessage,
} from "@metacoding/regulator-protocol";
import type { ExecutionStore } from "./execution-store.js";

export interface FailureContext {
  unit: UnitRecord;
  attempts: AttemptRecord[];
  observations: FailureObservation[];
  /** Unrouted signals for the instance; only those naming the unit are considered. */
  signals: VsmMessage[];
}

export interface Classification {
  cause: FailureCause;
  evidence: string[];
}

/** Normalize an error message the way the session's observer does: environment, timeout, or a plain tool error. */
export function causeFromError(message: string): FailureCause {
  if (/timed? ?out|ETIMEDOUT|deadline/i.test(message)) return "timeout";
  if (/ENOENT|EACCES|EPERM|not found|no such file|cannot find module|missing dependency|command not found|no model in the route|not available|ECONNREFUSED|ENOTFOUND/i.test(message)) return "environment";
  return "tool-error";
}

export function classifyFailure(context: FailureContext): Classification {
  const { unit, attempts, observations, signals } = context;
  const last = attempts.at(-1);
  const evidence: string[] = [];
  if (last?.detail) evidence.push(`attempt ${last.attempt}: ${last.outcome} — ${last.detail}`);
  else if (last) evidence.push(`attempt ${last.attempt}: ${last.outcome}`);
  if (unit.reason) evidence.push(`unit: ${unit.reason}`);
  const mine = signals.filter((s) => "unit" in s && s.unit === unit.unitId);
  const observed = observations.filter((o) => o.attempt === (last?.attempt ?? 0));
  for (const o of observed.slice(-3)) evidence.push(`${o.source}${o.toolName ? ` ${o.toolName}` : ""}: ${o.cause} — ${o.message}`);

  if (unit.reason?.startsWith("reintegration: conflict")) return { cause: "conflict", evidence };
  if (unit.reason?.startsWith("reintegration:")) return { cause: "environment", evidence };
  if (last?.outcome === "budget-exhausted") return { cause: "budget-exhausted", evidence };
  if (last?.outcome === "invalid-report") return { cause: "invalid-report", evidence };
  if (last?.outcome === "check-failure") return { cause: "check-failure", evidence };
  if (last?.outcome === "error") return { cause: last.detail ? causeFromError(last.detail) : "dispatch-error", evidence };
  if (mine.some((s) => s.kind === "coordination-signal" && s.coordination === "oscillation")) return { cause: "oscillation", evidence };
  if (last?.outcome === "no-report") {
    // The session's own observations refine a silent end: the last normalized failure wins.
    const refined = observed.at(-1)?.cause;
    if (refined === "environment" || refined === "timeout" || refined === "tool-error" || refined === "check-failure" || refined === "invalid-report") return { cause: refined, evidence };
    return { cause: "no-report", evidence };
  }
  if (!last && unit.reason) return { cause: causeFromError(unit.reason) === "environment" ? "environment" : "dispatch-error", evidence };
  return { cause: "unknown", evidence };
}

/** Actions that spend another attempt. */
export const ATTEMPT_ACTIONS: ReadonlySet<RecoveryAction> = new Set(["retry", "repair"]);
/** Actions after which nothing further runs without a decision from outside the loop. */
export const TERMINAL_ACTIONS: ReadonlySet<RecoveryAction> = new Set(["abort", "escalate", "pause"]);

export interface DecideOptions {
  policy: RecoveryPolicy;
  cause: FailureCause;
  /** How many times this cause has been routed for the unit, this one included. */
  occurrence: number;
  attemptsUsed: number;
  attemptCeiling: number;
}

export interface Decided {
  action: RecoveryAction;
  rationale: string;
}

export function decideRecovery(options: DecideOptions): Decided {
  const { policy, cause, occurrence, attemptsUsed, attemptCeiling } = options;
  const rule = policy.rules.find((r) => r.cause === cause);
  const actions = rule?.actions ?? policy.fallback;
  const index = Math.min(occurrence, actions.length) - 1;
  const action = actions[index]!;
  const source = rule ? `rule for ${cause}` : `fallback (no rule for ${cause})`;
  if (ATTEMPT_ACTIONS.has(action) && attemptsUsed >= attemptCeiling) {
    return {
      action: "escalate",
      rationale: `${policy.name} v${policy.version} ${source}, occurrence ${occurrence}, names ${action}; the unit has used ${attemptsUsed} of ${attemptCeiling} attempt(s), so the policy is exhausted`,
    };
  }
  return { action, rationale: `${policy.name} v${policy.version} ${source}, occurrence ${occurrence} → ${action}${occurrence > actions.length ? " (last action repeats)" : ""}` };
}

/** What the next attempt is told, when there is one. */
export function hintFor(cause: FailureCause, action: RecoveryAction, evidence: readonly string[]): string | undefined {
  if (!ATTEMPT_ACTIONS.has(action)) return undefined;
  const detail = evidence.join("; ") || "no detail recorded";
  switch (cause) {
    case "invalid-report":
      return `Your previous attempt's report_result was refused: ${detail}. The work in the worktree stands; fix the report, not the contract.`;
    case "check-failure":
      return `Host-run verification refused closeout of your previous attempt: ${detail}. The evidence the harness produced, not the report, decides. Fix the code so every check passes on the committed tree, commit, run run_tests and run_checks again, and report again.`;
    case "conflict":
      return `Reintegrating your branch conflicts with the base: ${detail}. Merge the base branch into the unit branch, resolve the conflicts without changing what the contract fixes, run the checks, and commit. Your report already stands.`;
    case "budget-exhausted":
      return `The previous attempt ran out of budget: ${detail}. Do not repeat work that is already committed in the worktree; go straight to what is missing and report.`;
    case "timeout":
      return `The previous attempt timed out: ${detail}. Prefer narrower commands and bounded test runs.`;
    default:
      return `The previous attempt ended without a report (${cause}): ${detail}. Continue from the worktree as you find it and call report_result before you finish.`;
  }
}

export function questionFor(cause: FailureCause, evidence: readonly string[]): string {
  return cause === "oscillation"
    ? `The unit is oscillating between fixes, which usually means a requirement is undecided. Which behaviour is wanted? (${evidence.join("; ") || "see the unit's signals"})`
    : `The unit cannot proceed without a decision from outside it (${cause}): ${evidence.join("; ") || "see the unit's record"}`;
}

export interface RouteOptions {
  policy: RecoveryPolicy;
  unitId: string;
  attemptCeiling: number;
  signals: VsmMessage[];
  now?: () => number;
}

/** Classify, decide, and record — once per blocked state. Returns the decision, or undefined if the unit is not blocked. */
export async function routeBlockedUnit(store: ExecutionStore, options: RouteOptions): Promise<RecoveryDecision | undefined> {
  const now = options.now ?? Date.now;
  const unit = await store.getUnit(options.unitId);
  if (!unit || unit.status !== "blocked") return undefined;
  const attempts = await store.listAttempts(unit.unitId);
  const observations = await store.listObservations(unit.unitId);
  const prior = await store.listDecisions(unit.unitId);
  const { cause, evidence } = classifyFailure({ unit, attempts, observations, signals: options.signals });
  const occurrence = prior.filter((d) => d.cause === cause).length + 1;
  const decided = decideRecovery({ policy: options.policy, cause, occurrence, attemptsUsed: unit.attempts, attemptCeiling: options.attemptCeiling });
  const hint = hintFor(cause, decided.action, evidence);
  const decision: RecoveryDecision = {
    id: randomUUID(),
    unitId: unit.unitId,
    attempt: Math.max(1, unit.attempts),
    cause,
    occurrence,
    evidence,
    action: decided.action,
    policy: { name: options.policy.name, version: options.policy.version },
    rationale: decided.rationale,
    ...(hint === undefined ? {} : { hint }),
    ...(decided.action === "clarify" ? { question: questionFor(cause, evidence) } : {}),
    decidedAt: new Date(now()).toISOString(),
    decidedBy: "S3",
  };
  await store.recordDecision(decision);
  return decision;
}
