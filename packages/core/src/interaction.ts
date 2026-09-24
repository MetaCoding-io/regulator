/**
 * Interaction contracts as mechanism (lesson 13).
 *
 *   continuesWithoutAnswer     the fixed rule: only a recap goes on without an
 *                              answer; silence, cancellation and timeout are
 *                              never consent
 *   dispositionForAnswer       what a person's answer means for the obligation
 *   checkDispositionAuthority  who may disposition what, from the policy's
 *                              people: a name not listed may do nothing
 *   remindable                 the open obligations owed to a person whose
 *                              last delivery is older than the policy allows
 *
 * Pi-free. Delivery to a real channel is the lab's; this decides.
 */
import {
  CONTINUES_WITHOUT_ANSWER, severityAtLeast,
  type Disposition, type InteractionKind, type InteractionPolicy, type ObligationState, type Person, type Severity,
} from "@metacoding/regulator-protocol";

export function continuesWithoutAnswer(kind: InteractionKind): boolean {
  return CONTINUES_WITHOUT_ANSWER[kind];
}

/** Severity an interaction of this kind carries as an obligation: everything that waits is blocking; a recap is advice. */
export function severityForKind(kind: InteractionKind): Severity {
  return continuesWithoutAnswer(kind) ? "advisory" : "blocking";
}

const YES = /^\s*(y|yes|approve|approved|ok|okay|confirm|confirmed|accept|accepted|proceed)\s*$/i;

/** What an answer means. Consent is a yes or it is a no; nothing else. */
export function dispositionForAnswer(kind: InteractionKind, answer: string): Disposition {
  switch (kind) {
    case "consent":
      return YES.test(answer) ? "accepted" : "rejected";
    case "uat":
      return YES.test(answer) ? "verified" : "rejected";
    default:
      return "fixed";
  }
}

export interface DispositionAsk {
  severity: Severity;
  disposition?: Disposition;
  /** The action is an S5 decision (identity accept / reject). */
  s5?: boolean;
}

/** Undefined when the person may; otherwise why not. */
export function checkDispositionAuthority(policy: InteractionPolicy, by: string, ask: DispositionAsk): string | undefined {
  const person: Person | undefined = policy.people.find((p) => p.name === by);
  if (!person) return `"${by}" is not a person the interaction policy (${policy.name} v${policy.version}) names; a name not listed may disposition nothing`;
  if (!severityAtLeast(person.resolveUpTo, ask.severity)) return `${by} may disposition up to ${person.resolveUpTo}; this is ${ask.severity}`;
  if (ask.disposition === "accepted-risk" && !person.acceptRisk) return `${by} may not accept risk (${policy.name} v${policy.version})`;
  if (ask.s5 && !person.actAsS5) return `${by} may not act as S5 (${policy.name} v${policy.version})`;
  return undefined;
}

/** Open obligations owed to a person, never delivered or delivered longer ago than the policy's reminder interval. */
export function remindable(states: readonly ObligationState[], policy: InteractionPolicy, now: number): ObligationState[] {
  return states.filter((o) => {
    if (o.consumer !== "human" || (o.status !== "open" && o.status !== "acknowledged")) return false;
    const last = o.deliveries.at(-1);
    return !last || now - Date.parse(last.at) >= policy.reminderAfterMs;
  });
}

/** Open obligations owed to a person that have never been delivered anywhere. */
export function undelivered(states: readonly ObligationState[]): ObligationState[] {
  return states.filter((o) => o.consumer === "human" && (o.status === "open" || o.status === "acknowledged") && o.deliveries.length === 0);
}
