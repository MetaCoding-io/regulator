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
import { WORKTREES_RELATIVE_DIR } from "@metacoding.io/regulator-core";
import type { Exec } from "./exec.js";

export { WORKTREES_RELATIVE_DIR } from "@metacoding.io/regulator-core";

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

/** The exact commit a checkout is at: what evidence binds to. */
export async function headRevision(exec: Exec, cwd: string): Promise<string> {
  return (await git(exec, cwd, ["rev-parse", "HEAD"])).trim();
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
  | { merged: false; reason: "conflict"; conflicts: string[] }
  /** The merge was clean and the merged tree failed the trial (#48): nothing landed; `sha` is the trial commit the evidence is bound to. */
  | { merged: false; reason: "trial-failed"; sha: string; reasons: string[] }
  /** The base moved between the trial and the landing: what was verified is not what would land, so nothing did. */
  | { merged: false; reason: "base-moved"; from: string; to: string };

/** What a pre-merge trial says about the merged tree, run in the trial worktree at the trial commit. */
export interface TrialVerdict {
  ok: boolean;
  reasons: string[];
}
export type Trial = (trial: { cwd: string; sha: string }) => Promise<TrialVerdict>;

/** Where a trial worktree lives while the trial runs; removed before `reintegrate` returns, whatever happened. */
export const TRIALS_RELATIVE_DIR = `${path.dirname(WORKTREES_RELATIVE_DIR)}/trials`;

/**
 * Merge `branch` into `base` inside the main checkout. Refuses if the checkout
 * is dirty or not on `base`. On conflict, records the conflicting paths, aborts
 * the merge so the base is left exactly as found, and returns them as data.
 */
export async function reintegrate(exec: Exec, repo: string, branch: string, base: string, options: { trial?: Trial } = {}): Promise<ReintegrationResult> {
  const current = await currentBranch(exec, repo);
  if (current !== base) return { merged: false, reason: "wrong-branch", current };
  if (!(await isClean(exec, repo))) return { merged: false, reason: "dirty-base" };
  if (!options.trial) {
    const merge = await exec("git", ["merge", "--no-ff", "--no-edit", "-m", `Reintegrate ${branch}`, branch], { cwd: repo });
    if (merge.code === 0) return { merged: true, sha: (await git(exec, repo, ["rev-parse", "--short", "HEAD"])).trim() };
    const conflicts = (await git(exec, repo, ["diff", "--name-only", "--diff-filter=U"])).split("\n").map((l) => l.trim()).filter(Boolean);
    await git(exec, repo, ["merge", "--abort"]);
    return { merged: false, reason: "conflict", conflicts };
  }
  // The pre-merge trial (#48): the merge is made first in a temporary worktree detached at the base's HEAD, the trial runs on
  // that merged tree, and only a tree that passed is landed — by fast-forward to the very commit that was verified, so what the
  // evidence is bound to is what the base carries. A failing trial leaves the base exactly as found: no red base, nothing to revert.
  const baseSha = (await git(exec, repo, ["rev-parse", "HEAD"])).trim();
  const trialDir = path.join(repo, TRIALS_RELATIVE_DIR, branch.replace(/[^A-Za-z0-9_.-]/g, "-"));
  await exec("git", ["worktree", "remove", "--force", trialDir], { cwd: repo });
  await git(exec, repo, ["worktree", "add", "--detach", trialDir, baseSha]);
  try {
    const merge = await exec("git", ["merge", "--no-ff", "--no-edit", "-m", `Reintegrate ${branch}`, branch], { cwd: trialDir });
    if (merge.code !== 0) {
      const conflicts = (await git(exec, trialDir, ["diff", "--name-only", "--diff-filter=U"])).split("\n").map((l) => l.trim()).filter(Boolean);
      await exec("git", ["merge", "--abort"], { cwd: trialDir });
      return { merged: false, reason: "conflict", conflicts };
    }
    const sha = (await git(exec, trialDir, ["rev-parse", "HEAD"])).trim();
    const verdict = await options.trial({ cwd: trialDir, sha });
    if (!verdict.ok) return { merged: false, reason: "trial-failed", sha, reasons: verdict.reasons };
    const landed = await exec("git", ["merge", "--ff-only", sha], { cwd: repo });
    if (landed.code !== 0) return { merged: false, reason: "base-moved", from: baseSha, to: (await git(exec, repo, ["rev-parse", "HEAD"])).trim() };
    return { merged: true, sha: sha.slice(0, 7) };
  } finally {
    await exec("git", ["worktree", "remove", "--force", trialDir], { cwd: repo });
  }
}

export async function removeUnitWorktree(exec: Exec, repo: string, unit: UnitWorktree, options: { deleteBranch: boolean }): Promise<void> {
  await git(exec, repo, ["worktree", "remove", "--force", unit.path]);
  if (options.deleteBranch) await git(exec, repo, ["branch", "-D", unit.branch]);
}
