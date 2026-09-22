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

const run = promisify(execFile);
const CLI = fileURLToPath(new URL("./lab-cli.js", import.meta.url));

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
