import { Type, type Static, type TSchema } from "typebox";
import { Value } from "typebox/value";

import { VsmSystemSchema } from "./vsm-systems.js";
export { VsmSystemSchema, type VsmSystem } from "./vsm-systems.js";

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
}, { additionalProperties: false });
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
}, { additionalProperties: false });
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
}, { additionalProperties: false });
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
}, { additionalProperties: false });
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
}, { additionalProperties: false });
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
}, { additionalProperties: false });
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
}, { additionalProperties: false });
export type AlgedonicSignal = Static<typeof AlgedonicSignalSchema>;

// Tool inputs deliberately exclude envelope, provenance, and authority fields.
const NonEmptyText = Type.String({ minLength: 1 });
export const ReportedEvidenceSchema = Type.Object({
  class: EvidenceClassSchema,
  ref: NonEmptyText,
  observation: Type.Optional(NonEmptyText),
}, { additionalProperties: false });

export const PolicyProposalInputSchema = Type.Object({
  subject: NonEmptyText,
  rationale: NonEmptyText,
  requestedChange: NonEmptyText,
  reportedSeverity: SeveritySchema,
  evidence: Type.Array(ReportedEvidenceSchema),
}, { additionalProperties: false });
export type PolicyProposalInput = Static<typeof PolicyProposalInputSchema>;

export const AuditFindingInputSchema = Type.Object({
  subject: NonEmptyText,
  reportedSeverity: SeveritySchema,
  invariant: Type.Optional(NonEmptyText),
  observation: NonEmptyText,
  evidence: Type.Array(ReportedEvidenceSchema),
  suggestedAction: Type.Optional(NonEmptyText),
}, { additionalProperties: false });
export type AuditFindingInput = Static<typeof AuditFindingInputSchema>;

export const UncertaintyImpactSchema = Type.Union([
  Type.Literal("low"), Type.Literal("medium"), Type.Literal("high"), Type.Literal("critical"),
]);
export const FollowUpSchema = Type.Union([
  Type.Literal("review"), Type.Literal("audit"), Type.Literal("research"),
  Type.Literal("clarification"), Type.Literal("policy-proposal"),
]);
const UncertaintyContent = {
  subject: NonEmptyText,
  decision: NonEmptyText,
  reason: NonEmptyText,
  alternatives: Type.Array(NonEmptyText),
  consequence: NonEmptyText,
  impact: UncertaintyImpactSchema,
  recommendedFollowUp: Type.Optional(FollowUpSchema),
};
export const UncertaintyInputSchema = Type.Object({
  ...UncertaintyContent,
  evidence: Type.Array(ReportedEvidenceSchema),
}, { additionalProperties: false });
export type UncertaintyInput = Static<typeof UncertaintyInputSchema>;

/** Reported impact is not effective severity, routing, or an escalation decision. */
export const UncertaintySignalSchema = Type.Object({
  ...EnvelopeFields,
  ...UncertaintyContent,
  kind: Type.Literal("uncertainty-signal"),
  channel: Type.Literal("signal"),
  source: Type.Literal("S1"),
  destination: Type.Literal("S3"),
  evidence: Type.Array(EvidenceRefSchema),
}, { additionalProperties: false });
export type UncertaintySignal = Static<typeof UncertaintySignalSchema>;

export const VsmMessageSchema = Type.Union([
  AuditFindingSchema,
  PolicyProposalSchema,
  ConstraintSchema,
  OperationalSignalSchema,
  IntelligenceSignalSchema,
  AlgedonicSignalSchema,
  UncertaintySignalSchema,
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
  return message.channel === "algedonic" || ("severity" in message && message.severity === "critical");
}

/** Host-only grants. Empty capabilities are least privilege. No grant mutates S5. */
export const ReportingAuthoritySchema = Type.Object({
  id: NonEmptyText,
  capabilities: Type.Object({
    proposePolicyAs: Type.Optional(Type.Union([
      Type.Literal("S1"), Type.Literal("S3"), Type.Literal("S4"),
    ])),
    reportOperationalSignal: Type.Optional(Type.Literal(true)),
    reportIndependentAudit: Type.Optional(Type.Literal(true)),
  }, { additionalProperties: false }),
}, { additionalProperties: false });
export type ReportingAuthority = Static<typeof ReportingAuthoritySchema>;

export const ReportingProvenanceSchema = Type.Object({
  host: NonEmptyText,
  sessionId: Type.Optional(NonEmptyText),
  unit: Type.Optional(NonEmptyText),
  sourceRevision: Type.Optional(NonEmptyText),
}, { additionalProperties: false });
export type ReportingProvenance = Static<typeof ReportingProvenanceSchema>;

export const ReportingContextSchema = Type.Object({
  authority: ReportingAuthoritySchema,
  provenance: ReportingProvenanceSchema,
}, { additionalProperties: false });
export type ReportingContext = Static<typeof ReportingContextSchema>;

export const ReportingToolNameSchema = Type.Union([
  Type.Literal("vsm_propose_policy_change"),
  Type.Literal("vsm_report_audit_finding"),
  Type.Literal("vsm_report_uncertainty"),
]);
export type ReportingToolName = Static<typeof ReportingToolNameSchema>;

// The tool produces a JSON-safe string change request, a subset of the general proposal protocol.
export const RegulatoryMessageSchema = Type.Union([
  Type.Object({ ...PolicyProposalSchema.properties, requestedChange: NonEmptyText }, { additionalProperties: false }),
  AuditFindingSchema,
  UncertaintySignalSchema,
]);
export type RegulatoryMessage = Static<typeof RegulatoryMessageSchema>;
export const RegulatoryEventSchema = Type.Object({
  schemaVersion: Type.Literal(1),
  message: RegulatoryMessageSchema,
  authority: ReportingAuthoritySchema,
  provenance: ReportingProvenanceSchema,
  tool: Type.Object({
    name: ReportingToolNameSchema,
    callId: NonEmptyText,
  }, { additionalProperties: false }),
}, { additionalProperties: false });
export type RegulatoryEvent = Static<typeof RegulatoryEventSchema>;

export const RegulatoryReceiptSchema = Type.Object({
  status: Type.Literal("persisted"),
  eventId: NonEmptyText,
  sequence: Type.Integer({ minimum: 1 }),
  timestamp: NonEmptyText,
  kind: Type.Union([
    Type.Literal("policy-proposal"), Type.Literal("audit-finding"), Type.Literal("uncertainty-signal"),
  ]),
  channel: Type.Union([Type.Literal("proposal"), Type.Literal("audit"), Type.Literal("signal")]),
}, { additionalProperties: false });
export type RegulatoryReceipt = Static<typeof RegulatoryReceiptSchema>;

export function assertValid<T extends TSchema>(schema: T, value: unknown, label: string): asserts value is Static<T> {
  if (!Value.Check(schema, value)) throw new Error(`Invalid ${label}: payload does not match the closed runtime schema.`);
}

// Control-plane vocabulary promoted from the course lab (checkpoints 1–3).
export { TokenUsageSchema, ToolCallRecordSchema, TurnRecordSchema, isTurnRecord, type TokenUsage, type ToolCallRecord, type TurnRecord } from "./trace.js";
export { ToolEffectSchema, type ToolEffect } from "./effects.js";
export type { CapabilityProfile, ReasoningLevel } from "./profiles.js";
export { MechanismLevelSchema, RegulatorRecordSchema, isRegulatorRecord, type MechanismLevel, type RegulatorRecord } from "./registry.js";
