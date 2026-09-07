import { randomUUID } from "node:crypto";
import {
  assertValid, AuditFindingInputSchema, PolicyProposalInputSchema, RegulatoryEventSchema,
  ReportingContextSchema, UncertaintyInputSchema,
  type RegulatoryEvent, type ReportingContext, type ReportingToolName,
} from "@metacoding/vsm-pi-protocol";

/** Validate both structure and the host grant that authorized the event. */
export function assertRegulatoryEvent(value: unknown): asserts value is RegulatoryEvent {
  assertValid(RegulatoryEventSchema, value, "regulatory event");
  const { message, authority: { capabilities }, tool, provenance } = value;
  const authorized = message.kind === "policy-proposal"
    ? tool.name === "vsm_propose_policy_change" && capabilities.proposePolicyAs === message.source
    : message.kind === "audit-finding"
      ? tool.name === "vsm_report_audit_finding" && capabilities.reportIndependentAudit === true
      : tool.name === "vsm_report_uncertainty" && capabilities.reportOperationalSignal === true;
  if (!authorized) throw new Error("Reporting authority denied for this event.");
  if (message.kind === "audit-finding" && ["blocking", "critical"].includes(message.severity) && message.evidence.length === 0) {
    throw new Error("Blocking/critical audit findings require evidence.");
  }
  if (message.unit !== provenance.unit || message.evidence.some((ref) => ref.sourceRevision !== provenance.sourceRevision)) {
    throw new Error("Event provenance must match host context.");
  }
}

/** Build one event from content-only input. No I/O, routing, or workflow decisions. */
export function createRegulatoryEvent(
  tool: ReportingToolName,
  input: unknown,
  context: ReportingContext | undefined,
  toolCallId: string,
): RegulatoryEvent {
  if (!context) throw new Error("Reporting authority denied: no host context was supplied.");
  assertValid(ReportingContextSchema, context, "host reporting context");
  const { authority, provenance } = context;
  const envelope = {
    id: randomUUID(), timestamp: new Date().toISOString(),
    ...(provenance.unit === undefined ? {} : { unit: provenance.unit }),
  };
  const evidenceWithProvenance = (refs: { class: string; ref: string; observation?: string }[]) => refs.map((ref) => ({
    ...ref, ...(provenance.sourceRevision === undefined ? {} : { sourceRevision: provenance.sourceRevision }),
  }));
  let message: unknown;
  switch (tool) {
    case "vsm_propose_policy_change": {
      assertValid(PolicyProposalInputSchema, input, "policy proposal input");
      if (!authority.capabilities.proposePolicyAs) throw new Error("Reporting authority denied: policy proposal capability required.");
      const { reportedSeverity, evidence, ...content } = input;
      message = {
        ...content, ...envelope, kind: "policy-proposal", channel: "proposal",
        source: authority.capabilities.proposePolicyAs, destination: "S5",
        severity: reportedSeverity, evidence: evidenceWithProvenance(evidence),
      };
      break;
    }
    case "vsm_report_audit_finding": {
      assertValid(AuditFindingInputSchema, input, "audit finding input");
      if (!authority.capabilities.reportIndependentAudit) throw new Error("Reporting authority denied: independent S3* audit capability required.");
      const { reportedSeverity, evidence, ...content } = input;
      message = {
        ...content, ...envelope, kind: "audit-finding", channel: "audit", source: "S3*", destination: "S3",
        severity: reportedSeverity, evidence: evidenceWithProvenance(evidence),
      };
      break;
    }
    case "vsm_report_uncertainty": {
      assertValid(UncertaintyInputSchema, input, "uncertainty input");
      if (!authority.capabilities.reportOperationalSignal) throw new Error("Reporting authority denied: S1 operational signal capability required.");
      message = {
        ...input, ...envelope, kind: "uncertainty-signal", channel: "signal", source: "S1", destination: "S3",
        evidence: evidenceWithProvenance(input.evidence),
      };
      break;
    }
    default:
      throw new Error("Unknown reporting tool.");
  }
  const event: unknown = { schemaVersion: 1, message, authority, provenance, tool: { name: tool, callId: toolCallId } };
  assertRegulatoryEvent(event);
  // Detach host/input objects so later mutation cannot rewrite event provenance.
  return structuredClone(event);
}
