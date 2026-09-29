import assert from "node:assert/strict";
import test from "node:test";
import { ENFORCEMENT_POINTS } from "@metacoding.io/regulator-protocol";
import { EXTENSIONS } from "./dispatcher.js";
import { mockPi } from "./test-support.js";

test("the host's enforcement points are what the host exposes (#76): every event a unit session's extension subscribes to is in the list and nothing else is, `dispatcher` aside; every tool they register is the tool list", async () => {
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
  assert.deepEqual([...ENFORCEMENT_POINTS.tool].sort(), [...tools].sort(), "the tool list is what the extensions register");
});
