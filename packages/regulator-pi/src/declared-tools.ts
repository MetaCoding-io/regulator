/**
 * Workload-declared tools (#121) — the host side.
 *
 * A workload may declare a tool of its own in `workload/<name>.json`: a
 * name, the description and the parameters schema the model sees, its
 * effect in the shape every built-in declares, and the program that
 * implements it. This extension registers every declared tool of the
 * definition, generically, when it loads — as Pi's own tools are registered,
 * before any flag is read — and knows nothing of what any of them does: the
 * domain is the workload's. A profile grants a declared tool by name as it
 * grants a built-in (the profile grant sets the surface), and the consent a
 * call of one may need is the authority extension's to derive from the
 * declared effect; nothing here asks or refuses.
 *
 * A call runs the declared program in the unit's worktree through the
 * control plane's own runner (`runDeclaredTool`), with the call's arguments
 * on stdin as JSON and the tool's declared outputs as its whole reach: a
 * write outside them is undone and the call refused, a non-zero exit or a
 * timeout is refused with what the program said, and the last stdout line
 * is what the model is told. The program's file, its hash, its exit and what
 * it wrote are recorded as a typed session entry, so a report's claim can
 * name what produced the file.
 *
 * Load with the other checkpoints; it registers nothing for a definition
 * that declares no tool.
 */
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { TSchema } from "typebox";
import { ExecutionStore, consentDerivedFrom } from "@metacoding.io/regulator-core";
import type { DeclaredToolOf, Exec } from "@metacoding.io/regulator";
import { DECLARED_TOOL_TIMEOUT_MS, LAB_ROOT, baseRoot, leaseStoreFor, loadDeclaredToolsSync, realExec, runDeclaredTool } from "@metacoding.io/regulator";

export const DECLARED_TOOL_ENTRY_TYPE = "regulator:declared-tool";

export interface DeclaredToolsExtensionOptions {
  /** The definition the tools are read from and their programs resolved under; the lab's by default. */
  definitionRoot?: string;
  /** The tools to register in place of the definition's (tests). */
  tools?: readonly DeclaredToolOf[];
  /** The ceiling a tool's program runs under; the lesser of it and the tool's own `timeoutMs` applies. */
  timeoutMs?: number;
  now?: () => number;
}

/** The description the model sees: the workload's, with what the harness adds for a tool whose consent it derives. */
export function describeDeclaredTool(tool: DeclaredToolOf["tool"]): string {
  if (!consentDerivedFrom(tool.effect)) return tool.description;
  return `${tool.description} Its declared effect is irreversible, so the harness refuses a call until a person's yes for exactly this call is on the record: ask first with ask_human kind=consent, with call naming the tool and the arguments you will use; the yes holds across attempts.`;
}

export function createDeclaredToolsExtension(options: DeclaredToolsExtensionOptions = {}): (pi: ExtensionAPI) => void {
  const now = options.now ?? Date.now;
  const root = options.definitionRoot ?? LAB_ROOT;
  const declared = options.tools ?? loadDeclaredToolsSync(root);
  const timeoutMs = options.timeoutMs ?? DECLARED_TOOL_TIMEOUT_MS;

  return (pi) => {
    const exec: Exec = async (command, args, execOptions) => {
      const result = await pi.exec(command, args, execOptions?.cwd ? { cwd: execOptions.cwd } : {});
      return { stdout: result.stdout, stderr: result.stderr, code: result.code };
    };
    let unitId = "";
    let attempt = 1;

    pi.on("session_start", async (_event, ctx) => {
      unitId = "";
      attempt = 1;
      try {
        const base = await baseRoot(exec, ctx.cwd);
        for (const lease of await leaseStoreFor(base, now).list()) {
          if (lease.resource === ctx.cwd) unitId = lease.unitId;
        }
        attempt = unitId ? ((await new ExecutionStore(base, now).getUnit(unitId))?.attempts ?? 0) + 1 : 1;
      } catch {
        unitId = "";
      }
      ctx.ui.setStatus("declared-tools", declared.length ? `declared tools: ${declared.map((d) => `${d.tool.name} (${d.workload}${consentDerivedFrom(d.tool.effect) ? ", consent derived" : ""})`).join(", ")}` : "declared tools: none");
    });

    for (const { tool, workload } of declared) {
      const definition: ToolDefinition<TSchema, { tool: string; workload: string; program: { file: string; sha256: string; exit: number }; written: string[]; evidence: unknown[] }> = {
        name: tool.name,
        label: tool.name,
        description: describeDeclaredTool(tool),
        promptSnippet: `${tool.name}: ${tool.description.split(/(?<=\.)\s/)[0]}`,
        parameters: tool.parameters as unknown as TSchema,
        async execute(toolCallId, params, _signal, _onUpdate, ctx) {
          const profile = pi.getFlag("profile");
          // The control plane's own runner, not Pi's exec: the program is handed its arguments on stdin and judged by its outputs, as a command runner's is.
          const run = await runDeclaredTool(realExec, {
            root, tool, arguments: params as Record<string, unknown>, cwd: ctx.cwd, timeoutMs,
            env: { ...(unitId ? { REGULATOR_UNIT: unitId } : {}), REGULATOR_ATTEMPT: String(attempt), ...(typeof profile === "string" && profile ? { REGULATOR_PROFILE: profile } : {}) },
          });
          const record = { tool: tool.name, workload, toolCallId, ...(unitId ? { unit: unitId } : {}), attempt, program: run.program, written: run.written, at: new Date(now()).toISOString() };
          pi.appendEntry(DECLARED_TOOL_ENTRY_TYPE, record);
          const provenance = `[regulator: ${tool.name} ran ${run.program.file} (${run.program.sha256.slice(0, 12)}), exit ${run.program.exit}; ${run.written.length ? `wrote ${run.written.join(", ")} under its declared outputs (${tool.program.outputs.join(", ")})` : "wrote nothing"}.]`;
          return { content: [{ type: "text", text: `${run.summary}\n${provenance}` }], details: { tool: tool.name, workload, program: run.program, written: run.written, evidence: run.evidence } };
        },
      };
      pi.registerTool(definition);
    }
  };
}

export default createDeclaredToolsExtension();
