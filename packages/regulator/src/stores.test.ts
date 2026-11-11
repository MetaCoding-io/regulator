import assert from "node:assert/strict";
import test from "node:test";
import { AUDIT_RELATIVE_PATH, EFFECTS_RELATIVE_PATH, INSTANCE_MANIFEST_RELATIVE_PATH, LEASES_RELATIVE_DIR, MEMORY_RELATIVE_PATH, SIGNALS_RELATIVE_PATH, TRACE_RELATIVE_PATH, UNITS_RELATIVE_DIR, UNIT_STATUS_HISTORY_FILE, VSM_DATABASE_RELATIVE_PATH, WORKTREES_RELATIVE_DIR } from "@metacoding.io/regulator-core";
import { INSTANCE_STORES, instanceStoreFor } from "@metacoding.io/regulator-protocol";
import { OUTBOX_RELATIVE_PATH } from "./deliver.js";
import { SENSOR_CURSOR_RELATIVE_PATH } from "./sensors.js";
import { TRIALS_RELATIVE_DIR } from "./worktree.js";

test("INSTANCE_STORES is the closed list of what the harness writes under .regulator/: every path constant the code keeps is a store, and the list names nothing the code does not", () => {
  const constants = [INSTANCE_MANIFEST_RELATIVE_PATH, UNITS_RELATIVE_DIR, LEASES_RELATIVE_DIR, WORKTREES_RELATIVE_DIR, SIGNALS_RELATIVE_PATH, TRACE_RELATIVE_PATH, EFFECTS_RELATIVE_PATH, AUDIT_RELATIVE_PATH, MEMORY_RELATIVE_PATH, VSM_DATABASE_RELATIVE_PATH, OUTBOX_RELATIVE_PATH, `${OUTBOX_RELATIVE_PATH}.cursor`, SENSOR_CURSOR_RELATIVE_PATH, TRIALS_RELATIVE_DIR, `${UNITS_RELATIVE_DIR}/*/${UNIT_STATUS_HISTORY_FILE}`];
  for (const c of constants) {
    const store = instanceStoreFor(c.endsWith("/") ? c : `${c}/`) ?? instanceStoreFor(c);
    assert.ok(store, `${c} is a store the list knows`);
  }
  const covered = new Set(constants.map((c) => instanceStoreFor(c)?.path ?? instanceStoreFor(`${c}/`)?.path));
  for (const s of INSTANCE_STORES) assert.ok(covered.has(s.path), `${s.path} is a path the code writes`);
  assert.equal(new Set(INSTANCE_STORES.map((s) => s.path)).size, INSTANCE_STORES.length, "no path twice");
  for (const s of INSTANCE_STORES) assert.ok(s.path.startsWith(".regulator/"), `${s.path} is under .regulator/`);
  assert.equal(instanceStoreFor(".regulator/units/u1/unit.json")?.name, "the execution store", "a file under a directory store belongs to it");
  assert.equal(instanceStoreFor(".regulator/outbox.cursor")?.name, "the outbox cursor", "a file store matches exactly");
  // A file every unit's directory keeps is a store of its own (#162): the pattern is more specific than the directory it is under.
  assert.equal(instanceStoreFor(".regulator/units/u1/status.ndjson")?.name, "the status history");
  assert.equal(instanceStoreFor(".regulator/units/*/status.ndjson")?.name, "the status history", "as a registry record's scope.resources spells it");
  assert.equal(instanceStoreFor(".regulator/units/u1/attempts.ndjson")?.name, "the execution store");
  assert.equal(instanceStoreFor(".regulator/units/u1/deeper/status.ndjson")?.name, "the execution store", "* is one segment, never a separator");
  assert.equal(instanceStoreFor(".regulator/units//status.ndjson")?.name, "the execution store", "and never an empty one");
  assert.equal(instanceStoreFor(".regulator/outbox.log"), undefined, "a path the list does not name is no store");
});
