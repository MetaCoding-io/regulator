import { Type, type Static } from "typebox";

/**
 * VSM functions are control-system responsibilities, not persona names.
 * Agents may participate in a function without becoming the authority for it.
 */
export const VsmSystemSchema = Type.Union([
  Type.Literal("S1"),
  Type.Literal("S2"),
  Type.Literal("S3"),
  Type.Literal("S3*"),
  Type.Literal("S4"),
  Type.Literal("S5"),
]);
export type VsmSystem = Static<typeof VsmSystemSchema>;

/**
 * Information is typed by control semantics rather than treated as generic
 * context. A proposal is not policy; a signal is not audit evidence.
 */
export const ChannelSchema = Type.Union([
  Type.Literal("constraint"),
  Type.Literal("signal"),
  Type.Literal("audit"),
  Type.Literal("intelligence"),
  Type.Literal("proposal"),
  Type.Literal("algedonic"),
]);
export type Channel = Static<typeof ChannelSchema>;

export const SeveritySchema = Type.Union([
  Type.Literal("info"),
  Type.Literal("advisory"),
  Type.Literal("blocking"),
  Type.Literal("critical"),
]);
export type Severity = Static<typeof SeveritySchema>;

export const EvidenceClassSchema = Type.Union([
  Type.Literal("file"),
  Type.Literal("command"),
  Type.Literal("test"),
  Type.Literal("runtime"),
  Type.Literal("semantic"),
  Type.Literal("model"),
]);
export type EvidenceClass = Static<typeof EvidenceClassSchema>;

export const EvidenceRefSchema = Type.Object({
  class: EvidenceClassSchema,
  ref: Type.String({ minLength: 1 }),
  observation: Type.Optional(Type.String()),
  sourceRevision: Type.Optional(Type.String()),
});
export type EvidenceRef = Static<typeof EvidenceRefSchema>;

const EnvelopeFields = {
  id: Type.String({ minLength: 1 }),
  timestamp: Type.String({ minLength: 1 }),
  source: VsmSystemSchema,
  subject: Type.String({ minLength: 1 }),
  unit: Type.Optional(Type.String()),
};

/** Independent evidence from S3*. */
export const AuditFindingSchema = Type.Object({
  ...EnvelopeFields,
  kind: Type.Literal("audit-finding"),
  channel: Type.Literal("audit"),
  source: Type.Literal("S3*"),
  destination: Type.Literal("S3"),
  severity: SeveritySchema,
  invariant: Type.Optional(Type.String()),
  observation: Type.String({ minLength: 1 }),
  evidence: Type.Array(EvidenceRefSchema),
  suggestedAction: Type.Optional(Type.String()),
});
export type AuditFinding = Static<typeof AuditFindingSchema>;

/**
 * A request to change system identity or policy. Creating this message never
 * grants authority to mutate S5 artifacts.
 */
export const PolicyProposalSchema = Type.Object({
  ...EnvelopeFields,
  kind: Type.Literal("policy-proposal"),
  channel: Type.Literal("proposal"),
  source: Type.Union([
    Type.Literal("S1"),
    Type.Literal("S3"),
    Type.Literal("S4"),
  ]),
  destination: Type.Literal("S5"),
  severity: SeveritySchema,
  rationale: Type.String({ minLength: 1 }),
  requestedChange: Type.Unknown(),
  evidence: Type.Array(EvidenceRefSchema),
});
export type PolicyProposal = Static<typeof PolicyProposalSchema>;

/** Downward policy/identity constraint issued by S5. */
export const ConstraintSchema = Type.Object({
  ...EnvelopeFields,
  kind: Type.Literal("constraint"),
  channel: Type.Literal("constraint"),
  source: Type.Literal("S5"),
  destination: Type.Union([
    Type.Literal("S4"),
    Type.Literal("S3"),
    Type.Literal("S2"),
    Type.Literal("S1"),
  ]),
  severity: SeveritySchema,
  rule: Type.String({ minLength: 1 }),
  rationale: Type.Optional(Type.String()),
});
export type Constraint = Static<typeof ConstraintSchema>;

/** Ordinary operational feedback flowing upward from S1. */
export const OperationalSignalSchema = Type.Object({
  ...EnvelopeFields,
  kind: Type.Literal("operational-signal"),
  channel: Type.Literal("signal"),
  source: Type.Literal("S1"),
  destination: Type.Literal("S3"),
  severity: SeveritySchema,
  observation: Type.String({ minLength: 1 }),
  evidence: Type.Array(EvidenceRefSchema),
});
export type OperationalSignal = Static<typeof OperationalSignalSchema>;

/** Future/environment-facing intelligence from S4. */
export const IntelligenceSignalSchema = Type.Object({
  ...EnvelopeFields,
  kind: Type.Literal("intelligence-signal"),
  channel: Type.Literal("intelligence"),
  source: Type.Literal("S4"),
  destination: Type.Union([Type.Literal("S3"), Type.Literal("S5")]),
  severity: SeveritySchema,
  observation: Type.String({ minLength: 1 }),
  evidence: Type.Array(EvidenceRefSchema),
  expiresAt: Type.Optional(Type.String()),
});
export type IntelligenceSignal = Static<typeof IntelligenceSignalSchema>;

/** Exceptional signal allowed to bypass ordinary reporting hierarchy. */
export const AlgedonicSignalSchema = Type.Object({
  ...EnvelopeFields,
  kind: Type.Literal("algedonic-signal"),
  channel: Type.Literal("algedonic"),
  source: Type.Union([
    Type.Literal("S1"),
    Type.Literal("S2"),
    Type.Literal("S3"),
    Type.Literal("S3*"),
    Type.Literal("S4"),
  ]),
  destination: Type.Literal("S5"),
  severity: Type.Union([Type.Literal("blocking"), Type.Literal("critical")]),
  observation: Type.String({ minLength: 1 }),
  evidence: Type.Array(EvidenceRefSchema),
  requiresHumanAttention: Type.Boolean(),
});
export type AlgedonicSignal = Static<typeof AlgedonicSignalSchema>;

export const VsmMessageSchema = Type.Union([
  AuditFindingSchema,
  PolicyProposalSchema,
  ConstraintSchema,
  OperationalSignalSchema,
  IntelligenceSignalSchema,
  AlgedonicSignalSchema,
]);
export type VsmMessage = Static<typeof VsmMessageSchema>;

/**
 * Only an explicit S5 authority action may directly change committed S5 state.
 * None of the message channels themselves carry mutation authority.
 */
export function channelCanMutateS5(_channel: Channel): false {
  return false;
}

export function isExceptional(message: VsmMessage): boolean {
  return message.channel === "algedonic" || message.severity === "critical";
}
