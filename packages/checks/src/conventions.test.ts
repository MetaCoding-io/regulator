import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { boundedTail, discoverConventions, parseNodeTestSummary } from "./conventions.js";

test("discoverConventions reports facts, not README claims", async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "regulator-conventions-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await writeFile(path.join(cwd, "README.md"), "Run the suite with: npm test\n");
  await writeFile(path.join(cwd, "package.json"), JSON.stringify({ name: "x", type: "module" }));
  await mkdir(path.join(cwd, "src"));
  await writeFile(path.join(cwd, "src", "a.js"), "export const a = 1;\n");
  await mkdir(path.join(cwd, "test"));
  await mkdir(path.join(cwd, "vendor"));
  const c = await discoverConventions(cwd);
  assert.deepEqual(c.testCommand, ["node", "--test"], "the README says npm test; there is no scripts.test");
  assert.equal(c.testCommandSource, "node --test (test/ directory present)");
  assert.deepEqual(c.sourceDirs, ["src"]);
  assert.deepEqual(c.protectedPaths, ["vendor/"]);
  assert.deepEqual(c.checks.map((check) => check.name), ["syntax:src/a.js", "protected-untouched"]);
  const bare = await mkdtemp(path.join(tmpdir(), "regulator-bare-"));
  t.after(() => rm(bare, { recursive: true, force: true }));
  assert.deepEqual((await discoverConventions(bare)).testCommand, []);
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
