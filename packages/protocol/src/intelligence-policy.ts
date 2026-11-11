/**
 * The intelligence policy (#123): sensors as a declared part of the
 * definition. A sensor is S4 without a model — a program over the instance,
 * or a glob over its files — that raises the same `intelligence-signal` a
 * research unit raises through `report_intelligence`, with the sensor's
 * provenance in place of the unit's. `regulator watch` runs the declared
 * sensors in its tick; the router opens the obligation; nothing replans.
 *
 * Two triggers, one each:
 *
 *   schedule   `{ everyMs }`: the sensor's `program` (the shape a command
 *              runner's is, `ProgramSchema`) runs in the instance at most
 *              once per interval, with nothing on stdin, and its last stdout
 *              line says whether it fires (`SensorOutputSchema`). Its
 *              `outputs` must be empty: a sensor reads and never writes the
 *              tree, and the definition check refuses one that declares any.
 *   glob       a pattern over the instance's files; a file matching it that
 *              the watcher's cursor has not seen is the event, and the
 *              signal's observation names it. No program.
 *
 * `affects` names unit *types*, not unit ids, because the unit a sensor's
 * signal bears on is usually dispatched after the sensor fires: the signal's
 * `affectedUnits` carries each as `type:<unitType>` (`affectsUnitType`), the
 * router opens an obligation that holds the type, and the progression veto
 * matches it at dispatch. `severity` and `expiresAfterMs` are the
 * declaration's: what the sensor's firing is worth and how long it stays
 * current are the definition's claims, which is the record's first limitation.
 */
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";
import { ProgramSchema } from "./workload.js";
import { SeveritySchema } from "./severity.js";

const NonEmpty = Type.String({ minLength: 1 });
const Name = Type.String({ pattern: "^[a-z][a-z0-9-]*$" });

/** The prefix a sensor writes its provenance under: `sensor:<name>`. */
export const SENSOR_PROVENANCE_PREFIX = "sensor:";
/** The prefix an `affectedUnits` entry carries when it names a unit type rather than a unit id. */
export const AFFECTED_UNIT_TYPE_PREFIX = "type:";

export const SensorScheduleSchema = Type.Object({
  /** The interval, in milliseconds, between two runs of the sensor's program; the watcher runs it when at least this long has passed since the last run. No cron. */
  everyMs: Type.Integer({ minimum: 1000 }),
}, { additionalProperties: false });
export type SensorSchedule = Static<typeof SensorScheduleSchema>;

export const SensorSchema = Type.Object({
  name: Name,
  description: NonEmpty,
  /** What the signal is raised under: `sensor:<name>`, the sensor's own name. The definition check refuses any other. */
  provenance: Type.String({ pattern: "^sensor:[a-z][a-z0-9-]*$" }),
  /** The unit types the sensor's signal bears on; each must be a type some workload declares. The signal names them as `type:<unitType>`. */
  affects: Type.Array(Name, { minItems: 1 }),
  /** The severity the signal is raised at: the declaration's claim about what the firing is worth; the router derives what it acts on. A program may say otherwise for one firing. */
  severity: SeveritySchema,
  /** How long a firing stays current, in milliseconds from the time it fires: the signal's `expiresAt`, unless the program names one. An expired signal that still holds an open unit raises an advisory. */
  expiresAfterMs: Type.Integer({ minimum: 60_000 }),
  /** The glob trigger: a pattern over paths relative to the instance (`*`, `**`, `?`, `{a,b}`); a new matching file is the event. */
  glob: Type.Optional(NonEmpty),
  /** The schedule trigger, with `program` as what runs. */
  schedule: Type.Optional(SensorScheduleSchema),
  /** The program a scheduled sensor runs, in the command runner's shape; its `outputs` must be empty. */
  program: Type.Optional(ProgramSchema),
}, { additionalProperties: false });
export type Sensor = Static<typeof SensorSchema>;

export const IntelligencePolicySchema = Type.Object({
  name: Name,
  version: Type.Integer({ minimum: 1 }),
  description: NonEmpty,
  /** The ceiling every sensor program runs under, in milliseconds; the lesser of it and a program's own `timeoutMs` applies. */
  programTimeoutMs: Type.Integer({ minimum: 1000 }),
  sensors: Type.Array(SensorSchema),
}, { additionalProperties: false });
export type IntelligencePolicy = Static<typeof IntelligencePolicySchema>;

export function isIntelligencePolicy(value: unknown): value is IntelligencePolicy {
  return Value.Check(IntelligencePolicySchema, value);
}

/** The `affectedUnits` entry that holds a unit type: `type:<unitType>`. */
export function affectsUnitType(unitType: string): string {
  return `${AFFECTED_UNIT_TYPE_PREFIX}${unitType}`;
}

/** The unit type an `affectedUnits` entry names, or undefined when the entry is a unit id. */
export function affectedUnitType(entry: string): string | undefined {
  return entry.startsWith(AFFECTED_UNIT_TYPE_PREFIX) && entry.length > AFFECTED_UNIT_TYPE_PREFIX.length ? entry.slice(AFFECTED_UNIT_TYPE_PREFIX.length) : undefined;
}

/** Whether a signal's provenance is a sensor's. */
export function isSensorProvenance(provenance: string | undefined): boolean {
  return provenance !== undefined && provenance.startsWith(SENSOR_PROVENANCE_PREFIX) && provenance.length > SENSOR_PROVENANCE_PREFIX.length;
}
