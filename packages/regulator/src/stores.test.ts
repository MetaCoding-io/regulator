import assert from "node:assert/strict";
import test from "node:test";
import { AUDIT_RELATIVE_PATH, EFFECTS_RELATIVE_PATH, INSTANCE_MANIFEST_RELATIVE_PATH, LEASES_RELATIVE_DIR, MEMORY_RELATIVE_PATH, SIGNALS_RELATIVE_PATH, TRACE_RELATIVE_PATH, UNITS_RELATIVE_DIR, VSM_DATABASE_RELATIVE_PATH, WORKTREES_RELATIVE_DIR } from "@metacoding.io/regulator-core";
import { INSTANCE_STORES, instanceStoreFor } from "@metacoding.io/regulator-protocol";
import { OUTBOX_RELATIVE_PATH } from "./deliver.js";
import { TRIALS_RELATIVE_DIR } from "./worktree.js";

test("INSTANCE_STORES is the closed list of what the harness writes under .regulator/: every path constant the code keeps is a store, and the list names nothing the code does not", () => {
  const constants = [INSTANCE_MANIFEST_RELATIVE_PATH, UNITS_RELATIVE_DIR, LEASES_RELATIVE_DIR, WORKTREES_RELATIVE_DIR, SIGNALS_RELATIVE_PATH, TRACE_RELATIVE_PATH, EFFECTS_RELATIVE_PATH, AUDIT_RELATIVE_PATH, MEMORY_RELATIVE_PATH, VSM_DATABASE_RELATIVE_PATH, OUTBOX_RELATIVE_PATH, `${OUTBOX_RELATIVE_PATH}.cursor`, TRIALS_RELATIVE_DIR];
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
  assert.equal(instanceStoreFor(".regulator/outbox.log"), undefined, "a path the list does not name is no store");
});
