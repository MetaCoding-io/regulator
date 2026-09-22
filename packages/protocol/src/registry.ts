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
export const MechanismLevelSchema = Type.Union([
  Type.Literal("type"), Type.Literal("deterministic-gate"), Type.Literal("typed-tool"), Type.Literal("model-judgment"), Type.Literal("prompt"),
]);
export type MechanismLevel = Static<typeof MechanismLevelSchema>;

export const RegulatorRecordSchema = Type.Object(
  {
    id: Type.String({ pattern: "^reg\\.[a-z0-9-]+\\.[a-z0-9-]+\\.v\\d+$" }),
    name: Type.String({ minLength: 1 }),
    status: Type.Union([Type.Literal("proposed"), Type.Literal("active"), Type.Literal("retired")]),
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
    /** Lesson 05: what the regulator consumes and emits, by message kind or channel. */
    channels: Type.Optional(
      Type.Object({ consumes: Type.Array(Type.String({ minLength: 1 })), emits: Type.Array(Type.String({ minLength: 1 })) }, { additionalProperties: false }),
    ),
    /** Lesson 05: what the regulator coordinates — the subjects it applies to and the resources it claims. */
    scope: Type.Optional(
      Type.Object({ subjects: Type.Array(Type.String({ minLength: 1 })), resources: Type.Array(Type.String({ minLength: 1 })) }, { additionalProperties: false }),
    ),
    /** Lesson 07: what the regulator costs to run, stated so it can be weighed against what it absorbs. */
    cost: Type.Optional(
      Type.Object({ description: Type.String({ minLength: 1 }), measured: Type.Optional(Type.String({ minLength: 1 })) }, { additionalProperties: false }),
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
