/**
 * Predictions, their resolution, and the `harness-edit` payload (#138: the
 * accept-path split, slice 2; the Harness² note §8; open questions §4).
 *
 * Three records are kept apart, and this file adds the one that was missing:
 *
 *   observed evidence      an `EvidenceRecord` (audit.ts): what S3* saw
 *   authoritative decision an obligation's disposition (obligations.ts): who decided what
 *   predicted effect       an `IntelligenceSignal` with a `prediction` block (below): a claim about the
 *                          future that stakes a metric, a baseline, a direction, a size and a probability,
 *                          and names the horizons at which it resolves and the value that counts against it
 *
 * A prediction is not a field of a proposal and not a sentence in a
 * rationale. It is a signal, routed as any intelligence is. It resolves from
 * the stores — the loop reads the named metric with the graders the eval
 * harness uses, never the unit's report — into a `prediction-resolution`
 * record, three-valued: confirmed, disconfirmed, or inconclusive. Inconclusive
 * is not neutral: it counts against the prediction's precision, never for the
 * edit it was made about.
 *
 * A `harness-edit` is a `requestedChange` with three parts, each a different
 * record: a diagnosis (references to what was observed), a change (the diff
 * against one advice file) and a prediction (the id of a signal with the
 * block). The schema refuses one that claims the kind and lacks a part; the
 * host refuses one whose references do not resolve. A proposal that is not a
 * `harness-edit` is unaffected: `requestedChange` stays free for it.
 */
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";
import { EvalMetricSchema, GraderVerdictSchema } from "./evals.js";
import { EvidenceRefSchema } from "./evidence.js";
import { UNIT_TRIGGERS, type UnitTrigger } from "./execution.js";
import { VsmSystemSchema } from "./vsm-systems.js";

const NonEmpty = Type.String({ minLength: 1 });

/**
 * A committed eval report's fingerprint: the SHA-256 of its file under `evals/reports/`. A report's own `fingerprint`
 * field stamps where it ran; this names which report, so a prediction can cite one before anyone reads it again.
 */
export const ReportFingerprintSchema = Type.String({ pattern: "^[0-9a-f]{64}$" });
export type ReportFingerprint = Static<typeof ReportFingerprintSchema>;

/** Which way the metric is predicted to move from the baseline. */
export const PredictionDirectionSchema = Type.Union([Type.Literal("lower"), Type.Literal("higher")]);
export type PredictionDirection = Static<typeof PredictionDirectionSchema>;

/**
 * What the prediction is relative to: a committed report's arm (its mean for the metric is the baseline value), or an
 * arm by name alone — the arm a probe runs against, read from the probe's own report when that horizon resolves.
 */
export const PredictionBaselineSchema = Type.Union([
  Type.Object({ report: ReportFingerprintSchema, arm: NonEmpty }, { additionalProperties: false }),
  Type.Object({ arm: NonEmpty }, { additionalProperties: false }),
]);
export type PredictionBaseline = Static<typeof PredictionBaselineSchema>;

/**
 * The probe horizon: an eval report, named by fingerprint, whose named arm ran the proposed change before anyone decided.
 * It resolves when a report with that fingerprint is read.
 */
export const ProbeHorizonSchema = Type.Object({
  kind: Type.Literal("probe"),
  report: ReportFingerprintSchema,
  /** The arm under the change; its summary for the metric is what is observed. */
  arm: NonEmpty,
  /** The grader value at this horizon that counts against the prediction. */
  disconfirmedBy: Type.Number(),
}, { additionalProperties: false });
export type ProbeHorizon = Static<typeof ProbeHorizonSchema>;

/**
 * The live horizon: the next N units of the named types after the prediction is open. The loop resolves it one unit
 * at a time, at close or abort, from the stores.
 */
export const LiveHorizonSchema = Type.Object({
  kind: Type.Literal("live"),
  unitTypes: Type.Array(NonEmpty, { minItems: 1 }),
  count: Type.Integer({ minimum: 1 }),
  /** The grader value, for one unit, that counts against the prediction. */
  disconfirmedBy: Type.Number(),
}, { additionalProperties: false });
export type LiveHorizon = Static<typeof LiveHorizonSchema>;

export const PredictionHorizonSchema = Type.Union([ProbeHorizonSchema, LiveHorizonSchema]);
export type PredictionHorizon = Static<typeof PredictionHorizonSchema>;

/**
 * The prediction block on an intelligence signal. Every field is required inside the block; the block itself is
 * optional on the signal, so a signal without one is exactly what it was. `probability` is a number in [0, 1] beside
 * the signal's three-valued `confidence`, which stays as it is: one is what the emitter stakes, the other is how it
 * describes its footing.
 */
export const PredictionSchema = Type.Object({
  /** A built-in metric (`EVAL_METRICS`) or a declared one (#129). */
  metric: EvalMetricSchema,
  baseline: PredictionBaselineSchema,
  direction: PredictionDirectionSchema,
  /** The size of the predicted move from the baseline, in the metric's units; 0 stakes "no worse". */
  magnitude: Type.Number({ minimum: 0 }),
  probability: Type.Number({ minimum: 0, maximum: 1 }),
  horizons: Type.Array(PredictionHorizonSchema, { minItems: 1 }),
}, { additionalProperties: false });
export type Prediction = Static<typeof PredictionSchema>;

/** Three-valued, by design: inconclusive counts against the prediction's precision and never for the edit. */
export const PredictionOutcomeSchema = Type.Union([Type.Literal("confirmed"), Type.Literal("disconfirmed"), Type.Literal("inconclusive")]);
export type PredictionOutcome = Static<typeof PredictionOutcomeSchema>;

/**
 * A resolution: one horizon of one prediction, read once. A live horizon is resolved once per unit it names; a probe
 * horizon once, from the report it names. The record is regulatory state like an evidence record, appended to the
 * regulatory log and never edited; it carries the grader's observation and what it was read from.
 */
export const PredictionResolutionSchema = Type.Object({
  type: Type.Literal("prediction-resolution"),
  id: NonEmpty,
  at: NonEmpty,
  /** The function that resolved it: the loop (S3), reading with S3*'s graders. */
  by: VsmSystemSchema,
  /** The id of the intelligence signal that carries the prediction. */
  predictionId: NonEmpty,
  /** The index of the horizon in the prediction's `horizons[]`. */
  horizon: Type.Integer({ minimum: 0 }),
  /** What resolved it: the unit that closed or aborted (live), or the report that was read (probe). */
  resolvedBy: Type.Union([
    Type.Object({ unit: NonEmpty, unitType: NonEmpty, status: Type.Union([Type.Literal("closed"), Type.Literal("aborted")]) }, { additionalProperties: false }),
    Type.Object({ report: ReportFingerprintSchema, arm: NonEmpty }, { additionalProperties: false }),
  ]),
  metric: EvalMetricSchema,
  outcome: PredictionOutcomeSchema,
  /** The grader's observed value, when one could be read. */
  observed: Type.Optional(Type.Number()),
  /** The baseline value the comparison used, when one could be read. */
  baseline: Type.Optional(Type.Number()),
  /** The grader's verdict as the harness gives it, when a grader ran. */
  grader: Type.Optional(GraderVerdictSchema),
  /** How the outcome follows from the numbers, or why nothing could be read. */
  reason: NonEmpty,
  /** What the value was read from: the stores, a report. Never a unit's report. */
  evidence: Type.Array(EvidenceRefSchema),
}, { additionalProperties: false });
export type PredictionResolution = Static<typeof PredictionResolutionSchema>;

export function isPredictionResolution(value: unknown): value is PredictionResolution {
  return Value.Check(PredictionResolutionSchema, value);
}

/** The step of a unit's trajectory the diagnosis was read at, as `UNIT_TRANSITIONS` names it. */
export const TrajectoryMomentSchema = Type.Unsafe<UnitTrigger>(Type.Union(UNIT_TRIGGERS.map((t) => Type.Literal(t))));
export type TrajectoryMoment = UnitTrigger;

/**
 * One reference of a diagnosis: what was observed, where. The unit, the revision and the moment place it; the evidence
 * record ids and signal ids are what was read there. It is evidence that something happened, and nothing more.
 */
export const DiagnosisRefSchema = Type.Object({
  unit: NonEmpty,
  /** The attempt the observations belong to. */
  attempt: Type.Integer({ minimum: 1 }),
  /** The revision the evidence was read at. */
  revision: NonEmpty,
  moment: TrajectoryMomentSchema,
  /** Ids of evidence records in the audit log. */
  evidence: Type.Array(NonEmpty),
  /** Ids of messages in the regulatory log. */
  signals: Type.Array(NonEmpty),
}, { additionalProperties: false });
export type DiagnosisRef = Static<typeof DiagnosisRefSchema>;

export const HARNESS_EDIT_KIND = "harness-edit";

/**
 * The typed `requestedChange` of a `harness-edit`: three parts, each a different record. The diagnosis references
 * observations; the change is the diff against one advice file, named by profile; the prediction is the id of an
 * intelligence signal that carries a prediction block. The host refuses one whose references do not resolve.
 */
export const HarnessEditSchema = Type.Object({
  kind: Type.Literal(HARNESS_EDIT_KIND),
  diagnosis: Type.Array(DiagnosisRefSchema, { minItems: 1 }),
  change: Type.Object({
    /** The profile whose advice file (`advice/<profile>.md`) the diff is against. */
    profile: Type.String({ pattern: "^[a-z][a-z0-9-]*$" }),
    /** The diff against that file. */
    diff: NonEmpty,
  }, { additionalProperties: false }),
  /** The id of the intelligence signal whose `prediction` block this edit is a bet on. */
  prediction: NonEmpty,
}, { additionalProperties: false });
export type HarnessEdit = Static<typeof HarnessEditSchema>;

/** Anything that claims to be a `harness-edit`, well-formed or not. */
const HarnessEditLikeSchema = Type.Object({ kind: Type.Literal(HARNESS_EDIT_KIND) });

/**
 * What a proposal's `requestedChange` may be: a well-formed `harness-edit`, or anything that does not claim to be one.
 * A plain proposal (text, an object of its own shape) passes as before; an object that says `kind: "harness-edit"`
 * and lacks a part is refused by the schema, before any host reads it.
 */
export const RequestedChangeSchema = Type.Union([HarnessEditSchema, Type.Unsafe<unknown>({ not: HarnessEditLikeSchema })]);

export function isHarnessEdit(value: unknown): value is HarnessEdit {
  return Value.Check(HarnessEditSchema, value);
}

/** True when the value claims the kind, whether or not it is well-formed. */
export function claimsHarnessEdit(value: unknown): boolean {
  return Value.Check(HarnessEditLikeSchema, value);
}
