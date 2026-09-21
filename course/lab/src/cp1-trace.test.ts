import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test, { type TestContext } from "node:test";
import {
  createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { createTraceExtension, isProtectedPath, TRACE_RELATIVE_PATH, VENDOR_BLOCK_REASON } from "./cp1-trace.js";
import { TurnTracker } from "./trace.js";

type Handler = (event: unknown, ctx: { cwd: string }) => unknown;

function mockPi(): { pi: ExtensionAPI; handlers: Map<string, Handler> } {
  const handlers = new Map<string, Handler>();
  const pi = { on: (name: string, handler: Handler) => handlers.set(name, handler) } as unknown as ExtensionAPI;
  return { pi, handlers };
}

async function projectDir(t: TestContext): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-cp1-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

const assistant = (totalTokens: number) => ({
  role: "assistant",
  content: [],
  usage: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0, totalTokens, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.001 } },
});

test("isProtectedPath: vendor/ in the forms Pi would hand us, fail-closed on the forms it should not", () => {
  for (const p of ["vendor/left-pad.js", "./vendor/left-pad.js", "@vendor/left-pad.js", "vendor\\left-pad.js", "vendor", "src/../vendor/x.js"]) {
    assert.equal(isProtectedPath(p), true, p);
  }
  for (const p of ["src/slugify.js", "vendored/notes.md", "docs/vendor.md", "./src/vendor-list.js"]) {
    assert.equal(isProtectedPath(p), false, p);
  }
  // A path the gate does not understand is refused, not reasoned about.
  assert.equal(isProtectedPath("/etc/passwd"), true);
  assert.equal(isProtectedPath("../outside.js"), true);
});

test("TurnTracker builds one record per turn from the event sequence", () => {
  let clock = 1000;
  const tracker = new TurnTracker(() => clock);
  tracker.startTurn(3, 1000);
  clock = 1010; tracker.toolStart("a", "read");
  clock = 1030; tracker.toolEnd("a", false);
  clock = 1040; tracker.toolBlocked("b", "write", "no");
  tracker.usage({ input: 1, output: 2, cacheRead: 0, cacheWrite: 0, totalTokens: 3, cost: 0 });
  clock = 1100;
  const record = tracker.endTurn();
  assert.ok(record);
  assert.equal(record.turnIndex, 3);
  assert.equal(record.durationMs, 100);
  assert.equal(record.usage?.totalTokens, 3);
  assert.deepEqual(record.toolCalls.map((c) => [c.toolName, c.blocked ?? false, c.endedAt! - c.startedAt]), [["read", false, 20], ["write", true, 0]]);
  assert.equal(tracker.endTurn(), undefined, "a second endTurn has nothing to close");
});

test("extension writes a typed trace record per turn and blocks vendor writes", async (t) => {
  const cwd = await projectDir(t);
  let clock = 5000;
  const { pi, handlers } = mockPi();
  createTraceExtension({ now: () => clock })(pi);
  const ctx = { cwd };
  const fire = (name: string, event: Record<string, unknown>) => handlers.get(name)!({ type: name, ...event }, ctx);

  await fire("session_start", { reason: "startup" });
  await fire("turn_start", { turnIndex: 0, timestamp: 5000 });
  await fire("tool_execution_start", { toolCallId: "w1", toolName: "write", args: {} });
  const blocked = await fire("tool_call", { toolCallId: "w1", toolName: "write", input: { path: "vendor/left-pad.js", content: "" } });
  assert.deepEqual(blocked, { block: true, reason: VENDOR_BLOCK_REASON });
  clock = 5020;
  await fire("tool_execution_start", { toolCallId: "w2", toolName: "write", args: {} });
  const allowed = await fire("tool_call", { toolCallId: "w2", toolName: "write", input: { path: "src/slugify.js", content: "" } });
  assert.equal(allowed, undefined);
  clock = 5050;
  await fire("tool_execution_end", { toolCallId: "w2", toolName: "write", result: {}, isError: false });
  await fire("message_end", { message: assistant(42) });
  clock = 5100;
  await fire("turn_end", { turnIndex: 0, message: {}, toolResults: [] });

  const lines = (await readFile(path.join(cwd, TRACE_RELATIVE_PATH), "utf8")).trim().split("\n");
  assert.equal(lines.length, 1);
  const record = JSON.parse(lines[0]!);
  assert.equal(record.turnIndex, 0);
  assert.equal(record.durationMs, 100);
  assert.equal(record.usage.totalTokens, 42);
  assert.equal(record.usage.cost, 0.001);
  assert.deepEqual(
    record.toolCalls.map((c: { toolName: string; blocked?: boolean; isError?: boolean }) => [c.toolName, c.blocked ?? false, c.isError ?? null]),
    [["write", true, null], ["write", false, false]],
  );

  // A user or tool-result message carries no usage and must not disturb the turn.
  await fire("turn_start", { turnIndex: 1, timestamp: 6000 });
  await fire("message_end", { message: { role: "user", content: [] } });
  clock = 6010;
  await fire("turn_end", { turnIndex: 1, message: {}, toolResults: [] });
  const second = JSON.parse((await readFile(path.join(cwd, TRACE_RELATIVE_PATH), "utf8")).trim().split("\n")[1]!);
  assert.equal(second.turnIndex, 1);
  assert.equal(second.usage, undefined);
});

test("Pi 0.85.1 loads the built checkpoint and its native tool_call hook refuses a vendor write without a model", async (t) => {
  const cwd = await projectDir(t);
  const agentDir = path.join(cwd, "agent-config");
  const settingsManager = SettingsManager.inMemory();
  const loader = new DefaultResourceLoader({
    cwd, agentDir, settingsManager,
    additionalExtensionPaths: [fileURLToPath(new URL("./cp1-trace.js", import.meta.url))],
    noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
  });
  await loader.reload();
  const loaded = loader.getExtensions();
  assert.deepEqual(loaded.errors, []);
  assert.equal(loaded.extensions.length, 1);
  const modelRuntime = await ModelRuntime.create({
    authPath: path.join(agentDir, "auth.json"), modelsPath: null,
    modelsStorePath: path.join(agentDir, "models-cache.json"),
    allowModelNetwork: false, refreshOnCreate: false,
  });
  const { session } = await createAgentSession({
    cwd, agentDir, settingsManager, modelRuntime,
    sessionManager: SessionManager.inMemory(cwd), resourceLoader: loader,
    tools: ["write", "edit"],
  });
  t.after(() => session.dispose());
  await session.bindExtensions({});
  assert.ok(session.agent.beforeToolCall);
  const assistantMessage = {
    role: "assistant" as const, content: [], api: "openai-responses" as const,
    provider: "test", model: "test", stopReason: "toolUse" as const, timestamp: 0,
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
  };
  const call = async (name: "write" | "edit", input: Record<string, unknown>) =>
    session.agent.beforeToolCall!({
      toolCall: { type: "toolCall", id: `${name}-${input.path}`, name, arguments: input },
      args: input, context: session.agent.state, assistantMessage,
    });
  const refused = await call("write", { path: "vendor/left-pad.js", content: "changed" });
  assert.equal(refused?.block, true);
  assert.match(refused?.reason ?? "", /vendored/);
  const refusedEdit = await call("edit", { path: "@vendor/left-pad.js", edits: [{ oldText: "a", newText: "b" }] });
  assert.equal(refusedEdit?.block, true);
  const allowed = await call("write", { path: "src/slugify.js", content: "ok" });
  assert.equal(allowed?.block, undefined);
});
