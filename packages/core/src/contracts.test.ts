import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { isUnitRecord, unitReason, type ResultReport, type UnitStatus, type WorkContract } from "@metacoding.io/regulator-protocol";
import { checkContract, checkResultReport, renderContractSection } from "./contracts.js";
import { ExecutionStore } from "./execution-store.js";

export function sampleContract(overrides: Partial<WorkContract> = {}): WorkContract {
  return {
    kind: "task",
    id: "tc-1",
    version: 1,
    unitId: "u1",
    unitType: "implement",
    workload: { name: "software-development", version: 1 },
    objective: "Fix the known issue in slugify",
    constraintRefs: ["INV-001"],
    fixed: [{ id: "f1", subject: "public signature", decision: "slugify(input) stays a single-argument function", authorityRef: "S3 planning" }],
    delegated: [{ id: "d1", subject: "helper decomposition", bounds: "private helpers inside src/slugify.js only" }],
    unresolved: [{ id: "u-underscore", subject: "underscore semantics", reason: "nobody has decided", handling: "stub-boundary" }],
    expectedEvidence: [{ id: "e1", description: "the test suite passes", class: "test", required: true }],
    provenance: { createdBy: "S3", createdAt: "2026-09-22T00:00:00.000Z" },
    ...overrides,
  };
}

export function sampleReport(overrides: Partial<ResultReport> = {}): ResultReport {
  return {
    contractId: "tc-1",
    contractVersion: 1,
    unitId: "u1",
    attempt: 1,
    reportedAt: "2026-09-22T00:10:00.000Z",
    summary: "Fixed the double-dash collapse; tests pass.",
    evidence: [{ class: "test", ref: "node --test", observation: "4 pass" }],
    delegatedResults: [{ decisionId: "d1", choice: "one private collapseSeparators helper" }],
    unresolvedOutcomes: [{ decisionId: "u-underscore", outcome: "preserved", note: "left underscore handling untouched; both tests still describe different behaviour" }],
    emergentDecisions: [],
    deviations: [],
    residualUncertainty: [],
    ...overrides,
  };
}

test("checkContract: colliding ids and resolve-before-execution refuse dispatch; a sound contract passes", () => {
  assert.deepEqual(checkContract(sampleContract()), []);
  const colliding = checkContract(sampleContract({ delegated: [{ id: "f1", subject: "x", bounds: "y" }] }));
  assert.match(colliding[0]!.message, /decision id "f1" is also used in fixed\[0\]/);
  const blocked = checkContract(sampleContract({ unresolved: [{ id: "u2", subject: "storage engine", reason: "open", handling: "resolve-before-execution" }] }));
  assert.match(blocked[0]!.message, /must be resolved before execution/);
  const badPredecessor = checkContract(sampleContract({ version: 1, provenance: { createdBy: "S3", createdAt: "t", predecessor: { version: 1, reason: "replan" } } }));
  assert.match(badPredecessor[0]!.message, /earlier version/);
  assert.throws(() => checkContract({ ...sampleContract(), authority: "S5" } as unknown as WorkContract), /work contract/);
});

test("checkResultReport: an unresolved decision cannot be closed silently; delegated choices must be reported; required evidence must be present", () => {
  const contract = sampleContract();
  assert.deepEqual(checkResultReport(contract, sampleReport()), []);

  const silent = checkResultReport(contract, sampleReport({ unresolvedOutcomes: [] }));
  assert.equal(silent.length, 1);
  assert.match(silent[0]!.message, /"u-underscore".*settled silently or forgotten/);

  const unreported = checkResultReport(contract, sampleReport({ delegatedResults: [] }));
  assert.match(unreported[0]!.message, /delegated decision "d1".*no reported choice/);

  const invented = checkResultReport(contract, sampleReport({ delegatedResults: [{ decisionId: "d1", choice: "x" }, { decisionId: "d9", choice: "y" }] }));
  assert.match(invented[0]!.message, /"d9" is not a delegated decision/);

  const noEvidence = checkResultReport(contract, sampleReport({ evidence: [{ class: "model", ref: "I am confident" }] }));
  assert.match(noEvidence[0]!.message, /required evidence "e1" \(test/);

  const wrongVersion = checkResultReport(contract, sampleReport({ contractVersion: 2 }));
  assert.match(wrongVersion[0]!.message, /report is for tc-1 v2, not tc-1 v1/);

  const danglingDeviation = checkResultReport(contract, sampleReport({ deviations: [{ kind: "fixed-decision", description: "changed the signature" }] }));
  assert.match(danglingDeviation[0]!.message, /must reference the fixed decision/);
  assert.deepEqual(checkResultReport(contract, sampleReport({ deviations: [{ kind: "fixed-decision", ref: "f1", description: "changed the signature" }] })), [], "a referenced deviation is reported, not refused: S3 decides what it means");
});

test("renderContractSection lists the three allocations and the closing obligation", () => {
  const text = renderContractSection(sampleContract());
  assert.match(text, /FIXED[\s\S]*f1: public signature/);
  assert.match(text, /DELEGATED[\s\S]*d1: helper decomposition — bounds:/);
  assert.match(text, /UNRESOLVED[\s\S]*u-underscore: underscore semantics/);
  assert.match(text, /call report_result exactly once/);
});

test("execution store: contract and report versions are immutable; attempts append; status is the only mutable field", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "regulator-exec-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  let clock = 1_000;
  const store = new ExecutionStore(root, () => clock);
  const contract = sampleContract();
  const unit = await store.createUnit(contract);
  assert.equal(unit.status, "contracted");
  assert.equal(unit.attempts, 0);
  await assert.rejects(store.createUnit(contract), /already exists/);
  assert.deepEqual(await store.currentContract("u1"), contract);
  assert.equal(await store.getUnit("nope"), undefined);
  await assert.rejects(store.getUnit("../evil"), /invalid unit id/);

  clock = 2_000;
  await store.setStatus("u1", "dispatched");
  const attempt = await store.recordAttempt({ unitId: "u1", contractVersion: 1, startedAt: "a", endedAt: "b", outcome: "reported", sessionId: "s1" });
  assert.equal(attempt.attempt, 1);
  assert.equal((await store.getUnit("u1"))?.attempts, 1);
  assert.deepEqual(await store.listAttempts("u1"), [attempt]);

  await store.writeReport(sampleReport());
  await assert.rejects(store.writeReport(sampleReport({ summary: "a second opinion" })), /EEXIST/, "one report per contract version and attempt");
  assert.equal((await store.getReport("u1", 1))?.summary, sampleReport().summary);
  await store.writeReport(sampleReport({ attempt: 2, summary: "the second attempt's report" }));
  assert.equal((await store.getReport("u1", 1))?.summary, "the second attempt's report", "no attempt named: the latest");
  assert.equal((await store.getReport("u1", 1, 1))?.summary, sampleReport().summary);
  assert.equal(await store.getReport("u1", 2), undefined);

  await store.setStatus("u1", "reported");
  const blocked = await store.setStatus("u1", "blocked", "reintegration: conflict");
  assert.equal(blocked.reason, "reintegration: conflict");
  // The lifecycle is a closed table: a status the loop never writes from here is refused by name, and the record is untouched.
  await assert.rejects(store.setStatus("u1", "closed"), /unit "u1" is blocked; blocked → closed is not a transition the loop declares \(UNIT_TRANSITIONS\); from blocked it declares dispatched, blocked, reported, aborted/);
  await assert.rejects(store.setStatus("u1", "contracted"), /blocked → contracted is not a transition/);
  assert.equal(unitReason((await store.getUnit("u1"))!), "reintegration: conflict", "a refused change writes nothing");
  await store.setStatus("u1", "reported");
  const closed = await store.setStatus("u1", "closed");
  assert.equal("reason" in closed, false, "a reason does not outlive the status it explained");
  assert.equal(unitReason(closed), undefined);
  assert.deepEqual((await store.listUnits()).map((u) => [u.unitId, u.status]), [["u1", "closed"]]);
  await assert.rejects(store.setStatus("u1", "dispatched"), /from closed it declares nothing: the status is terminal/);

  const onDisk = JSON.parse(await readFile(path.join(root, ".regulator", "units", "u1", "contract.v1.json"), "utf8"));
  assert.deepEqual(onDisk, contract);
});

test("the unit record is keyed on its status: a reason is written with blocked and with nothing else, by the signature and by the store (#161)", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "regulator-keyed-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new ExecutionStore(root, () => 1_000);
  await store.createUnit(sampleContract());

  // By the signature: the reason is a required argument of blocked and no argument of any other status.
  // @ts-expect-error blocked takes its reason.
  const noReason = store.setStatus("u1", "blocked");
  await assert.rejects(noReason, /a blocked unit says why it is blocked; contracted → blocked was asked with no reason/);
  // @ts-expect-error dispatched carries none.
  const withReason = store.setStatus("u1", "dispatched", "because");
  await assert.rejects(withReason, /dispatched carries no reason \(only a blocked unit's record does\)/);
  assert.equal((await store.getUnit("u1"))?.status, "contracted", "a refused write changes nothing");

  // By the store, for a caller whose status is not known until it runs.
  const status: UnitStatus = "dispatched";
  await assert.rejects((store.setStatus as (id: string, s: UnitStatus, reason?: string) => Promise<unknown>)("u1", status, "because"), /carries no reason/);
  await assert.rejects((store.setStatus as (id: string, s: UnitStatus, reason?: string) => Promise<unknown>)("u1", "blocked", ""), /says why it is blocked/);

  const blocked = await store.setStatus("u1", "blocked", "the lease is held");
  // The return is the record in that status: `reason` is a string here, not an optional one.
  const why: string = blocked.reason;
  assert.equal(why, "the lease is held");
  const dispatched = await store.setStatus("u1", "dispatched");
  // @ts-expect-error a dispatched unit's record has no reason to read.
  assert.equal(dispatched.reason, undefined);
  // recordAttempt rewrites the record and keeps its shape.
  await store.recordAttempt({ unitId: "u1", contractVersion: 1, startedAt: "a", endedAt: "b", outcome: "no-report" });
  const after = await store.setStatus("u1", "blocked", "the unit ended without calling report_result");
  await store.recordDecision({ id: "d1", unitId: "u1", attempt: 1, cause: "no-report", occurrence: 1, evidence: [], action: "abort", policy: { name: "recovery", version: 1 }, rationale: "r", decidedAt: "t", decidedBy: "S3" });
  assert.equal(after.attempts, 1);
  const aborted = await store.setStatus("u1", "aborted");
  assert.equal("reason" in aborted, false, "an aborted unit's record carries no reason: the decision record says why");
  const onDisk: unknown = JSON.parse(await readFile(path.join(root, ".regulator", "units", "u1", "unit.json"), "utf8"));
  assert.ok(isUnitRecord(onDisk));
});

test("a unit record written before #161 is read, named and rewritten: a reason beside aborted is dropped on read, and a record in neither shape is refused (#161)", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "regulator-legacy-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new ExecutionStore(root, () => 1_000);
  for (const unitId of ["u1", "u2", "u3"]) await store.createUnit(sampleContract({ unitId }));
  const file = (unitId: string) => path.join(root, ".regulator", "units", unitId, "unit.json");
  const current = JSON.parse(await readFile(file("u1"), "utf8"));
  // What 0.1.4 wrote at an abort: the status, and the reason beside it.
  const legacy = { ...current, status: "aborted", attempts: 2, reason: "aborted under recovery v3: check-failure" };
  await writeFile(file("u1"), `${JSON.stringify(legacy, null, 2)}\n`);
  assert.equal(isUnitRecord(legacy), false, "the older shape is not the current record");
  const read = await store.getUnit("u1");
  assert.equal(read?.status, "aborted");
  assert.equal("reason" in read!, false, "read without the reason its status cannot carry");
  assert.deepEqual((await store.listUnits()).map((u) => u.status), ["aborted", "contracted", "contracted"], "the instance still lists");

  // A blocked unit with no reason is a record in neither shape: nothing invents one.
  await writeFile(file("u3"), `${JSON.stringify({ ...current, unitId: "u3", status: "blocked" }, null, 2)}\n`);
  await assert.rejects(store.getUnit("u3"), /unit record/);
  const found = await store.legacyUnits();
  assert.deepEqual(found.legacy, [{ unitId: "u1", status: "aborted", reason: "aborted under recovery v3: check-failure" }]);
  assert.deepEqual(found.unreadable.map((u) => u.unitId), ["u3"]);

  assert.equal(await store.rewriteLegacyUnit("u1"), true);
  const rewritten = JSON.parse(await readFile(file("u1"), "utf8"));
  assert.ok(isUnitRecord(rewritten));
  assert.deepEqual(rewritten, { ...current, status: "aborted", attempts: 2 }, "the reason goes and nothing else changes");
  assert.equal(await store.rewriteLegacyUnit("u1"), false, "a second run finds nothing to do");
  assert.equal(await store.rewriteLegacyUnit("u2"), false);
  assert.deepEqual((await store.legacyUnits()).legacy, []);
});
