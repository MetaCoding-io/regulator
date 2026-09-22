/**
 * Policies: the part of the control-plane definition that says how much a
 * unit may spend and which model it runs on (lesson 07). Budgets belong to
 * S3 — a controller without a budget is not controlling anything — and they
 * are declared here, per unit type, not coded into the loop or left to the
 * model's judgement.
 */
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";

const NonEmpty = Type.String({ minLength: 1 });

/** Ceilings for one attempt of one unit, plus how many attempts the unit may have. */
export const BudgetCeilingSchema = Type.Object({
  /** Total tokens (input + output + cache) an attempt may consume. */
  tokens: Type.Integer({ minimum: 1 }),
  /** Provider-reported cost, in the provider's currency, an attempt may consume. */
  cost: Type.Optional(Type.Number({ minimum: 0 })),
  /** Wall-clock from session start, in milliseconds. */
  wallClockMs: Type.Integer({ minimum: 1 }),
  /** Assistant turns an attempt may take. */
  turns: Type.Integer({ minimum: 1 }),
  /** Attempts a unit may have before S3 must decide something else. */
  attempts: Type.Integer({ minimum: 1 }),
}, { additionalProperties: false });
export type BudgetCeiling = Static<typeof BudgetCeilingSchema>;

const ModelRef = Type.String({ pattern: "^[a-z0-9-]+/[^/\\s]+$", description: "provider/modelId" });

/** The model a unit type runs on, and what to fall back to when it is unavailable. */
export const ModelRouteSchema = Type.Object({
  primary: ModelRef,
  fallback: Type.Array(ModelRef),
}, { additionalProperties: false });
export type ModelRoute = Static<typeof ModelRouteSchema>;

export const PolicyDefinitionSchema = Type.Object({
  name: Type.String({ pattern: "^[a-z][a-z0-9-]*$" }),
  version: Type.Integer({ minimum: 1 }),
  description: NonEmpty,
  budgets: Type.Object({
    default: BudgetCeilingSchema,
    /** Per unit type; each field overrides the default's. */
    byUnitType: Type.Optional(Type.Record(Type.String(), Type.Partial(BudgetCeilingSchema))),
  }, { additionalProperties: false }),
  models: Type.Object({
    default: ModelRouteSchema,
    byUnitType: Type.Optional(Type.Record(Type.String(), ModelRouteSchema)),
  }, { additionalProperties: false }),
  /** S2's declared numbers (lesson 12): what counts as oscillation. */
  coordination: Type.Optional(Type.Object({
    /** Edits to one file within one unit before the thrash detector signals. */
    oscillationThreshold: Type.Integer({ minimum: 2 }),
  }, { additionalProperties: false })),
}, { additionalProperties: false });
export type PolicyDefinition = Static<typeof PolicyDefinitionSchema>;

export function isPolicyDefinition(value: unknown): value is PolicyDefinition {
  return Value.Check(PolicyDefinitionSchema, value);
}
