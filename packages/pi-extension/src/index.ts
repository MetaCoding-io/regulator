import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { authorizeWrite } from "@metacoding/vsm-pi-core";
import { isToolCallEventType, type ExtensionAPI, type ToolCallEventResult } from "@earendil-works/pi-coding-agent";

import { registerReportingTools, type ReportingToolOptions } from "./reporting-tools.js";
export type { HostReportingContext, ReportingToolOptions } from "./reporting-tools.js";

function block(reason: string): ToolCallEventResult {
  return { block: true, reason: `VSM-Pi: ${reason}` };
}

/** Match Pi 0.87.0's @ prefix / Unicode-space expansion before authorization. */
function expandToolPath(input: string): string {
  return (input.startsWith("@") ? input.slice(1) : input)
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replaceAll("\\", "/");
}

/**
 * A lexical policy check cannot see symlink or hard-link aliases. Reject them
 * conservatively, including dangling links and links in existing parents.
 * This is a preflight check, not an atomic filesystem sandbox.
 */
async function checkFilesystemPath(cwd: string, relativePath: string): Promise<void> {
  if (!path.isAbsolute(cwd)) throw new Error("Project root must be absolute.");
  let current = await realpath(cwd);
  if (!(await lstat(current)).isDirectory()) throw new Error("Invalid project root.");
  const segments = relativePath.split("/");
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        // Pi write creates missing parents. No further existing aliases can
        // occur below this missing component in a stable filesystem.
        return;
      }
      throw error;
    }
    if (info.isSymbolicLink()) throw new Error("Symbolic-link paths are not authorized.");
    if (index < segments.length - 1 && !info.isDirectory()) {
      throw new Error("A parent component is not a directory.");
    }
    if (index === segments.length - 1 && (!info.isFile() || info.nlink > 1)) {
      throw new Error("Only regular files with a single link are authorized.");
    }
  }
}

/** Generic native Pi gate. Launch Pi from the project root (ctx.cwd). */
function registerWriteGate(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    if (!isToolCallEventType("write", event) && !isToolCallEventType("edit", event)) return;

    // Narrowing describes the built-in tool contract, but earlier handlers can
    // mutate arguments without revalidation. Fail closed on malformed paths.
    const input: unknown = event.input.path;
    if (typeof input !== "string" || input.length === 0 || input.includes("\0")) {
      return block("write/edit requires a non-empty project-relative file path without NUL bytes.");
    }
    const expanded = expandToolPath(input);
    if (expanded === "~" || expanded.startsWith("~/") || expanded.startsWith("file://") || expanded.split("/").includes("..")) {
      return block("Use a project-relative file path without home expansion, file URLs, or parent traversal.");
    }

    // Operational authority is host-owned and fixed here. Tool arguments,
    // channels, prompts, and proposals cannot opt into s5-authority.
    let decision = authorizeWrite(expanded, "operational");
    if (decision.allowed) {
      // write creates parents too: a missing protected file must not be
      // replaced with a directory by writing a child beneath its path.
      const segments = decision.normalizedPath.split("/");
      for (let length = 1; length < segments.length; length++) {
        const parent = authorizeWrite(segments.slice(0, length).join("/"), "operational");
        if (!parent.allowed) {
          decision = parent;
          break;
        }
      }
    }
    if (!decision.allowed) {
      return block(`${decision.reason} Use vsm_propose_policy_change in a host-authorized reporting context, or request an explicit S5-authority workflow from the project owner.`);
    }
    if (decision.normalizedPath === ".") return block("A file path is required, not the project root.");

    try {
      await checkFilesystemPath(ctx.cwd, decision.normalizedPath);
    } catch {
      return block("Cannot safely authorize this filesystem path. Use a regular project-local file with no symbolic links or hard-link aliases and accessible parent directories.");
    }

    // Execute exactly the normalized path that was checked. The ./ prefix
    // prevents Pi from interpreting a resulting leading @ or ~ a second time.
    event.input.path = `./${decision.normalizedPath}`;
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
