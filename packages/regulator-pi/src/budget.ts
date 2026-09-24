/**
 * Checkpoint 6 — context and budget as regulated resources (lesson 07).
 *
 * The session side of S3's budget. Three mechanisms:
 *
 * 1. A budget guard. Tokens, cost, wall-clock and turns are counted per
 *    attempt against the policy's ceiling for the unit type. When one is
 *    crossed the attempt is halted (`ctx.abort()`) and every non-read-only
 *    tool is refused from then on. The ledger is written to the execution
 *    store so the orchestrator closes on it, never on the transcript.
 * 2. Contract-preserving compaction. `session_before_compact` builds the
 *    summary as a deterministic block — contract identity and allocation,
 *    evidence gathered, files touched — followed by a model summary of the
 *    conversation when a model is available and a stated gap when not.
 *    Nothing the loop needs depends on the summary being good.
 * 3. A model ledger. `model_select` records switches and fallbacks, so the
 *    attempt's cost is attributable.
 *
 * Select the policy with `--policy <file>` (or REGULATOR_POLICY). The unit is
 * found from the lease on this worktree and the contract from the unit's
 * record: S3 wrote both, and neither is inferred from the repository.
 */
import { readFile, realpath } from "node:fs/promises";
import { convertToLlm, serializeConversation, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { PolicyDefinitionSchema, assertValid, type PolicyDefinition, type TokenUsage, type WorkContract } from "@metacoding/vsm-pi-protocol";
import { BudgetMeter, ExecutionStore, TOOL_EFFECTS, ceilingFor, isReadOnlyEffect, renderPreservedContext, summarizeLedger } from "@metacoding/vsm-pi-core";
import type { Exec } from "@metacoding/regulator";
import { POLICY_PATH } from "@metacoding/regulator";
import { leaseStoreFor } from "@metacoding/regulator";
import { baseRoot } from "@metacoding/regulator";

export const EVIDENCE_TOOLS = new Set(["run_tests", "run_checks"]);

/** Summarize a serialized conversation. Returns undefined when it cannot (no model, error, abort). */
export type Summarizer = (conversation: string, ctx: ExtensionContext, signal: AbortSignal) => Promise<string | undefined>;

export interface BudgetExtensionOptions {
  now?: () => number;
  summarize?: Summarizer;
}

/** The default summarizer: the session's own model, through Pi's registry. */
export const modelSummarizer: Summarizer = async (conversation, ctx, signal) => {
  if (!ctx.model) return undefined;
  try {
    const response = await ctx.modelRegistry.complete(ctx.model, {
      messages: [{
        role: "user",
        content: [{ type: "text", text: `Summarize this coding-agent conversation for someone who must continue the work. Use these headings: Progress (done / in progress / blocked), Key decisions with rationale, Next steps. Be specific about files and test results. Do not restate the work contract; it is supplied separately.\n\n<conversation>\n${conversation}\n</conversation>` }],
        timestamp: Date.now(),
      }],
    }, { maxTokens: 4096, signal, cacheRetention: "none" });
    const text = response.content.filter((c): c is { type: "text"; text: string } => c.type === "text").map((c) => c.text).join("\n").trim();
    return text || undefined;
  } catch {
    return undefined;
  }
};

export function createBudgetExtension(options: BudgetExtensionOptions = {}): (pi: ExtensionAPI) => void {
  const now = options.now ?? Date.now;
  const summarize = options.summarize ?? modelSummarizer;

  return (pi) => {
    const exec: Exec = async (command, args, execOptions) => {
      const result = await pi.exec(command, args, execOptions?.cwd ? { cwd: execOptions.cwd } : {});
      return { stdout: result.stdout, stderr: result.stderr, code: result.code };
    };
    let policy: PolicyDefinition | undefined;
    let contract: WorkContract | undefined;
    let meter: BudgetMeter | undefined;
    let store: ExecutionStore | undefined;

    pi.registerFlag("policy", { description: "Policy file with budgets and model routes (or REGULATOR_POLICY)", type: "string", default: "" });

    pi.registerCommand("budget", {
      description: "Show this attempt's budget ledger",
      handler: async (_args, ctx) => {
        ctx.ui.notify(meter ? summarizeLedger(meter.ledger) : "budget: no unit, nothing is metered", "info");
      },
    });

    pi.on("session_start", async (_event, ctx) => {
      meter = undefined;
      contract = undefined;
      const policyFlag = pi.getFlag("policy");
      const policyPath = (typeof policyFlag === "string" && policyFlag) || process.env.REGULATOR_POLICY || POLICY_PATH;
      try {
        const value: unknown = JSON.parse(await readFile(policyPath, "utf8"));
        assertValid(PolicyDefinitionSchema, value, "policy");
        policy = value;
      } catch (error) {
        ctx.ui.setStatus("budget", "budget: no policy");
        ctx.ui.notify(`regulator: policy refused — ${(error as Error).message}`, "error");
        return;
      }
      // A flag is readable only by the extension that registered it, so this checkpoint does not
      // read checkpoint 4's `--unit` or 5's `--contract`. It finds the unit the way S3 recorded it:
      // the lease whose resource is this worktree, then the unit record and its contract version.
      try {
        const base = await baseRoot(exec, ctx.cwd);
        store = new ExecutionStore(base, now);
        const here = await realpath(ctx.cwd).catch(() => ctx.cwd);
        let unitId = process.env.REGULATOR_UNIT ?? "";
        for (const lease of await leaseStoreFor(base, now).list()) {
          if ((await realpath(lease.resource).catch(() => lease.resource)) === here) unitId = lease.unitId;
        }
        if (!unitId) {
          ctx.ui.setStatus("budget", "budget: none (no unit)");
          return;
        }
        const unit = await store.getUnit(unitId);
        contract = unit ? await store.getContract(unitId, unit.contract.version) : undefined;
        const unitType = contract?.unitType ?? unit?.unitType ?? "implement";
        meter = new BudgetMeter({
          unitId, attempt: (unit?.attempts ?? 0) + 1, ceiling: ceilingFor(policy, unitType), now,
          ...(ctx.model ? { model: `${ctx.model.provider}/${ctx.model.id}` } : {}),
        });
        await store.writeBudget(meter.ledger);
        ctx.ui.setStatus("budget", `budget: ${summarizeLedger(meter.ledger)}`);
      } catch (error) {
        // A guard that cannot start is a guard that says so: nothing is metered, and the footer shows it.
        meter = undefined;
        ctx.ui.setStatus("budget", "budget: guard failed to start");
        ctx.ui.notify(`regulator: budget guard failed to start — ${(error as Error).message}`, "error");
        if (process.env.REGULATOR_DEBUG) console.error(error);
      }
    });

    pi.on("message_end", (event) => {
      if (!meter || event.message.role !== "assistant") return undefined;
      const usage = event.message.usage;
      const record: TokenUsage = { input: usage.input, output: usage.output, cacheRead: usage.cacheRead, cacheWrite: usage.cacheWrite, totalTokens: usage.totalTokens, cost: usage.cost.total };
      meter.recordUsage(record);
      return undefined;
    });

    pi.on("model_select", (event) => {
      meter?.recordModel(`${event.model.provider}/${event.model.id}`);
    });

    pi.on("tool_execution_end", (event) => {
      if (!meter || event.isError || !EVIDENCE_TOOLS.has(event.toolName)) return;
      const content = (event.result as { content?: Array<{ type: string; text?: string }> } | undefined)?.content;
      const text = content?.find((c) => c.type === "text")?.text ?? "";
      meter.recordEvidence({ tool: event.toolName, at: new Date(now()).toISOString(), summary: (text.split("\n")[0] ?? "").slice(0, 200) || "(no output)" });
    });

    // Level 2: the ceiling. Checked at every turn end; once crossed, the attempt is halted.
    pi.on("turn_end", async (_event, ctx) => {
      if (!meter || !store) return;
      meter.recordTurn();
      const crossed = meter.check();
      await store.writeBudget(meter.ledger);
      ctx.ui.setStatus("budget", `budget: ${summarizeLedger(meter.ledger)}`);
      if (crossed) {
        ctx.ui.notify(`regulator: budget exhausted (${crossed}); halting attempt ${meter.ledger.attempt} of unit ${meter.ledger.unitId}. The orchestrator decides what happens next.`, "error");
        ctx.abort();
      }
    });

    // And at every tool call, so nothing with an effect runs after the ceiling — abort or no abort.
    pi.on("tool_call", (event) => {
      if (!meter) return undefined;
      const effect = TOOL_EFFECTS[event.toolName];
      if (effect && isReadOnlyEffect(effect)) return undefined;
      const crossed = meter.check();
      if (!crossed) return undefined;
      return { block: true, reason: `regulator: the attempt's ${crossed} budget is exhausted; no further tool with an effect may run. Call report_result if you can, otherwise stop.` };
    });

    pi.on("session_before_compact", async (event, ctx) => {
      if (!contract || !meter) return undefined;
      const { preparation, reason, signal } = event;
      const modified = [...new Set([...preparation.fileOps.written, ...preparation.fileOps.edited])].sort();
      const preserved = renderPreservedContext(contract, meter.ledger, meter.evidence, modified);
      const conversation = serializeConversation(convertToLlm([...preparation.messagesToSummarize, ...preparation.turnPrefixMessages]));
      const summary = await summarize(conversation, ctx, signal);
      const body = summary
        ? `## Conversation summary\n${summary}`
        : `## Conversation summary\nNot available (no summarizer or it failed); ${preparation.messagesToSummarize.length + preparation.turnPrefixMessages.length} messages were compacted. Continue from the regulator context above and the recent messages kept below.`;
      meter.recordCompaction(reason, true);
      if (store) await store.writeBudget(meter.ledger);
      return {
        compaction: {
          summary: `${preserved}\n\n${body}`,
          firstKeptEntryId: preparation.firstKeptEntryId,
          tokensBefore: preparation.tokensBefore,
          details: { regulator: { contract: `${contract.id} v${contract.version}`, evidence: meter.evidence.length, modified } },
        },
      };
    });

    pi.on("session_compact", (event, ctx) => {
      if (!meter) return;
      ctx.ui.notify(event.fromExtension ? "regulator: compacted; the contract, evidence pointers and touched files were carried" : "regulator: compacted by the default summarizer — the contract block was NOT carried", event.fromExtension ? "info" : "warning");
    });

    pi.on("session_compact_failed", (event, ctx) => {
      if (!meter) return;
      meter.recordCompaction(event.reason, false);
      ctx.ui.notify(`regulator: compaction failed (${event.reason}${event.errorMessage ? `: ${event.errorMessage}` : ""})`, "warning");
    });
  };
}

export default createBudgetExtension();
