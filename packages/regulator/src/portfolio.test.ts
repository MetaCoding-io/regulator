import assert from "node:assert/strict";
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { AuditLog, ExecutionStore, MemoryStore, ObligationLedger, checkDefinition, checkDispositionAuthority, consentRequiredFor, dispositionForAnswer, isReadOnlyProfile, readSignals, withDeclaredEffects } from "@metacoding.io/regulator-core";
import { driveUnit } from "./controller.js";
import { loadContract } from "./contract-file.js";
import { gitExec } from "./git-support.js";
import { initInstance } from "./instance.js";
import { loadInteractionPolicy } from "./interaction-policy.js";
import { loadPolicy } from "./policy.js";
import { declaredEffects, loadDeclaredToolsSync } from "./declared-tools.js";
import { portfolioDispatcher, type PortfolioBehaviour } from "./portfolio-scripted.js";
import { PROFILES } from "./profiles.js";
import { loadRecoveryPolicy } from "./recovery-policy.js";
import { loadRoutingPolicy } from "./routing-policy.js";
import { createHash } from "node:crypto";
import { isEvalReport, metricNames, type WorkloadDefinition } from "@metacoding.io/regulator-protocol";
import { EVALS_DIR, REPORTS_DIR, loadSuite, runSuite } from "./evals.js";
import { portfolioDispatchers } from "./portfolio-scripted.js";
import { LAB_ROOT, loadWorkloadFor } from "./workload.js";

const FIXTURE = path.join(LAB_ROOT, "fixture-portfolio");
const CONTRACTS = path.join(LAB_ROOT, "contracts", "portfolio");
const PORTFOLIO_POLICY = path.join(LAB_ROOT, "policies", "portfolio.json");
/** What a unit of the manager profile may write directly: never trades/pending/, which only place_trade reaches (#121). */
const WRITABLE = ["lots/", "targets/", "trades/proposed/", "reports/"];
const PROGRAMS = { plan: "workload/portfolio/plan-rebalance.mjs", harvest: "workload/portfolio/harvest-losses.mjs", place: "workload/portfolio/place-trade.mjs" };
const PLACE_TRADE_CALL = { tool: "place_trade", arguments: { proposed: "trades/proposed/2026-09-30.json" } };
const sha256Of = async (file: string) => createHash("sha256").update(await readFile(file)).digest("hex");
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

async function close(repo: string, behaviour: PortfolioBehaviour, unitIds: string[], overrides: { workload?: WorkloadDefinition; definitionRoot?: string } = {}) {
  const workload = overrides.workload ?? await loadWorkloadFor("portfolio");
  const interaction = await loadInteractionPolicy();
  const base = { repo, workload, policy: await loadPolicy(PORTFOLIO_POLICY), policyPath: PORTFOLIO_POLICY, recovery: await loadRecoveryPolicy(), routing: await loadRoutingPolicy(), interaction, owner: "alice", now: clock, ...(overrides.definitionRoot ? { definitionRoot: overrides.definitionRoot } : {}) };
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
async function proposedFiles(repo: string): Promise<string[]> {
  return (await readdir(path.join(repo, "trades", "proposed"))).filter((f) => f.endsWith(".json")).sort();
}

/** The list the plan-rebalance program computes for September, as the suite reads it and the person is asked about it. */
const SEPTEMBER_TRADES = [
  { ticker: "VTI", side: "sell", shares: 3, lots: [{ lot: "2025-03-14-VTI", shares: 3, gain: "139.50", longTerm: true, tax: "20.93" }] },
  { ticker: "BND", side: "sell", shares: 4, lots: [{ lot: "2026-09-02-BND", shares: 4, gain: "6.40", longTerm: false, tax: "2.24" }] },
  { ticker: "VXUS", side: "buy", shares: 29 },
];

test("the definition declares the third workload: portfolio runs under the manager and auditor profiles, two of its unit types run a program under the manager's effect declaration (#122), it declares place_trade with an irreversible effect from which the consent is derived (#121), the manager has no shell and no path grant on trades/pending/, the portfolio policy budgets the programs in wall-clock, and the check passes with three workloads", async () => {
  const checked = await checkDefinition(LAB_ROOT);
  assert.deepEqual(checked.problems, []);
  assert.deepEqual(checked.workloads.map((w) => w.name).sort(), ["personal-finance", "portfolio", "software-development"]);
  const portfolio = checked.workloads.find((w) => w.name === "portfolio")!;
  assert.deepEqual(portfolio.unitTypes.map((u) => [u.name, u.profile]), [["ingest-positions", "manager"], ["propose-target", "manager"], ["plan-rebalance", "manager"], ["confirm-trades", "manager"], ["harvest-losses", "manager"], ["review", "auditor"], ["close-period", "auditor"]]);
  const writing = ["run_checks", "run_tests", "inherited-tests", "identity-untouched", "glossary-lint"];
  assert.deepEqual(portfolio.unitTypes.map((u) => u.checks), [writing, writing, writing, writing, writing, ["run_tests", "inherited-tests", "identity-untouched"], []], "the checks per unit type the note's S1 table names; a program's output is checked exactly as a session's");
  assert.deepEqual(portfolio.unitTypes.map((u) => u.runner), [
    undefined, undefined,
    { kind: "command", argv: ["node", PROGRAMS.plan], outputs: ["trades/proposed/"] },
    undefined,
    { kind: "command", argv: ["node", PROGRAMS.harvest], outputs: ["trades/proposed/harvest-"] },
    undefined, undefined,
  ], "the two arithmetic types declare their program and its reach; everything else is a session by default");
  assert.equal(isReadOnlyProfile(PROFILES.auditor!), true, "the auditor grants nothing with a write, execution or side effect");
  assert.equal(PROFILES.manager!.tools.includes("bash"), false, "no shell: the write grant is complete at the tool boundary, and a program under this profile has no arbitrary execution beside it");
  assert.deepEqual(PROFILES.manager!.writablePaths, WRITABLE, "trades/pending/ is under no write grant: the one way there is the tool");
  assert.equal(PROFILES.manager!.consent, undefined, "no consent grant on the profile (#121): what needs a yes is derived from the tool's declared effect, not listed by path");
  for (const outside of ["lib/", "test/", "universe.json", "tax.json", "benchmark.json", "trades/pending/", ...PROTECTED]) assert.ok(!PROFILES.manager!.writablePaths.some((p) => outside.startsWith(p)), `${outside} is outside the manager's grant`);
  // The declared tool (#121): one, with the effect every built-in declares on, a program under the definition and trades/pending/ as its whole reach; granted to the manager by name.
  assert.deepEqual(portfolio.tools?.map((t) => [t.name, t.effect, t.program, Object.keys(t.parameters.properties as object), (t.parameters as { required: string[] }).required]), [["place_trade", { filesystem: "write", execution: "none", network: "none", sideEffects: "irreversible" }, { argv: ["node", PROGRAMS.place], outputs: ["trades/pending/"] }, ["proposed"], ["proposed"]]]);
  assert.ok(PROFILES.manager!.tools.includes("place_trade"), "granted by name, as a built-in is");
  assert.ok(!PROFILES.auditor!.tools.includes("place_trade"));
  const declared = declaredEffects(loadDeclaredToolsSync(LAB_ROOT));
  assert.deepEqual(Object.keys(declared), ["place_trade"], "what the host reads off the definition at load");
  assert.deepEqual(consentRequiredFor(PROFILES.manager!, PLACE_TRADE_CALL, declared), { grant: { tool: "place_trade" }, source: "effect", effect: declared.place_trade }, "the consent is derived: a bare grant on every call, from the effect, with no profile naming it");
  assert.equal(consentRequiredFor(PROFILES.manager!, { tool: "write", arguments: { path: "trades/pending/2026-09-30.json" } }, declared), undefined, "a plain write there needs no consent because the grant refuses it outright: the prefix is outside the manager's writable paths");
  assert.equal(isReadOnlyProfile({ ...PROFILES.auditor!, tools: [...PROFILES.auditor!.tools, "place_trade"] }, withDeclaredEffects(declared)), false, "a read-only profile could not be granted it: the declared effect is what the check reads");
  assert.deepEqual(checked.warnings.filter((w) => w.file.startsWith("workload/")), [], "no shipped profile reaches trades/pending/ beside the tool");
  assert.ok(Object.hasOwn(checked.advice.files, "manager"), "the manager's advice is a file in the definition");
  const budgets = checked.policies.find((p) => p.name === "portfolio")!.budgets.byUnitType!;
  assert.equal(budgets["confirm-trades"]!.attempts, 3, "the first attempt is spent asking for consent; a refused call still has a repair");
  assert.deepEqual(budgets["plan-rebalance"], { wallClockMs: 60000, attempts: 2 }, "a program is budgeted in wall-clock alone");
  assert.deepEqual(budgets["harvest-losses"], { wallClockMs: 60000, attempts: 2 });
});

test("the September close, done as the contracts ask: the lots are brought up to date and the review written on host-run evidence bound to the revision, the target is feasible, the trade list is computed by the plan-rebalance program with no session and checked by the suite like a model's work, its confirmation waits on one consent question naming every trade and the place_trade call, places it with the tool once a person says yes, the harvest candidates are a program's too, the review closes, and the custodian's exports and the person's fills are byte for byte what they were", async (t) => {
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
  assert.match(p1.evidence.find((r) => r.check === "run_tests")!.observation, /^9 passed, 0 failed/, "the eight assertions ran, and the turnover arithmetic's test beside them");
  const memory = await new MemoryStore(repo, clock).current("confirm-trades");
  assert.deepEqual(memory.map((m) => [m.subject, m.scope]), [["VNQ, 2 shares", ["ingest-positions", "confirm-trades", "review"]]]);
  assert.deepEqual(await new MemoryStore(repo, clock).current("propose-target"), [], "scoped memory is rendered to the unit types it names");

  // The plan: a program, run by the loop with no session, no host and no stand-in; its list lands under trades/proposed/ once the suite has passed it.
  const [planned] = await close(repo, "manager", ["p3-plan-rebalance"]);
  assert.equal(planned!.final.status, "closed", JSON.stringify(planned!.final));
  assert.deepEqual(planned!.decisions, []);
  assert.deepEqual(await proposedFiles(repo), ["2026-09-30.json"]);
  assert.deepEqual(await pendingFiles(repo), [], "a program writes where no yes is required, and nowhere else");
  const proposed = JSON.parse(await readFile(path.join(repo, "trades", "proposed", "2026-09-30.json"), "utf8")) as { date: string; trades: unknown[]; realisedTax: string; cashAfter: string };
  assert.deepEqual(proposed.trades, SEPTEMBER_TRADES, "the program's list: BND from the 2 September lot, since the 2025 lot's loss would be a wash sale against that fill; every sell with its gain and its tax");
  assert.deepEqual([proposed.realisedTax, proposed.cashAfter], ["23.17", "11.60"]);
  const store = new ExecutionStore(repo, clock);
  const [planAttempt] = await store.listAttempts("p3-plan-rebalance");
  assert.deepEqual(planAttempt?.program, { file: PROGRAMS.plan, sha256: await sha256Of(path.join(LAB_ROOT, PROGRAMS.plan)), exit: 0 }, "the attempt record says what program produced the list");
  assert.equal(planAttempt?.sessionId, undefined, "no session");
  const planBudget = await store.getBudget("p3-plan-rebalance", 1);
  assert.deepEqual([planBudget?.consumed.tokens, planBudget?.consumed.turns, planBudget?.ceiling.wallClockMs], [0, 0, 60000], "budgeted in wall-clock alone");
  const planReport = await store.getReport("p3-plan-rebalance", 1, 1);
  assert.match(planReport?.summary ?? "", /^wrote trades\/proposed\/2026-09-30\.json: sell 3 VTI from lot 2025-03-14-VTI \(gain 139\.50, long-term, tax 20\.93\); sell 4 BND/);
  assert.deepEqual([planReport?.delegatedResults, planReport?.unresolvedOutcomes], [[], []], "a program claims no judgment");
  const p3 = await audit.forUnit("p3-plan-rebalance");
  assert.deepEqual(p3.evidence.filter((r) => !r.check.startsWith("pre-merge:")).map((r) => [r.check, r.verdict]), [["run_checks:syntax:lib/portfolio.js", "pass"], ["run_tests", "pass"], ["inherited-tests", "pass"], ["identity-untouched", "pass"], ["glossary-lint", "pass"], ["file:trades/proposed/2026-09-30.json", "pass"]], "the host checks a program's revision as it checks a model's, and the file the program cites is there");
  assert.deepEqual(p3.verdicts.map((v) => v.verdict), ["pass"]);

  // The confirmation: one consent question for the whole list, nobody there, the unit pauses; what is owed reaches the outbox; a person answers; the next attempt carries it.
  const [paused] = await close(repo, "manager", ["p4-confirm-trades"]);
  assert.equal(paused!.final.status, "blocked");
  assert.equal(paused!.final.status === "blocked" ? paused!.final.reason : "", "paused");
  assert.deepEqual(paused!.decisions, [], "a paused unit is not routed: the recovery policy has nothing to say until a person answers");
  assert.deepEqual(await pendingFiles(repo), [], "nothing exists under trades/pending/ without a yes");
  assert.deepEqual(await refusals(repo), [], "the manager asked before it wrote: the gate had nothing to refuse");
  const ledgerStore = new ObligationLedger(repo, clock);
  const owed = (await ledgerStore.open("p4-confirm-trades")).filter((o) => o.concern === "interaction");
  assert.equal(owed.length, 1, "one question per list, not one per trade");
  const o = owed[0]!;
  assert.deepEqual([o.consumer, o.severity, o.blocks, o.subject], ["human", "blocking", true, "consent: the September trade list"]);
  for (const named of [/^May I place trades\/proposed\/2026-09-30\.json as trades\/pending\/2026-09-30\.json with place_trade: /, /sell 3 VTI from lot 2025-03-14-VTI \(gain 139\.50, long-term, tax 20\.93\)/, /sell 4 BND from lot 2026-09-02-BND \(gain 6\.40, short-term, tax 2\.24\)/, /buy 29 VXUS/, /Realised tax 23\.17 in all/]) assert.match(o.question ?? "", named, "the question names every trade, the lots it sells from and the tax it realises, as the program computed them");
  assert.match(await readFile(path.join(repo, ".regulator", "outbox"), "utf8"), new RegExp(`deliver:${o.id}`), "delivered to the outbox for a person");
  const request = (await ledgerStore.interactions()).find((i) => i.request.obligationId === o.id)!;
  assert.deepEqual([request.request.kind, request.answers[0]?.outcome], ["consent", "unavailable"]);
  assert.deepEqual(request.request.call, PLACE_TRADE_CALL, "the question records the call a yes authorizes — the tool and its argument, not a path (#121): what the consent gate matches");
  assert.match(request.request.action ?? "", /^place_trade with proposed trades\/proposed\/2026-09-30\.json: 3 trades written to trades\/pending\/2026-09-30\.json, byte for byte as proposed$/);
  const interaction = await loadInteractionPolicy();
  assert.equal(checkDispositionAuthority(interaction, "bob", { severity: o.severity }), undefined, "bob may disposition up to blocking");
  await ledgerStore.answerInteraction({ requestId: request.request.id, outcome: "answered", answer: "yes", by: "alice", channel: "cli" });
  await ledgerStore.resolve(o.id, { by: "alice", disposition: dispositionForAnswer("consent", "yes"), rationale: "yes" });
  const [done] = await close(repo, "manager", ["p4-confirm-trades"]);
  assert.equal(done!.final.status, "closed", JSON.stringify(done!.final));
  assert.deepEqual(await pendingFiles(repo), ["2026-09-30.json"]);
  assert.equal(await readFile(path.join(repo, "trades", "pending", "2026-09-30.json"), "utf8"), await readFile(path.join(repo, "trades", "proposed", "2026-09-30.json"), "utf8"), "the pending list is the proposed one, byte for byte: the tool copied it; the session asked and called, it neither planned nor wrote");
  assert.equal((await ledgerStore.open()).filter((x) => x.blocks).length, 0, "nothing is owed that holds a unit");
  const p4 = await audit.forUnit("p4-confirm-trades");
  assert.deepEqual(p4.verdicts.map((v) => v.verdict), ["pass"], "the paused attempt produced no verdict; the consented one passed");
  assert.deepEqual(p4.evidence.filter((r) => r.check.startsWith("file:")).map((r) => [r.check, r.verdict]), [["file:trades/pending/2026-09-30.json", "pass"]], "the report cites the file the tool wrote, and the host finds it at the revision");
  const placed = await store.getReport("p4-confirm-trades", 1, 2);
  assert.match(placed?.evidence.find((e) => e.ref === "trades/pending/2026-09-30.json")?.observation ?? "", new RegExp(`^byte for byte trades/proposed/2026-09-30\\.json: 3 trade\\(s\\); placed by ${PROGRAMS.place} \\(${(await sha256Of(path.join(LAB_ROOT, PROGRAMS.place))).slice(0, 12)}\\), exit 0$`), "the tool's provenance: which program placed it, by file and hash");
  assert.match(placed?.summary ?? "", /^consent given; place_trade wrote trades\/pending\/2026-09-30\.json, byte for byte the list under trades\/proposed\/2026-09-30\.json: sell 3 VTI; sell 4 BND; buy 29 VXUS\./);

  // The harvest candidates: the second program; where the losses are, and nothing about whether to take them.
  const [harvested] = await close(repo, "manager", ["p5-harvest-losses"]);
  assert.equal(harvested!.final.status, "closed", JSON.stringify(harvested!.final));
  assert.deepEqual(await proposedFiles(repo), ["2026-09-30.json", "harvest-2026-09-30.json"]);
  const candidates = JSON.parse(await readFile(path.join(repo, "trades", "proposed", "harvest-2026-09-30.json"), "utf8")) as { date: string; candidates: Array<{ lot: string; unrealised: string; longTerm: boolean }> };
  assert.deepEqual(candidates.candidates.map((c) => [c.lot, c.unrealised, c.longTerm]), [["2025-03-14-BND", "-779.00", true], ["2025-03-14-VXUS", "-165.00", true], ["2026-09-02-VXUS", "-118.40", false]], "every open lot under water at the 30 September prices; no threshold, no benefit-versus-cost (#124)");
  assert.deepEqual((await store.listAttempts("p5-harvest-losses"))[0]?.program, { file: PROGRAMS.harvest, sha256: await sha256Of(path.join(LAB_ROOT, PROGRAMS.harvest)), exit: 0 });
  assert.deepEqual(await pendingFiles(repo), ["2026-09-30.json"], "a candidate is not a trade");

  const [review] = await close(repo, "manager", ["p6-review"]);
  assert.equal(review!.final.status, "closed", JSON.stringify(review!.final));
  assert.deepEqual((await audit.forUnit("p6-review")).evidence.map((r) => r.check), ["run_tests", "inherited-tests", "identity-untouched", "pre-merge:run_tests"], "a read-only unit is still verified by the host, and the merged tree before its (empty) reintegration too");
  await assertProtectedUntouched(repo);
});

test("the careless close (#121): place_trade called without asking anyone is refused by the consent gate before anything exists — derived from the tool's declared effect, with no profile grant naming it: an operational-signal, the tree unchanged — and the unit then asks; after the yes, the next attempt's call runs on the yes already recorded without asking again, the tool copies the program's list byte for byte, and the unit closes on its first verified attempt. The shortcut the careless unit of #120 took, a pending list that was not the one the person was asked about, is impossible by construction: a session does not write the file", async (t) => {
  const repo = await portfolioInstance(t);
  for (const o of await close(repo, "careless", ["p1-ingest-positions", "p2-propose-target", "p3-plan-rebalance"])) assert.equal(o.final.status, "closed", `${o.unitId}: ${JSON.stringify(o.final)}`);
  const [paused] = await close(repo, "careless", ["p4-confirm-trades"]);
  assert.equal(paused!.final.status === "blocked" ? paused!.final.reason : "", "paused");
  assert.deepEqual(paused!.decisions, [], "refused at the call, not at closeout");
  assert.deepEqual(await pendingFiles(repo), [], "the tree is unchanged before the yes");
  assert.deepEqual(await tree(repo, "trades/pending/"), await tree(FIXTURE, "trades/pending/"));
  let seen = await refusals(repo);
  assert.equal(seen.length, 1, "one refusal, by the gate");
  assert.deepEqual([seen[0]!.unit, seen[0]!.subject, seen[0]!.evidence], ["p4-confirm-trades", 'consent refused: place_trade {"proposed":"trades/proposed/2026-09-30.json"}', [{ class: "command", ref: 'place_trade {"proposed":"trades/proposed/2026-09-30.json"}', observation: "absent" }]]);
  assert.match(seen[0]!.observation, /needs consent the gate derives from the workload's declaration of place_trade \(every place_trade call, derived from its declared effect \(sideEffects: irreversible\); no profile grant names it\) and was refused before it ran: no consent for this call is on the record for unit p4-confirm-trades\./);
  const ledgerStore = new ObligationLedger(repo, clock);
  const [o] = (await ledgerStore.open("p4-confirm-trades")).filter((x) => x.concern === "interaction");
  const request = (await ledgerStore.interactions()).find((i) => i.request.obligationId === o!.id)!;
  assert.deepEqual(request.request.call, PLACE_TRADE_CALL);
  await ledgerStore.answerInteraction({ requestId: request.request.id, outcome: "answered", answer: "yes", by: "alice", channel: "cli" });
  await ledgerStore.resolve(o!.id, { by: "alice", disposition: dispositionForAnswer("consent", "yes"), rationale: "yes" });
  const [done] = await close(repo, "careless", ["p4-confirm-trades"]);
  assert.equal(done!.final.status, "closed", JSON.stringify(done!.final));
  assert.deepEqual(done!.decisions, [], "nothing to repair: the tool wrote what the person was asked about, so the suite had nothing to refuse");
  // The yes holds across attempts (open questions §6, from #120): the gate read the consent off the ledger for the same call.
  // One question was asked in two attempts; nothing was refused after the yes.
  assert.equal((await ledgerStore.interactions()).filter((i) => i.request.unit === "p4-confirm-trades").length, 1, "the next attempt did not ask again for the same call");
  seen = await refusals(repo);
  assert.equal(seen.length, 1);
  const audit = new AuditLog(repo);
  const { verdicts, evidence } = await audit.forUnit("p4-confirm-trades");
  assert.deepEqual(verdicts.map((v) => v.verdict), ["pass"]);
  assert.equal(evidence.find((r) => r.check === "run_tests" && r.attempt === 2)?.verdict, "pass");
  // The suite's assertion that a pending list carries the proposed trades still runs at every closeout. What it guards has
  // changed: not a model's shortcut, which no session can take now, but a bug in place-trade.mjs — a tool that wrote
  // something other than the list it was handed would be refused here by name, as the careless unit of #120 was.
  assert.equal(await readFile(path.join(repo, "trades", "pending", "2026-09-30.json"), "utf8"), await readFile(path.join(repo, "trades", "proposed", "2026-09-30.json"), "utf8"), "the base carries the program's list: the tool's copy, which the suite's pending-equals-proposed check judged at closeout");
  await assertProtectedUntouched(repo);
});

test("a deliberately wrong program (#122): a second argv on a test-only copy of the unit type, whose list sells past the target, is refused at closeout by the portfolio's own suite on every attempt the policy grants and then escalated — nothing read the program to decide that, its output never lands, and the attempt records say which program ran", async (t) => {
  const repo = await portfolioInstance(t);
  for (const o of await close(repo, "manager", ["p1-ingest-positions", "p2-propose-target"])) assert.equal(o.final.status, "closed", `${o.unitId}: ${JSON.stringify(o.final)}`);
  // The wrong program lives under a definition root of its own, so nothing shipped carries it; the test-only unit type names it by argv.
  const root = await mkdtemp(path.join(tmpdir(), "regulator-wrong-program-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(path.join(LAB_ROOT, "workload"), path.join(root, "workload"), { recursive: true });
  const wrong = "workload/portfolio/plan-past-target.mjs";
  await writeFile(path.join(root, wrong), [
    'import { mkdirSync, writeFileSync } from "node:fs";',
    'mkdirSync("trades/proposed", { recursive: true });',
    // Eight VTI where three is the overweight: the position crosses its target. Held lot, no wash sale — only the band check refuses it.
    'writeFileSync("trades/proposed/2026-09-30.json", JSON.stringify({ date: "2026-09-30", trades: [{ ticker: "VTI", side: "sell", shares: 8, lots: [{ lot: "2025-03-14-VTI", shares: 8 }] }, { ticker: "VXUS", side: "buy", shares: 29 }] }, null, 2) + "\\n");',
    'console.log(JSON.stringify({ summary: "rebalanced, within band" }));',
    "",
  ].join("\n"));
  const shipped = await loadWorkloadFor("portfolio");
  const workload: WorkloadDefinition = { ...shipped, unitTypes: shipped.unitTypes.map((u) => (u.name === "plan-rebalance" ? { ...u, runner: { kind: "command" as const, argv: ["node", wrong], outputs: ["trades/proposed/"] } } : u)) };
  const [outcome] = await close(repo, "manager", ["p3-plan-rebalance"], { workload, definitionRoot: root });
  assert.equal(outcome!.final.status, "blocked");
  assert.equal(outcome!.final.status === "blocked" ? outcome!.final.reason : "", "check-failure", JSON.stringify(outcome!.final));
  assert.deepEqual(outcome!.decisions.map((d) => [d.cause, d.action]), [["check-failure", "repair"], ["check-failure", "escalate"]], "a deterministic program fails the same way twice; the policy's two attempts are spent and S5 is told");
  const { verdicts, evidence } = await new AuditLog(repo).forUnit("p3-plan-rebalance");
  assert.deepEqual(verdicts.map((v) => v.verdict), ["fail", "fail"]);
  for (const v of verdicts) assert.match(v.reasons.join("\n"), /not ok: every pending or proposed trade list moves each position toward its target, not past it, and lands every targeted position inside the benchmark's band/, "refused by the named check");
  assert.deepEqual(evidence.filter((e) => e.check === "run_tests").map((e) => [e.attempt, e.verdict]), [[1, "fail"], [2, "fail"]], "the suite's run, bound to the revision each attempt of the program produced");
  const attempts = await new ExecutionStore(repo, clock).listAttempts("p3-plan-rebalance");
  assert.deepEqual(attempts.map((a) => [a.outcome, a.program?.file, a.program?.exit]), [["check-failure", wrong, 0], ["check-failure", wrong, 0]], "the program ran and exited 0 both times; its claim satisfied nothing");
  assert.equal(attempts[0]?.program?.sha256, await sha256Of(path.join(root, wrong)));
  assert.deepEqual(await proposedFiles(repo), [], "the wrong list never landed on the base");
  assert.ok((await readSignals(repo)).some((s) => s.kind === "algedonic-signal" && s.unit === "p3-plan-rebalance"), "escalated to S5");
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
