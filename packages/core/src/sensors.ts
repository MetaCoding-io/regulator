/**
 * Sensors (#123): what the definition check refuses about the intelligence
 * policy, and the pure pieces the watcher's sensor runner in
 * `packages/regulator` builds on — a glob matcher over instance paths, and
 * the fold that says which sensor signals are still current.
 *
 *   checkIntelligencePolicy   the refusals over a well-formed policy: a sensor
 *                             whose affected unit type no workload declares,
 *                             whose provenance is not its own name under
 *                             `sensor:`, that names a program with no file
 *                             under the definition, that declares outputs
 *                             (a sensor reads and never writes), that has
 *                             neither trigger or both, a glob with a program
 *                             or a schedule without one, two sensors with one
 *                             name
 *   globToRegExp              `*`, `**`, `?` and `{a,b}` over `/`-separated
 *                             relative paths; nothing else is special
 *   currentSensorSignals      the sensor signals on the log that are unexpired
 *                             or still hold an open obligation, by provenance
 *                             and claim: what a re-firing sensor is deduplicated
 *                             against
 *
 * Pi-free and git-free.
 */
import { isSensorProvenance, type IntelligencePolicy, type IntelligenceSignal, type ObligationState, type RegulatoryEntry, type Sensor } from "@metacoding.io/regulator-protocol";
import { foldObligations, isOpen, unroutedMessages } from "./obligations.js";
import { checkProgram } from "./runners.js";
import { isMessage } from "./signals.js";

export interface CheckIntelligencePolicyOptions {
  /** The definition root a sensor program's file is resolved under. */
  root: string;
  policy: IntelligencePolicy;
  /** Every unit type the definition's workloads declare. */
  unitTypes: ReadonlySet<string>;
}

/** What `regulator check` refuses about an intelligence policy, in the order a reader fixes them. */
export async function checkIntelligencePolicy(options: CheckIntelligencePolicyOptions): Promise<string[]> {
  const { root, policy, unitTypes } = options;
  const problems: string[] = [];
  const names = new Set<string>();
  for (const sensor of policy.sensors) {
    const at = `sensor "${sensor.name}"`;
    if (names.has(sensor.name)) problems.push(`${at} is declared twice`);
    names.add(sensor.name);
    if (sensor.provenance !== `sensor:${sensor.name}`) problems.push(`${at} writes under provenance "${sensor.provenance}"; a sensor's provenance is its own name, "sensor:${sensor.name}"`);
    for (const type of sensor.affects) if (!unitTypes.has(type)) problems.push(`${at} affects unit type "${type}", which no workload declares`);
    const triggers = [sensor.glob === undefined ? [] : ["glob"], sensor.schedule === undefined ? [] : ["schedule"]].flat();
    if (triggers.length === 0) problems.push(`${at} has no trigger: declare a glob over the instance's files or a schedule with a program`);
    if (triggers.length === 2) problems.push(`${at} declares both a glob and a schedule; a sensor has one trigger`);
    if (sensor.schedule && !sensor.program) problems.push(`${at} is scheduled but names no program: a schedule says when to run, and there is nothing to run`);
    if (sensor.glob !== undefined && sensor.program) problems.push(`${at} declares a glob and a program; a glob sensor's event is the file, and nothing runs`);
    if (sensor.glob !== undefined) {
      try { globToRegExp(sensor.glob); } catch (error) { problems.push(`${at} declares glob "${sensor.glob}", which is not a pattern: ${(error as Error).message}`); }
    }
    if (sensor.program) {
      const checked = await checkProgram(root, at, sensor.program, "the signal's evidence");
      problems.push(...checked.problems);
      if (sensor.program.outputs.length) problems.push(`${at} declares outputs (${sensor.program.outputs.join(", ")}); a sensor reads the instance and never writes it, so its program declares none`);
    }
  }
  return problems;
}

/**
 * A glob over `/`-separated paths relative to the instance: `**` matches across separators, `*` and `?` within a
 * segment, `{a,b}` is an alternation; everything else is literal. Throws on an unbalanced brace.
 */
export function globToRegExp(glob: string): RegExp {
  let out = "^";
  let depth = 0;
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        // `**/` matches zero or more whole segments; a bare `**` matches anything.
        if (glob[i + 1] === "/") { i++; out += "(?:.*/)?"; } else out += ".*";
      } else out += "[^/]*";
    } else if (c === "?") out += "[^/]";
    else if (c === "{") { depth++; out += "(?:"; }
    else if (c === "}") { if (!depth) throw new Error(`unmatched "}" at ${i}`); depth--; out += ")"; }
    else if (c === "," && depth) out += "|";
    else out += c.replace(/[.+^$()|[\]\\]/g, "\\$&");
  }
  if (depth) throw new Error("unmatched \"{\"");
  return new RegExp(`${out}$`);
}

export function matchesGlob(glob: string, relativePath: string): boolean {
  return globToRegExp(glob).test(relativePath.split("\\").join("/"));
}

export interface CurrentSensorSignal {
  signal: IntelligenceSignal;
  /** The obligations opened from it, open or not. */
  obligations: ObligationState[];
  /** Whether nothing has routed it yet. */
  unrouted: boolean;
}

/** The signal is still current: not yet expired at `now`, or holding an open obligation, or waiting for the router. */
export function isCurrentSensorSignal(entry: CurrentSensorSignal, now: number): boolean {
  if (entry.unrouted) return true;
  if (entry.obligations.some(isOpen)) return true;
  return entry.signal.expiresAt === undefined || Date.parse(entry.signal.expiresAt) > now;
}

/**
 * Every intelligence signal a sensor raised, with what became of it. The watcher deduplicates a firing against this: a
 * sensor that still fires on the next tick raises nothing while an earlier signal with the same claim is current.
 */
export function sensorSignals(entries: readonly RegulatoryEntry[], provenance?: string): CurrentSensorSignal[] {
  const obligations = foldObligations(entries);
  const unrouted = new Set(unroutedMessages(entries).map((m) => m.id));
  const out: CurrentSensorSignal[] = [];
  for (const entry of entries) {
    if (!isMessage(entry) || entry.kind !== "intelligence-signal" || !isSensorProvenance(entry.provenance)) continue;
    if (provenance !== undefined && entry.provenance !== provenance) continue;
    out.push({ signal: entry, obligations: obligations.filter((o) => o.sources.includes(entry.id)), unrouted: unrouted.has(entry.id) });
  }
  return out;
}

/** The sensor a signal came from, by provenance, or undefined. */
export function sensorOf(policy: IntelligencePolicy, signal: IntelligenceSignal): Sensor | undefined {
  return policy.sensors.find((s) => s.provenance === signal.provenance);
}
