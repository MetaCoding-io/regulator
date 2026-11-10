/**
 * The orchestrator's execution store (lesson 06). Files under
 * `<root>/.regulator/units/<unitId>/`, one directory per unit:
 *
 *   unit.json              the unit record (status, attempts, and why when it is blocked) — the only mutable file
 *   contract.v<N>.json     the contract version that governs execution; never overwritten
 *   report.v<N>.a<M>.json  the result report attempt M wrote against version N; never overwritten
 *   attempts.ndjson        one immutable record per attempt
 *   budget.a<N>.json       the running ledger of attempt N (a counter: rewritten, never merged)
 *   observations.ndjson    normalized failures the session observed, append-only
 *   decisions.ndjson       one immutable recovery decision per routed failure
 *
 * Nothing here is regulatory state and nothing is inferred from the domain
 * (the repository): the orchestrator knows what it dispatched because it
 * wrote it down, not because it looked at the diff.
 */
import { mkdir, readdir, readFile, appendFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AttemptRecordSchema, BudgetLedgerSchema, FailureObservationSchema, RecoveryDecisionSchema, ResultReportSchema, UNIT_TRANSITIONS, UnitRecordSchema, WorkContractSchema, assertValid, readUnitRecord, unitTransitions,
  type AttemptRecord, type BudgetLedger, type FailureObservation, type ReasonedUnitStatus, type RecoveryDecision, type ResultReport, type UnitRecord, type UnitRecordIn, type UnitStatus, type WorkContract,
} from "@metacoding.io/regulator-protocol";
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
  async createUnit(contract: WorkContract): Promise<UnitRecordIn<"contracted">> {
    assertValid(WorkContractSchema, contract, "work contract");
    const dir = this.#unitDir(contract.unitId);
    if (await this.getUnit(contract.unitId)) throw new Error(`unit "${contract.unitId}" already exists`);
    await writeNew(path.join(dir, `contract.v${contract.version}.json`), contract);
    const record: UnitRecordIn<"contracted"> = {
      unitId: contract.unitId,
      unitType: contract.unitType,
      workload: contract.workload,
      contract: { id: contract.id, version: contract.version },
      status: "contracted",
      attempts: 0,
      createdAt: this.#stamp(),
      updatedAt: this.#stamp(),
    };
    await this.#writeUnit(record);
    return record;
  }

  /** The one write of `unit.json`: nothing that is not a unit record in its status's own shape reaches the disk. */
  async #writeUnit(record: UnitRecord): Promise<void> {
    assertValid(UnitRecordSchema, record, "unit record");
    await writeFile(path.join(this.#unitDir(record.unitId), "unit.json"), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  }

  async #readUnit(unitId: string): Promise<{ record: UnitRecord; legacyReason?: string } | undefined> {
    let value: unknown;
    try {
      value = JSON.parse(await readFile(path.join(this.#unitDir(unitId), "unit.json"), "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
    const read = readUnitRecord(value);
    // Not a record in either shape: the schema says what is wrong with it.
    if (!read) assertValid(UnitRecordSchema, value, "unit record");
    return read;
  }

  /**
   * The unit's record. A file written before the record was keyed on its status (#161) may carry a reason beside a
   * status that has none (an aborted unit did): it is read without it, and `legacyUnits` says which files those are.
   */
  async getUnit(unitId: string): Promise<UnitRecord | undefined> {
    return (await this.#readUnit(unitId))?.record;
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

  /**
   * The units whose file on disk is in the older shape, each with the reason its status cannot carry: what
   * `regulator doctor` names and `regulator upgrade` rewrites. A file that is a record in neither shape is listed
   * under `unreadable` with what the schema says, so a caller can report it and go on.
   */
  async legacyUnits(): Promise<{ total: number; legacy: Array<{ unitId: string; status: UnitStatus; reason: string }>; unreadable: Array<{ unitId: string; problem: string }> }> {
    const names = await readdir(this.dir).catch(() => [] as string[]);
    const legacy: Array<{ unitId: string; status: UnitStatus; reason: string }> = [];
    const unreadable: Array<{ unitId: string; problem: string }> = [];
    let total = 0;
    for (const name of names.sort()) {
      try {
        const read = await this.#readUnit(name);
        if (!read) continue;
        total += 1;
        if (read.legacyReason !== undefined) legacy.push({ unitId: name, status: read.record.status, reason: read.legacyReason });
      } catch (error) {
        total += 1;
        unreadable.push({ unitId: name, problem: (error as Error).message.split("\n")[0] ?? "not a unit record" });
      }
    }
    return { total, legacy, unreadable };
  }

  /** Rewrite a unit's file in the current shape, as it is read: the reason its status cannot carry goes, and nothing else changes. Returns whether the file was in the older shape. */
  async rewriteLegacyUnit(unitId: string): Promise<boolean> {
    const read = await this.#readUnit(unitId);
    if (!read || read.legacyReason === undefined) return false;
    await this.#writeUnit(read.record);
    return true;
  }

  /**
   * Move the unit along the lifecycle. The change must be a row of `UNIT_TRANSITIONS`: the table is the loop's
   * declaration of every path a unit can take, and a status written around it would make the unit's history
   * something the table does not draw. The gate is on the pair; which trigger took it is the loop's record to keep.
   *
   * A reason is written with a status that carries one, and only with it (#161): `blocked` takes its reason as a
   * required argument and every other status takes none, by the signature for a caller that names the status and by
   * the check below for one that does not.
   */
  async setStatus<S extends ReasonedUnitStatus>(unitId: string, status: S, reason: string): Promise<UnitRecordIn<S>>;
  async setStatus<S extends Exclude<UnitStatus, ReasonedUnitStatus>>(unitId: string, status: S): Promise<UnitRecordIn<S>>;
  async setStatus(unitId: string, status: UnitStatus, reason?: string): Promise<UnitRecord> {
    const unit = await this.getUnit(unitId);
    if (!unit) throw new Error(`no unit "${unitId}"`);
    if (!unitTransitions(unit.status, status).length) {
      const from = UNIT_TRANSITIONS.filter((t) => t.from === unit.status).map((t) => t.to);
      throw new Error(`unit "${unitId}" is ${unit.status}; ${unit.status} → ${status} is not a transition the loop declares (UNIT_TRANSITIONS); from ${unit.status} it declares ${from.length ? [...new Set(from)].join(", ") : "nothing: the status is terminal"}`);
    }
    const { unitId: id, unitType, workload, contract, attempts, createdAt } = unit;
    const rest = { unitId: id, unitType, workload, contract, attempts, createdAt, updatedAt: this.#stamp() };
    let next: UnitRecord;
    if (status === "blocked") {
      if (reason === undefined || reason === "") throw new Error(`unit "${unitId}": a blocked unit says why it is blocked; ${unit.status} → blocked was asked with no reason`);
      next = { ...rest, status, reason };
    } else {
      if (reason !== undefined) throw new Error(`unit "${unitId}": ${status} carries no reason (only a blocked unit's record does); ${unit.status} → ${status} was asked with "${reason}"`);
      next = { ...rest, status };
    }
    await this.#writeUnit(next);
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
    await this.#writeUnit({ ...unit, attempts: record.attempt, updatedAt: this.#stamp() });
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

  /** One report per contract version and attempt; a second write is refused, not merged. */
  async writeReport(report: ResultReport): Promise<void> {
    assertValid(ResultReportSchema, report, "result report");
    await writeNew(path.join(this.#unitDir(report.unitId), `report.v${report.contractVersion}.a${report.attempt}.json`), report);
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

  async #appendLine(unitId: string, file: string, value: unknown): Promise<void> {
    const dir = this.#unitDir(unitId);
    await mkdir(dir, { recursive: true });
    await appendFile(path.join(dir, file), `${JSON.stringify(value)}\n`, "utf8");
  }

  async #readLines<T>(unitId: string, file: string, check: (value: unknown) => asserts value is T): Promise<T[]> {
    try {
      const text = await readFile(path.join(this.#unitDir(unitId), file), "utf8");
      return text.split("\n").filter(Boolean).map((line) => {
        const value: unknown = JSON.parse(line);
        check(value);
        return value;
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  /** The session's observer appends normalized failures as they happen. */
  async recordObservation(observation: FailureObservation): Promise<void> {
    assertValid(FailureObservationSchema, observation, "failure observation");
    await this.#appendLine(observation.unitId, "observations.ndjson", observation);
  }

  async listObservations(unitId: string): Promise<FailureObservation[]> {
    return this.#readLines(unitId, "observations.ndjson", (v): asserts v is FailureObservation => assertValid(FailureObservationSchema, v, "failure observation"));
  }

  /** Recovery decisions are immutable: append only, never revised. */
  async recordDecision(decision: RecoveryDecision): Promise<void> {
    assertValid(RecoveryDecisionSchema, decision, "recovery decision");
    await this.#appendLine(decision.unitId, "decisions.ndjson", decision);
  }

  async listDecisions(unitId: string): Promise<RecoveryDecision[]> {
    return this.#readLines(unitId, "decisions.ndjson", (v): asserts v is RecoveryDecision => assertValid(RecoveryDecisionSchema, v, "recovery decision"));
  }

  /** The report a given attempt wrote against a contract version, or the latest attempt's when no attempt is named. */
  async getReport(unitId: string, version: number, attempt?: number): Promise<ResultReport | undefined> {
    let target = attempt;
    if (target === undefined) {
      let names: string[];
      try {
        names = await readdir(this.#unitDir(unitId));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
      }
      const prefix = `report.v${version}.a`;
      const attempts = names.filter((n) => n.startsWith(prefix) && n.endsWith(".json")).map((n) => Number(n.slice(prefix.length, -".json".length))).filter(Number.isInteger);
      if (!attempts.length) return undefined;
      target = Math.max(...attempts);
    }
    try {
      const value: unknown = JSON.parse(await readFile(path.join(this.#unitDir(unitId), `report.v${version}.a${target}.json`), "utf8"));
      assertValid(ResultReportSchema, value, "result report");
      return value;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }
}
