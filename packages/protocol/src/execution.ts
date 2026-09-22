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

export function isUnitRecord(value: unknown): value is UnitRecord {
  return Value.Check(UnitRecordSchema, value);
}
export function isAttemptRecord(value: unknown): value is AttemptRecord {
  return Value.Check(AttemptRecordSchema, value);
}
export function isLease(value: unknown): value is Lease {
  return Value.Check(LeaseSchema, value);
}
