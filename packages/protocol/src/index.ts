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

import { SeveritySchema } from "./severity.js";
export { SEVERITY_ORDER, SeveritySchema, severityAtLeast, type Severity } from "./severity.js";

import { EvidenceClassSchema, EvidenceRefSchema } from "./evidence.js";
export { EvidenceClassSchema, EvidenceRefSchema, type EvidenceClass, type EvidenceRef } from "./evidence.js";

import { PredictionResolutionSchema, PredictionSchema, RequestedChangeSchema } from "./prediction.js";

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
  /** Free for a plain proposal; a `harness-edit` (#138) is the typed payload `HarnessEditSchema`, and one that claims the kind and lacks a part is refused here. */
  requestedChange: RequestedChangeSchema,
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

/**
 * S2 coordination feedback to S3: something is oscillating, colliding, or
 * conflicting between operational units. S2 detects; S3 decides.
 */
export const CoordinationSubjectSchema = Type.Union([
  Type.Literal("oscillation"),
  Type.Literal("conflict"),
  Type.Literal("collision"),
  Type.Literal("lease-expired"),
]);
export type CoordinationSubject = Static<typeof CoordinationSubjectSchema>;

export const CoordinationSignalSchema = Type.Object({
  ...EnvelopeFields,
  kind: Type.Literal("coordination-signal"),
  channel: Type.Literal("signal"),
  source: Type.Literal("S2"),
  destination: Type.Literal("S3"),
  severity: SeveritySchema,
  coordination: CoordinationSubjectSchema,
  observation: Type.String({ minLength: 1 }),
  evidence: Type.Array(EvidenceRefSchema),
  /** The resource the units are contending over: a path, a branch, a file. */
  resource: Type.Optional(Type.String()),
}, { additionalProperties: false });
export type CoordinationSignal = Static<typeof CoordinationSignalSchema>;

export const ConfidenceSchema = Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]);
export type Confidence = Static<typeof ConfidenceSchema>;

/**
 * Future/environment-facing intelligence from S4. Advice to S3, never a
 * decision: the structured fields (lesson 11) let the router weigh it — what
 * is claimed, how surely, as of when, and which units it touches.
 */
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
  /** The claim in one sentence, separate from the observation that supports it. */
  claim: Type.Optional(Type.String({ minLength: 1 })),
  confidence: Type.Optional(ConfidenceSchema),
  /** When the environment was observed; recency is what makes intelligence usable. */
  observedAt: Type.Optional(Type.String({ minLength: 1 })),
  /** Units whose progression the intelligence bears on. */
  affectedUnits: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
  /**
   * A claim about the future that resolves (#138): the metric it stakes, the baseline, the direction and size, a
   * probability beside `confidence`, and the horizons at which the loop reads the outcome. Routed exactly as a signal
   * without it; a block missing any part is refused.
   */
  prediction: Type.Optional(PredictionSchema),
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
  CoordinationSignalSchema,
  IntelligenceSignalSchema,
  AlgedonicSignalSchema,
  UncertaintySignalSchema,
]);
export type VsmMessage = Static<typeof VsmMessageSchema>;

import { ObligationEventSchema } from "./obligations.js";
import { InteractionEventSchema } from "./interaction.js";
/** One line of the regulatory log (lesson 11): a typed message, an event about its routing, (lesson 13) an interaction with a person, or (#138) a prediction's resolution. */
export const RegulatoryEntrySchema = Type.Union([VsmMessageSchema, ObligationEventSchema, InteractionEventSchema, PredictionResolutionSchema]);
export type RegulatoryEntry = Static<typeof RegulatoryEntrySchema>;

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
export { CapabilityProfileSchema, ConsentGrantSchema, ReasoningLevelSchema, isCapabilityProfile, type CapabilityProfile, type ConsentGrant, type ReasoningLevel } from "./profiles.js";
export { MemoryEntrySchema, MemoryEventSchema, isMemoryEvent, type MemoryEntry, type MemoryEvent } from "./memory.js";
export { ENFORCEMENT_POINTS, EnforcementPointSchema, MechanismLevelSchema, RegulatorRecordSchema, enforcementPointName, isRegulatorRecord, unknownEnforcementPoint, type EnforcementPoint, type EnforcementWhere, type MechanismLevel, type RegulatorRecord } from "./registry.js";
export {
  ConsequenceSchema, ContractProvenanceSchema, DelegatedDecisionSchema, EvidenceExpectationSchema, ExpectationCheckSchema, FixedDecisionSchema,
  ResultReportInputSchema, ResultReportSchema, UnresolvedDecisionSchema, UnresolvedHandlingSchema, UnresolvedOutcomeSchema,
  WorkContractSchema, isResultReport, isWorkContract,
  type Consequence, type DelegatedDecision, type EvidenceExpectation, type ExpectationCheck, type FixedDecision, type ResultReport, type ResultReportInput,
  type UnresolvedDecision, type UnresolvedHandling, type WorkContract,
} from "./contracts.js";
export { CHECK_OPTIONS, CheckEntrySchema, CheckOptionsSchema, CommandRunnerSchema, HOST_CHECK_NAMES, RunnerSchema, SESSION_RUNNER, SessionRunnerSchema, UnitTypeSchema, WorkloadDefinitionSchema, checkName, checkNames, checkOptions, isCommandRunner, isWorkloadDefinition, runnerOf, type CheckEntry, type CheckOptions, type CommandRunner, type Runner, type SessionRunner, type UnitType, type WorkloadDefinition } from "./workload.js";
export {
  AttemptOutcomeSchema, AttemptRecordSchema, BudgetDimensionSchema, BudgetLedgerSchema, LeaseSchema, TERMINAL_UNIT_STATUSES, UNIT_TRANSITIONS, UNIT_TRIGGERS, UnitRecordSchema, UnitStatusSchema,
  isAttemptRecord, isLease, isUnitRecord, unitTransition, unitTransitions,
  type AttemptOutcome, type AttemptProgram, type AttemptRecord, type BudgetDimension, type BudgetLedger, type Lease, type UnitRecord, type UnitStatus, type UnitTransition, type UnitTransitionStep, type UnitTrigger,
} from "./execution.js";
export { BudgetCeilingSchema, ModelRouteSchema, PolicyDefinitionSchema, isPolicyDefinition, type BudgetCeiling, type ModelRoute, type PolicyDefinition } from "./policy.js";
export {
  EffectJournalEntrySchema, EffectStatusSchema, FailureCauseSchema, FailureObservationSchema, RecoveryActionSchema, RecoveryDecisionSchema,
  RecoveryPolicySchema, RecoveryRuleSchema, isRecoveryDecision, isRecoveryPolicy,
  type EffectJournalEntry, type EffectStatus, type FailureCause, type FailureObservation, type RecoveryAction, type RecoveryDecision,
  type RecoveryPolicy, type RecoveryRule,
} from "./recovery.js";
export {
  AuditEntrySchema, EvidenceEnvironmentSchema, EvidenceRecordSchema, HumanAcceptanceSchema, TechnicalVerdictSchema, VerdictSchema, isTechnicalVerdict,
  type AuditEntry, type EvidenceEnvironment, type EvidenceRecord, type HumanAcceptance, type TechnicalVerdict, type Verdict,
} from "./audit.js";
export {
  ConcernSchema, ConsumerSchema, DispositionSchema, ObligationEventSchema, ObligationSchema, ObligationStatusSchema, RoutableKindSchema, RoutingPolicySchema,
  RoutingRuleSchema, WAITING_ACTIONS, WaitingActionSchema, isObligationEvent, isRoutingPolicy,
  type Concern, type Consumer, type Disposition, type Obligation, type ObligationEvent, type ObligationState, type ObligationStatus, type RoutableKind,
  type RoutingPolicy, type RoutingRule, type WaitingAction,
} from "./obligations.js";
export {
  CONTINUES_WITHOUT_ANSWER, ConsentCallSchema, InteractionChannelSchema, InteractionEventSchema, InteractionKindSchema, InteractionOutcomeSchema, InteractionPolicySchema, InteractionRequestSchema, PersonSchema,
  isInteractionEvent, isInteractionPolicy,
  type ConsentCall, type InteractionChannel, type InteractionEvent, type InteractionKind, type InteractionOutcome, type InteractionPolicy, type InteractionRequest, type Person,
} from "./interaction.js";
export {
  ArmSummarySchema, AblationSwitchSchema, BuiltInMetricSchema, EVAL_METRICS, EnvironmentFingerprintSchema, EvalArmSchema, EvalMetricSchema, EvalReportSchema, EvalRunSchema, EvalSuiteSchema,
  GraderFingerprintSchema, GraderVerdictSchema, HARNESS_SWITCH_KINDS, LiftSchema, MetricEntrySchema, MetricSummarySchema, UNINTERPRETED_BY, UNINTERPRETED_MARKER,
  declaredMetrics, isBuiltInMetric, isEvalReport, isEvalSuite, isUninterpreted, metricName, metricNames, optimisedMetrics,
  type AblationSwitch, type ArmSummary, type BuiltInMetric, type EnvironmentFingerprint, type EvalArm, type EvalMetric, type EvalReport, type EvalRun, type EvalSuite,
  type GraderFingerprint, type GraderVerdict, type Lift, type MetricEntry, type MetricSummary,
} from "./evals.js";
export {
  DECLARED_METRIC_PATTERN, DeclaredMetricNameSchema, GraderCommandSchema, GraderOutputSchema, MetricDeclarationSchema, MetricDirectionSchema, MetricKindSchema,
  isDeclaredMetricName, isMetricDeclaration, parseDeclaredMetric,
  type DeclaredMetricName, type GraderCommand, type GraderOutput, type MetricDeclaration, type MetricDirection, type MetricKind,
} from "./metrics.js";
export { GENAI, SpanEventSchema, SpanKindSchema, SpanRecordSchema, SpanStatusSchema, VSM_ATTR, isSpanRecord, type SpanEvent, type SpanRecord } from "./spans.js";
export { DefinitionPointSchema, InstanceManifestSchema, MIGRATION_CLASSES, MIGRATION_GATES, MigrationBulletSchema, MigrationGateSchema, MigrationNoteSchema, UpgradeEntrySchema, isInstanceManifest, isMigrationNote, type DefinitionPoint, type InstanceManifest, type MigrationBullet, type MigrationClass, type MigrationGate, type MigrationGateKind, type MigrationNote, type UpgradeEntry } from "./instance.js";
export {
  DiagnosisRefSchema, HARNESS_EDIT_KIND, HarnessEditSchema, LiveHorizonSchema, PredictionBaselineSchema, PredictionDirectionSchema, PredictionHorizonSchema, PredictionOutcomeSchema,
  PredictionResolutionSchema, PredictionSchema, ProbeHorizonSchema, ReportFingerprintSchema, RequestedChangeSchema, TrajectoryMomentSchema, claimsHarnessEdit, isHarnessEdit, isPredictionResolution,
  type DiagnosisRef, type HarnessEdit, type LiveHorizon, type Prediction, type PredictionBaseline, type PredictionDirection, type PredictionHorizon, type PredictionOutcome, type PredictionResolution,
  type ProbeHorizon, type ReportFingerprint, type TrajectoryMoment,
} from "./prediction.js";
export { DEFINITION_WRITERS, HARNESS_OWNED_INSTANCE_DIRS, definitionClassOf, definitionWriter, definitionWriterCommands, seedDirFor, type DefinitionWriter, type DefinitionWriterClass } from "./definition-writers.js";
