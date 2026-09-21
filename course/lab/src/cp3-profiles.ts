/**
 * Checkpoint 3 — capability profiles and the advisory layer (lesson 04).
 *
 * A profile is applied through documented Pi APIs and nothing else:
 *
 *   pi.setActiveTools      the tool surface (positive grant, level 3)
 *   tool_call              writes outside the profile's paths are refused (level 2)
 *   before_agent_start     the profile's advice joins the system prompt (level 5)
 *   pi.setThinkingLevel    the reasoning budget
 *
 * Select a profile with `--profile <name>` at startup or `/profile <name>`
 * during a session. Load this checkpoint together with checkpoint 2 so the
 * typed tools it names exist:
 *
 *   pi -e ../dist/cp2-typed-tools.js -e ../dist/cp3-profiles.js
 */
import { isToolCallEventType, type ExtensionAPI, type ExtensionContext, type ToolCallEventResult } from "@earendil-works/pi-coding-agent";
import { isProfileName, isWritableUnder, PROFILES, renderProfileSection, type CapabilityProfile, type ProfileName } from "./profiles.js";

export const PROFILE_SECTION_TAG = "regulator_profile";

export interface ProfilesExtensionOptions {
  defaultProfile?: ProfileName;
}

type ThinkingLevel = Parameters<ExtensionAPI["setThinkingLevel"]>[0];

export function createProfilesExtension(options: ProfilesExtensionOptions = {}): (pi: ExtensionAPI) => void {
  const defaultProfile = options.defaultProfile ?? "implement";

  return (pi) => {
    let current: CapabilityProfile = PROFILES[defaultProfile];

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
        apply(PROFILES[name], ctx);
      },
    });

    pi.on("session_start", (_event, ctx) => {
      const flag = pi.getFlag("profile");
      const name = typeof flag === "string" && isProfileName(flag) ? flag : defaultProfile;
      apply(PROFILES[name], ctx);
    });

    // Level 5: the profile's advice rides along as a system-prompt section. Pi
    // diffs sections, so a stable section is a cache-friendly patch, not a rewrite.
    pi.on("before_agent_start", (event) => {
      event.systemPromptOptions.sections[PROFILE_SECTION_TAG] = renderProfileSection(current);
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

    function apply(profile: CapabilityProfile, ctx: ExtensionContext): void {
      current = profile;
      // Level 3: the tool surface. Names the host does not know are dropped, not errors.
      const known = new Set(pi.getAllTools().map((tool) => tool.name));
      pi.setActiveTools(profile.tools.filter((name) => known.has(name)));
      if (profile.thinkingLevel) pi.setThinkingLevel(profile.thinkingLevel as ThinkingLevel);
      ctx.ui.setStatus("profile", `profile: ${profile.name}`);
    }
  };
}

export default createProfilesExtension();
