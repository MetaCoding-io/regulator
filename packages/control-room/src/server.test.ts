import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { ExecutionStore, LeaseStore, ObligationLedger, appendSignal } from "@metacoding/vsm-pi-core";
import type { WorkContract } from "@metacoding/vsm-pi-protocol";
import { createControlRoomServer, readControlRoom } from "./server.js";

const contract: WorkContract = {
  kind: "task", id: "tc-1", version: 1, unitId: "u1", unitType: "implement",
  workload: { name: "software-development", version: 1 }, objective: "fix it", constraintRefs: [],
  fixed: [], delegated: [], unresolved: [], expectedEvidence: [],
  provenance: { createdBy: "S3", createdAt: "2026-09-22T00:00:00.000Z" },
};

async function fixture(t: TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), "regulator-control-room-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const definition = path.join(root, "definition");
  await mkdir(path.join(definition, "registry", "regulators"), { recursive: true });
  await mkdir(path.join(definition, "workload"), { recursive: true });
  await mkdir(path.join(definition, "src"), { recursive: true });
  await writeFile(path.join(definition, "src", "gate.ts"), "", "utf8");
  await writeFile(path.join(definition, "src", "gate.test.ts"), "", "utf8");
  await writeFile(path.join(definition, "registry", "regulators", "gate.json"), JSON.stringify({
    id: "reg.test.gate.v1", name: "Gate", status: "active", vsmFunction: "S3", purpose: "p",
    absorbs: { failureClass: "f", description: "d" },
    mechanism: { level: "deterministic-gate", implementation: "src/gate.ts", enforcementPoints: ["tool_call"] },
    evidence: { tests: ["src/gate.test.ts"] }, limitations: ["l"],
    ownership: { owner: "o", introduced: "2026-09-22", reviewBy: "2026-12-01" },
  }), "utf8");
  await writeFile(path.join(definition, "workload", "sd.json"), JSON.stringify({
    name: "software-development", version: 1, description: "d",
    unitTypes: [{ name: "implement", description: "d", profile: "implement", checks: [], requiresContract: true }],
  }), "utf8");
  const clock = 5_000_000;
  const a = path.join(root, "instance-a");
  const b = path.join(root, "instance-b");
  const store = new ExecutionStore(a, () => clock);
  await store.createUnit(contract);
  await store.setStatus("u1", "closed");
  await new LeaseStore(path.join(b, ".regulator", "leases"), () => clock).acquire({ unitId: "u2", owner: "bob", resource: "/w/u2", branch: "unit/u2", ttlMs: 1000 });
  await appendSignal(b, {
    id: "s1", timestamp: "t", source: "S2", kind: "coordination-signal", channel: "signal", destination: "S3",
    severity: "advisory", subject: "src/a.js", unit: "u2", coordination: "oscillation", observation: "4 edits", evidence: [],
  });
  await new ObligationLedger(b, () => clock).openObligation({ subject: "unit u2: clarify (oscillation)", unit: "u2", concern: "recovery-decision", sources: ["d1"], severity: "blocking", consumer: "human", blocks: true });
  return { definition, a, b, clock };
}

test("readControlRoom projects one definition and any number of instances, from files only", async (t) => {
  const { definition, a, b, clock } = await fixture(t);
  const view = await readControlRoom({ definitionDir: definition, instanceDirs: [a, b], now: () => clock });
  assert.equal(view.definition?.registry.records[0]?.id, "reg.test.gate.v1");
  assert.equal(view.instances.length, 2);
  assert.deepEqual(view.instances[0]?.units.map((u) => [u.unit.unitId, u.unit.status]), [["u1", "closed"]]);
  assert.deepEqual(view.instances[1]?.leases.map((l) => [l.lease.unitId, l.live]), [["u2", true]]);
  assert.equal(view.instances[1]?.signals[0]?.kind, "coordination-signal");
  assert.deepEqual(view.instances[1]?.obligations.map((o) => [o.consumer, o.status, o.blocks]), [["human", "open", true]]);
  const none = await readControlRoom({ instanceDirs: [], now: () => clock });
  assert.equal(none.definition, undefined);
  assert.deepEqual(none.instances, []);
});

test("the server serves the page and the JSON view, refuses writes, and knows no other path", async (t) => {
  const { definition, a, b, clock } = await fixture(t);
  const server = createControlRoomServer({ definitionDir: definition, instanceDirs: [a, b], now: () => clock });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type") ?? "", /text\/html/);
  const html = await page.text();
  assert.match(html, /regulator control room/);
  assert.match(html, /read-only/);
  assert.match(html, /fetch\("\/api\/status"/);
  assert.doesNotMatch(html, /method:\s*"POST"/, "the page never writes");

  const status = await fetch(`${base}/api/status`);
  assert.equal(status.status, 200);
  assert.equal(status.headers.get("cache-control"), "no-store");
  const view = await status.json() as { generatedAt: string; definition: { workloads: unknown[] }; instances: unknown[] };
  assert.equal(view.generatedAt, new Date(clock).toISOString());
  assert.equal(view.definition.workloads.length, 1);
  assert.equal(view.instances.length, 2);

  const post = await fetch(`${base}/api/status`, { method: "POST", body: "{}" });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET, HEAD");
  const del = await fetch(`${base}/`, { method: "DELETE" });
  assert.equal(del.status, 405);
  const missing = await fetch(`${base}/api/units`);
  assert.equal(missing.status, 404);
});
