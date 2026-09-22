/**
 * The lab's policy: budgets and model routes, declared in
 * `policies/default.json` and validated on load. The third part of the
 * definition (registry, workload, policies; profiles still live in code).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PolicyDefinitionSchema, assertValid, type PolicyDefinition } from "@metacoding/vsm-pi-protocol";
import { LAB_ROOT } from "./workload.js";

export const POLICY_PATH = path.join(LAB_ROOT, "policies", "default.json");

export async function loadPolicy(file: string = POLICY_PATH): Promise<PolicyDefinition> {
  const value: unknown = JSON.parse(await readFile(file, "utf8"));
  assertValid(PolicyDefinitionSchema, value, `policy ${path.basename(file)}`);
  return value;
}
