/**
 * Effect contracts for tools. No Pi dependency.
 *
 * A tool's *schema* says what the model may ask for. Its *effect* says what
 * happens in the world when it runs. The two are independent: `run_tests`
 * takes one optional string and executes whatever the project's test suite
 * does — write files, open sockets, spend credentials. A profile that calls
 * itself read-only has to reason about effects, not schemas.
 */
export interface ToolEffect {
  filesystem: "none" | "read" | "write";
  /** What code runs: nothing beyond the tool itself, the project's own code, or anything at all. */
  execution: "none" | "project-code" | "arbitrary";
  network: "none" | "unknown" | "open";
  sideEffects: "none" | "reversible" | "irreversible" | "unknown";
}

const READ_ONLY: ToolEffect = { filesystem: "read", execution: "none", network: "none", sideEffects: "none" };

/** Declared effects for Pi's built-in tools and the lab's typed tools. Anything not listed has an unknown effect. */
export const TOOL_EFFECTS: Readonly<Record<string, ToolEffect>> = {
  read: READ_ONLY,
  grep: READ_ONLY,
  find: READ_ONLY,
  ls: READ_ONLY,
  write: { filesystem: "write", execution: "none", network: "none", sideEffects: "reversible" },
  edit: { filesystem: "write", execution: "none", network: "none", sideEffects: "reversible" },
  bash: { filesystem: "write", execution: "arbitrary", network: "open", sideEffects: "unknown" },
  // Lab tools (checkpoint 2).
  read_conventions: READ_ONLY,
  // `node --check` parses without executing; `git status` reads. Bounded by the harness, not the project.
  run_checks: READ_ONLY,
  // Runs the project's test suite: whatever that suite does, this tool does.
  run_tests: { filesystem: "write", execution: "project-code", network: "unknown", sideEffects: "unknown" },
};

export function effectOf(toolName: string): ToolEffect | undefined {
  return TOOL_EFFECTS[toolName];
}

/**
 * Names of tools that keep a tool set from being read-only. Unknown effects
 * count as violations: a profile cannot promise what it has not declared.
 */
export function readOnlyViolations(toolNames: readonly string[]): string[] {
  return toolNames.filter((name) => {
    const effect = TOOL_EFFECTS[name];
    return !effect || effect.filesystem === "write" || effect.execution !== "none" || effect.sideEffects !== "none";
  });
}
