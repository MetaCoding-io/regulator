/**
 * Workload-declared tools (#121): what the definition check and the gates
 * share about a tool a workload declares with an effect contract.
 *
 *   declaredToolsOf      every declaration the workloads carry, by name,
 *                        with the workload that owns it
 *   declaredEffectsOf    the same as an effect table, the shape `effectOf`,
 *                        `readOnlyViolations` and the consent derivation
 *                        read — the declared tools' effects and no built-in,
 *                        so a derivation reads only what a workload wrote
 *   consentDerivedFrom   the one rule the gate derives from an effect: a
 *                        declared tool whose side effects are irreversible
 *                        needs a person's yes for the call before it runs
 *   checkDeclaredTools   what `regulator check` refuses about one workload's
 *                        declarations, and what it warns about: a built-in's
 *                        name, a name declared twice or by two workloads, a
 *                        schema that is not an object's, an effect that says
 *                        arbitrary execution or disagrees with the outputs, a
 *                        program with no file under the definition or an
 *                        output outside the project; and, for a tool whose
 *                        consent is derived, a profile that grants it and
 *                        may write under its outputs directly (refused: a
 *                        plain write there would need no yes) or grants a
 *                        shell beside it with no pattern covering the
 *                        outputs (warned: the shell is not path-gated)
 *
 * Pi-free and pure, beside the file lookup the graders and the runner share.
 */
import type { CapabilityProfile, ConsentGrant, DeclaredTool, ToolEffect, WorkloadDefinition } from "@metacoding.io/regulator-protocol";
import { PATH_GUARDED_TOOLS } from "./consent.js";
import { TOOL_EFFECTS, effectOf } from "./effects.js";
import { checkProgram, normalizeOutput } from "./runners.js";

export interface DeclaredToolOf {
  tool: DeclaredTool;
  /** The workload that declares it. */
  workload: string;
}

/** The declarations the definition's workloads carry, by tool name; a name declared twice keeps the first (the check refuses the second). */
export function declaredToolsOf(workloads: readonly WorkloadDefinition[]): Map<string, DeclaredToolOf> {
  const out = new Map<string, DeclaredToolOf>();
  for (const w of workloads) for (const tool of w.tools ?? []) if (!out.has(tool.name)) out.set(tool.name, { tool, workload: w.name });
  return out;
}

/** The declared tools' effects as a table, in the shape the built-in table has; nothing built in is in it. */
export function declaredEffectsOf(tools: Iterable<DeclaredTool>): Readonly<Record<string, ToolEffect>> {
  const out: Record<string, ToolEffect> = {};
  for (const tool of tools) if (!(tool.name in out)) out[tool.name] = tool.effect;
  return out;
}

/** The effects of every tool the workloads declare, for a definition read as a whole. */
export function declaredEffectsOfWorkloads(workloads: readonly WorkloadDefinition[]): Readonly<Record<string, ToolEffect>> {
  return declaredEffectsOf([...declaredToolsOf(workloads).values()].map((d) => d.tool));
}

/**
 * Whether a declared effect is one the gate derives consent from: side effects that cannot be undone. `unknown` is not
 * derived for — an unknown effect is a declaration that says nothing, and a gate derives nothing from nothing; the
 * read-only check already refuses such a tool to a read-only profile.
 */
export function consentDerivedFrom(effect: ToolEffect): boolean {
  return effect.sideEffects === "irreversible";
}

/** The bare grant the gate derives for a declared tool, or undefined when its effect derives none. */
export function derivedConsentGrant(tool: DeclaredTool): ConsentGrant | undefined {
  return consentDerivedFrom(tool.effect) ? { tool: tool.name } : undefined;
}

export interface CheckDeclaredToolsOptions {
  /** The definition root the program's file is resolved under. */
  root: string;
  workload: Pick<WorkloadDefinition, "name" | "tools">;
  /** Every declared profile: the ones that grant a tool are read for what they may reach beside it. */
  profiles: readonly CapabilityProfile[];
  /** Tool names the other workloads declare, each with its workload: the host registers a declared tool by name, so one workload declares it. */
  elsewhere?: ReadonlyMap<string, string>;
}

export interface DeclaredToolsCheck {
  problems: string[];
  warnings: string[];
}

function regExpOf(pattern: string): RegExp | undefined {
  try {
    return new RegExp(pattern);
  } catch {
    return undefined;
  }
}

/** What `regulator check` refuses and warns about in one workload's `tools[]`, in the order a reader fixes them. */
export async function checkDeclaredTools(options: CheckDeclaredToolsOptions): Promise<DeclaredToolsCheck> {
  const { root, workload, profiles } = options;
  const problems: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const tool of workload.tools ?? []) {
    const at = `tool "${tool.name}"`;
    if (tool.name in TOOL_EFFECTS) problems.push(`declares ${at}, which is a built-in the host registers (${Object.keys(TOOL_EFFECTS).join(", ")}): a declared tool's name is its own`);
    if (seen.has(tool.name)) problems.push(`declares ${at} twice`);
    seen.add(tool.name);
    const other = options.elsewhere?.get(tool.name);
    if (other !== undefined && other !== workload.name) problems.push(`declares ${at}, which workload "${other}" also declares: the host registers a declared tool by name, so one workload declares it`);
    if (tool.parameters.type !== "object") problems.push(`${at} declares a parameters schema whose type is ${JSON.stringify(tool.parameters.type)}; a tool's parameters are an object schema ("type": "object"), as every built-in's are`);
    if (tool.effect.execution === "arbitrary") problems.push(`${at} declares execution "arbitrary"; a declared tool is a program whose reach is its declared outputs, nothing wider, and arbitrary execution is the shell's alone`);
    const { problems: programProblems, outputs } = await checkProgram(root, at, tool.program, "the call's record");
    problems.push(...programProblems);
    if (tool.program.outputs.length && tool.effect.filesystem !== "write") problems.push(`${at} declares outputs (${tool.program.outputs.join(", ")}) and an effect whose filesystem is "${tool.effect.filesystem}": a program that writes under the project declares filesystem "write"`);
    if (!tool.program.outputs.length && tool.effect.filesystem === "write") problems.push(`${at} declares filesystem "write" and no outputs: a program's reach is its declared outputs, so what it writes is a prefix there`);
    if (!consentDerivedFrom(tool.effect)) continue;
    // A derived consent is enforced on the tool's calls. A profile that grants the tool and may reach its outputs another
    // way leaves the yes unasked there: a direct write is refused (the prefix is the profile's to drop or to guard), a shell
    // is warned about (nothing path-gates it), as the sandbox bypass is for a profile's own grant (#60).
    for (const profile of profiles.filter((p) => p.tools.includes(tool.name))) {
      const direct = profile.tools.filter((t) => PATH_GUARDED_TOOLS.has(t));
      const shells = profile.tools.filter((t) => effectOf(t)?.execution === "arbitrary");
      for (const output of outputs) {
        const reachable = profile.writablePaths.filter((w) => output.startsWith(w) || w.startsWith(output));
        for (const t of direct) {
          const guarded = (profile.consent ?? []).some((g) => g.tool === t && (!g.paths || g.paths.some((p) => output.startsWith(p) || p.startsWith(output))));
          if (reachable.length && !guarded) problems.push(`${at} needs consent, derived from its irreversible effect, and profile "${profile.name}" grants it beside ${t} under ${reachable.map((w) => `"${w}"`).join(", ")}, which reaches its output "${output}" with no yes asked: drop the prefix from the profile's writable paths, or guard it with a consent grant on ${t}`);
        }
        for (const shell of shells) {
          const covered = (profile.consent ?? []).some((g) => g.tool === shell && (g.pattern === undefined || regExpOf(g.pattern)?.test(output)));
          if (!covered) warnings.push(`${at} needs consent, derived from its irreversible effect, and profile "${profile.name}" grants ${shell}, which is not path-gated: a shell command can write under "${output}" with no consent asked. Declare {"tool":"${shell}","pattern":"${output.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}"} beside it, or the derived consent is enforced on ${tool.name} calls only`);
        }
      }
    }
  }
  return { problems, warnings };
}

/** The outputs of the declared tools whose consent is derived, normalized: what an instance's own writable prefixes must not reach (read by `doctor` against the manifest). */
export function guardedOutputsOf(tools: Iterable<DeclaredTool>): Array<{ tool: string; output: string }> {
  const out: Array<{ tool: string; output: string }> = [];
  for (const tool of tools) if (consentDerivedFrom(tool.effect)) for (const o of tool.program.outputs) out.push({ tool: tool.name, output: normalizeOutput(o) });
  return out;
}
