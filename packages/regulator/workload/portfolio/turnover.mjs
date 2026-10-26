/**
 * The portfolio workload's declared grader for `workload:portfolio/turnover`
 * (#129). The host runs it in the instance after a unit, with the instance as
 * the working directory; it reads the tree — the targets a unit wrote and
 * the custodian's exports — through the portfolio's own library, and writes
 * one JSON line: { metric, value, observation }. It reads no unit's report,
 * and it is not a model.
 *
 * The number: the one-way turnover the latest target implies against the
 * custodian's latest positions, at that export's prices — the fraction of
 * the portfolio a rebalance to the target would trade (`turnover` in
 * lib/portfolio.js). No target on or before the latest export is a turnover
 * of zero, said so in the observation.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";

const METRIC = "workload:portfolio/turnover";
const lib = await import(pathToFileURL(path.resolve("lib/portfolio.js")).href);

const emit = (value, observation) => process.stdout.write(`${JSON.stringify({ metric: METRIC, value, observation })}\n`);
const pct = (x) => `${(x * 100).toFixed(2)}%`;

const dates = lib.positionDates();
const latest = dates[dates.length - 1];
const targets = lib.targetDates().filter((d) => d <= latest);
if (!targets.length) {
  emit(0, `no target under targets/ on or before ${latest}: nothing to rebalance toward`);
} else {
  const date = targets[targets.length - 1];
  const t = lib.target(date);
  const current = lib.weights(lib.positions(latest), lib.prices(latest));
  const gaps = [...t.weights].map(([ticker, w]) => `${ticker} ${pct(Math.abs((current.get(ticker) ?? 0) - w))} ${(current.get(ticker) ?? 0) > w ? "over" : "under"}`);
  emit(lib.turnover(t.weights, current), `targets/${date}.json against positions/${latest}.csv at prices/${latest}.csv: ${gaps.join(", ")}`);
}
