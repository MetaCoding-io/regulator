/**
 * The lab's workload definition: the software-development autoloop, declared
 * in `workload/software-development.json` and validated on load. The loop in
 * `controller.ts` knows nothing about software; it asks the workload which
 * profile a unit type runs under.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WorkloadDefinitionSchema, assertValid, type UnitType, type WorkloadDefinition } from "@metacoding.io/regulator-protocol";

export const LAB_ROOT = fileURLToPath(new URL("../", import.meta.url));
export const WORKLOAD_PATH = path.join(LAB_ROOT, "workload", "software-development.json");

export async function loadWorkload(file: string = WORKLOAD_PATH): Promise<WorkloadDefinition> {
  const value: unknown = JSON.parse(await readFile(file, "utf8"));
  assertValid(WorkloadDefinitionSchema, value, `workload ${path.basename(file)}`);
  return value;
}

export function workloadPath(name: string, root: string = LAB_ROOT): string {
  return path.join(root, "workload", `${name}.json`);
}

/** The workload a contract names, from the definition's `workload/` directory: the loop is generic over workloads, so the contract says which one (lesson 06; the second workload arrives with the worked example). */
export async function loadWorkloadFor(name: string, root: string = LAB_ROOT): Promise<WorkloadDefinition> {
  const file = workloadPath(name, root);
  let workload: WorkloadDefinition;
  try {
    workload = await loadWorkload(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`the definition declares no workload "${name}" (no ${path.relative(root, file)})`);
    throw error;
  }
  if (workload.name !== name) throw new Error(`${path.relative(root, file)} declares workload "${workload.name}", not "${name}"; the file name must match`);
  return workload;
}

export function unitTypeOf(workload: WorkloadDefinition, name: string): UnitType | undefined {
  return workload.unitTypes.find((type) => type.name === name);
}
