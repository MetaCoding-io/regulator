/**
 * Checkpoint 8 — evidence, not claims (lesson 09).
 *
 * The session side of audit. The independent layer is the orchestrator's:
 * `auditUnit` in `controller.ts` re-runs the workload's checks with the
 * harness's own runner against the committed revision and derives the
 * verdict from that evidence alone. What the session contributes is
 * *provenance* and an early refusal:
 *
 * 1. Provenance on tool results. Every `run_tests` / `run_checks` result is
 *    stamped with the revision it ran against and whether the tree was dirty,
 *    recorded as a typed session entry (`pi.appendEntry`) and appended to the
 *    text the model sees — so a claim of evidence can name what it rests on.
 * 2. A preflight on `report_result`. Before the report is written, each cited
 *    `test` or `command` evidence ref must correspond to a run *in this
 *    session*, *on the committed tree*, *at the current revision*, that
 *    *passed*. Otherwise the call is blocked with the reason. This catches the
 *    cheap lie — "tests pass" with no tests run — at the point it is told.
 *
 * Neither makes evidence independent: the session ran the tools. The
 * closeout gate does not read anything this extension records.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { EvidenceRef } from "@metacoding/regulator-protocol";

export const PROVENANCE_ENTRY_TYPE = "regulator:evidence-provenance";
export const EVIDENCE_TOOLS: Record<string, "test" | "command"> = { run_tests: "test", run_checks: "command" };

export interface EvidenceExtensionOptions {
  now?: () => number;
}

export interface ToolRun {
  tool: string;
  revision: string;
  dirty: boolean;
  ok: boolean;
  at: string;
}

export function createEvidenceExtension(options: EvidenceExtensionOptions = {}): (pi: ExtensionAPI) => void {
  const now = options.now ?? Date.now;

  return (pi) => {
    const runs = new Map<string, ToolRun>();

    const revisionOf = async (cwd: string): Promise<{ revision: string; dirty: boolean }> => {
      const head = await pi.exec("git", ["rev-parse", "HEAD"], { cwd });
      const status = await pi.exec("git", ["status", "--porcelain"], { cwd });
      const dirty = status.stdout.split("\n").some((line) => line.trim() && !line.slice(3).startsWith(".regulator/"));
      return { revision: head.code === 0 ? head.stdout.trim() : "unknown", dirty };
    };

    const passed = (toolName: string, isError: boolean, details: unknown): boolean => {
      if (isError) return false;
      const d = details as { fail?: number; results?: Array<{ ok: boolean }> } | undefined;
      if (toolName === "run_tests") return d?.fail === 0;
      if (toolName === "run_checks") return Array.isArray(d?.results) && d.results.every((r) => r.ok);
      return false;
    };

    pi.on("session_start", (_event, ctx) => {
      runs.clear();
      ctx.ui.setStatus("evidence", "evidence: no runs");
    });

    // Provenance: what a tool result rests on, stamped where the model and the session both see it.
    pi.on("tool_result", async (event, ctx) => {
      if (!(event.toolName in EVIDENCE_TOOLS)) return undefined;
      const { revision, dirty } = await revisionOf(ctx.cwd);
      const run: ToolRun = { tool: event.toolName, revision, dirty, ok: passed(event.toolName, event.isError, event.details), at: new Date(now()).toISOString() };
      runs.set(event.toolName, run);
      pi.appendEntry(PROVENANCE_ENTRY_TYPE, run);
      ctx.ui.setStatus("evidence", `evidence: ${[...runs.values()].map((r) => `${r.tool}@${r.revision.slice(0, 7)}${r.dirty ? "+" : ""} ${r.ok ? "ok" : "FAIL"}`).join(", ")}`);
      const stamp = `[regulator: ${event.toolName} ran at revision ${revision.slice(0, 7)}${dirty ? " with uncommitted changes" : ""}; the orchestrator re-runs it independently at close]`;
      return { content: [...event.content, { type: "text", text: stamp }] };
    });

    // Preflight: a report may not cite a run that did not happen here, on this tree, at this revision, and pass.
    pi.on("tool_call", async (event, ctx) => {
      if (event.toolName !== "report_result") return undefined;
      const cited = ((event.input as { evidence?: EvidenceRef[] }).evidence ?? []).filter((e) => e.class === "test" || e.class === "command");
      if (cited.length === 0) return undefined;
      const { revision, dirty } = await revisionOf(ctx.cwd);
      const problems: string[] = [];
      for (const ref of cited) {
        const tool = ref.class === "test" ? "run_tests" : "run_checks";
        const run = runs.get(tool);
        if (!run) problems.push(`"${ref.ref}" (${ref.class}) cites ${tool}, which has not run in this session`);
        else if (run.revision !== revision || run.dirty || dirty) problems.push(`"${ref.ref}" (${ref.class}): ${tool} ran at ${run.revision.slice(0, 7)}${run.dirty ? " on a dirty tree" : ""}; the tree is now at ${revision.slice(0, 7)}${dirty ? " with uncommitted changes" : ""} — commit, run ${tool} again, then report`);
        else if (!run.ok) problems.push(`"${ref.ref}" (${ref.class}): ${tool} ran at ${run.revision.slice(0, 7)} and did not pass; a report cannot cite it as evidence`);
      }
      if (problems.length === 0) return undefined;
      return { block: true, reason: `report refused before it was written — evidence must be produced, not claimed:\n${problems.map((p) => `- ${p}`).join("\n")}` };
    });
  };
}

export default createEvidenceExtension();
