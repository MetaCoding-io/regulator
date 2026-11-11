/**
 * Operational memory (lesson 12): what the system has learned about its
 * environment — *tests need FOO=1*, *the CI runner lacks Docker*. Durable,
 * S3's, agent-writable, and deliberately not identity: every entry carries
 * who recorded it, from which unit at which revision, and a review-by date
 * after which it is stale and no longer rendered. A retraction is a later
 * event, never an edit. Nothing here can reach an identity file.
 */
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";
import { EvidenceRefSchema } from "./evidence.js";

const NonEmpty = Type.String({ minLength: 1 });

export const MemoryEntrySchema = Type.Object({
  id: NonEmpty,
  subject: NonEmpty,
  /** The fact, as a sentence a future unit can act on. */
  note: NonEmpty,
  evidence: Type.Array(EvidenceRefSchema),
  /** The unit that recorded it, when a unit did. */
  unit: Type.Optional(NonEmpty),
  /** The revision of the repository the fact was observed at. */
  revision: Type.Optional(NonEmpty),
  /** Who recorded it: "S1" for a unit's tool call, or a person's name. */
  recordedBy: NonEmpty,
  recordedAt: NonEmpty,
  /** After this date the entry is stale: not rendered, shown as expired. */
  reviewBy: NonEmpty,
  /** Unit types the fact is rendered to (lesson 15); absent or empty means every unit of the instance. */
  scope: Type.Optional(Type.Array(NonEmpty)),
}, { additionalProperties: false });
export type MemoryEntry = Static<typeof MemoryEntrySchema>;

export const MemoryEventSchema = Type.Union([
  Type.Object({ type: Type.Literal("memory-recorded"), entry: MemoryEntrySchema }, { additionalProperties: false }),
  Type.Object({ type: Type.Literal("memory-retracted"), id: NonEmpty, memoryId: NonEmpty, by: NonEmpty, at: NonEmpty, reason: NonEmpty }, { additionalProperties: false }),
]);
export type MemoryEvent = Static<typeof MemoryEventSchema>;

/**
 * A memory seed (#130): one entry a fixture carries into a fresh instance's store, in a `memory.seed.json` beside the
 * fixture's files. It holds what a unit would have supplied and no dates: the fixture step records it through the
 * store at the fixture commit's revision, with `reviewBy` that many days after the copy, so a seeded fact is under the
 * same expiry rule as one a unit remembered and a committed fixture never goes stale on the shelf.
 */
export const MemorySeedSchema = Type.Object({
  subject: NonEmpty,
  note: NonEmpty,
  evidence: Type.Array(EvidenceRefSchema),
  unit: Type.Optional(NonEmpty),
  recordedBy: NonEmpty,
  /** Days from the copy to the review-by date; the store refuses more than its maximum. */
  reviewInDays: Type.Integer({ minimum: 1 }),
  scope: Type.Optional(Type.Array(NonEmpty)),
}, { additionalProperties: false });
export type MemorySeed = Static<typeof MemorySeedSchema>;

export function isMemoryEvent(value: unknown): value is MemoryEvent {
  return Value.Check(MemoryEventSchema, value);
}
