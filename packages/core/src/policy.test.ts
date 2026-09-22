import assert from "node:assert/strict";
import test from "node:test";
import type { PolicyDefinition, WorkContract } from "@metacoding/vsm-pi-protocol";
import { BudgetMeter, ceilingFor, chooseModels, renderPreservedContext, routeFor, summarizeLedger } from "./policy.js";

const policy: PolicyDefinition = {
  name: "default", version: 1, description: "d",
  budgets: {
    default: { tokens: 100_000, wallClockMs: 600_000, turns: 40, attempts: 3 },
    byUnitType: { plan: { tokens: 20_000, turns: 8 } },
  },
  models: {
    default: { primary: "anthropic/claude-sonnet-4-5", fallback: ["openai/gpt-5-mini"] },
    byUnitType: { plan: { primary: "openai/gpt-5-mini", fallback: [] } },
  },
};

test("policy resolution: per-type ceilings override field by field; routes fall back to the default; models are chosen from what is available, in declared order", () => {
  assert.deepEqual(ceilingFor(policy, "implement"), { tokens: 100_000, wallClockMs: 600_000, turns: 40, attempts: 3 });
  assert.deepEqual(ceilingFor(policy, "plan"), { tokens: 20_000, wallClockMs: 600_000, turns: 8, attempts: 3 });
  assert.equal(routeFor(policy, "plan").primary, "openai/gpt-5-mini");
  assert.equal(routeFor(policy, "verify").primary, "anthropic/claude-sonnet-4-5");
  const route = routeFor(policy, "implement");
  assert.deepEqual(chooseModels(route, ["openai/gpt-5-mini", "anthropic/claude-sonnet-4-5"]), ["anthropic/claude-sonnet-4-5", "openai/gpt-5-mini"]);
  assert.deepEqual(chooseModels(route, ["openai/gpt-5-mini"]), ["openai/gpt-5-mini"], "the primary is unavailable: the declared fallback, not a guess");
  assert.deepEqual(chooseModels(route, ["google/gemini-2.5-flash"]), [], "nothing declared is available: nothing to run on");
});

test("budget meter: counts tokens, cost and turns; wall-clock from the injected clock; reports the first ceiling crossed and stays exhausted", () => {
  let clock = 1_700_000_000_000;
  const meter = new BudgetMeter({ unitId: "u1", attempt: 1, ceiling: { tokens: 1000, cost: 0.5, wallClockMs: 60_000, turns: 3, attempts: 2 }, now: () => clock, model: "anthropic/claude-sonnet-4-5" });
  assert.equal(meter.check(), undefined);
  meter.recordUsage({ input: 300, output: 100, cacheRead: 0, cacheWrite: 0, totalTokens: 400, cost: 0.1 });
  meter.recordTurn();
  clock += 10_000;
  assert.equal(meter.check(), undefined);
  assert.equal(meter.ledger.consumed.wallClockMs, 10_000);
  assert.deepEqual(meter.ledger.models, ["anthropic/claude-sonnet-4-5"]);
  meter.recordModel("anthropic/claude-sonnet-4-5");
  meter.recordModel("openai/gpt-5-mini");
  assert.deepEqual(meter.ledger.models, ["anthropic/claude-sonnet-4-5", "openai/gpt-5-mini"], "a switch is recorded once");
  meter.recordUsage({ input: 500, output: 200, cacheRead: 0, cacheWrite: 0, totalTokens: 700, cost: 0.1 });
  meter.recordTurn();
  assert.equal(meter.check(), "tokens", "1100 of 1000 tokens: the first dimension in order wins");
  assert.equal(meter.exhausted?.dimension, "tokens");
  meter.recordTurn(); meter.recordTurn();
  assert.equal(meter.check(), "tokens", "sticky: still the dimension that halted the attempt");
  assert.equal(meter.ledger.consumed.turns, 4);
  assert.match(summarizeLedger(meter.ledger), /1100\/1000 tok \(110%\), 4\/3 turns, exhausted: tokens/);
  assert.equal("attempts" in meter.ledger.ceiling, false, "attempts are the orchestrator's ceiling, not the session's");

  const turns = new BudgetMeter({ unitId: "u1", attempt: 1, ceiling: { tokens: 10, wallClockMs: 10, turns: 1, attempts: 1 }, now: () => clock });
  turns.recordTurn();
  assert.equal(turns.check(), "turns");
  const wall = new BudgetMeter({ unitId: "u1", attempt: 1, ceiling: { tokens: 10, wallClockMs: 5, turns: 5, attempts: 1 }, now: () => clock });
  clock += 6;
  assert.equal(wall.check(), "wallClockMs");
});

test("preserved context carries the contract allocation, the evidence pointers and the touched files, and nothing of it depends on a model", () => {
  const contract: WorkContract = {
    kind: "task", id: "tc-1", version: 2, unitId: "u1", unitType: "implement",
    workload: { name: "software-development", version: 1 }, objective: "Fix the slug collapse", constraintRefs: [],
    fixed: [{ id: "f1", subject: "signature", decision: "single argument", authorityRef: "P1" }],
    delegated: [{ id: "d1", subject: "helpers", bounds: "private only" }],
    unresolved: [{ id: "u1", subject: "underscores", reason: "undecided", handling: "stub-boundary" }],
    expectedEvidence: [], provenance: { createdBy: "S3", createdAt: "t" },
  };
  const meter = new BudgetMeter({ unitId: "u1", attempt: 2, ceiling: { tokens: 5000, wallClockMs: 1000, turns: 9, attempts: 3 }, now: () => 0 });
  meter.recordUsage({ input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 1234, cost: 0 });
  meter.recordTurn();
  meter.recordEvidence({ tool: "run_tests", at: "1970-01-01T00:00:00.000Z", summary: "4 passed, 0 failed" });
  const text = renderPreservedContext(contract, meter.ledger, meter.evidence, ["src/slugify.js"]);
  for (const needle of ["tc-1 v2", "attempt 2", "Fix the slug collapse", "f1: single argument", "d1: helpers — private only", "u1: underscores (stub-boundary)", "run_tests: 4 passed, 0 failed", "src/slugify.js", "1234/5000 tokens, 1/9 turns", "report_result exactly once"]) {
    assert.ok(text.includes(needle), `missing: ${needle}`);
  }
});
