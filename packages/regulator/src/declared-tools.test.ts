import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { DeclaredToolError, declaredEffects, declaredToolArgumentProblems, loadDeclaredTools, loadDeclaredToolsSync, runDeclaredTool } from "./declared-tools.js";
import { gitExec, initRepo } from "./git-support.js";
import { LAB_ROOT } from "./workload.js";

/** A definition root of its own with one program, so the shipped definition carries nothing test-only. */
async function definitionWith(t: TestContext, program: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "regulator-declared-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "workload", "pf"), { recursive: true });
  await writeFile(path.join(root, "workload", "pf", "stamp.mjs"), program);
  return root;
}

const stamp = {
  name: "stamp", description: "d", parameters: { type: "object", properties: { note: { type: "string" }, where: { type: "string" } }, required: ["note"], additionalProperties: false },
  effect: { filesystem: "write" as const, execution: "none" as const, network: "none" as const, sideEffects: "irreversible" as const },
  program: { argv: ["node", "workload/pf/stamp.mjs"], outputs: ["stamps/"] },
};

/** A program that writes what it is handed on stdin where it is told, and says so last. */
const PROGRAM = [
  'import { mkdirSync, readFileSync, writeFileSync } from "node:fs";',
  "const args = JSON.parse(readFileSync(0, \"utf8\"));",
  'if (args.note === "fail") { process.stderr.write("refusing: the note says so\\n"); process.exit(3); }',
  'if (args.note === "quiet") { process.stdout.write("done, quietly\\n"); process.exit(0); }',
  'const file = args.where ?? "stamps/note.txt";',
  'mkdirSync(file.split("/").slice(0, -1).join("/") || ".", { recursive: true });',
  "writeFileSync(file, `${args.note}\\n`);",
  'process.stdout.write(`${JSON.stringify({ summary: `stamped ${file}`, evidence: [{ class: "file", ref: file, observation: "written" }] })}\\n`);',
  "",
].join("\n");

test("the shipped definition declares one tool, place_trade, read off the workload at load as the host reads it; its effects table carries that tool and no built-in", async () => {
  const sync = loadDeclaredToolsSync(LAB_ROOT);
  assert.deepEqual(sync.map((d) => [d.tool.name, d.workload]), [["place_trade", "portfolio"]]);
  assert.deepEqual(await loadDeclaredTools(LAB_ROOT), sync);
  assert.deepEqual(declaredEffects(sync), { place_trade: { filesystem: "write", execution: "none", network: "none", sideEffects: "irreversible" } });
  assert.deepEqual(loadDeclaredToolsSync(path.join(LAB_ROOT, "fixture")), [], "a root with no workload directory declares nothing");
  assert.equal(declaredToolArgumentProblems(sync[0]!.tool, { proposed: "trades/proposed/2026-09-30.json" }), undefined);
  assert.match(declaredToolArgumentProblems(sync[0]!.tool, { proposed: "trades/pending/2026-09-30.json" }) ?? "", /^\/proposed: must match pattern/);
  assert.match(declaredToolArgumentProblems(sync[0]!.tool, { proposed: "trades/proposed/2026-09-30.json", extra: 1 }) ?? "", /must not have additional properties/);
});

test("runDeclaredTool runs the declared program in the worktree with the call's arguments on stdin, under the tool's declared outputs: what it wrote there stands and is named, what it printed last is the summary with its evidence, and the program's file, hash and exit are the call's provenance", async (t) => {
  const root = await definitionWith(t, PROGRAM);
  const cwd = await initRepo(t);
  const run = await runDeclaredTool(gitExec, { root, tool: stamp, arguments: { note: "hello" }, cwd });
  assert.equal(await readFile(path.join(cwd, "stamps", "note.txt"), "utf8"), "hello\n", "the arguments reached the program on stdin");
  assert.deepEqual([run.summary, run.evidence, run.written, run.program.file, run.program.exit, run.program.sha256.length], ["stamped stamps/note.txt", [{ class: "file", ref: "stamps/note.txt", observation: "written" }], ["stamps/note.txt"], "workload/pf/stamp.mjs", 0, 64]);
  const quiet = await runDeclaredTool(gitExec, { root, tool: stamp, arguments: { note: "quiet" }, cwd });
  assert.deepEqual([quiet.summary, quiet.evidence, quiet.written], ["done, quietly", [], []], "no JSON line: the tail is what the model is told, and nothing was written");
});

test("a call of a declared tool is refused — nothing of it stands — when its arguments do not fit the tool's schema, when its program writes outside the declared outputs (undone before the refusal), when the program exits non-zero (with what it said), and when the program names no file under the definition", async (t) => {
  const root = await definitionWith(t, PROGRAM);
  const cwd = await initRepo(t);
  await assert.rejects(runDeclaredTool(gitExec, { root, tool: stamp, arguments: {} as Record<string, unknown>, cwd }), (e: Error) => e instanceof DeclaredToolError && /^stamp refused: the arguments do not fit the tool's schema \(\/: must have required propert(y|ies) .?note.?\)$/.test(e.message));
  await assert.rejects(runDeclaredTool(gitExec, { root, tool: stamp, arguments: { note: "stray", where: "src/injected.js" }, cwd }), (e: Error) => e instanceof DeclaredToolError && /^stamp refused: its program wrote outside the tool's declared outputs \(stamps\/\): src\/injected\.js; the writes are undone and nothing of this call stands$/.test(e.message) && e.program?.exit === 0);
  await assert.rejects(stat(path.join(cwd, "src", "injected.js")), /ENOENT/, "undone");
  await assert.rejects(runDeclaredTool(gitExec, { root, tool: stamp, arguments: { note: "stray", where: "src/index.js" }, cwd }), /wrote outside the tool's declared outputs/);
  assert.equal(await readFile(path.join(cwd, "src", "index.js"), "utf8"), "export const answer = 42;\n", "a tracked file is put back");
  await assert.rejects(runDeclaredTool(gitExec, { root, tool: stamp, arguments: { note: "fail" }, cwd }), (e: Error) => e instanceof DeclaredToolError && /^stamp refused: its program exited 3: refusing: the note says so$/.test(e.message) && e.program?.exit === 3);
  await assert.rejects(runDeclaredTool(gitExec, { root, tool: { ...stamp, program: { ...stamp.program, argv: ["node", "workload/pf/missing.mjs"] } }, arguments: { note: "x" }, cwd }), /names no file under the definition/);
  await assert.rejects(runDeclaredTool(gitExec, { root, tool: { ...stamp, program: { ...stamp.program, timeoutMs: 1 } }, arguments: { note: "x" }, cwd }), /ran past its ceiling/);
  await assert.rejects(stat(path.join(cwd, "stamps")), /ENOENT/, "no refused call left anything under the outputs either");
});
