/**
 * The one Pi-shaped step of the loop: run a session for a unit through the
 * Pi SDK, in the unit's worktree, with checkpoints 2–6 loaded and the unit,
 * profile, contract and policy supplied as extension flags. The session is
 * persisted under Pi's session directory so the typed entries (contract,
 * report) survive; the orchestrator still reads the report from its own
 * store.
 *
 * Model routing (lesson 07): the policy's route for the unit type is
 * filtered by what is actually available; the first candidate runs, and a
 * provider failure moves to the next declared fallback in a fresh session.
 * Nothing outside the route is ever tried.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAgentSession, DefaultResourceLoader, getAgentDir, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import { chooseModels } from "@metacoding/vsm-pi-core";
import type { Dispatcher } from "./controller.js";

const dist = fileURLToPath(new URL("./", import.meta.url));
export const CHECKPOINT_EXTENSIONS = ["cp2-typed-tools.js", "cp3-profiles.js", "cp4-coordination.js", "cp5-contract.js", "cp6-budget.js", "cp7-recovery.js", "cp8-evidence.js"].map((f) => path.join(dist, f));

export interface PiDispatcherOptions {
  /** Echo the model's text to stdout as it streams. */
  echo?: boolean;
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
      const resourceLoader = new DefaultResourceLoader({ cwd: worktree, agentDir, additionalExtensionPaths: CHECKPOINT_EXTENSIONS });
      await resourceLoader.reload();
      const { errors, runtime } = resourceLoader.getExtensions();
      if (errors.length) throw new Error(`extension load errors: ${errors.map((e) => `${e.path}: ${e.error}`).join("; ")}`);
      // The same values `pi --unit … --profile … --contract … --policy …` would set on the command line.
      // (Checkpoint 6 reads none of the first three: it finds the unit from the lease and the contract from the store.)
      for (const [name, value] of [["unit", unitId], ["profile", profile], ["contract", contractPath], ["policy", policyPath]] as const) runtime.flagValues.set(name, value);
      const { session } = await createAgentSession({ cwd: worktree, agentDir, model, modelRuntime, resourceLoader, sessionManager: SessionManager.create(worktree) });
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
