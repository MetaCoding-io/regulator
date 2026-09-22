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
  CapabilityProfileSchema, HOST_CHECK_NAMES, PolicyDefinitionSchema, WorkloadDefinitionSchema, assertValid, isInteractionPolicy, isPolicyDefinition, isRecoveryPolicy, isRoutingPolicy,
  type CapabilityProfile, type InteractionPolicy, type PolicyDefinition, type RecoveryPolicy, type RoutingPolicy, type WorkloadDefinition,
} from "@metacoding/vsm-pi-protocol";
import { readIdentity, type IdentitySet } from "./identity.js";
import { readOnlyViolations } from "./effects.js";

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
  const out: CheckedDefinition = { dir, profiles: [], workloads: [], policies: [], recovery: [], routing: [], interaction: [], identity: await readIdentity(path.join(dir, "identity")), problems: [] };
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
        if (!out.profiles.some((p) => p.name === type.profile)) problem(`workload/${file}`, `unit type "${type.name}" runs under profile "${type.profile}", which is not declared under profiles/`);
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
  return out;
}
