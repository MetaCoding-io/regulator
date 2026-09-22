import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { LeaseHeldError, LeaseStore, ThrashDetector } from "./coordination.js";

test("leases: a live lease excludes other units; expiry lets the resource be reclaimed; heartbeat extends; release clears", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-leases-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let clock = 1_000_000;
  const store = new LeaseStore(dir, () => clock);
  const a = await store.acquire({ unitId: "u1", owner: "alice", resource: "/work/u1", branch: "unit/u1", ttlMs: 1000 });
  assert.equal(a.expiresAt, 1_001_000);
  await assert.rejects(store.acquire({ unitId: "u2", owner: "bob", resource: "/work/u1", branch: "unit/u2", ttlMs: 1000 }), LeaseHeldError);
  // A different resource is not contended.
  await store.acquire({ unitId: "u2", owner: "bob", resource: "/work/u2", branch: "unit/u2", ttlMs: 1000 });
  // The same unit re-acquiring renews rather than conflicting with itself.
  await store.acquire({ unitId: "u1", owner: "alice", resource: "/work/u1", branch: "unit/u1", ttlMs: 1000 });
  clock = 1_000_500;
  const renewed = await store.heartbeat("u1", 1000);
  assert.equal(renewed.expiresAt, 1_001_500);
  clock = 1_002_000;
  assert.equal(store.isLive(renewed), false);
  await assert.rejects(store.heartbeat("u1", 1000), /expired/, "a dead lease is not revived by a late heartbeat");
  // Expired: another unit may reclaim the resource.
  const reclaimed = await store.acquire({ unitId: "u3", owner: "carol", resource: "/work/u1", branch: "unit/u3", ttlMs: 1000 });
  assert.equal(reclaimed.unitId, "u3");
  assert.equal(await store.release("u3"), true);
  assert.equal(await store.release("u3"), false);
  assert.deepEqual((await store.list()).map((l) => l.unitId), ["u1", "u2"]);
  await assert.rejects(store.acquire({ unitId: "../evil", owner: "x", resource: "/r", branch: "b", ttlMs: 1 }), /invalid unit id/);
});

test("thrash detector: signals at each threshold multiple, per file, never below", () => {
  const detector = new ThrashDetector({ unitId: "u1", threshold: 3, now: () => 42 });
  assert.equal(detector.record("src/a.js"), undefined);
  assert.equal(detector.record("src/a.js"), undefined);
  assert.equal(detector.record("src/b.js"), undefined, "a different file has its own count");
  const first = detector.record("src/a.js");
  assert.deepEqual(first, { subject: "oscillation", unitId: "u1", path: "src/a.js", edits: 3, threshold: 3, at: 42 });
  assert.equal(detector.record("src/a.js"), undefined);
  assert.equal(detector.record("src/a.js"), undefined);
  assert.equal(detector.record("src/a.js")?.edits, 6, "the signal recurs so it stays visible");
  assert.deepEqual(detector.counts(), { "src/a.js": 6, "src/b.js": 1 });
  assert.throws(() => new ThrashDetector({ unitId: "u", threshold: 1 }), /at least 2/);
});
