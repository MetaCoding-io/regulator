import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { Type } from "typebox";
import type { CapabilityProfile } from "@metacoding.io/regulator-protocol";
import { ObligationLedger, readSignals } from "@metacoding.io/regulator-core";
import { LAB_ROOT, PROFILES, declaredEffects, gitExec, initRepo, loadDeclaredToolsSync, startUnit, type DeclaredToolOf } from "@metacoding.io/regulator";
import { createAuthorityExtension } from "./authority.js";
import { DECLARED_TOOL_ENTRY_TYPE, createDeclaredToolsExtension, describeDeclaredTool } from "./declared-tools.js";
import { createProfilesExtension, PROFILE_SECTION_TAG } from "./profiles.js";
import { ctxFor, mockPi } from "./test-support.js";

type Block = { block: boolean; reason: string } | undefined;

/** A definition of its own with one program, so nothing test-only ships in the definition. */
async function stampDefinition(t: TestContext): Promise<{ root: string; tools: DeclaredToolOf[] }> {
  const root = await mkdtemp(path.join(tmpdir(), "regulator-pi-declared-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "workload", "pf"), { recursive: true });
  await writeFile(path.join(root, "workload", "pf", "stamp.mjs"), [
    'import { mkdirSync, readFileSync, writeFileSync } from "node:fs";',
    "const args = JSON.parse(readFileSync(0, \"utf8\"));",
    'const file = args.where ?? "stamps/note.txt";',
    'mkdirSync(file.split("/").slice(0, -1).join("/") || ".", { recursive: true });',
    "writeFileSync(file, `${args.note}\\n`);",
    'process.stdout.write(`${JSON.stringify({ summary: `stamped ${file}`, evidence: [{ class: "file", ref: file }] })}\\n`);',
    "",
  ].join("\n"));
  const tools: DeclaredToolOf[] = [{
    workload: "pf",
    tool: {
      name: "stamp", description: "Stamp a note into the tree. It cannot be unstamped.", parameters: { type: "object", properties: { note: { type: "string" }, where: { type: "string" } }, required: ["note"], additionalProperties: false },
      effect: { filesystem: "write", execution: "none", network: "none", sideEffects: "irreversible" },
      program: { argv: ["node", "workload/pf/stamp.mjs"], outputs: ["stamps/"] },
    },
  }];
  return { root, tools };
}

test("the declared-tools extension registers every tool the definition's workloads declare, generically, at load: the shipped definition gives place_trade with the workload's own schema and description, and the harness's sentence about the consent it derives", () => {
  const { pi, tools } = mockPi();
  createDeclaredToolsExtension()(pi);
  assert.deepEqual([...tools.keys()], ["place_trade"]);
  const placeTrade = tools.get("place_trade")!;
  const shipped = loadDeclaredToolsSync(LAB_ROOT)[0]!.tool;
  assert.deepEqual(placeTrade.parameters, shipped.parameters, "the schema the model sees is the workload's, as declared");
  assert.equal(placeTrade.description, describeDeclaredTool(shipped));
  assert.match(placeTrade.description, /^Place the trade list a person has agreed to:.* Its declared effect is irreversible, so the harness refuses a call until a person's yes for exactly this call is on the record: ask first with ask_human kind=consent/);
  assert.equal(describeDeclaredTool({ ...shipped, effect: { ...shipped.effect, sideEffects: "none" } }), shipped.description, "a read-only declared tool carries the workload's description alone");
  const { pi: none, tools: noneRegistered } = mockPi();
  createDeclaredToolsExtension({ tools: [] })(none);
  assert.deepEqual([...noneRegistered.keys()], [], "a definition that declares no tool registers nothing");
});

test("a declared tool's execute runs its program in the session's worktree with the call's arguments on stdin, under the tool's declared outputs: the model is told what the program said and what ran, a typed session entry records the program by file and hash with what it wrote, and a write outside the outputs is undone and the call refused", async (t) => {
  const { root, tools } = await stampDefinition(t);
  const cwd = await initRepo(t);
  const { pi, tools: registered, entries, handlers } = mockPi();
  createDeclaredToolsExtension({ definitionRoot: root, tools, now: () => 1_700_000_000_000 })(pi);
  const { ctx, statuses } = ctxFor(cwd);
  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
  assert.equal(statuses["declared-tools"], "declared tools: stamp (pf, consent derived)");
  const stamp = registered.get("stamp")!;
  const out = await stamp.execute("c1", { note: "hello" }, undefined as never, undefined as never, ctx as never);
  assert.equal(await readFile(path.join(cwd, "stamps", "note.txt"), "utf8"), "hello\n");
  const text = (out.content[0] as { text: string }).text;
  assert.match(text, /^stamped stamps\/note\.txt\n\[regulator: stamp ran workload\/pf\/stamp\.mjs \([0-9a-f]{12}\), exit 0; wrote stamps\/note\.txt under its declared outputs \(stamps\/\)\.\]$/);
  const details = out.details as { tool: string; workload: string; program: { file: string; exit: number }; written: string[] };
  assert.deepEqual([details.tool, details.workload, details.program.file, details.program.exit, details.written], ["stamp", "pf", "workload/pf/stamp.mjs", 0, ["stamps/note.txt"]]);
  assert.deepEqual(entries.map((e) => e.customType), [DECLARED_TOOL_ENTRY_TYPE]);
  const entry = entries[0]!.data as { tool: string; toolCallId: string; program: { sha256: string }; written: string[]; at: string };
  assert.deepEqual([entry.tool, entry.toolCallId, entry.program.sha256.length, entry.written, entry.at], ["stamp", "c1", 64, ["stamps/note.txt"], "2023-11-14T22:13:20.000Z"]);
  await assert.rejects(stamp.execute("c2", { note: "stray", where: "src/injected.js" }, undefined as never, undefined as never, ctx as never), /stamp refused: its program wrote outside the tool's declared outputs \(stamps\/\): src\/injected\.js; the writes are undone/);
  await assert.rejects(stat(path.join(cwd, "src", "injected.js")), /ENOENT/, "undone before the refusal");
  await assert.rejects(stamp.execute("c3", {} as never, undefined as never, undefined as never, ctx as never), /the arguments do not fit the tool's schema/);
});

const manager: CapabilityProfile = { name: "manager", description: "d", tools: ["read", "write", "stamp", "ask_human", "report_result"], writablePaths: ["lots/"] };

test("consent derived from the effect (#121): the authority gate refuses a call of a declared irreversible tool before it runs with no consent grant on the profile — an operational-signal naming the derivation, and the instruction to ask naming the call with its arguments — lets it run on a recorded yes for that call, asks again for different arguments, and derives nothing for a built-in's irreversible effect or a declared read-only tool", async (t) => {
  const { tools } = await stampDefinition(t);
  const repo = await initRepo(t);
  let clock = Date.parse("2026-10-27T09:00:00.000Z");
  const tick = () => (clock += 1000);
  const started = await startUnit(gitExec, { repo, unitId: "p4", owner: "alice", now: tick });
  const declared = declaredEffects([...tools, { workload: "pf", tool: { ...tools[0]!.tool, name: "lookup", effect: { filesystem: "read", execution: "none", network: "none", sideEffects: "none" }, program: { ...tools[0]!.tool.program, outputs: [] } } }]);
  const { pi, handlers } = mockPi([{ name: "stamp", parameters: Type.Object({ note: Type.String(), where: Type.Optional(Type.String()) }, { additionalProperties: false }) }, "read", "write"]);
  createAuthorityExtension({ now: tick, profile: { ...manager, tools: [...manager.tools, "lookup", "notify_owner"] }, declared })(pi);
  const { ctx, statuses } = ctxFor(started.worktree.path);
  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
  assert.match(statuses.authority ?? "", /; consent derived for stamp \(manager\)$/, "no grant on the profile; the derivation is said");
  let n = 0;
  const call = async (toolName: string, input: Record<string, unknown>) => (await handlers.get("tool_call")!({ type: "tool_call", toolName, toolCallId: `c${n++}`, input }, ctx)) as Block;
  const signals = async () => (await readSignals(repo)).filter((s) => s.kind === "operational-signal") as Array<{ unit?: string; subject: string; observation: string; evidence: Array<{ class: string; ref: string; observation?: string }> }>;

  const refused = await call("stamp", { note: "hello" });
  assert.equal(refused?.block, true);
  assert.equal(refused?.reason, 'regulator: stamp refused: no consent for this call is on the record for unit p4. Ask first: ask_human with kind=consent, an action stating what a yes authorizes, and call {"tool":"stamp","arguments":{"note":"hello"}}; the harness refuses this call until a person\'s yes for that call is on the record, and holds the yes across attempts. Do not work around the refusal.');
  let recorded = await signals();
  assert.deepEqual([recorded.length, recorded[0]!.unit, recorded[0]!.subject, recorded[0]!.evidence], [1, "p4", 'consent refused: stamp {"note":"hello"}', [{ class: "command", ref: 'stamp {"note":"hello"}', observation: "absent" }]]);
  assert.match(recorded[0]!.observation, /^stamp \{"note":"hello"\} needs consent the gate derives from the workload's declaration of stamp \(every stamp call, derived from its declared effect \(sideEffects: irreversible\); no profile grant names it\) and was refused before it ran: no consent for this call is on the record for unit p4\. The unit was told to ask with ask_human kind=consent\.$/);
  assert.equal(await call("lookup", { note: "x" }), undefined, "a declared read-only tool needs no consent");
  assert.equal(await call("notify_owner", { message: "x" }), undefined, "a built-in's irreversible effect derives nothing: it is a channel to a person");
  assert.equal(await call("write", { path: "lots/x.csv", content: "" }), undefined);

  // A yes for the call, recorded with its arguments: the gate reads the record, and the call runs; different arguments ask again.
  const ledger = new ObligationLedger(repo, tick);
  const o = await ledger.openObligation({ subject: "consent: stamp", unit: "p4", concern: "interaction", sources: ["ask:1"], severity: "blocking", consumer: "human", blocks: true, question: "May I stamp hello?", openedBy: "S1" });
  await ledger.requestInteraction({ id: "r1", kind: "consent", subject: "stamp", question: "May I stamp hello?", action: "stamp hello", call: { tool: "stamp", arguments: { note: "hello" } }, severity: "blocking", unit: "p4", attempt: 1, obligationId: o.id, evidence: [], raisedBy: "S1", raisedAt: new Date(clock).toISOString(), timeoutMs: 1000, channel: "none" }, "S1");
  await ledger.answerInteraction({ requestId: "r1", outcome: "unavailable", by: "S1", channel: "none" });
  assert.match((await call("stamp", { note: "hello" }))?.reason ?? "", /has no answer yet, and silence is not consent/);
  await ledger.answerInteraction({ requestId: "r1", outcome: "answered", answer: "yes", by: "alice", channel: "cli" });
  await ledger.resolve(o.id, { by: "alice", disposition: "accepted", rationale: "yes" });
  assert.equal(await call("stamp", { note: "hello" }), undefined, "the recorded yes covers the call");
  assert.equal(await call("stamp", { note: "hello", where: "stamps/elsewhere.txt" }), undefined, "an argument the record did not name is free");
  assert.match((await call("stamp", { note: "goodbye" }))?.reason ?? "", /no consent for this call is on the record/, "a different argument the record named is a different action");
  assert.equal((await signals()).length, 3);
});

test("the profile section says which granted declared tools the gate derives a consent for, beside the profile's own grants, from the definition's declared effects", async (t) => {
  const { fixtureCopy } = await import("./test-support.js");
  const cwd = await fixtureCopy(t);
  const { pi, handlers, flags } = mockPi(["read", "write", "edit", "grep", "find", "ls", "place_trade", "ask_human", "report_result"]);
  flags.set("profile", "manager");
  createProfilesExtension()(pi);
  const { ctx } = ctxFor(cwd);
  await handlers.get("session_start")!({ type: "session_start", reason: "startup" }, ctx);
  const event = { type: "before_agent_start", systemPromptOptions: { sections: {} as Record<string, string> } };
  await handlers.get("before_agent_start")!(event, ctx);
  assert.match(event.systemPromptOptions.sections[PROFILE_SECTION_TAG] ?? "", /^Consent is required before: every place_trade call \(its declared effect is irreversible\)\. Ask first with ask_human kind=consent/m);
  assert.ok(PROFILES.manager!.tools.includes("place_trade"));
});
