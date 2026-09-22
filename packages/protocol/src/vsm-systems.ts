import { Type, type Static } from "typebox";

/**
 * VSM functions are control-system responsibilities, not persona names.
 * Agents may participate in a function without becoming the authority for it.
 */
export const VsmSystemSchema = Type.Union([
  Type.Literal("S1"),
  Type.Literal("S2"),
  Type.Literal("S3"),
  Type.Literal("S3*"),
  Type.Literal("S4"),
  Type.Literal("S5"),
]);
export type VsmSystem = Static<typeof VsmSystemSchema>;
