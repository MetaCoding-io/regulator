import assert from "node:assert/strict";
import { link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test, { type TestContext } from "node:test";
import { PROTECTED_S5_PATHS } from "@metacoding/regulator-core";
import {
  createAgentSession, createWriteTool, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager,
  type CustomToolCallEvent, type ExtensionAPI, type ExtensionContext, type ExtensionHandler, type ToolCallEvent, type ToolCallEventResult,
} from "@earendil-works/pi-coding-agent";
import regulatorPiExtension from "./write-gate.js";

type Handler = ExtensionHandler<ToolCallEvent, ToolCallEventResult>;

/** Pi 0.87.0 types a native tool call's `arguments` as a JSON object; the mock events carry a generic record. */
type WriteOrEditArguments = { path: string; content?: string; edits?: { oldText: string; newText: string }[] };
const asArguments = (input: Record<string, unknown>): WriteOrEditArguments => input as WriteOrEditArguments;

async function fixture(t: TestContext): Promise<string> {
  const cwd = await mkdtemp(path.join(tmpdir(), "regulator-pi-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await mkdir(path.join(cwd, "vsm"));
  await mkdir(path.join(cwd, "src"));
  for (const artifact of PROTECTED_S5_PATHS) await writeFile(path.join(cwd, artifact), "identity");
  await writeFile(path.join(cwd, "src/file.ts"), "before");
  return cwd;
}

function registeredHandler(): Handler {
  const handlers: Handler[] = [];
  // A strict mock: unexpected registration/API calls fail the test.
  const pi = {
    registerTool() {},
    on(event: string, handler: Handler) {
      assert.equal(event, "tool_call");
      handlers.push(handler);
    },
  } as unknown as ExtensionAPI;
  regulatorPiExtension(pi);
  assert.equal(handlers.length, 1);
  return handlers[0]!;
}

function toolCall(toolName: "write" | "edit", inputPath: string): CustomToolCallEvent {
  return {
    type: "tool_call", toolCallId: "call-1", toolName,
    input: toolName === "write"
      ? { path: inputPath, content: "after" }
      : { path: inputPath, edits: [{ oldText: "before", newText: "after" }] },
  };
}

function context(cwd: string): ExtensionContext {
  return { cwd } as ExtensionContext;
}

test("registers the native tool_call handler", () => {
  registeredHandler();
});

test("blocks write and edit to every protected artifact and normalized aliases", async (t) => {
  const cwd = await fixture(t);
  const handler = registeredHandler();
  for (const tool of ["write", "edit"] as const) {
    for (const artifact of PROTECTED_S5_PATHS) {
      for (const alias of [artifact, `./${artifact}`, `@${artifact}`, artifact.replaceAll("/", "\\"), artifact.replace("vsm/", "vsm//./")]) {
        const event = toolCall(tool, alias);
        event.input.authority = "s5-authority";
        const result = await handler(event, context(cwd));
        assert.equal(result?.block, true, `${tool}: ${alias}`);
        assert.match(result?.reason ?? "", /vsm_propose_policy_change/i);
      }
      assert.equal(await readFile(path.join(cwd, artifact), "utf8"), "identity");
    }
  }
});

test("write/edit cannot turn a missing protected artifact into a parent directory", async (t) => {
  const cwd = await fixture(t);
  await rm(path.join(cwd, "vsm/domain.ttl"));
  const handler = registeredHandler();
  for (const tool of ["write", "edit"] as const) {
    for (const input of ["vsm/domain.ttl/child", "vsm/domain.ttl/"]) {
      assert.equal((await handler(toolCall(tool, input), context(cwd)))?.block, true, input);
    }
  }
});

test("ordinary writes and edits pass with the checked normalized path", async (t) => {
  const cwd = await fixture(t);
  const handler = registeredHandler();
  for (const tool of ["write", "edit"] as const) {
    for (const [input, expected] of [
      ["src/file.ts", "./src/file.ts"],
      ["./src//./file.ts", "./src/file.ts"],
      ["src\\file.ts", "./src/file.ts"],
      ["new/nested/file.ts", "./new/nested/file.ts"],
      ["@src/file.ts", "./src/file.ts"],
      ["src/new\u202Ffile.ts", "./src/new file.ts"],
      ["./@literal.ts", "./@literal.ts"],
      ["@@literal.ts", "./@literal.ts"],
      ["./~literal.ts", "./~literal.ts"],
      ["~literal.ts", "./~literal.ts"],
      ["vsm/notes.md", "./vsm/notes.md"],
    ] as const) {
      const event = toolCall(tool, input);
      assert.equal(await handler(event, context(cwd)), undefined, input);
      assert.equal(event.input.path, expected);
    }
  }
});

test("path preparation remains compatible with the pinned host's real write tool", async (t) => {
  const cwd = await fixture(t);
  const handler = registeredHandler();
  const destinations: string[] = [];
  const hostWrite = createWriteTool(cwd, {
    operations: {
      mkdir: async () => {},
      writeFile: async (destination) => { destinations.push(destination); },
    },
  });
  for (const [input, expected] of [
    ["@src/file.ts", "src/file.ts"],
    ["src/new\u202Ffile.ts", "src/new file.ts"],
    ["./src//./file.ts", "src/file.ts"],
    ["@@literal.ts", "@literal.ts"],
    ["./~literal.ts", "~literal.ts"],
  ] as const) {
    const event = toolCall("write", input);
    destinations.length = 0;
    await hostWrite.execute("raw-host", { path: input, content: "after" });
    assert.equal(await handler(event, context(cwd)), undefined);
    assert.ok(typeof event.input.path === "string");
    await hostWrite.execute("guarded-host", { path: event.input.path, content: "after" });
    assert.deepEqual(destinations, [path.join(cwd, expected), path.join(cwd, expected)]);
  }
  // Current Pi expands file URLs to absolute targets. The adapter must block
  // that host-specific syntax, even when the URL points inside the project.
  const url = pathToFileURL(path.join(cwd, "vsm/IDENTITY.md")).href;
  destinations.length = 0;
  await hostWrite.execute("raw-file-url", { path: url, content: "after" });
  assert.deepEqual(destinations, [path.join(cwd, "vsm/IDENTITY.md")]);
  assert.equal((await handler(toolCall("write", url), context(cwd)))?.block, true);
});

test("absolute, home, traversal, and malformed paths fail closed", async (t) => {
  const cwd = await fixture(t);
  const handler = registeredHandler();
  for (const tool of ["write", "edit"] as const) {
    for (const input of [
      path.join(cwd, "src/file.ts"), "/tmp/outside", "C:\\repo\\file.ts", "C:relative.ts",
      "\\\\host\\share\\file.ts", "../file.ts", "src/../../file.ts", "src/../file.ts",
      "..\\file.ts", "~/file.ts", "@/tmp/file.ts", "@../file.ts", "@~/file.ts",
      pathToFileURL(path.join(cwd, "vsm/IDENTITY.md")).href,
      `@${pathToFileURL(path.join(cwd, "src/file.ts")).href}`, "file:///tmp/outside",
      "", ".", "./", "@", "file\0.ts", undefined, null, 42,
    ]) {
      const event = toolCall(tool, "placeholder");
      event.input.path = input;
      assert.equal((await handler(event, context(cwd)))?.block, true, String(input));
    }
  }
});

test("filesystem aliases and unresolvable parents cannot bypass S5 checks", async (t) => {
  const cwd = await fixture(t);
  const outside = await mkdtemp(path.join(tmpdir(), "regulator-outside-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await symlink(path.join(cwd, "vsm/IDENTITY.md"), path.join(cwd, "alias.md"));
  await symlink(path.join(cwd, "vsm"), path.join(cwd, "policy"));
  await symlink(outside, path.join(cwd, "outside"));
  await symlink(path.join(outside, "missing"), path.join(cwd, "dangling"));
  await symlink("loop", path.join(cwd, "loop"));
  await link(path.join(cwd, "vsm/IDENTITY.md"), path.join(cwd, "hardlink.md"));
  const handler = registeredHandler();
  for (const tool of ["write", "edit"] as const) {
    for (const input of ["alias.md", "policy/IDENTITY.md", "outside/new/file.ts", "dangling/new.ts", "loop/file.ts", "hardlink.md", "src/file.ts/child", "src"]) {
      assert.equal((await handler(toolCall(tool, input), context(cwd)))?.block, true, input);
    }
    assert.equal((await handler(toolCall(tool, "src/file.ts"), context(path.join(cwd, "missing"))))?.block, true);
  }
});

test("other tools are untouched and no state leaks across project roots", async (t) => {
  const cwd = await fixture(t);
  const other = await fixture(t);
  await symlink(path.join(cwd, "vsm"), path.join(cwd, "alias"));
  const handler = registeredHandler();
  for (const toolName of ["read", "bash", "custom"]) {
    const event: ToolCallEvent = { type: "tool_call", toolName, toolCallId: "other", input: { path: "vsm/IDENTITY.md" } };
    assert.equal(await handler(event, context(cwd)), undefined);
    assert.equal(event.input.path, "vsm/IDENTITY.md");
  }
  assert.equal((await handler(toolCall("write", "alias/notes.md"), context(cwd)))?.block, true);
  assert.equal(await handler(toolCall("write", "alias/notes.md"), context(other)), undefined);
});

test("Pi loads the built entry and native session hook blocks protected mutations without a model", async (t) => {
  const cwd = await fixture(t);
  const agentDir = path.join(cwd, "agent-config");
  const settingsManager = SettingsManager.inMemory();
  const loader = new DefaultResourceLoader({
    cwd, agentDir, settingsManager,
    additionalExtensionPaths: [fileURLToPath(new URL("./write-gate.js", import.meta.url))],
    noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
  });
  await loader.reload();
  const loaded = loader.getExtensions();
  assert.deepEqual(loaded.errors, []);
  assert.equal(loaded.extensions.length, 1);
  const modelRuntime = await ModelRuntime.create({
    authPath: path.join(agentDir, "auth.json"), modelsPath: null,
    modelsStorePath: path.join(agentDir, "models-cache.json"),
    allowModelNetwork: false, refreshOnCreate: false,
  });
  const { session } = await createAgentSession({
    cwd, agentDir, settingsManager, modelRuntime,
    sessionManager: SessionManager.inMemory(cwd), resourceLoader: loader,
    tools: ["write", "edit"],
  });
  t.after(() => session.dispose());
  await session.bindExtensions({});
  assert.ok(session.agent.beforeToolCall);
  const assistantMessage = {
    role: "assistant" as const, content: [], api: "openai-responses" as const,
    provider: "test", model: "test", stopReason: "toolUse" as const, timestamp: 0,
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
  };
  for (const toolName of ["write", "edit"] as const) {
    const event = toolCall(toolName, "vsm/IDENTITY.md");
    const tool = session.agent.state.tools.find((item) => item.name === toolName);
    assert.ok(tool);
    // Invoke the actual native-engine interception seam with model-free input.
    const result = await session.agent.beforeToolCall({
      toolCall: { type: "toolCall", id: event.toolCallId, name: toolName, arguments: asArguments(event.input) },
      args: event.input, context: session.agent.state,
      assistantMessage,
    });
    assert.equal(result?.block, true);
    assert.match(result?.reason ?? "", /proposal/);
    assert.equal(await readFile(path.join(cwd, "vsm/IDENTITY.md"), "utf8"), "identity");

    const ordinary = toolCall(toolName, "src/file.ts");
    if (toolName === "edit") ordinary.input.edits = [{ oldText: "after", newText: "edited" }];
    const allowed = await session.agent.beforeToolCall({
      toolCall: { type: "toolCall", id: ordinary.toolCallId, name: toolName, arguments: asArguments(ordinary.input) },
      args: ordinary.input, context: session.agent.state,
      assistantMessage,
    });
    assert.equal(allowed?.block, undefined);
    await tool.execute(ordinary.toolCallId, ordinary.input);
    assert.equal(await readFile(path.join(cwd, "src/file.ts"), "utf8"), toolName === "write" ? "after" : "edited");
  }
});
