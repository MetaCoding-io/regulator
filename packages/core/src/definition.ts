/**
 * The definition check (lesson 12): a control plane is declared, not
 * assembled, so the declaration is checked as a whole. Profiles, the
 * workload, the policies and the identity are each validated, and the
 * references between them must resolve — a unit type's profile exists, a
 * policy's unit types exist, a check name is one the host runs, the identity
 * set is complete, every profile has its advice file and no file names a
 * profile nobody declared, and every directory of the definition falls in a
 * class of `DEFINITION_WRITERS` (#110), and a suite pre-registers only
 * metrics the definition carries — built in, or declared beside the workload
 * that owns them with a grader file the report can fingerprint (#129). The
 * registry has its own check; this is the rest.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  CapabilityProfileSchema, DEFINITION_WRITERS, EvalReportSchema, EvalSuiteSchema, HOST_CHECK_NAMES, PolicyDefinitionSchema, UNINTERPRETED_MARKER, WorkloadDefinitionSchema, assertValid, definitionClassOf, isInteractionPolicy, isPolicyDefinition, isRecoveryPolicy, isRoutingPolicy, isUninterpreted, seedDirFor, type CapabilityProfile, type EvalReport, type EvalSuite, type InteractionPolicy, type PolicyDefinition, type RecoveryPolicy, type RoutingPolicy, type WorkloadDefinition, CHECK_OPTIONS, checkName, checkNames, type CheckEntry,
  isBuiltInMetric, metricNames, optimisedMetrics, parseDeclaredMetric,
} from "@metacoding.io/regulator-protocol";
import { adviceContextBudget, adviceMaxChars, readAdviceSet, type AdviceSet } from "./advice.js";
import { identityContextBudget, identityMaxChars, readIdentity, type IdentitySet } from "./identity.js";
import { readOnlyViolations } from "./effects.js";
import { declaredMetricsOf, graderFile, instrumentHeldOutScore } from "./metrics.js";
import { isReadOnlyProfile } from "./profiles.js";

export interface DefinitionProblem {
  file: string;
  message: string;
}

export interface CheckedDefinition {
  dir: string;
  profiles: CapabilityProfile[];
  workloads: WorkloadDefinition[];
  policies: PolicyDefinition[];
  recovery: RecoveryPolicy[];
  routing: RoutingPolicy[];
  interaction: InteractionPolicy[];
  identity: IdentitySet;
  /** The advice files under advice/, one per declared profile (#110). */
  advice: AdviceSet;
  /** Eval suites under evals/ and committed reports under evals/reports/ (lesson 14). */
  evals: EvalSuite[];
  reports: EvalReport[];
  problems: DefinitionProblem[];
  /** What is true and worth knowing, and refuses nothing: the identity set or an advice file over its context budget. */
  warnings: DefinitionProblem[];
}

/**
 * The package's own code and tooling beside the definition: not definition files, so not placed in a class. Everything
 * else under the root that is a directory must be declared by `DEFINITION_WRITERS` before anything reads it.
 */
/** Directories beside the definition that are not it: the code, its build, and `figures/`, which `regulator docs --write` renders from the definition and nothing reads back. */
const NOT_DEFINITION_DIRS: ReadonlySet<string> = new Set(["src", "dist", "node_modules", "figures"]);

async function jsonFiles(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }
}

/** The options a check entry carries that the check does not take. */
function unknownCheckOptions(entry: CheckEntry): string[] {
  if (typeof entry === "string") return [];
  const takes: readonly string[] = CHECK_OPTIONS[entry.name] ?? [];
  return Object.keys(entry.options).filter((o) => !takes.includes(o));
}

export async function checkDefinition(dir: string): Promise<CheckedDefinition> {
  const out: CheckedDefinition = { dir, profiles: [], workloads: [], policies: [], recovery: [], routing: [], interaction: [], identity: await readIdentity(path.join(dir, seedDirFor("identity"))), advice: { dir: path.join(dir, seedDirFor("advice")), files: {}, problems: [] }, evals: [], reports: [], problems: [], warnings: [] };
  const problem = (file: string, message: string) => out.problems.push({ file, message });

  const profileFiles = await jsonFiles(path.join(dir, "profiles"));
  if (!profileFiles.length) problem("profiles/", "no profiles declared: the definition grants no capabilities");
  for (const file of profileFiles) {
    try {
      const value: unknown = JSON.parse(await readFile(path.join(dir, "profiles", file), "utf8"));
      assertValid(CapabilityProfileSchema, value, `profile ${file}`);
      if (value.name !== path.basename(file, ".json")) problem(`profiles/${file}`, `declares profile "${value.name}"; the file name must match`);
      if (value.description.toLowerCase().includes("read-only") && value.writablePaths.length === 0) {
        const violations = readOnlyViolations(value.tools);
        if (violations.length && !/not read-only by declared effect/i.test(value.description)) problem(`profiles/${file}`, `says read-only but grants ${violations.join(", ")}, whose effects are not read-only`);
      }
      out.profiles.push(value);
    } catch (error) {
      problem(`profiles/${file}`, (error as Error).message);
    }
  }

  for (const file of await jsonFiles(path.join(dir, "workload"))) {
    try {
      const value: unknown = JSON.parse(await readFile(path.join(dir, "workload", file), "utf8"));
      assertValid(WorkloadDefinitionSchema, value, `workload ${file}`);
      out.workloads.push(value);
      for (const type of value.unitTypes) {
        const profile = out.profiles.find((p) => p.name === type.profile);
        if (!profile) problem(`workload/${file}`, `unit type "${type.name}" runs under profile "${type.profile}", which is not declared under profiles/`);
        // A unit nothing bounds may not change anything: a unit type that runs without a contract must run under a
        // profile whose every tool is read-only by declared effect. The flag is a grant, and this is where it is checked.
        else if (!type.requiresContract && !isReadOnlyProfile(profile)) {
          problem(`workload/${file}`, `unit type "${type.name}" runs without a contract but its profile "${type.profile}" grants ${readOnlyViolations(profile.tools).join(", ")}, whose effects are not read-only: a unit no contract bounds may not write`);
        }
        // A contracted unit closes only by reporting: a profile that does not grant the report tool makes every unit of
        // the type end as no-report (found by the first live drift run, 0.1.2). The grant is the profile's to declare.
        else if (type.requiresContract && !profile.tools.includes("report_result")) {
          problem(`workload/${file}`, `unit type "${type.name}" runs under a contract but its profile "${type.profile}" does not grant report_result: a contracted unit closes only by reporting, and the grant belongs in the declaration (the contract extension adds the tool as a backstop)`);
        }
        for (const entry of type.checks) {
          const check = checkName(entry);
          if (!(HOST_CHECK_NAMES as readonly string[]).includes(check)) problem(`workload/${file}`, `unit type "${type.name}" names check "${check}", which the host does not run (known: ${HOST_CHECK_NAMES.join(", ")})`);
          for (const option of unknownCheckOptions(entry)) problem(`workload/${file}`, `unit type "${type.name}" gives check "${check}" the option "${option}", which it does not take${CHECK_OPTIONS[check]?.length ? ` (it takes ${CHECK_OPTIONS[check]!.join(", ")})` : ""}`);
        }
      }
      // Declared metrics (#129): a declaration is data beside what owns it. The name must be this workload's, each name
      // once, the grader must be a file under the definition (what the report fingerprints), and a judged metric — one
      // with an instrument ref — waits until the instrument record exists with its held-out score.
      const declaredNames = new Set<string>();
      for (const metric of value.metrics ?? []) {
        const parsed = parseDeclaredMetric(metric.name);
        if (!parsed || parsed.owner !== "workload" || parsed.id !== value.name) problem(`workload/${file}`, `declares metric "${metric.name}", which belongs to ${parsed?.owner === "instrument" ? `instrument "${parsed.id}": an instrument's metric is declared on its record` : `workload "${parsed?.id}": a declaration lives beside the workload that owns it`}`);
        if (declaredNames.has(metric.name)) problem(`workload/${file}`, `declares metric "${metric.name}" twice`);
        declaredNames.add(metric.name);
        if (!(await graderFile(dir, metric.grader.argv))) problem(`workload/${file}`, `metric "${metric.name}" declares the grader \`${metric.grader.argv.join(" ")}\`, and no argument of it is a file under the definition: the grader's file is what the report fingerprints, and it is missing`);
        if (metric.instrument !== undefined && (await instrumentHeldOutScore(dir, metric.instrument)) === undefined) problem(`workload/${file}`, `metric "${metric.name}" is judged by instrument "${metric.instrument}", and no instrument record carries its held-out score: a judged metric waits on the record (open questions §4, #49)`);
      }
    } catch (error) {
      problem(`workload/${file}`, (error as Error).message);
    }
  }
  if (!out.workloads.length) problem("workload/", "no workload declared");

  for (const file of await jsonFiles(path.join(dir, "policies"))) {
    try {
      const value: unknown = JSON.parse(await readFile(path.join(dir, "policies", file), "utf8"));
      if (isPolicyDefinition(value)) {
        out.policies.push(value);
        const types = new Set(out.workloads.flatMap((w) => w.unitTypes.map((t) => t.name)));
        for (const name of [...Object.keys(value.budgets.byUnitType ?? {}), ...Object.keys(value.models.byUnitType ?? {})]) {
          if (!types.has(name)) problem(`policies/${file}`, `names unit type "${name}", which no workload declares`);
        }
      } else if (isRecoveryPolicy(value)) out.recovery.push(value);
      else if (isRoutingPolicy(value)) {
        out.routing.push(value);
        for (const floor of value.floors ?? []) {
          try { new RegExp(floor.pattern); } catch { problem(`policies/${file}`, `floor pattern "${floor.pattern}" is not a regular expression`); }
        }
      } else if (isInteractionPolicy(value)) {
        out.interaction.push(value);
        if (!value.people.length) problem(`policies/${file}`, "names nobody: no obligation owed to a person can ever be dispositioned");
      } else assertValid(PolicyDefinitionSchema, value, `policy ${file} (not a budget, recovery, routing or interaction policy)`);
    } catch (error) {
      problem(`policies/${file}`, (error as Error).message);
    }
  }
  if (!out.policies.length) problem("policies/", "no budget policy declared");
  if (!out.recovery.length) problem("policies/", "no recovery policy declared");
  if (!out.routing.length) problem("policies/", "no routing policy declared");
  if (!out.interaction.length) problem("policies/", "no interaction policy declared: nothing says how long to wait for a person or who may answer");
  for (const p of out.identity.problems) problem("identity/", p);
  // A long set is valid and partly unseen (#51): a warning, not a problem, since the check refuses nothing over it. The limit is
  // the budget policy's (#91): the one named "default", as the software workload's units run under; a deployment raises it there.
  const defaultPolicy = out.policies.find((p) => p.name === "default") ?? out.policies[0];
  const budget = identityContextBudget(out.identity, identityMaxChars(defaultPolicy));
  if (budget.warning) out.warnings.push({ file: "identity/", message: budget.warning });

  // Advice (#110): a file per declared profile, no file for an undeclared one, and no profile carrying the text twice while
  // the inline field lasts its one release of overlap. Over the budget policy's `advice.maxChars` is a warning, as for identity.
  out.advice = await readAdviceSet(out.advice.dir, out.profiles.map((p) => ({ name: p.name, inline: (p.advice?.length ?? 0) > 0 })));
  for (const p of out.advice.problems) problem(p.file, p.message);
  for (const [profile, text] of Object.entries(out.advice.files)) {
    const cut = adviceContextBudget(profile, text, adviceMaxChars(defaultPolicy));
    if (cut.warning) out.warnings.push({ file: `advice/${profile}.md`, message: cut.warning });
  }

  // Evals (lesson 14): a suite is part of the declaration — its tasks must exist, its baseline must be an arm, its checks must be
  // ones the host runs, and an ablation arm must say which switch it throws. A committed report must validate, or it is a rumour.
  for (const file of await jsonFiles(path.join(dir, "evals"))) {
    try {
      const value: unknown = JSON.parse(await readFile(path.join(dir, "evals", file), "utf8"));
      assertValid(EvalSuiteSchema, value, `eval suite ${file}`);
      out.evals.push(value);
      if (!value.arms.some((a) => a.name === value.baseline)) problem(`evals/${file}`, `baseline "${value.baseline}" is not an arm`);
      const names = new Set<string>();
      for (const arm of value.arms) {
        if (names.has(arm.name)) problem(`evals/${file}`, `arm "${arm.name}" is declared twice`);
        names.add(arm.name);
        for (const entry of arm.checks) for (const option of unknownCheckOptions(entry)) problem(`evals/${file}`, `arm "${arm.name}" gives check "${checkName(entry)}" the option "${option}", which it does not take`);
        for (const check of checkNames(arm.checks)) if (!(HOST_CHECK_NAMES as readonly string[]).includes(check)) problem(`evals/${file}`, `arm "${arm.name}" names check "${check}", which the host does not run`);
        if (arm.ablates && !arm.switch) problem(`evals/${file}`, `arm "${arm.name}" ablates ${arm.ablates} but names no switch`);
        if (arm.switch?.startsWith("check:") && checkNames(arm.checks).includes(arm.switch.slice("check:".length))) problem(`evals/${file}`, `arm "${arm.name}" switches off ${arm.switch} but still runs that check`);
      }
      // Pre-registration over declared metrics (#129): a declared name the definition does not carry is refused, not
      // warned about — a report summarizes only what was declared before the run. At most one declared metric is marked
      // as the optimisation target; the built-ins are reported only.
      const declared = declaredMetricsOf(out.workloads);
      const registered = new Set<string>();
      for (const name of metricNames(value.metrics)) {
        if (registered.has(name)) problem(`evals/${file}`, `pre-registers "${name}" twice`);
        registered.add(name);
        if (isBuiltInMetric(name) || declared.has(name)) continue;
        const parsed = parseDeclaredMetric(name);
        if (parsed?.owner === "instrument") problem(`evals/${file}`, `pre-registers "${name}", an instrument's metric, and no instrument record declares it: the instrument record kind does not exist yet (open questions §4)`);
        else {
          const owner = out.workloads.find((w) => w.name === parsed?.id);
          problem(`evals/${file}`, `pre-registers "${name}", which ${owner ? `workload "${owner.name}" does not declare (it declares ${owner.metrics?.length ? owner.metrics.map((m) => m.name).join(", ") : "no metrics"})` : `no workload declares (no workload "${parsed?.id}")`}`);
        }
      }
      const targets = optimisedMetrics(value.metrics);
      if (targets.length > 1) problem(`evals/${file}`, `marks ${targets.length} metrics optimise (${targets.join(", ")}): at most one declared metric is the optimisation target, and every other is reported only`);
      for (const target of targets) if (isBuiltInMetric(target)) problem(`evals/${file}`, `marks "${target}" optimise, but a built-in is reported only: only a declared metric may be the optimisation target`);
      for (const task of value.tasks) {
        try { await readFile(path.join(dir, task)); } catch { problem(`evals/${file}`, `task "${task}" does not exist`); }
      }
      try { await readdir(path.join(dir, value.fixture)); } catch { problem(`evals/${file}`, `fixture "${value.fixture}" does not exist`); }
    } catch (error) {
      problem(`evals/${file}`, (error as Error).message);
    }
  }
  for (const file of await jsonFiles(path.join(dir, "evals", "reports"))) {
    try {
      const value: unknown = JSON.parse(await readFile(path.join(dir, "evals", "reports", file), "utf8"));
      assertValid(EvalReportSchema, value, `eval report ${file}`);
      out.reports.push(value);
      if (!out.evals.some((s) => s.name === value.suite.name)) problem(`evals/reports/${file}`, `reports on suite "${value.suite.name}", which evals/ does not declare`);
      // A report over the declared suite version says the same optimisation target the suite marks: what a run was selected on is not the report's to choose.
      const declaredSuite = out.evals.find((s) => s.name === value.suite.name && s.version === value.suite.version);
      if (declaredSuite && (optimisedMetrics(declaredSuite.metrics)[0] ?? undefined) !== value.suite.optimise) problem(`evals/reports/${file}`, `says the optimisation target was ${value.suite.optimise ? `"${value.suite.optimise}"` : "none"}, but suite ${value.suite.name} v${value.suite.version} marks ${optimisedMetrics(declaredSuite.metrics)[0] ? `"${optimisedMetrics(declaredSuite.metrics)[0]}"` : "none"}`);
      // The number is never the conclusion: a committed report without a person's reading of it is a table, not evidence.
      if (isUninterpreted(value)) problem(`evals/reports/${file}`, `carries the placeholder interpretation ("${UNINTERPRETED_MARKER}", by "${value.interpretedBy}"); re-run with --interpretation <file> --by <who>, or do not commit it`);
    } catch (error) {
      problem(`evals/reports/${file}`, (error as Error).message);
    }
  }

  // Who writes it (#110): a directory of the definition that no class of DEFINITION_WRITERS declares is refused, so a
  // new kind of definition file is declared — with the path an accepted proposal against it takes — before anything reads it.
  let entries: Array<{ name: string; isDirectory(): boolean }> = [];
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { entries = []; }
  for (const entry of entries.filter((e) => e.isDirectory() && !e.name.startsWith(".") && !NOT_DEFINITION_DIRS.has(e.name)).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!definitionClassOf(entry.name)) problem(`${entry.name}/`, `is a definition directory in no class of DEFINITION_WRITERS (${DEFINITION_WRITERS.map((w) => w.class).join(", ")}): declare who writes it, and through which path, before anything reads it`);
  }
  return out;
}
