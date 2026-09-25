import assert from "node:assert/strict";
import test from "node:test";
import type { EvalRun } from "@metacoding.io/regulator-protocol";
import { formatSummary, lifts, summarize, summarizeArms, tQuantile975 } from "./evals.js";

const run = (arm: string, repetition: number, metrics: Record<string, number>): EvalRun =>
  ({ arm, repetition, task: "t", unitId: "u", outcome: "closed", metrics, graders: [], startedAt: "a", endedAt: "b" });

test("summaries use Student's t at small n: one run has no interval, two runs a wide one, and the interval narrows as n grows", () => {
  assert.equal(tQuantile975(1), 12.706);
  assert.equal(tQuantile975(30), 2.042);
  assert.equal(tQuantile975(1000), 1.96);
  assert.deepEqual(summarize([]).n, 0);
  assert.deepEqual(summarize([4]), { n: 1, mean: 4, sd: 0, ci95: [4, 4], min: 4, max: 4 });
  const two = summarize([2, 4]);
  assert.equal(two.mean, 3);
  assert.ok(two.ci95[0] < -5 && two.ci95[1] > 11, `two points say almost nothing: ${JSON.stringify(two.ci95)}`);
  const ten = summarize([2, 4, 2, 4, 2, 4, 2, 4, 2, 4]);
  assert.equal(ten.mean, 3);
  assert.ok(ten.ci95[0] > 2 && ten.ci95[1] < 4);
  assert.equal(formatSummary(summarize([4])), "4 (n=1)");
  assert.match(formatSummary(ten), /^3 \[2\.\d, 3\.\d\] n=10$/);
});

test("arms are summarized over the pre-registered metrics only, and a lift is a delta with an honest overlap screen, never a p-value", () => {
  const runs = [
    run("control", 1, { closed: 1, tokens: 100, drift: 3, extra: 9 }), run("control", 2, { closed: 1, tokens: 120, drift: 3 }), run("control", 3, { closed: 0, tokens: 110, drift: 2 }),
    run("treatment", 1, { closed: 1, tokens: 150, drift: 0 }), run("treatment", 2, { closed: 1, tokens: 160, drift: 0 }), run("treatment", 3, { closed: 1, tokens: 140, drift: 0 }),
  ];
  const arms = summarizeArms(runs, ["closed", "tokens", "drift"]);
  assert.deepEqual(arms.map((a) => [a.arm, a.runs, Object.keys(a.metrics)]), [["control", 3, ["closed", "tokens", "drift"]], ["treatment", 3, ["closed", "tokens", "drift"]]]);
  assert.equal(arms[1]!.metrics.drift!.mean, 0);
  const l = lifts(arms, "control");
  assert.deepEqual(l.map((x) => [x.arm, x.metric, Math.round(x.delta * 100) / 100, x.separated]), [
    ["treatment", "closed", 0.33, false],
    ["treatment", "tokens", 40, false],
    ["treatment", "drift", -2.67, true],
  ]);
  assert.deepEqual(lifts(arms, "nope"), [], "no baseline, no lift");
  // Three runs per arm: a 40-token difference does not separate at n=3 (the t interval is wide), and the report must say so.
  assert.ok(arms[0]!.metrics.tokens!.ci95[1] > arms[1]!.metrics.tokens!.ci95[0]);
});
