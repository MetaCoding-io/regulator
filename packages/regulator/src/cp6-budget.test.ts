import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { ExecutionStore, UNITS_RELATIVE_DIR } from "@metacoding/vsm-pi-core";
import type { BudgetLedger, WorkContract } from "@metacoding/vsm-pi-protocol";
import { createBudgetExtension } from "./cp6-budget.js";
import { loadContract } from "./cp5-contract.js";
import { gitExec, initRepo } from "./git-support.js";
import { POLICY_PATH } from "./policy.js";
import { ctxFor, mockPi } from "./test-support.js";
import { startUnit } from "./unit.js";

const LAB_ROOT = fileURLToPath(new URL("../", import.meta.url));

async function tinyPolicy(repo: string, ceiling: Record<string, number>): Promise<string> {
  const { writeFile } = await import("node:fs/promises");
  const file = path.join(repo, "tiny-policy.json");
  await writeFile(file, JSON.stringify({
    name: "tiny", version: 1, description: "a ceiling small enough to hit in a test",
    budgets: { default: { tokens: 1000, wallClockMs: 60_000, turns: 3, attempts: 2, ...ceiling } },
    models: { default: { primary: "anthropic/claude-sonnet-4-5", fallback: [] } },
  }), "utf8");
  return file;
}

async function contracted(repo: string): Promise<{ contract: WorkContract; file: string }> {
  const contract = await loadContract(path.join(LAB_ROOT, "contracts", "fix-known-issue.json"));
  await new ExecutionStore(repo).createUnit(contract);
  return { contract, file: path.join(repo, UNITS_RELATIVE_DIR, contract.unitId, "contract.v1.json") };
}

const usage = (totalTokens: number, cost = 0) => ({ type: "message_end", message: { role: "assistant", usage: { input: totalTokens, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens, cost: { total: cost } } } });
const turnEnd = { type: "turn_end", turnIndex: 0, message: {}, toolResults: [] };

test("budget guard: the ledger is written at start, counts usage and turns, and the first ceiling crossed halts the attempt and refuses every effectful tool", async (t) => {
  const repo = await initRepo(t);
  const { contract } = await contracted(repo);
  const started = await startUnit(gitExec, { repo, unitId: contract.unitId, owner: "alice" });
  const policy = await tinyPolicy(repo, { tokens: 1000, turns: 5 });
  let clock = 1_700_000_000_000;
  const { pi, handlers, flags } = mockPi();
  flags.set("policy", policy);
  createBudgetExtension({ now: () => clock, summarize: async () => undefined })(pi);
  const { ctx, statuses, notices, state } = ctxFor(started.worktree.path, { model: { provider: "anthropic", id: "claude-sonnet-4-5" } });
  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
  const store = new ExecutionStore(repo);
  const initial = await store.getBudget(contract.unitId, 1);
  assert.equal(initial?.attempt, 1);
  assert.deepEqual(initial?.ceiling, { tokens: 1000, wallClockMs: 60_000, turns: 5 });
  assert.deepEqual(initial?.models, ["anthropic/claude-sonnet-4-5"]);
  assert.match(statuses.budget ?? "", /0\/1000 tok/);

  handlers.get("message_end")!(usage(400, 0.01), ctx);
  clock += 1000;
  await handlers.get("turn_end")!(turnEnd, ctx);
  assert.equal(state.aborts, 0);
  const write = { type: "tool_call", toolName: "write", toolCallId: "w", input: { path: "src.txt", content: "" } };
  assert.equal(handlers.get("tool_call")!(write, ctx), undefined, "under the ceiling, writes run");
  handlers.get("tool_execution_start")?.({ type: "tool_execution_start", toolCallId: "t1", toolName: "run_tests", args: {} }, ctx);
  handlers.get("tool_execution_end")!({ type: "tool_execution_end", toolCallId: "t1", toolName: "run_tests", isError: false, result: { content: [{ type: "text", text: "4 passed, 0 failed (node --test)\nmore" }] } }, ctx);
  handlers.get("model_select")!({ type: "model_select", model: { provider: "openai", id: "gpt-5" }, previousModel: undefined, source: "set" }, ctx);

  handlers.get("message_end")!(usage(700, 0.02), ctx);
  await handlers.get("turn_end")!(turnEnd, ctx);
  assert.equal(state.aborts, 1, "the ceiling halts the attempt");
  assert.match(notices.at(-1)?.message ?? "", /budget exhausted \(tokens\)/);
  const ledger = (await store.getBudget(contract.unitId, 1)) as BudgetLedger;
  assert.deepEqual(ledger.consumed, { tokens: 1100, cost: 0.03, wallClockMs: 1000, turns: 2 });
  assert.equal(ledger.exhausted?.dimension, "tokens");
  assert.deepEqual(ledger.models, ["anthropic/claude-sonnet-4-5", "openai/gpt-5"]);
  const refused = handlers.get("tool_call")!(write, ctx) as { block: boolean; reason: string };
  assert.equal(refused.block, true);
  assert.match(refused.reason, /tokens budget is exhausted/);
  assert.equal(handlers.get("tool_call")!({ type: "tool_call", toolName: "read", toolCallId: "r", input: { path: "x" } }, ctx), undefined, "reads still run: reporting needs them");
  const bash = { type: "tool_call", toolName: "bash", toolCallId: "b", input: { command: "ls" } };
  assert.equal((handlers.get("tool_call")!(bash, ctx) as { block: boolean }).block, true, "the shell is covered");
});

test("budget guard: turns and wall-clock are ceilings too; without a unit nothing is metered and nothing halts", async (t) => {
  const repo = await initRepo(t);
  const { contract } = await contracted(repo);
  const started = await startUnit(gitExec, { repo, unitId: contract.unitId, owner: "alice" });
  let clock = 1_700_000_000_000;
  const turns = mockPi();
  turns.flags.set("policy", await tinyPolicy(repo, { turns: 2, tokens: 999_999 }));
  createBudgetExtension({ now: () => clock })(turns.pi);
  const a = ctxFor(started.worktree.path);
  await turns.handlers.get("session_start")!({ type: "session_start", reason: "startup" }, a.ctx);
  await turns.handlers.get("turn_end")!(turnEnd, a.ctx);
  assert.equal(a.state.aborts, 0);
  await turns.handlers.get("turn_end")!(turnEnd, a.ctx);
  assert.equal(a.state.aborts, 1);
  assert.match(a.notices.at(-1)?.message ?? "", /exhausted \(turns\)/);

  const none = mockPi();
  createBudgetExtension({ now: () => clock })(none.pi);
  const b = ctxFor(repo);
  await none.handlers.get("session_start")!({ type: "session_start", reason: "startup" }, b.ctx);
  assert.equal(b.statuses.budget, "budget: none (no unit)");
  none.handlers.get("message_end")!(usage(10_000_000), b.ctx);
  await none.handlers.get("turn_end")!(turnEnd, b.ctx);
  assert.equal(b.state.aborts, 0);
  assert.equal(none.handlers.get("tool_call")!({ type: "tool_call", toolName: "write", toolCallId: "w", input: {} }, b.ctx), undefined);
  await none.commands.get("budget")!.handler("", b.ctx);
  assert.match(b.notices.at(-1)?.message ?? "", /nothing is metered/);
});

test("contract-preserving compaction: the summary begins with the contract allocation, evidence pointers and touched files, whether or not a model summary is available", async (t) => {
  const repo = await initRepo(t);
  const { contract } = await contracted(repo);
  const started = await startUnit(gitExec, { repo, unitId: contract.unitId, owner: "alice" });
  const boot = async (summarize: (() => Promise<string | undefined>) | undefined) => {
    const { pi, handlers, flags } = mockPi();
    flags.set("policy", await tinyPolicy(repo, {}));
    createBudgetExtension({ now: () => 1_700_000_000_000, ...(summarize ? { summarize } : {}) })(pi);
    const { ctx, notices } = ctxFor(started.worktree.path);
    await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
    handlers.get("tool_execution_end")!({ type: "tool_execution_end", toolCallId: "t1", toolName: "run_checks", isError: false, result: { content: [{ type: "text", text: "2 checks passed" }] } }, ctx);
    handlers.get("tool_execution_end")!({ type: "tool_execution_end", toolCallId: "t2", toolName: "run_tests", isError: true, result: {} }, ctx);
    return { handlers, ctx, notices };
  };
  const preparation = {
    firstKeptEntryId: "entry-42", messagesToSummarize: [{ role: "user", content: "hello", timestamp: 1 }], turnPrefixMessages: [], isSplitTurn: false,
    tokensBefore: 120_000, fileOps: { read: new Set(["README.md"]), written: new Set(["src/slugify.js"]), edited: new Set(["test/basics.test.js"]) }, settings: {},
  };
  const event = { type: "session_before_compact", preparation, branchEntries: [], reason: "threshold", willRetry: false, signal: new AbortController().signal };

  const withModel = await boot(async () => "Progress: fixed the collapse. Next: run tests.");
  const result = await withModel.handlers.get("session_before_compact")!(event, withModel.ctx) as { compaction: { summary: string; firstKeptEntryId: string; tokensBefore: number; details: unknown } };
  const summary = result.compaction.summary;
  assert.equal(result.compaction.firstKeptEntryId, "entry-42");
  assert.equal(result.compaction.tokensBefore, 120_000);
  assert.ok(summary.startsWith("## Regulator context (preserved across compaction"), "the deterministic block comes first");
  for (const needle of [`${contract.id} v${contract.version}`, "f-signature:", "f-vendor:", "d-helpers:", "u-unicode:", "run_checks: 2 checks passed", "src/slugify.js, test/basics.test.js", "Progress: fixed the collapse"]) {
    assert.ok(summary.includes(needle), `missing: ${needle}`);
  }
  assert.ok(!summary.includes("run_tests"), "a failed evidence tool is not evidence");
  assert.deepEqual((result.compaction.details as { regulator: { evidence: number; modified: string[] } }).regulator.evidence, 1);
  const ledger = await new ExecutionStore(repo).getBudget(contract.unitId, 1);
  assert.deepEqual(ledger?.compactions.map((c) => [c.reason, c.preserved]), [["threshold", true]]);

  const withoutModel = await boot(async () => undefined);
  const fallback = await withoutModel.handlers.get("session_before_compact")!(event, withoutModel.ctx) as { compaction: { summary: string } };
  assert.ok(fallback.compaction.summary.includes("f-signature:"), "the contract block does not depend on the model");
  assert.match(fallback.compaction.summary, /Not available .* 1 messages were compacted/);

  const bare = await boot(undefined);
  const defaultSummarizer = await bare.handlers.get("session_before_compact")!(event, bare.ctx) as { compaction: { summary: string } };
  assert.match(defaultSummarizer.compaction.summary, /Not available/, "no model in the mock context: the default summarizer declines and the block still carries");
  await bare.handlers.get("session_compact")!({ type: "session_compact", compactionEntry: {}, fromExtension: false, reason: "threshold", willRetry: false }, bare.ctx);
  assert.match(bare.notices.at(-1)?.message ?? "", /NOT carried/);
});

test("checkpoint 6 loads into a real Pi session next to checkpoint 5 and writes the attempt's ledger", async (t) => {
  const repo = await initRepo(t);
  const { contract, file } = await contracted(repo);
  const started = await startUnit(gitExec, { repo, unitId: contract.unitId, owner: "alice" });
  const cwd = started.worktree.path;
  const agentDir = path.join(repo, "agent-config");
  const settingsManager = SettingsManager.inMemory();
  const loader = new DefaultResourceLoader({
    cwd, agentDir, settingsManager,
    additionalExtensionPaths: ["cp5-contract.js", "cp6-budget.js"].map((f) => fileURLToPath(new URL(`./${f}`, import.meta.url))),
    noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
  });
  await loader.reload();
  assert.deepEqual(loader.getExtensions().errors, []);
  const runtime = loader.getExtensions().runtime;
  runtime.flagValues.set("contract", file); runtime.flagValues.set("policy", POLICY_PATH);
  const modelRuntime = await ModelRuntime.create({
    authPath: path.join(agentDir, "auth.json"), modelsPath: null, modelsStorePath: path.join(agentDir, "models-cache.json"),
    allowModelNetwork: false, refreshOnCreate: false,
  });
  const { session } = await createAgentSession({ cwd, agentDir, settingsManager, modelRuntime, sessionManager: SessionManager.inMemory(cwd), resourceLoader: loader });
  t.after(() => session.dispose());
  await session.bindExtensions({});
  await session.waitForIdle();
  const ledger = await new ExecutionStore(repo).getBudget(contract.unitId, 1);
  assert.equal(ledger?.attempt, 1);
  assert.equal(ledger?.ceiling.tokens, 400_000, "the implement ceiling from policies/default.json");
});
