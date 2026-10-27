import assert from "node:assert/strict";
import { cp, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { AuditLog, MemoryStore, ObligationLedger, checkDefinition, checkDispositionAuthority, dispositionForAnswer, isReadOnlyProfile, readSignals } from "@metacoding.io/regulator-core";
import { driveUnit } from "./controller.js";
import { loadContract } from "./contract-file.js";
import { gitExec } from "./git-support.js";
import { initInstance } from "./instance.js";
import { loadInteractionPolicy } from "./interaction-policy.js";
import { loadPolicy } from "./policy.js";
import { portfolioDispatcher, type PortfolioBehaviour } from "./portfolio-scripted.js";
import { PROFILES } from "./profiles.js";
import { loadRecoveryPolicy } from "./recovery-policy.js";
import { loadRoutingPolicy } from "./routing-policy.js";
import { createHash } from "node:crypto";
import { isEvalReport, metricNames } from "@metacoding.io/regulator-protocol";
import { EVALS_DIR, REPORTS_DIR, loadSuite, runSuite } from "./evals.js";
import { portfolioDispatchers } from "./portfolio-scripted.js";
import { LAB_ROOT, loadWorkloadFor } from "./workload.js";

const FIXTURE = path.join(LAB_ROOT, "fixture-portfolio");
const CONTRACTS = path.join(LAB_ROOT, "contracts", "portfolio");
const PORTFOLIO_POLICY = path.join(LAB_ROOT, "policies", "portfolio.json");
const WRITABLE = ["lots/", "targets/", "trades/pending/", "reports/"];
const PROTECTED = ["positions/", "prices/", "trades/executed/"];
/** A clock that moves: an answer recorded after an attempt ended must be later than it, as it would be for a person. */
let tick = Date.parse("2026-10-01T09:00:00.000Z");
const clock = () => (tick += 1000);

/** The managed portfolio as a repository of its own, initialized as an instance with the layout the worked example declares. */
async function portfolioInstance(t: TestContext): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-portfolio-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await cp(FIXTURE, dir, { recursive: true });
  for (const args of [["init", "--quiet", "-b", "main"], ["add", "-A"], ["-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "the portfolio as of the August close"]]) {
    const r = await gitExec("git", args, { cwd: dir });
    if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  }
  await initInstance(gitExec, { repo: dir, writablePaths: WRITABLE, protectedPaths: PROTECTED, by: "alice", now: clock });
  return dir;
}

async function close(repo: string, behaviour: PortfolioBehaviour, unitIds: string[]) {
  const workload = await loadWorkloadFor("portfolio");
  const interaction = await loadInteractionPolicy();
  const base = { repo, workload, policy: await loadPolicy(PORTFOLIO_POLICY), policyPath: PORTFOLIO_POLICY, recovery: await loadRecoveryPolicy(), routing: await loadRoutingPolicy(), interaction, owner: "alice", now: clock };
  const dispatcher = portfolioDispatcher(gitExec, { behaviour, repo, interaction, now: clock });
  const outcomes = [];
  for (const unitId of unitIds) outcomes.push({ unitId, ...(await driveUnit(gitExec, { ...base, contract: await loadContract(path.join(CONTRACTS, `${unitId}.json`)), dispatcher })) });
  return outcomes;
}

/** Every file under a prefix, with its bytes: what "byte-identical" compares. */
async function tree(root: string, prefix: string): Promise<Array<[string, string]>> {
  const dir = path.join(root, prefix);
  const files = (await readdir(dir, { recursive: true })).filter((f) => !f.startsWith(".")).sort();
  const out: Array<[string, string]> = [];
  for (const f of files) {
    const content = await readFile(path.join(dir, f), "utf8").catch(() => undefined);
    if (content !== undefined) out.push([f, content]);
  }
  return out;
}

/** The protected prefixes on the base are byte for byte what the fixture shipped, after every close. */
async function assertProtectedUntouched(repo: string) {
  for (const prefix of PROTECTED) assert.deepEqual(await tree(repo, prefix), await tree(FIXTURE, prefix), `${prefix} on the base is byte for byte what the custodian and the person wrote`);
}

/** The consent gate's refusals on the record (#60): the operational-signals the interception writes before a guarded write runs. */
async function refusals(repo: string) {
  return (await readSignals(repo)).filter((s) => s.kind === "operational-signal" && s.subject.startsWith("consent refused:")) as Array<{ unit?: string; subject: string; observation: string; evidence: Array<{ class: string; ref: string; observation?: string }> }>;
}

async function pendingFiles(repo: string): Promise<string[]> {
  return (await readdir(path.join(repo, "trades", "pending"))).filter((f) => f.endsWith(".json")).sort();
}

test("the definition declares the third workload: portfolio runs under the manager and auditor profiles, the manager has no shell and the portfolio policy budgets its unit types, and the check passes with three workloads", async () => {
  const checked = await checkDefinition(LAB_ROOT);
  assert.deepEqual(checked.problems, []);
  assert.deepEqual(checked.workloads.map((w) => w.name).sort(), ["personal-finance", "portfolio", "software-development"]);
  const portfolio = checked.workloads.find((w) => w.name === "portfolio")!;
  assert.deepEqual(portfolio.unitTypes.map((u) => [u.name, u.profile]), [["ingest-positions", "manager"], ["propose-target", "manager"], ["plan-rebalance", "manager"], ["review", "auditor"], ["close-period", "auditor"]]);
  assert.deepEqual(portfolio.unitTypes.map((u) => u.checks), [
    ["run_checks", "run_tests", "inherited-tests", "identity-untouched", "glossary-lint"], ["run_checks", "run_tests", "inherited-tests", "identity-untouched", "glossary-lint"], ["run_checks", "run_tests", "inherited-tests", "identity-untouched", "glossary-lint"],
    ["run_tests", "inherited-tests", "identity-untouched"], [],
  ], "the checks per unit type the note's S1 table names");
  assert.equal(isReadOnlyProfile(PROFILES.auditor!), true, "the auditor grants nothing with a write, execution or side effect");
  assert.equal(PROFILES.manager!.tools.includes("bash"), false, "no shell: the write grant is complete at the tool boundary");
  assert.deepEqual(PROFILES.manager!.writablePaths, WRITABLE);
  assert.deepEqual(PROFILES.manager!.consent, [{ tool: "write", paths: ["trades/pending/"] }, { tool: "edit", paths: ["trades/pending/"] }], "the trade list is a write under a guarded prefix (#60): the grant names the tool and the path, not a place_trade tool");
  for (const outside of ["lib/", "test/", "universe.json", "tax.json", "benchmark.json", ...PROTECTED]) assert.ok(!PROFILES.manager!.writablePaths.some((p) => outside.startsWith(p)), `${outside} is outside the manager's grant`);
  assert.ok(Object.hasOwn(checked.advice.files, "manager"), "the manager's advice is a file in the definition");
  assert.ok(checked.policies.some((p) => p.name === "portfolio" && Object.keys(p.budgets.byUnitType ?? {}).includes("plan-rebalance")));
  assert.equal(checked.policies.find((p) => p.name === "portfolio")!.budgets.byUnitType!["plan-rebalance"]!.attempts, 3, "the first attempt is spent asking for consent; a refused list still has a repair");
});

test("the September close, done as the contracts ask: the lots are brought up to date and the review written on host-run evidence bound to the revision, the target is feasible, the trade list waits on one consent question naming every trade and lands inside the band once a person says yes, the review closes, and the custodian's exports and the person's fills are byte for byte what they were", async (t) => {
  const repo = await portfolioInstance(t);
  const outcomes = await close(repo, "manager", ["p1-ingest-positions", "p2-propose-target"]);
  for (const o of outcomes) {
    assert.equal(o.final.status, "closed", `${o.unitId}: ${JSON.stringify(o.final)}`);
    assert.deepEqual(o.decisions, [], `${o.unitId} needed no recovery`);
    if (o.final.status === "closed") assert.equal(o.final.preMerge?.verdict, "pass", `${o.unitId}: the merged tree passes the portfolio's checks before it lands`);
  }
  const lots = await readFile(path.join(repo, "lots", "lots.csv"), "utf8");
  assert.match(lots, /^2026-09-02-BND,BND,2026-09-02,4,72\.30$/m, "the 2 September fill opened a lot");
  assert.match(lots, /^2025-03-14-VTI,VTI,2025-03-14,54,250\.00$/m, "the 2 September sell reduced the 2025 lot");
  assert.match(await readFile(path.join(repo, "lots", "lots.json"), "utf8"), /"asOf": "2026-09-30"/);
  const report = await readFile(path.join(repo, "reports", "2026-09.md"), "utf8");
  assert.match(report, /^Time-weighted return: 2\.71%\.$/m, "chained over the three exports with the deposit valued on its day; the naive return would be 3.98%");
  assert.match(report, /Open items:\n- VNQ 2 shares/);
  assert.doesNotMatch(await readFile(path.join(repo, "targets", "2026-09-30.json"), "utf8"), /"band"/, "the band is the benchmark's, not the target's: a unit-written file carries no number a check judges it by");
  assert.match(await readFile(path.join(repo, "benchmark.json"), "utf8"), /"band": 0\.02/);

  const audit = new AuditLog(repo);
  const p1 = await audit.forUnit("p1-ingest-positions");
  assert.deepEqual(p1.evidence.filter((r) => r.attempt === 1 && !r.check.startsWith("pre-merge:")).map((r) => [r.check, r.verdict]), [["run_checks:syntax:lib/portfolio.js", "pass"], ["run_tests", "pass"], ["inherited-tests", "pass"], ["identity-untouched", "pass"], ["glossary-lint", "pass"]], "the workload's checks, with the portfolio's suite discovered from package.json");
  assert.deepEqual(p1.evidence.filter((r) => r.check.startsWith("pre-merge:")).map((r) => [r.check, r.verdict]), [["pre-merge:run_checks:syntax:lib/portfolio.js", "pass"], ["pre-merge:run_tests", "pass"]]);
  assert.match(p1.evidence.find((r) => r.check === "run_tests")!.observation, /^7 passed, 0 failed/, "the six assertions ran, and the turnover arithmetic's test beside them");
  const memory = await new MemoryStore(repo, clock).current("plan-rebalance");
  assert.deepEqual(memory.map((m) => [m.subject, m.scope]), [["VNQ, 2 shares", ["ingest-positions", "plan-rebalance", "review"]]]);
  assert.deepEqual(await new MemoryStore(repo, clock).current("propose-target"), [], "scoped memory is rendered to the unit types it names");

  // The trade list: one consent question for the whole list, nobody there, the unit pauses; what is owed reaches the outbox; a person answers; the next attempt carries it.
  const [paused] = await close(repo, "manager", ["p3-plan-rebalance"]);
  assert.equal(paused!.final.status, "blocked");
  assert.equal(paused!.final.status === "blocked" ? paused!.final.reason : "", "paused");
  assert.deepEqual(paused!.decisions, [], "a paused unit is not routed: the recovery policy has nothing to say until a person answers");
  assert.deepEqual(await pendingFiles(repo), [], "nothing exists under trades/pending/ without a yes");
  assert.deepEqual(await refusals(repo), [], "the manager asked before it wrote: the gate had nothing to refuse");
  const ledgerStore = new ObligationLedger(repo, clock);
  const owed = (await ledgerStore.open("p3-plan-rebalance")).filter((o) => o.concern === "interaction");
  assert.equal(owed.length, 1, "one question per list, not one per trade");
  const o = owed[0]!;
  assert.deepEqual([o.consumer, o.severity, o.blocks, o.subject], ["human", "blocking", true, "consent: the September trade list"]);
  for (const named of [/sell 3 VTI from lot 2025-03-14-VTI \(gain 139\.50, long-term, tax 20\.93\)/, /sell 4 BND from lot 2026-09-02-BND \(gain 6\.40, short-term, tax 2\.24\)/, /buy 29 VXUS at 58\.90/, /Realised tax 23\.17 in all/]) assert.match(o.question ?? "", named, "the question names every trade, the lots it sells from and the tax it realises");
  assert.match(await readFile(path.join(repo, ".regulator", "outbox"), "utf8"), new RegExp(`deliver:${o.id}`), "delivered to the outbox for a person");
  const request = (await ledgerStore.interactions()).find((i) => i.request.obligationId === o.id)!;
  assert.deepEqual([request.request.kind, request.answers[0]?.outcome], ["consent", "unavailable"]);
  assert.deepEqual(request.request.call, { tool: "write", arguments: { path: "trades/pending/2026-09-30.json" } }, "the question records the call a yes authorizes: what the consent gate matches (#60)");
  const interaction = await loadInteractionPolicy();
  assert.equal(checkDispositionAuthority(interaction, "bob", { severity: o.severity }), undefined, "bob may disposition up to blocking");
  await ledgerStore.answerInteraction({ requestId: request.request.id, outcome: "answered", answer: "yes", by: "alice", channel: "cli" });
  await ledgerStore.resolve(o.id, { by: "alice", disposition: dispositionForAnswer("consent", "yes"), rationale: "yes" });
  const [done] = await close(repo, "manager", ["p3-plan-rebalance"]);
  assert.equal(done!.final.status, "closed", JSON.stringify(done!.final));
  assert.deepEqual(await pendingFiles(repo), ["2026-09-30.json"]);
  const list = JSON.parse(await readFile(path.join(repo, "trades", "pending", "2026-09-30.json"), "utf8")) as { trades: Array<{ ticker: string; side: string; shares: number; lots?: Array<{ lot: string; shares: number }> }> };
  assert.deepEqual(list.trades, [
    { ticker: "VTI", side: "sell", shares: 3, lots: [{ lot: "2025-03-14-VTI", shares: 3 }] },
    { ticker: "BND", side: "sell", shares: 4, lots: [{ lot: "2026-09-02-BND", shares: 4 }] },
    { ticker: "VXUS", side: "buy", shares: 29 },
  ], "the list the person consented to: BND from the 2 September lot, since the 2025 lot's loss would be a wash sale against that fill");
  assert.equal((await ledgerStore.open()).filter((x) => x.blocks).length, 0, "nothing is owed that holds a unit");
  const p3 = await audit.forUnit("p3-plan-rebalance");
  assert.deepEqual(p3.verdicts.map((v) => v.verdict), ["pass"], "the paused attempt produced no verdict; the consented one passed");

  const [review] = await close(repo, "manager", ["p4-review"]);
  assert.equal(review!.final.status, "closed", JSON.stringify(review!.final));
  assert.deepEqual((await audit.forUnit("p4-review")).evidence.map((r) => r.check), ["run_tests", "inherited-tests", "identity-untouched", "pre-merge:run_tests"], "a read-only unit is still verified by the host, and the merged tree before its (empty) reintegration too");
  await assertProtectedUntouched(repo);
});

test("the careless close: the trade list written without asking anyone is refused at the write by the consent gate — an operational-signal, the tree unchanged — and the unit then asks; after the yes, a list that trades past the target, sells from a lot the portfolio does not hold and creates a wash sale is refused by the portfolio's checks, each by name; the repair attempt writes on the yes already recorded without asking again, the unit closes, and the base never received the refused list", async (t) => {
  const repo = await portfolioInstance(t);
  for (const o of await close(repo, "careless", ["p1-ingest-positions", "p2-propose-target"])) assert.equal(o.final.status, "closed", `${o.unitId}: ${JSON.stringify(o.final)}`);
  const [paused] = await close(repo, "careless", ["p3-plan-rebalance"]);
  assert.equal(paused!.final.status === "blocked" ? paused!.final.reason : "", "paused");
  assert.deepEqual(paused!.decisions, [], "refused at the write, not at closeout");
  assert.deepEqual(await pendingFiles(repo), [], "the tree is unchanged before the yes");
  assert.deepEqual(await tree(repo, "trades/pending/"), await tree(FIXTURE, "trades/pending/"));
  let seen = await refusals(repo);
  assert.equal(seen.length, 1, "one refusal, by the gate (#60)");
  assert.deepEqual([seen[0]!.unit, seen[0]!.subject, seen[0]!.evidence], ["p3-plan-rebalance", "consent refused: write trades/pending/2026-09-30.json", [{ class: "file", ref: "trades/pending/2026-09-30.json", observation: "absent" }]]);
  assert.match(seen[0]!.observation, /falls under profile "manager"'s consent grant \(under trades\/pending\/\) and was refused before it ran: no consent for this call is on the record for unit p3-plan-rebalance\./);
  const ledgerStore = new ObligationLedger(repo, clock);
  const [o] = (await ledgerStore.open("p3-plan-rebalance")).filter((x) => x.concern === "interaction");
  const request = (await ledgerStore.interactions()).find((i) => i.request.obligationId === o!.id)!;
  assert.deepEqual(request.request.call, { tool: "write", arguments: { path: "trades/pending/2026-09-30.json" } });
  await ledgerStore.answerInteraction({ requestId: request.request.id, outcome: "answered", answer: "yes", by: "alice", channel: "cli" });
  await ledgerStore.resolve(o!.id, { by: "alice", disposition: dispositionForAnswer("consent", "yes"), rationale: "yes" });
  const [done] = await close(repo, "careless", ["p3-plan-rebalance"]);
  assert.equal(done!.final.status, "closed", JSON.stringify(done!.final));
  assert.deepEqual(done!.decisions.map((d) => [d.cause, d.action]), [["check-failure", "repair"]]);
  // The yes holds across attempts (open questions §6, from #120): the repair attempt's hint is the router's, and the gate read
  // the consent off the ledger for the same call. One question was asked in three attempts; nothing was refused after the yes.
  assert.equal((await ledgerStore.interactions()).filter((i) => i.request.unit === "p3-plan-rebalance").length, 1, "the repair attempt did not ask again for the same action");
  seen = await refusals(repo);
  assert.equal(seen.length, 1);
  const audit = new AuditLog(repo);
  const { verdicts } = await audit.forUnit("p3-plan-rebalance");
  assert.deepEqual(verdicts.map((v) => v.verdict), ["fail", "pass"]);
  const refused = verdicts[0]!.reasons.join("\n");
  assert.match(refused, /run_tests/);
  for (const check of [/not ok: every pending trade list moves each position toward its target, not past it, and lands every targeted position inside the benchmark's band/, /not ok: every sell in a pending list names lots the portfolio holds, in the shares it holds/, /not ok: no trade in a pending list creates a wash sale against the lot history/]) assert.match(refused, check, "refused by the named check");
  const list = JSON.parse(await readFile(path.join(repo, "trades", "pending", "2026-09-30.json"), "utf8")) as { trades: Array<{ ticker: string; shares: number; lots?: Array<{ lot: string }> }> };
  assert.deepEqual(list.trades.map((x) => [x.ticker, x.shares, x.lots?.map((l) => l.lot) ?? []]), [["VTI", 3, ["2025-03-14-VTI"]], ["BND", 4, ["2026-09-02-BND"]], ["VXUS", 29, []]], "the base carries the repaired list, never the refused one");
  await assertProtectedUntouched(repo);
});

test("the first declared metric (#129): the portfolio workload declares turnover with its grader command, a small suite over the fixture pre-registers it beside three built-ins, and a scripted run carries it per arm with its interval, per run with its observation, and in the fingerprint with the grader's file hash — without a report committed, since nobody has read it", async (t) => {
  t.diagnostic("runs p1 and p2 under two arms, two repetitions each; ~40 seconds");
  const suite = await loadSuite(path.join(EVALS_DIR, "portfolio-turnover.json"));
  assert.deepEqual(metricNames(suite.metrics), ["closed", "attempts", "refusals", "workload:portfolio/turnover"], "pre-registered: three built-ins and the one declared metric");
  const workload = await loadWorkloadFor("portfolio");
  assert.deepEqual(workload.metrics?.map((m) => [m.name, m.kind, m.direction, m.instrument, m.grader.argv]), [["workload:portfolio/turnover", "rate", "lower", undefined, ["node", "workload/portfolio/turnover.mjs"]]], "declared beside the workload that owns it, as data, deterministic (no instrument)");
  const report = await runSuite(gitExec, {
    suite, dispatcherFor: portfolioDispatchers(gitExec, "manager", clock), owner: "eval", now: clock, policyPath: PORTFOLIO_POLICY, instance: { writablePaths: WRITABLE, protectedPaths: PROTECTED },
    dispatcher: "scripted:manager", model: "none", interpretation: "test", interpretedBy: "test",
  });
  assert.ok(isEvalReport(report), "the report validates");
  assert.equal(report.suite.optimise, "workload:portfolio/turnover", "the one metric an optimiser could select on is stored on the report; nothing optimised anything");
  assert.deepEqual(report.arms.map((a) => [a.arm, a.runs, Object.keys(a.metrics)]), [["control", 4, metricNames(suite.metrics)], ["treatment", 4, metricNames(suite.metrics)]], "two tasks × two repetitions per arm, summarized over the pre-registered metrics only");
  const byTask = (arm: string) => Object.fromEntries(report.runs.filter((r) => r.arm === arm && r.repetition === 1).map((r) => [r.task, r]));
  for (const arm of ["control", "treatment"]) {
    const runs = byTask(arm);
    assert.deepEqual(Object.values(runs).map((r) => [r.outcome, r.metrics.refusals, r.metrics.boundaryViolations]), [["closed", 0, 0], ["closed", 0, 0]], `${arm}: both units close on the first attempt, and the writes under the manifest's prefixes are no boundary violation`);
    // After p1 the latest target is still August's; after p2 the September target the unit wrote is what the custodian's 30 September positions are measured against.
    const p1 = runs["p1-ingest-positions"]!.graders.find((g) => g.grader === "workload:portfolio/turnover")!;
    const p2 = runs["p2-propose-target"]!.graders.find((g) => g.grader === "workload:portfolio/turnover")!;
    assert.equal(p1.kind, "declared");
    assert.equal(p1.value.toFixed(4), "0.0317", `${arm}: the August target against the 30 September export: 2.33% over on VTI, 3.34% under on VXUS, 0.68% under on BND, halved`);
    assert.equal(p1.observation, "targets/2026-08-31.json against positions/2026-09-30.csv at prices/2026-09-30.csv: VTI 2.33% over, VXUS 3.34% under, BND 0.68% under");
    assert.equal(p2.value.toFixed(4), "0.0450", `${arm}: the September target the unit proposed, tilted toward VXUS, implies more trading`);
    assert.match(p2.observation, /^targets\/2026-09-30\.json against positions\/2026-09-30\.csv at prices\/2026-09-30\.csv: VTI 2\.33% over, VXUS 5\.34% under, BND 1\.32% over$/);
    assert.equal(runs["p2-propose-target"]!.metrics["workload:portfolio/turnover"], p2.value, "the declared value is folded into the run's metrics beside the built-ins");
    const summary = report.arms.find((a) => a.arm === arm)!.metrics["workload:portfolio/turnover"]!;
    assert.equal(summary.n, 4);
    assert.equal(summary.mean.toFixed(4), "0.0383");
    assert.deepEqual([summary.min.toFixed(4), summary.max.toFixed(4)], ["0.0317", "0.0450"]);
    assert.ok(summary.ci95[0] < summary.mean && summary.mean < summary.ci95[1], `${arm}: a Student's t interval on four runs: ${JSON.stringify(summary.ci95)}`);
  }
  const lift = report.lifts.find((l) => l.arm === "treatment" && l.metric === "workload:portfolio/turnover")!;
  assert.deepEqual([lift.delta, lift.separated], [0, false], "the scripted manager proposes the same target under every arm, so the gates change nothing about turnover — the lift is a zero with overlapping intervals, not a claim");
  const file = "workload/portfolio/turnover.mjs";
  assert.deepEqual(report.fingerprint.graders, [{ metric: "workload:portfolio/turnover", argv: ["node", file], file, sha256: createHash("sha256").update(await readFile(path.join(LAB_ROOT, file))).digest("hex") }], "the fingerprint says what measured it");
  assert.deepEqual(Object.keys(report.fingerprint.policies), ["portfolio", "recovery", "routing", "interaction"], "the units ran under the portfolio budget policy");
  assert.ok(!(await readdir(REPORTS_DIR)).some((f) => f.startsWith("portfolio")), "no portfolio report is committed under evals/reports/: a report commits only with a person's interpretation");
});
