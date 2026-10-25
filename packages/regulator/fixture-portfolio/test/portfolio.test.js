import assert from "node:assert/strict";
import test from "node:test";
import { applyTrades, band, benchmark, executedTrades, lots, pendingLists, percent, periodDates, positionDates, positions, prices, replayLots, reportOpenItems, reportPeriods, reportReturn, target, targetDates, tax, timeWeightedReturn, universe, washSales, weights } from "../lib/portfolio.js";

const EPSILON = 1e-9;
const u = universe();
const held = new Set(u.tickers);

test("every target is feasible under the declared constraints: long-only, summing to one, naming only the universe, each benchmark subset within its tolerance", () => {
  const b = benchmark();
  for (const date of targetDates()) {
    const t = target(date);
    assert.equal(t.asOf, date, `targets/${date}.json: asOf ${t.asOf} is not the file's date`);
    let sum = 0;
    for (const [ticker, w] of t.weights) {
      assert.ok(held.has(ticker), `targets/${date}.json: ${ticker} is not in universe.json`);
      assert.ok(typeof w === "number" && w >= 0, `targets/${date}.json: ${ticker} at ${w} is not long-only`);
      sum += w;
    }
    assert.ok(Math.abs(sum - 1) <= EPSILON, `targets/${date}.json: the weights sum to ${sum}, not one`);
    for (const subset of b.subsets) {
      const targeted = subset.tickers.reduce((s, ticker) => s + (t.weights.get(ticker) ?? 0), 0);
      const reference = subset.tickers.reduce((s, ticker) => s + (b.weights[ticker] ?? 0), 0);
      assert.ok(Math.abs(targeted - reference) <= subset.tolerance + EPSILON, `targets/${date}.json: subset ${subset.name} is at ${targeted.toFixed(4)}; the benchmark holds it at ${reference.toFixed(4)} ± ${subset.tolerance}`);
    }
  }
});

test("every pending trade list moves each position toward its target, not past it, and lands every targeted position inside the benchmark's band", () => {
  const bandWidth = band();
  assert.ok(bandWidth > 0 && bandWidth < 1, `benchmark.json: band ${bandWidth} is not a fraction of the portfolio`);
  for (const list of pendingLists()) {
    assert.ok(targetDates().includes(list.date), `${list.file}: no targets/${list.date}.json to plan against`);
    const t = target(list.date);
    const before = positions(list.date);
    const px = prices(list.date);
    for (const trade of list.trades) assert.ok(t.weights.has(trade.ticker), `${list.file}: trades ${trade.ticker}, which the target does not name`);
    const after = applyTrades(before, list.trades, px);
    const wBefore = weights(before, px);
    const wAfter = weights(after, px);
    for (const [ticker, w] of t.weights) {
      const dBefore = (wBefore.get(ticker) ?? 0) - w;
      const dAfter = (wAfter.get(ticker) ?? 0) - w;
      const pct = (d) => `${(d * 100).toFixed(2)}%`;
      assert.ok(dBefore * dAfter >= -EPSILON, `${list.file}: ${ticker} trades past its target, from ${pct(dBefore)} to ${pct(dAfter)}`);
      assert.ok(Math.abs(dAfter) <= Math.abs(dBefore) + EPSILON, `${list.file}: ${ticker} moves away from its target, from ${pct(dBefore)} to ${pct(dAfter)}`);
      assert.ok(Math.abs(dAfter) <= bandWidth + EPSILON, `${list.file}: ${ticker} lands at ${pct(dAfter)} from its target; the band is ${pct(bandWidth)}`);
    }
  }
});

test("every sell in a pending list names lots the portfolio holds, in the shares it holds", () => {
  for (const list of pendingLists()) {
    const ledger = lots();
    assert.equal(ledger.asOf, list.date, `${list.file}: the lots are current to ${ledger.asOf}, not to the list's date; what the portfolio holds on ${list.date} is not known`);
    const taken = new Map();
    for (const trade of list.trades.filter((t) => t.side === "sell")) {
      assert.ok(Array.isArray(trade.lots) && trade.lots.length, `${list.file}: the sell of ${trade.shares} ${trade.ticker} names no lot`);
      const named = trade.lots.reduce((s, from) => s + from.shares, 0);
      assert.equal(named, trade.shares, `${list.file}: the sell of ${trade.shares} ${trade.ticker} names lots for ${named}`);
      for (const from of trade.lots) {
        const lot = ledger.open.find((l) => l.lot === from.lot);
        assert.ok(lot && lot.ticker === trade.ticker, `${list.file}: sells ${trade.ticker} from lot ${from.lot}, which the portfolio does not hold`);
        const total = (taken.get(from.lot) ?? 0) + from.shares;
        taken.set(from.lot, total);
        assert.ok(total <= lot.shares, `${list.file}: sells ${total} of lot ${from.lot}, which holds ${lot.shares}`);
      }
    }
  }
});

test("no trade in a pending list creates a wash sale against the lot history", () => {
  const { washSaleWindowDays } = tax();
  for (const list of pendingLists()) {
    const problems = washSales(list, lots().open, executedTrades(), prices(list.date), washSaleWindowDays);
    assert.deepEqual(problems, [], problems.join("; "));
  }
});

test("the lots reconcile to the executed trades and to the custodian's positions", () => {
  const ledger = lots();
  assert.ok(positionDates().includes(ledger.asOf), `lots/lots.json: no positions export for ${ledger.asOf}`);
  assert.deepEqual(ledger.open, replayLots(ledger.asOf), `lots/lots.csv is not what trades/executed/ implies through ${ledger.asOf}`);
  const pos = positions(ledger.asOf);
  for (const ticker of u.tickers) {
    const inLots = ledger.open.filter((l) => l.ticker === ticker).reduce((s, l) => s + l.shares, 0);
    assert.equal(inLots, pos.holdings.get(ticker) ?? 0, `${ticker}: the lots hold ${inLots} shares; the custodian holds ${pos.holdings.get(ticker) ?? 0} on ${ledger.asOf} — the lots file is wrong`);
  }
  for (const lot of ledger.open) assert.ok(held.has(lot.ticker), `lot ${lot.lot}: ${lot.ticker} is not in universe.json; a position the universe does not name has no lot here and is carried as an open item`);
});

test("a period's report states the positions' time-weighted return and carries every position outside the universe as an open item", () => {
  for (const period of reportPeriods()) {
    const dates = periodDates(period);
    const stated = reportReturn(period);
    const computed = percent(timeWeightedReturn(dates));
    assert.equal(stated, computed, `reports/${period}.md says ${stated ?? "nothing"}; the time-weighted return over ${dates.join(" → ")} is ${computed}`);
    const last = dates[dates.length - 1];
    const open = reportOpenItems(period);
    for (const [ticker, n] of positions(last).holdings) {
      if (held.has(ticker)) continue;
      assert.ok(open.some((line) => line.includes(ticker)), `reports/${period}.md: ${n} ${ticker} on ${last} is not in universe.json and the report's open items do not carry it`);
    }
  }
});
