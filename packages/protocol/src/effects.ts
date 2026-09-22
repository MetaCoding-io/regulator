import { Type, type Static } from "typebox";

/**
 * A tool's *schema* says what the model may ask for. Its *effect* says what
 * happens in the world when it runs. The two are independent: a one-string
 * schema can run the whole project. Profiles and authority reason about
 * effects, not schemas.
 */
export const ToolEffectSchema = Type.Object(
  {
    filesystem: Type.Union([Type.Literal("none"), Type.Literal("read"), Type.Literal("write")]),
    /** What code runs: nothing beyond the tool itself, the project's own code, or anything at all. */
    execution: Type.Union([Type.Literal("none"), Type.Literal("project-code"), Type.Literal("arbitrary")]),
    network: Type.Union([Type.Literal("none"), Type.Literal("unknown"), Type.Literal("open")]),
    sideEffects: Type.Union([Type.Literal("none"), Type.Literal("reversible"), Type.Literal("irreversible"), Type.Literal("unknown")]),
  },
  { additionalProperties: false },
);
export type ToolEffect = Static<typeof ToolEffectSchema>;
