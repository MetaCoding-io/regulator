import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { checkRegistry, loadRegistry, renderRegistryMarkdown } from "./registry.js";

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

test("check rejects a record that claims what it cannot show", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "regulator-registry-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "registry/regulators"), { recursive: true });
  const record = {
    id: "reg.control.example.v1", name: "Example", status: "active", vsmFunction: "S3",
    purpose: "x", absorbs: { failureClass: "f", description: "d" },
    mechanism: { level: "deterministic-gate", implementation: "src/missing.ts", enforcementPoints: ["tool_call"] },
    evidence: { tests: ["src/missing.test.ts"] },
    ownership: { owner: "o", introduced: "2026-09-21", reviewBy: "2026-12-01" },
  };
  await writeFile(path.join(root, "registry/regulators/example.json"), JSON.stringify(record));
  await writeFile(path.join(root, "registry/regulators/broken.json"), "{not json");
  await writeFile(path.join(root, "registry/regulators/shape.json"), JSON.stringify({ ...record, id: "bad id" }));
  const { problems, records } = await checkRegistry(path.join(root, "registry"), root);
  assert.equal(records.length, 1);
  const messages = problems.map((p) => p.message);
  assert.ok(messages.some((m) => m.startsWith("not valid JSON")));
  assert.ok(messages.some((m) => m.includes("does not match the regulator record schema")));
  assert.ok(messages.some((m) => m.includes("implementation not found: src/missing.ts")));
  assert.ok(messages.some((m) => m.includes("cited test not found: src/missing.test.ts")));
  assert.ok(messages.some((m) => m.includes("must state at least one limitation")));
});
