/**
 * The portfolio workload's `harvest-threshold` sensor (#123): a program the
 * watcher runs in the instance on the intelligence policy's schedule. It
 * reads the open lots and the latest custodian's export's prices through the
 * portfolio's own library, values each lot's unrealised loss at the rate
 * tax.json applies to it — the long-term rate past the cutoff, the short-term
 * rate before — and fires when any lot's loss is worth more than the minimum
 * its argv declares in dollars (`--minimum <dollars>`). It writes nothing.
 *
 * The threshold is the portfolio note's (§3, S4 item 1, second case): the
 * book's harvest chapter sets a loss against its costs, and the costs are the
 * harvest contract's to declare (#124); until that file exists the minimum
 * lives on the sensor's declaration, and this program compares a tax value
 * to a number and nothing more. Firing holds `harvest-losses` through an
 * obligation until a person dispositions it; the sensor harvests nothing.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";

const lib = await import(pathToFileURL(path.resolve("lib/portfolio.js")).href);

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const say = (report) => process.stdout.write(`${JSON.stringify(report)}\n`);

const at = process.argv.indexOf("--minimum");
const minimum = at >= 0 ? Number(process.argv[at + 1]) : Number.NaN;
if (!Number.isFinite(minimum) || minimum < 0) fail("usage: harvest-threshold.mjs --minimum <dollars>: the minimum tax value of a loss worth raising, declared on the sensor");
const minimumCents = Math.round(minimum * 100);

const dates = lib.positionDates();
if (!dates.length) fail("no export under positions/: no prices to value the lots at");
const latest = dates[dates.length - 1];
const px = lib.prices(latest);
const taxRules = lib.tax();
const ledger = lib.lots();

const valued = [];
for (const lot of [...ledger.open].sort((a, b) => a.lot.localeCompare(b.lot))) {
  const price = px.get(lot.ticker);
  if (price === undefined) fail(`prices/${latest}.csv carries no price for ${lot.ticker}`);
  const loss = lib.unrealised(lot, price);
  if (loss >= 0) continue;
  const longTerm = lib.daysBetween(lot.acquired, latest) > taxRules.longTermAfterDays;
  const rate = longTerm ? taxRules.longTermRate : taxRules.shortTermRate;
  valued.push({ lot: lot.lot, loss, longTerm, rate, value: Math.round(-loss * rate) });
}
const worth = valued.filter((v) => v.value > minimumCents);
const observation = `lots/lots.csv (current to ${ledger.asOf}) at prices/${latest}.csv, minimum ${lib.money(minimumCents)}: ${valued.length ? valued.map((v) => `${v.lot} loss ${lib.money(-v.loss)} × ${v.rate} ${v.longTerm ? "long-term" : "short-term"} = ${lib.money(v.value)}`).join(", ") : "no lot at a loss"}`;
if (!worth.length) say({ fires: false, observation });
else {
  say({
    fires: true,
    claim: `${worth.map((v) => `${v.lot} carries an unrealised loss worth ${lib.money(v.value)} at the ${v.longTerm ? "long" : "short"}-term rate`).join(", ")} at the ${latest} prices, over the ${lib.money(minimumCents)} minimum`,
    observation,
    evidence: [
      { class: "file", ref: "lots/lots.csv", observation: `${ledger.open.length} open lot(s), current to ${ledger.asOf}` },
      { class: "file", ref: `prices/${latest}.csv`, observation: "the latest closing prices" },
      { class: "file", ref: "tax.json", observation: `long-term ${taxRules.longTermRate} after ${taxRules.longTermAfterDays} days, short-term ${taxRules.shortTermRate}` },
    ],
  });
}
