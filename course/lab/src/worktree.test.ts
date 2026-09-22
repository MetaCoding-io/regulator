import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { gitExec, initRepo } from "./git-support.js";
import { baseRoot, checkpoint, createUnitWorktree, currentBranch, isClean, reintegrate, removeUnitWorktree } from "./worktree.js";

test("worktree per unit: create, checkpoint, reintegrate cleanly, remove", async (t) => {
  const repo = await initRepo(t);
  const unit = await createUnitWorktree(gitExec, repo, "u1", "main");
  assert.equal(unit.branch, "unit/u1");
  assert.equal(await currentBranch(gitExec, unit.path), "unit/u1");
  assert.equal(path.resolve(await baseRoot(gitExec, unit.path)), path.resolve(repo), "a worktree knows its base checkout");
  assert.deepEqual(await checkpoint(gitExec, unit.path, "nothing yet"), { committed: false });
  await writeFile(path.join(unit.path, "src.txt"), "two\n");
  const cp = await checkpoint(gitExec, unit.path, "change src");
  assert.equal(cp.committed, true);
  assert.match(cp.sha ?? "", /^[0-9a-f]{7,}$/);
  assert.equal(await readFile(path.join(repo, "src.txt"), "utf8"), "one\n", "the base is untouched until reintegration");
  const result = await reintegrate(gitExec, repo, unit.branch, "main");
  assert.equal(result.merged, true);
  assert.equal(await readFile(path.join(repo, "src.txt"), "utf8"), "two\n");
  await removeUnitWorktree(gitExec, repo, unit, { deleteBranch: true });
  assert.equal((await gitExec("git", ["branch", "--list", "unit/u1"], { cwd: repo })).stdout.trim(), "");
});

test("reintegration refuses a dirty base or the wrong branch, and surfaces a conflict without resolving it", async (t) => {
  const repo = await initRepo(t);
  const unit = await createUnitWorktree(gitExec, repo, "u1", "main");
  await writeFile(path.join(unit.path, "src.txt"), "unit version\n");
  await checkpoint(gitExec, unit.path, "unit change");

  await writeFile(path.join(repo, "scratch.txt"), "uncommitted\n");
  assert.deepEqual(await reintegrate(gitExec, repo, unit.branch, "main"), { merged: false, reason: "dirty-base" });
  await gitExec("git", ["clean", "-fq"], { cwd: repo });
  assert.equal(await isClean(gitExec, repo), true, ".regulator/ is ignored when judging cleanliness");

  // Base moves on the same line: a real conflict.
  await writeFile(path.join(repo, "src.txt"), "base version\n");
  await gitExec("git", ["commit", "--quiet", "-am", "base change"], { cwd: repo });
  const before = (await gitExec("git", ["rev-parse", "HEAD"], { cwd: repo })).stdout.trim();
  const result = await reintegrate(gitExec, repo, unit.branch, "main");
  assert.deepEqual(result, { merged: false, reason: "conflict", conflicts: ["src.txt"] });
  assert.equal((await gitExec("git", ["rev-parse", "HEAD"], { cwd: repo })).stdout.trim(), before, "HEAD is exactly as found");
  assert.equal(await isClean(gitExec, repo), true, "the aborted merge left nothing behind");
  assert.equal(await readFile(path.join(repo, "src.txt"), "utf8"), "base version\n");

  await gitExec("git", ["checkout", "--quiet", "-b", "other"], { cwd: repo });
  assert.deepEqual(await reintegrate(gitExec, repo, unit.branch, "main"), { merged: false, reason: "wrong-branch", current: "other" });
});
