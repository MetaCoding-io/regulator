import assert from "node:assert/strict";
import test from "node:test";
import type { PolicyDefinition, WorkContract } from "@metacoding.io/regulator-protocol";
import { BudgetMeter, carriedLedger, ceilingFor, chooseModels, ownConsumption, renderPreservedContext, routeFor, summarizeLedger } from "./policy.js";

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

test("budget meter: a session that opens on an attempt already metered resumes its ledger — consumption, models and a halt carry over; another attempt starts clean", () => {
  let clock = 1_700_000_000_000;
  const ceiling = { tokens: 1000, wallClockMs: 60_000, turns: 3, attempts: 2 };
  const primary = new BudgetMeter({ unitId: "u1", attempt: 1, ceiling, now: () => clock, model: "anthropic/claude-sonnet-4-5" });
  primary.recordUsage({ input: 600, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 600, cost: 0.2 });
  primary.recordTurn();
  clock += 5_000;
  const fallback = new BudgetMeter({ unitId: "u1", attempt: 1, ceiling, now: () => clock, model: "openai/gpt-5", resume: primary.ledger });
  assert.deepEqual(fallback.ledger.models, ["anthropic/claude-sonnet-4-5", "openai/gpt-5"], "the attempt ran on both, in order");
  assert.equal(fallback.ledger.consumed.tokens, 600, "what the primary spent stays on the attempt");
  assert.equal(fallback.ledger.consumed.turns, 1);
  assert.equal(fallback.ledger.consumed.wallClockMs, 5_000, "the clock runs from the attempt's start, not the fallback's");
  fallback.recordUsage({ input: 500, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 500, cost: 0.1 });
  fallback.recordTurn();
  assert.equal(fallback.check(), "tokens", "the ceiling is the attempt's: the fallback cannot spend it twice");

  const halted = new BudgetMeter({ unitId: "u1", attempt: 1, ceiling, now: () => clock, model: "google/gemini-3.8-flash", resume: fallback.ledger });
  assert.equal(halted.exhausted?.dimension, "tokens", "a halted attempt stays halted whichever session opens on it");
  assert.equal(halted.check(), "tokens");

  const next = new BudgetMeter({ unitId: "u1", attempt: 2, ceiling, now: () => clock, model: "anthropic/claude-sonnet-4-5", resume: fallback.ledger });
  assert.equal(next.ledger.consumed.tokens, 0, "a different attempt's ledger is not resumed");
  assert.equal(next.exhausted, undefined);
  assert.deepEqual(next.ledger.models, ["anthropic/claude-sonnet-4-5"]);
});

test("a carried ledger (#133): the attempt that continues an earlier one opens on what it spent, under the same ceiling, and says how much of its consumption is the earlier attempt's; the meter resumes it, the clock adds and does not re-measure, and each attempt's own consumption sums to the unit's", () => {
  let clock = 1_700_000_000_000;
  const ceiling = { tokens: 1000, cost: 1, wallClockMs: 60_000, turns: 5, attempts: 3 };
  const first = new BudgetMeter({ unitId: "u1", attempt: 1, ceiling, now: () => clock, model: "anthropic/claude-sonnet-4-5" });
  first.recordUsage({ input: 600, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 600, cost: 0.25 });
  first.recordTurn(); first.recordTurn();
  first.recordCompaction("threshold", true);
  clock += 20_000;
  const ended = first.ledger;

  clock += 3_600_000; // the unit waited an hour between the attempts: that hour is nobody's wall clock
  const seeded = carriedLedger(ended, 2, () => clock);
  assert.deepEqual(seeded.consumed, { tokens: 600, cost: 0.25, wallClockMs: 20_000, turns: 2 }, "the ledger continues from what attempt 1 spent");
  assert.deepEqual(seeded.carried, { attempt: 1, consumed: { tokens: 600, cost: 0.25, wallClockMs: 20_000, turns: 2 } });
  assert.deepEqual([seeded.attempt, seeded.models, seeded.compactions, seeded.exhausted], [2, [], [], undefined], "the models, the compactions and a halt are the earlier attempt's own");
  assert.deepEqual(ownConsumption(seeded), { tokens: 0, cost: 0, wallClockMs: 0, turns: 0 });
  assert.deepEqual(ownConsumption(ended), ended.consumed, "a ledger that carries nothing is all its own");

  const second = new BudgetMeter({ unitId: "u1", attempt: 2, ceiling, now: () => clock, model: "anthropic/claude-sonnet-4-5", resume: seeded });
  assert.equal(second.ledger.consumed.tokens, 600, "the session's meter resumes the ledger S3 opened, as a fallback session resumes an attempt's");
  assert.equal(second.ledger.carried?.attempt, 1);
  assert.deepEqual(second.ledger.models, ["anthropic/claude-sonnet-4-5"]);
  clock += 10_000;
  second.recordUsage({ input: 300, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 300, cost: 0.25 });
  second.recordTurn();
  assert.equal(second.ledger.consumed.wallClockMs, 30_000, "20 s carried and 10 s of its own; the hour between is not counted");
  assert.equal(second.check(), undefined, "900 of 1000 tokens: there is budget left");
  assert.deepEqual(ownConsumption(second.ledger), { tokens: 300, cost: 0.25, wallClockMs: 10_000, turns: 1 });
  assert.equal(ownConsumption(ended).tokens + ownConsumption(second.ledger).tokens, second.ledger.consumed.tokens, "summed per attempt, each token is counted once");
  assert.match(summarizeLedger(second.ledger), /^900\/1000 tok \(90%\), 3\/5 turns, 600 tok and 2 turns carried from attempt 1$/);
  second.recordUsage({ input: 100, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 100, cost: 0 });
  assert.equal(second.check(), "tokens", "the retry spends what the first attempt left, not a new allowance");

  const third = carriedLedger(second.ledger, 3, () => clock);
  assert.deepEqual([third.carried?.attempt, third.carried?.consumed.tokens, third.exhausted], [2, 1000, undefined], "a chain carries the running total; the halt marker stays with the attempt that crossed");
  assert.equal(new BudgetMeter({ unitId: "u1", attempt: 3, ceiling, now: () => clock, resume: third }).check(), "tokens", "and with nothing left the guard halts the new session at its first check");
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
