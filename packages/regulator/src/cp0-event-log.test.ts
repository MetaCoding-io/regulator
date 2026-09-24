import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import eventLog, { EVENT_LOG_RELATIVE_PATH } from "./cp0-event-log.js";

type Handler = (event: unknown, ctx: { cwd: string }) => unknown;

/** A `pi` that only remembers what was registered. No session, no model. */
function mockPi(): { pi: ExtensionAPI; handlers: Map<string, Handler> } {
  const handlers = new Map<string, Handler>();
  const pi = { on: (name: string, handler: Handler) => handlers.set(name, handler) } as unknown as ExtensionAPI;
  return { pi, handlers };
}

async function projectDir(t: TestContext): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-cp0-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test("registers a handler for every stage of the loop", () => {
  const { pi, handlers } = mockPi();
  eventLog(pi);
  assert.deepEqual(
    [...handlers.keys()].sort(),
    [
      "agent_end", "agent_start", "before_agent_start", "session_shutdown", "session_start",
      "tool_call", "tool_execution_end", "tool_execution_start", "turn_end", "turn_start",
    ],
  );
});

test("writes one JSON line per event into the project's .regulator directory", async (t) => {
  const cwd = await projectDir(t);
  const { pi, handlers } = mockPi();
  eventLog(pi);
  const ctx = { cwd };
  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
  await handlers.get("turn_start")!({ type: "turn_start", turnIndex: 0, timestamp: 1 }, ctx);
  await handlers.get("tool_execution_start")!({ type: "tool_execution_start", toolCallId: "c1", toolName: "read", args: {} }, ctx);
  await handlers.get("tool_execution_end")!({ type: "tool_execution_end", toolCallId: "c1", toolName: "read", result: {}, isError: false }, ctx);
  await handlers.get("turn_end")!({ type: "turn_end", turnIndex: 0, message: {}, toolResults: [{}] }, ctx);

  const lines = (await readFile(path.join(cwd, EVENT_LOG_RELATIVE_PATH), "utf8")).trim().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.type), ["session_start", "turn_start", "tool_execution_start", "tool_execution_end", "turn_end"]);
  assert.equal(lines[0].reason, "startup");
  assert.equal(lines[2].toolName, "read");
  assert.equal(lines[4].toolResults, 1);
  for (const line of lines) assert.equal(typeof line.ts, "number");
});

test("observes tool calls but never blocks them", async (t) => {
  const cwd = await projectDir(t);
  const { pi, handlers } = mockPi();
  eventLog(pi);
  const result = await handlers.get("tool_call")!(
    { type: "tool_call", toolCallId: "c2", toolName: "write", input: { path: "vendor/left-pad.js", content: "x" } },
    { cwd },
  );
  assert.equal(result, undefined);
});
