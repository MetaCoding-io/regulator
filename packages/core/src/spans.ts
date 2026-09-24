/**
 * The span projection (lesson 14): every append-only record an instance
 * holds, read as OpenTelemetry GenAI spans. One trace per unit; an
 * `invoke_agent` span per attempt; `execute_tool` spans for the host-run
 * checks, the journaled effects and the deliveries; a `chat` span for what
 * the budget ledger knows of the model calls. Obligation and interaction
 * events become span events on the unit. The transcript is never read.
 *
 * Redaction is not optional: every string attribute passes `redact`, which
 * removes the instance's canary values and anything shaped like a credential
 * before it leaves the store. A span that had something redacted says so.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { GENAI, VSM_ATTR, type EvalReport, type SpanEvent, type SpanRecord } from "@metacoding/regulator-protocol";
import { AuditLog } from "./audit-log.js";
import { EffectJournal } from "./effect-journal.js";
import { RegulatoryEventStore, VSM_DATABASE_RELATIVE_PATH } from "./event-store.js";
import { ExecutionStore } from "./execution-store.js";
import { MemoryStore } from "./memory.js";
import { ObligationLedger } from "./obligations.js";
import { REGULATOR_DIR } from "./paths.js";
import { isMessage, readEntries } from "./signals.js";

export type Attributes = Record<string, string | number | boolean>;

export interface RedactionRules {
  /** Exact values that must never appear: the instance's canaries and anything the caller adds. */
  values: readonly string[];
  /** Shapes of credentials, applied after the values. */
  patterns: readonly RegExp[];
  maxChars: number;
}

/** Credential shapes worth refusing on sight. Broad on purpose: a false positive costs a few characters of a log line. */
export const DEFAULT_SECRET_PATTERNS: readonly RegExp[] = [
  /\b(sk|pk|rk)-[A-Za-z0-9_-]{16,}\b/g,
  /\bsk-ant-[A-Za-z0-9_-]{16,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/g,
  /\b(?:[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|APIKEY))\s*[=:]\s*["']?[^\s"']{6,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

export const REDACTED = "[REDACTED]";

export function redact(text: string, rules: RedactionRules): { text: string; redacted: boolean } {
  let out = text;
  let redacted = false;
  for (const value of rules.values) {
    if (value && out.includes(value)) { out = out.split(value).join(REDACTED); redacted = true; }
  }
  for (const pattern of rules.patterns) {
    const next = out.replace(pattern, (m) => (m.includes("=") || m.includes(":") ? `${m.split(/[=:]/)[0]}=${REDACTED}` : REDACTED));
    if (next !== out) { out = next; redacted = true; }
  }
  if (out.length > rules.maxChars) out = `${out.slice(0, rules.maxChars)}…`;
  return { text: out, redacted };
}

export async function canaryValues(root: string): Promise<string[]> {
  try {
    return (await readFile(path.join(root, REGULATOR_DIR, "canaries"), "utf8")).split("\n").map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function id(...parts: string[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 16);
}

function traceIdFor(root: string, unitId: string): string {
  return createHash("sha256").update(`${root}\u0000${unitId}`).digest("hex").slice(0, 32);
}

/** Which registry record a check, effect or event is the work of: the join key the control room needs. */
export const REGULATOR_FOR: Readonly<Record<string, string>> = {
  run_tests: "reg.audit.closeout-gate.v1",
  run_checks: "reg.audit.closeout-gate.v1",
  file: "reg.audit.closeout-gate.v1",
  "identity-untouched": "reg.audit.identity-untouched-check.v1",
  "export-signature": "reg.audit.behaviour-check.v1",
  notify_owner: "reg.coordination.effect-journal.v1",
  deliver: "reg.algedonic.delivery.v1",
  obligation: "reg.control.obligation-router.v1",
  interaction: "reg.algedonic.interaction-contract.v1",
  decision: "reg.control.recovery-router.v1",
  budget: "reg.control.budget-guard.v1",
  memory: "reg.control.memory-store.v1",
};

export interface ProjectSpansOptions {
  /** Extra values to redact, besides the instance's canaries. */
  redactValues?: readonly string[];
  patterns?: readonly RegExp[];
  maxChars?: number;
}

export async function projectSpans(root: string, options: ProjectSpansOptions = {}): Promise<SpanRecord[]> {
  const rules: RedactionRules = { values: [...(await canaryValues(root)), ...(options.redactValues ?? [])], patterns: options.patterns ?? DEFAULT_SECRET_PATTERNS, maxChars: options.maxChars ?? 2000 };
  let anyRedacted = false;
  const attrs = (raw: Record<string, string | number | boolean | undefined>): Attributes => {
    const out: Attributes = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v === undefined) continue;
      if (typeof v === "string") {
        const r = redact(v, rules);
        if (r.redacted) { anyRedacted = true; out[VSM_ATTR.redacted] = true; }
        out[k] = r.text;
      } else out[k] = v;
    }
    return out;
  };

  const store = new ExecutionStore(root);
  const audit = new AuditLog(root);
  const journal = new EffectJournal(root);
  const ledger = new ObligationLedger(root);
  const entries = await readEntries(root);
  const obligations = await ledger.obligations();
  const interactions = await ledger.interactions();
  const effects = await journal.entries();
  const memory = await new MemoryStore(root).states();
  const spans: SpanRecord[] = [];
  // The reporting tools' SQLite store (lesson 15: under .regulator/ like every other record) — its events by unit, when it exists.
  const reported: Array<{ unit?: string; at: string; kind: string; channel: string; source: string; destination: string; subject: string; tool: string; host: string; sequence: number }> = [];
  if (existsSync(path.join(root, VSM_DATABASE_RELATIVE_PATH))) {
    const store = new RegulatoryEventStore(root);
    try {
      for (const { sequence, event } of store.readAll()) {
        reported.push({ ...(event.provenance.unit ? { unit: event.provenance.unit } : {}), at: event.message.timestamp, kind: event.message.kind, channel: event.message.channel, source: event.message.source, destination: event.message.destination, subject: event.message.subject, tool: event.tool.name, host: event.provenance.host, sequence });
      }
    } finally {
      store.close();
    }
  }

  for (const unit of await store.listUnits()) {
    const traceId = traceIdFor(root, unit.unitId);
    const unitSpanId = id(traceId, "unit");
    const attempts = await store.listAttempts(unit.unitId);
    const decisions = await store.listDecisions(unit.unitId);
    const unitAudit = await audit.forUnit(unit.unitId);
    const events: SpanEvent[] = [];
    for (const o of obligations.filter((x) => x.unit === unit.unitId)) {
      for (const h of o.history) {
        events.push({ name: h.type, time: h.at, attributes: attrs({ [VSM_ATTR.obligation]: o.id, [VSM_ATTR.regulator]: REGULATOR_FOR.obligation!, "vsm.obligation.concern": o.concern, "vsm.obligation.consumer": o.consumer, "vsm.obligation.severity": o.severity, by: h.by }) });
      }
    }
    for (const i of interactions.filter((x) => x.request.unit === unit.unitId)) {
      events.push({ name: "interaction-requested", time: i.request.raisedAt, attributes: attrs({ [VSM_ATTR.regulator]: REGULATOR_FOR.interaction!, "vsm.interaction.kind": i.request.kind, "vsm.interaction.channel": i.request.channel, [VSM_ATTR.obligation]: i.request.obligationId, subject: i.request.subject }) });
      for (const a of i.answers) events.push({ name: "interaction-answered", time: a.at, attributes: attrs({ [VSM_ATTR.regulator]: REGULATOR_FOR.interaction!, outcome: a.outcome, by: a.by, channel: a.channel }) });
    }
    for (const d of decisions) {
      events.push({ name: "recovery-decision", time: d.decidedAt, attributes: attrs({ [VSM_ATTR.regulator]: REGULATOR_FOR.decision!, [VSM_ATTR.attempt]: d.attempt, cause: d.cause, action: d.action, occurrence: d.occurrence, [VSM_ATTR.policyName]: d.policy.name, [VSM_ATTR.policyVersion]: d.policy.version }) });
    }
    for (const m of memory.filter((x) => x.unit === unit.unitId)) {
      events.push({ name: "memory-recorded", time: m.recordedAt, attributes: attrs({ [VSM_ATTR.regulator]: REGULATOR_FOR.memory!, subject: m.subject, reviewBy: m.reviewBy, status: m.status }) });
    }
    for (const e of entries) {
      if (!isMessage(e) || e.unit !== unit.unitId) continue;
      events.push({ name: e.kind, time: e.timestamp, attributes: attrs({ [VSM_ATTR.system]: e.source, channel: e.channel, subject: e.subject, ...("severity" in e && e.severity ? { severity: e.severity } : {}) }) });
    }
    for (const r of reported.filter((x) => x.unit === unit.unitId)) {
      events.push({ name: `reported ${r.kind}`, time: r.at, attributes: attrs({ [VSM_ATTR.system]: r.source, channel: r.channel, subject: r.subject, [GENAI.toolName]: r.tool, "vsm.events.sequence": r.sequence, host: r.host }) });
    }
    events.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
    const last = attempts.at(-1);
    spans.push({
      traceId, spanId: unitSpanId, name: `unit ${unit.unitId}`, kind: "internal", startTime: unit.createdAt, endTime: last?.endedAt ?? unit.updatedAt,
      status: unit.status === "closed" ? "ok" : unit.status === "aborted" ? "error" : "unset",
      attributes: attrs({ [VSM_ATTR.unit]: unit.unitId, [VSM_ATTR.unitType]: unit.unitType, [VSM_ATTR.contractId]: unit.contract.id, [VSM_ATTR.contractVersion]: unit.contract.version, [VSM_ATTR.outcome]: unit.status, "vsm.workload": `${unit.workload.name} v${unit.workload.version}` }),
      events,
    });

    for (const a of attempts) {
      const attemptSpanId = id(traceId, "attempt", String(a.attempt));
      const budget = await store.getBudget(unit.unitId, a.attempt);
      spans.push({
        traceId, spanId: attemptSpanId, parentSpanId: unitSpanId, name: `invoke_agent ${unit.unitType}`, kind: "client", startTime: a.startedAt, endTime: a.endedAt,
        status: a.outcome === "reported" ? "ok" : a.outcome === "error" ? "error" : "unset",
        attributes: attrs({
          [GENAI.operation]: "invoke_agent", [GENAI.agentName]: unit.unitType, [GENAI.agentId]: unit.unitId, [GENAI.conversationId]: a.sessionId,
          [VSM_ATTR.unit]: unit.unitId, [VSM_ATTR.attempt]: a.attempt, [VSM_ATTR.contractVersion]: a.contractVersion, [VSM_ATTR.outcome]: a.outcome, detail: a.detail,
          ...(budget ? { [GENAI.requestModel]: budget.models[0], [GENAI.responseModel]: budget.models.at(-1) } : {}),
        }),
        events: [],
      });
      if (budget) {
        spans.push({
          traceId, spanId: id(traceId, "chat", String(a.attempt)), parentSpanId: attemptSpanId, name: `chat ${budget.models.at(-1) ?? "model"}`, kind: "client", startTime: budget.startedAt, endTime: budget.updatedAt,
          status: budget.exhausted ? "error" : "unset",
          attributes: attrs({
            [GENAI.operation]: "chat", [GENAI.requestModel]: budget.models[0], [GENAI.responseModel]: budget.models.at(-1), [VSM_ATTR.regulator]: REGULATOR_FOR.budget!,
            [VSM_ATTR.unit]: unit.unitId, [VSM_ATTR.attempt]: a.attempt, "vsm.usage.tokens": budget.consumed.tokens, "vsm.usage.turns": budget.consumed.turns, "vsm.usage.cost": budget.consumed.cost,
            "vsm.budget.tokens": budget.ceiling.tokens, "vsm.budget.turns": budget.ceiling.turns, ...(budget.exhausted ? { "vsm.budget.exhausted": budget.exhausted.dimension } : {}), "vsm.compactions": budget.compactions.length,
          }),
          events: budget.compactions.map((c) => ({ name: "compaction", time: c.at, attributes: attrs({ reason: c.reason, preserved: c.preserved }) })),
        });
      }
      for (const r of unitAudit.evidence.filter((x) => x.attempt === a.attempt)) {
        const check = r.check.split(":")[0]!;
        spans.push({
          traceId, spanId: id(traceId, "evidence", r.id), parentSpanId: attemptSpanId, name: `execute_tool ${r.check}`, kind: "internal", startTime: r.at, endTime: r.at,
          status: r.verdict === "pass" ? "ok" : r.verdict === "fail" ? "error" : "unset",
          attributes: attrs({
            [GENAI.operation]: "execute_tool", [GENAI.toolName]: r.check, [VSM_ATTR.system]: r.producedBy, [VSM_ATTR.regulator]: REGULATOR_FOR[check] ?? REGULATOR_FOR.run_checks!,
            [VSM_ATTR.evidence]: r.id, [VSM_ATTR.unit]: unit.unitId, [VSM_ATTR.attempt]: r.attempt, [VSM_ATTR.contractVersion]: r.contract.version, "vsm.evidence.class": r.class, "vsm.evidence.verdict": r.verdict,
            "vsm.evidence.criteria": r.criteria.join(","), "vsm.revision": r.revision, observation: r.observation, ...(r.command ? { command: r.command.join(" ") } : {}),
          }),
          events: [],
        });
      }
      for (const v of unitAudit.verdicts.filter((x) => x.attempt === a.attempt)) {
        spans.push({
          traceId, spanId: id(traceId, "verdict", v.id), parentSpanId: attemptSpanId, name: "verdict", kind: "internal", startTime: v.at, endTime: v.at,
          status: v.verdict === "pass" ? "ok" : v.verdict === "fail" ? "error" : "unset",
          attributes: attrs({ [VSM_ATTR.system]: v.decidedBy, [VSM_ATTR.regulator]: REGULATOR_FOR.run_tests!, [VSM_ATTR.unit]: unit.unitId, [VSM_ATTR.attempt]: v.attempt, "vsm.verdict": v.verdict, "vsm.revision": v.revision, reasons: v.reasons.join("; "), "vsm.evidence.ids": v.evidence.join(",") }),
          events: [],
        });
      }
    }
    for (const e of effects.filter((x) => x.unitId === unit.unitId)) {
      spans.push({
        traceId, spanId: id(traceId, "effect", e.key, e.status, e.at), parentSpanId: unitSpanId, name: `execute_tool ${e.tool}`, kind: "producer", startTime: e.at, endTime: e.at,
        status: e.status === "committed" || e.status === "confirmed" ? "ok" : e.status === "absent" ? "error" : "unset",
        attributes: attrs({ [GENAI.operation]: "execute_tool", [GENAI.toolName]: e.tool, [GENAI.toolCallId]: e.key, [VSM_ATTR.regulator]: REGULATOR_FOR[e.tool] ?? REGULATOR_FOR.notify_owner!, [VSM_ATTR.unit]: unit.unitId, "vsm.effect.status": e.status, description: e.description, result: e.result }),
        events: [],
      });
    }
  }
  if (anyRedacted) for (const s of spans) if (s.attributes[VSM_ATTR.redacted] === undefined) s.attributes[VSM_ATTR.redacted] = false;
  return spans;
}

/** One row of a unit's replay (lesson 15): a span or a span event, in time order, with the regulator it belongs to when the record says. */
export interface TimelineEntry {
  at: string;
  /** `span` for something with a duration, `event` for a point on the unit's span. */
  kind: "span" | "event";
  name: string;
  status?: string;
  regulator?: string;
  attempt?: number;
  detail: string;
}

const DETAIL_KEYS = ["detail", "observation", "reasons", "subject", "description", "result", "outcome", "action", "cause", "by", "vsm.outcome", "vsm.verdict", "vsm.effect.status"] as const;

/** A unit's replay: contract → attempts → tool executions → evidence → verdicts → decisions → obligations → deliveries, from its spans. */
export function timelineFor(spans: readonly SpanRecord[], unitId: string): TimelineEntry[] {
  const mine = spans.filter((s) => s.attributes[VSM_ATTR.unit] === unitId);
  const out: TimelineEntry[] = [];
  const detailOf = (a: Record<string, string | number | boolean>) => DETAIL_KEYS.filter((k) => a[k] !== undefined && a[k] !== "").map((k) => `${k}: ${String(a[k]).split("\n")[0]}`).join(" · ");
  for (const s of mine) {
    out.push({ at: s.startTime, kind: "span", name: s.name, status: s.status, ...(typeof s.attributes[VSM_ATTR.regulator] === "string" ? { regulator: s.attributes[VSM_ATTR.regulator] as string } : {}), ...(typeof s.attributes[VSM_ATTR.attempt] === "number" ? { attempt: s.attributes[VSM_ATTR.attempt] as number } : {}), detail: detailOf(s.attributes) });
    for (const e of s.events) out.push({ at: e.time, kind: "event", name: e.name, ...(typeof e.attributes[VSM_ATTR.regulator] === "string" ? { regulator: e.attributes[VSM_ATTR.regulator] as string } : {}), ...(typeof e.attributes[VSM_ATTR.attempt] === "number" ? { attempt: e.attributes[VSM_ATTR.attempt] as number } : {}), detail: detailOf(e.attributes) });
  }
  return out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/** The spans an eval report is evidence for: one per run, so a tracing backend can join runs to units by attribute. */
export function reportSpans(report: EvalReport): SpanRecord[] {
  const traceId = createHash("sha256").update(`${report.suite.name}\u0000${report.suite.version}\u0000${report.generatedAt}`).digest("hex").slice(0, 32);
  return report.runs.map((r) => ({
    traceId, spanId: id(traceId, r.arm, String(r.repetition), r.task), name: `eval ${r.arm}/${r.task}`, kind: "internal", startTime: r.startedAt, endTime: r.endedAt,
    status: r.outcome === "closed" ? "ok" : "unset",
    attributes: { "vsm.eval.suite": `${report.suite.name} v${report.suite.version}`, "vsm.eval.arm": r.arm, "vsm.eval.repetition": r.repetition, "vsm.eval.task": r.task, [VSM_ATTR.unit]: r.unitId, [VSM_ATTR.outcome]: r.outcome, ...Object.fromEntries(Object.entries(r.metrics).map(([k, v]) => [`vsm.eval.${k}`, v])) },
    events: [],
  }));
}
