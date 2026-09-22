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
}, { additionalProperties: false });
export type MemoryEntry = Static<typeof MemoryEntrySchema>;

export const MemoryEventSchema = Type.Union([
  Type.Object({ type: Type.Literal("memory-recorded"), entry: MemoryEntrySchema }, { additionalProperties: false }),
  Type.Object({ type: Type.Literal("memory-retracted"), id: NonEmpty, memoryId: NonEmpty, by: NonEmpty, at: NonEmpty, reason: NonEmpty }, { additionalProperties: false }),
]);
export type MemoryEvent = Static<typeof MemoryEventSchema>;

export function isMemoryEvent(value: unknown): value is MemoryEvent {
  return Value.Check(MemoryEventSchema, value);
}
