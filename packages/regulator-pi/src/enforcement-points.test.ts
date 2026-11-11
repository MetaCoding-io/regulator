import assert from "node:assert/strict";
import test from "node:test";
import { ENFORCEMENT_POINTS } from "@metacoding.io/regulator-protocol";
import { LAB_ROOT, loadDeclaredToolsSync } from "@metacoding.io/regulator";
import { EXTENSIONS } from "./dispatcher.js";
import { mockPi } from "./test-support.js";

test("the host's enforcement points are what the host exposes (#76): every event a unit session's extension subscribes to is in the list and nothing else is, `dispatcher` aside; every tool they register is the tool list — with the tools the definition's workloads declare (#121) standing under the one point `declared`, since their names are the workload's, not the host's", async () => {
  const events = new Set<string>();
  const tools = new Set<string>();
  for (const name of EXTENSIONS) {
    const { pi, handlers, tools: registered } = mockPi();
    const mod = (await import(`./${name}.js`)) as { default: (pi: unknown) => void };
    mod.default(pi);
    for (const event of handlers.keys()) events.add(event);
    for (const tool of registered.keys()) tools.add(tool);
  }
  const listed = ENFORCEMENT_POINTS.host.filter((p) => p !== "dispatcher");
  assert.deepEqual([...listed].sort(), [...events].sort(), "the host list is the subscribed events, plus dispatcher");
  const declared = new Set(loadDeclaredToolsSync(LAB_ROOT).map((d) => d.tool.name));
  assert.ok(declared.size > 0 && [...declared].every((t) => tools.has(t)), "the declared-tools extension registers every tool the definition declares");
  assert.deepEqual([...ENFORCEMENT_POINTS.tool].filter((p) => p !== "declared").sort(), [...tools].filter((t) => !declared.has(t)).sort(), "the tool list is what the extensions register, the declared ones under `declared`");
  assert.ok((ENFORCEMENT_POINTS.tool as readonly string[]).includes("declared"));
});
