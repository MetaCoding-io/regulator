/**
 * The command runner's declaration (#122): what the definition check refuses
 * about a unit type that runs a program instead of a session, read against
 * the profile the type names. A profile on a command runner is an effect
 * declaration, not a tool grant, so the check reads it for what it says a
 * unit of the type may reach and for nothing a program could call.
 *
 *   commandRunnerShapeHints   the one shape fault worth naming before the
 *                             schema does: a command runner without an argv
 *   checkCommandRunner        the refusals over a well-formed declaration:
 *                             an argv naming no file under the definition
 *                             (the file is what the attempt record hashes),
 *                             a profile granting arbitrary execution (a
 *                             program's reach is its declared outputs,
 *                             nothing wider), an output outside the
 *                             profile's writable paths, and an output under a
 *                             consent grant of the profile (a program cannot
 *                             ask, so it may not write where a yes is
 *                             required)
 *
 * Pi-free and pure, beside the file lookup the graders share.
 */
import path from "node:path";
import { HARNESS_OWNED_INSTANCE_DIRS, type CapabilityProfile, type CommandRunner, type Program, type UnitType } from "@metacoding.io/regulator-protocol";
import { PROTECTED_S5_PATHS } from "./authority.js";
import { PATH_GUARDED_TOOLS, describeConsentGrant } from "./consent.js";
import { effectOf } from "./effects.js";
import { graderFile } from "./metrics.js";

/** An output prefix as the grant compares it: `./` and backslashes removed, lexically normalized. */
export function normalizeOutput(output: string): string {
  return path.posix.normalize(output.replaceAll("\\", "/")).replace(/^\.\//, "");
}

/** What a raw workload value says about a command runner that the schema will refuse without naming: a unit type whose runner is `command` with no argv, or an empty one. */
export function commandRunnerShapeHints(value: unknown): string[] {
  const hints: string[] = [];
  const types = (value as { unitTypes?: unknown })?.unitTypes;
  if (!Array.isArray(types)) return hints;
  for (const type of types as Array<{ name?: unknown; runner?: { kind?: unknown; argv?: unknown } }>) {
    if (type?.runner?.kind !== "command") continue;
    const name = typeof type.name === "string" ? type.name : "?";
    if (!Array.isArray(type.runner.argv) || type.runner.argv.length === 0) hints.push(`unit type "${name}" declares a command runner without an argv: a program is named or there is nothing to run`);
  }
  return hints;
}

export interface CheckCommandRunnerOptions {
  /** The definition root the argv's file is resolved under. */
  root: string;
  type: Pick<UnitType, "name" | "profile">;
  runner: CommandRunner;
  /** The profile the unit type names, when it is declared; an undeclared profile is the workload check's own problem. */
  profile?: CapabilityProfile;
}

/** An output prefix a program may never declare: the identity, the advice and the S5 artifacts change through their accept paths, never through a program. */
function harnessOwned(output: string): boolean {
  return [...HARNESS_OWNED_INSTANCE_DIRS, ...PROTECTED_S5_PATHS].some((p) => output.startsWith(p) || p.startsWith(output));
}

/**
 * What any program's declaration earns on its own (#121; shared by the command runner and a declared tool): an argv
 * naming no file under the definition (the file is what the record hashes), an output outside the project, and an output
 * under a harness-owned or S5 prefix. `at` names the declaring thing; `record` says what hashes the file.
 */
export async function checkProgram(root: string, at: string, program: Program, record: string = "the attempt record"): Promise<{ problems: string[]; outputs: string[] }> {
  const problems: string[] = [];
  const outputs: string[] = [];
  if (!(await graderFile(root, program.argv))) {
    problems.push(`${at} runs the program \`${program.argv.join(" ")}\`, and no argument of it is a file under the definition: the program's file is what ${record} hashes, and it is missing`);
  }
  for (const declared of program.outputs) {
    const output = normalizeOutput(declared);
    if (output === ".." || output.startsWith("../") || path.posix.isAbsolute(output)) {
      problems.push(`${at} declares output "${declared}", which is not inside the project`);
      continue;
    }
    if (harnessOwned(output)) {
      problems.push(`${at} declares output "${declared}", which is the identity's, the advice's or S5's: those change through their accept paths, never through a program`);
      continue;
    }
    outputs.push(output);
  }
  return { problems, outputs };
}

/** What `regulator check` refuses about one command runner, in the order a reader fixes them. */
export async function checkCommandRunner(options: CheckCommandRunnerOptions): Promise<string[]> {
  const { root, type, runner, profile } = options;
  const at = `unit type "${type.name}"`;
  const { problems, outputs } = await checkProgram(root, at, runner);
  if (!profile) return problems;
  const arbitrary = profile.tools.filter((t) => effectOf(t)?.execution === "arbitrary");
  if (arbitrary.length) {
    problems.push(`${at} runs a program under profile "${profile.name}", which grants ${arbitrary.join(", ")}, whose execution is arbitrary: a profile on a command runner is an effect declaration, and a program's reach is its declared outputs, nothing wider`);
  }
  for (const output of outputs) {
    const declared = runner.outputs.find((o) => normalizeOutput(o) === output) ?? output;
    if (!profile.writablePaths.some((w) => output.startsWith(w))) {
      problems.push(`${at} declares output "${declared}", which is outside profile "${profile.name}"'s writable paths (${profile.writablePaths.join(", ") || "none"}): a program writes only where its effect declaration says a unit of the profile may`);
    }
    for (const grant of profile.consent ?? []) {
      if (!PATH_GUARDED_TOOLS.has(grant.tool) || grant.pattern !== undefined) continue;
      const covered = !grant.paths || grant.paths.some((p) => output.startsWith(p) || p.startsWith(output));
      if (covered) problems.push(`${at} declares output "${declared}", which falls under profile "${profile.name}"'s consent grant (${describeConsentGrant(grant)}): a program cannot ask, so it may not write where a yes is required`);
    }
  }
  return problems;
}
