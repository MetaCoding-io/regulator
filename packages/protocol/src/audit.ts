/**
 * Audit vocabulary (lesson 09): evidence that does not depend on self-report.
 *
 * An evidence record is an observation the *host* made by running a check
 * against an exact revision in a stated environment, bound to the criteria
 * (the contract's evidence expectations) it speaks to. A technical verdict is
 * derived mechanically from the records that are fresh for the revision under
 * closeout. A human acceptance is a person's disposition of a criterion no
 * host check can observe, recorded separately from the technical verdict and
 * never in its place.
 *
 * All three are regulatory state: they live in the append-only audit log,
 * not in the orchestrator's execution store and not in the repository.
 */
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";
import { EvidenceClassSchema } from "./evidence.js";

const NonEmpty = Type.String({ minLength: 1 });
const ContractRef = Type.Object({ id: NonEmpty, version: Type.Integer({ minimum: 1 }) }, { additionalProperties: false });

export const VerdictSchema = Type.Union([Type.Literal("pass"), Type.Literal("fail"), Type.Literal("inconclusive")]);
export type Verdict = Static<typeof VerdictSchema>;

export const EvidenceEnvironmentSchema = Type.Object({
  node: NonEmpty,
  platform: NonEmpty,
  arch: NonEmpty,
}, { additionalProperties: false });
export type EvidenceEnvironment = Static<typeof EvidenceEnvironmentSchema>;

/** One host-run observation, bound to a revision, an environment, an attempt and the criteria it addresses. */
export const EvidenceRecordSchema = Type.Object({
  id: NonEmpty,
  unitId: NonEmpty,
  attempt: Type.Integer({ minimum: 1 }),
  contract: ContractRef,
  /** The host check that produced it: `run_tests`, `run_checks:<name>`, `file:<path>`. */
  check: NonEmpty,
  class: EvidenceClassSchema,
  /** Ids of the contract's evidence expectations this record speaks to. Empty means it binds to no criterion. */
  criteria: Type.Array(NonEmpty),
  verdict: VerdictSchema,
  command: Type.Optional(Type.Array(NonEmpty)),
  observation: Type.String(),
  /** The exact source revision the check ran against. Evidence from another revision is a memory. */
  revision: NonEmpty,
  environment: EvidenceEnvironmentSchema,
  producedBy: Type.Literal("S3*"),
  at: NonEmpty,
}, { additionalProperties: false });
export type EvidenceRecord = Static<typeof EvidenceRecordSchema>;

/** A person's disposition of a criterion tools cannot observe. Separate from the technical verdict by construction. */
export const HumanAcceptanceSchema = Type.Object({
  id: NonEmpty,
  unitId: NonEmpty,
  contract: ContractRef,
  criterion: NonEmpty,
  revision: NonEmpty,
  disposition: Type.Union([Type.Literal("accepted"), Type.Literal("rejected")]),
  by: NonEmpty,
  note: Type.Optional(NonEmpty),
  at: NonEmpty,
}, { additionalProperties: false });
export type HumanAcceptance = Static<typeof HumanAcceptanceSchema>;

/** Derived mechanically from the evidence that is fresh for the revision; never from what the report says. */
export const TechnicalVerdictSchema = Type.Object({
  id: NonEmpty,
  unitId: NonEmpty,
  attempt: Type.Integer({ minimum: 1 }),
  contract: ContractRef,
  revision: NonEmpty,
  verdict: VerdictSchema,
  /** Ids of the evidence records the verdict considered. */
  evidence: Type.Array(NonEmpty),
  /** Required criteria with fresh passing evidence or an accepted disposition. */
  satisfied: Type.Array(NonEmpty),
  /** Required criteria with fresh failing evidence or a rejected disposition. */
  failed: Type.Array(NonEmpty),
  /** Required criteria with no host evidence at all. */
  missing: Type.Array(NonEmpty),
  /** Required criteria whose only evidence is from another revision. */
  stale: Type.Array(NonEmpty),
  /** Evidence the report claims of a class the host found failing at this revision. */
  contradicted: Type.Array(NonEmpty),
  /** Required criteria no host check can observe, with no human disposition yet. */
  awaitingAcceptance: Type.Array(NonEmpty),
  reasons: Type.Array(NonEmpty),
  decidedBy: Type.Literal("S3*"),
  at: NonEmpty,
}, { additionalProperties: false });
export type TechnicalVerdict = Static<typeof TechnicalVerdictSchema>;

/** One line of the audit log. */
export const AuditEntrySchema = Type.Union([
  Type.Object({ type: Type.Literal("evidence"), record: EvidenceRecordSchema }, { additionalProperties: false }),
  Type.Object({ type: Type.Literal("verdict"), verdict: TechnicalVerdictSchema }, { additionalProperties: false }),
  Type.Object({ type: Type.Literal("acceptance"), acceptance: HumanAcceptanceSchema }, { additionalProperties: false }),
]);
export type AuditEntry = Static<typeof AuditEntrySchema>;

export function isTechnicalVerdict(value: unknown): value is TechnicalVerdict {
  return Value.Check(TechnicalVerdictSchema, value);
}
