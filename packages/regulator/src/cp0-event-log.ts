/**
 * Checkpoint 0 — the harness is the regulator (lesson 01).
 *
 * The smallest useful extension: subscribe to the agent loop and write one line
 * per event to `.regulator/events.ndjson` in the project. It changes nothing
 * about the agent's behaviour. Its only job is to make the loop visible.
 *
 * Load it from a project directory:
 *
 *   pi -e /path/to/packages/regulator/dist/cp0-event-log.js
 */
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const EVENT_LOG_RELATIVE_PATH = path.join(".regulator", "events.ndjson");

/** One line of the log. Keep it small: the point is the shape of the loop, not its contents. */
export interface EventLogLine {
  ts: number;
  type: string;
  [key: string]: unknown;
}

async function record(cwd: string, line: EventLogLine): Promise<void> {
  const file = path.join(cwd, EVENT_LOG_RELATIVE_PATH);
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(line)}\n`, "utf8");
}

export default function eventLog(pi: ExtensionAPI): void {
  // Session boundaries.
  pi.on("session_start", (event, ctx) => record(ctx.cwd, { ts: Date.now(), type: event.type, reason: event.reason }));
  pi.on("session_shutdown", (event, ctx) => record(ctx.cwd, { ts: Date.now(), type: event.type }));

  // One prompt from the user → one agent run.
  pi.on("before_agent_start", (event, ctx) =>
    record(ctx.cwd, { ts: Date.now(), type: event.type, promptChars: event.prompt.length }),
  );
  pi.on("agent_start", (event, ctx) => record(ctx.cwd, { ts: Date.now(), type: event.type }));
  pi.on("agent_end", (event, ctx) =>
    record(ctx.cwd, { ts: Date.now(), type: event.type, messages: event.messages.length }),
  );

  // One model response (+ its tool calls) → one turn. A run has many turns.
  pi.on("turn_start", (event, ctx) => record(ctx.cwd, { ts: Date.now(), type: event.type, turnIndex: event.turnIndex }));
  pi.on("turn_end", (event, ctx) =>
    record(ctx.cwd, { ts: Date.now(), type: event.type, turnIndex: event.turnIndex, toolResults: event.toolResults.length }),
  );

  // Inside a turn: each tool call, before and after it executes.
  pi.on("tool_execution_start", (event, ctx) =>
    record(ctx.cwd, { ts: Date.now(), type: event.type, toolCallId: event.toolCallId, toolName: event.toolName }),
  );
  pi.on("tool_call", async (event, ctx) => {
    await record(ctx.cwd, { ts: Date.now(), type: event.type, toolCallId: event.toolCallId, toolName: event.toolName });
    return undefined; // Observe only. Checkpoint 1 is where a handler first says no.
  });
  pi.on("tool_execution_end", (event, ctx) =>
    record(ctx.cwd, {
      ts: Date.now(),
      type: event.type,
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      isError: event.isError,
    }),
  );
}
