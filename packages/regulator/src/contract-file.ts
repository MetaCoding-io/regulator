/**
 * A work contract as a file: read, schema-validated and checked before anything runs under it. Pi-free; the session
 * extension that loads the contract into a session (regulator-pi) and the loop both use it.
 */
import { readFile } from "node:fs/promises";
import { checkContract } from "@metacoding/vsm-pi-core";
import { WorkContractSchema, assertValid, type WorkContract } from "@metacoding/vsm-pi-protocol";

export async function loadContract(file: string): Promise<WorkContract> {
  const value: unknown = JSON.parse(await readFile(file, "utf8"));
  assertValid(WorkContractSchema, value, "work contract");
  const problems = checkContract(value);
  if (problems.length) throw new Error(problems.map((p) => `${p.path}: ${p.message}`).join("; "));
  return value;
}
