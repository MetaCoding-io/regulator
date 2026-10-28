/**
 * Capability profiles as positive grants over declared tool effects.
 *
 * A persona says who the agent is; a profile says what it can reach. The
 * checks here are mechanisms (levels 2–3 of the hierarchy); the profile's
 * advice — the file `advice/<profile>.md`, or the inline `advice[]` for one
 * release of overlap — is the level-5 remainder, rendered for the model but
 * never relied on for enforcement.
 */
import path from "node:path";
import type { CapabilityProfile, ToolEffect } from "@metacoding.io/regulator-protocol";
import { renderAdvice } from "./advice.js";
import { consentDerivedFrom } from "./declared-tools.js";
import { describeConsentGrant } from "./consent.js";
import { TOOL_EFFECTS, readOnlyViolations } from "./effects.js";

/**
 * A profile is read-only when every tool it grants has a declared read-only
 * effect and it grants no direct writes. Removing `write`, `edit` and `bash`
 * is not enough: a tool with a one-string schema can still run the project.
 */
export function isReadOnlyProfile(profile: CapabilityProfile, effects: Readonly<Record<string, ToolEffect>> = TOOL_EFFECTS): boolean {
  return profile.writablePaths.length === 0 && readOnlyViolations(profile.tools, effects).length === 0;
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

export interface RenderProfileOptions {
  /** The text of the instance's advice file for this profile; when given it is rendered in place of the inline `advice[]`. */
  advice?: string;
  /** The budget policy's `advice.maxChars`; the file's text is cut there, with a marker, as the identity is at `identity.maxChars`. */
  maxChars?: number;
  /** The effects of the workload-declared tools (#121): a granted one with an irreversible effect is described beside the profile's own consent grants, since the gate derives a consent for it. */
  declared?: Readonly<Record<string, ToolEffect>>;
}

/**
 * The profile as the model sees it: a system-prompt section, not a persona. The advice file renders byte for byte as
 * the inline lines did — one `- ` bullet per line — so moving the text into the file changes nothing a unit is told.
 */
export function renderProfileSection(profile: CapabilityProfile, options: RenderProfileOptions = {}): string {
  const writable = profile.writablePaths.length ? profile.writablePaths.join(", ") : "none (no direct writes)";
  const lines = [
    `Active capability profile: ${profile.name} — ${profile.description}`,
    `Writable paths for write/edit: ${writable}. Writes elsewhere are refused by the harness, not by you.`,
  ];
  if (profile.tools.includes("bash")) {
    lines.push("bash is granted and is not path-gated: the writable paths bind you there too, and the harness cannot check it.");
  }
  // The grant described, not advised (#60): the refusal is the interception's; this says where it stands. A declared tool
  // with an irreversible effect stands beside the grants (#121): the gate derives its consent from the declaration.
  const derived = profile.tools.filter((t) => { const e = options.declared?.[t]; return e !== undefined && consentDerivedFrom(e); });
  const required = [...(profile.consent ?? []).map(describeConsentGrant), ...derived.map((t) => `every ${t} call (its declared effect is irreversible)`)];
  if (required.length) {
    lines.push(`Consent is required before: ${required.join("; ")}. Ask first with ask_human kind=consent, naming the call (the tool and the arguments it will run with); the harness refuses such a call until a person's yes for it is on the record, and holds that yes across attempts.`);
  }
  if (options.advice !== undefined) {
    const advice = options.maxChars === undefined ? renderAdvice(options.advice, Number.POSITIVE_INFINITY) : renderAdvice(options.advice, options.maxChars);
    if (advice) lines.push(advice);
  } else {
    lines.push(...(profile.advice ?? []).map((line) => `- ${line}`));
  }
  return lines.join("\n");
}
