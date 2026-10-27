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
 *   consentGrantFor      the grant a call falls under, if any
 *   consentFor           the lookup over the ledger: the consent obligation
 *                        on the unit whose recorded call matches this one,
 *                        and what it says — accepted (with any amendment),
 *                        pending, rejected, or absent. The action the
 *                        request recorded is what is matched: not the hint
 *                        the next attempt was given, not the attempt number,
 *                        so a yes on attempt 1 holds on attempt 3 for the
 *                        same call and a different call asks again
 *
 * Pi-free and pure. Nothing here reads a tool's effects to decide that a call
 * needs consent: the grant is written, and `effectOf` is read only to find
 * the tools a path cannot gate (`execution: "arbitrary"`).
 */
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { CapabilityProfile, ConsentCall, ConsentGrant, InteractionRequest, ObligationState } from "@metacoding.io/regulator-protocol";
import { effectOf } from "./effects.js";
import type { InteractionState } from "./obligations.js";

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

/** A path as the grant and the record compare it: Pi's `@` spelling, backslashes and `./` removed, lexically normalized. */
export function normalizeConsentPath(input: string): string {
  const cleaned = (input.startsWith("@") ? input.slice(1) : input).replaceAll("\\", "/");
  return path.posix.normalize(cleaned).replace(/^\.\//, "");
}

/** The call with its `path` argument normalized, so the record and the gate spell it one way. */
export function normalizeConsentCall(call: ConsentCall): ConsentCall {
  const p = call.arguments.path;
  return typeof p === "string" ? { tool: call.tool, arguments: { ...call.arguments, path: normalizeConsentPath(p) } } : { tool: call.tool, arguments: { ...call.arguments } };
}

/** The grant this call falls under, or undefined when the profile needs no consent for it. */
export function consentGrantFor(profile: CapabilityProfile, call: ConsentCall): ConsentGrant | undefined {
  const normalized = normalizeConsentCall(call);
  return (profile.consent ?? []).find((grant) => {
    if (grant.tool !== call.tool) return false;
    if (grant.paths) {
      const p = normalized.arguments.path;
      return typeof p === "string" && grant.paths.some((prefix) => p.startsWith(prefix));
    }
    if (grant.pattern !== undefined) {
      const command = normalized.arguments.command;
      return typeof command === "string" && (regExpOf(grant.pattern)?.test(command) ?? false);
    }
    return true;
  });
}

/** The call a consent recorded covers this one: the same tool, and every argument the record names equal in the call. */
export function matchesConsentedCall(recorded: ConsentCall, call: ConsentCall): boolean {
  if (recorded.tool !== call.tool) return false;
  const a = normalizeConsentCall(recorded).arguments;
  const b = normalizeConsentCall(call).arguments;
  return Object.entries(a).every(([key, value]) => key in b && isDeepStrictEqual(value, b[key]));
}

export type ConsentVerdict =
  | { status: "accepted"; obligation: ObligationState; request: InteractionRequest; by: string; amendedArguments?: Record<string, unknown> }
  | { status: "pending" | "rejected"; obligation: ObligationState; request: InteractionRequest }
  | { status: "absent" };

/**
 * What the ledger says about consent for this call on this unit. The latest consent request on the unit whose
 * recorded call matches decides: resolved as accepted is a yes (with the arguments a person amended, if any),
 * resolved otherwise is a no, still owed is pending, and no matching request at all is absent. A request that
 * recorded no call matches nothing: a consent the gate can check names the call it is for.
 */
export function consentFor(obligations: readonly ObligationState[], interactions: readonly InteractionState[], unit: string | undefined, call: ConsentCall): ConsentVerdict {
  const matching = interactions
    .filter((i) => i.request.kind === "consent" && i.request.unit === unit && i.request.call !== undefined && matchesConsentedCall(i.request.call, call))
    .sort((x, y) => x.request.raisedAt.localeCompare(y.request.raisedAt));
  for (const state of [...matching].reverse()) {
    const obligation = obligations.find((o) => o.id === state.request.obligationId);
    if (!obligation) continue;
    if (obligation.status !== "resolved") return { status: "pending", obligation, request: state.request };
    if (obligation.disposition !== "accepted") return { status: "rejected", obligation, request: state.request };
    const answered = [...state.answers].reverse().find((a) => a.outcome === "answered");
    return { status: "accepted", obligation, request: state.request, by: obligation.closedBy ?? answered?.by ?? "unknown", ...(answered?.amendedArguments === undefined ? {} : { amendedArguments: answered.amendedArguments }) };
  }
  return { status: "absent" };
}
