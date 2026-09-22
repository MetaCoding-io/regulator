/**
 * Execution state: what the orchestrator owns and nothing else infers.
 * Units, attempts and leases. Regulatory state (signals, findings,
 * obligations) lives elsewhere and is never derived from these records.
 */
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";

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
}, { additionalProperties: false });
export type AttemptRecord = Static<typeof AttemptRecordSchema>;

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
