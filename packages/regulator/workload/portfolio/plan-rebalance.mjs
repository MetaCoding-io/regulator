/**
 * The portfolio workload's `plan-rebalance` program (#122): the unit type's
 * declared command, run by the control plane in the unit's worktree with no
 * session and no model. It reads the tree through the portfolio's own
 * library — the latest custodian's export, the latest target on or before
 * it, the lots, the tax parameters — and writes the trade list that moves
 * every targeted position toward its target at that date's prices to
 * `trades/proposed/<date>.json`: a list a program computed, not yet agreed.
 * Nothing is written under `trades/pending/`; consent and that copy are the
 * confirm unit's, a session that asks a person once about every trade.
 *
 * The arithmetic, as the contract fixes it:
 *   - an overweight is sold down to its target in whole shares, never past it;
 *   - each sell comes from the lots in the tax ordering — a loss before a
 *     gain, a long-term gain before a short-term one — and never from a loss
 *     lot whose sale would be a wash sale against another lot of the ticker
 *     acquired inside the window; a sell that cannot be filled from clean
 *     lots is filled as far as they go;
 *   - an underweight is bought with the cash the sells free and the cash on
 *     hand, toward its target and not past it, in whole shares;
 *   - a position the target does not name is not traded.
 *
 * Every sell carries, per lot, the gain or loss and the tax it realises, so
 * the confirm unit's question can name them. The last line of stdout is the
 * unit's report. The program decides nothing the host trusts: the suite
 * under test/ judges the list it wrote at closeout, as it judges any list.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const lib = await import(pathToFileURL(path.resolve("lib/portfolio.js")).href);

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const dates = lib.positionDates();
const latest = dates[dates.length - 1];
const targets = lib.targetDates().filter((d) => d <= latest);
if (!targets.length) fail(`no target under targets/ on or before ${latest}: nothing to rebalance toward`);
const date = targets[targets.length - 1];
if (!dates.includes(date)) fail(`targets/${date}.json has no positions export of its date to plan against`);
const ledger = lib.lots();
if (ledger.asOf !== date) fail(`lots/ are current to ${ledger.asOf}, not to ${date}: ingest the fills first`);

const t = lib.target(date);
const pos = lib.positions(date);
const px = lib.prices(date);
const taxRules = lib.tax();
const { total } = lib.valuation(pos, px);
const w = lib.weights(pos, px);
const priceOf = (ticker) => {
  const p = px.get(ticker);
  if (p === undefined) fail(`prices/${date}.csv carries no price for ${ticker}`);
  return p;
};
const inWindow = (lot) => Math.abs(lib.daysBetween(lot.acquired, date)) <= taxRules.washSaleWindowDays;
const longTerm = (lot) => lib.daysBetween(lot.acquired, date) > taxRules.longTermAfterDays;

const trades = [];
const said = [];
let taxTotal = 0;
let cash = pos.cash;

// Sells first: each overweight down to its target, from the lots the ordering and the window allow.
for (const [ticker, target] of t.weights) {
  const price = priceOf(ticker);
  let wanted = Math.floor((((w.get(ticker) ?? 0) - target) * total) / price);
  if (wanted <= 0) continue;
  const held = ledger.open.filter((l) => l.ticker === ticker);
  const clean = held.filter((l) => !(price < l.costPerShare && held.some((o) => o.lot !== l.lot && inWindow(o))));
  const rank = (l) => (price < l.costPerShare ? 0 : longTerm(l) ? 1 : 2);
  const from = [];
  for (const lot of [...clean].sort((a, b) => rank(a) - rank(b) || a.lot.localeCompare(b.lot))) {
    if (wanted <= 0) break;
    const n = Math.min(wanted, lot.shares);
    const gain = (price - lot.costPerShare) * n;
    const tax = Math.round(gain * (longTerm(lot) ? taxRules.longTermRate : taxRules.shortTermRate));
    from.push({ lot: lot.lot, shares: n, gain: lib.money(gain), longTerm: longTerm(lot), tax: lib.money(tax) });
    taxTotal += tax;
    wanted -= n;
    said.push(`sell ${n} ${ticker} from lot ${lot.lot} (${gain < 0 ? "loss" : "gain"} ${lib.money(Math.abs(gain))}, ${longTerm(lot) ? "long-term" : "short-term"}, tax ${lib.money(tax)})`);
  }
  const sold = from.reduce((s, f) => s + f.shares, 0);
  if (sold) {
    trades.push({ ticker, side: "sell", shares: sold, lots: from });
    cash += sold * price;
  }
}

// Then buys: each underweight toward its target with the cash there is, in whole shares, never past it.
for (const [ticker, target] of t.weights) {
  const price = priceOf(ticker);
  const short = Math.floor(((target - (w.get(ticker) ?? 0)) * total) / price);
  if (short <= 0) continue;
  const n = Math.min(short, Math.floor(cash / price));
  if (n <= 0) continue;
  trades.push({ ticker, side: "buy", shares: n });
  cash -= n * price;
  said.push(`buy ${n} ${ticker} at ${lib.money(price)} (${lib.money(n * price)})`);
}

const file = `trades/proposed/${date}.json`;
const list = {
  date,
  target: `targets/${date}.json`,
  note: "Computed by the workload's plan-rebalance program from the target, the band, the lots and the tax ordering at this date's prices; not yet agreed. A person is asked once about every trade here before it is copied, unchanged, under trades/pending/.",
  trades,
  realisedTax: lib.money(taxTotal),
  cashAfter: lib.money(cash),
};
mkdirSync(path.dirname(file), { recursive: true });
writeFileSync(file, `${JSON.stringify(list, null, 2)}\n`);

process.stdout.write(`${JSON.stringify({
  summary: `wrote ${file}: ${said.join("; ") || "nothing to trade"}; realised tax ${lib.money(taxTotal)}; ${lib.money(cash)} cash left. Not yet agreed: consent and the copy under trades/pending/ are the confirm unit's.`,
  evidence: [{ class: "file", ref: file, observation: `${trades.length} trade(s) toward targets/${date}.json at prices/${date}.csv` }],
})}\n`);
