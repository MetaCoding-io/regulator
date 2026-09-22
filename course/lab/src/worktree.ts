/**
 * Isolation and reintegration, Pi-free: one git worktree and branch per unit,
 * checkpoint commits inside it, and a merge back that refuses a dirty base
 * and surfaces conflicts instead of resolving them.
 *
 * Isolation is only half of S2. Reintegration is where hidden coupling
 * surfaces, and a conflict is a coordination signal for S3 — never something
 * this module settles on its own.
 */
import path from "node:path";
import { WORKTREES_RELATIVE_DIR } from "@metacoding/vsm-pi-core";
import type { Exec } from "./exec.js";

export { WORKTREES_RELATIVE_DIR } from "@metacoding/vsm-pi-core";

async function git(exec: Exec, cwd: string, args: string[]): Promise<string> {
  const result = await exec("git", args, { cwd });
  if (result.code !== 0) throw new Error(`git ${args.join(" ")} failed (${result.code}): ${result.stderr.trim() || result.stdout.trim()}`);
  return result.stdout;
}

/** The main checkout that owns `.git`, whether `cwd` is that checkout or one of its worktrees. */
export async function baseRoot(exec: Exec, cwd: string): Promise<string> {
  const common = (await git(exec, cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"])).trim();
  return path.dirname(common);
}

export async function currentBranch(exec: Exec, cwd: string): Promise<string> {
  return (await git(exec, cwd, ["rev-parse", "--abbrev-ref", "HEAD"])).trim();
}

/** Clean means no tracked changes and no untracked files, ignoring the harness's own `.regulator/` directory. */
export async function isClean(exec: Exec, cwd: string): Promise<boolean> {
  const status = await git(exec, cwd, ["status", "--porcelain"]);
  return status.split("\n").filter((line) => line.trim() && !line.slice(3).startsWith(".regulator/")).length === 0;
}

export function unitBranch(unitId: string): string {
  return `unit/${unitId}`;
}

export interface UnitWorktree {
  unitId: string;
  branch: string;
  path: string;
}

/** Create `unit/<id>` from `base` and check it out under `.regulator/worktrees/<id>`. */
export async function createUnitWorktree(exec: Exec, repo: string, unitId: string, base = "HEAD"): Promise<UnitWorktree> {
  const branch = unitBranch(unitId);
  const worktree = path.join(repo, WORKTREES_RELATIVE_DIR, unitId);
  await git(exec, repo, ["worktree", "add", "-b", branch, worktree, base]);
  return { unitId, branch, path: worktree };
}

export interface CheckpointResult {
  committed: boolean;
  sha?: string;
}

/** Commit everything in the worktree, or report that there was nothing to commit. */
export async function checkpoint(exec: Exec, worktree: string, message: string): Promise<CheckpointResult> {
  await git(exec, worktree, ["add", "-A"]);
  if (await isClean(exec, worktree)) return { committed: false };
  await git(exec, worktree, ["commit", "--quiet", "-m", message]);
  return { committed: true, sha: (await git(exec, worktree, ["rev-parse", "--short", "HEAD"])).trim() };
}

export type ReintegrationResult =
  | { merged: true; sha: string }
  | { merged: false; reason: "dirty-base" }
  | { merged: false; reason: "wrong-branch"; current: string }
  | { merged: false; reason: "conflict"; conflicts: string[] };

/**
 * Merge `branch` into `base` inside the main checkout. Refuses if the checkout
 * is dirty or not on `base`. On conflict, records the conflicting paths, aborts
 * the merge so the base is left exactly as found, and returns them as data.
 */
export async function reintegrate(exec: Exec, repo: string, branch: string, base: string): Promise<ReintegrationResult> {
  const current = await currentBranch(exec, repo);
  if (current !== base) return { merged: false, reason: "wrong-branch", current };
  if (!(await isClean(exec, repo))) return { merged: false, reason: "dirty-base" };
  const merge = await exec("git", ["merge", "--no-ff", "--no-edit", "-m", `Reintegrate ${branch}`, branch], { cwd: repo });
  if (merge.code === 0) return { merged: true, sha: (await git(exec, repo, ["rev-parse", "--short", "HEAD"])).trim() };
  const conflicts = (await git(exec, repo, ["diff", "--name-only", "--diff-filter=U"])).split("\n").map((l) => l.trim()).filter(Boolean);
  await git(exec, repo, ["merge", "--abort"]);
  return { merged: false, reason: "conflict", conflicts };
}

export async function removeUnitWorktree(exec: Exec, repo: string, unit: UnitWorktree, options: { deleteBranch: boolean }): Promise<void> {
  await git(exec, repo, ["worktree", "remove", "--force", unit.path]);
  if (options.deleteBranch) await git(exec, repo, ["branch", "-D", unit.branch]);
}
