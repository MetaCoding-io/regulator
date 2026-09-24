import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { EffectJournal, ExecutionStore, effectKey } from "@metacoding/regulator-core";
import { createRecoveryExtension, outboxHas } from "./recovery.js";
import { loadContract } from "./contract.js";
import { gitExec, initRepo , LAB_ROOT } from "@metacoding/regulator";
import { ctxFor, mockPi } from "./test-support.js";
import { startUnit } from "@metacoding/regulator";



async function contracted(repo: string) {
  const contract = await loadContract(path.join(LAB_ROOT, "contracts", "fix-known-issue.json"));
  await new ExecutionStore(repo).createUnit(contract);
  return contract;
}

test("failure observations: tool and provider errors are normalized to causes and appended to the unit's observations for the router", async (t) => {
  const repo = await initRepo(t);
  const contract = await contracted(repo);
  const started = await startUnit(gitExec, { repo, unitId: contract.unitId, owner: "alice" });
  const { pi, handlers } = mockPi();
  createRecoveryExtension({ now: () => 1_700_000_000_000 })(pi);
  const { ctx, statuses } = ctxFor(started.worktree.path);
  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
  assert.equal(statuses.recovery, "recovery: observing unit u1 attempt 1");
  await handlers.get("tool_execution_end")!({ type: "tool_execution_end", toolCallId: "t1", toolName: "run_tests", isError: true, result: { content: [{ type: "text", text: "Test command did not produce a test summary (exit 1): node --test\nError: Cannot find module 'left-pad'" }] } }, ctx);
  await handlers.get("tool_execution_end")!({ type: "tool_execution_end", toolCallId: "t2", toolName: "bash", isError: true, result: { content: [{ type: "text", text: "command timed out after 120000 ms" }] } }, ctx);
  await handlers.get("tool_execution_end")!({ type: "tool_execution_end", toolCallId: "t3", toolName: "read", isError: false, result: { content: [{ type: "text", text: "fine" }] } }, ctx);
  await handlers.get("tool_execution_end")!({ type: "tool_execution_end", toolCallId: "t4", toolName: "report_result", isError: true, result: { content: [{ type: "text", text: "Report refused against tc-fix v1:\n- unresolved: u-unicode is unresolved in the contract but has no outcome" }] } }, ctx);
  await handlers.get("agent_end")!({ type: "agent_end", messages: [{ role: "assistant", stopReason: "error", errorMessage: "429 rate limited by provider" }] }, ctx);
  const observations = await new ExecutionStore(repo).listObservations("u1");
  assert.deepEqual(observations.map((o) => [o.source, o.toolName, o.cause]), [["tool", "run_tests", "environment"], ["tool", "bash", "timeout"], ["tool", "report_result", "invalid-report"], ["provider", undefined, "tool-error"]]);
  assert.equal(observations[0]?.attempt, 1);
  assert.match(observations[0]?.message ?? "", /^Test command did not produce a test summary .* Cannot find module 'left-pad'$/, "the whole failure text is kept on one line, so the cause and the hint can see it");

  const none = mockPi();
  createRecoveryExtension()(none.pi);
  const b = ctxFor(repo);
  await none.handlers.get("session_start")!({ type: "session_start", reason: "startup" }, b.ctx);
  assert.equal(b.statuses.recovery, "recovery: no unit");
  await none.handlers.get("tool_execution_end")!({ type: "tool_execution_end", toolCallId: "t", toolName: "bash", isError: true, result: { content: [{ type: "text", text: "x" }] } }, b.ctx);
  assert.deepEqual(await new ExecutionStore(repo).listObservations("u1"), observations, "no unit, nothing observed");
});

test("notify_owner is durable: journaled before the send, committed after, sent once per key, and a crash between send and record is reconciled on the next start rather than repeated", async (t) => {
  const repo = await initRepo(t);
  const contract = await contracted(repo);
  const started = await startUnit(gitExec, { repo, unitId: contract.unitId, owner: "alice" });
  const outbox = path.join(repo, "outbox.txt");
  let clock = 1_700_000_000_000;
  const boot = async (crashAfterEffect = false) => {
    const { pi, handlers, tools } = mockPi();
    createRecoveryExtension({ now: () => clock, outbox, crashAfterEffect })(pi);
    const { ctx, notices } = ctxFor(started.worktree.path);
    await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
    return { notify: (message: string) => tools.get("notify_owner")!.execute("c", { message }, undefined as never, undefined as never, ctx as never), notices };
  };
  const journal = new EffectJournal(repo);
  const key = effectKey("u1", "notify_owner", { message: "tests cannot run: left-pad is missing" });

  const a = await boot();
  const sent = await a.notify("tests cannot run: left-pad is missing");
  assert.match((sent.content[0] as { text: string }).text, /Sent to the owner/);
  assert.equal((await readFile(outbox, "utf8")).split("\n").filter(Boolean).length, 1);
  assert.equal((await journal.state(key))?.status, "committed");
  const again = await a.notify("tests cannot run: left-pad is missing");
  assert.match((again.content[0] as { text: string }).text, /Already sent \(committed/);
  assert.equal((await readFile(outbox, "utf8")).split("\n").filter(Boolean).length, 1, "sent once");
  await a.notify("a different message");
  assert.equal((await readFile(outbox, "utf8")).split("\n").filter(Boolean).length, 2);

  // The crash: the line reaches the outbox, the process dies before the commit line is written.
  const crashing = await boot(true);
  await assert.rejects(crashing.notify("deploy window closes at noon"), /simulated crash/);
  const crashedKey = effectKey("u1", "notify_owner", { message: "deploy window closes at noon" });
  assert.equal(await outboxHas(outbox, crashedKey), true, "the effect happened");
  assert.equal((await journal.state(crashedKey))?.status, "intended", "but was never recorded");

  // Restart: reconciliation asks the outbox, confirms, and the tool does not send again.
  clock += 5000;
  const restarted = await boot();
  assert.match(restarted.notices.find((n) => /reconciled effect/.test(n.message))?.message ?? "", /it had happened; not repeating it/);
  assert.equal((await journal.state(crashedKey))?.status, "confirmed");
  const dup = await restarted.notify("deploy window closes at noon");
  assert.match((dup.content[0] as { text: string }).text, /Already sent \(confirmed/);
  assert.equal((await readFile(outbox, "utf8")).split("\n").filter(Boolean).length, 3, "still three lines: nothing was repeated");
  assert.deepEqual((await journal.states()).map((s) => s.status), ["committed", "committed", "confirmed"]);
});

test("checkpoint 7 loads into a real Pi session and registers notify_owner with its effect declared", async (t) => {
  const repo = await initRepo(t);
  const contract = await contracted(repo);
  const started = await startUnit(gitExec, { repo, unitId: contract.unitId, owner: "alice" });
  const cwd = started.worktree.path;
  const agentDir = path.join(repo, "agent-config");
  const settingsManager = SettingsManager.inMemory();
  const loader = new DefaultResourceLoader({
    cwd, agentDir, settingsManager, additionalExtensionPaths: [fileURLToPath(new URL("./recovery.js", import.meta.url))],
    noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
  });
  await loader.reload();
  assert.deepEqual(loader.getExtensions().errors, []);
  const modelRuntime = await ModelRuntime.create({
    authPath: path.join(agentDir, "auth.json"), modelsPath: null, modelsStorePath: path.join(agentDir, "models-cache.json"),
    allowModelNetwork: false, refreshOnCreate: false,
  });
  const { session, extensionsResult } = await createAgentSession({ cwd, agentDir, settingsManager, modelRuntime, sessionManager: SessionManager.inMemory(cwd), resourceLoader: loader });
  t.after(() => session.dispose());
  await session.bindExtensions({});
  assert.ok(extensionsResult.extensions[0]?.tools.has("notify_owner"));
  const { TOOL_EFFECTS } = await import("@metacoding/regulator-core");
  assert.equal(TOOL_EFFECTS.notify_owner?.sideEffects, "irreversible", "an effect that cannot be unsent says so");
});
