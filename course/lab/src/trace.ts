/**
 * Typed trace records for the `regulator` reference build.
 *
 * This module has no Pi dependency on purpose. A trace is a claim about what
 * happened in a turn, and the shape of that claim should be readable without
 * knowing any harness API. Compare VSM-Pi's INV-007: protocol stays runtime-free.
 *
 * The shape is a runtime schema, not only a TypeScript type: the writer
 * refuses a record that does not match it. A trace that can contain anything
 * is not evidence of anything.
 */
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";

export const TokenUsageSchema = Type.Object(
  {
    input: Type.Integer({ minimum: 0 }),
    output: Type.Integer({ minimum: 0 }),
    cacheRead: Type.Integer({ minimum: 0 }),
    cacheWrite: Type.Integer({ minimum: 0 }),
    totalTokens: Type.Integer({ minimum: 0 }),
    /** Total cost in the provider's currency, as Pi reports it. */
    cost: Type.Number({ minimum: 0 }),
  },
  { additionalProperties: false },
);
export type TokenUsage = Static<typeof TokenUsageSchema>;

export const ToolCallRecordSchema = Type.Object(
  {
    toolCallId: Type.String({ minLength: 1 }),
    toolName: Type.String({ minLength: 1 }),
    startedAt: Type.Integer(),
    endedAt: Type.Optional(Type.Integer()),
    isError: Type.Optional(Type.Boolean()),
    /** Set when a `tool_call` handler refused the call before it executed. */
    blocked: Type.Optional(Type.Boolean()),
    reason: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
export type ToolCallRecord = Static<typeof ToolCallRecordSchema>;

export const TurnRecordSchema = Type.Object(
  {
    turnIndex: Type.Integer({ minimum: 0 }),
    startedAt: Type.Integer(),
    endedAt: Type.Integer(),
    durationMs: Type.Integer({ minimum: 0 }),
    usage: Type.Optional(TokenUsageSchema),
    toolCalls: Type.Array(ToolCallRecordSchema),
  },
  { additionalProperties: false },
);
export type TurnRecord = Static<typeof TurnRecordSchema>;

export function isTurnRecord(value: unknown): value is TurnRecord {
  return Value.Check(TurnRecordSchema, value);
}

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
      throw new Error(`regulator: refusing to write a malformed trace record: ${JSON.stringify(record)}`);
    }
    this.#ready ??= mkdir(path.dirname(this.filePath), { recursive: true }).then(() => undefined);
    await this.#ready;
    await appendFile(this.filePath, `${JSON.stringify(record)}\n`, "utf8");
  }
}
