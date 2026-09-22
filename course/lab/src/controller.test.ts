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
