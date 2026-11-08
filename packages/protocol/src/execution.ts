/**
 * Execution state: what the orchestrator owns and nothing else infers.
 * Units, attempts and leases. Regulatory state (signals, findings,
 * obligations) lives elsewhere and is never derived from these records.
 */
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";
import type { ENFORCEMENT_POINTS } from "./registry.js";

const NonEmpty = Type.String({ minLength: 1 });

export const UnitStatusSchema = Type.Union([
  Type.Literal("contracted"),
  Type.Literal("dispatched"),
  Type.Literal("reported"),
  Type.Literal("closed"),
  Type.Literal("blocked"),
  /** Terminal: S3 gave up on this unit under policy. Its lease and worktree are gone; its history is not. */
  Type.Literal("aborted"),
]);
export type UnitStatus = Static<typeof UnitStatusSchema>;

/** The statuses a unit never leaves. */
export const TERMINAL_UNIT_STATUSES: ReadonlySet<UnitStatus> = new Set<UnitStatus>(["closed", "aborted"]);

/**
 * What moves a unit from one status to the next, as the loop names it. A trigger is the loop's reason, not the
 * attempt's outcome: `attempt-failed` covers every way an attempt ends short of closing, and the attempt record says which.
 */
export const UNIT_TRIGGERS = [
  "dispatch", "dispatch-refused", "attempt-failed", "verified", "re-verified", "re-audit-refused",
  "reintegrated", "reintegration-refused", "routed-waiting", "abort",
] as const;
export type UnitTrigger = (typeof UNIT_TRIGGERS)[number];

/** A step of the loop that writes a unit's status: one of the loop's declared enforcement points. */
export type UnitTransitionStep = Extract<(typeof ENFORCEMENT_POINTS)["loop"][number], "runUnit" | "closeUnit" | "routeUnit" | "finishUnit">;

export interface UnitTransition {
  from: UnitStatus;
  to: UnitStatus;
  on: UnitTrigger;
  /** The loop step that takes it. */
  by: UnitTransitionStep;
  /** Taken by the loop on its own, or only after something outside it: a policy decision, a person's answer, a disposition. */
  automatic: boolean;
  description: string;
}

/**
 * The unit lifecycle, as a closed table: every transition the S3 loop takes, and no other. The execution store
 * refuses a status change that is not a row here, so a unit's status history is a path through this table and a
 * figure drawn from it shows every path a unit can take. A new row is a change to the loop, made in the same change.
 */
export const UNIT_TRANSITIONS: readonly UnitTransition[] = [
  { from: "contracted", to: "dispatched", on: "dispatch", by: "runUnit", automatic: true, description: "the contract passed the gate and the progression veto; the lease is held, the worktree is open, attempt 1 runs" },
  { from: "contracted", to: "blocked", on: "dispatch-refused", by: "runUnit", automatic: true, description: "the lease is held by another owner, or the worktree could not be started; no attempt was spent" },
  { from: "blocked", to: "dispatched", on: "dispatch", by: "runUnit", automatic: false, description: "a further attempt under the same contract version: the router said retry or repair, or a person answered what the unit waited on" },
  { from: "blocked", to: "blocked", on: "dispatch-refused", by: "runUnit", automatic: false, description: "a further attempt could not start: the lease is held, or the worktree could not be resumed" },
  { from: "dispatched", to: "blocked", on: "attempt-failed", by: "runUnit", automatic: true, description: "the attempt ended without closing: a dispatch error, a question nobody answered, a budget ceiling, no report, a report that does not honour the contract, or closeout refused by the host's checks" },
  { from: "dispatched", to: "reported", on: "verified", by: "runUnit", automatic: true, description: "the report honours the contract and the technical verdict is pass at the committed revision" },
  { from: "blocked", to: "reported", on: "re-verified", by: "closeUnit", automatic: false, description: "a re-audit without a new attempt passed: a person accepted a criterion no check observes, or the missing evidence could be produced" },
  { from: "blocked", to: "blocked", on: "re-audit-refused", by: "closeUnit", automatic: false, description: "a re-audit without a new attempt was refused again" },
  { from: "reported", to: "closed", on: "reintegrated", by: "finishUnit", automatic: true, description: "the pre-merge trial passed and the branch landed on the base; the lease and the worktree are gone" },
  { from: "reported", to: "blocked", on: "reintegration-refused", by: "finishUnit", automatic: true, description: "the trial merge failed its checks or conflicted, the base was dirty or moved, or the checkout was on the wrong branch; nothing landed" },
  { from: "blocked", to: "blocked", on: "routed-waiting", by: "routeUnit", automatic: true, description: "the recovery policy named an action the loop cannot apply (remediate, replan, clarify, pause) or was exhausted (escalate): an obligation is opened for the consumer the routing policy names, and the unit waits on it" },
  { from: "blocked", to: "aborted", on: "abort", by: "routeUnit", automatic: true, description: "the recovery policy said abort: the lease is released and the worktree removed; the history stays" },
];

/** The rows from one status to another: several when the loop has more than one reason to take the same edge. */
export function unitTransitions(from: UnitStatus, to: UnitStatus): UnitTransition[] {
  return UNIT_TRANSITIONS.filter((t) => t.from === from && t.to === to);
}

/** The row a trigger names from a status, if the table has one. */
export function unitTransition(from: UnitStatus, on: UnitTrigger): UnitTransition | undefined {
  return UNIT_TRANSITIONS.find((t) => t.from === from && t.on === on);
}

export const UnitRecordSchema = Type.Object({
  unitId: Type.String({ pattern: "^[a-zA-Z0-9._-]+$" }),
  unitType: NonEmpty,
  workload: Type.Object({ name: NonEmpty, version: Type.Integer({ minimum: 1 }) }, { additionalProperties: false }),
  contract: Type.Object({ id: NonEmpty, version: Type.Integer({ minimum: 1 }) }, { additionalProperties: false }),
  status: UnitStatusSchema,
  attempts: Type.Integer({ minimum: 0 }),
  createdAt: NonEmpty,
  updatedAt: NonEmpty,
  /** Why the unit is blocked, when it is. */
  reason: Type.Optional(NonEmpty),
}, { additionalProperties: false });
export type UnitRecord = Static<typeof UnitRecordSchema>;

export const AttemptOutcomeSchema = Type.Union([
  Type.Literal("reported"),
  Type.Literal("no-report"),
  Type.Literal("invalid-report"),
  Type.Literal("budget-exhausted"),
  /** The report was valid but host-run verification refused closeout (lesson 09). */
  Type.Literal("check-failure"),
  /** The session asked a person and no answer came (lesson 13): the unit waits on the obligation, and nothing is routed. */
  Type.Literal("paused"),
  Type.Literal("error"),
]);
export type AttemptOutcome = Static<typeof AttemptOutcomeSchema>;

/** Immutable once written: an attempt happened, whatever it produced. */
export const AttemptRecordSchema = Type.Object({
  unitId: NonEmpty,
  attempt: Type.Integer({ minimum: 1 }),
  contractVersion: Type.Integer({ minimum: 1 }),
  startedAt: NonEmpty,
  endedAt: NonEmpty,
  outcome: AttemptOutcomeSchema,
  sessionId: Type.Optional(NonEmpty),
  detail: Type.Optional(NonEmpty),
  /**
   * For a command unit (#122): the program that ran, by its file under the definition and that file's SHA-256, and how
   * it ended — its exit code, or none when it was stopped at the wall-clock ceiling. A session attempt carries none.
   */
  program: Type.Optional(Type.Object({
    file: NonEmpty,
    sha256: Type.String({ pattern: "^[0-9a-f]{64}$" }),
    exit: Type.Optional(Type.Integer()),
  }, { additionalProperties: false })),
}, { additionalProperties: false });
export type AttemptRecord = Static<typeof AttemptRecordSchema>;
export type AttemptProgram = NonNullable<AttemptRecord["program"]>;

export const LeaseSchema = Type.Object({
  unitId: Type.String({ pattern: "^[a-zA-Z0-9._-]+$" }),
  owner: NonEmpty,
  /** Absolute path of the directory the lease grants writes to. */
  resource: NonEmpty,
  branch: NonEmpty,
  acquiredAt: Type.Number(),
  heartbeatAt: Type.Number(),
  expiresAt: Type.Number(),
}, { additionalProperties: false });
export type Lease = Static<typeof LeaseSchema>;

export const BudgetDimensionSchema = Type.Union([
  Type.Literal("tokens"), Type.Literal("cost"), Type.Literal("wallClockMs"), Type.Literal("turns"),
]);
export type BudgetDimension = Static<typeof BudgetDimensionSchema>;

/**
 * The running account of what one attempt has consumed against its ceiling.
 * Written by the budget guard in the session, read by the orchestrator at
 * close and by the read model. A counter, so it is rewritten; the ceiling it
 * carries is the policy's at dispatch and does not change mid-attempt.
 */
export const BudgetLedgerSchema = Type.Object({
  unitId: NonEmpty,
  attempt: Type.Integer({ minimum: 1 }),
  ceiling: Type.Object({
    tokens: Type.Integer({ minimum: 1 }),
    cost: Type.Optional(Type.Number({ minimum: 0 })),
    wallClockMs: Type.Integer({ minimum: 1 }),
    turns: Type.Integer({ minimum: 1 }),
  }, { additionalProperties: false }),
  consumed: Type.Object({
    tokens: Type.Integer({ minimum: 0 }),
    cost: Type.Number({ minimum: 0 }),
    wallClockMs: Type.Integer({ minimum: 0 }),
    turns: Type.Integer({ minimum: 0 }),
  }, { additionalProperties: false }),
  startedAt: NonEmpty,
  updatedAt: NonEmpty,
  /** The model(s) the attempt ran on, in order; a second entry means a switch or a fallback. */
  models: Type.Array(NonEmpty),
  /** Set once, when a ceiling was crossed: the guard halted the attempt. */
  exhausted: Type.Optional(Type.Object({ dimension: BudgetDimensionSchema, at: NonEmpty }, { additionalProperties: false })),
  /** Compactions that happened during the attempt, with whether the contract block was carried. */
  compactions: Type.Array(Type.Object({ at: NonEmpty, reason: NonEmpty, preserved: Type.Boolean() }, { additionalProperties: false })),
}, { additionalProperties: false });
export type BudgetLedger = Static<typeof BudgetLedgerSchema>;

export function isUnitRecord(value: unknown): value is UnitRecord {
  return Value.Check(UnitRecordSchema, value);
}
export function isAttemptRecord(value: unknown): value is AttemptRecord {
  return Value.Check(AttemptRecordSchema, value);
}
export function isLease(value: unknown): value is Lease {
  return Value.Check(LeaseSchema, value);
}
