import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { AuditLog, MemoryStore, ObligationLedger, checkDefinition, checkDispositionAuthority, dispositionForAnswer, isReadOnlyProfile } from "@metacoding/vsm-pi-core";
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
  assert.deepEqual(checked.workloads.map((w) => w.name).sort(), ["personal-finance", "software-development"]);
  const finance = checked.workloads.find((w) => w.name === "personal-finance")!;
  assert.deepEqual(finance.unitTypes.map((u) => [u.name, u.profile]), [["ingest", "bookkeeper"], ["categorize", "bookkeeper"], ["reconcile", "auditor"], ["report", "bookkeeper"], ["prepare-payment", "bookkeeper"], ["close", "auditor"]]);
  assert.equal(isReadOnlyProfile(PROFILES.auditor!), true, "the auditor grants nothing with a write, execution or side effect");
  assert.equal(PROFILES.bookkeeper!.tools.includes("bash"), false, "no shell: the write grant is complete at the tool boundary");
  assert.deepEqual(PROFILES.bookkeeper!.writablePaths, ["ledger/", "reports/", "payments/pending/"]);
  assert.ok(checked.policies.some((p) => p.name === "finance" && Object.keys(p.budgets.byUnitType ?? {}).includes("prepare-payment")));
  await assert.rejects(loadWorkloadFor("payroll"), /declares no workload "payroll"/);
});

test("the August close, done as the contracts ask: four units close on the ledger's own checks run by the host, the base is verified after each merge, the unknown merchant is carried as an open item, and the payment waits on a person's consent until one answers", async (t) => {
  const repo = await ledgerInstance(t);
  const outcomes = await close(repo, "bookkeeper", ["f1-ingest", "f2-categorize", "f3-reconcile", "f4-report"]);
  for (const o of outcomes) {
    assert.equal(o.final.status, "closed", `${o.unitId}: ${JSON.stringify(o.final)}`);
    assert.deepEqual(o.decisions, [], `${o.unitId} needed no recovery`);
    if (o.final.status === "closed" && o.unitId !== "f3-reconcile") assert.equal(o.final.postMerge?.verdict, "pass", `${o.unitId}: the merged base passes the ledger's checks`);
  }
  const ledger = await readFile(path.join(repo, "ledger", "2026-08.csv"), "utf8");
  assert.equal(ledger.split("\n").filter(Boolean).length, 13, "header plus the statement's twelve rows");
  assert.match(ledger, /UNKNOWN MERCHANT 8831,-120\.00,uncategorized,/);
  assert.match(await readFile(path.join(repo, "reports", "2026-08.md"), "utf8"), /Open items:\n- 2026-08-28 UNKNOWN MERCHANT 8831 -120\.00 \(uncategorized\)/);
  assert.equal(await readFile(path.join(repo, "statements", "2026-08-checking.csv"), "utf8"), await readFile(path.join(FIXTURE, "statements", "2026-08-checking.csv"), "utf8"), "the bank's record is byte for byte what it was");

  const audit = new AuditLog(repo);
  const f1 = await audit.forUnit("f1-ingest");
  assert.deepEqual(f1.evidence.filter((r) => r.attempt === 1 && !r.check.startsWith("post-merge:")).map((r) => [r.check, r.verdict]), [["run_checks:syntax:lib/ledger.js", "pass"], ["run_tests", "pass"], ["inherited-tests", "pass"], ["identity-untouched", "pass"], ["glossary-lint", "pass"]], "the workload's checks, with the ledger's suite discovered from package.json");
  assert.deepEqual(f1.evidence.filter((r) => r.check.startsWith("post-merge:")).map((r) => [r.check, r.verdict]), [["post-merge:run_checks:syntax:lib/ledger.js", "pass"], ["post-merge:run_tests", "pass"]]);
  assert.deepEqual((await audit.forUnit("f3-reconcile")).evidence.map((r) => r.check), ["run_tests", "inherited-tests", "identity-untouched", "post-merge:run_tests"], "a read-only unit is still verified by the host, and the base after its (empty) reintegration too");
  const memory = await new MemoryStore(repo, clock).current("categorize");
  assert.deepEqual(memory.map((m) => [m.subject, m.scope]), [["GREENGROCER 114", ["categorize", "reconcile"]]]);
  assert.deepEqual(await new MemoryStore(repo, clock).current("ingest"), [], "scoped memory is rendered to the unit types it names");

  // The payment: consent asked, nobody there, the unit pauses; what is owed reaches the outbox; a person answers; the next attempt carries it.
  const [paused] = await close(repo, "bookkeeper", ["f5-prepare-payment"]);
  assert.equal(paused!.final.status, "blocked");
  assert.equal(paused!.final.status === "blocked" ? paused!.final.reason : "", "paused");
  assert.deepEqual(paused!.decisions, [], "a paused unit is not routed: the recovery policy has nothing to say until a person answers");
  assert.equal(existsSync(path.join(repo, "payments", "pending", "2026-09-rent.json")), false, "nothing was written without a yes");
  const ledgerStore = new ObligationLedger(repo, clock);
  const owed = (await ledgerStore.open("f5-prepare-payment")).filter((o) => o.concern === "interaction");
  assert.equal(owed.length, 1);
  const o = owed[0]!;
  assert.deepEqual([o.consumer, o.severity, o.blocks, o.subject], ["human", "blocking", true, "consent: September rent"]);
  assert.match(await readFile(path.join(repo, ".regulator", "outbox"), "utf8"), new RegExp(`deliver:${o.id}`), "delivered to the outbox for a person");
  const request = (await ledgerStore.interactions()).find((i) => i.request.obligationId === o.id)!;
  assert.deepEqual([request.request.kind, request.answers[0]?.outcome], ["consent", "unavailable"]);
  const interaction = await loadInteractionPolicy();
  assert.equal(checkDispositionAuthority(interaction, "bob", { severity: o.severity }), undefined, "bob may disposition up to blocking");
  await ledgerStore.answerInteraction({ requestId: request.request.id, outcome: "answered", answer: "yes", by: "alice", channel: "cli" });
  await ledgerStore.resolve(o.id, { by: "alice", disposition: dispositionForAnswer("consent", "yes"), rationale: "yes" });
  const [done] = await close(repo, "bookkeeper", ["f5-prepare-payment"]);
  assert.equal(done!.final.status, "closed", JSON.stringify(done!.final));
  assert.match(await readFile(path.join(repo, "payments", "pending", "2026-09-rent.json"), "utf8"), /"amount": "1450\.00"/);
  assert.equal((await ledgerStore.open()).filter((x) => x.blocks).length, 0, "nothing is owed that holds a unit");
});

test("the careless close: editing the bank's statement is refused by the protected prefix and by the ledger's checks, a category outside the taxonomy is refused by the ledger's checks, and each unit closes on the repair attempt the recovery policy grants", async (t) => {
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
});
