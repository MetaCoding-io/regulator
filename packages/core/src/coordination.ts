/**
 * S2 mechanisms, Pi-free: leases with liveness, and the thrash detector (lesson 05).
 *
 * A lease is a claim on a resource — here, a worktree — with an owner, a unit,
 * and an expiry that must be renewed. Liveness is the part that makes it a
 * coordination mechanism rather than a lock file: a holder that stops
 * heartbeating loses the claim, so a dead worker cannot block a resource
 * forever. (GSD-Pi reclaims "leases held by verifiably-dead local workers";
 * this is the same idea with expiry standing in for a process check.)
 *
 * The thrash detector does not decide anything. It counts edits per file per
 * unit and emits a coordination signal past a threshold. S2 detects; S3
 * decides (lesson 08's recovery router).
 */
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { LeaseSchema, assertValid, type Lease } from "@metacoding/vsm-pi-protocol";

export type { Lease } from "@metacoding/vsm-pi-protocol";


export class LeaseHeldError extends Error {
  constructor(readonly holder: Lease) {
    super(`resource ${holder.resource} is leased by unit "${holder.unitId}" (owner ${holder.owner}) until ${new Date(holder.expiresAt).toISOString()}`);
    this.name = "LeaseHeldError";
  }
}

export interface AcquireOptions {
  unitId: string;
  owner: string;
  resource: string;
  branch: string;
  ttlMs: number;
}

export class LeaseStore {
  readonly dir: string;
  readonly #now: () => number;

  constructor(dir: string, now: () => number = Date.now) {
    this.dir = dir;
    this.#now = now;
  }

  isLive(lease: Lease): boolean {
    return lease.expiresAt > this.#now();
  }

  #file(unitId: string): string {
    if (!/^[a-zA-Z0-9._-]+$/.test(unitId)) throw new Error(`invalid unit id: ${JSON.stringify(unitId)}`);
    return path.join(this.dir, `${unitId}.json`);
  }

  async list(): Promise<Lease[]> {
    let files: string[];
    try {
      files = await readdir(this.dir);
    } catch {
      return [];
    }
    const leases: Lease[] = [];
    for (const file of files.filter((f) => f.endsWith(".json")).sort()) {
      const value: unknown = JSON.parse(await readFile(path.join(this.dir, file), "utf8"));
      assertValid(LeaseSchema, value, "lease");
      leases.push(value);
    }
    return leases;
  }

  async get(unitId: string): Promise<Lease | undefined> {
    try {
      const value: unknown = JSON.parse(await readFile(this.#file(unitId), "utf8"));
      assertValid(LeaseSchema, value, "lease");
      return value;
    } catch {
      return undefined;
    }
  }

  /**
   * Claim a resource. Refuses while another unit holds a *live* lease on it;
   * an expired lease is reclaimed. The same unit re-acquiring renews.
   */
  async acquire(options: AcquireOptions): Promise<Lease> {
    const now = this.#now();
    for (const other of await this.list()) {
      if (other.unitId === options.unitId) continue;
      if (other.resource === options.resource && this.isLive(other)) throw new LeaseHeldError(other);
    }
    const lease: Lease = {
      unitId: options.unitId,
      owner: options.owner,
      resource: options.resource,
      branch: options.branch,
      acquiredAt: now,
      heartbeatAt: now,
      expiresAt: now + options.ttlMs,
    };
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.#file(options.unitId), `${JSON.stringify(lease, null, 2)}\n`, "utf8");
    return lease;
  }

  /** Renew. A lease that already expired cannot be heartbeated back to life: re-acquire instead. */
  async heartbeat(unitId: string, ttlMs: number): Promise<Lease> {
    const lease = await this.get(unitId);
    if (!lease) throw new Error(`no lease for unit "${unitId}"`);
    if (!this.isLive(lease)) throw new Error(`lease for unit "${unitId}" expired at ${new Date(lease.expiresAt).toISOString()}; re-acquire it`);
    const now = this.#now();
    const renewed: Lease = { ...lease, heartbeatAt: now, expiresAt: now + ttlMs };
    await writeFile(this.#file(unitId), `${JSON.stringify(renewed, null, 2)}\n`, "utf8");
    return renewed;
  }

  async release(unitId: string): Promise<boolean> {
    const existed = (await this.get(unitId)) !== undefined;
    await rm(this.#file(unitId), { force: true });
    return existed;
  }
}

export interface ThrashSignal {
  subject: "oscillation";
  unitId: string;
  path: string;
  edits: number;
  threshold: number;
  at: number;
}

export interface ThrashDetectorOptions {
  unitId: string;
  /** Edits to one file, within one unit, before a signal is raised. */
  threshold?: number;
  now?: () => number;
}

/** Counts write/edit calls per file per unit and raises a signal at each threshold multiple. */
export class ThrashDetector {
  readonly unitId: string;
  readonly threshold: number;
  readonly #counts = new Map<string, number>();
  readonly #now: () => number;

  constructor(options: ThrashDetectorOptions) {
    this.unitId = options.unitId;
    this.threshold = options.threshold ?? 4;
    this.#now = options.now ?? Date.now;
    if (this.threshold < 2) throw new Error("threshold must be at least 2: one edit is work, not oscillation");
  }

  record(filePath: string): ThrashSignal | undefined {
    const edits = (this.#counts.get(filePath) ?? 0) + 1;
    this.#counts.set(filePath, edits);
    if (edits % this.threshold !== 0) return undefined;
    return { subject: "oscillation", unitId: this.unitId, path: filePath, edits, threshold: this.threshold, at: this.#now() };
  }

  counts(): Record<string, number> {
    return Object.fromEntries(this.#counts);
  }
}
