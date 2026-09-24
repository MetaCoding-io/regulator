import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { ExecutionStore, INSTANCE_MANIFEST_RELATIVE_PATH, ObligationLedger } from "@metacoding/vsm-pi-core";
import type { WorkContract } from "@metacoding/vsm-pi-protocol";
import { driveUnit } from "./controller.js";
import { gitExec } from "./git-support.js";
import { doctor, initInstance, readManifest } from "./instance.js";
import { loadInteractionPolicy } from "./interaction-policy.js";
import { POLICY_PATH, loadPolicy } from "./policy.js";
import { loadRecoveryPolicy } from "./recovery-policy.js";
import { loadRoutingPolicy } from "./routing-policy.js";
import { startUnit } from "./unit.js";
import { loadWorkload } from "./workload.js";

/** An unfamiliar repository: `lib/` instead of `src/`, an npm test script, no `vendor/`, a committed `.env`. Nothing the lab's fixture assumed. */
async function unfamiliarRepo(t: TestContext): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-unfamiliar-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, "lib"));
  await mkdir(path.join(dir, "test"));
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "elsewhere", private: true, type: "module", scripts: { test: "node --test" } }));
  await writeFile(path.join(dir, "lib", "greet.js"), "export function greet(name) { return `hi ${name}`; }\n");
  await writeFile(path.join(dir, "test", "greet.test.js"), 'import test from "node:test"; import assert from "node:assert/strict"; import { greet } from "../lib/greet.js"; test("greet", () => assert.equal(greet("x"), "hi x"));\n');
  await writeFile(path.join(dir, ".env"), "DEPLOY_TOKEN=abcdef123456789\n");
  await writeFile(path.join(dir, "README.md"), "# elsewhere\n");
  for (const args of [["init", "--quiet", "-b", "trunk"], ["add", "-A"], ["commit", "--quiet", "-m", "init"]]) {
    const r = await gitExec("git", args, { cwd: dir });
    if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  }
  return dir;
}

const clock = Date.parse("2026-09-22T12:00:00.000Z");

test("the portability drill (lesson 15): the definition installs into an unfamiliar repository — identity seeded and committed, .regulator/ ignored, canaries recorded, the layout declared in the manifest — refuses a dirty tree and a second init, and doctor says what it found", async (t) => {
  const repo = await unfamiliarRepo(t);
  await writeFile(path.join(repo, "scratch.txt"), "dirty\n");
  await assert.rejects(initInstance(gitExec, { repo, writablePaths: ["lib/", "test/"], by: "alice", now: () => clock }), /uncommitted changes; init commits the identity on its own/);
  await rm(path.join(repo, "scratch.txt"));
  await assert.rejects(initInstance(gitExec, { repo, writablePaths: ["lib"], by: "alice" }), /"lib" is not a relative prefix ending in \//);
  const bare = await mkdtemp(path.join(tmpdir(), "regulator-not-a-repo-"));
  t.after(() => rm(bare, { recursive: true, force: true }));
  await assert.rejects(initInstance(gitExec, { repo: bare, by: "alice" }), /is not a git repository; init the repository first/);

  const result = await initInstance(gitExec, { repo, writablePaths: ["lib/", "test/"], protectedPaths: ["config/"], by: "alice", now: () => clock });
  assert.equal(result.canaries, 1, "the committed .env's token is a canary");
  assert.ok(result.committed, "the identity was committed");
  assert.deepEqual([result.manifest.version, result.manifest.definition.name, result.manifest.writablePaths, result.manifest.protectedPaths, result.manifest.initializedBy, result.manifest.initializedAt], [1, "regulator", ["lib/", "test/"], ["config/"], "alice", "2026-09-22T12:00:00.000Z"]);
  assert.equal(result.manifest.definition.pi, "0.87.0");
  assert.equal(result.manifest.definition.registry, 43);
  assert.match(result.manifest.definition.harnessRevision, /^[0-9a-f]{40}$/);
  assert.deepEqual(await readManifest(repo), result.manifest);
  assert.match(await readFile(path.join(repo, ".gitignore"), "utf8"), /^\.regulator\/\n$/);
  assert.match(await readFile(path.join(repo, "regulator/identity/INVARIANTS.md"), "utf8"), /INV-001/);
});

test("one unit end to end in the unfamiliar repository: the unit writes under lib/, the discovered npm test script and the declared prefixes verify it, glossary-lint reads the identity's refused words, and the merged base is checked after reintegration", async (t) => {
  const repo = await unfamiliarRepo(t);
  await initInstance(gitExec, { repo, writablePaths: ["lib/", "test/"], by: "alice", now: () => clock });
  const workload = await loadWorkload();
  const contract: WorkContract = {
    kind: "task", id: "tc-greet", version: 1, unitId: "g1", unitType: "implement", workload: { name: workload.name, version: workload.version },
    objective: "greet loudly", constraintRefs: [], fixed: [], delegated: [], unresolved: [],
    expectedEvidence: [
      { id: "e-tests", description: "the suite passes", class: "test", required: true }, { id: "e-checks", description: "checks pass", class: "command", required: true },
      // The contract changes greet's behaviour, so the inherited test that pins the old behaviour is the unit's to rewrite: exempt, by declaration.
      { id: "e-inherited", description: "the inherited suite, except the greet test this contract changes", class: "test", required: true, check: { kind: "inherited-tests", exempt: ["test/greet.test.js"] } },
    ],
    provenance: { createdBy: "S3", createdAt: "t" },
  };
  const base = { policy: await loadPolicy(), policyPath: POLICY_PATH, routing: await loadRoutingPolicy(), interaction: await loadInteractionPolicy(), recovery: await loadRecoveryPolicy(), workload, repo, owner: "alice", now: () => clock };
  const store = new ExecutionStore(repo, () => clock);
  const report = (attempt: number) => ({
    contractId: contract.id, contractVersion: 1, unitId: "g1", attempt, reportedAt: "t", summary: "done",
    evidence: [{ class: "test" as const, ref: "npm test", observation: "pass" }, { class: "command" as const, ref: "run_checks", observation: "pass" }],
    delegatedResults: [], unresolvedOutcomes: [], emergentDecisions: [], deviations: [], residualUncertainty: [],
  });
  // Attempt 1 writes a comment that calls the unit a task; the glossary's words are the identity's, seeded by init. The router
  // says repair, and attempt 2 makes the same change in the glossary's words.
  const hints: Array<string | undefined> = [];
  const { final: outcome, decisions } = await driveUnit(gitExec, { ...base, contract, dispatcher: async (r) => {
    hints.push(r.hint);
    await writeFile(path.join(r.worktree, "lib", "greet.js"), `// ${r.attempt === 1 ? "task" : "unit g1"}: shout\nexport function greet(name) { return \`HI ${"$"}{name}\`; }\n`);
    await writeFile(path.join(r.worktree, "test", "greet.test.js"), 'import test from "node:test"; import assert from "node:assert/strict"; import { greet } from "../lib/greet.js"; test("greet", () => assert.equal(greet("x"), "HI x"));\n');
    await gitExec("git", ["commit", "-qam", `g1: shout (attempt ${r.attempt})`], { cwd: r.worktree });
    await store.writeReport(report(r.attempt));
    return {};
  } });
  assert.deepEqual(decisions.map((d) => [d.cause, d.action]), [["check-failure", "repair"]]);
  assert.match(hints[1] ?? "", /glossary-lint — the glossary's words drifted on the branch: comment "\/\/ task: shout": task \(say unit\)/);
  assert.equal(outcome.status, "closed", JSON.stringify(outcome));
  assert.deepEqual(outcome.status === "closed" ? outcome.postMerge : undefined, { verdict: "pass", sha: outcome.status === "closed" ? outcome.sha : "", reasons: [] }, "the merged base was checked with the discovered npm test script");
  assert.match(await readFile(path.join(repo, "lib", "greet.js"), "utf8"), /HI/);
  const evidence = (await new (await import("@metacoding/vsm-pi-core")).AuditLog(repo).forUnit("g1")).evidence;
  assert.deepEqual(evidence.filter((r) => r.check.startsWith("post-merge:")).map((r) => [r.check, r.verdict, r.revision === (outcome.status === "closed" ? outcome.sha : "")]), [["post-merge:run_checks:syntax:lib/greet.js", "pass", true], ["post-merge:run_tests", "pass", true]]);
  assert.deepEqual((await evidence.filter((r) => r.attempt === 2 && !r.check.startsWith("post-merge:")).map((r) => r.check)), ["run_checks:syntax:lib/greet.js", "run_tests", "inherited-tests", "identity-untouched", "export-signature", "glossary-lint"], "the workload's checks, under the project's own conventions");
  assert.equal((await new ObligationLedger(repo).open()).filter((o) => o.blocks).length, 0);
});
