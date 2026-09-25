import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { ResultReport, WorkContract } from "@metacoding.io/regulator-protocol";
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

  const blocked = await store.setStatus("u1", "blocked", "reintegration conflict");
  assert.equal(blocked.reason, "reintegration conflict");
  const closed = await store.setStatus("u1", "closed");
  assert.equal(closed.reason, undefined, "a reason does not outlive the status it explained");
  assert.deepEqual((await store.listUnits()).map((u) => [u.unitId, u.status]), [["u1", "closed"]]);

  const onDisk = JSON.parse(await readFile(path.join(root, ".regulator", "units", "u1", "contract.v1.json"), "utf8"));
  assert.deepEqual(onDisk, contract);
});
