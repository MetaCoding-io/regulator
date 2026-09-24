/**
 * The audit log (lesson 09): S3*'s regulatory state, append-only.
 *
 * Evidence records, technical verdicts and human acceptances, one JSON line
 * each under `.regulator/audit.ndjson`. Nothing here is execution state: the
 * orchestrator reads the verdict to decide whether a unit may close, and the
 * log is what a reviewer replays to see why. Lines are schema-checked on
 * write and on read; a line that does not validate is a corrupt log, not a
 * skipped entry.
 */
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  AuditEntrySchema, assertValid, type AuditEntry, type EvidenceRecord, type HumanAcceptance, type TechnicalVerdict,
} from "@metacoding/regulator-protocol";
import { AUDIT_RELATIVE_PATH } from "./paths.js";

export interface UnitAudit {
  evidence: EvidenceRecord[];
  verdicts: TechnicalVerdict[];
  acceptances: HumanAcceptance[];
}

export class AuditLog {
  readonly file: string;

  constructor(root: string) {
    this.file = path.join(root, AUDIT_RELATIVE_PATH);
  }

  async #append(entry: AuditEntry): Promise<void> {
    assertValid(AuditEntrySchema, entry, "audit entry");
    await mkdir(path.dirname(this.file), { recursive: true });
    await appendFile(this.file, `${JSON.stringify(entry)}\n`, "utf8");
  }

  async appendEvidence(record: EvidenceRecord): Promise<void> {
    await this.#append({ type: "evidence", record });
  }

  async appendVerdict(verdict: TechnicalVerdict): Promise<void> {
    await this.#append({ type: "verdict", verdict });
  }

  async appendAcceptance(acceptance: HumanAcceptance): Promise<void> {
    await this.#append({ type: "acceptance", acceptance });
  }

  async entries(): Promise<AuditEntry[]> {
    let text: string;
    try {
      text = await readFile(this.file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    return text.split("\n").filter(Boolean).map((line) => {
      const value: unknown = JSON.parse(line);
      assertValid(AuditEntrySchema, value, "audit entry");
      return value;
    });
  }

  /** Replay: everything the log holds about one unit, in the order it was recorded. */
  async forUnit(unitId: string): Promise<UnitAudit> {
    const audit: UnitAudit = { evidence: [], verdicts: [], acceptances: [] };
    for (const entry of await this.entries()) {
      if (entry.type === "evidence" && entry.record.unitId === unitId) audit.evidence.push(entry.record);
      else if (entry.type === "verdict" && entry.verdict.unitId === unitId) audit.verdicts.push(entry.verdict);
      else if (entry.type === "acceptance" && entry.acceptance.unitId === unitId) audit.acceptances.push(entry.acceptance);
    }
    return audit;
  }
}
