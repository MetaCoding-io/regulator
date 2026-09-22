import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { MemoryStore } from "@metacoding/vsm-pi-core";
import { IDENTITY_SECTION_TAG, MEMORY_ENTRY_TYPE, MEMORY_SECTION_TAG, createIdentityExtension } from "./cp11-identity.js";
import { gitExec, initRepo } from "./git-support.js";
import { ctxFor, mockPi } from "./test-support.js";
import { startUnit } from "./unit.js";

const DAY = 86_400_000;

test("identity is rendered into the system prompt from the files each run, never from the transcript; memory is rendered as facts that expire; `remember` stamps provenance, requires an expiry, and is the only tool registered", async (t) => {
  const repo = await initRepo(t);
  const started = await startUnit(gitExec, { repo, unitId: "u1", owner: "alice" });
  const clock = Date.parse("2026-09-22T12:00:00.000Z");
  const { pi, handlers, tools, entries } = mockPi();
  createIdentityExtension({ now: () => clock, maxReviewDays: 30 })(pi);
  assert.deepEqual([...tools.keys()], ["remember"], "one way to record a fact; no way to touch identity");

  const { ctx, statuses } = ctxFor(started.worktree.path);
  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
  assert.equal(statuses.identity, "identity: INV-001, INV-002, INV-003, INV-004; memory: 0 current");

  const sections = async () => {
    const event = { type: "before_agent_start", systemPromptOptions: { sections: {} as Record<string, string> } };
    await handlers.get("before_agent_start")!(event, ctx);
    return event.systemPromptOptions.sections;
  };
  let s = await sections();
  assert.match(s[IDENTITY_SECTION_TAG] ?? "", /^This instance's identity \(S5\)[\s\S]*--- IDENTITY\.md ---[\s\S]*## INV-001 — Identity is write-protected[\s\S]*## INV-004 — Memory is not identity[\s\S]*--- BOUNDARIES\.md ---[\s\S]*--- GLOSSARY\.md ---/);
  assert.match(s[MEMORY_SECTION_TAG] ?? "", /^Operational memory \(S3\): nothing current/);

  const remember = tools.get("remember")!;
  await assert.rejects(remember.execute("m0", { subject: "s", note: "n", evidence: [], reviewBy: "2026-09-01T00:00:00.000Z" }, undefined as never, undefined as never, ctx as never), /is not in the future/);
  await assert.rejects(remember.execute("m0", { subject: "s", note: "n", evidence: [], reviewBy: "2027-09-01T00:00:00.000Z" }, undefined as never, undefined as never, ctx as never), /more than 30 days out/);
  const head = (await gitExec("git", ["rev-parse", "HEAD"], { cwd: started.worktree.path })).stdout.trim();
  const out = await remember.execute("m1", { subject: "test runner", note: "needs FOO=1 or the suite hangs", evidence: [{ class: "command", ref: "npm test" }], reviewBy: new Date(clock + 7 * DAY).toISOString() }, undefined as never, undefined as never, ctx as never) as { content: Array<{ text: string }>; details: { memoryId: string } };
  assert.match(out.content[0]?.text ?? "", new RegExp(`^Recorded memory [0-9a-f-]+ \\("test runner"\\), current until 2026-09-29, with unit u1 and revision ${head.slice(0, 7)} as provenance\\. It is a fact for later units, not a rule\\.$`));
  const stored = await new MemoryStore(repo, () => clock).states();
  assert.equal(stored.length, 1, "recorded in the base checkout's store, not the worktree's");
  assert.equal(stored[0]?.unit, "u1");
  assert.equal(stored[0]?.revision, head);
  assert.equal(stored[0]?.recordedBy, "S1");
  assert.deepEqual(stored[0]?.evidence, [{ class: "command", ref: "npm test", sourceRevision: head }]);
  assert.equal(entries[0]?.customType, MEMORY_ENTRY_TYPE);
  s = await sections();
  assert.match(s[MEMORY_SECTION_TAG] ?? "", /- test runner: needs FOO=1 or the suite hangs \(recorded 2026-09-22 by S1 in unit u1; review by 2026-09-29\)/);
  assert.equal(await gitExec("git", ["status", "--porcelain"], { cwd: started.worktree.path }).then((r) => r.stdout.trim()), "", "the domain and the identity are untouched");

  // The identity a unit sees is the files: edit one and the next run says so. Compaction cannot lose what is not in the transcript.
  await writeFile(path.join(started.worktree.path, "regulator/identity/GLOSSARY.md"), "# Identity — glossary\n\n- **Unit** — redefined.\n");
  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
  s = await sections();
  assert.match(s[IDENTITY_SECTION_TAG] ?? "", /redefined/);
  assert.equal((await readFile(path.join(repo, "regulator/identity/GLOSSARY.md"), "utf8")).includes("redefined"), false, "the base checkout's copy is what the closeout check compares against");
});

test("with a problem in the identity set the session says so; outside a repository the tool refuses", async (t) => {
  const repo = await initRepo(t);
  await writeFile(path.join(repo, "regulator/identity/INVARIANTS.md"), "# no invariants here\n");
  const { pi, handlers, tools } = mockPi();
  createIdentityExtension()(pi);
  const { ctx, statuses, notices } = ctxFor(repo);
  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
  assert.equal(statuses.identity, "identity: none found under regulator/identity/; 1 problem(s)");
  assert.match(notices[0]?.message ?? "", /identity problems — INVARIANTS\.md declares no invariant/);
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const bare = await mkdtemp(path.join(tmpdir(), "regulator-no-repo-"));
  t.after(() => rm(bare, { recursive: true, force: true }));
  const other = ctxFor(bare);
  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, other.ctx);
  await assert.rejects(tools.get("remember")!.execute("m", { subject: "s", note: "n", evidence: [], reviewBy: "2099-01-01T00:00:00.000Z" }, undefined as never, undefined as never, other.ctx as never), /not inside a repository the orchestrator knows; memory has nowhere to be recorded/);
});
