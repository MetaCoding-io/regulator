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

  await write(dir, "profiles/research.json", { name: "research", description: "Read-only.", tools: ["read", "run_tests"], writablePaths: [], advice: ["Report; do not change."] });
  await write(dir, "profiles/implement.json", { name: "implementer", description: "d", tools: ["write"], writablePaths: ["src/"] });
  await write(dir, "profiles/builder.json", { name: "builder", description: "d", tools: ["write"], writablePaths: ["src/"] });
  // Advice is a file set (#110): builder has its file (a long one, over the policy's cap); research carries the text twice; implementer has none; nobody is not a profile.
  await write(dir, "advice/builder.md", `- ${"Build small, build often. ".repeat(20).trim()}\n`);
  await write(dir, "advice/research.md", "- Report; do not change.\n");
  await write(dir, "advice/nobody.md", "- x\n");
  // A directory of the definition in no class of DEFINITION_WRITERS: nobody declared who writes it.
  await write(dir, "skills/review.md", "# a skill\n");
  await write(dir, "workload/sd.json", { name: "sd", version: 1, description: "d", unitTypes: [{ name: "implement", description: "d", profile: "implement", checks: ["run_tests", "lint", { name: "run_tests", options: { commitMessages: "advisory" } }], requiresContract: true }, { name: "plan", description: "d", profile: "nope", checks: [], requiresContract: false }, { name: "sketch", description: "d", profile: "research", checks: [], requiresContract: false }, { name: "build", description: "d", profile: "builder", checks: [], requiresContract: true }] });
  await write(dir, "policies/default.json", { name: "default", version: 1, description: "d", identity: { maxChars: 1000 }, advice: { maxChars: 100 }, budgets: { default: { tokens: 1, wallClockMs: 1, turns: 1, attempts: 1 }, byUnitType: { deploy: { tokens: 2 } } }, models: { default: { primary: "a/b", fallback: [] } } });
  await write(dir, "policies/routing.json", { name: "routing", version: 1, description: "d", rules: [], impactSeverity: { low: "info", medium: "advisory", high: "blocking", critical: "critical" }, recovery: { remediate: "S3", replan: "S3", clarify: "human", pause: "human", escalate: "human" }, blocksAtOrAbove: "blocking", floors: [{ pattern: "(", severity: "blocking", reason: "r" }] });
  await write(dir, "policies/odd.json", { name: "odd" });
  for (const name of ["IDENTITY.md", "GLOSSARY.md"]) await write(dir, `identity/${name}`, "# x\n\ntext\n");
  await write(dir, "identity/BOUNDARIES.md", `# x\n\n${"- a boundary, at length\n".repeat(60)}`);
  await write(dir, "identity/INVARIANTS.md", "## INV-001 — One\n\nstatement\n");

  const checked = await checkDefinition(dir);
  assert.deepEqual(checked.problems.map((p) => `${p.file}: ${p.message}`), [
    "profiles/implement.json: declares profile \"implementer\"; the file name must match",
    "profiles/research.json: says read-only but grants run_tests, whose effects are not read-only",
    "workload/sd.json: unit type \"implement\" runs under profile \"implement\", which is not declared under profiles/",
    "workload/sd.json: unit type \"implement\" names check \"lint\", which the host does not run (known: run_tests, run_checks, identity-untouched, export-signature, glossary-lint, inherited-tests)",
    "workload/sd.json: unit type \"implement\" gives check \"run_tests\" the option \"commitMessages\", which it does not take",
    "workload/sd.json: unit type \"plan\" runs under profile \"nope\", which is not declared under profiles/",
    "workload/sd.json: unit type \"sketch\" runs without a contract but its profile \"research\" grants run_tests, whose effects are not read-only: a unit no contract bounds may not write",
    "workload/sd.json: unit type \"build\" runs under a contract but its profile \"builder\" does not grant report_result: a contracted unit closes only by reporting, and the grant belongs in the declaration (the contract extension adds the tool as a backstop)",
    "policies/default.json: names unit type \"deploy\", which no workload declares",
    "policies/odd.json: Invalid policy odd.json (not a budget, recovery, routing or interaction policy): payload does not match the closed runtime schema.",
    "policies/routing.json: floor pattern \"(\" is not a regular expression",
    "policies/: no recovery policy declared",
    "policies/: no interaction policy declared: nothing says how long to wait for a person or who may answer",
    "advice/nobody.md: names no declared profile (declared: builder, implementer, research); an advice file is `<profile>.md` for a profile under profiles/",
    "profiles/research.json: carries advice inline and advice/research.md exists: move the text into the file, do not carry two copies",
    "advice/implementer.md: is missing: profile \"implementer\" declares no advice; every profile has an advice file (an empty one says the profile is told nothing beyond its grant)",
    "skills/: is a definition directory in no class of DEFINITION_WRITERS (identity, advice, declaration): declare who writes it, and through which path, before anything reads it",
  ]);
  assert.deepEqual(checked.warnings.map((w) => `${w.file}: ${w.message.slice(0, 60)}`), [
    "identity/: the identity set renders to 1761 characters and a unit's pro",
    "advice/builder.md: the advice for profile \"builder\" renders to 521 characters a",
  ], "the policy's identity.maxChars (1000) and advice.maxChars (100) are the limits the check measures against (#91, #110)");
  assert.deepEqual(checked.identity.invariants.map((i) => i.id), ["INV-001"]);
  assert.deepEqual(Object.keys(checked.advice.files).sort(), ["builder", "research"]);
  assert.equal(checked.profiles.length, 3, "a profile with a naming problem is still loaded; the problem is reported");
});

/**
 * Declared metrics (#129). A definition with one workload, `pf`, under a profile that resolves, so the only problems
 * about `workload/pf.json` and `evals/` are the ones the declaration and the suite earn.
 */
async function metricsDefinition(t: { after(fn: () => Promise<void>): void }, options: { metrics?: unknown[]; suiteMetrics?: unknown[]; otherWorkload?: boolean; report?: Record<string, unknown> } = {}): Promise<string[]> {
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-metrics-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await write(dir, "profiles/manager.json", { name: "manager", description: "d", tools: ["write", "report_result"], writablePaths: ["lots/"] });
  await write(dir, "advice/manager.md", "- x\n");
  await write(dir, "workload/pf/turnover.mjs", "process.stdout.write(JSON.stringify({ metric: 'workload:pf/turnover', value: 0 }));\n");
  const unitTypes = [{ name: "ingest", description: "d", profile: "manager", checks: ["run_tests"], requiresContract: true }];
  await write(dir, "workload/pf.json", { name: "pf", version: 1, description: "d", unitTypes, ...(options.metrics ? { metrics: options.metrics } : {}) });
  if (options.otherWorkload) await write(dir, "workload/other.json", { name: "other", version: 1, description: "d", unitTypes, metrics: [{ name: "workload:other/size", description: "d", kind: "count", direction: "none", grader: { argv: ["node", "workload/pf/turnover.mjs"] } }] });
  await write(dir, "contracts/p1.json", "{}");
  await mkdir(path.join(dir, "fixture-pf"), { recursive: true });
  if (options.suiteMetrics) {
    await write(dir, "evals/pf.json", {
      name: "pf", version: 1, description: "d", fixture: "fixture-pf", tasks: ["contracts/p1.json"],
      arms: [{ name: "control", description: "d", extensions: [], checks: ["run_tests"], identity: false }, { name: "treatment", description: "d", extensions: [], checks: ["run_tests"], identity: true }],
      repetitions: 1, metrics: options.suiteMetrics, baseline: "control",
    });
  }
  if (options.report) await write(dir, "evals/reports/pf.json", options.report);
  const checked = await checkDefinition(dir);
  return checked.problems.filter((p) => p.file === "workload/pf.json" || p.file.startsWith("evals/")).map((p) => `${p.file}: ${p.message}`);
}

const turnover = { name: "workload:pf/turnover", description: "the turnover the latest target implies", kind: "rate", direction: "lower", grader: { argv: ["node", "workload/pf/turnover.mjs"] } };

test("declared metrics: a workload's declaration with a grader file under the definition, pre-registered by a suite with one optimisation target, passes the definition check", async (t) => {
  assert.deepEqual(await metricsDefinition(t, { metrics: [turnover], suiteMetrics: ["closed", { name: "workload:pf/turnover", optimise: true }] }), []);
  assert.deepEqual(await metricsDefinition(t, { metrics: [turnover], suiteMetrics: ["closed", "workload:pf/turnover"] }), [], "nothing marked: everything is reported only");
  assert.deepEqual(await metricsDefinition(t, { metrics: [], suiteMetrics: ["closed", "attempts"] }), [], "a workload that declares nothing, and a suite of built-ins, are what they were");
});

test("refused: a suite that pre-registers a declared name the definition does not carry — by a workload that exists, by one that does not, and by an instrument, since no instrument record exists yet", async (t) => {
  assert.deepEqual(await metricsDefinition(t, { metrics: [turnover], suiteMetrics: ["closed", "workload:pf/taxCost", "workload:nope/turnover", "instrument:inst.judge.v1/brier"] }), [
    'evals/pf.json: pre-registers "workload:pf/taxCost", which workload "pf" does not declare (it declares workload:pf/turnover)',
    'evals/pf.json: pre-registers "workload:nope/turnover", which no workload declares (no workload "nope")',
    'evals/pf.json: pre-registers "instrument:inst.judge.v1/brier", an instrument\'s metric, and no instrument record declares it: the instrument record kind does not exist yet (open questions §4)',
  ]);
  assert.deepEqual(await metricsDefinition(t, { suiteMetrics: ["workload:pf/turnover"] }), ['evals/pf.json: pre-registers "workload:pf/turnover", which workload "pf" does not declare (it declares no metrics)']);
});

test("refused: a declared grader whose command names no file under the definition — the file is what the report fingerprints", async (t) => {
  assert.deepEqual(await metricsDefinition(t, { metrics: [{ ...turnover, grader: { argv: ["node", "workload/pf/missing.mjs"] } }] }), [
    'workload/pf.json: metric "workload:pf/turnover" declares the grader `node workload/pf/missing.mjs`, and no argument of it is a file under the definition: the grader\'s file is what the report fingerprints, and it is missing',
  ]);
  assert.deepEqual(await metricsDefinition(t, { metrics: [{ ...turnover, grader: { argv: ["git", "diff", "--stat"] } }] }), [
    'workload/pf.json: metric "workload:pf/turnover" declares the grader `git diff --stat`, and no argument of it is a file under the definition: the grader\'s file is what the report fingerprints, and it is missing',
  ], "a command with no file of its own has nothing a report can hash");
  assert.deepEqual(await metricsDefinition(t, { metrics: [{ ...turnover, grader: { argv: ["node", "../../etc/passwd"] } }] }).then((p) => p.length), 1, "a path outside the definition is not the definition's");
});

test("refused: a workload that declares the same metric twice, or a metric another workload or an instrument owns", async (t) => {
  assert.deepEqual(await metricsDefinition(t, { metrics: [turnover, { ...turnover, description: "again" }] }), ['workload/pf.json: declares metric "workload:pf/turnover" twice']);
  assert.deepEqual(await metricsDefinition(t, { metrics: [{ ...turnover, name: "workload:other/turnover" }, { ...turnover, name: "instrument:inst.judge.v1/brier" }], otherWorkload: true }), [
    'workload/pf.json: declares metric "workload:other/turnover", which belongs to workload "other": a declaration lives beside the workload that owns it',
    'workload/pf.json: declares metric "instrument:inst.judge.v1/brier", which belongs to instrument "inst.judge.v1": an instrument\'s metric is declared on its record',
  ]);
});

test("refused: a second optimisation target, and a built-in as the target — one declared metric to optimise, everything else reported only", async (t) => {
  const second = { ...turnover, name: "workload:pf/taxCost" };
  assert.deepEqual(await metricsDefinition(t, { metrics: [turnover, second], suiteMetrics: [{ name: "workload:pf/turnover", optimise: true }, { name: "workload:pf/taxCost", optimise: true }] }), [
    "evals/pf.json: marks 2 metrics optimise (workload:pf/turnover, workload:pf/taxCost): at most one declared metric is the optimisation target, and every other is reported only",
  ]);
  assert.deepEqual(await metricsDefinition(t, { metrics: [turnover], suiteMetrics: [{ name: "closed", optimise: true }, "workload:pf/turnover"] }), [
    'evals/pf.json: marks "closed" optimise, but a built-in is reported only: only a declared metric may be the optimisation target',
  ]);
  assert.deepEqual(await metricsDefinition(t, { metrics: [turnover], suiteMetrics: ["closed", "closed", "workload:pf/turnover"] }), ['evals/pf.json: pre-registers "closed" twice']);
});

test("refused: a judged metric — one with an instrument ref — until the instrument record exists with its held-out score; the record kind does not exist yet, so every judged metric waits", async (t) => {
  assert.deepEqual(await metricsDefinition(t, { metrics: [{ ...turnover, name: "workload:pf/viewQuality", kind: "score", direction: "higher", instrument: "inst.judge.consequential.v1" }] }), [
    'workload/pf.json: metric "workload:pf/viewQuality" is judged by instrument "inst.judge.consequential.v1", and no instrument record carries its held-out score: a judged metric waits on the record (open questions §4, #49)',
  ]);
});

test("a committed report over a declared suite version says the same optimisation target the suite marks", async (t) => {
  const fingerprint = { node: "v22", platform: "linux", arch: "x64", pi: "0.87.0", harnessRevision: "a".repeat(40), dispatcher: "scripted:manager", model: "none", registry: 1, policies: {} };
  const report = { suite: { name: "pf", version: 1 }, generatedAt: "t", fingerprint, arms: [], lifts: [], runs: [], interpretation: "read", interpretedBy: "alice" };
  assert.deepEqual(await metricsDefinition(t, { metrics: [turnover], suiteMetrics: [{ name: "workload:pf/turnover", optimise: true }], report }), [
    'evals/reports/pf.json: says the optimisation target was none, but suite pf v1 marks "workload:pf/turnover"',
  ]);
  assert.deepEqual(await metricsDefinition(t, { metrics: [turnover], suiteMetrics: [{ name: "workload:pf/turnover", optimise: true }], report: { ...report, suite: { ...report.suite, optimise: "workload:pf/turnover" } } }), []);
});
