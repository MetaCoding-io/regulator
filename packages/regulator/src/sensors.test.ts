import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { ObligationLedger, readSignals } from "@metacoding.io/regulator-core";
import type { IntelligencePolicy, Sensor } from "@metacoding.io/regulator-protocol";
import { watchOutbox } from "./deliver.js";
import { gitExec, initRepo } from "./git-support.js";
import { loadInteractionPolicy } from "./interaction-policy.js";
import { loadRoutingPolicy } from "./routing-policy.js";
import { SENSOR_CURSOR_RELATIVE_PATH, parseSensorOutput, runSensors } from "./sensors.js";

/** A definition root of its own with the sensor programs the tests name: nothing shipped carries them. */
async function definitionRoot(t: TestContext): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "regulator-sensor-definition-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "sensors"), { recursive: true });
  const program = (name: string, body: string) => writeFile(path.join(root, "sensors", `${name}.mjs`), `${body}\n`);
  // Fires when the instance carries a file named `drift`, with its content as the claim; quiet otherwise.
  await program("drift", 'import { existsSync, readFileSync } from "node:fs"; if (!existsSync("drift")) { console.log(JSON.stringify({ fires: false, observation: "inside the band" })); } else { const claim = readFileSync("drift", "utf8").trim(); console.log("reading…"); console.log(JSON.stringify({ fires: true, claim, observation: `read drift: ${claim}`, evidence: [{ class: "file", ref: "drift" }] })); }');
  await program("fails", 'console.error("no prices for VNQ"); process.exit(3);');
  await program("writes", 'import { writeFileSync } from "node:fs"; writeFileSync("scratch.txt", "x"); console.log(JSON.stringify({ fires: false }));');
  await program("babbles", 'console.log("not a report");');
  await program("overrides", 'console.log(JSON.stringify({ fires: true, claim: "a quiet one", observation: "o", evidence: [], severity: "advisory", expiresAt: "2026-12-01T00:00:00.000Z", confidence: "low" }));');
  return root;
}

const sensor = (name: string, over: Partial<Sensor> = {}): Sensor => ({
  name, description: "d", provenance: `sensor:${name}`, affects: ["plan"], severity: "blocking", expiresAfterMs: 3_600_000,
  schedule: { everyMs: 60_000 }, program: { argv: ["node", `sensors/${name}.mjs`], outputs: [] }, ...over,
});
const policyWith = (...sensors: Sensor[]): IntelligencePolicy => ({ name: "intelligence", version: 1, description: "d", programTimeoutMs: 10_000, sensors });

test("a sensor's last line: a report, or the reason it is not one", () => {
  assert.deepEqual(parseSensorOutput('noise\n{"fires":false}\n'), { output: { fires: false } });
  assert.match((parseSensorOutput("") as { error: string }).error, /printed nothing/);
  assert.match((parseSensorOutput("fires: true") as { error: string }).error, /not JSON/);
  assert.match((parseSensorOutput('{"fires":true}') as { error: string }).error, /not a sensor's report/);
});

test("sensors in the watcher's tick (#123): a scheduled sensor runs its program in the instance once per interval; a firing is an intelligence-signal with the sensor's provenance, the program's file and hash as evidence and the affected unit types as `type:` entries; it is routed like a research unit's and holds the type; a sensor that still fires raises nothing while the claim is current; a changed claim is a new signal", async (t) => {
  const repo = await initRepo(t);
  const root = await definitionRoot(t);
  let clock = Date.parse("2026-10-15T12:00:00.000Z");
  const now = () => clock;
  const routing = await loadRoutingPolicy();
  const policy = policyWith(sensor("drift"));
  const ledger = new ObligationLedger(repo, now);

  let run = await runSensors(gitExec, { repo, definitionRoot: root, policy, routing, now });
  assert.deepEqual([run.ran, run.fired, run.failed, run.deduplicated, run.expired], [["drift"], [], [], [], []], "quiet: the program ran and said it does not fire");
  assert.deepEqual(await readSignals(repo), [], "nothing on the log");
  const cursor = JSON.parse(await readFile(path.join(repo, SENSOR_CURSOR_RELATIVE_PATH), "utf8")) as { lastRun: Record<string, string> };
  assert.equal(cursor.lastRun.drift, "2026-10-15T12:00:00.000Z", "the cursor remembers the run");

  await writeFile(path.join(repo, "drift"), "VTI is past the band\n");
  clock += 30_000;
  run = await runSensors(gitExec, { repo, definitionRoot: root, policy, routing, now });
  assert.deepEqual(run.ran, [], "half the interval has passed: not due");
  clock += 30_000;
  run = await runSensors(gitExec, { repo, definitionRoot: root, policy, routing, now });
  assert.equal(run.fired.length, 1);
  const [signal] = run.fired;
  assert.deepEqual(
    [signal!.source, signal!.kind, signal!.destination, signal!.severity, signal!.provenance, signal!.unit, signal!.claim, signal!.subject, signal!.affectedUnits, signal!.observedAt, signal!.expiresAt],
    ["S4", "intelligence-signal", "S3", "blocking", "sensor:drift", undefined, "VTI is past the band", "drift: VTI is past the band", ["type:plan"], "2026-10-15T12:01:00.000Z", "2026-10-15T13:01:00.000Z"],
    "the research unit's record, with the sensor's provenance where the unit would be and the declared expiry from the time it fired",
  );
  assert.equal(signal!.evidence[0]!.ref, "sensors/drift.mjs");
  assert.match(signal!.evidence[0]!.observation ?? "", /^the sensor's program, sha256 [0-9a-f]{64}$/);
  assert.deepEqual(signal!.evidence.map((e) => [e.class, e.ref, typeof e.sourceRevision]), [["file", "sensors/drift.mjs", "string"], ["file", "drift", "string"]], "the program's evidence follows the program's own, each stamped with the instance's revision");
  assert.deepEqual((await readSignals(repo)).map((s) => s.id), [signal!.id], "on the regulatory log");

  // The same router a research unit's signal gets: the obligation holds the unit type at dispatch.
  const { routeMessages, progressionVeto } = await import("@metacoding.io/regulator-core");
  const routed = await routeMessages(ledger, { policy: routing, now });
  assert.deepEqual(routed.opened.map((o) => [o.unit, o.unitType, o.blocks, o.consumer, o.concern, o.sources]), [[undefined, "plan", true, "S3", "intelligence-signal", [signal!.id]]]);
  assert.deepEqual((await progressionVeto(ledger, "p3", "plan")).map((o) => o.id), [routed.opened[0]!.id]);

  // Still firing on the next tick: one open obligation per sensor and claim.
  clock += 60_000;
  run = await runSensors(gitExec, { repo, definitionRoot: root, policy, routing, now });
  assert.deepEqual([run.ran, run.fired.length, run.deduplicated], [["drift"], 0, ["drift"]], "the program ran and fired; nothing was raised");
  assert.equal((await readSignals(repo)).length, 1);
  // A different reading is a different claim.
  await writeFile(path.join(repo, "drift"), "BND is past the band\n");
  clock += 60_000;
  run = await runSensors(gitExec, { repo, definitionRoot: root, policy, routing, now });
  assert.deepEqual(run.fired.map((s) => s.claim), ["BND is past the band"]);
  // Dispositioned and not yet expired: the sensor stays quiet on the same claim until the signal expires.
  await ledger.resolve(routed.opened[0]!.id, { by: "alice", disposition: "replan", rationale: "plan it" });
  await writeFile(path.join(repo, "drift"), "VTI is past the band\n");
  clock += 60_000;
  run = await runSensors(gitExec, { repo, definitionRoot: root, policy, routing, now });
  assert.deepEqual([run.fired.length, run.deduplicated], [0, ["drift"]], "resolved, but the earlier signal is current for an hour");
  clock += 3_600_000;
  run = await runSensors(gitExec, { repo, definitionRoot: root, policy, routing, now });
  assert.deepEqual(run.fired.map((s) => s.claim), ["VTI is past the band"], "expired and dispositioned: the condition still holds, so it is raised again");
});

test("a failed sensor is operational, never a replan: a non-zero exit, a stray write (undone), and a last line that is not a report are each an advisory operational-signal naming the sensor, once per distinct failure, and the router notes them; a program may say its own severity, confidence and expiry for one firing", async (t) => {
  const repo = await initRepo(t);
  const root = await definitionRoot(t);
  let clock = Date.parse("2026-10-15T12:00:00.000Z");
  const now = () => clock;
  const routing = await loadRoutingPolicy();
  const policy = policyWith(sensor("fails"), sensor("writes"), sensor("babbles"), sensor("overrides", { severity: "blocking", expiresAfterMs: 3_600_000 }));
  let run = await runSensors(gitExec, { repo, definitionRoot: root, policy, routing, now });
  assert.deepEqual(run.failed.map((f) => f.sensor), ["fails", "writes", "babbles"]);
  assert.match(run.failed[0]!.detail, /^the program exited 3: no prices for VNQ$/);
  assert.match(run.failed[1]!.detail, /^the program wrote scratch\.txt; a sensor reads and never writes, and the writes are undone$/);
  assert.match(run.failed[2]!.detail, /^the program's last line is not JSON: not a report$/);
  await assert.rejects(readFile(path.join(repo, "scratch.txt")), "the stray write is undone");
  const signals = await readSignals(repo);
  assert.deepEqual(signals.map((s) => [s.kind, "severity" in s ? s.severity : undefined, s.subject]), [
    ["operational-signal", "advisory", "sensor fails failed"], ["operational-signal", "advisory", "sensor writes failed"], ["operational-signal", "advisory", "sensor babbles failed"],
    ["intelligence-signal", "advisory", "overrides: a quiet one"],
  ]);
  const fired = signals[3]!;
  assert.deepEqual(fired.kind === "intelligence-signal" ? [fired.severity, fired.confidence, fired.expiresAt] : [], ["advisory", "low", "2026-12-01T00:00:00.000Z"], "the program's word for this firing, over the declaration's");
  const { routeMessages } = await import("@metacoding.io/regulator-core");
  const routed = await routeMessages(new ObligationLedger(repo, now), { policy: routing, now });
  assert.deepEqual(routed.noted.map((n) => n.message.subject), ["sensor fails failed", "sensor writes failed", "sensor babbles failed"], "below the operational line: noted, never an obligation, nothing replanned");
  assert.deepEqual(routed.opened.map((o) => [o.unitType, o.blocks]), [["plan", false]], "an advisory firing opens an obligation that holds nothing");
  clock += 60_000;
  run = await runSensors(gitExec, { repo, definitionRoot: root, policy, routing, now });
  assert.equal(run.failed.length, 3, "still failing");
  assert.equal((await readSignals(repo)).length, 4, "the same failure is not recorded twice");
});

test("a glob sensor fires when a matching file appears that the cursor has not seen — the first tick seeds the cursor and fires on nothing — and its observation names the file; an expired signal still holding an open obligation raises one advisory, once", async (t) => {
  const repo = await initRepo(t);
  const root = await definitionRoot(t);
  let clock = Date.parse("2026-10-15T12:00:00.000Z");
  const now = () => clock;
  const routing = await loadRoutingPolicy();
  const { schedule: _s, program: _p, ...glob } = sensor("export", { affects: ["ingest"], expiresAfterMs: 60_000 });
  const policy = policyWith({ ...glob, glob: "{positions,prices}/*" });
  await mkdir(path.join(repo, "positions"), { recursive: true });
  await writeFile(path.join(repo, "positions", "2026-09-30.csv"), "ticker,shares\n");
  let run = await runSensors(gitExec, { repo, definitionRoot: root, policy, routing, now });
  assert.deepEqual([run.ran, run.fired], [["export"], []], "what exists at the first tick is the baseline");
  const cursor = JSON.parse(await readFile(path.join(repo, SENSOR_CURSOR_RELATIVE_PATH), "utf8")) as { seen: Record<string, string[]> };
  assert.deepEqual(cursor.seen.export, ["positions/2026-09-30.csv"]);
  await mkdir(path.join(repo, "prices"), { recursive: true });
  await writeFile(path.join(repo, "prices", "2026-10-15.csv"), "ticker,price\n");
  await writeFile(path.join(repo, "positions", "2026-10-15.csv"), "ticker,shares\n");
  await writeFile(path.join(repo, "targets.txt"), "not matching\n");
  clock += 1000;
  run = await runSensors(gitExec, { repo, definitionRoot: root, policy, routing, now });
  assert.equal(run.fired.length, 1, "one signal per tick, naming every new file");
  const [signal] = run.fired;
  assert.equal(signal!.claim, "2 new file(s) matched {positions,prices}/*: positions/2026-10-15.csv, prices/2026-10-15.csv");
  assert.match(signal!.observation, /^positions\/2026-10-15\.csv appeared under the instance; prices\/2026-10-15\.csv appeared under the instance; the watcher's cursor had not seen them\. Affects ingest\.$/);
  assert.deepEqual(signal!.evidence.map((e) => e.ref), ["positions/2026-10-15.csv", "prices/2026-10-15.csv"], "no program, so no program evidence");
  assert.deepEqual(signal!.affectedUnits, ["type:ingest"]);
  clock += 1000;
  run = await runSensors(gitExec, { repo, definitionRoot: root, policy, routing, now });
  assert.deepEqual(run.fired, [], "seen: nothing new");

  // The expiry advisory: the signal held ingest; a minute later it has expired and the hold is still open.
  const { routeMessages, progressionVeto } = await import("@metacoding.io/regulator-core");
  const ledger = new ObligationLedger(repo, now);
  const routed = await routeMessages(ledger, { policy: routing, now });
  assert.deepEqual(routed.opened.map((o) => [o.unitType, o.blocks]), [["ingest", true]]);
  clock += 60_000;
  run = await runSensors(gitExec, { repo, definitionRoot: root, policy, routing, now });
  assert.equal(run.expired.length, 1);
  const [advisory] = run.expired;
  assert.deepEqual([advisory!.severity, advisory!.blocks, advisory!.consumer, advisory!.concern, advisory!.unit, advisory!.unitType, advisory!.sources], ["advisory", false, "S3", "intelligence-signal", undefined, undefined, [signal!.id, routed.opened[0]!.id]]);
  assert.equal(advisory!.subject, `expired intelligence: ${signal!.subject}`);
  assert.match(advisory!.question ?? "", /^sensor:export raised this at 2026-10-15T12:00:01\.000Z and it expired at 2026-10-15T12:01:01\.000Z; 1 obligation\(s\) it opened is still open and still hold unit type ingest\. Is the claim still current, or should what it holds be released\?$/);
  assert.deepEqual((await progressionVeto(ledger, "p1", "ingest")).map((o) => o.id), [routed.opened[0]!.id], "the advisory releases nothing by itself: the hold stays until a person dispositions it");
  clock += 1000;
  run = await runSensors(gitExec, { repo, definitionRoot: root, policy, routing, now });
  assert.deepEqual(run.expired, [], "said once");
  await ledger.resolve(routed.opened[0]!.id, { by: "alice", disposition: "no-action", rationale: "ingested by hand" });
  clock += 1000;
  run = await runSensors(gitExec, { repo, definitionRoot: root, policy, routing, now });
  assert.deepEqual(run.expired, [], "nothing held: nothing to say");
});

test("the watcher runs the sensors in its tick when the policy is given, routes what fired and delivers what is owed, and the tick says what the sensors did; without a policy it runs none", async (t) => {
  const repo = await initRepo(t);
  const root = await definitionRoot(t);
  let clock = Date.parse("2026-10-15T12:00:00.000Z");
  const now = () => clock;
  const interaction = await loadInteractionPolicy();
  const routing = await loadRoutingPolicy();
  await writeFile(path.join(repo, "drift"), "VTI is past the band\n");
  const bare = await watchOutbox(repo, { policy: interaction, now, once: true });
  assert.equal(bare[0]!.sensors, undefined);
  assert.deepEqual(await readSignals(repo), []);
  const ticks = await watchOutbox(repo, { policy: interaction, now, once: true, sensors: { policy: policyWith(sensor("drift")), definitionRoot: root, routing, exec: gitExec } });
  const did = ticks[0]!.sensors;
  assert.deepEqual([did?.ran, did?.fired.length, ticks[0]!.delivered], [["drift"], 1, 0], "fired and routed in the tick; owed to S3, so nothing reached the outbox");
  const ledger = new ObligationLedger(repo, now);
  assert.deepEqual((await ledger.open()).map((o) => [o.unitType, o.blocks, o.consumer]), [["plan", true, "S3"]], "routed by the tick, not left unrouted");
  assert.deepEqual(await ledger.unrouted(), []);
});

test("a sensor belongs to the workloads whose unit types it affects, and only the sensors of an instance's workloads apply: the shipped policy's three are the portfolio's, and a software or finance instance runs none of them", async () => {
  const { loadIntelligencePolicy } = await import("./intelligence-policy.js");
  const { loadWorkloadFor } = await import("./workload.js");
  const policy = await loadIntelligencePolicy();
  const workloads = await Promise.all(["software-development", "personal-finance", "portfolio"].map((w) => loadWorkloadFor(w)));
  const { applicableSensors, sensorWorkloads } = await import("./sensors.js");
  assert.deepEqual(policy.sensors.map((s) => sensorWorkloads(s, workloads)), [["portfolio"], ["portfolio"], ["portfolio"]]);
  const portfolio = applicableSensors(policy, workloads, new Set(["portfolio"]));
  assert.deepEqual([portfolio.policy.sensors.map((s) => s.name), portfolio.skipped], [["drift-band", "harvest-threshold", "new-export"], []]);
  const software = applicableSensors(policy, workloads, new Set(["software-development"]));
  assert.deepEqual([software.policy.sensors, software.skipped], [[], [{ sensor: "drift-band", workloads: ["portfolio"] }, { sensor: "harvest-threshold", workloads: ["portfolio"] }, { sensor: "new-export", workloads: ["portfolio"] }]]);
  assert.deepEqual(applicableSensors(policy, workloads, new Set()).policy.sensors, [], "an instance that has run no unit and names no workload runs no sensor");
  assert.deepEqual(sensorWorkloads(sensor("x", { affects: ["implement", "plan-rebalance"] }), workloads), ["portfolio", "software-development"], "a sensor may belong to more than one");
});
