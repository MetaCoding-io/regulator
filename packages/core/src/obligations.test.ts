import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import type { RecoveryDecision, RoutingPolicy, VsmMessage } from "@metacoding/vsm-pi-protocol";
import { ObligationLedger, dispositionByDecision, effectiveSeverity, progressionVeto, routeMessages } from "./obligations.js";
import { SIGNALS_RELATIVE_PATH } from "./paths.js";
import { appendSignal, readSignals } from "./signals.js";

const policy: RoutingPolicy = {
  name: "routing", version: 2, description: "d",
  rules: [
    { kind: "algedonic-signal", minSeverity: "blocking", consumer: "human" },
    { kind: "policy-proposal", minSeverity: "info", consumer: "S5" },
    { kind: "audit-finding", minSeverity: "blocking", consumer: "S3" },
    { kind: "coordination-signal", minSeverity: "advisory", consumer: "S3" },
    { kind: "operational-signal", minSeverity: "blocking", consumer: "S3" },
    { kind: "uncertainty-signal", minSeverity: "blocking", consumer: "S3" },
    { kind: "intelligence-signal", minSeverity: "advisory", consumer: "S3" },
  ],
  impactSeverity: { low: "info", medium: "advisory", high: "blocking", critical: "critical" },
  recovery: { remediate: "S3", replan: "S3", clarify: "human", pause: "human", escalate: "human" },
  blocksAtOrAbove: "blocking",
};

let clock = 1_700_000_000_000;
const tick = () => (clock += 1000);
const envelope = (id: string, unit: string) => ({ id, timestamp: "t", unit });
const finding = (id: string, unit: string, severity: "advisory" | "blocking" | "critical" = "blocking"): VsmMessage =>
  ({ ...envelope(id, unit), kind: "audit-finding", channel: "audit", source: "S3*", destination: "S3", severity, subject: `finding ${id}`, observation: "o", evidence: [] });
const intelligence = (id: string, over: Partial<Extract<VsmMessage, { kind: "intelligence-signal" }>> = {}): VsmMessage =>
  ({ ...envelope(id, "r1"), kind: "intelligence-signal", channel: "intelligence", source: "S4", destination: "S3", severity: "blocking", subject: `intel ${id}`, observation: "o", evidence: [], ...over });

async function root(t: TestContext): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-obligations-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test("routing: a message becomes an obligation for the policy's consumer at or above the policy's line, is noted with the reason below it or without a rule, and is never routed twice; the veto is the blocking obligations on the unit", async (t) => {
  const dir = await root(t);
  const ledger = new ObligationLedger(dir, tick);
  await appendSignal(dir, finding("f1", "u1"));
  await appendSignal(dir, finding("f2", "u1", "advisory"));
  await appendSignal(dir, { id: "c1", timestamp: "t", unit: "u2", kind: "constraint", channel: "constraint", source: "S5", destination: "S1", severity: "info", subject: "rule", rule: "r" });
  await appendSignal(dir, { ...envelope("p1", "u1"), kind: "policy-proposal", channel: "proposal", source: "S1", destination: "S5", severity: "info", subject: "allow x", rationale: "r", requestedChange: "x", evidence: [] });
  assert.equal((await ledger.unrouted()).length, 4);

  const routed = await routeMessages(ledger, { policy, now: tick });
  assert.deepEqual(routed.opened.map((o) => [o.concern, o.unit, o.consumer, o.severity, o.blocks]), [["audit-finding", "u1", "S3", "blocking", true], ["policy-proposal", "u1", "S5", "info", false]]);
  assert.deepEqual(routed.noted.map((n) => [n.message.id, n.reason]), [["f2", "advisory is below blocking, the routing v2 line for audit-finding"], ["c1", "routing v2 has no rule for constraint"]]);
  assert.deepEqual(await ledger.unrouted(), [], "noted messages are routed too: nothing is silently dropped");
  assert.deepEqual((await routeMessages(ledger, { policy, now: tick })).opened, [], "routing is idempotent");
  assert.deepEqual((await progressionVeto(ledger, "u1")).map((o) => o.subject), ["finding f1"], "the proposal is owed to S5 but does not stop the unit");
  assert.deepEqual(await progressionVeto(ledger, "u2"), []);
  assert.equal((await readSignals(dir)).length, 4, "messages read back unchanged beside the routing events");
  const lines = (await readFile(path.join(dir, SIGNALS_RELATIVE_PATH), "utf8")).trim().split("\n");
  assert.equal(lines.length, 8, "four messages, two openings, two notes — one log");
});

test("lifecycle: open → acknowledged → resolved | escalated | superseded; a terminal record does not reopen; escalation needs a successor and the successor carries the sources", async (t) => {
  const dir = await root(t);
  const ledger = new ObligationLedger(dir, tick);
  const o = await ledger.openObligation({ subject: "s", unit: "u1", concern: "coordination-signal", sources: ["m1"], severity: "advisory", consumer: "S3", blocks: false });
  await ledger.acknowledge(o.id, "alice", "seen");
  let state = await ledger.get(o.id);
  assert.equal(state?.status, "acknowledged");
  assert.deepEqual(state?.acknowledgedBy, ["alice"]);
  assert.deepEqual(state?.history.map((h) => h.type), ["obligation-opened", "obligation-acknowledged"]);

  const successor = await ledger.escalate(o.id, { by: "alice", to: "human", severity: "blocking", rationale: "needs a decision" });
  state = await ledger.get(o.id);
  assert.equal(state?.status, "escalated");
  assert.equal(state?.successor, successor.id);
  assert.deepEqual(successor.sources, [o.id, "m1"], "the successor cites its predecessor and the original message");
  assert.equal(successor.consumer, "human");
  assert.equal(successor.blocks, false, "blocks is carried from the predecessor unless said otherwise");
  await assert.rejects(ledger.resolve(o.id, { by: "bob", disposition: "fixed", rationale: "x" }), /is escalated; terminal records do not reopen — open a successor/);
  await assert.rejects(ledger.acknowledge(o.id, "bob"), /terminal/);
  await assert.rejects(ledger.escalate(successor.id, { by: "bob", successor: "nope", rationale: "x" }), /no obligation "nope"/, "an escalation to nothing is not an escalation");

  const later = await ledger.openObligation({ subject: "s (revised)", unit: "u1", concern: "coordination-signal", sources: [successor.id], severity: "blocking", consumer: "human", blocks: true });
  await ledger.supersede(successor.id, { by: "alice", successor: later.id, rationale: "the question changed" });
  await ledger.resolve(later.id, { by: "alice", disposition: "accepted-risk", rationale: "ship it" });
  const all = await ledger.obligations();
  assert.deepEqual(all.map((s) => [s.status, s.disposition ?? s.successor]), [["escalated", successor.id], ["superseded", later.id], ["resolved", "accepted-risk"]]);
  assert.deepEqual(await ledger.open("u1"), []);
  assert.equal(all[2]?.closedBy, "alice");
});

test("intelligence: effective severity is the router's; expired intelligence is noted, not an obligation; affected units each get the veto, and reported impact maps through policy", async (t) => {
  const dir = await root(t);
  const ledger = new ObligationLedger(dir, tick);
  await appendSignal(dir, intelligence("i1", { affectedUnits: ["u1", "u2"], claim: "left-pad 1.3.0 has a CVE", confidence: "high", observedAt: "2026-09-22T00:00:00.000Z" }));
  await appendSignal(dir, intelligence("i2", { expiresAt: new Date(clock - 1).toISOString(), severity: "critical" }));
  await appendSignal(dir, intelligence("i3", { severity: "advisory" }));
  const uncertainty: VsmMessage = { ...envelope("q1", "u1"), kind: "uncertainty-signal", channel: "signal", source: "S1", destination: "S3", subject: "unicode", decision: "d", reason: "r", alternatives: [], consequence: "c", impact: "high", evidence: [] };
  await appendSignal(dir, uncertainty);
  assert.equal(effectiveSeverity(uncertainty, policy), "blocking", "impact high is the model's claim; blocking is the policy's mapping");

  const routed = await routeMessages(ledger, { policy, now: tick });
  assert.deepEqual(routed.opened.map((o) => [o.sources[0], o.unit, o.blocks]), [["i1", "u1", true], ["i1", "u2", true], ["i3", "r1", false], ["q1", "u1", true]]);
  assert.match(routed.noted[0]?.reason ?? "", /^intelligence expired at .*; stale evidence cannot raise an obligation$/);
  assert.deepEqual((await progressionVeto(ledger, "u2")).map((o) => o.subject), ["intel i1"], "the veto lands on the affected unit, not on the unit that researched");
});

test("floors (lesson 12): a message that names an invariant or the identity path is raised to the floor's severity; one that only cites an invariant as its authority is not", async (t) => {
  const dir = await root(t);
  const ledger = new ObligationLedger(dir, tick);
  const floored: RoutingPolicy = { ...policy, floors: [{ pattern: "\\bINV-\\d{3}\\b|regulator/identity/", severity: "blocking", reason: "about S5" }] };
  const proposal: VsmMessage = { ...envelope("p1", "u1"), kind: "policy-proposal", channel: "proposal", source: "S1", destination: "S5", severity: "info", subject: "relax INV-001 for this unit", rationale: "r", requestedChange: "x", evidence: [] };
  const applied: VsmMessage = { ...envelope("f1", "u1"), kind: "audit-finding", channel: "audit", source: "S3*", destination: "S3", severity: "advisory", subject: "unit u1: closeout refused (inconclusive)", invariant: "INV-003", observation: "the worktree has uncommitted changes", evidence: [] };
  const bash: VsmMessage = { ...envelope("f2", "u1"), kind: "audit-finding", channel: "audit", source: "S3*", destination: "S3", severity: "advisory", subject: "protected path changed by bash", observation: "bash changed regulator/identity/INVARIANTS.md (modified)", evidence: [] };
  assert.equal(effectiveSeverity(proposal, floored), "blocking");
  assert.equal(effectiveSeverity(applied, floored), "advisory", "citing an invariant as authority is not naming it as the subject");
  assert.equal(effectiveSeverity(bash, floored), "blocking");
  assert.equal(effectiveSeverity(proposal, policy), "info", "no floors, no raise");
  for (const m of [proposal, applied, bash]) await appendSignal(dir, m);
  const routed = await routeMessages(ledger, { policy: floored, now: tick });
  assert.deepEqual(routed.opened.map((o) => [o.sources[0], o.severity, o.blocks]), [["p1", "blocking", true], ["f2", "blocking", true]]);
  assert.deepEqual(routed.noted.map((n) => n.message.id), ["f1"]);
});

test("disposition by decision: retry, repair and abort resolve the unit's open S3 obligations with the decision as rationale; a waiting action opens one obligation for the policy's consumer and escalates the S3 ones to it", async (t) => {
  const dir = await root(t);
  const ledger = new ObligationLedger(dir, tick);
  await appendSignal(dir, finding("f1", "u1"));
  await appendSignal(dir, { ...envelope("s1", "u1"), kind: "coordination-signal", channel: "signal", source: "S2", destination: "S3", severity: "advisory", subject: "src/a.js", coordination: "oscillation", observation: "4 edits", evidence: [] });
  await appendSignal(dir, finding("f9", "u9"));
  await routeMessages(ledger, { policy, now: tick });
  const decision = (over: Partial<RecoveryDecision>): RecoveryDecision => ({
    id: "d1", unitId: "u1", attempt: 1, cause: "check-failure", occurrence: 1, evidence: [], action: "repair", policy: { name: "recovery", version: 1 }, rationale: "rule for check-failure", decidedAt: "t", decidedBy: "S3", ...over,
  });

  assert.equal(await dispositionByDecision(ledger, decision({}), policy), undefined);
  let mine = (await ledger.obligations()).filter((o) => o.unit === "u1");
  assert.deepEqual(mine.map((o) => [o.status, o.disposition]), [["resolved", "rework"], ["resolved", "rework"]]);
  assert.match(mine[0]?.rationale ?? "", /^recovery v1: check-failure \(occurrence 1\) → repair\. rule for check-failure$/);
  assert.equal((await ledger.open("u9")).length, 1, "another unit's obligations are untouched");
  assert.deepEqual(await progressionVeto(ledger, "u1"), [], "the unit may be dispatched again");

  await appendSignal(dir, finding("f2", "u1"));
  await routeMessages(ledger, { policy, now: tick });
  const wait = await dispositionByDecision(ledger, decision({ id: "d2", cause: "oscillation", action: "clarify", question: "Which behaviour is wanted?" }), policy);
  assert.equal(wait?.consumer, "human");
  assert.equal(wait?.concern, "recovery-decision");
  assert.equal(wait?.blocks, true);
  assert.equal(wait?.question, "Which behaviour is wanted?");
  mine = (await ledger.obligations()).filter((o) => o.unit === "u1" && o.status !== "resolved");
  assert.deepEqual(mine.map((o) => [o.concern, o.status, o.successor]), [["audit-finding", "escalated", wait?.id], ["recovery-decision", "open", undefined]]);
  assert.deepEqual(wait?.sources, ["d2", mine[0]?.id], "the wait cites the decision and what it escalates");
  assert.deepEqual((await progressionVeto(ledger, "u1")).map((o) => o.id), [wait?.id], "the unit waits on a person; nothing in the loop moves it");

  const abort = await dispositionByDecision(ledger, decision({ id: "d3", action: "abort" }), policy);
  assert.equal(abort, undefined);
  assert.equal((await ledger.get(wait!.id))?.status, "open", "a wait obligation is a person's to close, not the router's");
});
