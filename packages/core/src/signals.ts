/**
 * The regulatory log: typed messages an instance has recorded, and — since
 * lesson 11 — the routing events that say what became of each one. One
 * append-only NDJSON file under `.regulator/`; every line is validated
 * against the protocol on the way in and on the way out. Lesson 08's router
 * reads the messages; lesson 11's obligation ledger folds the events.
 */
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { RegulatoryEntrySchema, assertValid, type RegulatoryEntry, type VsmMessage } from "@metacoding/regulator-protocol";
import { SIGNALS_RELATIVE_PATH } from "./paths.js";

export function isMessage(entry: RegulatoryEntry): entry is VsmMessage {
  return "kind" in entry;
}

export async function appendEntry(root: string, entry: RegulatoryEntry): Promise<void> {
  assertValid(RegulatoryEntrySchema, entry, "regulatory entry");
  const file = path.join(root, SIGNALS_RELATIVE_PATH);
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(entry)}\n`, "utf8");
}

export async function appendSignal(root: string, message: VsmMessage): Promise<void> {
  await appendEntry(root, message);
}

export async function readEntries(root: string): Promise<RegulatoryEntry[]> {
  let text: string;
  try {
    text = await readFile(path.join(root, SIGNALS_RELATIVE_PATH), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return text.split("\n").filter(Boolean).map((line) => {
    const value: unknown = JSON.parse(line);
    assertValid(RegulatoryEntrySchema, value, "regulatory entry");
    return value;
  });
}

/** Every message the log holds, routed or not. */
export async function readSignals(root: string): Promise<VsmMessage[]> {
  return (await readEntries(root)).filter(isMessage);
}
