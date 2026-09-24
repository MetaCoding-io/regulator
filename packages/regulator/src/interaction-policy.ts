/**
 * The lab's interaction policy: timeouts per interaction kind, the attention
 * budget, the reminder interval and the people who may disposition what —
 * declared in `policies/interaction.json` and validated on load (lesson 13).
 * What a timeout means is not in it: the protocol fixes that.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { InteractionPolicySchema, assertValid, type InteractionPolicy } from "@metacoding/vsm-pi-protocol";
import { LAB_ROOT } from "./workload.js";

export const INTERACTION_POLICY_PATH = path.join(LAB_ROOT, "policies", "interaction.json");

export async function loadInteractionPolicy(file: string = INTERACTION_POLICY_PATH): Promise<InteractionPolicy> {
  const value: unknown = JSON.parse(await readFile(file, "utf8"));
  assertValid(InteractionPolicySchema, value, `interaction policy ${path.basename(file)}`);
  return value;
}
