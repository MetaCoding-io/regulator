import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { CONTINUES_WITHOUT_ANSWER, type InteractionKind, type InteractionPolicy } from "@metacoding.io/regulator-protocol";
import { checkDispositionAuthority, continuesWithoutAnswer, dispositionForAnswer, remindable, severityForKind, undelivered } from "./interaction.js";
import { ObligationLedger } from "./obligations.js";

const policy: InteractionPolicy = {
  name: "interaction", version: 1, description: "d",
  timeoutsMs: { recap: 1000, choice: 1000, clarification: 1000, consent: 1000, uat: 1000 },
  attention: { blockingPerAttempt: 1 },
  reminderAfterMs: 3_600_000,
  people: [
    { name: "alice", resolveUpTo: "critical", acceptRisk: true, actAsS5: true },
    { name: "bob", resolveUpTo: "blocking", acceptRisk: false, actAsS5: false },
  ],
};

async function root(t: TestContext): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-interaction-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test("the rule is fixed, not declared: only a recap continues without an answer; everything that waits is a blocking obligation; consent and acceptance are a yes or a no, nothing else", () => {
  const kinds: InteractionKind[] = ["recap", "choice", "clarification", "consent", "uat"];
  assert.deepEqual(kinds.map((k) => [k, continuesWithoutAnswer(k)]), [["recap", true], ["choice", false], ["clarification", false], ["consent", false], ["uat", false]]);
  assert.deepEqual(kinds.filter((k) => CONTINUES_WITHOUT_ANSWER[k]), ["recap"], "no policy field can widen this: it is a constant of the protocol");
  assert.deepEqual(kinds.map(severityForKind), ["advisory", "blocking", "blocking", "blocking", "blocking"]);
  for (const yes of ["yes", "Yes", " y ", "approve", "ok", "proceed", "accepted"]) assert.equal(dispositionForAnswer("consent", yes), "accepted", yes);
  for (const no of ["no", "", "yes but only on staging", "later", "maybe", "timed out"]) assert.equal(dispositionForAnswer("consent", no), "rejected", `"${no}" is not a yes`);
  assert.equal(dispositionForAnswer("uat", "accept"), "verified");
  assert.equal(dispositionForAnswer("uat", "looks wrong on mobile"), "rejected");
  assert.equal(dispositionForAnswer("choice", "postgres"), "fixed");
  assert.equal(dispositionForAnswer("clarification", "the second one"), "fixed");
});

test("disposition authority: a name the policy does not list may do nothing; severity, risk acceptance and S5 are each a declared grant", () => {
  assert.equal(checkDispositionAuthority(policy, "alice", { severity: "critical", disposition: "accepted-risk", s5: true }), undefined);
  assert.equal(checkDispositionAuthority(policy, "bob", { severity: "blocking", disposition: "fixed" }), undefined);
  assert.match(checkDispositionAuthority(policy, "mallory", { severity: "info" }) ?? "", /^"mallory" is not a person the interaction policy \(interaction v1\) names; a name not listed may disposition nothing$/);
  assert.match(checkDispositionAuthority(policy, "bob", { severity: "critical" }) ?? "", /^bob may disposition up to blocking; this is critical$/);
  assert.match(checkDispositionAuthority(policy, "bob", { severity: "advisory", disposition: "accepted-risk" }) ?? "", /^bob may not accept risk \(interaction v1\)$/);
  assert.match(checkDispositionAuthority(policy, "bob", { severity: "advisory", s5: true }) ?? "", /^bob may not act as S5 \(interaction v1\)$/);
});

test("the ledger keeps deliveries and interactions beside the obligations they concern: a delivery is not a disposition, a reminder is due by the policy's interval, and a request folds with its answers", async (t) => {
  let clock = Date.parse("2026-09-22T12:00:00.000Z");
  const ledger = new ObligationLedger(await root(t), () => clock);
  const owed = await ledger.openObligation({ subject: "consent: delete the branch", unit: "u1", concern: "interaction", sources: ["ask:1"], severity: "blocking", consumer: "human", blocks: true, question: "May I?", openedBy: "S1" });
  const s3 = await ledger.openObligation({ subject: "finding", unit: "u1", concern: "audit-finding", sources: ["f1"], severity: "blocking", consumer: "S3", blocks: true, openedBy: "S3*" });
  const request = { id: "r1", kind: "consent" as const, subject: "delete the branch", question: "May I?", action: "git push --delete", severity: "blocking" as const, unit: "u1", attempt: 1, obligationId: owed.id, evidence: [], raisedBy: "S1" as const, raisedAt: new Date(clock).toISOString(), timeoutMs: 1000, channel: "none" as const };
  await ledger.requestInteraction(request, "S1");
  await ledger.answerInteraction({ requestId: "r1", outcome: "unavailable", by: "S1", channel: "none" });

  let states = await ledger.obligations();
  assert.deepEqual(undelivered(states).map((o) => o.id), [owed.id], "owed to a person and never delivered; S3's is not a person's");
  assert.deepEqual(remindable(states, policy, clock).map((o) => o.id), [owed.id], "never delivered counts as due");
  await ledger.deliver(owed.id, { by: "S3", channel: "outbox", target: "outbox" });
  states = await ledger.obligations();
  assert.deepEqual(undelivered(states), []);
  assert.deepEqual(remindable(states, policy, clock + policy.reminderAfterMs - 1), []);
  assert.deepEqual(remindable(states, policy, clock + policy.reminderAfterMs).map((o) => o.id), [owed.id], "due again after the interval");
  const delivered = states.find((o) => o.id === owed.id)!;
  assert.equal(delivered.status, "open", "delivery is not a disposition");
  assert.deepEqual(delivered.deliveries, [{ at: new Date(clock).toISOString(), channel: "outbox", reminder: false, target: "outbox" }]);
  assert.equal(states.find((o) => o.id === s3.id)!.deliveries.length, 0);

  clock += 5000;
  await ledger.answerInteraction({ requestId: "r1", outcome: "answered", answer: "yes", by: "alice", channel: "cli" });
  await ledger.resolve(owed.id, { by: "alice", disposition: "accepted", rationale: "yes" });
  await assert.rejects(ledger.deliver(owed.id, { by: "S3", channel: "outbox" }), /is resolved/, "nothing is delivered once it is closed");
  assert.deepEqual(await ledger.interactions(), [{
    request,
    answers: [
      { at: "2026-09-22T12:00:00.000Z", by: "S1", outcome: "unavailable", channel: "none" },
      { at: "2026-09-22T12:00:05.000Z", by: "alice", outcome: "answered", channel: "cli", answer: "yes" },
    ],
  }]);
  assert.equal((await ledger.obligations()).length, 2, "interaction events are not obligations");
});
