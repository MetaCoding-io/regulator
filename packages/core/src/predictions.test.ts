import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import type { EvalReport, GraderVerdict, HarnessEdit, IntelligenceSignal, PolicyProposal, Prediction, RoutingPolicy, WorkContract } from "@metacoding.io/regulator-protocol";
import { AuditLog } from "./audit-log.js";
import { ExecutionStore } from "./execution-store.js";
import { ObligationLedger, routeMessages } from "./obligations.js";
import { baselineValue, checkHarnessEdit, compareWithPrediction, foldPredictions, readPredictions, resolvePredictions, type CommittedReport } from "./predictions.js";
import { appendSignal, readEntries } from "./signals.js";

const routing: RoutingPolicy = {
  name: "routing", version: 1, description: "d",
  rules: [
    { kind: "policy-proposal", minSeverity: "info", consumer: "S5" },
    { kind: "intelligence-signal", minSeverity: "advisory", consumer: "S3" },
  ],
  impactSeverity: { low: "info", medium: "advisory", high: "blocking", critical: "critical" },
  recovery: { remediate: "S3", replan: "S3", clarify: "human", pause: "human", escalate: "human" },
  blocksAtOrAbove: "blocking",
};

let clock = Date.parse("2026-10-26T10:00:00.000Z");
const tick = () => (clock += 1000);
const stamp = () => new Date(clock).toISOString();

const REPORT = "a".repeat(64);
const PROBE = "b".repeat(64);
const prediction: Prediction = {
  metric: "refusals", baseline: { report: REPORT, arm: "treatment" }, direction: "lower", magnitude: 1, probability: 0.7,
  horizons: [{ kind: "live", unitTypes: ["implement"], count: 2, disconfirmedBy: 2 }],
};
const signal = (id: string, over: Omit<Partial<IntelligenceSignal>, "prediction"> & { prediction?: Prediction | undefined } = {}): IntelligenceSignal => {
  const { prediction: block, ...rest } = { prediction, ...over };
  return {
    id, timestamp: stamp(), source: "S4", kind: "intelligence-signal", channel: "intelligence", destination: "S3", severity: "advisory",
    subject: "advice/implement.md: run the inherited suite before reporting", observation: "two units reported without running it", claim: "fewer refusals", confidence: "medium",
    evidence: [{ class: "file", ref: ".regulator/audit.ndjson" }], ...(block === undefined ? {} : { prediction: block }), ...rest,
  };
};
const summary = (mean: number, half = 0.5, n = 3) => ({ n, mean, sd: 0.1, ci95: [mean - half, mean + half] as [number, number], min: mean - half, max: mean + half });
const report = (fingerprint: string, arms: Record<string, Record<string, ReturnType<typeof summary>>>, file?: string): CommittedReport => ({
  fingerprint, ...(file ? { file } : {}),
  report: {
    suite: { name: "drift", version: 1 }, generatedAt: "2026-10-01T00:00:00.000Z",
    fingerprint: { node: "v22", platform: "linux", arch: "x64", pi: "0.87.0", harnessRevision: "abc1234", dispatcher: "scripted:reference", model: "none", registry: 49, policies: {} },
    arms: Object.entries(arms).map(([arm, metrics]) => ({ arm, runs: 3, metrics })), lifts: [], runs: [], interpretation: "read", interpretedBy: "alice",
  } satisfies EvalReport,
});
const reports = [report(REPORT, { treatment: { refusals: summary(1) }, control: { refusals: summary(3) } }, "evals/reports/drift-drifter.json")];
const measuring = (value: number): ((metric: string) => Promise<GraderVerdict | undefined>) => async (metric) => ({ grader: metric, kind: "trajectory", value, observation: `${value} refused attempt(s)` });

async function root(t: TestContext): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-predictions-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test("the three-valued rule: disconfirmed at or past the disconfirming value, confirmed when the observed value reaches the baseline moved by the magnitude (for a probe, its whole interval), inconclusive otherwise and whenever no baseline can be read", () => {
  const lower = { baseline: 3, direction: "lower" as const, magnitude: 1, disconfirmedBy: 4 };
  assert.equal(compareWithPrediction({ ...lower, observed: 2 }).outcome, "confirmed");
  assert.equal(compareWithPrediction({ ...lower, observed: 1 }).outcome, "confirmed");
  assert.equal(compareWithPrediction({ ...lower, observed: 2.5 }).outcome, "inconclusive", "moved, but not by the magnitude staked");
  assert.equal(compareWithPrediction({ ...lower, observed: 3 }).outcome, "inconclusive", "no change is not confirmation");
  assert.equal(compareWithPrediction({ ...lower, observed: 4 }).outcome, "disconfirmed");
  assert.equal(compareWithPrediction({ ...lower, observed: 9 }).outcome, "disconfirmed");
  assert.match(compareWithPrediction({ ...lower, observed: 9 }).reason, /observed 9 is at or past the disconfirming value 4 \(predicted lower\)/);
  const higher = { baseline: 0.5, direction: "higher" as const, magnitude: 0.2, disconfirmedBy: 0.4 };
  assert.equal(compareWithPrediction({ ...higher, observed: 0.7 }).outcome, "confirmed");
  assert.equal(compareWithPrediction({ ...higher, observed: 0.6 }).outcome, "inconclusive");
  assert.equal(compareWithPrediction({ ...higher, observed: 0.4 }).outcome, "disconfirmed");
  // No baseline: disconfirmed is still readable, confirmed is not.
  assert.equal(compareWithPrediction({ ...lower, baseline: undefined, observed: 5 }).outcome, "disconfirmed");
  assert.equal(compareWithPrediction({ ...lower, baseline: undefined, observed: 0 }).outcome, "inconclusive");
  assert.match(compareWithPrediction({ ...lower, baseline: undefined, observed: 0 }).reason, /no baseline value could be read/);
  // A probe: the mean reaches the target, the interval must too.
  assert.equal(compareWithPrediction({ ...lower, observed: 1.5, interval: [1, 2] }).outcome, "confirmed");
  assert.equal(compareWithPrediction({ ...lower, observed: 1.5, interval: [0.5, 2.5] }).outcome, "inconclusive", "the interval crosses the target: too small to see at this budget");
  assert.match(compareWithPrediction({ ...lower, observed: 1.5, interval: [0.5, 2.5] }).reason, /its 95% interval \[0\.5, 2\.5\] does not/);
  // The disconfirming value is read first, whatever the baseline says.
  assert.equal(compareWithPrediction({ baseline: 3, direction: "lower", magnitude: 1, disconfirmedBy: 1, observed: 1 }).outcome, "disconfirmed", "a prediction whose disconfirming value sits inside its own target disconfirms there");
});

test("live horizon, three outcomes from the stores: a unit of the named type closes, the metric is read with the grader the caller supplies, compared against the committed report's arm and the disconfirming value, and one prediction-resolution is appended per unit; a disconfirmed reading raises a proposal to S5 that the routing policy turns into an obligation with the prediction's id in its subject; the count is the fold, not a scan; inconclusive counts against precision", async (t) => {
  const dir = await root(t);
  await appendSignal(dir, signal("p-confirm"));
  await appendSignal(dir, signal("p-disconfirm", { prediction: { ...prediction, horizons: [{ kind: "live", unitTypes: ["implement", "verify"], count: 1, disconfirmedBy: 2 }] } }));
  await appendSignal(dir, signal("p-inconclusive", { prediction: { ...prediction, metric: "boundaryViolations", horizons: [{ kind: "live", unitTypes: ["implement"], count: 1, disconfirmedBy: 3 }] } }));
  await appendSignal(dir, signal("plain", { prediction: undefined }));
  await appendSignal(dir, signal("other-type", { prediction: { ...prediction, horizons: [{ kind: "live", unitTypes: ["research"], count: 1, disconfirmedBy: 2 }] } }));
  await routeMessages(new ObligationLedger(dir, tick), { policy: routing, now: tick });
  let states = await readPredictions(dir);
  assert.deepEqual(states.map((s) => [s.signal.id, s.status, s.horizons[0]?.status, s.horizons[0]?.openedAt === s.signal.timestamp]), [
    ["p-confirm", "open", "open", true], ["p-disconfirm", "open", "open", true], ["p-inconclusive", "open", "open", true], ["other-type", "open", "open", true],
  ], "a prediction no harness-edit bets on is open from its signal; a signal without the block is not a prediction");

  // u1 closes: refusals 0. Confirmed for p-confirm (baseline 1, lower by 1 → 0 reaches 0); disconfirmed needs ≥ 2, so p-disconfirm is confirmed too... unless its unit reads otherwise.
  const measure = async (metric: string): Promise<GraderVerdict | undefined> => (metric === "refusals" ? { grader: "refusals", kind: "trajectory", value: 0, observation: "no attempt refused" } : undefined);
  const first = await resolvePredictions(dir, { unit: { unitId: "u1", unitType: "implement", status: "closed" }, measure, reports, routing, now: tick });
  assert.deepEqual(first.resolutions.map((r) => [r.predictionId, r.outcome, r.observed, r.baseline]), [["p-confirm", "confirmed", 0, 1], ["p-disconfirm", "confirmed", 0, 1], ["p-inconclusive", "inconclusive", undefined, undefined]], "the report's arm has no boundaryViolations summary either, so that baseline is unread too");
  assert.match(first.resolutions[2]?.reason ?? "", /no grader observes "boundaryViolations" for unit u1; nothing was read/);
  assert.deepEqual(first.resolutions.map((r) => r.resolvedBy), Array(3).fill({ unit: "u1", unitType: "implement", status: "closed" }));
  assert.deepEqual(first.resolutions[0]?.evidence, [{ class: "file", ref: ".regulator/units/u1", observation: "refusals (trajectory): no attempt refused" }, { class: "file", ref: "evals/reports/drift-drifter.json", observation: "baseline 1" }], "read from the stores and the report, never from the unit's report");
  assert.deepEqual(first.proposals, [], "nothing disconfirmed, nothing proposed");

  // Resolving the same unit again resolves nothing: one resolution per unit per horizon.
  const again = await resolvePredictions(dir, { unit: { unitId: "u1", unitType: "implement", status: "closed" }, measure, reports, routing, now: tick });
  assert.deepEqual(again.resolutions, []);
  states = await readPredictions(dir);
  assert.deepEqual(states.map((s) => [s.signal.id, s.status, s.summary]), [
    ["p-confirm", "open", { confirmed: 1, disconfirmed: 0, inconclusive: 0, resolved: 1, precision: 1 }],
    ["p-disconfirm", "resolved", { confirmed: 1, disconfirmed: 0, inconclusive: 0, resolved: 1, precision: 1 }],
    ["p-inconclusive", "resolved", { confirmed: 0, disconfirmed: 0, inconclusive: 1, resolved: 1, precision: 0 }],
    ["other-type", "open", { confirmed: 0, disconfirmed: 0, inconclusive: 0, resolved: 0, precision: undefined }],
  ], "count 1 is met by one unit; count 2 stays open; inconclusive is counted and counts against");

  // u2 aborts with 3 refusals: p-confirm's second unit disconfirms (≥ 2) and meets the count; p-disconfirm is met already and is not resolved again.
  const second = await resolvePredictions(dir, { unit: { unitId: "u2", unitType: "implement", status: "aborted" }, measure: measuring(3), reports, routing, now: tick });
  assert.deepEqual(second.resolutions.map((r) => [r.predictionId, r.outcome, r.observed, r.resolvedBy]), [["p-confirm", "disconfirmed", 3, { unit: "u2", unitType: "implement", status: "aborted" }]]);
  assert.equal(second.proposals.length, 1, "a disconfirmed live horizon raises a proposal to S5");
  const proposal = second.proposals[0]!;
  assert.deepEqual([proposal.kind, proposal.source, proposal.destination, proposal.severity, proposal.unit], ["policy-proposal", "S3", "S5", "advisory", undefined]);
  assert.equal(proposal.subject, "prediction p-confirm disconfirmed at its live horizon: revert or re-decide advice/implement.md: run the inherited suite before reporting", "no harness-edit was accepted on it, so the target is the signal's subject");
  assert.equal(typeof proposal.requestedChange, "string", "a plain proposal: it carries no prediction and cannot be probed");
  assert.match(proposal.rationale, /refusals for unit u2 \(implement, aborted\) read 3: observed 3 is at or past the disconfirming value 2 \(predicted lower\)\. The prediction staked refusals lower by 1 at probability 0\.7\. Resolution [0-9a-f-]{36}\./);
  assert.deepEqual(second.opened.map((o) => [o.consumer, o.concern, o.severity, o.blocks, o.sources, o.unit]), [["S5", "policy-proposal", "advisory", false, [proposal.id], undefined]], "routed under the routing policy: the policy's rule for a proposal names S5");
  assert.match(second.opened[0]?.subject ?? "", /^prediction p-confirm disconfirmed/);
  states = await readPredictions(dir);
  assert.deepEqual(states[0]?.summary, { confirmed: 1, disconfirmed: 1, inconclusive: 0, resolved: 2, precision: 0.5 });
  assert.equal(states[0]?.status, "resolved", "two units resolved: the count is met");
  assert.equal(states[0]?.horizons[0]?.status, "met");

  // A grader that fails is a reading not taken: inconclusive, with the failure named, and the close it follows is not undone.
  await appendSignal(dir, signal("p-failing", { prediction: { ...prediction, horizons: [{ kind: "live", unitTypes: ["verify"], count: 1, disconfirmedBy: 2 }] } }));
  const failing = await resolvePredictions(dir, { unit: { unitId: "v1", unitType: "verify", status: "closed" }, measure: async () => { throw new Error("grader exited 2: no fixture\nmore"); }, reports, routing, now: tick });
  assert.deepEqual(failing.resolutions.map((r) => [r.predictionId, r.outcome, r.observed]), [["p-failing", "inconclusive", undefined]]);
  assert.equal(failing.resolutions[0]?.reason, 'the grader for "refusals" failed on unit v1: grader exited 2: no fixture; nothing was read, so nothing counts for the prediction');
  assert.deepEqual(failing.resolutions[0]?.evidence[0], { class: "file", ref: ".regulator/units/v1", observation: "the grader failed: grader exited 2: no fixture" });

  // A unit of a type no live horizon names resolves nothing; the log holds exactly the five resolutions and the one proposal.
  const unrelated = await resolvePredictions(dir, { unit: { unitId: "u3", unitType: "integrate", status: "closed" }, measure: measuring(0), reports, routing, now: tick });
  assert.deepEqual(unrelated.resolutions, []);
  const entries = await readEntries(dir);
  assert.equal(entries.filter((e) => "type" in e && e.type === "prediction-resolution").length, 5);
  assert.equal(entries.filter((e) => "kind" in e && e.kind === "policy-proposal").length, 1);
  assert.deepEqual((await new ObligationLedger(dir).unrouted()).map((m) => m.kind), ["intelligence-signal"], "the proposal was routed, not left in the log; the signal appended by hand above waits for the router");
});

test("a harness-edit's live horizon opens at acceptance: before the proposal is decided a closing unit resolves nothing against it; after `accepted` the next units count; a declined proposal's horizon never opens", async (t) => {
  const dir = await root(t);
  const ledger = new ObligationLedger(dir, tick);
  await appendSignal(dir, signal("p1"));
  await appendSignal(dir, signal("p2"));
  const edit = (predictionId: string): HarnessEdit => ({ kind: "harness-edit", diagnosis: [{ unit: "u0", attempt: 1, revision: "abc1234", moment: "attempt-failed", evidence: ["e1"], signals: [] }], change: { profile: "implement", diff: "+ Run the inherited suite." }, prediction: predictionId });
  const propose = (id: string, predictionId: string): PolicyProposal => ({ id, timestamp: stamp(), source: "S4", kind: "policy-proposal", channel: "proposal", destination: "S5", severity: "advisory", subject: "advice/implement.md: run the inherited suite", rationale: "r", requestedChange: edit(predictionId), evidence: [] });
  await appendSignal(dir, propose("he1", "p1"));
  await appendSignal(dir, propose("he2", "p2"));
  let states = await readPredictions(dir);
  assert.deepEqual(states.map((s) => [s.signal.id, s.status, s.horizons[0]?.status, s.proposals]), [["p1", "awaiting-decision", "awaiting-decision", [{ messageId: "he1", profile: "implement" }]], ["p2", "awaiting-decision", "awaiting-decision", [{ messageId: "he2", profile: "implement" }]]], "unrouted: still awaiting");
  await routeMessages(ledger, { policy: routing, now: tick });
  const [o1, o2] = (await ledger.obligations()).filter((o) => o.concern === "policy-proposal");
  states = await readPredictions(dir);
  assert.deepEqual(states.map((s) => [s.status, s.proposals[0]?.obligationId, s.proposals[0]?.status]), [["awaiting-decision", o1!.id, "open"], ["awaiting-decision", o2!.id, "open"]]);

  // A unit closes while both are undecided: nothing is measured, because neither edit is in effect.
  const before = await resolvePredictions(dir, { unit: { unitId: "u1", unitType: "implement", status: "closed" }, measure: measuring(0), reports, routing, now: tick });
  assert.deepEqual(before.resolutions, []);

  tick();
  await ledger.resolve(o1!.id, { by: "alice", disposition: "accepted", rationale: "accepted. Prediction p1: live horizon open." });
  await ledger.resolve(o2!.id, { by: "alice", disposition: "rejected", rationale: "no" });
  const acceptedAt = (await ledger.get(o1!.id))?.closedAt;
  states = await readPredictions(dir);
  assert.deepEqual(states.map((s) => [s.signal.id, s.status, s.horizons[0]?.status, s.horizons[0]?.openedAt]), [["p1", "open", "open", acceptedAt], ["p2", "declined", "declined", undefined]]);
  assert.match(states[0]?.horizons[0]?.note ?? "", /open since alice accepted proposal he1 \(advice\/implement\.md\)/);
  assert.match(states[1]?.horizons[0]?.note ?? "", /proposal he2 was rejected by alice; the edit never took effect/);
  assert.deepEqual(states[0]?.proposals, [{ messageId: "he1", profile: "implement", obligationId: o1!.id, status: "resolved", disposition: "accepted", decidedAt: acceptedAt, decidedBy: "alice" }]);

  // The next two implement units resolve p1 and never p2; a disconfirmation names the accepted edit's file as what to revert or re-decide.
  const first = await resolvePredictions(dir, { unit: { unitId: "u2", unitType: "implement", status: "closed" }, measure: measuring(0), reports, routing, now: tick });
  assert.deepEqual(first.resolutions.map((r) => [r.predictionId, r.outcome]), [["p1", "confirmed"]]);
  const second = await resolvePredictions(dir, { unit: { unitId: "u3", unitType: "implement", status: "closed" }, measure: measuring(2), reports, routing, now: tick });
  assert.deepEqual(second.resolutions.map((r) => [r.predictionId, r.outcome]), [["p1", "disconfirmed"]]);
  assert.equal(second.proposals[0]?.subject, "prediction p1 disconfirmed at its live horizon: revert or re-decide regulator/advice/implement.md");
  assert.match(second.proposals[0]?.rationale ?? "", /and alice accepted proposal he1 on it/);
  assert.deepEqual(second.opened.map((o) => o.consumer), ["S5"]);
  states = await readPredictions(dir);
  assert.deepEqual(states.map((s) => [s.signal.id, s.status, s.summary.precision]), [["p1", "resolved", 0.5], ["p2", "declined", undefined]]);
});

test("probe horizon: it is open from the signal (a probe runs before anyone decides) and resolves once, from the committed report whose fingerprint it names, against the arm's interval; the baseline may be the probe's own arm; a report that is not committed resolves nothing", async (t) => {
  const dir = await root(t);
  const probe = (over: Partial<Prediction> = {}) => ({ ...prediction, horizons: [{ kind: "probe" as const, report: PROBE, arm: "advised", disconfirmedBy: 2 }], ...over });
  await appendSignal(dir, signal("pr-confirmed", { prediction: probe({ baseline: { arm: "control" } }) }));
  await appendSignal(dir, signal("pr-inconclusive", { prediction: probe({ baseline: { arm: "control" }, magnitude: 1.8 }) }));
  await appendSignal(dir, signal("pr-disconfirmed", { prediction: probe({ direction: "higher", magnitude: 1 }) }));
  await appendSignal(dir, signal("pr-elsewhere", { prediction: probe({ horizons: [{ kind: "probe", report: "c".repeat(64), arm: "advised", disconfirmedBy: 2 }] }) }));
  const probed = report(PROBE, { control: { refusals: summary(3) }, advised: { refusals: summary(1, 0.5) } }, "evals/reports/drift-probe.json");
  const without = await resolvePredictions(dir, { reports, routing, now: tick });
  assert.deepEqual(without.resolutions, [], "the probe report is not among the committed ones: nothing to read");
  const resolved = await resolvePredictions(dir, { reports: [...reports, probed], routing, now: tick });
  assert.deepEqual(resolved.resolutions.map((r) => [r.predictionId, r.outcome, r.observed, r.baseline, r.resolvedBy]), [
    ["pr-confirmed", "confirmed", 1, 3, { report: PROBE, arm: "advised" }],
    ["pr-inconclusive", "inconclusive", 1, 3, { report: PROBE, arm: "advised" }],
    ["pr-disconfirmed", "disconfirmed", 1, 1, { report: PROBE, arm: "advised" }],
  ]);
  assert.match(resolved.resolutions[0]?.reason ?? "", /observed 1 reaches 2 \(baseline 3 lower by 1\), as does its 95% interval \[0\.5, 1\.5\]/);
  assert.match(resolved.resolutions[1]?.reason ?? "", /the mean 1 reaches 1\.2 \(baseline 3 lower by 1\.8\) but its 95% interval \[0\.5, 1\.5\] does not/);
  assert.match(resolved.resolutions[2]?.reason ?? "", /observed 1 is at or past the disconfirming value 2 \(predicted higher\)/);
  assert.deepEqual(resolved.resolutions[0]?.evidence, [{ class: "file", ref: "evals/reports/drift-probe.json", observation: 'arm "advised": refusals mean 1 over 3 run(s), 95% interval [0.5, 1.5]' }], "the baseline arm is in the same report");
  assert.deepEqual(resolved.resolutions[2]?.evidence[1], { class: "file", ref: "evals/reports/drift-drifter.json", observation: "baseline 1" }, "a report baseline cites its own report");
  assert.deepEqual(resolved.proposals, [], "a disconfirmed probe informs the decision; only a disconfirmed live horizon raises an obligation");
  const again = await resolvePredictions(dir, { reports: [...reports, probed], routing, now: tick });
  assert.deepEqual(again.resolutions, [], "a probe resolves once");
  const states = await readPredictions(dir);
  assert.deepEqual(states.map((s) => [s.signal.id, s.status, s.horizons[0]?.status]), [["pr-confirmed", "resolved", "met"], ["pr-inconclusive", "resolved", "met"], ["pr-disconfirmed", "resolved", "met"], ["pr-elsewhere", "open", "open"]]);
  assert.deepEqual(baselineValue(probe({ baseline: { arm: "control" } }), reports), { problem: 'the baseline names arm "control" of a probe report, and a live horizon has none to read it from' }, "an arm-only baseline has no value at a live horizon");
  assert.deepEqual(baselineValue(prediction, []), { problem: `no committed report has fingerprint ${REPORT.slice(0, 12)}…` });
  assert.deepEqual(baselineValue({ ...prediction, metric: "tokens" }, reports), { problem: 'report evals/reports/drift-drifter.json has no summary of tokens for arm "treatment"' });
});

test("the host's reading of a harness-edit (#138): every diagnosis reference resolves in the stores — the unit, the attempt, the moment in its trajectory, the evidence at that revision, the signals — and the prediction names an intelligence signal carrying the block; each miss is named, and a plain proposal is never read this way", async (t) => {
  const dir = await root(t);
  const store = new ExecutionStore(dir, tick);
  const contract: WorkContract = {
    kind: "task", id: "tc-1", version: 1, unitId: "u1", unitType: "implement", workload: { name: "software-development", version: 1 },
    objective: "o", constraintRefs: [], fixed: [], delegated: [], unresolved: [], expectedEvidence: [], provenance: { createdBy: "S3", createdAt: "t" },
  };
  await store.createUnit(contract);
  await store.setStatus("u1", "dispatched");
  await store.recordAttempt({ unitId: "u1", contractVersion: 1, startedAt: "2026-10-26T10:00:01.000Z", endedAt: "2026-10-26T10:00:09.000Z", outcome: "check-failure", detail: "run_tests failed" });
  await store.setStatus("u1", "blocked", "audit refused closeout");
  const audit = new AuditLog(dir);
  await audit.appendEvidence({ id: "e1", unitId: "u1", attempt: 1, contract: { id: "tc-1", version: 1 }, check: "run_tests", class: "test", criteria: [], verdict: "fail", observation: "1 failed", revision: "abc1234", environment: { node: "v22", platform: "linux", arch: "x64" }, producedBy: "S3*", at: "2026-10-26T10:00:08.000Z" });
  await audit.appendVerdict({ id: "v1", unitId: "u1", attempt: 1, contract: { id: "tc-1", version: 1 }, revision: "abc1234", verdict: "fail", evidence: ["e1"], satisfied: [], failed: ["e-tests"], missing: [], stale: [], contradicted: [], awaitingAcceptance: [], reasons: ["run_tests — 1 failed"], decidedBy: "S3*", at: "2026-10-26T10:00:08.500Z" });
  await appendSignal(dir, { id: "f1", timestamp: stamp(), source: "S3*", kind: "audit-finding", channel: "audit", destination: "S3", severity: "blocking", subject: "unit u1: closeout refused (fail)", unit: "u1", observation: "o", evidence: [] });
  await appendSignal(dir, { id: "f2", timestamp: stamp(), source: "S3*", kind: "audit-finding", channel: "audit", destination: "S3", severity: "blocking", subject: "unit u9: closeout refused (fail)", unit: "u9", observation: "o", evidence: [] });
  await appendSignal(dir, signal("p1"));
  await appendSignal(dir, signal("bare", { prediction: undefined }));
  const edit: HarnessEdit = { kind: "harness-edit", diagnosis: [{ unit: "u1", attempt: 1, revision: "abc1234", moment: "attempt-failed", evidence: ["e1"], signals: ["f1"] }], change: { profile: "implement", diff: "+ Run the inherited suite before reporting." }, prediction: "p1" };
  assert.deepEqual(await checkHarnessEdit(dir, edit, { declaredProfiles: ["implement", "research"] }), [], "resolves");
  assert.deepEqual(await checkHarnessEdit(dir, { ...edit, diagnosis: [{ ...edit.diagnosis[0]!, unit: "u2" }] }), ['diagnosis[0]: unit "u2" is not in the execution store']);
  assert.deepEqual(await checkHarnessEdit(dir, { ...edit, diagnosis: [{ ...edit.diagnosis[0]!, attempt: 2 }] }), ['diagnosis[0]: unit "u1" has no attempt 2 (1 recorded)']);
  assert.deepEqual(await checkHarnessEdit(dir, { ...edit, diagnosis: [{ ...edit.diagnosis[0]!, moment: "reintegrated" }] }), ['diagnosis[0]: unit "u1" never passed through "reintegrated" (its trajectory: dispatch → attempt-failed)']);
  assert.deepEqual(await checkHarnessEdit(dir, { ...edit, diagnosis: [{ ...edit.diagnosis[0]!, evidence: ["e2"], signals: ["f2", "nope"] }] }), [
    'diagnosis[0]: evidence "e2" is not in the audit log for unit "u1"',
    'diagnosis[0]: signal "f2" is about unit "u9", not "u1"',
    'diagnosis[0]: signal "nope" is not in the regulatory log',
  ]);
  assert.deepEqual(await checkHarnessEdit(dir, { ...edit, diagnosis: [{ ...edit.diagnosis[0]!, revision: "def5678" }] }), ['diagnosis[0]: evidence "e1" was read at revision abc1234, not def5678']);
  assert.deepEqual(await checkHarnessEdit(dir, { ...edit, diagnosis: [{ ...edit.diagnosis[0]!, evidence: [], signals: [] }] }), ["diagnosis[0]: names no evidence record and no signal; a diagnosis references what was observed"]);
  assert.deepEqual(await checkHarnessEdit(dir, { ...edit, change: { profile: "deployer", diff: "x" } }, { declaredProfiles: ["implement"] }), ['change: profile "deployer" is not one the definition declares (implement)']);
  assert.deepEqual(await checkHarnessEdit(dir, { ...edit, prediction: "missing" }), ['prediction: "missing" names no message in the regulatory log']);
  assert.deepEqual(await checkHarnessEdit(dir, { ...edit, prediction: "f1" }), ['prediction: "f1" is an audit-finding, not an intelligence signal']);
  assert.deepEqual(await checkHarnessEdit(dir, { ...edit, prediction: "bare" }), ['prediction: intelligence signal "bare" carries no prediction block (metric, baseline, direction, magnitude, probability, horizons)']);
  assert.deepEqual(foldPredictions(await readEntries(dir)).map((s) => s.signal.id), ["p1"], "the fold sees the one signal with a block");
});
