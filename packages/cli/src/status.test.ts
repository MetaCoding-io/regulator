import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { ExecutionStore, LeaseStore, appendSignal } from "@metacoding/vsm-pi-core";
import type { WorkContract } from "@metacoding/vsm-pi-protocol";
import { readStatus, renderStatusText } from "./status.js";

const contract: WorkContract = {
  kind: "task", id: "tc-1", version: 1, unitId: "u1", unitType: "implement",
  workload: { name: "software-development", version: 1 }, objective: "fix it", constraintRefs: [],
  fixed: [], delegated: [], unresolved: [], expectedEvidence: [],
  provenance: { createdBy: "S3", createdAt: "2026-09-22T00:00:00.000Z" },
};

test("status: a definition and an instance are read from files only, and the view says what is declared and what is pending", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "regulator-status-"));
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
  await writeFile(path.join(definition, "workload", "broken.json"), "{\"name\": 1}", "utf8");

  const instance = path.join(root, "instance");
  const clock = 5_000_000;
  const store = new ExecutionStore(instance, () => clock);
  await store.createUnit(contract);
  await store.setStatus("u1", "blocked", "no-report");
  await store.recordAttempt({ unitId: "u1", contractVersion: 1, startedAt: "a", endedAt: "b", outcome: "no-report" });
  const leases = new LeaseStore(path.join(instance, ".regulator", "leases"), () => clock);
  await leases.acquire({ unitId: "u1", owner: "alice", resource: "/w/u1", branch: "unit/u1", ttlMs: 1000 });
  await appendSignal(instance, {
    id: "s1", timestamp: "t", source: "S2", kind: "coordination-signal", channel: "signal", destination: "S3",
    severity: "advisory", subject: "src/a.js", unit: "u1", coordination: "oscillation", observation: "4 edits", evidence: [],
  });

  const view = await readStatus({ definitionDir: definition, instanceDir: instance, now: () => clock });
  assert.deepEqual(view.definition?.declared, ["registry", "workload"]);
  assert.deepEqual(view.definition?.pending, ["profiles", "policies"]);
  assert.equal(view.definition?.registry.records.length, 1);
  assert.deepEqual(view.definition?.registry.problems, []);
  assert.equal(view.definition?.workloads.length, 1);
  assert.match(view.definition?.problems[0] ?? "", /broken\.json/);
  assert.equal(view.instance?.units.length, 1);
  assert.equal(view.instance?.units[0]?.unit.status, "blocked");
  assert.equal(view.instance?.units[0]?.contract?.id, "tc-1");
  assert.equal(view.instance?.units[0]?.report, undefined);
  assert.equal(view.instance?.units[0]?.attemptRecords[0]?.outcome, "no-report");
  assert.deepEqual(view.instance?.leases.map((l) => [l.lease.unitId, l.live]), [["u1", true]]);
  assert.equal(view.instance?.signals[0]?.kind, "coordination-signal");

  const text = renderStatusText(view);
  assert.match(text, /declared: registry, workload; pending: profiles, policies/);
  assert.match(text, /S3 {2}deterministic-gate {2}reg\.test\.gate\.v1/);
  assert.match(text, /blocked {4}u1 {2}implement {2}contract tc-1 v1 {2}attempts 1 \(last: no-report\) {2}— no-report/);
  assert.match(text, /live {4}u1 {2}alice/);
  assert.match(text, /coordination-signal {2}S2→S3 {2}src\/a\.js {2}\(unit u1\)/);

  const empty = await readStatus({ instanceDir: path.join(root, "nothing-here"), now: () => clock });
  assert.deepEqual(empty.instance, { dir: path.join(root, "nothing-here"), units: [], leases: [], signals: [] });
  assert.match(renderStatusText({ generatedAt: "t", definition: undefined, instance: undefined }), /nothing to show/);
});
