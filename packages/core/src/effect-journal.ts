/**
 * The effect journal (lesson 08): durable execution for side-effecting tools.
 *
 * Before a tool acts on the world it writes `intended` under an idempotency
 * key; after, `committed`. A harness that dies in between leaves an
 * `intended` line with no `committed` one, and on restart `reconcile` asks
 * the world whether the effect happened — `confirmed` or `absent` — instead
 * of assuming either. A key that is already committed or confirmed is never
 * acted on again: the tool returns the recorded result.
 *
 * Append-only NDJSON under `.regulator/effects.ndjson`; the state of a key is
 * the fold of its lines.
 */
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { EffectJournalEntrySchema, assertValid, type EffectJournalEntry, type EffectStatus } from "@metacoding/vsm-pi-protocol";
import { EFFECTS_RELATIVE_PATH } from "./paths.js";

export interface EffectState {
  key: string;
  tool: string;
  description: string;
  unitId?: string;
  status: EffectStatus;
  intendedAt: string;
  result?: string;
}

/** A stable key for "this unit, this tool, these arguments": the same intention always keys the same. */
export function effectKey(unitId: string | undefined, tool: string, args: unknown): string {
  return createHash("sha256").update(JSON.stringify([unitId ?? null, tool, args])).digest("hex").slice(0, 24);
}

export class EffectJournal {
  readonly file: string;
  readonly #now: () => number;

  constructor(root: string, now: () => number = Date.now) {
    this.file = path.join(root, EFFECTS_RELATIVE_PATH);
    this.#now = now;
  }

  async entries(): Promise<EffectJournalEntry[]> {
    let text: string;
    try {
      text = await readFile(this.file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    return text.split("\n").filter(Boolean).map((line) => {
      const value: unknown = JSON.parse(line);
      assertValid(EffectJournalEntrySchema, value, "effect journal entry");
      return value;
    });
  }

  /** Every key's current state, in first-intended order. */
  async states(): Promise<EffectState[]> {
    const states = new Map<string, EffectState>();
    for (const entry of await this.entries()) {
      const current = states.get(entry.key);
      if (!current) {
        states.set(entry.key, {
          key: entry.key, tool: entry.tool, description: entry.description, status: entry.status, intendedAt: entry.at,
          ...(entry.unitId === undefined ? {} : { unitId: entry.unitId }), ...(entry.result === undefined ? {} : { result: entry.result }),
        });
      } else {
        current.status = entry.status;
        if (entry.result !== undefined) current.result = entry.result;
      }
    }
    return [...states.values()];
  }

  async state(key: string): Promise<EffectState | undefined> {
    return (await this.states()).find((s) => s.key === key);
  }

  async #append(entry: EffectJournalEntry): Promise<void> {
    assertValid(EffectJournalEntrySchema, entry, "effect journal entry");
    await mkdir(path.dirname(this.file), { recursive: true });
    await appendFile(this.file, `${JSON.stringify(entry)}\n`, "utf8");
  }

  /**
   * Declare the intention. Returns the prior state when the key was already
   * committed or confirmed (do not act again), or `intended` afresh otherwise.
   * A key still `intended` from a crashed run is re-declared, not refused:
   * reconciliation, not intention, decides what happened to it.
   */
  async begin(entry: { key: string; tool: string; description: string; unitId?: string }): Promise<{ proceed: boolean; prior?: EffectState }> {
    const prior = await this.state(entry.key);
    if (prior && (prior.status === "committed" || prior.status === "confirmed")) return { proceed: false, prior };
    await this.#append({ ...entry, status: "intended", at: new Date(this.#now()).toISOString() });
    return { proceed: true, ...(prior ? { prior } : {}) };
  }

  async commit(key: string, result: string): Promise<void> {
    const prior = await this.state(key);
    if (!prior) throw new Error(`no intention recorded for effect ${key}`);
    await this.#append({ key, tool: prior.tool, description: prior.description, status: "committed", at: new Date(this.#now()).toISOString(), result, ...(prior.unitId === undefined ? {} : { unitId: prior.unitId }) });
  }

  /** Intentions with no recorded outcome: what a crash between effect and record leaves behind. */
  async pending(): Promise<EffectState[]> {
    return (await this.states()).filter((s) => s.status === "intended");
  }

  /** Ask the world about each pending intention. `verify` returns true if the effect is observably done. */
  async reconcile(verify: (state: EffectState) => Promise<boolean>): Promise<EffectState[]> {
    const reconciled: EffectState[] = [];
    for (const state of await this.pending()) {
      const done = await verify(state);
      const status: EffectStatus = done ? "confirmed" : "absent";
      await this.#append({ key: state.key, tool: state.tool, description: state.description, status, at: new Date(this.#now()).toISOString(), ...(state.unitId === undefined ? {} : { unitId: state.unitId }) });
      reconciled.push({ ...state, status });
    }
    return reconciled;
  }
}
