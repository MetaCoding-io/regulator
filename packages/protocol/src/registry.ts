import { Type, type Static } from "typebox";
import { Value } from "typebox/value";
import { VsmSystemSchema } from "./vsm-systems.js";

/**
 * A regulator's identity card: what failure it absorbs, at which level of the
 * mechanism hierarchy, implemented where, evidenced by which tests, bounded
 * how, owned by whom, reviewed when. Closed: unknown fields are rejected so
 * that the record grows deliberately, lesson by lesson.
 */
const isoDate = Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" });
const oneOf = <T extends readonly string[]>(values: T) => Type.Union(values.map((v) => Type.Literal(v)));

export const MechanismLevelSchema = oneOf(["type", "deterministic-gate", "typed-tool", "model-judgment", "prompt"] as const);
export type MechanismLevel = Static<typeof MechanismLevelSchema>;

export const RegulatorRecordSchema = Type.Object(
  {
    id: Type.String({ pattern: "^reg\\.[a-z0-9-]+\\.[a-z0-9-]+\\.v\\d+$" }),
    name: Type.String({ minLength: 1 }),
    status: oneOf(["proposed", "active", "retired"] as const),
    vsmFunction: VsmSystemSchema,
    purpose: Type.String({ minLength: 1 }),
    absorbs: Type.Object(
      { failureClass: Type.String({ minLength: 1 }), description: Type.String({ minLength: 1 }) },
      { additionalProperties: false },
    ),
    mechanism: Type.Object(
      {
        level: MechanismLevelSchema,
        implementation: Type.String({ minLength: 1 }),
        enforcementPoints: Type.Array(Type.String({ minLength: 1 })),
      },
      { additionalProperties: false },
    ),
    authority: Type.Optional(
      Type.Object({ may: Type.Array(Type.String()), mayNot: Type.Array(Type.String()) }, { additionalProperties: false }),
    ),
    evidence: Type.Object(
      { tests: Type.Array(Type.String({ minLength: 1 })), lastVerifiedRevision: Type.Optional(Type.String()) },
      { additionalProperties: false },
    ),
    limitations: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    ownership: Type.Object(
      { owner: Type.String({ minLength: 1 }), introduced: isoDate, reviewBy: isoDate },
      { additionalProperties: false },
    ),
    retirement: Type.Optional(Type.Object({ condition: Type.String({ minLength: 1 }) }, { additionalProperties: false })),
    introducedIn: Type.Optional(Type.String({ pattern: "^M\\d{2}$" })),
  },
  { additionalProperties: false },
);
export type RegulatorRecord = Static<typeof RegulatorRecordSchema>;

export function isRegulatorRecord(value: unknown): value is RegulatorRecord {
  return Value.Check(RegulatorRecordSchema, value);
}
