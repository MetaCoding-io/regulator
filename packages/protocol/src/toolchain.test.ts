import assert from "node:assert/strict";
import test from "node:test";
import { Value } from "typebox/value";
import { ENVIRONMENT_FILES, EnvironmentFingerprintSchema, ExpectationCheckSchema, InstanceManifestSchema, TOOLCHAIN_SOURCES, describeToolchain, sameToolchain } from "./index.js";

const hash = "b".repeat(64);

test("the toolchain (#178) is optional on the fingerprint and the manifest, and closed: three sources, a SHA-256; a record written before it validates unchanged and reads as not recorded", () => {
  assert.deepEqual([...TOOLCHAIN_SOURCES], ["nix-store", "lock", "package-lock"]);
  const fingerprint = { node: "v22.19.0", platform: "linux", arch: "x64", pi: "0.87.0", harnessRevision: "0".repeat(40), dispatcher: "scripted:reference", model: "none", registry: 50, policies: { default: 1 } };
  assert.equal(Value.Check(EnvironmentFingerprintSchema, fingerprint), true, "a committed report's fingerprint, without the field");
  for (const source of TOOLCHAIN_SOURCES) assert.equal(Value.Check(EnvironmentFingerprintSchema, { ...fingerprint, toolchain: { source, hash } }), true, source);
  assert.equal(Value.Check(EnvironmentFingerprintSchema, { ...fingerprint, toolchain: { source: "apt", hash } }), false);
  assert.equal(Value.Check(EnvironmentFingerprintSchema, { ...fingerprint, toolchain: { source: "lock", hash, file: "flake.lock" } }), false);
  const manifest = { version: 1, definition: { root: "/srv/regulator", name: "regulator", registry: 50, harnessRevision: "0".repeat(40), pi: "0.87.0" }, initializedAt: "t", initializedBy: "alice" };
  assert.equal(Value.Check(InstanceManifestSchema, manifest), true);
  assert.equal(Value.Check(InstanceManifestSchema, { ...manifest, toolchain: { source: "package-lock", hash } }), true);
  assert.equal(sameToolchain(undefined, undefined), true);
  assert.equal(sameToolchain({ source: "lock", hash }, { source: "package-lock", hash }), false, "the same bytes under another source are another reading");
  assert.equal(describeToolchain(undefined), "not recorded");
  assert.equal(describeToolchain({ source: "lock", hash }), `lock ${"b".repeat(12)}…`);
});

test("a contract exempts an environment file from identity-untouched by name (#178), at least one, and nothing outside the closed list: not the identity, not the advice, not vendor/", () => {
  assert.deepEqual([...ENVIRONMENT_FILES], ["flake.nix", "flake.lock", "devenv.nix", "devenv.lock", "devenv.yaml"]);
  assert.equal(Value.Check(ExpectationCheckSchema, { kind: "identity-untouched", exempt: [...ENVIRONMENT_FILES] }), true);
  for (const exempt of [[], ["regulator/identity/"], ["regulator/advice/implement.md"], ["vendor/"], ["flake.lock", "INVARIANTS.md"]]) {
    assert.equal(Value.Check(ExpectationCheckSchema, { kind: "identity-untouched", exempt }), false, JSON.stringify(exempt));
  }
});
