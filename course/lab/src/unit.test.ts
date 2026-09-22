import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { gitExec, initRepo } from "./git-support.js";
import { finishUnit, initFixture, SIGNALS_RELATIVE_PATH, startUnit, unitStatus } from "./unit.js";
import { checkpoint, isClean } from "./worktree.js";

test("unit lifecycle: start claims the lease and isolates; finish reintegrates and releases", async (t) => {
  const repo = await initRepo(t);
  let clock = 5_000_000;
  const now = () => clock;
  const started = await startUnit(gitExec, { repo, unitId: "u1", owner: "alice", ttlMs: 60_000, now });
  assert.equal(started.base, "main");
  assert.equal(started.lease.resource, started.worktree.path);
  assert.equal((await unitStatus(gitExec, repo, now)).map((s) => [s.lease.unitId, s.live]).length, 1);

  // Starting the same unit twice is refused while the lease is live, and leaves no second worktree.
  await assert.rejects(startUnit(gitExec, { repo, unitId: "u1", owner: "bob", now }), /leased by unit "u1"/);
  // A worktree is not the base checkout.
  await assert.rejects(startUnit(gitExec, { repo: started.worktree.path, unitId: "u2", owner: "bob", now }), /base checkout/);

  await writeFile(path.join(started.worktree.path, "src.txt"), "two\n");
  await checkpoint(gitExec, started.worktree.path, "unit work");
  const finished = await finishUnit(gitExec, { repo, unitId: "u1", now });
  assert.equal(finished.result.merged, true);
  assert.equal(finished.released, true);
  assert.equal(await readFile(path.join(repo, "src.txt"), "utf8"), "two\n");
  await assert.rejects(stat(started.worktree.path), /ENOENT/, "worktree removed");
  assert.deepEqual(await unitStatus(gitExec, repo, now), []);
});

test("a conflicting finish resolves nothing: the base is left as found, the lease is kept, and S3 gets a signal", async (t) => {
  const repo = await initRepo(t);
  const started = await startUnit(gitExec, { repo, unitId: "u1", owner: "alice" });
  await writeFile(path.join(started.worktree.path, "src.txt"), "unit\n");
  await checkpoint(gitExec, started.worktree.path, "unit change");
  await writeFile(path.join(repo, "src.txt"), "base\n");
  await gitExec("git", ["commit", "--quiet", "-am", "base change"], { cwd: repo });

  const finished = await finishUnit(gitExec, { repo, unitId: "u1" });
  assert.deepEqual(finished.result, { merged: false, reason: "conflict", conflicts: ["src.txt"] });
  assert.equal(finished.released, false);
  assert.equal(await isClean(gitExec, repo), true);
  assert.equal(await readFile(path.join(repo, "src.txt"), "utf8"), "base\n");
  assert.ok(finished.signal);
  assert.equal(finished.signal.kind, "coordination-signal");
  assert.equal(finished.signal.coordination, "conflict");
  assert.equal(finished.signal.source, "S2");
  assert.deepEqual(finished.signal.evidence, [{ class: "file", ref: "src.txt" }]);
  const lines = (await readFile(path.join(repo, SIGNALS_RELATIVE_PATH), "utf8")).trim().split("\n");
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]!).id, finished.signal.id);
  assert.equal((await unitStatus(gitExec, repo)).length, 1, "the unit keeps its lease and worktree to resolve the conflict");
});

test("initFixture makes a fixture its own repository with one commit on main", async (t) => {
  const parent = await mkdtemp(path.join(tmpdir(), "regulator-fixture-init-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const dest = await initFixture(gitExec, fileURLToPath(new URL("../fixture-oscillation/", import.meta.url)), path.join(parent, "slugkit"));
  assert.equal(await isClean(gitExec, dest), true);
  assert.equal((await gitExec("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: dest })).stdout.trim(), "main");
  assert.equal((await gitExec("git", ["rev-list", "--count", "HEAD"], { cwd: dest })).stdout.trim(), "1");
  await assert.rejects(initFixture(gitExec, fileURLToPath(new URL("../fixture/", import.meta.url)), dest), /exist/i, "never overwrites");
});
