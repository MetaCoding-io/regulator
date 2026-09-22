/**
 * A capability profile is a positive grant: what a kind of work may reach.
 * It binds a tool surface, the paths the work may write, a reasoning budget,
 * and the advice the model should carry — the part no gate can enforce.
 * A persona says who the agent is; a profile says what it can reach.
 *
 * Since lesson 12 a profile is a declared part of the definition — a file
 * under `profiles/`, validated on load — not a constant in code.
 */
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";

export const ReasoningLevelSchema = Type.Union([Type.Literal("minimal"), Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]);
export type ReasoningLevel = Static<typeof ReasoningLevelSchema>;

export const CapabilityProfileSchema = Type.Object({
  name: Type.String({ pattern: "^[a-z][a-z0-9-]*$" }),
  description: Type.String({ minLength: 1 }),
  /** Tools this profile may use. Names unknown to the host are ignored when applied. */
  tools: Type.Array(Type.String({ minLength: 1 })),
  /** Project-relative prefixes the profile may write under. Empty means no direct writes. */
  writablePaths: Type.Array(Type.String({ minLength: 1 })),
  thinkingLevel: Type.Optional(ReasoningLevelSchema),
  /** Advice for the model: only what a gate cannot know. */
  advice: Type.Array(Type.String({ minLength: 1 })),
}, { additionalProperties: false });
export type CapabilityProfile = Static<typeof CapabilityProfileSchema>;

export function isCapabilityProfile(value: unknown): value is CapabilityProfile {
  return Value.Check(CapabilityProfileSchema, value);
}
