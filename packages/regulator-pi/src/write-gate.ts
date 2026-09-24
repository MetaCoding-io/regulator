import { prepareWritePath } from "@metacoding/vsm-pi-core";
import { isToolCallEventType, type ExtensionAPI, type ToolCallEventResult } from "@earendil-works/pi-coding-agent";

import { registerReportingTools, type ReportingToolOptions } from "./reporting-tools.js";
export type { HostReportingContext, ReportingToolOptions } from "./reporting-tools.js";

function block(reason: string): ToolCallEventResult {
  return { block: true, reason: `VSM-Pi: ${reason}` };
}

/**
 * Generic native Pi gate. Launch Pi from the project root (ctx.cwd). The
 * checks themselves — expansion, traversal, protected S5 artifacts and their
 * parents, symlink and hard-link aliases — are `prepareWritePath` in core, so
 * the course lab's gate and this one cannot drift apart.
 */
function registerWriteGate(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    if (!isToolCallEventType("write", event) && !isToolCallEventType("edit", event)) return;

    // Narrowing describes the built-in tool contract, but earlier handlers can
    // mutate arguments without revalidation; prepareWritePath fails closed on
    // malformed paths. Operational authority is host-owned and fixed here:
    // tool arguments, channels, prompts, and proposals cannot opt into s5-authority.
    const prepared = await prepareWritePath(ctx.cwd, event.input.path, { authority: "operational" });
    if (!prepared.allowed) {
      return block(prepared.cause === "protected"
        ? `${prepared.reason} Use vsm_propose_policy_change in a host-authorized reporting context, or request an explicit S5-authority workflow from the project owner.`
        : prepared.reason);
    }
    // Execute exactly the normalized path that was checked.
    event.input.path = prepared.path;
    return undefined;
  });
}

/** Explicit host binding; the default extension has no reporting grants. */
export function createVsmPiExtension(options: ReportingToolOptions = {}): (pi: ExtensionAPI) => void {
  return (pi) => {
    registerWriteGate(pi);
    registerReportingTools(pi, options);
  };
}
export default createVsmPiExtension();
