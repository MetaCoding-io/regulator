import assert from "node:assert/strict";
import test from "node:test";
import { Value } from "typebox/value";
import {
  EVAL_METRICS, EnvironmentFingerprintSchema, EvalMetricSchema, EvalReportSchema, EvalSuiteSchema, GraderOutputSchema, GraderVerdictSchema, MetricDeclarationSchema, MetricEntrySchema,
  declaredMetrics, isBuiltInMetric, isDeclaredMetricName, metricNames, optimisedMetrics, parseDeclaredMetric,
} from "./index.js";

const declaration = {
  name: "workload:portfolio/turnover", description: "the turnover the latest target implies against the custodian's positions", kind: "rate", direction: "lower",
  grader: { argv: ["node", "workload/portfolio/turnover.mjs"] },
};

test("the fifteen built-in metrics are exactly what they were, and a metric name is now one of them or a declared one — namespaced to the workload or the instrument that owns it", () => {
  assert.deepEqual([...EVAL_METRICS], [
    "closed", "attempts", "tokens", "turns", "wallClockMs", "retries", "escalations", "invariantViolations",
    "boundaryViolations", "signatureDrift", "vocabularyDrift", "memoryRules", "memoryFacts", "refusals", "suiteWeakened",
  ]);
  for (const m of EVAL_METRICS) {
    assert.equal(Value.Check(EvalMetricSchema, m), true, m);
    assert.equal(isBuiltInMetric(m), true);
    assert.equal(isDeclaredMetricName(m), false, `${m} is built in, not declared`);
  }
  for (const m of ["workload:portfolio/turnover", "instrument:inst.judge.consequential.v1/brier", "workload:software-development/corpusF1"]) {
    assert.equal(Value.Check(EvalMetricSchema, m), true, m);
    assert.equal(isDeclaredMetricName(m), true, m);
    assert.equal(isBuiltInMetric(m), false);
  }
  // A bare name is neither: a declared metric says who owns it, so a workload cannot shadow a built-in or another workload's.
  for (const m of ["turnover", "closed2", "Workload:portfolio/turnover", "workload:portfolio/", "workload:portfolio/Turnover", "workload:/turnover", "fixture:portfolio/turnover", "workload:portfolio/turn over"]) {
    assert.equal(Value.Check(EvalMetricSchema, m), false, `${m} is refused`);
  }
  assert.deepEqual(parseDeclaredMetric("workload:portfolio/turnover"), { owner: "workload", id: "portfolio", metric: "turnover" });
  assert.deepEqual(parseDeclaredMetric("instrument:inst.judge.v1/brier"), { owner: "instrument", id: "inst.judge.v1", metric: "brier" });
  assert.equal(parseDeclaredMetric("closed"), undefined);
});

test("a metric declaration is data: a namespaced name, a kind, a direction, an optional instrument ref and a grader argv; nothing else, and nothing inferred", () => {
  assert.equal(Value.Check(MetricDeclarationSchema, declaration), true);
  assert.equal(Value.Check(MetricDeclarationSchema, { ...declaration, instrument: "inst.judge.v1" }), true, "a judged metric names its instrument; whether the record exists is the definition check's question");
  assert.equal(Value.Check(MetricDeclarationSchema, { ...declaration, grader: { argv: ["node", "x.mjs"], timeoutMs: 30_000 } }), true);
  for (const [why, bad] of Object.entries({
    "no grader": { ...declaration, grader: undefined },
    "an empty argv": { ...declaration, grader: { argv: [] } },
    "a grader that is a model call, not a command": { ...declaration, grader: { model: "anthropic/claude-sonnet-4-5", prompt: "score it" } },
    "a bare name": { ...declaration, name: "turnover" },
    "an unknown kind": { ...declaration, kind: "percentage" },
    "an unknown direction": { ...declaration, direction: "up" },
    "a field the declaration does not carry": { ...declaration, builtIn: true },
    "no description": { ...declaration, description: "" },
  })) assert.equal(Value.Check(MetricDeclarationSchema, bad), false, why);
  // What a grader emits, one object per line.
  assert.equal(Value.Check(GraderOutputSchema, { metric: "workload:portfolio/turnover", value: 0.031 }), true);
  assert.equal(Value.Check(GraderOutputSchema, { metric: "workload:portfolio/turnover", value: 0.031, observation: "VTI 3 shares over, BND 4 over, VXUS 29 under" }), true);
  assert.equal(Value.Check(GraderOutputSchema, { metric: "closed", value: 1 }), false, "a grader may not emit a built-in: those are the harness's");
  assert.equal(Value.Check(GraderOutputSchema, { metric: "workload:portfolio/turnover", value: "0.03" }), false, "a value is a number");
});

test("a suite pre-registers built-in and declared names alike; one declared metric may be marked optimise, and the flag is readable without inference", () => {
  const suite = {
    name: "s", version: 1, description: "d", fixture: "fixture-portfolio", tasks: ["contracts/portfolio/p1-ingest-positions.json"],
    arms: [{ name: "control", description: "d", extensions: [], checks: ["run_tests"], identity: false }, { name: "treatment", description: "d", extensions: [], checks: ["run_tests"], identity: true }],
    repetitions: 2, metrics: ["closed", "attempts", { name: "workload:portfolio/turnover", optimise: true }], baseline: "control",
  };
  assert.equal(Value.Check(EvalSuiteSchema, suite), true);
  assert.deepEqual(metricNames(suite.metrics as never), ["closed", "attempts", "workload:portfolio/turnover"]);
  assert.deepEqual(declaredMetrics(suite.metrics as never), ["workload:portfolio/turnover"]);
  assert.deepEqual(optimisedMetrics(suite.metrics as never), ["workload:portfolio/turnover"]);
  assert.deepEqual(optimisedMetrics(["closed", "workload:portfolio/turnover"]), [], "nothing marked: everything is reported only");
  assert.equal(Value.Check(MetricEntrySchema, { name: "closed", optimise: false }), false, "the flag is `true` or absent, never a false that reads as a second state");
  assert.equal(Value.Check(MetricEntrySchema, { name: "closed", optimise: true, weight: 2 }), false, "an entry carries the name and the flag and nothing else");
  // The schema carries every flag a suite writes; which of them are refused — a second one, one on a built-in — is the definition check's (core), so the refusal names the file.
  assert.deepEqual(optimisedMetrics([{ name: "workload:a/x", optimise: true }, { name: "workload:a/y", optimise: true }]), ["workload:a/x", "workload:a/y"]);
  assert.equal(Value.Check(EvalSuiteSchema, { ...suite, metrics: ["turnover"] }), false, "a suite cannot pre-register a name nobody can own");
});

test("a grader verdict may be declared, and the fingerprint carries each declared grader's command and file hash — absent when nothing was declared, so the committed shape is unchanged", () => {
  assert.equal(Value.Check(GraderVerdictSchema, { grader: "workload:portfolio/turnover", kind: "declared", value: 0.031, observation: "three positions off target" }), true);
  assert.equal(Value.Check(GraderVerdictSchema, { grader: "boundaryViolations", kind: "outcome", value: 0, observation: "nothing changed outside src/, test/" }), true);
  assert.equal(Value.Check(GraderVerdictSchema, { grader: "x", kind: "judged", value: 0, observation: "o" }), false);
  const fingerprint = { node: "v22.19.0", platform: "linux", arch: "x64", pi: "0.87.0", harnessRevision: "a".repeat(40), dispatcher: "scripted:manager", model: "none", registry: 43, policies: { default: 1 } };
  assert.equal(Value.Check(EnvironmentFingerprintSchema, fingerprint), true, "the shape every committed report carries");
  const graders = [{ metric: "workload:portfolio/turnover", argv: ["node", "workload/portfolio/turnover.mjs"], file: "workload/portfolio/turnover.mjs", sha256: "0".repeat(64) }];
  assert.equal(Value.Check(EnvironmentFingerprintSchema, { ...fingerprint, graders }), true);
  assert.equal(Value.Check(EnvironmentFingerprintSchema, { ...fingerprint, graders: [{ ...graders[0], sha256: "not a hash" }] }), false, "the hash is what makes the stamp reproducible");
  assert.equal(Value.Check(EnvironmentFingerprintSchema, { ...fingerprint, graders: [{ ...graders[0], metric: "closed" }] }), false, "a built-in has no file to hash: its grader is the harness");
  const report = { suite: { name: "s", version: 1 }, generatedAt: "t", fingerprint, arms: [], lifts: [], runs: [], interpretation: "read", interpretedBy: "alice" };
  assert.equal(Value.Check(EvalReportSchema, report), true);
  assert.equal(Value.Check(EvalReportSchema, { ...report, suite: { ...report.suite, optimise: "workload:portfolio/turnover" } }), true, "the report says which metric an optimiser could select on");
  assert.equal(Value.Check(EvalReportSchema, { ...report, suite: { ...report.suite, optimise: "closed" } }), false, "never a built-in");
});
