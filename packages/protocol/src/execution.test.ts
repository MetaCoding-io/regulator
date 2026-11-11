import assert from "node:assert/strict";
import test from "node:test";
import {
  UNIT_TRANSITIONS, UNIT_TRIGGERS, UnitStatusSchema, isUnitRecord, isUnitTransitionRecord, readUnitRecord, unitReason, unitTransition,
  type ReasonedUnitStatus, type TargetOf, type TriggerFrom, type TriggerFromEvery, type UnitRecord, type UnitRecordIn, type UnitStatus, type UnitTransitionRecord, type UnitTrigger,
} from "./execution.js";

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

test("UNIT_TRANSITIONS is a type the compiler holds: TriggerFrom names the triggers legal from a status, and an illegal pair does not compile (#162)", () => {
  // Legal from each status, as the table declares.
  const fromContracted: TriggerFrom<"contracted">[] = ["dispatch", "dispatch-refused"];
  const fromDispatched: TriggerFrom<"dispatched">[] = ["attempt-failed", "verified"];
  const fromReported: TriggerFrom<"reported">[] = ["reintegrated", "reintegration-refused"];
  const fromBlocked: TriggerFrom<"blocked">[] = ["dispatch", "dispatch-refused", "re-verified", "re-audit-refused", "routed-waiting", "abort"];
  // @ts-expect-error contracted → closed is no row: `reintegrated` is not a trigger from contracted.
  const illegal: TriggerFrom<"contracted"> = "reintegrated";
  // @ts-expect-error a unit that is dispatched cannot be dispatched.
  const twice: TriggerFrom<"dispatched"> = "dispatch";
  // @ts-expect-error nothing leaves a terminal status: the type is `never`.
  const afterClose: TriggerFrom<"closed"> = "dispatch";
  // @ts-expect-error nor aborted.
  const afterAbort: TriggerFrom<"aborted"> = "abort";

  // The runtime table agrees with the type, status by status.
  const declared = (from: UnitStatus) => UNIT_TRANSITIONS.filter((t) => t.from === from).map((t) => t.on).sort();
  assert.deepEqual(declared("contracted"), [...fromContracted].sort());
  assert.deepEqual(declared("dispatched"), [...fromDispatched].sort());
  assert.deepEqual(declared("reported"), [...fromReported].sort());
  assert.deepEqual(declared("blocked"), [...fromBlocked].sort());
  assert.deepEqual([declared("closed"), declared("aborted")], [[], []]);
  for (const [from, on] of [["contracted", illegal], ["dispatched", twice], ["closed", afterClose], ["aborted", afterAbort]] as Array<[UnitStatus, UnitTrigger]>) assert.equal(unitTransition(from, on), undefined, `${from}/${on}`);

  // The target is looked up, in the type as in the table.
  const target: TargetOf<"dispatched", "verified"> = "reported";
  // @ts-expect-error verified leads to reported, not closed.
  const wrongTarget: TargetOf<"dispatched", "verified"> = "closed";
  assert.equal(unitTransition("dispatched", "verified")?.to, target);
  assert.notEqual(unitTransition("dispatched", "verified")?.to, wrongTarget);

  // What a writer may name when it knows only that the unit is one of several statuses: what is declared from all of them.
  const both: TriggerFromEvery<"contracted" | "blocked">[] = ["dispatch", "dispatch-refused"];
  // @ts-expect-error abort is declared from blocked and not from contracted.
  const notBoth: TriggerFromEvery<"contracted" | "blocked"> = "abort";
  // @ts-expect-error nothing is declared from every status, so an un-narrowed status names nothing.
  const fromAnywhere: TriggerFromEvery<UnitStatus> = "dispatch";
  assert.ok(both.length === 2 && notBoth && fromAnywhere);

  // Every trigger is a row and every (from, on) pair is one row: the lookup the store makes is a function.
  assert.deepEqual([...new Set(UNIT_TRANSITIONS.map((t) => t.on))].sort(), [...UNIT_TRIGGERS].sort());
  assert.equal(new Set(UNIT_TRANSITIONS.map((t) => `${t.from}/${t.on}`)).size, UNIT_TRANSITIONS.length);
  assert.equal(UNIT_TRANSITIONS.length, 12);
});

test("a line of the status history is a row of the table with its time, and the reason exactly where the target is blocked (#162)", () => {
  const moved: UnitTransitionRecord = { from: "contracted", to: "dispatched", on: "dispatch", at: "t" };
  const blocked: UnitTransitionRecord = { from: "dispatched", to: "blocked", on: "attempt-failed", at: "t", reason: "the unit ended without calling report_result" };
  // @ts-expect-error a line into blocked carries the reason.
  const noReason: UnitTransitionRecord = { from: "dispatched", to: "blocked", on: "attempt-failed", at: "t" };
  // @ts-expect-error the triple is a row of the table: contracted → closed on reintegrated is not one.
  const noRow: UnitTransitionRecord = { from: "contracted", to: "closed", on: "reintegrated", at: "t" };
  assert.ok(isUnitTransitionRecord(moved) && isUnitTransitionRecord(blocked));
  assert.equal(isUnitTransitionRecord(noReason), false);
  assert.equal(isUnitTransitionRecord(noRow), false);
  assert.equal(isUnitTransitionRecord({ ...moved, reason: "why" }), false, "a reason beside a target that is not blocked");
  assert.equal(isUnitTransitionRecord({ ...moved, to: "reported" }), false, "the target is the row's, not the writer's");
  assert.equal(isUnitTransitionRecord({ from: "contracted", to: "dispatched", on: "dispatch" }), false, "when it was written is part of the line");
  // One schema member per row: every row, with a time and its reason, validates, and nothing else was tried above.
  for (const row of UNIT_TRANSITIONS) assert.ok(isUnitTransitionRecord({ from: row.from, to: row.to, on: row.on, at: "t", ...(row.to === "blocked" ? { reason: "r" } : {}) }), `${row.from}/${row.on}`);
});
