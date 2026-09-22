/**
 * Obligations and routing (lesson 11).
 *
 * A message records something that happened. An obligation records something
 * the metasystem has not yet shown it absorbed. The lifecycle is small and
 * has no in-progress state — the orchestrator owns work-in-progress:
 *
 *   open → acknowledged → resolved | escalated | superseded
 *
 * Terminal records never reopen in place; later evidence opens a successor.
 * State is the fold of immutable events appended to the regulatory log, so
 * an obligation's history is its record. Which messages become obligations,
 * for whom, and which open obligations veto a unit's progression is declared
 * in a versioned routing policy — not decided by the emitting model.
 */
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";
import { RecoveryActionSchema } from "./recovery.js";
import { SeveritySchema } from "./severity.js";
import { VsmSystemSchema } from "./vsm-systems.js";

const NonEmpty = Type.String({ minLength: 1 });

export const ObligationStatusSchema = Type.Union([
  Type.Literal("open"),
  Type.Literal("acknowledged"),
  Type.Literal("resolved"),
  Type.Literal("escalated"),
  Type.Literal("superseded"),
]);
export type ObligationStatus = Static<typeof ObligationStatusSchema>;

/** How an obligation was dispositioned. Separate from status: every outcome is not a state. */
export const DispositionSchema = Type.Union([
  Type.Literal("no-action"),
  Type.Literal("accepted-risk"),
  Type.Literal("rework"),
  Type.Literal("replan"),
  Type.Literal("fixed"),
  Type.Literal("verified"),
  Type.Literal("rejected"),
  /** Accepted into identity or policy by an explicit S5-authority path (lesson 12). */
  Type.Literal("accepted"),
  Type.Literal("research-requested"),
  Type.Literal("audit-requested"),
  Type.Literal("policy-clarification-requested"),
]);
export type Disposition = Static<typeof DispositionSchema>;

/** Who must disposition an obligation: a VSM function, or a person. */
export const ConsumerSchema = Type.Union([VsmSystemSchema, Type.Literal("human")]);
export type Consumer = Static<typeof ConsumerSchema>;

/** What an obligation is about: a message kind, or a recovery decision the loop cannot apply on its own. */
export const ConcernSchema = Type.Union([
  Type.Literal("audit-finding"),
  Type.Literal("policy-proposal"),
  Type.Literal("constraint"),
  Type.Literal("operational-signal"),
  Type.Literal("coordination-signal"),
  Type.Literal("intelligence-signal"),
  Type.Literal("algedonic-signal"),
  Type.Literal("uncertainty-signal"),
  Type.Literal("recovery-decision"),
]);
export type Concern = Static<typeof ConcernSchema>;

export const ObligationSchema = Type.Object({
  id: NonEmpty,
  subject: NonEmpty,
  /** The unit the concern is about, when it is about one. */
  unit: Type.Optional(NonEmpty),
  concern: ConcernSchema,
  /** The message ids, decision ids or predecessor obligation ids this obligation was opened from. */
  sources: Type.Array(NonEmpty, { minItems: 1 }),
  /** Effective severity: the router's, derived under policy — never the emitting model's claim. */
  severity: SeveritySchema,
  consumer: ConsumerSchema,
  /** While open, the named unit may not be dispatched or closed. Derived from severity under policy. */
  blocks: Type.Boolean(),
  /** For a clarification: what must be answered. */
  question: Type.Optional(NonEmpty),
  openedAt: NonEmpty,
  /** The function that routed it. */
  openedBy: VsmSystemSchema,
}, { additionalProperties: false });
export type Obligation = Static<typeof ObligationSchema>;

const EventBase = { id: NonEmpty, at: NonEmpty, by: NonEmpty };

export const ObligationEventSchema = Type.Union([
  Type.Object({ type: Type.Literal("obligation-opened"), ...EventBase, obligation: ObligationSchema }, { additionalProperties: false }),
  Type.Object({ type: Type.Literal("obligation-acknowledged"), ...EventBase, obligationId: NonEmpty, note: Type.Optional(NonEmpty) }, { additionalProperties: false }),
  Type.Object({ type: Type.Literal("obligation-resolved"), ...EventBase, obligationId: NonEmpty, disposition: DispositionSchema, rationale: NonEmpty }, { additionalProperties: false }),
  /** Valid only with a successor: "someone else should look at this" is not an escalation. */
  Type.Object({ type: Type.Literal("obligation-escalated"), ...EventBase, obligationId: NonEmpty, successor: NonEmpty, rationale: NonEmpty }, { additionalProperties: false }),
  Type.Object({ type: Type.Literal("obligation-superseded"), ...EventBase, obligationId: NonEmpty, successor: NonEmpty, rationale: NonEmpty }, { additionalProperties: false }),
  /** A message routed as trace only: recorded, cited, and deliberately not an obligation. */
  Type.Object({ type: Type.Literal("message-noted"), ...EventBase, message: NonEmpty, reason: NonEmpty }, { additionalProperties: false }),
]);
export type ObligationEvent = Static<typeof ObligationEventSchema>;

/** The fold: an obligation with its status and the events that produced it. */
export interface ObligationState extends Obligation {
  status: ObligationStatus;
  acknowledgedBy: string[];
  disposition?: Disposition;
  rationale?: string;
  successor?: string;
  closedAt?: string;
  closedBy?: string;
  history: ObligationEvent[];
}

/** Message kinds the routing policy can name. */
export const RoutableKindSchema = Type.Union([
  Type.Literal("audit-finding"),
  Type.Literal("policy-proposal"),
  Type.Literal("constraint"),
  Type.Literal("operational-signal"),
  Type.Literal("coordination-signal"),
  Type.Literal("intelligence-signal"),
  Type.Literal("algedonic-signal"),
  Type.Literal("uncertainty-signal"),
]);
export type RoutableKind = Static<typeof RoutableKindSchema>;

export const RoutingRuleSchema = Type.Object({
  kind: RoutableKindSchema,
  /** Messages of this kind at or above this severity open an obligation; below it they are noted. */
  minSeverity: SeveritySchema,
  consumer: ConsumerSchema,
}, { additionalProperties: false });
export type RoutingRule = Static<typeof RoutingRuleSchema>;

/** Recovery actions the loop records and cannot apply: each needs a consumer to wait on. */
export const WaitingActionSchema = Type.Union([
  Type.Literal("remediate"), Type.Literal("replan"), Type.Literal("clarify"), Type.Literal("pause"), Type.Literal("escalate"),
]);
export type WaitingAction = Static<typeof WaitingActionSchema>;

export const RoutingPolicySchema = Type.Object({
  name: Type.String({ pattern: "^[a-z][a-z0-9-]*$" }),
  version: Type.Integer({ minimum: 1 }),
  description: NonEmpty,
  rules: Type.Array(RoutingRuleSchema),
  /** Reported impact on an uncertainty signal is a claim; this maps it to the effective severity the router uses. */
  impactSeverity: Type.Object({
    low: SeveritySchema, medium: SeveritySchema, high: SeveritySchema, critical: SeveritySchema,
  }, { additionalProperties: false }),
  /** Who a unit waits on for each recovery action the loop cannot apply. */
  recovery: Type.Object({
    remediate: ConsumerSchema, replan: ConsumerSchema, clarify: ConsumerSchema, pause: ConsumerSchema, escalate: ConsumerSchema,
  }, { additionalProperties: false }),
  /** An open obligation at or above this severity, naming a unit, vetoes that unit's dispatch and close. */
  blocksAtOrAbove: SeveritySchema,
  /** Severity floors by subject (lesson 12): a message whose subject or observation matches is raised to at least this severity. */
  floors: Type.Optional(Type.Array(Type.Object({
    /** A regular expression tested against the message's subject and observation. */
    pattern: NonEmpty,
    severity: SeveritySchema,
    /** Why: typically the invariant the pattern names. */
    reason: NonEmpty,
  }, { additionalProperties: false }))),
}, { additionalProperties: false });
export type RoutingPolicy = Static<typeof RoutingPolicySchema>;

export function isRoutingPolicy(value: unknown): value is RoutingPolicy {
  return Value.Check(RoutingPolicySchema, value);
}
export function isObligationEvent(value: unknown): value is ObligationEvent {
  return Value.Check(ObligationEventSchema, value);
}

// Keep the recovery vocabulary and the waiting set in one place: a waiting action is a recovery action.
export const WAITING_ACTIONS: ReadonlySet<Static<typeof RecoveryActionSchema>> = new Set<Static<typeof RecoveryActionSchema>>(["remediate", "replan", "clarify", "pause", "escalate"]);
