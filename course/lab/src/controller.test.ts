import assert from "node:assert/strict";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { ExecutionStore, SIGNALS_RELATIVE_PATH, readSignals } from "@metacoding/vsm-pi-core";
import type { ResultReport, WorkContract } from "@metacoding/vsm-pi-protocol";
import { runUnit, type Dispatcher } from "./controller.js";
import { loadContract } from "./cp5-contract.js";
import { gitExec, initRepo } from "./git-support.js";
import { unitStatus } from "./unit.js";
import { POLICY_PATH, loadPolicy } from "./policy.js";
import { loadWorkload } from "./workload.js";

const LAB_ROOT = fileURLToPath(new URL("../", import.meta.url));
const contractFile = path.join(LAB_ROOT, "contracts", "fix-known-issue.json");
const policyP = loadPolicy();
const withPolicy = async () => ({ policy: await policyP, policyPath: POLICY_PATH });

function reportFor(contract: WorkContract, overrides: Partial<ResultReport> = {}): ResultReport {
  return {
    contractId: contract.id, contractVersion: contract.version, unitId: contract.unitId, reportedAt: "2026-09-22T00:05:00.000Z",
    summary: "done",
    evidence: [{ class: "test", ref: "run_tests", observation: "all pass" }, { class: "command", ref: "run_checks", observation: "all pass" }],
    delegatedResults: contract.delegated.map((d) => ({ decisionId: d.id, choice: "kept it simple" })),
    unresolvedOutcomes: contract.unresolved.map((d) => ({ decisionId: d.id, outcome: "preserved" as const, note: "untouched" })),
    emergentDecisions: [], deviations: [], residualUncertainty: [],
    ...overrides,
  };
}

/** A dispatcher that does what a well-behaved unit does: commits work and writes a report. */
function unitThat(behaviour: (request: Parameters<Dispatcher>[0], store: ExecutionStore) => Promise<void>, repo: string): Dispatcher {
  return async (request) => {
    await behaviour(request, new ExecutionStore(repo));
    return { sessionId: "session-1" };
  };
}

test("the loop closes a unit from its report: contract recorded, lease and worktree taken, report checked, branch reintegrated, lease released", async (t) => {
  const repo = await initRepo(t);
  const contract = await loadContract(contractFile);
  const workload = await loadWorkload();
  const seen: string[] = [];
  const outcome = await runUnit(gitExec, { ...(await withPolicy()),
    repo, contract, workload, owner: "alice", now: () => 1_700_000_000_000,
    dispatcher: unitThat(async (request, store) => {
      seen.push(request.profile, request.contractPath);
      assert.equal((await store.getUnit("u1"))?.status, "dispatched");
      await writeFile(path.join(request.worktree, "src.txt"), "fixed\n");
      await gitExec("git", ["add", "-A"], { cwd: request.worktree });
      await gitExec("git", ["commit", "-qm", "fix"], { cwd: request.worktree });
      await store.writeReport(reportFor(contract, {
        emergentDecisions: [{ subject: "trailing whitespace", choiceOrQuestion: "trimmed it", consequenceIfWrong: "high" }],
      }));
    }, repo),
  });
  assert.equal(outcome.status, "closed");
  assert.equal(seen[0], "implement", "the workload chose the profile, not the contract and not the model");
  assert.match(seen[1] ?? "", /\.regulator\/units\/u1\/contract\.v1\.json$/);
  assert.equal(await readFile(path.join(repo, "src.txt"), "utf8"), "fixed\n");
  const store = new ExecutionStore(repo);
  const unit = await store.getUnit("u1");
  assert.equal(unit?.status, "closed");
  assert.equal(unit?.attempts, 1);
  assert.equal((await store.listAttempts("u1"))[0]?.outcome, "reported");
  assert.deepEqual(await unitStatus(gitExec, repo), [], "lease released");
  const signals = await readSignals(repo);
  assert.equal(signals.length, 1, "a high-consequence emergent decision is regulatory information");
  assert.equal(signals[0]?.kind, "operational-signal");
  assert.match((signals[0] as { observation: string }).observation, /trailing whitespace/);
});

test("no report, no close: the unit is blocked, the attempt is recorded, and the lease is kept for S3 to decide", async (t) => {
  const repo = await initRepo(t);
  const contract = await loadContract(contractFile);
  const outcome = await runUnit(gitExec, { ...(await withPolicy()), repo, contract, workload: await loadWorkload(), owner: "alice", dispatcher: async () => ({}) });
  assert.deepEqual(outcome, { status: "blocked", reason: "no-report" });
  const store = new ExecutionStore(repo);
  assert.equal((await store.getUnit("u1"))?.status, "blocked");
  assert.match((await store.getUnit("u1"))?.reason ?? "", /without calling report_result/);
  assert.equal((await store.listAttempts("u1"))[0]?.outcome, "no-report");
  assert.equal((await unitStatus(gitExec, repo)).length, 1, "the resource stays claimed until S3 routes the failure");
  await stat(path.join(repo, ".regulator", "worktrees", "u1"));
});

test("a report that settles an unresolved decision does not close the unit even though the file exists", async (t) => {
  const repo = await initRepo(t);
  const contract = await loadContract(contractFile);
  const outcome = await runUnit(gitExec, { ...(await withPolicy()),
    repo, contract, workload: await loadWorkload(), owner: "alice",
    dispatcher: unitThat(async (_request, store) => { await store.writeReport(reportFor(contract, { unresolvedOutcomes: [] })); }, repo),
  });
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.status === "blocked" && outcome.reason, "invalid-report");
  assert.match(outcome.status === "blocked" ? outcome.problems?.[0]?.message ?? "" : "", /u-unicode.*settled silently/);
  assert.equal((await new ExecutionStore(repo).listAttempts("u1"))[0]?.outcome, "invalid-report");
});

test("an unsound contract or an undeclared unit type is refused before anything is claimed", async (t) => {
  const repo = await initRepo(t);
  const contract = await loadContract(contractFile);
  const workload = await loadWorkload();
  let dispatched = 0;
  const dispatcher: Dispatcher = async () => { dispatched++; return {}; };
  const unknownType = await runUnit(gitExec, { ...(await withPolicy()), repo, contract: { ...contract, unitType: "deploy" }, workload, owner: "a", dispatcher });
  assert.equal(unknownType.status, "refused");
  assert.match(unknownType.status === "refused" ? unknownType.problems[0]?.message ?? "" : "", /"deploy" is not a unit type/);
  const wrongWorkload = await runUnit(gitExec, { ...(await withPolicy()), repo, contract: { ...contract, workload: { name: "finance", version: 1 } }, workload, owner: "a", dispatcher });
  assert.equal(wrongWorkload.status, "refused");
  const mustResolve = await runUnit(gitExec, { ...(await withPolicy()),
    repo, workload, owner: "a", dispatcher,
    contract: { ...contract, unresolved: [{ id: "u0", subject: "s", reason: "r", handling: "resolve-before-execution" }] },
  });
  assert.equal(mustResolve.status, "refused");
  assert.equal(dispatched, 0);
  assert.equal(await new ExecutionStore(repo).getUnit("u1"), undefined, "nothing was recorded");
  assert.deepEqual(await unitStatus(gitExec, repo), []);
  await assert.rejects(stat(path.join(repo, SIGNALS_RELATIVE_PATH)), /ENOENT/);
});

test("a deviation from a fixed decision is reported, not hidden: the unit closes and S3 gets a blocking signal", async (t) => {
  const repo = await initRepo(t);
  const contract = await loadContract(contractFile);
  const outcome = await runUnit(gitExec, { ...(await withPolicy()),
    repo, contract, workload: await loadWorkload(), owner: "alice",
    dispatcher: unitThat(async (request, store) => {
      await writeFile(path.join(request.worktree, "src.txt"), "changed\n");
      await gitExec("git", ["commit", "-qam", "change"], { cwd: request.worktree });
      await store.writeReport(reportFor(contract, {
        deviations: [{ kind: "fixed-decision", ref: "f-signature", description: "added an optional second parameter; the tests required it" }],
      }));
    }, repo),
  });
  assert.equal(outcome.status, "closed");
  const signals = await readSignals(repo);
  assert.equal(signals.length, 1);
  assert.equal((signals[0] as { severity: string }).severity, "blocking");
  assert.match(signals[0]?.subject ?? "", /fixed-decision deviation \(f-signature\)/);
});

test("budgets: a halted attempt is recorded as budget-exhausted; a blocked unit is re-dispatched under the same contract version while attempts remain, and refused once they are spent", async (t) => {
  const repo = await initRepo(t);
  const contract = await loadContract(contractFile);
  const workload = await loadWorkload();
  const base = await withPolicy();
  const policy = { ...base.policy, budgets: { ...base.policy.budgets, byUnitType: { implement: { attempts: 2 } } } };
  const options = { ...base, policy, repo, contract, workload, owner: "alice" };
  const store = new ExecutionStore(repo);

  // Attempt 1: the session's guard crossed the token ceiling and wrote it to the ledger; no report.
  const first = await runUnit(gitExec, {
    ...options,
    dispatcher: async (request) => {
      assert.equal(request.attempt, 1);
      assert.equal(request.route.primary, "anthropic/claude-sonnet-4-5", "the policy's route for implement");
      assert.equal(request.policyPath, POLICY_PATH);
      await store.writeBudget({
        unitId: "u1", attempt: 1, ceiling: { tokens: 1000, wallClockMs: 60_000, turns: 5 }, consumed: { tokens: 1200, cost: 0.1, wallClockMs: 5000, turns: 3 },
        startedAt: "2026-09-22T00:00:00.000Z", updatedAt: "2026-09-22T00:00:05.000Z", models: ["anthropic/claude-sonnet-4-5"],
        exhausted: { dimension: "tokens", at: "2026-09-22T00:00:05.000Z" }, compactions: [],
      });
      return { sessionId: "s1" };
    },
  });
  assert.equal(first.status, "blocked");
  assert.equal(first.status === "blocked" && first.reason, "budget-exhausted");
  assert.match(first.status === "blocked" ? first.detail ?? "" : "", /tokens ceiling crossed .*1200 tokens, 3 turns/);
  assert.equal((await store.listAttempts("u1"))[0]?.outcome, "budget-exhausted");
  assert.match((await store.getUnit("u1"))?.reason ?? "", /budget exhausted: tokens/);
  assert.equal((await unitStatus(gitExec, repo)).length, 1, "the lease and worktree are kept for the next attempt");

  // Attempt 2: re-dispatched under the same contract version, same worktree; this time it reports and closes.
  const second = await runUnit(gitExec, {
    ...options,
    dispatcher: async (request) => {
      assert.equal(request.attempt, 2);
      assert.match(request.worktree, /\.regulator\/worktrees\/u1$/);
      await writeFile(path.join(request.worktree, "src.txt"), "second try\n");
      await gitExec("git", ["commit", "-qam", "second"], { cwd: request.worktree });
      await store.writeReport(reportFor(contract));
      return { sessionId: "s2" };
    },
  });
  assert.equal(second.status, "closed");
  assert.equal((await store.getUnit("u1"))?.attempts, 2);
  assert.deepEqual((await store.listAttempts("u1")).map((a) => a.outcome), ["budget-exhausted", "reported"]);
  assert.equal(await readFile(path.join(repo, "src.txt"), "utf8"), "second try\n");

  // A closed unit is not re-dispatched; a blocked one out of attempts is refused before anything is claimed.
  const closed = await runUnit(gitExec, { ...options, dispatcher: async () => ({}) });
  assert.equal(closed.status, "refused");
  assert.match(closed.status === "refused" ? closed.problems[0]?.message ?? "" : "", /exists and is closed/);

  const repo2 = await initRepo(t);
  const store2 = new ExecutionStore(repo2);
  const spent = { ...options, repo: repo2, policy: { ...policy, budgets: { ...policy.budgets, byUnitType: { implement: { attempts: 1 } } } } };
  assert.equal((await runUnit(gitExec, { ...spent, dispatcher: async () => ({}) })).status, "blocked");
  const exhausted = await runUnit(gitExec, { ...spent, dispatcher: async () => { throw new Error("must not dispatch"); } });
  assert.equal(exhausted.status, "refused");
  assert.match(exhausted.status === "refused" ? exhausted.problems[0]?.message ?? "" : "", /used its 1 attempt\(s\); S3 must decide/);
  assert.equal((await store2.getUnit("u1"))?.attempts, 1);

  const replanned = await runUnit(gitExec, { ...options, repo: repo2, contract: { ...contract, version: 2, provenance: { ...contract.provenance, predecessor: { version: 1, reason: "replan" } } }, dispatcher: async () => ({}) });
  assert.equal(replanned.status, "refused");
  assert.match(replanned.status === "refused" ? replanned.problems[0]?.message ?? "" : "", /a new contract version is a replan \(lesson 08\), not a retry/);
});

test("recovery: the autoloop retries a silent unit under the policy, repairs a refused report with a hint, and stops at the first decision it cannot apply", async (t) => {
  const { loadRecoveryPolicy } = await import("./recovery-policy.js");
  const { driveUnit } = await import("./controller.js");
  const repo = await initRepo(t);
  const contract = await loadContract(contractFile);
  const workload = await loadWorkload();
  const recovery = await loadRecoveryPolicy();
  const base = await withPolicy();
  const store = new ExecutionStore(repo);
  const hints: Array<string | undefined> = [];
  let calls = 0;
  const { final, decisions } = await driveUnit(gitExec, {
    ...base, repo, contract, workload, recovery, owner: "alice",
    dispatcher: async (request) => {
      calls++;
      hints.push(request.hint);
      if (calls === 1) return { sessionId: "s1" };                         // silent: no report
      if (calls === 2) {
        // A refused report never reaches the store (report_result throws); what the session leaves behind is the observation.
        await store.recordObservation({ unitId: contract.unitId, attempt: 2, at: "2026-01-01T00:00:00.000Z", source: "tool", toolName: "report_result", cause: "invalid-report", message: "Report refused against tc-fix v1: unresolved: u-unicode is unresolved in the contract but has no outcome" });
        return { sessionId: "s2" };
      }
      await writeFile(path.join(request.worktree, "src.txt"), "third\n");   // work, still no report
      await gitExec("git", ["commit", "-qam", "third"], { cwd: request.worktree });
      return { sessionId: "s3" };
    },
  });
  assert.equal(calls, 3, "attempt ceiling for implement is 3");
  assert.deepEqual(decisions.map((d) => [d.attempt, d.cause, d.action, d.occurrence]), [[1, "no-report", "retry", 1], [2, "invalid-report", "repair", 1], [3, "no-report", "escalate", 2]]);
  assert.equal(hints[0], undefined);
  assert.match(hints[1] ?? "", /ended without a report \(no-report\)/);
  assert.match(hints[2] ?? "", /report_result was refused: attempt 2: no-report; .*tool report_result: invalid-report — Report refused .*u-unicode/);
  assert.equal(final.status, "blocked");
  const unit = await store.getUnit("u1");
  assert.match(unit?.reason ?? "", /escalated to S5: no-report \(recovery v1\)/);
  assert.equal(unit?.attempts, 3);
  const signals = await readSignals(repo);
  const algedonic = signals.find((s) => s.kind === "algedonic-signal");
  assert.ok(algedonic, "policy exhausted: an algedonic signal to S5");
  assert.equal((algedonic as { requiresHumanAttention: boolean }).requiresHumanAttention, true);
  assert.match((algedonic as { observation: string }).observation, /policy is exhausted/);
  assert.equal((await store.listDecisions("u1")).length, 3, "every decision is on disk, immutably");
  assert.equal((await unitStatus(gitExec, repo)).length, 1, "an escalated unit keeps its claim until S5 decides");
});

test("recovery: oscillation routes to clarify with a question and stops; environment routes to remediate; abort releases the claim and the unit is aborted, not deleted", async (t) => {
  const { loadRecoveryPolicy } = await import("./recovery-policy.js");
  const { driveUnit, routeUnit } = await import("./controller.js");
  const { appendSignal } = await import("@metacoding/vsm-pi-core");
  const repo = await initRepo(t);
  const contract = await loadContract(contractFile);
  const workload = await loadWorkload();
  const recovery = await loadRecoveryPolicy();
  const base = await withPolicy();
  const store = new ExecutionStore(repo);

  // Oscillation: the unit ends silently after S2 signalled thrash.
  const osc = await driveUnit(gitExec, {
    ...base, repo, contract, workload, recovery, owner: "alice",
    dispatcher: async () => {
      await appendSignal(repo, { id: "s1", timestamp: "t", source: "S2", kind: "coordination-signal", channel: "signal", destination: "S3", severity: "advisory", subject: "src/slugify.js", unit: "u1", coordination: "oscillation", observation: "4 edits to src/slugify.js", evidence: [] });
      return { sessionId: "s1" };
    },
  });
  assert.equal(osc.decisions.length, 1);
  assert.equal(osc.decisions[0]?.action, "clarify");
  assert.match(osc.decisions[0]?.question ?? "", /Which behaviour is wanted\?/);
  assert.match((await store.getUnit("u1"))?.reason ?? "", /awaiting clarify: oscillation/);
  assert.equal((await store.getUnit("u1"))?.attempts, 1, "clarify spends no attempt");

  // Environment, observed by the session: remediate, not retry.
  const repo2 = await initRepo(t);
  const store2 = new ExecutionStore(repo2);
  const env = await driveUnit(gitExec, {
    ...base, repo: repo2, contract, workload, recovery, owner: "alice",
    dispatcher: async () => {
      await store2.recordObservation({ unitId: "u1", attempt: 1, at: "t", source: "tool", toolName: "run_tests", cause: "environment", message: "Cannot find module 'left-pad'" });
      return { sessionId: "s1" };
    },
  });
  assert.deepEqual(env.decisions.map((d) => [d.cause, d.action]), [["environment", "remediate"]]);
  assert.match((await store2.getUnit("u1"))?.reason ?? "", /awaiting remediate: environment/);

  // Abort under a policy that says so: the claim is released, the record stays.
  const abortive = { ...recovery, version: 2, rules: [{ cause: "no-report" as const, actions: ["abort" as const] }] };
  const repo3 = await initRepo(t);
  const store3 = new ExecutionStore(repo3);
  const gone = await driveUnit(gitExec, { ...base, repo: repo3, contract, workload, recovery: abortive, owner: "alice", dispatcher: async () => ({}) });
  assert.deepEqual(gone.decisions.map((d) => [d.action, d.policy.version]), [["abort", 2]]);
  assert.equal((await store3.getUnit("u1"))?.status, "aborted");
  assert.deepEqual(await unitStatus(gitExec, repo3), [], "lease released");
  await assert.rejects(stat(path.join(repo3, ".regulator", "worktrees", "u1")), /ENOENT/, "worktree removed");
  assert.equal((await store3.listAttempts("u1")).length, 1, "history kept");
  assert.equal(await routeUnit(gitExec, { repo: repo3, unitId: "u1", policy: base.policy, recovery }), undefined, "an aborted unit is not routed again");
});
