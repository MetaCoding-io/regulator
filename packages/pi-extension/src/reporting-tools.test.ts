import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test, { type TestContext } from "node:test";
import { PROTECTED_S5_PATHS, RegulatoryEventStore, VSM_DATABASE_RELATIVE_PATH } from "@metacoding/vsm-pi-core";
import { assertValid, RegulatoryReceiptSchema, type ReportingAuthority } from "@metacoding/vsm-pi-protocol";
import { type ExtensionAPI, type ExtensionContext, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import defaultExtension, { createVsmPiExtension, type HostReportingContext } from "./index.js";

const examples = JSON.parse(readFileSync(new URL("../../../fixtures/reporting/examples.json", import.meta.url), "utf8"));
const names = ["vsm_propose_policy_change", "vsm_report_audit_finding", "vsm_report_uncertainty"] as const;
async function project(t: TestContext) {
  const cwd = await mkdtemp(path.join(tmpdir(), "vsm-reporting-tools-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  return cwd;
}
function harness(cwd: string, resolve?: () => HostReportingContext | undefined) {
  const tools = new Map<string, ToolDefinition>();
  const events: string[] = [];
  const api = {
    on: (event: string) => events.push(event),
    registerTool: (tool: ToolDefinition) => { assert.equal(tools.has(tool.name), false); tools.set(tool.name, tool); },
  } as unknown as ExtensionAPI;
  (resolve ? createVsmPiExtension({ resolveReportingContext: resolve }) : defaultExtension)(api);
  assert.deepEqual(events, ["tool_call"]);
  assert.deepEqual([...tools.keys()], names);
  const context = { cwd, sessionManager: { getSessionId: () => "pi-session-1" } } as ExtensionContext;
  return {
    tools,
    execute(name: string, input: unknown, id = "call-1", signal?: AbortSignal) {
      return tools.get(name)!.execute(id, input, signal, undefined, context);
    },
  };
}

test("default Pi registers three closed-schema tools but grants no reporting authority", async (t) => {
  const cwd = await project(t);
  const host = harness(cwd);
  for (const [index, name] of names.entries()) {
    const tool = host.tools.get(name)!;
    const json = JSON.parse(JSON.stringify(tool.parameters));
    assert.equal(json.type, "object");
    assert.equal(json.additionalProperties, false);
    assert.equal(json.properties.evidence.items.additionalProperties, false);
    assert.doesNotThrow(() => assertValid(tool.parameters, examples[index].payload, "provider schema"));
    await assert.rejects(host.execute(name, examples[index].payload), /authority denied/);
  }
  assert.equal(existsSync(path.join(cwd, ".regulator")), false);
});

test("all successful tool calls persist one event and return replayable receipts without S5 writes", async (t) => {
  const cwd = await project(t);
  await mkdir(path.join(cwd, "vsm"));
  for (const artifact of PROTECTED_S5_PATHS) await writeFile(path.join(cwd, artifact), "committed identity");
  // A fixture owned by the test, not a real GSD database. The adapter must never open it.
  await mkdir(path.join(cwd, ".gsd"));
  await writeFile(path.join(cwd, ".gsd/gsd.db"), "GSD-owned sentinel");
  let authority: ReportingAuthority = examples[0].authority;
  const host = harness(cwd, () => ({ authority, unit: "unit-7", sourceRevision: "host-revision" }));
  const receipts = [];
  for (const [index, name] of names.entries()) {
    authority = examples[index].authority;
    const result = await host.execute(name, examples[index].payload, `pi-call-${index}`);
    assertValid(RegulatoryReceiptSchema, result.details, "tool receipt");
    receipts.push(result.details);
    assert.equal(result.content[0]?.type, "text");
    if (result.content[0]?.type === "text") assert.deepEqual(JSON.parse(result.content[0].text), result.details);
  }
  const reopened = new RegulatoryEventStore(cwd);
  const rows = reopened.readAll();
  reopened.close();
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => row.receipt), receipts);
  assert.deepEqual(rows.map((row) => [row.event.message.source, row.event.message.channel, row.event.message.destination]), [
    ["S1", "proposal", "S5"], ["S3*", "audit", "S3"], ["S1", "signal", "S3"],
  ]);
  for (const [index, row] of rows.entries()) {
    assert.equal(row.event.authority.id, examples[index].authority.id);
    assert.equal(row.event.provenance.sessionId, "pi-session-1");
    assert.equal(row.event.provenance.unit, "unit-7");
    assert.equal(row.event.provenance.sourceRevision, "host-revision");
    assert.equal(row.event.tool.callId, `pi-call-${index}`);
    assert.match(row.event.provenance.host, /^@earendil-works\/pi-coding-agent@/);
  }
  for (const artifact of PROTECTED_S5_PATHS) assert.equal(await readFile(path.join(cwd, artifact), "utf8"), "committed identity");
  assert.equal(await readFile(path.join(cwd, ".gsd/gsd.db"), "utf8"), "GSD-owned sentinel");
});

test("ordinary context cannot audit and host grants are reevaluated on every execution", async (t) => {
  const cwd = await project(t);
  let authority: ReportingAuthority = examples[0].authority;
  const host = harness(cwd, () => ({ authority, sourceRevision: "rev" }));
  await assert.rejects(host.execute(names[1], examples[1].payload), /independent S3\*/);
  assert.equal(existsSync(path.join(cwd, VSM_DATABASE_RELATIVE_PATH)), false);
  authority = examples[1].authority;
  await host.execute(names[1], examples[1].payload);
  authority = { id: "unmapped", capabilities: {} };
  for (const [index, name] of names.entries()) await assert.rejects(host.execute(name, examples[index].payload), /authority denied/);
  const store = new RegulatoryEventStore(cwd);
  assert.equal(store.readAll().length, 1);
  store.close();
});

test("execute revalidates closed payloads even if Pi validation is bypassed or arguments are mutated", async (t) => {
  const cwd = await project(t);
  const host = harness(cwd, () => ({
    authority: { id: "test-host", capabilities: { proposePolicyAs: "S4", reportIndependentAudit: true, reportOperationalSignal: true } },
    sourceRevision: "rev",
  }));
  for (const [index, name] of names.entries()) {
    for (const field of ["source", "destination", "channel", "id", "timestamp", "authority", "capabilities", "functions", "requiredConsumers", "effectiveSeverity", "resolutionBoundary", "mutateS5", "sourceRevision", "runtimeRoot"]) {
      await assert.rejects(host.execute(name, { ...examples[index].payload, [field]: "S5" }), /closed runtime schema/);
      await assert.rejects(host.execute(name, { ...examples[index].payload, evidence: [{ class: "file", ref: "x", [field]: "S5" }] }), /closed runtime schema/);
    }
  }
  for (const reportedSeverity of ["blocking", "critical"]) {
    await assert.rejects(host.execute(names[1], { ...examples[1].payload, reportedSeverity, evidence: [] }), /require evidence/);
  }
  assert.equal(existsSync(path.join(cwd, ".regulator")), false);
});

test("persistence failures never produce a success receipt or a partial row", async (t) => {
  const cwd = await project(t);
  const store = new RegulatoryEventStore(cwd);
  store.close();
  const db = new DatabaseSync(path.join(cwd, VSM_DATABASE_RELATIVE_PATH));
  db.exec(`CREATE TRIGGER injected AFTER INSERT ON regulatory_events
    BEGIN SELECT RAISE(ABORT, 'test write failure'); END;`);
  const host = harness(cwd, () => ({ authority: examples[0].authority, sourceRevision: "rev" }));
  await assert.rejects(host.execute(names[0], examples[0].payload), /test write failure/);
  assert.equal(db.prepare("SELECT count(*) AS count FROM regulatory_events").get()?.count, 0);
  db.exec("DROP TRIGGER injected");
  db.close();
  const result = await host.execute(names[0], examples[0].payload);
  assertValid(RegulatoryReceiptSchema, result.details, "receipt after recovery");
  assert.equal(result.details.sequence, 1);
  const failedRoot = await project(t);
  await writeFile(path.join(failedRoot, ".regulator"), "not a directory");
  const failedHost = harness(failedRoot, () => ({ authority: examples[0].authority, sourceRevision: "rev" }));
  await assert.rejects(failedHost.execute(names[0], examples[0].payload));
});

test("aborted calls and non-Git provenance fail safely without inventing metadata", async (t) => {
  const cwd = await project(t);
  const host = harness(cwd, () => ({ authority: examples[2].authority }));
  await assert.rejects(host.execute(names[2], examples[2].payload, "aborted", AbortSignal.abort()), /abort/i);
  assert.equal(existsSync(path.join(cwd, ".regulator")), false);
  await host.execute(names[2], examples[2].payload);
  const store = new RegulatoryEventStore(cwd);
  assert.equal(store.readAll()[0]?.event.provenance.sourceRevision, undefined);
  store.close();
});

test("supported Pi SDK loads and executes all reporting tools with explicit host grants", async () => {
  const { runReportingSmoke } = await import(new URL("../../../scripts/reporting-smoke.mjs", import.meta.url).href);
  const output = await runReportingSmoke();
  assert.deepEqual(output.checks, { ordinaryAuditDenied: true, smuggledAuthorityRejected: true, persistedRows: 3, gsdDatabaseAbsent: true });
});

test("canonical runtime root is separate from execution cwd and its Git provenance", async (t) => {
  const cwd = await project(t);
  execFileSync("git", ["-C", cwd, "init", "--quiet"]);
  execFileSync("git", ["-C", cwd, "-c", "user.name=VSM test", "-c", "user.email=test@example.invalid",
    "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", "commit", "--allow-empty", "--quiet", "-m", "fixture"]);
  const revision = execFileSync("git", ["-C", cwd, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const runtimeRoot = await project(t);
  const host = harness(cwd, () => ({ authority: examples[1].authority, runtimeRoot }));
  await host.execute(names[1], examples[1].payload);
  assert.equal(existsSync(path.join(cwd, ".regulator")), false);
  assert.equal(existsSync(path.join(runtimeRoot, VSM_DATABASE_RELATIVE_PATH)), true);
  const store = new RegulatoryEventStore(runtimeRoot);
  const event = store.readAll()[0]!.event;
  store.close();
  assert.equal(event.provenance.sourceRevision, revision);
  assert.equal(event.message.evidence[0]?.sourceRevision, revision);
});
