/**
 * The obligation ledger and the router (lesson 11).
 *
 *   ObligationLedger   the fold over the regulatory log: every obligation with
 *                      its status and history, the messages nobody has routed
 *                      yet, the transitions (acknowledge, resolve, escalate,
 *                      supersede) — each an appended event, never an edit
 *   routeMessages      the router: under a versioned routing policy, every
 *                      unrouted message becomes an obligation for a named
 *                      consumer or is noted as trace only, with the reason
 *   progressionVeto    the open obligations that stop a unit being dispatched
 *                      or closed: severity at or above the policy's line
 *
 * Pi-free and git-free. Nothing here performs an obligation; it says who
 * owes what, and the loop refuses to move a unit past what is owed.
 */
import { randomUUID } from "node:crypto";
import {
  WAITING_ACTIONS, severityAtLeast,
  type Consumer, type Disposition, type InteractionEvent, type InteractionOutcome, type InteractionRequest, type Obligation, type ObligationEvent, type ObligationState,
  type RecoveryDecision, type RegulatoryEntry, type RoutingPolicy, type Severity, type VsmMessage, type VsmSystem,
} from "@metacoding/vsm-pi-protocol";
import { appendEntry, isMessage, readEntries } from "./signals.js";

const TERMINAL = new Set(["resolved", "escalated", "superseded"]);

function isObligationEvent(entry: RegulatoryEntry): entry is ObligationEvent {
  return "type" in entry && entry.type.startsWith("obligation-");
}

/** Fold the log's events into obligation states, in the order they were opened. */
export function foldObligations(entries: readonly RegulatoryEntry[]): ObligationState[] {
  const states = new Map<string, ObligationState>();
  for (const entry of entries) {
    if (!isObligationEvent(entry) || entry.type === "message-noted") continue;
    if (entry.type === "obligation-opened") {
      states.set(entry.obligation.id, { ...entry.obligation, status: "open", acknowledgedBy: [], deliveries: [], history: [entry] });
      continue;
    }
    const state = states.get(entry.obligationId);
    if (!state) throw new Error(`corrupt regulatory log: ${entry.type} for unknown obligation ${entry.obligationId}`);
    state.history.push(entry);
    if (entry.type === "obligation-delivered") {
      state.deliveries.push({ at: entry.at, channel: entry.channel, reminder: entry.reminder, ...(entry.target === undefined ? {} : { target: entry.target }) });
    } else if (entry.type === "obligation-acknowledged") {
      state.acknowledgedBy.push(entry.by);
      if (state.status === "open") state.status = "acknowledged";
    } else {
      state.status = entry.type === "obligation-resolved" ? "resolved" : entry.type === "obligation-escalated" ? "escalated" : "superseded";
      state.closedAt = entry.at;
      state.closedBy = entry.by;
      state.rationale = entry.rationale;
      if (entry.type === "obligation-resolved") state.disposition = entry.disposition;
      else state.successor = entry.successor;
    }
  }
  return [...states.values()];
}

/** Messages no routing event has cited: neither opened as an obligation nor noted. */
export function unroutedMessages(entries: readonly RegulatoryEntry[]): VsmMessage[] {
  const cited = new Set<string>();
  for (const entry of entries) {
    if (isMessage(entry)) continue;
    if (entry.type === "message-noted") cited.add(entry.message);
    else if (entry.type === "obligation-opened") for (const s of entry.obligation.sources) cited.add(s);
  }
  return entries.filter(isMessage).filter((m) => !cited.has(m.id));
}

export function isOpen(state: ObligationState): boolean {
  return !TERMINAL.has(state.status);
}

export interface OpenObligationInput {
  subject: string;
  unit?: string;
  concern: Obligation["concern"];
  sources: string[];
  severity: Severity;
  consumer: Consumer;
  blocks: boolean;
  question?: string;
  openedBy?: VsmSystem;
}

export interface Transition {
  by: string;
  rationale: string;
}

export class ObligationLedger {
  readonly root: string;
  readonly #now: () => number;

  constructor(root: string, now: () => number = Date.now) {
    this.root = root;
    this.#now = now;
  }

  #stamp(): string {
    return new Date(this.#now()).toISOString();
  }

  entries(): Promise<RegulatoryEntry[]> {
    return readEntries(this.root);
  }

  async obligations(): Promise<ObligationState[]> {
    return foldObligations(await this.entries());
  }

  async get(id: string): Promise<ObligationState | undefined> {
    return (await this.obligations()).find((o) => o.id === id);
  }

  async open(unitId?: string): Promise<ObligationState[]> {
    return (await this.obligations()).filter((o) => isOpen(o) && (unitId === undefined || o.unit === unitId));
  }

  async unrouted(): Promise<VsmMessage[]> {
    return unroutedMessages(await this.entries());
  }

  async openObligation(input: OpenObligationInput): Promise<Obligation> {
    const obligation: Obligation = {
      id: randomUUID(), subject: input.subject, ...(input.unit === undefined ? {} : { unit: input.unit }), concern: input.concern, sources: input.sources,
      severity: input.severity, consumer: input.consumer, blocks: input.blocks, ...(input.question === undefined ? {} : { question: input.question }),
      openedAt: this.#stamp(), openedBy: input.openedBy ?? "S3",
    };
    await appendEntry(this.root, { type: "obligation-opened", id: randomUUID(), at: obligation.openedAt, by: obligation.openedBy, obligation });
    return obligation;
  }

  async #live(id: string): Promise<ObligationState> {
    const state = await this.get(id);
    if (!state) throw new Error(`no obligation "${id}"`);
    if (!isOpen(state)) throw new Error(`obligation ${id} is ${state.status}; terminal records do not reopen — open a successor`);
    return state;
  }

  async #append(event: ObligationEvent): Promise<void> {
    await appendEntry(this.root, event);
  }

  /** Received by a consumer authorized to handle it. Not agreement, not correctness. */
  async acknowledge(id: string, by: string, note?: string): Promise<void> {
    await this.#live(id);
    await this.#append({ type: "obligation-acknowledged", id: randomUUID(), at: this.#stamp(), by, obligationId: id, ...(note === undefined ? {} : { note }) });
  }

  async resolve(id: string, transition: Transition & { disposition: Disposition }): Promise<void> {
    await this.#live(id);
    await this.#append({ type: "obligation-resolved", id: randomUUID(), at: this.#stamp(), by: transition.by, obligationId: id, disposition: transition.disposition, rationale: transition.rationale });
  }

  /**
   * This consumer cannot legitimately resolve it. Either link an existing open
   * obligation as the successor, or open one for the named consumer. Never
   * valid without a successor.
   */
  async escalate(id: string, transition: Transition & ({ successor: string } | { to: Consumer; severity?: Severity; blocks?: boolean })): Promise<Obligation> {
    const state = await this.#live(id);
    let successor: Obligation;
    if ("successor" in transition) {
      const target = await this.#live(transition.successor);
      successor = target;
    } else {
      successor = await this.openObligation({
        subject: state.subject, ...(state.unit === undefined ? {} : { unit: state.unit }), concern: state.concern, sources: [id, ...state.sources],
        severity: transition.severity ?? state.severity, consumer: transition.to, blocks: transition.blocks ?? state.blocks, ...(state.question === undefined ? {} : { question: state.question }),
      });
    }
    await this.#append({ type: "obligation-escalated", id: randomUUID(), at: this.#stamp(), by: transition.by, obligationId: id, successor: successor.id, rationale: transition.rationale });
    return successor;
  }

  async supersede(id: string, transition: Transition & { successor: string }): Promise<void> {
    await this.#live(id);
    await this.#live(transition.successor);
    await this.#append({ type: "obligation-superseded", id: randomUUID(), at: this.#stamp(), by: transition.by, obligationId: id, successor: transition.successor, rationale: transition.rationale });
  }

  async note(messageId: string, by: string, reason: string): Promise<void> {
    await this.#append({ type: "message-noted", id: randomUUID(), at: this.#stamp(), by, message: messageId, reason });
  }

  /** The obligation was put in front of its consumer (lesson 13). Delivery is not a disposition. */
  async deliver(id: string, delivery: { by: string; channel: "outbox" | "tui" | "rpc" | "cli"; reminder?: boolean; target?: string }): Promise<void> {
    await this.#live(id);
    await this.#append({ type: "obligation-delivered", id: randomUUID(), at: this.#stamp(), by: delivery.by, obligationId: id, channel: delivery.channel, reminder: delivery.reminder ?? false, ...(delivery.target === undefined ? {} : { target: delivery.target }) });
  }

  // Interactions (lesson 13): what a unit asked a person, and what came back. Events beside the obligations they concern.
  async requestInteraction(request: InteractionRequest, by: string): Promise<void> {
    await appendEntry(this.root, { type: "interaction-requested", id: randomUUID(), at: this.#stamp(), by, request });
  }

  async answerInteraction(answer: { requestId: string; outcome: InteractionOutcome; answer?: string; by: string; channel: InteractionRequest["channel"] }): Promise<void> {
    await appendEntry(this.root, { type: "interaction-answered", id: randomUUID(), at: this.#stamp(), by: answer.by, requestId: answer.requestId, outcome: answer.outcome, channel: answer.channel, ...(answer.answer === undefined ? {} : { answer: answer.answer }) });
  }

  /** Every request with its answers, oldest first. */
  async interactions(): Promise<InteractionState[]> {
    const states = new Map<string, InteractionState>();
    for (const entry of await this.entries()) {
      if (isMessage(entry) || !entry.type.startsWith("interaction-")) continue;
      const e = entry as InteractionEvent;
      if (e.type === "interaction-requested") states.set(e.request.id, { request: e.request, answers: [] });
      else states.get(e.requestId)?.answers.push({ at: e.at, by: e.by, outcome: e.outcome, channel: e.channel, ...(e.answer === undefined ? {} : { answer: e.answer }) });
    }
    return [...states.values()];
  }
}

export interface InteractionState {
  request: InteractionRequest;
  answers: Array<{ at: string; by: string; outcome: InteractionOutcome; channel: InteractionRequest["channel"]; answer?: string }>;
}

/**
 * The severity the router acts on. An uncertainty's reported impact is a
 * claim; the policy maps it. A policy floor (lesson 12) raises a message that
 * names what the floor names — an invariant, a protected path — to at least
 * the floor's severity, whatever the emitter claimed.
 */
export function effectiveSeverity(message: VsmMessage, policy: RoutingPolicy): Severity {
  let severity: Severity = message.kind === "uncertainty-signal" ? policy.impactSeverity[message.impact] : message.severity;
  // What the message says — subject, observation, rationale — not the invariant a finding cites as its authority:
  // a closeout refusal under INV-003 applies the invariant; it is not about it.
  const text = `${message.subject}\n${"observation" in message ? message.observation : ""}\n${"rationale" in message ? message.rationale : ""}`;
  for (const floor of policy.floors ?? []) {
    if (new RegExp(floor.pattern).test(text) && !severityAtLeast(severity, floor.severity)) severity = floor.severity;
  }
  return severity;
}

export interface RouteMessagesOptions {
  policy: RoutingPolicy;
  now?: () => number;
  /** The function routing; S3 unless a definition says otherwise. */
  by?: VsmSystem;
}

export interface Routed {
  opened: Obligation[];
  noted: Array<{ message: VsmMessage; reason: string }>;
}

/**
 * Route every unrouted message under the policy. Intelligence past its
 * expiry is noted, never an obligation: stale evidence cannot certify a
 * decision. Intelligence naming affected units opens one obligation per unit,
 * so the veto lands where the concern is.
 */
export async function routeMessages(ledger: ObligationLedger, options: RouteMessagesOptions): Promise<Routed> {
  const { policy } = options;
  const now = options.now ?? Date.now;
  const by = options.by ?? "S3";
  const routed: Routed = { opened: [], noted: [] };
  for (const message of await ledger.unrouted()) {
    const rule = policy.rules.find((r) => r.kind === message.kind);
    const severity = effectiveSeverity(message, policy);
    const note = async (reason: string) => { await ledger.note(message.id, by, reason); routed.noted.push({ message, reason }); };
    if (!rule) { await note(`${policy.name} v${policy.version} has no rule for ${message.kind}`); continue; }
    if (!severityAtLeast(severity, rule.minSeverity)) { await note(`${severity} is below ${rule.minSeverity}, the ${policy.name} v${policy.version} line for ${message.kind}`); continue; }
    if (message.kind === "intelligence-signal" && message.expiresAt && Date.parse(message.expiresAt) <= now()) { await note(`intelligence expired at ${message.expiresAt}; stale evidence cannot raise an obligation`); continue; }
    const blocks = severityAtLeast(severity, policy.blocksAtOrAbove);
    const units = message.kind === "intelligence-signal" && message.affectedUnits?.length ? message.affectedUnits : [message.unit];
    for (const unit of new Set(units)) {
      routed.opened.push(await ledger.openObligation({
        subject: message.subject, ...(unit === undefined ? {} : { unit }), concern: message.kind, sources: [message.id], severity, consumer: rule.consumer,
        // A blocking obligation holds the unit it is about. With no unit it holds nothing — except an audit finding about the
        // instance itself (lesson 15: the base failing its checks after a merge), which holds every dispatch until S3 decides.
        blocks: blocks && (unit !== undefined || message.kind === "audit-finding"), openedBy: by,
      }));
    }
  }
  return routed;
}

/** The open obligations that veto a unit's dispatch and close. */
export async function progressionVeto(ledger: ObligationLedger, unitId: string): Promise<ObligationState[]> {
  // What is owed on the unit, and what is owed on the instance itself (lesson 15): an obligation with no unit — the base
  // failing its checks after a merge — holds every unit until S3 dispositions it.
  return (await ledger.open()).filter((o) => o.blocks && (o.unit === unitId || o.unit === undefined));
}

/**
 * S3's disposition of what it was routed, expressed by the recovery decision
 * it took. Retry, repair and abort resolve the unit's open S3 obligations;
 * a waiting action opens one obligation for the consumer the policy names and
 * escalates the S3 ones to it, so the wait has a successor and an owner.
 * `cites` are further sources the wait absorbs — the algedonic signal an
 * escalation emitted — so the router does not open a second obligation for
 * them.
 */
export async function dispositionByDecision(ledger: ObligationLedger, decision: RecoveryDecision, policy: RoutingPolicy, options: { cites?: readonly string[] } = {}): Promise<Obligation | undefined> {
  const mine = (await ledger.open(decision.unitId)).filter((o) => o.consumer === "S3" && o.concern !== "recovery-decision");
  const cite = `${decision.policy.name} v${decision.policy.version}: ${decision.cause} (occurrence ${decision.occurrence}) → ${decision.action}`;
  if (!WAITING_ACTIONS.has(decision.action)) {
    const disposition: Disposition = decision.action === "abort" ? "rejected" : "rework";
    for (const o of mine) await ledger.resolve(o.id, { by: "S3", disposition, rationale: `${cite}. ${decision.rationale}` });
    return undefined;
  }
  const action = decision.action as keyof RoutingPolicy["recovery"];
  const wait = await ledger.openObligation({
    subject: `unit ${decision.unitId}: ${decision.action} (${decision.cause})`, unit: decision.unitId, concern: "recovery-decision",
    sources: [decision.id, ...(options.cites ?? []), ...mine.map((o) => o.id)], severity: "blocking", consumer: policy.recovery[action], blocks: true,
    ...(decision.question === undefined ? {} : { question: decision.question }),
  });
  for (const o of mine) await ledger.escalate(o.id, { by: "S3", successor: wait.id, rationale: `${cite}; S3 cannot resolve this inside the loop` });
  return wait;
}
