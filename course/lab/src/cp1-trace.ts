/**
 * Checkpoint 1 — anatomy of a turn (lesson 02).
 *
 * Two things are added on top of checkpoint 0:
 *
 * 1. A structured trace: one typed `TurnRecord` per turn, with its tool calls,
 *    token usage and wall-clock, written to `.regulator/trace.ndjson`.
 * 2. The first gate: a `tool_call` handler that refuses `write` and `edit`
 *    calls under `vendor/`. It exists for the lesson's two-rule drill — the
 *    same rule as prose in AGENTS.md versus as a handler that can say no.
 *
 * The gate is deliberately simple. It normalizes the obvious things Pi itself
 * normalizes and nothing more; lesson 10 hardens it and explains why a lexical
 * check is not a filesystem boundary. See regulator's `packages/regulator-pi` for
 * the hardened version.
 */
import path from "node:path";
import { isToolCallEventType, type ExtensionAPI, type ToolCallEventResult } from "@earendil-works/pi-coding-agent";
import type { TokenUsage } from "@metacoding/regulator-protocol";
import { TraceWriter, TurnTracker } from "@metacoding/regulator-core";

export const TRACE_RELATIVE_PATH = path.join(".regulator", "trace.ndjson");
export const PROTECTED_PREFIX = "vendor/";
export const VENDOR_BLOCK_REASON = `regulator: files under ${PROTECTED_PREFIX} are vendored and must not be edited. Change the dependency, not the copy.`;

/**
 * Lexical path check. Mirrors Pi's own leading-`@` and backslash handling, then
 * asks one question: does the normalized project-relative path start with
 * `vendor/`? Absolute paths and `..` are refused outright rather than reasoned
 * about — a gate that does not understand a path should fail closed.
 */
export function isProtectedPath(input: string): boolean {
  const cleaned = (input.startsWith("@") ? input.slice(1) : input).replaceAll("\\", "/");
  if (path.posix.isAbsolute(cleaned)) return true;
  const normalized = path.posix.normalize(cleaned).replace(/^\.\//, "");
  if (normalized === ".." || normalized.startsWith("../")) return true;
  return normalized === PROTECTED_PREFIX.slice(0, -1) || normalized.startsWith(PROTECTED_PREFIX);
}

export interface TraceExtensionOptions {
  /** Injectable clock so tests can assert on durations. */
  now?: () => number;
  /** Trace file path relative to the project root. */
  traceRelativePath?: string;
}

export function createTraceExtension(options: TraceExtensionOptions = {}): (pi: ExtensionAPI) => void {
  const now = options.now ?? Date.now;
  const traceRelativePath = options.traceRelativePath ?? TRACE_RELATIVE_PATH;

  return (pi) => {
    let tracker = new TurnTracker(now);
    let writer: TraceWriter | undefined;

    pi.on("session_start", (_event, ctx) => {
      tracker = new TurnTracker(now);
      writer = new TraceWriter(path.join(ctx.cwd, traceRelativePath));
    });

    pi.on("turn_start", (event) => {
      tracker.startTurn(event.turnIndex, event.timestamp);
    });

    pi.on("tool_execution_start", (event) => {
      tracker.toolStart(event.toolCallId, event.toolName);
    });

    pi.on("tool_call", (event): ToolCallEventResult | undefined => {
      if (isToolCallEventType("write", event) || isToolCallEventType("edit", event)) {
        if (isProtectedPath(event.input.path)) {
          tracker.toolBlocked(event.toolCallId, event.toolName, VENDOR_BLOCK_REASON);
          return { block: true, reason: VENDOR_BLOCK_REASON };
        }
      }
      return undefined;
    });

    pi.on("tool_execution_end", (event) => {
      tracker.toolEnd(event.toolCallId, event.isError);
    });

    pi.on("message_end", (event) => {
      if (event.message.role !== "assistant") return undefined;
      const usage = event.message.usage;
      const record: TokenUsage = {
        input: usage.input,
        output: usage.output,
        cacheRead: usage.cacheRead,
        cacheWrite: usage.cacheWrite,
        totalTokens: usage.totalTokens,
        cost: usage.cost.total,
      };
      tracker.usage(record);
      return undefined;
    });

    pi.on("turn_end", async (_event, ctx) => {
      const record = tracker.endTurn();
      if (!record) return;
      writer ??= new TraceWriter(path.join(ctx.cwd, traceRelativePath));
      await writer.append(record);
    });
  };
}

export default createTraceExtension();
