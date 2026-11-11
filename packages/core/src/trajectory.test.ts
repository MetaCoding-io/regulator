import assert from "node:assert/strict";
import test from "node:test";
import type { AttemptRecord, ObligationState, RecoveryDecision, TechnicalVerdict, UnitRecord, UnitStatus, UnitTransitionRecord } from "@metacoding.io/regulator-protocol";
import { TERMINAL_UNIT_STATUSES, UNIT_TRANSITIONS, UNIT_TRIGGERS } from "@metacoding.io/regulator-protocol";
import { unitTrajectory } from "./trajectory.js";

const T = (n: number) => `2026-10-13T10:${String(n).padStart(2, "0")}:00.000Z`;

function unit(overrides: { status?: UnitStatus; attempts?: number; updatedAt?: string; reason?: string } = {}): UnitRecord {
  const base = { unitId: "u1", unitType: "implement", workload: { name: "software-development", version: 1 }, contract: { id: "tc-1", version: 1 }, attempts: overrides.attempts ?? 2, createdAt: T(0), updatedAt: overrides.updatedAt ?? T(30) };
  const status = overrides.status ?? "closed";
  // Only a blocked unit's record says why (#161).
  return status === "blocked" ? { ...base, status, reason: overrides.reason ?? "the unit ended without calling report_result" } : { ...base, status };
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
  // The table is a type now (#162): comparing a row's `from` with "closed" does not compile, because no row has it. The runtime reading, for the record:
  assert.deepEqual(UNIT_TRANSITIONS.filter((t) => TERMINAL_UNIT_STATUSES.has(t.from)), [], "closed and aborted are terminal");
  assert.equal(new Set(UNIT_TRANSITIONS.map((t) => `${t.from}/${t.on}`)).size, UNIT_TRANSITIONS.length, "a trigger names one row from a status: the store looks the target up by the pair");
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
  assert.deepEqual(t.steps[3]!.why, ["unit: reintegration: conflict — pre-merge:run_tests failed on the trial commit", RECONSTRUCTED]);
  // No history was given: the whole path is a reconstruction, and it says so, on the trajectory, on the first step and on every step whose move was inferred.
  assert.equal(t.basis, "reconstructed");
  assert.match(t.steps[0]!.why.at(-1)!, /^this unit has no status history: its moves were written before the store kept one \(#162\), so the path below is reconstructed from the attempt, verdict, decision and obligation records$/);
  assert.deepEqual(t.steps.map((s) => s.source ?? null), [null, "reconstructed", "reconstructed", "reconstructed", null, "reconstructed", "reconstructed", "reconstructed"]);
  assert.equal(t.steps[7]!.why.at(-1), RECONSTRUCTED);
});

const RECONSTRUCTED = "reconstructed: this unit has no status history for this move (it was written before the store kept one, #162), so it is placed here from the records beside it";
const line = <L extends UnitTransitionRecord>(l: L): UnitTransitionRecord => l;

test("with the status history the path is read, not inferred: the three moves that had no record of their own are lines, placed where the store wrote them (#162)", () => {
  const records = {
    unit: unit({ status: "closed", attempts: 2 }),
    attempts: [attempt(1, T(1), T(5), "reported"), attempt(2, T(10), T(20), "reported")],
    decisions: [decision(1, T(7), "conflict", "repair", { evidence: ["attempt 1: reported", "unit: reintegration: conflict — pre-merge:run_tests failed on the trial commit"] })],
    verdicts: [verdict(1, T(5), "pass"), verdict(2, T(20), "pass")],
    obligations: [],
  };
  const history = [
    line({ from: "contracted", to: "dispatched", on: "dispatch", at: T(1) }),
    line({ from: "dispatched", to: "reported", on: "verified", at: T(5) }),
    line({ from: "reported", to: "blocked", on: "reintegration-refused", at: T(6), reason: "reintegration: conflict — pre-merge:run_tests failed on the trial commit" }),
    line({ from: "blocked", to: "dispatched", on: "dispatch", at: T(10) }),
    line({ from: "dispatched", to: "reported", on: "verified", at: T(20) }),
    line({ from: "reported", to: "closed", on: "reintegrated", at: T(21) }),
  ];
  const t = unitTrajectory({ ...records, history });
  assert.equal(t.problem, undefined);
  assert.deepEqual([t.basis, t.final], ["history", "closed"]);
  assert.deepEqual(t.steps.map((s) => [s.event, s.from, s.to, s.transition ?? null, s.source ?? null]), [
    ["contracted", "contracted", "contracted", null, null],
    ["attempt-started", "contracted", "dispatched", "dispatch", "history"],
    ["attempt-ended", "dispatched", "reported", "verified", "history"],
    ["reintegration", "reported", "blocked", "reintegration-refused", "history"],
    ["decision", "blocked", "blocked", null, null],
    ["attempt-started", "blocked", "dispatched", "dispatch", "history"],
    ["attempt-ended", "dispatched", "reported", "verified", "history"],
    ["reintegration", "reported", "closed", "reintegrated", "history"],
  ]);
  // The refusal is its own line: its time is when the store wrote it (not the decision's), its reason is the line's, and it cites the history.
  const refused = t.steps[3]!;
  assert.deepEqual([refused.at, refused.title, refused.regulator, refused.by, refused.cites], [T(6), "reintegration refused", "reg.audit.pre-merge-trial.v1", "finishUnit", ["status.ndjson"]]);
  assert.equal(refused.why.at(-1), "reintegration: conflict — pre-merge:run_tests failed on the trial commit");
  assert.equal(refused.why.includes(RECONSTRUCTED), false);
  // Reintegration is when the store wrote it, not when the unit record was last touched.
  assert.deepEqual([t.steps[7]!.at, t.steps[7]!.title, t.steps[7]!.cites], [T(21), "reintegrated: closed", ["status.ndjson"]]);
  assert.equal(t.steps[0]!.why.length, 2, "nothing is said about reconstruction when nothing is reconstructed");
  // The why of a step the records explain is still the records': the history gives the move, never the reason.
  assert.ok(t.steps[5]!.why.some((w) => w.startsWith("routed under recovery v2: conflict → repair")));

  // The same records with no history reconstruct the same path; the difference is where the refusal is placed, and that it says it was placed.
  const legacy = unitTrajectory(records);
  assert.deepEqual(legacy.steps.map((s) => [s.event, s.from, s.to, s.transition ?? null]), t.steps.map((s) => [s.event, s.from, s.to, s.transition ?? null]));
  assert.deepEqual([legacy.basis, legacy.steps[3]!.at, legacy.steps[7]!.at], ["reconstructed", T(7), T(30)]);
});

test("the three rows that share blocked → blocked are told apart by the trigger the store wrote, not by the record beside them (#162)", () => {
  const t = unitTrajectory({
    unit: unit({ status: "blocked", attempts: 1, reason: "lease for unit u1 is held by bob until 2026-10-13T11:00:00.000Z", updatedAt: T(9) }),
    attempts: [attempt(1, T(1), T(5), "check-failure", "inconclusive — awaiting acceptance e-wording")],
    decisions: [decision(1, T(6), "check-failure", "pause")],
    verdicts: [verdict(1, T(5), "inconclusive", { awaitingAcceptance: ["e-wording"] }), verdict(1, T(8), "inconclusive", { id: "v1b", awaitingAcceptance: ["e-wording"] })],
    obligations: [],
    history: [
      line({ from: "contracted", to: "dispatched", on: "dispatch", at: T(1) }),
      line({ from: "dispatched", to: "blocked", on: "attempt-failed", at: T(5), reason: "audit refused closeout: inconclusive" }),
      line({ from: "blocked", to: "blocked", on: "routed-waiting", at: T(6), reason: "awaiting pause: check-failure (recovery v2)" }),
      line({ from: "blocked", to: "blocked", on: "re-audit-refused", at: T(8), reason: "audit refused closeout: inconclusive" }),
      line({ from: "blocked", to: "blocked", on: "dispatch-refused", at: T(9), reason: "lease for unit u1 is held by bob until 2026-10-13T11:00:00.000Z" }),
    ],
  });
  assert.equal(t.problem, undefined);
  assert.deepEqual(t.steps.filter((s) => s.from === "blocked" && s.to === "blocked").map((s) => [s.event, s.transition, s.by, s.source]), [
    ["decision", "routed-waiting", "routeUnit", "history"],
    ["re-audit", "re-audit-refused", "closeUnit", "history"],
    ["recorded", "dispatch-refused", "runUnit", "history"],
  ]);
  assert.deepEqual([t.final, t.basis], ["blocked", "history"]);
  assert.equal(t.steps.at(-1)!.why.at(-1), "lease for unit u1 is held by bob until 2026-10-13T11:00:00.000Z");
});

test("where the history and the records disagree the trajectory says so; a history that begins partway is not read, and the path is reconstructed whole (#162)", () => {
  const base = { decisions: [], verdicts: [], obligations: [] };
  // A unit that has not moved has an empty history, and that is its whole path.
  const fresh = unitTrajectory({ ...base, unit: unit({ status: "contracted", attempts: 0 }), attempts: [], history: [] });
  assert.deepEqual([fresh.steps.length, fresh.basis, fresh.final, fresh.problem], [1, "history", "contracted", undefined]);

  // A transition with no record beside it: the store wrote it, so it is taken, and the missing record is named.
  const noRecord = unitTrajectory({ ...base, unit: unit({ status: "blocked", attempts: 0 }), attempts: [], history: [line({ from: "contracted", to: "dispatched", on: "dispatch", at: T(1) }), line({ from: "dispatched", to: "blocked", on: "attempt-failed", at: T(5), reason: "the unit ended without calling report_result" })] });
  assert.match(noRecord.problem ?? "", /^line 1 of the status history \(dispatch: contracted → dispatched at 2026-10-13T10:01:00\.000Z\) has no record beside it: the store wrote the transition, and the attempt, verdict or decision that should say why is missing$/);
  assert.deepEqual(noRecord.steps.map((s) => [s.event, s.to, s.transition ?? null]), [["contracted", "contracted", null], ["recorded", "dispatched", "dispatch"], ["recorded", "blocked", "attempt-failed"]]);
  assert.equal(noRecord.final, "blocked");

  // A record with no transition: shown where it falls, and the unit does not move for it.
  const noLine = unitTrajectory({ ...base, unit: unit({ status: "dispatched", attempts: 1 }), attempts: [attempt(1, T(1), T(5), "no-report")], history: [line({ from: "contracted", to: "dispatched", on: "dispatch", at: T(1) })] });
  assert.match(noLine.problem ?? "", /^step 3 \(attempt 1 ended: no-report\) is a record of attempt-failed, and the status history has no attempt-failed after its line 1: the record was written and the transition was not$/);
  assert.deepEqual(noLine.steps.map((s) => [s.event, s.from, s.to, s.transition ?? null]), [["contracted", "contracted", "contracted", null], ["attempt-started", "contracted", "dispatched", "dispatch"], ["attempt-ended", "dispatched", "dispatched", null]]);

  // The history ends where the unit record does not: one of the two writes of a transition did not land, or the record was edited.
  const forged = unitTrajectory({ ...base, unit: unit({ status: "aborted", attempts: 1 }), attempts: [attempt(1, T(1), T(5), "no-report")], history: [line({ from: "contracted", to: "dispatched", on: "dispatch", at: T(1) }), line({ from: "dispatched", to: "blocked", on: "attempt-failed", at: T(5), reason: "the unit ended without calling report_result" })] });
  assert.equal(forged.problem, "the status history ends blocked and the unit record says aborted: a transition reached one and not the other, or the record was written around the store");

  // A history whose lines do not join: every line is a row of the table, and the path through them is not one.
  const broken = unitTrajectory({ ...base, unit: unit({ status: "closed", attempts: 1 }), attempts: [attempt(1, T(1), T(5), "no-report")], history: [line({ from: "contracted", to: "dispatched", on: "dispatch", at: T(1) }), line({ from: "dispatched", to: "blocked", on: "attempt-failed", at: T(5), reason: "r" }), line({ from: "reported", to: "closed", on: "reintegrated", at: T(9) })] });
  assert.match(broken.problem ?? "", /^line 3 of the status history \(reintegrated: reported → closed at .*\) leaves reported, and the line before it left the unit blocked: a line is missing, or one was written around the store$/);

  // A unit an older build ran and this one resumed: its history begins at blocked. Nothing is read from it.
  const partial = unitTrajectory({
    ...base, unit: unit({ status: "closed", attempts: 2 }),
    attempts: [attempt(1, T(1), T(5), "no-report"), attempt(2, T(10), T(20), "reported")], decisions: [decision(1, T(6), "no-report", "retry")], verdicts: [verdict(2, T(20), "pass")],
    history: [line({ from: "blocked", to: "dispatched", on: "dispatch", at: T(10) }), line({ from: "dispatched", to: "reported", on: "verified", at: T(20) }), line({ from: "reported", to: "closed", on: "reintegrated", at: T(21) })],
  });
  assert.deepEqual([partial.basis, partial.final, partial.problem], ["reconstructed", "closed", undefined]);
  assert.match(partial.steps[0]!.why.at(-1)!, /^this unit's status history begins partway \(its first line leaves blocked, not contracted\): its earlier moves were written before the store kept a history \(#162\), so the whole path below is reconstructed .*, and the history is not read$/);
  assert.equal(partial.steps.at(-1)!.at, T(30), "reconstructed: reintegration is placed at the record's last write, as before");
  assert.ok(partial.steps.filter((s) => s.transition).every((s) => s.source === "reconstructed"));
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
