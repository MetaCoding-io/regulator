import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { PROVENANCE_ENTRY_TYPE, createEvidenceExtension } from "./cp8-evidence.js";
import { gitExec, initRepo } from "./git-support.js";
import { ctxFor, mockPi } from "./test-support.js";

const rev = async (cwd: string) => (await gitExec("git", ["rev-parse", "HEAD"], { cwd })).stdout.trim();

test("provenance: every run_tests / run_checks result is stamped with the revision it ran at and recorded as a typed session entry", async (t) => {
  const repo = await initRepo(t);
  const { pi, handlers, entries } = mockPi();
  createEvidenceExtension({ now: () => 1_700_000_000_000 })(pi);
  const { ctx, statuses } = ctxFor(repo);
  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
  const head = await rev(repo);
  const patched = await handlers.get("tool_result")!({ type: "tool_result", toolName: "run_tests", toolCallId: "t1", input: {}, content: [{ type: "text", text: "1 passed, 0 failed" }], details: { pass: 1, fail: 0 }, isError: false }, ctx) as { content: Array<{ text: string }> };
  assert.equal(patched.content.length, 2, "the model's text is kept; the stamp is appended");
  assert.match(patched.content[1]?.text ?? "", new RegExp(`run_tests ran at revision ${head.slice(0, 7)}; the orchestrator re-runs it independently`));
  assert.deepEqual(entries[0], { customType: PROVENANCE_ENTRY_TYPE, data: { tool: "run_tests", revision: head, dirty: false, ok: true, at: "2023-11-14T22:13:20.000Z" } }, "state in the session, not context");
  assert.equal(statuses.evidence, `evidence: run_tests@${head.slice(0, 7)} ok`);
  await writeFile(path.join(repo, "src.txt"), "edited\n");
  const dirty = await handlers.get("tool_result")!({ type: "tool_result", toolName: "run_checks", toolCallId: "c1", input: {}, content: [{ type: "text", text: "FAIL syntax" }], details: { results: [{ ok: false }] }, isError: false }, ctx) as { content: Array<{ text: string }> };
  assert.match(dirty.content[1]?.text ?? "", /with uncommitted changes/);
  assert.equal(statuses.evidence, `evidence: run_tests@${head.slice(0, 7)} ok, run_checks@${head.slice(0, 7)}+ FAIL`);
  assert.equal(await handlers.get("tool_result")!({ type: "tool_result", toolName: "read", toolCallId: "r", input: {}, content: [], details: {}, isError: false }, ctx), undefined, "other tools are not stamped");
});

test("preflight: report_result is blocked when it cites a run that did not happen here, ran on another revision or a dirty tree, or did not pass", async (t) => {
  const repo = await initRepo(t);
  const { pi, handlers } = mockPi();
  const ext = createEvidenceExtension();
  ext(pi);
  const { ctx } = ctxFor(repo);
  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
  const report = (evidence: Array<{ class: string; ref: string }>) => ({ type: "tool_call", toolName: "report_result", toolCallId: "rep", input: { summary: "done", evidence } });
  const call = async (evidence: Array<{ class: string; ref: string }>) => handlers.get("tool_call")!(report(evidence), ctx) as Promise<{ block: boolean; reason: string } | undefined>;

  // The cheap lie: "tests pass" with nothing run.
  const lie = await call([{ class: "test", ref: "run_tests" }, { class: "command", ref: "run_checks" }]);
  assert.equal(lie?.block, true);
  assert.match(lie?.reason ?? "", /"run_tests" \(test\) cites run_tests, which has not run in this session/);
  assert.match(lie?.reason ?? "", /"run_checks" \(command\) cites run_checks, which has not run/);
  assert.equal(await call([{ class: "file", ref: "src.txt" }]), undefined, "only test and command claims are preflighted here; files are the closeout gate's");

  // Ran and failed.
  await handlers.get("tool_result")!({ type: "tool_result", toolName: "run_tests", toolCallId: "t1", input: {}, content: [], details: { pass: 0, fail: 1 }, isError: false }, ctx);
  const failed = await call([{ class: "test", ref: "run_tests" }]);
  assert.match(failed?.reason ?? "", /did not pass; a report cannot cite it/);

  // Ran and passed, then the tree changed: stale.
  await handlers.get("tool_result")!({ type: "tool_result", toolName: "run_tests", toolCallId: "t2", input: {}, content: [], details: { pass: 1, fail: 0 }, isError: false }, ctx);
  assert.equal(await call([{ class: "test", ref: "run_tests" }]), undefined, "fresh, clean, passing: the report may proceed to the contract check");
  await writeFile(path.join(repo, "src.txt"), "edited\n");
  const stale = await call([{ class: "test", ref: "run_tests" }]);
  assert.match(stale?.reason ?? "", /the tree is now at \w{7} with uncommitted changes — commit, run run_tests again, then report/);
  await gitExec("git", ["commit", "-qam", "edit"], { cwd: repo });
  const moved = await call([{ class: "test", ref: "run_tests" }]);
  assert.match(moved?.reason ?? "", /run_tests ran at \w{7}; the tree is now at \w{7} — commit, run run_tests again/);
  await handlers.get("tool_result")!({ type: "tool_result", toolName: "run_tests", toolCallId: "t3", input: {}, content: [], details: { pass: 1, fail: 0 }, isError: false }, ctx);
  assert.equal(await call([{ class: "test", ref: "run_tests" }]), undefined);
  assert.equal(await handlers.get("tool_call")!({ type: "tool_call", toolName: "write", toolCallId: "w", input: { path: "x" } }, ctx), undefined, "other tools are not the preflight's business");
});

test("checkpoint 8 loads into a real Pi session with the provenance entry type registered", async (t) => {
  const repo = await initRepo(t);
  const agentDir = path.join(repo, "agent-config");
  const settingsManager = SettingsManager.inMemory();
  const loader = new DefaultResourceLoader({
    cwd: repo, agentDir, settingsManager, additionalExtensionPaths: [fileURLToPath(new URL("./cp8-evidence.js", import.meta.url))],
    noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
  });
  await loader.reload();
  assert.deepEqual(loader.getExtensions().errors, []);
  const modelRuntime = await ModelRuntime.create({
    authPath: path.join(agentDir, "auth.json"), modelsPath: null, modelsStorePath: path.join(agentDir, "models-cache.json"),
    allowModelNetwork: false, refreshOnCreate: false,
  });
  const { session, extensionsResult } = await createAgentSession({ cwd: repo, agentDir, settingsManager, modelRuntime, sessionManager: SessionManager.inMemory(repo), resourceLoader: loader });
  t.after(() => session.dispose());
  await session.bindExtensions({});
  assert.equal(extensionsResult.extensions.length, 1);
  assert.equal(PROVENANCE_ENTRY_TYPE, "regulator:evidence-provenance");
});
