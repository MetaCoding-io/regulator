/**
 * The orchestrator's execution store (lesson 06). Files under
 * `<root>/.regulator/units/<unitId>/`, one directory per unit:
 *
 *   unit.json              the unit record (status, attempts) — the only mutable file
 *   contract.v<N>.json     the contract version that governs execution; never overwritten
 *   report.v<N>.json       the result report against that version; never overwritten
 *   attempts.ndjson        one immutable record per attempt
 *   budget.a<N>.json       the running ledger of attempt N (a counter: rewritten, never merged)
 *
 * Nothing here is regulatory state and nothing is inferred from the domain
 * (the repository): the orchestrator knows what it dispatched because it
 * wrote it down, not because it looked at the diff.
 */
import { mkdir, readdir, readFile, appendFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AttemptRecordSchema, BudgetLedgerSchema, ResultReportSchema, UnitRecordSchema, WorkContractSchema, assertValid,
  type AttemptRecord, type BudgetLedger, type ResultReport, type UnitRecord, type UnitStatus, type WorkContract,
} from "@metacoding/vsm-pi-protocol";
import { UNITS_RELATIVE_DIR } from "./paths.js";

function assertUnitId(unitId: string): void {
  if (!/^[a-zA-Z0-9._-]+$/.test(unitId)) throw new Error(`invalid unit id: ${JSON.stringify(unitId)}`);
}

async function writeNew(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  // `wx`: fail if the file exists. Contract and report versions are immutable.
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}

export class ExecutionStore {
  readonly dir: string;
  readonly #now: () => number;

  constructor(root: string, now: () => number = Date.now) {
    this.dir = path.join(root, UNITS_RELATIVE_DIR);
    this.#now = now;
  }

  #unitDir(unitId: string): string {
    assertUnitId(unitId);
    return path.join(this.dir, unitId);
  }

  #stamp(): string {
    return new Date(this.#now()).toISOString();
  }

  /** Record a new unit under its governing contract. Refuses if the unit or the contract version exists. */
  async createUnit(contract: WorkContract): Promise<UnitRecord> {
    assertValid(WorkContractSchema, contract, "work contract");
    const dir = this.#unitDir(contract.unitId);
    if (await this.getUnit(contract.unitId)) throw new Error(`unit "${contract.unitId}" already exists`);
    await writeNew(path.join(dir, `contract.v${contract.version}.json`), contract);
    const record: UnitRecord = {
      unitId: contract.unitId,
      unitType: contract.unitType,
      workload: contract.workload,
      contract: { id: contract.id, version: contract.version },
      status: "contracted",
      attempts: 0,
      createdAt: this.#stamp(),
      updatedAt: this.#stamp(),
    };
    await writeFile(path.join(dir, "unit.json"), `${JSON.stringify(record, null, 2)}\n`, "utf8");
    return record;
  }

  async getUnit(unitId: string): Promise<UnitRecord | undefined> {
    try {
      const value: unknown = JSON.parse(await readFile(path.join(this.#unitDir(unitId), "unit.json"), "utf8"));
      assertValid(UnitRecordSchema, value, "unit record");
      return value;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async listUnits(): Promise<UnitRecord[]> {
    let names: string[];
    try {
      names = await readdir(this.dir);
    } catch {
      return [];
    }
    const units: UnitRecord[] = [];
    for (const name of names.sort()) {
      const unit = await this.getUnit(name);
      if (unit) units.push(unit);
    }
    return units;
  }

  async setStatus(unitId: string, status: UnitStatus, reason?: string): Promise<UnitRecord> {
    const unit = await this.getUnit(unitId);
    if (!unit) throw new Error(`no unit "${unitId}"`);
    const { reason: _dropped, ...rest } = unit;
    const next: UnitRecord = { ...rest, status, updatedAt: this.#stamp(), ...(reason === undefined ? {} : { reason }) };
    await writeFile(path.join(this.#unitDir(unitId), "unit.json"), `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return next;
  }

  async getContract(unitId: string, version: number): Promise<WorkContract | undefined> {
    try {
      const value: unknown = JSON.parse(await readFile(path.join(this.#unitDir(unitId), `contract.v${version}.json`), "utf8"));
      assertValid(WorkContractSchema, value, "work contract");
      return value;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  /** The contract currently governing the unit. */
  async currentContract(unitId: string): Promise<WorkContract | undefined> {
    const unit = await this.getUnit(unitId);
    return unit ? this.getContract(unitId, unit.contract.version) : undefined;
  }

  /** Attempts are immutable: append only, numbered from the unit record. */
  async recordAttempt(attempt: Omit<AttemptRecord, "attempt">): Promise<AttemptRecord> {
    const unit = await this.getUnit(attempt.unitId);
    if (!unit) throw new Error(`no unit "${attempt.unitId}"`);
    const record: AttemptRecord = { ...attempt, attempt: unit.attempts + 1 };
    assertValid(AttemptRecordSchema, record, "attempt record");
    await appendFile(path.join(this.#unitDir(attempt.unitId), "attempts.ndjson"), `${JSON.stringify(record)}\n`, "utf8");
    const { reason, ...rest } = unit;
    const next: UnitRecord = { ...rest, attempts: record.attempt, updatedAt: this.#stamp(), ...(reason === undefined ? {} : { reason }) };
    await writeFile(path.join(this.#unitDir(attempt.unitId), "unit.json"), `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return record;
  }

  async listAttempts(unitId: string): Promise<AttemptRecord[]> {
    try {
      const text = await readFile(path.join(this.#unitDir(unitId), "attempts.ndjson"), "utf8");
      return text.trim().split("\n").filter(Boolean).map((line) => {
        const value: unknown = JSON.parse(line);
        assertValid(AttemptRecordSchema, value, "attempt record");
        return value;
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  /** One report per contract version; a second write is refused, not merged. */
  async writeReport(report: ResultReport): Promise<void> {
    assertValid(ResultReportSchema, report, "result report");
    await writeNew(path.join(this.#unitDir(report.unitId), `report.v${report.contractVersion}.json`), report);
  }

  /** The budget guard rewrites the ledger as the attempt consumes; a counter, not a record. */
  async writeBudget(ledger: BudgetLedger): Promise<void> {
    assertValid(BudgetLedgerSchema, ledger, "budget ledger");
    const dir = this.#unitDir(ledger.unitId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `budget.a${ledger.attempt}.json`), `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  }

  async getBudget(unitId: string, attempt: number): Promise<BudgetLedger | undefined> {
    try {
      const value: unknown = JSON.parse(await readFile(path.join(this.#unitDir(unitId), `budget.a${attempt}.json`), "utf8"));
      assertValid(BudgetLedgerSchema, value, "budget ledger");
      return value;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async getReport(unitId: string, version: number): Promise<ResultReport | undefined> {
    try {
      const value: unknown = JSON.parse(await readFile(path.join(this.#unitDir(unitId), `report.v${version}.json`), "utf8"));
      assertValid(ResultReportSchema, value, "result report");
      return value;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }
}
