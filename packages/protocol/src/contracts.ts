/**
 * Work contracts and result reports (lesson 06).
 *
 * A contract allocates decisions before dispatch: FIXED (preserve),
 * DELEGATED (choose within bounds, report the choice), UNRESOLVED (do not
 * settle; surface). The result report closes the loop against the exact
 * contract version. Neither carries execution lifecycle (that is the
 * orchestrator's unit record) nor regulatory authority (a contract delegates
 * implementation decisions only; there is deliberately no `authority`,
 * `capabilities` or `functions` field a model could fill in).
 */
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";
import { EvidenceClassSchema, EvidenceRefSchema } from "./evidence.js";

const NonEmpty = Type.String({ minLength: 1 });
const DecisionId = Type.String({ pattern: "^[a-zA-Z0-9][a-zA-Z0-9._-]*$" });

export const FixedDecisionSchema = Type.Object({
  id: DecisionId,
  subject: NonEmpty,
  decision: NonEmpty,
  /** Where the decision came from: an invariant id, an accepted decision, an S3 planning record. */
  authorityRef: NonEmpty,
  rationale: Type.Optional(NonEmpty),
}, { additionalProperties: false });
export type FixedDecision = Static<typeof FixedDecisionSchema>;

export const DelegatedDecisionSchema = Type.Object({
  id: DecisionId,
  subject: NonEmpty,
  /** The bounds within which S1 may choose. A delegation without bounds is abdication. */
  bounds: NonEmpty,
  /** Default true: the choice made must appear in the result report. */
  requiredReport: Type.Optional(Type.Boolean()),
}, { additionalProperties: false });
export type DelegatedDecision = Static<typeof DelegatedDecisionSchema>;

export const UnresolvedHandlingSchema = Type.Union([
  Type.Literal("resolve-before-execution"),
  Type.Literal("defer"),
  Type.Literal("stub-boundary"),
  Type.Literal("research"),
  Type.Literal("policy-clarification"),
]);
export type UnresolvedHandling = Static<typeof UnresolvedHandlingSchema>;

export const UnresolvedDecisionSchema = Type.Object({
  id: DecisionId,
  subject: NonEmpty,
  reason: NonEmpty,
  handling: UnresolvedHandlingSchema,
  obligationRef: Type.Optional(NonEmpty),
}, { additionalProperties: false });
export type UnresolvedDecision = Static<typeof UnresolvedDecisionSchema>;

export const EvidenceExpectationSchema = Type.Object({
  id: DecisionId,
  description: NonEmpty,
  class: EvidenceClassSchema,
  required: Type.Boolean(),
}, { additionalProperties: false });
export type EvidenceExpectation = Static<typeof EvidenceExpectationSchema>;

export const ContractProvenanceSchema = Type.Object({
  /** Only S3 writes contracts. A model-facing path never sets this. */
  createdBy: Type.Literal("S3"),
  createdAt: NonEmpty,
  sourceRevision: Type.Optional(NonEmpty),
  predecessor: Type.Optional(Type.Object({
    version: Type.Integer({ minimum: 1 }),
    reason: NonEmpty,
  }, { additionalProperties: false })),
}, { additionalProperties: false });

export const WorkContractSchema = Type.Object({
  kind: Type.Literal("task"),
  id: Type.String({ pattern: "^[a-zA-Z0-9][a-zA-Z0-9._-]*$" }),
  version: Type.Integer({ minimum: 1 }),
  unitId: Type.String({ pattern: "^[a-zA-Z0-9._-]+$" }),
  /** Must name a unit type the workload definition declares. */
  unitType: NonEmpty,
  workload: Type.Object({ name: NonEmpty, version: Type.Integer({ minimum: 1 }) }, { additionalProperties: false }),
  objective: NonEmpty,
  contribution: Type.Optional(NonEmpty),
  constraintRefs: Type.Array(NonEmpty),
  fixed: Type.Array(FixedDecisionSchema),
  delegated: Type.Array(DelegatedDecisionSchema),
  unresolved: Type.Array(UnresolvedDecisionSchema),
  expectedEvidence: Type.Array(EvidenceExpectationSchema),
  provenance: ContractProvenanceSchema,
}, { additionalProperties: false });
export type WorkContract = Static<typeof WorkContractSchema>;

export function isWorkContract(value: unknown): value is WorkContract {
  return Value.Check(WorkContractSchema, value);
}

export const ConsequenceSchema = Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]);
export type Consequence = Static<typeof ConsequenceSchema>;

/** What became of an unresolved decision. There is no "settled": settling is not S1's to do. */
export const UnresolvedOutcomeSchema = Type.Union([Type.Literal("preserved"), Type.Literal("surfaced")]);

const ReportFields = {
  summary: NonEmpty,
  evidence: Type.Array(EvidenceRefSchema),
  delegatedResults: Type.Array(Type.Object({
    decisionId: DecisionId,
    choice: NonEmpty,
    rationale: Type.Optional(NonEmpty),
  }, { additionalProperties: false })),
  unresolvedOutcomes: Type.Array(Type.Object({
    decisionId: DecisionId,
    outcome: UnresolvedOutcomeSchema,
    note: NonEmpty,
  }, { additionalProperties: false })),
  emergentDecisions: Type.Array(Type.Object({
    subject: NonEmpty,
    choiceOrQuestion: NonEmpty,
    consequenceIfWrong: ConsequenceSchema,
  }, { additionalProperties: false })),
  deviations: Type.Array(Type.Object({
    kind: Type.Union([Type.Literal("fixed-decision"), Type.Literal("constraint"), Type.Literal("scope"), Type.Literal("interface")]),
    ref: Type.Optional(NonEmpty),
    description: NonEmpty,
  }, { additionalProperties: false })),
  residualUncertainty: Type.Array(Type.Object({
    subject: NonEmpty,
    reason: NonEmpty,
    consequenceIfWrong: ConsequenceSchema,
  }, { additionalProperties: false })),
};

/** What the model supplies. The contract binding is host-filled. */
export const ResultReportInputSchema = Type.Object(ReportFields, { additionalProperties: false });
export type ResultReportInput = Static<typeof ResultReportInputSchema>;

export const ResultReportSchema = Type.Object({
  contractId: NonEmpty,
  contractVersion: Type.Integer({ minimum: 1 }),
  unitId: NonEmpty,
  /** The attempt that produced it (lesson 09): a new attempt is new work and writes its own report; a report is never revised. */
  attempt: Type.Integer({ minimum: 1 }),
  reportedAt: NonEmpty,
  ...ReportFields,
}, { additionalProperties: false });
export type ResultReport = Static<typeof ResultReportSchema>;

export function isResultReport(value: unknown): value is ResultReport {
  return Value.Check(ResultReportSchema, value);
}
