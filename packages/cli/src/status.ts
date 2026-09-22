/**
 * The `regulator status` read model: one typed projection of a definition
 * and an instance, for humans (`renderStatusText`) and for the control room
 * (`--json`). It owns no state and never infers state from the repository:
 * everything here is read from the definition's files and the instance's
 * `.regulator/` directory.
 *
 *   definition = registry + profiles + policies + workload   (what is declared)
 *   instance   = units + leases + unrouted signals           (what is running)
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  ExecutionStore, LEASES_RELATIVE_DIR, LeaseStore, checkRegistry, readSignals, summarizeLedger,
  type RegistryProblem,
} from "@metacoding/vsm-pi-core";
import {
  PolicyDefinitionSchema, WorkloadDefinitionSchema, assertValid,
  type AttemptRecord, type BudgetLedger, type Lease, type PolicyDefinition, type RecoveryDecision, type RegulatorRecord, type ResultReport, type UnitRecord, type VsmMessage, type WorkContract, type WorkloadDefinition,
} from "@metacoding/vsm-pi-protocol";

export interface DefinitionView {
  dir: string;
  registry: { records: RegulatorRecord[]; problems: RegistryProblem[] };
  workloads: WorkloadDefinition[];
  policies: PolicyDefinition[];
  problems: string[];
  /** Which parts of the definition are declared as files today, and which are still code or absent. */
  declared: Array<"registry" | "workload" | "policies">;
  pending: Array<"profiles" | "policies">;
}

export interface UnitView {
  unit: UnitRecord;
  contract: WorkContract | undefined;
  report: ResultReport | undefined;
  attemptRecords: AttemptRecord[];
  /** The latest attempt's budget ledger, when the guard wrote one. */
  budget: BudgetLedger | undefined;
  /** Every recovery decision S3 recorded for the unit, oldest first. */
  decisions: RecoveryDecision[];
}

export interface InstanceView {
  dir: string;
  units: UnitView[];
  leases: Array<{ lease: Lease; live: boolean }>;
  signals: VsmMessage[];
}

export interface StatusView {
  generatedAt: string;
  definition: DefinitionView | undefined;
  instance: InstanceView | undefined;
}

export interface ReadStatusOptions {
  definitionDir?: string;
  instanceDir?: string;
  now?: () => number;
}

export async function readDefinition(dir: string): Promise<DefinitionView> {
  const registry = await checkRegistry(path.join(dir, "registry"), dir);
  const problems: string[] = [];
  const workloads: WorkloadDefinition[] = [];
  let files: string[] = [];
  try {
    files = (await readdir(path.join(dir, "workload"))).filter((f) => f.endsWith(".json")).sort();
  } catch {
    problems.push("no workload/ directory: the definition declares no workload");
  }
  for (const file of files) {
    try {
      const value: unknown = JSON.parse(await readFile(path.join(dir, "workload", file), "utf8"));
      assertValid(WorkloadDefinitionSchema, value, `workload ${file}`);
      workloads.push(value);
    } catch (error) {
      problems.push(`workload/${file}: ${(error as Error).message}`);
    }
  }
  const policies: PolicyDefinition[] = [];
  let policyFiles: string[] = [];
  try {
    policyFiles = (await readdir(path.join(dir, "policies"))).filter((f) => f.endsWith(".json")).sort();
  } catch {
    problems.push("no policies/ directory: the definition declares no budgets or model routes");
  }
  for (const file of policyFiles) {
    try {
      const value: unknown = JSON.parse(await readFile(path.join(dir, "policies", file), "utf8"));
      assertValid(PolicyDefinitionSchema, value, `policy ${file}`);
      policies.push(value);
    } catch (error) {
      problems.push(`policies/${file}: ${(error as Error).message}`);
    }
  }
  const declared: DefinitionView["declared"] = ["registry"];
  if (workloads.length) declared.push("workload");
  if (policies.length) declared.push("policies");
  return {
    dir,
    registry: { records: registry.records, problems: registry.problems },
    workloads,
    policies,
    problems,
    declared,
    pending: policies.length ? ["profiles"] : ["profiles", "policies"],
  };
}

export async function readInstance(dir: string, now: () => number = Date.now): Promise<InstanceView> {
  const store = new ExecutionStore(dir, now);
  const units: UnitView[] = [];
  for (const unit of await store.listUnits()) {
    units.push({
      unit,
      contract: await store.getContract(unit.unitId, unit.contract.version),
      report: await store.getReport(unit.unitId, unit.contract.version),
      attemptRecords: await store.listAttempts(unit.unitId),
      budget: unit.attempts > 0 ? await store.getBudget(unit.unitId, unit.attempts) : await store.getBudget(unit.unitId, 1),
      decisions: await store.listDecisions(unit.unitId),
    });
  }
  const leaseStore = new LeaseStore(path.join(dir, LEASES_RELATIVE_DIR), now);
  const leases = (await leaseStore.list()).map((lease) => ({ lease, live: leaseStore.isLive(lease) }));
  return { dir, units, leases, signals: await readSignals(dir) };
}

export async function readStatus(options: ReadStatusOptions): Promise<StatusView> {
  const now = options.now ?? Date.now;
  return {
    generatedAt: new Date(now()).toISOString(),
    definition: options.definitionDir ? await readDefinition(path.resolve(options.definitionDir)) : undefined,
    instance: options.instanceDir ? await readInstance(path.resolve(options.instanceDir), now) : undefined,
  };
}

export function renderStatusText(view: StatusView): string {
  const lines: string[] = [];
  if (view.definition) {
    const d = view.definition;
    lines.push(`definition ${d.dir}`);
    lines.push(`  declared: ${d.declared.join(", ")}; pending: ${d.pending.join(", ")}`);
    lines.push(`  registry: ${d.registry.records.length} regulator(s), ${d.registry.problems.length} problem(s)`);
    for (const record of d.registry.records) lines.push(`    ${record.vsmFunction.padEnd(3)} ${record.mechanism.level.padEnd(19)} ${record.id}`);
    for (const workload of d.workloads) {
      lines.push(`  workload ${workload.name} v${workload.version}: ${workload.unitTypes.map((u) => `${u.name}→${u.profile}`).join(", ")}`);
    }
    for (const policy of d.policies) {
      const b = policy.budgets.default;
      lines.push(`  policy ${policy.name} v${policy.version}: default ${b.tokens} tok, ${b.turns} turns, ${b.attempts} attempts; models ${policy.models.default.primary}${policy.models.default.fallback.length ? ` → ${policy.models.default.fallback.join(" → ")}` : ""}`);
    }
    for (const problem of [...d.registry.problems.map((p) => `${p.file}: ${p.message}`), ...d.problems]) lines.push(`  ! ${problem}`);
  }
  if (view.instance) {
    const i = view.instance;
    lines.push(`instance ${i.dir}`);
    lines.push(`  units: ${i.units.length}`);
    for (const { unit, report, attemptRecords, budget, decisions } of i.units) {
      const last = attemptRecords.at(-1);
      const routed = decisions.at(-1);
      lines.push(`    ${unit.status.padEnd(10)} ${unit.unitId}  ${unit.unitType}  contract ${unit.contract.id} v${unit.contract.version}  attempts ${unit.attempts}${last ? ` (last: ${last.outcome})` : ""}${report ? "  reported" : ""}${budget ? `  budget ${summarizeLedger(budget)}` : ""}${routed ? `  routed ${routed.cause}→${routed.action} (${routed.policy.name} v${routed.policy.version})` : ""}${unit.reason ? `  — ${unit.reason}` : ""}`);
    }
    lines.push(`  leases: ${i.leases.length}`);
    for (const { lease, live } of i.leases) lines.push(`    ${live ? "live   " : "expired"} ${lease.unitId}  ${lease.owner}  until ${new Date(lease.expiresAt).toISOString()}`);
    lines.push(`  unrouted signals: ${i.signals.length}`);
    for (const signal of i.signals) lines.push(`    ${signal.kind}  ${signal.source}→${signal.destination}  ${signal.subject}${"unit" in signal && signal.unit ? `  (unit ${signal.unit})` : ""}`);
  }
  if (!view.definition && !view.instance) lines.push("nothing to show: pass --definition <dir> and/or --instance <dir>");
  return `${lines.join("\n")}\n`;
}
