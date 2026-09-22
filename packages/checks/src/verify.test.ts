import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import type { EvidenceRecord, ResultReport, WorkContract } from "@metacoding/vsm-pi-protocol";
import { realExec } from "./exec.js";
import { bindEvidence, runHostChecks, summarizeVerdict, technicalVerdict } from "./verify.js";

const IDENTITY = ["-c", "user.name=lab", "-c", "user.email=lab@example.invalid", "-c", "commit.gpgsign=false"];
async function git(cwd: string, ...args: string[]): Promise<string> {
  const r = await realExec("git", [...IDENTITY, ...args], { cwd });
  if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

/** A tiny project with one passing test, one syntax check and a vendored file, committed once. */
async function project(t: TestContext): Promise<{ cwd: string; revision: string }> {
  const cwd = await mkdtemp(path.join(tmpdir(), "regulator-verify-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await writeFile(path.join(cwd, "package.json"), JSON.stringify({ name: "p", private: true, type: "module" }));
  await mkdir(path.join(cwd, "src"));
  await writeFile(path.join(cwd, "src", "a.js"), "export const a = 1;\n");
  await mkdir(path.join(cwd, "test"));
  await writeFile(path.join(cwd, "test", "a.test.js"), 'import test from "node:test"; import assert from "node:assert/strict"; import { a } from "../src/a.js"; test("a", () => assert.equal(a, 1));\n');
  await mkdir(path.join(cwd, "vendor"));
  await writeFile(path.join(cwd, "vendor", "v.js"), "export const v = 0;\n");
  await git(cwd, "init", "--quiet", "-b", "main");
  await git(cwd, "add", "-A");
  await git(cwd, "commit", "--quiet", "-m", "init");
  return { cwd, revision: await git(cwd, "rev-parse", "HEAD") };
}

const contract: WorkContract = {
  kind: "task", id: "tc-1", version: 1, unitId: "u1", unitType: "implement", workload: { name: "software-development", version: 1 },
  objective: "o", constraintRefs: [], fixed: [], delegated: [], unresolved: [],
  expectedEvidence: [
    { id: "e-tests", description: "tests pass", class: "test", required: true },
    { id: "e-checks", description: "checks pass", class: "command", required: true },
    { id: "e-notes", description: "a note file exists", class: "file", required: false },
  ],
  provenance: { createdBy: "S3", createdAt: "t" },
};
const report: ResultReport = {
  contractId: "tc-1", contractVersion: 1, unitId: "u1", attempt: 1, reportedAt: "t", summary: "done",
  evidence: [{ class: "test", ref: "run_tests", observation: "all pass" }, { class: "command", ref: "run_checks", observation: "all pass" }],
  delegatedResults: [], unresolvedOutcomes: [], emergentDecisions: [], deviations: [], residualUncertainty: [],
};

test("runHostChecks runs the project's real checks with the harness's own runner and binds each result to the revision, environment, attempt and criteria", async (t) => {
  const { cwd, revision } = await project(t);
  const results = await runHostChecks(realExec, { cwd, checks: ["run_tests", "run_checks", "lint"], fileRefs: ["src/a.js", "docs/missing.md"] });
  assert.deepEqual(results.map((r) => [r.check, r.class, r.verdict]), [
    ["run_tests", "test", "pass"], ["run_checks:syntax:src/a.js", "command", "pass"], ["run_checks:protected-untouched", "command", "pass"],
    ["lint", "command", "inconclusive"], ["file:src/a.js", "file", "pass"], ["file:docs/missing.md", "file", "fail"],
  ]);
  assert.match(results[0]?.observation ?? "", /^1 passed, 0 failed/);
  assert.deepEqual(results[0]?.command, ["node", "--test", "--test-reporter", "tap"], "the harness pins the reporter it parses");
  const records = bindEvidence(results, { unitId: "u1", attempt: 2, contract: { id: "tc-1", version: 1 }, expectations: contract.expectedEvidence, revision, now: () => 1_700_000_000_000 });
  assert.deepEqual(records.map((r) => r.criteria), [["e-tests"], ["e-checks"], ["e-checks"], ["e-checks"], ["e-notes"], ["e-notes"]], "bound by class to the contract's criteria");
  assert.equal(records[0]?.revision, revision);
  assert.equal(records[0]?.attempt, 2);
  assert.equal(records[0]?.producedBy, "S3*");
  assert.equal(records[0]?.environment.node, process.version);
  assert.equal(records[0]?.at, "2023-11-14T22:13:20.000Z");
});

test("a failing test and a touched protected path are failing evidence; a project with no tests is inconclusive, not passing", async (t) => {
  const { cwd } = await project(t);
  await writeFile(path.join(cwd, "test", "a.test.js"), 'import test from "node:test"; import assert from "node:assert/strict"; test("a", () => assert.equal(1, 2)); test("b", () => {});\n');
  await writeFile(path.join(cwd, "vendor", "v.js"), "export const v = 1;\n");
  const results = await runHostChecks(realExec, { cwd, checks: ["run_tests", "run_checks"] });
  assert.deepEqual(results.map((r) => [r.check, r.verdict]), [["run_tests", "fail"], ["run_checks:syntax:src/a.js", "pass"], ["run_checks:protected-untouched", "fail"]]);
  assert.match(results[0]?.observation ?? "", /1 passed, 1 failed\nnot ok: a/);
  assert.match(results[2]?.observation ?? "", /vendor\/v\.js/);
  const bare = await mkdtemp(path.join(tmpdir(), "regulator-bare-"));
  t.after(() => rm(bare, { recursive: true, force: true }));
  const none = await runHostChecks(realExec, { cwd: bare, checks: ["run_tests", "run_checks"] });
  assert.deepEqual(none.map((r) => r.verdict), ["inconclusive", "inconclusive"]);
});

test("technicalVerdict is derived from fresh host evidence only: missing, stale, failed and contradicted each refuse; a report's claims never satisfy", () => {
  const rec = (over: Partial<EvidenceRecord>): EvidenceRecord => ({
    id: over.id ?? "r", unitId: "u1", attempt: 1, contract: { id: "tc-1", version: 1 }, check: "run_tests", class: "test", criteria: ["e-tests"], verdict: "pass",
    observation: "1 passed, 0 failed", revision: "aaaaaaa1", environment: { node: "v22", platform: "linux", arch: "x64" }, producedBy: "S3*", at: "t", ...over,
  });
  const base = { contract, report, acceptances: [], unitId: "u1", attempt: 1, revision: "aaaaaaa1", now: () => 0 };
  const tests = rec({ id: "t" });
  const checks = rec({ id: "c", check: "run_checks:syntax:src/a.js", class: "command", criteria: ["e-checks"] });

  const nothing = technicalVerdict({ ...base, records: [] });
  assert.equal(nothing.verdict, "inconclusive");
  assert.deepEqual(nothing.missing, ["e-tests", "e-checks"], "the report says all pass; that is not evidence");
  assert.equal(nothing.evidence.length, 0);

  const ok = technicalVerdict({ ...base, records: [tests, checks] });
  assert.equal(ok.verdict, "pass");
  assert.deepEqual(ok.satisfied, ["e-tests", "e-checks"]);
  assert.deepEqual(ok.evidence, ["t", "c"]);
  assert.equal(summarizeVerdict(ok), "pass@aaaaaaa");

  const stale = technicalVerdict({ ...base, records: [tests, checks], revision: "bbbbbbb2" });
  assert.equal(stale.verdict, "inconclusive");
  assert.deepEqual(stale.stale, ["e-tests", "e-checks"]);
  assert.match(stale.reasons[0] ?? "", /evidence exists only for aaaaaaa, not bbbbbbb/);

  const failing = technicalVerdict({ ...base, records: [rec({ id: "t2", verdict: "fail", observation: "0 passed, 1 failed\nnot ok: a" }), checks] });
  assert.equal(failing.verdict, "fail");
  assert.deepEqual(failing.failed, ["e-tests"]);
  assert.deepEqual(failing.contradicted, ["run_tests"], "the report claimed passing tests");
  assert.match(summarizeVerdict(failing), /^fail@aaaaaaa \(failed e-tests; contradicted run_tests\)/);

  const inconclusive = technicalVerdict({ ...base, records: [rec({ id: "t3", verdict: "inconclusive", observation: "no test command discovered" }), checks] });
  assert.equal(inconclusive.verdict, "inconclusive");
  assert.deepEqual(inconclusive.missing, ["e-tests"]);

  const optionalOnly = technicalVerdict({ ...base, records: [tests, checks, rec({ id: "f", check: "file:docs/x.md", class: "file", criteria: ["e-notes"], verdict: "fail" })] });
  assert.equal(optionalOnly.verdict, "pass", "a failing optional criterion does not refuse");
});

test("human acceptance is separate from the technical verdict: a semantic criterion waits for a person, and only a disposition at this revision counts", () => {
  const semantic: WorkContract = { ...contract, expectedEvidence: [{ id: "e-ux", description: "the error message reads well", class: "semantic", required: true }] };
  const base = { contract: semantic, records: [], unitId: "u1", attempt: 1, revision: "aaaaaaa1", now: () => 0 };
  const waiting = technicalVerdict({ ...base, acceptances: [] });
  assert.equal(waiting.verdict, "inconclusive");
  assert.deepEqual(waiting.awaitingAcceptance, ["e-ux"]);
  const acceptance = { id: "a1", unitId: "u1", contract: { id: "tc-1", version: 1 }, criterion: "e-ux", revision: "aaaaaaa1", disposition: "accepted" as const, by: "alice", at: "t" };
  assert.equal(technicalVerdict({ ...base, acceptances: [acceptance] }).verdict, "pass");
  assert.equal(technicalVerdict({ ...base, acceptances: [{ ...acceptance, revision: "0000000" }] }).verdict, "inconclusive", "accepted at another revision is a memory");
  const rejected = technicalVerdict({ ...base, acceptances: [{ ...acceptance, disposition: "rejected", note: "too terse" }] });
  assert.equal(rejected.verdict, "fail");
  assert.match(rejected.reasons[0] ?? "", /rejected by alice: too terse/);
});

test("identity-untouched (lesson 12): INV-001 in code — a change under a protected prefix anywhere on the unit's branch fails, committed or not, whatever the working tree says; without a base ref it is inconclusive", async (t) => {
  const { cwd } = await project(t);
  await mkdir(path.join(cwd, "regulator", "identity"), { recursive: true });
  await writeFile(path.join(cwd, "regulator", "identity", "INVARIANTS.md"), "## INV-001 — x\n\ns\n");
  await git(cwd, "add", "-A");
  await git(cwd, "commit", "--quiet", "-m", "identity");
  await git(cwd, "checkout", "--quiet", "-b", "unit/u1");
  const protectedPaths = ["regulator/identity/", "vendor/"];
  const run = async (base?: string) => (await runHostChecks(realExec, { cwd, checks: ["identity-untouched"], protectedPaths, ...(base === undefined ? {} : { base }) }))[0]!;
  assert.equal((await run()).verdict, "inconclusive");
  assert.equal((await run("main")).verdict, "pass");
  assert.match((await run("main")).observation, /no change under regulator\/identity\/, vendor\/ since main/);

  // The route the bash watch cannot see: edit and commit in one command. The tree is clean; the branch is not.
  await writeFile(path.join(cwd, "regulator", "identity", "INVARIANTS.md"), "## INV-001 — relaxed\n\ns\n");
  await git(cwd, "commit", "--quiet", "-am", "relax the invariant");
  assert.equal(await git(cwd, "status", "--porcelain"), "", "git status sees nothing");
  const failed = await run("main");
  assert.equal(failed.verdict, "fail");
  assert.equal(failed.class, "command");
  assert.match(failed.observation, /^protected paths changed on the branch \(INV-001\): regulator\/identity\/INVARIANTS\.md$/);
  assert.deepEqual(failed.command, ["git", "diff", "--name-only", "main...HEAD", "--", "regulator/identity/", "vendor/"]);

  // A change under src/ on the same branch is not the identity's business.
  await git(cwd, "checkout", "--quiet", "main");
  await git(cwd, "checkout", "--quiet", "-b", "unit/u2");
  await writeFile(path.join(cwd, "src", "a.js"), "export const a = 2;\n");
  await git(cwd, "commit", "--quiet", "-am", "work");
  assert.equal((await run("main")).verdict, "pass");
  assert.equal((await runHostChecks(realExec, { cwd, checks: ["identity-untouched"], base: "main", protectedPaths: [] }))[0]?.observation, "no protected prefixes declared");
});

test("export-signature (lesson 14): a criterion observed by content — the host imports the module at HEAD and reads the export's arity; the record binds to that criterion alone, and a runtime criterion with host evidence no longer waits for a person", async (t) => {
  const { cwd, revision } = await project(t);
  const expectations = [
    { id: "e-tests", description: "tests pass", class: "test" as const, required: true },
    { id: "e-signature", description: "a keeps one parameter", class: "runtime" as const, required: true, check: { kind: "export-signature" as const, module: "src/a.js", export: "a", arity: 1 } },
    { id: "e-looks", description: "the page looks right", class: "runtime" as const, required: true },
  ];
  const run = async () => runHostChecks(realExec, { cwd, checks: ["export-signature"], expectations });
  // `a` is a constant, not a function.
  let [r] = await run();
  assert.deepEqual([r!.check, r!.class, r!.criterion, r!.verdict], ["export-signature:e-signature", "runtime", "e-signature", "fail"]);
  assert.equal(r!.observation, "src/a.js exports a as a number, not a function");
  await writeFile(path.join(cwd, "src", "a.js"), "export const a = (x) => x;\n");
  [r] = await run();
  assert.equal(r!.verdict, "pass");
  assert.equal(r!.observation, "a(1 parameter) exported by src/a.js at HEAD");
  await writeFile(path.join(cwd, "src", "a.js"), "export function a(x, options = {}) { return x; }\n");
  [r] = await run();
  assert.equal(r!.verdict, "pass", "a defaulted second parameter does not count towards Function.length: the signature the caller sees is one argument");
  await writeFile(path.join(cwd, "src", "a.js"), "export function a(x, sep) { return x + sep; }\n");
  [r] = await run();
  assert.equal(r!.verdict, "fail");
  assert.equal(r!.observation, "a declares 2 parameter(s); the contract fixes 1");
  await writeFile(path.join(cwd, "src", "a.js"), "export function b(x) { return x; }\n");
  [r] = await run();
  assert.equal(r!.observation, "src/a.js does not export a");
  await writeFile(path.join(cwd, "src", "a.js"), "export function a(x) { return x; }\nthrow new Error('boom at import');\n");
  [r] = await run();
  assert.equal(r!.verdict, "inconclusive");
  assert.match(r!.observation, /could not load src\/a\.js: boom at import/);
  assert.equal((await runHostChecks(realExec, { cwd, checks: ["export-signature"], expectations: [expectations[0]!] }))[0]?.observation, "no expectation in the contract carries an export-signature check");

  // Binding by content: the signature record names only its criterion; a test record binds to test-class expectations that carry no check.
  await writeFile(path.join(cwd, "src", "a.js"), "export function a(x) { return x; }\n");
  await writeFile(path.join(cwd, "test", "a.test.js"), 'import test from "node:test"; import assert from "node:assert/strict"; import { a } from "../src/a.js"; test("a", () => assert.equal(a(1), 1));\n');
  const results = await runHostChecks(realExec, { cwd, checks: ["run_tests", "export-signature"], expectations });
  const bound = bindEvidence(results, { unitId: "u1", attempt: 1, contract: { id: "tc-1", version: 1 }, expectations, revision });
  assert.deepEqual(bound.map((b) => [b.check, b.criteria]), [["run_tests", ["e-tests"]], ["export-signature:e-signature", ["e-signature"]]]);
  const verdict = technicalVerdict({ contract: { ...contract, expectedEvidence: expectations }, records: bound, acceptances: [], unitId: "u1", attempt: 1, revision });
  assert.deepEqual([verdict.verdict, verdict.satisfied, verdict.awaitingAcceptance], ["inconclusive", ["e-tests", "e-signature"], ["e-looks"]], "the probed runtime criterion is satisfied by host evidence; the unprobed one still waits for a person");
});

test("glossary-lint (lesson 15): the words the glossary refuses are read off the branch's added comment lines and commit messages, never off identifiers; no terms is a pass, no base is inconclusive", async (t) => {
  const { cwd } = await project(t);
  await git(cwd, "checkout", "--quiet", "-b", "unit/u1");
  const forbidden = [{ term: "task", say: "unit" }, { term: "ticket", say: "obligation" }];
  const run = async (base?: string) => (await runHostChecks(realExec, { cwd, checks: ["glossary-lint"], forbidden, writablePaths: ["src/", "test/"], ...(base === undefined ? {} : { base }) }))[0]!;
  assert.equal((await run()).verdict, "inconclusive");
  assert.equal((await runHostChecks(realExec, { cwd, checks: ["glossary-lint"], base: "main", forbidden: [] }))[0]?.observation, "the glossary refuses no words");
  await writeFile(path.join(cwd, "src", "a.js"), "export const task = 1; // the value of a\nexport const a = task;\n");
  await git(cwd, "commit", "--quiet", "-am", "unit u1: rename nothing");
  let r = await run("main");
  assert.equal(r.verdict, "pass", `an identifier is not drift: ${r.observation}`);
  await writeFile(path.join(cwd, "src", "a.js"), "export const task = 1; // this task's value (ticket #4)\nexport const a = task;\n");
  await git(cwd, "commit", "--quiet", "-am", "finish the Tasks for this ticket");
  r = await run("main");
  assert.equal(r.verdict, "fail");
  assert.match(r.observation, /comment "\/\/ this task's value \(ticket #4\)": task \(say unit\)/);
  assert.match(r.observation, /commit "finish the Tasks for this ticket": task \(say unit\)/);
  assert.match(r.observation, /ticket \(say obligation\)/);
  await writeFile(path.join(cwd, "vendor", "v.js"), "// vendored task runner\nexport const v = 0;\n");
  await git(cwd, "commit", "--quiet", "-am", "unit u1: vendor note");
  r = await run("main");
  assert.doesNotMatch(r.observation, /vendored task runner/, "only the writable prefixes are read");
});
