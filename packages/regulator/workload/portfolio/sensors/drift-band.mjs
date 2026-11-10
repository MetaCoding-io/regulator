/**
 * The portfolio workload's `drift-band` sensor (#123): a program the watcher
 * runs in the instance on the intelligence policy's schedule, with no
 * session and no model. It reads the tree through the portfolio's own
 * library — the latest custodian's export, that date's prices, the latest
 * target on or before it, the band in benchmark.json — and says on its last
 * stdout line whether any targeted weight is further from its target than
 * the band. It writes nothing; a sensor's reach is the signal it raises, and
 * the watcher undoes anything else.
 *
 * The number is the portfolio note's (§3, S4 item 1): the drift band the
 * book's rebalancing chapter defines, read here from the person's file and
 * never from the target a unit wrote. Firing holds `plan-rebalance` through
 * an obligation until a person dispositions it; the sensor plans nothing.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";

const lib = await import(pathToFileURL(path.resolve("lib/portfolio.js")).href);

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const say = (report) => process.stdout.write(`${JSON.stringify(report)}\n`);
const pct = (x) => `${(x * 100).toFixed(2)}%`;

const dates = lib.positionDates();
if (!dates.length) fail("no export under positions/: nothing to measure drift against");
const latest = dates[dates.length - 1];
const targets = lib.targetDates().filter((d) => d <= latest);
if (!targets.length) {
  say({ fires: false, observation: `no target under targets/ on or before ${latest}: nothing to drift from` });
} else {
  const date = targets[targets.length - 1];
  const t = lib.target(date);
  const band = lib.band();
  const w = lib.weights(lib.positions(latest), lib.prices(latest));
  const gaps = [...t.weights].map(([ticker, target]) => ({ ticker, target, weight: w.get(ticker) ?? 0, gap: (w.get(ticker) ?? 0) - target }));
  const past = gaps.filter((g) => Math.abs(g.gap) > band);
  const observation = `targets/${date}.json against positions/${latest}.csv at prices/${latest}.csv, band ${pct(band)}: ${gaps.map((g) => `${g.ticker} ${pct(g.weight)} vs ${pct(g.target)} (${pct(Math.abs(g.gap))} ${g.gap > 0 ? "over" : "under"})`).join(", ")}`;
  if (!past.length) say({ fires: false, observation });
  else {
    say({
      fires: true,
      claim: `${past.map((g) => `${g.ticker} is ${pct(Math.abs(g.gap))} ${g.gap > 0 ? "over" : "under"} its target`).join(", ")} at the ${latest} export, past the ${pct(band)} band of targets/${date}.json`,
      observation,
      evidence: [
        { class: "file", ref: `positions/${latest}.csv`, observation: "the latest custodian's export" },
        { class: "file", ref: `prices/${latest}.csv`, observation: "that date's closing prices" },
        { class: "file", ref: `targets/${date}.json`, observation: "the latest target on or before it" },
        { class: "file", ref: "benchmark.json", observation: `band ${band}` },
      ],
    });
  }
}
