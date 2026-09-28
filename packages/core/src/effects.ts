/**
 * Declared effects for Pi's built-in tools and regulator's own tools.
 *
 * A tool's schema says what the model may ask for; its effect says what
 * happens in the world when it runs. A profile that calls itself read-only
 * reasons about effects, not schemas: `run_tests` has a one-string schema and
 * runs whatever the project's test suite does.
 */
import type { ToolEffect } from "@metacoding.io/regulator-protocol";

const READ_ONLY: ToolEffect = { filesystem: "read", execution: "none", network: "none", sideEffects: "none" };
/**
 * A record in the control plane's own stores — a report, a proposal, intelligence, a fact. The domain is untouched
 * (`filesystem: none`: nothing under the repository changes) and every record can be superseded, rejected or
 * retracted (`reversible`). Read-only admits records: they are how a unit talks to S3, and a unit that cannot
 * report cannot close (found by the first live drift run, 0.1.2).
 */
const RECORD: ToolEffect = { filesystem: "none", execution: "none", network: "none", sideEffects: "reversible" };

export const TOOL_EFFECTS: Readonly<Record<string, ToolEffect>> = {
  read: READ_ONLY,
  grep: READ_ONLY,
  find: READ_ONLY,
  ls: READ_ONLY,
  write: { filesystem: "write", execution: "none", network: "none", sideEffects: "reversible" },
  edit: { filesystem: "write", execution: "none", network: "none", sideEffects: "reversible" },
  bash: { filesystem: "write", execution: "arbitrary", network: "open", sideEffects: "unknown" },
  // regulator typed tools.
  read_conventions: READ_ONLY,
  // `node --check` parses without executing; `git status` reads. Bounded by the harness, not the project.
  run_checks: READ_ONLY,
  // Runs the project's test suite: whatever that suite does, this tool does.
  run_tests: { filesystem: "write", execution: "project-code", network: "unknown", sideEffects: "unknown" },
  // Lesson 08: a message to the unit's owner, outside the repository. Cannot be unsent; journaled before it is sent.
  notify_owner: { filesystem: "none", execution: "none", network: "none", sideEffects: "irreversible" },
  // Lesson 10: records a typed proposal in the regulatory log. It never changes policy or identity.
  propose_policy_change: RECORD,
  // Lesson 06: writes the result report to the execution store, once; the domain is untouched.
  report_result: RECORD,
  // Lesson 11: records typed intelligence in the regulatory log. Advice to S3; it never applies anything.
  report_intelligence: RECORD,
  // Lesson 12: appends a fact with provenance and an expiry to the operational memory store. Never identity.
  remember: RECORD,
  // Lesson 13: interrupts a person. Attention spent cannot be returned, and the obligation it opens is owed.
  ask_human: { filesystem: "none", execution: "none", network: "none", sideEffects: "irreversible" },
};

export function effectOf(toolName: string): ToolEffect | undefined {
  return TOOL_EFFECTS[toolName];
}

/** Effect-free: reads and nothing else. What a paused unit may still do (the pause gate), stricter than read-only: a record is an effect too. */
export function isEffectFree(effect: ToolEffect): boolean {
  return effect.filesystem !== "write" && effect.execution === "none" && effect.network === "none" && effect.sideEffects === "none";
}

/** Read-only is about the domain and the world: no write under the repository, no execution, no network, and no effect that cannot be undone. A control-plane record (see `RECORD`) is admitted. */
export function isReadOnlyEffect(effect: ToolEffect): boolean {
  return effect.filesystem !== "write" && effect.execution === "none" && effect.network === "none" && (effect.sideEffects === "none" || effect.sideEffects === "reversible");
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
