import assert from "node:assert/strict";
import { cp, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { instanceStoreFor } from "@metacoding.io/regulator-protocol";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { AuditLog, ExecutionStore, MemoryStore, ObligationLedger, checkDefinition, checkDispositionAuthority, dispositionForAnswer, isReadOnlyProfile, readSignals } from "@metacoding.io/regulator-core";
import { driveUnit } from "./controller.js";
import { loadContract } from "./contract-file.js";
import { financeDispatcher, type FinanceBehaviour } from "./finance-scripted.js";
import { gitExec } from "./git-support.js";
import { initInstance } from "./instance.js";
import { loadInteractionPolicy } from "./interaction-policy.js";
import { loadPolicy } from "./policy.js";
import { PROFILES } from "./profiles.js";
import { loadRecoveryPolicy } from "./recovery-policy.js";
import { loadRoutingPolicy } from "./routing-policy.js";
import { LAB_ROOT, loadWorkloadFor } from "./workload.js";

const FIXTURE = path.join(LAB_ROOT, "fixture-finance");
const CONTRACTS = path.join(LAB_ROOT, "contracts", "finance");
const FINANCE_POLICY = path.join(LAB_ROOT, "policies", "finance.json");
/** A clock that moves: an answer recorded after an attempt ended must be later than it, as it would be for a person. */
let tick = Date.parse("2026-09-23T09:00:00.000Z");
const clock = () => (tick += 1000);

/** The household's ledger as a repository of its own, initialized as an instance with the layout the worked example declares. */
async function ledgerInstance(t: TestContext): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-ledger-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await cp(FIXTURE, dir, { recursive: true });
  for (const args of [["init", "--quiet", "-b", "main"], ["add", "-A"], ["-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "the ledger as of the July close"]]) {
    const r = await gitExec("git", args, { cwd: dir });
    if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  }
  await initInstance(gitExec, { repo: dir, writablePaths: ["ledger/", "reports/", "payments/pending/"], protectedPaths: ["statements/", "payments/executed/"], by: "alice", now: clock });
  return dir;
}

/** The consent gate's refusals on the record (#60): the operational-signals the interception writes before a guarded write runs. */
async function refusals(repo: string) {
  return (await readSignals(repo)).filter((s) => s.kind === "operational-signal" && s.subject.startsWith("consent refused:")) as Array<{ unit?: string; subject: string; observation: string; evidence: Array<{ class: string; ref: string; observation?: string }> }>;
}

async function close(repo: string, behaviour: FinanceBehaviour, unitIds: string[]) {
  const workload = await loadWorkloadFor("personal-finance");
  const interaction = await loadInteractionPolicy();
  const base = { repo, workload, policy: await loadPolicy(FINANCE_POLICY), policyPath: FINANCE_POLICY, recovery: await loadRecoveryPolicy(), routing: await loadRoutingPolicy(), interaction, owner: "alice", now: clock };
  const dispatcher = financeDispatcher(gitExec, { behaviour, repo, interaction, now: clock });
  const outcomes = [];
  for (const unitId of unitIds) outcomes.push({ unitId, ...(await driveUnit(gitExec, { ...base, contract: await loadContract(path.join(CONTRACTS, `${unitId}.json`)), dispatcher })) });
  return outcomes;
}

test("the definition declares the second workload: personal-finance runs under the bookkeeper and auditor profiles, the finance policy budgets its unit types, and the check passes with both workloads", async () => {
  const checked = await checkDefinition(LAB_ROOT);
  assert.deepEqual(checked.problems, []);
  assert.deepEqual(checked.workloads.map((w) => w.name).sort(), ["personal-finance", "portfolio", "software-development"]);
  const finance = checked.workloads.find((w) => w.name === "personal-finance")!;
  assert.deepEqual(finance.unitTypes.map((u) => [u.name, u.profile]), [["ingest", "bookkeeper"], ["categorize", "bookkeeper"], ["reconcile", "auditor"], ["report", "bookkeeper"], ["prepare-payment", "bookkeeper"], ["close", "auditor"]]);
  assert.equal(isReadOnlyProfile(PROFILES.auditor!), true, "the auditor grants nothing with a write, execution or side effect");
  assert.equal(PROFILES.bookkeeper!.tools.includes("bash"), false, "no shell: the write grant is complete at the tool boundary");
  assert.deepEqual(PROFILES.bookkeeper!.writablePaths, ["ledger/", "reports/", "payments/pending/"]);
  assert.deepEqual(PROFILES.bookkeeper!.consent, [{ tool: "write", paths: ["payments/pending/"] }, { tool: "edit", paths: ["payments/pending/"] }], "the payment is a write under a guarded prefix (#60): the grant names the tool and the path, not a pay tool");
  assert.equal(PROFILES.auditor!.consent, undefined, "the auditor grants none");
  assert.deepEqual(checked.warnings.filter((w) => w.file.startsWith("profiles/")), [], "no shell beside the guarded write: nothing bypasses the grant");
  assert.ok(checked.policies.some((p) => p.name === "finance" && Object.keys(p.budgets.byUnitType ?? {}).includes("prepare-payment")));
  await assert.rejects(loadWorkloadFor("payroll"), /declares no workload "payroll"/);
});

test("the August close, done as the contracts ask: four units close on the ledger's own checks run by the host, the merged tree is verified before each merge lands, the unknown merchant is carried as an open item, and the payment waits on a person's consent until one answers", async (t) => {
  const repo = await ledgerInstance(t);
  const outcomes = await close(repo, "bookkeeper", ["f1-ingest", "f2-categorize", "f3-reconcile", "f4-report"]);
  for (const o of outcomes) {
    assert.equal(o.final.status, "closed", `${o.unitId}: ${JSON.stringify(o.final)}`);
    assert.deepEqual(o.decisions, [], `${o.unitId} needed no recovery`);
    if (o.final.status === "closed" && o.unitId !== "f3-reconcile") assert.equal(o.final.preMerge?.verdict, "pass", `${o.unitId}: the merged tree passes the ledger's checks before it lands`);
  }
  const ledger = await readFile(path.join(repo, "ledger", "2026-08.csv"), "utf8");
  assert.equal(ledger.split("\n").filter(Boolean).length, 13, "header plus the statement's twelve rows");
  assert.match(ledger, /UNKNOWN MERCHANT 8831,-120\.00,uncategorized,/);
  assert.match(await readFile(path.join(repo, "reports", "2026-08.md"), "utf8"), /Open items:\n- 2026-08-28 UNKNOWN MERCHANT 8831 -120\.00 \(uncategorized\)/);
  assert.equal(await readFile(path.join(repo, "statements", "2026-08-checking.csv"), "utf8"), await readFile(path.join(FIXTURE, "statements", "2026-08-checking.csv"), "utf8"), "the bank's record is byte for byte what it was");

  const audit = new AuditLog(repo);
  const f1 = await audit.forUnit("f1-ingest");
  assert.deepEqual(f1.evidence.filter((r) => r.attempt === 1 && !r.check.startsWith("pre-merge:")).map((r) => [r.check, r.verdict]), [["run_checks:syntax:lib/ledger.js", "pass"], ["run_tests", "pass"], ["inherited-tests", "pass"], ["identity-untouched", "pass"], ["glossary-lint", "pass"]], "the workload's checks, with the ledger's suite discovered from package.json");
  assert.deepEqual(f1.evidence.filter((r) => r.check.startsWith("pre-merge:")).map((r) => [r.check, r.verdict]), [["pre-merge:run_checks:syntax:lib/ledger.js", "pass"], ["pre-merge:run_tests", "pass"]]);
  assert.deepEqual((await audit.forUnit("f3-reconcile")).evidence.map((r) => r.check), ["run_tests", "inherited-tests", "identity-untouched", "pre-merge:run_tests"], "a read-only unit is still verified by the host, and the merged tree before its (empty) reintegration too");
  const memory = await new MemoryStore(repo, clock).current("categorize");
  assert.deepEqual(memory.map((m) => [m.subject, m.scope]), [["GREENGROCER 114", ["categorize", "reconcile"]]]);
  assert.deepEqual(await new MemoryStore(repo, clock).current("ingest"), [], "scoped memory is rendered to the unit types it names");

  // The payment: consent asked, nobody there, the unit pauses; what is owed reaches the outbox; a person answers; the next attempt carries it.
  const [paused] = await close(repo, "bookkeeper", ["f5-prepare-payment"]);
  assert.equal(paused!.final.status, "blocked");
  assert.equal(paused!.final.status === "blocked" ? paused!.final.reason : "", "paused");
  assert.deepEqual(paused!.decisions, [], "a paused unit is not routed: the recovery policy has nothing to say until a person answers");
  assert.equal(existsSync(path.join(repo, "payments", "pending", "2026-09-rent.json")), false, "nothing was written without a yes");
  assert.deepEqual(await refusals(repo), [], "the bookkeeper asked before it wrote: the gate had nothing to refuse");
  const ledgerStore = new ObligationLedger(repo, clock);
  const owed = (await ledgerStore.open("f5-prepare-payment")).filter((o) => o.concern === "interaction");
  assert.equal(owed.length, 1);
  const o = owed[0]!;
  assert.deepEqual([o.consumer, o.severity, o.blocks, o.subject], ["human", "blocking", true, "consent: September rent"]);
  assert.match(await readFile(path.join(repo, ".regulator", "outbox"), "utf8"), new RegExp(`deliver:${o.id}`), "delivered to the outbox for a person");
  // Every path the run left under .regulator/ is a store the closed list names (#153).
  for (const entry of await readdir(path.join(repo, ".regulator"))) assert.ok(instanceStoreFor(`.regulator/${entry}`) ?? instanceStoreFor(`.regulator/${entry}/`), `.regulator/${entry} is a store INSTANCE_STORES names`);
  const request = (await ledgerStore.interactions()).find((i) => i.request.obligationId === o.id)!;
  assert.deepEqual([request.request.kind, request.answers[0]?.outcome], ["consent", "unavailable"]);
  assert.deepEqual(request.request.call, { tool: "write", arguments: { path: "payments/pending/2026-09-rent.json" } }, "the question records the call a yes authorizes: what the consent gate matches (#60)");
  const interaction = await loadInteractionPolicy();
  assert.equal(checkDispositionAuthority(interaction, "bob", { severity: o.severity }), undefined, "bob may disposition up to blocking");
  await ledgerStore.answerInteraction({ requestId: request.request.id, outcome: "answered", answer: "yes", by: "alice", channel: "cli" });
  await ledgerStore.resolve(o.id, { by: "alice", disposition: dispositionForAnswer("consent", "yes"), rationale: "yes" });
  const [done] = await close(repo, "bookkeeper", ["f5-prepare-payment"]);
  assert.equal(done!.final.status, "closed", JSON.stringify(done!.final));
  assert.match(await readFile(path.join(repo, "payments", "pending", "2026-09-rent.json"), "utf8"), /"amount": "1450\.00"/);
  assert.equal((await ledgerStore.open()).filter((x) => x.blocks).length, 0, "nothing is owed that holds a unit");
  assert.deepEqual(await refusals(repo), [], "the write ran on the recorded yes");
});

test("the careless close: editing the bank's statement is refused by the protected prefix and by the ledger's checks, a category outside the taxonomy is refused by the ledger's checks, each unit closes on the repair attempt the recovery policy grants; and the payment written without asking anyone is refused at the write by the consent gate, not by a check — recorded as an operational-signal, the tree unchanged — and closes after a person's yes", async (t) => {
  const repo = await ledgerInstance(t);
  const outcomes = await close(repo, "careless", ["f1-ingest", "f2-categorize"]);
  for (const o of outcomes) {
    assert.equal(o.final.status, "closed", `${o.unitId}: ${JSON.stringify(o.final)}`);
    assert.deepEqual(o.decisions.map((d) => [d.cause, d.action]), [["check-failure", "repair"]], o.unitId);
  }
  const audit = new AuditLog(repo);
  const first = (await audit.forUnit("f1-ingest")).verdicts[0]!;
  assert.equal(first.verdict, "fail");
  assert.match(first.reasons.join("\n"), /identity-untouched/);
  assert.match(first.reasons.join("\n"), /statements\/2026-08-checking\.csv/);
  assert.match(first.reasons.join("\n"), /run_tests/);
  const second = (await audit.forUnit("f2-categorize")).verdicts[0]!;
  assert.equal(second.verdict, "fail");
  assert.match(second.reasons.join("\n"), /run_tests/);
  assert.equal(await readFile(path.join(repo, "statements", "2026-08-checking.csv"), "utf8"), await readFile(path.join(FIXTURE, "statements", "2026-08-checking.csv"), "utf8"), "the base never received the edited statement");
  assert.match(await readFile(path.join(repo, "ledger", "2026-08.csv"), "utf8"), /UNKNOWN MERCHANT 8831,-120\.00,uncategorized,/);

  // The payment (#60): the careless bookkeeper goes straight to the write. The consent gate refuses it before it runs — there is
  // no yes for that call on the record — and only then does the unit ask. Nothing under payments/pending/ changed; no check was needed.
  const [refused] = await close(repo, "careless", ["f5-prepare-payment"]);
  assert.equal(refused!.final.status === "blocked" ? refused!.final.reason : "", "paused");
  assert.deepEqual(refused!.decisions, [], "refused at the write, not at closeout: the recovery policy saw no check failure");
  assert.equal(existsSync(path.join(repo, "payments", "pending", "2026-09-rent.json")), false, "the tree is unchanged before the yes");
  assert.deepEqual(await readdir(path.join(repo, "payments", "pending")), await readdir(path.join(FIXTURE, "payments", "pending")));
  let seen = await refusals(repo);
  assert.equal(seen.length, 1, "one refusal, by the gate");
  assert.deepEqual([seen[0]!.unit, seen[0]!.subject, seen[0]!.evidence], ["f5-prepare-payment", "consent refused: write payments/pending/2026-09-rent.json", [{ class: "file", ref: "payments/pending/2026-09-rent.json", observation: "absent" }]]);
  assert.match(seen[0]!.observation, /^write payments\/pending\/2026-09-rent\.json falls under profile "bookkeeper"'s consent grant \(under payments\/pending\/\) and was refused before it ran: no consent for this call is on the record for unit f5-prepare-payment\. The unit was told to ask with ask_human kind=consent\.$/);
  const ledgerStore = new ObligationLedger(repo, clock);
  const [o] = (await ledgerStore.open("f5-prepare-payment")).filter((x) => x.concern === "interaction");
  assert.ok(o, "the refusal told the unit to ask, and it asked");
  const request = (await ledgerStore.interactions()).find((i) => i.request.obligationId === o!.id)!;
  assert.deepEqual([request.request.attempt, request.request.call], [1, { tool: "write", arguments: { path: "payments/pending/2026-09-rent.json" } }]);
  const unit = await new ExecutionStore(repo, clock).getUnit("f5-prepare-payment");
  assert.equal(unit?.attempts, 1, "the refused write cost no attempt of its own: the attempt ended paused on the question");
  await ledgerStore.answerInteraction({ requestId: request.request.id, outcome: "answered", answer: "yes", by: "alice", channel: "cli" });
  await ledgerStore.resolve(o!.id, { by: "alice", disposition: dispositionForAnswer("consent", "yes"), rationale: "yes" });
  const [done] = await close(repo, "careless", ["f5-prepare-payment"]);
  assert.equal(done!.final.status, "closed", JSON.stringify(done!.final));
  assert.match(await readFile(path.join(repo, "payments", "pending", "2026-09-rent.json"), "utf8"), /"amount": "1450\.00"/);
  seen = await refusals(repo);
  assert.equal(seen.length, 1, "the write ran on the recorded yes; nothing more was refused");
});
