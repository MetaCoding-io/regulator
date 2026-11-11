import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { writeFile } from "node:fs/promises";
import { ExecutionStore, UNITS_RELATIVE_DIR, loadRegistry, ownConsumption, readSignals } from "@metacoding.io/regulator-core";
import type { AuditFinding, RecoveryPolicy, ResultReport, WorkContract } from "@metacoding.io/regulator-protocol";
import { LAB_ROOT, POLICY_PATH, driveUnit, gitExec, initRepo, loadInteractionPolicy, loadPolicy, loadRecoveryPolicy, loadRoutingPolicy, loadWorkload, startUnit, type Dispatcher } from "@metacoding.io/regulator";
import { loadContract } from "./contract.js";
import { CONTRACT_ENTRY_TYPE } from "./contract.js";
import { attemptEnd, openUnitSession } from "./dispatcher.js";

// The first live drift run (0.1.1) found every unit ending as `no-report` with nothing metered: the dispatcher created
// sessions but never bound them, and binding is what emits `session_start`. This drives the real dispatcher path — the
// definition's loader, the flags, `createAgentSession`, `bindExtensions` — with no model, and asserts what a bound
// session must show before the first prompt: the contract in the session and the prompt, the budget ledger written.
test("openUnitSession binds the definition's extensions: the contract, the profile and the budget guard start before the first prompt", async (t) => {
  const repo = await initRepo(t);
  const contract = await loadContract(path.join(LAB_ROOT, "contracts", "fix-known-issue.json"));
  await new ExecutionStore(repo).createUnit(contract);
  const contractPath = path.join(repo, UNITS_RELATIVE_DIR, contract.unitId, "contract.v1.json");
  const started = await startUnit(gitExec, { repo, unitId: contract.unitId, owner: "alice" });
  const sessionManager = SessionManager.inMemory();

  const { session, refused, extensionErrors } = await openUnitSession({
    worktree: started.worktree.path, unitId: contract.unitId, contractPath, profile: "implement", policyPath: POLICY_PATH, sessionManager,
  });
  try {
    assert.deepEqual(extensionErrors, [], "no extension failed to start");
    assert.deepEqual(refused, [], "the fixture declares no extensions of its own");
    const entries = sessionManager.getEntries().map((e) => (e.type === "custom" ? `custom:${e.customType}` : e.type));
    assert.ok(entries.includes(`custom:${CONTRACT_ENTRY_TYPE}`), `the contract is recorded in the session: ${entries.join(", ")}`);
    const active = session.getActiveToolNames();
    assert.ok(active.includes("report_result"), `the contract's report tool is active: ${active.join(", ")}`);
    assert.ok(active.includes("write") && !active.includes("propose_policy_change") || active.includes("propose_policy_change"), "the profile decided the tool surface");
    assert.ok(active.length < session.getAllTools().length || active.includes("ask_human"), "the grant is the profile's, not every registered tool");
    const ledger = await new ExecutionStore(repo).getBudget(contract.unitId, 1);
    assert.equal(ledger?.attempt, 1, "the budget guard found the unit through its lease and wrote the attempt's ledger");
    assert.equal(ledger?.unitId, contract.unitId);
  } finally {
    session.dispose();
  }
});

// The first live run on 0.1.2 ended two units with "every model in the route failed": the budget guard had halted
// the attempt at its token ceiling, Pi recorded the abort as an errored message, and the dispatcher failed over to
// two fallbacks that overwrote the ledger. The ledger decides; the message alone does not.
test("attemptEnd: a halt recorded in the ledger is not a provider failure; an errored message without one is; anything else completed", () => {
  const ledger = { unitId: "u", attempt: 1, ceiling: { tokens: 10, wallClockMs: 10, turns: 10 }, consumed: { tokens: 10, cost: 0, wallClockMs: 1, turns: 1 }, startedAt: "t", updatedAt: "t", models: ["anthropic/claude-sonnet-4-5"], compactions: [] };
  assert.equal(attemptEnd({ stopReason: "error" }, { ...ledger, exhausted: { dimension: "tokens", at: "t" } }), "halted", "the guard's abort surfaces as an errored message; the ledger says it was the ceiling");
  assert.equal(attemptEnd({ stopReason: "aborted" }, { ...ledger, exhausted: { dimension: "turns", at: "t" } }), "halted");
  assert.equal(attemptEnd({ stopReason: "error" }, ledger), "provider-error", "no ceiling crossed: the provider failed, fail over");
  assert.equal(attemptEnd({ stopReason: "error" }, undefined), "provider-error", "no ledger at all (the guard never started): still a provider failure");
  assert.equal(attemptEnd({ stopReason: "stop" }, ledger), "completed");
  assert.equal(attemptEnd({ stopReason: "toolUse" }, ledger), "completed");
  assert.equal(attemptEnd(undefined, ledger), "completed", "no assistant message: nothing to fail over from");
});

test("the host says which models it can run on now, as provider/id, the same lookup the dispatcher chooses from", async () => {
  const { host } = await import("./dispatcher.js");
  const available = await host.availableModels!();
  assert.ok(Array.isArray(available));
  for (const ref of available) assert.match(ref, /^[a-z0-9-]+\/.+$/, `a provider/id reference: ${ref}`);
});

// The behavioral canary acts (#133). No model: each dispatch opens a real session through `openUnitSession`, so the
// definition's extensions are bound, and the assistant replies are played to them as Pi plays them — `message_end`
// for the canary and the meter, the `turn_end` boundary for the guard's ledger write. Nothing here stops the session
// when the canary falls silent; the attempt ends as the script ends, and what the loop does next is the router's.
type Reply = { text: string; tokens: number };
type Played = { sessionId: string; hint: string | undefined };
function scriptedSessions(script: (call: number, request: Parameters<Dispatcher>[0], store: ExecutionStore) => Promise<Reply[]>, repo: string, played: Played[]): Dispatcher {
  return async (request) => {
    const { session, extensionErrors } = await openUnitSession({
      worktree: request.worktree, unitId: request.unitId, contractPath: request.contractPath, profile: request.profile, policyPath: request.policyPath, sessionManager: SessionManager.inMemory(),
    });
    try {
      const replies = await script(played.length + 1, request, new ExecutionStore(repo));
      for (const [turnIndex, reply] of replies.entries()) {
        const message = {
          role: "assistant" as const, content: [{ type: "text" as const, text: reply.text }], api: "anthropic-messages", provider: "anthropic", model: "claude-sonnet-4-5", stopReason: "stop" as const, timestamp: Date.now(),
          usage: { input: reply.tokens, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: reply.tokens, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        };
        await session.extensionRunner.emitMessageEnd({ type: "message_end", message } as never);
        await session.extensionRunner.emitBoundary({ type: "turn_end", turnIndex, message, toolResults: [], messageEntryId: `m${turnIndex}`, toolResultEntryIds: [], outcome: "completed" } as never, () => ({}) as never);
      }
      assert.deepEqual(extensionErrors, [], "no extension handler failed while the session ran");
      played.push({ sessionId: session.sessionId, hint: request.hint });
      return { sessionId: session.sessionId };
    } finally {
      await session.extensionRunner.emit({ type: "session_shutdown", reason: "quit" }).catch(() => undefined);
      session.dispose();
    }
  };
}

function reportFor(contract: WorkContract, attempt: number): ResultReport {
  return {
    contractId: contract.id, contractVersion: contract.version, unitId: contract.unitId, attempt, reportedAt: new Date().toISOString(), summary: "done",
    evidence: [{ class: "test", ref: "run_tests", observation: "all pass" }, { class: "command", ref: "run_checks", observation: "all pass" }],
    delegatedResults: contract.delegated.map((d) => ({ decisionId: d.id, choice: "kept it simple" })),
    unresolvedOutcomes: contract.unresolved.map((d) => ({ decisionId: d.id, outcome: "preserved" as const, note: "untouched" })),
    emergentDecisions: [], deviations: [], residualUncertainty: [],
  };
}

async function loopOptions() {
  return {
    policy: await loadPolicy(), policyPath: POLICY_PATH, routing: await loadRoutingPolicy(), interaction: await loadInteractionPolicy(), workload: await loadWorkload(),
    regulators: (await loadRegistry(path.join(LAB_ROOT, "registry"))).records.map((r) => r.id),
  };
}

// Two replies without the marker after one with it: the shipped budget policy's canary (`[{unit}]`, 2 misses) records its finding on the
// third reply. The session goes on to a fourth, which the meter counts like the others, and ends without a report.
const degraded: Reply[] = [{ text: "[u1] Reading the contract.", tokens: 40_000 }, { text: "Now the tests.", tokens: 50_000 }, { text: "Let me look at the source again.", tokens: 60_000 }, { text: "[u1] One more read.", tokens: 20_000 }];

test("context-degradation (#133): under a recovery policy that declares the rule, an attempt that carries the canary's finding and no report is routed under the cause and dispatched again in a new session on the same ledger — the retry spends what the degraded attempt left — and the finding stays advisory", async (t) => {
  const repo = await initRepo(t);
  const contract = await loadContract(path.join(LAB_ROOT, "contracts", "fix-known-issue.json"));
  const shipped = await loadRecoveryPolicy();
  assert.equal(shipped.rules.some((r) => r.cause === "context-degradation"), false, "the shipped recovery policy declares no rule for the cause: adopting it is this one line");
  const recovery: RecoveryPolicy = { ...shipped, name: "recovery-with-canary", rules: [...shipped.rules, { cause: "context-degradation", actions: ["retry", "escalate"] }] };
  const played: Played[] = [];
  const { final, decisions } = await driveUnit(gitExec, {
    ...(await loopOptions()), repo, contract, recovery, owner: "alice",
    dispatcher: scriptedSessions(async (call, request, store) => {
      if (call === 1) return degraded;
      // The fresh session: the canary's count is the session's, so it starts at zero; the unit does the work and reports.
      await writeFile(path.join(request.worktree, "src.txt"), "fixed\n");
      await gitExec("git", ["add", "-A"], { cwd: request.worktree });
      await gitExec("git", ["commit", "-qm", "fix"], { cwd: request.worktree });
      await store.writeReport(reportFor(contract, request.attempt));
      return [{ text: "[u1] Fixed and reported.", tokens: 30_000 }];
    }, repo, played),
  });

  const store = new ExecutionStore(repo);
  assert.deepEqual(decisions.map((d) => [d.attempt, d.cause, d.action, d.occurrence, d.policy.name]), [[1, "context-degradation", "retry", 1, "recovery-with-canary"]], "routed under the cause, by the rule the policy declares");
  assert.match(decisions[0]!.evidence.join("; "), /attempt 1: no-report; .*S3\* audit: context-degradation — the behavioral canary recorded 1 finding\(s\) during attempt 1, .*\(2 consecutive replies without \[u1\]\)/);
  assert.equal(played.length, 2, "dispatched again");
  assert.notEqual(played[0]!.sessionId, played[1]!.sessionId, "in a new session");
  assert.equal(played[0]!.hint, undefined);
  assert.match(played[1]!.hint ?? "", /fresh session on the same budget/);

  const first = await store.getBudget("u1", 1);
  const second = await store.getBudget("u1", 2);
  assert.deepEqual([first?.consumed.tokens, first?.consumed.turns, first?.exhausted, first?.carried], [170_000, 4, undefined, undefined], "attempt 1 ran on past the finding to its own end, 170,000 of 400,000 tokens, and was not halted: nothing stopped the model");
  assert.deepEqual(second?.carried && [second.carried.attempt, second.carried.consumed.tokens, second.carried.consumed.turns], [1, 170_000, 4], "attempt 2's ledger says what it carried, and from which attempt");
  assert.deepEqual([second?.consumed.tokens, second?.consumed.turns], [200_000, 5], "the ledger continues: 170,000 carried and 30,000 of its own, against one ceiling");
  assert.equal(second?.ceiling.tokens, first?.ceiling.tokens, "the same ceiling, not a second allowance");
  assert.deepEqual([ownConsumption(second!).tokens, ownConsumption(first!).tokens + ownConsumption(second!).tokens], [30_000, 200_000], "and the unit's cost counts each token once");

  assert.equal(final.status, "closed", "the fresh session closed the unit");
  assert.deepEqual((await store.listAttempts("u1")).map((a) => [a.attempt, a.outcome, a.sessionId]), [[1, "no-report", played[0]!.sessionId], [2, "reported", played[1]!.sessionId]], "two attempt records: the retry is counted against the attempt ceiling like any other");
  const findings = (await readSignals(repo)).filter((m): m is AuditFinding => m.kind === "audit-finding" && m.invariant === "context-degradation");
  assert.deepEqual(findings.map((f) => [f.severity, f.channel, f.source, f.unit]), [["advisory", "audit", "S3*", "u1"]], "one finding, still advisory on the audit channel: the cause is what the loop read");
});

test("context-degradation (#133): under the shipped recovery policy, which declares no rule for it, the same attempt is routed as no-report and retried on a new ledger, as before; the finding is evidence on the decision", async (t) => {
  const repo = await initRepo(t);
  const contract = await loadContract(path.join(LAB_ROOT, "contracts", "fix-known-issue.json"));
  const played: Played[] = [];
  const { decisions } = await driveUnit(gitExec, {
    ...(await loopOptions()), repo, contract, recovery: await loadRecoveryPolicy(), owner: "alice",
    dispatcher: scriptedSessions(async (call) => (call === 1 ? degraded : [{ text: "[u1] Still looking.", tokens: 10_000 }]), repo, played),
  });
  assert.deepEqual(decisions.map((d) => [d.attempt, d.cause, d.action, d.occurrence]), [[1, "no-report", "retry", 1], [2, "no-report", "retry", 2], [3, "no-report", "escalate", 3]], "no rule, no cause: the silent end is routed by the rule for no-report, never by the fallback");
  assert.match(decisions[0]!.evidence.join("; "), /S3\* audit: context-degradation/, "the silence is on the record of the decision that did not act on it");
  assert.doesNotMatch(decisions[1]!.evidence.join("; "), /context-degradation/, "attempt 1's finding is not attempt 2's");
  const store = new ExecutionStore(repo);
  const second = await store.getBudget("u1", 2);
  assert.deepEqual([second?.carried, second?.consumed.tokens], [undefined, 10_000], "a retry under any other cause opens a new ledger");
});
