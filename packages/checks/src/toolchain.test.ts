import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { EvidenceEnvironmentSchema, assertValid } from "@metacoding.io/regulator-protocol";
import { discoverToolchain, evidenceEnvironment, nixStoreIdentity } from "./toolchain.js";

const valid = (v: unknown): boolean => { try { assertValid(EvidenceEnvironmentSchema, v, "environment"); return true; } catch { return false; } };
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
/** No Nix variables: the lock and package-lock sources, whatever shell the suite itself runs in. */
const OUTSIDE: NodeJS.ProcessEnv = { PATH: "/usr/bin:/bin" };

test("discoverToolchain (#178): nix-store, then lock (flake.lock before devenv.lock), then package-lock (pnpm-lock.yaml first), the first found recorded; none, and the field is absent and the record validates as today", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-toolchain-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  assert.equal(await discoverToolchain(dir, OUTSIDE), undefined, "nothing found: no field");
  const bare = await evidenceEnvironment(dir, OUTSIDE);
  assert.equal("toolchain" in bare, false);
  assert.ok(valid(bare), "a record without the field validates as it did");

  await writeFile(path.join(dir, "package-lock.json"), "{}\n");
  assert.deepEqual(await discoverToolchain(dir, OUTSIDE), { source: "package-lock", hash: sha("{}\n") });
  await writeFile(path.join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  assert.deepEqual(await discoverToolchain(dir, OUTSIDE), { source: "package-lock", hash: sha("lockfileVersion: '9.0'\n") }, "pnpm-lock.yaml first");

  await writeFile(path.join(dir, "devenv.lock"), "devenv\n");
  assert.deepEqual(await discoverToolchain(dir, OUTSIDE), { source: "lock", hash: sha("devenv\n") }, "a declared environment outranks the package lock");
  await writeFile(path.join(dir, "flake.lock"), "flake\n");
  assert.deepEqual(await discoverToolchain(dir, OUTSIDE), { source: "lock", hash: sha("flake\n") }, "flake.lock before devenv.lock");

  // Inside a devenv shell: the profile's store path, through its symlink, outranks every file.
  const store = path.join(dir, "nix-store-abc123-devenv-profile");
  await writeFile(store, "");
  await symlink(store, path.join(dir, ".devenv-profile"));
  const devenv = { ...OUTSIDE, DEVENV_PROFILE: path.join(dir, ".devenv-profile") };
  assert.equal(await nixStoreIdentity(devenv), store, "the symlink resolved to the store path");
  assert.deepEqual(await discoverToolchain(dir, devenv), { source: "nix-store", hash: sha(store) }, "the hash of the store path's string");
  assert.deepEqual(await discoverToolchain(dir, { ...OUTSIDE, DEVENV_PROFILE: "/nix/store/zzz-unresolvable-profile" }), { source: "nix-store", hash: sha("/nix/store/zzz-unresolvable-profile") }, "an unresolvable profile is hashed as given");

  // A bare `nix develop` names no profile: its store inputs on PATH, sorted and deduplicated, stand for it.
  const shell = { IN_NIX_SHELL: "impure", PATH: ["/nix/store/bbb-git/bin", "/usr/bin", "/nix/store/aaa-nodejs/bin", "/nix/store/bbb-git/bin"].join(path.delimiter) };
  assert.deepEqual(await discoverToolchain(dir, shell), { source: "nix-store", hash: sha("/nix/store/aaa-nodejs/bin\n/nix/store/bbb-git/bin") });
  const reordered = { ...shell, PATH: ["/nix/store/aaa-nodejs/bin", "/nix/store/bbb-git/bin", "/bin"].join(path.delimiter) };
  assert.deepEqual(await discoverToolchain(dir, reordered), await discoverToolchain(dir, shell), "the order PATH lists them in is not the environment");
  assert.deepEqual(await discoverToolchain(dir, { IN_NIX_SHELL: "pure", PATH: "/usr/bin" }), { source: "lock", hash: sha("flake\n") }, "a shell with no store path on PATH falls through to the lock");

  const recorded = await evidenceEnvironment(dir, devenv);
  assert.deepEqual(recorded.toolchain, { source: "nix-store", hash: sha(store) });
  assert.ok(valid(recorded));
  assert.equal(valid({ ...recorded, toolchain: { source: "docker", hash: sha("x") } }), false, "the source is a closed list");
  assert.equal(valid({ ...recorded, toolchain: { source: "lock", hash: "abc" } }), false, "the hash is a SHA-256");
});
