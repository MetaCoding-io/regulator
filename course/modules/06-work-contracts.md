# Lesson 06 — Work contracts: what you are actually authorizing

**Part 3 · S3 Control** · ~80 min instruction · ~120 min lab · builds **checkpoint 5**

> You dispatch "add rate limiting to the API". Which decisions did you just delegate,
> and which did you accidentally delegate?

Parts 1 and 2 built a unit that is honest about its effects, bounded by a profile, and
isolated in a worktree it holds a lease on. Nothing yet says *what the unit is for*. A
task description does not — it says what work exists, and leaves every decision the
planner did not think of to whoever does the work. This lesson builds the artifact that
allocates decisions before dispatch, the report that closes the loop after, and the
first slice of the orchestrator that runs one against the other. It is also where the
control plane stops being a pile of extensions and becomes a *definition* an *instance*
runs from.

**Prerequisites.** Checkpoint 4 passing. A model configured for `pi` (drills 1–3 run a
live session; the checkpoint tests do not).

---

## 1. The question

Hand an agent *"add deployment cancellation"* and it will make forty decisions. Whether
cancellation is a state or a flag. Which public signatures may change. Whether the old
wire format survives. What happens to a deployment that was retrying. Some of those
were decided months ago by someone with authority; some are genuinely the implementer's
to make; some nobody has decided, and the honest answer is *stop and ask*. The task
description treats all forty the same, which means the agent treats them all the same:
it decides. Each choice is locally plausible. Their sum is architectural drift, and it
is invisible because it lives in the diff.

The question is not how to describe the task better. It is what, exactly, you are
authorizing when you dispatch it.

## 2. Concept

### A contract allocates decisions

S3 is operational control: it plans, dispatches, budgets, recovers, and holds the
authoritative record of what is running. Its core artifact is not a task but a
**contract**, and the core of a contract is the allocation of decisions into three
kinds:

```text
FIXED        already decided, with an authority behind it; preserve it.
             Deviation is reported — never silent, never a reinterpretation.
DELEGATED    yours to choose, within stated bounds; report the choice you made.
UNRESOLVED   nobody has decided. You may not settle it by omission; preserve
             the boundary and surface what you learn.
```

Read those as Ashby would: they are an explicit **allocation of variety**. Fixed
decisions attenuate the unit's choice space to what S5 and prior planning already
absorbed. Delegated decisions are the variety S3 deliberately leaves to S1, because S1
has the local information to spend it well. Unresolved decisions are the variety
*nobody* has absorbed yet — and the one rule that matters most in this lesson is that
they may not be absorbed by accident. A delegation without bounds is abdication. An
unresolved decision quietly settled is a policy made by whoever happened to be typing.

The contract carries other things — an objective, constraint references, expected
evidence, provenance — but they are secondary. This repository's design record
([`OPERATIONAL-WORK-CONTRACT.md`](../../docs/archive/2026-09/OPERATIONAL-WORK-CONTRACT.md) §5, archived) puts
it in one line: *the task tells S1 what work exists; the contract tells S1 what freedom
it has, what must remain true, and how the rest of the system will know whether the
work succeeded.*

### The result report closes the loop

A contract without a structured result is half a feedback loop. The **result report**
is bound to the exact contract version and answers, item by item: what choice was made
for each delegated decision; what became of each unresolved one — *preserved* or
*surfaced*, and there is deliberately no *settled*; which decisions emerged that the
contract had not allocated; any deviation from a fixed decision or constraint; and what
the unit is still unsure about.

That last item is the **residual-uncertainty rule**, and it is worth stating as a rule
because every harness violates it by default: a system that discards what its
operations were unsure about destroys exactly the information its regulator needs.
Compare the contract's *prospective* uncertainty (what planning knew it had not
decided) with the report's *residual* uncertainty (what the unit had to decide anyway)
and you have a measure of planning quality that no test suite gives you. An emergent
decision is not a failure; it is a signal that S3's plan missed a consequential choice,
and it becomes regulatory information rather than invisible architecture.

The report does not self-certify success. It supplies evidence and observations;
verification (lesson 09) and audit decide whether they hold.

### Decomposition: thin vertical slices

A contract is written per unit, and how you cut units decides whether the loop closes.
Prefer **thin vertical slices** — the smallest change that crosses enough boundaries to
demonstrate observable behaviour end to end — over horizontal sweeps that build a layer
completely and defer the first real signal to the end. Horizontal work is not
forbidden; it has to justify itself and name the integration proof that shows the
enabling work is actually usable. The design record's §2–3 give the two contract
levels (slice delivery, task work); this checkpoint builds the task level and leaves
the slice level to the planning lesson.

### Definition and instance

Lesson 05's `AGENTS.md` bullet said the control plane is *declared, not assembled*.
Here is what that means mechanically. An **instance** runs from a **definition**:

```text
definition = regulator registry      what regulates, at which level, bounded how
           + capability profiles     positive grants over declared effects
           + policies                budgets, consent rules, thresholds (lesson 07+)
           + workload                unit types, checks, plan grammar
```

The orchestrator loop knows nothing about software. It knows that a contract names a
unit type, that the workload maps a unit type to a profile, and that a unit is
contracted, dispatched, reported and closed. Everything that made earlier harnesses
heavy — fixed phases, milestone lifecycles, acceptance rituals — is *workload*, and
lives in a JSON file the loop reads. The software-development autoloop is the first
workload definition; a second workload is a second file, not a fork of the loop.

And the state boundary, restated because this is the lesson that makes it bite:

```text
execution state     units, attempts, leases         the orchestrator's store
regulatory state    signals, findings, obligations   the event store / signal sink
domain output       the repository                   never read as state
```

The orchestrator closes a unit from the report the unit *wrote*, never from the diff it
*produced*. If the unit did not report, the unit did not finish, whatever the diff
looks like. This is INV-005 as a mechanism.

## 3. Mechanism

### The SDK as a driver

Every earlier checkpoint was an extension loaded by a `pi` the human started. The
orchestrator starts sessions itself, and for that Pi's SDK is the surface:
`DefaultResourceLoader` to load the checkpoint extensions into a session rooted in the
unit's worktree, `createAgentSession` to build it, `session.prompt` to run one turn to
completion, `SessionManager.create(cwd)` so the session file persists with everything
the extensions appended. The flags the human would pass on the command line —
`--unit`, `--profile`, `--contract` — are set on the loader's extension runtime
(`runtime.flagValues`) before the session is created, which is exactly what the CLI's
parser does for you. Read `examples/sdk/12-full-control.ts` for the fully explicit
version and `13-session-runtime.ts` for the runtime that owns session replacement.

### Typed entries: `pi.appendEntry`

A session file is a tree of entries, and not all of them are messages. `appendEntry`
writes a **custom entry** with a `customType` and arbitrary data that is persisted,
reloadable, and *not sent to the model*. That is the right home for the contract and
the report: state the session carries about itself, distinct from context the model
reasons over. (Its sibling, `sendMessage` with a custom message, *does* enter context;
this lesson does not use it, and the difference is the point.)

### Tools the unit must call: `registerTool` with a gate inside

`report_result` is a registered tool with a runtime schema, like lesson 03's tools, and
its `execute` is a gate: the host binds the report to the contract id and version,
checks it, and *throws* with the list of problems if the allocation was not honoured.
A thrown error is returned to the model as the tool result, so the unit learns exactly
what is missing and can report again. An accepted report is written once — the store
refuses a second — and the tool refuses a second call.

### The section, again: `before_agent_start`

The contract also rides along as a system-prompt section, rendered from the loaded
contract each turn. This is level 5, advice, and the registry card says so. It exists
so that a unit produces an acceptable report on the first try rather than learning the
contract from refusals; nothing it says is enforced by it.

### What this checkpoint deliberately does not use

`pi.sendMessage` / `sendUserMessage` for injected control input, `ctx.newSession()` and
`ctx.fork()` for unit boundaries, steering and follow-ups. All are real coordination
surfaces. The loop does not steer a running unit yet, because the function that would
decide to (recovery, lesson 08) does not exist yet; and a unit boundary is a worktree
and a session, not a fork, because the orchestrator — not the session — owns where
units begin and end.

## 4. Build: checkpoint 5

### Protocol — [`packages/protocol/src/contracts.ts`](../../packages/protocol/src/contracts.ts), [`workload.ts`](../../packages/protocol/src/workload.ts), [`execution.ts`](../../packages/protocol/src/execution.ts)

`WorkContractSchema`: `kind: "task"`, id and version, the unit id and type, the workload
it belongs to, objective, constraint references, the three decision lists, expected
evidence, and provenance whose `createdBy` is the literal `"S3"`. Closed: there is no
`authority`, `capabilities` or `functions` field a model could fill in, because a
contract delegates *implementation* decisions and nothing else. `ResultReportSchema`
mirrors it; `ResultReportInputSchema` is the model-facing subset, with the binding to
contract id, version and unit host-filled. `UnresolvedOutcomeSchema` is
`"preserved" | "surfaced"` — the type is the first gate.

`WorkloadDefinitionSchema`: a name and version, and unit types each naming a profile,
the harness-run checks that verify it, and whether it may run without a contract.
`UnitRecordSchema`, `AttemptRecordSchema` and `LeaseSchema` are the execution state:
what the orchestrator owns and nothing else infers.

### Core — [`packages/core/src/contracts.ts`](../../packages/core/src/contracts.ts), [`execution-store.ts`](../../packages/core/src/execution-store.ts), [`signals.ts`](../../packages/core/src/signals.ts)

`checkContract` refuses dispatch for colliding decision ids, an unresolved decision
whose handling is `resolve-before-execution`, and a predecessor that is not an earlier
version. `checkResultReport` is the closing gate: contract id and version must match;
every delegated decision (unless marked `requiredReport: false`) has a reported
choice; every unresolved decision appears with an outcome — a missing one is reported
as *"settled silently or forgotten, and neither closes the unit"*; a fixed-decision
deviation must reference the decision it deviates from; each required evidence
expectation has at least one reference of its class. `renderContractSection` is the
advice.

`ExecutionStore` is one directory per unit under `.regulator/units/`: `contract.v<N>.json`
and `report.v<N>.json` are written with the `wx` flag and can never be overwritten;
`attempts.ndjson` is append-only; `unit.json` is the only file that changes, and only
its status, attempt count and reason do. Lesson 05's lease store and thrash detector
moved here too — this loop and the read model below are their second and third
consumers, which is the promotion rule — and the signal sink that lesson 05 wrote
inline is now `appendSignal` / `readSignals`, validating every line against the
protocol's message union.

### The workload — [`packages/regulator/workload/software-development.json`](../../packages/regulator/workload/software-development.json)

Six unit types: `plan` and `close` run under `research` (they never change the
repository), `implement` and `integrate` under `implement`, `verify` under `research`,
and `research` under `intelligence` (lesson 11).
Only `implement` is dispatched in this lesson. The `checks` each type names are
consumed from lesson 09; declaring them now is how the definition stays ahead of the
loop rather than behind it. `workload.test.ts` asserts every profile named is one the
lab declares.

### The extension — [`packages/regulator/src/cp5-contract.ts`](../../packages/regulator/src/cp5-contract.ts)

`--contract <path>` (or `REGULATOR_CONTRACT`). On `session_start` it loads and checks
the contract, appends it as a `regulator:contract` entry and puts `contract: tc-… v1` in
the footer; an invalid contract is refused with the reasons and the session runs with
no contract, which means `report_result` refuses everything. `before_agent_start`
renders the section. `report_result` does what section 3 says, and writes the accepted
report to the execution store in the *base checkout* (found from the worktree the same
way lesson 05's gate found the lease). `agent_end` warns if a contracted session ends
unreported.

### The loop — [`packages/regulator/src/controller.ts`](../../packages/regulator/src/controller.ts)

`runUnit(exec, { repo, contract, workload, dispatcher, owner })`:

```text
contract   checkContract; the workload must be the instance's; the unit type must exist
           → refused, before anything is claimed
dispatch   store.createUnit (the contract version is now immutable)
           startUnit (lease first, then worktree — lesson 05)
           dispatcher({ worktree, contractPath, profile: unitType.profile })
close      report = store.getReport(unit, version)     never the diff
           none            → attempt "no-report",      unit blocked, lease kept
           fails the check → attempt "invalid-report", unit blocked, lease kept
           passes          → attempt "reported"; emergent high-consequence decisions
                             and every deviation become operational signals for S3;
                             finishUnit reintegrates and releases → closed
                             (a conflict blocks the unit; lesson 05's signal is recorded)
```

The `Dispatcher` is the one Pi-shaped step, injected so the loop is tested without a
model and driven with one. [`dispatch-pi.ts`](../../packages/regulator/src/dispatch-pi.ts) is the real
one: checkpoints 2–5 loaded into a session in the worktree, flags set on the runtime,
`session.prompt(contract.objective)`, session persisted. Verify and route are missing
from the loop on purpose; where they would go, it records what happened and stops.

### The CLI — [`packages/regulator/src/cli.ts`](../../packages/regulator/src/cli.ts) and [`status.ts`](../../packages/regulator/src/status.ts)

```text
regulator contract check <file>          validate; say what it allocates
regulator unit dispatch <contract.json>  run one unit through the loop with a live session
regulator unit show <id>                 the unit record, its attempts, whether it reported
regulator status [--definition <dir>] [--instance <dir>] [--json]
```

`status` is the read model over a definition (registry, workloads; it says
plainly that profiles and policies are still declared in code) and an instance (units
with contract, report and attempts; leases with liveness; unrouted signals). It owns no
state, and it has no subcommand that changes anything. The control room will consume
its `--json` output; that is the whole reason it exists before the control room does.

### Example contracts — [`packages/regulator/contracts/`](../../packages/regulator/contracts/)

`fix-known-issue.json` for the main fixture: the public signature and the vendored
helper are fixed, helper decomposition and added tests are delegated, non-ASCII input
is unresolved (deferred). `underscore-unresolved.json` for the oscillation fixture: the
underscore question is unresolved with `stub-boundary` handling, and the objective says
so in words. Two registry cards are gates (`work-contract-gate`, `result-report-gate`)
and one is honest about being advice (`contract-advice`, level `prompt`).

## 5. Break it

Four drills. The first three need a model; `regulator fixture` gives you a fresh
repository each time.

**Drill 1 — prose versus contract.** Make two fixtures. In the first, do what lesson 04
did: start `u1`, launch `pi` in the worktree with checkpoints 2–4 and `--profile
implement`, and prompt *"Fix the known issue described in the README."* In the second,
run `regulator unit dispatch packages/regulator/contracts/fix-known-issue.json`. Same model,
same fixture, same objective. Now diff the two results — not the code, the *decisions*:

| | Prose | Contract |
| --- | --- | --- |
| Files changed outside `src/slugify.js` and its tests | | |
| Helpers or modules added | | |
| Tests added, changed, or weakened | | |
| Anything touched that a fixed decision names | | |
| What the summary says about non-ASCII input | | |
| Where the delegated choices are recorded | | |

The last row is the one to sit with. In the prose run the helper decomposition is in
the diff and nowhere else. In the contract run it is in `report.v1.json`, named, with
the bounds it was made under. Same choice; only one of them is a record.

**Drill 2 — the silent settlement.** `regulator fixture /tmp/osc --oscillation`, then
`regulator unit dispatch packages/regulator/contracts/underscore-unresolved.json`. The objective
tells the unit not to decide the underscore question; the section repeats it; and the
fourth test cannot pass without deciding it. Watch what the model does with the report.
The interesting outcomes, in rough order of how often they occur:

1. It reports `u-underscore` as *surfaced* with a clear note, leaves the fourth test
   failing, and cites the run. The unit closes. This is correct.
2. It changes `slugify` so all four tests pass — impossible, so it actually breaks
   one — and reports the decision as *preserved*. The report validates (the gate reads
   the report, not the diff); the unit closes; the deviation is invisible. Write down
   what would have caught it. Lesson 09 builds that.
3. It omits `u-underscore` from the report. The tool refuses with the *"settled
   silently or forgotten"* message; the model repairs the report. Count the retries.
4. It never calls `report_result`. The session ends; the loop records `no-report`,
   blocks the unit, and keeps the lease. `regulator unit show u2` shows the attempt.

Three runs; record which you got. Then read the session file under Pi's session
directory and find the `regulator:contract` and `regulator:result-report` entries: the
contract the unit ran under and the report it wrote, in the transcript, not derived
from it.

**Drill 3 — a fixed decision, contested.** Edit a copy of `fix-known-issue.json` so a
fixed decision is wrong on purpose — say, *"slugify must return an array"*. Dispatch.
A good unit reports a `fixed-decision` deviation referencing `f-signature` and explains
why; the loop closes the unit and writes a *blocking* operational signal for S3. A bad
unit obeys and ships an array. A worse one ignores the decision and says nothing. Which
did you get, and what in the current build could tell the difference between the last
two? (Nothing. That is the gap between this lesson and lesson 09.)

**Drill 4 — the read model.** With the instances from drills 1–3 still on disk:

```text
regulator status --definition packages/regulator --instance /tmp/osc
regulator status --definition packages/regulator --instance /tmp/osc --json | jq '.instance.units[].unit.status'
```

Then try to find, from the status output alone, the answer to *"what did unit u2 decide
about underscores?"* You can: it is in the report, which is in the unit view. Now try
*"is the code correct?"* You cannot, and the read model must never pretend to. The
control room is a projection of records; the moment it reads the repository to answer a
question, it has become a second source of truth.

## 6. Field study: two contract designs and one vocabulary

**VSM-Pi.** The archived design record
[`OPERATIONAL-WORK-CONTRACT.md`](../../docs/archive/2026-09/OPERATIONAL-WORK-CONTRACT.md),
§5 (decision allocation), §8 (prospective versus residual uncertainty), §9 (the
result report) and §14 (validation rules). Check your `checkResultReport` against §14's
list: which rules does the build enforce, which does it enforce weaker than written
(evidence by class, not content), and which are absent? Then §18's ten invariants —
find the mechanism for each in checkpoint 5, or write down that there is none yet.
The document says "GSD task" where the build says "unit", its field names differ from
the schema's (`fixedDecisions` became `fixed`, `planningProvenance` became
`provenance`), and its §10 point that contracts are versioned rather than
lifecycle-managed is the reason `ExecutionStore` has no `contract.status`. Its slice
level was never built.

The archived [`PLANNER-CONTRACT-COMPOSITION.md`](../../docs/archive/2026-09/PLANNER-CONTRACT-COMPOSITION.md)
§17 states the invariant the build keeps: *S1 may not execute without an immutable,
host-bound contract*. The loop takes a contract as its input, so there is nothing to
refuse; what the workload's `requiresContract` declares is the other direction — a unit
type marked contract-less (`plan`) must run under a read-only profile, which
`regulator check` enforces, and `regulator unit start --type` refuses a type that
requires one. Its §9, a missing-contract *obligation*, was never built: a design that
the build made unnecessary.

**GSD-Pi.** In `CONTEXT.md` at `cc8779f`, the runtime vocabulary entries for
**Milestone**, **Slice**, **Task** and **Open Question**. GSD decomposes milestone →
slice → task and keeps its slices vertical by convention and review. Its *Open Question*
carries a recommendation, rationale, alternatives, uncertainty and a condition for
revisiting — which is a richer record of an unresolved decision than this checkpoint's
`{ reason, handling, obligationRef }`. Question for your notes: GSD's open question is
addressed to a human and pauses work by interaction kind; the contract's unresolved
decision is addressed to the unit and forbids settling. Are those the same object seen
from two sides, or two objects? What would it take for a surfaced outcome in a result
report to *become* an open question?

## 7. Checkpoint

You have finished checkpoint 5 when:

1. `pnpm check` passes — including `contracts.test.ts` (an unresolved decision cannot
   be closed silently; delegated choices must be reported; required evidence by class),
   the execution store's immutability tests, `controller.test.ts` (closed from a report;
   blocked on no report with the lease kept; blocked on an invalid report; refused before
   anything is claimed; deviations become blocking signals), `cp5-contract.test.ts`
   (typed entry, section, tool gate, and the real-session load with the contract as a
   flag), and `status.test.ts`.
2. `regulator unit dispatch` runs a live unit against the main fixture to `closed`, and
   `regulator unit show u1` shows one attempt with outcome `reported`.
3. The oscillation fixture under `underscore-unresolved.json` produces at least one
   refused report or one surfaced outcome in your three runs, and you have recorded which.
4. `regulator status --definition packages/regulator --instance <repo> --json` validates as the
   view type and shows every unit you dispatched with its contract and report.
5. The three registry cards pass `registry:check`; `REGULATORS.md` is regenerated; the
   `contract-advice` card is at level `prompt`.
6. Your notes hold drills 1–3 and your answers to the field-study questions.

## Further reading

- This repository's [ADR 0001](../../docs/decisions/0001-own-orchestrator.md) — the
  orchestrator sized, and the definition/instance split.
- [`vsm/INVARIANTS.md`](../../vsm/INVARIANTS.md), INV-005 — execution state and
  regulatory state stay separate.
- Pi docs at `v0.87.0`: `sdk.md` in full, especially "Session Management" and
  "Extensions"; `session-format.md` for custom entries; `extensions.md` on
  `appendEntry`, `sendMessage` and `registerTool`.
- Upstream examples: `sdk/12-full-control.ts`, `sdk/13-session-runtime.ts`,
  `sdk/11-sessions.ts`.
- Beer, *The Heart of Enterprise*, on System 3 as the "inside and now" — the
  allocation of resources and the accountability loop that comes back with them.
