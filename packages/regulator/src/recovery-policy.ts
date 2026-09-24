/**
 * The lab's recovery policy: cause → actions by occurrence, declared in
 * `policies/recovery.json` and validated on load. Versioned separately from
 * the budget policy so a recovery decision can cite exactly the rules that
 * produced it.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { RecoveryPolicySchema, assertValid, type RecoveryPolicy } from "@metacoding/regulator-protocol";
import { LAB_ROOT } from "./workload.js";

export const RECOVERY_POLICY_PATH = path.join(LAB_ROOT, "policies", "recovery.json");

export async function loadRecoveryPolicy(file: string = RECOVERY_POLICY_PATH): Promise<RecoveryPolicy> {
  const value: unknown = JSON.parse(await readFile(file, "utf8"));
  assertValid(RecoveryPolicySchema, value, `recovery policy ${path.basename(file)}`);
  return value;
}
