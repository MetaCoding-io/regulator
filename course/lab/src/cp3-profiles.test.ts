import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { createProfilesExtension, PROFILE_SECTION_TAG } from "./cp3-profiles.js";
import { isWritableUnder, PROFILES, renderProfileSection } from "./profiles.js";
import { ctxFor, fixtureCopy, mockPi } from "./test-support.js";

test("isWritableUnder is a positive grant: only listed prefixes, fail-closed elsewhere", () => {
  const implement = PROFILES.implement;
  for (const p of ["src/slugify.js", "./src/new.js", "@test/x.test.js", "test\\y.test.js"]) assert.equal(isWritableUnder(implement, p), true, p);
  for (const p of ["README.md", "vendor/left-pad.js", "srcs/x.js", "src/../vendor/x.js", "/etc/passwd", "../x"]) assert.equal(isWritableUnder(implement, p), false, p);
  assert.equal(isWritableUnder(PROFILES.research, "src/slugify.js"), false, "read-only profile grants nothing");
});

test("the profile section is advice, and says the refusal comes from the harness", () => {
  const section = renderProfileSection(PROFILES.implement);
  assert.match(section, /^Active capability profile: implement/);
  assert.match(section, /refused by the harness, not by you/);
  assert.match(renderProfileSection(PROFILES.research), /read-only/);
});

test("research profile: tool surface excludes write/edit/bash and writes are refused structurally", async (t) => {
  const cwd = await fixtureCopy(t);
  const { pi, handlers, flags, activeTools, thinkingLevels } = mockPi();
  flags.set("profile", "research");
  createProfilesExtension()(pi);
  const { ctx, statuses } = ctxFor(cwd);

  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
  const active = activeTools.at(-1)!;
  assert.deepEqual(active, ["read", "grep", "find", "ls"], "unknown tool names are dropped, not errors");
  assert.equal(statuses.profile, "profile: research");
  assert.deepEqual(thinkingLevels, ["medium"]);

  const refused = await handlers.get("tool_call")!({ type: "tool_call", toolName: "write", toolCallId: "w", input: { path: "src/slugify.js", content: "" } }, ctx);
  assert.equal((refused as { block: boolean }).block, true);
  assert.match((refused as { reason: string }).reason, /read-only profile/);
});

test("/profile switches the grant; writes follow the new profile's paths", async (t) => {
  const cwd = await fixtureCopy(t);
  const { pi, handlers, commands, activeTools } = mockPi(["read", "write", "edit", "bash", "grep", "find", "ls", "run_tests", "run_checks", "read_conventions"]);
  createProfilesExtension({ defaultProfile: "research" })(pi);
  const { ctx, notices } = ctxFor(cwd);
  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);

  await commands.get("profile")!.handler("nope", ctx);
  assert.match(notices.at(-1)!.message, /Unknown profile "nope"/);
  assert.equal(activeTools.length, 1, "an unknown name changes nothing");

  await commands.get("profile")!.handler("implement", ctx);
  assert.ok(activeTools.at(-1)!.includes("write"));
  assert.ok(activeTools.at(-1)!.includes("run_checks"));
  const fire = (p: string) => handlers.get("tool_call")!({ type: "tool_call", toolName: "edit", toolCallId: p, input: { path: p, edits: [] } }, ctx);
  assert.equal(await fire("src/slugify.js"), undefined);
  assert.equal(await fire("test/new.test.js"), undefined);
  assert.equal((await fire("vendor/left-pad.js") as { block: boolean }).block, true);
  assert.equal((await fire("README.md") as { block: boolean }).block, true, "not protected, but not granted either");

  await commands.get("profile")!.handler("", ctx);
  assert.match(notices.at(-1)!.message, /^profile: implement/);
});

test("before_agent_start contributes the profile as a system-prompt section", async (t) => {
  const cwd = await fixtureCopy(t);
  const { pi, handlers } = mockPi();
  createProfilesExtension()(pi);
  const { ctx } = ctxFor(cwd);
  const options = { sections: {} as Record<string, string> };
  await handlers.get("before_agent_start")!({ type: "before_agent_start", prompt: "hi", systemPrompt: "base", systemPromptOptions: options }, ctx);
  assert.match(options.sections[PROFILE_SECTION_TAG]!, /Active capability profile: implement/);
});

test("Pi 0.87.0 loads the built checkpoint; the native hook enforces the default profile's grant", async (t) => {
  const cwd = await fixtureCopy(t);
  const agentDir = path.join(cwd, "agent-config");
  const settingsManager = SettingsManager.inMemory();
  const loader = new DefaultResourceLoader({
    cwd, agentDir, settingsManager,
    additionalExtensionPaths: [
      fileURLToPath(new URL("./cp2-typed-tools.js", import.meta.url)),
      fileURLToPath(new URL("./cp3-profiles.js", import.meta.url)),
    ],
    noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
  });
  await loader.reload();
  const loaded = loader.getExtensions();
  assert.deepEqual(loaded.errors, []);
  assert.equal(loaded.extensions.length, 2);
  const modelRuntime = await ModelRuntime.create({
    authPath: path.join(agentDir, "auth.json"), modelsPath: null,
    modelsStorePath: path.join(agentDir, "models-cache.json"),
    allowModelNetwork: false, refreshOnCreate: false,
  });
  const { session } = await createAgentSession({
    cwd, agentDir, settingsManager, modelRuntime,
    sessionManager: SessionManager.inMemory(cwd), resourceLoader: loader,
    tools: ["read", "write", "edit"],
  });
  t.after(() => session.dispose());
  await session.bindExtensions({});
  const assistantMessage = {
    role: "assistant" as const, content: [], api: "openai-responses" as const,
    provider: "test", model: "test", stopReason: "toolUse" as const, timestamp: 0,
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
  };
  type ToolInput = { path: string; content?: string };
  const call = (input: ToolInput) =>
    session.agent.beforeToolCall!({
      toolCall: { type: "toolCall", id: input.path, name: "write", arguments: input },
      args: input, context: session.agent.state, assistantMessage,
    });
  assert.equal((await call({ path: "src/ok.js", content: "" }))?.block, undefined);
  const refused = await call({ path: "README.md", content: "" });
  assert.equal(refused?.block, true);
  assert.match(refused?.reason ?? "", /profile "implement" may write under src\/, test\//);
});
