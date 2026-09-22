/**
 * Human interaction contracts and the algedonic path (lesson 13).
 *
 * An interaction kind is a contract: whether an answer is required, whether
 * work pauses, and what silence means. The rule that matters is fixed here,
 * not declared in a policy, because no policy may relax it:
 *
 *   silence, cancellation and timeout are never consent.
 *
 * Only a recap — decisions offered for correction while reversible work
 * continues — may continue without an answer. Everything else pauses and
 * records why. A policy declares how long to wait, how many interrupts an
 * attempt may spend (attention is the scarcest budget), when to remind, and
 * who may disposition what; it cannot declare that a timeout is a yes.
 */
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";
import { EvidenceRefSchema } from "./evidence.js";
import { SeveritySchema } from "./severity.js";
import { VsmSystemSchema } from "./vsm-systems.js";

const NonEmpty = Type.String({ minLength: 1 });

export const InteractionKindSchema = Type.Union([
  /** Decisions and assumptions offered for correction while reversible work continues. Nonblocking. */
  Type.Literal("recap"),
  /** Pick one of the options; work waits. */
  Type.Literal("choice"),
  /** An open question; work waits. */
  Type.Literal("clarification"),
  /** Explicit authorization for an irreversible, public, paid, destructive or account-level action; work waits, and nothing but a yes is a yes. */
  Type.Literal("consent"),
  /** Subjective acceptance of something no check can observe; work waits. */
  Type.Literal("uat"),
]);
export type InteractionKind = Static<typeof InteractionKindSchema>;

/** The rule, as a value the type system holds: only a recap continues without an answer. */
export const CONTINUES_WITHOUT_ANSWER: Readonly<Record<InteractionKind, boolean>> = { recap: true, choice: false, clarification: false, consent: false, uat: false };

export const InteractionOutcomeSchema = Type.Union([
  Type.Literal("answered"),
  Type.Literal("timed-out"),
  Type.Literal("cancelled"),
  /** No human is present to ask: headless, or a mode with no dialogs. */
  Type.Literal("unavailable"),
]);
export type InteractionOutcome = Static<typeof InteractionOutcomeSchema>;

export const InteractionChannelSchema = Type.Union([Type.Literal("tui"), Type.Literal("rpc"), Type.Literal("outbox"), Type.Literal("cli"), Type.Literal("none")]);
export type InteractionChannel = Static<typeof InteractionChannelSchema>;

/** What was asked, of whom, under which contract. Provenance is the host's. */
export const InteractionRequestSchema = Type.Object({
  id: NonEmpty,
  kind: InteractionKindSchema,
  subject: NonEmpty,
  question: NonEmpty,
  options: Type.Optional(Type.Array(NonEmpty, { minItems: 2 })),
  /** For consent: what would be done if the answer is yes. Irreversible by definition. */
  action: Type.Optional(NonEmpty),
  severity: SeveritySchema,
  unit: Type.Optional(NonEmpty),
  attempt: Type.Optional(Type.Integer({ minimum: 1 })),
  /** The obligation this request opened (or answered on the spot). */
  obligationId: NonEmpty,
  evidence: Type.Array(EvidenceRefSchema),
  raisedBy: VsmSystemSchema,
  raisedAt: NonEmpty,
  timeoutMs: Type.Integer({ minimum: 0 }),
  channel: InteractionChannelSchema,
}, { additionalProperties: false });
export type InteractionRequest = Static<typeof InteractionRequestSchema>;

const EventBase = { id: NonEmpty, at: NonEmpty, by: NonEmpty };

export const InteractionEventSchema = Type.Union([
  Type.Object({ type: Type.Literal("interaction-requested"), ...EventBase, request: InteractionRequestSchema }, { additionalProperties: false }),
  Type.Object({
    type: Type.Literal("interaction-answered"), ...EventBase, requestId: NonEmpty, outcome: InteractionOutcomeSchema,
    answer: Type.Optional(NonEmpty), channel: InteractionChannelSchema,
  }, { additionalProperties: false }),
]);
export type InteractionEvent = Static<typeof InteractionEventSchema>;

export const PersonSchema = Type.Object({
  name: NonEmpty,
  /** The highest severity this person may disposition. */
  resolveUpTo: SeveritySchema,
  /** May resolve with `accepted-risk`. */
  acceptRisk: Type.Boolean(),
  /** May decide proposals owed to S5 (`identity accept|reject`). */
  actAsS5: Type.Boolean(),
}, { additionalProperties: false });
export type Person = Static<typeof PersonSchema>;

export const InteractionPolicySchema = Type.Object({
  name: Type.String({ pattern: "^[a-z][a-z0-9-]*$" }),
  version: Type.Integer({ minimum: 1 }),
  description: NonEmpty,
  /** How long a dialog waits, per kind, before it is recorded as timed out. */
  timeoutsMs: Type.Object({
    recap: Type.Integer({ minimum: 1000 }), choice: Type.Integer({ minimum: 1000 }), clarification: Type.Integer({ minimum: 1000 }),
    consent: Type.Integer({ minimum: 1000 }), uat: Type.Integer({ minimum: 1000 }),
  }, { additionalProperties: false }),
  /** Attention is the scarcest budget: blocking interrupts an attempt may spend before the tool refuses. */
  attention: Type.Object({ blockingPerAttempt: Type.Integer({ minimum: 0 }) }, { additionalProperties: false }),
  /** An obligation owed to a person and still open this long after its last delivery is delivered again. */
  reminderAfterMs: Type.Integer({ minimum: 60_000 }),
  /** Who may disposition what. A name not listed may disposition nothing. */
  people: Type.Array(PersonSchema),
}, { additionalProperties: false });
export type InteractionPolicy = Static<typeof InteractionPolicySchema>;

export function isInteractionPolicy(value: unknown): value is InteractionPolicy {
  return Value.Check(InteractionPolicySchema, value);
}
export function isInteractionEvent(value: unknown): value is InteractionEvent {
  return Value.Check(InteractionEventSchema, value);
}
