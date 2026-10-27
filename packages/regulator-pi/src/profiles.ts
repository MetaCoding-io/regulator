/**
 * Checkpoint 3 — capability profiles and the advisory layer (lesson 04).
 *
 * A profile is applied through documented Pi APIs and nothing else:
 *
 *   pi.setActiveTools      the tool surface (positive grant, level 3)
 *   tool_call              writes outside the profile's paths are refused (level 2)
 *   before_agent_start     the profile's advice joins the system prompt (level 5), read
 *                          from the instance's copy `regulator/advice/<profile>.md` on
 *                          each session (#110) and cut at the budget policy's
 *                          `advice.maxChars` the way the identity is at its limit
 *   pi.setThinkingLevel    the reasoning budget
 *
 * Select a profile with `--profile <name>` at startup or `/profile <name>`
 * during a session. Load this checkpoint together with checkpoint 2 so the
 * typed tools it names exist:
 *
 *   pi -e ../dist/tools.js -e ../dist/profiles.js
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isToolCallEventType, type ExtensionAPI, type ExtensionContext, type ToolCallEventResult } from "@earendil-works/pi-coding-agent";
import { isPolicyDefinition, type CapabilityProfile } from "@metacoding.io/regulator-protocol";
import { adviceContextBudget, adviceFileName, adviceMaxChars, isWritableUnder, renderProfileSection } from "@metacoding.io/regulator-core";
import type { Exec } from "@metacoding.io/regulator";
import { readManifest } from "@metacoding.io/regulator";
import { isProfileName, PROFILES, type ProfileName } from "@metacoding.io/regulator";
import { ADVICE_RELATIVE_DIR, LAB_ROOT, POLICY_PATH, baseRoot, declaredEffects, loadDeclaredToolsSync } from "@metacoding.io/regulator";

export const PROFILE_SECTION_TAG = "regulator_profile";

export interface ProfilesExtensionOptions {
  defaultProfile?: ProfileName;
}

type ThinkingLevel = Parameters<ExtensionAPI["setThinkingLevel"]>[0];

export function createProfilesExtension(options: ProfilesExtensionOptions = {}): (pi: ExtensionAPI) => void {
  const defaultProfile = options.defaultProfile ?? "implement";
  // The workload-declared tools' effects (#121): the section says which granted ones the gate derives a consent for.
  const declared = declaredEffects(loadDeclaredToolsSync(LAB_ROOT));

  return (pi) => {
    let current: CapabilityProfile = PROFILES[defaultProfile];
    /** The project's writable prefixes as a person declared them at init (lesson 15); undefined means the profile's own. */
    let declaredWritable: string[] | undefined;
    /** The instance's advice file for the current profile (#110), read from the working tree the unit sees; undefined outside an instance that carries one. */
    let advice: string | undefined;
    /** The budget policy's `advice.maxChars`, or the default: read with the policy the budget extension reads. */
    let maxChars = adviceMaxChars();
    /** Whether this session has already said its advice is cut: once per session, not per turn. */
    let truncationSignalled = false;
    let cwd = "";
    const exec: Exec = async (command, args, execOptions) => {
      const result = await pi.exec(command, args, execOptions?.cwd ? { cwd: execOptions.cwd } : {});
      return { stdout: result.stdout, stderr: result.stderr, code: result.code };
    };

    pi.registerFlag("profile", {
      description: `Capability profile to start in (${Object.keys(PROFILES).join(", ")})`,
      type: "string",
      default: defaultProfile,
    });

    pi.registerCommand("profile", {
      description: "Show or switch the capability profile: /profile [name]",
      handler: async (args, ctx) => {
        const name = args.trim();
        if (!name) {
          ctx.ui.notify(`profile: ${current.name} — ${current.description}`, "info");
          return;
        }
        if (!isProfileName(name)) {
          ctx.ui.notify(`Unknown profile "${name}". Known: ${Object.keys(PROFILES).join(", ")}`, "error");
          return;
        }
        await apply(PROFILES[name], ctx);
      },
    });

    pi.on("session_start", async (_event, ctx) => {
      const flag = pi.getFlag("profile");
      const name = typeof flag === "string" && isProfileName(flag) ? flag : defaultProfile;
      declaredWritable = undefined;
      cwd = ctx.cwd;
      truncationSignalled = false;
      maxChars = adviceMaxChars();
      try {
        const policyFlag = pi.getFlag("policy");
        const policyPath = (typeof policyFlag === "string" && policyFlag) || process.env.REGULATOR_POLICY || POLICY_PATH;
        const value: unknown = JSON.parse(await readFile(policyPath, "utf8"));
        if (isPolicyDefinition(value)) maxChars = adviceMaxChars(value);
      } catch { /* no policy readable here: the default limit applies, and the budget extension says so about the policy */ }
      try {
        const manifest = await readManifest(await baseRoot(exec, ctx.cwd));
        if (manifest?.writablePaths) declaredWritable = [...manifest.writablePaths];
      } catch {
        declaredWritable = undefined;
      }
      await apply(PROFILES[name], ctx);
    });

    // Level 5: the profile's advice rides along as a system-prompt section, from the instance's file (#110), cut at the
    // policy's limit with the cut said once. Pi diffs sections, so a stable section is a cache-friendly patch, not a rewrite.
    pi.on("before_agent_start", (event, ctx) => {
      event.systemPromptOptions.sections[PROFILE_SECTION_TAG] = advice === undefined ? renderProfileSection(current, { declared }) : renderProfileSection(current, { advice, maxChars, declared });
      const budget = advice === undefined ? undefined : adviceContextBudget(current.name, advice, maxChars);
      if (budget?.warning && !truncationSignalled) {
        truncationSignalled = true;
        ctx.ui.notify(`regulator: ${budget.warning}`, "warning");
      }
      return undefined;
    });

    // Level 2: the positive grant, enforced. Not the model's decision.
    pi.on("tool_call", (event): ToolCallEventResult | undefined => {
      if (isToolCallEventType("write", event) || isToolCallEventType("edit", event)) {
        if (!isWritableUnder(current, event.input.path)) {
          const writable = current.writablePaths.length ? current.writablePaths.join(", ") : "nothing (read-only profile)";
          return {
            block: true,
            reason: `regulator: profile "${current.name}" may write under ${writable}; "${event.input.path}" is outside that. Switch profiles with /profile if the work genuinely needs it.`,
          };
        }
      }
      return undefined;
    });

    async function apply(profile: CapabilityProfile, ctx: ExtensionContext): Promise<void> {
      // A read-only profile stays read-only whatever the manifest says: the declaration widens a grant, never creates one.
      current = declaredWritable && profile.writablePaths.length ? { ...profile, writablePaths: declaredWritable } : profile;
      // The advice is read from the working tree the unit sees, as the identity is: it is protected there, and the closeout
      // compares it with the base, so what is rendered is what is committed or a finding. No file: the grant alone (or the
      // inline advice a profile still carries during the overlap release).
      advice = await readFile(path.join(cwd || ctx.cwd, ADVICE_RELATIVE_DIR, adviceFileName(profile.name)), "utf8").catch(() => undefined);
      truncationSignalled = false;
      // Level 3: the tool surface. Names the host does not know are dropped, not errors.
      const known = new Set(pi.getAllTools().map((tool) => tool.name));
      pi.setActiveTools(profile.tools.filter((name) => known.has(name)));
      if (profile.thinkingLevel) pi.setThinkingLevel(profile.thinkingLevel as ThinkingLevel);
      const budget = advice === undefined ? undefined : adviceContextBudget(profile.name, advice, maxChars);
      const cut = budget?.truncated ? `; advice truncated at ${budget.max} of ${budget.chars} characters` : "";
      ctx.ui.setStatus("profile", `profile: ${profile.name}${declaredWritable && profile.writablePaths.length ? ` (writes under ${declaredWritable.join(", ")} by the instance manifest)` : ""}${cut}`);
    }
  };
}

export default createProfilesExtension();
