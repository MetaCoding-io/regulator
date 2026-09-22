/**
 * The operational memory store (lesson 12): `.regulator/memory.ndjson`,
 * append-only. S3's, not S5's: what units have learned about the environment,
 * each entry with provenance and a review-by date. Current entries are
 * rendered into a unit's context; expired ones are shown by the read model
 * and rendered to nobody. A retraction is an appended event.
 */
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { MemoryEventSchema, assertValid, type MemoryEntry, type MemoryEvent } from "@metacoding/vsm-pi-protocol";
import { MEMORY_RELATIVE_PATH } from "./paths.js";

export interface MemoryState extends MemoryEntry {
  status: "current" | "expired" | "retracted";
  retraction?: { by: string; at: string; reason: string };
}

export interface RecordMemoryInput {
  subject: string;
  note: string;
  evidence: MemoryEntry["evidence"];
  unit?: string;
  revision?: string;
  recordedBy: string;
  /** ISO date; must be in the future and within `maxReviewDays`. */
  reviewBy: string;
}

export class MemoryStore {
  readonly file: string;
  readonly #now: () => number;
  readonly maxReviewDays: number;

  constructor(root: string, now: () => number = Date.now, options: { maxReviewDays?: number } = {}) {
    this.file = path.join(root, MEMORY_RELATIVE_PATH);
    this.#now = now;
    this.maxReviewDays = options.maxReviewDays ?? 90;
  }

  async #append(event: MemoryEvent): Promise<void> {
    assertValid(MemoryEventSchema, event, "memory event");
    await mkdir(path.dirname(this.file), { recursive: true });
    await appendFile(this.file, `${JSON.stringify(event)}\n`, "utf8");
  }

  async events(): Promise<MemoryEvent[]> {
    let text: string;
    try {
      text = await readFile(this.file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    return text.split("\n").filter(Boolean).map((line) => {
      const value: unknown = JSON.parse(line);
      assertValid(MemoryEventSchema, value, "memory event");
      return value;
    });
  }

  /** Record a fact. A review-by date in the past, or further out than the store allows, is refused: memory without an expiry is policy in disguise. */
  async record(input: RecordMemoryInput): Promise<MemoryEntry> {
    const now = this.#now();
    const reviewBy = Date.parse(input.reviewBy);
    if (Number.isNaN(reviewBy)) throw new Error(`reviewBy "${input.reviewBy}" is not a date`);
    if (reviewBy <= now) throw new Error(`reviewBy ${input.reviewBy} is not in the future; a fact that is already stale is not worth remembering`);
    const limit = now + this.maxReviewDays * 86_400_000;
    if (reviewBy > limit) throw new Error(`reviewBy ${input.reviewBy} is more than ${this.maxReviewDays} days out; operational memory is reviewed, not permanent — identity is proposed, not remembered`);
    const entry: MemoryEntry = {
      id: randomUUID(), subject: input.subject, note: input.note, evidence: input.evidence,
      ...(input.unit === undefined ? {} : { unit: input.unit }), ...(input.revision === undefined ? {} : { revision: input.revision }),
      recordedBy: input.recordedBy, recordedAt: new Date(now).toISOString(), reviewBy: new Date(reviewBy).toISOString(),
    };
    await this.#append({ type: "memory-recorded", entry });
    return entry;
  }

  async retract(memoryId: string, by: string, reason: string): Promise<void> {
    const state = (await this.states()).find((s) => s.id === memoryId);
    if (!state) throw new Error(`no memory entry "${memoryId}"`);
    if (state.status === "retracted") throw new Error(`memory entry ${memoryId} is already retracted`);
    await this.#append({ type: "memory-retracted", id: randomUUID(), memoryId, by, at: new Date(this.#now()).toISOString(), reason });
  }

  async states(): Promise<MemoryState[]> {
    const now = this.#now();
    const states = new Map<string, MemoryState>();
    for (const event of await this.events()) {
      if (event.type === "memory-recorded") {
        states.set(event.entry.id, { ...event.entry, status: Date.parse(event.entry.reviewBy) > now ? "current" : "expired" });
      } else {
        const state = states.get(event.memoryId);
        if (!state) throw new Error(`corrupt memory store: retraction of unknown entry ${event.memoryId}`);
        state.status = "retracted";
        state.retraction = { by: event.by, at: event.at, reason: event.reason };
      }
    }
    return [...states.values()];
  }

  async current(): Promise<MemoryState[]> {
    return (await this.states()).filter((s) => s.status === "current");
  }
}

/** Memory as the model sees it: facts with their expiry, never as instructions and never as identity. */
export function renderMemorySection(entries: readonly MemoryState[]): string {
  if (!entries.length) return "Operational memory (S3): nothing current. Record what you learn about this environment with `remember`; each fact expires and is reviewed.";
  const lines = ["Operational memory (S3): what earlier units learned about this environment. Facts, not rules — each expires on its review-by date. Not identity; a fact that turns out to be policy is proposed, not remembered."];
  for (const e of entries) lines.push(`- ${e.subject}: ${e.note} (recorded ${e.recordedAt.slice(0, 10)} by ${e.recordedBy}${e.unit ? ` in unit ${e.unit}` : ""}; review by ${e.reviewBy.slice(0, 10)})`);
  return lines.join("\n");
}
