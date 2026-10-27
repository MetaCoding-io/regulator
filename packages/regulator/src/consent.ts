/**
 * The consent gate (#60): what the host's tool-call interception runs before
 * a call that falls under the profile's consent grant, and what a scripted
 * unit runs in its place, so the model-free examples are refused by the same
 * mechanism a session is.
 *
 * The decision is core's `consentFor` over the ledger. This adds the two
 * things a gate owes beyond a verdict: the refusal recorded as an
 * `operational-signal` from the unit to S3, with the tool, the path and the
 * reason, and the instruction the unit is given — ask, with ask_human
 * kind=consent naming the call. An accepted consent may carry the arguments
 * a person amended; the gate hands back the call to run with them in place,
 * and names the fields that changed. An amendment the tool's schema refuses,
 * or one that moves the call to another path, is a rejection: the consent
 * was for that call.
 */
import { randomUUID } from "node:crypto";
import { ObligationLedger, appendSignal, consentFor, consentGrantFor, normalizeConsentCall, severityForKind, type ConsentVerdict } from "@metacoding.io/regulator-core";
import type { CapabilityProfile, ConsentCall, InteractionRequest, OperationalSignal } from "@metacoding.io/regulator-protocol";

export interface ConsentGateOptions {
  /** The instance (the base checkout): where the ledger and the regulatory log live. */
  repo: string;
  /** The unit the session runs for; undefined in a session no lease names, which can only match a consent asked without one. */
  unitId?: string;
  profile: CapabilityProfile;
  call: ConsentCall;
  now?: () => number;
  /** The host's check of amended arguments against the tool's schema: undefined when they validate, otherwise why not. Without one, an amendment cannot be checked and is refused. */
  validate?: (args: Record<string, unknown>) => string | undefined;
}

export type ConsentRefusal = "absent" | "pending" | "rejected" | "amendment-refused";

export type ConsentGateDecision =
  | { allowed: true; guarded: false }
  | { allowed: true; guarded: true; obligationId: string; by: string; arguments: Record<string, unknown>; amended: string[] }
  | { allowed: false; guarded: true; refusal: ConsentRefusal; reason: string; instruction: string; signalId: string; obligationId?: string };

/** The argument a grant identifies the call by: what the refusal names and what an amendment may not move. */
function subjectOf(call: ConsentCall): string {
  const p = call.arguments.path;
  if (typeof p === "string") return p;
  const c = call.arguments.command;
  if (typeof c === "string") return c.slice(0, 120);
  return JSON.stringify(call.arguments).slice(0, 120);
}

/** How the unit is told to ask: the call, spelled so the record matches what the gate will see. */
export function consentInstruction(call: ConsentCall): string {
  const recorded: ConsentCall = { tool: call.tool, arguments: typeof call.arguments.path === "string" ? { path: call.arguments.path } : typeof call.arguments.command === "string" ? { command: call.arguments.command } : call.arguments };
  return `Ask first: ask_human with kind=consent, an action stating what a yes authorizes, and call ${JSON.stringify(recorded)}; the harness refuses this call until a person's yes for that call is on the record, and holds the yes across attempts. Do not work around the refusal.`;
}

function explain(verdict: ConsentVerdict, unitId: string | undefined): string {
  const unit = unitId ? `unit ${unitId}` : "this session (no unit)";
  switch (verdict.status) {
    case "absent": return `no consent for this call is on the record for ${unit}`;
    case "pending": return `the consent question for this call (obligation ${verdict.obligation.id.slice(0, 8)}) has no answer yet, and silence is not consent`;
    case "rejected": return `${verdict.obligation.closedBy ?? "a person"} refused consent for this call (obligation ${verdict.obligation.id.slice(0, 8)}): do not perform it`;
    default: return "";
  }
}

export async function consentGate(options: ConsentGateOptions): Promise<ConsentGateDecision> {
  const now = options.now ?? Date.now;
  const call = normalizeConsentCall(options.call);
  const grant = consentGrantFor(options.profile, call);
  if (!grant) return { allowed: true, guarded: false };
  const ledger = new ObligationLedger(options.repo, now);
  const verdict = consentFor(await ledger.obligations(), await ledger.interactions(), options.unitId, call);
  const subject = subjectOf(call);

  const refuse = async (refusal: ConsentRefusal, reason: string, obligationId?: string): Promise<ConsentGateDecision> => {
    const signal: OperationalSignal = {
      id: randomUUID(), timestamp: new Date(now()).toISOString(), source: "S1", kind: "operational-signal", channel: "signal", destination: "S3", severity: "advisory",
      subject: `consent refused: ${call.tool} ${subject}`, ...(options.unitId ? { unit: options.unitId } : {}),
      observation: `${call.tool} ${subject} falls under profile "${options.profile.name}"'s consent grant (${grant.paths ? `under ${grant.paths.join(", ")}` : grant.pattern !== undefined ? `matching /${grant.pattern}/` : "every call"}) and was refused before it ran: ${reason}. The unit was told to ask with ask_human kind=consent.`,
      evidence: [{ class: typeof call.arguments.command === "string" ? "command" : "file", ref: subject, observation: refusal }],
    };
    await appendSignal(options.repo, signal);
    return { allowed: false, guarded: true, refusal, reason, instruction: consentInstruction(call), signalId: signal.id, ...(obligationId === undefined ? {} : { obligationId }) };
  };

  if (verdict.status !== "accepted") return refuse(verdict.status, explain(verdict, options.unitId), verdict.status === "absent" ? undefined : verdict.obligation.id);
  const amended = Object.keys(verdict.amendedArguments ?? {});
  if (!amended.length) return { allowed: true, guarded: true, obligationId: verdict.obligation.id, by: verdict.by, arguments: call.arguments, amended: [] };
  const args = { ...call.arguments, ...verdict.amendedArguments };
  const who = `${verdict.by}'s consent (obligation ${verdict.obligation.id.slice(0, 8)}) amended ${amended.join(", ")}`;
  if (grant.paths && "path" in (verdict.amendedArguments ?? {}) && normalizeConsentCall({ tool: call.tool, arguments: args }).arguments.path !== call.arguments.path) {
    return refuse("amendment-refused", `${who}, and the path is what the grant guards: a different path is a different action, to be asked for on its own. The amendment counts as a rejection`, verdict.obligation.id);
  }
  const why = options.validate ? options.validate(args) : "the tool's schema is not known here, so the amended call cannot be checked";
  if (why !== undefined) return refuse("amendment-refused", `${who}, and the tool's schema refuses the result (${why}). The amendment counts as a rejection; ask again if the work still needs the call`, verdict.obligation.id);
  return { allowed: true, guarded: true, obligationId: verdict.obligation.id, by: verdict.by, arguments: args, amended };
}

export interface HeadlessConsentAsk {
  unitId: string;
  attempt: number;
  subject: string;
  question: string;
  action: string;
  call: ConsentCall;
  evidence: InteractionRequest["evidence"];
  timeoutMs?: number;
  now?: () => number;
}

/**
 * What `ask_human` kind=consent does with nobody to ask (the scripted units' stand-in for the session): the obligation
 * is owed before anyone could answer it, the request records the call a yes would authorize, and the answer is
 * recorded as unavailable. The loop then records the attempt as paused and holds the unit until a person answers.
 */
export async function askConsentHeadless(repo: string, ask: HeadlessConsentAsk): Promise<{ obligationId: string; requestId: string }> {
  const now = ask.now ?? Date.now;
  const ledger = new ObligationLedger(repo, now);
  const severity = severityForKind("consent");
  const obligation = await ledger.openObligation({ subject: `consent: ${ask.subject}`, unit: ask.unitId, concern: "interaction", sources: [`ask:${randomUUID()}`], severity, consumer: "human", blocks: true, question: ask.question, openedBy: "S1" });
  const request: InteractionRequest = {
    id: randomUUID(), kind: "consent", subject: ask.subject, question: ask.question, action: ask.action, call: normalizeConsentCall(ask.call), severity, unit: ask.unitId, attempt: ask.attempt, obligationId: obligation.id,
    evidence: ask.evidence, raisedBy: "S1", raisedAt: new Date(now()).toISOString(), timeoutMs: ask.timeoutMs ?? 0, channel: "none",
  };
  await ledger.requestInteraction(request, "S1");
  await ledger.answerInteraction({ requestId: request.id, outcome: "unavailable", by: "S1", channel: "none" });
  return { obligationId: obligation.id, requestId: request.id };
}
