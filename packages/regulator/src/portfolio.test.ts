import assert from "node:assert/strict";
import { cp, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { AuditLog, MemoryStore, ObligationLedger, checkDefinition, checkDispositionAuthority, dispositionForAnswer, isReadOnlyProfile } from "@metacoding.io/regulator-core";
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
  assert.match(await readFile(path.join(repo, "targets", "2026-09-30.json"), "utf8"), /"band": 0\.02/);

  const audit = new AuditLog(repo);
  const p1 = await audit.forUnit("p1-ingest-positions");
  assert.deepEqual(p1.evidence.filter((r) => r.attempt === 1 && !r.check.startsWith("pre-merge:")).map((r) => [r.check, r.verdict]), [["run_checks:syntax:lib/portfolio.js", "pass"], ["run_tests", "pass"], ["inherited-tests", "pass"], ["identity-untouched", "pass"], ["glossary-lint", "pass"]], "the workload's checks, with the portfolio's suite discovered from package.json");
  assert.deepEqual(p1.evidence.filter((r) => r.check.startsWith("pre-merge:")).map((r) => [r.check, r.verdict]), [["pre-merge:run_checks:syntax:lib/portfolio.js", "pass"], ["pre-merge:run_tests", "pass"]]);
  assert.match(p1.evidence.find((r) => r.check === "run_tests")!.observation, /^6 passed, 0 failed/, "the six assertions ran");
  const memory = await new MemoryStore(repo, clock).current("plan-rebalance");
  assert.deepEqual(memory.map((m) => [m.subject, m.scope]), [["VNQ, 2 shares", ["ingest-positions", "plan-rebalance", "review"]]]);
  assert.deepEqual(await new MemoryStore(repo, clock).current("propose-target"), [], "scoped memory is rendered to the unit types it names");

  // The trade list: one consent question for the whole list, nobody there, the unit pauses; what is owed reaches the outbox; a person answers; the next attempt carries it.
  const [paused] = await close(repo, "manager", ["p3-plan-rebalance"]);
  assert.equal(paused!.final.status, "blocked");
  assert.equal(paused!.final.status === "blocked" ? paused!.final.reason : "", "paused");
  assert.deepEqual(paused!.decisions, [], "a paused unit is not routed: the recovery policy has nothing to say until a person answers");
  assert.deepEqual(await pendingFiles(repo), [], "nothing exists under trades/pending/ without a yes");
  const ledgerStore = new ObligationLedger(repo, clock);
  const owed = (await ledgerStore.open("p3-plan-rebalance")).filter((o) => o.concern === "interaction");
  assert.equal(owed.length, 1, "one question per list, not one per trade");
  const o = owed[0]!;
  assert.deepEqual([o.consumer, o.severity, o.blocks, o.subject], ["human", "blocking", true, "consent: the September trade list"]);
  for (const named of [/sell 3 VTI from lot 2025-03-14-VTI \(gain 139\.50, long-term, tax 20\.93\)/, /sell 4 BND from lot 2026-09-02-BND \(gain 6\.40, short-term, tax 2\.24\)/, /buy 29 VXUS at 58\.90/, /Realised tax 23\.17 in all/]) assert.match(o.question ?? "", named, "the question names every trade, the lots it sells from and the tax it realises");
  assert.match(await readFile(path.join(repo, ".regulator", "outbox"), "utf8"), new RegExp(`deliver:${o.id}`), "delivered to the outbox for a person");
  const request = (await ledgerStore.interactions()).find((i) => i.request.obligationId === o.id)!;
  assert.deepEqual([request.request.kind, request.answers[0]?.outcome], ["consent", "unavailable"]);
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

test("the careless close: a list that trades past the target, sells from a lot the portfolio does not hold and creates a wash sale is refused by the portfolio's checks, each by name, at the first attempt that writes; the unit closes on the repair the recovery policy grants, and the base never received the refused list", async (t) => {
  const repo = await portfolioInstance(t);
  for (const o of await close(repo, "careless", ["p1-ingest-positions", "p2-propose-target"])) assert.equal(o.final.status, "closed", `${o.unitId}: ${JSON.stringify(o.final)}`);
  const [paused] = await close(repo, "careless", ["p3-plan-rebalance"]);
  assert.equal(paused!.final.status === "blocked" ? paused!.final.reason : "", "paused");
  assert.deepEqual(await pendingFiles(repo), []);
  const ledgerStore = new ObligationLedger(repo, clock);
  const [o] = (await ledgerStore.open("p3-plan-rebalance")).filter((x) => x.concern === "interaction");
  const request = (await ledgerStore.interactions()).find((i) => i.request.obligationId === o!.id)!;
  await ledgerStore.answerInteraction({ requestId: request.request.id, outcome: "answered", answer: "yes", by: "alice", channel: "cli" });
  await ledgerStore.resolve(o!.id, { by: "alice", disposition: dispositionForAnswer("consent", "yes"), rationale: "yes" });
  const [done] = await close(repo, "careless", ["p3-plan-rebalance"]);
  assert.equal(done!.final.status, "closed", JSON.stringify(done!.final));
  assert.deepEqual(done!.decisions.map((d) => [d.cause, d.action]), [["check-failure", "repair"]]);
  const audit = new AuditLog(repo);
  const { verdicts } = await audit.forUnit("p3-plan-rebalance");
  assert.deepEqual(verdicts.map((v) => v.verdict), ["fail", "pass"]);
  const refused = verdicts[0]!.reasons.join("\n");
  assert.match(refused, /run_tests/);
  for (const check of [/not ok: every pending trade list moves each position toward its target, not past it, and lands every targeted position inside the band/, /not ok: every sell in a pending list names lots the portfolio holds, in the shares it holds/, /not ok: no trade in a pending list creates a wash sale against the lot history/]) assert.match(refused, check, "refused by the named check");
  const list = JSON.parse(await readFile(path.join(repo, "trades", "pending", "2026-09-30.json"), "utf8")) as { trades: Array<{ ticker: string; shares: number; lots?: Array<{ lot: string }> }> };
  assert.deepEqual(list.trades.map((x) => [x.ticker, x.shares, x.lots?.map((l) => l.lot) ?? []]), [["VTI", 3, ["2025-03-14-VTI"]], ["BND", 4, ["2026-09-02-BND"]], ["VXUS", 29, []]], "the base carries the repaired list, never the refused one");
  await assertProtectedUntouched(repo);
});
