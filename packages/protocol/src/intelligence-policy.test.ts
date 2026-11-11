import assert from "node:assert/strict";
import test from "node:test";
import { Value } from "typebox/value";
import { IntelligencePolicySchema, SensorOutputSchema, affectedUnitType, affectsUnitType, isIntelligencePolicy, isSensorOutput, isSensorProvenance } from "./index.js";

const sensor = {
  name: "drift-band", description: "d", provenance: "sensor:drift-band", affects: ["plan-rebalance"], severity: "blocking", expiresAfterMs: 60_000,
  schedule: { everyMs: 1000 }, program: { argv: ["node", "workload/portfolio/sensors/drift-band.mjs"], outputs: [] },
};
const policy = { name: "intelligence", version: 1, description: "d", programTimeoutMs: 1000, sensors: [sensor] };

test("the intelligence policy (#123): a closed schema over sensors — name, provenance, the unit types affected, a severity, an expiry, a schedule with a program or a glob", () => {
  assert.ok(isIntelligencePolicy(policy));
  assert.ok(isIntelligencePolicy({ ...policy, sensors: [{ name: "new-export", description: "d", provenance: "sensor:new-export", affects: ["ingest-positions"], severity: "advisory", expiresAfterMs: 60_000, glob: "{positions,prices}/*" }] }));
  assert.ok(isIntelligencePolicy({ ...policy, sensors: [] }), "a policy with no sensors is a valid declaration that watches nothing");
  for (const [why, bad] of Object.entries({
    "an unknown field": { ...policy, cron: "* * * * *" },
    "a provenance without the sensor: prefix": { ...policy, sensors: [{ ...sensor, provenance: "drift-band" }] },
    "no provenance": { ...policy, sensors: [{ ...sensor, provenance: undefined }] },
    "no affected unit type": { ...policy, sensors: [{ ...sensor, affects: [] }] },
    "an interval below a second": { ...policy, sensors: [{ ...sensor, schedule: { everyMs: 10 } }] },
    "an expiry below a minute": { ...policy, sensors: [{ ...sensor, expiresAfterMs: 1000 }] },
    "no severity": { ...policy, sensors: [{ ...sensor, severity: undefined }] },
    "no program timeout ceiling": { ...policy, programTimeoutMs: undefined },
    "a program with no argv": { ...policy, sensors: [{ ...sensor, program: { argv: [], outputs: [] } }] },
  })) assert.equal(isIntelligencePolicy(bad), false, why);
  // The shape alone admits a sensor with both triggers or neither, or with outputs: the definition check refuses those by name.
  assert.ok(Value.Check(IntelligencePolicySchema, { ...policy, sensors: [{ ...sensor, glob: "x/*" }] }));
});

test("a sensor's output: fires with a claim, an observation and evidence, or does not; the severity, the confidence and the expiry are optional; anything else is not a report", () => {
  assert.ok(isSensorOutput({ fires: false }));
  assert.ok(isSensorOutput({ fires: false, observation: "VTI 1.2% from its target, inside the band" }));
  assert.ok(isSensorOutput({ fires: true, claim: "c", observation: "o", evidence: [{ class: "file", ref: "prices/2026-10-15.csv" }], severity: "advisory", confidence: "high", expiresAt: "2026-11-15T00:00:00.000Z" }));
  assert.ok(isSensorOutput({ fires: true, claim: "c", observation: "o", evidence: [] }));
  for (const bad of [{ fires: true }, { fires: true, claim: "c", observation: "o" }, { fires: "yes" }, { fires: true, claim: "c", observation: "o", evidence: [], affectedUnits: ["u1"] }, "fires", null]) assert.equal(Value.Check(SensorOutputSchema, bad), false, JSON.stringify(bad));
});

test("affectedUnits entries: `type:<unitType>` holds a unit type; anything else is a unit id", () => {
  assert.equal(affectsUnitType("plan-rebalance"), "type:plan-rebalance");
  assert.equal(affectedUnitType("type:plan-rebalance"), "plan-rebalance");
  assert.equal(affectedUnitType("p3-plan-rebalance"), undefined);
  assert.equal(affectedUnitType("type:"), undefined, "an empty type names nothing");
  assert.equal(isSensorProvenance("sensor:drift-band"), true);
  assert.equal(isSensorProvenance("human:alice"), false);
  assert.equal(isSensorProvenance(undefined), false);
});
