/**
 * Capability profiles. No Pi dependency.
 *
 * A profile is a positive grant: what a kind of work may do. It binds a tool
 * surface, the paths the work may write, a reasoning budget, and the advice
 * the model should carry — the part no gate can enforce. A persona says who
 * the agent is; a profile says what it can reach.
 *
 * Model and context-file bindings are deliberately absent at this checkpoint:
 * model routing arrives with budgets (lesson 07), durable context with
 * identity (lesson 12).
 */
import path from "node:path";
import { readOnlyViolations } from "./effects.js";

export type ReasoningLevel = "minimal" | "low" | "medium" | "high";

export interface CapabilityProfile {
  name: string;
  description: string;
  /** Tools this profile may use. Names unknown to the host are ignored when applied. */
  tools: readonly string[];
  /** Project-relative prefixes the profile may write under. Empty means no direct writes. */
  writablePaths: readonly string[];
  thinkingLevel?: ReasoningLevel;
  /** Advice for the model: only what a gate cannot know. */
  advice: readonly string[];
}

export const PROFILES = {
  research: {
    name: "research",
    description:
      "Read and report. No write, edit or shell tools, and no execution of project code: every granted tool has a declared read-only effect.",
    tools: ["read", "grep", "find", "ls", "read_conventions", "run_checks"],
    writablePaths: [],
    thinkingLevel: "medium",
    advice: [
      "You are in the research profile: you can read the project and run its static checks, but not change it or run its code.",
      "Report what you find with file paths and line numbers. If asked to change something, say what you would change and why; do not attempt it.",
    ],
  },
  implement: {
    name: "implement",
    description:
      "Change source and tests. Direct write and edit calls are limited to src/ and test/; bash is granted and is not path-gated.",
    tools: ["read", "write", "edit", "grep", "find", "ls", "bash", "read_conventions", "run_tests", "run_checks"],
    writablePaths: ["src/", "test/"],
    thinkingLevel: "medium",
    advice: [
      "You are in the implement profile: you may change files under src/ and test/ only.",
      "When the README and the code disagree, trust the code and say so in your summary.",
      "Prefer the smallest change that makes the tests pass; do not restructure what you were not asked to change.",
      "Run run_checks and run_tests before reporting work as done. Report what you ran, not what you assume.",
    ],
  },
} as const satisfies Record<string, CapabilityProfile>;

export type ProfileName = keyof typeof PROFILES;

export function isProfileName(name: string): name is ProfileName {
  return Object.hasOwn(PROFILES, name);
}

/**
 * A profile is read-only when every tool it grants has a declared read-only
 * effect and it grants no direct writes. Removing `write`, `edit` and `bash`
 * is not enough: a tool with a one-string schema can still run the project.
 */
export function isReadOnlyProfile(profile: CapabilityProfile): boolean {
  return profile.writablePaths.length === 0 && readOnlyViolations(profile.tools).length === 0;
}

/**
 * Positive-grant path check: the normalized project-relative path must start
 * with one of the profile's writable prefixes. Anything the gate does not
 * understand — absolute paths, `..` — is refused. Same limits as checkpoint 1:
 * lexical only; lesson 10 hardens it.
 */
export function isWritableUnder(profile: CapabilityProfile, input: string): boolean {
  const cleaned = (input.startsWith("@") ? input.slice(1) : input).replaceAll("\\", "/");
  if (path.posix.isAbsolute(cleaned)) return false;
  const normalized = path.posix.normalize(cleaned).replace(/^\.\//, "");
  if (normalized === ".." || normalized.startsWith("../")) return false;
  return profile.writablePaths.some((prefix) => normalized.startsWith(prefix));
}

/** The profile as the model sees it: a system-prompt section, not a persona. */
export function renderProfileSection(profile: CapabilityProfile): string {
  const writable = profile.writablePaths.length ? profile.writablePaths.join(", ") : "none (no direct writes)";
  const lines = [
    `Active capability profile: ${profile.name} — ${profile.description}`,
    `Writable paths for write/edit: ${writable}. Writes elsewhere are refused by the harness, not by you.`,
  ];
  if (profile.tools.includes("bash")) {
    lines.push("bash is granted and is not path-gated: the writable paths bind you there too, and the harness cannot check it.");
  }
  lines.push(...profile.advice.map((line) => `- ${line}`));
  return lines.join("\n");
}
