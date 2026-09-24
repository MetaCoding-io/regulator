import assert from "node:assert/strict";
import test from "node:test";
import { readSignals } from "@metacoding/regulator-core";
import { INTELLIGENCE_ENTRY_TYPE, createIntelligenceExtension } from "./intelligence.js";
import { gitExec, initRepo } from "@metacoding/regulator";
import { ctxFor, mockPi } from "./test-support.js";
import { startUnit } from "@metacoding/regulator";

test("report_intelligence records a typed intelligence-signal S4→S3 with host provenance — unit from the lease, revision from the tree — and applies nothing; there is no tool to resolve, route or apply", async (t) => {
  const repo = await initRepo(t);
  const started = await startUnit(gitExec, { repo, unitId: "r1", owner: "alice" });
  const { pi, handlers, tools, entries } = mockPi();
  createIntelligenceExtension({ now: () => 1_700_000_000_000 })(pi);
  assert.deepEqual([...tools.keys()], ["report_intelligence"], "one way to speak, none to act");
  assert.equal([...tools.keys()].some((n) => /resolve|apply|route|obligation/.test(n)), false);

  const { ctx, statuses, notices } = ctxFor(started.worktree.path);
  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
  assert.equal(statuses.intelligence, "intelligence: reporting as unit r1");
  const head = (await gitExec("git", ["rev-parse", "HEAD"], { cwd: started.worktree.path })).stdout.trim();

  const tool = tools.get("report_intelligence")!;
  const input = {
    subject: "vendor/left-pad.js", claim: "the vendored copy differs from left-pad 1.3.0", observation: "line 4 pads with a tab", confidence: "high", reportedSeverity: "blocking",
    evidence: [{ class: "file", ref: "src/index.js", observation: "the caller" }], affectedUnits: ["u1"], expiresAt: "2027-01-01T00:00:00.000Z",
  };
  const out = await tool.execute("i1", input, undefined as never, undefined as never, ctx as never) as { content: Array<{ text: string }>; details: { intelligenceId: string; revision: string } };
  assert.match(out.content[0]?.text ?? "", /^Intelligence [0-9a-f-]+ recorded on the intelligence channel for S3 at revision \w{7}\. Nothing has been applied: the orchestrator routes it under its policy and may hold u1 until it is dispositioned\./);
  assert.equal(out.details.revision, head);

  const signals = await readSignals(repo);
  assert.equal(signals.length, 1, "recorded in the base checkout's log, not the worktree's");
  const signal = signals[0]!;
  assert.equal(signal.kind, "intelligence-signal");
  assert.equal(signal.source, "S4");
  assert.equal(signal.destination, "S3");
  assert.equal(signal.unit, "r1", "provenance is the lease's, not the model's");
  if (signal.kind !== "intelligence-signal") throw new Error("unreachable");
  assert.equal(signal.claim, input.claim);
  assert.equal(signal.confidence, "high");
  assert.equal(signal.severity, "blocking", "reported severity is carried as the claim; the router derives what it acts on");
  assert.deepEqual(signal.affectedUnits, ["u1"]);
  assert.equal(signal.observedAt, "2023-11-14T22:13:20.000Z", "observedAt defaults to now");
  assert.equal(signal.expiresAt, "2027-01-01T00:00:00.000Z");
  assert.deepEqual(signal.evidence, [{ class: "file", ref: "src/index.js", observation: "the caller", sourceRevision: head }], "evidence refs are stamped with the revision they were read at");
  assert.deepEqual(entries[0], { customType: INTELLIGENCE_ENTRY_TYPE, data: { id: signal.id, revision: head, dirty: false, at: "2023-11-14T22:13:20.000Z" } });
  assert.equal(statuses.intelligence, "intelligence: 1 finding(s) recorded as unit r1");
  assert.match(notices[0]?.message ?? "", /intelligence \w{8} recorded for S3 \(vendor\/left-pad\.js, high confidence\)/);
  assert.equal((await gitExec("git", ["status", "--porcelain"], { cwd: started.worktree.path })).stdout.trim(), "", "the domain is untouched");
});

test("outside a repository the orchestrator knows, the tool refuses: intelligence with no provenance is not recorded", async (t) => {
  const { pi, handlers, tools } = mockPi();
  createIntelligenceExtension()(pi);
  const { ctx, statuses } = ctxFor(await (await import("node:fs/promises")).mkdtemp((await import("node:path")).join((await import("node:os")).tmpdir(), "regulator-no-repo-")));
  t.after(async () => (await import("node:fs/promises")).rm(ctx.cwd, { recursive: true, force: true }));
  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
  assert.equal(statuses.intelligence, "intelligence: no unit");
  await assert.rejects(
    tools.get("report_intelligence")!.execute("i", { subject: "s", claim: "c", observation: "o", confidence: "low", reportedSeverity: "info", evidence: [{ class: "file", ref: "x" }], affectedUnits: [] }, undefined as never, undefined as never, ctx as never),
    /not inside a repository the orchestrator knows; intelligence has nowhere to be recorded/,
  );
});
