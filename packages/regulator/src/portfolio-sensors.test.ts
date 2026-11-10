/**
 * The three portfolio sensors (#123) against a copy of the fixture, as
 * `regulator fixture <dest> --portfolio` makes one. The committed data is
 * never changed: each test adds an export to its copy and runs the sensors
 * the way `regulator watch` does.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { promisify } from "node:util";
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
    ["harvest-threshold", "sensor:harvest-threshold", ["harvest-losses"], "blocking", ["node", SENSORS.harvest]],
    ["new-export", "sensor:new-export", ["ingest-positions"], "advisory", "{positions,prices}/*"],
  ]);
  for (const s of policy.sensors) if (s.program) assert.deepEqual(s.program.outputs, [], `${s.name} writes nothing`);
  assert.equal(policy.version, 2, "version 2 (#181): the harvest sensor's threshold left the declaration for the household's arithmetic");
  const recovery = await loadRecoveryPolicy();
  assert.ok(recovery.rules.length, "the sensors never reach the recovery policy: nothing here is a unit");
});

test("drift-band: the September rebalance executed, an export inside the band raises no drift; an export where a rally moves VTI 2.16% from its target, past the 2% band, fires once, and a plan-rebalance dispatch is held by the obligation until a person dispositions it; the sensor still firing on the next tick raises nothing more", async (t) => {
  const repo = await portfolioCopy(t);
  // 7 October: the holdings the September list implies, at the September prices — every weight inside the band.
  await addExport(repo, "2026-10-07", SEPTEMBER_PRICES);
  let { run, routed } = await sensorsTick(repo);
  assert.deepEqual(run.ran, ["drift-band", "harvest-threshold", "new-export"], "every sensor runs on the first tick; the glob seeds its cursor");
  assert.deepEqual([run.fired.map((s) => s.provenance), run.failed, routed.opened.map((o) => o.unitType)], [["sensor:harvest-threshold"], [], ["harvest-losses"]], "inside the band, and the files that exist are the baseline; the harvest sensor fires on its own arithmetic (BND's loss at 73.90 nets 70.69), which holds harvest-losses and nothing of the rebalance");
  // 15 October: VTI rallies to 325; VTI lands at 38.16% against a 36% target, 2.16% over; BND at 76 is 1.75% under, inside.
  const files = await addExport(repo, "2026-10-15", { ...SEPTEMBER_PRICES, VTI: "325.00", VXUS: "58.00", BND: "76.00", VNQ: "84.00" });
  ({ run, routed } = await sensorsTick(repo));
  assert.deepEqual(run.failed, []);
  assert.deepEqual(run.fired.map((s) => s.provenance), ["sensor:drift-band", "sensor:harvest-threshold", "sensor:new-export"], "the drift sensor and the glob; the harvest sensor fires again on a claim that names the new prices (BND nets 9.53, VXUS 16.40)");
  const [drift, , fresh] = run.fired;
  assert.equal(drift!.claim, "VTI is 2.16% over its target at the 2026-10-15 export, past the 2.00% band of targets/2026-08-31.json");
  assert.match(drift!.observation, /^targets\/2026-08-31\.json against positions\/2026-10-15\.csv at prices\/2026-10-15\.csv, band 2\.00%: VTI 38\.16% vs 36\.00% \(2\.16% over\), VXUS 28\.18% vs 29\.00% \(0\.82% under\), BND 33\.25% vs 35\.00% \(1\.75% under\)$/);
  assert.deepEqual([drift!.source, drift!.severity, drift!.affectedUnits, drift!.unit], ["S4", "blocking", ["type:plan-rebalance"], undefined]);
  assert.deepEqual(drift!.evidence.map((e) => e.ref), [SENSORS.drift, "positions/2026-10-15.csv", "prices/2026-10-15.csv", "targets/2026-08-31.json", "benchmark.json"], "the program's file first, then what it read");
  assert.match(drift!.evidence[0]!.observation ?? "", /^the sensor's program, sha256 [0-9a-f]{64}$/);
  assert.equal(drift!.expiresAt, new Date(Date.parse(drift!.observedAt!) + 2_592_000_000).toISOString(), "current for the declared thirty days");
  assert.equal(fresh!.claim, `3 new file(s) matched {positions,prices}/*: ${files.join(", ")}`);
  assert.deepEqual(fresh!.affectedUnits, ["type:ingest-positions"]);
  assert.deepEqual(routed.opened.map((o) => [o.unitType, o.unit, o.blocks, o.consumer, o.severity]), [["plan-rebalance", undefined, true, "S3", "blocking"], ["harvest-losses", undefined, true, "S3", "blocking"], ["ingest-positions", undefined, false, "S3", "advisory"]], "the same router and the same obligation a research unit's signal gets, holding the type");

  // The hold: plan-rebalance is dispatched after the sensor fired, and the veto matches the type.
  const ledger = new ObligationLedger(repo, clock);
  const hold = routed.opened[0]!;
  assert.deepEqual((await progressionVeto(ledger, "p3-plan-rebalance", "plan-rebalance")).map((o) => o.id), [hold.id]);
  let outcome = await dispatch(repo, "p3-plan-rebalance");
  assert.equal(outcome.status, "refused");
  assert.match(outcome.status === "refused" ? outcome.problems.map((p) => p.message).join("\n") : "", new RegExp(`^obligation ${hold.id.slice(0, 8)} \\(S3, blocking, intelligence-signal\\) is open on unit type "plan-rebalance" \\(raised before this unit existed; it holds every unit of the type\\): drift-band: VTI is 2\\.16% over its target.*; it must be dispositioned before dispatch`));
  assert.deepEqual(await progressionVeto(ledger, "p2-propose-target", "propose-target"), [], "another type is not held by the drift");
  assert.deepEqual(await progressionVeto(ledger, "p1-ingest-positions", "ingest-positions"), [], "the new export is advisory: a person is told, and the ingest it is for is not held");

  // Still past the band on the next tick: nothing more is raised while the obligation is open.
  ({ run, routed } = await sensorsTick(repo));
  assert.deepEqual([run.ran, run.fired, run.deduplicated, routed.opened], [["drift-band", "harvest-threshold", "new-export"], [], ["drift-band", "harvest-threshold"], []], "an hour on, the programs ran again; each fired on the same claim and raised nothing");
  assert.equal((await readSignals(repo)).filter((s) => s.kind === "intelligence-signal").length, 4, "four signals on the log (the harvest's first, then the three of the October export), not six");

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

/** The harvest sensor's program run in a copy as the watcher runs it, for the report a quiet run leaves on no log. */
async function harvestReport(repo: string): Promise<{ fires: boolean; observation: string }> {
  const { stdout } = await promisify(execFile)(process.execPath, [path.join(LAB_ROOT, SENSORS.harvest)], { cwd: repo });
  return JSON.parse(stdout.trim().split("\n").at(-1)!);
}

test("harvest-threshold (#181): the sensor fires on the harvest arithmetic and on no number of its own. An export where BND sits at 76.50 leaves the 2025 BND lot's loss of 285.00 worth 42.75 at the long-term rate, under the 14.54 of trading and the 33.25 of opportunity cost harvest.json prices: quiet, and the observation says why. An export where BND falls to 72.50 puts the loss at 1045.00, worth 156.75, against 13.78 and 31.51: the sensor fires with the three figures and the net in its claim, holds harvest-losses until a person dispositions it, and the drift sensor stays quiet since every weight is inside the band", async (t) => {
  const repo = await portfolioCopy(t);
  // The costs, recomputed here from the person's files and not through the library: two legs at the trading rate, and
  // an at-the-money option on the tracking difference over the wash-sale window, each on the lot's value in cents.
  const inputs = JSON.parse(await readFile(path.join(FIXTURE, "harvest.json"), "utf8")) as { tradingCostRate: number; trackingVolatility: number };
  const taxRules = JSON.parse(await readFile(path.join(FIXTURE, "tax.json"), "utf8")) as { longTermRate: number; washSaleWindowDays: number };
  assert.equal(taxRules.washSaleWindowDays, 30);
  const money = (cents: number) => `${cents < 0 ? "-" : ""}${(Math.abs(cents) / 100).toFixed(2)}`;
  const costs = (priceCents: number, shares: number, costCents: number) => {
    const value = priceCents * shares;
    const benefit = Math.round((costCents - priceCents) * shares * taxRules.longTermRate);
    const trading = 2 * Math.round(value * inputs.tradingCostRate);
    const opportunity = Math.round(value * inputs.trackingVolatility * Math.sqrt(taxRules.washSaleWindowDays / 365) / Math.sqrt(2 * Math.PI));
    return { benefit: money(benefit), trading: money(trading), opportunity: money(opportunity), net: money(benefit - trading - opportunity) };
  };
  const vxus = costs(5890, 150, 6000);
  assert.deepEqual(vxus, { benefit: "24.75", trading: "8.84", opportunity: "20.21", net: "-4.30" });
  const inputsRead = "by harvest.json (trading cost 0.0005 a leg, tracking volatility 0.02) over tax.json's 30-day window";
  const vxusLine = `2025-03-14-VXUS loss 165.00, benefit ${vxus.benefit} long-term less trading cost ${vxus.trading} and opportunity cost ${vxus.opportunity} = net ${vxus.net}`;

  // The quiet case: 190 BND bought at 78.00, now 76.50. A loss, with a benefit below its two costs.
  const quiet = costs(7650, 190, 7800);
  assert.deepEqual(quiet, { benefit: "42.75", trading: "14.54", opportunity: "33.25", net: "-5.04" });
  await addExport(repo, "2026-10-07", { ...SEPTEMBER_PRICES, BND: "76.50" });
  let { run, routed } = await sensorsTick(repo);
  assert.deepEqual([run.ran, run.fired, run.failed, routed.opened], [["drift-band", "harvest-threshold", "new-export"], [], [], []], "the sensor ran and raised nothing: two lots at a loss, neither worth its costs");
  assert.deepEqual(await harvestReport(repo), {
    fires: false,
    observation: `lots/lots.csv (current to 2026-08-31) at prices/2026-10-07.csv, ${inputsRead}: 2025-03-14-BND loss 285.00, benefit ${quiet.benefit} long-term less trading cost ${quiet.trading} and opportunity cost ${quiet.opportunity} = net ${quiet.net}; ${vxusLine}; no loss's benefit exceeds its costs`,
  });
  assert.deepEqual(await progressionVeto(new ObligationLedger(repo, clock), "p5-harvest-losses", "harvest-losses"), [], "nothing holds the harvest");
  await assert.rejects(promisify(execFile)(process.execPath, [path.join(LAB_ROOT, SENSORS.harvest), "--minimum", "150"], { cwd: repo }), /usage: harvest-threshold\.mjs \(no arguments\).*got --minimum 150/s, "the argument is gone, and a leftover one is an error, not a number quietly ignored");

  // The firing case: BND at 72.50.
  const worked = costs(7250, 190, 7800);
  assert.deepEqual(worked, { benefit: "156.75", trading: "13.78", opportunity: "31.51", net: "111.46" });
  await addExport(repo, "2026-10-15", { ...SEPTEMBER_PRICES, BND: "72.50" });
  ({ run, routed } = await sensorsTick(repo));
  assert.deepEqual(run.failed, []);
  assert.deepEqual(run.fired.map((s) => s.provenance), ["sensor:harvest-threshold", "sensor:new-export"]);
  const [harvest] = run.fired;
  assert.equal(harvest!.claim, `2025-03-14-BND is worth harvesting at the 2026-10-15 prices: benefit ${worked.benefit} at the long-term rate against trading cost ${worked.trading} and opportunity cost ${worked.opportunity}, net ${worked.net}`);
  assert.equal(harvest!.observation, `lots/lots.csv (current to 2026-08-31) at prices/2026-10-15.csv, ${inputsRead}: 2025-03-14-BND loss 1045.00, benefit ${worked.benefit} long-term less trading cost ${worked.trading} and opportunity cost ${worked.opportunity} = net ${worked.net}; ${vxusLine}`);
  assert.deepEqual(harvest!.affectedUnits, ["type:harvest-losses"]);
  assert.deepEqual(harvest!.evidence.map((e) => e.ref), [SENSORS.harvest, "lots/lots.csv", "prices/2026-10-15.csv", "tax.json", "harvest.json"]);
  const ledger = new ObligationLedger(repo, clock);
  const hold = routed.opened.find((o) => o.unitType === "harvest-losses")!;
  let outcome = await dispatch(repo, "p5-harvest-losses");
  assert.equal(outcome.status, "refused");
  assert.match(outcome.status === "refused" ? outcome.problems.map((p) => p.message).join("\n") : "", /is open on unit type "harvest-losses"/);
  assert.deepEqual(await progressionVeto(ledger, "p3-plan-rebalance", "plan-rebalance"), [], "the drift sensor said nothing: every weight is inside the band");
  await ledger.resolve(hold.id, { by: "alice", disposition: "replan", rationale: "harvest it" });
  outcome = await dispatch(repo, "p5-harvest-losses");
  assert.notEqual(outcome.status, "refused", JSON.stringify(outcome));
});

test("new-export: the glob over positions/ and prices/ fires on the files of an export the cursor has not seen, names them, and opens an advisory obligation that holds nothing — the export is what ingest-positions consumes; an export that was there at the first tick is the baseline and never fires", async (t) => {
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
  const note = routed.opened.find((o) => o.unitType === "ingest-positions")!;
  assert.deepEqual([note.blocks, note.consumer, note.severity], [false, "S3", "advisory"], "an advisory obligation on the type: a person is told the export landed, and nothing is held");
  const outcome = await dispatch(repo, "p1-ingest-positions");
  assert.notEqual(outcome.status, "refused", `ingest-positions is what the export is for, so the signal must not hold it: ${JSON.stringify(outcome)}`);
  ({ run } = await sensorsTick(repo));
  assert.deepEqual(run.fired.filter((s) => s.provenance === "sensor:new-export"), [], "seen");
});
