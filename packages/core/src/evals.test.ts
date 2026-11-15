import assert from "node:assert/strict";
import test from "node:test";
import type { EvalRun } from "@metacoding.io/regulator-protocol";
import { baselineCheck, formatSummary, lifts, metricDirection, summarize, summarizeArms, taskTable, tQuantile975 } from "./evals.js";

const run = (arm: string, repetition: number, metrics: Record<string, number>, task = "t"): EvalRun =>
  ({ arm, repetition, task, unitId: task, outcome: "closed", metrics, graders: [], startedAt: "a", endedAt: "b" });

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

test("the per-task table (#201): per task in run order, each arm's mean over its repetitions, and each non-baseline arm's difference from the baseline with the arm that leads by the metric's direction; means only, no interval", () => {
  const runs = [
    run("control", 1, { closed: 1, boundaryViolations: 0, refusals: 0 }, "d1"), run("control", 2, { closed: 1, boundaryViolations: 0, refusals: 0 }, "d1"),
    run("control", 1, { closed: 1, boundaryViolations: 2, refusals: 0 }, "d2"), run("control", 2, { closed: 1, boundaryViolations: 1, refusals: 0 }, "d2"),
    run("treatment", 1, { closed: 1, boundaryViolations: 0, refusals: 0 }, "d1"), run("treatment", 2, { closed: 0, boundaryViolations: 0, refusals: 3 }, "d1"),
    run("treatment", 1, { closed: 0, boundaryViolations: 0, refusals: 3 }, "d2"), run("treatment", 2, { closed: 0, boundaryViolations: 0, refusals: 3, "workload:pf/turnover": 0.2 }, "d2"),
  ];
  const table = taskTable(runs, ["closed", "boundaryViolations", "refusals", "workload:pf/turnover"], "control", { "workload:pf/turnover": "lower" });
  assert.deepEqual(table.map((t) => t.task), ["d1", "d2"], "tasks in the order the runs name them: the order they ran in");
  assert.deepEqual(table[0]!.arms, [{ arm: "control", n: 2, means: { closed: 1, boundaryViolations: 0, refusals: 0 } }, { arm: "treatment", n: 2, means: { closed: 0.5, boundaryViolations: 0, refusals: 1.5 } }]);
  assert.deepEqual(table[1]!.arms[1]!.means["workload:pf/turnover"], 0.2, "a metric is averaged over the runs that observed it");
  assert.deepEqual(table[0]!.differences, [
    { arm: "treatment", metric: "closed", delta: -0.5, direction: "higher", leads: "control" },
    { arm: "treatment", metric: "boundaryViolations", delta: 0, direction: "lower" },
    { arm: "treatment", metric: "refusals", delta: 1.5, direction: "none" },
  ], "a tie names no leader, and an unranked metric names none: a refusal is the gate working as often as it is a cost");
  assert.deepEqual(table[1]!.differences.map((d) => [d.metric, d.delta, d.leads]), [["closed", -1, "control"], ["boundaryViolations", -1.5, "treatment"], ["refusals", 3, undefined]], "the baseline never observed the declared metric, so there is no difference to state");
  for (const t of table) for (const d of t.differences) assert.ok(!("separated" in d) && !("ci95" in d), "no interval and no separation flag at the task level");
  assert.deepEqual(taskTable(runs, ["closed"], "nope")[0]!.differences, [], "no baseline, no difference");
  assert.equal(metricDirection("closed"), "higher");
  assert.equal(metricDirection("cacheWrite"), "lower");
  assert.equal(metricDirection("workload:pf/turnover"), "none", "a declared metric's direction is its declaration's; without one it is not ranked");
});

test("a baseline that discriminates (#201): per pre-registered outcome metric, the baseline's maximum over its runs and whether it is above zero; a baseline clean on every one gave the gates nothing to catch", () => {
  const clean = [run("control", 1, { boundaryViolations: 0, vocabularyDrift: 0, closed: 0, invariantViolations: 28 }), run("control", 2, { boundaryViolations: 0, vocabularyDrift: 0 }), run("treatment", 1, { boundaryViolations: 4 })];
  assert.deepEqual(baselineCheck(clean, ["closed", "boundaryViolations", "vocabularyDrift", "invariantViolations"], "control"), {
    arm: "control", metrics: [{ metric: "boundaryViolations", max: 0, failed: false }, { metric: "vocabularyDrift", max: 0, failed: false }], discriminates: false,
  }, "only the outcome metrics count: an unclosed unit or a trajectory count (the canary's silences) is not drift a gate could catch, and a treatment arm's drift is not the baseline's");
  const drifted = [...clean, run("control", 3, { boundaryViolations: 0, vocabularyDrift: 2 })];
  assert.equal(baselineCheck(drifted, ["boundaryViolations", "vocabularyDrift"], "control")!.discriminates, true, "one run that drifted is enough");
  assert.deepEqual(baselineCheck(drifted, ["boundaryViolations", "vocabularyDrift"], "control")!.metrics.map((m) => [m.metric, m.max]), [["boundaryViolations", 0], ["vocabularyDrift", 2]]);
  assert.equal(baselineCheck(clean, ["closed", "tokens", "workload:pf/turnover"], "control"), undefined, "a suite that pre-registers no outcome metric cannot say, so the report says nothing");
  assert.equal(baselineCheck(clean, ["boundaryViolations"], "nope"), undefined, "no baseline run, nothing to say");
});
