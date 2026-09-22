/**
 * Spans (lesson 14): the instance's append-only records projected onto the
 * OpenTelemetry GenAI semantic conventions, so a tracing backend can read
 * what the orchestrator and the regulators wrote without a vendor adapter.
 *
 *   invoke_agent    one attempt of a unit (gen_ai.operation.name = invoke_agent)
 *   execute_tool    a journaled effect, a host-run check, a delivery
 *   chat            what the budget ledger knows of the model calls: tokens,
 *                   turns, the models used — the transcript itself is never
 *                   projected
 *
 * Correlation is by attribute, not by name: `vsm.unit.id`, `vsm.attempt`,
 * `vsm.contract.version`, `vsm.regulator.id`, `vsm.evidence.id`,
 * `vsm.policy.name` / `vsm.policy.version`. Every string attribute passes
 * the redaction rules before it leaves the instance.
 */
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";

const NonEmpty = Type.String({ minLength: 1 });

export const GENAI = {
  operation: "gen_ai.operation.name",
  agentName: "gen_ai.agent.name",
  agentId: "gen_ai.agent.id",
  toolName: "gen_ai.tool.name",
  toolCallId: "gen_ai.tool.call.id",
  requestModel: "gen_ai.request.model",
  responseModel: "gen_ai.response.model",
  usageInput: "gen_ai.usage.input_tokens",
  usageOutput: "gen_ai.usage.output_tokens",
  conversationId: "gen_ai.conversation.id",
} as const;

export const VSM_ATTR = {
  unit: "vsm.unit.id",
  unitType: "vsm.unit.type",
  attempt: "vsm.attempt",
  contractId: "vsm.contract.id",
  contractVersion: "vsm.contract.version",
  regulator: "vsm.regulator.id",
  evidence: "vsm.evidence.id",
  obligation: "vsm.obligation.id",
  policyName: "vsm.policy.name",
  policyVersion: "vsm.policy.version",
  system: "vsm.system",
  outcome: "vsm.outcome",
  redacted: "vsm.redacted",
} as const;

export const SpanKindSchema = Type.Union([Type.Literal("internal"), Type.Literal("client"), Type.Literal("server"), Type.Literal("producer"), Type.Literal("consumer")]);

export const SpanStatusSchema = Type.Union([Type.Literal("unset"), Type.Literal("ok"), Type.Literal("error")]);

export const SpanEventSchema = Type.Object({
  name: NonEmpty,
  time: NonEmpty,
  attributes: Type.Record(Type.String(), Type.Union([Type.String(), Type.Number(), Type.Boolean()])),
}, { additionalProperties: false });
export type SpanEvent = Static<typeof SpanEventSchema>;

export const SpanRecordSchema = Type.Object({
  traceId: NonEmpty,
  spanId: NonEmpty,
  parentSpanId: Type.Optional(NonEmpty),
  name: NonEmpty,
  kind: SpanKindSchema,
  startTime: NonEmpty,
  endTime: NonEmpty,
  status: SpanStatusSchema,
  attributes: Type.Record(Type.String(), Type.Union([Type.String(), Type.Number(), Type.Boolean()])),
  events: Type.Array(SpanEventSchema),
}, { additionalProperties: false });
export type SpanRecord = Static<typeof SpanRecordSchema>;

export function isSpanRecord(value: unknown): value is SpanRecord {
  return Value.Check(SpanRecordSchema, value);
}
