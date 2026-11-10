import assert from "node:assert/strict";
import test from "node:test";
import { UnitStatusSchema, isUnitRecord, readUnitRecord, unitReason, type ReasonedUnitStatus, type UnitRecord, type UnitRecordIn, type UnitStatus } from "./execution.js";

const base = { unitId: "u1", unitType: "implement", workload: { name: "software-development", version: 1 }, contract: { id: "tc-1", version: 1 }, attempts: 1, createdAt: "t", updatedAt: "t" };

test("UnitRecordSchema is one object per status: a reason is required on blocked and refused everywhere else (#161)", () => {
  const statuses = UnitStatusSchema.anyOf.map((s) => s.const);
  assert.deepEqual(statuses, ["contracted", "dispatched", "reported", "closed", "blocked", "aborted"]);
  for (const status of statuses) {
    assert.equal(isUnitRecord({ ...base, status }), status !== "blocked", `${status} without a reason`);
    assert.equal(isUnitRecord({ ...base, status, reason: "why" }), status === "blocked", `${status} with a reason`);
    assert.equal(isUnitRecord({ ...base, status, reason: "" }), false, `${status} with an empty reason`);
  }
  assert.equal(isUnitRecord({ ...base, status: "paused" }), false);
  assert.equal(isUnitRecord({ ...base, status: "closed", extra: 1 }), false);
});

test("the type says what the schema says: only a blocked record has a reason, and it is a string", () => {
  const blocked: UnitRecord = { ...base, status: "blocked", reason: "the lease is held" };
  const closed: UnitRecord = { ...base, status: "closed" };
  // @ts-expect-error a closed unit with a reason is not a unit record.
  const closedWithReason: UnitRecord = { ...base, status: "closed", reason: "why" };
  // @ts-expect-error a blocked unit without a reason is not a unit record.
  const blockedWithout: UnitRecord = { ...base, status: "blocked" };
  assert.equal(isUnitRecord(closedWithReason), false);
  assert.equal(isUnitRecord(blockedWithout), false);
  // Every status has a record, and blocked is the one that carries a reason: a status added to the union without its record fails here.
  const everyStatus: UnitRecord["status"] = "contracted" as UnitStatus;
  const reasoned: ReasonedUnitStatus = "blocked";
  // @ts-expect-error no other status is reasoned.
  const notReasoned: ReasonedUnitStatus = "aborted";
  const narrowed: UnitRecordIn<"blocked"> | undefined = blocked.status === "blocked" ? blocked : undefined;
  assert.equal(narrowed?.reason, "the lease is held");
  assert.equal(unitReason(blocked), "the lease is held");
  assert.equal(unitReason(closed), undefined);
  assert.ok(everyStatus && reasoned && notReasoned);
});

test("readUnitRecord reads the one older shape, a reason beside a status that carries none, and nothing else that is not a record", () => {
  assert.deepEqual(readUnitRecord({ ...base, status: "closed" }), { record: { ...base, status: "closed" } });
  assert.deepEqual(readUnitRecord({ ...base, status: "blocked", reason: "why" }), { record: { ...base, status: "blocked", reason: "why" } });
  assert.deepEqual(readUnitRecord({ ...base, status: "aborted", reason: "aborted under recovery v3: no-report" }), { record: { ...base, status: "aborted" }, legacyReason: "aborted under recovery v3: no-report" });
  assert.equal(readUnitRecord({ ...base, status: "blocked" }), undefined, "a blocked unit with no reason is not repaired");
  assert.equal(readUnitRecord({ ...base, status: "aborted", reason: "why", extra: 1 }), undefined);
  assert.equal(readUnitRecord({ ...base, status: "nowhere", reason: "why" }), undefined);
  assert.equal(readUnitRecord("unit"), undefined);
});
