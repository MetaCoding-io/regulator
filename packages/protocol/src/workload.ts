/**
 * A workload definition: the part of the control-plane definition that says
 * what kinds of unit exist and what each may use. The orchestrator loop is
 * generic; everything workload-specific is declared here. The software-
 * development autoloop is the first one (lesson 06); a second workload is a
 * second file, not a fork of the loop.
 */
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";

const NonEmpty = Type.String({ minLength: 1 });

/** The host-run checks a unit type may name (lesson 09; `identity-untouched` since lesson 12). */
export const HOST_CHECK_NAMES = ["run_tests", "run_checks", "identity-untouched"] as const;

export const UnitTypeSchema = Type.Object({
  name: Type.String({ pattern: "^[a-z][a-z0-9-]*$" }),
  description: NonEmpty,
  /** The capability profile a unit of this type is dispatched under (lesson 04). */
  profile: NonEmpty,
  /** Names of harness-run checks that verify a unit of this type (consumed from lesson 09). */
  checks: Type.Array(NonEmpty),
  /** Whether a unit of this type may be dispatched without a work contract. */
  requiresContract: Type.Boolean(),
}, { additionalProperties: false });
export type UnitType = Static<typeof UnitTypeSchema>;

export const WorkloadDefinitionSchema = Type.Object({
  name: Type.String({ pattern: "^[a-z][a-z0-9-]*$" }),
  version: Type.Integer({ minimum: 1 }),
  description: NonEmpty,
  unitTypes: Type.Array(UnitTypeSchema, { minItems: 1 }),
}, { additionalProperties: false });
export type WorkloadDefinition = Static<typeof WorkloadDefinitionSchema>;

export function isWorkloadDefinition(value: unknown): value is WorkloadDefinition {
  return Value.Check(WorkloadDefinitionSchema, value);
}
