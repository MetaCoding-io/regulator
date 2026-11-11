/**
 * Declared metrics (#129): a workload or an instrument brings a metric of its
 * own, with the grader that measures it, as a declaration and never as an
 * inference. The fifteen trajectory and outcome counts in `evals.ts` are the
 * built-in set; everything else a report may summarize is declared here
 * first, so pre-registration holds for declared metrics as it does for the
 * built-ins: a suite names what it will measure before any run.
 *
 * A declaration lives beside what owns the metric — `workload/<name>.json`
 * carries `metrics[]` for a workload's, and an instrument record will carry
 * its own once that record kind exists (open questions §4). The grader is a
 * declared command the host runs in the instance after a repetition, in the
 * shape the host checks and the `command` runner (#122) use: an argv. It
 * reads the instance's outputs and the fixture's ground truth, and emits one
 * JSON object per line, `{ metric, value, observation? }`. Its exit code and
 * its output are the only things read; it never reads a unit's report, and
 * it is never a model.
 */
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";

const NonEmpty = Type.String({ minLength: 1 });

/** `workload:<workload>/<metric>` or `instrument:<record id>/<metric>`; the metric part is camel-cased like the built-ins. */
export const DECLARED_METRIC_PATTERN = "^(workload:[a-z][a-z0-9-]*|instrument:[A-Za-z0-9][A-Za-z0-9_.-]*)/[a-z][A-Za-z0-9]*$";
export const DeclaredMetricNameSchema = Type.String({ pattern: DECLARED_METRIC_PATTERN });
export type DeclaredMetricName = Static<typeof DeclaredMetricNameSchema>;

/** What the number is: a count of things, a rate or fraction, or a score on a declared scale. */
export const MetricKindSchema = Type.Union([Type.Literal("count"), Type.Literal("rate"), Type.Literal("score")]);
export type MetricKind = Static<typeof MetricKindSchema>;

/** Which way is better — `lower`, `higher` — or `none` for a quantity that is reported and not ranked. */
export const MetricDirectionSchema = Type.Union([Type.Literal("lower"), Type.Literal("higher"), Type.Literal("none")]);
export type MetricDirection = Static<typeof MetricDirectionSchema>;

/**
 * The grader as a command: an argv the host runs with the instance as its working directory. The first entry that names
 * a file under the definition is the grader's file; its hash goes into the report's fingerprint, so a report can say what
 * measured it, and the definition check refuses a declaration that names no such file.
 */
export const GraderCommandSchema = Type.Object({
  argv: Type.Array(NonEmpty, { minItems: 1 }),
  timeoutMs: Type.Optional(Type.Integer({ minimum: 1 })),
}, { additionalProperties: false });
export type GraderCommand = Static<typeof GraderCommandSchema>;

export const MetricDeclarationSchema = Type.Object({
  name: DeclaredMetricNameSchema,
  description: NonEmpty,
  kind: MetricKindSchema,
  direction: MetricDirectionSchema,
  /** The instrument record whose judgment this metric is (a judged metric). Refused by the definition check until the record exists with its held-out score. */
  instrument: Type.Optional(NonEmpty),
  grader: GraderCommandSchema,
}, { additionalProperties: false });
export type MetricDeclaration = Static<typeof MetricDeclarationSchema>;

/** One line of a declared grader's output: the metric it measured, the number, and what the number was made of. */
export const GraderOutputSchema = Type.Object({
  metric: DeclaredMetricNameSchema,
  value: Type.Number(),
  observation: Type.Optional(NonEmpty),
}, { additionalProperties: false });
export type GraderOutput = Static<typeof GraderOutputSchema>;

export function isDeclaredMetricName(name: string): name is DeclaredMetricName {
  return Value.Check(DeclaredMetricNameSchema, name);
}

/** The namespace, the owner and the metric of a declared name, or undefined when the name is not a declared one. */
export function parseDeclaredMetric(name: string): { owner: "workload" | "instrument"; id: string; metric: string } | undefined {
  if (!isDeclaredMetricName(name)) return undefined;
  const [prefix, metric] = name.split("/") as [string, string];
  const [owner, id] = prefix.split(":") as ["workload" | "instrument", string];
  return { owner, id, metric };
}

export function isMetricDeclaration(value: unknown): value is MetricDeclaration {
  return Value.Check(MetricDeclarationSchema, value);
}
