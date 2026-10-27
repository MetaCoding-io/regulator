/**
 * Checkpoint 9 — authority boundaries and protected state (lesson 10).
 *
 * Four mechanisms, each with a stated boundary:
 *
 * 1. The identity write gate. `write` and `edit` go through `prepareWritePath`
 *    (core): malformed input, home expansion, file URLs, traversal, the S5
 *    artifacts, the instance's harness-owned directories (`regulator/identity/`, `regulator/advice/`), the project's
 *    protected paths (from its conventions), their parents, and the aliases a
 *    lexical check cannot see — symlinks, hard links, non-directory parents —
 *    all refused; the tool executes exactly the normalized path that was
 *    checked. Fail closed.
 * 2. The bash watch. A hook cannot sandbox a shell. It can take a snapshot of
 *    every protected file before `bash` runs and compare after: a change is
 *    reverted from the snapshot, recorded as an audit finding (S3* → S3,
 *    INV-001), and reported in the tool result the model sees. Detection and
 *    repair, not prevention — and only for the working tree.
 * 3. Proposal intake. `propose_policy_change` records a typed proposal on the
 *    proposal channel and changes nothing (INV-002).
 * 4. The trust rule and the canary watch. A unit's project never gets to load
 *    its own extensions or skills into the harness (`project_trust` → no); and
 *    any canary value the instance declares (`.regulator/canaries`) is redacted
 *    from every tool result and reported when it appears in the model's text.
 * 5. The consent gate (#60, #121). A call that falls under the profile's
 *    consent grant — a write or edit under a guarded prefix, a shell command
 *    the grant's pattern matches, any call of a bare-granted tool — or that
 *    calls a tool the workload declared with an irreversible effect, for
 *    which the gate derives the same bare grant from the declaration with no
 *    profile naming it, runs only when the ledger holds a consent obligation
 *    for this unit, resolved as accepted, whose recorded call covers it.
 *    Otherwise the call is refused before it runs, the refusal is an
 *    operational-signal to S3, and the unit is told to ask with ask_human
 *    kind=consent naming the call. A yes that carries amended arguments runs
 *    the amended call in place of the proposed one, and the tool result
 *    names what changed. The profile is the one the dispatcher names in the
 *    `profile` flag, as the profile grant reads it; the declared effects are
 *    the definition's workloads', read at load, and only theirs: a built-in
 *    with an irreversible effect (ask_human, notify_owner) is a channel to a
 *    person, and consent on it would be circular.
 *
 * Load with checkpoints 2–8; this checkpoint supersedes the lexical vendor
 * gate of checkpoint 1 and the profile grant's path check of checkpoint 3.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Type } from "typebox";
import { Value } from "typebox/value";
import { isToolCallEventType, type ExtensionAPI, type ToolCallEventResult } from "@earendil-works/pi-coding-agent";
import { SeveritySchema, type AuditFinding, type CapabilityProfile, type PolicyProposal, type ToolEffect } from "@metacoding.io/regulator-protocol";
import { discoverConventions } from "@metacoding.io/regulator-checks";
import { PROTECTED_S5_PATHS, appendSignal, consentRequiredFor, prepareWritePath } from "@metacoding.io/regulator-core";
import type { Exec } from "@metacoding.io/regulator";
import { CANARIES_RELATIVE_PATH, HARNESS_OWNED_INSTANCE_DIRS, LAB_ROOT, PROFILES, consentGate, declaredEffects, isProfileName, leaseStoreFor, loadDeclaredToolsSync } from "@metacoding.io/regulator";
import { baseRoot } from "@metacoding.io/regulator";

export interface AuthorityExtensionOptions {
  now?: () => number;
  /** Values that must never appear in a tool result or the model's text, besides the instance's `.regulator/canaries`. */
  canaries?: readonly string[];
  /** The profile whose consent grant the gate enforces; by default the one the `profile` flag names, as the profile grant reads it. */
  profile?: CapabilityProfile;
  /** The effects of the workload-declared tools the gate derives consent from (#121); by default the definition's, read at load. */
  declared?: Readonly<Record<string, ToolEffect>>;
  /** The definition the declared tools are read from; the lab's by default. */
  definitionRoot?: string;
}

export const REDACTION = "[REDACTED: canary]";

/** Every file under the protected paths, by project-relative path. `null` marks a path that did not exist. */
export async function snapshotProtected(cwd: string, protectedPaths: readonly string[]): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  for (const p of protectedPaths) {
    const abs = path.join(cwd, p);
    let info;
    try {
      info = await stat(abs);
    } catch {
      continue;
    }
    if (info.isFile()) {
      files.set(p.replace(/^\.\//, ""), await readFile(abs));
    } else if (info.isDirectory()) {
      for (const entry of await readdir(abs, { recursive: true, withFileTypes: true })) {
        if (!entry.isFile()) continue;
        const full = path.join(entry.parentPath ?? entry.path, entry.name);
        files.set(path.relative(cwd, full), await readFile(full));
      }
    }
  }
  return files;
}

export interface ProtectedChange {
  path: string;
  kind: "modified" | "deleted" | "created";
}

/** Compare two snapshots and restore the first: the change is undone and named. */
export async function restoreProtected(cwd: string, before: Map<string, Buffer>, after: Map<string, Buffer>): Promise<ProtectedChange[]> {
  const changes: ProtectedChange[] = [];
  for (const [p, content] of before) {
    const now = after.get(p);
    if (now === undefined) changes.push({ path: p, kind: "deleted" });
    else if (!now.equals(content)) changes.push({ path: p, kind: "modified" });
    else continue;
    await mkdir(path.dirname(path.join(cwd, p)), { recursive: true });
    await writeFile(path.join(cwd, p), content);
  }
  for (const p of after.keys()) {
    if (before.has(p)) continue;
    changes.push({ path: p, kind: "created" });
    await rm(path.join(cwd, p), { force: true });
  }
  return changes;
}

export function createAuthorityExtension(options: AuthorityExtensionOptions = {}): (pi: ExtensionAPI) => void {
  const now = options.now ?? Date.now;
  // The declared effects (#121): the workloads' own tools and nothing built in, so the derivation never reaches a channel to a person.
  const declared = options.declared ?? declaredEffects(loadDeclaredToolsSync(options.definitionRoot ?? LAB_ROOT));

  return (pi) => {
    const exec: Exec = async (command, args, execOptions) => {
      const result = await pi.exec(command, args, execOptions?.cwd ? { cwd: execOptions.cwd } : {});
      return { stdout: result.stdout, stderr: result.stderr, code: result.code };
    };
    let base = "";
    let unitId = "";
    let protectedPaths: string[] = [...HARNESS_OWNED_INSTANCE_DIRS];
    let canaries: string[] = [...(options.canaries ?? [])];
    const snapshots = new Map<string, Map<string, Buffer>>();
    let profile: CapabilityProfile = options.profile ?? PROFILES.implement;
    /** Calls the consent gate ran with a person's amendment, by tool call id: the result names the fields that changed. */
    const amendments = new Map<string, { by: string; fields: string[] }>();

    const finding = async (severity: AuditFinding["severity"], subject: string, observation: string, invariant: string, evidence: AuditFinding["evidence"] = []): Promise<void> => {
      if (!base) return;
      const message: AuditFinding = {
        id: randomUUID(), timestamp: new Date(now()).toISOString(), source: "S3*", kind: "audit-finding", channel: "audit", destination: "S3",
        severity, subject, ...(unitId ? { unit: unitId } : {}), invariant, observation, evidence,
      };
      await appendSignal(base, message);
    };

    // The trust rule: a unit's project is data, never a source of extensions or skills for the harness.
    pi.on("project_trust", (event) => {
      return { trusted: "no", ...(event ? {} : {}) };
    });

    pi.on("session_start", async (_event, ctx) => {
      try {
        base = await baseRoot(exec, ctx.cwd);
      } catch {
        base = "";
      }
      const conventions = await discoverConventions(ctx.cwd);
      // The harness-owned directories come from DEFINITION_WRITERS (identity, advice), never restated here; the conventions add the project's.
      protectedPaths = [...HARNESS_OWNED_INSTANCE_DIRS, ...conventions.protectedPaths.filter((p) => !HARNESS_OWNED_INSTANCE_DIRS.includes(p))];
      unitId = "";
      amendments.clear();
      if (!options.profile) {
        const flag = pi.getFlag("profile");
        profile = typeof flag === "string" && isProfileName(flag) ? PROFILES[flag] : PROFILES.implement;
      }
      if (base) {
        for (const lease of await leaseStoreFor(base, now).list()) {
          if (path.resolve(lease.resource) === path.resolve(ctx.cwd)) unitId = lease.unitId;
        }
        try {
          canaries = [...new Set([...(options.canaries ?? []), ...(await readFile(path.join(base, CANARIES_RELATIVE_PATH), "utf8")).split("\n").map((l) => l.trim()).filter(Boolean)])];
        } catch {
          canaries = [...(options.canaries ?? [])];
        }
      }
      const trusted = typeof ctx.isProjectTrusted === "function" ? ctx.isProjectTrusted() : false;
      const grants = profile.consent?.length ?? 0;
      const derived = profile.tools.filter((t) => declared[t]?.sideEffects === "irreversible");
      ctx.ui.setStatus("authority", `authority: protecting ${protectedPaths.join(", ")}; project ${trusted ? "TRUSTED (unexpected)" : "untrusted"}; ${canaries.length} canar${canaries.length === 1 ? "y" : "ies"}${grants ? `; ${grants} consent grant${grants === 1 ? "" : "s"} (${profile.name})` : ""}${derived.length ? `; consent derived for ${derived.join(", ")} (${profile.name})` : ""}`);
      if (trusted) ctx.ui.notify("regulator: this project is trusted — its own extensions and skills may have loaded into the harness. A unit's project should never be.", "warning");
    });

    // 5. The consent gate: a guarded call — under the profile's grant, or a declared tool whose irreversible effect derives one —
    // runs only on a person's recorded yes for it. Not the model's decision, and not the hint's.
    const consent = async (toolName: string, toolCallId: string, input: Record<string, unknown>, notify: (message: string) => void): Promise<ToolCallEventResult | undefined> => {
      const requirement = consentRequiredFor(profile, { tool: toolName, arguments: input }, declared);
      if (!requirement) return undefined;
      if (!base) return { block: true, reason: `regulator: ${toolName} ${requirement.source === "profile" ? `falls under profile "${profile.name}"'s consent grant` : "needs consent derived from its declared effect"}, and this session is not inside a repository the orchestrator knows: no consent can be on the record here.` };
      const decision = await consentGate({
        repo: base, ...(unitId ? { unitId } : {}), profile, call: { tool: toolName, arguments: input }, now, declared,
        validate: (args) => {
          const schema = pi.getAllTools().find((t) => t.name === toolName)?.parameters;
          if (!schema) return "the tool's schema is not known to this session";
          return Value.Check(schema, args) ? undefined : [...Value.Errors(schema, args)].map((e) => `${e.instancePath || "/"}: ${e.message}`).join("; ");
        },
      });
      if (!decision.allowed) {
        notify(`regulator: ${toolName} refused — ${decision.reason}`);
        return { block: true, reason: `regulator: ${toolName} refused: ${decision.reason}. ${decision.instruction}` };
      }
      if (decision.guarded && decision.amended.length) {
        for (const key of decision.amended) input[key] = decision.arguments[key];
        amendments.set(toolCallId, { by: decision.by, fields: decision.amended });
      }
      return undefined;
    };

    // 1. The identity write gate.
    pi.on("tool_call", async (event, ctx): Promise<ToolCallEventResult | undefined> => {
      const notify = (message: string) => ctx.ui.notify(message, "warning");
      if (isToolCallEventType("write", event) || isToolCallEventType("edit", event)) {
        const prepared = await prepareWritePath(ctx.cwd, event.input.path, { authority: "operational", protectedPaths });
        if (!prepared.allowed) {
          const hint = prepared.cause === "protected" ? " Identity and protected paths change through propose_policy_change, never through a unit's write; a proposal records the request and changes nothing." : "";
          return { block: true, reason: `regulator: ${prepared.reason}${hint}` };
        }
        event.input.path = prepared.path;
        // 5. On the path that was checked: an amendment never moves it, so what runs is what the gate saw.
        return consent(event.toolName, event.toolCallId, event.input, notify);
      }
      // 2. Before a shell command: remember what the protected files hold.
      if (event.toolName === "bash") snapshots.set(event.toolCallId, await snapshotProtected(ctx.cwd, protectedPaths));
      return consent(event.toolName, event.toolCallId, event.input as Record<string, unknown>, notify);
    });

    pi.on("tool_result", async (event, ctx) => {
      let content = event.content;
      let changed = false;
      // 5. A call that ran with a person's amendment says so: the unit proposed something else.
      const amended = amendments.get(event.toolCallId);
      if (amended) {
        amendments.delete(event.toolCallId);
        content = [...content, { type: "text", text: `[regulator: this ${event.toolName} ran with ${amended.fields.join(", ")} as ${amended.by}'s consent amended ${amended.fields.length === 1 ? "it" : "them"}, not as you proposed. The record of the consent holds the amended value.]` }];
        changed = true;
      }
      // 2. After a shell command: anything protected that changed is put back and reported.
      const before = snapshots.get(event.toolCallId);
      if (event.toolName === "bash" && before) {
        snapshots.delete(event.toolCallId);
        const changes = await restoreProtected(ctx.cwd, before, await snapshotProtected(ctx.cwd, protectedPaths));
        if (changes.length) {
          const described = changes.map((c) => `${c.path} (${c.kind})`).join(", ");
          await finding("blocking", "protected path changed by bash", `bash changed ${described}; the working tree was restored from the pre-command snapshot. Command: ${String((event.input as { command?: unknown }).command ?? "").slice(0, 200)}`, "INV-001",
            changes.map((c) => ({ class: "file" as const, ref: c.path, observation: c.kind })));
          ctx.ui.notify(`regulator: bash changed protected ${described}; restored and recorded as an audit finding`, "error");
          content = [...content, { type: "text", text: `[regulator: this command changed protected ${described}. The change was reverted from the pre-command snapshot and recorded as an audit finding (INV-001). Protected paths change through propose_policy_change, never through the shell.]` }];
          changed = true;
        }
      }
      // 4. Canaries never leave a tool result.
      if (canaries.length) {
        const leaked = new Set<string>();
        content = content.map((block) => {
          if (block.type !== "text") return block;
          let text = block.text;
          for (const canary of canaries) if (text.includes(canary)) { leaked.add(canary); text = text.replaceAll(canary, REDACTION); }
          return text === block.text ? block : { ...block, text };
        });
        if (leaked.size) {
          changed = true;
          await finding("critical", "canary in tool result", `${event.toolName} returned ${leaked.size} canary value(s); redacted before the model saw them. A credential the repository holds reached a tool result.`, "secret-exposure",
            [{ class: "runtime", ref: event.toolName, observation: `tool call ${event.toolCallId}` }]);
          ctx.ui.notify(`regulator: ${event.toolName} returned a canary value; redacted and recorded`, "error");
        }
      }
      return changed ? { content } : undefined;
    });

    // 4. A canary in the model's own text cannot be unsaid; it is recorded.
    pi.on("message_end", async (event, ctx) => {
      if (!canaries.length || event.message.role !== "assistant") return;
      const text = event.message.content.map((c) => (c.type === "text" ? c.text : "")).join("\n");
      const leaked = canaries.filter((c) => text.includes(c));
      if (!leaked.length) return;
      await finding("critical", "canary in assistant text", `the model wrote ${leaked.length} canary value(s) into its response; the transcript now holds a credential`, "secret-exposure");
      ctx.ui.notify("regulator: the model's response contains a canary value; recorded as a critical audit finding", "error");
    });

    // 3. Proposal intake: the right to ask, mechanically separated from the right to change.
    pi.registerTool({
      name: "propose_policy_change",
      label: "Propose policy change",
      description:
        "Request a change to identity, policy or a protected path. The request is recorded as a typed proposal for S5 and " +
        "changes nothing: no file is written, no policy takes effect. Use it when the work genuinely needs what a gate refused.",
      promptSnippet: "Record a typed proposal to change identity or policy; it changes nothing by itself",
      promptGuidelines: ["When a write is refused as protected, do not work around it: propose the change with propose_policy_change and continue without it."],
      parameters: Type.Object({
        subject: Type.String({ minLength: 1, maxLength: 200, description: "What the proposal is about (a path, an invariant, a policy field)" }),
        rationale: Type.String({ minLength: 1, maxLength: 2000, description: "Why the change is needed for the work" }),
        requestedChange: Type.String({ minLength: 1, maxLength: 2000, description: "The change requested, concretely" }),
        severity: SeveritySchema,
      }),
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        if (!base) throw new Error("This session is not inside a repository the orchestrator knows; a proposal has nowhere to be recorded.");
        const proposal: PolicyProposal = {
          id: randomUUID(), timestamp: new Date(now()).toISOString(), source: "S1", kind: "policy-proposal", channel: "proposal", destination: "S5",
          severity: params.severity, subject: params.subject, ...(unitId ? { unit: unitId } : {}),
          rationale: params.rationale, requestedChange: params.requestedChange, evidence: [],
        };
        await appendSignal(base, proposal);
        ctx.ui.notify(`regulator: proposal ${proposal.id.slice(0, 8)} recorded for S5 (${params.subject})`, "info");
        return {
          content: [{ type: "text", text: `Proposal ${proposal.id} recorded on the proposal channel for S5. Nothing has changed: the protected path is still protected and the policy still stands. Continue the work without the change.` }],
          details: { proposalId: proposal.id, protectedPaths: [...protectedPaths, ...PROTECTED_S5_PATHS] },
        };
      },
    });
  };
}

export default createAuthorityExtension();
