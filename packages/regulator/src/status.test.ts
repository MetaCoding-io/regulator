import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { AuditLog, ExecutionStore, LeaseStore, MemoryStore, ObligationLedger, appendSignal } from "@metacoding/regulator-core";
import type { WorkContract } from "@metacoding/regulator-protocol";
import { readStatus, renderStatusText } from "./status.js";

const contract: WorkContract = {
  kind: "task", id: "tc-1", version: 1, unitId: "u1", unitType: "implement",
  workload: { name: "software-development", version: 1 }, objective: "fix it", constraintRefs: [],
  fixed: [], delegated: [], unresolved: [], expectedEvidence: [],
  provenance: { createdBy: "S3", createdAt: "2026-09-22T00:00:00.000Z" },
};

test("status: a definition and an instance are read from files only, and the view says what is declared and what is pending", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "regulator-status-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const definition = path.join(root, "definition");
  await mkdir(path.join(definition, "registry", "regulators"), { recursive: true });
  await mkdir(path.join(definition, "workload"), { recursive: true });
  await mkdir(path.join(definition, "src"), { recursive: true });
  await writeFile(path.join(definition, "src", "gate.ts"), "", "utf8");
  await writeFile(path.join(definition, "src", "gate.test.ts"), "", "utf8");
  await writeFile(path.join(definition, "registry", "regulators", "gate.json"), JSON.stringify({
    id: "reg.test.gate.v1", name: "Gate", status: "active", vsmFunction: "S3", purpose: "p",
    absorbs: { failureClass: "f", description: "d" },
    mechanism: { level: "deterministic-gate", implementation: "src/gate.ts", enforcementPoints: ["tool_call"] },
    evidence: { tests: ["src/gate.test.ts"] }, limitations: ["l"],
    ownership: { owner: "o", introduced: "2026-09-22", reviewBy: "2026-12-01" },
    ablation: { switch: "extension:gate", note: "n" }, retirement: { condition: "c" },
  }), "utf8");
  await writeFile(path.join(definition, "workload", "sd.json"), JSON.stringify({
    name: "software-development", version: 1, description: "d",
    unitTypes: [{ name: "implement", description: "d", profile: "implement", checks: [], requiresContract: true }],
  }), "utf8");
  await writeFile(path.join(definition, "workload", "broken.json"), "{\"name\": 1}", "utf8");
  await mkdir(path.join(definition, "policies"), { recursive: true });
  await writeFile(path.join(definition, "policies", "default.json"), JSON.stringify({
    name: "default", version: 1, description: "d",
    budgets: { default: { tokens: 1000, wallClockMs: 60_000, turns: 5, attempts: 2 } },
    models: { default: { primary: "anthropic/claude-sonnet-4-5", fallback: ["openai/gpt-5"] } },
  }), "utf8");
  await mkdir(path.join(definition, "profiles"), { recursive: true });
  await writeFile(path.join(definition, "profiles", "implement.json"), JSON.stringify({ name: "implement", description: "d", tools: ["read", "write"], writablePaths: ["src/"], advice: [] }), "utf8");
  await mkdir(path.join(definition, "identity"), { recursive: true });
  for (const name of ["IDENTITY.md", "GLOSSARY.md", "BOUNDARIES.md"]) await writeFile(path.join(definition, "identity", name), "# x\n\ntext\n", "utf8");
  await writeFile(path.join(definition, "identity", "INVARIANTS.md"), "## INV-001 — One\n\nstatement\n", "utf8");
  await writeFile(path.join(definition, "policies", "recovery.json"), JSON.stringify({ name: "recovery", version: 1, description: "d", rules: [{ cause: "no-report", actions: ["retry"] }], fallback: ["pause"] }), "utf8");
  await writeFile(path.join(definition, "policies", "routing.json"), JSON.stringify({
    name: "routing", version: 1, description: "d", rules: [{ kind: "coordination-signal", minSeverity: "advisory", consumer: "S3" }],
    impactSeverity: { low: "info", medium: "advisory", high: "blocking", critical: "critical" }, recovery: { remediate: "S3", replan: "S3", clarify: "human", pause: "human", escalate: "human" }, blocksAtOrAbove: "blocking",
  }), "utf8");

  await writeFile(path.join(definition, "policies", "interaction.json"), JSON.stringify({
    name: "interaction", version: 1, description: "d", timeoutsMs: { recap: 30_000, choice: 120_000, clarification: 300_000, consent: 300_000, uat: 600_000 },
    attention: { blockingPerAttempt: 2 }, reminderAfterMs: 3_600_000, people: [{ name: "alice", resolveUpTo: "critical", acceptRisk: true, actAsS5: true }, { name: "bob", resolveUpTo: "blocking", acceptRisk: false, actAsS5: false }],
  }), "utf8");

  const instance = path.join(root, "instance");
  const clock = 5_000_000;
  const store = new ExecutionStore(instance, () => clock);
  await store.createUnit(contract);
  await store.setStatus("u1", "blocked", "no-report");
  await store.recordAttempt({ unitId: "u1", contractVersion: 1, startedAt: "a", endedAt: "b", outcome: "no-report" });
  await store.recordDecision({
    id: "d1", unitId: "u1", attempt: 1, cause: "no-report", occurrence: 1, evidence: ["attempt 1: no-report"], action: "retry",
    policy: { name: "recovery", version: 1 }, rationale: "r", decidedAt: "t", decidedBy: "S3",
  });
  await store.writeBudget({
    unitId: "u1", attempt: 1, ceiling: { tokens: 1000, wallClockMs: 60_000, turns: 5 }, consumed: { tokens: 250, cost: 0, wallClockMs: 10, turns: 2 },
    startedAt: "a", updatedAt: "b", models: ["anthropic/claude-sonnet-4-5"], compactions: [],
  });
  await new AuditLog(instance).appendVerdict({
    id: "v1", unitId: "u1", attempt: 1, contract: { id: "tc-1", version: 1 }, revision: "abcdef0123", verdict: "inconclusive",
    evidence: [], satisfied: [], failed: [], missing: ["e-tests"], stale: [], contradicted: [], awaitingAcceptance: [], reasons: ["e-tests (test): no host evidence"], decidedBy: "S3*", at: "t",
  });
  const leases = new LeaseStore(path.join(instance, ".regulator", "leases"), () => clock);
  await leases.acquire({ unitId: "u1", owner: "alice", resource: "/w/u1", branch: "unit/u1", ttlMs: 1000 });
  await appendSignal(instance, {
    id: "s1", timestamp: "t", source: "S2", kind: "coordination-signal", channel: "signal", destination: "S3",
    severity: "advisory", subject: "src/a.js", unit: "u1", coordination: "oscillation", observation: "4 edits", evidence: [],
  });

  const ledger = new ObligationLedger(instance, () => clock);
  const owed = await ledger.openObligation({ subject: "unit u1: clarify (oscillation)", unit: "u1", concern: "recovery-decision", sources: ["d1"], severity: "blocking", consumer: "human", blocks: true, question: "Which behaviour is wanted?" });
  const done = await ledger.openObligation({ subject: "allow x", concern: "policy-proposal", sources: ["p1"], severity: "info", consumer: "S5", blocks: false });
  await ledger.resolve(done.id, { by: "alice", disposition: "rejected", rationale: "no" });
  await ledger.deliver(owed.id, { by: "S3", channel: "outbox", target: "outbox" });
  await ledger.requestInteraction({ id: "r1", kind: "consent", subject: "force-push", question: "May I?", action: "git push --force", severity: "blocking", unit: "u1", attempt: 1, obligationId: owed.id, evidence: [], raisedBy: "S1", raisedAt: "t", timeoutMs: 1000, channel: "none" }, "S1");
  await ledger.answerInteraction({ requestId: "r1", outcome: "unavailable", by: "S1", channel: "none" });

  await new MemoryStore(instance, () => clock).record({ subject: "runner", note: "lacks docker", evidence: [], recordedBy: "alice", unit: "u1", reviewBy: new Date(clock + 86_400_000).toISOString() });

  const view = await readStatus({ definitionDir: definition, instanceDir: instance, now: () => clock });
  assert.deepEqual(view.definition?.declared, ["registry", "workload", "policies", "profiles", "identity"]);
  assert.deepEqual(view.definition?.profiles.map((p) => p.name), ["implement"]);
  assert.deepEqual(view.definition?.identity.invariants.map((i) => i.id), ["INV-001"]);
  assert.deepEqual(view.instance?.memory.map((m) => [m.subject, m.status]), [["runner", "current"]]);
  assert.equal(view.definition?.recovery[0]?.name, "recovery");
  assert.equal(view.definition?.routing[0]?.name, "routing");
  assert.equal(view.definition?.interaction[0]?.people.length, 2);
  assert.deepEqual(view.definition?.problems.filter((p) => /recovery|routing|interaction/.test(p)), [], "the four policy shapes are all policies");
  assert.deepEqual(view.definition?.evals, []);
  assert.deepEqual(view.definition?.lifecycle.map((l) => [l.id, l.ablation?.switch, l.retirement, l.ablatedIn, l.reportedIn, l.overdueDays < 0]), [["reg.test.gate.v1", "extension:gate", "c", [], [], true]], "the lifecycle row: switch, condition, no ablation arm yet, not due");
  assert.deepEqual(view.definition?.pending, []);
  assert.equal(view.definition?.policies[0]?.name, "default");
  assert.equal(view.definition?.registry.records.length, 1);
  assert.deepEqual(view.definition?.registry.problems, []);
  assert.equal(view.definition?.workloads.length, 1);
  assert.match(view.definition?.problems[0] ?? "", /broken\.json/);
  assert.equal(view.instance?.units.length, 1);
  assert.equal(view.instance?.units[0]?.unit.status, "blocked");
  assert.equal(view.instance?.units[0]?.contract?.id, "tc-1");
  assert.equal(view.instance?.units[0]?.report, undefined);
  assert.equal(view.instance?.units[0]?.attemptRecords[0]?.outcome, "no-report");
  assert.equal(view.instance?.units[0]?.budget?.consumed.tokens, 250);
  assert.deepEqual(view.instance?.units[0]?.decisions.map((d) => d.action), ["retry"]);
  assert.deepEqual(view.instance?.units[0]?.audit.verdicts.map((v) => v.verdict), ["inconclusive"]);
  assert.deepEqual(view.instance?.leases.map((l) => [l.lease.unitId, l.live]), [["u1", true]]);
  assert.equal(view.instance?.signals[0]?.kind, "coordination-signal", "unrouted: nothing has routed it yet");
  assert.deepEqual(view.instance?.obligations.map((o) => [o.consumer, o.status]), [["human", "open"], ["S5", "resolved"]]);
  assert.deepEqual(view.instance?.units[0]?.obligations.map((o) => o.id), [owed.id], "a unit's view carries what is owed on it");
  assert.deepEqual(view.instance?.obligations[0]?.deliveries, [{ at: new Date(clock).toISOString(), channel: "outbox", reminder: false, target: "outbox" }]);
  assert.deepEqual(view.instance?.interactions.map((x) => [x.request.kind, x.answers.map((a) => a.outcome)]), [["consent", ["unavailable"]]]);
  assert.equal(view.instance?.manifest, undefined);
  const timeline = view.instance?.units[0]?.timeline ?? [];
  assert.deepEqual([...new Set(timeline.map((e) => e.name))].sort(), ["chat anthropic/claude-sonnet-4-5", "coordination-signal", "interaction-answered", "interaction-requested", "invoke_agent implement", "memory-recorded", "obligation-delivered", "obligation-opened", "recovery-decision", "unit u1", "verdict"].filter((n) => timeline.some((e) => e.name === n)), "the replay: every record about the unit");
  assert.equal(timeline[0]?.name, "unit u1", "the unit span opens the replay");
  assert.ok(timeline.length >= 6);
  for (let i = 1; i < timeline.length; i++) assert.ok(timeline[i - 1]!.at <= timeline[i]!.at, "in time order");

  const text = renderStatusText(view);
  assert.match(text, /recovery recovery v1: 1 rule\(s\), fallback pause/);
  assert.match(text, /routing routing v1: coordination-signal≥advisory→S3; veto at blocking/);
  assert.match(text, /interaction interaction v1: waits recap 30s, choice 120s, clarification 300s, consent 300s, uat 600s; 2 blocking interrupt\(s\) per attempt; remind after 60 min\n {4}alice: up to critical, may accept risk, may act as S5\n {4}bob: up to blocking\n/);
  assert.match(text, /obligations: 1 open of 2\n {4}open {8} human blocking veto {2}\w{8} {2}recovery-decision {2}unit u1: clarify \(oscillation\) {2}\(unit u1\) {2}Q: Which behaviour is wanted\? {2}delivered ×1 \(outbox\)\n {2}interactions: 1 asked, 1 unanswered\n {4}consent {7}r1 {2}force-push {2}\(unit u1, attempt 1\) {2}via none {2}unavailable by S1\n/);
  assert.match(text, /declared: registry, workload, policies, profiles, identity; pending: $/m);
  assert.match(text, /lifecycle: 1 active regulator\(s\), 0 overdue for review, 0 with an ablation arm, 0 with a committed ablation report/);
  assert.match(text, /profile implement: read, write; writes src\//);
  assert.match(text, /identity: INV-001\n/);
  assert.match(text, /memory: 1 current of 1\n {4}\w{8} {2}runner: lacks docker {2}\(by alice in u1; review by \d{4}-\d{2}-\d{2}\)/);
  assert.match(text, /policy default v1: default 1000 tok, 5 turns, 2 attempts; models anthropic\/claude-sonnet-4-5 → openai\/gpt-5/);
  assert.match(text, /S3 {2}deterministic-gate {2}reg\.test\.gate\.v1/);
  assert.match(text, /blocked {4}u1 {2}implement {2}contract tc-1 v1 {2}attempts 1 \(last: no-report\) {2}budget 250\/1000 tok \(25%\), 2\/5 turns {2}routed no-report→retry \(recovery v1\) {2}audit inconclusive@abcdef0 \(missing e-tests\) {2}owed human! {2}— no-report/);
  assert.match(text, /live {4}u1 {2}alice/);
  assert.match(text, /coordination-signal {2}S2→S3 {2}src\/a\.js {2}\(unit u1\)/);

  const empty = await readStatus({ instanceDir: path.join(root, "nothing-here"), now: () => clock });
  assert.deepEqual(empty.instance, { dir: path.join(root, "nothing-here"), units: [], leases: [], signals: [], obligations: [], memory: [], interactions: [], manifest: undefined });
  assert.match(renderStatusText({ generatedAt: "t", definition: undefined, instance: undefined }), /nothing to show/);
});
