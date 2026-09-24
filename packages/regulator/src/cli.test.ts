import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { promisify } from "node:util";
import { MemoryStore, ObligationLedger, appendSignal, routeMessages } from "@metacoding/vsm-pi-core";
import { gitExec, initRepo } from "./git-support.js";
import { loadRoutingPolicy } from "./routing-policy.js";
import { LAB_ROOT } from "./workload.js";

const run = promisify(execFile);
const CLI = fileURLToPath(new URL("./cli.js", import.meta.url));

/** `regulator …` in an instance, as a person would run it. */
async function regulator(cwd: string, ...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const r = await run(process.execPath, [CLI, ...args], { cwd, env: { ...process.env, GIT_AUTHOR_NAME: "lab", GIT_AUTHOR_EMAIL: "lab@example.invalid", GIT_COMMITTER_NAME: "lab", GIT_COMMITTER_EMAIL: "lab@example.invalid" } });
    return { code: 0, stdout: r.stdout, stderr: r.stderr };
  } catch (error) {
    const e = error as { code?: number; stdout?: string; stderr?: string };
    return { code: e.code ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

test("the S5 decision path: `identity accept` is the only writer of an identity file — it needs a proposal owed to S5, writes under S5 authority, refuses an invalid set, commits citing the obligation and resolves it as accepted; `identity reject` changes nothing", async (t) => {
  const repo = await initRepo(t);
  const ledger = new ObligationLedger(repo);
  await appendSignal(repo, { id: "p1", timestamp: "t", source: "S1", kind: "policy-proposal", channel: "proposal", destination: "S5", severity: "advisory", subject: "INV-005: no network from units", unit: "u1", rationale: "the fixture calls out", requestedChange: "add INV-005", evidence: [] });
  await appendSignal(repo, { id: "p2", timestamp: "t", source: "S1", kind: "policy-proposal", channel: "proposal", destination: "S5", severity: "info", subject: "rename src/", unit: "u1", rationale: "r", requestedChange: "x", evidence: [] });
  await appendSignal(repo, { id: "f1", timestamp: "t", source: "S3*", kind: "audit-finding", channel: "audit", destination: "S3", severity: "blocking", subject: "x", unit: "u1", observation: "o", evidence: [] });
  await routeMessages(ledger, { policy: await loadRoutingPolicy() });
  const [accept, reject, finding] = (await ledger.obligations()).map((o) => o.id);
  assert.equal((await ledger.get(accept!))?.severity, "blocking", "the proposal names an invariant: the routing floor raises it");

  // The proposed file lives outside the instance: an identity decision is committed on its own, and an untracked file in the base checkout would stop it.
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const outside = await mkdtemp(path.join(tmpdir(), "regulator-proposal-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  const proposed = path.join(outside, "proposed-INVARIANTS.md");
  const current = await readFile(path.join(repo, "regulator/identity/INVARIANTS.md"), "utf8");
  const before = (await gitExec("git", ["rev-parse", "HEAD"], { cwd: repo })).stdout.trim();

  // Not a proposal: refused.
  let r = await regulator(repo, "identity", "accept", finding!.slice(0, 8), "--by", "alice", "--file", "INVARIANTS.md", "--from", proposed, "--rationale", "x");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /is audit-finding owed to S3; `identity accept\|reject` decides proposals owed to S5/);

  // An invalid result is reverted, and the obligation stays open.
  await writeFile(proposed, "# nothing here\n");
  r = await regulator(repo, "identity", "accept", accept!.slice(0, 8), "--by", "alice", "--file", "INVARIANTS.md", "--from", proposed, "--rationale", "x");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /leaves the identity set invalid \(INVARIANTS\.md declares no invariant/);
  assert.equal(await readFile(path.join(repo, "regulator/identity/INVARIANTS.md"), "utf8"), current, "reverted");
  assert.equal((await ledger.get(accept!))?.status, "open");

  // The wrong file name is refused before anything is written.
  r = await regulator(repo, "identity", "accept", accept!.slice(0, 8), "--by", "alice", "--file", "AGENTS.md", "--from", proposed, "--rationale", "x");
  assert.equal(r.code, 2);
  assert.match(r.stderr, /--file must be one of IDENTITY\.md, INVARIANTS\.md, GLOSSARY\.md, BOUNDARIES\.md/);

  // The decision: a new invariant, committed on main, the obligation resolved as accepted with the commit.
  await writeFile(proposed, `${current}\n## INV-005 — Units do not reach the network\n\nNo unit opens a network connection; the fixture's publish step is a person's.\n\nChecked by: nothing yet — see docs/DEBT.md row 19.\n`);
  r = await regulator(repo, "identity", "accept", accept!.slice(0, 8), "--by", "alice", "--file", "INVARIANTS.md", "--from", proposed, "--rationale", "the fixture calls out and nothing should");
  assert.equal(r.code, 0, r.stderr);
  const after = (await gitExec("git", ["rev-parse", "HEAD"], { cwd: repo })).stdout.trim();
  assert.notEqual(after, before);
  assert.match(r.stdout, new RegExp(`^proposal ${accept!.slice(0, 8)} accepted by alice \\(S5\\): regulator/identity/INVARIANTS\\.md committed as ${after.slice(0, 7)} on main; the obligation is resolved as accepted`));
  const log = (await gitExec("git", ["log", "-1", "--format=%B"], { cwd: repo })).stdout;
  assert.match(log, new RegExp(`^S5: accept proposal ${accept!.slice(0, 8)} into regulator/identity/INVARIANTS\\.md\\n\\nDecided by alice under S5 authority\\. Obligation ${accept}\\.`));
  assert.match(await readFile(path.join(repo, "regulator/identity/INVARIANTS.md"), "utf8"), /## INV-005 — Units do not reach the network/);
  const state = await ledger.get(accept!);
  assert.equal(state?.status, "resolved");
  assert.equal(state?.disposition, "accepted");
  assert.match(state?.rationale ?? "", new RegExp(`regulator/identity/INVARIANTS\\.md changed in ${after.slice(0, 7)} on main under S5 authority`));
  assert.equal((await gitExec("git", ["status", "--porcelain"], { cwd: repo })).stdout.trim(), "", "committed, not left in the tree");

  r = await regulator(repo, "identity", "reject", reject!.slice(0, 8), "--by", "alice", "--rationale", "src/ is fine");
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /rejected by alice \(S5\): src\/ is fine; identity unchanged/);
  assert.equal((await ledger.get(reject!))?.disposition, "rejected");
  assert.equal((await gitExec("git", ["rev-parse", "HEAD"], { cwd: repo })).stdout.trim(), after, "a rejection commits nothing");
});

test("memory from the outside: `memory` lists current facts, `--all` shows expired and retracted ones, and a retraction is by name with a reason", async (t) => {
  const repo = await initRepo(t);
  const clock = Date.now();
  const store = new MemoryStore(repo, () => clock);
  const a = await store.record({ subject: "runner", note: "lacks docker", evidence: [], recordedBy: "alice", reviewBy: new Date(clock + 5 * 86_400_000).toISOString() });
  await store.record({ subject: "tests", note: "need FOO=1", evidence: [], recordedBy: "S1", unit: "u0", reviewBy: new Date(clock + 2 * 86_400_000).toISOString() });
  let r = await regulator(repo, "memory");
  assert.match(r.stdout, /^current {3}\w{8} {2}runner: lacks docker {2}\(by alice, \d{4}-\d{2}-\d{2} → review \d{4}-\d{2}-\d{2}\)\ncurrent {3}\w{8} {2}tests: need FOO=1 {2}\(by S1 in u0, /);
  r = await regulator(repo, "memory", "retract", a.id.slice(0, 8), "--by", "bob", "--reason", "docker arrived");
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /retracted by bob: docker arrived/);
  r = await regulator(repo, "memory");
  assert.match(r.stdout, /^current {3}\w{8} {2}tests: need FOO=1[\s\S]*1 shown of 2/, "the retracted entry is gone from the current view");
  r = await regulator(repo, "memory", "--all");
  assert.match(r.stdout, /retracted \w{8} {2}runner[\s\S]*retracted by bob: docker arrived[\s\S]*2 shown of 2/);
  r = await regulator(repo, "memory", "retract", "nope", "--by", "bob", "--reason", "x");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /no memory entry "nope"/);
});

test("the algedonic path from the outside (lesson 13): `answer` records a person's answer as the disposition and refuses an option the question did not offer; `remind` delivers what is due; every `--by` is checked against the interaction policy's people before anything is written", async (t) => {
  const repo = await initRepo(t);
  const ledger = new ObligationLedger(repo);
  const consent = await ledger.openObligation({ subject: "consent: force-push", unit: "u1", concern: "interaction", sources: ["ask:1"], severity: "blocking", consumer: "human", blocks: true, question: "May I force-push?", openedBy: "S1" });
  const choice = await ledger.openObligation({ subject: "choice: database", unit: "u1", concern: "interaction", sources: ["ask:2"], severity: "blocking", consumer: "human", blocks: true, question: "Which?", openedBy: "S1" });
  const critical = await ledger.openObligation({ subject: "algedonic: secrets in the log", unit: "u1", concern: "algedonic-signal", sources: ["a1"], severity: "critical", consumer: "human", blocks: true, openedBy: "S1" });
  const proposal = await ledger.openObligation({ subject: "rename src/", unit: "u1", concern: "policy-proposal", sources: ["p1"], severity: "advisory", consumer: "S5", blocks: false, openedBy: "S1" });
  const request = (id: string, kind: "consent" | "choice", obligationId: string, options?: string[]) =>
    ledger.requestInteraction({ id, kind, subject: "s", question: "q", ...(options ? { options } : {}), ...(kind === "consent" ? { action: "git push --force" } : {}), severity: "blocking", unit: "u1", attempt: 1, obligationId, evidence: [], raisedBy: "S1", raisedAt: "t", timeoutMs: 1000, channel: "none" }, "S1");
  await request("r1", "consent", consent.id);
  await request("r2", "choice", choice.id, ["sqlite", "postgres"]);

  // Delivery on demand: never delivered counts as due; a second run within the interval delivers nothing.
  let r = await regulator(repo, "remind");
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /^delivered open {9}human blocking veto {2}\w{8} {2}interaction {2}consent: force-push {2}\(unit u1\) {2}not delivered\n {6}question: May I force-push\?\ndelivered open[\s\S]*3 delivered\n$/, "owed to a person: the proposal owed to S5 is not delivered to a person");
  r = await regulator(repo, "remind");
  assert.equal(r.stdout, "0 delivered\n");
  r = await regulator(repo, "obligations");
  assert.match(r.stdout, /consent: force-push {2}\(unit u1\) {2}delivered ×1 \(outbox \d{4}-\d{2}-\d{2}T\d{2}:\d{2}\)/);

  // Authority before anything is written.
  r = await regulator(repo, "answer", consent.id.slice(0, 8), "--by", "mallory", "--answer", "yes");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /"mallory" is not a person the interaction policy \(interaction v1\) names; a name not listed may disposition nothing/);
  r = await regulator(repo, "obligation", "resolve", critical.id.slice(0, 8), "--by", "bob", "--disposition", "fixed", "--rationale", "rotated");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /bob may disposition up to blocking; this is critical/);
  r = await regulator(repo, "obligation", "resolve", choice.id.slice(0, 8), "--by", "bob", "--disposition", "accepted-risk", "--rationale", "fine");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /bob may not accept risk/);
  r = await regulator(repo, "identity", "reject", proposal.id.slice(0, 8), "--by", "bob", "--rationale", "x");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /bob may not act as S5/);
  r = await regulator(repo, "obligation", "ack", consent.id.slice(0, 8), "--by", "nobody");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /"nobody" is not a person/);
  assert.deepEqual((await ledger.obligations()).map((o) => o.status), ["open", "open", "open", "open"], "nothing was written");

  // The answer is the disposition. An option the question did not offer is refused; a consent that is not a yes is a rejection.
  r = await regulator(repo, "answer", choice.id.slice(0, 8), "--by", "bob", "--answer", "mysql");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /the question offers sqlite \| postgres; "mysql" is not one of them/);
  r = await regulator(repo, "answer", choice.id.slice(0, 8), "--by", "bob", "--answer", "postgres");
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout, "choice answered by bob (fixed): postgres; unit u1 may proceed if nothing else is owed on it, and the next attempt carries the answer\n");
  r = await regulator(repo, "answer", consent.id.slice(0, 8), "--by", "alice", "--answer", "no, rebase");
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /^consent answered by alice \(rejected\): no, rebase;/);
  r = await regulator(repo, "answer", consent.id.slice(0, 8), "--by", "alice", "--answer", "yes");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /is resolved/);
  r = await regulator(repo, "answer", critical.id.slice(0, 8), "--by", "alice", "--answer", "yes");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /is algedonic-signal, not a question a unit asked; use `obligation resolve`/);
  const states = await ledger.obligations();
  assert.deepEqual(states.map((o) => [o.status, o.closedBy, o.disposition, o.rationale]), [["resolved", "alice", "rejected", "no, rebase"], ["resolved", "bob", "fixed", "postgres"], ["open", undefined, undefined, undefined], ["open", undefined, undefined, undefined]]);
  assert.deepEqual((await ledger.interactions()).map((i) => i.answers.map((a) => [a.by, a.outcome, a.channel, a.answer])), [[["alice", "answered", "cli", "no, rebase"]], [["bob", "answered", "cli", "postgres"]]]);
  r = await regulator(repo, "obligation", "resolve", critical.id.slice(0, 8), "--by", "alice", "--disposition", "accepted-risk", "--rationale", "rotated; the log is private");
  assert.equal(r.code, 0, r.stderr);
});

test("assurance from the outside (lesson 14): `spans` projects the instance's records as redacted GenAI spans, `review --due` lists what the registry owes a review, and `eval` runs a suite headlessly with a scripted unit and writes a report a person still has to interpret", async (t) => {
  const repo = await initRepo(t);
  await writeFile(path.join(repo, ".regulator", "canaries"), "hunter2hunter2\n").catch(async () => { const { mkdir } = await import("node:fs/promises"); await mkdir(path.join(repo, ".regulator"), { recursive: true }); await writeFile(path.join(repo, ".regulator", "canaries"), "hunter2hunter2\n"); });
  const ledger = new ObligationLedger(repo);
  await appendSignal(repo, { id: "f1", timestamp: "2026-09-22T12:00:00.000Z", source: "S3*", kind: "audit-finding", channel: "audit", destination: "S3", severity: "blocking", subject: "unit u1: closeout refused (fail)", unit: "u1", observation: "token hunter2hunter2 in output", evidence: [] });
  await routeMessages(ledger, { policy: await loadRoutingPolicy() });
  const { ExecutionStore } = await import("@metacoding/vsm-pi-core");
  const store = new ExecutionStore(repo);
  await store.createUnit({ kind: "task", id: "tc-1", version: 1, unitId: "u1", unitType: "implement", workload: { name: "software-development", version: 1 }, objective: "o", constraintRefs: [], fixed: [], delegated: [], unresolved: [], expectedEvidence: [], provenance: { createdBy: "S3", createdAt: "t" } });
  await store.recordAttempt({ unitId: "u1", contractVersion: 1, startedAt: "2026-09-22T12:00:01.000Z", endedAt: "2026-09-22T12:00:05.000Z", outcome: "check-failure", detail: "see hunter2hunter2" });
  let r = await regulator(repo, "spans");
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /unit u1 {26,} unset/);
  assert.match(r.stdout, /invoke_agent implement[^\n]*\[redacted\]/);
  assert.match(r.stdout, /2 span\(s\), 1 trace\(s\)/);
  r = await regulator(repo, "spans", "--json");
  const spans = r.stdout.trim().split("\n").map((l) => JSON.parse(l) as { name: string; attributes: Record<string, unknown>; events: Array<{ name: string }> });
  assert.equal(spans.length, 2);
  assert.doesNotMatch(r.stdout, /hunter2hunter2/, "the canary never leaves the instance");
  assert.equal(spans[1]!.attributes.detail, "see [REDACTED]");
  assert.deepEqual(spans[0]!.events.map((e) => e.name), ["audit-finding", "obligation-opened"]);

  r = await regulator(repo, "review");
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /reg\.audit\.behaviour-check\.v1 {2}ablation check:export-signature {2}retire when: Never as a mechanism/);
  assert.match(r.stdout, /\n43 record\(s\)\n$/);
  r = await regulator(repo, "review", "--due");
  assert.match(r.stdout, /^0 record\(s\) overdue or due within 0 day\(s\)\n$/, "nothing is overdue at the lesson's date");
  r = await regulator(repo, "review", "--due", "--within", "3650");
  assert.match(r.stdout, /43 record\(s\) overdue or due within 3650 day\(s\)/);

  const out = path.join(repo, "eval-report.json");
  r = await regulator(repo, "eval", path.join(LAB_ROOT, "evals", "drift.json"), "--behaviour", "reference", "--arm", "treatment", "--reps", "1", "--out", out);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /^suite drift v1: 6 task\(s\), treatment × 1 repetition\(s\); scripted reference; ablation arms cover 4 of 43 regulators\n/);
  assert.match(r.stdout, /\n {2}control {14}rep 1 {2}d1-fix {7}closed {3}closed=1 /);
  assert.match(r.stdout, /\ntreatment: 6 run\(s\); closed 1 \[1, 1\] n=6;/);
  assert.match(r.stdout, /\n {2}treatment vs control: closed \+0\n/);
  assert.match(r.stdout, /report written to .*eval-report\.json\n$/);
  const report = JSON.parse(await readFile(out, "utf8")) as { interpretation: string; interpretedBy: string; fingerprint: { dispatcher: string } };
  assert.equal(report.interpretedBy, "nobody yet", "a report the CLI wrote without an interpretation file says so");
  assert.match(report.interpretation, /not yet interpreted by a person/);
  assert.equal(report.fingerprint.dispatcher, "scripted:reference");
  r = await regulator(repo, "eval", path.join(LAB_ROOT, "evals", "drift.json"), "--behaviour", "nope");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /no scripted behaviour "nope"/);
});

test("operating from the outside (lesson 15): `init` installs the definition into a repository, `doctor` is the CI entry point and fails on an overdue review date, `watch --once` forwards the outbox to a channel command, and `identity promote` is the release path into the definition's seed", async (t) => {
  const { mkdtemp, rm, mkdir, readdir } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-second-repo-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, "lib"));
  await writeFile(path.join(dir, "lib", "a.js"), "export const a = 1;\n");
  await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "second", private: true, type: "module" }));
  for (const args of [["init", "--quiet", "-b", "main"], ["add", "-A"], ["commit", "--quiet", "-m", "init"]]) await gitExec("git", args, { cwd: dir });
  let r = await regulator(dir, "doctor");
  assert.equal(r.code, 0, "no manifest yet: only the definition checks run, and the definition is fine");
  assert.doesNotMatch(r.stdout, /manifest/);
  r = await regulator(dir, "init", "--writable", "lib/", "--by", "alice");
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /^instance ready at .*: definition regulator at [0-9a-f]{7} \(43 regulators, pi 0\.87\.0\), initialized by alice\n {2}writes under lib\/ \(declared\); protected regulator\/identity\/ and whatever the conventions discover; 0 canaries\n {2}committed [0-9a-f]{7} on the base branch/);
  r = await regulator(dir, "init");
  assert.equal(r.code, 1);
  assert.match(r.stderr, /is already an instance/);
  r = await regulator(dir, "doctor");
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^ok {6} node/m);
  assert.match(r.stdout, /^ok {6} manifest {10}definition regulator at [0-9a-f]{7}, 43 regulators, pi 0\.87\.0; initialized \d{4}-\d{2}-\d{2} by alice; writable lib\//m);
  assert.match(r.stdout, /^ok {6} base {14}clean, on main/m);
  assert.match(r.stdout, /\n0 problem\(s\)\n$/);
  r = await regulator(dir, "doctor", "--json", "--today", "2027-01-01");
  assert.equal(r.code, 1);
  const report = JSON.parse(r.stdout) as { checks: Array<{ name: string; ok: boolean; detail: string }>; problems: number };
  assert.deepEqual(report.checks.filter((c) => !c.ok).map((c) => c.name), ["registry", "reviews"], "an overdue review date is a problem for the registry check and the review check");
  assert.equal(report.problems, 2);

  // The watcher forwards to whatever command the deployment names; here, a script that appends to a file.
  const ledger = new ObligationLedger(dir);
  await ledger.openObligation({ subject: "clarify: x", unit: "u1", concern: "recovery-decision", sources: ["d1"], severity: "blocking", consumer: "human", blocks: true, openedBy: "S3" });
  const channel = path.join(dir, "channel.log");
  r = await regulator(dir, "watch", "--once", "--exec", process.execPath, "-e", `require("fs").appendFileSync(${JSON.stringify(channel)}, process.argv[1] + "\\n")`);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /delivered 1, reminded 0, forwarded 1\n$/);
  assert.match(await readFile(channel, "utf8"), /^deliver:[0-9a-f-]+:0 .* u1 blocking veto recovery-decision on u1: clarify: x/);
  r = await regulator(dir, "watch", "--once", "--exec", process.execPath, "-e", "process.exit(3)");
  assert.equal(r.code, 0, "nothing new to forward");
  assert.match(r.stdout, /forwarded 0\n$/);

  // The release path: the instance's identity file into a definition's seed, committed there under S5 authority.
  const definition = await mkdtemp(path.join(tmpdir(), "regulator-definition-"));
  t.after(() => rm(definition, { recursive: true, force: true }));
  const { cp } = await import("node:fs/promises");
  await cp(path.join(LAB_ROOT, "identity"), path.join(definition, "identity"), { recursive: true });
  for (const args of [["init", "--quiet", "-b", "main"], ["add", "-A"], ["commit", "--quiet", "-m", "seed"]]) await gitExec("git", args, { cwd: definition });
  r = await regulator(dir, "identity", "promote", "GLOSSARY.md", "--by", "alice", "--rationale", "x", "--definition", definition);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /identical to the definition's seed; nothing to promote/);
  await writeFile(path.join(dir, "regulator/identity/GLOSSARY.md"), `${await readFile(path.join(dir, "regulator/identity/GLOSSARY.md"), "utf8")}- sprint (say unit)\n`);
  await gitExec("git", ["commit", "-qam", "S5: accept a glossary change (simulated)"], { cwd: dir });
  r = await regulator(dir, "identity", "promote", "GLOSSARY.md", "--by", "bob", "--rationale", "x", "--definition", definition);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /bob may not act as S5/);
  r = await regulator(dir, "identity", "promote", "INVARIANTS.md", "--by", "alice", "--rationale", "x", "--definition", definition);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /identical to the definition's seed/);
  await writeFile(path.join(dir, "regulator/identity/INVARIANTS.md"), "# no invariants\n");
  await gitExec("git", ["commit", "-qam", "break"], { cwd: dir });
  r = await regulator(dir, "identity", "promote", "INVARIANTS.md", "--by", "alice", "--rationale", "x", "--definition", definition);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /would leave the definition's identity invalid \(INVARIANTS\.md declares no invariant/);
  assert.match(await readFile(path.join(definition, "identity", "INVARIANTS.md"), "utf8"), /INV-001/, "the seed is untouched by a refused promotion");
  assert.deepEqual((await readdir(path.join(definition, "identity"))).sort(), ["BOUNDARIES.md", "GLOSSARY.md", "IDENTITY.md", "INVARIANTS.md"]);
  r = await regulator(dir, "identity", "promote", "GLOSSARY.md", "--by", "alice", "--rationale", "the instance learned a word", "--definition", definition);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /^GLOSSARY\.md promoted by alice \(S5\): the definition's seed at .* now carries this instance's file, committed as [0-9a-f]{7}; every instance initialized from now on starts from it\n$/);
  assert.match(await readFile(path.join(definition, "identity", "GLOSSARY.md"), "utf8"), /- sprint \(say unit\)\n$/);
  assert.match((await gitExec("git", ["log", "-1", "--format=%s%n%b"], { cwd: definition })).stdout, /^S5: promote GLOSSARY\.md from instance .*@[0-9a-f]{7} into the definition\n+Decided by alice under S5 authority\.\nthe instance learned a word/);
  assert.equal((await gitExec("git", ["status", "--porcelain"], { cwd: definition })).stdout.trim(), "", "the definition is clean: the promotion is one commit");
});

test("the contract-less path (lesson 05) honours the workload's requiresContract (lesson 06): `unit start --type` refuses a type that requires a contract, refuses a type the workload does not declare, and starts a contract-less type bare", async (t) => {
  const repo = await initRepo(t);
  const refused = await regulator(repo, "unit", "start", "u1", "--type", "implement");
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /unit type "implement" requires a contract: dispatch it with `regulator unit dispatch <contract.json>`/);
  const unknown = await regulator(repo, "unit", "start", "u1", "--type", "deploy");
  assert.equal(unknown.code, 1);
  assert.match(unknown.stderr, /unit type "deploy" is not a unit type of workload software-development/);
  const started = await regulator(repo, "unit", "start", "u1", "--type", "plan");
  assert.equal(started.code, 0, started.stderr);
  assert.match(started.stdout, /unit u1: branch/);
});
