import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { MemoryStore } from "@metacoding.io/regulator-core";
import { IDENTITY_SECTION_TAG, MEMORY_ENTRY_TYPE, MEMORY_SECTION_TAG, createIdentityExtension } from "./identity.js";
import { gitExec, initRepo , LAB_ROOT } from "@metacoding.io/regulator";
import { ctxFor, mockPi } from "./test-support.js";
import { startUnit } from "@metacoding.io/regulator";

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
  // The seed fits the default limit since #91; a policy may lower it, so the status may say it is truncated.
  assert.match(statuses.identity ?? "", /^identity: INV-001, INV-002, INV-003, INV-004(; truncated at 12000 of \d+ characters)?; memory: 0 current$/);

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

test("an identity set over its context budget is rendered truncated and the cut is recorded (#51): the status line says so, one advisory operational-signal per session goes to the base's log with the files cut as evidence, and the section still ends with the truncation marker", async (t) => {
  const repo = await initRepo(t);
  const started = await startUnit(gitExec, { repo, unitId: "u1", owner: "alice" });
  const boundaries = path.join(started.worktree.path, "regulator/identity/BOUNDARIES.md");
  await writeFile(boundaries, `${await readFile(boundaries, "utf8")}\n${"- A boundary, restated at length so the set is longer than a prompt carries.\n".repeat(120)}`);
  const clock = Date.parse("2026-09-22T12:00:00.000Z");
  const { pi, handlers } = mockPi();
  createIdentityExtension({ now: () => clock })(pi);
  const { ctx, statuses, notices } = ctxFor(started.worktree.path);
  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
  assert.match(statuses.identity ?? "", /^identity: INV-001, INV-002, INV-003, INV-004; truncated at 12000 of \d{4,} characters; memory: 0 current$/);

  const event = { type: "before_agent_start", systemPromptOptions: { sections: {} as Record<string, string> } };
  await handlers.get("before_agent_start")!(event, ctx);
  await handlers.get("before_agent_start")!(event, ctx);
  assert.match(event.systemPromptOptions.sections[IDENTITY_SECTION_TAG] ?? "", /\n\[identity truncated at 12000 characters; the files are authoritative\]$/);
  assert.equal(notices.length, 1, "said once per session, not per turn");
  assert.match(notices[0]?.message ?? "", /^regulator: the identity set renders to \d+ characters and a unit's prompt carries 12000: \d+ character\(s\) of BOUNDARIES\.md, GLOSSARY\.md are advice the model never sees\./);
  const signals = (await readFile(path.join(repo, ".regulator/signals.ndjson"), "utf8")).trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);
  assert.equal(signals.length, 1, "recorded in the base's log, once");
  assert.deepEqual([signals[0]!.kind, signals[0]!.source, signals[0]!.destination, signals[0]!.severity, signals[0]!.unit, signals[0]!.subject, signals[0]!.timestamp], ["operational-signal", "S1", "S3", "advisory", "u1", "identity truncated at 12000 characters", "2026-09-22T12:00:00.000Z"]);
  assert.deepEqual(signals[0]!.evidence, [{ class: "file", ref: "regulator/identity/BOUNDARIES.md" }, { class: "file", ref: "regulator/identity/GLOSSARY.md" }]);

  // The limit is the budget policy's (#91): a policy that raises it renders the same set whole, and nothing is signalled.
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { POLICY_PATH } = await import("@metacoding.io/regulator");
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-policy-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const raised = { ...JSON.parse(await readFile(POLICY_PATH, "utf8")) as Record<string, unknown>, identity: { maxChars: 40000 } };
  await writeFile(path.join(dir, "policy.json"), JSON.stringify(raised));
  const before = process.env.REGULATOR_POLICY;
  process.env.REGULATOR_POLICY = path.join(dir, "policy.json");
  t.after(() => { if (before === undefined) delete process.env.REGULATOR_POLICY; else process.env.REGULATOR_POLICY = before; });
  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
  assert.match(statuses.identity ?? "", /^identity: INV-001, INV-002, INV-003, INV-004; memory: 0 current$/, "whole under the raised limit");
  const whole = { type: "before_agent_start", systemPromptOptions: { sections: {} as Record<string, string> } };
  await handlers.get("before_agent_start")!(whole, ctx);
  assert.doesNotMatch(whole.systemPromptOptions.sections[IDENTITY_SECTION_TAG] ?? "", /identity truncated/);
  assert.equal(notices.length, 1, "nothing more was said");
});

test("memory scope (lesson 15): a fact recorded for research units is rendered to a research unit and not to an implement unit; the tool records the scope with the fact", async (t) => {
  const repo = await initRepo(t);
  const { ExecutionStore } = await import("@metacoding.io/regulator-core");
  const { loadContract } = await import("./contract.js");
  const store = new ExecutionStore(repo);
  const base = await loadContract(path.join(LAB_ROOT, "contracts", "fix-known-issue.json"));
  await store.createUnit({ ...base, unitId: "imp" });
  await store.createUnit({ ...base, id: "tc-r", unitId: "res", unitType: "research" });
  const clock = Date.parse("2026-09-22T12:00:00.000Z");
  const imp = await startUnit(gitExec, { repo, unitId: "imp", owner: "alice" });
  const res = await startUnit(gitExec, { repo, unitId: "res", owner: "alice" });
  const { pi, handlers, tools } = mockPi();
  createIdentityExtension({ now: () => clock, maxReviewDays: 30 })(pi);
  const sections = async (cwd: string) => {
    const { ctx } = ctxFor(cwd);
    await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
    const event = { type: "before_agent_start", systemPromptOptions: { sections: {} as Record<string, string> } };
    await handlers.get("before_agent_start")!(event, ctx);
    return { section: event.systemPromptOptions.sections[MEMORY_SECTION_TAG] ?? "", ctx };
  };
  const { ctx } = await sections(res.worktree.path);
  const out = await tools.get("remember")!.execute("m", { subject: "advisory feed", note: "rate-limited to 60/min", evidence: [], reviewBy: new Date(clock + 7 * DAY).toISOString(), scope: ["research"] }, undefined as never, undefined as never, ctx as never) as { content: Array<{ text: string }> };
  assert.match(out.content[0]!.text, /for research units\. It is a fact for later units/);
  assert.match((await sections(res.worktree.path)).section, /advisory feed: rate-limited to 60\/min .*; for research units\)/);
  assert.doesNotMatch((await sections(imp.worktree.path)).section, /advisory feed/, "an implement unit never sees it");
  await tools.get("remember")!.execute("m2", { subject: "everyone", note: "n", evidence: [], reviewBy: new Date(clock + 7 * DAY).toISOString() }, undefined as never, undefined as never, ctx as never);
  assert.match((await sections(imp.worktree.path)).section, /everyone: n/);
});
