import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { discoverConventions, parseNodeTestSummary, boundedTail } from "./conventions.js";
import { createTypedToolsExtension, TOOL_NAMES, type CheckResult } from "./cp2-typed-tools.js";
import { ctxFor, fixtureCopy, mockPi } from "./test-support.js";

test("discoverConventions reports facts, not README claims", async (t) => {
  const cwd = await fixtureCopy(t);
  const c = await discoverConventions(cwd);
  assert.deepEqual(c.testCommand, ["node", "--test"]);
  assert.equal(c.testCommandSource, "node --test (test/ directory present)");
  assert.deepEqual(c.sourceDirs, ["src"]);
  assert.deepEqual(c.protectedPaths, ["vendor/"]);
  assert.deepEqual(c.checks.map((check) => check.name), ["syntax:src/slugify.js", "protected-untouched"]);
});

test("parseNodeTestSummary reads TAP and spec output and names failures; boundedTail keeps the end", () => {
  const tap = "TAP version 13\nok 1 - a\nnot ok 2 - b fails\nnot ok 3 - c fails\n# tests 3\n# pass 1\n# fail 2\n";
  assert.deepEqual(parseNodeTestSummary(tap), { pass: 1, fail: 2, failures: ["b fails", "c fails"] });
  // Node 24's default `spec` reporter: failures appear inline and again under "failing tests".
  const spec = "✔ a (1.2ms)\n✖ b fails (3.4ms)\n✖ c fails (0.5ms)\nℹ tests 3\nℹ pass 1\nℹ fail 2\n✖ failing tests:\n✖ b fails (3.4ms)\n✖ c fails (0.5ms)\n";
  assert.deepEqual(parseNodeTestSummary(spec), { pass: 1, fail: 2, failures: ["b fails", "c fails"] });
  assert.equal(parseNodeTestSummary("Error: Cannot find module"), undefined);
  const bounded = boundedTail("x".repeat(100), 10);
  assert.equal(bounded.truncated, true);
  assert.ok(bounded.text.endsWith("x".repeat(10)));
  assert.equal(boundedTail("short", 10).truncated, false);
});

test("registers three narrow tools with model-facing contracts", () => {
  const { pi, tools } = mockPi();
  createTypedToolsExtension()(pi);
  assert.deepEqual([...tools.keys()].sort(), [...TOOL_NAMES].sort());
  for (const tool of tools.values()) {
    assert.ok(tool.promptSnippet, `${tool.name} has a prompt snippet`);
    assert.ok(tool.promptGuidelines?.length, `${tool.name} has guidelines`);
    assert.equal((tool.parameters as { type?: string }).type, "object");
  }
});

test("run_tests returns a bounded structured summary and honours a filter", async (t) => {
  const cwd = await fixtureCopy(t);
  const { pi, tools } = mockPi();
  createTypedToolsExtension({ maxOutputChars: 300 })(pi);
  const { ctx } = ctxFor(cwd);
  const run = tools.get("run_tests")!;

  const all = await run.execute("t1", {}, undefined, undefined, ctx as never);
  const details = all.details as { pass: number; fail: number; failures: string[]; truncated: boolean };
  assert.equal(details.pass, 2);
  assert.equal(details.fail, 2);
  assert.deepEqual(details.failures, ["collapses repeated separators to a single dash", "trims leading and trailing dashes"]);
  assert.equal(details.truncated, true, "raw output is bounded when tests fail");
  const text = (all.content[0] as { text: string }).text;
  assert.match(text, /^2 passed, 2 failed/);
  assert.match(text, /not ok: trims leading/);
  assert.ok(text.length < 700, `output stays small (${text.length} chars)`);

  const filtered = await run.execute("t2", { filter: "suffix" }, undefined, undefined, ctx as never);
  const fd = filtered.details as { pass: number; fail: number };
  assert.deepEqual([fd.pass, fd.fail], [1, 0]);
});

test("run_tests throws when tests cannot run, returns when they ran and failed", async (t) => {
  const { pi, tools } = mockPi();
  createTypedToolsExtension()(pi);
  const run = tools.get("run_tests")!;

  const empty = await mkdtemp(path.join(tmpdir(), "regulator-empty-"));
  t.after(() => rm(empty, { recursive: true, force: true }));
  await assert.rejects(run.execute("t3", {}, undefined, undefined, ctxFor(empty).ctx as never), /No test command discovered/);

  const broken = await mkdtemp(path.join(tmpdir(), "regulator-broken-"));
  t.after(() => rm(broken, { recursive: true, force: true }));
  await writeFile(path.join(broken, "package.json"), JSON.stringify({ name: "broken", scripts: { test: "node -e \"process.exit(3)\"" } }));
  await assert.rejects(run.execute("t4", {}, undefined, undefined, ctxFor(broken).ctx as never), /did not produce a test summary \(exit 3\)/);
});

test("run_checks gives one verdict per check and notices a touched protected path", async (t) => {
  const cwd = await fixtureCopy(t, { git: true });
  const { pi, tools } = mockPi();
  createTypedToolsExtension()(pi);
  const { ctx } = ctxFor(cwd);
  const checks = tools.get("run_checks")!;

  const clean = await checks.execute("c1", {}, undefined, undefined, ctx as never);
  const results = (clean.details as { results: CheckResult[] }).results;
  assert.deepEqual(results.map((r) => [r.name, r.ok]), [["syntax:src/slugify.js", true], ["protected-untouched", true]]);

  await writeFile(path.join(cwd, "vendor/left-pad.js"), "// touched\n");
  const dirty = await checks.execute("c2", {}, undefined, undefined, ctx as never);
  const after = (dirty.details as { results: CheckResult[] }).results;
  assert.equal(after.find((r) => r.name === "protected-untouched")?.ok, false);
  assert.match((dirty.content[0] as { text: string }).text, /FAIL protected-untouched/);
});

test("Pi 0.87.0 loads the built checkpoint and executes the typed tools in a real session without a model", async (t) => {
  // run_checks rather than run_tests here: Pi's own exec inherits this test runner's
  // environment, and `node --test` refuses to nest. `node --check` and git do not care.
  const cwd = await fixtureCopy(t, { git: true });
  const agentDir = path.join(cwd, "agent-config");
  const settingsManager = SettingsManager.inMemory();
  const loader = new DefaultResourceLoader({
    cwd, agentDir, settingsManager,
    additionalExtensionPaths: [fileURLToPath(new URL("./cp2-typed-tools.js", import.meta.url))],
    noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
  });
  await loader.reload();
  assert.deepEqual(loader.getExtensions().errors, []);
  const modelRuntime = await ModelRuntime.create({
    authPath: path.join(agentDir, "auth.json"), modelsPath: null,
    modelsStorePath: path.join(agentDir, "models-cache.json"),
    allowModelNetwork: false, refreshOnCreate: false,
  });
  const { session } = await createAgentSession({
    cwd, agentDir, settingsManager, modelRuntime,
    sessionManager: SessionManager.inMemory(cwd), resourceLoader: loader,
    tools: [...TOOL_NAMES],
  });
  t.after(() => session.dispose());
  await session.bindExtensions({});
  const tools = new Map(session.agent.state.tools.map((tool) => [tool.name, tool]));
  assert.deepEqual([...tools.keys()].sort(), [...TOOL_NAMES].sort());
  const conventions = await tools.get("read_conventions")!.execute("s1", {});
  assert.deepEqual((conventions.details as { testCommand: string[] }).testCommand, ["node", "--test"]);
  const checks = await tools.get("run_checks")!.execute("s2", {});
  const results = (checks.details as { results: CheckResult[] }).results;
  assert.deepEqual(results.map((r) => [r.name, r.ok]), [["syntax:src/slugify.js", true], ["protected-untouched", true]]);
});
