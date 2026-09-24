import assert from "node:assert/strict";
import test from "node:test";
import { ObligationLedger } from "@metacoding/vsm-pi-core";
import type { InteractionPolicy } from "@metacoding/vsm-pi-protocol";
import { INTERACTION_ENTRY_TYPE, PAUSED_ENTRY_TYPE, createAlgedonicExtension } from "./algedonic.js";
import { gitExec, initRepo } from "@metacoding/regulator";
import { ctxFor, mockPi, type Dialogs } from "./test-support.js";
import { startUnit } from "@metacoding/regulator";

const policy: InteractionPolicy = {
  name: "interaction", version: 1, description: "d",
  timeoutsMs: { recap: 1000, choice: 2000, clarification: 3000, consent: 4000, uat: 5000 },
  attention: { blockingPerAttempt: 2 },
  reminderAfterMs: 60_000,
  people: [{ name: "alice", resolveUpTo: "critical", acceptRisk: true, actAsS5: true }],
};
const clock = Date.parse("2026-09-22T12:00:00.000Z");
const nothing = undefined as never;
type ToolOut = { content: Array<{ text: string }>; details: Record<string, unknown> };

async function session(t: Parameters<typeof initRepo>[0], options: { hasUI?: boolean; mode?: string; dialogs?: Dialogs; policy?: InteractionPolicy } = {}) {
  const repo = await initRepo(t);
  const started = await startUnit(gitExec, { repo, unitId: "u1", owner: "alice" });
  const mock = mockPi();
  createAlgedonicExtension({ now: () => clock, policy: options.policy ?? policy, person: "alice" })(mock.pi);
  const c = ctxFor(started.worktree.path, { hasUI: options.hasUI ?? false, ...(options.mode ? { mode: options.mode } : {}), ...(options.dialogs ? { dialogs: options.dialogs } : {}) });
  await mock.handlers.get("session_start")!({ type: "session_start", reason: "startup" }, c.ctx);
  const ask = (params: Record<string, unknown>) => mock.tools.get("ask_human")!.execute("call", params, nothing, nothing, c.ctx as never) as Promise<ToolOut>;
  const gate = (toolName: string) => mock.handlers.get("tool_call")!({ type: "tool_call", toolName, input: {} }, c.ctx) as { block: boolean; reason: string } | undefined;
  const settle = () => mock.handlers.get("agent_before_settle")!({ type: "agent_before_settle", entries: [{ type: "message" }] }, c.ctx) as { entries: unknown[]; continue: boolean } | undefined;
  return { repo, worktree: started.worktree.path, ledger: new ObligationLedger(repo, () => clock), ask, gate, settle, ...mock, ...c };
}

test("headless consent: no person, no answer, no action — the question is an obligation owed to a person, the request and its outcome are on the record, and the pause gate refuses every tool with an effect until the session ends", async (t) => {
  const s = await session(t);
  assert.deepEqual([...s.tools.keys()], ["ask_human"]);
  assert.equal(s.statuses.algedonic, "algedonic: headless — questions pause; 2 blocking interrupt(s) allowed");
  assert.equal(s.gate("write"), undefined, "nothing is gated before a question goes unanswered");

  await assert.rejects(s.ask({ kind: "consent", subject: "x", question: "q", evidence: [] }), /consent needs `action`/);
  await assert.rejects(s.ask({ kind: "choice", subject: "x", question: "q", evidence: [] }), /choice needs `options`/);

  const out = await s.ask({ kind: "consent", subject: "force-push main", question: "The branch diverged; may I force-push?", action: "git push --force origin main", evidence: [{ class: "command", ref: "git status" }] });
  assert.match(out.content[0]!.text, /^No answer \(no person is present\)\. Silence is not consent: do NOT perform the action\. The unit is paused: tools with an effect are refused from now on, the question is recorded as obligation [0-9a-f]{8} owed to a person, and the orchestrator will hold the unit until someone answers with `regulator answer`\. Call report_result with what you have so far and stop\.$/);
  assert.equal(out.details.paused, true);
  assert.equal(out.details.outcome, "unavailable");

  const [o] = await s.ledger.obligations();
  assert.ok(o);
  assert.deepEqual([o.concern, o.consumer, o.severity, o.blocks, o.status, o.unit, o.subject, o.question, o.openedBy], ["interaction", "human", "blocking", true, "open", "u1", "consent: force-push main", "The branch diverged; may I force-push?", "S1"]);
  const [i] = await s.ledger.interactions();
  const head = (await gitExec("git", ["rev-parse", "HEAD"], { cwd: s.worktree })).stdout.trim();
  assert.deepEqual({ ...i!.request, id: "-" }, { id: "-", kind: "consent", subject: "force-push main", question: "The branch diverged; may I force-push?", action: "git push --force origin main", severity: "blocking", unit: "u1", attempt: 1, obligationId: o.id, evidence: [{ class: "command", ref: "git status", sourceRevision: head }], raisedBy: "S1", raisedAt: "2026-09-22T12:00:00.000Z", timeoutMs: 4000, channel: "none" });
  assert.deepEqual(i!.answers, [{ at: "2026-09-22T12:00:00.000Z", by: "S1", outcome: "unavailable", channel: "none" }]);
  assert.equal(s.entries[0]?.customType, INTERACTION_ENTRY_TYPE);
  assert.equal(s.statuses.algedonic, `algedonic: PAUSED — consent unanswered (${o.id.slice(0, 8)})`);

  // The pause gate: not the model's decision.
  for (const tool of ["write", "edit", "bash", "run_tests", "notify_owner", "remember"]) {
    assert.match(s.gate(tool)?.reason ?? "", new RegExp(`^regulator: the unit is paused — a consent question \\("The branch diverged; may I force-push\\?"\\) has no answer, and silence is not consent\\. Nothing with an effect runs until a person answers \\(obligation ${o.id.slice(0, 8)}\\)\\. Call report_result with what you have and stop\\.$`), tool);
  }
  for (const tool of ["read", "grep", "read_conventions", "report_result"]) assert.equal(s.gate(tool), undefined, `${tool} still runs`);
  const settled = s.settle();
  assert.equal(settled?.continue, false, "the turn does not go on");
  assert.deepEqual(settled?.entries.at(-1), { type: "custom_message", customType: PAUSED_ENTRY_TYPE, content: "paused: consent unanswered — The branch diverged; may I force-push?", display: false, details: { kind: "consent", question: "The branch diverged; may I force-push?", obligationId: o.id } });
  assert.equal(await gitExec("git", ["status", "--porcelain"], { cwd: s.worktree }).then((r) => r.stdout.trim()), "", "nothing was done");
});

test("with a person present the question is a dialog with the policy's timeout for its kind; an answer is the person's disposition on the spot: consent yes → accepted, choice → fixed; a no, a timeout and a cancel all pause, because a false is never a yes", async (t) => {
  const seen: Array<[string, number | undefined]> = [];
  let confirmAnswer = true;
  let cancel = false;
  const dialogs: Dialogs = {
    confirm: async (title, _message, opts) => { seen.push([title, opts?.timeout]); if (cancel) throw new Error("cancelled"); return confirmAnswer; },
    select: async (title, options, opts) => { seen.push([title, opts?.timeout]); return options[1]; },
    input: async (title, _placeholder, opts) => { seen.push([title, opts?.timeout]); return "  the second one  "; },
  };
  const s = await session(t, { hasUI: true, dialogs, policy: { ...policy, attention: { blockingPerAttempt: 10 } } });
  assert.equal(s.statuses.algedonic, "algedonic: a person is present; 10 blocking interrupt(s) allowed");

  let out = await s.ask({ kind: "consent", subject: "delete the branch", question: "May I?", action: "git push --delete origin wip", evidence: [] });
  assert.equal(out.content[0]!.text, 'Consent given by alice: "yes". The action is authorized: git push --delete origin wip.');
  assert.deepEqual(out.details, { obligationId: out.details.obligationId, disposition: "accepted", answer: "yes" });
  out = await s.ask({ kind: "choice", subject: "database", question: "Which?", options: ["sqlite", "postgres"], evidence: [] });
  assert.equal(out.content[0]!.text, "alice answered: postgres");
  assert.equal(out.details.disposition, "fixed");
  out = await s.ask({ kind: "clarification", subject: "which test", question: "Which one is flaky?", evidence: [] });
  assert.equal(out.content[0]!.text, "alice answered: the second one");
  assert.deepEqual(seen, [["Consent — delete the branch (unit u1)", 4000], ["Question — database (unit u1)\nWhich?", 2000], ["Question — which test (unit u1)\nWhich one is flaky?", 3000]]);
  let all = await s.ledger.obligations();
  assert.deepEqual(all.map((o) => [o.status, o.closedBy, o.disposition, o.rationale]), [
    ["resolved", "alice", "accepted", "consent answered in the session: yes"],
    ["resolved", "alice", "fixed", "consent answered in the session: postgres".replace("consent", "choice")],
    ["resolved", "alice", "fixed", "clarification answered in the session: the second one"],
  ]);
  assert.deepEqual((await s.ledger.interactions()).map((i) => [i.request.channel, i.answers[0]!.by, i.answers[0]!.outcome, i.answers[0]!.channel, i.answers[0]!.answer]), [["tui", "alice", "answered", "tui", "yes"], ["tui", "alice", "answered", "tui", "postgres"], ["tui", "alice", "answered", "tui", "the second one"]]);
  assert.equal(s.gate("write"), undefined, "answered: nothing is paused");

  // A no is a rejection, on the record, and it pauses: the unit does not get to try again in this session.
  confirmAnswer = false;
  out = await s.ask({ kind: "consent", subject: "drop the table", question: "May I?", action: "DROP TABLE users", evidence: [] });
  assert.match(out.content[0]!.text, /^No answer \(timed-out\)\. Silence is not consent: do NOT perform the action\./);
  assert.match(s.gate("bash")?.reason ?? "", /the unit is paused — a consent question \("May I\?"\) has no answer, and silence is not consent/);
  all = await s.ledger.obligations();
  assert.equal(all.at(-1)?.status, "open");
  assert.equal((await s.ledger.interactions()).at(-1)?.answers[0]?.outcome, "timed-out");

  // Cancelled is recorded as cancelled, never as a yes.
  const fresh = await session(t, { hasUI: true, dialogs, policy: { ...policy, attention: { blockingPerAttempt: 10 } } });
  cancel = true;
  out = await fresh.ask({ kind: "consent", subject: "pay", question: "May I?", action: "charge the card", evidence: [] });
  assert.match(out.content[0]!.text, /^No answer \(cancelled\)\. Silence is not consent/);
  assert.equal((await fresh.ledger.interactions()).at(-1)?.answers[0]?.outcome, "cancelled");
});

test("a recap never waits and never pauses; attention is a budget the tool enforces per attempt — blocking questions past the cap are refused, recaps are not", async (t) => {
  const s = await session(t, { policy: { ...policy, attention: { blockingPerAttempt: 1 } } });
  let out = await s.ask({ kind: "recap", subject: "assumptions so far", question: "I assumed the test wants 42 and kept the export name. Correct me if not.", evidence: [] });
  assert.match(out.content[0]!.text, /^Recap recorded as obligation [0-9a-f]{8} for a person to correct later\. No answer is needed; continue with reversible work\.$/);
  assert.equal(s.gate("write"), undefined, "a recap does not pause");
  const [recap] = await s.ledger.obligations();
  assert.deepEqual([recap!.severity, recap!.blocks, recap!.status, recap!.consumer], ["advisory", false, "open", "human"], "owed to a person for correction; it holds nothing");
  assert.equal(s.settle(), undefined);

  out = await s.ask({ kind: "clarification", subject: "flaky test", question: "Which one?", evidence: [] });
  assert.equal(out.details.paused, true);
  await assert.rejects(s.ask({ kind: "uat", subject: "the layout", question: "Does it look right?", evidence: [] }), /^Error: attention budget exhausted: this attempt may ask 1 blocking question\(s\) and has asked 1\. Record the decision as residual uncertainty in report_result, or offer it as a recap\.$/);
  out = await s.ask({ kind: "recap", subject: "more assumptions", question: "Kept the file name.", evidence: [] });
  assert.match(out.content[0]!.text, /^Recap recorded/);
  assert.equal((await s.ledger.obligations()).length, 3, "the refused question opened nothing");

  // A new session is a new attempt: the budget and the pause start over, but what is owed stays owed.
  await s.handlers.get("session_start")!({ type: "session_start", reason: "startup" }, s.ctx);
  assert.equal(s.gate("write"), undefined);
  assert.equal((await s.ledger.open("u1")).filter((o) => o.blocks).length, 1, "the unanswered question is still open: the orchestrator, not this session, decides whether the unit runs");
});

test("outside a repository the tool refuses; without a person and with no policy every blocking question pauses at once", async (t) => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const bare = await mkdtemp(path.join(tmpdir(), "regulator-no-repo-"));
  t.after(() => rm(bare, { recursive: true, force: true }));
  const { pi, handlers, tools } = mockPi();
  createAlgedonicExtension({ policy })(pi);
  const { ctx } = ctxFor(bare);
  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
  await assert.rejects(tools.get("ask_human")!.execute("c", { kind: "recap", subject: "s", question: "q", evidence: [] }, nothing, nothing, ctx as never), /not inside a repository the orchestrator knows; a question has nowhere to be recorded/);

  const s = await session(t, { policy: { ...policy, attention: { blockingPerAttempt: 0 } } });
  assert.equal(s.statuses.algedonic, "algedonic: headless — questions pause; 0 blocking interrupt(s) allowed");
  await assert.rejects(s.ask({ kind: "consent", subject: "s", question: "q", action: "a", evidence: [] }), /attention budget exhausted: this attempt may ask 0 blocking question\(s\)/);
});
