/**
 * Delivery of what is owed to a person (lesson 13): the algedonic path's last
 * hop. An obligation owed to a person is written to the owner's outbox — the
 * same outbox `notify_owner` uses, an effect that cannot be unsent — through
 * the effect journal, once per obligation, and recorded as delivered in the
 * regulatory log. A reminder is a second delivery after the policy's interval.
 * Delivery is not a disposition: the obligation stays open until a person
 * answers.
 */
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { EffectJournal, ObligationLedger, remindable, undelivered } from "@metacoding/vsm-pi-core";
import type { InteractionPolicy, ObligationState } from "@metacoding/vsm-pi-protocol";
import { OUTBOX_RELATIVE_PATH } from "./cp7-recovery.js";

export interface DeliverOptions {
  policy: InteractionPolicy;
  now?: () => number;
  /** Where deliveries go. Defaults to REGULATOR_OUTBOX or `<repo>/.regulator/outbox`. */
  outbox?: string;
}

export interface Delivered {
  obligation: ObligationState;
  reminder: boolean;
}

function describe(o: ObligationState): string {
  return `${o.severity}${o.blocks ? " veto" : ""} ${o.concern} on ${o.unit ?? "no unit"}: ${o.subject}${o.question ? ` — ${o.question}` : ""} (answer with \`regulator answer ${o.id.slice(0, 8)}\` or \`regulator obligation resolve ${o.id.slice(0, 8)}\`)`;
}

async function deliverOne(ledger: ObligationLedger, journal: EffectJournal, outbox: string, o: ObligationState, reminder: boolean, now: () => number): Promise<boolean> {
  const key = `deliver:${o.id}:${o.deliveries.length}`;
  const begun = await journal.begin({ key, tool: "deliver", description: `${reminder ? "remind" : "deliver"} obligation ${o.id.slice(0, 8)} to the owner's outbox`, ...(o.unit ? { unitId: o.unit } : {}) });
  if (!begun.proceed) return false;
  await mkdir(path.dirname(outbox), { recursive: true });
  await appendFile(outbox, `${key} ${new Date(now()).toISOString()} ${o.unit ?? "-"} ${reminder ? "REMINDER: " : ""}${describe(o).replaceAll("\n", " ")}\n`, "utf8");
  await journal.commit(key, `delivered ${new Date(now()).toISOString()}`);
  await ledger.deliver(o.id, { by: "S3", channel: "outbox", reminder, target: path.basename(outbox) });
  return true;
}

/** Every open obligation owed to a person that nothing has delivered yet. */
export async function deliverPending(repo: string, options: DeliverOptions): Promise<Delivered[]> {
  const now = options.now ?? Date.now;
  const ledger = new ObligationLedger(repo, now);
  const journal = new EffectJournal(repo, now);
  const outbox = options.outbox ?? process.env.REGULATOR_OUTBOX ?? path.join(repo, OUTBOX_RELATIVE_PATH);
  const delivered: Delivered[] = [];
  for (const o of undelivered(await ledger.obligations())) {
    if (await deliverOne(ledger, journal, outbox, o, false, now)) delivered.push({ obligation: o, reminder: false });
  }
  return delivered;
}

/** Every open obligation owed to a person whose last delivery is older than the policy's reminder interval. */
export async function remindDue(repo: string, options: DeliverOptions): Promise<Delivered[]> {
  const now = options.now ?? Date.now;
  const ledger = new ObligationLedger(repo, now);
  const journal = new EffectJournal(repo, now);
  const outbox = options.outbox ?? process.env.REGULATOR_OUTBOX ?? path.join(repo, OUTBOX_RELATIVE_PATH);
  const delivered: Delivered[] = [];
  for (const o of remindable(await ledger.obligations(), options.policy, now())) {
    const reminder = o.deliveries.length > 0;
    if (await deliverOne(ledger, journal, outbox, o, reminder, now)) delivered.push({ obligation: o, reminder });
  }
  return delivered;
}
