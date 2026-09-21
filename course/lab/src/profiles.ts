/**
 * Capability profiles. No Pi dependency.
 *
 * A profile is a positive grant: what a kind of work may do. It binds a tool
 * surface, the paths the work may write, a reasoning budget, and the advice
 * the model should carry — the part no gate can enforce. A persona says who
 * the agent is; a profile says what it can reach.
 */
import path from "node:path";

export type ReasoningLevel = "minimal" | "low" | "medium" | "high";

export interface CapabilityProfile {
  name: string;
  description: string;
  /** Tools this profile may use. Names unknown to the host are ignored when applied. */
  tools: readonly string[];
  /** Project-relative prefixes the profile may write under. Empty means read-only. */
  writablePaths: readonly string[];
  thinkingLevel?: ReasoningLevel;
  /** Advice for the model: only what a gate cannot know. */
  advice: readonly string[];
}

export const PROFILES = {
  research: {
    name: "research",
    description: "Read and report. Cannot write, edit, or run shell commands.",
    tools: ["read", "grep", "find", "ls", "read_conventions", "run_tests"],
    writablePaths: [],
    thinkingLevel: "medium",
    advice: [
      "You are in the research profile: you can read the project and run its tests, but not change it.",
      "Report what you find with file paths and line numbers. If asked to change something, say what you would change and why; do not attempt it.",
    ],
  },
  implement: {
    name: "implement",
    description: "Change source and tests under src/ and test/. Cannot touch anything else.",
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
  const writable = profile.writablePaths.length ? profile.writablePaths.join(", ") : "none (read-only)";
  return [
    `Active capability profile: ${profile.name} — ${profile.description}`,
    `Writable paths: ${writable}. Writes elsewhere are refused by the harness, not by you.`,
    ...profile.advice.map((line) => `- ${line}`),
  ].join("\n");
}
