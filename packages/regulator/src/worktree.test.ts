import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { gitExec, initRepo } from "./git-support.js";
import { baseRoot, checkpoint, createUnitWorktree, currentBranch, isClean, reintegrate, removeUnitWorktree } from "./worktree.js";

test("the pre-merge trial (#48): the merge is made in a temporary worktree first and the trial runs there; a failing trial lands nothing and leaves no worktree, a conflict is found there too, a passing trial lands exactly the verified commit by fast-forward, and a base that moved meanwhile is refused", async (t) => {
  const repo = await initRepo(t);
  const unit = await createUnitWorktree(gitExec, repo, "u1");
  await writeFile(path.join(unit.path, "src", "u1.js"), "export const u1 = 1;\n");
  await gitExec("git", ["add", "-A"], { cwd: unit.path });
  await gitExec("git", ["commit", "-qm", "u1: a file"], { cwd: unit.path });
  const head = async () => (await gitExec("git", ["rev-parse", "HEAD"], { cwd: repo })).stdout.trim();
  const before = await head();
  const worktrees = async () => (await gitExec("git", ["worktree", "list"], { cwd: repo })).stdout;
  const seen: Array<{ cwd: string; sha: string; hasFile: boolean; baseHead: string }> = [];

  const failed = await reintegrate(gitExec, repo, unit.branch, "main", { trial: async (trial) => {
    seen.push({ cwd: trial.cwd, sha: trial.sha, hasFile: existsSync(path.join(trial.cwd, "src", "u1.js")), baseHead: await head() });
    return { ok: false, reasons: ["pre-merge:run_tests: 1 passed, 1 failed"] };
  } });
  assert.equal(failed.merged, false);
  assert.deepEqual(failed.merged ? undefined : [failed.reason, "reasons" in failed ? failed.reasons : undefined], ["trial-failed", ["pre-merge:run_tests: 1 passed, 1 failed"]]);
  assert.equal(await head(), before, "nothing landed");
  assert.ok(seen[0]!.cwd.includes(`${path.sep}.regulator${path.sep}trials${path.sep}`), "the trial ran in its own worktree under .regulator/trials/");
  assert.equal(seen[0]!.hasFile, true, "on the merged tree");
  assert.equal(seen[0]!.baseHead, before, "while the base was untouched");
  assert.equal(failed.merged ? undefined : "sha" in failed ? failed.sha !== before : undefined, true, "the trial commit is not the base's");
  assert.doesNotMatch(await worktrees(), /trials/, "the trial worktree is removed, whatever happened");

  const passed = await reintegrate(gitExec, repo, unit.branch, "main", { trial: async () => ({ ok: true, reasons: [] }) });
  assert.equal(passed.merged, true);
  const after = await head();
  assert.equal(after, seen.length && passed.merged ? (await gitExec("git", ["rev-parse", passed.sha], { cwd: repo })).stdout.trim() : "", "the base is at the trial commit");
  assert.equal(passed.merged ? passed.sha : "", after.slice(0, 7));
  assert.match((await gitExec("git", ["log", "-1", "--format=%s%n%P", after], { cwd: repo })).stdout, new RegExp(`^Reintegrate unit/u1\\n${before} [0-9a-f]{40}\\n$`), "a merge commit of the base and the branch, as before");
  assert.doesNotMatch(await worktrees(), /trials/);

  // A conflict is found in the trial, and the base is untouched.
  const u2 = await createUnitWorktree(gitExec, repo, "u2");
  await writeFile(path.join(u2.path, "src", "u1.js"), "export const u1 = 2;\n");
  await gitExec("git", ["commit", "-qam", "u2: the same line"], { cwd: u2.path });
  await writeFile(path.join(repo, "src", "u1.js"), "export const u1 = 3;\n");
  await gitExec("git", ["commit", "-qam", "main: the same line"], { cwd: repo });
  const mid = await head();
  const conflicted = await reintegrate(gitExec, repo, u2.branch, "main", { trial: async () => { throw new Error("no trial on a conflict"); } });
  assert.deepEqual(conflicted, { merged: false, reason: "conflict", conflicts: ["src/u1.js"] });
  assert.equal(await head(), mid);
  assert.doesNotMatch(await worktrees(), /trials/);

  // The base moves during the trial: what was verified is not what would land.
  const u3 = await createUnitWorktree(gitExec, repo, "u3");
  await writeFile(path.join(u3.path, "src", "u3.js"), "export const u3 = 1;\n");
  await gitExec("git", ["add", "-A"], { cwd: u3.path });
  await gitExec("git", ["commit", "-qm", "u3"], { cwd: u3.path });
  const moved = await reintegrate(gitExec, repo, u3.branch, "main", { trial: async () => {
    await writeFile(path.join(repo, "README.md"), "moved\n");
    await gitExec("git", ["add", "-A"], { cwd: repo });
    await gitExec("git", ["commit", "-qm", "someone else landed"], { cwd: repo });
    return { ok: true, reasons: [] };
  } });
  assert.equal(moved.merged ? undefined : moved.reason, "base-moved");
  assert.doesNotMatch(await worktrees(), /trials/);
});

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
