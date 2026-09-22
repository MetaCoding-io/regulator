/**
 * The lab's workload definition: the software-development autoloop, declared
 * in `workload/software-development.json` and validated on load. The loop in
 * `controller.ts` knows nothing about software; it asks the workload which
 * profile a unit type runs under.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WorkloadDefinitionSchema, assertValid, type UnitType, type WorkloadDefinition } from "@metacoding/vsm-pi-protocol";

export const LAB_ROOT = fileURLToPath(new URL("../", import.meta.url));
export const WORKLOAD_PATH = path.join(LAB_ROOT, "workload", "software-development.json");

export async function loadWorkload(file: string = WORKLOAD_PATH): Promise<WorkloadDefinition> {
  const value: unknown = JSON.parse(await readFile(file, "utf8"));
  assertValid(WorkloadDefinitionSchema, value, `workload ${path.basename(file)}`);
  return value;
}

export function unitTypeOf(workload: WorkloadDefinition, name: string): UnitType | undefined {
  return workload.unitTypes.find((type) => type.name === name);
}
