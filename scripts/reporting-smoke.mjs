// Model-free completion evidence. Host grants here are test fixtures, never model input.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { createRegulatorPiExtension } from "../packages/regulator-pi/dist/write-gate.js";
import { RegulatoryEventStore, VSM_DATABASE_RELATIVE_PATH } from "../packages/core/dist/index.js";

const examples = JSON.parse(await readFile(new URL("../fixtures/reporting/examples.json", import.meta.url), "utf8"));
export async function runReportingSmoke() {
  const cwd = await mkdtemp(path.join(tmpdir(), "vsm-reporting-smoke-"));
  let session;
  try {
    const agentDir = path.join(cwd, "agent-config");
    const settingsManager = SettingsManager.inMemory();
    let authority = examples[0].authority;
    const loader = new DefaultResourceLoader({
      cwd, agentDir, settingsManager,
      extensionFactories: [createRegulatorPiExtension({
        resolveReportingContext: () => ({ authority, unit: "example-unit", sourceRevision: "example-revision" }),
      })],
      noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
    });
    await loader.reload();
    assert.deepEqual(loader.getExtensions().errors, []);
    const modelRuntime = await ModelRuntime.create({
      authPath: path.join(agentDir, "auth.json"), modelsPath: null,
      modelsStorePath: path.join(agentDir, "models-cache.json"),
      allowModelNetwork: false, refreshOnCreate: false,
    });
    ({ session } = await createAgentSession({
      cwd, agentDir, settingsManager, modelRuntime, resourceLoader: loader,
      sessionManager: SessionManager.inMemory(cwd), tools: examples.map((example) => example.tool),
    }));
    await session.bindExtensions({});
    const tools = new Map(session.agent.state.tools.map((tool) => [tool.name, tool]));
    assert.equal(tools.size, 3);
    await assert.rejects(tools.get(examples[1].tool).execute("ordinary-audit", examples[1].payload), /authority denied/);
    await assert.rejects(tools.get(examples[2].tool).execute("smuggled-source", { ...examples[2].payload, source: "S5" }), /closed runtime schema/);
    assert.equal(existsSync(path.join(cwd, VSM_DATABASE_RELATIVE_PATH)), false);

    const receipts = [];
    for (const [index, example] of examples.entries()) {
      authority = example.authority;
      const result = await tools.get(example.tool).execute(`smoke-call-${index}`, example.payload);
      assert.equal(result.details.status, "persisted");
      receipts.push(result.details);
    }
    const reopened = new RegulatoryEventStore(cwd);
    const rows = reopened.readAll();
    reopened.close();
    assert.equal(rows.length, 3);
    assert.deepEqual(rows.map((row) => row.receipt), receipts);
    assert.equal(rows[1].event.message.source, "S3*");
    assert.equal(rows[2].event.message.channel, "signal");
    assert.equal(rows[2].event.message.destination, "S3");
    assert.equal(existsSync(path.join(cwd, ".gsd/gsd.db")), false);
    return {
      database: VSM_DATABASE_RELATIVE_PATH,
      examples: rows.map((row, index) => ({ tool: examples[index].tool, payload: examples[index].payload, ...row })),
      checks: { ordinaryAuditDenied: true, smuggledAuthorityRejected: true, persistedRows: rows.length, gsdDatabaseAbsent: true },
    };
  } finally {
    session?.dispose();
    await rm(cwd, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await runReportingSmoke(), null, 2));
}
