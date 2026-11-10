import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { RecoveryPolicy, UnitRecord, WorkContract } from "@metacoding.io/regulator-protocol";
import { EffectJournal, effectKey } from "./effect-journal.js";
import { ExecutionStore } from "./execution-store.js";
import type { AuditFinding } from "@metacoding.io/regulator-protocol";
import { CANARY_INVARIANT } from "./canary.js";
import { carriesLedger, causeFromError, causeUnderPolicy, classifyFailure, decideRecovery, hintFor, routeBlockedUnit } from "./recovery.js";

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

// The behavioral canary's finding as the identity extension records it (`regulator-pi/src/identity.ts`): advisory, S3* to S3, on the audit channel.
const silence = (timestamp: string, over: Partial<AuditFinding> = {}): AuditFinding => ({
  id: `f-${timestamp}`, timestamp, source: "S3*", kind: "audit-finding", channel: "audit", destination: "S3", severity: "advisory",
  subject: "behavioral canary silent", unit: "u1", invariant: CANARY_INVARIANT, observation: "prose the classifier never reads",
  evidence: [{ class: "runtime", ref: "message_end", observation: "2 consecutive replies without [u1]" }], ...over,
});
const during = (outcome: Parameters<typeof attempt>[0], detail?: string, n = 1) => ({ ...attempt(outcome, detail, n), startedAt: "2026-11-10T10:00:00.000Z", endedAt: "2026-11-10T10:30:00.000Z" });

test("classifyFailure (#133): the behavioral canary's finding on the attempt classifies a silent end as context-degradation, last in the precedence; on any other cause it is evidence on the decision and not the cause", () => {
  const c = (over: Partial<Parameters<typeof classifyFailure>[0]>) => classifyFailure({ unit: unit(), attempts: [during("no-report")], observations: [], signals: [silence("2026-11-10T10:05:00.000Z")], ...over });
  const silent = c({});
  assert.equal(silent.cause, "context-degradation", "no report, and the canary fell silent during the attempt");
  assert.equal(silent.otherwise, "no-report", "what the same records say without the finding: the cause a policy with no rule for it routes under");
  assert.deepEqual(silent.evidence, ["attempt 1: no-report", "S3* audit: context-degradation — the behavioral canary recorded 1 finding(s) during attempt 1, the first at 2026-11-10T10:05:00.000Z (2 consecutive replies without [u1])"]);
  assert.match(c({ signals: [silence("2026-11-10T10:05:00.000Z"), silence("2026-11-10T10:09:00.000Z", { evidence: [{ class: "runtime", ref: "message_end", observation: "4 consecutive replies without [u1]" }] })] }).evidence.at(-1) ?? "", /recorded 2 finding\(s\) .*first at 2026-11-10T10:05:00.000Z \(4 consecutive replies without \[u1\]\)/, "the re-fired finding is the same episode: the count and the latest run length");

  // Read by the invariant, the unit and the attempt's window — nothing else.
  assert.equal(c({ signals: [silence("2026-11-10T10:05:00.000Z", { observation: "the context may be degraded", subject: "context-degradation" , invariant: "INV-001" })] }).cause, "no-report", "the prose and the subject do not classify: the invariant does");
  assert.equal(c({ signals: [silence("2026-11-10T10:05:00.000Z", { unit: "u2" })] }).cause, "no-report", "another unit's silence");
  assert.equal(c({ signals: [silence("2026-11-10T09:59:59.000Z")] }).cause, "no-report", "a finding from before this attempt began: an earlier attempt's session, whose count is gone");
  assert.equal(c({ attempts: [during("no-report"), { ...attempt("no-report", undefined, 2), startedAt: "2026-11-10T10:31:00.000Z", endedAt: "2026-11-10T10:50:00.000Z" }], unit: unit({ attempts: 2 }) }).cause, "no-report", "attempt 1's silence does not classify attempt 2");
  assert.equal(c({ signals: [silence("2026-11-10T10:05:00.000Z", { severity: "blocking" })] }).cause, "context-degradation", "the severity is the routing policy's concern, not the classifier's");

  // The precedence is a rule: everything that names a failure a fresh context does not fix wins, and the silence stays evidence.
  const exhausted = c({ attempts: [during("budget-exhausted", "tokens ceiling crossed")] });
  assert.equal(exhausted.cause, "budget-exhausted", "nothing is left on the ledger a carried retry would spend");
  assert.equal(exhausted.otherwise, undefined);
  assert.match(exhausted.evidence.at(-1) ?? "", /^S3\* audit: context-degradation/, "a second observation, on the record");
  const refused = c({ attempts: [{ ...during("no-report"), outcome: "check-failure" as const, detail: "fail — run_tests" }] });
  assert.equal(refused.cause, "check-failure", "the closeout's refusal is routed as itself");
  assert.match(refused.evidence.at(-1) ?? "", /^S3\* audit: context-degradation/, "and its decision records that the canary was silent first: the lead-time instance the card asks for");
  assert.equal(c({ attempts: [during("invalid-report", "u-unicode missing")] }).cause, "invalid-report");
  assert.equal(c({ attempts: [during("error", "something odd")] }).cause, "tool-error");
  assert.equal(c({ unit: unit({ reason: "reintegration: conflict" }), attempts: [during("reported")] }).cause, "conflict");
  assert.equal(c({ signals: [silence("2026-11-10T10:05:00.000Z"), { id: "s", timestamp: "t", source: "S2", kind: "coordination-signal", channel: "signal", destination: "S3", severity: "advisory", subject: "src/a.js", unit: "u1", coordination: "oscillation", observation: "4 edits", evidence: [] }] }).cause, "oscillation", "S2's signal wins: an undecided requirement is not a tired context");
  assert.equal(c({ observations: [{ unitId: "u1", attempt: 1, at: "t", source: "tool", toolName: "run_tests", cause: "environment", message: "Cannot find module 'left-pad'" }] }).cause, "environment", "what the session observed wins: a missing dependency is still missing in a fresh session");
  assert.equal(c({ attempts: [during("reported")] }).cause, "unknown", "an attempt that reported is not a silent end");
});

test("causeUnderPolicy (#133): a cause that rests on an advisory finding is routed only under a rule the policy declares; a policy that names no rule for it routes the unit as if the finding were not there, never by its fallback", () => {
  const classified = { cause: "context-degradation" as const, evidence: [], otherwise: "no-report" as const };
  assert.equal(causeUnderPolicy(classified, policy), "no-report", "no rule for context-degradation: the silent end is a silent end");
  const adopting: RecoveryPolicy = { ...policy, rules: [...policy.rules, { cause: "context-degradation", actions: ["retry", "escalate"] }] };
  assert.equal(causeUnderPolicy(classified, adopting), "context-degradation", "one rule adopts the cause");
  assert.equal(causeUnderPolicy({ cause: "timeout", evidence: [] }, policy), "timeout", "any other unruled cause still takes the fallback: only an advisory cause has an otherwise");
  assert.equal(decideRecovery({ policy: adopting, cause: "context-degradation", occurrence: 1, attemptsUsed: 1, attemptCeiling: 3 }).action, "retry");
  assert.equal(decideRecovery({ policy: adopting, cause: "context-degradation", occurrence: 2, attemptsUsed: 2, attemptCeiling: 3 }).action, "escalate", "a second silent end under the cause is a person's");
  assert.equal(decideRecovery({ policy: adopting, cause: "context-degradation", occurrence: 1, attemptsUsed: 3, attemptCeiling: 3 }).action, "escalate", "the attempt ceiling caps it like any retry");
  assert.match(hintFor("context-degradation", "retry", ["attempt 1: no-report"]) ?? "", /fresh session on the same budget: what that attempt spent already counts against this one/);
  assert.equal(carriesLedger({ cause: "context-degradation", action: "retry" }), true, "the retry continues the degraded attempt's ledger");
  assert.equal(carriesLedger({ cause: "context-degradation", action: "escalate" }), false, "no attempt, nothing to carry");
  assert.equal(carriesLedger({ cause: "no-report", action: "retry" }), false, "every other retry opens a new ledger, as before");
  assert.equal(carriesLedger({ cause: "budget-exhausted", action: "retry" }), false);
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

test("routeBlockedUnit (#133): a silent attempt that carries the canary's finding is routed as no-report under a policy with no rule for the cause and as context-degradation under one that declares it; either decision carries the finding as evidence", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "regulator-route-canary-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new ExecutionStore(root, () => Date.parse("2026-11-10T10:30:00.000Z"));
  const contract: WorkContract = {
    kind: "task", id: "tc-1", version: 1, unitId: "u1", unitType: "implement", workload: { name: "software-development", version: 1 },
    objective: "o", constraintRefs: [], fixed: [], delegated: [], unresolved: [], expectedEvidence: [], provenance: { createdBy: "S3", createdAt: "t" },
  };
  await store.createUnit(contract);
  await store.recordAttempt({ unitId: "u1", contractVersion: 1, startedAt: "2026-11-10T10:00:00.000Z", endedAt: "2026-11-10T10:30:00.000Z", outcome: "no-report" });
  await store.setStatus("u1", "blocked", "the unit ended without calling report_result");
  const signals = [silence("2026-11-10T10:05:00.000Z")];

  const shipped = await routeBlockedUnit(store, { policy, unitId: "u1", attemptCeiling: 3, signals });
  assert.deepEqual([shipped?.cause, shipped?.action, shipped?.occurrence], ["no-report", "retry", 1], "no rule names the cause: routed as before, not paused by the fallback");
  assert.match(shipped?.evidence.at(-1) ?? "", /^S3\* audit: context-degradation/, "the silence is on the decision whichever cause routed it");
  assert.equal(carriesLedger(shipped!), false);

  const adopting: RecoveryPolicy = { ...policy, version: 4, rules: [...policy.rules, { cause: "context-degradation", actions: ["retry", "escalate"] }] };
  const routed = await routeBlockedUnit(store, { policy: adopting, unitId: "u1", attemptCeiling: 3, signals });
  assert.deepEqual([routed?.cause, routed?.action, routed?.occurrence, routed?.attempt], ["context-degradation", "retry", 1, 1]);
  assert.deepEqual(routed?.policy, { name: "recovery", version: 4 });
  assert.match(routed?.rationale ?? "", /recovery v4 rule for context-degradation, occurrence 1 → retry/);
  assert.match(routed?.hint ?? "", /fresh session on the same budget/);
  assert.equal(carriesLedger(routed!), true);
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
