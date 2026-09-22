/**
 * The definition's capability profiles, declared as files under `profiles/`
 * and validated on load (lesson 12). The profile type, the effect
 * declarations and the checks (`isWritableUnder`, `isReadOnlyProfile`,
 * `renderProfileSection`) ship in VSM-Pi's packages; the lab only declares
 * the profiles it uses. Loaded synchronously so the checkpoints can bind the
 * default at registration time.
 *
 * Model bindings live in the policy (lesson 07); the identity and memory a
 * profile's session carries come from checkpoint 11, not from the profile.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CapabilityProfileSchema, assertValid, type CapabilityProfile } from "@metacoding/vsm-pi-protocol";

export type { CapabilityProfile } from "@metacoding/vsm-pi-protocol";
export { isReadOnlyProfile, isWritableUnder, renderProfileSection } from "@metacoding/vsm-pi-core";

export const PROFILES_DIR = fileURLToPath(new URL("../profiles/", import.meta.url));
/** The names the workload and the checkpoints rely on; the definition check refuses a workload that names another. */
export type ProfileName = "research" | "intelligence" | "implement";

export function loadProfilesSync(dir: string = PROFILES_DIR): Record<string, CapabilityProfile> {
  const profiles: Record<string, CapabilityProfile> = {};
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const value: unknown = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
    assertValid(CapabilityProfileSchema, value, `profile ${file}`);
    profiles[value.name] = value;
  }
  return profiles;
}

const loaded = loadProfilesSync();
for (const name of ["research", "intelligence", "implement"] as const) {
  if (!loaded[name]) throw new Error(`profiles/${name}.json is missing from the definition`);
}
export const PROFILES = loaded as Record<ProfileName, CapabilityProfile> & Record<string, CapabilityProfile>;

export function isProfileName(name: string): name is ProfileName {
  return Object.hasOwn(PROFILES, name);
}
