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

/**
 * The person's harvest inputs (harvest.json): the trading cost of a leg as a fraction of its value, and the annualised
 * volatility of a replacement's return against the fund it replaces, which the opportunity cost of holding the
 * replacement through the wash-sale window is priced from. Numbers a person fixes; a unit never writes the file.
 */
export function harvest() {
  const h = json("harvest.json");
  for (const key of ["tradingCostRate", "trackingVolatility"]) {
    if (typeof h[key] !== "number" || !(h[key] >= 0)) throw new Error(`harvest.json: ${key} is not a non-negative number`);
  }
  return h;
}

/** The exchangeable set a ticker belongs to, or undefined when no set names it. */
export function setOf(sets, ticker) {
  return sets.find((s) => s.tickers.includes(ticker));
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

/**
 * The tax-lot ledger: the open lots, the date it is current to, and the wash sales the executed trades forced on it.
 * A lot carries its fill price as `costPerShare` and, when a loss sale of its ticker inside the wash-sale window was
 * disallowed against it, the disallowed loss as `basisAdjustment` (cents, added to the lot's basis) with the closed
 * lot(s) it came from in `washedFrom`; `lots.json` lists every such wash sale, which is how a closed lot is marked.
 */
export function lots() {
  const summary = json("lots/lots.json");
  const open = parseCsv(readFileSync(path.join(ROOT, "lots", "lots.csv"), "utf8")).map((row) => ({
    lot: row.lot, ticker: row.ticker, acquired: row.acquired, shares: shares(row.shares), costPerShare: cents(row.costPerShare),
    basisAdjustment: cents(row.basisAdjustment || "0"), washedFrom: row.washedFrom ? row.washedFrom.split("+") : [],
  }));
  const washSales = (summary.washSales ?? []).map((w) => ({ lot: w.lot, soldOn: w.soldOn, shares: shares(w.shares), disallowed: cents(w.disallowed), replacement: w.replacement }));
  return { asOf: summary.asOf, open, washSales };
}

/** The columns of lots.csv, in order. */
export const LOT_COLUMNS = ["lot", "ticker", "acquired", "shares", "costPerShare", "basisAdjustment", "washedFrom"];

/** lots.csv as the ledger writes it: one row per open lot, sorted by lot id, the adjustment columns empty when none. */
export function renderLotsCsv(open) {
  const rows = [...open].sort((a, b) => a.lot.localeCompare(b.lot)).map((l) => [l.lot, l.ticker, l.acquired, l.shares, money(l.costPerShare), l.basisAdjustment ? money(l.basisAdjustment) : "", (l.washedFrom ?? []).join("+")].join(","));
  return `${LOT_COLUMNS.join(",")}\n${rows.join("\n")}\n`;
}

/** lots.json as the ledger writes it: the date it is current to and the wash sales the fills forced, each marking a closed lot. */
export function renderLotsJson({ asOf, washSales = [] }) {
  const marks = washSales.map((w) => `    { "lot": "${w.lot}", "soldOn": "${w.soldOn}", "shares": ${w.shares}, "disallowed": "${money(w.disallowed)}", "replacement": "${w.replacement}" }`);
  return `{\n  "asOf": "${asOf}",\n  "note": "The date the ledger is current to: every executed trade through it is applied, the open lots reconcile to the custodian's export of that date, and washSales lists every loss sale a buy of the same ticker inside the wash-sale window disallowed in part or whole — the disallowed loss is the replacement lot's basisAdjustment in lots.csv, and the sold lot is marked here.",\n  "washSales": [${marks.length ? `\n${marks.join(",\n")}\n  ` : ""}]\n}\n`;
}

/** A lot's basis for `n` of its shares, in cents: the fill price times the shares, plus its share of any disallowed loss carried in. */
export function basisOf(lot, n = lot.shares) {
  const adjustment = lot.basisAdjustment ?? 0;
  return lot.costPerShare * n + (n === lot.shares ? adjustment : Math.round((adjustment * n) / lot.shares));
}

/** The person's record of what was traded, in date order; each file is one day's fills. */
export function executedTrades() {
  const dir = path.join(ROOT, "trades", "executed");
  return readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => ({ file: `trades/executed/${f}`, ...JSON.parse(readFileSync(path.join(dir, f), "utf8")) }));
}

/**
 * The kinds of trade list the checks know. A `rebalance` list (`<date>.json`, the default when a list says nothing)
 * moves positions toward a target and is judged by the band, ticker by ticker. A `harvest` list
 * (`harvest-plan-<date>.json`) sells lots at a loss and buys their replacements from the same exchangeable set, and
 * is judged by the harvest rules, set by set; the band test ticker by ticker would refuse the very swap it exists for.
 */
export const LIST_KINDS = ["rebalance", "harvest"];

/** A list's kind: what it says, or `rebalance` when it says nothing. Anything else is a fault in the file. */
export function kindOf(list) {
  const kind = list.kind ?? "rebalance";
  if (!LIST_KINDS.includes(kind)) throw new Error(`${list.file}: kind "${kind}" is none of ${LIST_KINDS.join(", ")}`);
  return kind;
}

/** The kind a list's file name says: `harvest-plan-<date>.json` is a harvest, `<date>.json` a rebalance. */
export function kindOfName(name) {
  return name.startsWith("harvest-plan-") ? "harvest" : "rebalance";
}

const LIST_NAME = /^(harvest-plan-)?\d{4}-\d{2}-\d{2}\.json$/;

function listsUnder(sub) {
  const dir = path.join(ROOT, "trades", sub);
  return readdirSync(dir).filter((f) => LIST_NAME.test(f)).sort().map((f) => ({ file: `trades/${sub}/${f}`, name: f, ...JSON.parse(readFileSync(path.join(dir, f), "utf8")) }));
}

/** Trade lists the household has agreed to execute, rebalance and harvest alike, in name order; each with its file and its name. */
export function pendingLists() {
  return listsUnder("pending");
}

/** Trade lists nobody has agreed to yet — `trades/proposed/<date>.json`, a program's rebalance, and `harvest-plan-<date>.json`, a harvest — in name order. */
export function proposedLists() {
  return listsUnder("proposed");
}

/** Every trade list the checks judge: the agreed ones and the proposed ones, each with its file. */
export function tradeLists() {
  return [...pendingLists(), ...proposedLists()];
}

/** The lists as the day trades them: one per name, the agreed copy standing for its proposed twin, since a pending list carries the proposed trades. */
export function distinctLists() {
  const seen = new Set();
  return tradeLists().filter((l) => !seen.has(l.name) && seen.add(l.name));
}

/** The rebalance lists dated a day, one per name: what a harvest planned the same day is planned after. */
export function rebalanceListsOn(date) {
  return distinctLists().filter((l) => kindOf(l) === "rebalance" && l.date === date);
}

/** Every other list dated inside the window of a list, one per name: what a harvest's trades are read against beside the lot history and the fills. */
export function otherListsWithin(list, windowDays) {
  return distinctLists().filter((l) => l.name !== list.name && Math.abs(daysBetween(l.date, list.date)) <= windowDays);
}

/** The positions a harvest starts from: the custodian's export of the date after the rebalance lists of that date, which it is planned after. */
export function harvestBaseline(date, px) {
  return rebalanceListsOn(date).reduce((pos, l) => applyTrades(pos, l.trades, px), positions(date));
}

/**
 * The lots a program found at an unrealised loss (`trades/proposed/harvest-<date>.json`), in date order: candidates
 * for a harvest, each naming the lot, its shares, its cost, the price and the loss. Not a trade list: nothing in one is
 * a trade until a harvest contract turns a candidate into a sell and a replacement from the ticker's set.
 */
export function harvestCandidates() {
  const dir = path.join(ROOT, "trades", "proposed");
  return readdirSync(dir).filter((f) => /^harvest-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().map((f) => ({ file: `trades/proposed/${f}`, ...JSON.parse(readFileSync(path.join(dir, f), "utf8")) }));
}

/** A lot's unrealised gain or loss at a price, in cents, against its basis (a disallowed loss carried in counts): negative is a loss. */
export function unrealised(lot, price) {
  return price * lot.shares - basisOf(lot);
}

/** A lot's id: the fill date and the ticker. One buy of a ticker per day is the custodian's convention and this ledger's. */
export function lotId(date, ticker) {
  return `${date}-${ticker}`;
}

/**
 * The lots the executed trades imply, replayed through a date: every buy opens a lot at its fill price; every sell
 * takes the shares it names from the lots it names. A sell naming a lot that does not exist, or more shares than it
 * holds, is a fault in the record and throws. The open lots alone; `replayLedger` carries the wash sales too.
 */
export function replayLots(throughDate, options = {}) {
  return replayLedger(throughDate, options).open;
}

/**
 * The ledger the executed trades imply, replayed through a date, with the wash-sale rule applied as the fills come:
 * when a sell realises a loss on a lot and shares of the same ticker were acquired inside the window — a lot bought
 * within the window before and still held after that day's sells, or a buy within the window after — the loss on as
 * many shares as were acquired is disallowed and added to the replacement lot's basis (`basisAdjustment`, with the
 * sold lot in `washedFrom`), each acquired share absorbing one sold share's loss, earliest acquisition first; the
 * sold lot is marked in `washSales`. A person may choose to wash a loss; the ledger then says so and carries the
 * basis forward, and nothing here judges the choice.
 */
export function replayLedger(throughDate, { before = false } = {}) {
  const { washSaleWindowDays } = tax();
  const days = executedTrades().filter((day) => (before ? day.date < throughDate : day.date <= throughDate));
  const open = new Map();
  const washSales = [];
  /** Replacement shares of a lot already matched to a disallowed loss: each acquired share absorbs one sold share. */
  const absorbed = new Map();
  /** Adjustments owed to lots a later fill opens. */
  const pending = new Map();
  const within = (a, b) => Math.abs(daysBetween(a, b)) <= washSaleWindowDays;
  const soldOn = (day, lotId) => day.trades.filter((t) => t.side === "sell").flatMap((t) => t.lots ?? []).filter((f) => f.lot === lotId).reduce((n, f) => n + shares(f.shares), 0);
  const capacity = (lotId, held) => Math.max(0, held - (absorbed.get(lotId) ?? 0));
  const absorb = (lotId, n) => absorbed.set(lotId, (absorbed.get(lotId) ?? 0) + n);
  for (const day of days) {
    for (const t of day.trades) {
      if (t.side === "buy") {
        const id = lotId(day.date, t.ticker);
        if (open.has(id)) throw new Error(`${day.file}: a second buy of ${t.ticker} on ${day.date}; one lot per ticker per day`);
        const owed = pending.get(id) ?? { adjustment: 0, from: [] };
        open.set(id, { lot: id, ticker: t.ticker, acquired: day.date, shares: shares(t.shares), costPerShare: cents(t.price), basisAdjustment: owed.adjustment, washedFrom: owed.from });
      } else if (t.side === "sell") {
        const price = cents(t.price);
        for (const from of t.lots ?? []) {
          const lot = open.get(from.lot);
          if (!lot || lot.ticker !== t.ticker) throw new Error(`${day.file}: sells ${t.ticker} from lot ${from.lot}, which the ledger does not hold`);
          const n = shares(from.shares);
          if (n > lot.shares) throw new Error(`${day.file}: sells ${from.shares} of lot ${from.lot}, which holds ${lot.shares}`);
          const gain = price * n - basisOf(lot, n);
          if (gain < 0) {
            // Replacement shares, earliest first: lots of the ticker bought inside the window and still held after this day's sells, then buys inside the window after.
            const replacements = [
              ...[...open.values()].filter((l) => l.ticker === t.ticker && l.lot !== lot.lot && within(l.acquired, day.date)).map((l) => ({ id: l.lot, date: l.acquired, free: capacity(l.lot, l.shares - soldOn(day, l.lot)), existing: l })),
              ...days.filter((d) => d.date > day.date && within(d.date, day.date)).flatMap((d) => d.trades.filter((b) => b.side === "buy" && b.ticker === t.ticker).map((b) => ({ id: lotId(d.date, b.ticker), date: d.date, free: capacity(lotId(d.date, b.ticker), shares(b.shares)) }))),
            ].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
            let unmatched = n;
            for (const r of replacements) {
              const matched = Math.min(unmatched, r.free);
              if (matched <= 0) continue;
              const disallowed = Math.round((-gain * matched) / n);
              absorb(r.id, matched);
              if (r.existing) { r.existing.basisAdjustment += disallowed; r.existing.washedFrom = [...r.existing.washedFrom, lot.lot]; }
              else { const owed = pending.get(r.id) ?? { adjustment: 0, from: [] }; pending.set(r.id, { adjustment: owed.adjustment + disallowed, from: [...owed.from, lot.lot] }); }
              washSales.push({ lot: lot.lot, soldOn: day.date, shares: matched, disallowed, replacement: r.id });
              unmatched -= matched;
              if (!unmatched) break;
            }
          }
          lot.basisAdjustment = n === lot.shares ? 0 : lot.basisAdjustment - Math.round((lot.basisAdjustment * n) / lot.shares);
          lot.shares -= n;
          if (lot.shares === 0) open.delete(from.lot);
        }
      } else throw new Error(`${day.file}: trade side "${t.side}" is neither buy nor sell`);
    }
  }
  return {
    open: [...open.values()].sort((a, b) => a.lot.localeCompare(b.lot)),
    washSales: washSales.sort((a, b) => a.soldOn.localeCompare(b.soldOn) || a.lot.localeCompare(b.lot) || a.replacement.localeCompare(b.replacement)),
  };
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
    const gain = price * shares(from.shares) - basisOf(lot, shares(from.shares));
    out.push({ lot: lot.lot, shares: shares(from.shares), gain, longTerm, tax: Math.round(gain * (longTerm ? taxRules.longTermRate : taxRules.shortTermRate)) });
  }
  return out;
}

/**
 * The wash sales a trade list would create, as problems (none means none). Under the declared window: a sale at a loss
 * of a ticker is a wash sale when shares of that ticker other than the ones sold were acquired within the window —
 * a lot the ledger holds that was opened within it, a buy of the same ticker in the list itself, a buy within the
 * window after among the fills, or a buy in another list of the window — and a buy is a wash sale when the fills, or
 * another list of the window, or this list itself, sold that ticker at a loss within the window, before or after.
 * The security is the ticker: tax.json defines the wash sale so, and a ticker's exchangeable set is not the same
 * ticker — a replacement from the set is what the set is for.
 *
 * With no options this is the rebalance list's rule, over the lot history and the fills alone. `options.lists` adds
 * the other lists of the window (`otherListsWithin`), and `options.sets` makes the check a harvest's, set by set: a
 * buy must come from the set of a ticker the list sells, never a ticker the list also sells (that re-entry is the
 * wash sale the sets exist to avoid, at a gain as at a loss), and a sell's ticker must be in a set at all.
 */
export function washSales(list, ledger, executed, px, windowDays, options = {}) {
  const { lists = [], sets } = options;
  const problems = [];
  const within = (date) => Math.abs(daysBetween(date, list.date)) <= windowDays;
  const soldShares = (trades) => (ticker) => trades.filter((t) => t.side === "sell" && t.ticker === ticker).reduce((s, t) => s + shares(t.shares), 0);
  const boughtShares = (trades) => (ticker) => trades.filter((t) => t.side === "buy" && t.ticker === ticker).reduce((s, t) => s + shares(t.shares), 0);
  /** What the day's lists take from each lot, this one and the others: shares sold are not replacement shares. */
  const soldFrom = new Map();
  for (const l of [list, ...lists]) for (const t of l.trades) if (t.side === "sell") for (const f of t.lots ?? []) soldFrom.set(f.lot, (soldFrom.get(f.lot) ?? 0) + shares(f.shares));
  const lossLotsOf = (trade, held, price) => (trade.lots ?? []).filter((f) => { const lot = held.find((l) => l.lot === f.lot); return lot && price * shares(f.shares) < basisOf(lot, shares(f.shares)); });
  const soldTickers = new Set(list.trades.filter((t) => t.side === "sell").map((t) => t.ticker));

  for (const t of list.trades) {
    if (t.side === "sell") {
      const price = priceOf(px, t.ticker, list.date);
      const atLoss = lossLotsOf(t, ledger, price);
      if (sets && !setOf(sets, t.ticker)) problems.push(`${list.file}: sells ${t.ticker}, which no set in universe.json names: a harvest exchanges within a set, and a lot outside every set is deferred, not sold`);
      if (!atLoss.length) continue;
      const sources = [];
      const inLedger = ledger.filter((l) => l.ticker === t.ticker && within(l.acquired)).reduce((s, l) => s + Math.max(0, l.shares - (soldFrom.get(l.lot) ?? 0)), 0);
      if (inLedger) sources.push(`${inLedger} held from a lot bought within the window`);
      const inList = boughtShares(list.trades)(t.ticker);
      if (inList) sources.push(`${inList} bought in this list`);
      for (const other of lists) { const n = boughtShares(other.trades)(t.ticker); if (n) sources.push(`${n} bought by ${other.file} on ${other.date}`); }
      for (const day of executed) if (day.date > list.date && within(day.date)) { const n = boughtShares(day.trades)(t.ticker); if (n) sources.push(`${n} bought on ${day.date} (${day.file})`); }
      if (sources.length) problems.push(`${list.file}: selling ${t.ticker} from ${atLoss.map((f) => f.lot).join(", ")} at a loss is a wash sale: other share(s) of ${t.ticker} acquired within ${windowDays} days of ${list.date} — ${sources.join("; ")}`);
    } else if (t.side === "buy") {
      if (sets) {
        const set = setOf(sets, t.ticker);
        if (!set) problems.push(`${list.file}: buys ${t.ticker}, which no set in universe.json names`);
        else if (soldTickers.has(t.ticker)) problems.push(`${list.file}: buys ${t.ticker} and sells it: a replacement is another ticker of the ${set.name} set, never the one sold`);
        else if (![...soldTickers].some((sold) => set.tickers.includes(sold))) problems.push(`${list.file}: buys ${t.ticker} and sells nothing of the ${set.name} set: a harvest exchanges within a set`);
      }
      for (const day of executed) {
        if (!within(day.date)) continue;
        const held = replayLots(day.date, { before: true });
        for (const e of day.trades) {
          if (e.side !== "sell" || e.ticker !== t.ticker) continue;
          const lossLots = lossLotsOf(e, held, cents(e.price));
          if (lossLots.length) problems.push(`${list.file}: buying ${t.ticker} is a wash sale: ${day.file} sold it at a loss from ${lossLots.map((f) => f.lot).join(", ")} ${Math.abs(daysBetween(day.date, list.date))} day(s) ${day.date <= list.date ? "before" : "after"}`);
        }
      }
      for (const other of lists) {
        const otherPx = prices(other.date);
        for (const e of other.trades) {
          if (e.side !== "sell" || e.ticker !== t.ticker) continue;
          const lossLots = lossLotsOf(e, ledger, priceOf(otherPx, e.ticker, other.date));
          if (lossLots.length) problems.push(`${list.file}: buying ${t.ticker} is a wash sale: ${other.file} sells it at a loss from ${lossLots.map((f) => f.lot).join(", ")} on ${other.date}`);
        }
      }
    }
  }
  return problems;
}

// ---------------------------------------------------------------- harvesting

/** The expected shortfall of a zero-mean normal variable, per unit of its standard deviation: 1/√(2π). */
export const OPTION_FACTOR = 1 / Math.sqrt(2 * Math.PI);

/** One leg's trading cost, in cents: the leg's value times the person's rate (harvest.json). */
export function tradingCost(value, rate) {
  return Math.round(value * rate);
}

/**
 * The opportunity cost of holding a replacement in place of the fund sold until the window closes, in cents: an
 * at-the-money option on the tracking difference — the value, times the annualised tracking volatility, times the
 * square root of the window in years, times 1/√(2π), the expected shortfall of a normal tracking difference. The
 * volatility is the person's number (harvest.json); the window is tax.json's.
 */
export function opportunityCost(value, volatility, windowDays) {
  return Math.round(value * volatility * Math.sqrt(windowDays / 365) * OPTION_FACTOR);
}

/**
 * Whether a lot is worth harvesting at a price on a date, by the person's arithmetic: the tax benefit of the loss at
 * the rate its holding period earns, against the trading cost of both legs (each on the lot's value, since the
 * replacement leg is within a share of it) and the opportunity cost of the window. Everything in cents; `net` is the
 * benefit less both costs, and a harvest is worth it when `net` is positive.
 */
export function harvestEvaluation(lot, price, onDate, taxRules, inputs) {
  const value = price * lot.shares;
  const loss = unrealised(lot, price);
  const longTerm = daysBetween(lot.acquired, onDate) > taxRules.longTermAfterDays;
  const benefit = loss < 0 ? Math.round(-loss * (longTerm ? taxRules.longTermRate : taxRules.shortTermRate)) : 0;
  const trading = 2 * tradingCost(value, inputs.tradingCostRate);
  const opportunity = opportunityCost(value, inputs.trackingVolatility, taxRules.washSaleWindowDays);
  return { value, loss, longTerm, benefit, tradingCost: trading, opportunityCost: opportunity, net: benefit - trading - opportunity };
}

/** Why a candidate is not harvested: the closed list of reasons a harvest list may give for a candidate it leaves. */
export const HARVEST_REASONS = ["benefit below costs", "blocked by a recent buy", "no replacement available"];

/**
 * The tickers that could replace a sold one: the others of its set, less any the list sells and any sold at a loss
 * inside the window by the fills or by another list of the window (buying one back would be a wash sale).
 */
export function replacementsFor(ticker, { list, lists = [], executed, ledger, sets, windowDays, date }) {
  const set = setOf(sets, ticker);
  if (!set) return [];
  const soldTickers = new Set(list.trades.filter((t) => t.side === "sell").map((t) => t.ticker));
  const within = (d) => Math.abs(daysBetween(d, date)) <= windowDays;
  const soldAtLossRecently = (candidate) => {
    for (const day of executed) {
      if (!within(day.date)) continue;
      const held = replayLots(day.date, { before: true });
      for (const e of day.trades) if (e.side === "sell" && e.ticker === candidate && (e.lots ?? []).some((f) => { const lot = held.find((l) => l.lot === f.lot); return lot && cents(e.price) * shares(f.shares) < basisOf(lot, shares(f.shares)); })) return true;
    }
    for (const other of lists) {
      const otherPx = prices(other.date);
      for (const e of other.trades) if (e.side === "sell" && e.ticker === candidate && (e.lots ?? []).some((f) => { const lot = ledger.find((l) => l.lot === f.lot); return lot && priceOf(otherPx, candidate, other.date) * shares(f.shares) < basisOf(lot, shares(f.shares)); })) return true;
    }
    return false;
  };
  return set.tickers.filter((t) => t !== ticker && !soldTickers.has(t) && !soldAtLossRecently(t));
}

/**
 * Every reason, of the closed list, why a candidate lot is not harvested by a list, given the list as it stands: the
 * benefit does not cover the costs; shares of its ticker were acquired inside the window beyond what the day's lists
 * sell (the lot itself counts as sold); or nothing in its set can replace it. Empty means the lot is harvestable.
 * The planner and the check share this: a planner leaves a candidate for the first reason, and the check holds the
 * stated reason to be one of these.
 */
export function harvestObstacles(lot, context) {
  const { list, lists = [], executed, ledger, sets, taxRules, inputs, px, date } = context;
  const windowDays = taxRules.washSaleWindowDays;
  const price = priceOf(px, lot.ticker, date);
  const out = [];
  const evaluation = harvestEvaluation(lot, price, date, taxRules, inputs);
  if (evaluation.net <= 0) out.push({ reason: HARVEST_REASONS[0], detail: `benefit ${money(evaluation.benefit)} against trading cost ${money(evaluation.tradingCost)} and opportunity cost ${money(evaluation.opportunityCost)}` });
  const within = (d) => Math.abs(daysBetween(d, date)) <= windowDays;
  const soldFrom = new Map([[lot.lot, lot.shares]]);
  for (const l of [list, ...lists]) for (const t of l.trades) if (t.side === "sell") for (const f of t.lots ?? []) soldFrom.set(f.lot, (soldFrom.get(f.lot) ?? 0) + shares(f.shares));
  const sources = [];
  const inLedger = ledger.filter((l) => l.ticker === lot.ticker && within(l.acquired)).reduce((s, l) => s + Math.max(0, l.shares - (soldFrom.get(l.lot) ?? 0)), 0);
  if (inLedger) sources.push(`${inLedger} held from a lot bought within ${windowDays} days`);
  for (const l of [list, ...lists]) { const n = l.trades.filter((t) => t.side === "buy" && t.ticker === lot.ticker).reduce((s, t) => s + shares(t.shares), 0); if (n) sources.push(`${n} bought by ${l.file}`); }
  for (const day of executed) if (day.date > date && within(day.date)) { const n = day.trades.filter((t) => t.side === "buy" && t.ticker === lot.ticker).reduce((s, t) => s + shares(t.shares), 0); if (n) sources.push(`${n} bought on ${day.date}`); }
  if (sources.length) out.push({ reason: HARVEST_REASONS[1], detail: sources.join("; ") });
  const replacements = replacementsFor(lot.ticker, { list, lists, executed, ledger, sets, windowDays, date });
  if (!replacements.length) out.push({ reason: HARVEST_REASONS[2], detail: setOf(sets, lot.ticker) ? `every other ticker of the ${setOf(sets, lot.ticker).name} set is sold here or was sold at a loss within ${windowDays} days` : `no set in universe.json names ${lot.ticker}; deferred` });
  return out;
}

/** Each set's weight of the whole portfolio: the sum over its tickers. */
export function setWeights(pos, px, sets) {
  const w = weights(pos, px);
  return new Map(sets.map((s) => [s.name, s.tickers.reduce((sum, t) => sum + (w.get(t) ?? 0), 0)]));
}

/** Each set's share of a target: the sum of the target weights of its tickers. */
export function setTargets(targetWeights, sets) {
  return new Map(sets.map((s) => [s.name, s.tickers.reduce((sum, t) => sum + (targetWeights.get(t) ?? 0), 0)]));
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

// ---------------------------------------------------------------- turnover

/**
 * The one-way turnover a target implies against the current weights: half the sum, over the target's tickers, of the
 * absolute gap between the target weight and the current one — the fraction of the portfolio's value a rebalance to
 * the target would trade, each dollar counted once. A position the target does not name is not traded and does not
 * count. A pure function of two weight maps; the workload's turnover grader reads it.
 */
export function turnover(targetWeights, currentWeights) {
  let gap = 0;
  for (const [ticker, w] of targetWeights) gap += Math.abs(w - (currentWeights.get(ticker) ?? 0));
  return gap / 2;
}
