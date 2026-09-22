import assert from "node:assert/strict";
import test from "node:test";
import { isProfileName } from "./profiles.js";
import { loadWorkload, unitTypeOf } from "./workload.js";

test("the committed workload definition validates and only names profiles the lab declares", async () => {
  const workload = await loadWorkload();
  assert.equal(workload.name, "software-development");
  assert.deepEqual(workload.unitTypes.map((t) => t.name), ["plan", "implement", "verify", "integrate", "close"]);
  for (const type of workload.unitTypes) assert.ok(isProfileName(type.profile), `${type.name} runs under an undeclared profile "${type.profile}"`);
  assert.equal(unitTypeOf(workload, "implement")?.requiresContract, true);
  assert.equal(unitTypeOf(workload, "plan")?.profile, "research", "planning never changes the repository");
  assert.equal(unitTypeOf(workload, "deploy"), undefined);
});
