/**
 * The three portfolio sensors (#123) against a copy of the fixture, as
 * `regulator fixture <dest> --portfolio` makes one. The committed data is
 * never changed: each test adds an export to its copy and runs the sensors
 * the way `regulator watch` does.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { ObligationLedger, checkDefinition, checkDispositionAuthority, progressionVeto, readSignals, routeMessages } from "@metacoding.io/regulator-core";
import { runUnit } from "./controller.js";
import { loadContract } from "./contract-file.js";
import { gitExec } from "./git-support.js";
import { initInstance } from "./instance.js";
import { INTELLIGENCE_POLICY_PATH, loadIntelligencePolicy } from "./intelligence-policy.js";
import { loadInteractionPolicy } from "./interaction-policy.js";
import { loadPolicy } from "./policy.js";
import { loadRecoveryPolicy } from "./recovery-policy.js";
import { loadRoutingPolicy } from "./routing-policy.js";
import { runSensors } from "./sensors.js";
import { initFixture } from "./unit.js";
import { LAB_ROOT, loadWorkloadFor } from "./workload.js";

const FIXTURE = path.join(LAB_ROOT, "fixture-portfolio");
const CONTRACTS = path.join(LAB_ROOT, "contracts", "portfolio");
const PORTFOLIO_POLICY = path.join(LAB_ROOT, "policies", "portfolio.json");
const SENSORS = { drift: "workload/portfolio/sensors/drift-band.mjs", harvest: "workload/portfolio/sensors/harvest-threshold.mjs" };
let tick = Date.parse("2026-10-16T09:00:00.000Z");
const clock = () => (tick += 1000);

/** The fixture as `regulator fixture <dest> --portfolio` copies it, then initialized as an instance with the worked example's layout. */
async function portfolioCopy(t: TestContext): Promise<string> {
  const parent = await mkdtemp(path.join(tmpdir(), "regulator-portfolio-sensors-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const dir = await initFixture(gitExec, FIXTURE, path.join(parent, "portfolio"));
  await initInstance(gitExec, { repo: dir, writablePaths: ["lots/", "targets/", "trades/proposed/", "reports/"], protectedPaths: ["positions/", "prices/", "trades/executed/"], by: "alice", now: clock });
  return dir;
}

/** A custodian's export added to the copy: the holdings, the summary and that day's prices. The September rebalance executed is the default book. */
async function addExport(repo: string, date: string, prices: Record<string, string>, holdings: Record<string, number> = { VTI: 51, VXUS: 211, BND: 190, VNQ: 2 }, cash = "11.60"): Promise<string[]> {
  const files = [`positions/${date}.csv`, `positions/${date}.json`, `prices/${date}.csv`];
  await writeFile(path.join(repo, files[0]!), `ticker,shares\n${Object.entries(holdings).map(([t, n]) => `${t},${n}`).join("\n")}\n`);
  await writeFile(path.join(repo, files[1]!), `{ "account": "brokerage", "date": "${date}", "cash": "${cash}", "externalFlows": "0.00" }\n`);
  await writeFile(path.join(repo, files[2]!), `ticker,price\n${Object.entries(prices).map(([t, p]) => `${t},${p}`).join("\n")}\n`);
  // The person commits the custodian's export on the base, as the fixture's README has them do; a sensor reads the tree either way.
  for (const args of [["add", "-A", "--", ...files], ["-c", "commit.gpgsign=false", "commit", "--quiet", "-m", `the custodian's export of ${date}`]]) {
    const r = await gitExec("git", args, { cwd: repo });
    if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  }
  return files;
}

const SEPTEMBER_PRICES = { VTI: "296.50", ITOT: "127.60", VXUS: "58.90", IXUS: "65.70", BND: "73.90", AGG: "100.30", VNQ: "83.90" };

/** One tick an hour later, as the shipped schedule (`everyMs` 3600000) has the watcher run the programs: the sensors, then the router. */
async function sensorsTick(repo: string) {
  tick += 3_600_000;
  const routing = await loadRoutingPolicy();
  const run = await runSensors(gitExec, { repo, definitionRoot: LAB_ROOT, policy: await loadIntelligencePolicy(), routing, now: clock });
  const routed = await routeMessages(new ObligationLedger(repo, clock), { policy: routing, now: clock });
  return { run, routed };
}

/** One dispatch through the loop, as `regulator unit dispatch` runs it: refused by the veto, or past it. */
async function dispatch(repo: string, unitId: string) {
  const workload = await loadWorkloadFor("portfolio");
  return runUnit(gitExec, {
    repo, workload, contract: await loadContract(path.join(CONTRACTS, `${unitId}.json`)), policy: await loadPolicy(PORTFOLIO_POLICY), policyPath: PORTFOLIO_POLICY,
    routing: await loadRoutingPolicy(), interaction: await loadInteractionPolicy(), owner: "alice", now: clock,
    dispatcher: async () => { throw new Error("a program unit never reaches the host's dispatcher"); },
  });
}

test("the definition declares the three portfolio sensors (#123): two scheduled programs under workload/portfolio/sensors/ with no outputs and one glob, each under its own provenance, affecting a unit type the portfolio workload declares, and the check passes", async () => {
  const checked = await checkDefinition(LAB_ROOT);
  assert.deepEqual(checked.problems, []);
  assert.equal(checked.intelligence.length, 1);
  const policy = await loadIntelligencePolicy(INTELLIGENCE_POLICY_PATH);
  assert.deepEqual(policy.sensors.map((s) => [s.name, s.provenance, s.affects, s.severity, s.glob ?? s.program?.argv]), [
    ["drift-band", "sensor:drift-band", ["plan-rebalance"], "blocking", ["node", SENSORS.drift]],
    ["harvest-threshold", "sensor:harvest-threshold", ["harvest-losses"], "blocking", ["node", SENSORS.harvest, "--minimum", "150"]],
    ["new-export", "sensor:new-export", ["ingest-positions"], "blocking", "{positions,prices}/*"],
  ]);
  for (const s of policy.sensors) if (s.program) assert.deepEqual(s.program.outputs, [], `${s.name} writes nothing`);
  const recovery = await loadRecoveryPolicy();
  assert.ok(recovery.rules.length, "the sensors never reach the recovery policy: nothing here is a unit");
});

test("drift-band: the September rebalance executed, a quiet export inside the band raises nothing; an export where a rally moves VTI 2.16% from its target, past the 2% band, fires once, and a plan-rebalance dispatch is held by the obligation until a person dispositions it; the sensor still firing on the next tick raises nothing more", async (t) => {
  const repo = await portfolioCopy(t);
  // 7 October: the holdings the September list implies, at the September prices — every weight inside the band.
  await addExport(repo, "2026-10-07", SEPTEMBER_PRICES);
  let { run, routed } = await sensorsTick(repo);
  assert.deepEqual(run.ran, ["drift-band", "harvest-threshold", "new-export"], "every sensor runs on the first tick; the glob seeds its cursor");
  assert.deepEqual([run.fired, run.failed, routed.opened], [[], [], []], "inside the band, no loss worth 150, and the files that exist are the baseline");
  // 15 October: VTI rallies to 325; VTI lands at 38.16% against a 36% target, 2.16% over; BND at 76 is 1.75% under, inside.
  const files = await addExport(repo, "2026-10-15", { ...SEPTEMBER_PRICES, VTI: "325.00", VXUS: "58.00", BND: "76.00", VNQ: "84.00" });
  ({ run, routed } = await sensorsTick(repo));
  assert.deepEqual(run.failed, []);
  assert.deepEqual(run.fired.map((s) => s.provenance), ["sensor:drift-band", "sensor:new-export"], "the drift sensor and the glob; the harvest sensor is quiet (BND's loss is worth 57.00 at the long-term rate)");
  const [drift, fresh] = run.fired;
  assert.equal(drift!.claim, "VTI is 2.16% over its target at the 2026-10-15 export, past the 2.00% band of targets/2026-08-31.json");
  assert.match(drift!.observation, /^targets\/2026-08-31\.json against positions\/2026-10-15\.csv at prices\/2026-10-15\.csv, band 2\.00%: VTI 38\.16% vs 36\.00% \(2\.16% over\), VXUS 28\.18% vs 29\.00% \(0\.82% under\), BND 33\.25% vs 35\.00% \(1\.75% under\)$/);
  assert.deepEqual([drift!.source, drift!.severity, drift!.affectedUnits, drift!.unit], ["S4", "blocking", ["type:plan-rebalance"], undefined]);
  assert.deepEqual(drift!.evidence.map((e) => e.ref), [SENSORS.drift, "positions/2026-10-15.csv", "prices/2026-10-15.csv", "targets/2026-08-31.json", "benchmark.json"], "the program's file first, then what it read");
  assert.match(drift!.evidence[0]!.observation ?? "", /^the sensor's program, sha256 [0-9a-f]{64}$/);
  assert.equal(drift!.expiresAt, new Date(Date.parse(drift!.observedAt!) + 2_592_000_000).toISOString(), "current for the declared thirty days");
  assert.equal(fresh!.claim, `3 new file(s) matched {positions,prices}/*: ${files.join(", ")}`);
  assert.deepEqual(fresh!.affectedUnits, ["type:ingest-positions"]);
  assert.deepEqual(routed.opened.map((o) => [o.unitType, o.unit, o.blocks, o.consumer, o.severity]), [["plan-rebalance", undefined, true, "S3", "blocking"], ["ingest-positions", undefined, true, "S3", "blocking"]], "the same router and the same obligation a research unit's signal gets, holding the type");

  // The hold: plan-rebalance is dispatched after the sensor fired, and the veto matches the type.
  const ledger = new ObligationLedger(repo, clock);
  const hold = routed.opened[0]!;
  assert.deepEqual((await progressionVeto(ledger, "p3-plan-rebalance", "plan-rebalance")).map((o) => o.id), [hold.id]);
  let outcome = await dispatch(repo, "p3-plan-rebalance");
  assert.equal(outcome.status, "refused");
  assert.match(outcome.status === "refused" ? outcome.problems.map((p) => p.message).join("\n") : "", new RegExp(`^obligation ${hold.id.slice(0, 8)} \\(S3, blocking, intelligence-signal\\) is open on unit type "plan-rebalance" \\(raised before this unit existed; it holds every unit of the type\\): drift-band: VTI is 2\\.16% over its target.*; it must be dispositioned before dispatch`));
  assert.deepEqual(await progressionVeto(ledger, "p2-propose-target", "propose-target"), [], "another type is not held by the drift");
  assert.deepEqual((await progressionVeto(ledger, "p1-ingest-positions", "ingest-positions")).map((o) => o.unitType), ["ingest-positions"], "the new export holds the ingest until someone says so");

  // Still past the band on the next tick: nothing more is raised while the obligation is open.
  ({ run, routed } = await sensorsTick(repo));
  assert.deepEqual([run.ran, run.fired, run.deduplicated, routed.opened], [["drift-band", "harvest-threshold", "new-export"], [], ["drift-band"], []], "an hour on, the programs ran again; the drift sensor fired on the same claim and raised nothing");
  assert.equal((await readSignals(repo)).filter((s) => s.kind === "intelligence-signal").length, 2, "two signals on the log, not three");

  // A person dispositions it, and the dispatch goes ahead: the next attempt is the program's, no longer the veto's.
  const interaction = await loadInteractionPolicy();
  assert.equal(checkDispositionAuthority(interaction, "alice", { severity: hold.severity }), undefined);
  await ledger.resolve(hold.id, { by: "alice", disposition: "replan", rationale: "plan the rebalance against the October export" });
  assert.deepEqual(await progressionVeto(ledger, "p3-plan-rebalance", "plan-rebalance"), []);
  outcome = await dispatch(repo, "p3-plan-rebalance");
  assert.equal(outcome.status, "closed", `past the veto the program ran and the loop closed the unit on the suite's evidence; the sensor planned nothing, and the veto was all that stood in the way: ${JSON.stringify(outcome)}`);
  // The committed fixture is what it was: this test wrote to its copy.
  for (const f of ["positions/2026-09-30.csv", "prices/2026-09-30.csv", "lots/lots.csv"]) assert.equal(await readFile(path.join(repo, f), "utf8"), await readFile(path.join(FIXTURE, f), "utf8"));
});

test("harvest-threshold: an export where BND falls to 72.50 puts the 2025 BND lot's loss at 1045.00, worth 156.75 at the long-term rate, over the 150.00 minimum the sensor's argv declares; the sensor fires, holds harvest-losses until a person dispositions it, and the drift sensor stays quiet since every weight is inside the band", async (t) => {
  const repo = await portfolioCopy(t);
  await addExport(repo, "2026-10-07", SEPTEMBER_PRICES);
  let { run } = await sensorsTick(repo);
  assert.deepEqual(run.fired, [], "at the September prices BND's loss is worth 116.85 and VXUS's 24.75: under the minimum");
  await addExport(repo, "2026-10-15", { ...SEPTEMBER_PRICES, BND: "72.50" });
  let routed;
  ({ run, routed } = await sensorsTick(repo));
  assert.deepEqual(run.failed, []);
  assert.deepEqual(run.fired.map((s) => s.provenance), ["sensor:harvest-threshold", "sensor:new-export"]);
  const [harvest] = run.fired;
  assert.equal(harvest!.claim, "2025-03-14-BND carries an unrealised loss worth 156.75 at the long-term rate at the 2026-10-15 prices, over the 150.00 minimum");
  assert.equal(harvest!.observation, "lots/lots.csv (current to 2026-08-31) at prices/2026-10-15.csv, minimum 150.00: 2025-03-14-BND loss 1045.00 × 0.15 long-term = 156.75, 2025-03-14-VXUS loss 165.00 × 0.15 long-term = 24.75");
  assert.deepEqual(harvest!.affectedUnits, ["type:harvest-losses"]);
  assert.deepEqual(harvest!.evidence.map((e) => e.ref), [SENSORS.harvest, "lots/lots.csv", "prices/2026-10-15.csv", "tax.json"]);
  const ledger = new ObligationLedger(repo, clock);
  const hold = routed.opened.find((o) => o.unitType === "harvest-losses")!;
  let outcome = await dispatch(repo, "p5-harvest-losses");
  assert.equal(outcome.status, "refused");
  assert.match(outcome.status === "refused" ? outcome.problems.map((p) => p.message).join("\n") : "", /is open on unit type "harvest-losses"/);
  assert.deepEqual(await progressionVeto(ledger, "p3-plan-rebalance", "plan-rebalance"), [], "the drift sensor said nothing: VTI 36.43%, VXUS 29.94%, BND 33.19%");
  await ledger.resolve(hold.id, { by: "alice", disposition: "replan", rationale: "harvest it" });
  outcome = await dispatch(repo, "p5-harvest-losses");
  assert.notEqual(outcome.status, "refused", JSON.stringify(outcome));
});

test("new-export: the glob over positions/ and prices/ fires on the files of an export the cursor has not seen, names them, and holds ingest-positions until a person dispositions it; an export that was there at the first tick is the baseline and never fires", async (t) => {
  const repo = await portfolioCopy(t);
  let { run, routed } = await sensorsTick(repo);
  assert.deepEqual(run.fired.filter((s) => s.provenance === "sensor:new-export"), [], "the four shipped exports are the baseline");
  assert.deepEqual(routed.opened.filter((o) => o.unitType === "ingest-positions"), []);
  const files = await addExport(repo, "2026-10-15", SEPTEMBER_PRICES);
  ({ run, routed } = await sensorsTick(repo));
  const fresh = run.fired.find((s) => s.provenance === "sensor:new-export")!;
  assert.equal(fresh.claim, `3 new file(s) matched {positions,prices}/*: ${files.join(", ")}`);
  assert.deepEqual(fresh.evidence.map((e) => [e.class, e.ref]), files.map((f) => ["file", f]));
  assert.equal(fresh.expiresAt, new Date(Date.parse(fresh.observedAt!) + 604_800_000).toISOString(), "current for the declared week");
  const hold = routed.opened.find((o) => o.unitType === "ingest-positions")!;
  assert.deepEqual([hold.blocks, hold.consumer], [true, "S3"]);
  let outcome = await dispatch(repo, "p1-ingest-positions");
  assert.equal(outcome.status, "refused");
  assert.match(outcome.status === "refused" ? outcome.problems.map((p) => p.message).join("\n") : "", /is open on unit type "ingest-positions" .*: new-export: 3 new file\(s\) matched/);
  ({ run } = await sensorsTick(repo));
  assert.deepEqual(run.fired.filter((s) => s.provenance === "sensor:new-export"), [], "seen");
  await new ObligationLedger(repo, clock).resolve(hold.id, { by: "alice", disposition: "replan", rationale: "ingest October" });
  outcome = await dispatch(repo, "p1-ingest-positions");
  assert.notEqual(outcome.status, "refused", JSON.stringify(outcome));
});
