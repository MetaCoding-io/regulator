/**
 * Delivery of what is owed to a person (lesson 13): the algedonic path's last
 * hop. An obligation owed to a person is written to the owner's outbox — the
 * same outbox `notify_owner` uses, an effect that cannot be unsent — through
 * the effect journal, once per obligation, and recorded as delivered in the
 * regulatory log. A reminder is a second delivery after the policy's interval.
 * Delivery is not a disposition: the obligation stays open until a person
 * answers.
 */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { EffectJournal, ObligationLedger, remindable, undelivered } from "@metacoding.io/regulator-core";
import type { InteractionPolicy, ObligationState } from "@metacoding.io/regulator-protocol";
import { REGULATOR_DIR } from "@metacoding.io/regulator-core";

/** The outbox: one line per delivery to a person, keyed so reconciliation can read it back (lesson 08). */
export const OUTBOX_RELATIVE_PATH = path.join(REGULATOR_DIR, "outbox");

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

export interface WatchOptions extends DeliverOptions {
  /** A command run once per new outbox line, with the line as its last argument: the channel is the deployment's. */
  exec?: readonly string[];
  /** The process runner for `exec`. */
  run?: (command: string, args: string[]) => Promise<{ code: number; stderr: string }>;
  intervalMs?: number;
  /** One tick, then return — for CI and tests. */
  once?: boolean;
  onTick?: (tick: WatchTick) => void;
  /** A signal that ends the loop. */
  signal?: AbortSignal;
}

export interface WatchTick {
  at: string;
  delivered: number;
  reminded: number;
  /** New outbox lines handed to the channel this tick. */
  forwarded: number;
  failed: number;
}

const CURSOR_RELATIVE_PATH = path.join(".regulator", "outbox.cursor");

/**
 * The watcher (lesson 15): the process a quiet instance was missing. Each tick delivers what is pending, reminds what
 * is due, and forwards every outbox line it has not forwarded yet to the channel command, remembering how far it got
 * in a cursor file so a restart forwards nothing twice. The outbox stays the record; the channel is whatever the
 * deployment names.
 */
export async function watchOutbox(repo: string, options: WatchOptions): Promise<WatchTick[]> {
  const now = options.now ?? Date.now;
  const outbox = options.outbox ?? process.env.REGULATOR_OUTBOX ?? path.join(repo, OUTBOX_RELATIVE_PATH);
  const cursorFile = path.join(repo, CURSOR_RELATIVE_PATH);
  const run = options.run ?? (async (command: string, args: string[]) => {
    const { execFile } = await import("node:child_process");
    return new Promise<{ code: number; stderr: string }>((resolve) => {
      execFile(command, args, { cwd: repo }, (error, _stdout, stderr) => resolve({ code: error && typeof (error as { code?: unknown }).code === "number" ? (error as { code: number }).code : error ? 1 : 0, stderr: String(stderr) }));
    });
  });
  const ticks: WatchTick[] = [];
  for (;;) {
    const delivered = await deliverPending(repo, { policy: options.policy, now, outbox });
    const reminded = await remindDue(repo, { policy: options.policy, now, outbox });
    let forwarded = 0, failed = 0;
    const text = await readFile(outbox, "utf8").catch(() => "");
    const cursor = Number((await readFile(cursorFile, "utf8").catch(() => "0")).trim()) || 0;
    if (text.length > cursor) {
      const lines = text.slice(cursor).split("\n").filter(Boolean);
      for (const line of lines) {
        if (options.exec?.length) {
          const result = await run(options.exec[0]!, [...options.exec.slice(1), line]);
          if (result.code === 0) forwarded++; else failed++;
        } else forwarded++;
      }
      if (!failed) {
        await mkdir(path.dirname(cursorFile), { recursive: true });
        await writeFile(cursorFile, `${text.length}\n`, "utf8");
      }
    }
    const tick: WatchTick = { at: new Date(now()).toISOString(), delivered: delivered.length, reminded: reminded.length, forwarded, failed };
    ticks.push(tick);
    options.onTick?.(tick);
    if (options.once || options.signal?.aborted) return ticks;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, options.intervalMs ?? 60_000);
      options.signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
    });
    if (options.signal?.aborted) return ticks;
  }
}
