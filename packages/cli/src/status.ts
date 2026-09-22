/**
 * The `regulator status` read model: one typed projection of a definition
 * and an instance, for humans (`renderStatusText`) and for the control room
 * (`--json`). It owns no state and never infers state from the repository:
 * everything here is read from the definition's files and the instance's
 * `.regulator/` directory.
 *
 *   definition = registry + profiles + policies + workload + identity   (what is declared)
 *   instance   = units + leases + obligations + memory + unrouted messages (what is running,
 *                                                                          what is owed, what is known)
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { summarizeVerdict } from "@metacoding/vsm-pi-checks";
import {
  AuditLog, ExecutionStore, INSTANCE_MANIFEST_RELATIVE_PATH, LEASES_RELATIVE_DIR, LeaseStore, MemoryStore, ObligationLedger, checkRegistry, formatSummary, projectSpans, readIdentity, summarizeLedger, timelineFor,
  type IdentitySet, type InteractionState, type MemoryState, type RegistryProblem, type TimelineEntry, type UnitAudit,
} from "@metacoding/vsm-pi-core";
import {
  CapabilityProfileSchema, EvalReportSchema, EvalSuiteSchema, PolicyDefinitionSchema, WorkloadDefinitionSchema, assertValid, isInteractionPolicy, isPolicyDefinition, isRecoveryPolicy, isRoutingPolicy,
  InstanceManifestSchema,
  type AttemptRecord, type BudgetLedger, type CapabilityProfile, type EvalReport, type EvalSuite, type InstanceManifest, type InteractionPolicy, type Lease, type ObligationState, type PolicyDefinition, type RecoveryDecision, type RecoveryPolicy, type RegulatorRecord, type ResultReport,
  type RoutingPolicy, type UnitRecord, type VsmMessage, type WorkContract, type WorkloadDefinition,
} from "@metacoding/vsm-pi-protocol";

export interface DefinitionView {
  dir: string;
  registry: { records: RegulatorRecord[]; problems: RegistryProblem[] };
  workloads: WorkloadDefinition[];
  policies: PolicyDefinition[];
  /** The recovery policies (lesson 08), routing policies (lesson 11) and interaction policies (lesson 13) the definition declares beside its budget policies. */
  recovery: RecoveryPolicy[];
  routing: RoutingPolicy[];
  interaction: InteractionPolicy[];
  /** Capability profiles, declared as files since lesson 12. */
  profiles: CapabilityProfile[];
  /** The identity set the definition seeds into every instance (lesson 12): files, invariants, problems. */
  identity: IdentitySet;
  /** Eval suites and committed reports (lesson 14): the assurance view's source. */
  evals: EvalSuite[];
  reports: EvalReport[];
  /** Per active regulator: when it is due for review, how it is ablated, whether a committed report covers that, and when it may retire (lesson 14). */
  lifecycle: LifecycleRow[];
  problems: string[];
  /** Which parts of the definition are declared as files, and which are absent. */
  declared: Array<"registry" | "workload" | "policies" | "profiles" | "identity">;
  pending: Array<"profiles" | "policies" | "identity">;
}

export interface LifecycleRow {
  id: string;
  name: string;
  reviewBy: string;
  /** Days past the review date at the view's generation time; negative when still ahead. */
  overdueDays: number;
  ablation: { switch: string; note: string } | undefined;
  retirement: string | undefined;
  /** Suites with an arm that ablates this regulator, and committed reports that ran such an arm. */
  ablatedIn: string[];
  reportedIn: string[];
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
  /** S3*'s record for the unit: the latest technical verdict and the evidence behind it, replayed from the audit log. */
  audit: UnitAudit;
  /** What is owed on the unit, open or closed, folded from the regulatory log (lesson 11). */
  obligations: ObligationState[];
  /** The replay (lesson 15): every record about the unit in time order, from the span projection. */
  timeline: TimelineEntry[];
}

export interface InstanceView {
  dir: string;
  units: UnitView[];
  leases: Array<{ lease: Lease; live: boolean }>;
  /** Messages nothing has routed yet: an obligation or a note is what routing leaves behind. */
  signals: VsmMessage[];
  /** Every obligation the instance holds, in the order opened. */
  obligations: ObligationState[];
  /** Operational memory (lesson 12): current, expired and retracted facts. */
  memory: MemoryState[];
  /** What units asked a person and what came back (lesson 13), oldest first. */
  interactions: InteractionState[];
  /** What `regulator init` wrote (lesson 15), when it did; the problem when the file is there and invalid. */
  manifest: InstanceManifest | undefined;
  manifestProblem?: string;
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

export async function readDefinition(dir: string, now: () => number = Date.now): Promise<DefinitionView> {
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
  const recovery: RecoveryPolicy[] = [];
  const routing: RoutingPolicy[] = [];
  const interaction: InteractionPolicy[] = [];
  let policyFiles: string[] = [];
  try {
    policyFiles = (await readdir(path.join(dir, "policies"))).filter((f) => f.endsWith(".json")).sort();
  } catch {
    problems.push("no policies/ directory: the definition declares no budgets or model routes");
  }
  for (const file of policyFiles) {
    try {
      const value: unknown = JSON.parse(await readFile(path.join(dir, "policies", file), "utf8"));
      // Four policy shapes share the directory; a file is whichever closed schema it satisfies, and none is a problem.
      if (isPolicyDefinition(value)) policies.push(value);
      else if (isRecoveryPolicy(value)) recovery.push(value);
      else if (isRoutingPolicy(value)) routing.push(value);
      else if (isInteractionPolicy(value)) interaction.push(value);
      else assertValid(PolicyDefinitionSchema, value, `policy ${file} (not a budget, recovery, routing or interaction policy)`);
    } catch (error) {
      problems.push(`policies/${file}: ${(error as Error).message}`);
    }
  }
  const profiles: CapabilityProfile[] = [];
  let profileFiles: string[] = [];
  try {
    profileFiles = (await readdir(path.join(dir, "profiles"))).filter((f) => f.endsWith(".json")).sort();
  } catch {
    problems.push("no profiles/ directory: the definition declares no capability profiles");
  }
  for (const file of profileFiles) {
    try {
      const value: unknown = JSON.parse(await readFile(path.join(dir, "profiles", file), "utf8"));
      assertValid(CapabilityProfileSchema, value, `profile ${file}`);
      profiles.push(value);
    } catch (error) {
      problems.push(`profiles/${file}: ${(error as Error).message}`);
    }
  }
  const identity = await readIdentity(path.join(dir, "identity"));
  for (const p of identity.problems) problems.push(`identity/: ${p}`);
  const evals: EvalSuite[] = [];
  const reports: EvalReport[] = [];
  for (const file of await jsonFilesIn(path.join(dir, "evals"))) {
    try {
      const value: unknown = JSON.parse(await readFile(path.join(dir, "evals", file), "utf8"));
      assertValid(EvalSuiteSchema, value, `eval suite ${file}`);
      evals.push(value);
    } catch (error) {
      problems.push(`evals/${file}: ${(error as Error).message}`);
    }
  }
  for (const file of await jsonFilesIn(path.join(dir, "evals", "reports"))) {
    try {
      const value: unknown = JSON.parse(await readFile(path.join(dir, "evals", "reports", file), "utf8"));
      assertValid(EvalReportSchema, value, `eval report ${file}`);
      reports.push(value);
    } catch (error) {
      problems.push(`evals/reports/${file}: ${(error as Error).message}`);
    }
  }
  const today = now();
  const lifecycle: LifecycleRow[] = registry.records.filter((r) => r.status === "active").map((r) => {
    const ablatedIn = evals.filter((s) => s.arms.some((a) => a.ablates === r.id)).map((s) => s.name);
    const arms = new Set(evals.flatMap((s) => s.arms.filter((a) => a.ablates === r.id).map((a) => `${s.name}:${a.name}`)));
    return {
      id: r.id, name: r.name, reviewBy: r.ownership.reviewBy, overdueDays: Math.round((today - Date.parse(r.ownership.reviewBy)) / 86_400_000),
      ablation: r.ablation, retirement: r.retirement?.condition, ablatedIn,
      reportedIn: reports.filter((rep) => rep.arms.some((a) => arms.has(`${rep.suite.name}:${a.arm}`))).map((rep) => `${rep.suite.name} v${rep.suite.version} (${rep.fingerprint.dispatcher})`),
    };
  });
  const declared: DefinitionView["declared"] = ["registry"];
  const pending: DefinitionView["pending"] = [];
  if (workloads.length) declared.push("workload");
  if (policies.length) declared.push("policies"); else pending.push("policies");
  if (profiles.length) declared.push("profiles"); else pending.push("profiles");
  if (identity.invariants.length && !identity.problems.length) declared.push("identity"); else pending.push("identity");
  return {
    dir,
    registry: { records: registry.records, problems: registry.problems },
    workloads,
    policies,
    recovery,
    routing,
    interaction,
    profiles,
    identity,
    evals,
    reports,
    lifecycle,
    problems,
    declared,
    pending,
  };
}

async function jsonFilesIn(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }
}

export async function readInstance(dir: string, now: () => number = Date.now): Promise<InstanceView> {
  const store = new ExecutionStore(dir, now);
  const auditLog = new AuditLog(dir);
  const ledger = new ObligationLedger(dir, now);
  const obligations = await ledger.obligations();
  const spans = await projectSpans(dir);
  const units: UnitView[] = [];
  for (const unit of await store.listUnits()) {
    units.push({
      unit,
      contract: await store.getContract(unit.unitId, unit.contract.version),
      report: await store.getReport(unit.unitId, unit.contract.version),
      attemptRecords: await store.listAttempts(unit.unitId),
      budget: unit.attempts > 0 ? await store.getBudget(unit.unitId, unit.attempts) : await store.getBudget(unit.unitId, 1),
      decisions: await store.listDecisions(unit.unitId),
      audit: await auditLog.forUnit(unit.unitId),
      obligations: obligations.filter((o) => o.unit === unit.unitId),
      timeline: timelineFor(spans, unit.unitId),
    });
  }
  let manifest: InstanceManifest | undefined;
  let manifestProblem: string | undefined;
  try {
    const value: unknown = JSON.parse(await readFile(path.join(dir, INSTANCE_MANIFEST_RELATIVE_PATH), "utf8"));
    assertValid(InstanceManifestSchema, value, "instance manifest");
    manifest = value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") manifestProblem = (error as Error).message;
  }
  const leaseStore = new LeaseStore(path.join(dir, LEASES_RELATIVE_DIR), now);
  const leases = (await leaseStore.list()).map((lease) => ({ lease, live: leaseStore.isLive(lease) }));
  return { dir, units, leases, signals: await ledger.unrouted(), obligations, memory: await new MemoryStore(dir, now).states(), interactions: await ledger.interactions(), manifest, ...(manifestProblem ? { manifestProblem } : {}) };
}

export async function readStatus(options: ReadStatusOptions): Promise<StatusView> {
  const now = options.now ?? Date.now;
  return {
    generatedAt: new Date(now()).toISOString(),
    definition: options.definitionDir ? await readDefinition(path.resolve(options.definitionDir), now) : undefined,
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
    for (const profile of d.profiles) lines.push(`  profile ${profile.name}: ${profile.tools.join(", ")}; writes ${profile.writablePaths.join(", ") || "nothing"}`);
    lines.push(`  identity: ${d.identity.invariants.map((i) => i.id).join(", ") || "none"}${d.identity.problems.length ? ` (${d.identity.problems.length} problem(s))` : ""}`);
    for (const policy of d.recovery) lines.push(`  recovery ${policy.name} v${policy.version}: ${policy.rules.length} rule(s), fallback ${policy.fallback.join(" → ")}`);
    for (const policy of d.routing) lines.push(`  routing ${policy.name} v${policy.version}: ${policy.rules.map((r) => `${r.kind}≥${r.minSeverity}→${r.consumer}`).join(", ")}; veto at ${policy.blocksAtOrAbove}`);
    for (const policy of d.interaction) {
      lines.push(`  interaction ${policy.name} v${policy.version}: waits ${Object.entries(policy.timeoutsMs).map(([k, ms]) => `${k} ${Math.round(ms / 1000)}s`).join(", ")}; ${policy.attention.blockingPerAttempt} blocking interrupt(s) per attempt; remind after ${Math.round(policy.reminderAfterMs / 60_000)} min`);
      for (const p of policy.people) lines.push(`    ${p.name}: up to ${p.resolveUpTo}${p.acceptRisk ? ", may accept risk" : ""}${p.actAsS5 ? ", may act as S5" : ""}`);
    }
    for (const suite of d.evals) lines.push(`  eval suite ${suite.name} v${suite.version}: ${suite.tasks.length} task(s); arms ${suite.arms.map((a) => a.name + (a.ablates ? ` (ablates ${a.ablates})` : "")).join(", ")}; ${suite.repetitions} repetition(s); baseline ${suite.baseline}`);
    for (const r of d.reports) {
      lines.push(`  eval report ${r.suite.name} v${r.suite.version} at ${r.generatedAt.slice(0, 10)}: ${r.fingerprint.dispatcher} on ${r.fingerprint.model}, harness ${r.fingerprint.harnessRevision.slice(0, 7)}, interpreted by ${r.interpretedBy}`);
      for (const a of r.arms) lines.push(`    ${a.arm.padEnd(20)} n=${a.runs}  ${["closed", "refusals", "boundaryViolations", "signatureDrift", "vocabularyDrift", "memoryRules"].filter((m) => a.metrics[m]).map((m) => `${m} ${formatSummary(a.metrics[m]!, 2)}`).join("  ")}`);
    }
    const overdue = d.lifecycle.filter((l) => l.overdueDays > 0);
    lines.push(`  lifecycle: ${d.lifecycle.length} active regulator(s), ${overdue.length} overdue for review, ${d.lifecycle.filter((l) => l.ablatedIn.length).length} with an ablation arm, ${d.lifecycle.filter((l) => l.reportedIn.length).length} with a committed ablation report`);
    for (const l of overdue) lines.push(`    overdue ${l.overdueDays}d  ${l.id}  (review by ${l.reviewBy})`);
    for (const problem of [...d.registry.problems.map((p) => `${p.file}: ${p.message}`), ...d.problems]) lines.push(`  ! ${problem}`);
  }
  if (view.instance) {
    const i = view.instance;
    lines.push(`instance ${i.dir}`);
    lines.push(`  manifest: ${i.manifest ? `definition ${i.manifest.definition.name} at ${i.manifest.definition.harnessRevision.slice(0, 7)} (${i.manifest.definition.registry} regulators, pi ${i.manifest.definition.pi}), initialized ${i.manifest.initializedAt.slice(0, 10)} by ${i.manifest.initializedBy}${i.manifest.writablePaths ? `; writable ${i.manifest.writablePaths.join(", ")}` : ""}${i.manifest.protectedPaths ? `; protected ${i.manifest.protectedPaths.join(", ")}` : ""}` : i.manifestProblem ? `! ${i.manifestProblem}` : "none (not initialized with `regulator init`)"}`);
    lines.push(`  units: ${i.units.length}`);
    for (const { unit, report, attemptRecords, budget, decisions, audit, obligations } of i.units) {
      const last = attemptRecords.at(-1);
      const routed = decisions.at(-1);
      const verdict = audit.verdicts.at(-1);
      const owed = obligations.filter((o) => o.status === "open" || o.status === "acknowledged");
      lines.push(`    ${unit.status.padEnd(10)} ${unit.unitId}  ${unit.unitType}  contract ${unit.contract.id} v${unit.contract.version}  attempts ${unit.attempts}${last ? ` (last: ${last.outcome})` : ""}${report ? "  reported" : ""}${budget ? `  budget ${summarizeLedger(budget)}` : ""}${routed ? `  routed ${routed.cause}→${routed.action} (${routed.policy.name} v${routed.policy.version})` : ""}${verdict ? `  audit ${summarizeVerdict(verdict)}` : ""}${owed.length ? `  owed ${owed.map((o) => `${o.consumer}${o.blocks ? "!" : ""}`).join(",")}` : ""}${unit.reason ? `  — ${unit.reason}` : ""}`);
    }
    lines.push(`  leases: ${i.leases.length}`);
    for (const { lease, live } of i.leases) lines.push(`    ${live ? "live   " : "expired"} ${lease.unitId}  ${lease.owner}  until ${new Date(lease.expiresAt).toISOString()}`);
    const open = i.obligations.filter((o) => o.status === "open" || o.status === "acknowledged");
    lines.push(`  obligations: ${open.length} open of ${i.obligations.length}`);
    for (const o of open) lines.push(`    ${o.status.padEnd(12)} ${o.consumer.padEnd(5)} ${o.severity.padEnd(8)} ${o.blocks ? "veto" : "    "}  ${o.id.slice(0, 8)}  ${o.concern}  ${o.subject}${o.unit ? `  (unit ${o.unit})` : ""}${o.question ? `  Q: ${o.question}` : ""}${o.deliveries.length ? `  delivered ×${o.deliveries.length} (${o.deliveries.at(-1)!.channel})` : o.consumer === "human" ? "  not delivered" : ""}`);
    const unanswered = i.interactions.filter((x) => !x.answers.some((a) => a.outcome === "answered"));
    lines.push(`  interactions: ${i.interactions.length} asked, ${unanswered.length} unanswered`);
    for (const x of i.interactions) {
      const last = x.answers.at(-1);
      lines.push(`    ${x.request.kind.padEnd(13)} ${x.request.id.slice(0, 8)}  ${x.request.subject}${x.request.unit ? `  (unit ${x.request.unit}, attempt ${x.request.attempt ?? "?"})` : ""}  via ${x.request.channel}  ${last ? `${last.outcome} by ${last.by}${last.answer ? `: ${last.answer}` : ""}` : "pending"}`);
    }
    const current = i.memory.filter((m) => m.status === "current");
    lines.push(`  memory: ${current.length} current of ${i.memory.length}`);
    for (const m of current) lines.push(`    ${m.id.slice(0, 8)}  ${m.subject}: ${m.note}  (by ${m.recordedBy}${m.unit ? ` in ${m.unit}` : ""}; review by ${m.reviewBy.slice(0, 10)})`);
    lines.push(`  unrouted signals: ${i.signals.length}`);
    for (const signal of i.signals) lines.push(`    ${signal.kind}  ${signal.source}→${signal.destination}  ${signal.subject}${"unit" in signal && signal.unit ? `  (unit ${signal.unit})` : ""}`);
  }
  if (!view.definition && !view.instance) lines.push("nothing to show: pass --definition <dir> and/or --instance <dir>");
  return `${lines.join("\n")}\n`;
}
