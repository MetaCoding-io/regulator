import assert from "node:assert/strict";
import test from "node:test";
import { HARVEST_REASONS, OPTION_FACTOR, basisOf, harvest, harvestEvaluation, harvestObstacles, money, opportunityCost, prices, renderLotsCsv, replacementsFor, replayLots, tax, tradingCost, universe, washSales } from "../lib/portfolio.js";

// The arithmetic a harvest is judged by, on the shipped data at the 30 September prices with the lots the fills imply
// through that date: what the plan-harvest unit computes and the checks recompute. Not a check over the tree.
const DATE = "2026-09-30";
const taxRules = tax();
const inputs = harvest();
const px = prices(DATE);
const ledger = replayLots(DATE);
const sets = universe().sets;
const lot = (id) => ledger.find((l) => l.lot === id);
const noList = { file: "test", name: "test", date: DATE, trades: [] };

test("the opportunity cost is an at-the-money option on the tracking difference over the window: value × volatility × √(days/365) / √(2π), in whole cents", () => {
  assert.ok(Math.abs(OPTION_FACTOR - 0.398942) < 1e-6);
  assert.equal(opportunityCost(1_404_100, 0.02, 30), 3212, "14041.00 of BND at 2% tracking volatility over 30 days: 32.12");
  assert.equal(opportunityCost(1_404_100, 0, 30), 0, "no tracking volatility, no opportunity cost");
  assert.equal(tradingCost(1_404_100, 0.0005), 702, "one leg at five basis points: 7.02");
});

test("a lot's benefit is the loss at the rate its holding period earns, against two legs of trading cost on its value and the opportunity cost of the window", () => {
  const bnd = harvestEvaluation(lot("2025-03-14-BND"), px.get("BND"), DATE, taxRules, inputs);
  assert.deepEqual([bnd.loss, bnd.longTerm, bnd.benefit, bnd.tradingCost, bnd.opportunityCost, bnd.net].map((c) => (typeof c === "number" ? money(c) : c)), ["-779.00", true, "116.85", "14.04", "32.12", "70.69"], "190 BND bought at 78.00, priced at 73.90: a long-term loss worth harvesting");
  const vxusOld = harvestEvaluation(lot("2025-03-14-VXUS"), px.get("VXUS"), DATE, taxRules, inputs);
  assert.deepEqual([money(vxusOld.benefit), money(vxusOld.tradingCost), money(vxusOld.opportunityCost), money(vxusOld.net)], ["24.75", "8.84", "20.21", "-4.30"], "150 VXUS 1.10 under water: the long-term benefit does not cover the costs on 8835.00 of value");
  const vxusNew = harvestEvaluation(lot("2026-09-02-VXUS"), px.get("VXUS"), DATE, taxRules, inputs);
  assert.deepEqual([vxusNew.longTerm, money(vxusNew.benefit), money(vxusNew.net)], [false, "41.44", "35.25"], "32 VXUS bought in September: a short-term loss at the higher rate, worth it on the arithmetic alone");
  const vti = harvestEvaluation(lot("2025-03-14-VTI"), px.get("VTI"), DATE, taxRules, inputs);
  assert.deepEqual([vti.loss > 0, vti.benefit, vti.net < 0], [true, 0, true], "a lot at a gain has no benefit and only costs");
});

test("a lot's basis carries a disallowed loss, prorated when part of the lot is sold", () => {
  const adjusted = { lot: "x", ticker: "BND", acquired: "2026-10-15", shares: 20, costPerShare: 7250, basisAdjustment: 8200, washedFrom: ["2025-03-14-BND"] };
  assert.equal(basisOf(adjusted), 20 * 7250 + 8200, "the whole lot: the fill price times the shares plus the disallowed loss");
  assert.equal(basisOf(adjusted, 5), 5 * 7250 + 2050, "five of twenty shares carry a quarter of the adjustment");
  assert.equal(renderLotsCsv([adjusted, lot("2025-03-14-VTI")]), "lot,ticker,acquired,shares,costPerShare,basisAdjustment,washedFrom\n2025-03-14-VTI,VTI,2025-03-14,54,250.00,,\nx,BND,2026-10-15,20,72.50,82.00,2025-03-14-BND\n", "sorted by lot, the adjustment columns empty where there is none");
});

test("why a candidate is left: the three reasons, each found by the arithmetic against the list as it stands", () => {
  const rebalance = { file: "trades/pending/2026-09-30.json", name: "2026-09-30.json", date: DATE, trades: [{ ticker: "BND", side: "sell", shares: 4, lots: [{ lot: "2026-09-02-BND", shares: 4 }] }, { ticker: "VXUS", side: "buy", shares: 29 }] };
  const context = { list: noList, lists: [rebalance], executed: [], ledger, sets, taxRules, inputs, px, date: DATE };
  assert.deepEqual(harvestObstacles(lot("2025-03-14-BND"), context), [], "the 2 September BND lot is sold by the rebalance list of the day, so nothing bought inside the window remains: harvestable");
  assert.deepEqual(harvestObstacles(lot("2025-03-14-VXUS"), context).map((o) => o.reason), [HARVEST_REASONS[0], HARVEST_REASONS[1]], "the old VXUS lot: not worth it, and 32 shares bought on 2 September plus 29 the rebalance buys stand inside the window");
  assert.deepEqual(harvestObstacles(lot("2026-09-02-VXUS"), context).map((o) => o.reason), [HARVEST_REASONS[1]], "the September VXUS lot: worth it, but the rebalance list buys 29 VXUS the same day");
  assert.deepEqual(harvestObstacles(lot("2026-09-02-VXUS"), { ...context, lists: [] }).map((o) => o.reason), [], "without the rebalance's buy the September lot is harvestable: the lot itself counts as sold, not as its own replacement");
  const lonely = [{ name: "us-bonds", tickers: ["BND"] }, ...sets.filter((s) => s.name !== "us-bonds")];
  assert.deepEqual(harvestObstacles(lot("2025-03-14-BND"), { ...context, sets: lonely }).map((o) => o.reason), [HARVEST_REASONS[2]], "a set of one has nothing to replace a sold ticker with");
  assert.deepEqual(harvestObstacles(lot("2025-03-14-BND"), { ...context, sets: sets.filter((s) => s.name !== "us-bonds") }).map((o) => o.reason), [HARVEST_REASONS[2]], "a ticker no set names has no replacement: deferred");
  assert.deepEqual(replacementsFor("BND", { ...context, windowDays: taxRules.washSaleWindowDays }), ["AGG"]);
  assert.deepEqual(replacementsFor("BND", { ...context, windowDays: taxRules.washSaleWindowDays, list: { ...noList, trades: [{ ticker: "AGG", side: "sell", shares: 1, lots: [] }] } }), [], "a ticker the list also sells is no replacement");
  assert.deepEqual(replacementsFor("BND", { ...context, windowDays: taxRules.washSaleWindowDays, lists: [{ file: "trades/proposed/other.json", name: "other.json", date: DATE, trades: [{ ticker: "AGG", side: "sell", shares: 1, lots: [{ lot: "2025-03-14-BND", shares: 1 }] }] }] }), ["AGG"], "a sell of the replacement at a gain elsewhere in the window does not bar it; only a loss sale does");
});

test("a harvest list's wash-sale check, set by set: a replacement that is the sold ticker, a buy from a set nothing is sold from, a sell of a ticker outside every set, and the other lists of the window", () => {
  const w = taxRules.washSaleWindowDays;
  const sellBnd = { ticker: "BND", side: "sell", shares: 190, lots: [{ lot: "2025-03-14-BND", shares: 190 }] };
  const rebalance = { file: "trades/pending/2026-09-30.json", name: "2026-09-30.json", date: DATE, trades: [{ ticker: "BND", side: "sell", shares: 4, lots: [{ lot: "2026-09-02-BND", shares: 4 }] }, { ticker: "VXUS", side: "buy", shares: 29 }] };
  const list = (trades) => ({ file: "trades/proposed/harvest-plan-2026-09-30.json", name: "harvest-plan-2026-09-30.json", date: DATE, kind: "harvest", trades });
  assert.deepEqual(washSales(list([sellBnd, { ticker: "AGG", side: "buy", shares: 139 }]), ledger, [], px, w, { sets, lists: [rebalance] }), [], "BND into AGG, with the September BND lot sold by the rebalance: clean");
  assert.match(washSales(list([sellBnd, { ticker: "AGG", side: "buy", shares: 139 }]), ledger, [], px, w, { sets }).join("; "), /selling BND from 2025-03-14-BND at a loss is a wash sale: .*4 held from a lot bought within the window/, "without the rebalance list in view, the 2 September lot stands as replacement shares");
  assert.match(washSales(list([sellBnd, { ticker: "BND", side: "buy", shares: 190 }]), ledger, [], px, w, { sets, lists: [rebalance] }).join("; "), /buys BND and sells it: a replacement is another ticker of the us-bonds set/, "buying what it sells");
  assert.match(washSales(list([sellBnd, { ticker: "BND", side: "buy", shares: 190 }]), ledger, [], px, w, { sets, lists: [rebalance] }).join("; "), /selling BND from 2025-03-14-BND at a loss is a wash sale: .*190 bought in this list/, "and the sale itself is washed by that buy");
  assert.match(washSales(list([sellBnd, { ticker: "ITOT", side: "buy", shares: 100 }]), ledger, [], px, w, { sets, lists: [rebalance] }).join("; "), /buys ITOT and sells nothing of the us-equity set/, "a buy from a set nothing is sold from");
  assert.match(washSales(list([{ ticker: "VNQ", side: "sell", shares: 2, lots: [] }]), ledger, [], px, w, { sets }).join("; "), /sells VNQ, which no set in universe.json names/, "a ticker outside every set is deferred, not harvested");
  const vxus = list([{ ticker: "VXUS", side: "sell", shares: 32, lots: [{ lot: "2026-09-02-VXUS", shares: 32 }] }, { ticker: "IXUS", side: "buy", shares: 28 }]);
  assert.match(washSales(vxus, ledger, [], px, w, { sets, lists: [rebalance] }).join("; "), /29 bought by trades\/pending\/2026-09-30\.json on 2026-09-30/, "the rebalance list of the day buys the ticker the harvest sells at a loss");
  assert.deepEqual(washSales(vxus, ledger, [], px, w, { sets, lists: [] }), [], "alone, the September VXUS lot sells clean: it is not its own replacement");
  assert.deepEqual(washSales(rebalance, ledger, [], px, w), [], "the rebalance list keeps the per-ticker rule over the history alone; the harvest list in the tree is not its concern");
});
