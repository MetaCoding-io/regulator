import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { checkDefinition } from "./definition.js";

async function write(root: string, file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), typeof value === "string" ? value : JSON.stringify(value), "utf8");
}

test("checkDefinition: the declaration is checked as a whole — every file validates and the references between them resolve; what is missing is named", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-definition-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const empty = await checkDefinition(dir);
  assert.deepEqual(empty.problems.map((p) => p.message).slice(0, 2), ["no profiles declared: the definition grants no capabilities", "no workload declared"]);
  assert.ok(empty.problems.some((p) => p.file === "identity/" && /INVARIANTS\.md is missing/.test(p.message)));

  await write(dir, "profiles/research.json", { name: "research", description: "Read-only.", tools: ["read", "run_tests"], writablePaths: [], advice: [] });
  await write(dir, "profiles/implement.json", { name: "implementer", description: "d", tools: ["write"], writablePaths: ["src/"], advice: [] });
  await write(dir, "workload/sd.json", { name: "sd", version: 1, description: "d", unitTypes: [{ name: "implement", description: "d", profile: "implement", checks: ["run_tests", "lint"], requiresContract: true }, { name: "plan", description: "d", profile: "nope", checks: [], requiresContract: false }] });
  await write(dir, "policies/default.json", { name: "default", version: 1, description: "d", budgets: { default: { tokens: 1, wallClockMs: 1, turns: 1, attempts: 1 }, byUnitType: { deploy: { tokens: 2 } } }, models: { default: { primary: "a/b", fallback: [] } } });
  await write(dir, "policies/routing.json", { name: "routing", version: 1, description: "d", rules: [], impactSeverity: { low: "info", medium: "advisory", high: "blocking", critical: "critical" }, recovery: { remediate: "S3", replan: "S3", clarify: "human", pause: "human", escalate: "human" }, blocksAtOrAbove: "blocking", floors: [{ pattern: "(", severity: "blocking", reason: "r" }] });
  await write(dir, "policies/odd.json", { name: "odd" });
  for (const name of ["IDENTITY.md", "GLOSSARY.md", "BOUNDARIES.md"]) await write(dir, `identity/${name}`, "# x\n\ntext\n");
  await write(dir, "identity/INVARIANTS.md", "## INV-001 — One\n\nstatement\n");

  const checked = await checkDefinition(dir);
  assert.deepEqual(checked.problems.map((p) => `${p.file}: ${p.message}`), [
    "profiles/implement.json: declares profile \"implementer\"; the file name must match",
    "profiles/research.json: says read-only but grants run_tests, whose effects are not read-only",
    "workload/sd.json: unit type \"implement\" runs under profile \"implement\", which is not declared under profiles/",
    "workload/sd.json: unit type \"implement\" names check \"lint\", which the host does not run (known: run_tests, run_checks, identity-untouched, export-signature, glossary-lint, inherited-tests)",
    "workload/sd.json: unit type \"plan\" runs under profile \"nope\", which is not declared under profiles/",
    "policies/default.json: names unit type \"deploy\", which no workload declares",
    "policies/odd.json: Invalid policy odd.json (not a budget, recovery, routing or interaction policy): payload does not match the closed runtime schema.",
    "policies/routing.json: floor pattern \"(\" is not a regular expression",
    "policies/: no recovery policy declared",
    "policies/: no interaction policy declared: nothing says how long to wait for a person or who may answer",
  ]);
  assert.deepEqual(checked.identity.invariants.map((i) => i.id), ["INV-001"]);
  assert.equal(checked.profiles.length, 2, "a profile with a naming problem is still loaded; the problem is reported");
});
