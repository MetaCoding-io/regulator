import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { IntelligenceSignal } from "@metacoding.io/regulator-protocol";
import { globToRegExp, isCurrentSensorSignal, matchesGlob, sensorSignals } from "./sensors.js";
import { ObligationLedger } from "./obligations.js";
import { appendSignal } from "./signals.js";

test("the glob matcher (#123): `*` and `?` within a segment, `**` across them, `{a,b}` as an alternation; everything else literal; an unbalanced brace is refused", () => {
  assert.ok(matchesGlob("prices/*", "prices/2026-10-15.csv"));
  assert.ok(!matchesGlob("prices/*", "prices/sub/2026-10-15.csv"), "`*` stays inside a segment");
  assert.ok(matchesGlob("prices/**", "prices/sub/2026-10-15.csv"));
  assert.ok(matchesGlob("**/*.csv", "prices/2026-10-15.csv"));
  assert.ok(matchesGlob("**/*.csv", "2026-10-15.csv"), "`**/` matches zero segments too");
  assert.ok(matchesGlob("{positions,prices}/*", "positions/2026-10-15.json"));
  assert.ok(matchesGlob("{positions,prices}/*", "prices/2026-10-15.csv"));
  assert.ok(!matchesGlob("{positions,prices}/*", "targets/2026-10-15.json"));
  assert.ok(matchesGlob("positions/????-??-??.csv", "positions/2026-10-15.csv"));
  assert.ok(!matchesGlob("positions/????-??-??.csv", "positions/2026-10-15.json"));
  assert.ok(matchesGlob("a.b/*", "a.b/x"), "a dot is literal");
  assert.ok(!matchesGlob("a.b/*", "aXb/x"));
  assert.ok(matchesGlob("prices/*", "prices\\2026-10-15.csv"), "a Windows separator is read as `/`");
  assert.throws(() => globToRegExp("{a,b"), /unmatched "\{"/);
  assert.throws(() => globToRegExp("a}"), /unmatched "\}"/);
});

const signal = (id: string, over: Partial<IntelligenceSignal> = {}): IntelligenceSignal =>
  ({ id, timestamp: "t", kind: "intelligence-signal", channel: "intelligence", source: "S4", destination: "S3", severity: "blocking", subject: `s ${id}`, observation: "o", evidence: [], claim: "the band is crossed", provenance: "sensor:drift", ...over });

test("sensor signals are folded with what became of them, and one is current while it is unrouted, holds an open obligation, or has not expired", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-sensor-signals-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const now = Date.parse("2026-10-15T12:00:00.000Z");
  const ledger = new ObligationLedger(dir, () => now);
  await appendSignal(dir, signal("i1", { expiresAt: "2026-10-15T11:00:00.000Z" }));
  await appendSignal(dir, signal("i2", { expiresAt: "2026-10-16T00:00:00.000Z" }));
  await appendSignal(dir, signal("i3", { expiresAt: "2026-10-15T11:00:00.000Z" }));
  const { provenance: _p, ...research } = signal("r1", { unit: "r1" });
  await appendSignal(dir, research);
  await appendSignal(dir, signal("h1", { provenance: "sensor:harvest", claim: "a lot is worth harvesting" }));
  const o1 = await ledger.openObligation({ subject: "s i1", unitType: "plan", concern: "intelligence-signal", sources: ["i1"], severity: "blocking", consumer: "S3", blocks: true });
  const o2 = await ledger.openObligation({ subject: "s i2", unitType: "plan", concern: "intelligence-signal", sources: ["i2"], severity: "blocking", consumer: "S3", blocks: true });
  await ledger.resolve(o2.id, { by: "alice", disposition: "replan", rationale: "plan it" });
  await ledger.note("i3", "S3", "below the line");
  const all = sensorSignals(await ledger.entries());
  assert.deepEqual(all.map((e) => [e.signal.id, e.obligations.map((o) => o.status), e.unrouted]), [["i1", ["open"], false], ["i2", ["resolved"], false], ["i3", [], false], ["h1", [], true]], "a research unit's signal (r1) is not a sensor's");
  assert.deepEqual(sensorSignals(await ledger.entries(), "sensor:harvest").map((e) => e.signal.id), ["h1"]);
  assert.deepEqual(all.map((e) => isCurrentSensorSignal(e, now)), [true, true, false, true], "i1: expired but held open; i2: resolved but not yet expired; i3: expired and noted; h1: unrouted");
  assert.equal(isCurrentSensorSignal(all[1]!, Date.parse("2026-10-17T00:00:00.000Z")), false, "i2 stops being current when it expires");
  assert.equal(o1.unitType, "plan");
});
