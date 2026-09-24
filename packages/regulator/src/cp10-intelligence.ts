/**
 * Checkpoint 10 — environmental intelligence (lesson 11).
 *
 * The session side of S4. A research unit runs like any other unit — its own
 * contract, budget, model route and profile, dispatched by S3 — and what it
 * produces is *intelligence*: a typed claim with evidence, confidence,
 * recency and the units it bears on. This extension gives it exactly one way
 * to say so:
 *
 *   report_intelligence   a typed tool that records an intelligence-signal
 *                         (S4 → S3) in the regulatory log, with the unit,
 *                         revision and session as provenance the model does
 *                         not supply. It changes nothing. There is no tool to
 *                         apply, resolve or route intelligence: the router
 *                         (orchestrator, under the routing policy) decides
 *                         what an obligation it raises means for a unit.
 *
 * Reported severity is the unit's claim; the router derives what it acts on.
 * Intelligence with an expiry that has passed is noted, never an obligation.
 *
 * Load with checkpoints 2–9; the intelligence profile (cp3) is what puts the
 * tool in a session's surface, and the lease gate (cp4) is what keeps a
 * research unit from writing anywhere.
 */
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ConfidenceSchema, ReportedEvidenceSchema, SeveritySchema, type IntelligenceSignal } from "@metacoding/vsm-pi-protocol";
import { appendSignal } from "@metacoding/vsm-pi-core";
import type { Exec } from "./exec.js";
import { leaseStoreFor } from "./unit.js";
import { baseRoot, headRevision, isClean } from "./worktree.js";

export const INTELLIGENCE_ENTRY_TYPE = "regulator:intelligence";

export interface IntelligenceExtensionOptions {
  now?: () => number;
}

export const ReportIntelligenceInputSchema = Type.Object({
  subject: Type.String({ minLength: 1, maxLength: 200, description: "What the intelligence is about: a dependency, a platform, an advisory, a behaviour" }),
  claim: Type.String({ minLength: 1, maxLength: 2000, description: "The finding in one or two sentences" }),
  observation: Type.String({ minLength: 1, maxLength: 4000, description: "What you read or measured that supports the claim" }),
  confidence: ConfidenceSchema,
  reportedSeverity: SeveritySchema,
  evidence: Type.Array(ReportedEvidenceSchema, { minItems: 1, description: "Files, versions, dates: what the claim rests on" }),
  affectedUnits: Type.Array(Type.String({ pattern: "^[a-zA-Z0-9._-]+$" }), { description: "Unit ids whose work this bears on; empty if none" }),
  observedAt: Type.Optional(Type.String({ minLength: 1, description: "When the environment was observed, ISO 8601; defaults to now" })),
  expiresAt: Type.Optional(Type.String({ minLength: 1, description: "When the finding stops being current, ISO 8601, if it does" })),
}, { additionalProperties: false });

export function createIntelligenceExtension(options: IntelligenceExtensionOptions = {}): (pi: ExtensionAPI) => void {
  const now = options.now ?? Date.now;

  return (pi) => {
    const exec: Exec = async (command, args, execOptions) => {
      const result = await pi.exec(command, args, execOptions?.cwd ? { cwd: execOptions.cwd } : {});
      return { stdout: result.stdout, stderr: result.stderr, code: result.code };
    };
    let base = "";
    let unitId = "";
    let reported = 0;

    pi.on("session_start", async (_event, ctx) => {
      reported = 0;
      unitId = "";
      try {
        base = await baseRoot(exec, ctx.cwd);
        for (const lease of await leaseStoreFor(base, now).list()) {
          if (path.resolve(lease.resource) === path.resolve(ctx.cwd)) unitId = lease.unitId;
        }
      } catch {
        base = "";
      }
      ctx.ui.setStatus("intelligence", unitId ? `intelligence: reporting as unit ${unitId}` : "intelligence: no unit");
    });

    pi.registerTool({
      name: "report_intelligence",
      label: "Report intelligence",
      description:
        "Record what you found out about the project's environment as typed intelligence for the orchestrator: the claim, what supports it, " +
        "how sure you are, as of when, and which units it affects. It is advice. Nothing is applied, no unit is changed, no policy moves; " +
        "the orchestrator routes it under its policy. Call it once per finding.",
      promptSnippet: "Record a typed intelligence finding for the orchestrator; it is advice and changes nothing",
      promptGuidelines: ["Report intelligence as a claim with its evidence and confidence, and name the affected units; do not act on it and do not recommend that the orchestrator skip its own checks."],
      parameters: ReportIntelligenceInputSchema,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        if (!base) throw new Error("This session is not inside a repository the orchestrator knows; intelligence has nowhere to be recorded.");
        const revision = await headRevision(exec, ctx.cwd);
        const dirty = !(await isClean(exec, ctx.cwd));
        const at = new Date(now()).toISOString();
        const signal: IntelligenceSignal = {
          id: randomUUID(), timestamp: at, source: "S4", kind: "intelligence-signal", channel: "intelligence", destination: "S3",
          severity: params.reportedSeverity, subject: params.subject, ...(unitId ? { unit: unitId } : {}),
          observation: params.observation, claim: params.claim, confidence: params.confidence,
          evidence: params.evidence.map((e) => ({ ...e, sourceRevision: revision })),
          observedAt: params.observedAt ?? at, ...(params.expiresAt === undefined ? {} : { expiresAt: params.expiresAt }),
          affectedUnits: params.affectedUnits,
        };
        await appendSignal(base, signal);
        reported += 1;
        pi.appendEntry(INTELLIGENCE_ENTRY_TYPE, { id: signal.id, revision, dirty, at });
        ctx.ui.setStatus("intelligence", `intelligence: ${reported} finding(s) recorded${unitId ? ` as unit ${unitId}` : ""}`);
        ctx.ui.notify(`regulator: intelligence ${signal.id.slice(0, 8)} recorded for S3 (${params.subject}, ${params.confidence} confidence)`, "info");
        return {
          content: [{ type: "text", text: `Intelligence ${signal.id} recorded on the intelligence channel for S3 at revision ${revision.slice(0, 7)}${dirty ? " (working tree dirty)" : ""}. Nothing has been applied: the orchestrator routes it under its policy${params.affectedUnits.length ? ` and may hold ${params.affectedUnits.join(", ")} until it is dispositioned` : ""}. Continue, and close the contract with report_result when you are done.` }],
          details: { intelligenceId: signal.id, revision, affectedUnits: params.affectedUnits },
        };
      },
    });
  };
}

export default createIntelligenceExtension();
