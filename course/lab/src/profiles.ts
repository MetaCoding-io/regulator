/**
 * The course's two capability profiles. The profile type, the effect
 * declarations, and the checks (`isWritableUnder`, `isReadOnlyProfile`,
 * `renderProfileSection`) ship in VSM-Pi's packages; the lab only declares
 * the profiles it uses.
 *
 * Model and context-file bindings are deliberately absent at this checkpoint:
 * model routing arrives with budgets (lesson 07), durable context with
 * identity (lesson 12).
 */
import type { CapabilityProfile } from "@metacoding/vsm-pi-protocol";

export type { CapabilityProfile } from "@metacoding/vsm-pi-protocol";
export { isReadOnlyProfile, isWritableUnder, renderProfileSection } from "@metacoding/vsm-pi-core";

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
