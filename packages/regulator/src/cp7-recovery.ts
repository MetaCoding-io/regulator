/**
 * Checkpoint 7 — failure, recovery, and durable execution (lesson 08).
 *
 * The session side of recovery. The router itself is S3's and runs in the
 * orchestrator (`controller.ts`); what the session contributes is
 * *observation* and *durability*:
 *
 * 1. Failure observations. Every tool error and provider error is normalized
 *    to a cause (environment, timeout, tool-error) and appended to the unit's
 *    observations, so a silent end can be routed by what actually went wrong
 *    rather than by "no report".
 * 2. A side-effecting tool done durably. `notify_owner` sends a message to an
 *    outbox outside the repository — an effect that cannot be unsent. It writes
 *    `intended` to the effect journal before sending and `committed` after; a
 *    repeated call with the same key returns the recorded result instead of
 *    sending again; and on session start any `intended` with no outcome is
 *    reconciled against the outbox, so a harness that died between the send
 *    and the record neither repeats nor forgets it.
 *
 * The outbox is a file named by REGULATOR_OUTBOX (default: `.regulator/outbox`
 * beside the base checkout's `.regulator/`, which is enough for the drill).
 */
import { appendFile, mkdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { FailureObservation } from "@metacoding/vsm-pi-protocol";
import { EffectJournal, ExecutionStore, REGULATOR_DIR, causeFromError, effectKey } from "@metacoding/vsm-pi-core";
import type { Exec } from "./exec.js";
import { leaseStoreFor } from "./unit.js";
import { baseRoot } from "./worktree.js";

export interface RecoveryExtensionOptions {
  now?: () => number;
  /** Where notify_owner delivers. Defaults to REGULATOR_OUTBOX or `<base>/.regulator/outbox`. */
  outbox?: string;
  /** Test hook: throw after the effect and before the journal commit, to simulate the crash. */
  crashAfterEffect?: boolean;
}

export const OUTBOX_RELATIVE_PATH = path.join(REGULATOR_DIR, "outbox");

export async function outboxHas(outbox: string, key: string): Promise<boolean> {
  try {
    return (await readFile(outbox, "utf8")).split("\n").some((line) => line.startsWith(`${key} `));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export function createRecoveryExtension(options: RecoveryExtensionOptions = {}): (pi: ExtensionAPI) => void {
  const now = options.now ?? Date.now;

  return (pi) => {
    const exec: Exec = async (command, args, execOptions) => {
      const result = await pi.exec(command, args, execOptions?.cwd ? { cwd: execOptions.cwd } : {});
      return { stdout: result.stdout, stderr: result.stderr, code: result.code };
    };
    let base = "";
    let unitId = "";
    let attempt = 1;
    let store: ExecutionStore | undefined;
    let journal: EffectJournal | undefined;
    let outbox = "";

    const observe = async (observation: Omit<FailureObservation, "unitId" | "attempt" | "at">) => {
      if (!store || !unitId) return;
      await store.recordObservation({ unitId, attempt, at: new Date(now()).toISOString(), ...observation });
    };

    pi.on("session_start", async (_event, ctx) => {
      try {
        base = await baseRoot(exec, ctx.cwd);
        store = new ExecutionStore(base, now);
        journal = new EffectJournal(base, now);
        outbox = options.outbox ?? process.env.REGULATOR_OUTBOX ?? path.join(base, OUTBOX_RELATIVE_PATH);
        const here = await realpath(ctx.cwd).catch(() => ctx.cwd);
        unitId = process.env.REGULATOR_UNIT ?? "";
        for (const lease of await leaseStoreFor(base, now).list()) {
          if ((await realpath(lease.resource).catch(() => lease.resource)) === here) unitId = lease.unitId;
        }
        attempt = unitId ? ((await store.getUnit(unitId))?.attempts ?? 0) + 1 : 1;
        // Durable execution: anything intended and never recorded is settled against the world before any new effect.
        const reconciled = await journal.reconcile((state) => outboxHas(outbox, state.key));
        for (const r of reconciled) ctx.ui.notify(`regulator: reconciled effect ${r.key} (${r.description}): ${r.status === "confirmed" ? "it had happened; not repeating it" : "it had not happened; it may be intended again"}`, "warning");
        ctx.ui.setStatus("recovery", unitId ? `recovery: observing unit ${unitId} attempt ${attempt}` : "recovery: no unit");
      } catch (error) {
        store = undefined;
        ctx.ui.setStatus("recovery", "recovery: observer failed to start");
        ctx.ui.notify(`regulator: recovery observer failed to start — ${(error as Error).message}`, "error");
      }
    });

    // Normalize tool failures into causes as they happen: this is what the router reads for a silent end.
    pi.on("tool_execution_end", async (event) => {
      if (!event.isError) return;
      const content = (event.result as { content?: Array<{ type: string; text?: string }> } | undefined)?.content;
      const text = content?.find((c) => c.type === "text")?.text ?? "tool error";
      const message = text.replace(/\s+/g, " ").trim().slice(0, 300);
      // A refused report_result is a typed refusal, not a tool error: the report did not honour the contract.
      const cause = event.toolName === "report_result" ? "invalid-report" : causeFromError(text);
      await observe({ source: "tool", toolName: event.toolName, cause, message });
    });

    // A run that ends on a provider error is an observation too, with the provider as source.
    pi.on("agent_end", async (event) => {
      const last = [...event.messages].reverse().find((m) => m.role === "assistant");
      if (last && last.role === "assistant" && last.stopReason === "error") {
        const message = (last.errorMessage ?? "provider error").slice(0, 300);
        await observe({ source: "provider", cause: causeFromError(message), message });
      }
    });

    pi.registerTool({
      name: "notify_owner",
      label: "Notify owner",
      description:
        "Send a short message to the unit's owner. This leaves the repository and cannot be unsent, so it is journaled: " +
        "the same message from the same unit is sent once, and a message whose send was interrupted is reconciled rather than repeated.",
      promptSnippet: "Notify the unit's owner of something they must know now",
      promptGuidelines: ["Use notify_owner only for what the owner must act on; the result report is where ordinary findings go."],
      parameters: Type.Object({ message: Type.String({ minLength: 1, maxLength: 500, description: "What the owner must know" }) }),
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        if (!journal) throw new Error("The effect journal is not available; refusing to act on the world unjournaled.");
        const key = effectKey(unitId || undefined, "notify_owner", { message: params.message });
        const description = `notify owner: ${params.message.slice(0, 80)}`;
        const begun = await journal.begin({ key, tool: "notify_owner", description, ...(unitId ? { unitId } : {}) });
        if (!begun.proceed) {
          return { content: [{ type: "text", text: `Already sent (${begun.prior?.status}, ${begun.prior?.intendedAt}); not sending again. ${begun.prior?.result ?? ""}`.trim() }], details: { key, duplicate: true } };
        }
        // The effect: a line in the outbox, keyed so reconciliation can find it.
        await mkdir(path.dirname(outbox), { recursive: true });
        await appendFile(outbox, `${key} ${new Date(now()).toISOString()} ${unitId || "-"} ${params.message.replaceAll("\n", " ")}\n`, "utf8");
        if (options.crashAfterEffect) throw new Error("simulated crash between the effect and its record");
        await journal.commit(key, `sent ${new Date(now()).toISOString()}`);
        ctx.ui.notify(`regulator: owner notified (${key})`, "info");
        return { content: [{ type: "text", text: `Sent to the owner (effect ${key}).` }], details: { key, duplicate: false } };
      },
    });
  };
}

export default createRecoveryExtension();
