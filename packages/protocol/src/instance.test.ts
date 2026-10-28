import assert from "node:assert/strict";
import test from "node:test";
import { Value } from "typebox/value";
import { InstanceManifestSchema, MIGRATION_CLASSES, MIGRATION_GATES, MigrationBulletSchema, MigrationNoteSchema, UpgradeEntrySchema, isInstanceManifest, isMigrationNote } from "./index.js";

const sha = "a".repeat(64);

/** A manifest exactly as init wrote it under 0.1.3: no package version, no upgrade history. */
const written013 = {
  version: 1,
  definition: { root: "/srv/regulator", name: "regulator", registry: 43, harnessRevision: "0".repeat(40), pi: "0.87.0" },
  writablePaths: ["lib/"],
  initializedAt: "2026-09-29T12:00:00.000Z",
  initializedBy: "alice",
};

test("the manifest stays at schema version 1 (#53): one written before the package version and the upgrade history existed still validates; the new fields are optional and closed", () => {
  assert.equal(isInstanceManifest(written013), true, "a 0.1.3 manifest validates unchanged");
  const entry = { from: { packageVersion: "0.1.3", harnessRevision: "0".repeat(40) }, to: { packageVersion: "0.1.4", harnessRevision: "1".repeat(40) }, report: "none", by: "alice", at: "2026-10-27T12:00:00.000Z" };
  const upgraded = { ...written013, definition: { ...written013.definition, packageVersion: "0.1.4", harnessRevision: "1".repeat(40) }, upgrades: [entry, { ...entry, report: sha, reportFile: "evals/reports/drift-live-2026-11-01.json" }] };
  assert.equal(isInstanceManifest(upgraded), true);
  assert.equal(Value.Check(UpgradeEntrySchema, entry), true);
  // Closed: a version that is not semver, a report that is neither "none" nor a SHA-256, a missing side, an unknown field, a schema version that is not 1.
  assert.equal(isInstanceManifest({ ...written013, definition: { ...written013.definition, packageVersion: "unreleased" } }), false, "the manifest records a released version, never the word unreleased");
  assert.equal(isInstanceManifest({ ...written013, definition: { ...written013.definition, packageVersion: "0.1" } }), false);
  assert.equal(Value.Check(UpgradeEntrySchema, { ...entry, report: "abc" }), false);
  assert.equal(Value.Check(UpgradeEntrySchema, { ...entry, report: undefined }), false);
  assert.equal(Value.Check(UpgradeEntrySchema, { ...entry, to: { packageVersion: "0.1.4" } }), false);
  assert.equal(Value.Check(UpgradeEntrySchema, { ...entry, ranBy: "alice" }), false);
  assert.equal(isInstanceManifest({ ...written013, upgrades: [{ ...entry, by: "" }] }), false);
  assert.equal(isInstanceManifest({ ...written013, version: 2 }), false);
  assert.equal(Value.Check(InstanceManifestSchema, { ...written013, upgrades: "none" }), false);
});

test("the migration note is a typed shape (#53): a closed class list, a closed gate vocabulary where scripted and live carry a report fingerprint and check and none carry nothing, and the version is semver or unreleased", () => {
  assert.deepEqual([...MIGRATION_CLASSES], ["identity", "policy", "workload", "profile", "advice", "registry", "contract"]);
  assert.deepEqual([...MIGRATION_GATES], ["check", "scripted", "live", "none"]);
  const bullet = { class: "advice", path: "advice/<profile>.md", gate: { kind: "check" }, text: "Advice is a file set; upgrade seeds regulator/advice/ where absent." };
  for (const gate of [{ kind: "check" }, { kind: "none" }, { kind: "scripted", report: sha }, { kind: "live", report: sha }]) assert.equal(Value.Check(MigrationBulletSchema, { ...bullet, gate }), true, JSON.stringify(gate));
  for (const gate of [{ kind: "scripted" }, { kind: "live" }, { kind: "check", report: sha }, { kind: "none", report: sha }, { kind: "eval", report: sha }, { kind: "scripted", report: "abc" }]) assert.equal(Value.Check(MigrationBulletSchema, { ...bullet, gate }), false, JSON.stringify(gate));
  assert.equal(Value.Check(MigrationBulletSchema, { ...bullet, class: "fixture" }), false, "a fixture is not a class a note describes");
  assert.equal(Value.Check(MigrationBulletSchema, { ...bullet, text: "" }), false);
  assert.equal(isMigrationNote({ version: "unreleased", bullets: [bullet] }), true);
  assert.equal(isMigrationNote({ version: "0.1.4", bullets: [] }), true, "a version with a section and nothing an instance meets");
  assert.equal(isMigrationNote({ version: "0.2", bullets: [] }), false);
  assert.equal(isMigrationNote({ version: "Unreleased", bullets: [] }), false);
  assert.equal(Value.Check(MigrationNoteSchema, { version: "0.1.4" }), false);
});
