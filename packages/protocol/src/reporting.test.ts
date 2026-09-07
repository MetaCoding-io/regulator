import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Value } from "typebox/value";
import {
  AuditFindingInputSchema, PolicyProposalInputSchema, UncertaintyInputSchema,
  UncertaintySignalSchema, VsmMessageSchema, isExceptional,
} from "./index.js";

const examples = JSON.parse(readFileSync(new URL("../../../fixtures/reporting/examples.json", import.meta.url), "utf8"));
const schemas = [PolicyProposalInputSchema, AuditFindingInputSchema, UncertaintyInputSchema];
const forbidden = [
  "id", "timestamp", "source", "destination", "channel", "kind", "functions", "capabilities",
  "authority", "requiredConsumers", "routing", "effectiveSeverity", "severity", "resolutionBoundary",
  "escalationBoundary", "sourceRevision", "provenance", "unit", "sessionId", "mutateS5", "confidence",
];

test("all reporting payloads and nested evidence are closed content-only schemas", () => {
  for (const [index, schema] of schemas.entries()) {
    const payload = examples[index].payload;
    assert.equal(Value.Check(schema, payload), true);
    for (const field of forbidden) {
      assert.equal(Value.Check(schema, { ...payload, [field]: "S5" }), false, `${index}: ${field}`);
      assert.equal(Value.Check(schema, { ...payload, evidence: [{ class: "file", ref: "x", [field]: "S5" }] }), false, `evidence: ${field}`);
    }
    assert.equal(Value.Check(schema, { ...payload, evidence: [{ class: "file", ref: "x" }] }), true);
    assert.equal(Value.Check(schema, { ...payload, subject: "" }), false);
    assert.equal(Value.Check(schema, { ...payload, evidence: [{ class: "invented", ref: "x" }] }), false);
  }
  assert.equal(Value.Check(PolicyProposalInputSchema, { ...examples[0].payload, requestedChange: { authority: "S5" } }), false);
  assert.equal(Value.Check(UncertaintyInputSchema, { ...examples[2].payload, recommendedFollowUp: "automatic-escalation" }), false);
});

test("uncertainty remains an S1 signal even with critical reported impact", () => {
  const message = {
    ...examples[2].payload, id: "uncertainty-1", timestamp: "2026-09-07T12:00:00.000Z",
    kind: "uncertainty-signal", channel: "signal", source: "S1", destination: "S3", impact: "critical",
  };
  assert.equal(Value.Check(UncertaintySignalSchema, message), true);
  assert.equal(Value.Check(VsmMessageSchema, message), true);
  assert.equal(isExceptional(message), false);
  for (const patch of [
    { source: "S5" }, { destination: "S5" }, { channel: "audit" }, { channel: "algedonic" },
    { kind: "policy-proposal" }, { severity: "critical" }, { effectiveSeverity: "critical" },
  ]) {
    assert.equal(Value.Check(UncertaintySignalSchema, { ...message, ...patch }), false);
    assert.equal(Value.Check(VsmMessageSchema, { ...message, ...patch }), false);
  }
});
