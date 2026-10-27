/**
 * A workload definition: the part of the control-plane definition that says
 * what kinds of unit exist and what each may use. The orchestrator loop is
 * generic; everything workload-specific is declared here. The software-
 * development autoloop is the first one (lesson 06); a second workload is a
 * second file, not a fork of the loop.
 */
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";
import { MetricDeclarationSchema } from "./metrics.js";

const NonEmpty = Type.String({ minLength: 1 });

/** The host-run checks a unit type may name (lesson 09; `identity-untouched` since lesson 12; `export-signature` since lesson 14; `glossary-lint` since lesson 15). */
export const HOST_CHECK_NAMES = ["run_tests", "run_checks", "identity-untouched", "export-signature", "glossary-lint", "inherited-tests"] as const;

/**
 * What a check may be told, per check. `glossary-lint` reads two sources — added comment lines and commit messages — and a
 * workload may declare the commit-message half advisory: a refused word there is recorded as evidence and an advisory
 * finding, not a failed check (#47). Every other check takes no option; the definition check refuses one it is given.
 */
export const CheckOptionsSchema = Type.Object({
  commitMessages: Type.Optional(Type.Union([Type.Literal("blocking"), Type.Literal("advisory")])),
}, { additionalProperties: false });
export type CheckOptions = Static<typeof CheckOptionsSchema>;
/** Which checks take which options; a check not listed takes none. */
export const CHECK_OPTIONS: Readonly<Record<string, readonly (keyof CheckOptions)[]>> = { "glossary-lint": ["commitMessages"] };

/** A check a unit type names: the name alone, or the name with the options the workload declares for it. */
export const CheckEntrySchema = Type.Union([NonEmpty, Type.Object({ name: NonEmpty, options: CheckOptionsSchema }, { additionalProperties: false })]);
export type CheckEntry = Static<typeof CheckEntrySchema>;
export function checkName(entry: CheckEntry): string { return typeof entry === "string" ? entry : entry.name; }
export function checkNames(entries: readonly CheckEntry[]): string[] { return entries.map(checkName); }
/** The options declared per check name, for the checks that carry any. */
export function checkOptions(entries: readonly CheckEntry[]): Record<string, CheckOptions> {
  return Object.fromEntries(entries.flatMap((e) => (typeof e === "string" ? [] : [[e.name, e.options] as const])));
}

/** A project-relative prefix a program may write under: never absolute, never `..` at the root; compared by prefix as a profile's writable paths are. */
const OutputPrefix = Type.String({ minLength: 1, pattern: "^(?!\\.\\.(/|$))[^/\\\\][^\\\\]*$" });

/**
 * How a unit of the type runs (#122). A `session` is a model under the profile's grant, opened by the host; the
 * default when the field is absent, and the only kind before #122. A `command` is a program the control plane runs
 * itself, with its own process runner, in the unit's worktree: no host, no model, no tools. Its argv is in the shape a
 * declared grader has — the first entry naming a file under the definition is the program's file, and its hash goes into
 * the attempt record so a report can say what produced it; the program is run with the contract path and the attempt
 * in its environment, under the policy's wall-clock ceiling for the unit type as its one budget (tokens and turns are
 * zero by construction), and `outputs` are the prefixes it may write under — its whole reach. Its exit and its last
 * stdout line are the report. The profile stays on the unit type for both kinds: for a command runner it is the effect
 * declaration the read-only check and the consent refusal read, not a tool grant, and the definition check refuses a
 * command runner whose profile grants arbitrary execution or whose outputs fall under a consent grant (a program cannot
 * ask, so it may not write where a yes is required) or outside the profile's writable paths.
 */
export const SessionRunnerSchema = Type.Object({ kind: Type.Literal("session") }, { additionalProperties: false });
export const CommandRunnerSchema = Type.Object({
  kind: Type.Literal("command"),
  /** The program, as the host runs it: an argv whose first entry naming a file under the definition is the program's file. */
  argv: Type.Array(NonEmpty, { minItems: 1 }),
  /** The program's own limit, when it declares one below the policy's wall-clock ceiling; the lesser of the two applies. */
  timeoutMs: Type.Optional(Type.Integer({ minimum: 1 })),
  /** The prefixes the program may write under. A write anywhere else is a dispatch error; empty means the program writes nothing. */
  outputs: Type.Array(OutputPrefix),
}, { additionalProperties: false });
export const RunnerSchema = Type.Union([SessionRunnerSchema, CommandRunnerSchema]);
export type SessionRunner = Static<typeof SessionRunnerSchema>;
export type CommandRunner = Static<typeof CommandRunnerSchema>;
export type Runner = Static<typeof RunnerSchema>;

export const SESSION_RUNNER: SessionRunner = { kind: "session" };

export const UnitTypeSchema = Type.Object({
  name: Type.String({ pattern: "^[a-z][a-z0-9-]*$" }),
  description: NonEmpty,
  /** The capability profile a unit of this type is dispatched under (lesson 04); for a command runner, its effect declaration. */
  profile: NonEmpty,
  /** How a unit of this type runs (#122): a session under the profile's grant (the default), or a declared program. */
  runner: Type.Optional(RunnerSchema),
  /** The harness-run checks that verify a unit of this type (consumed from lesson 09): a name, or a name with options. */
  checks: Type.Array(CheckEntrySchema),
  /** Whether a unit of this type may be dispatched without a work contract. */
  /** Whether the unit runs only under a work contract. A type declared contract-less must run under a read-only profile (checked by the definition check); the CLI refuses to start it without one otherwise. */
  requiresContract: Type.Boolean(),
}, { additionalProperties: false });
export type UnitType = Static<typeof UnitTypeSchema>;

/** The runner a unit type declares, with `session` as the default when the field is absent. */
export function runnerOf(type: Pick<UnitType, "runner">): Runner {
  return type.runner ?? SESSION_RUNNER;
}

export function isCommandRunner(runner: Runner): runner is CommandRunner {
  return runner.kind === "command";
}

export const WorkloadDefinitionSchema = Type.Object({
  name: Type.String({ pattern: "^[a-z][a-z0-9-]*$" }),
  version: Type.Integer({ minimum: 1 }),
  description: NonEmpty,
  unitTypes: Type.Array(UnitTypeSchema, { minItems: 1 }),
  /**
   * The metrics this workload declares, each with its grader (#129): named `workload:<this workload>/<metric>`, so a
   * declaration lives beside what owns it. A suite pre-registers a declared name as it does a built-in one.
   */
  metrics: Type.Optional(Type.Array(MetricDeclarationSchema)),
}, { additionalProperties: false });
export type WorkloadDefinition = Static<typeof WorkloadDefinitionSchema>;

export function isWorkloadDefinition(value: unknown): value is WorkloadDefinition {
  return Value.Check(WorkloadDefinitionSchema, value);
}
