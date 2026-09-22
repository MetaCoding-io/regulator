/**
 * Per-turn trace records: one typed claim about what happened in a turn.
 *
 * The shape lives in protocol as a runtime schema; the writer refuses a
 * record that does not match it. A trace that can contain anything is not
 * evidence of anything.
 */
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { isTurnRecord, type TokenUsage, type ToolCallRecord, type TurnRecord } from "@metacoding/vsm-pi-protocol";

/** Accumulates one turn's worth of events into a single `TurnRecord`. */
export class TurnTracker {
  #turn: { index: number; startedAt: number; usage?: TokenUsage; tools: Map<string, ToolCallRecord> } | undefined;
  readonly #now: () => number;

  constructor(now: () => number = Date.now) {
    this.#now = now;
  }

  get active(): boolean {
    return this.#turn !== undefined;
  }

  startTurn(index: number, timestamp: number = this.#now()): void {
    this.#turn = { index, startedAt: timestamp, tools: new Map() };
  }

  toolStart(toolCallId: string, toolName: string): void {
    this.#turn?.tools.set(toolCallId, { toolCallId, toolName, startedAt: this.#now() });
  }

  toolBlocked(toolCallId: string, toolName: string, reason: string): void {
    const existing = this.#turn?.tools.get(toolCallId);
    const record: ToolCallRecord = existing ?? { toolCallId, toolName, startedAt: this.#now() };
    record.blocked = true;
    record.reason = reason;
    record.endedAt = this.#now();
    this.#turn?.tools.set(toolCallId, record);
  }

  toolEnd(toolCallId: string, isError: boolean): void {
    const record = this.#turn?.tools.get(toolCallId);
    if (!record) return;
    record.endedAt = this.#now();
    record.isError = isError;
  }

  usage(usage: TokenUsage): void {
    if (this.#turn) this.#turn.usage = usage;
  }

  /** Close the turn and return its record, or `undefined` if no turn was open. */
  endTurn(): TurnRecord | undefined {
    const turn = this.#turn;
    if (!turn) return undefined;
    this.#turn = undefined;
    const endedAt = this.#now();
    const record: TurnRecord = {
      turnIndex: turn.index,
      startedAt: turn.startedAt,
      endedAt,
      durationMs: endedAt - turn.startedAt,
      toolCalls: [...turn.tools.values()],
    };
    if (turn.usage) record.usage = turn.usage;
    return record;
  }
}

/** Appends one JSON object per line. Validates first; creates the parent directory on first write. */
export class TraceWriter {
  readonly filePath: string;
  #ready: Promise<void> | undefined;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async append(record: TurnRecord): Promise<void> {
    if (!isTurnRecord(record)) {
      throw new Error(`vsm-pi: refusing to write a malformed trace record: ${JSON.stringify(record)}`);
    }
    this.#ready ??= mkdir(path.dirname(this.filePath), { recursive: true }).then(() => undefined);
    await this.#ready;
    await appendFile(this.filePath, `${JSON.stringify(record)}\n`, "utf8");
  }
}
