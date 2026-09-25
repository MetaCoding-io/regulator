/** Shared helpers for the lab's headless tests. Not part of any checkpoint. */
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TestContext } from "node:test";
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { LAB_ROOT, realExec } from "@metacoding.io/regulator";

export type Handler = (event: unknown, ctx: unknown) => unknown;

export interface MockPi {
  pi: ExtensionAPI;
  handlers: Map<string, Handler>;
  tools: Map<string, ToolDefinition>;
  commands: Map<string, { handler: (args: string, ctx: unknown) => unknown }>;
  flags: Map<string, boolean | string | undefined>;
  activeTools: string[][];
  thinkingLevels: string[];
  entries: { customType: string; data: unknown }[];
}

/** A `pi` that records registrations and runs `exec` for real. No session, no model. */
export function mockPi(allToolNames: string[] = ["read", "write", "edit", "bash", "grep", "find", "ls"]): MockPi {
  const state: MockPi = {
    pi: undefined as unknown as ExtensionAPI,
    handlers: new Map(),
    tools: new Map(),
    commands: new Map(),
    flags: new Map(),
    activeTools: [],
    thinkingLevels: [],
    entries: [],
  };
  state.pi = {
    on: (name: string, handler: Handler) => state.handlers.set(name, handler),
    registerTool: (definition: ToolDefinition) => state.tools.set(definition.name, definition),
    registerCommand: (name: string, options: { handler: (args: string, ctx: unknown) => unknown }) => state.commands.set(name, options),
    // A value set before registration stands in for a CLI-provided flag; the default fills the gap.
    registerFlag: (name: string, options: { default?: boolean | string }) => { if (!state.flags.has(name)) state.flags.set(name, options.default); },
    getFlag: (name: string) => state.flags.get(name),
    getAllTools: () => [...allToolNames, ...state.tools.keys()].map((name) => ({ name })),
    setActiveTools: (names: string[]) => state.activeTools.push(names),
    // The surface as last set; every tool until something sets it, as in Pi.
    getActiveTools: () => state.activeTools.at(-1) ?? [...allToolNames, ...state.tools.keys()],
    setThinkingLevel: (level: string) => state.thinkingLevels.push(level),
    exec: realExec,
    appendEntry: (customType: string, data: unknown) => state.entries.push({ customType, data }),
  } as unknown as ExtensionAPI;
  return state;
}

export { realExec } from "@metacoding.io/regulator";

export interface Dialogs {
  confirm?: (title: string, message: string, opts?: { timeout?: number }) => Promise<boolean>;
  select?: (title: string, options: string[], opts?: { timeout?: number }) => Promise<string | undefined>;
  input?: (title: string, placeholder?: string, opts?: { timeout?: number }) => Promise<string | undefined>;
}

export function ctxFor(cwd: string, options: { model?: { provider: string; id: string }; hasUI?: boolean; mode?: string; dialogs?: Dialogs } = {}) {
  const notices: { message: string; level: string }[] = [];
  const statuses: Record<string, string> = {};
  const state = { aborts: 0 };
  const noDialog = async () => { throw new Error("no dialog in this test"); };
  return {
    ctx: {
      cwd,
      hasUI: options.hasUI ?? false,
      mode: options.mode ?? (options.hasUI ? "tui" : "print"),
      ui: {
        notify: (message: string, level: string) => notices.push({ message, level }), setStatus: (key: string, value: string) => { statuses[key] = value; },
        confirm: options.dialogs?.confirm ?? noDialog, select: options.dialogs?.select ?? noDialog, input: options.dialogs?.input ?? noDialog,
      },
      abort: () => { state.aborts++; },
      getContextUsage: () => ({ tokens: null, contextWindow: 200_000, percent: null }),
      model: options.model,
      modelRegistry: { complete: async () => { throw new Error("no model in tests"); } },
    },
    notices,
    statuses,
    state,
  };
}

export const FIXTURE_DIR = path.join(LAB_ROOT, "fixture");

/** A throwaway copy of the fixture project, optionally as a git repo with one commit. */
export async function fixtureCopy(t: TestContext, { git = false } = {}): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-fixture-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await cp(FIXTURE_DIR, dir, { recursive: true });
  await rm(path.join(dir, ".regulator"), { recursive: true, force: true });
  if (git) {
    const run = (...args: string[]) => realExec("git", args, { cwd: dir });
    await run("init", "--quiet");
    await run("-c", "user.name=lab", "-c", "user.email=lab@example.invalid", "-c", "commit.gpgsign=false", "add", ".");
    await run("-c", "user.name=lab", "-c", "user.email=lab@example.invalid", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "fixture");
  }
  return dir;
}
