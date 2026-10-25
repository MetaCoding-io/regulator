/**
 * The portfolio's own vocabulary: how its files are read, and the arithmetic
 * the checks under test/ apply to them. Used by the checks and by nothing the
 * harness dispatches — a unit reads and writes the files, and these functions
 * decide whether it did so correctly.
 *
 * Money is held in cents as integers; a price has two decimals and a share
 * count is whole, so a holding's value is exact. Weights are the one place a
 * fraction appears, and every comparison of weights states its tolerance.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../", import.meta.url));

const DAY = 86_400_000;

function parseCsv(text) {
  const [header, ...lines] = text.trim().split("\n");
  const keys = header.split(",");
  return lines.filter(Boolean).map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(keys.map((k, i) => [k, (cells[i] ?? "").trim()]));
  });
}

function json(file) {
  return JSON.parse(readFileSync(path.join(ROOT, file), "utf8"));
}

export function cents(amount) {
  const n = Math.round(Number(amount) * 100);
  if (!Number.isInteger(n)) throw new Error(`"${amount}" is not an amount`);
  return n;
}

export function money(c) {
  return `${c < 0 ? "-" : ""}${Math.trunc(Math.abs(c) / 100)}.${String(Math.abs(c) % 100).padStart(2, "0")}`;
}

export function shares(n) {
  const s = Number(n);
  if (!Number.isInteger(s) || s < 0) throw new Error(`"${n}" is not a share count`);
  return s;
}

/** Whole days from one ISO date to another. */
export function daysBetween(from, to) {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY);
}

// ---------------------------------------------------------------- the person's files

/** The ETFs the portfolio may hold, grouped into sets the person considers exchangeable but not substantially identical. */
export function universe() {
  const u = json("universe.json");
  return { ...u, tickers: u.sets.flatMap((s) => s.tickers) };
}

/** Rates, the long-term cutoff, the wash-sale window, the jurisdiction. */
export function tax() {
  return json("tax.json");
}

/** The reference weights, the subsets a target holds within a tolerance of them, and the rebalance band. */
export function benchmark() {
  return json("benchmark.json");
}

/** The rebalance band: the person's number in benchmark.json, the maximum deviation any targeted position lands at after a rebalance. */
export function band() {
  return benchmark().band;
}

// ---------------------------------------------------------------- the custodian's files

/** Dates with a positions export: `["2026-07-31", "2026-08-31", …]`. */
export function positionDates() {
  return readdirSync(path.join(ROOT, "positions")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, 10)).sort();
}

/**
 * One export: the holdings as `Map<ticker, shares>`, the cash, and the external flows (deposits less withdrawals) that
 * landed on the export's date and are inside its cash. The custodian exports on the day a flow lands, so a flow is
 * always valued on its own day.
 */
export function positions(date) {
  const summary = json(`positions/${date}.json`);
  const holdings = new Map();
  for (const row of parseCsv(readFileSync(path.join(ROOT, "positions", `${date}.csv`), "utf8"))) holdings.set(row.ticker, shares(row.shares));
  return { date, account: summary.account, holdings, cash: cents(summary.cash), externalFlows: cents(summary.externalFlows ?? "0") };
}

/** The closing prices on a date, as `Map<ticker, cents>`. */
export function prices(date) {
  const out = new Map();
  for (const row of parseCsv(readFileSync(path.join(ROOT, "prices", `${date}.csv`), "utf8"))) out.set(row.ticker, cents(row.price));
  return out;
}

function priceOf(px, ticker, date) {
  const p = px.get(ticker);
  if (p === undefined) throw new Error(`prices/${date}.csv carries no price for ${ticker}`);
  return p;
}

/** The value of each holding and of the whole, in cents. */
export function valuation(pos, px) {
  const values = new Map();
  let total = pos.cash;
  for (const [ticker, n] of pos.holdings) {
    const v = n * priceOf(px, ticker, pos.date);
    values.set(ticker, v);
    total += v;
  }
  return { values, total };
}

/** Each holding's weight of the whole portfolio, cash and all. */
export function weights(pos, px) {
  const { values, total } = valuation(pos, px);
  return new Map([...values].map(([ticker, v]) => [ticker, v / total]));
}

// ---------------------------------------------------------------- targets

export function targetDates() {
  return readdirSync(path.join(ROOT, "targets")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, 10)).sort();
}

/** A target: the weights by ticker. The band it is rebalanced within is the benchmark's, not the target's. */
export function target(date) {
  const t = json(`targets/${date}.json`);
  return { ...t, weights: new Map(Object.entries(t.weights)) };
}

// ---------------------------------------------------------------- lots and trades

/** The tax-lot ledger: the open lots and the date it is current to. */
export function lots() {
  const summary = json("lots/lots.json");
  const open = parseCsv(readFileSync(path.join(ROOT, "lots", "lots.csv"), "utf8")).map((row) => ({ lot: row.lot, ticker: row.ticker, acquired: row.acquired, shares: shares(row.shares), costPerShare: cents(row.costPerShare) }));
  return { asOf: summary.asOf, open };
}

/** The person's record of what was traded, in date order; each file is one day's fills. */
export function executedTrades() {
  const dir = path.join(ROOT, "trades", "executed");
  return readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => ({ file: `trades/executed/${f}`, ...JSON.parse(readFileSync(path.join(dir, f), "utf8")) }));
}

/** Trade lists the household has agreed to execute, in date order. */
export function pendingLists() {
  const dir = path.join(ROOT, "trades", "pending");
  return readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => ({ file: `trades/pending/${f}`, ...JSON.parse(readFileSync(path.join(dir, f), "utf8")) }));
}

/** A lot's id: the fill date and the ticker. One buy of a ticker per day is the custodian's convention and this ledger's. */
export function lotId(date, ticker) {
  return `${date}-${ticker}`;
}

/**
 * The lots the executed trades imply, replayed through a date: every buy opens a lot at its fill price; every sell
 * takes the shares it names from the lots it names. A sell naming a lot that does not exist, or more shares than it
 * holds, is a fault in the record and throws.
 */
export function replayLots(throughDate, { before = false } = {}) {
  const open = new Map();
  for (const day of executedTrades()) {
    if (before ? day.date >= throughDate : day.date > throughDate) continue;
    for (const t of day.trades) {
      if (t.side === "buy") {
        const id = lotId(day.date, t.ticker);
        if (open.has(id)) throw new Error(`${day.file}: a second buy of ${t.ticker} on ${day.date}; one lot per ticker per day`);
        open.set(id, { lot: id, ticker: t.ticker, acquired: day.date, shares: shares(t.shares), costPerShare: cents(t.price) });
      } else if (t.side === "sell") {
        for (const from of t.lots ?? []) {
          const lot = open.get(from.lot);
          if (!lot || lot.ticker !== t.ticker) throw new Error(`${day.file}: sells ${t.ticker} from lot ${from.lot}, which the ledger does not hold`);
          if (shares(from.shares) > lot.shares) throw new Error(`${day.file}: sells ${from.shares} of lot ${from.lot}, which holds ${lot.shares}`);
          lot.shares -= shares(from.shares);
          if (lot.shares === 0) open.delete(from.lot);
        }
      } else throw new Error(`${day.file}: trade side "${t.side}" is neither buy nor sell`);
    }
  }
  return [...open.values()].sort((a, b) => a.lot.localeCompare(b.lot));
}

/** The holdings after a trade list, and the cash: sells add proceeds, buys spend, at the date's prices. */
export function applyTrades(pos, trades, px) {
  const holdings = new Map(pos.holdings);
  let cash = pos.cash;
  for (const t of trades) {
    const n = shares(t.shares);
    const amount = n * priceOf(px, t.ticker, pos.date);
    if (t.side === "buy") { holdings.set(t.ticker, (holdings.get(t.ticker) ?? 0) + n); cash -= amount; }
    else if (t.side === "sell") { holdings.set(t.ticker, (holdings.get(t.ticker) ?? 0) - n); cash += amount; }
    else throw new Error(`trade side "${t.side}" is neither buy nor sell`);
  }
  for (const [ticker, n] of holdings) if (n === 0) holdings.delete(ticker);
  return { ...pos, holdings, cash };
}

/** Each sell's gain or loss per lot it names, at a price, and the tax it realises under the declared rates. */
export function realised(trade, price, openLots, taxRules, onDate) {
  const out = [];
  for (const from of trade.lots ?? []) {
    const lot = openLots.find((l) => l.lot === from.lot);
    if (!lot) continue;
    const held = daysBetween(lot.acquired, onDate);
    const longTerm = held > taxRules.longTermAfterDays;
    const gain = (price - lot.costPerShare) * shares(from.shares);
    out.push({ lot: lot.lot, shares: shares(from.shares), gain, longTerm, tax: Math.round(gain * (longTerm ? taxRules.longTermRate : taxRules.shortTermRate)) });
  }
  return out;
}

/**
 * The wash sales a trade list would create, as problems (none means none). Under the declared window: a sale at a loss
 * of a ticker is a wash sale when shares of that ticker other than the ones sold were acquired within the window —
 * a lot the ledger holds that was opened within it, or a buy of the same ticker in the list itself; and a buy is a wash
 * sale when the executed record shows a loss sale of that ticker within the window before the list's date. A ticker's
 * exchangeable set is not the same ticker: a replacement from the set is what the set is for.
 */
export function washSales(list, ledger, executed, px, windowDays) {
  const problems = [];
  const within = (date) => Math.abs(daysBetween(date, list.date)) <= windowDays;
  const boughtInList = (ticker) => list.trades.filter((t) => t.side === "buy" && t.ticker === ticker).reduce((s, t) => s + shares(t.shares), 0);
  for (const t of list.trades) {
    if (t.side === "sell") {
      const price = priceOf(px, t.ticker, list.date);
      const sold = new Map((t.lots ?? []).map((f) => [f.lot, shares(f.shares)]));
      const atLoss = (t.lots ?? []).filter((f) => { const lot = ledger.find((l) => l.lot === f.lot); return lot && price < lot.costPerShare; });
      if (!atLoss.length) continue;
      const replacement = ledger.filter((l) => l.ticker === t.ticker && within(l.acquired)).reduce((s, l) => s + l.shares - (sold.get(l.lot) ?? 0), 0) + boughtInList(t.ticker);
      if (replacement > 0) problems.push(`${list.file}: selling ${t.ticker} from ${atLoss.map((f) => f.lot).join(", ")} at a loss is a wash sale: ${replacement} other share(s) of ${t.ticker} acquired within ${windowDays} days of ${list.date}`);
    } else if (t.side === "buy") {
      for (const day of executed) {
        if (!within(day.date) || day.date > list.date) continue;
        const held = replayLots(day.date, { before: true });
        for (const e of day.trades) {
          if (e.side !== "sell" || e.ticker !== t.ticker) continue;
          const lossLots = (e.lots ?? []).filter((f) => { const lot = held.find((l) => l.lot === f.lot); return lot && cents(e.price) < lot.costPerShare; });
          if (lossLots.length) problems.push(`${list.file}: buying ${t.ticker} is a wash sale: ${day.file} sold it at a loss from ${lossLots.map((f) => f.lot).join(", ")} ${daysBetween(day.date, list.date)} day(s) before`);
        }
      }
    }
  }
  return problems;
}

// ---------------------------------------------------------------- returns and reports

/** The export dates a period's return runs over: the last export before the period, then every export inside it. */
export function periodDates(period) {
  const dates = positionDates();
  const before = dates.filter((d) => d < `${period}-01`);
  const inside = dates.filter((d) => d.startsWith(period));
  if (!before.length || !inside.length) throw new Error(`${period}: no export before the period, or none inside it; its return cannot be measured`);
  return [before[before.length - 1], ...inside];
}

/**
 * The time-weighted return over consecutive exports: each sub-period's growth is its end value less the flow that
 * landed that day, over its start value; the sub-periods chain. A flow neither earns nor loses return of its own.
 */
export function timeWeightedReturn(dates) {
  let growth = 1;
  for (let i = 1; i < dates.length; i++) {
    const start = valuation(positions(dates[i - 1]), prices(dates[i - 1])).total;
    const end = positions(dates[i]);
    growth *= (valuation(end, prices(dates[i])).total - end.externalFlows) / start;
  }
  return growth - 1;
}

/** A return as the report prints it: a percentage to two decimals. */
export function percent(r) {
  return `${(r * 100).toFixed(2)}%`;
}

export function reportPeriods() {
  return readdirSync(path.join(ROOT, "reports")).filter((f) => /^\d{4}-\d{2}\.md$/.test(f)).map((f) => f.slice(0, 7)).sort();
}

function reportText(period) {
  return readFileSync(path.join(ROOT, "reports", `${period}.md`), "utf8");
}

/** The return a report states, as printed. */
export function reportReturn(period) {
  return /^Time-weighted return: (-?\d+\.\d{2}%)\.?$/m.exec(reportText(period))?.[1];
}

/** The lines under the report's "Open items" heading: what the period carries forward rather than settles. */
export function reportOpenItems(period) {
  const after = reportText(period).split(/^Open items:/m)[1] ?? "";
  return after.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("- "));
}

export function hasReport(period) {
  return existsSync(path.join(ROOT, "reports", `${period}.md`));
}
