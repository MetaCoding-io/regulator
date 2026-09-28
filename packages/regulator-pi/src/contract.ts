/**
 * Checkpoint 5 — work contracts and the result report (lesson 06).
 *
 * The session side of the S3 loop. The orchestrator wrote the contract before
 * this session existed; this extension:
 *
 *   session_start        loads it, checks it, and appends it to the session as a
 *                        typed entry (`pi.appendEntry`) — state, not context
 *   before_agent_start   renders it as a system-prompt section (level 5: advice)
 *   report_result        a typed tool the unit must call at close; the report is
 *                        checked against the exact contract version and refused
 *                        if an unresolved decision is missing (level 3 + 2)
 *
 * Select the contract with `--contract <path>` (or REGULATOR_CONTRACT). Load
 * with checkpoints 2–4 so the tools, profile and lease it assumes exist:
 *
 *   pi -e tools.js -e profiles.js -e coordination.js -e contract.js \
 *      --unit u1 --profile implement --contract ../../units/u1/contract.v1.json
 */
import { loadContract } from "@metacoding.io/regulator";
export { loadContract } from "@metacoding.io/regulator";
import { readFile } from "node:fs/promises";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ResultReportInputSchema, WorkContractSchema, assertValid, type ResultReport, type WorkContract } from "@metacoding.io/regulator-protocol";
import { ExecutionStore, checkContract, checkResultReport, renderContractSection } from "@metacoding.io/regulator-core";
import type { Exec } from "@metacoding.io/regulator";
import { baseRoot } from "@metacoding.io/regulator";

export const CONTRACT_SECTION_TAG = "regulator_contract";
export const CONTRACT_ENTRY_TYPE = "regulator:contract";
export const REPORT_ENTRY_TYPE = "regulator:result-report";

export interface ContractExtensionOptions {
  now?: () => number;
}

export function createContractExtension(options: ContractExtensionOptions = {}): (pi: ExtensionAPI) => void {
  const now = options.now ?? Date.now;

  return (pi) => {
    const exec: Exec = async (command, args, execOptions) => {
      const result = await pi.exec(command, args, execOptions?.cwd ? { cwd: execOptions.cwd } : {});
      return { stdout: result.stdout, stderr: result.stderr, code: result.code };
    };
    let contract: WorkContract | undefined;
    let reported = false;

    pi.registerFlag("contract", { description: "Path to the work contract this session executes (or REGULATOR_CONTRACT)", type: "string", default: "" });

    pi.on("session_start", async (_event, ctx) => {
      contract = undefined;
      reported = false;
      const flag = pi.getFlag("contract");
      const file = (typeof flag === "string" && flag) || process.env.REGULATOR_CONTRACT || "";
      if (!file) {
        ctx.ui.setStatus("contract", "contract: none");
        return;
      }
      try {
        contract = await loadContract(file);
      } catch (error) {
        ctx.ui.setStatus("contract", "contract: invalid");
        ctx.ui.notify(`regulator: contract refused — ${(error as Error).message}`, "error");
        return;
      }
      pi.appendEntry(CONTRACT_ENTRY_TYPE, contract);
      // A contracted unit must be able to report, whatever the profile lists: the profiles extension has already set
      // the surface (it loads first), so report_result joins it here. A session with no contract never gets it.
      const active = pi.getActiveTools();
      if (!active.includes("report_result")) pi.setActiveTools([...active, "report_result"]);
      ctx.ui.setStatus("contract", `contract: ${contract.id} v${contract.version}`);
    });

    // Level 5: the contract as advice. The gates below are what make it binding.
    pi.on("before_agent_start", (event) => {
      if (contract) event.systemPromptOptions.sections[CONTRACT_SECTION_TAG] = renderContractSection(contract);
      return undefined;
    });

    pi.on("agent_end", (_event, ctx) => {
      if (contract && !reported) ctx.ui.notify(`regulator: unit ${contract.unitId} has not called report_result; the orchestrator will not close it`, "warning");
    });

    pi.registerTool({
      name: "report_result",
      label: "Report result",
      description:
        "Close this unit's work contract: what you did, the evidence, the choice you made for each delegated decision, " +
        "what became of each unresolved decision (preserved or surfaced — never settled), decisions you had to make that the " +
        "contract did not allocate, any deviation from a fixed decision or constraint, and what you are still unsure about. " +
        "Refused, with reasons, if the report does not honour the contract; fix the report and call again.",
      promptSnippet: "Report the unit's result against its work contract",
      promptGuidelines: ["Call report_result exactly once, as the last action of a contracted unit, after running the checks."],
      parameters: ResultReportInputSchema,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        if (!contract) throw new Error("This session has no work contract; there is nothing to report against.");
        if (reported) throw new Error(`Unit ${contract.unitId} already reported against ${contract.id} v${contract.version}; a report is not revised.`);
        const store = new ExecutionStore(await baseRoot(exec, ctx.cwd), now);
        // The attempt is the orchestrator's count plus one: it records the attempt after this session ends.
        const attempt = ((await store.getUnit(contract.unitId))?.attempts ?? 0) + 1;
        const report: ResultReport = {
          contractId: contract.id,
          contractVersion: contract.version,
          unitId: contract.unitId,
          attempt,
          reportedAt: new Date(now()).toISOString(),
          ...params,
        };
        const problems = checkResultReport(contract, report);
        if (problems.length) {
          throw new Error(`Report refused against ${contract.id} v${contract.version}:\n${problems.map((p) => `- ${p.path}: ${p.message}`).join("\n")}`);
        }
        await store.writeReport(report);
        reported = true;
        pi.appendEntry(REPORT_ENTRY_TYPE, report);
        ctx.ui.setStatus("contract", `contract: ${contract.id} v${contract.version} (reported)`);
        return {
          content: [{ type: "text", text: `Report accepted for unit ${contract.unitId} (${contract.id} v${contract.version}). The orchestrator closes the unit; you are done.` }],
          details: { unitId: contract.unitId, contractId: contract.id, contractVersion: contract.version },
        };
      },
    });
  };
}


export default createContractExtension();
