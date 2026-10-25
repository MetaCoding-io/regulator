/**
 * Scripted units for the worked example (`docs/examples/portfolio.md`): the
 * September close of the managed portfolio under the portfolio workload,
 * done without a model so the example runs under CI and the closeout checks
 * can be watched doing their work.
 *
 *   manager    does each unit the way its contract asks: the lots are brought
 *              up to date from the person's fills and reconciled to the
 *              custodian, the report's return is the positions' time-weighted
 *              one, the target is a reported tilt inside the benchmark's
 *              tolerances, the plan sells from the lots the tax ordering and
 *              the wash-sale window allow, and the trade list is written only
 *              after a person's yes to one question naming every trade
 *   careless   the same units, but the first trade list it writes takes the
 *              shortcuts a hurried person would: sells past the target, sells
 *              from a lot the portfolio does not hold, and sells the older lot
 *              at a loss inside the wash-sale window of a fill — and, on the
 *              repair attempt the router grants, does it right
 *
 * A scripted unit never runs a session, so nothing here exercises the gates
 * inside one (the profile grant, the write gate, the pause gate): what the
 * example shows is the loop — the closeout checks over the portfolio's own
 * suite, the protected prefixes, the consent obligation and the paused
 * attempt, the pre-merge trial on the merged tree.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ExecutionStore, MemoryStore, ObligationLedger, severityForKind } from "@metacoding.io/regulator-core";
import type { InteractionPolicy, ResultReport, WorkContract } from "@metacoding.io/regulator-protocol";
import type { DispatchRequest, Dispatcher } from "./controller.js";
import type { Exec } from "./exec.js";

export const PORTFOLIO_BEHAVIOURS = ["manager", "careless"] as const;
export type PortfolioBehaviour = (typeof PORTFOLIO_BEHAVIOURS)[number];
export function isPortfolioBehaviour(value: string): value is PortfolioBehaviour {
  return (PORTFOLIO_BEHAVIOURS as readonly string[]).includes(value);
}

const DAY = 86_400_000;
const PERIOD = "2026-09";
const DATE = "2026-09-30";
/** September's target: the benchmark tilted toward international equity, inside every subset's tolerance (the contract's d-inputs). */
const TARGET: Record<string, number> = { VTI: 0.36, VXUS: 0.31, BND: 0.33 };
const BAND = 0.02;

type Holding = Map<string, number>;
interface Positions { holdings: Holding; cash: number; externalFlows: number }
interface Lot { lot: string; ticker: string; acquired: string; shares: number; costPerShare: number }
interface Trade { ticker: string; side: "buy" | "sell"; shares: number; lots?: Array<{ lot: string; shares: number }> }
interface Fill extends Trade { price: string }

const cents = (amount: string | number): number => Math.round(Number(amount) * 100);
function money(c: number): string {
  return `${c < 0 ? "-" : ""}${Math.trunc(Math.abs(c) / 100)}.${String(Math.abs(c) % 100).padStart(2, "0")}`;
}
function csv(text: string): Record<string, string>[] {
  const [header = "", ...lines] = text.trim().split("\n");
  const keys = header.split(",");
  return lines.filter(Boolean).map((l) => Object.fromEntries(keys.map((k, i) => [k, (l.split(",")[i] ?? "").trim()])));
}
async function read(worktree: string, file: string): Promise<string> {
  return readFile(path.join(worktree, file), "utf8");
}
async function write(worktree: string, file: string, content: string): Promise<void> {
  await mkdir(path.dirname(path.join(worktree, file)), { recursive: true });
  await writeFile(path.join(worktree, file), content, "utf8");
}

async function positions(worktree: string, date: string): Promise<Positions> {
  const summary = JSON.parse(await read(worktree, `positions/${date}.json`)) as { cash: string; externalFlows?: string };
  const holdings: Holding = new Map(csv(await read(worktree, `positions/${date}.csv`)).map((r) => [r.ticker!, Number(r.shares)]));
  return { holdings, cash: cents(summary.cash), externalFlows: cents(summary.externalFlows ?? "0") };
}
async function prices(worktree: string, date: string): Promise<Map<string, number>> {
  return new Map(csv(await read(worktree, `prices/${date}.csv`)).map((r) => [r.ticker!, cents(r.price!)]));
}
function total(pos: Positions, px: Map<string, number>): number {
  let v = pos.cash;
  for (const [t, n] of pos.holdings) v += n * (px.get(t) ?? 0);
  return v;
}
function weight(pos: Positions, px: Map<string, number>, ticker: string): number {
  return ((pos.holdings.get(ticker) ?? 0) * (px.get(ticker) ?? 0)) / total(pos, px);
}
async function lots(worktree: string): Promise<{ asOf: string; open: Lot[] }> {
  const { asOf } = JSON.parse(await read(worktree, "lots/lots.json")) as { asOf: string };
  const open = csv(await read(worktree, "lots/lots.csv")).map((r) => ({ lot: r.lot!, ticker: r.ticker!, acquired: r.acquired!, shares: Number(r.shares), costPerShare: cents(r.costPerShare!) }));
  return { asOf, open };
}
function lotsCsv(open: Lot[]): string {
  return `lot,ticker,acquired,shares,costPerShare\n${[...open].sort((a, b) => a.lot.localeCompare(b.lot)).map((l) => `${l.lot},${l.ticker},${l.acquired},${l.shares},${money(l.costPerShare)}`).join("\n")}\n`;
}
const daysBetween = (from: string, to: string): number => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

function reportFor(contract: WorkContract, attempt: number, summary: string, at: string, extra: Partial<ResultReport> = {}): ResultReport {
  return {
    contractId: contract.id, contractVersion: contract.version, unitId: contract.unitId, attempt, reportedAt: at, summary,
    evidence: [{ class: "test", ref: "run_tests", observation: "the portfolio's suite passes" }, { class: "command", ref: "run_checks", observation: "checks pass" }],
    delegatedResults: contract.delegated.map((d) => ({ decisionId: d.id, choice: "kept within the bounds" })),
    unresolvedOutcomes: contract.unresolved.map((d) => ({ decisionId: d.id, outcome: "surfaced" as const, note: "not traded and listed as an open item; nobody has said what it is" })),
    emergentDecisions: [], deviations: [], residualUncertainty: [],
    ...extra,
  };
}

export interface PortfolioDispatcherOptions {
  behaviour: PortfolioBehaviour;
  /** The instance (the base checkout): where the memory store and the obligation ledger live. */
  repo: string;
  /** For the consent question's timeout; the scripted unit is headless, so nobody answers in the session either way. */
  interaction?: InteractionPolicy;
  now?: () => number;
}

/**
 * One dispatcher for every unit of the September close, keyed by unit id.
 * The careless behaviour drifts on the first trade list it writes and takes
 * the router's hint on the repair attempt.
 */
export function portfolioDispatcher(exec: Exec, options: PortfolioDispatcherOptions): Dispatcher {
  const now = options.now ?? Date.now;
  const store = new ExecutionStore(options.repo, now);
  const stamp = () => new Date(now()).toISOString();

  const commit = async (worktree: string, message: string) => {
    await exec("git", ["add", "-A"], { cwd: worktree });
    const r = await exec("git", ["-c", "commit.gpgsign=false", "commit", "-q", "-m", message], { cwd: worktree });
    if (r.code !== 0 && !/nothing to commit/.test(r.stdout + r.stderr)) throw new Error(`commit failed: ${r.stderr}`);
  };

  /** The manager's plan at the date's prices: sell the overweights down to their targets, from the lots the ordering and the window allow; buy the underweight with what that frees. */
  const plan = async (worktree: string) => {
    const pos = await positions(worktree, DATE);
    const px = await prices(worktree, DATE);
    const ledger = await lots(worktree);
    const tax = JSON.parse(await read(worktree, "tax.json")) as { shortTermRate: number; longTermRate: number; longTermAfterDays: number; washSaleWindowDays: number };
    const value = total(pos, px);
    const trades: Trade[] = [];
    const realised: string[] = [];
    let taxTotal = 0;
    for (const ticker of ["VTI", "BND"]) {
      const over = (weight(pos, px, ticker) - TARGET[ticker]!) * value;
      let wanted = Math.floor(over / px.get(ticker)!);
      if (wanted <= 0) continue;
      // The tax ordering (d-lots): a loss before a gain, long-term before short-term among gains; a loss lot whose sale would
      // be a wash sale against another lot of the ticker inside the window is skipped, however the ordering ranks it.
      const price = px.get(ticker)!;
      const held = ledger.open.filter((l) => l.ticker === ticker);
      const rank = (l: Lot) => (price < l.costPerShare ? 0 : daysBetween(l.acquired, DATE) > tax.longTermAfterDays ? 1 : 2);
      const clean = held.filter((l) => !(price < l.costPerShare && held.some((o) => o.lot !== l.lot && Math.abs(daysBetween(o.acquired, DATE)) <= tax.washSaleWindowDays)));
      const from: Array<{ lot: string; shares: number }> = [];
      for (const lot of [...clean].sort((a, b) => rank(a) - rank(b))) {
        if (wanted <= 0) break;
        const n = Math.min(wanted, lot.shares);
        from.push({ lot: lot.lot, shares: n });
        wanted -= n;
        const gain = (price - lot.costPerShare) * n;
        const longTerm = daysBetween(lot.acquired, DATE) > tax.longTermAfterDays;
        const t = Math.round(gain * (longTerm ? tax.longTermRate : tax.shortTermRate));
        taxTotal += t;
        realised.push(`sell ${n} ${ticker} from lot ${lot.lot} (${gain < 0 ? "loss" : "gain"} ${money(Math.abs(gain))}, ${longTerm ? "long-term" : "short-term"}, tax ${money(t)})`);
      }
      const sold = from.reduce((s, f) => s + f.shares, 0);
      if (sold) trades.push({ ticker, side: "sell", shares: sold, lots: from });
    }
    let cash = pos.cash + trades.reduce((s, t) => s + t.shares * px.get(t.ticker)!, 0);
    const after: Positions = { ...pos, holdings: new Map(pos.holdings) };
    for (const t of trades) after.holdings.set(t.ticker, after.holdings.get(t.ticker)! - t.shares);
    const short = (TARGET.VXUS! - weight(after, px, "VXUS")) * value;
    const buy = Math.min(Math.floor(cash / px.get("VXUS")!), Math.floor(short / px.get("VXUS")!));
    trades.push({ ticker: "VXUS", side: "buy", shares: buy });
    cash -= buy * px.get("VXUS")!;
    realised.push(`buy ${buy} VXUS at ${money(px.get("VXUS")!)} (${money(buy * px.get("VXUS")!)})`);
    return { trades, realised, taxTotal, cashAfter: cash };
  };

  const steps: Record<string, (r: DispatchRequest) => Promise<{ summary: string; extra?: Partial<ResultReport> }>> = {
    "p1-ingest-positions": async (r) => {
      // The fills since the lots were last current open and reduce lots; then the ledger is current to the latest export.
      const ledger = await lots(r.worktree);
      const open = new Map(ledger.open.map((l) => [l.lot, { ...l }]));
      const { readdir } = await import("node:fs/promises");
      const days = (await readdir(path.join(r.worktree, "trades", "executed"))).filter((f) => f.endsWith(".json")).sort();
      let applied = 0;
      for (const file of days) {
        const day = JSON.parse(await read(r.worktree, `trades/executed/${file}`)) as { date: string; trades: Fill[] };
        if (day.date <= ledger.asOf) continue;
        applied += 1;
        for (const t of day.trades) {
          if (t.side === "buy") open.set(`${day.date}-${t.ticker}`, { lot: `${day.date}-${t.ticker}`, ticker: t.ticker, acquired: day.date, shares: t.shares, costPerShare: cents(t.price) });
          else for (const f of t.lots ?? []) { const lot = open.get(f.lot)!; lot.shares -= f.shares; if (lot.shares === 0) open.delete(f.lot); }
        }
      }
      await write(r.worktree, "lots/lots.csv", lotsCsv([...open.values()]));
      await write(r.worktree, "lots/lots.json", `{ "asOf": "${DATE}", "note": "The date the ledger is current to: every executed trade through it is applied, and the open lots reconcile to the custodian's export of that date." }\n`);
      // The period review: the valuation, the time-weighted return chained over the period's exports, the holdings, the open items.
      const dates = ["2026-08-31", "2026-09-15", DATE];
      let growth = 1;
      let flows = 0;
      for (let i = 1; i < dates.length; i++) {
        const start = total(await positions(r.worktree, dates[i - 1]!), await prices(r.worktree, dates[i - 1]!));
        const end = await positions(r.worktree, dates[i]!);
        flows += end.externalFlows;
        growth *= (total(end, await prices(r.worktree, dates[i]!)) - end.externalFlows) / start;
      }
      const pos = await positions(r.worktree, DATE);
      const px = await prices(r.worktree, DATE);
      const value = total(pos, px);
      const universe = (JSON.parse(await read(r.worktree, "universe.json")) as { sets: Array<{ tickers: string[] }> }).sets.flatMap((s) => s.tickers);
      const rows = [...pos.holdings].map(([t, n]) => `| ${t} | ${n} | ${money(px.get(t)!)} | ${money(n * px.get(t)!)} | ${((n * px.get(t)!) / value * 100).toFixed(1)}% |`);
      const open_items = [...pos.holdings].filter(([t]) => !universe.includes(t)).map(([t, n]) => `- ${t} ${n} shares (${money(n * px.get(t)!)} on ${DATE}) is not in universe.json: transferred in before the opening purchases, with no confirmation and no basis; not traded, carried until a person says what it is`);
      const previous = total(await positions(r.worktree, dates[0]!), await prices(r.worktree, dates[0]!));
      await write(r.worktree, `reports/${PERIOD}.md`, `# ${PERIOD} — period review\n\nAccount brokerage: value ${money(value)} on ${DATE}, from ${money(previous)} on ${dates[0]}; external flows ${money(flows)}.\nTime-weighted return: ${((growth - 1) * 100).toFixed(2)}%.\n\n| ticker | shares | price | value | weight |\n| --- | --- | --- | --- | --- |\n${rows.join("\n")}\n| cash | | | ${money(pos.cash)} | ${(pos.cash / value * 100).toFixed(1)}% |\n\nOpen items:${open_items.length ? `\n${open_items.join("\n")}` : " none."}\n`);
      await commit(r.worktree, `p1: the lots current to ${DATE} from the September fills, and the September review`);
      await new MemoryStore(options.repo, now).record({
        subject: "VNQ, 2 shares", note: "in the account since before the opening purchases; the custodian has no confirmation for it and nobody has given its basis — a person has to say what it is before anything trades it", evidence: [{ class: "file", ref: `positions/${DATE}.csv` }],
        unit: r.unitId, recordedBy: "S1", reviewBy: new Date(now() + 60 * DAY).toISOString(), scope: ["ingest-positions", "plan-rebalance", "review"],
      });
      return { summary: `applied ${applied} day(s) of fills to the lots, now current to ${DATE} and reconciled to the custodian; wrote reports/${PERIOD}.md with the time-weighted return ${((growth - 1) * 100).toFixed(2)}% over ${dates.join(" → ")}; VNQ stays an open item`, extra: {
        delegatedResults: [{ decisionId: "d-prose", choice: "one sentence; the numbers are the custodian's, the return chains the three exports with the 500.00 deposit valued on its day" }],
        residualUncertainty: [{ subject: "VNQ", reason: "no fill and no basis; a person has to say where it came from", consequenceIfWrong: "low" }],
      } };
    },
    "p2-propose-target": async (r) => {
      await write(r.worktree, `targets/${DATE}.json`, `${JSON.stringify({ asOf: DATE, band: BAND, weights: TARGET }, null, 2)}\n`);
      await commit(r.worktree, `p2: the September target, the benchmark tilted toward international equity`);
      return { summary: `wrote targets/${DATE}.json: VTI 0.36, VXUS 0.31, BND 0.33 with band ${BAND}; equity 0.67 against the benchmark's 0.65 and fixed income 0.33 against 0.35, inside the 0.05 tolerances`, extra: {
        delegatedResults: [{ decisionId: "d-inputs", choice: "the benchmark's weights as the equilibrium, with no view raised this period; tilted 0.06 toward international equity after its September fall, taken 0.04 from US equity and 0.02 from bonds" }],
      } };
    },
    "p3-plan-rebalance": async (r) => {
      const ledger = new ObligationLedger(options.repo, now);
      // A session learns an answer from its hint; the repair attempt's hint is the router's, so the stand-in also reads the
      // record the hint was built from: a consent obligation on this unit that a person resolved as accepted.
      const consented = /consent .*answered|answer(ed)?[^.]*\byes\b/i.test(r.hint ?? "")
        || (await ledger.obligations()).some((o) => o.unit === r.unitId && o.concern === "interaction" && o.status === "resolved" && o.disposition === "accepted");
      const { trades, realised, taxTotal, cashAfter } = await plan(r.worktree);
      if (!consented) {
        // What ask_human does headlessly: the question is owed before anyone could answer it, nobody is there, and the answer is recorded as unavailable.
        const question = `May I write trades/pending/${DATE}.json: ${realised.join("; ")}? Realised tax ${money(taxTotal)} in all; ${money(cashAfter)} cash left.`;
        const obligation = await ledger.openObligation({ subject: "consent: the September trade list", unit: r.unitId, concern: "interaction", sources: [`ask:${randomUUID()}`], severity: severityForKind("consent"), consumer: "human", blocks: true, question, openedBy: "S1" });
        const request = { id: randomUUID(), kind: "consent" as const, subject: "the September trade list", question, action: `write trades/pending/${DATE}.json with ${trades.length} trades`, severity: severityForKind("consent"), unit: r.unitId, attempt: r.attempt, obligationId: obligation.id, evidence: [{ class: "file" as const, ref: "lots/lots.csv", observation: "the lots each sell comes from, current to the export" }], raisedBy: "S1" as const, raisedAt: stamp(), timeoutMs: options.interaction?.timeoutsMs.consent ?? 0, channel: "none" as const };
        await ledger.requestInteraction(request, "S1");
        await ledger.answerInteraction({ requestId: request.id, outcome: "unavailable", by: "S1", channel: "none" });
        return { summary: "asked for consent to the September trade list, naming every trade, its lots and its tax; no one answered, nothing was written", extra: { residualUncertainty: [{ subject: "consent", reason: "the question is owed to a person", consequenceIfWrong: "high" }] } };
      }
      // Attempt 1 asked and paused; the first attempt that writes is the second. The careless one takes its shortcuts there.
      const careless = options.behaviour === "careless" && r.attempt === 2;
      const list = careless
        ? [
          // Past the target: four more VTI than the overweight is worth, so VTI crosses to under.
          { ticker: "VTI", side: "sell" as const, shares: 4, lots: [{ lot: "2025-03-14-VTI", shares: 4 }] },
          // From a lot the portfolio does not hold: 2 September bought BND and VXUS, never VTI.
          { ticker: "VTI", side: "sell" as const, shares: 1, lots: [{ lot: "2026-09-02-VTI", shares: 1 }] },
          // A wash sale: the older BND lot is at a loss, and the 2 September fill is inside the window.
          { ticker: "BND", side: "sell" as const, shares: 6, lots: [{ lot: "2025-03-14-BND", shares: 6 }] },
          { ticker: "VXUS", side: "buy" as const, shares: 36 },
        ]
        : trades;
      await write(r.worktree, `trades/pending/${DATE}.json`, `${JSON.stringify({ date: DATE, trades: list }, null, 2)}\n`);
      await commit(r.worktree, careless ? "p3: the September trade list" : "p3: the September trade list under trades/pending/, after consent");
      if (careless) return { summary: "consent given; wrote the September trade list" };
      return { summary: `consent given; wrote trades/pending/${DATE}.json: ${realised.join("; ")}; realised tax ${money(taxTotal)}`, extra: {
        delegatedResults: [
          { decisionId: "d-lots", choice: "VTI from the 2025 lot (a long-term gain; the only lot); BND from the 2 September lot — the 2025 lot is at a loss, but selling it inside the window of that fill would be a wash sale, so the short-term gain is the clean one", rationale: realised.filter((l) => l.startsWith("sell")).join("; ") },
          { decisionId: "d-extent", choice: "all the way to the target on the two overweights, in whole shares; the underweight lands inside the band with the cash that frees, nothing more is sold to reach it", rationale: `tax ${money(taxTotal)} either way: the extra sells would be from the same lots` },
        ],
      } };
    },
    "p4-review": async () => ({ summary: `read lots/, targets/${DATE}.json, trades/pending/${DATE}.json and reports/${PERIOD}.md against the ${DATE} export: the lots hold what the custodian holds, the target is inside every subset tolerance, the list lands every position inside the band and sells only from held lots with no wash sale, and the return is the positions' own. One open item: VNQ, 2 shares, carried.`, extra: { evidence: [{ class: "test", ref: "run_tests", observation: "the portfolio's suite passes; the host's run is the evidence" }] } }),
  };

  return async (r) => {
    const step = steps[r.unitId];
    if (!step) throw new Error(`the scripted manager knows no unit "${r.unitId}"`);
    const { summary, extra } = await step(r);
    await store.writeReport(reportFor(r.contract, r.attempt, summary, stamp(), extra));
    return {};
  };
}
