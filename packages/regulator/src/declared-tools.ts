/**
 * Workload-declared tools (#121), Pi-free: how the control plane reads them
 * off the definition and runs one, so the Pi host's extension and the
 * scripted units call the same program the same way.
 *
 *   loadDeclaredToolsSync  every tool the definition's workloads declare,
 *                          with the workload that owns it, read at load —
 *                          the host registers tools when its extensions
 *                          load, before any flag is set
 *   loadDeclaredTools      the same, asynchronously
 *   runDeclaredTool        one call of a declared tool: the arguments
 *                          checked against the tool's schema, the program
 *                          run in the unit's worktree through `runProgram`
 *                          with the arguments on stdin as JSON and the
 *                          tool's declared outputs as its whole reach, a
 *                          write outside them undone and the call refused,
 *                          a non-zero exit or a timeout refused with what
 *                          the program said, and the last stdout line (a
 *                          JSON object with `summary`, or the tail) as what
 *                          the model is told, with the program's file, hash
 *                          and exit as provenance
 *
 * What runs a declared tool trusts the declared program to be the workload's,
 * as the command runner does; it inspects nothing beyond the declaration.
 * Whether the call may run at all — the consent a person's yes authorizes —
 * is the consent gate's (`consent.ts`), checked before this is reached.
 */
import { readdirSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Value } from "typebox/value";
import { declaredEffectsOf, declaredToolsOf, type DeclaredToolOf } from "@metacoding.io/regulator-core";
import { ReportedEvidenceSchema, WorkloadDefinitionSchema, assertValid, type AttemptProgram, type DeclaredTool, type ToolEffect, type WorkloadDefinition } from "@metacoding.io/regulator-protocol";
import type { Static } from "typebox";
type ReportedEvidence = Static<typeof ReportedEvidenceSchema>;
import type { Exec } from "./exec.js";
import { excerpt, runProgram, tail } from "./runner.js";
import { LAB_ROOT } from "./workload.js";

export type { DeclaredToolOf } from "@metacoding.io/regulator-core";

/** The ceiling a declared tool's program runs under when the host names none: the typed tools' own default. */
export const DECLARED_TOOL_TIMEOUT_MS = 120_000;

function workloadsSync(root: string): WorkloadDefinition[] {
  const dir = path.join(root, "workload");
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }
  return files.map((file) => {
    const value: unknown = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
    assertValid(WorkloadDefinitionSchema, value, `workload ${file}`);
    return value;
  });
}

/** Every tool the definition's workloads declare, by name, read at load; a definition that declares none gives an empty list. */
export function loadDeclaredToolsSync(root: string = LAB_ROOT): DeclaredToolOf[] {
  return [...declaredToolsOf(workloadsSync(root)).values()];
}

export async function loadDeclaredTools(root: string = LAB_ROOT): Promise<DeclaredToolOf[]> {
  const dir = path.join(root, "workload");
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }
  const workloads: WorkloadDefinition[] = [];
  for (const file of files) {
    const value: unknown = JSON.parse(await readFile(path.join(dir, file), "utf8"));
    assertValid(WorkloadDefinitionSchema, value, `workload ${file}`);
    workloads.push(value);
  }
  return [...declaredToolsOf(workloads).values()];
}

/** The declared tools' effects as a table: what the consent gate derives from, and nothing built in. */
export function declaredEffects(tools: readonly DeclaredToolOf[]): Readonly<Record<string, ToolEffect>> {
  return declaredEffectsOf(tools.map((d) => d.tool));
}

/** Why a call's arguments do not fit the tool's schema, or undefined when they do: the check the gate's amendment runs and the run runs again. */
export function declaredToolArgumentProblems(tool: DeclaredTool, args: Record<string, unknown>): string | undefined {
  return Value.Check(tool.parameters, args) ? undefined : [...Value.Errors(tool.parameters, args)].map((e) => `${e.instancePath || "/"}: ${e.message}`).join("; ");
}

export interface RunDeclaredToolOptions {
  /** The definition root the program's file is resolved under. */
  root: string;
  tool: DeclaredTool;
  arguments: Record<string, unknown>;
  /** The unit's worktree. */
  cwd: string;
  /** The host's ceiling; the lesser of it and the tool's own `timeoutMs` applies. */
  timeoutMs?: number;
  /** What the program is told beside its arguments: the unit, the attempt, the profile, when the caller knows them. */
  env?: NodeJS.ProcessEnv;
}

export interface DeclaredToolRun {
  /** The program that ran, with its exit: the call's provenance. */
  program: AttemptProgram & { exit: number };
  /** What the model is told: the program's `summary` from its last JSON line, or the tail of what it printed. */
  summary: string;
  /** Evidence the program's last line cites, when it cites any. */
  evidence: ReportedEvidence[];
  /** The paths the program wrote under its declared outputs. */
  written: string[];
}

/** A refused call of a declared tool: what the program did not do, with the program's provenance where it ran. */
export class DeclaredToolError extends Error {
  constructor(message: string, readonly program?: AttemptProgram) {
    super(message);
    this.name = "DeclaredToolError";
  }
}

export async function runDeclaredTool(exec: Exec, options: RunDeclaredToolOptions): Promise<DeclaredToolRun> {
  const { tool } = options;
  const why = declaredToolArgumentProblems(tool, options.arguments);
  if (why !== undefined) throw new DeclaredToolError(`${tool.name} refused: the arguments do not fit the tool's schema (${why})`);
  const run = await runProgram(exec, {
    root: options.root, program: tool.program, cwd: options.cwd, timeoutMs: options.timeoutMs ?? DECLARED_TOOL_TIMEOUT_MS,
    input: `${JSON.stringify(options.arguments)}\n`, env: { ...options.env, REGULATOR_TOOL: tool.name },
  });
  const { program, result, timedOut, written, outside } = run;
  if (outside.length) throw new DeclaredToolError(`${tool.name} refused: its program wrote outside the tool's declared outputs (${tool.program.outputs.join(", ") || "none"}): ${outside.join(", ")}; the writes are undone and nothing of this call stands`, { ...program, ...(timedOut ? {} : { exit: result.code }) });
  if (timedOut) throw new DeclaredToolError(`${tool.name} refused: its program ran past its ceiling and was stopped with nothing done${result.stderr.trim() ? `; stderr: ${tail(result.stderr)}` : ""}`, program);
  if (result.code !== 0) throw new DeclaredToolError(`${tool.name} refused: its program exited ${result.code}: ${excerpt(result.stderr) || excerpt(result.stdout) || "(no output)"}`, { ...program, exit: result.code });
  const last = result.stdout.trim().split("\n").map((l) => l.trim()).filter(Boolean).at(-1);
  let parsed: unknown;
  try { parsed = last === undefined ? undefined : JSON.parse(last); } catch { parsed = undefined; }
  const said = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as { summary?: unknown; evidence?: unknown }) : undefined;
  const summary = typeof said?.summary === "string" && said.summary ? said.summary : (tail(result.stdout) || `${tool.name} ran`);
  const evidence = Array.isArray(said?.evidence) ? (said.evidence as ReportedEvidence[]).filter((e) => typeof e === "object" && e !== null && typeof (e as { ref?: unknown }).ref === "string") : [];
  return { program: { ...program, exit: result.code }, summary, evidence, written };
}
