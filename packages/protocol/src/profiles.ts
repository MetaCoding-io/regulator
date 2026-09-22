/**
 * A capability profile is a positive grant: what a kind of work may reach.
 * It binds a tool surface, the paths the work may write, a reasoning budget,
 * and the advice the model should carry — the part no gate can enforce.
 * A persona says who the agent is; a profile says what it can reach.
 */
export type ReasoningLevel = "minimal" | "low" | "medium" | "high";

export interface CapabilityProfile {
  name: string;
  description: string;
  /** Tools this profile may use. Names unknown to the host are ignored when applied. */
  tools: readonly string[];
  /** Project-relative prefixes the profile may write under. Empty means no direct writes. */
  writablePaths: readonly string[];
  thinkingLevel?: ReasoningLevel;
  /** Advice for the model: only what a gate cannot know. */
  advice: readonly string[];
}
