/**
 * The lab's intelligence policy (#123): the sensors `regulator watch` runs,
 * declared in `policies/intelligence.json` and validated on load. A
 * definition without the file declares no sensors, and the watcher runs
 * none; the definition check reads the file when it exists.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { IntelligencePolicySchema, assertValid, type IntelligencePolicy } from "@metacoding.io/regulator-protocol";
import { LAB_ROOT } from "./workload.js";

export const INTELLIGENCE_POLICY_PATH = path.join(LAB_ROOT, "policies", "intelligence.json");

export async function loadIntelligencePolicy(file: string = INTELLIGENCE_POLICY_PATH): Promise<IntelligencePolicy> {
  const value: unknown = JSON.parse(await readFile(file, "utf8"));
  assertValid(IntelligencePolicySchema, value, `intelligence policy ${path.basename(file)}`);
  return value;
}

/** The policy when the file exists, else undefined: an instance may run under a definition that declares no sensors. */
export async function loadIntelligencePolicyIfPresent(file: string = INTELLIGENCE_POLICY_PATH): Promise<IntelligencePolicy | undefined> {
  try {
    await readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  return loadIntelligencePolicy(file);
}
