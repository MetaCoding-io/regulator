import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { GENAI, VSM_ATTR, isSpanRecord, type WorkContract } from "@metacoding.io/regulator-protocol";
import { AuditLog } from "./audit-log.js";
import { EffectJournal } from "./effect-journal.js";
import { ExecutionStore } from "./execution-store.js";
import { ObligationLedger } from "./obligations.js";
import { REGULATOR_DIR } from "./paths.js";
import { appendSignal } from "./signals.js";
import { DEFAULT_SECRET_PATTERNS, REDACTED, projectSpans, redact } from "./spans.js";

async function root(t: TestContext): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-spans-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
const contract: WorkContract = {
  kind: "task", id: "tc-1", version: 1, unitId: "u1", unitType: "implement", workload: { name: "software-development", version: 1 },
  objective: "o", constraintRefs: [], fixed: [], delegated: [], unresolved: [], expectedEvidence: [{ id: "e-tests", description: "d", class: "test", required: true }],
  provenance: { createdBy: "S3", createdAt: "t" },
};

test("redaction removes canary values and credential shapes, marks what it did, and bounds length", () => {
  const rules = { values: ["hunter2secret"], patterns: DEFAULT_SECRET_PATTERNS, maxChars: 60 };
  assert.deepEqual(redact("plain text", rules), { text: "plain text", redacted: false });
  assert.deepEqual(redact("token hunter2secret leaked", rules), { text: `token ${REDACTED} leaked`, redacted: true });
  assert.equal(redact("key sk-abcdefghijklmnopqrstuvwxyz0123 here", rules).text, `key ${REDACTED} here`);
  assert.equal(redact("AWS AKIAABCDEFGHIJKLMNOP", rules).text, `AWS ${REDACTED}`);
  assert.equal(redact("Authorization: Bearer abcdefghijklmnopqrstuvwxyz", rules).text, `Authorization: ${REDACTED}`);
  assert.equal(redact("GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz1234 done", rules).text, `GITHUB_TOKEN=${REDACTED} done`);
  assert.equal(redact("DB_PASSWORD: s3cr3tvalue", rules).text, `DB_PASSWORD=${REDACTED}`);
  const long = redact("x".repeat(100), rules);
  assert.equal(long.text.length, 61);
});

test("the span projection reads every log the instance keeps — never the transcript — into GenAI spans joined by unit, attempt, evidence, obligation and regulator ids, with redaction applied to every string attribute", async (t) => {
  const dir = await root(t);
  let clock = Date.parse("2026-09-22T12:00:00.000Z");
  const now = () => (clock += 1000);
  await mkdir(path.join(dir, REGULATOR_DIR), { recursive: true });
  await writeFile(path.join(dir, REGULATOR_DIR, "canaries"), "supersecretvalue\n");
  const store = new ExecutionStore(dir, now);
  await store.createUnit(contract);
  await store.recordAttempt({ unitId: "u1", contractVersion: 1, startedAt: "2026-09-22T12:00:01.000Z", endedAt: "2026-09-22T12:00:09.000Z", outcome: "check-failure", sessionId: "s1", detail: "tests fail; token supersecretvalue in output" });
  await store.writeBudget({ unitId: "u1", attempt: 1, ceiling: { tokens: 1000, wallClockMs: 60_000, turns: 5 }, consumed: { tokens: 250, cost: 0.01, wallClockMs: 8000, turns: 2 }, startedAt: "2026-09-22T12:00:01.000Z", updatedAt: "2026-09-22T12:00:08.000Z", models: ["anthropic/claude-sonnet-4-5", "openai/gpt-5"], compactions: [{ at: "2026-09-22T12:00:05.000Z", reason: "threshold", preserved: true }] });
  await store.recordDecision({ id: "d1", unitId: "u1", attempt: 1, cause: "check-failure", occurrence: 1, evidence: [], action: "repair", policy: { name: "recovery", version: 1 }, rationale: "r", hint: "h", decidedBy: "S3", decidedAt: "2026-09-22T12:00:10.000Z" });
  const audit = new AuditLog(dir);
  await audit.appendEvidence({ id: "ev1", unitId: "u1", attempt: 1, contract: { id: "tc-1", version: 1 }, check: "run_tests", class: "test", criteria: ["e-tests"], verdict: "fail", command: ["node", "--test"], observation: "1 passed, 1 failed\nnot ok: uses AKIAABCDEFGHIJKLMNOP", revision: "abc1234", environment: { node: "v22", platform: "linux", arch: "x64" }, producedBy: "S3*", at: "2026-09-22T12:00:08.500Z" });
  await audit.appendVerdict({ id: "v1", unitId: "u1", attempt: 1, contract: { id: "tc-1", version: 1 }, revision: "abc1234", verdict: "fail", evidence: ["ev1"], satisfied: [], failed: ["e-tests"], missing: [], stale: [], contradicted: [], awaitingAcceptance: [], reasons: ["e-tests (test): run_tests — 1 failed"], decidedBy: "S3*", at: "2026-09-22T12:00:08.600Z" });
  await appendSignal(dir, { id: "f1", timestamp: "2026-09-22T12:00:08.700Z", source: "S3*", kind: "audit-finding", channel: "audit", destination: "S3", severity: "blocking", subject: "unit u1: closeout refused (fail)", unit: "u1", observation: "o", evidence: [] });
  clock = Date.parse("2026-09-22T12:00:11.000Z");
  const ledger = new ObligationLedger(dir, now);
  const o = await ledger.openObligation({ subject: "closeout refused", unit: "u1", concern: "audit-finding", sources: ["f1"], severity: "blocking", consumer: "S3", blocks: true, openedBy: "S3*" });
  await ledger.resolve(o.id, { by: "S3", disposition: "rework", rationale: "repair" });
  const journal = new EffectJournal(dir, now);
  await journal.begin({ key: "k1", tool: "notify_owner", description: "tell the owner", unitId: "u1" });
  await journal.commit("k1", "sent");

  const spans = await projectSpans(dir);
  assert.ok(spans.every(isSpanRecord), "every span validates against the schema");
  assert.deepEqual(spans.map((s) => s.name), ["unit u1", "invoke_agent implement", "chat openai/gpt-5", "execute_tool run_tests", "verdict", "execute_tool notify_owner", "execute_tool notify_owner"]);
  const [unit, attempt, chat, evidence, verdict, intended, committed] = spans;
  assert.equal(new Set(spans.map((s) => s.traceId)).size, 1, "one trace per unit");
  assert.equal(attempt!.parentSpanId, unit!.spanId);
  assert.equal(chat!.parentSpanId, attempt!.spanId);
  assert.equal(evidence!.parentSpanId, attempt!.spanId);
  assert.equal(attempt!.attributes[GENAI.operation], "invoke_agent");
  assert.equal(attempt!.attributes[GENAI.conversationId], "s1");
  assert.equal(attempt!.attributes.detail, `tests fail; token ${REDACTED} in output`, "the canary is gone from the attempt detail");
  assert.equal(attempt!.attributes[VSM_ATTR.redacted], true);
  assert.equal(unit!.attributes[VSM_ATTR.redacted], false, "spans with nothing redacted say so once anything was");
  assert.deepEqual([chat!.attributes[GENAI.requestModel], chat!.attributes[GENAI.responseModel], chat!.attributes["vsm.usage.tokens"], chat!.attributes["vsm.compactions"]], ["anthropic/claude-sonnet-4-5", "openai/gpt-5", 250, 1]);
  assert.equal(chat!.events[0]?.name, "compaction");
  assert.deepEqual([evidence!.attributes[GENAI.toolName], evidence!.attributes[VSM_ATTR.evidence], evidence!.attributes[VSM_ATTR.regulator], evidence!.attributes["vsm.evidence.criteria"], evidence!.status], ["run_tests", "ev1", "reg.audit.closeout-gate.v1", "e-tests", "error"]);
  assert.equal(evidence!.attributes.observation, `1 passed, 1 failed\nnot ok: uses ${REDACTED}`, "credential shapes in observations are redacted");
  assert.equal(verdict!.attributes["vsm.verdict"], "fail");
  assert.deepEqual([intended!.attributes["vsm.effect.status"], committed!.attributes["vsm.effect.status"], committed!.attributes[GENAI.toolCallId], committed!.status], ["intended", "committed", "k1", "ok"]);
  assert.deepEqual(unit!.events.map((e) => e.name), ["audit-finding", "recovery-decision", "obligation-opened", "obligation-resolved"], "obligation, decision and message events ride the unit span in time order");
  assert.equal(unit!.events[2]!.attributes[VSM_ATTR.obligation], o.id);
  assert.equal(unit!.events[1]!.attributes[VSM_ATTR.policyVersion], 1);
  assert.deepEqual(await projectSpans(await root(t)), [], "an empty instance projects nothing");
});
