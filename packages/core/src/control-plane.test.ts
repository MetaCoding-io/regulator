import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { isTurnRecord, type CapabilityProfile } from "@metacoding.io/regulator-protocol";
import {
  checkRegistry, isReadOnlyProfile, isWritableUnder, readOnlyViolations, renderBoundaryMarkdown, renderProfileSection, renderRegistryMarkdown,
  TraceWriter, TurnTracker,
} from "./index.js";

async function tempDir(t: TestContext, prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test("TurnTracker builds one record per turn from the event sequence", () => {
  let clock = 1000;
  const tracker = new TurnTracker(() => clock);
  tracker.startTurn(3, 1000);
  clock = 1010; tracker.toolStart("a", "read");
  clock = 1030; tracker.toolEnd("a", false);
  clock = 1040; tracker.toolBlocked("b", "write", "no");
  tracker.usage({ input: 1, output: 2, cacheRead: 0, cacheWrite: 0, totalTokens: 3, cost: 0 });
  clock = 1100;
  const record = tracker.endTurn();
  assert.ok(record);
  assert.equal(record.turnIndex, 3);
  assert.equal(record.durationMs, 100);
  assert.equal(record.usage?.totalTokens, 3);
  assert.deepEqual(record.toolCalls.map((c) => [c.toolName, c.blocked ?? false, c.endedAt! - c.startedAt]), [["read", false, 20], ["write", true, 0]]);
  assert.equal(tracker.endTurn(), undefined, "a second endTurn has nothing to close");
});

test("TraceWriter validates at runtime, not only by type: malformed records are refused", async (t) => {
  const dir = await tempDir(t, "regulator-trace-");
  const writer = new TraceWriter(path.join(dir, "nested", "trace.ndjson"));
  const good = { turnIndex: 0, startedAt: 1, endedAt: 2, durationMs: 1, toolCalls: [] };
  assert.equal(isTurnRecord(good), true);
  for (const bad of [
    { ...good, turnIndex: -1 },
    { ...good, durationMs: "1" },
    { ...good, toolCalls: [{ toolCallId: "", toolName: "read", startedAt: 1 }] },
    { ...good, extra: true },
    { ...good, usage: { input: 1 } },
  ]) {
    assert.equal(isTurnRecord(bad), false, JSON.stringify(bad));
    await assert.rejects(writer.append(bad as never), /malformed trace record/);
  }
  await assert.rejects(readFile(writer.filePath), /ENOENT/, "nothing was written");
  await writer.append(good);
  assert.equal((await readFile(writer.filePath, "utf8")).trim(), JSON.stringify(good));
});

test("read-only is a claim about effects, not tool names", () => {
  assert.deepEqual(readOnlyViolations(["read", "grep", "find", "ls", "read_conventions", "run_checks"]), []);
  assert.deepEqual(readOnlyViolations(["read", "run_tests"]), ["run_tests"], "a one-string schema that runs the project is not read-only");
  assert.deepEqual(readOnlyViolations(["read", "mystery_tool"]), ["mystery_tool"], "an undeclared effect is a violation");
  assert.deepEqual(readOnlyViolations(["bash"]), ["bash"]);
});

const research: CapabilityProfile = {
  name: "research", description: "Read and report.", tools: ["read", "grep", "read_conventions"], writablePaths: [], advice: ["Report; do not change."],
};
const implement: CapabilityProfile = {
  name: "implement", description: "Change src/ and test/.", tools: ["read", "write", "edit", "bash"], writablePaths: ["src/", "test/"], advice: ["Smallest change."],
};

test("profiles: read-only by effect; writable paths are a positive grant that fails closed", () => {
  assert.equal(isReadOnlyProfile(research), true);
  assert.equal(isReadOnlyProfile({ ...research, tools: [...research.tools, "run_tests"] }), false);
  assert.equal(isReadOnlyProfile(implement), false);
  for (const p of ["src/a.js", "./src/a.js", "@test/a.test.js", "test\\a.js"]) assert.equal(isWritableUnder(implement, p), true, p);
  for (const p of ["README.md", "vendor/x.js", "srcs/x.js", "src/../vendor/x.js", "/etc/passwd", "../x"]) assert.equal(isWritableUnder(implement, p), false, p);
  assert.equal(isWritableUnder(research, "src/a.js"), false, "read-only profile grants nothing");
});

test("the profile section is advice and says the refusal comes from the harness", () => {
  const section = renderProfileSection(implement);
  assert.match(section, /^Active capability profile: implement/);
  assert.match(section, /refused by the harness, not by you/);
  assert.match(section, /bash is granted and is not path-gated/);
  assert.doesNotMatch(renderProfileSection(research), /bash is granted/);
});

const record = {
  id: "reg.control.example.v1", name: "Example", status: "active", vsmFunction: "S3",
  purpose: "x", absorbs: { failureClass: "f", description: "d" },
  mechanism: { level: "deterministic-gate", implementation: "src/gate.ts", enforcementPoints: ["tool_call"] },
  evidence: { tests: ["src/gate.test.ts"] },
  limitations: ["lexical only"],
  ownership: { owner: "o", introduced: "2026-09-21", reviewBy: "2026-12-01" },
  ablation: { switch: "extension:gate", note: "the harness drops the extension" },
  retirement: { condition: "no regression across two model versions" },
};

test("checkRegistry accepts a record that shows what it claims and renders it", async (t) => {
  const root = await tempDir(t, "regulator-registry-ok-");
  await mkdir(path.join(root, "registry/regulators"), { recursive: true });
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "src/gate.ts"), "");
  await writeFile(path.join(root, "src/gate.test.ts"), "");
  await writeFile(path.join(root, "registry/regulators/example.json"), JSON.stringify(record));
  const { records, problems } = await checkRegistry(path.join(root, "registry"), root);
  assert.deepEqual(problems, []);
  assert.equal(records.length, 1);
  const md = renderRegistryMarkdown(records);
  assert.match(md, /^# Regulators\n/);
  assert.match(md, /`reg\.control\.example\.v1` \| Example \| S3 \| deterministic-gate \| active/);
  assert.match(md, /\*\*Limitations\.\*\*\n- lexical only/);
  assert.match(md, /\*\*Ablation\.\*\* `extension:gate` — the harness drops the extension\n\n\*\*Retirement condition\.\*\* no regression across two model versions/);
  const { reviewDue } = await import("./registry.js");
  assert.deepEqual(reviewDue(records, "2026-11-01").map((d) => d.record.id), [], "not due yet");
  assert.deepEqual(reviewDue(records, "2026-11-01", 30).map((d) => [d.record.id, d.overdueDays]), [["reg.control.example.v1", -30]], "due within a month");
  assert.deepEqual(reviewDue(records, "2026-12-11").map((d) => d.overdueDays), [10], "overdue");
  const boundary = renderBoundaryMarkdown(records);
  assert.match(boundary, /^# Enforcement boundary\n/);
  assert.match(boundary, /## Example \(`reg\.control\.example\.v1`\)\n\nEnforced at `tool_call` in `src\/gate\.ts`; S3, deterministic-gate\.\n\nNot covered:\n\n- lexical only/);
});

test("checkRegistry verifies implementation and test paths only in a source checkout, and says which it did", async (t) => {
  // An installed package ships dist/ and no sibling sources: the paths a record cites are provenance there, verified at
  // the release by `pnpm check`. `doctor` on an instance must not report every record as broken (0.1.1).
  const installed = await tempDir(t, "regulator-registry-installed-");
  await mkdir(path.join(installed, "registry/regulators"), { recursive: true });
  await mkdir(path.join(installed, "dist"));
  await writeFile(path.join(installed, "registry/regulators/example.json"), JSON.stringify(record));
  const skipped = await checkRegistry(path.join(installed, "registry"), installed);
  assert.equal(skipped.filesVerified, false);
  assert.deepEqual(skipped.problems, [], "no source tree: the paths are not checked");
  const forced = await checkRegistry(path.join(installed, "registry"), installed, { verifyFiles: true });
  assert.equal(forced.filesVerified, true);
  assert.deepEqual(forced.problems.map((p) => p.message).sort(), ["cited test not found: src/gate.test.ts", "implementation not found: src/gate.ts"]);
  const checkout = await tempDir(t, "regulator-registry-checkout-");
  await mkdir(path.join(checkout, "registry/regulators"), { recursive: true });
  await mkdir(path.join(checkout, "src"));
  await writeFile(path.join(checkout, "registry/regulators/example.json"), JSON.stringify(record));
  const verified = await checkRegistry(path.join(checkout, "registry"), checkout);
  assert.equal(verified.filesVerified, true, "a src/ directory beside the registry is a source checkout");
  assert.equal(verified.problems.length, 2);
});

test("checkRegistry rejects a record that claims what it cannot show", async (t) => {
  const root = await tempDir(t, "regulator-registry-bad-");
  await mkdir(path.join(root, "registry/regulators"), { recursive: true });
  await mkdir(path.join(root, "src")); // a source checkout: the cited files are expected to exist
  await writeFile(path.join(root, "registry/regulators/example.json"), JSON.stringify({ ...record, limitations: [] }));
  await writeFile(path.join(root, "registry/regulators/dupe.json"), JSON.stringify({ ...record, limitations: [] }));
  await writeFile(path.join(root, "registry/regulators/broken.json"), "{not json");
  await writeFile(path.join(root, "registry/regulators/shape.json"), JSON.stringify({ ...record, id: "bad id" }));
  await writeFile(path.join(root, "registry/regulators/lifecycle.json"), JSON.stringify({ ...record, id: "reg.control.lifecycle.v1", ablation: undefined, retirement: undefined }));
  const { problems, records } = await checkRegistry(path.join(root, "registry"), root);
  assert.equal(records.length, 3);
  const messages = problems.map((p) => p.message);
  for (const expected of [
    "not valid JSON", "does not match the regulator record schema", "duplicate id",
    "implementation not found: src/gate.ts", "cited test not found: src/gate.test.ts", "must state at least one limitation",
    "names no ablation switch", "states no retirement condition",
  ]) {
    assert.ok(messages.some((m) => m.includes(expected)), `expected a problem containing "${expected}"; got ${JSON.stringify(messages)}`);
  }
});
