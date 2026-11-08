/**
 * The behavioral canary: an absence canary over the model's own replies.
 *
 * The identity set is rendered into every unit's prompt from the files, so a
 * rule in it cannot be lost to compaction. Whether the model is still
 * *following* the rules it was given is a different question, and one the host
 * can observe cheaply: the budget policy declares a short marker every reply
 * must begin with, the identity extension renders that rule beside the
 * identity, and this class reads each reply for it. A reply without the marker
 * is a miss; a run of misses is the signal. The idea is the warrant canary: a
 * statement re-asserted every period, whose silence says something upstream
 * has changed. Here, upstream is the model's attention to small rules, which
 * degrades before its attention to large ones does.
 *
 * It decides nothing. The identity extension records the finding (S3* → S3)
 * and S3 decides what a degraded session is worth. The credential canary
 * (`authority.ts`) is the other polarity: a value whose *presence* is the alarm.
 */

export interface BehavioralCanaryPolicy {
  /** What every reply must begin with. `{unit}` is replaced by the unit id, so the marker is the instance's and not one a model could have learned. */
  marker: string;
  /** Consecutive replies without the marker before a finding is recorded. */
  misses: number;
}

export const CANARY_UNIT_PLACEHOLDER = "{unit}";

/** The marker for one session: the policy's template with the unit id substituted (`no-unit` outside a unit). */
export function canaryMarker(template: string, unitId: string | undefined): string {
  return template.replaceAll(CANARY_UNIT_PLACEHOLDER, unitId || "no-unit");
}

/** The rule as the model sees it: one short section, rendered on every run beside the identity and never cut with it. */
export function renderCanarySection(marker: string): string {
  return [
    `Begin every reply with \`${marker}\` as its first characters, before any other text.`,
    "This is a behavioral canary (S3*): the host reads each reply for it and records when it goes missing. It carries no meaning, needs no explanation, and is not repeated elsewhere in the reply.",
  ].join(" ");
}

export interface CanaryObservation {
  /** The reply began with the marker. */
  hit: boolean;
  /** Replies without the marker since the last hit, this one included. */
  consecutiveMisses: number;
  /** The run of misses reached the policy's count (or a multiple of it while the silence lasts): record a finding. */
  signal: boolean;
}

/**
 * Reads assistant replies for the marker and counts the silence. One instance
 * per session: the count is the session's, as the thrash detector's is.
 */
export class BehavioralCanary {
  readonly marker: string;
  readonly misses: number;
  #consecutiveMisses = 0;
  #seen = 0;
  #hits = 0;

  constructor(marker: string, misses: number) {
    if (!marker.trim()) throw new Error("a behavioral canary needs a marker: an empty string is always present");
    if (!Number.isInteger(misses) || misses < 1) throw new Error("misses must be a positive integer: the first reply without the marker is at least one miss");
    this.marker = marker;
    this.misses = misses;
  }

  /**
   * One assistant reply's text. A reply with no text (tool calls only) is not a
   * reply the rule covers and is not counted either way: `undefined`.
   */
  observe(text: string): CanaryObservation | undefined {
    if (!text.trim()) return undefined;
    this.#seen++;
    if (text.trimStart().startsWith(this.marker)) {
      this.#hits++;
      this.#consecutiveMisses = 0;
      return { hit: true, consecutiveMisses: 0, signal: false };
    }
    this.#consecutiveMisses++;
    return { hit: false, consecutiveMisses: this.#consecutiveMisses, signal: this.#consecutiveMisses % this.misses === 0 };
  }

  /** Replies read, and how many carried the marker. */
  counts(): { seen: number; hits: number; consecutiveMisses: number } {
    return { seen: this.#seen, hits: this.#hits, consecutiveMisses: this.#consecutiveMisses };
  }
}
