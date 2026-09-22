import { Type, type Static } from "typebox";

export const EvidenceClassSchema = Type.Union([
  Type.Literal("file"),
  Type.Literal("command"),
  Type.Literal("test"),
  Type.Literal("runtime"),
  Type.Literal("semantic"),
  Type.Literal("model"),
]);
export type EvidenceClass = Static<typeof EvidenceClassSchema>;

export const EvidenceRefSchema = Type.Object({
  class: EvidenceClassSchema,
  ref: Type.String({ minLength: 1 }),
  observation: Type.Optional(Type.String()),
  sourceRevision: Type.Optional(Type.String()),
}, { additionalProperties: false });
export type EvidenceRef = Static<typeof EvidenceRefSchema>;
