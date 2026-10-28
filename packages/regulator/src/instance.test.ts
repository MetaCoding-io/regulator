import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { ExecutionStore, INSTANCE_MANIFEST_RELATIVE_PATH, ObligationLedger } from "@metacoding.io/regulator-core";
import type { WorkContract } from "@metacoding.io/regulator-protocol";
import { driveUnit } from "./controller.js";
import { gitExec } from "./git-support.js";
import { doctor, initInstance, readManifest, upgradeInstance } from "./instance.js";
import { LAB_ROOT } from "./workload.js";
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
  assert.equal(result.manifest.definition.registry, 52);
  assert.match(result.manifest.definition.harnessRevision, /^[0-9a-f]{40}$/);
  assert.deepEqual(await readManifest(repo), result.manifest);
  assert.match(await readFile(path.join(repo, ".gitignore"), "utf8"), /^\.regulator\/\n$/);
  assert.match(await readFile(path.join(repo, "regulator/identity/INVARIANTS.md"), "utf8"), /INV-001/);
  // Advice is seeded beside identity (#110): one file per declared profile, committed with it, and doctor sees both.
  assert.deepEqual((await readdir(path.join(repo, "regulator/advice"))).sort(), ["auditor.md", "bookkeeper.md", "implement.md", "intelligence.md", "manager.md", "research.md"]);
  assert.equal(await readFile(path.join(repo, "regulator/advice/implement.md"), "utf8"), await readFile(path.join(LAB_ROOT, "advice/implement.md"), "utf8"));
  const tracked = (await gitExec("git", ["ls-files", "regulator/"], { cwd: repo })).stdout.trim().split("\n");
  assert.ok(tracked.includes("regulator/advice/implement.md") && tracked.includes("regulator/identity/INVARIANTS.md"), "both harness-owned directories are committed by init");
  const report = await doctor(gitExec, { repo, now: () => clock });
  const advice = report.checks.find((c) => c.name === "advice");
  assert.deepEqual([advice?.ok, advice?.detail, advice?.warning], [true, "regulator/advice/ present: 6 file(s) for auditor, bookkeeper, implement, intelligence, manager, research", undefined]);
  const reach = report.checks.find((c) => c.name === "manifest-writable");
  assert.deepEqual([reach?.ok, reach?.detail], [true, "no manifest prefix reaches a declared tool's guarded output (place_trade: trades/pending/)"], "the manifest's prefixes (lib/, test/) reach no declared tool's outputs");
});

test("doctor refuses an instance manifest whose writable prefixes reach a declared tool's guarded output (#121): the prefixes replace a writing profile's in the session, so a plain write there would need no yes and the consent the gate derives from the tool's effect would be bypassed — the line to drop is named, since upgrade never rewrites a person's declaration", async (t) => {
  const repo = await unfamiliarRepo(t);
  await initInstance(gitExec, { repo, writablePaths: ["lots/", "targets/", "trades/proposed/", "trades/pending/", "reports/"], by: "alice", now: () => clock });
  const report = await doctor(gitExec, { repo, now: () => clock, today: "2026-09-22" });
  const reach = report.checks.find((c) => c.name === "manifest-writable")!;
  assert.equal(reach.ok, false);
  assert.match(reach.detail, /^the manifest declares "trades\/pending\/" writable, which reaches place_trade's output "trades\/pending\/": a unit's plain write there needs no yes, so the consent the gate derives from the tool's irreversible effect is bypassed\. Remove the prefix from \.regulator\/instance\.json by hand/);
  assert.ok(report.problems >= 1);
  const above = await doctor(gitExec, { repo: await (async () => { const r = await unfamiliarRepo(t); await initInstance(gitExec, { repo: r, writablePaths: ["trades/"], by: "alice", now: () => clock }); return r; })(), now: () => clock, today: "2026-09-22" });
  assert.equal(above.checks.find((c) => c.name === "manifest-writable")?.ok, false, "a prefix above the output reaches it");
});

test("doctor says when the instance's identity set is over its context budget (#51): the identity check passes with a warning that names the size, the limit and the files cut, `--json` carries it, and nothing is a problem", async (t) => {
  const repo = await unfamiliarRepo(t);
  await initInstance(gitExec, { repo, writablePaths: ["lib/", "test/"], by: "alice", now: () => clock });
  const commit = async (message: string) => { for (const args of [["add", "-A"], ["commit", "--quiet", "-m", message]]) await gitExec("git", args, { cwd: repo }); };
  let report = await doctor(gitExec, { repo, now: () => clock, today: "2026-09-22" });
  const identity = () => report.checks.find((c) => c.name === "identity")!;
  /** Warnings other than the definition check's own. */
  const instanceWarnings = () => report.checks.filter((c) => c.warning && c.name !== "definition").length;
  assert.equal(identity().ok, true);
  assert.match(identity().detail, /^regulator\/identity\/ present: 4 invariant\(s\), renders to \d{4} of 12000 characters$/);
  assert.equal(identity().warning, undefined);
  assert.equal(instanceWarnings(), 0);

  const boundaries = path.join(repo, "regulator/identity/BOUNDARIES.md");
  await writeFile(boundaries, `${await readFile(boundaries, "utf8")}\n${"- A boundary, restated at length so the set is longer than a prompt carries.\n".repeat(120)}`);
  await commit("a longer identity");
  report = await doctor(gitExec, { repo, now: () => clock, today: "2026-09-22" });
  assert.equal(identity().ok, true, "a long set is valid");
  assert.match(identity().warning ?? "", /^the identity set renders to \d+ characters and a unit's prompt carries 12000: \d+ character\(s\) of BOUNDARIES\.md, GLOSSARY\.md are advice the model never sees\. Shorten the set, or raise `identity\.maxChars` in the budget policy; the files are authoritative either way\.$/);
  assert.equal(instanceWarnings(), 1);
  assert.equal(report.warnings, report.checks.filter((c) => c.warning).length, "the report counts them");
  assert.equal(report.problems, 0, "a warning refuses nothing");
  assert.match(JSON.stringify(report), /"warning":"the identity set renders to/);
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
  // says repair, and attempt 2 makes the same change in the glossary's words — and says "task" in its commit message, which the
  // software workload made advisory (#47): recorded, not refused.
  const hints: Array<string | undefined> = [];
  const { final: outcome, decisions } = await driveUnit(gitExec, { ...base, contract, dispatcher: async (r) => {
    hints.push(r.hint);
    await writeFile(path.join(r.worktree, "lib", "greet.js"), `// ${r.attempt === 1 ? "task" : "unit g1"}: shout\nexport function greet(name) { return \`HI ${"$"}{name}\`; }\n`);
    await writeFile(path.join(r.worktree, "test", "greet.test.js"), 'import test from "node:test"; import assert from "node:assert/strict"; import { greet } from "../lib/greet.js"; test("greet", () => assert.equal(greet("x"), "HI x"));\n');
    await gitExec("git", ["commit", "-qam", r.attempt === 1 ? "g1: shout (attempt 1)" : "g1: shout, task done (attempt 2)"], { cwd: r.worktree });
    await store.writeReport(report(r.attempt));
    return {};
  } });
  assert.deepEqual(decisions.map((d) => [d.cause, d.action]), [["check-failure", "repair"]]);
  assert.match(hints[1] ?? "", /glossary-lint — the glossary's words drifted on the branch: comment "\/\/ task: shout": task \(say unit\)/);
  assert.equal(outcome.status, "closed", JSON.stringify(outcome));
  assert.deepEqual(outcome.status === "closed" ? outcome.preMerge : undefined, { verdict: "pass", sha: (await gitExec("git", ["rev-parse", "HEAD"], { cwd: repo })).stdout.trim(), reasons: [] }, "the merged tree was checked with the discovered npm test script before it landed, and what landed is the trial commit");
  assert.match(await readFile(path.join(repo, "lib", "greet.js"), "utf8"), /HI/);
  const evidence = (await new (await import("@metacoding.io/regulator-core")).AuditLog(repo).forUnit("g1")).evidence;
  assert.deepEqual(evidence.filter((r) => r.check.startsWith("pre-merge:")).map((r) => [r.check, r.verdict, r.revision.startsWith(outcome.status === "closed" ? outcome.sha : "-")]), [["pre-merge:run_checks:syntax:lib/greet.js", "pass", true], ["pre-merge:run_tests", "pass", true]]);
  assert.deepEqual((await evidence.filter((r) => r.attempt === 2 && !r.check.startsWith("pre-merge:")).map((r) => r.check)), ["run_checks:syntax:lib/greet.js", "run_tests", "inherited-tests", "identity-untouched", "export-signature", "glossary-lint"], "the workload's checks, under the project's own conventions");
  assert.equal((await new ObligationLedger(repo).open()).filter((o) => o.blocks).length, 0);
  const lint = evidence.find((r) => r.attempt === 2 && r.check === "glossary-lint")!;
  assert.equal(lint.verdict, "pass", "the commit-message word is advisory under this workload");
  assert.match(lint.observation, /; 1 hit\(s\) in commit messages, which this workload made advisory: commit "g1: shout, task done \(attempt 2\)": task \(say unit\)$/);
  const { readSignals } = await import("@metacoding.io/regulator-core");
  const advisories = (await readSignals(repo)).filter((s) => s.kind === "audit-finding" && s.severity === "advisory");
  assert.deepEqual(advisories.map((s) => [s.unit, s.subject]), [["g1", "unit g1: glossary-lint saw drift the workload made advisory"]]);
  assert.match((advisories[0] as { observation: string }).observation, /^1 hit\(s\) in commit messages, which this workload made advisory/);
});

/** The definition's revision at the v0.1.3 tag: what a manifest written by 0.1.3's init recorded. */
const REV_0_1_3 = "5115ea2144b89d07a3b943ab2e2f247ea8f896eb";

test("the definition upgrade (#53): an instance initialized as 0.1.3 left it — a manifest without a package version, no regulator/advice/ — is carried to the installed definition by `upgrade`: the advice set is seeded and committed, a file that exists is never overwritten, the manifest carries the version and one history entry naming the report it was checked against, doctor is green after, and a second run changes nothing and says so", async (t) => {
  const repo = await unfamiliarRepo(t);
  await initInstance(gitExec, { repo, writablePaths: ["lib/", "test/"], by: "alice", now: () => clock });
  const git = async (...args: string[]) => { const r = await gitExec("git", args, { cwd: repo }); if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`); return r.stdout.trim(); };
  // As 0.1.3 would have left it: identity seeded and committed, the ignore line, and a manifest with no package version at 0.1.3's revision; advice was not a file set yet.
  // One advice file is kept with a person's edit, to show a file that exists is never touched.
  await git("rm", "-rq", "--", "regulator/advice/auditor.md", "regulator/advice/bookkeeper.md", "regulator/advice/intelligence.md", "regulator/advice/manager.md", "regulator/advice/research.md");
  await writeFile(path.join(repo, "regulator/advice/implement.md"), "- Decided here: say so in your summary.\n");
  await git("commit", "-qam", "as 0.1.3 left it, with one advice file decided locally");
  const written = (await readManifest(repo))!;
  const asOf013 = { ...written, definition: { root: written.definition.root, name: written.definition.name, registry: 43, harnessRevision: REV_0_1_3, pi: written.definition.pi } };
  await writeFile(path.join(repo, INSTANCE_MANIFEST_RELATIVE_PATH), `${JSON.stringify(asOf013, null, 2)}\n`, "utf8");
  assert.equal((await readManifest(repo))!.definition.packageVersion, undefined, "a 0.1.3 manifest validates and carries no package version");
  let report = await doctor(gitExec, { repo, now: () => clock });
  const by = (name: string) => report.checks.find((c) => c.name === name)!;
  assert.match(by("manifest").detail, /; package version not recorded \(a manifest written before `regulator upgrade` existed\); never upgraded$/);
  assert.equal(by("definition-drift").ok, false);
  assert.match(by("definition-drift").detail, /initialized under 5115ea2 \(43 regulators, pi 0\.87\.0\); the definition is now [0-9a-f]{7} \(52, pi 0\.87\.0\) — the installed package 0\.1\.3 is newer than the manifest's \(none recorded\): run `regulator upgrade`$/);
  assert.equal(by("advice").ok, false, "doctor sees the missing advice files");
  const before = await git("rev-parse", "HEAD");

  // A dry run plans and changes nothing; it needs nobody.
  const dry = await upgradeInstance(gitExec, { repo, check: true, now: () => clock });
  assert.equal(dry.plan.outcome, "upgrade");
  if (dry.plan.outcome !== "upgrade") return;
  assert.deepEqual([dry.plan.from, dry.plan.fromUnversioned, dry.plan.to.packageVersion, dry.plan.crossed.map((n) => n.version)], [{ packageVersion: "0.1.3", harnessRevision: REV_0_1_3 }, true, "0.1.3", ["unreleased"]], "read as the floor, crossing the unreleased head's note");
  assert.deepEqual(dry.plan.steps.map((s) => [s.step, s.apply, s.step === "seed" ? s.files : undefined]), [["seed", false, []], ["seed", true, ["auditor.md", "bookkeeper.md", "intelligence.md", "manager.md", "research.md"]], ["ignore", false, undefined]]);
  assert.match(dry.notes, /^## unreleased \(head [0-9a-f]{7}\)\n {2}- advice advice\/<profile>\.md \[gate: regulator check only\]\n {4}A profile's advice is a file set seeded like identity \(#110\)/);
  assert.match(dry.notes, /- workload workload\/software-development\.json \[gate: scripted report 4a7daff51eb1…\]/, "a gate read from the note, never asserted here");
  assert.deepEqual([dry.applied, dry.committed, dry.evidence], [[], undefined, { report: "none" }], "no committed report ran at this revision, and the dry run says so");
  assert.equal(await git("rev-parse", "HEAD"), before);
  assert.deepEqual(await readManifest(repo), asOf013, "the manifest is untouched by a dry run");

  // Applying needs a person and a clean base.
  await assert.rejects(upgradeInstance(gitExec, { repo, now: () => clock }), /upgrade needs --by <who>/);
  await writeFile(path.join(repo, "scratch.txt"), "dirty\n");
  await assert.rejects(upgradeInstance(gitExec, { repo, by: "alice", now: () => clock }), /the base checkout has uncommitted changes; an upgrade is committed on its own/);
  await rm(path.join(repo, "scratch.txt"));

  const result = await upgradeInstance(gitExec, { repo, by: "alice", now: () => clock });
  assert.equal(result.plan.outcome, "upgrade");
  assert.deepEqual(result.applied.map((s) => s.step), ["seed"]);
  assert.ok(result.committed && result.committed !== before, "the seeded files are one commit on the base branch");
  assert.equal(await git("rev-parse", "HEAD"), result.committed);
  assert.equal(await git("status", "--porcelain"), "", "the base is clean after: nothing left unstaged");
  assert.match(await git("log", "-1", "--format=%s%n%b"), /^regulator upgrade: 0\.1\.3 → 0\.1\.3 by alice\n+Definition regulator 0\.1\.3@5115ea2 → 0\.1\.3@[0-9a-f]{7} \(52 regulators, pi 0\.87\.0\)\.\nSeeded from the definition, absent here: regulator\/advice\/auditor\.md, regulator\/advice\/bookkeeper\.md, regulator\/advice\/intelligence\.md, regulator\/advice\/manager\.md, regulator\/advice\/research\.md\.\nChecked against no committed report at this revision\./);
  assert.deepEqual((await readdir(path.join(repo, "regulator/advice"))).sort(), ["auditor.md", "bookkeeper.md", "implement.md", "intelligence.md", "manager.md", "research.md"]);
  assert.equal(await readFile(path.join(repo, "regulator/advice/manager.md"), "utf8"), await readFile(path.join(LAB_ROOT, "advice/manager.md"), "utf8"), "seeded byte for byte");
  assert.equal(await readFile(path.join(repo, "regulator/advice/implement.md"), "utf8"), "- Decided here: say so in your summary.\n", "the file a person decided is exactly as they left it");
  assert.match(await readFile(path.join(repo, "regulator/identity/INVARIANTS.md"), "utf8"), /INV-001/);
  const tracked = (await git("ls-files", "regulator/advice")).split("\n");
  assert.equal(tracked.length, 6, "every advice file is committed");
  const upgraded = (await readManifest(repo))!;
  assert.equal(upgraded.definition.packageVersion, "0.1.3");
  assert.equal(upgraded.definition.registry, 52);
  assert.match(upgraded.definition.harnessRevision, /^[0-9a-f]{40}$/);
  assert.notEqual(upgraded.definition.harnessRevision, REV_0_1_3);
  assert.deepEqual(upgraded.upgrades, [{ from: { packageVersion: "0.1.3", harnessRevision: REV_0_1_3 }, to: { packageVersion: "0.1.3", harnessRevision: upgraded.definition.harnessRevision }, report: "none", by: "alice", at: "2026-09-22T12:00:00.000Z" }]);
  assert.deepEqual([upgraded.initializedAt, upgraded.initializedBy, upgraded.writablePaths], [written.initializedAt, "alice", ["lib/", "test/"]], "what init wrote stays");
  assert.deepEqual(result.manifest, upgraded);

  report = await doctor(gitExec, { repo, now: () => clock });
  assert.equal(report.problems, 0, JSON.stringify(report.checks.filter((c) => !c.ok)));
  assert.match(by("manifest").detail, /; package 0\.1\.3; upgraded 1× — last 2026-09-22 by alice, 0\.1\.3@5115ea2 → 0\.1\.3@[0-9a-f]{7}, checked against no report$/);
  assert.equal(by("definition-drift").detail, "the instance was initialized under this definition revision");
  assert.equal(by("advice").ok, true);

  // A second run: nothing crossed, nothing absent, nothing written.
  const again = await upgradeInstance(gitExec, { repo, by: "alice", now: () => clock });
  assert.equal(again.plan.outcome, "current");
  assert.match((again.plan as { detail: string }).detail, /^the instance is at 0\.1\.3 \([0-9a-f]{7}\), which is the installed definition; nothing to do$/);
  assert.deepEqual([again.applied, again.committed, again.manifest], [[], undefined, upgraded]);
  assert.equal(await git("rev-parse", "HEAD"), result.committed);
  assert.deepEqual(await readManifest(repo), upgraded, "the manifest is byte-for-byte what the first run wrote");
});
