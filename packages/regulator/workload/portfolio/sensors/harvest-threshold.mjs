/**
 * The portfolio workload's `harvest-threshold` sensor (#123, #181): a program
 * the watcher runs in the instance on the intelligence policy's schedule. It
 * reads the open lots, the latest custodian's export's prices, tax.json and
 * the household's harvest inputs (harvest.json) through the portfolio's own
 * library, and fires when any open lot is worth harvesting by the library's
 * `harvestEvaluation`: the tax benefit of its loss at the rate its holding
 * period earns, less two legs of trading cost and the opportunity cost of
 * holding a replacement through the wash-sale window, is positive. It takes
 * no arguments and writes nothing.
 *
 * The threshold is the portfolio note's (§3, S4 item 1, second case): a loss
 * net of its costs. It is the arithmetic the plan-harvest contract fixes
 * (`f-inputs`) and the suite recomputes for every harvest list, read here
 * from the same function, so a firing names a lot the contract will not
 * leave as "benefit below costs" at these prices. The numbers are the
 * household's, in their files; the definition carries none. Firing holds
 * `harvest-losses` through an obligation until a person dispositions it; the
 * sensor harvests nothing.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";

const lib = await import(pathToFileURL(path.resolve("lib/portfolio.js")).href);

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const say = (report) => process.stdout.write(`${JSON.stringify(report)}\n`);

if (process.argv.length > 2) fail(`usage: harvest-threshold.mjs (no arguments): the threshold is harvest.json's and tax.json's arithmetic, not a number on the sensor; got ${process.argv.slice(2).join(" ")}`);

const dates = lib.positionDates();
if (!dates.length) fail("no export under positions/: no prices to value the lots at");
const latest = dates[dates.length - 1];
const px = lib.prices(latest);
const taxRules = lib.tax();
const inputs = lib.harvest();
const ledger = lib.lots();

const term = (v) => (v.longTerm ? "long-term" : "short-term");
const valued = [];
for (const lot of [...ledger.open].sort((a, b) => a.lot.localeCompare(b.lot))) {
  const price = px.get(lot.ticker);
  if (price === undefined) fail(`prices/${latest}.csv carries no price for ${lot.ticker}`);
  const evaluation = lib.harvestEvaluation(lot, price, latest, taxRules, inputs);
  if (evaluation.loss < 0) valued.push({ lot: lot.lot, ...evaluation });
}
const worth = valued.filter((v) => v.net > 0);
const each = (v) => `${v.lot} loss ${lib.money(-v.loss)}, benefit ${lib.money(v.benefit)} ${term(v)} less trading cost ${lib.money(v.tradingCost)} and opportunity cost ${lib.money(v.opportunityCost)} = net ${lib.money(v.net)}`;
const observation = `lots/lots.csv (current to ${ledger.asOf}) at prices/${latest}.csv, by harvest.json (trading cost ${inputs.tradingCostRate} a leg, tracking volatility ${inputs.trackingVolatility}) over tax.json's ${taxRules.washSaleWindowDays}-day window: ${!valued.length ? "no lot at a loss" : `${valued.map(each).join("; ")}${worth.length ? "" : "; no loss's benefit exceeds its costs"}`}`;
if (!worth.length) say({ fires: false, observation });
else {
  say({
    fires: true,
    claim: `${worth.map((v) => `${v.lot} is worth harvesting at the ${latest} prices: benefit ${lib.money(v.benefit)} at the ${term(v)} rate against trading cost ${lib.money(v.tradingCost)} and opportunity cost ${lib.money(v.opportunityCost)}, net ${lib.money(v.net)}`).join("; ")}`,
    observation,
    evidence: [
      { class: "file", ref: "lots/lots.csv", observation: `${ledger.open.length} open lot(s), current to ${ledger.asOf}` },
      { class: "file", ref: `prices/${latest}.csv`, observation: "the latest closing prices" },
      { class: "file", ref: "tax.json", observation: `long-term ${taxRules.longTermRate} after ${taxRules.longTermAfterDays} days, short-term ${taxRules.shortTermRate}, a ${taxRules.washSaleWindowDays}-day wash-sale window` },
      { class: "file", ref: "harvest.json", observation: `trading cost ${inputs.tradingCostRate} of a leg's value, tracking volatility ${inputs.trackingVolatility}` },
    ],
  });
}
