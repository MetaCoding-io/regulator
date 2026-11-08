import assert from "node:assert/strict";
import test from "node:test";
import type { AttemptRecord, ObligationState, RecoveryDecision, TechnicalVerdict, UnitRecord } from "@metacoding.io/regulator-protocol";
import { UNIT_TRANSITIONS, UNIT_TRIGGERS } from "@metacoding.io/regulator-protocol";
import { unitTrajectory } from "./trajectory.js";

const T = (n: number) => `2026-10-13T10:${String(n).padStart(2, "0")}:00.000Z`;

function unit(overrides: Partial<UnitRecord> = {}): UnitRecord {
  return { unitId: "u1", unitType: "implement", workload: { name: "software-development", version: 1 }, contract: { id: "tc-1", version: 1 }, status: "closed", attempts: 2, createdAt: T(0), updatedAt: T(30), ...overrides };
}
function attempt(n: number, startedAt: string, endedAt: string, outcome: AttemptRecord["outcome"], detail?: string): AttemptRecord {
  return { unitId: "u1", attempt: n, contractVersion: 1, startedAt, endedAt, outcome, sessionId: `s${n}`, ...(detail ? { detail } : {}) };
}
function verdict(n: number, at: string, v: TechnicalVerdict["verdict"], extra: Partial<TechnicalVerdict> = {}): TechnicalVerdict {
  return { id: `v${n}`, unitId: "u1", attempt: n, contract: { id: "tc-1", version: 1 }, revision: "abcdef0123", verdict: v, evidence: ["e1"], satisfied: [], failed: [], missing: [], stale: [], contradicted: [], awaitingAcceptance: [], reasons: [], decidedBy: "S3*", at, ...extra };
}
function decision(n: number, at: string, cause: RecoveryDecision["cause"], action: RecoveryDecision["action"], extra: Partial<RecoveryDecision> = {}): RecoveryDecision {
  return { id: `d${n}`, unitId: "u1", attempt: n, cause, occurrence: 1, evidence: [`attempt ${n}: ${cause}`], action, policy: { name: "recovery", version: 2 }, rationale: `recovery v2 rule for ${cause}, occurrence 1 → ${action}`, decidedAt: at, decidedBy: "S3", ...extra };
}

test("the table is closed and consistent: every trigger is used, every row's step is a loop step, and the terminal statuses have no way out", () => {
  const used = new Set(UNIT_TRANSITIONS.map((t) => t.on));
  assert.deepEqual([...UNIT_TRIGGERS].filter((t) => !used.has(t)), [], "a trigger nothing takes is a word, not a transition");
  assert.deepEqual(UNIT_TRANSITIONS.filter((t) => t.from === "closed" || t.from === "aborted"), [], "closed and aborted are terminal");
  assert.deepEqual([...new Set(UNIT_TRANSITIONS.map((t) => t.by))].sort(), ["closeUnit", "finishUnit", "routeUnit", "runUnit"]);
  for (const from of ["contracted", "dispatched", "reported", "blocked"] as const) assert.ok(UNIT_TRANSITIONS.some((t) => t.from === from), `${from} leads somewhere`);
});

test("a refused attempt, a repair and a close replay as a path through the table, each step saying why from the records", () => {
  const t = unitTrajectory({
    unit: unit(),
    attempts: [attempt(1, T(1), T(5), "check-failure", "fail — e-tests (test): failed"), attempt(2, T(10), T(20), "reported")],
    decisions: [decision(1, T(6), "check-failure", "repair", { hint: "Host-run verification refused closeout: fix the code." })],
    verdicts: [verdict(1, T(5), "fail", { failed: ["e-tests"], reasons: ["e-tests (test): run_tests failed at abcdef0"] }), verdict(2, T(20), "pass", { satisfied: ["e-tests"] })],
    obligations: [],
    attemptCeiling: 3,
  });
  assert.equal(t.problem, undefined);
  assert.equal(t.final, "closed");
  assert.deepEqual(t.steps.map((s) => [s.index, s.event, s.from, s.to, s.transition ?? null]), [
    [1, "contracted", "contracted", "contracted", null],
    [2, "attempt-started", "contracted", "dispatched", "dispatch"],
    [3, "attempt-ended", "dispatched", "blocked", "attempt-failed"],
    [4, "decision", "blocked", "blocked", null],
    [5, "attempt-started", "blocked", "dispatched", "dispatch"],
    [6, "attempt-ended", "dispatched", "reported", "verified"],
    [7, "reintegration", "reported", "closed", "reintegrated"],
  ]);
  assert.deepEqual(t.steps.map((s) => s.by ?? null), [null, "runUnit", "runUnit", null, "runUnit", "runUnit", "finishUnit"]);
  const refused = t.steps[2]!;
  assert.equal(refused.regulator, "reg.audit.closeout-gate.v1");
  assert.ok(refused.why.includes("failed: e-tests"), "the verdict's failed criteria are the why");
  assert.ok(refused.why.includes("e-tests (test): run_tests failed at abcdef0"));
  assert.deepEqual(refused.cites, ["v1"]);
  const routed = t.steps[3]!;
  assert.equal(routed.regulator, "reg.control.recovery-router.v1");
  assert.equal(routed.why[0], "recovery v2 rule for check-failure, occurrence 1 → repair");
  assert.ok(routed.why.some((w) => w.startsWith("hint for the next attempt: Host-run")));
  const resumed = t.steps[4]!;
  assert.equal(resumed.why[0], "attempt 2 of 3 under contract tc-1 v1");
  assert.ok(resumed.why[1]!.startsWith("routed under recovery v2: check-failure → repair (occurrence 1)"), resumed.why[1]);
  assert.deepEqual(resumed.cites, ["d1", "session s2"]);
  assert.equal(t.steps[6]!.regulator, "reg.coordination.reintegration.v1");
  assert.equal(t.steps[6]!.at, T(30), "reintegration leaves no record of its own: it is placed when the record was last written");
});

test("a reintegration the trial refused is placed before the decision that routed it, from the decision's evidence", () => {
  const t = unitTrajectory({
    unit: unit({ status: "closed", attempts: 2 }),
    attempts: [attempt(1, T(1), T(5), "reported"), attempt(2, T(10), T(20), "reported")],
    decisions: [decision(1, T(7), "conflict", "repair", { evidence: ["attempt 1: reported", "unit: reintegration: conflict — pre-merge:run_tests failed on the trial commit"] })],
    verdicts: [verdict(1, T(5), "pass"), verdict(2, T(20), "pass")],
    obligations: [],
  });
  assert.equal(t.problem, undefined);
  assert.deepEqual(t.steps.map((s) => [s.event, s.to, s.transition ?? null]), [
    ["contracted", "contracted", null], ["attempt-started", "dispatched", "dispatch"], ["attempt-ended", "reported", "verified"],
    ["reintegration", "blocked", "reintegration-refused"], ["decision", "blocked", null],
    ["attempt-started", "dispatched", "dispatch"], ["attempt-ended", "reported", "verified"], ["reintegration", "closed", "reintegrated"],
  ]);
  assert.equal(t.steps[3]!.at, T(7));
  assert.equal(t.steps[3]!.regulator, "reg.audit.pre-merge-trial.v1");
  assert.deepEqual(t.steps[3]!.why, ["unit: reintegration: conflict — pre-merge:run_tests failed on the trial commit"]);
});

test("a paused attempt waits on the question; the answer is why the next attempt starts; a waiting decision and an abort are self-loop and terminal moves", () => {
  const asked: ObligationState = {
    id: "ob-consent-1", subject: "consent: September rent", unit: "u1", concern: "interaction", sources: ["i1"], severity: "blocking", consumer: "human", blocks: true,
    question: "Pay the rent?", openedAt: T(4), openedBy: "S3", status: "resolved", acknowledgedBy: [], disposition: "accepted-risk", rationale: "yes", closedAt: T(8), closedBy: "alice", deliveries: [],
    history: [
      { type: "obligation-opened", id: "h1", at: T(4), by: "S3", obligation: { id: "ob-consent-1", subject: "consent: September rent", unit: "u1", concern: "interaction", sources: ["i1"], severity: "blocking", consumer: "human", blocks: true, question: "Pay the rent?", openedAt: T(4), openedBy: "S3" } },
      { type: "obligation-resolved", id: "h2", at: T(8), by: "alice", obligationId: "ob-consent-1", disposition: "accepted-risk", rationale: "yes" },
    ],
  };
  const t = unitTrajectory({
    unit: unit({ status: "aborted", attempts: 2, updatedAt: T(26) }),
    attempts: [attempt(1, T(1), T(5), "paused", "consent: September rent — Pay the rent? (obligation ob-conse)"), attempt(2, T(10), T(20), "no-report")],
    decisions: [decision(2, T(22), "no-report", "clarify", { question: "What is wanted?" }), decision(2, T(25), "no-report", "abort", { id: "d3", occurrence: 2 })],
    verdicts: [],
    obligations: [asked],
  });
  assert.equal(t.problem, undefined);
  assert.deepEqual(t.steps.map((s) => [s.event, s.from, s.to, s.transition ?? null]), [
    ["contracted", "contracted", "contracted", null],
    ["attempt-started", "contracted", "dispatched", "dispatch"],
    ["obligation-opened", "dispatched", "dispatched", null],
    ["attempt-ended", "dispatched", "blocked", "attempt-failed"],
    ["obligation-closed", "blocked", "blocked", null],
    ["attempt-started", "blocked", "dispatched", "dispatch"],
    ["attempt-ended", "dispatched", "blocked", "attempt-failed"],
    ["decision", "blocked", "blocked", "routed-waiting"],
    ["decision", "blocked", "aborted", "abort"],
  ]);
  assert.equal(t.steps[3]!.regulator, "reg.algedonic.pause-gate.v1");
  assert.ok(t.steps[2]!.why[1]!.includes("while open it vetoes dispatch and close"));
  assert.ok(t.steps[5]!.why.some((w) => w.startsWith("the question ob-conse (consent: September rent) was resolved by alice as accepted-risk: yes")), t.steps[5]!.why.join(" | "));
  assert.equal(t.steps[5]!.regulator, "reg.control.obligation-router.v1");
  assert.equal(t.steps[7]!.by, "routeUnit");
  assert.ok(t.steps[7]!.why.includes("question: What is wanted?"));
  assert.ok(t.steps[8]!.why.includes("the loop released the lease and removed the worktree"));
  assert.equal(t.final, "aborted");
});

test("a dispatch refused before any attempt is the unit's reason; a status the records cannot reach is a problem, not a guess", () => {
  const held = unitTrajectory({ unit: unit({ status: "blocked", attempts: 0, reason: "lease for unit u1 is held by bob until 2026-10-13T11:00:00.000Z", updatedAt: T(2) }), attempts: [], decisions: [], verdicts: [], obligations: [] });
  assert.equal(held.problem, undefined);
  assert.deepEqual(held.steps.map((s) => [s.event, s.to, s.transition ?? null]), [["contracted", "contracted", null], ["recorded", "blocked", "dispatch-refused"]]);
  assert.equal(held.steps[1]!.regulator, "reg.coordination.unit-lease.v1");
  assert.equal(held.steps[1]!.why[1], "lease for unit u1 is held by bob until 2026-10-13T11:00:00.000Z");

  const forged = unitTrajectory({ unit: unit({ status: "aborted", attempts: 1 }), attempts: [attempt(1, T(1), T(5), "no-report")], decisions: [], verdicts: [], obligations: [] });
  assert.equal(forged.final, "blocked");
  assert.match(forged.problem ?? "", /^the replay ends blocked but the record says aborted: no record-less transition joins them/);

  const skipped = unitTrajectory({ unit: unit({ status: "blocked", attempts: 1 }), attempts: [attempt(1, T(1), T(5), "no-report")], decisions: [decision(1, T(3), "no-report", "pause")], verdicts: [], obligations: [] });
  assert.match(skipped.problem ?? "", /^step 3 \(routed: no-report → pause\) takes routed-waiting from dispatched, which the loop does not declare \(from dispatched it declares attempt-failed, verified\): a record is missing or a status was written around the loop$/);
  assert.equal(skipped.final, "blocked", "after the problem the fold follows the records so the rest still reads");
});
