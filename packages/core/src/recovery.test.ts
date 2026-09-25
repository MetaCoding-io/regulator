import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { RecoveryPolicy, UnitRecord, WorkContract } from "@metacoding.io/regulator-protocol";
import { EffectJournal, effectKey } from "./effect-journal.js";
import { ExecutionStore } from "./execution-store.js";
import { causeFromError, classifyFailure, decideRecovery, hintFor, routeBlockedUnit } from "./recovery.js";

const policy: RecoveryPolicy = {
  name: "recovery", version: 3, description: "d",
  rules: [
    { cause: "no-report", actions: ["retry", "retry", "escalate"] },
    { cause: "invalid-report", actions: ["repair", "repair", "escalate"] },
    { cause: "budget-exhausted", actions: ["retry", "replan"] },
    { cause: "environment", actions: ["remediate", "escalate"] },
    { cause: "oscillation", actions: ["clarify"] },
    { cause: "conflict", actions: ["repair", "escalate"] },
  ],
  fallback: ["pause"],
};

const unit = (over: Partial<UnitRecord> = {}): UnitRecord => ({
  unitId: "u1", unitType: "implement", workload: { name: "software-development", version: 1 }, contract: { id: "tc-1", version: 1 },
  status: "blocked", attempts: 1, createdAt: "t", updatedAt: "t", ...over,
});
const attempt = (outcome: "reported" | "no-report" | "invalid-report" | "budget-exhausted" | "error", detail?: string, n = 1) =>
  ({ unitId: "u1", attempt: n, contractVersion: 1, startedAt: "a", endedAt: "b", outcome, ...(detail === undefined ? {} : { detail }) });

test("classifyFailure: the orchestrator's record decides first, then S2's signals, then the session's observations; error text normalizes to environment, timeout or tool-error", () => {
  const c = (over: Partial<Parameters<typeof classifyFailure>[0]>) => classifyFailure({ unit: unit(), attempts: [], observations: [], signals: [], ...over }).cause;
  assert.equal(c({ attempts: [attempt("budget-exhausted", "tokens ceiling crossed")] }), "budget-exhausted");
  assert.equal(c({ attempts: [attempt("invalid-report", "u-unicode missing")] }), "invalid-report");
  assert.equal(c({ unit: unit({ reason: "reintegration: conflict" }), attempts: [attempt("reported")] }), "conflict");
  assert.equal(c({ unit: unit({ reason: "reintegration: dirty-base" }), attempts: [attempt("reported")] }), "environment");
  assert.equal(c({ attempts: [attempt("error", "extension load errors: Cannot find module 'x'")] }), "environment");
  assert.equal(c({ attempts: [attempt("error", "Test command timed out after 120000 ms")] }), "timeout");
  assert.equal(c({ attempts: [attempt("error", "something odd")] }), "tool-error");
  assert.equal(c({ attempts: [attempt("error")] }), "dispatch-error");
  assert.equal(c({ attempts: [attempt("no-report")], signals: [{ id: "s", timestamp: "t", source: "S2", kind: "coordination-signal", channel: "signal", destination: "S3", severity: "advisory", subject: "src/a.js", unit: "u1", coordination: "oscillation", observation: "4 edits", evidence: [] }] }), "oscillation");
  assert.equal(c({ attempts: [attempt("no-report")], signals: [{ id: "s", timestamp: "t", source: "S2", kind: "coordination-signal", channel: "signal", destination: "S3", severity: "advisory", subject: "src/a.js", unit: "u2", coordination: "oscillation", observation: "4 edits", evidence: [] }] }), "no-report", "another unit's signal is not this unit's cause");
  assert.equal(c({ attempts: [attempt("no-report")], observations: [{ unitId: "u1", attempt: 1, at: "t", source: "tool", toolName: "run_tests", cause: "environment", message: "Cannot find module 'left-pad'" }] }), "environment", "a silent end is refined by what the session observed");
  assert.equal(c({ attempts: [attempt("no-report")], observations: [{ unitId: "u1", attempt: 1, at: "t", source: "tool", toolName: "report_result", cause: "invalid-report", message: "Report refused" }] }), "invalid-report", "a refused report_result is the session's observation of an invalid report");
  assert.equal(c({ attempts: [attempt("no-report")], observations: [{ unitId: "u1", attempt: 2, at: "t", source: "tool", cause: "environment", message: "old" }] }), "no-report", "observations from another attempt do not count");
  assert.equal(c({ unit: unit({ attempts: 0, reason: "resource … is leased by unit \"u1\"" }) }), "dispatch-error");
  assert.equal(c({ unit: unit({ attempts: 0 }) }), "unknown");
  const { evidence } = classifyFailure({ unit: unit({ reason: "budget exhausted: tokens" }), attempts: [attempt("budget-exhausted", "tokens ceiling crossed at t")], observations: [{ unitId: "u1", attempt: 1, at: "t", source: "tool", toolName: "bash", cause: "tool-error", message: "exit 1" }], signals: [] });
  assert.deepEqual(evidence, ["attempt 1: budget-exhausted — tokens ceiling crossed at t", "unit: budget exhausted: tokens", "tool bash: tool-error — exit 1"]);
  assert.equal(causeFromError("ECONNREFUSED 127.0.0.1:443"), "environment");
});

test("decideRecovery: the Nth occurrence takes the Nth action and the last repeats; an attempt-spending action with no attempts left becomes escalate; an unruled cause takes the fallback", () => {
  const d = (cause: Parameters<typeof decideRecovery>[0]["cause"], occurrence: number, attemptsUsed = 1, attemptCeiling = 3) => decideRecovery({ policy, cause, occurrence, attemptsUsed, attemptCeiling });
  assert.equal(d("no-report", 1).action, "retry");
  assert.equal(d("no-report", 2).action, "retry");
  assert.equal(d("no-report", 3).action, "escalate");
  assert.equal(d("no-report", 9).action, "escalate");
  assert.match(d("no-report", 9).rationale, /last action repeats/);
  assert.equal(d("oscillation", 1).action, "clarify");
  assert.equal(d("budget-exhausted", 2).action, "replan");
  const spent = d("no-report", 1, 3, 3);
  assert.equal(spent.action, "escalate");
  assert.match(spent.rationale, /names retry; the unit has used 3 of 3 attempt\(s\), so the policy is exhausted/);
  assert.equal(d("environment", 1, 3, 3).action, "remediate", "remediate does not spend an attempt");
  assert.equal(d("timeout", 1).action, "pause");
  assert.match(d("timeout", 1).rationale, /fallback \(no rule for timeout\)/);
  assert.match(d("no-report", 1).rationale, /recovery v3 rule for no-report, occurrence 1 → retry/);
  assert.match(hintFor("invalid-report", "repair", ["u-unicode missing"]) ?? "", /report_result was refused: u-unicode missing/);
  assert.equal(hintFor("oscillation", "clarify", []), undefined, "only attempt-spending actions carry a hint");
});

test("routeBlockedUnit: records one immutable decision per routed failure, counting occurrences per cause, citing the policy version; a unit that is not blocked is not routed", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "regulator-route-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new ExecutionStore(root, () => 1_700_000_000_000);
  const contract: WorkContract = {
    kind: "task", id: "tc-1", version: 1, unitId: "u1", unitType: "implement", workload: { name: "software-development", version: 1 },
    objective: "o", constraintRefs: [], fixed: [], delegated: [], unresolved: [], expectedEvidence: [], provenance: { createdBy: "S3", createdAt: "t" },
  };
  await store.createUnit(contract);
  assert.equal(await routeBlockedUnit(store, { policy, unitId: "u1", attemptCeiling: 3, signals: [] }), undefined, "contracted, not blocked");

  await store.recordAttempt({ unitId: "u1", contractVersion: 1, startedAt: "a", endedAt: "b", outcome: "no-report" });
  await store.setStatus("u1", "blocked", "the unit ended without calling report_result");
  const first = await routeBlockedUnit(store, { policy, unitId: "u1", attemptCeiling: 3, signals: [], now: () => 1_700_000_000_000 });
  assert.equal(first?.cause, "no-report");
  assert.equal(first?.action, "retry");
  assert.equal(first?.occurrence, 1);
  assert.deepEqual(first?.policy, { name: "recovery", version: 3 });
  assert.equal(first?.decidedBy, "S3");
  assert.match(first?.hint ?? "", /ended without a report/);

  await store.recordAttempt({ unitId: "u1", contractVersion: 1, startedAt: "a", endedAt: "b", outcome: "no-report" });
  await store.recordObservation({ unitId: "u1", attempt: 2, at: "t", source: "tool", toolName: "run_tests", cause: "environment", message: "Cannot find module 'left-pad'" });
  const second = await routeBlockedUnit(store, { policy, unitId: "u1", attemptCeiling: 3, signals: [] });
  assert.equal(second?.cause, "environment", "the observation refined the silent end");
  assert.equal(second?.action, "remediate");
  assert.equal(second?.occurrence, 1, "occurrences count per cause");

  await store.recordAttempt({ unitId: "u1", contractVersion: 1, startedAt: "a", endedAt: "b", outcome: "no-report" });
  const third = await routeBlockedUnit(store, { policy, unitId: "u1", attemptCeiling: 3, signals: [] });
  assert.equal(third?.cause, "no-report");
  assert.equal(third?.occurrence, 2);
  assert.equal(third?.action, "escalate", "retry is named, but 3 of 3 attempts are used");

  const decisions = await store.listDecisions("u1");
  assert.deepEqual(decisions.map((d) => [d.cause, d.action, d.occurrence]), [["no-report", "retry", 1], ["environment", "remediate", 1], ["no-report", "escalate", 2]]);
  assert.equal(new Set(decisions.map((d) => d.id)).size, 3);
});

test("effect journal: intend before acting, commit after; a committed key is never acted on again; a crash between the two is reconciled against the world, not assumed", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "regulator-effects-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  let clock = 1_700_000_000_000;
  const journal = new EffectJournal(root, () => clock);
  const key = effectKey("u1", "notify_owner", { message: "done" });
  assert.equal(key, effectKey("u1", "notify_owner", { message: "done" }), "same intention, same key");
  assert.notEqual(key, effectKey("u2", "notify_owner", { message: "done" }));

  const first = await journal.begin({ key, unitId: "u1", tool: "notify_owner", description: "notify: done" });
  assert.equal(first.proceed, true);
  assert.equal(first.prior, undefined);
  await journal.commit(key, "sent #1");
  const again = await journal.begin({ key, unitId: "u1", tool: "notify_owner", description: "notify: done" });
  assert.equal(again.proceed, false, "already committed: do not send twice");
  assert.equal(again.prior?.result, "sent #1");

  // The crash: intention written, effect done in the world, process dies before commit.
  const crashed = effectKey("u1", "notify_owner", { message: "second" });
  const world = new Set<string>();
  await journal.begin({ key: crashed, unitId: "u1", tool: "notify_owner", description: "notify: second" });
  world.add(crashed);
  // Restart: the intention is pending; the world says it happened.
  assert.deepEqual((await journal.pending()).map((p) => p.key), [crashed]);
  clock += 1000;
  const reconciled = await journal.reconcile(async (state) => world.has(state.key));
  assert.deepEqual(reconciled.map((r) => [r.key, r.status]), [[crashed, "confirmed"]]);
  assert.equal((await journal.begin({ key: crashed, unitId: "u1", tool: "notify_owner", description: "notify: second" })).proceed, false, "confirmed counts as done");

  // And one that did not happen: absent, so it may be intended again.
  const lost = effectKey("u1", "notify_owner", { message: "third" });
  await journal.begin({ key: lost, unitId: "u1", tool: "notify_owner", description: "notify: third" });
  const gone = await journal.reconcile(async () => false);
  assert.deepEqual(gone.map((r) => r.status), ["absent"]);
  const redo = await journal.begin({ key: lost, unitId: "u1", tool: "notify_owner", description: "notify: third" });
  assert.equal(redo.proceed, true);
  assert.equal(redo.prior?.status, "absent");
  assert.deepEqual((await journal.states()).map((s) => s.status), ["committed", "confirmed", "intended"]);
  await assert.rejects(journal.commit("nope", "x"), /no intention recorded/);
});
