import { Type, type Static } from "typebox";
import { Value } from "typebox/value";

/**
 * A per-turn trace record: one typed claim about what happened in a turn.
 * Runtime schema, not only a TypeScript type — a trace that can contain
 * anything is not evidence of anything.
 */
export const TokenUsageSchema = Type.Object(
  {
    input: Type.Integer({ minimum: 0 }),
    output: Type.Integer({ minimum: 0 }),
    cacheRead: Type.Integer({ minimum: 0 }),
    cacheWrite: Type.Integer({ minimum: 0 }),
    totalTokens: Type.Integer({ minimum: 0 }),
    /** Total cost in the provider's currency, as the host reports it. */
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
