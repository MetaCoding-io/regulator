/**
 * The one Pi-shaped step of the loop: run a session for a unit through the
 * Pi SDK, in the unit's worktree, with checkpoints 2–5 loaded and the unit,
 * profile and contract supplied as extension flags. The session is persisted
 * under Pi's session directory so the typed entries (contract, report)
 * survive; the orchestrator still reads the report from its own store.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAgentSession, DefaultResourceLoader, getAgentDir, SessionManager } from "@earendil-works/pi-coding-agent";
import type { Dispatcher } from "./controller.js";

const dist = fileURLToPath(new URL("./", import.meta.url));
export const CHECKPOINT_EXTENSIONS = ["cp2-typed-tools.js", "cp3-profiles.js", "cp4-coordination.js", "cp5-contract.js"].map((f) => path.join(dist, f));

export interface PiDispatcherOptions {
  /** Echo the model's text to stdout as it streams. */
  echo?: boolean;
}

export function piDispatcher(options: PiDispatcherOptions = {}): Dispatcher {
  return async ({ worktree, unitId, contract, contractPath, profile }) => {
    const agentDir = getAgentDir();
    const resourceLoader = new DefaultResourceLoader({ cwd: worktree, agentDir, additionalExtensionPaths: CHECKPOINT_EXTENSIONS });
    await resourceLoader.reload();
    const { errors, runtime } = resourceLoader.getExtensions();
    if (errors.length) throw new Error(`extension load errors: ${errors.map((e) => `${e.path}: ${e.error}`).join("; ")}`);
    // The same values `pi --unit … --profile … --contract …` would set on the command line.
    for (const [name, value] of [["unit", unitId], ["profile", profile], ["contract", contractPath]] as const) runtime.flagValues.set(name, value);
    const { session } = await createAgentSession({ cwd: worktree, agentDir, resourceLoader, sessionManager: SessionManager.create(worktree) });
    try {
      if (options.echo) {
        session.subscribe((event) => {
          if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") process.stdout.write(event.assistantMessageEvent.delta);
        });
      }
      await session.prompt(contract.objective);
      if (options.echo) process.stdout.write("\n");
      return { sessionId: session.sessionId };
    } finally {
      session.dispose();
    }
  };
}
