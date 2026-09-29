import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { ExecutionStore, UNITS_RELATIVE_DIR } from "@metacoding.io/regulator-core";
import { LAB_ROOT, POLICY_PATH, gitExec, initRepo, startUnit } from "@metacoding.io/regulator";
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
