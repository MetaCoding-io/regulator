import assert from "node:assert/strict";
import test from "node:test";
import { Value } from "typebox/value";
import {
  EVAL_METRICS, HarnessEditSchema, IntelligenceSignalSchema, PolicyProposalSchema, PredictionResolutionSchema, PredictionSchema, RegulatoryEntrySchema, VsmMessageSchema,
  claimsHarnessEdit, isHarnessEdit, isPredictionResolution,
  type HarnessEdit, type Prediction, type PredictionResolution,
} from "./index.js";

const signal = {
  id: "i1", timestamp: "2026-10-26T00:00:00Z", source: "S4", kind: "intelligence-signal", channel: "intelligence", destination: "S3",
  severity: "advisory", subject: "advice/implement.md: run the inherited suite before reporting", observation: "two units reported without running it",
  claim: "units told to run the suite will be refused less often", confidence: "medium", evidence: [{ class: "file", ref: ".regulator/audit.ndjson" }],
};
const report = "a".repeat(64);
const prediction: Prediction = {
  metric: "refusals", baseline: { report, arm: "treatment" }, direction: "lower", magnitude: 1, probability: 0.7,
  horizons: [{ kind: "probe", report: "b".repeat(64), arm: "advised", disconfirmedBy: 2 }, { kind: "live", unitTypes: ["implement"], count: 3, disconfirmedBy: 2 }],
};

test("the prediction block (#138) is additive: a signal without it is unchanged, a signal with it is the same message kind, routed the same way; the block refuses a missing part, a probability outside [0, 1], an unknown metric and an unknown field — and `confidence` stays three-valued beside it", () => {
  assert.equal(Value.Check(IntelligenceSignalSchema, signal), true, "no block: as before");
  assert.equal(Value.Check(IntelligenceSignalSchema, { ...signal, prediction }), true);
  assert.equal(Value.Check(VsmMessageSchema, { ...signal, prediction }), true, "the same kind on the same channel");
  assert.equal(Value.Check(RegulatoryEntrySchema, { ...signal, prediction }), true, "a line of the regulatory log");
  for (const part of Object.keys(prediction) as Array<keyof Prediction>) {
    const { [part]: _dropped, ...missing } = prediction;
    assert.equal(Value.Check(PredictionSchema, missing), false, `a block without ${part}`);
    assert.equal(Value.Check(IntelligenceSignalSchema, { ...signal, prediction: missing }), false, `a signal with a block without ${part}`);
  }
  for (const probability of [-0.1, 1.1, 2, Number.NaN]) assert.equal(Value.Check(PredictionSchema, { ...prediction, probability }), false, `probability ${probability}`);
  for (const probability of [0, 0.5, 1]) assert.equal(Value.Check(PredictionSchema, { ...prediction, probability }), true, `probability ${probability}`);
  assert.equal(Value.Check(PredictionSchema, { ...prediction, metric: "velocity" }), false, "a metric that is neither built in nor declared");
  assert.equal(Value.Check(PredictionSchema, { ...prediction, metric: "workload:portfolio/turnover" }), true, "a declared metric name (#129)");
  for (const metric of EVAL_METRICS) assert.equal(Value.Check(PredictionSchema, { ...prediction, metric }), true, metric);
  assert.equal(Value.Check(PredictionSchema, { ...prediction, confidence: 0.7 }), false, "the probability is `probability`; the block carries no second confidence");
  assert.equal(Value.Check(IntelligenceSignalSchema, { ...signal, prediction, confidence: 0.7 }), false, "`confidence` is low | medium | high, as it was");
  assert.equal(Value.Check(PredictionSchema, { ...prediction, direction: "none" }), false, "a prediction moves the metric one way");
  assert.equal(Value.Check(PredictionSchema, { ...prediction, magnitude: -1 }), false);
  assert.equal(Value.Check(PredictionSchema, { ...prediction, horizons: [] }), false, "a prediction without a horizon never resolves");
  assert.equal(Value.Check(PredictionSchema, { ...prediction, horizons: [{ kind: "live", unitTypes: [], count: 3, disconfirmedBy: 2 }] }), false, "a live horizon names at least one unit type");
  assert.equal(Value.Check(PredictionSchema, { ...prediction, horizons: [{ kind: "live", unitTypes: ["implement"], count: 0, disconfirmedBy: 2 }] }), false, "the next N units: N ≥ 1");
  assert.equal(Value.Check(PredictionSchema, { ...prediction, horizons: [{ kind: "live", unitTypes: ["implement"], count: 3 }] }), false, "a horizon without a disconfirming value cannot count against anything");
  assert.equal(Value.Check(PredictionSchema, { ...prediction, horizons: [{ kind: "probe", report: "not-a-fingerprint", arm: "advised", disconfirmedBy: 2 }] }), false, "a probe names a report by its fingerprint");
  assert.equal(Value.Check(PredictionSchema, { ...prediction, baseline: { report } }), false, "a report baseline names the arm whose mean is the baseline");
  assert.equal(Value.Check(PredictionSchema, { ...prediction, baseline: { arm: "control" } }), true, "the arm a probe runs against, read from the probe's own report");
  assert.equal(Value.Check(PredictionSchema, { ...prediction, baseline: 3 }), false, "a baseline is a report's arm or an arm, not a number: the number is read when the horizon resolves");
});

const resolution: PredictionResolution = {
  type: "prediction-resolution", id: "r1", at: "2026-10-26T01:00:00Z", by: "S3", predictionId: "i1", horizon: 1,
  resolvedBy: { unit: "u2", unitType: "implement", status: "closed" }, metric: "refusals", outcome: "disconfirmed", observed: 2, baseline: 1,
  grader: { grader: "refusals", kind: "trajectory", value: 2, observation: "attempt 1: check-failure; attempt 2: check-failure" },
  reason: "observed 2 is at or past the disconfirming value 2", evidence: [{ class: "file", ref: ".regulator/units/u2" }],
};

test("a prediction-resolution is a record kind of the regulatory log, three-valued, resolved by a unit or by a report; it is not a message and carries no `kind`", () => {
  assert.equal(isPredictionResolution(resolution), true);
  assert.equal(Value.Check(RegulatoryEntrySchema, resolution), true);
  assert.equal(Value.Check(VsmMessageSchema, resolution), false, "a resolution is not routed; it is the outcome of routing's effect");
  assert.equal("kind" in resolution, false, "`kind` is how the log tells a message from an event");
  for (const outcome of ["confirmed", "disconfirmed", "inconclusive"]) assert.equal(isPredictionResolution({ ...resolution, outcome }), true, outcome);
  for (const outcome of ["neutral", "pending", "open"]) assert.equal(isPredictionResolution({ ...resolution, outcome }), false, outcome);
  assert.equal(isPredictionResolution({ ...resolution, resolvedBy: { report: "c".repeat(64), arm: "advised" } }), true, "a probe horizon is resolved by a report");
  assert.equal(isPredictionResolution({ ...resolution, resolvedBy: { unit: "u2" } }), false, "a unit resolves with its type and how it ended");
  const { observed: _o, baseline: _b, grader: _g, ...unread } = resolution;
  assert.equal(isPredictionResolution({ ...unread, outcome: "inconclusive", reason: "no grader observes velocity" }), true, "nothing read is still a resolution — inconclusive, with the reason");
  for (const part of ["predictionId", "horizon", "resolvedBy", "metric", "outcome", "reason", "evidence"] as const) {
    const { [part]: _dropped, ...missing } = resolution;
    assert.equal(Value.Check(PredictionResolutionSchema, missing), false, `without ${part}`);
  }
});

const diagnosis = { unit: "u1", attempt: 2, revision: "abc1234", moment: "attempt-failed" as const, evidence: ["e1"], signals: ["f1"] };
const edit: HarnessEdit = { kind: "harness-edit", diagnosis: [diagnosis], change: { profile: "implement", diff: "+ - Run the inherited suite before reporting.\n" }, prediction: "i1" };
const proposal = {
  id: "p1", timestamp: "2026-10-26T00:00:00Z", source: "S4", kind: "policy-proposal", channel: "proposal", destination: "S5", severity: "advisory",
  subject: "advice/implement.md: run the inherited suite before reporting", rationale: "two units were refused for a suite they never ran", requestedChange: edit, evidence: [],
};

test("the harness-edit payload (#138) is a typed requestedChange with three parts, each a different record; the schema refuses one that claims the kind and lacks a part, and a plain policy-proposal is unaffected", () => {
  assert.equal(isHarnessEdit(edit), true);
  assert.equal(Value.Check(PolicyProposalSchema, proposal), true);
  assert.equal(Value.Check(VsmMessageSchema, proposal), true, "a harness-edit is a policy-proposal: same kind, same channel, same router");
  // Plain proposals: text, an object of any other shape, as #110 and every earlier lesson wrote them.
  for (const requestedChange of ["add a line", { rule: "example" }, { kind: "other", anything: true }, 1, null, [1]]) {
    assert.equal(Value.Check(PolicyProposalSchema, { ...proposal, requestedChange }), true, `plain: ${JSON.stringify(requestedChange)}`);
    assert.equal(isHarnessEdit(requestedChange), false);
    assert.equal(claimsHarnessEdit(requestedChange), false);
  }
  // Claiming the kind and missing a part is refused by the schema, before any host reads the stores.
  for (const part of ["diagnosis", "change", "prediction"] as const) {
    const { [part]: _dropped, ...missing } = edit;
    assert.equal(claimsHarnessEdit(missing), true);
    assert.equal(isHarnessEdit(missing), false, `without ${part}`);
    assert.equal(Value.Check(PolicyProposalSchema, { ...proposal, requestedChange: missing }), false, `a proposal whose harness-edit lacks ${part}`);
    assert.equal(Value.Check(RegulatoryEntrySchema, { ...proposal, requestedChange: missing }), false, "and it cannot be appended to the log");
  }
  assert.equal(isHarnessEdit({ ...edit, diagnosis: [] }), false, "a diagnosis references at least one observation");
  assert.equal(isHarnessEdit({ ...edit, change: { profile: "implement" } }), false, "a change is a diff");
  assert.equal(isHarnessEdit({ ...edit, change: { profile: "Implement", diff: "x" } }), false, "the target is a profile name, as the advice file set names them");
  assert.equal(isHarnessEdit({ ...edit, change: { file: "advice/implement.md", diff: "x" } }), false, "by profile, not by path");
  assert.equal(isHarnessEdit({ ...edit, prediction: { metric: "refusals" } }), false, "the prediction is the id of a signal, not a block folded into the proposal");
  assert.equal(isHarnessEdit({ ...edit, rationale: "x" }), false, "closed: the rationale is the proposal's, not the payload's");
  for (const field of ["unit", "attempt", "revision", "moment", "evidence", "signals"] as const) {
    const { [field]: _dropped, ...missing } = diagnosis;
    assert.equal(isHarnessEdit({ ...edit, diagnosis: [missing] }), false, `a diagnosis reference without ${field}`);
  }
  assert.equal(isHarnessEdit({ ...edit, diagnosis: [{ ...diagnosis, moment: "the second attempt" }] }), false, "the moment is a step of the unit lifecycle's table, not prose");
  assert.equal(Value.Check(HarnessEditSchema, { ...edit, diagnosis: [{ ...diagnosis, moment: "verified" }] }), true);
});
