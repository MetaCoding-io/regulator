/**
 * Capability profiles as positive grants over declared tool effects.
 *
 * A persona says who the agent is; a profile says what it can reach. The
 * checks here are mechanisms (levels 2–3 of the hierarchy); the profile's
 * `advice` is the level-5 remainder, rendered for the model but never relied
 * on for enforcement.
 */
import path from "node:path";
import type { CapabilityProfile } from "@metacoding/vsm-pi-protocol";
import { readOnlyViolations } from "./effects.js";

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
 * with one of the profile's writable prefixes. Anything the check does not
 * understand — absolute paths, `..` — is refused. Lexical only: it does not
 * follow symlinks or protect against TOCTOU. Compare `authorizeWrite`, which
 * is the negative-invariant counterpart for protected S5 paths.
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
