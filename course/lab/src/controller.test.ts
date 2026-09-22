import assert from "node:assert/strict";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { ExecutionStore, SIGNALS_RELATIVE_PATH, loadRegistry, readSignals } from "@metacoding/vsm-pi-core";
import type { ResultReport, WorkContract } from "@metacoding/vsm-pi-protocol";
import { runUnit, type Dispatcher } from "./controller.js";
import { loadContract } from "./cp5-contract.js";
import { gitExec, initRepo } from "./git-support.js";
import { unitStatus } from "./unit.js";
import { POLICY_PATH, loadPolicy } from "./policy.js";
import { loadInteractionPolicy } from "./interaction-policy.js";
import { loadRoutingPolicy } from "./routing-policy.js";
import { loadWorkload } from "./workload.js";

const LAB_ROOT = fileURLToPath(new URL("../", import.meta.url));
const contractFile = path.join(LAB_ROOT, "contracts", "fix-known-issue.json");
const policyP = loadPolicy();
const routingP = loadRoutingPolicy();
const regulatorsP = loadRegistry(path.join(LAB_ROOT, "registry")).then((r) => r.records.map((x) => x.id));
const interactionP = loadInteractionPolicy();
const withPolicy = async () => ({ policy: await policyP, policyPath: POLICY_PATH, routing: await routingP, interaction: await interactionP, regulators: await regulatorsP });

function reportFor(contract: WorkContract, overrides: Partial<ResultReport> = {}): ResultReport {
  return {
    contractId: contract.id, contractVersion: contract.version, unitId: contract.unitId, attempt: 1, reportedAt: "2026-09-22T00:05:00.000Z",
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
      await store.writeReport(reportFor(contract, { attempt: 2 }));
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
  assert.equal(await routeUnit(gitExec, { repo: repo3, unitId: "u1", policy: base.policy, recovery, routing: base.routing, interaction: base.interaction }), undefined, "an aborted unit is not routed again");
});

test("evidence, not claims: a report that says the tests pass does not close the unit when the harness's own run says otherwise; the repair attempt closes on fresh evidence", async (t) => {
  const { AuditLog } = await import("@metacoding/vsm-pi-core");
  const { loadRecoveryPolicy } = await import("./recovery-policy.js");
  const { driveUnit } = await import("./controller.js");
  const repo = await initRepo(t);
  const contract = await loadContract(contractFile);
  const workload = await loadWorkload();
  const store = new ExecutionStore(repo);
  const hints: Array<string | undefined> = [];
  const { final, decisions } = await driveUnit(gitExec, {
    ...(await withPolicy()), repo, contract, workload, recovery: await loadRecoveryPolicy(), owner: "alice",
    dispatcher: async (request) => {
      hints.push(request.hint);
      if (request.attempt === 1) {
        // The lie: break the test, commit, and report "all pass" with evidence of every required class.
        await writeFile(path.join(request.worktree, "src", "index.js"), "export const answer = 41;\n");
        await gitExec("git", ["commit", "-qam", "break"], { cwd: request.worktree });
        await store.writeReport(reportFor(contract, { attempt: 1, summary: "fixed; all tests pass" }));
      } else {
        await writeFile(path.join(request.worktree, "src", "index.js"), "export const answer = 42;\n");
        await gitExec("git", ["commit", "-qam", "repair"], { cwd: request.worktree });
        await store.writeReport(reportFor(contract, { attempt: 2, summary: "repaired" }));
      }
      return { sessionId: `s${request.attempt}` };
    },
  });
  assert.equal(final.status, "closed");
  assert.deepEqual((await store.listAttempts("u1")).map((a) => a.outcome), ["check-failure", "reported"]);
  assert.match((await store.listAttempts("u1"))[0]?.detail ?? "", /^fail@\w{7} \(failed e-tests; contradicted run_tests\)/);
  assert.deepEqual(decisions.map((d) => [d.cause, d.action]), [["check-failure", "repair"]]);
  assert.match(hints[1] ?? "", /Host-run verification refused closeout.*not ok: answer.*The evidence the harness produced, not the report, decides/s);
  const audit = await new AuditLog(repo).forUnit("u1");
  assert.deepEqual(audit.verdicts.map((v) => [v.attempt, v.verdict]), [[1, "fail"], [2, "pass"]]);
  assert.deepEqual(audit.evidence.filter((r) => r.attempt === 1).map((r) => [r.check, r.verdict]), [["run_checks:syntax:src/index.js", "pass"], ["run_tests", "fail"], ["identity-untouched", "pass"], ["export-signature", "inconclusive"]], "in the order the workload names the checks; a signature check with no expectation carrying one is inconclusive, and binds to nothing");
  assert.equal(audit.evidence[0]?.producedBy, "S3*");
  assert.notEqual(audit.evidence[0]?.revision, audit.evidence.at(-1)?.revision, "each attempt's evidence binds to its own revision");
  assert.deepEqual(audit.verdicts[1]?.evidence, audit.evidence.filter((r) => r.attempt === 2).map((r) => r.id), "the passing verdict considered only the fresh records");
  const findings = (await readSignals(repo)).filter((s) => s.kind === "audit-finding");
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.source, "S3*");
  assert.equal((findings[0] as { severity: string }).severity, "blocking");
  assert.match((findings[0] as { observation: string }).observation, /report cites test evidence "run_tests" but the host found run_tests failing/);
  assert.equal(await readFile(path.join(repo, "src", "index.js"), "utf8"), "export const answer = 42;\n", "only the repaired revision was reintegrated");
});

test("closeout is inconclusive on an uncommitted tree or a criterion no check can observe; a human acceptance at that revision lets `close` finish it without spending an attempt", async (t) => {
  const { AuditLog } = await import("@metacoding/vsm-pi-core");
  const { closeUnit } = await import("./controller.js");
  const repo = await initRepo(t);
  const base = await loadContract(contractFile);
  const contract: WorkContract = { ...base, expectedEvidence: [...base.expectedEvidence, { id: "e-wording", description: "the README's known-issue paragraph reads well", class: "semantic", required: true }] };
  const workload = await loadWorkload();
  const store = new ExecutionStore(repo);
  const options = { ...(await withPolicy()), repo, contract, workload, owner: "alice" };

  const dirty = await runUnit(gitExec, { ...options, dispatcher: unitThat(async (request, s) => {
    await writeFile(path.join(request.worktree, "src.txt"), "uncommitted\n");
    await s.writeReport(reportFor(contract, { evidence: [...reportFor(contract).evidence, { class: "semantic", ref: "README.md", observation: "reads well to me" }] }));
  }, repo) });
  assert.equal(dirty.status, "blocked", JSON.stringify(dirty));
  assert.equal(dirty.status === "blocked" && dirty.reason, "check-failure");
  assert.equal(dirty.status === "blocked" ? dirty.verdict?.verdict : "", "inconclusive");
  assert.match(dirty.status === "blocked" ? dirty.verdict?.reasons[0] ?? "" : "", /uncommitted changes: evidence cannot be bound to revision/);
  assert.equal((await new AuditLog(repo).forUnit("u1")).evidence.length, 0, "nothing was recorded against a tree that binds to no revision");

  // Commit inside the worktree, as the unit should have; re-audit without an attempt.
  const worktree = path.join(repo, ".regulator", "worktrees", "u1");
  await gitExec("git", ["commit", "-qam", "commit the work"], { cwd: worktree });
  const waiting = await closeUnit(gitExec, { repo, unitId: "u1", workload, routing: options.routing, interaction: options.interaction });
  assert.equal(waiting.status, "blocked");
  assert.equal(waiting.status === "blocked" ? waiting.verdict?.verdict : "", "inconclusive");
  assert.deepEqual(waiting.status === "blocked" ? waiting.verdict?.awaitingAcceptance : [], ["e-wording"]);
  assert.deepEqual(waiting.status === "blocked" ? waiting.verdict?.satisfied : [], ["e-tests", "e-checks"], "the host evidence is in; only the human's part is missing");
  assert.match((await store.getUnit("u1"))?.reason ?? "", /audit refused closeout: inconclusive@\w{7} \(awaiting acceptance e-wording\)/);

  const revision = (await gitExec("git", ["rev-parse", "HEAD"], { cwd: worktree })).stdout.trim();
  await new AuditLog(repo).appendAcceptance({ id: "a1", unitId: "u1", contract: { id: contract.id, version: 1 }, criterion: "e-wording", revision: "0000000", disposition: "accepted", by: "alice", at: "t" });
  assert.equal((await closeUnit(gitExec, { repo, unitId: "u1", workload, routing: options.routing, interaction: options.interaction })).status, "blocked", "an acceptance at another revision is a memory");
  await new AuditLog(repo).appendAcceptance({ id: "a2", unitId: "u1", contract: { id: contract.id, version: 1 }, criterion: "e-wording", revision, disposition: "accepted", by: "alice", note: "clear", at: "t" });
  const closed = await closeUnit(gitExec, { repo, unitId: "u1", workload, routing: options.routing, interaction: options.interaction });
  assert.equal(closed.status, "closed");
  assert.equal((await store.getUnit("u1"))?.attempts, 1, "a re-audit is not an attempt");
  assert.deepEqual((await store.listAttempts("u1")).map((a) => a.outcome), ["check-failure"], "the attempt history is immutable; the audit log says what changed");
  const audit = await new AuditLog(repo).forUnit("u1");
  assert.deepEqual(audit.verdicts.map((v) => v.verdict), ["inconclusive", "inconclusive", "inconclusive", "pass"]);
  assert.equal(await readFile(path.join(repo, "src.txt"), "utf8"), "uncommitted\n");
  const again = await closeUnit(gitExec, { repo, unitId: "u1", workload, routing: options.routing, interaction: options.interaction });
  assert.equal(again.status, "refused");
  assert.match(again.status === "refused" ? again.problems[0]?.message ?? "" : "", /is closed; only a blocked unit is re-audited/);
});

test("obligations: what a unit records is routed at the loop's steps under the routing policy; S3's recovery decision dispositions what S3 was routed; a waiting action becomes an obligation owed to a person that vetoes re-dispatch until it is resolved, and the resolution reaches the next attempt as the hint", async (t) => {
  const { ObligationLedger, appendSignal } = await import("@metacoding/vsm-pi-core");
  const { loadRecoveryPolicy } = await import("./recovery-policy.js");
  const { driveUnit } = await import("./controller.js");
  const repo = await initRepo(t);
  const contract = await loadContract(contractFile);
  const workload = await loadWorkload();
  const recovery = await loadRecoveryPolicy();
  const base = await withPolicy();
  const store = new ExecutionStore(repo);
  const ledger = new ObligationLedger(repo);
  const hints: Array<string | undefined> = [];

  // Attempt 1 lies about the tests (closeout refused: a blocking finding), records a proposal, and S2 saw it thrash.
  const first = await driveUnit(gitExec, {
    ...base, repo, contract, workload, recovery, owner: "alice",
    dispatcher: async (request) => {
      hints.push(request.hint);
      await appendSignal(repo, { id: "p1", timestamp: "t", source: "S1", kind: "policy-proposal", channel: "proposal", destination: "S5", severity: "advisory", subject: "let units edit vendor/", unit: "u1", rationale: "r", requestedChange: "x", evidence: [] });
      await appendSignal(repo, { id: "s1", timestamp: "t", source: "S2", kind: "coordination-signal", channel: "signal", destination: "S3", severity: "advisory", subject: "src/index.js", unit: "u1", coordination: "oscillation", observation: "4 edits to src/index.js", evidence: [] });
      await writeFile(path.join(request.worktree, "src", "index.js"), `export const answer = ${100 + request.attempt};\n`);
      await gitExec("git", ["commit", "-qam", "break"], { cwd: request.worktree });
      await store.writeReport(reportFor(contract, { attempt: request.attempt, summary: "fixed; all tests pass" }));
      return { sessionId: `s${request.attempt}` };
    },
  });
  // check-failure wins the classification (the orchestrator's record first), so the router says repair — but repair
  // spends an attempt, and the oscillation signal is still S3's to disposition: it was resolved as rework by the same decision.
  assert.deepEqual(first.decisions.map((d) => [d.cause, d.action]), [["check-failure", "repair"], ["check-failure", "repair"], ["check-failure", "replan"]]);
  assert.equal(first.final.status, "blocked");
  let all = await ledger.obligations();
  assert.deepEqual(all.map((o) => [o.concern, o.consumer, o.status, o.disposition ?? o.successor?.slice(0, 8)]).slice(0, 3), [
    ["policy-proposal", "S5", "open", undefined],
    ["coordination-signal", "S3", "resolved", "rework"],
    ["audit-finding", "S3", "resolved", "rework"],
  ], "the proposal is owed to S5 and stays; what was S3's was dispositioned by S3's decision");
  const wait = all.find((o) => o.concern === "recovery-decision");
  assert.ok(wait, "replan cannot be applied by the loop: an obligation says who it waits on");
  assert.equal(wait.consumer, "S3");
  assert.equal(wait.blocks, true);
  assert.match(wait.subject, /^unit u1: replan \(check-failure\)$/);
  assert.equal(all.filter((o) => o.status === "escalated").at(-1)?.successor, wait.id, "the finding S3 could not resolve was escalated to the wait, with a successor");
  assert.deepEqual(await ledger.unrouted(), [], "nothing is left unrouted");
  assert.equal(all.filter((o) => o.unit === "u1" && o.status === "open").length, 2, "the proposal and the wait");

  // The veto: a re-dispatch under the same contract is refused while the wait is open — and a person answers it outside the loop.
  const policy = { ...base.policy, budgets: { ...base.policy.budgets, byUnitType: { implement: { attempts: 4 } } } };
  const refused = await runUnit(gitExec, { ...base, policy, repo, contract, workload, owner: "alice", dispatcher: async () => ({}) });
  assert.equal(refused.status, "refused");
  assert.match(refused.status === "refused" ? refused.problems.map((p) => p.message).join("\n") : "", new RegExp(`obligation ${wait.id.slice(0, 8)} \\(S3, blocking, recovery-decision\\) is open on unit "u1": unit u1: replan \\(check-failure\\); it must be dispositioned before dispatch`));
  await ledger.resolve(wait.id, { by: "alice", disposition: "rework", rationale: "the test expects 42; keep the contract, fix the value" });
  const answered = await runUnit(gitExec, { ...base, policy, repo, contract, workload, owner: "alice", dispatcher: async (request) => {
    hints.push(request.hint);
    await writeFile(path.join(request.worktree, "src", "index.js"), "export const answer = 42;\n");
    await gitExec("git", ["commit", "-qam", "repair"], { cwd: request.worktree });
    await store.writeReport(reportFor(contract, { attempt: 4, summary: "repaired", emergentDecisions: [{ subject: "a comment", choiceOrQuestion: "added one", consequenceIfWrong: "low" }], residualUncertainty: [{ subject: "unicode", reason: "not decided", consequenceIfWrong: "high" }] }));
    return { sessionId: "s4" };
  } });
  assert.equal(answered.status, "closed");
  assert.match(hints.at(-1) ?? "", /^Obligation \w{8} on this unit \(unit u1: replan \(check-failure\)\) was resolved by alice as rework: the test expects 42; keep the contract, fix the value$/);
  all = await ledger.obligations();
  assert.deepEqual(all.filter((o) => o.unit === "u1" && (o.status === "open")).map((o) => [o.concern, o.consumer, o.blocks]), [["policy-proposal", "S5", false], ["uncertainty-signal", "S3", true]], "residual uncertainty of high consequence is owed to S3; the closed unit is not held by it");
  const noted = (await ledger.entries()).filter((e) => "type" in e && e.type === "message-noted");
  assert.equal(noted.length, 1);
  assert.match("reason" in noted[0]! ? noted[0].reason : "", /^info is below blocking, the routing v1 line for operational-signal$/, "a low-consequence emergent decision is routed as trace, with the reason, not dropped");
});

test("intelligence: a research unit runs under its own profile, budget and route; its report is verified by the files it cites; the intelligence it recorded is routed into an obligation per affected unit that vetoes their dispatch until dispositioned — never applied, never replanned; expired intelligence is noted", async (t) => {
  const { ObligationLedger, appendSignal } = await import("@metacoding/vsm-pi-core");
  const repo = await initRepo(t);
  const research = await loadContract(path.join(LAB_ROOT, "contracts", "research-vendored-helper.json"));
  const implement = await loadContract(contractFile);
  const workload = await loadWorkload();
  const base = await withPolicy();
  const store = new ExecutionStore(repo);
  const ledger = new ObligationLedger(repo);

  const researched = await runUnit(gitExec, { ...base, repo, contract: research, workload, owner: "alice", dispatcher: async (request) => {
    assert.equal(request.profile, "intelligence");
    assert.equal(request.route.primary, "anthropic/claude-haiku-4-5", "research runs on the policy's cheaper route");
    // What report_intelligence records (the tool is tested on its own): blocking, naming u1; and one that is already stale.
    await appendSignal(repo, { id: "i1", timestamp: "t", source: "S4", kind: "intelligence-signal", channel: "intelligence", destination: "S3", severity: "blocking", subject: "vendor/left-pad.js", unit: "r1", observation: "line 4 pads with a tab", claim: "the vendored copy is modified", confidence: "high", evidence: [{ class: "file", ref: "src/index.js" }], affectedUnits: ["u1"], observedAt: "2026-09-22T00:00:00.000Z" });
    await appendSignal(repo, { id: "i2", timestamp: "t", source: "S4", kind: "intelligence-signal", channel: "intelligence", destination: "S3", severity: "critical", subject: "node 18 EOL", unit: "r1", observation: "o", evidence: [], affectedUnits: ["u1"], expiresAt: "2020-01-01T00:00:00.000Z" });
    await store.writeReport(reportFor(research, { evidence: [{ class: "file", ref: "src/index.js", observation: "read" }], delegatedResults: [{ decisionId: "d-scope", choice: "whole file" }], unresolvedOutcomes: [] }));
    return { sessionId: "r" };
  } });
  assert.equal(researched.status, "closed", "a research unit closes like any unit: on evidence, not on its claim");
  assert.equal((await store.getUnit("r1"))?.status, "closed");
  const entries = await ledger.entries();
  assert.deepEqual(entries.filter((e) => "type" in e && e.type === "message-noted").map((e) => "reason" in e ? e.reason : ""), ["intelligence expired at 2020-01-01T00:00:00.000Z; stale evidence cannot raise an obligation"]);
  const held = (await ledger.open("u1")).filter((o) => o.blocks);
  assert.deepEqual(held.map((o) => [o.concern, o.consumer, o.severity, o.sources]), [["intelligence-signal", "S3", "blocking", ["i1"]]], "the veto lands on the affected unit before it exists");
  assert.equal(await readFile(path.join(repo, "src", "index.js"), "utf8"), "export const answer = 42;\n", "nothing was applied to the domain");

  const refused = await runUnit(gitExec, { ...base, repo, contract: implement, workload, owner: "alice", dispatcher: async () => { throw new Error("must not dispatch"); } });
  assert.equal(refused.status, "refused");
  assert.match(refused.status === "refused" ? refused.problems[0]?.message ?? "" : "", /\(S3, blocking, intelligence-signal\) is open on unit "u1": vendor\/left-pad\.js; it must be dispositioned before dispatch/);
  assert.equal(await store.getUnit("u1"), undefined, "refused before anything was claimed");

  await ledger.resolve(held[0]!.id, { by: "alice", disposition: "accepted-risk", rationale: "the modification is the fix we are shipping" });
  const dispatched = await runUnit(gitExec, { ...base, repo, contract: implement, workload, owner: "alice", dispatcher: unitThat(async (request, s) => {
    assert.equal(request.hint, undefined, "an intelligence disposition is not a recovery answer; the contract stands as written");
    await writeFile(path.join(request.worktree, "src.txt"), "fixed\n");
    await gitExec("git", ["commit", "-qam", "fix"], { cwd: request.worktree });
    await s.writeReport(reportFor(implement));
  }, repo) });
  assert.equal(dispatched.status, "closed");
});

test("identity in code (lesson 12): a fixed decision must cite an authority that exists, and a unit that commits a change under a protected prefix on its branch fails the identity-untouched check at closeout — INV-001 as evidence, not as a sentence", async (t) => {
  const { AuditLog, ObligationLedger } = await import("@metacoding/vsm-pi-core");
  const repo = await initRepo(t);
  const base = await loadContract(contractFile);
  const workload = await loadWorkload();
  const options = { ...(await withPolicy()), repo, workload, owner: "alice" };

  const freeText: WorkContract = { ...base, fixed: [{ id: "f-x", subject: "x", decision: "y", authorityRef: "S3 planning decision P1 (lesson 06)" }, { id: "f-y", subject: "x", decision: "y", authorityRef: "INV-099" }] };
  const refused = await runUnit(gitExec, { ...options, contract: freeText, dispatcher: async () => { throw new Error("must not dispatch"); } });
  assert.equal(refused.status, "refused");
  assert.deepEqual(refused.status === "refused" ? refused.problems.map((p) => p.path) : [], ["fixed[0].authorityRef", "fixed[1].authorityRef"]);
  assert.match(refused.status === "refused" ? refused.problems[0]?.message ?? "" : "", /is free text; an authority is an invariant \(INV-nnn\)/);
  assert.match(refused.status === "refused" ? refused.problems[1]?.message ?? "" : "", /cites INV-099, which the identity does not declare \(it declares INV-001, INV-002, INV-003, INV-004\)/);
  assert.equal(await new ExecutionStore(repo).getUnit("u1"), undefined, "nothing was claimed");

  // The route lesson 10 could not close: edit the identity and commit in one shell command. The tree is clean; the branch is not.
  const cited: WorkContract = { ...base, fixed: [...base.fixed, { id: "f-identity", subject: "identity", decision: "untouched", authorityRef: "INV-001" }] };
  const outcome = await runUnit(gitExec, { ...options, contract: cited, dispatcher: unitThat(async (request, store) => {
    await writeFile(path.join(request.worktree, "regulator", "identity", "INVARIANTS.md"), "# relaxed\n\n## INV-001 — Identity is editable\n\nsure\n");
    await writeFile(path.join(request.worktree, "src.txt"), "fixed\n");
    await gitExec("git", ["commit", "-qam", "fix, and relax the invariant while we are here"], { cwd: request.worktree });
    await store.writeReport(reportFor(cited));
  }, repo) });
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.status === "blocked" && outcome.reason, "check-failure");
  const verdict = outcome.status === "blocked" ? outcome.verdict : undefined;
  assert.equal(verdict?.verdict, "fail");
  assert.deepEqual(verdict?.failed, ["e-checks"], "the identity check speaks to the command-class criterion");
  assert.match(verdict?.reasons.join("\n") ?? "", /identity-untouched — protected paths changed on the branch \(INV-001\): regulator\/identity\/INVARIANTS\.md/);
  const audit = await new AuditLog(repo).forUnit("u1");
  assert.deepEqual(audit.evidence.filter((r) => r.check === "identity-untouched").map((r) => r.verdict), ["fail"]);
  assert.equal(await readFile(path.join(repo, "regulator", "identity", "INVARIANTS.md"), "utf8").then((s) => s.includes("editable")), false, "nothing reintegrated");
  const owed = (await new ObligationLedger(repo).open("u1")).filter((o) => o.concern === "audit-finding");
  assert.deepEqual(owed.map((o) => [o.severity, o.blocks]), [["blocking", true]], "the closeout finding names INV-001; the routing floor keeps it at blocking");
});

test("algedonic (lesson 13): a unit that asked a person and got no answer is recorded as paused, not routed and not retried; what is owed to a person is delivered to the outbox once; `answer` is the person's disposition and the next attempt carries it as the hint", async (t) => {
  const { EffectJournal, ObligationLedger } = await import("@metacoding/vsm-pi-core");
  const { loadRecoveryPolicy } = await import("./recovery-policy.js");
  const { driveUnit, routeUnit } = await import("./controller.js");
  const { deliverPending, remindDue } = await import("./deliver.js");
  const { OUTBOX_RELATIVE_PATH } = await import("./cp7-recovery.js");
  const repo = await initRepo(t);
  const contract = await loadContract(contractFile);
  const workload = await loadWorkload();
  const recovery = await loadRecoveryPolicy();
  const base = await withPolicy();
  let clock = Date.parse("2026-09-22T12:00:00.000Z");
  const now = () => clock;
  const store = new ExecutionStore(repo, now);
  const ledger = new ObligationLedger(repo, now);
  const hints: Array<string | undefined> = [];

  // The unit asks for consent headlessly (what checkpoint 12 does in the session) and reports what it has.
  const driven = await driveUnit(gitExec, {
    ...base, repo, contract, workload, recovery, owner: "alice", now,
    dispatcher: async (request) => {
      hints.push(request.hint);
      const o = await ledger.openObligation({ subject: "consent: force-push", unit: "u1", concern: "interaction", sources: ["ask:1"], severity: "blocking", consumer: "human", blocks: true, question: "The branch diverged; may I force-push?", openedBy: "S1" });
      await ledger.requestInteraction({ id: "r1", kind: "consent", subject: "force-push", question: "The branch diverged; may I force-push?", action: "git push --force", severity: "blocking", unit: "u1", attempt: request.attempt, obligationId: o.id, evidence: [], raisedBy: "S1", raisedAt: new Date(clock).toISOString(), timeoutMs: 1000, channel: "none" }, "S1");
      await ledger.answerInteraction({ requestId: "r1", outcome: "unavailable", by: "S1", channel: "none" });
      await store.writeReport(reportFor(contract, { attempt: request.attempt, summary: "paused on consent" }));
      return { sessionId: `s${request.attempt}` };
    },
  });
  assert.equal(driven.final.status, "blocked");
  assert.equal(driven.final.status === "blocked" && driven.final.reason, "paused");
  assert.match(driven.final.status === "blocked" ? driven.final.detail ?? "" : "", /^consent: force-push — The branch diverged; may I force-push\? \(obligation [0-9a-f]{8}\)$/);
  assert.deepEqual(driven.decisions, [], "the recovery policy has nothing to say while a person is asked: no retry, no repair, no attempt spent on it");
  const unit = await store.getUnit("u1");
  assert.equal(unit?.status, "blocked");
  assert.match(unit?.reason ?? "", /^paused: awaiting a person — consent: force-push/);
  assert.deepEqual((await store.listAttempts("u1")).map((a) => a.outcome), ["paused"]);
  assert.equal(await routeUnit(gitExec, { repo, unitId: "u1", policy: base.policy, recovery, routing: base.routing, interaction: base.interaction, now }), undefined, "not routed while the question is open");

  // Delivered once, through the effect journal, to the same outbox notify_owner uses; recorded on the obligation.
  const owed = (await ledger.open("u1")).find((o) => o.concern === "interaction")!;
  const outbox = await readFile(path.join(repo, OUTBOX_RELATIVE_PATH), "utf8");
  assert.match(outbox, new RegExp(`^deliver:${owed.id}:0 2026-09-22T12:00:00\\.000Z u1 blocking veto interaction on u1: consent: force-push — The branch diverged; may I force-push\\? \\(answer with \`regulator answer ${owed.id.slice(0, 8)}\` or \`regulator obligation resolve ${owed.id.slice(0, 8)}\`\\)\\n$`));
  assert.deepEqual(owed.deliveries, [{ at: "2026-09-22T12:00:00.000Z", channel: "outbox", reminder: false, target: "outbox" }]);
  assert.deepEqual(await deliverPending(repo, { policy: base.interaction, now }), [], "nothing pending is delivered twice");
  assert.deepEqual(await remindDue(repo, { policy: base.interaction, now }), [], "not yet due");
  clock += base.interaction.reminderAfterMs;
  const reminded = await remindDue(repo, { policy: base.interaction, now });
  assert.deepEqual(reminded.map((d) => [d.obligation.id, d.reminder]), [[owed.id, true]]);
  assert.match(await readFile(path.join(repo, OUTBOX_RELATIVE_PATH), "utf8"), /\ndeliver:[0-9a-f-]+:1 2026-09-22T13:00:00\.000Z u1 REMINDER: blocking veto interaction/);
  assert.deepEqual((await new EffectJournal(repo, now).states()).filter((e) => e.tool === "deliver").map((e) => e.status), ["committed", "committed"]);
  assert.equal((await ledger.get(owed.id))?.status, "open", "delivered twice; still not answered");

  // The veto holds re-dispatch; a person's answer releases it and reaches the next attempt.
  const refused = await runUnit(gitExec, { ...base, repo, contract, workload, owner: "alice", now, dispatcher: async () => ({}) });
  assert.equal(refused.status, "refused");
  assert.match(refused.status === "refused" ? refused.problems[0]?.message ?? "" : "", /\(human, blocking, interaction\) is open on unit "u1": consent: force-push; it must be dispositioned before dispatch/);
  clock += 1000;
  await ledger.answerInteraction({ requestId: "r1", outcome: "answered", answer: "no, rebase instead", by: "alice", channel: "cli" });
  await ledger.resolve(owed.id, { by: "alice", disposition: "rejected", rationale: "no, rebase instead" });
  const resumed = await runUnit(gitExec, { ...base, repo, contract, workload, owner: "alice", now, dispatcher: async (request) => {
    hints.push(request.hint);
    await writeFile(path.join(request.worktree, "src", "index.js"), "export const answer = 42;\n");
    await gitExec("git", ["commit", "-qam", "rebased, as told"], { cwd: request.worktree });
    await store.writeReport(reportFor(contract, { attempt: request.attempt, summary: "done without the force-push" }));
    return { sessionId: "s2" };
  } });
  assert.equal(resumed.status, "closed", JSON.stringify(resumed));
  assert.deepEqual(hints, [undefined, "Your question (consent: force-push: The branch diverged; may I force-push?) was answered by alice — rejected: no, rebase instead. Do not perform what was refused."]);
  assert.deepEqual((await store.listAttempts("u1")).map((a) => a.outcome), ["paused", "reported"]);
});
