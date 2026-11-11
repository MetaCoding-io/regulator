import assert from "node:assert/strict";
import test from "node:test";
import { HARVEST_REASONS, applyTrades, band, basisOf, benchmark, cents, executedTrades, harvest, harvestBaseline, harvestCandidates, harvestEvaluation, harvestObstacles, kindOf, kindOfName, lots, money, otherListsWithin, pendingLists, percent, periodDates, positionDates, positions, prices, proposedLists, replayLedger, replacementsFor, reportOpenItems, reportPeriods, reportReturn, setTargets, setWeights, target, targetDates, tax, timeWeightedReturn, tradeLists, universe, unrealised, washSales, weights } from "../lib/portfolio.js";

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

test("every trade list says a kind the checks know, and the kind its name says", () => {
  for (const list of tradeLists()) {
    assert.equal(kindOf(list), kindOfName(list.name), `${list.file}: says kind ${kindOf(list)}; a file named ${list.name} is a ${kindOfName(list.name)} list`);
    assert.ok(Array.isArray(list.trades), `${list.file}: no trades array`);
  }
});

test("every pending or proposed rebalance list moves each position toward its target, not past it, and lands every targeted position inside the benchmark's band", () => {
  const bandWidth = band();
  assert.ok(bandWidth > 0 && bandWidth < 1, `benchmark.json: band ${bandWidth} is not a fraction of the portfolio`);
  for (const list of tradeLists().filter((l) => kindOf(l) === "rebalance")) {
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

test("every sell in a pending or proposed list, rebalance or harvest, names lots the portfolio holds, in the shares it holds — counted across the lists of a day", () => {
  const takenOn = new Map();
  for (const list of tradeLists()) {
    const ledger = lots();
    assert.equal(ledger.asOf, list.date, `${list.file}: the lots are current to ${ledger.asOf}, not to the list's date; what the portfolio holds on ${list.date} is not known`);
    // One count per name per day: a pending list carries its proposed twin's trades, so the twin is not a second taking.
    const key = `${list.date} ${list.name}`;
    if (takenOn.has(key)) continue;
    const taken = [...takenOn.entries()].filter(([k]) => k.startsWith(`${list.date} `)).reduce((m, [, t]) => { for (const [lot, n] of t) m.set(lot, (m.get(lot) ?? 0) + n); return m; }, new Map());
    const own = new Map();
    takenOn.set(key, own);
    for (const trade of list.trades.filter((t) => t.side === "sell")) {
      assert.ok(Array.isArray(trade.lots) && trade.lots.length, `${list.file}: the sell of ${trade.shares} ${trade.ticker} names no lot`);
      const named = trade.lots.reduce((s, from) => s + from.shares, 0);
      assert.equal(named, trade.shares, `${list.file}: the sell of ${trade.shares} ${trade.ticker} names lots for ${named}`);
      for (const from of trade.lots) {
        const lot = ledger.open.find((l) => l.lot === from.lot);
        assert.ok(lot && lot.ticker === trade.ticker, `${list.file}: sells ${trade.ticker} from lot ${from.lot}, which the portfolio does not hold`);
        const total = (taken.get(from.lot) ?? 0) + from.shares;
        taken.set(from.lot, total);
        own.set(from.lot, (own.get(from.lot) ?? 0) + from.shares);
        assert.ok(total <= lot.shares, `${list.file}: sells ${total} of lot ${from.lot} across the lists of ${list.date}, which holds ${lot.shares}`);
      }
    }
  }
});

test("no trade in a pending or proposed list creates a wash sale: a rebalance list against the lot history and the fills, ticker by ticker; a harvest list also against the other lists of its window, set by set — every buy from the set of a sold ticker and never a ticker the list sells", () => {
  const { washSaleWindowDays } = tax();
  for (const list of tradeLists()) {
    const options = kindOf(list) === "harvest" ? { sets: u.sets, lists: otherListsWithin(list, washSaleWindowDays) } : {};
    const problems = washSales(list, lots().open, executedTrades(), prices(list.date), washSaleWindowDays, options);
    assert.deepEqual(problems, [], problems.join("; "));
  }
});

// A pending list comes to exist only through the workload's place_trade tool, which copies the proposed file byte for byte
// after a person's yes (regulator #121); a session cannot write one. So this assertion no longer guards a model's shortcut
// (a list trimmed after the yes, which the careless unit of #120 took) but a bug in the tool's program: a copy that is not
// the list the person was asked about is refused here by name, whatever wrote it.
test("a pending list carries the trades the proposed list of its name computed, rebalance or harvest: what the person agreed to is what is executed", () => {
  const proposed = new Map(proposedLists().map((l) => [l.name, l]));
  for (const list of pendingLists()) {
    const computed = proposed.get(list.name);
    if (!computed) continue;
    assert.deepEqual(list.trades, computed.trades, `${list.file}: the trades are not the ones ${computed.file} computed, which is the list the person was asked about`);
  }
});

test("every harvest candidate is an open lot the portfolio holds at an unrealised loss at its date's prices, with the loss as the arithmetic says", () => {
  for (const list of harvestCandidates()) {
    assert.equal(list.file, `trades/proposed/harvest-${list.date}.json`, `${list.file}: the file is not named for its date ${list.date}`);
    const ledger = lots();
    assert.equal(ledger.asOf, list.date, `${list.file}: the lots are current to ${ledger.asOf}, not to the list's date`);
    const px = prices(list.date);
    assert.ok(Array.isArray(list.candidates), `${list.file}: no candidates array`);
    for (const c of list.candidates) {
      const lot = ledger.open.find((l) => l.lot === c.lot);
      assert.ok(lot && lot.ticker === c.ticker, `${list.file}: ${c.lot} is not an open lot of ${c.ticker}`);
      assert.equal(c.shares, lot.shares, `${list.file}: ${c.lot} holds ${lot.shares} shares, not ${c.shares}`);
      const price = px.get(c.ticker);
      assert.ok(price !== undefined, `${list.file}: prices/${list.date}.csv carries no price for ${c.ticker}`);
      const loss = unrealised(lot, price);
      assert.ok(loss < 0, `${list.file}: ${c.lot} is not at a loss at ${money(price)} (cost ${money(lot.costPerShare)})`);
      assert.equal(cents(c.unrealised), loss, `${list.file}: ${c.lot} states ${c.unrealised}; the arithmetic says ${money(loss)}`);
    }
  }
});


test("every harvest list sells whole candidate lots at a loss whose benefit exceeds both costs by harvest.json's arithmetic, stated per sell and in benefit order; buys only what the sells free, from the sold ticker's set; keeps every set inside the band of its target after the day's trades; and accounts for every candidate it leaves with a reason the arithmetic confirms", () => {
  const inputs = harvest();
  const taxRules = tax();
  const bandWidth = band();
  const candidatesByDate = new Map(harvestCandidates().map((c) => [c.date, c]));
  for (const list of tradeLists().filter((l) => kindOf(l) === "harvest")) {
    const ledger = lots();
    const px = prices(list.date);
    const candidates = candidatesByDate.get(list.date);
    assert.ok(candidates, `${list.file}: no trades/proposed/harvest-${list.date}.json to harvest from`);
    assert.equal(list.candidates, candidates.file, `${list.file}: names ${list.candidates} as its candidates; the program's file for ${list.date} is ${candidates.file}`);
    const context = { list, lists: otherListsWithin(list, taxRules.washSaleWindowDays), executed: executedTrades(), ledger: ledger.open, sets: u.sets, taxRules, inputs, px, date: list.date };
    const sold = new Set();
    let previousNet = Infinity;
    for (const trade of list.trades.filter((t) => t.side === "sell")) {
      assert.equal(trade.lots?.length, 1, `${list.file}: a harvest sells one whole lot per sell; the sell of ${trade.ticker} names ${trade.lots?.length ?? 0}`);
      const [from] = trade.lots;
      const candidate = candidates.candidates.find((c) => c.lot === from.lot);
      assert.ok(candidate, `${list.file}: sells lot ${from.lot}, which ${candidates.file} does not list as a candidate`);
      const lot = ledger.open.find((l) => l.lot === from.lot);
      assert.ok(lot, `${list.file}: sells lot ${from.lot}, which the portfolio does not hold`);
      assert.equal(from.shares, lot.shares, `${list.file}: sells ${from.shares} of lot ${from.lot}; a harvest takes the whole lot of ${lot.shares}`);
      assert.ok(!sold.has(from.lot), `${list.file}: sells lot ${from.lot} twice`);
      sold.add(from.lot);
      const e = harvestEvaluation(lot, px.get(trade.ticker), list.date, taxRules, inputs);
      assert.ok(e.loss < 0, `${list.file}: lot ${from.lot} is not at a loss at ${money(px.get(trade.ticker))}`);
      assert.ok(e.net > 0, `${list.file}: lot ${from.lot} is not worth harvesting: benefit ${money(e.benefit)} against trading cost ${money(e.tradingCost)} and opportunity cost ${money(e.opportunityCost)}`);
      for (const [field, value] of [["gain", from.gain, e.loss], ["tax", from.tax, -e.benefit]].map(([f, stated, computed]) => [f, [stated, computed]])) assert.equal(cents(value[0]), value[1], `${list.file}: lot ${from.lot} states ${field} ${value[0]}; the arithmetic says ${money(value[1])}`);
      assert.equal(from.longTerm, e.longTerm, `${list.file}: lot ${from.lot} is ${e.longTerm ? "long" : "short"}-term on ${list.date}`);
      for (const [field, stated, computed] of [["benefit", trade.benefit, e.benefit], ["tradingCost", trade.tradingCost, e.tradingCost], ["opportunityCost", trade.opportunityCost, e.opportunityCost]]) assert.equal(cents(stated), computed, `${list.file}: the sell of ${trade.ticker} states ${field} ${stated}; the arithmetic says ${money(computed)}`);
      assert.ok(e.net <= previousNet, `${list.file}: the sell of ${trade.ticker} (net ${money(e.net)}) comes after a smaller one; sells are ordered by benefit net of costs`);
      previousNet = e.net;
      const replacements = replacementsFor(trade.ticker, context);
      assert.ok(replacements.includes(trade.replacement), `${list.file}: the sell of ${trade.ticker} names ${trade.replacement} as its replacement; the set allows ${replacements.join(", ") || "nothing"}`);
      assert.ok(list.trades.some((t) => t.side === "buy" && t.ticker === trade.replacement), `${list.file}: the sell of ${trade.ticker} names ${trade.replacement} as its replacement and the list does not buy it`);
    }
    for (const trade of list.trades.filter((t) => t.side === "buy")) {
      const replaced = list.trades.filter((t) => t.side === "sell" && t.replacement === trade.ticker);
      assert.ok(replaced.length, `${list.file}: buys ${trade.ticker}, which no sell names as its replacement`);
      assert.deepEqual(trade.replaces, replaced.map((t) => t.ticker).join("+"), `${list.file}: the buy of ${trade.ticker} says it replaces ${trade.replaces}; the sells it replaces are ${replaced.map((t) => t.ticker).join("+")}`);
    }
    // The day's positions: after the rebalance lists of the date, then after this list; a harvest spends only what it frees and moves no set past the band.
    const before = harvestBaseline(list.date, px);
    const after = applyTrades(before, list.trades, px);
    assert.ok(after.cash >= before.cash, `${list.file}: the buys cost ${money(before.cash - after.cash)} more than the sells free`);
    assert.equal(cents(list.cashAfter), after.cash, `${list.file}: states cash after ${list.cashAfter}; the arithmetic says ${money(after.cash)}`);
    assert.ok(targetDates().includes(list.date), `${list.file}: no targets/${list.date}.json to hold the sets to`);
    const setTarget = setTargets(target(list.date).weights, u.sets);
    const wAfter = setWeights(after, px, u.sets);
    for (const set of u.sets) {
      const d = (wAfter.get(set.name) ?? 0) - (setTarget.get(set.name) ?? 0);
      assert.ok(Math.abs(d) <= bandWidth + EPSILON, `${list.file}: the ${set.name} set lands at ${(d * 100).toFixed(2)}% from its target after the day's trades; the band is ${(bandWidth * 100).toFixed(2)}%`);
    }
    // Every candidate not sold is accounted for, with one of the closed reasons, and the reason holds against the list as it stands.
    assert.ok(Array.isArray(list.dispositions), `${list.file}: no dispositions array`);
    for (const c of candidates.candidates) {
      if (sold.has(c.lot)) continue;
      const d = list.dispositions.find((x) => x.lot === c.lot);
      assert.ok(d, `${list.file}: candidate ${c.lot} is neither sold nor accounted for under dispositions`);
      assert.ok(HARVEST_REASONS.includes(d.reason), `${list.file}: candidate ${c.lot} is left for "${d.reason}", which is none of: ${HARVEST_REASONS.join(", ")}`);
      const lot = ledger.open.find((l) => l.lot === c.lot);
      const obstacles = harvestObstacles(lot, context).map((o) => o.reason);
      assert.ok(obstacles.includes(d.reason), `${list.file}: candidate ${c.lot} is left for "${d.reason}", but the arithmetic finds ${obstacles.length ? obstacles.join(", ") : "nothing in the way"}`);
    }
    for (const d of list.dispositions) {
      assert.ok(candidates.candidates.some((c) => c.lot === d.lot), `${list.file}: dispositions name ${d.lot}, which is not a candidate`);
      assert.ok(!sold.has(d.lot), `${list.file}: ${d.lot} is both sold and left`);
    }
  }
});

test("the lots reconcile to the executed trades and to the custodian's positions, with the basis adjusted and the sold lot marked wherever the fills washed a loss", () => {
  const ledger = lots();
  assert.ok(positionDates().includes(ledger.asOf), `lots/lots.json: no positions export for ${ledger.asOf}`);
  const implied = replayLedger(ledger.asOf);
  for (const lot of implied.open) {
    const stated = ledger.open.find((l) => l.lot === lot.lot);
    assert.ok(stated, `lots/lots.csv: lot ${lot.lot} is missing; trades/executed/ opens it`);
    assert.equal(money(basisOf(stated)), money(basisOf(lot)), `lots/lots.csv: lot ${lot.lot} carries a basis of ${money(basisOf(stated))} (${stated.shares} at ${money(stated.costPerShare)}${stated.basisAdjustment ? ` + ${money(stated.basisAdjustment)} disallowed` : ""}); the fills imply ${money(basisOf(lot))}${lot.basisAdjustment ? `, with ${money(lot.basisAdjustment)} of the loss on ${lot.washedFrom.join(", ")} disallowed and added to it: a buy inside the wash-sale window` : ""}`);
  }
  assert.deepEqual(ledger.open, implied.open, `lots/lots.csv is not what trades/executed/ implies through ${ledger.asOf}`);
  assert.deepEqual(ledger.washSales, implied.washSales, `lots/lots.json: washSales does not mark the loss sales the fills washed through ${ledger.asOf}; the fills imply ${JSON.stringify(implied.washSales.map((w) => ({ ...w, disallowed: money(w.disallowed) })))}`);
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
