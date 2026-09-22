import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { checkRegistry, loadRegistry, renderRegistryMarkdown } from "@metacoding/vsm-pi-core";

const labRoot = fileURLToPath(new URL("../", import.meta.url));
const registryDir = path.join(labRoot, "registry");

test("the committed registry passes check: every record is well-formed, implemented, tested and bounded", async () => {
  const registry = await checkRegistry(registryDir, labRoot);
  assert.deepEqual(registry.problems, []);
  assert.deepEqual(registry.records.map((r) => r.id).sort(), ["reg.authority.vendor-write-gate.v1", "reg.control.profile-write-grant.v1"]);
});

test("REGULATORS.md is generated from the records and has not drifted", async () => {
  const { records } = await loadRegistry(registryDir);
  const committed = await readFile(path.join(registryDir, "REGULATORS.md"), "utf8");
  assert.equal(committed, renderRegistryMarkdown(records), "run `pnpm --filter @metacoding/vsm-pi-course-lab registry:docs`");
});
