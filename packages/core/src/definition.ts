/**
 * The definition check (lesson 12): a control plane is declared, not
 * assembled, so the declaration is checked as a whole. Profiles, the
 * workload, the policies and the identity are each validated, and the
 * references between them must resolve — a unit type's profile exists, a
 * policy's unit types exist, a check name is one the host runs, the identity
 * set is complete. The registry has its own check; this is the rest.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  CapabilityProfileSchema, EvalReportSchema, EvalSuiteSchema, HOST_CHECK_NAMES, PolicyDefinitionSchema, UNINTERPRETED_MARKER, WorkloadDefinitionSchema, assertValid, isInteractionPolicy, isPolicyDefinition, isRecoveryPolicy, isRoutingPolicy, isUninterpreted,
  type CapabilityProfile, type EvalReport, type EvalSuite, type InteractionPolicy, type PolicyDefinition, type RecoveryPolicy, type RoutingPolicy, type WorkloadDefinition,
} from "@metacoding.io/regulator-protocol";
import { readIdentity, type IdentitySet } from "./identity.js";
import { readOnlyViolations } from "./effects.js";
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
  /** Eval suites under evals/ and committed reports under evals/reports/ (lesson 14). */
  evals: EvalSuite[];
  reports: EvalReport[];
  problems: DefinitionProblem[];
}

async function jsonFiles(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }
}

export async function checkDefinition(dir: string): Promise<CheckedDefinition> {
  const out: CheckedDefinition = { dir, profiles: [], workloads: [], policies: [], recovery: [], routing: [], interaction: [], identity: await readIdentity(path.join(dir, "identity")), evals: [], reports: [], problems: [] };
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
        for (const check of type.checks) {
          if (!(HOST_CHECK_NAMES as readonly string[]).includes(check)) problem(`workload/${file}`, `unit type "${type.name}" names check "${check}", which the host does not run (known: ${HOST_CHECK_NAMES.join(", ")})`);
        }
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
        for (const check of arm.checks) if (!(HOST_CHECK_NAMES as readonly string[]).includes(check)) problem(`evals/${file}`, `arm "${arm.name}" names check "${check}", which the host does not run`);
        if (arm.ablates && !arm.switch) problem(`evals/${file}`, `arm "${arm.name}" ablates ${arm.ablates} but names no switch`);
        if (arm.switch?.startsWith("check:") && arm.checks.includes(arm.switch.slice("check:".length))) problem(`evals/${file}`, `arm "${arm.name}" switches off ${arm.switch} but still runs that check`);
      }
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
      // The number is never the conclusion: a committed report without a person's reading of it is a table, not evidence.
      if (isUninterpreted(value)) problem(`evals/reports/${file}`, `carries the placeholder interpretation ("${UNINTERPRETED_MARKER}", by "${value.interpretedBy}"); re-run with --interpretation <file> --by <who>, or do not commit it`);
    } catch (error) {
      problem(`evals/reports/${file}`, (error as Error).message);
    }
  }
  return out;
}
