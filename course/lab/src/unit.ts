/**
 * The unit lifecycle the harness drives around a Pi session, Pi-free:
 *
 *   start   claim a lease, create an isolated worktree and branch
 *   finish  reintegrate the branch, release the lease — or surface a conflict
 *
 * Lesson 06's orchestrator dispatches units through exactly these two steps.
 */
import { randomUUID } from "node:crypto";
import { cp, realpath } from "node:fs/promises";
import path from "node:path";
import type { CoordinationSignal } from "@metacoding/vsm-pi-protocol";
import { LEASES_RELATIVE_DIR, SIGNALS_RELATIVE_PATH, WORKTREES_RELATIVE_DIR, appendSignal } from "@metacoding/vsm-pi-core";
import { LeaseHeldError, LeaseStore, type Lease } from "./coordination.js";
import type { Exec } from "./exec.js";
import {
  baseRoot, createUnitWorktree, currentBranch, reintegrate, removeUnitWorktree, unitBranch,
  type ReintegrationResult, type UnitWorktree,
} from "./worktree.js";

export { LEASES_RELATIVE_DIR, SIGNALS_RELATIVE_PATH, appendSignal } from "@metacoding/vsm-pi-core";
export const DEFAULT_LEASE_TTL_MS = 10 * 60 * 1000;

export function leaseStoreFor(repo: string, now?: () => number): LeaseStore {
  return new LeaseStore(path.join(repo, LEASES_RELATIVE_DIR), now);
}

async function assertBaseCheckout(exec: Exec, repo: string): Promise<string> {
  const here = await realpath(repo);
  const base = await realpath(await baseRoot(exec, here));
  if (here !== base) throw new Error(`run this in the base checkout (${base}), not in a worktree`);
  return here;
}

export interface StartUnitOptions {
  repo: string;
  unitId: string;
  owner: string;
  ttlMs?: number;
  now?: () => number;
}

export interface StartedUnit {
  worktree: UnitWorktree;
  lease: Lease;
  base: string;
}

/** Claim the lease first — if it is held, no worktree is created. */
export async function startUnit(exec: Exec, options: StartUnitOptions): Promise<StartedUnit> {
  const repo = await assertBaseCheckout(exec, options.repo);
  const base = await currentBranch(exec, repo);
  const store = leaseStoreFor(repo, options.now);
  const resource = path.join(repo, WORKTREES_RELATIVE_DIR, options.unitId);
  // A start is a claim, not a renewal: a unit that is already live cannot be started again.
  const existing = await store.get(options.unitId);
  if (existing && store.isLive(existing)) throw new LeaseHeldError(existing);
  const lease = await store.acquire({
    unitId: options.unitId, owner: options.owner, resource, branch: unitBranch(options.unitId), ttlMs: options.ttlMs ?? DEFAULT_LEASE_TTL_MS,
  });
  try {
    const worktree = await createUnitWorktree(exec, repo, options.unitId, base);
    return { worktree, lease, base };
  } catch (error) {
    await store.release(options.unitId);
    throw error;
  }
}

export interface FinishUnitOptions {
  repo: string;
  unitId: string;
  now?: () => number;
}

export interface FinishedUnit {
  result: ReintegrationResult;
  released: boolean;
  signal?: CoordinationSignal;
}

/**
 * Merge the unit's branch into the current base branch. On success the lease,
 * worktree and branch go away. On conflict nothing is resolved: a coordination
 * signal is recorded for S3 and the unit keeps its lease and worktree.
 */
export async function finishUnit(exec: Exec, options: FinishUnitOptions): Promise<FinishedUnit> {
  const repo = await assertBaseCheckout(exec, options.repo);
  const store = leaseStoreFor(repo, options.now);
  const branch = unitBranch(options.unitId);
  const base = await currentBranch(exec, repo);
  const result = await reintegrate(exec, repo, branch, base);
  if (result.merged) {
    const worktree: UnitWorktree = { unitId: options.unitId, branch, path: path.join(repo, WORKTREES_RELATIVE_DIR, options.unitId) };
    await removeUnitWorktree(exec, repo, worktree, { deleteBranch: true });
    return { result, released: await store.release(options.unitId) };
  }
  if (result.reason !== "conflict") return { result, released: false };
  const signal: CoordinationSignal = {
    id: randomUUID(),
    timestamp: new Date((options.now ?? Date.now)()).toISOString(),
    source: "S2",
    kind: "coordination-signal",
    channel: "signal",
    destination: "S3",
    severity: "blocking",
    subject: branch,
    unit: options.unitId,
    coordination: "conflict",
    observation: `Reintegrating ${branch} into ${base} conflicts in ${result.conflicts.join(", ")}; the merge was aborted and nothing was resolved.`,
    evidence: result.conflicts.map((ref) => ({ class: "file" as const, ref })),
    resource: base,
  };
  await appendSignal(repo, signal);
  return { result, released: false, signal };
}

export interface UnitStatus {
  lease: Lease;
  live: boolean;
}

export async function unitStatus(exec: Exec, repo: string, now?: () => number): Promise<UnitStatus[]> {
  const base = await assertBaseCheckout(exec, repo);
  const store = leaseStoreFor(base, now);
  return (await store.list()).map((lease) => ({ lease, live: store.isLive(lease) }));
}

/** Copy a fixture project to `dest` and make it its own git repository with one commit. */
export async function initFixture(exec: Exec, source: string, dest: string): Promise<string> {
  await cp(source, dest, { recursive: true, errorOnExist: true, force: false });
  const run = async (args: string[]) => {
    const r = await exec("git", args, { cwd: dest });
    if (r.code !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr.trim()}`);
  };
  await run(["init", "--quiet", "-b", "main"]);
  await run(["add", "-A"]);
  await run(["-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "fixture"]);
  return dest;
}
