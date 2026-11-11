/**
 * Sensors (#123): the watcher's S4 without a model. `regulator watch` runs
 * the sensors the intelligence policy declares in its tick, and a sensor
 * that fires raises the same `intelligence-signal` a research unit raises
 * through `report_intelligence` — `source: "S4"`, the sensor's provenance in
 * place of the unit's, the program's file and hash as evidence — which the
 * same router turns into an obligation, and the same veto holds the unit
 * type it names at dispatch. Nothing here dispatches; a sensor raises an
 * obligation and never replans.
 *
 *   A scheduled sensor runs its program in the instance (the base checkout,
 *   not a worktree) through `runProgram`, with nothing on stdin, when at
 *   least `everyMs` has passed since its last run. Exit 0 with a last stdout
 *   line in the sensor-output shape says whether it fires; a non-zero exit, a
 *   timeout, a last line that is not one, or a write anywhere (its outputs
 *   are empty, so a write is undone) is a failed run, recorded as an advisory
 *   `operational-signal` naming the sensor and never an obligation.
 *
 *   A glob sensor fires when a file matching its glob appears that the
 *   watcher's cursor has not seen. The first tick seeds the cursor with what
 *   exists and fires on nothing; what the instance already held was already
 *   dealt with, or is a person's to raise.
 *
 *   A sensor that still fires on the next tick raises nothing while an
 *   earlier signal with the same claim is current — unrouted, holding an open
 *   obligation, or not yet expired — so there is one open obligation per
 *   sensor and claim. When a signal with an expiry expires while an
 *   obligation it opened is still open, one advisory obligation says so.
 *
 * The cursor (`.regulator/sensors.json`) is the watcher's: the files each
 * glob sensor has seen and the last run of each scheduled one. The record is
 * the regulatory log.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { ObligationLedger, REGULATOR_DIR, appendSignal, isCurrentSensorSignal, isOpen, matchesGlob, sensorSignals } from "@metacoding.io/regulator-core";
import { isSensorOutput, affectsUnitType, type IntelligencePolicy, type IntelligenceSignal, type Obligation, type OperationalSignal, type RoutingPolicy, type Sensor, type SensorOutput, type WorkloadDefinition } from "@metacoding.io/regulator-protocol";
import type { Exec } from "./exec.js";
import { ProgramError, excerpt, runProgram } from "./runner.js";
import { headRevision } from "./worktree.js";

export const SENSOR_CURSOR_RELATIVE_PATH = path.join(REGULATOR_DIR, "sensors.json");
/** The subject prefix of the advisory the watcher raises when a held signal expires; what it is deduplicated by. */
export const EXPIRED_SUBJECT_PREFIX = "expired intelligence: ";

interface SensorCursor {
  /** Per glob sensor: the files seen, as instance-relative paths. */
  seen: Record<string, string[]>;
  /** Per scheduled sensor: when its program last ran, ISO 8601. */
  lastRun: Record<string, string>;
}

async function readCursor(repo: string): Promise<SensorCursor> {
  try {
    const value = JSON.parse(await readFile(path.join(repo, SENSOR_CURSOR_RELATIVE_PATH), "utf8")) as Partial<SensorCursor>;
    return { seen: value.seen ?? {}, lastRun: value.lastRun ?? {} };
  } catch {
    return { seen: {}, lastRun: {} };
  }
}

async function writeCursor(repo: string, cursor: SensorCursor): Promise<void> {
  const file = path.join(repo, SENSOR_CURSOR_RELATIVE_PATH);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(cursor, null, 2)}\n`, "utf8");
}

/** Every file under the instance, relative with `/`, skipping `.git`, `.regulator` and `node_modules`. */
async function listFiles(root: string, dir = root): Promise<string[]> {
  const out: string[] = [];
  let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === REGULATOR_DIR || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await listFiles(root, full));
    else if (entry.isFile()) out.push(path.relative(root, full).split(path.sep).join("/"));
  }
  return out.sort();
}

export interface RunSensorsOptions {
  /** The instance: where the log, the cursor and the files a sensor reads are. */
  repo: string;
  /** The definition root a sensor program's file is resolved under. */
  definitionRoot: string;
  policy: IntelligencePolicy;
  routing: RoutingPolicy;
  now?: () => number;
}

export interface SensorFailure {
  sensor: string;
  detail: string;
}

export interface SensorsRun {
  /** The signals raised this tick, in declaration order. */
  fired: IntelligenceSignal[];
  /** Sensors that still fire and raised nothing, because an earlier signal with the same claim is current. */
  deduplicated: string[];
  /** Failed runs, each recorded as an operational-signal. */
  failed: SensorFailure[];
  /** The advisories opened for signals that expired while holding something. */
  expired: Obligation[];
  /** The sensors that ran or were read this tick. */
  ran: string[];
}

/** The workloads a sensor belongs to: those declaring a unit type it affects. A sensor is the workload's, as its programs read the workload's domain. */
export function sensorWorkloads(sensor: Sensor, workloads: readonly WorkloadDefinition[]): string[] {
  return workloads.filter((w) => w.unitTypes.some((t) => sensor.affects.includes(t.name))).map((w) => w.name).sort();
}

/**
 * The sensors that apply to an instance: those of the workloads named — by `--workload`, or the workloads the
 * instance's units run under. The shipped definition carries several workloads, and a sensor over one workload's
 * domain (the portfolio's `lib/portfolio.js`) has nothing to read in another's instance; running it there would be a
 * failure every tick, so a sensor runs only where its workload does.
 */
export function applicableSensors(policy: IntelligencePolicy, workloads: readonly WorkloadDefinition[], applicable: ReadonlySet<string>): { policy: IntelligencePolicy; skipped: Array<{ sensor: string; workloads: string[] }> } {
  const kept: Sensor[] = [];
  const skipped: Array<{ sensor: string; workloads: string[] }> = [];
  for (const sensor of policy.sensors) {
    const owners = sensorWorkloads(sensor, workloads);
    if (owners.some((w) => applicable.has(w))) kept.push(sensor); else skipped.push({ sensor: sensor.name, workloads: owners });
  }
  return { policy: { ...policy, sensors: kept }, skipped };
}

/** The signal a firing makes: the research unit's shape, with the sensor's provenance and, for a program, its file and hash as evidence. */
export function sensorSignal(sensor: Sensor, output: Extract<SensorOutput, { fires: true }>, context: { at: string; revision: string; program?: { file: string; sha256: string } }): IntelligenceSignal {
  const expiresAt = output.expiresAt ?? new Date(Date.parse(context.at) + sensor.expiresAfterMs).toISOString();
  return {
    id: randomUUID(), timestamp: context.at, source: "S4", kind: "intelligence-signal", channel: "intelligence", destination: "S3",
    severity: output.severity ?? sensor.severity, subject: `${sensor.name}: ${output.claim}`,
    observation: output.observation, claim: output.claim, ...(output.confidence === undefined ? {} : { confidence: output.confidence }),
    evidence: [
      ...(context.program ? [{ class: "file" as const, ref: context.program.file, observation: `the sensor's program, sha256 ${context.program.sha256}`, sourceRevision: context.revision }] : []),
      ...output.evidence.map((e) => ({ ...e, sourceRevision: context.revision })),
    ],
    observedAt: context.at, expiresAt, affectedUnits: sensor.affects.map(affectsUnitType), provenance: sensor.provenance,
  };
}

/** What a program's last stdout line says, or why it is not a sensor's report. */
export function parseSensorOutput(stdout: string): { output: SensorOutput } | { error: string } {
  const last = stdout.trim().split("\n").map((l) => l.trim()).filter(Boolean).at(-1);
  if (last === undefined) return { error: "the program printed nothing; a sensor's last stdout line says whether it fires" };
  let parsed: unknown;
  try { parsed = JSON.parse(last); } catch { return { error: `the program's last line is not JSON: ${last.slice(0, 200)}` }; }
  if (!isSensorOutput(parsed)) return { error: `the program's last line is not a sensor's report ({ fires: false } or { fires: true, claim, observation, evidence[], severity?, confidence?, expiresAt? }): ${last.slice(0, 200)}` };
  return { output: parsed };
}

/**
 * One tick of the sensors: run what is due, raise what fires, record what failed, and say what expired. The router is
 * the caller's next step (the watcher routes and delivers after this), so a signal raised here is unrouted when this
 * returns, and is counted as current by the next tick's deduplication.
 */
export async function runSensors(exec: Exec, options: RunSensorsOptions): Promise<SensorsRun> {
  const now = options.now ?? Date.now;
  const { repo, policy } = options;
  const run: SensorsRun = { fired: [], deduplicated: [], failed: [], expired: [], ran: [] };
  const cursor = await readCursor(repo);
  const ledger = new ObligationLedger(repo, now);
  let entries = await ledger.entries();
  let revision: string | undefined;
  const revisionOf = async () => (revision ??= await headRevision(exec, repo).catch(() => "unknown"));
  const at = () => new Date(now()).toISOString();

  const fail = async (sensor: Sensor, detail: string, evidence: OperationalSignal["evidence"]) => {
    // A broken sensor is a fact about the deployment, not a reason to hold anything: advisory, below the operational line, noted by the router and never an obligation; once per distinct failure.
    const subject = `sensor ${sensor.name} failed`;
    const observation = `${sensor.provenance} did not run to a report: ${detail}. Nothing was raised; a sensor's failure is operational, never a replan.`;
    run.failed.push({ sensor: sensor.name, detail });
    if (entries.some((e) => "kind" in e && e.kind === "operational-signal" && e.subject === subject && e.observation === observation)) return;
    const signal: OperationalSignal = { id: randomUUID(), timestamp: at(), source: "S1", kind: "operational-signal", channel: "signal", destination: "S3", severity: "advisory", subject, observation, evidence };
    await appendSignal(repo, signal);
    entries = await ledger.entries();
  };

  const raise = async (sensor: Sensor, output: Extract<SensorOutput, { fires: true }>, program?: { file: string; sha256: string }) => {
    const current = sensorSignals(entries, sensor.provenance).filter((e) => e.signal.claim === output.claim && isCurrentSensorSignal(e, now()));
    if (current.length) { run.deduplicated.push(sensor.name); return; }
    const signal = sensorSignal(sensor, output, { at: at(), revision: await revisionOf(), ...(program ? { program } : {}) });
    await appendSignal(repo, signal);
    entries = await ledger.entries();
    run.fired.push(signal);
  };

  for (const sensor of policy.sensors) {
    if (sensor.glob !== undefined) {
      const matching = (await listFiles(repo)).filter((f) => matchesGlob(sensor.glob!, f));
      const seen = cursor.seen[sensor.name];
      run.ran.push(sensor.name);
      if (seen === undefined) {
        // The first tick: what exists is the baseline, not an event.
        cursor.seen[sensor.name] = matching;
        continue;
      }
      const known = new Set(seen);
      const fresh = matching.filter((f) => !known.has(f));
      cursor.seen[sensor.name] = [...new Set([...seen, ...matching])].sort();
      if (!fresh.length) continue;
      await raise(sensor, {
        fires: true,
        claim: `${fresh.length} new file(s) matched ${sensor.glob}: ${fresh.join(", ")}`,
        observation: `${fresh.map((f) => `${f} appeared under the instance`).join("; ")}; the watcher's cursor had not seen ${fresh.length === 1 ? "it" : "them"}. Affects ${sensor.affects.join(", ")}.`,
        evidence: fresh.map((f) => ({ class: "file" as const, ref: f, observation: "a new file matching the sensor's glob" })),
      });
      continue;
    }
    if (!sensor.schedule || !sensor.program) continue;
    const last = cursor.lastRun[sensor.name];
    if (last !== undefined && now() - Date.parse(last) < sensor.schedule.everyMs) continue;
    run.ran.push(sensor.name);
    cursor.lastRun[sensor.name] = at();
    let outcome;
    try {
      outcome = await runProgram(exec, { root: options.definitionRoot, program: sensor.program, cwd: repo, timeoutMs: policy.programTimeoutMs, env: { REGULATOR_SENSOR: sensor.name } });
    } catch (error) {
      await fail(sensor, error instanceof ProgramError ? error.message : String(error), [{ class: "command", ref: sensor.program.argv.join(" ") }]);
      continue;
    }
    const programRef = { class: "file" as const, ref: outcome.program.file, observation: `sha256 ${outcome.program.sha256}` };
    if (outcome.outside.length) { await fail(sensor, `the program wrote ${outcome.outside.join(", ")}; a sensor reads and never writes, and the writes are undone`, [programRef]); continue; }
    if (outcome.timedOut) { await fail(sensor, `the program ran past ${Math.min(sensor.program.timeoutMs ?? Number.POSITIVE_INFINITY, policy.programTimeoutMs)} ms and was stopped`, [programRef]); continue; }
    if (outcome.result.code !== 0) { await fail(sensor, `the program exited ${outcome.result.code}: ${excerpt(outcome.result.stderr) || excerpt(outcome.result.stdout) || "(no output)"}`, [programRef]); continue; }
    const parsed = parseSensorOutput(outcome.result.stdout);
    if ("error" in parsed) { await fail(sensor, parsed.error, [programRef]); continue; }
    if (parsed.output.fires) await raise(sensor, parsed.output, outcome.program);
  }
  await writeCursor(repo, cursor);

  // Expiry: a signal past its expiry whose obligation is still open gets one advisory saying so — the re-raise the
  // intelligence-intake card's third limitation left undone, for every intelligence signal the log holds.
  const obligations = await ledger.obligations();
  const rule = options.routing.rules.find((r) => r.kind === "intelligence-signal");
  for (const entry of entries) {
    if (!("kind" in entry) || entry.kind !== "intelligence-signal" || entry.expiresAt === undefined || Date.parse(entry.expiresAt) > now()) continue;
    const held = obligations.filter((o) => o.sources.includes(entry.id) && isOpen(o) && !o.subject.startsWith(EXPIRED_SUBJECT_PREFIX));
    if (!held.length) continue;
    const subject = `${EXPIRED_SUBJECT_PREFIX}${entry.subject}`;
    if (obligations.some((o) => o.subject === subject && o.sources[0] === entry.id)) continue;
    run.expired.push(await ledger.openObligation({
      subject, concern: "intelligence-signal", sources: [entry.id, ...held.map((o) => o.id)], severity: "advisory", consumer: rule?.consumer ?? "S3", blocks: false,
      question: `${entry.provenance ?? entry.unit ?? "S4"} raised this at ${entry.observedAt ?? entry.timestamp} and it expired at ${entry.expiresAt}; ${held.length} obligation(s) it opened ${held.length === 1 ? "is" : "are"} still open and still ${held.some((o) => o.blocks) ? "hold" : "name"} ${held.map((o) => o.unitType ? `unit type ${o.unitType}` : o.unit ? `unit ${o.unit}` : "the instance").join(", ")}. Is the claim still current, or should what it holds be released?`,
    }));
  }
  return run;
}
