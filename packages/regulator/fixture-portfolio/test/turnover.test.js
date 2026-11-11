import assert from "node:assert/strict";
import test from "node:test";
import { positions, prices, target, turnover, weights } from "../lib/portfolio.js";

const close = (a, b) => Math.abs(a - b) < 1e-12;

test("turnover is half the absolute weight gap over the target's tickers: the fraction of the portfolio a rebalance to the target trades, each dollar once", () => {
  const t = new Map([["A", 0.5], ["B", 0.5]]);
  assert.ok(close(turnover(t, new Map([["A", 0.6], ["B", 0.3]])), 0.15), "0.1 over on A and 0.2 under on B is 0.15 of the portfolio traded");
  assert.equal(turnover(t, new Map([["A", 0.5], ["B", 0.5]])), 0, "on target: nothing to trade");
  assert.ok(close(turnover(t, new Map([["A", 1]])), 0.5), "a ticker the target names and the portfolio does not hold is fully under");
  assert.ok(close(turnover(t, new Map([["A", 0.5], ["B", 0.5], ["C", 0.1]])), 0), "a holding the target does not name is carried, not traded, and does not count");
  // On the shipped data: the August target against the 31 August export, and the same target after the 2 September rebalance.
  const august = target("2026-08-31").weights;
  const before = turnover(august, weights(positions("2026-08-31"), prices("2026-08-31")));
  const after = turnover(august, weights(positions("2026-09-15"), prices("2026-09-15")));
  assert.ok(before > 0 && before < 1, `the August export was off its target by a fraction of the portfolio, not by nothing and not by all of it: ${before}`);
  assert.ok(after < before, `the executed rebalance brought the portfolio closer to the August target: ${after} after, ${before} before`);
});
