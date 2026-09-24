import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import type { ResultReportInput, WorkContract } from "@metacoding/regulator-protocol";
import { ExecutionStore, UNITS_RELATIVE_DIR } from "@metacoding/regulator-core";
import { CONTRACT_ENTRY_TYPE, CONTRACT_SECTION_TAG, REPORT_ENTRY_TYPE, createContractExtension, loadContract } from "./contract.js";
import { gitExec, initRepo , LAB_ROOT } from "@metacoding/regulator";
import { ctxFor, mockPi } from "./test-support.js";
import { startUnit } from "@metacoding/regulator";



async function contractFor(repo: string, unitId = "u1"): Promise<{ contract: WorkContract; file: string }> {
  const contract = await loadContract(path.join(LAB_ROOT, "contracts", "underscore-unresolved.json"));
  const bound: WorkContract = { ...contract, unitId };
  const store = new ExecutionStore(repo);
  await store.createUnit(bound);
  return { contract: bound, file: path.join(repo, UNITS_RELATIVE_DIR, unitId, `contract.v${bound.version}.json`) };
}

const goodReport: ResultReportInput = {
  summary: "Left underscore behaviour as found; the decided tests pass.",
  evidence: [{ class: "test", ref: "node --test", observation: "3 pass, 1 fail (underscore-b)" }],
  delegatedResults: [{ decisionId: "d-helpers", choice: "no new helpers were needed" }],
  unresolvedOutcomes: [{ decisionId: "u-underscore", outcome: "surfaced", note: "underscore-a and underscore-b cannot both pass; the owner must choose" }],
  emergentDecisions: [],
  deviations: [],
  residualUncertainty: [],
};

test("contract extension: the contract becomes a typed entry and a prompt section; report_result refuses a silently settled decision and accepts a surfaced one, once", async (t) => {
  const repo = await initRepo(t);
  const { contract, file } = await contractFor(repo);
  const started = await startUnit(gitExec, { repo, unitId: "u1", owner: "alice" });
  const { pi, handlers, tools, flags, entries } = mockPi();
  flags.set("contract", file);
  createContractExtension({ now: () => 1_700_000_000_000 })(pi);
  const { ctx, statuses, notices } = ctxFor(started.worktree.path);
  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
  assert.equal(statuses.contract, "contract: tc-underscore v1");
  assert.deepEqual(entries, [{ customType: CONTRACT_ENTRY_TYPE, data: contract }]);

  const event = { type: "before_agent_start", prompt: "go", systemPrompt: "", systemPromptOptions: { sections: {} as Record<string, string> } };
  await handlers.get("before_agent_start")!(event, ctx);
  assert.match(event.systemPromptOptions.sections[CONTRACT_SECTION_TAG] ?? "", /UNRESOLVED[\s\S]*u-underscore/);

  const report = tools.get("report_result")!;
  const run = (input: ResultReportInput) => report.execute("call", input, undefined as never, undefined as never, ctx as never);
  await assert.rejects(run({ ...goodReport, unresolvedOutcomes: [] }), /u-underscore.*settled silently or forgotten/);
  await assert.rejects(run({ ...goodReport, delegatedResults: [] }), /delegated decision "d-helpers"/);
  await assert.rejects(run({ ...goodReport, evidence: [] }), /required evidence "e-tests"/);
  assert.equal(entries.length, 1, "a refused report leaves no entry");

  const accepted = await run(goodReport);
  assert.match((accepted.content[0] as { text: string }).text, /Report accepted for unit u1/);
  assert.equal(statuses.contract, "contract: tc-underscore v1 (reported)");
  assert.equal(entries[1]?.customType, REPORT_ENTRY_TYPE);
  const onDisk = JSON.parse(await readFile(path.join(repo, UNITS_RELATIVE_DIR, "u1", "report.v1.a1.json"), "utf8"));
  assert.equal(onDisk.contractId, "tc-underscore");
  assert.equal(onDisk.attempt, 1, "the host binds the report to the attempt");
  assert.equal(onDisk.reportedAt, "2023-11-14T22:13:20.000Z", "the host stamps the report");
  await assert.rejects(run(goodReport), /already reported/);

  await handlers.get("agent_end")!({ type: "agent_end", messages: [] }, ctx);
  assert.equal(notices.filter((n) => /has not called report_result/.test(n.message)).length, 0);
});

test("contract extension: no contract means no section and a refused tool; an invalid contract is refused at start", async (t) => {
  const repo = await initRepo(t);
  const none = mockPi();
  createContractExtension()(none.pi);
  const noneCtx = ctxFor(repo);
  await none.handlers.get("session_start")!({ type: "session_start", reason: "startup" }, noneCtx.ctx);
  assert.equal(noneCtx.statuses.contract, "contract: none");
  await assert.rejects(none.tools.get("report_result")!.execute("c", goodReport, undefined as never, undefined as never, noneCtx.ctx as never), /no work contract/);
  await none.handlers.get("agent_end")!({ type: "agent_end", messages: [] }, noneCtx.ctx);

  const bad = path.join(repo, "bad-contract.json");
  const { contract } = await contractFor(repo, "u9");
  await writeFile(bad, JSON.stringify({ ...contract, unresolved: [{ id: "x", subject: "s", reason: "r", handling: "resolve-before-execution" }] }), "utf8");
  const invalid = mockPi();
  invalid.flags.set("contract", bad);
  createContractExtension()(invalid.pi);
  const invalidCtx = ctxFor(repo);
  await invalid.handlers.get("session_start")!({ type: "session_start", reason: "startup" }, invalidCtx.ctx);
  assert.equal(invalidCtx.statuses.contract, "contract: invalid");
  assert.match(invalidCtx.notices[0]?.message ?? "", /must be resolved before execution/);
  assert.equal(invalid.entries.length, 0);
});

test("checkpoint 5 loads into a real Pi session with the contract supplied as an extension flag", async (t) => {
  const repo = await initRepo(t);
  const { file } = await contractFor(repo);
  const started = await startUnit(gitExec, { repo, unitId: "u1", owner: "alice" });
  const cwd = started.worktree.path;
  const agentDir = path.join(repo, "agent-config");
  const settingsManager = SettingsManager.inMemory();
  const loader = new DefaultResourceLoader({
    cwd, agentDir, settingsManager,
    additionalExtensionPaths: [fileURLToPath(new URL("./contract.js", import.meta.url))],
    noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
  });
  await loader.reload();
  assert.deepEqual(loader.getExtensions().errors, []);
  loader.getExtensions().runtime.flagValues.set("contract", file);
  const modelRuntime = await ModelRuntime.create({
    authPath: path.join(agentDir, "auth.json"), modelsPath: null, modelsStorePath: path.join(agentDir, "models-cache.json"),
    allowModelNetwork: false, refreshOnCreate: false,
  });
  const { session, extensionsResult } = await createAgentSession({
    cwd, agentDir, settingsManager, modelRuntime, sessionManager: SessionManager.inMemory(cwd), resourceLoader: loader,
  });
  t.after(() => session.dispose());
  await session.bindExtensions({});
  assert.ok(extensionsResult.extensions[0]?.tools.has("report_result"), "the report tool is registered");
  await session.waitForIdle();
  const entries = session.sessionManager.getEntries().filter((e) => e.type === "custom");
  assert.equal(entries.length, 1, "session_start appended the contract as a typed entry");
  assert.equal((entries[0] as { customType: string }).customType, CONTRACT_ENTRY_TYPE);
});
