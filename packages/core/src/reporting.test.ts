import assert from "node:assert/strict";
import fs, { existsSync, readFileSync } from "node:fs";
import { link, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test, { type TestContext } from "node:test";
import {
  assertValid, ReportingAuthoritySchema, ReportingToolNameSchema,
  type ReportingContext,
} from "@metacoding/vsm-pi-protocol";
import { createRegulatoryEvent, RegulatoryEventStore, VSM_DATABASE_RELATIVE_PATH } from "./index.js";

const examples = JSON.parse(readFileSync(new URL("../../../fixtures/reporting/examples.json", import.meta.url), "utf8"));
async function project(t: TestContext) {
  const cwd = await mkdtemp(path.join(tmpdir(), "vsm-events-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  return cwd;
}
function exampleEvent(index: number) {
  const { tool, payload, authority } = examples[index];
  assertValid(ReportingToolNameSchema, tool, "example tool");
  assertValid(ReportingAuthoritySchema, authority, "example authority");
  return createRegulatoryEvent(tool, payload, {
    authority, provenance: { host: "test-host", sessionId: "session-1", unit: "unit-1", sourceRevision: "abc123" },
  }, `call-${index}`);
}

test("host context constructs envelope, provenance and grants without sharing mutable input", () => {
  for (let index = 0; index < examples.length; index++) {
    const event = exampleEvent(index);
    assert.match(event.message.id, /^[a-f0-9-]{36}$/);
    assert.equal(new Date(event.message.timestamp).toISOString(), event.message.timestamp);
    assert.equal(event.message.unit, "unit-1");
    assert.equal(event.authority.id, examples[index].authority.id);
    assert.equal(event.tool.callId, `call-${index}`);
    assert.equal(event.provenance.sourceRevision, "abc123");
    for (const ref of event.message.evidence) assert.equal(ref.sourceRevision, "abc123");
  }
  for (const source of ["S1", "S3", "S4"] as const) {
    const context: ReportingContext = { authority: { id: "proposer", capabilities: { proposePolicyAs: source } }, provenance: { host: "test" } };
    const event = createRegulatoryEvent("vsm_propose_policy_change", examples[0].payload, context, "proposal");
    context.authority.id = "changed";
    assert.equal(event.authority.id, "proposer");
    assert.equal(event.message.source, source);
    assert.equal(event.message.destination, "S5");
  }
});

test("default and operational contexts cannot report independent audits", () => {
  const input = examples[1].payload;
  assert.throws(() => createRegulatoryEvent("vsm_report_audit_finding", input, undefined, "call"), /authority denied/);
  for (const capabilities of [{}, { reportOperationalSignal: true as const }, { proposePolicyAs: "S1" as const }]) {
    assert.throws(() => createRegulatoryEvent("vsm_report_audit_finding", input, {
      authority: { id: "ordinary", capabilities }, provenance: { host: "test" },
    }, "call"), /authority denied/);
  }
  for (const reportedSeverity of ["blocking", "critical"]) {
    assert.throws(() => createRegulatoryEvent("vsm_report_audit_finding", { ...input, reportedSeverity, evidence: [] }, {
      authority: examples[1].authority, provenance: { host: "test" },
    }, "call"), /require evidence/);
  }
  assert.doesNotThrow(() => createRegulatoryEvent("vsm_report_audit_finding", { ...input, reportedSeverity: "advisory", evidence: [] }, {
    authority: examples[1].authority, provenance: { host: "test" },
  }, "call"));
});

test("SQLite appends, reopens, replays by sequence, and reproduces receipts", async (t) => {
  const cwd = await project(t);
  const store = new RegulatoryEventStore(cwd);
  assert.equal(store.path, path.join(cwd, VSM_DATABASE_RELATIVE_PATH));
  const events = examples.map((_: unknown, index: number) => exampleEvent(index));
  // Timestamp ordering is intentionally different from commit ordering.
  events[0].message.timestamp = "2026-09-09T00:00:00.000Z";
  events[1].message.timestamp = "2026-09-07T00:00:00.000Z";
  const receipts = events.map((event: ReturnType<typeof exampleEvent>) => store.append(event));
  assert.deepEqual(receipts.map((receipt: { sequence: number }) => receipt.sequence), [1, 2, 3]);
  store.close();
  const reopened = new RegulatoryEventStore(cwd);
  assert.deepEqual(reopened.readAll().map((row) => row.event), events);
  assert.deepEqual(reopened.readAll().map((row) => row.receipt), receipts);
  reopened.close();
  const db = new DatabaseSync(path.join(cwd, VSM_DATABASE_RELATIVE_PATH));
  assert.equal(db.prepare("PRAGMA journal_mode").get()?.journal_mode, "wal");
  const rows = db.prepare("SELECT * FROM regulatory_events ORDER BY sequence").all();
  assert.equal(rows.length, 3);
  assert.equal(rows[0]?.source, "S1");
  assert.equal(rows[1]?.channel, "audit");
  assert.ok(String(rows[0]?.event_json).startsWith('{"authority":'));
  assert.throws(() => db.exec("UPDATE regulatory_events SET subject = 'changed'"), /append-only/);
  assert.throws(() => db.exec("DELETE FROM regulatory_events"), /append-only/);
  db.close();
  assert.equal(existsSync(path.join(cwd, ".gsd/gsd.db")), false);
});

test("an insert failure rolls back and leaves the connection usable", async (t) => {
  const cwd = await project(t);
  const store = new RegulatoryEventStore(cwd);
  const db = new DatabaseSync(store.path);
  db.exec(`CREATE TRIGGER inject_failure AFTER INSERT ON regulatory_events
    BEGIN SELECT RAISE(ABORT, 'injected persistence failure'); END;`);
  assert.throws(() => store.append(exampleEvent(0)), /injected persistence failure/);
  assert.deepEqual(store.readAll(), []);
  db.exec("DROP TRIGGER inject_failure");
  db.exec(`CREATE TRIGGER inject_failure AFTER INSERT ON regulatory_events
    BEGIN SELECT RAISE(ROLLBACK, 'automatic rollback'); END;`);
  assert.throws(() => store.append(exampleEvent(0)), /automatic rollback/);
  assert.deepEqual(store.readAll(), []);
  db.exec("DROP TRIGGER inject_failure");
  const event = exampleEvent(0);
  const receipt = store.append(event);
  assert.equal(receipt.sequence, 1);
  assert.throws(() => store.append(event), /UNIQUE/);
  assert.equal(store.readAll().length, 1);
  assert.equal(store.append(exampleEvent(2)).sequence, 2);
  db.close();
  store.close();
});

test("invalid internal events are rejected before any insertion", async (t) => {
  const store = new RegulatoryEventStore(await project(t));
  const event = exampleEvent(1);
  for (const invalid of [
    { ...event, authority: { id: "ordinary", capabilities: {} } },
    { ...event, message: { ...event.message, source: "S1" } },
    { ...event, message: { ...event.message, evidence: [] } },
    { ...event, provenance: { ...event.provenance, sourceRevision: "changed" } },
  ]) {
    assert.throws(() => store.append(invalid as typeof event));
  }
  assert.deepEqual(store.readAll(), []);
  store.close();
});

test("runtime path aliases and failed opens cannot redirect persistence", async (t) => {
  const cwd = await project(t);
  const outside = await project(t);
  await symlink(outside, path.join(cwd, ".gsd"));
  assert.throws(() => new RegulatoryEventStore(cwd), /aliases/);
  await rm(path.join(cwd, ".gsd"));
  await mkdir(path.join(cwd, ".gsd/vsm-runtime"), { recursive: true });
  await symlink(path.join(outside, "target.db"), path.join(cwd, VSM_DATABASE_RELATIVE_PATH));
  assert.throws(() => new RegulatoryEventStore(cwd), /unaliased/);
  assert.equal(existsSync(path.join(outside, "target.db")), false);
  await rm(path.join(cwd, VSM_DATABASE_RELATIVE_PATH));
  const other = new RegulatoryEventStore(outside);
  other.close();
  await link(path.join(outside, VSM_DATABASE_RELATIVE_PATH), path.join(cwd, VSM_DATABASE_RELATIVE_PATH));
  assert.throws(() => new RegulatoryEventStore(cwd), /unaliased/);
});


test("first-open tolerates another process creating directories before mkdir", async (t) => {
  const cwd = await project(t);
  const original = fs.mkdirSync;
  let races = 0;
  t.mock.method(fs, "mkdirSync", (filename: Parameters<typeof original>[0], options: Parameters<typeof original>[1]) => {
    if (!existsSync(filename)) {
      original(filename);
      races++;
    }
    return original(filename, options);
  });
  syncBuiltinESMExports();
  try {
    const store = new RegulatoryEventStore(cwd);
    try {
      assert.equal(store.append(exampleEvent(0)).sequence, 1);
      assert.equal(races, 2);
    } finally { store.close(); }
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
});
