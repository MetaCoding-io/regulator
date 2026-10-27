/**
 * Per-tool consent grants (#60): a field on the capability profile, enforced
 * by the host's tool-call interception, declared and never inferred.
 *
 *   checkConsentGrants   what the definition check says about a profile's
 *                        grants: a guarded tool the profile does not grant, a
 *                        guarded path outside its writable paths, a pattern on
 *                        a tool that takes none or one that is not a regular
 *                        expression, are refused; a guarded write beside an
 *                        arbitrary-execution tool with no pattern covering the
 *                        path is the sandbox bypass, and a warning
 *
 * Pi-free. Nothing here reads a tool's effects to decide that a call needs
 * consent: the grant is written, and `effectOf` is read only to find the
 * tools a path cannot gate (`execution: "arbitrary"`).
 */
import type { CapabilityProfile, ConsentGrant } from "@metacoding.io/regulator-protocol";
import { effectOf } from "./effects.js";

/** The tools a `paths` grant narrows: the two whose argument the profile grant already gates by prefix. */
export const PATH_GUARDED_TOOLS: ReadonlySet<string> = new Set(["write", "edit"]);

function regExpOf(pattern: string): RegExp | undefined {
  try {
    return new RegExp(pattern);
  } catch {
    return undefined;
  }
}

/** A grant in one phrase, as the profile section and the refusals say it. */
export function describeConsentGrant(grant: ConsentGrant): string {
  if (grant.paths) return `${grant.tool} under ${grant.paths.join(", ")}`;
  if (grant.pattern !== undefined) return `${grant.tool} matching /${grant.pattern}/`;
  return `every ${grant.tool} call`;
}

export interface ConsentGrantProblem {
  message: string;
}

/** What `regulator check` refuses about a profile's consent grants. */
export function checkConsentGrants(profile: CapabilityProfile): ConsentGrantProblem[] {
  const problems: ConsentGrantProblem[] = [];
  for (const [i, grant] of (profile.consent ?? []).entries()) {
    const at = `consent[${i}]`;
    if (!profile.tools.includes(grant.tool)) problems.push({ message: `${at} needs consent for "${grant.tool}", which the profile does not grant: a grant guards calls the profile can make` });
    if (grant.paths && !PATH_GUARDED_TOOLS.has(grant.tool)) problems.push({ message: `${at} narrows "${grant.tool}" by paths; a path applies to ${[...PATH_GUARDED_TOOLS].join(" and ")}, whose argument the profile grant gates` });
    for (const p of grant.paths ?? []) {
      if (!profile.writablePaths.some((w) => p.startsWith(w))) problems.push({ message: `${at} needs consent for ${grant.tool} under "${p}", which is outside the profile's writable paths (${profile.writablePaths.join(", ") || "none"}): a write there is refused before consent could be asked` });
    }
    if (grant.pattern !== undefined) {
      if (effectOf(grant.tool)?.execution !== "arbitrary") problems.push({ message: `${at} gives "${grant.tool}" a pattern; a command pattern applies to a tool with arbitrary execution (bash), which no path gates` });
      else if (!regExpOf(grant.pattern)) problems.push({ message: `${at} pattern "${grant.pattern}" is not a regular expression` });
    }
    if (grant.paths && grant.pattern !== undefined) problems.push({ message: `${at} carries both paths and a pattern; one entry guards one tool one way` });
  }
  return problems;
}

/**
 * The sandbox bypass (#60): a profile that needs consent for a write under a path and also grants a tool whose
 * execution is arbitrary leaves the path reachable through the shell with no consent asked, since the shell is
 * not path-gated. A pattern entry on the shell that matches the path closes it; without one, this warns.
 */
export function consentBypassWarnings(profile: CapabilityProfile): ConsentGrantProblem[] {
  const warnings: ConsentGrantProblem[] = [];
  const shells = profile.tools.filter((t) => effectOf(t)?.execution === "arbitrary");
  for (const grant of profile.consent ?? []) {
    for (const p of grant.paths ?? []) {
      for (const shell of shells) {
        const covered = (profile.consent ?? []).some((g) => g.tool === shell && (g.pattern === undefined || regExpOf(g.pattern)?.test(p)));
        if (!covered) warnings.push({ message: `profile "${profile.name}" needs consent for ${grant.tool} under "${p}" and grants ${shell}, which is not path-gated: a shell command can write there with no consent asked. Declare {"tool":"${shell}","pattern":"${p.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}"} beside it, or the grant is enforced on ${grant.tool} calls only` });
      }
    }
  }
  return warnings;
}
