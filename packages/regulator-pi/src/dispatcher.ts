/**
 * The one Pi-shaped step of the loop: run a session for a unit through the
 * Pi SDK, in the unit's worktree, with checkpoints 2–10 loaded and the unit,
 * profile, contract and policy supplied as extension flags. The session is
 * persisted under Pi's session directory so the typed entries (contract,
 * report) survive; the orchestrator still reads the report from its own
 * store.
 *
 * Model routing (lesson 07): the policy's route for the unit type is
 * filtered by what is actually available; the first candidate runs, and a
 * provider failure moves to the next declared fallback in a fresh session.
 * Nothing outside the route is ever tried.
 *
 * The trust rule (lesson 10): the session loads the definition's checkpoints
 * and nothing else. The SDK's resource loader discovers a project's own
 * `.pi/extensions`, skills, prompt templates and themes from `cwd` without
 * asking anyone — the `project_trust` event is the CLI's, not the loader's —
 * so `definitionResourceLoader` turns project resources off and keeps only
 * the extensions the definition names. A unit's project is data, never a
 * source of control. Since lesson 12 the same rule covers context files and
 * settings: the session reads no `AGENTS.md` from the worktree and no
 * `.pi/settings.json` — the identity comes from checkpoint 11, the settings
 * from the definition's `settings.json`, held in memory.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createAgentSession, DefaultResourceLoader, getAgentDir, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { chooseModels } from "@metacoding.io/regulator-core";
import { LAB_ROOT, type Dispatcher, type Host, type HostDispatcherOptions } from "@metacoding.io/regulator";

const dist = fileURLToPath(new URL("./", import.meta.url));
export const SETTINGS_PATH = path.join(LAB_ROOT, "settings.json");

/** The definition's settings, in memory: nothing the project's `.pi/settings.json` says reaches a unit's session. */
export async function definitionSettings(file: string = SETTINGS_PATH): Promise<SettingsManager> {
  const value: unknown = JSON.parse(await readFile(file, "utf8"));
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`settings ${file} must be an object`);
  return SettingsManager.inMemory(value as Parameters<typeof SettingsManager.inMemory>[0]);
}
/** The session extensions this host loads for a unit, by name, in load order. */
export const EXTENSIONS = ["tools", "profiles", "coordination", "contract", "budget", "recovery", "evidence", "authority", "intelligence", "identity", "algedonic"] as const;
/** The absolute path of a named extension's built module. */
export function extensionPath(name: string): string { return path.join(dist, `${name}.js`); }
export const CHECKPOINT_EXTENSIONS = EXTENSIONS.map(extensionPath);

export interface PiDispatcherOptions {
  /** Echo the model's text to stdout as it streams. */
  echo?: boolean;
  /** The extensions to load instead of the host's full list: an eval arm (lesson 14). */
  extensionPaths?: readonly string[];
}

export interface DefinitionLoaderOptions {
  cwd: string;
  agentDir: string;
  /** The extensions the definition declares; every other discovered extension is refused. */
  extensionPaths?: readonly string[];
  settingsManager?: SettingsManager;
}

export interface DefinitionLoader {
  loader: DefaultResourceLoader;
  /** Extensions the loader discovered and this rule kept out, by path. */
  refused: string[];
}

/** A resource loader that trusts the definition and nothing found in the project: no extensions, skills, prompts, themes or context files from the worktree. */
export function definitionResourceLoader(options: DefinitionLoaderOptions): DefinitionLoader {
  const allowed = new Set((options.extensionPaths ?? CHECKPOINT_EXTENSIONS).map((p) => path.resolve(p)));
  const refused: string[] = [];
  const loader = new DefaultResourceLoader({
    cwd: options.cwd, agentDir: options.agentDir, additionalExtensionPaths: [...allowed],
    ...(options.settingsManager ? { settingsManager: options.settingsManager } : {}),
    noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
    extensionsOverride: (base) => {
      const kept = base.extensions.filter((e) => {
        const ok = allowed.has(path.resolve(e.resolvedPath)) || allowed.has(path.resolve(e.path));
        if (!ok) refused.push(e.path);
        return ok;
      });
      return { ...base, extensions: kept };
    },
  });
  return { loader, refused };
}

export function piDispatcher(options: PiDispatcherOptions = {}): Dispatcher {
  return async ({ worktree, unitId, contract, contractPath, profile, route, policyPath, hint }) => {
    const agentDir = getAgentDir();
    const modelRuntime = await ModelRuntime.create();
    const available = (await modelRuntime.getAvailable()).map((m) => `${m.provider}/${m.id}`);
    const candidates = chooseModels(route, available);
    if (!candidates.length) {
      throw new Error(`no model in the route is available: ${[route.primary, ...route.fallback].join(", ")} (available: ${available.join(", ") || "none"})`);
    }
    let lastError: string | undefined;
    for (const ref of candidates) {
      const slash = ref.indexOf("/");
      const model = modelRuntime.getModel(ref.slice(0, slash), ref.slice(slash + 1));
      if (!model) continue;
      const settingsManager = await definitionSettings();
      const { loader: resourceLoader, refused } = definitionResourceLoader({ cwd: worktree, agentDir, settingsManager, ...(options.extensionPaths ? { extensionPaths: options.extensionPaths } : {}) });
      await resourceLoader.reload();
      const { errors, runtime } = resourceLoader.getExtensions();
      if (errors.length) throw new Error(`extension load errors: ${errors.map((e) => `${e.path}: ${e.error}`).join("; ")}`);
      if (refused.length && options.echo) process.stdout.write(`[regulator] refused ${refused.length} extension(s) the definition does not declare: ${refused.join(", ")}\n`);
      // The same values `pi --unit … --profile … --contract … --policy …` would set on the command line.
      // (Checkpoint 6 reads none of the first three: it finds the unit from the lease and the contract from the store.)
      for (const [name, value] of [["unit", unitId], ["profile", profile], ["contract", contractPath], ["policy", policyPath]] as const) runtime.flagValues.set(name, value);
      const { session } = await createAgentSession({ cwd: worktree, agentDir, model, modelRuntime, resourceLoader, settingsManager, sessionManager: SessionManager.create(worktree) });
      try {
        if (options.echo) {
          process.stdout.write(`[regulator] unit ${unitId} on ${ref}\n`);
          session.subscribe((event) => {
            if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") process.stdout.write(event.assistantMessageEvent.delta);
          });
        }
        await session.prompt(hint ? `${contract.objective}\n\nFrom the orchestrator, about your previous attempt: ${hint}` : contract.objective);
        if (options.echo) process.stdout.write("\n");
        const last = [...session.messages].reverse().find((m) => m.role === "assistant");
        if (last && last.role === "assistant" && last.stopReason === "error") {
          lastError = last.errorMessage ?? "provider error";
          if (options.echo) process.stdout.write(`[regulator] ${ref} failed: ${lastError}; trying the next declared fallback\n`);
          continue;
        }
        return { sessionId: session.sessionId };
      } finally {
        session.dispose();
      }
    }
    throw new Error(`every model in the route failed; last error: ${lastError ?? "unknown"}`);
  };
}

const ownPackage = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { name: string; peerDependencies?: Record<string, string> };

/** What the control plane resolves by name: this package as a regulator host. */
export const host: Host = {
  name: ownPackage.name,
  runtime: { name: "@earendil-works/pi-coding-agent", pin: ownPackage.peerDependencies?.["@earendil-works/pi-coding-agent"] ?? "unknown" },
  extensions: EXTENSIONS,
  extensionPath,
  dispatcher: (options: HostDispatcherOptions = {}) => piDispatcher({ ...(options.echo === undefined ? {} : { echo: options.echo }), ...(options.extensions ? { extensionPaths: options.extensions.map(extensionPath) } : {}) }),
};
