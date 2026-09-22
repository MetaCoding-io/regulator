/**
 * Checkpoint 4 — isolation, leases, and the anti-oscillation problem (lesson 05).
 *
 * Three S2 mechanisms, all of them mechanism rather than persona:
 *
 * 1. A lease gate. Every tool with a non-read-only effect — write, edit, bash,
 *    run_tests, anything undeclared — is refused unless this session's unit
 *    holds a live lease on the worktree it is running in. Unlike the path gates
 *    of checkpoints 1 and 3, this gate covers the shell, because it is a
 *    per-session condition rather than a per-path one.
 * 2. A heartbeat, so a session that goes quiet loses its claim.
 * 3. A thrash detector: edits per file per unit, emitting a typed coordination
 *    signal for S3 past a threshold. It never decides anything.
 *
 * Plus `/checkpoint`, a commit inside the worktree. Run the unit lifecycle
 * around the session with the lab CLI:
 *
 *   regulator unit start u1        (in the base checkout)
 *   cd .regulator/worktrees/u1 && pi -e ../../../dist/cp4-coordination.js --unit u1
 *   regulator unit finish u1       (in the base checkout)
 */
import { randomUUID } from "node:crypto";
import { realpath } from "node:fs/promises";
import type { ExtensionAPI, ExtensionContext, ToolCallEventResult } from "@earendil-works/pi-coding-agent";
import type { CoordinationSignal } from "@metacoding/vsm-pi-protocol";
import { isReadOnlyEffect, TOOL_EFFECTS } from "@metacoding/vsm-pi-core";
import { readFile } from "node:fs/promises";
import { PolicyDefinitionSchema, assertValid } from "@metacoding/vsm-pi-protocol";
import { LeaseStore, ThrashDetector, type Lease, type ThrashSignal } from "./coordination.js";
import type { Exec } from "./exec.js";
import { POLICY_PATH } from "./policy.js";
import { appendSignal, DEFAULT_LEASE_TTL_MS, leaseStoreFor } from "./unit.js";
import { baseRoot, checkpoint } from "./worktree.js";

export interface CoordinationExtensionOptions {
  now?: () => number;
  ttlMs?: number;
  /** Edits to one file, within one unit, before an oscillation signal is raised. Overrides the policy's `coordination.oscillationThreshold` (lesson 12). */
  threshold?: number;
}

/** The declared threshold: the policy's, from `--policy` / REGULATOR_POLICY / the definition's default; 4 if the policy declares none. */
export async function oscillationThreshold(policyPath: string): Promise<number> {
  try {
    const value: unknown = JSON.parse(await readFile(policyPath, "utf8"));
    assertValid(PolicyDefinitionSchema, value, "policy");
    return value.coordination?.oscillationThreshold ?? 4;
  } catch {
    return 4;
  }
}

export function createCoordinationExtension(options: CoordinationExtensionOptions = {}): (pi: ExtensionAPI) => void {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? DEFAULT_LEASE_TTL_MS;

  return (pi) => {
    const exec: Exec = async (command, args, execOptions) => {
      const result = await pi.exec(command, args, execOptions?.cwd ? { cwd: execOptions.cwd } : {});
      return { stdout: result.stdout, stderr: result.stderr, code: result.code };
    };
    let unitId = "";
    let base = "";
    let store: LeaseStore | undefined;
    let lease: Lease | undefined;
    let detector: ThrashDetector | undefined;
    const pendingPaths = new Map<string, string>();
    let initialized = false;

    pi.registerFlag("unit", { description: "Unit id whose lease this session works under (or REGULATOR_UNIT)", type: "string", default: "" });

    pi.registerCommand("checkpoint", {
      description: "Commit the unit's work so far: /checkpoint [message]",
      handler: async (args, ctx) => {
        await ensureInit(ctx);
        if (!unitId) {
          ctx.ui.notify("no unit: start one with `regulator unit start <id>` and launch pi with --unit", "error");
          return;
        }
        const result = await checkpoint(exec, ctx.cwd, args.trim() || `checkpoint: unit ${unitId}`);
        ctx.ui.notify(result.committed ? `checkpoint ${result.sha}` : "nothing to checkpoint", "info");
      },
    });

    pi.registerCommand("lease", {
      description: "Show this session's unit and lease",
      handler: async (_args, ctx) => {
        await ensureInit(ctx);
        if (!lease) {
          ctx.ui.notify(unitId ? `unit ${unitId}: no lease` : "no unit", "info");
          return;
        }
        ctx.ui.notify(`unit ${unitId}: ${store?.isLive(lease) ? "live" : "expired"} lease on ${lease.resource} until ${new Date(lease.expiresAt).toISOString()}`, "info");
      },
    });

    pi.on("session_start", async (_event, ctx) => {
      initialized = false;
      await ensureInit(ctx);
    });

    // Level 2: the lease gate. Read-only effects pass; everything else needs a live lease here.
    pi.on("tool_call", async (event, ctx): Promise<ToolCallEventResult | undefined> => {
      const effect = TOOL_EFFECTS[event.toolName];
      if (effect && isReadOnlyEffect(effect)) return undefined;
      await ensureInit(ctx);
      if (await leaseCovers(ctx.cwd)) return undefined;
      return {
        block: true,
        reason: unitId
          ? `regulator: no live lease for unit "${unitId}" on ${ctx.cwd}. Run \`regulator unit start ${unitId}\` in the base checkout and launch pi in the worktree it prints, with --unit ${unitId}.`
          : "regulator: this session has no unit. Write-capable tools are refused without a lease; launch pi with --unit <id> inside a started unit's worktree.",
      };
    });

    pi.on("turn_end", async () => {
      if (store && lease && unitId && store.isLive(lease)) lease = await store.heartbeat(unitId, ttlMs);
    });

    // `tool_execution_end` carries the result, not the arguments, so the path
    // is captured at start and consumed at end. Only a completed write counts:
    // a failed edit changed nothing and is not evidence of oscillation.
    pi.on("tool_execution_start", (event) => {
      if (event.toolName !== "write" && event.toolName !== "edit") return;
      const filePath = (event.args as { path?: unknown } | undefined)?.path;
      if (typeof filePath === "string") pendingPaths.set(event.toolCallId, filePath);
    });

    pi.on("tool_execution_end", async (event, ctx) => {
      const filePath = pendingPaths.get(event.toolCallId);
      pendingPaths.delete(event.toolCallId);
      if (event.isError || !detector || filePath === undefined) return;
      const signal = detector.record(filePath);
      if (signal) await emit(ctx, signal);
    });

    async function ensureInit(ctx: ExtensionContext): Promise<void> {
      if (initialized) return;
      initialized = true;
      const flag = pi.getFlag("unit");
      unitId = (typeof flag === "string" && flag) || process.env.REGULATOR_UNIT || "";
      const policyFlag = pi.getFlag("policy");
      const threshold = options.threshold ?? await oscillationThreshold((typeof policyFlag === "string" && policyFlag) || process.env.REGULATOR_POLICY || POLICY_PATH);
      detector = new ThrashDetector({ unitId: unitId || "no-unit", now, threshold });
      if (!unitId) {
        ctx.ui.setStatus("unit", "unit: none (writes refused)");
        return;
      }
      base = await baseRoot(exec, ctx.cwd);
      store = leaseStoreFor(base, now);
      lease = await store.get(unitId);
      ctx.ui.setStatus("unit", (await leaseCovers(ctx.cwd)) ? `unit: ${unitId} (lease ok)` : `unit: ${unitId} (no live lease)`);
    }

    async function leaseCovers(cwd: string): Promise<boolean> {
      if (!store || !lease || !store.isLive(lease)) return false;
      const here = await realpath(cwd).catch(() => cwd);
      const there = await realpath(lease.resource).catch(() => lease!.resource);
      return here === there;
    }

    async function emit(ctx: ExtensionContext, signal: ThrashSignal): Promise<void> {
      const message: CoordinationSignal = {
        id: randomUUID(),
        timestamp: new Date(signal.at).toISOString(),
        source: "S2",
        kind: "coordination-signal",
        channel: "signal",
        destination: "S3",
        severity: "advisory",
        subject: signal.path,
        unit: signal.unitId,
        coordination: "oscillation",
        observation: `${signal.edits} edits to ${signal.path} within unit ${signal.unitId}: the fix may be oscillating.`,
        evidence: [{ class: "file", ref: signal.path }],
        resource: ctx.cwd,
      };
      await appendSignal(base || ctx.cwd, message);
      ctx.ui.notify(message.observation, "warning");
    }
  };
}

export default createCoordinationExtension();
