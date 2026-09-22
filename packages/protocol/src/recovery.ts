/**
 * Failure, recovery, and durable effects (lesson 08).
 *
 * A failed attempt is normalized to a cause; a versioned recovery policy
 * maps the cause, and how often it has recurred, to exactly one action;
 * the decision is recorded with the policy version that produced it. "Retry"
 * is one action among eight, and escalation is what happens when the policy
 * has nothing left to say.
 *
 * An effect journal entry is written *before* a side-effecting tool acts, so
 * a harness that dies between the effect and its record can find out, on
 * restart, whether the effect happened rather than doing it again.
 */
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";

const NonEmpty = Type.String({ minLength: 1 });

export const FailureCauseSchema = Type.Union([
  Type.Literal("budget-exhausted"),
  Type.Literal("no-report"),
  Type.Literal("invalid-report"),
  Type.Literal("check-failure"),
  Type.Literal("tool-error"),
  Type.Literal("timeout"),
  Type.Literal("ambiguity"),
  Type.Literal("environment"),
  Type.Literal("conflict"),
  Type.Literal("oscillation"),
  Type.Literal("dispatch-error"),
  Type.Literal("unknown"),
]);
export type FailureCause = Static<typeof FailureCauseSchema>;

/** GSD-Pi's vocabulary, plus `escalate`: the action when the policy is exhausted. */
export const RecoveryActionSchema = Type.Union([
  Type.Literal("retry"),
  Type.Literal("repair"),
  Type.Literal("replan"),
  Type.Literal("remediate"),
  Type.Literal("clarify"),
  Type.Literal("pause"),
  Type.Literal("abort"),
  Type.Literal("escalate"),
]);
export type RecoveryAction = Static<typeof RecoveryActionSchema>;

export const RecoveryRuleSchema = Type.Object({
  cause: FailureCauseSchema,
  /** The action for the first, second, … occurrence of the cause on one unit; the last repeats. */
  actions: Type.Array(RecoveryActionSchema, { minItems: 1 }),
}, { additionalProperties: false });
export type RecoveryRule = Static<typeof RecoveryRuleSchema>;

export const RecoveryPolicySchema = Type.Object({
  name: Type.String({ pattern: "^[a-z][a-z0-9-]*$" }),
  version: Type.Integer({ minimum: 1 }),
  description: NonEmpty,
  rules: Type.Array(RecoveryRuleSchema),
  /** For a cause no rule names. */
  fallback: Type.Array(RecoveryActionSchema, { minItems: 1 }),
}, { additionalProperties: false });
export type RecoveryPolicy = Static<typeof RecoveryPolicySchema>;

/** A normalized failure seen during an attempt: a tool error, a provider error, or what the orchestrator observed at close. */
export const FailureObservationSchema = Type.Object({
  unitId: NonEmpty,
  attempt: Type.Integer({ minimum: 1 }),
  at: NonEmpty,
  source: Type.Union([Type.Literal("tool"), Type.Literal("provider"), Type.Literal("orchestrator")]),
  toolName: Type.Optional(NonEmpty),
  cause: FailureCauseSchema,
  message: NonEmpty,
}, { additionalProperties: false });
export type FailureObservation = Static<typeof FailureObservationSchema>;

/** Immutable: one decision per routed failure, citing the policy version that produced it. */
export const RecoveryDecisionSchema = Type.Object({
  id: NonEmpty,
  unitId: NonEmpty,
  /** The attempt that failed. */
  attempt: Type.Integer({ minimum: 1 }),
  cause: FailureCauseSchema,
  /** How many times this cause has now been routed for this unit, this one included. */
  occurrence: Type.Integer({ minimum: 1 }),
  evidence: Type.Array(NonEmpty),
  action: RecoveryActionSchema,
  policy: Type.Object({ name: NonEmpty, version: Type.Integer({ minimum: 1 }) }, { additionalProperties: false }),
  rationale: NonEmpty,
  /** For retry and repair: what the next attempt is told about this one. */
  hint: Type.Optional(NonEmpty),
  /** For clarify: the question S3 needs answered before the unit can continue. */
  question: Type.Optional(NonEmpty),
  decidedAt: NonEmpty,
  decidedBy: Type.Literal("S3"),
}, { additionalProperties: false });
export type RecoveryDecision = Static<typeof RecoveryDecisionSchema>;

export const EffectStatusSchema = Type.Union([
  /** Written before the effect: the harness intends to do this. */
  Type.Literal("intended"),
  /** The effect ran and its result was recorded. */
  Type.Literal("committed"),
  /** Reconciliation found the effect had happened although no commit was recorded. */
  Type.Literal("confirmed"),
  /** Reconciliation found the effect had not happened. */
  Type.Literal("absent"),
]);
export type EffectStatus = Static<typeof EffectStatusSchema>;

/** One line of the effect journal. State is the fold of all lines for a key. */
export const EffectJournalEntrySchema = Type.Object({
  /** Idempotency key: the same intended effect always has the same key. */
  key: NonEmpty,
  unitId: Type.Optional(NonEmpty),
  tool: NonEmpty,
  description: NonEmpty,
  status: EffectStatusSchema,
  at: NonEmpty,
  result: Type.Optional(NonEmpty),
}, { additionalProperties: false });
export type EffectJournalEntry = Static<typeof EffectJournalEntrySchema>;

export function isRecoveryPolicy(value: unknown): value is RecoveryPolicy {
  return Value.Check(RecoveryPolicySchema, value);
}
export function isRecoveryDecision(value: unknown): value is RecoveryDecision {
  return Value.Check(RecoveryDecisionSchema, value);
}
