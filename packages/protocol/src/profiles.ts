/**
 * A capability profile is a positive grant: what a kind of work may reach.
 * It binds a tool surface, the paths the work may write and a reasoning
 * budget. The advice the model should carry — the part no gate can enforce —
 * is a file of its own beside the profile (`advice/<profile>.md`, the
 * accept-path split, #110), so a command may write advice without being able
 * to write a grant. A persona says who the agent is; a profile says what it
 * can reach.
 *
 * Since lesson 12 a profile is a declared part of the definition — a file
 * under `profiles/`, validated on load — not a constant in code.
 */
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";

export const ReasoningLevelSchema = Type.Union([Type.Literal("minimal"), Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]);
export type ReasoningLevel = Static<typeof ReasoningLevelSchema>;

/**
 * A consent grant (#60): a call of the named tool must be preceded by an answered `ask_human` of kind `consent`
 * whose recorded call matches it, or the host's interception refuses the call. A declaration, not an inference:
 * nothing derives "needs consent" from a tool's effects. A bare entry guards every call of the tool; `paths`
 * narrows `write` and `edit` to project-relative prefixes; `pattern` is a regular expression over the `command`
 * of an arbitrary-execution tool (`bash`), which no path gates.
 */
export const ConsentGrantSchema = Type.Object({
  tool: Type.String({ minLength: 1 }),
  /** For write and edit: the prefixes under which a call needs consent. */
  paths: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { minItems: 1 })),
  /** For bash: a regular expression; a command it matches needs consent. */
  pattern: Type.Optional(Type.String({ minLength: 1 })),
}, { additionalProperties: false });
export type ConsentGrant = Static<typeof ConsentGrantSchema>;

export const CapabilityProfileSchema = Type.Object({
  name: Type.String({ pattern: "^[a-z][a-z0-9-]*$" }),
  description: Type.String({ minLength: 1 }),
  /** Tools this profile may use. Names unknown to the host are ignored when applied. */
  tools: Type.Array(Type.String({ minLength: 1 })),
  /** Project-relative prefixes the profile may write under. Empty means no direct writes. */
  writablePaths: Type.Array(Type.String({ minLength: 1 })),
  thinkingLevel: Type.Optional(ReasoningLevelSchema),
  /**
   * Advice for the model, inline: only what a gate cannot know. Optional for one release (#110): advice lives in
   * `advice/<profile>.md`, and the definition check refuses a profile that carries both the field and the file.
   */
  advice: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
  /** The calls that need a person's recorded yes before they run (#60). Absent or empty: none. */
  consent: Type.Optional(Type.Array(ConsentGrantSchema)),
}, { additionalProperties: false });
export type CapabilityProfile = Static<typeof CapabilityProfileSchema>;

export function isCapabilityProfile(value: unknown): value is CapabilityProfile {
  return Value.Check(CapabilityProfileSchema, value);
}
