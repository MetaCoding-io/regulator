import assert from "node:assert/strict";
import test from "node:test";
import { Value } from "typebox/value";
import {
  AuditFindingSchema, PolicyProposalSchema, AlgedonicSignalSchema,
  VsmMessageSchema, channelCanMutateS5,
} from "./index.js";

const envelope = {
  id: "finding-1", timestamp: "2026-09-06T12:00:00Z", subject: "architecture",
  severity: "advisory", evidence: [{ class: "command", ref: "pnpm check", sourceRevision: "abc123" }],
};
const audit = {
  ...envelope, kind: "audit-finding", channel: "audit", source: "S3*",
  destination: "S3", observation: "Dependency boundaries hold",
};
const proposal = {
  ...envelope, kind: "policy-proposal", channel: "proposal", source: "S1",
  destination: "S5", rationale: "Clarify invariant", requestedChange: { rule: "example" },
};
const algedonic = {
  ...envelope, kind: "algedonic-signal", channel: "algedonic", source: "S1",
  destination: "S5", severity: "blocking", observation: "Invariant violated",
  requiresHumanAttention: true,
};

test("runtime audit validation accepts independent evidence and rejects S1 sources", () => {
  assert.equal(Value.Check(AuditFindingSchema, audit), true);
  assert.equal(Value.Check(VsmMessageSchema, audit), true);
  for (const schema of [AuditFindingSchema, VsmMessageSchema]) {
    assert.equal(Value.Check(schema, { ...audit, source: "S1" }), false);
    assert.equal(Value.Check(schema, { ...audit, evidence: [{ class: "invented", ref: "x" }] }), false);
  }
});

test("policy proposals target S5 without carrying mutation authority", () => {
  assert.equal(Value.Check(PolicyProposalSchema, proposal), true);
  assert.equal(Value.Check(VsmMessageSchema, proposal), true);
  assert.equal(Value.Check(PolicyProposalSchema, { ...proposal, destination: "S3" }), false);
  assert.equal(channelCanMutateS5("proposal"), false);
});

test("algedonic signals accept only blocking or critical severity", () => {
  for (const severity of ["info", "advisory", "blocking", "critical", "unknown"]) {
    for (const schema of [AlgedonicSignalSchema, VsmMessageSchema]) {
      assert.equal(Value.Check(schema, { ...algedonic, severity }), ["blocking", "critical"].includes(severity));
    }
  }
});

const messages = [
  audit, proposal, algedonic,
  { ...envelope, kind: "constraint", channel: "constraint", source: "S5", destination: "S1", rule: "Preserve authority" },
  { ...envelope, kind: "operational-signal", channel: "signal", source: "S1", destination: "S3", observation: "Task complete" },
  { ...envelope, kind: "intelligence-signal", channel: "intelligence", source: "S4", destination: "S3", observation: "Environment changed" },
];
test("all message kinds enforce their channel discriminator at runtime", () => {
  for (const message of messages) {
    assert.equal(Value.Check(VsmMessageSchema, message), true, message.kind);
    for (const channel of [...messages.map((item) => item.channel), "unknown"]) {
      assert.equal(Value.Check(VsmMessageSchema, { ...message, channel }), channel === message.channel, `${message.kind}/${channel}`);
    }
    assert.equal(Value.Check(VsmMessageSchema, { ...message, kind: "unknown" }), false);
  }
});
