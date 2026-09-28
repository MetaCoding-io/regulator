/**
 * Evaluation vocabulary (lesson 14): evidence about the regulators, one
 * recursion level up from the evidence about a unit.
 *
 * A suite names the fixture, the tasks (contracts run in order, so drift can
 * accumulate), the arms (which regulation is on) and how many repetitions
 * each arm gets, because agent runs are stochastic. A run is one arm × one
 * repetition × one task, with what the orchestrator recorded and what the
 * graders observed. A report summarizes runs per arm with confidence
 * intervals, stamps the environment it ran in, and carries a person's
 * interpretation — the number is never the conclusion.
 *
 * An ablation switch is how a registry record names the arm that turns it
 * off. The harness can throw some switches (a host check, a checkpoint
 * extension); the rest are named so the lifecycle view can say a regulator
 * has no ablation evidence, rather than pretending one exists.
 */
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";

const NonEmpty = Type.String({ minLength: 1 });

/** `none`, or `<kind>:<target>` — `check:identity-untouched`, `extension:authority`, `loop:progression-veto`, `policy:routing.floors`, `tool:remember`. */
export const AblationSwitchSchema = Type.String({ pattern: "^(none|(check|extension|loop|policy|tool):[A-Za-z0-9_.:/-]+)$" });
export type AblationSwitch = Static<typeof AblationSwitchSchema>;

/** The switches the harness can throw without a live model or a code change. */
export const HARNESS_SWITCH_KINDS = ["check", "extension"] as const;

export const EvalArmSchema = Type.Object({
  name: Type.String({ pattern: "^[a-z][a-z0-9-]*$" }),
  description: NonEmpty,
  /** Checkpoint extensions the dispatcher loads for a live run (file stems, e.g. `authority`). Ignored by a scripted run. */
  extensions: Type.Array(NonEmpty),
  /** Host checks the workload's implement unit type runs under this arm; overrides the workload's list. */
  checks: Type.Array(NonEmpty),
  /** Whether the instance carries the definition's identity set. */
  identity: Type.Boolean(),
  /** The registry record this arm switches off, when it is an ablation arm. */
  ablates: Type.Optional(NonEmpty),
  switch: Type.Optional(AblationSwitchSchema),
}, { additionalProperties: false });
export type EvalArm = Static<typeof EvalArmSchema>;

export const EVAL_METRICS = [
  "closed", "attempts", "tokens", "turns", "wallClockMs", "retries", "escalations", "invariantViolations",
  "boundaryViolations", "signatureDrift", "vocabularyDrift", "memoryRules", "memoryFacts", "refusals", "suiteWeakened",
] as const;
export const EvalMetricSchema = Type.Union(EVAL_METRICS.map((m) => Type.Literal(m)));
export type EvalMetric = Static<typeof EvalMetricSchema>;

export const EvalSuiteSchema = Type.Object({
  name: Type.String({ pattern: "^[a-z][a-z0-9-]*$" }),
  version: Type.Integer({ minimum: 1 }),
  description: NonEmpty,
  /** Fixture directory, relative to the definition. */
  fixture: NonEmpty,
  /** Contract files, relative to the definition, run in this order in one instance per repetition. */
  tasks: Type.Array(NonEmpty, { minItems: 1 }),
  arms: Type.Array(EvalArmSchema, { minItems: 2 }),
  repetitions: Type.Integer({ minimum: 1 }),
  /** Pre-registered: the metrics the report summarizes, declared before any run. */
  metrics: Type.Array(EvalMetricSchema, { minItems: 1 }),
  /** Which arm each other arm is compared against. */
  baseline: NonEmpty,
}, { additionalProperties: false });
export type EvalSuite = Static<typeof EvalSuiteSchema>;

export const GraderVerdictSchema = Type.Object({
  grader: NonEmpty,
  /** `outcome`: the resulting environment; `trajectory`: the records of how it got there. */
  kind: Type.Union([Type.Literal("outcome"), Type.Literal("trajectory")]),
  value: Type.Number(),
  observation: NonEmpty,
}, { additionalProperties: false });
export type GraderVerdict = Static<typeof GraderVerdictSchema>;

export const EvalRunSchema = Type.Object({
  arm: NonEmpty,
  repetition: Type.Integer({ minimum: 1 }),
  task: NonEmpty,
  unitId: NonEmpty,
  outcome: Type.Union([Type.Literal("closed"), Type.Literal("blocked"), Type.Literal("refused")]),
  detail: Type.Optional(NonEmpty),
  /** Every pre-registered metric, observed for this run. */
  metrics: Type.Record(Type.String(), Type.Number()),
  graders: Type.Array(GraderVerdictSchema),
  startedAt: NonEmpty,
  endedAt: NonEmpty,
}, { additionalProperties: false });
export type EvalRun = Static<typeof EvalRunSchema>;

export const MetricSummarySchema = Type.Object({
  n: Type.Integer({ minimum: 0 }),
  mean: Type.Number(),
  sd: Type.Number(),
  /** 95% confidence interval on the mean (Student's t); equal to the mean when n < 2. */
  ci95: Type.Tuple([Type.Number(), Type.Number()]),
  min: Type.Number(),
  max: Type.Number(),
}, { additionalProperties: false });
export type MetricSummary = Static<typeof MetricSummarySchema>;

/** Where the numbers came from: without this a result is a rumour. */
export const EnvironmentFingerprintSchema = Type.Object({
  node: NonEmpty,
  platform: NonEmpty,
  arch: NonEmpty,
  /** The pinned Pi version the definition declares. */
  pi: NonEmpty,
  /** The revision of the harness (the definition's repository) that ran. */
  harnessRevision: NonEmpty,
  /** `scripted:<behaviour>` for a headless run with a scripted unit; a model id for a live run. */
  dispatcher: NonEmpty,
  model: NonEmpty,
  /** Registry records and the definition's policy versions at run time. */
  registry: Type.Integer({ minimum: 0 }),
  policies: Type.Record(Type.String(), Type.Integer({ minimum: 1 })),
}, { additionalProperties: false });
export type EnvironmentFingerprint = Static<typeof EnvironmentFingerprintSchema>;

export const ArmSummarySchema = Type.Object({
  arm: NonEmpty,
  runs: Type.Integer({ minimum: 0 }),
  metrics: Type.Record(Type.String(), MetricSummarySchema),
}, { additionalProperties: false });
export type ArmSummary = Static<typeof ArmSummarySchema>;

/** Treatment minus baseline on one metric, with whether the intervals overlap — the honest test at small n. */
export const LiftSchema = Type.Object({
  arm: NonEmpty,
  metric: NonEmpty,
  delta: Type.Number(),
  /** True when the two 95% intervals do not overlap. Not a p-value; a screen. */
  separated: Type.Boolean(),
}, { additionalProperties: false });
export type Lift = Static<typeof LiftSchema>;

export const EvalReportSchema = Type.Object({
  suite: Type.Object({ name: NonEmpty, version: Type.Integer({ minimum: 1 }) }, { additionalProperties: false }),
  generatedAt: NonEmpty,
  fingerprint: EnvironmentFingerprintSchema,
  arms: Type.Array(ArmSummarySchema),
  lifts: Type.Array(LiftSchema),
  runs: Type.Array(EvalRunSchema),
  /** A person's reading of the numbers, including where the gated arm lost. Required: a report without one is a table. */
  interpretation: NonEmpty,
  interpretedBy: NonEmpty,
}, { additionalProperties: false });
export type EvalReport = Static<typeof EvalReportSchema>;

/**
 * What `regulator eval` writes when no person has read the numbers yet. Such a report is a
 * run's output, not evidence: `regulator check` refuses one committed under `evals/reports/`.
 */
export const UNINTERPRETED_BY = "nobody yet";
export const UNINTERPRETED_MARKER = "not yet interpreted by a person";

/** True when a report still carries the placeholder interpretation or interpreter. */
export function isUninterpreted(report: Pick<EvalReport, "interpretation" | "interpretedBy">): boolean {
  return report.interpretedBy.trim() === UNINTERPRETED_BY || report.interpretation.includes(UNINTERPRETED_MARKER);
}

export function isEvalSuite(value: unknown): value is EvalSuite {
  return Value.Check(EvalSuiteSchema, value);
}
export function isEvalReport(value: unknown): value is EvalReport {
  return Value.Check(EvalReportSchema, value);
}
