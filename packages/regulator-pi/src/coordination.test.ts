import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { createCoordinationExtension, oscillationThreshold } from "./coordination.js";
import { gitExec, initRepo } from "@metacoding/regulator";
import { ctxFor, mockPi } from "./test-support.js";
import { SIGNALS_RELATIVE_PATH, startUnit } from "@metacoding/regulator";

const write = (p: string) => ({ type: "tool_call", toolName: "write", toolCallId: p, input: { path: p, content: "" } });
const bash = { type: "tool_call", toolName: "bash", toolCallId: "sh", input: { command: "sed -i s/a/b/ src.txt" } };
const read = { type: "tool_call", toolName: "read", toolCallId: "r", input: { path: "src.txt" } };

test("lease gate: read-only effects pass; write, bash and run_tests need a live lease on this worktree", async (t) => {
  const repo = await initRepo(t);
  let clock = 9_000_000;
  const now = () => clock;
  const started = await startUnit(gitExec, { repo, unitId: "u1", owner: "alice", ttlMs: 10_000, now });

  // In the worktree, as the leased unit.
  const { pi, handlers, flags } = mockPi();
  flags.set("unit", "u1");
  createCoordinationExtension({ now, ttlMs: 10_000 })(pi);
  const { ctx, statuses } = ctxFor(started.worktree.path);
  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
  assert.equal(statuses.unit, "unit: u1 (lease ok)");
  assert.equal(await handlers.get("tool_call")!(read, ctx), undefined);
  assert.equal(await handlers.get("tool_call")!(write("src.txt"), ctx), undefined);
  assert.equal(await handlers.get("tool_call")!(bash, ctx), undefined, "the lease gate covers the shell");
  assert.equal(await handlers.get("tool_call")!({ type: "tool_call", toolName: "run_tests", toolCallId: "t", input: {} }, ctx), undefined);

  // Heartbeat at turn end keeps it alive; silence lets it expire.
  clock += 8_000;
  await handlers.get("turn_end")!({ type: "turn_end", turnIndex: 0, message: {}, toolResults: [] }, ctx);
  clock += 8_000;
  assert.equal(await handlers.get("tool_call")!(write("src.txt"), ctx), undefined, "renewed at turn end");
  clock += 11_000;
  const expired = await handlers.get("tool_call")!(write("src.txt"), ctx);
  assert.equal((expired as { block: boolean }).block, true);
  assert.match((expired as { reason: string }).reason, /no live lease for unit "u1"/);
  assert.equal(await handlers.get("tool_call")!(read, ctx), undefined, "reads never need a lease");

  // In the base checkout, the lease does not cover this directory.
  const other = mockPi();
  other.flags.set("unit", "u1");
  createCoordinationExtension({ now: () => 9_000_000, ttlMs: 10_000 })(other.pi);
  const base = ctxFor(repo);
  await other.handlers.get("session_start")!({ type: "session_start", reason: "startup" }, base.ctx);
  assert.equal(base.statuses.unit, "unit: u1 (no live lease)");
  assert.equal((await other.handlers.get("tool_call")!(write("src.txt"), base.ctx) as { block: boolean }).block, true);

  // No unit at all: fail closed on everything non-read-only, including an undeclared tool.
  const none = mockPi();
  createCoordinationExtension({ now })(none.pi);
  const noneCtx = ctxFor(started.worktree.path);
  await none.handlers.get("session_start")!({ type: "session_start", reason: "startup" }, noneCtx.ctx);
  assert.equal(noneCtx.statuses.unit, "unit: none (writes refused)");
  assert.match((await none.handlers.get("tool_call")!(write("x"), noneCtx.ctx) as { reason: string }).reason, /no unit/);
  assert.equal((await none.handlers.get("tool_call")!({ type: "tool_call", toolName: "mystery", toolCallId: "m", input: {} }, noneCtx.ctx) as { block: boolean }).block, true);
  assert.equal(await none.handlers.get("tool_call")!(read, noneCtx.ctx), undefined);
});

test("thrash detector: the fourth edit to one file emits a typed coordination signal for S3", async (t) => {
  const repo = await initRepo(t);
  const started = await startUnit(gitExec, { repo, unitId: "u1", owner: "alice" });
  const { pi, handlers, flags } = mockPi();
  flags.set("unit", "u1");
  createCoordinationExtension({ threshold: 4 })(pi);
  const { ctx, notices } = ctxFor(started.worktree.path);
  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
  let calls = 0;
  const edit = async (p: string, isError = false) => {
    const toolCallId = `call-${calls++}`;
    handlers.get("tool_execution_start")!({ type: "tool_execution_start", toolCallId, toolName: "edit", args: { path: p, edits: [] } }, ctx);
    await handlers.get("tool_execution_end")!({ type: "tool_execution_end", toolCallId, toolName: "edit", result: {}, isError }, ctx);
  };
  await edit("src/slugify.js"); await edit("src/slugify.js"); await edit("src/slugify.js");
  await edit("src/slugify.js", true);
  await edit("src/other.js");
  await assert.rejects(readFile(path.join(repo, SIGNALS_RELATIVE_PATH)), /ENOENT/, "three edits and a failed one are not oscillation");
  await edit("src/slugify.js");
  const lines = (await readFile(path.join(repo, SIGNALS_RELATIVE_PATH), "utf8")).trim().split("\n");
  assert.equal(lines.length, 1);
  const signal = JSON.parse(lines[0]!);
  assert.equal(signal.kind, "coordination-signal");
  assert.equal(signal.source, "S2");
  assert.equal(signal.destination, "S3");
  assert.equal(signal.coordination, "oscillation");
  assert.equal(signal.unit, "u1");
  assert.equal(signal.subject, "src/slugify.js");
  assert.match(signal.observation, /4 edits/);
  assert.equal(notices.at(-1)?.level, "warning");
});

test("Pi 0.87.0 loads the built checkpoint; the native hook refuses a write outside a leased worktree and allows one inside", async (t) => {
  const repo = await initRepo(t);
  const started = await startUnit(gitExec, { repo, unitId: "u1", owner: "alice" });
  process.env.REGULATOR_UNIT = "u1";
  t.after(() => { delete process.env.REGULATOR_UNIT; });
  const boot = async (cwd: string) => {
    const agentDir = path.join(cwd, "agent-config");
    const settingsManager = SettingsManager.inMemory();
    const loader = new DefaultResourceLoader({
      cwd, agentDir, settingsManager,
      additionalExtensionPaths: [fileURLToPath(new URL("./coordination.js", import.meta.url))],
      noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
    });
    await loader.reload();
    assert.deepEqual(loader.getExtensions().errors, []);
    const modelRuntime = await ModelRuntime.create({
      authPath: path.join(agentDir, "auth.json"), modelsPath: null,
      modelsStorePath: path.join(agentDir, "models-cache.json"),
      allowModelNetwork: false, refreshOnCreate: false,
    });
    const { session } = await createAgentSession({
      cwd, agentDir, settingsManager, modelRuntime,
      sessionManager: SessionManager.inMemory(cwd), resourceLoader: loader, tools: ["read", "write"],
    });
    t.after(() => session.dispose());
    await session.bindExtensions({});
    const assistantMessage = {
      role: "assistant" as const, content: [], api: "openai-responses" as const, provider: "test", model: "test",
      stopReason: "toolUse" as const, timestamp: 0,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    };
    type ToolInput = { path: string; content?: string };
    return (name: "read" | "write", input: ToolInput) =>
      session.agent.beforeToolCall!({ toolCall: { type: "toolCall", id: input.path, name, arguments: input }, args: input, context: session.agent.state, assistantMessage });
  };
  const inWorktree = await boot(started.worktree.path);
  assert.equal((await inWorktree("write", { path: "src.txt", content: "x" }))?.block, undefined);
  const inBase = await boot(repo);
  const refused = await inBase("write", { path: "src.txt", content: "x" });
  assert.equal(refused?.block, true);
  assert.match(refused?.reason ?? "", /no live lease/);
  assert.equal((await inBase("read", { path: "src.txt" }))?.block, undefined);
});

test("the oscillation threshold is the policy's, not a constant (lesson 12): the definition's default declares it; a policy without one, or none at all, falls back to 4", async (t) => {
  const { POLICY_PATH } = await import("@metacoding/regulator");
  const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  assert.equal(await oscillationThreshold(POLICY_PATH), 4);
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-threshold-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const policy = JSON.parse(await (await import("node:fs/promises")).readFile(POLICY_PATH, "utf8")) as { coordination?: unknown };
  await writeFile(path.join(dir, "six.json"), JSON.stringify({ ...policy, coordination: { oscillationThreshold: 6 } }));
  assert.equal(await oscillationThreshold(path.join(dir, "six.json")), 6);
  delete policy.coordination;
  await writeFile(path.join(dir, "none.json"), JSON.stringify(policy));
  assert.equal(await oscillationThreshold(path.join(dir, "none.json")), 4);
  assert.equal(await oscillationThreshold(path.join(dir, "missing.json")), 4);
});
