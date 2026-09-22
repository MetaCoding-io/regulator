/**
 * Checkpoint 11 — durable identity and policy (lesson 12).
 *
 * Three kinds of persistence, kept apart by mechanism:
 *
 *   identity            the instance's `regulator/identity/` set — what the
 *                       system is, its invariants, its glossary, its
 *                       boundaries — rendered into the system prompt from the
 *                       files on every run (`before_agent_start`). It never
 *                       lives in the transcript, so compaction cannot lose it
 *                       and a model version cannot reinterpret it. Write-
 *                       protected by checkpoint 9; proposed against, never
 *                       edited, by a unit.
 *   operational memory  `.regulator/memory.ndjson` — what units learned about
 *                       the environment. Agent-writable through one typed tool,
 *                       `remember`, whose provenance (unit, revision, time) the
 *                       harness stamps and whose review-by date is required and
 *                       bounded. Current entries are rendered as facts that
 *                       expire; nothing here can reach an identity file.
 *   runtime evidence    the audit log (checkpoint 8). Not this checkpoint's.
 *
 * Load with checkpoints 2–10. The dispatcher (lesson 12) loads no context
 * files from the worktree: this section is the identity a unit sees.
 */
import path from "node:path";
import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ReportedEvidenceSchema } from "@metacoding/vsm-pi-protocol";
import { MemoryStore, readIdentity, renderIdentitySection, renderMemorySection, type IdentitySet } from "@metacoding/vsm-pi-core";
import type { Exec } from "./exec.js";
import { IDENTITY_RELATIVE_DIR, leaseStoreFor } from "./unit.js";
import { baseRoot, headRevision } from "./worktree.js";

export const IDENTITY_SECTION_TAG = "regulator_identity";
export const MEMORY_SECTION_TAG = "regulator_memory";
export const MEMORY_ENTRY_TYPE = "regulator:memory";

export interface IdentityExtensionOptions {
  now?: () => number;
  /** Days a memory entry may be current for before review. */
  maxReviewDays?: number;
}

export const RememberInputSchema = Type.Object({
  subject: Type.String({ minLength: 1, maxLength: 120, description: "What the fact is about: a tool, a command, a service, a directory" }),
  note: Type.String({ minLength: 1, maxLength: 1000, description: "The fact, as one or two sentences a later unit can act on" }),
  evidence: Type.Array(ReportedEvidenceSchema, { description: "What you observed that establishes it; empty if it is a plain observation" }),
  reviewBy: Type.String({ minLength: 1, description: "ISO date after which the fact should be re-checked; required, in the future, within the store's limit" }),
}, { additionalProperties: false });

export function createIdentityExtension(options: IdentityExtensionOptions = {}): (pi: ExtensionAPI) => void {
  const now = options.now ?? Date.now;

  return (pi) => {
    const exec: Exec = async (command, args, execOptions) => {
      const result = await pi.exec(command, args, execOptions?.cwd ? { cwd: execOptions.cwd } : {});
      return { stdout: result.stdout, stderr: result.stderr, code: result.code };
    };
    let base = "";
    let unitId = "";
    let identity: IdentitySet | undefined;
    let memory: MemoryStore | undefined;

    pi.on("session_start", async (_event, ctx) => {
      unitId = "";
      identity = undefined;
      memory = undefined;
      try {
        base = await baseRoot(exec, ctx.cwd);
      } catch {
        base = "";
      }
      // The identity is read from the working tree the unit sees: it is protected there, and the closeout check
      // compares it with the base, so what is rendered is what is committed or a finding.
      identity = await readIdentity(path.join(ctx.cwd, IDENTITY_RELATIVE_DIR));
      if (base) {
        memory = new MemoryStore(base, now, options.maxReviewDays === undefined ? {} : { maxReviewDays: options.maxReviewDays });
        for (const lease of await leaseStoreFor(base, now).list()) {
          if (path.resolve(lease.resource) === path.resolve(ctx.cwd)) unitId = lease.unitId;
        }
      }
      const current = memory ? (await memory.current()).length : 0;
      const problems = identity.problems.length ? `; ${identity.problems.length} problem(s)` : "";
      ctx.ui.setStatus("identity", identity.invariants.length ? `identity: ${identity.invariants.map((i) => i.id).join(", ")}${problems}; memory: ${current} current` : `identity: none found under ${IDENTITY_RELATIVE_DIR}${problems}`);
      if (identity.problems.length) ctx.ui.notify(`regulator: identity problems — ${identity.problems.join("; ")}`, "warning");
    });

    // Level 5 by design: identity and memory are advice to the model. What makes identity binding is the gate
    // (checkpoint 9) and the closeout check (this lesson); what keeps memory honest is the expiry the tool enforces.
    pi.on("before_agent_start", async (event) => {
      if (identity && (identity.invariants.length || Object.keys(identity.files).length)) event.systemPromptOptions.sections[IDENTITY_SECTION_TAG] = renderIdentitySection(identity);
      if (memory) event.systemPromptOptions.sections[MEMORY_SECTION_TAG] = renderMemorySection(await memory.current());
      return undefined;
    });

    pi.registerTool({
      name: "remember",
      label: "Remember",
      description:
        "Record a fact about this environment for later units — a flag a test needs, a tool the runner lacks, a command that only works one way. " +
        "It is operational memory, not identity: it carries your unit and revision as provenance, it expires on the review-by date you give, " +
        "and it never changes a rule. A fact that turns out to be a rule is proposed with propose_policy_change instead.",
      promptSnippet: "Record an environmental fact with an expiry for later units; never a rule",
      promptGuidelines: ["Use remember for facts about the environment with a review-by date; use propose_policy_change for anything that would change identity or policy."],
      parameters: RememberInputSchema,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        if (!memory || !base) throw new Error("This session is not inside a repository the orchestrator knows; memory has nowhere to be recorded.");
        const revision = await headRevision(exec, ctx.cwd).catch(() => undefined);
        const entry = await memory.record({
          subject: params.subject, note: params.note, evidence: params.evidence.map((e) => ({ ...e, ...(revision ? { sourceRevision: revision } : {}) })),
          ...(unitId ? { unit: unitId } : {}), ...(revision ? { revision } : {}), recordedBy: "S1", reviewBy: params.reviewBy,
        });
        pi.appendEntry(MEMORY_ENTRY_TYPE, { id: entry.id, subject: entry.subject, reviewBy: entry.reviewBy, at: entry.recordedAt });
        ctx.ui.notify(`regulator: remembered "${entry.subject}" until ${entry.reviewBy.slice(0, 10)}`, "info");
        return {
          content: [{ type: "text", text: `Recorded memory ${entry.id} ("${entry.subject}"), current until ${entry.reviewBy.slice(0, 10)}, with unit ${unitId || "none"} and revision ${revision?.slice(0, 7) ?? "unknown"} as provenance. It is a fact for later units, not a rule.` }],
          details: { memoryId: entry.id, reviewBy: entry.reviewBy },
        };
      },
    });
  };
}

export default createIdentityExtension();
