/**
 * Declared effects for Pi's built-in tools and VSM-Pi's own tools.
 *
 * A tool's schema says what the model may ask for; its effect says what
 * happens in the world when it runs. A profile that calls itself read-only
 * reasons about effects, not schemas: `run_tests` has a one-string schema and
 * runs whatever the project's test suite does.
 */
import type { ToolEffect } from "@metacoding/vsm-pi-protocol";

const READ_ONLY: ToolEffect = { filesystem: "read", execution: "none", network: "none", sideEffects: "none" };

export const TOOL_EFFECTS: Readonly<Record<string, ToolEffect>> = {
  read: READ_ONLY,
  grep: READ_ONLY,
  find: READ_ONLY,
  ls: READ_ONLY,
  write: { filesystem: "write", execution: "none", network: "none", sideEffects: "reversible" },
  edit: { filesystem: "write", execution: "none", network: "none", sideEffects: "reversible" },
  bash: { filesystem: "write", execution: "arbitrary", network: "open", sideEffects: "unknown" },
  // VSM-Pi typed tools.
  read_conventions: READ_ONLY,
  // `node --check` parses without executing; `git status` reads. Bounded by the harness, not the project.
  run_checks: READ_ONLY,
  // Runs the project's test suite: whatever that suite does, this tool does.
  run_tests: { filesystem: "write", execution: "project-code", network: "unknown", sideEffects: "unknown" },
  // Lesson 08: a message to the unit's owner, outside the repository. Cannot be unsent; journaled before it is sent.
  notify_owner: { filesystem: "write", execution: "none", network: "none", sideEffects: "irreversible" },
  // Lesson 10: records a typed proposal in the regulatory log. It never changes policy or identity.
  propose_policy_change: { filesystem: "write", execution: "none", network: "none", sideEffects: "reversible" },
  // Lesson 06: writes the result report to the execution store, once; the domain is untouched.
  report_result: { filesystem: "write", execution: "none", network: "none", sideEffects: "reversible" },
  // Lesson 11: records typed intelligence in the regulatory log. Advice to S3; it never applies anything.
  report_intelligence: { filesystem: "write", execution: "none", network: "none", sideEffects: "reversible" },
};

export function effectOf(toolName: string): ToolEffect | undefined {
  return TOOL_EFFECTS[toolName];
}

export function isReadOnlyEffect(effect: ToolEffect): boolean {
  return effect.filesystem !== "write" && effect.execution === "none" && effect.sideEffects === "none";
}

/**
 * Names of tools that keep a tool set from being read-only. Unknown effects
 * count as violations: a profile cannot promise what it has not declared.
 */
export function readOnlyViolations(toolNames: readonly string[], effects: Readonly<Record<string, ToolEffect>> = TOOL_EFFECTS): string[] {
  return toolNames.filter((name) => {
    const effect = effects[name];
    return !effect || !isReadOnlyEffect(effect);
  });
}
