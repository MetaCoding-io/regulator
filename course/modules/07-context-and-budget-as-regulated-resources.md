# Lesson 07 — Context and budget as regulated resources

**Part 3 · S3 Control** · ~70 min instruction · ~110 min lab · builds **checkpoint 6**

> Context window, tokens, wall-clock, and money are all finite. Who decides how they
> are spent, and what happens at the limit?

Lesson 06 gave the orchestrator a contract to dispatch and a report to close on. It
gave it no way to say *enough*. A unit that reads the same file forty times, retries the
same edit until the window fills, or waits on a provider that has stopped answering
consumes everything and reports nothing — and nothing outside the loop decides that it
should stop. This lesson makes the three finite resources a unit spends into declared,
metered, enforced budgets; makes the model itself one of them; and makes compaction, the
eviction policy of the context window, a regulatory decision rather than a default.

**Prerequisites.** Checkpoint 5 passing. A model configured for `pi`, and for drill 3 a
second provider's key.

---

## 1. The question

Every harness spends four things on a unit: context, tokens, time, and money. Most
harnesses treat the first as free memory, the second and fourth as someone else's
invoice, and the third as whatever it takes. The context window is the one that bites
first: it fills, the runtime summarizes, and the unit continues on a summary that a
model wrote under a generic prompt — which may or may not have kept the one constraint
the planner fixed. The unit does not know what it lost. Neither does the orchestrator,
because the loop closes on the report, and the report is written by a unit that has
forgotten.

The question has two halves. *Who decides* how much a unit may spend — and the answer
is S3, because a controller without a budget is not controlling anything. And *what
must survive* when the window is evicted — and the answer is whatever losing would break
the loop: the contract's allocation, the evidence gathered, the files touched.

## 2. Concept

### Context is a budget with an eviction policy

Ashby again. Everything that enters the context is variety the model has to attend to;
everything evicted is variety it no longer can. Lesson 03 attenuated on the way in
(tool result truncation, narrow tools). Compaction attenuates the *history*, and the
eviction policy — what is kept, what is summarized, what the summary must say — decides
what the unit still knows about its own contract. That is not a runtime detail. It is a
regulatory decision, and this checkpoint takes it away from the default summarizer for
one specific reason: the contract must survive, and no summary prompt can be trusted to
keep it.

The rule is to separate what must be *carried* from what may be *summarized*. Carried
means deterministic: the contract's fixed, delegated and unresolved decisions, the
evidence pointers the unit has already produced, the files it has modified. Summarized
means a model's account of the conversation, useful and unreliable. The carried block
comes first and does not depend on the model; the summary follows and may be wrong.

### Budgets belong to S3

A ceiling is a decision made before the work, per unit type, in the definition —
not a number the model is told to respect and not a limit the operator applies by hand
when they notice the bill. It is declared in a **policy**, the third part of the
definition (registry, workload, policy; profiles are still code), and it has four
dimensions per attempt — tokens, cost, wall-clock, turns — plus one per unit: attempts.
When a ceiling is crossed the attempt is *halted*, the unit is *blocked*, and the
orchestrator records why. What happens next is a recovery decision, and lesson 08
builds the function that makes it. Until then the unit waits, lease kept, with the
ledger that explains it.

Notice the shape: the same three-way split as lesson 05. The guard *detects* and
*halts*; it does not *decide*. Raising a ceiling is an S5-flavoured act on the policy
file; choosing to retry, replan or escalate is S3's routing; neither is the guard's.

### The model is a budgeted, unstable component

Providers rate-limit, deprecate, and fall over. A harness whose only model is
unavailable has zero regulatory variety: every unit stops, and nothing records why. So
the model a unit type runs on is part of the policy too, as a **route**: a primary and
a declared fallback list, in order. The dispatcher runs the first available; a provider
failure moves to the next *declared* one in a fresh session. Nothing outside the route
is ever tried, because "some model that happened to work" is not a decision anyone
made. Per-unit-type routing also lets cheap work run on cheap models — `close` on a
small model, `implement` on a capable one — as an S3 budget decision like any other,
not a judgement the router makes about task difficulty. GSD-Pi's router does make that
judgement (section 6); this one deliberately does not.

### Measure the cost of regulation

Every regulator in this course costs something — tokens for a section, a call for a
summary, a session for a failover. The registry gains a `cost` field this lesson, and
the three new cards fill it. A regulator whose cost is unstated cannot be weighed
against what it absorbs, and lesson 14's ablation is where that weighing happens.

## 3. Mechanism

### What Pi counts, and where

Every assistant message carries `usage`: input, output, cache read and write, total
tokens, and the provider's cost. Lesson 02's trace recorded it per turn; this
checkpoint sums it per attempt on `message_end`. `ctx.getContextUsage()` gives the
current context size against the model's window — useful for a footer, not for a
ceiling, because it is an estimate and is `null` right after compaction.

### Halting: `ctx.abort()` and the gate

`ctx.abort()` stops the current run at the next checkpoint. It is the right tool for
a ceiling — the attempt ends, `agent_end` fires, the orchestrator closes on what is on
disk — and it is not sufficient on its own: a queued follow-up, a steering message, or
a handler that fires before the abort lands can still run a tool. So the guard is two
mechanisms: the abort on `turn_end`, and a `tool_call` gate that refuses every
non-read-only effect once a ceiling is crossed. The gate reads the same effect table
lesson 03 declared and lesson 05's lease gate used; reads still run, because a unit
that can still report needs them.

### Compaction hooks

`session_before_compact` fires before every compaction — threshold, manual `/compact`,
or overflow recovery — with a `preparation`: the messages that will be summarized, the
split-turn prefix, the previous summary, the file operations extracted from the doomed
messages, the cut point (`firstKeptEntryId`), and the token count. Return
`{ compaction: { summary, firstKeptEntryId, tokensBefore } }` and yours is the summary;
return nothing and Pi's default summarizer runs. `session_compact` tells you which
happened (`fromExtension`), and `session_compact_failed` pairs an attempt with its
failure. `serializeConversation(convertToLlm(messages))` renders the doomed messages
as text for your own summarizer; `ctx.modelRegistry.complete(ctx.model, …)` runs it.

### Models: `ModelRuntime`, `model_select`, `createAgentSession({ model })`

`ModelRuntime.getAvailable()` lists the models with credentials configured;
`getModel(provider, id)` fetches one; `createAgentSession({ model })` starts a session
on it. `model_select` fires on every switch, with the model and the reason. A failed
provider does not throw out of `session.prompt`: the run ends with an assistant message
whose `stopReason` is `"error"`, which is what the dispatcher inspects to fail over.

### Flags are per extension

A detail that cost an hour: `pi.getFlag` returns a value only for a flag *this*
extension registered, and two extensions registering the same flag name is a load
error. Checkpoint 6 therefore does not read checkpoint 4's `--unit` or 5's
`--contract`. It finds the unit the way S3 recorded it — the lease whose resource is
this worktree — and the contract from the unit's record. Which is the better design
anyway: the guard meters what the orchestrator dispatched, not what the command line
said.

## 4. Build: checkpoint 6

### The policy — [`packages/protocol/src/policy.ts`](../../packages/protocol/src/policy.ts), [`packages/regulator/policies/default.json`](../../packages/regulator/policies/default.json)

`PolicyDefinitionSchema`: budgets (a default ceiling and per-unit-type overrides, field
by field) and models (a default route and per-unit-type routes). A ceiling is `tokens`,
optional `cost`, `wallClockMs`, `turns`, and `attempts`. A route is `primary` plus
`fallback[]`, each a `provider/modelId`. The lab's `default.json` gives `implement`
400k tokens, 60 turns and 3 attempts on a capable model with two fallbacks, and `close`
50k tokens, 8 turns and 1 attempt on a small one. `regulator status` now reads
`policies/*.json` and reports `declared: registry, workload, policies`.

### The meter and the preserved block — [`packages/core/src/policy.ts`](../../packages/core/src/policy.ts)

`ceilingFor` and `routeFor` resolve the policy for a unit type. `chooseModels` orders
a route by availability and returns nothing if nothing declared is available.
`BudgetMeter` is the ceiling: it records usage, turns, model switches, compactions and
evidence pointers, and `check()` returns the first dimension over its ceiling — sticky,
so a halted attempt stays halted. `renderPreservedContext` is the block every
compaction begins with. `BudgetLedgerSchema` is what the meter writes: ceiling,
consumed, models, compactions, and `exhausted` once set. The execution store gains
`budget.a<N>.json` per attempt — a counter, rewritten, unlike the immutable contract and
report.

### The extension — [`packages/regulator-pi/src/budget.ts`](../../packages/regulator-pi/src/budget.ts)

`--policy <file>` (default: the lab's). On `session_start` it finds the unit from the
lease on the current worktree, loads the unit's contract from the store, builds the
meter with the ceiling for the unit type and the current model, and writes the first
ledger. `message_end` adds usage; `model_select` records the model; `tool_execution_end`
records a one-line evidence pointer for each successful `run_tests` or `run_checks`;
`turn_end` counts the turn, checks the ceiling, rewrites the ledger, updates the footer
(`budget: 12400/400000 tok (3%), 4/60 turns`), and on a crossing notifies and aborts;
`tool_call` refuses effects after a crossing. `session_before_compact` returns the
preserved block followed by the model summary — or by a stated gap when the summarizer
has no model or fails. `/budget` shows the ledger.

### The loop — [`packages/regulator/src/controller.ts`](../../packages/regulator/src/controller.ts)

`runUnit` takes a policy. Before dispatch it resolves the ceiling, and if the unit
already exists it accepts it only when *blocked*, under the *same contract version*,
with *attempts remaining* — a new version is a replan and lesson 08's business, and a
spent unit is refused with the reason S3 must decide something other than trying
again. A resumed unit renews its lease and reuses its worktree (`resumeUnit`). After
dispatch, a missing report with an `exhausted` ledger records the attempt as
`budget-exhausted` and blocks the unit on that dimension. The dispatch request now
carries the attempt number, the route, and the policy path.

### The dispatcher — [`packages/regulator-pi/src/dispatcher.ts`](../../packages/regulator-pi/src/dispatcher.ts)

Filters the route by `ModelRuntime.getAvailable()`, runs the first candidate with
checkpoints 2–6 loaded, and on an assistant message with `stopReason: "error"` moves to
the next declared model in a fresh session, echoing which. No candidate available is
an error before any session starts; every candidate failing is an error after.

### Registry cards

`budget-guard` (S3, gate) and `model-router` (S3, gate) are mechanism; `contract-
preserving-compaction` is honestly `model-judgment`, because its summary is, with the
limitation that only the deterministic block is guaranteed. All three carry `cost`.

## 5. Break it

Four drills. `regulator fixture` for a fresh repository each time.

**Drill 1 — the runaway, halted.** Write a policy with `implement` at 3 turns:

```json
{ "name": "tiny", "version": 1, "description": "three turns",
  "budgets": { "default": { "tokens": 400000, "wallClockMs": 1200000, "turns": 3, "attempts": 2 } },
  "models": { "default": { "primary": "<your provider/model>", "fallback": [] } } }
```

Dispatch the oscillation fixture under `underscore-unresolved.json` with
`--policy tiny.json`. Watch the footer count turns; at the third the notification says
`budget exhausted (turns)` and the session ends. `regulator unit show u2`:

```
blocked    u2  implement  contract tc-underscore v1  attempts 1  — budget exhausted: turns
  attempt 1: budget-exhausted — turns ceiling crossed at … (… tokens, 3 turns)
    budget: …/400000 tok (…%), 3/3 turns, exhausted: turns; models: …; compactions: 0
```

Dispatch again with the same contract: attempt 2 resumes the same worktree. Let it run
out again. Dispatch a third time: refused, *"has used its 2 attempt(s); S3 must decide
something other than trying again"*. Nothing was claimed. Note what the model was in the
middle of when each halt landed, and whether the abort or the tool gate is what stopped
it — the notices say.

**Drill 2 — compaction, with and without the block.** Set `keepRecentTokens` low and
`reserveTokens` high in the fixture's `.pi/settings.json` so a compaction happens within
a few turns of the known-issue contract:

```json
{ "compaction": { "enabled": true, "reserveTokens": 190000, "keepRecentTokens": 2000 } }
```

Run once with checkpoints 2–5 only (no guard): the default summarizer compacts. Then
run with checkpoint 6. Compare the two compaction entries in the session files:

| | Default summary | Contract-preserving |
| --- | --- | --- |
| Fixed decisions named | | |
| Unresolved decision named as unresolved | | |
| Evidence already gathered listed | | |
| Files modified listed | | |
| Anything the model summary got wrong | | |

Then the behavioural question: after compaction, did the unit re-run tests it had
already run? Did it touch a file a fixed decision protects? In the default run it
sometimes will; in the preserving run the block says *do not re-run what is already
evidenced*, and the contract section (lesson 06) is still in the system prompt either
way. Write down which loss the block actually prevented — it is progress, not the
contract text, and the lesson's registry card says so.

**Drill 3 — the provider goes away.** Put a working primary and a working fallback in
the route. Dispatch, and while the unit is running revoke the primary's key (rename it
in `auth.json`, or unset the environment variable) and let the next request fail.
Without a fallback the attempt ends with an error and `unit show` says `error`. With
one, the dispatcher echoes *`… failed: …; trying the next declared fallback`*, a fresh
session starts on the fallback, and the ledger of the *second* session records the
model. Two things to record: what the fallback session knew (the contract, nothing
else — it is a fresh session), and what the first session's ledger cost. That cost is
the price of failover, and it belongs in the router's `cost` field.

**Drill 4 — the read model.** `regulator status --definition packages/regulator --instance
<repo>` now prints the policy line and, per unit, `budget 12400/400000 tok (3%), 4/60
turns`. The control room shows the same in the units table and a budget section in the
unit inspector, including which models the attempt ran on and whether each compaction
carried the block. Find the halted unit from drill 1 in the page and read its ledger.
Then ask the page *why* it was halted at three turns and not four. It cannot tell you:
the ceiling is in the policy, and the policy is in the definition view. That is the
right place for it.

## 6. Field study: routing by judgement, and measuring cost

**GSD-Pi.** `docs/user-docs/dynamic-model-routing.md` and `docs/dev/ADR-004-capability-
aware-model-routing.md` at `cc8779f`. GSD classifies each unit into a complexity tier
(light / standard / heavy), scores available models by capability against the task's
requirements, applies budget pressure, and picks — with *downgrade-only* semantics, so
the user's configured model is a ceiling. It is a considerably richer router than this
checkpoint's, and it makes a judgement this one refuses to: what the task needs. Read
the ADR's pipeline diagram and answer two questions. Where in it is a decision made
that no human declared? And what does *downgrade-only* protect against that a declared
route does not need protecting against?

Then `docs/token-consumption-savings-evidence.md`: a table of measured input tokens per
surface before and after a set of attenuations — tool schema scoping, capped context
sections, narrowed skills. Two things to take from it. The measurements are per
*surface* (`gsd-auto`, `gsd-run`), which is the granularity a cost claim needs. And the
savings came almost entirely from attenuating what enters the context, not from
compacting what is already there — the lesson 03 side of this lesson's coin. Your
registry cards' `cost` fields are the seed of the same table for `regulator`; lesson 14
fills it.

**VSM-Pi.** This repository's `AGENTS.md`, the S3 bullet in "Architectural
boundaries": *leases and budgets* are named as part of the loop, and the loop is
*generic over workloads*. Check that against the build: the ceiling and the route are
resolved by unit type from a file; the loop code mentions neither tokens nor models.
Question for your notes: `attempts` is the one ceiling the session cannot enforce on
itself. Why must it live in the orchestrator, and what would go wrong if the guard
counted attempts by reading the store?

## 7. Checkpoint

You have finished checkpoint 6 when:

1. `pnpm check` passes — including `policy.test.ts` (resolution, model choice by
   availability, the meter's dimensions and stickiness, the preserved block), the
   controller's budget test (a halted attempt recorded as `budget-exhausted`; re-dispatch
   under the same version while attempts remain; refusal when spent or replanned), and
   `budget.test.ts` (ledger at start, halt and gate at the ceiling, no metering
   without a unit, the compaction summary beginning with the contract block with and
   without a model, and the real-session load).
2. Drill 1's unit is blocked with `budget exhausted: turns` after attempt 1, resumed for
   attempt 2, and refused for attempt 3.
3. Drill 2's compaction entry, with checkpoint 6 loaded, begins with the regulator
   context block and names every fixed and unresolved decision.
4. `regulator status` reports `declared: registry, workload, policies` and a budget per
   dispatched unit; the control room shows the policy table and the unit's ledger.
5. The three registry cards pass `registry:check` with `cost` filled; `REGULATORS.md`
   is regenerated.
6. Your notes hold drills 1–3 and the field-study answers.

## Further reading

- Pi docs at `v0.87.0`: `compaction.md` in full; `extensions.md` on
  `session_before_compact`, `model_select`, `ctx.abort`, `ctx.getContextUsage`;
  `settings.md` on compaction settings and per-model overrides; `models.md` on
  scoped models and providers.
- Upstream examples: `custom-compaction.ts`, `trigger-compact.ts`, `summarize.ts`,
  `provider-payload.ts`; `sdk/02-custom-model.ts`.
- This repository's [ADR 0001](../../docs/decisions/0001-own-orchestrator.md) on the
  loop's size, and the archived [`CONTROL-REGISTRY.md`](../../docs/archive/2026-09/CONTROL-REGISTRY.md) §2 on the
  `cost` field.
- Ashby, *An Introduction to Cybernetics*, chapter 11, on the regulator's own capacity
  as a channel.
