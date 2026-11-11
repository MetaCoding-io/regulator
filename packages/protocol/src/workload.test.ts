import assert from "node:assert/strict";
import test from "node:test";
import { Value } from "typebox/value";
import { AttemptRecordSchema, CommandRunnerSchema, RunnerSchema, UnitTypeSchema, isCommandRunner, runnerOf, type UnitType } from "./index.js";

const unitType: UnitType = { name: "parse", description: "d", profile: "manager", checks: ["run_tests"], requiresContract: true };
const command = { kind: "command" as const, argv: ["node", "workload/portfolio/plan-rebalance.mjs"], outputs: ["trades/proposed/"] };

test("the runner (#122): a unit type without one runs a session, the default the loop ran before the field existed", () => {
  assert.equal(Value.Check(UnitTypeSchema, unitType), true);
  assert.deepEqual(runnerOf(unitType), { kind: "session" });
  assert.deepEqual(runnerOf({ runner: { kind: "session" } }), { kind: "session" });
  assert.equal(isCommandRunner(runnerOf(unitType)), false);
});

test("a command runner declares its argv and its outputs; a timeout is optional; the profile stays on the unit type as the effect declaration", () => {
  assert.equal(Value.Check(UnitTypeSchema, { ...unitType, runner: command }), true);
  assert.equal(Value.Check(UnitTypeSchema, { ...unitType, runner: { ...command, timeoutMs: 30_000 } }), true);
  assert.equal(Value.Check(CommandRunnerSchema, { ...command, outputs: [] }), true, "a program that writes nothing declares no outputs");
  assert.equal(isCommandRunner(runnerOf({ runner: command })), true);
  assert.deepEqual(runnerOf({ runner: command }), command);
});

test("refused by the schema: a command runner without argv or with an empty one, without outputs, with an output that is absolute or escapes the project, an unknown kind, and a field the shape does not declare", () => {
  const { argv: _argv, ...noArgv } = command;
  assert.equal(Value.Check(RunnerSchema, noArgv), false, "no argv");
  assert.equal(Value.Check(RunnerSchema, { ...command, argv: [] }), false, "an empty argv names no program");
  const { outputs: _outputs, ...noOutputs } = command;
  assert.equal(Value.Check(RunnerSchema, noOutputs), false, "outputs are declared, even when empty");
  assert.equal(Value.Check(RunnerSchema, { ...command, outputs: ["/tmp/"] }), false, "an absolute output");
  assert.equal(Value.Check(RunnerSchema, { ...command, outputs: ["../elsewhere/"] }), false, "an output above the project");
  assert.equal(Value.Check(RunnerSchema, { ...command, outputs: ["..\\elsewhere\\"] }), false, "backslashes are not a path here");
  assert.equal(Value.Check(RunnerSchema, { ...command, timeoutMs: 0 }), false, "a timeout of nothing");
  assert.equal(Value.Check(RunnerSchema, { kind: "container", argv: ["x"], outputs: [] }), false, "an unknown kind");
  assert.equal(Value.Check(RunnerSchema, { kind: "session", argv: ["x"] }), false, "a session runner carries no argv");
  assert.equal(Value.Check(RunnerSchema, { ...command, profile: "manager" }), false, "the profile is the unit type's, not the runner's");
});

test("the attempt record carries the program that ran, by file and SHA-256, and its exit; a session attempt carries none", () => {
  const attempt = { unitId: "p3", attempt: 1, contractVersion: 1, startedAt: "2026-10-27T00:00:00.000Z", endedAt: "2026-10-27T00:00:01.000Z", outcome: "reported" };
  assert.equal(Value.Check(AttemptRecordSchema, attempt), true);
  const sha256 = "a".repeat(64);
  assert.equal(Value.Check(AttemptRecordSchema, { ...attempt, program: { file: "workload/portfolio/plan-rebalance.mjs", sha256, exit: 0 } }), true);
  assert.equal(Value.Check(AttemptRecordSchema, { ...attempt, outcome: "error", program: { file: "workload/portfolio/plan-rebalance.mjs", sha256 } }), true, "stopped at the ceiling: no exit code");
  assert.equal(Value.Check(AttemptRecordSchema, { ...attempt, program: { file: "x.mjs", sha256: "not a hash", exit: 0 } }), false);
  assert.equal(Value.Check(AttemptRecordSchema, { ...attempt, program: { file: "x.mjs", sha256, exit: 1.5 } }), false);
  assert.equal(Value.Check(AttemptRecordSchema, { ...attempt, program: { file: "x.mjs", sha256, exit: 0, stdout: "x" } }), false, "the output is the report's, not the record's");
});

import { DeclaredToolSchema, ProgramSchema, WorkloadDefinitionSchema } from "./index.js";

const placeTrade = {
  name: "place_trade", description: "Place a trade list.", parameters: { type: "object", properties: { proposed: { type: "string" } }, required: ["proposed"], additionalProperties: false },
  effect: { filesystem: "write", execution: "project-code", network: "none", sideEffects: "irreversible" },
  program: { argv: ["node", "workload/portfolio/place-trade.mjs"], outputs: ["trades/pending/"] },
};

test("a declared tool (#121): a name the model calls, a description and a parameters schema it sees, an effect in the shape every built-in declares, and a program in the command runner's shape; the workload carries them under tools[]", () => {
  assert.equal(Value.Check(DeclaredToolSchema, placeTrade), true);
  assert.equal(Value.Check(DeclaredToolSchema, { ...placeTrade, program: { ...placeTrade.program, timeoutMs: 5000 } }), true);
  assert.equal(Value.Check(ProgramSchema, command), false, "a program carries no kind; the kind is the runner's");
  const { kind: _kind, ...program } = command;
  assert.equal(Value.Check(ProgramSchema, program), true, "the runner's argv, timeout and outputs are a program");
  assert.equal(Value.Check(WorkloadDefinitionSchema, { name: "pf", version: 1, description: "d", unitTypes: [unitType], tools: [placeTrade] }), true);
  assert.equal(Value.Check(WorkloadDefinitionSchema, { name: "pf", version: 1, description: "d", unitTypes: [unitType] }), true, "tools[] is optional: a workload that declares none is what it was");
});

test("refused by the schema: a declared tool without an effect, with an effect off the four axes, without a program or its outputs, with a name a model cannot call, or with a field the shape does not declare", () => {
  const { effect: _effect, ...noEffect } = placeTrade;
  assert.equal(Value.Check(DeclaredToolSchema, noEffect), false, "the effect is the point of declaring");
  assert.equal(Value.Check(DeclaredToolSchema, { ...placeTrade, effect: { ...placeTrade.effect, sideEffects: "dangerous" } }), false);
  assert.equal(Value.Check(DeclaredToolSchema, { ...placeTrade, effect: { filesystem: "write" } }), false, "every axis is declared");
  const { program: _program, ...noProgram } = placeTrade;
  assert.equal(Value.Check(DeclaredToolSchema, noProgram), false);
  assert.equal(Value.Check(DeclaredToolSchema, { ...placeTrade, program: { argv: ["node", "x.mjs"] } }), false, "outputs are declared, even when empty");
  assert.equal(Value.Check(DeclaredToolSchema, { ...placeTrade, program: { argv: [], outputs: [] } }), false);
  assert.equal(Value.Check(DeclaredToolSchema, { ...placeTrade, name: "Place-Trade" }), false);
  assert.equal(Value.Check(DeclaredToolSchema, { ...placeTrade, consent: true }), false, "consent is derived from the effect, never declared on the tool");
  assert.equal(Value.Check(DeclaredToolSchema, { ...placeTrade, parameters: "string" }), false, "the parameters are a schema object");
});
