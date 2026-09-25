import { lstatSync, mkdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { assertValid, RegulatoryReceiptSchema, type RegulatoryEvent, type RegulatoryReceipt } from "@metacoding.io/regulator-protocol";
import { assertRegulatoryEvent } from "./reporting.js";

/** Lesson 15: the reporting tools' event store lives with the instance's other records, under `.regulator/`. */
export const VSM_DATABASE_RELATIVE_PATH = ".regulator/events.db";
export interface StoredRegulatoryEvent {
  sequence: number;
  event: RegulatoryEvent;
  receipt: RegulatoryReceipt;
}

function inspectPath(filename: string) {
  try { return lstatSync(filename); } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

/** Fixed runtime path: never accepts an arbitrary database filename. */
function databasePath(projectRoot: string): string {
  if (!path.isAbsolute(projectRoot)) throw new Error("VSM event store requires an absolute project root.");
  let directory = realpathSync(projectRoot);
  for (const component of [".regulator"]) {
    directory = path.join(directory, component);
    mkdirSync(directory, { recursive: true });
    const info = lstatSync(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("VSM runtime directories must not be aliases.");
  }
  const filename = path.join(directory, "events.db");
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const info = inspectPath(filename + suffix);
    if (info && (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1)) {
      throw new Error("VSM database and sidecars must be regular, unaliased files.");
    }
  }
  return filename;
}

/** Stable key order, JSON-safe values already constrained by the event schemas. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  const result = JSON.stringify(value);
  if (result === undefined) throw new Error("Event must contain JSON values.");
  return result;
}

function receiptFor(event: RegulatoryEvent, sequence: number): RegulatoryReceipt {
  const receipt = {
    status: "persisted", eventId: event.message.id, sequence,
    timestamp: event.message.timestamp, kind: event.message.kind, channel: event.message.channel,
  };
  assertValid(RegulatoryReceiptSchema, receipt, "regulatory receipt");
  return receipt;
}

/** Append/replay only. SQLite is the single event history; no GSD workflow state. */
export class RegulatoryEventStore {
  readonly path: string;
  private readonly db: DatabaseSync;

  constructor(projectRoot: string) {
    this.path = databasePath(projectRoot);
    this.db = new DatabaseSync(this.path);
    try {
      this.db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;");
      this.db.exec("BEGIN IMMEDIATE");
      const version = this.db.prepare("PRAGMA user_version").get()?.user_version;
      if (version !== 0 && version !== 1) throw new Error("Unsupported VSM event store schema version.");
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS regulatory_events (
          sequence INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id TEXT NOT NULL UNIQUE,
          timestamp TEXT NOT NULL,
          kind TEXT NOT NULL,
          channel TEXT NOT NULL,
          source TEXT NOT NULL,
          destination TEXT NOT NULL,
          subject TEXT NOT NULL,
          event_json TEXT NOT NULL CHECK(json_valid(event_json))
        );
        CREATE TRIGGER IF NOT EXISTS regulatory_events_no_update
          BEFORE UPDATE ON regulatory_events BEGIN SELECT RAISE(ABORT, 'regulatory events are append-only'); END;
        CREATE TRIGGER IF NOT EXISTS regulatory_events_no_delete
          BEFORE DELETE ON regulatory_events BEGIN SELECT RAISE(ABORT, 'regulatory events are append-only'); END;
        PRAGMA user_version = 1;
        COMMIT;
      `);
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  append(event: RegulatoryEvent): RegulatoryReceipt {
    assertRegulatoryEvent(event);
    const json = canonicalJson(event);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const { message } = event;
      const result = this.db.prepare(`
        INSERT INTO regulatory_events (event_id, timestamp, kind, channel, source, destination, subject, event_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(message.id, message.timestamp, message.kind, message.channel, message.source, message.destination, message.subject, json);
      const receipt = receiptFor(event, Number(result.lastInsertRowid));
      this.db.exec("COMMIT");
      return receipt;
    } catch (error) {
      // Some SQLite failures already roll back the transaction. Preserve the
      // original persistence error rather than replacing it with a rollback error.
      try { this.db.exec("ROLLBACK"); } catch {}
      throw error;
    }
  }

  readAll(): StoredRegulatoryEvent[] {
    return this.db.prepare("SELECT sequence, event_json FROM regulatory_events ORDER BY sequence ASC").all().map((row) => {
      if (typeof row.event_json !== "string" || typeof row.sequence !== "number") throw new Error("Invalid VSM event row.");
      const event: unknown = JSON.parse(row.event_json);
      assertRegulatoryEvent(event);
      return { sequence: row.sequence, event, receipt: receiptFor(event, row.sequence) };
    });
  }

  close(): void { this.db.close(); }
}
