/**
 * The lab's routing policy: which messages become obligations, for whom,
 * and which open obligations veto a unit's progression — declared in
 * `policies/routing.json` and validated on load (lesson 11). Versioned on
 * its own so an obligation can cite exactly the rule that opened it.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { RoutingPolicySchema, assertValid, type RoutingPolicy } from "@metacoding/vsm-pi-protocol";
import { LAB_ROOT } from "./workload.js";

export const ROUTING_POLICY_PATH = path.join(LAB_ROOT, "policies", "routing.json");

export async function loadRoutingPolicy(file: string = ROUTING_POLICY_PATH): Promise<RoutingPolicy> {
  const value: unknown = JSON.parse(await readFile(file, "utf8"));
  assertValid(RoutingPolicySchema, value, `routing policy ${path.basename(file)}`);
  return value;
}
