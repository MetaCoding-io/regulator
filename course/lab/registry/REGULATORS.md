# Regulators

Generated from `registry/regulators/*.json` by `regulator docs`. Do not edit by hand.

| ID | Name | Function | Level | Status | Review by |
| --- | --- | --- | --- | --- | --- |
| `reg.control.budget-guard.v1` | Budget guard | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.control.contract-advice.v1` | Contract advice section | S3 | prompt | active | 2026-12-01 |
| `reg.control.contract-preserving-compaction.v1` | Contract-preserving compaction | S3 | model-judgment | active | 2026-12-01 |
| `reg.coordination.effect-journal.v1` | Effect journal | S2 | deterministic-gate | active | 2026-12-01 |
| `reg.control.failure-observer.v1` | Failure observer | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.control.model-router.v1` | Model router | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.control.profile-write-grant.v1` | Profile write grant | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.control.recovery-router.v1` | Recovery router | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.coordination.reintegration.v1` | Reintegration guard | S2 | deterministic-gate | active | 2026-12-01 |
| `reg.control.result-report-gate.v1` | Result report gate | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.coordination.thrash-detector.v1` | Thrash detector | S2 | deterministic-gate | active | 2026-12-01 |
| `reg.coordination.unit-lease.v1` | Unit lease gate | S2 | deterministic-gate | active | 2026-12-01 |
| `reg.authority.vendor-write-gate.v1` | Vendor write gate | S5 | deterministic-gate | active | 2026-12-01 |
| `reg.control.work-contract-gate.v1` | Work contract gate | S3 | deterministic-gate | active | 2026-12-01 |

## Budget guard

`reg.control.budget-guard.v1` · S3 · deterministic-gate · active · introduced in M07

**Purpose.** Meter each attempt's tokens, cost, wall-clock and turns against the policy's ceiling for the unit type; halt the attempt when a ceiling is crossed and refuse every tool with an effect from then on. The ledger is written to the execution store so the orchestrator closes on it and the read model can show it.

**Absorbs.** `runaway-unit` — A unit that keeps going — retrying, re-reading, re-editing — consumes the whole context window and the whole budget without anything outside the loop deciding it should.

**Mechanism.** `src/cp6-budget.ts` at `turn_end (ctx.abort)`, `tool_call`, `runUnit (close: budget-exhausted attempt)`

**Channels.** consumes `policy (budgets)`, `message_end usage`, `model_select` · emits `budget ledger (execution store)`

**Scope.** subjects unit, attempt · resources tokens, cost, wall-clock, turns

**Cost.** One ledger write per turn end; no model calls. Negligible next to the turns it meters.

**May.**
- halt the running attempt
- refuse non-read-only tools once a ceiling is crossed
- record the ledger

**May not.**
- raise a ceiling
- decide what happens to a halted unit (lesson 08)
- choose a model

**Evidence.** `src/cp6-budget.test.ts`, `src/controller.test.ts`, `../../packages/core/src/policy.test.ts`

**Limitations.**
- Ceilings are checked at turn end and tool call, so the turn that crosses one completes; a single very large response is not cut off mid-stream.
- Tokens and cost are what the provider reports on each assistant message; a provider that reports nothing meters as zero.
- The wall-clock ceiling is measured from session start, not from dispatch; time spent loading extensions or waiting on a rate limit counts against the unit.
- Attempts are the orchestrator's ceiling (runUnit), not the session's; a unit re-dispatched by hand outside runUnit is not counted.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01


## Contract advice section

`reg.control.contract-advice.v1` · S3 · prompt · active · introduced in M06

**Purpose.** Render the governing contract — fixed, delegated, unresolved, expected evidence, and the obligation to call report_result — as a system-prompt section, so the unit knows what freedom it has. This is advice: it changes what the model is told, not what it can do.

**Absorbs.** `uninformed-unit` — The gates refuse a bad report, but a unit that never saw the allocation produces one by accident and burns an attempt learning the contract from refusals.

**Mechanism.** `src/cp5-contract.ts` at `before_agent_start`

**Channels.** consumes `work contract (S3)` · emits nothing

**Scope.** subjects unit · resources system prompt

**May.**
- add a section to the system prompt

**May not.**
- enforce anything; the result-report gate and the lease gate do

**Evidence.** `src/cp5-contract.test.ts`

**Limitations.**
- Prompt text: the model may ignore it, and a long transcript may push it out of attention. Everything it says that matters is also a gate.
- The section is regenerated each turn from the loaded contract; it cannot reflect a contract version issued after the session started.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01


## Contract-preserving compaction

`reg.control.contract-preserving-compaction.v1` · S3 · model-judgment · active · introduced in M07

**Purpose.** Replace the default compaction summary with a deterministic block — the contract's identity and allocation, the evidence gathered so far, the files touched — followed by a model summary of the conversation when one is available. What the loop needs to continue never depends on the summary being good.

**Absorbs.** `compaction-amnesia` — After a threshold compaction the unit no longer knows which decisions were fixed, which were unresolved, or what it already proved; it re-does settled work or quietly violates a constraint the summary dropped.

**Mechanism.** `src/cp6-budget.ts` at `session_before_compact`, `session_compact`, `session_compact_failed`

**Channels.** consumes `work contract`, `budget ledger`, `compaction preparation (messages, file ops)` · emits `compaction entry`

**Scope.** subjects unit, attempt · resources context window

**Cost.** One summarization call per compaction on the session's model, bounded at 4096 output tokens; the deterministic block adds a few hundred tokens to every post-compaction context.

**May.**
- provide the compaction summary
- record the compaction in the ledger

**May not.**
- cancel a compaction
- change the contract
- decide what is kept beyond the preserved block (Pi's cut point stands)

**Evidence.** `src/cp6-budget.test.ts`, `../../packages/core/src/policy.test.ts`

**Limitations.**
- The conversation summary is model judgement: it can be wrong, and nothing checks it. Only the deterministic block is guaranteed.
- Evidence pointers are the first line of run_tests and run_checks results; evidence gathered through bash is invisible to it.
- The block is what compaction carries; the contract section in the system prompt (lesson 06) is regenerated every turn regardless. This regulator preserves progress, not the contract text.
- Without a model (or when it fails) the summary says so and the block stands alone; the unit continues with less.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01


## Effect journal

`reg.coordination.effect-journal.v1` · S2 · deterministic-gate · active · introduced in M08

**Purpose.** Make a side-effecting tool durable: write `intended` under an idempotency key before the effect and `committed` after; refuse to act again on a key that is committed or confirmed; on every session start reconcile each `intended` with no outcome against the world (confirmed or absent) before any new effect. A harness that loses its process between an effect and its record neither repeats the effect nor forgets it.

**Absorbs.** `duplicated-effect` — The notification was sent, the process died before it wrote that down, the retry sends it again; or the sandbox vanished mid-unit and nobody knows whether the external operation happened.

**Mechanism.** `src/cp7-recovery.ts` at `notify_owner (execute: begin/commit)`, `session_start (reconcile)`

**Channels.** consumes `tool call (notify_owner)`, `outbox (the world)` · emits `effect journal (.regulator/effects.ndjson)`

**Scope.** subjects unit, effect · resources outbox

**Cost.** Two journal appends per effect and one outbox read per pending intention at start; no model calls.

**May.**
- refuse a duplicate effect and return the recorded result
- mark a pending intention confirmed or absent from what the world shows

**May not.**
- undo an effect
- decide whether an effect should happen (the model asks; the contract and profile decide)
- reconcile effects it has no way to observe

**Evidence.** `src/cp7-recovery.test.ts`, `../../packages/core/src/recovery.test.ts`

**Limitations.**
- Reconciliation needs an observable world: notify_owner's outbox is keyed so it can be read back. An effect with no observable trace can only be recorded as absent, which is a guess.
- The idempotency key is the unit, the tool and the arguments; the same message sent on purpose twice is refused. Vary the message.
- Only notify_owner is journaled. bash is not: a shell command's side effects are unknown by declaration (lesson 03), and nothing here can journal what it cannot name.
- The journal is per base checkout, on one machine; two harnesses on two machines cannot see each other's intentions.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01


## Failure observer

`reg.control.failure-observer.v1` · S3 · deterministic-gate · active · introduced in M08

**Purpose.** Normalize every tool error and provider error in a session to a cause (environment, timeout, tool-error; a refused report_result is invalid-report) and append it to the unit's observations, so that an attempt that ends without a report is routed by what went wrong rather than by the fact that it went silent.

**Absorbs.** `opaque-failure` — The transcript knows the tests could not load a module; the orchestrator only knows the unit did not report. Retrying is the wrong action and nothing in the record says so.

**Mechanism.** `src/cp7-recovery.ts` at `tool_execution_end (isError)`, `agent_end (stopReason error)`

**Channels.** consumes `tool_execution_end`, `agent_end` · emits `failure observation (execution store)`

**Scope.** subjects unit, attempt · resources observations

**Cost.** One append per failed tool call; no model calls.

**May.**
- record an observation

**May not.**
- decide anything
- rewrite a tool result the model sees
- halt the attempt

**Evidence.** `src/cp7-recovery.test.ts`, `../../packages/core/src/recovery.test.ts`

**Limitations.**
- Normalization is a regular expression over the error text (flattened to one line, first 300 characters); an environment problem phrased unusually is recorded as a plain tool error. Only a refused report_result is typed without the regex, as invalid-report.
- Only errors the tool layer reports as errors are observed: a test that fails is not an error, and a bash command that exits non-zero without the tool flagging it is invisible.
- The observer records; it never rewrites the result the model sees (tool_result), so the model and the router may disagree about what happened.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01


## Model router

`reg.control.model-router.v1` · S3 · deterministic-gate · active · introduced in M07

**Purpose.** Run each unit type on the model the policy routes it to, and on a provider failure move to the next declared fallback in a fresh session. Nothing outside the route is ever tried, and every model an attempt ran on is in its ledger.

**Absorbs.** `single-model-dependence` — A harness whose only model is rate-limited, deprecated or down has zero regulatory variety: every unit stops, and nothing records why.

**Mechanism.** `src/dispatch-pi.ts` at `piDispatcher (model choice, failover)`, `model_select (ledger)`

**Channels.** consumes `policy (models)`, `model availability (ModelRuntime)` · emits `budget ledger models[]`

**Scope.** subjects unit type · resources model, provider

**Cost.** One availability lookup per dispatch; a failover repeats the unit's prompt on the fallback model, so a failed attempt can cost twice.

**May.**
- choose among the route's models by availability
- fail over to the next declared model after a provider error

**May not.**
- use a model the route does not name
- upgrade or downgrade on judgement of task difficulty
- change the route

**Evidence.** `../../packages/core/src/policy.test.ts`

**Limitations.**
- Failover starts a fresh session: the fallback model does not see what the primary did, only the contract, and the ledger of the first session records the wasted attempt cost.
- Availability means an API key is configured, not that the provider is up; a provider that fails on the first call still costs one session.
- The dispatcher itself is exercised only with a live model (the lesson's drill); the route resolution it relies on is what the tests cover.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01


## Profile write grant

`reg.control.profile-write-grant.v1` · S3 · deterministic-gate · active · introduced in M04

**Purpose.** Limit direct write and edit calls to the paths the active capability profile grants, and limit the active tool surface to the profile's tools.

**Absorbs.** `ungranted-capability-use` — Work of one kind (research, implementation) reaching tools or paths it was never granted, because a persona prompt is the only thing saying otherwise.

**Mechanism.** `src/cp3-profiles.ts` at `session_start`, `tool_call`

**May.**
- set the active tool set when a profile is applied
- block a write or edit outside the profile's writable paths

**May not.**
- select a profile without a user command or CLI flag
- block shell commands
- grant a tool the host does not have

**Evidence.** `src/cp3-profiles.test.ts`

**Limitations.**
- Positive grant covers write and edit only; the implement profile grants bash, which is not path-gated.
- Read-only means declared read-only effects (effects.ts); a tool with an undeclared effect is refused from read-only profiles, not audited.
- Lexical path check only, as for the vendor write gate.

**Ownership.** course-lab · introduced 2026-09-21 · review by 2026-12-01


## Recovery router

`reg.control.recovery-router.v1` · S3 · deterministic-gate · active · introduced in M08

**Purpose.** Route every blocked unit: normalize the failure to one cause from the orchestrator's records, S2's signals and the session's observations; take the action the versioned recovery policy names for that cause on its Nth occurrence; record the decision immutably with the policy version; apply what the loop can apply (retry and repair with a hint, abort, escalate as an algedonic signal) and hold the rest for a decision from outside the loop.

**Absorbs.** `naive-retry` — A failed attempt is retried as-is, again and again: a variety amplifier pointed at the wrong target, multiplying cost without adding information, until the budget is gone and nobody can say why.

**Mechanism.** `src/controller.ts` at `routeUnit (after a blocked outcome)`, `driveUnit (the autoloop)`

**Channels.** consumes `attempt records`, `failure observations`, `coordination-signal (oscillation, conflict)`, `recovery policy` · emits `recovery decision (execution store)`, `algedonic-signal → S5 (policy exhausted)`

**Scope.** subjects unit, attempt · resources attempts, lease, worktree

**Cost.** No model calls. One decision record per routed failure; a retry or repair costs a further attempt, which is why the attempt ceiling caps them.

**May.**
- classify a failure
- select the policy's action
- re-dispatch with a hint
- abort a unit and release its claim
- escalate to S5

**May not.**
- change the recovery policy
- issue a new contract version (replan is S3 planning, not routing)
- answer a clarification (that is the owner's)
- resolve an obligation on the unit's behalf

**Evidence.** `../../packages/core/src/recovery.test.ts`, `src/controller.test.ts`

**Limitations.**
- Classification is a fixed precedence over recorded facts; a failure with two causes is routed by the first the precedence finds, and check-failure is not yet produced because harness-run verification arrives in lesson 09.
- Remediate, replan, clarify and pause are recorded and the unit waits; nothing in the loop performs them, and nothing yet reminds anyone that they are waiting (lesson 11's obligations).
- Occurrences are counted per cause per unit; a unit that alternates between two causes never reaches the third action of either rule and is stopped by the attempt ceiling instead.
- Escalation is an algedonic signal in the signal sink; until obligations exist it is exposed by the read model, not delivered.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01


## Reintegration guard

`reg.coordination.reintegration.v1` · S2 · deterministic-gate · active · introduced in M05

**Purpose.** Merge a unit's branch back into the base only from a clean checkout on the base branch; on conflict, abort, leave the base exactly as found, and hand the conflicting paths to S3 as a coordination signal.

**Absorbs.** `hidden-coupling` — Work done in isolation looks finished until it meets the base; a merge that auto-resolves, or that lands on a dirty checkout, hides the coupling instead of surfacing it.

**Mechanism.** `src/worktree.ts` at `regulator unit finish`

**Channels.** consumes `unit branch`, `base branch` · emits `coordination-signal (conflict) → S3`

**Scope.** subjects unit · resources base branch, worktree

**May.**
- refuse to merge into a dirty checkout or from the wrong branch
- abort a conflicting merge and record the conflicting paths
- remove the worktree and branch and release the lease after a clean merge

**May not.**
- resolve a conflict
- rebase or rewrite history
- merge without a clean base

**Evidence.** `src/worktree.test.ts`, `src/unit.test.ts`

**Limitations.**
- Detects file-level conflicts only; two units can change disjoint files and still break each other (the S2 gap analysis's semantic-conflict case).
- Merge commits only; no rebase, squash or fast-forward policy.
- Nothing runs the checks after the merge yet; lesson 09 adds evidence at closeout.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01


## Result report gate

`reg.control.result-report-gate.v1` · S3 · deterministic-gate · active · introduced in M06

**Purpose.** Close a unit only from a result report that honours the exact contract version: every delegated choice reported, every unresolved decision preserved or surfaced (never settled), required evidence present, fixed-decision deviations referenced. Refuses the report at the tool and again at close; a unit with no report or an invalid one is blocked, not closed.

**Absorbs.** `silent-closure` — A unit declares itself done; the decisions it made under uncertainty, the ones it quietly settled, and the constraints it bent are visible only to whoever reads the whole transcript.

**Mechanism.** `src/cp5-contract.ts` at `report_result (tool execute)`, `runUnit (close)`

**Channels.** consumes `result report (S1, via report_result)` · emits `operational-signal → S3 (high-consequence emergent decisions, deviations)`

**Scope.** subjects unit, contract · resources execution store

**May.**
- refuse a report with reasons
- block a unit that ends without a valid report
- record emergent decisions and deviations as typed signals for S3

**May not.**
- certify that the work is correct (verification and audit do that)
- resolve an unresolved decision
- decide what to do about a blocked unit (lesson 08)

**Evidence.** `src/cp5-contract.test.ts`, `src/controller.test.ts`, `../../packages/core/src/contracts.test.ts`

**Limitations.**
- Evidence is checked by class, not by content: a report can cite a test run it did not make. Host-run verification (lesson 09) is what makes evidence independent of the report.
- A unit can describe an unresolved decision as 'preserved' while its diff settles it; the gate reads the report, never the diff, by design — catching that is audit's job.
- Emergent decisions below high consequence are recorded in the report only; nothing routes them yet.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01


## Thrash detector

`reg.coordination.thrash-detector.v1` · S2 · deterministic-gate · active · introduced in M05

**Purpose.** Count write and edit calls per file within a unit and emit a typed coordination signal past a threshold, so oscillation between two fixes becomes visible to S3 instead of burning budget silently.

**Absorbs.** `oscillation` — Fix A breaks B, fix B breaks A; each individual edit is locally reasonable and nothing in the loop notices the pattern.

**Mechanism.** `src/cp4-coordination.ts` at `tool_execution_end`

**Channels.** consumes `tool_execution_end (write, edit)` · emits `coordination-signal (oscillation) → S3`

**Scope.** subjects unit · resources file

**May.**
- record a coordination signal to .regulator/signals.ndjson and notify the user

**May not.**
- block a tool call
- pause or replan the unit (S3 decides, lesson 08)
- decide which of two fixes is right

**Evidence.** `src/cp4-coordination.test.ts`, `../../packages/core/src/coordination.test.ts`

**Limitations.**
- Counts write and edit tool calls only; edits made through bash are invisible to it.
- Memory is per session: a unit resumed in a new session starts counting from zero.
- The threshold is a constant, not a policy; lesson 07 makes it a budget.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01


## Unit lease gate

`reg.coordination.unit-lease.v1` · S2 · deterministic-gate · active · introduced in M05

**Purpose.** Refuse every tool with a non-read-only effect unless the session's unit holds a live lease on the worktree it runs in, so two units cannot write the same checkout and a dead session cannot hold a claim forever.

**Absorbs.** `write-collision` — Two sessions writing one checkout corrupt each other's work; a session that died mid-unit blocks the resource until someone notices.

**Mechanism.** `src/cp4-coordination.ts` at `session_start`, `tool_call`, `turn_end`

**Channels.** consumes `lease (.regulator/leases)` · emits nothing

**Scope.** subjects unit, session · resources worktree

**May.**
- refuse any non-read-only tool call while no live lease covers the working directory
- renew the unit's lease at each turn end

**May not.**
- acquire or release a lease (the unit lifecycle does that)
- resolve which unit should hold a contested resource
- block read-only tools

**Evidence.** `src/cp4-coordination.test.ts`, `../../packages/core/src/coordination.test.ts`

**Limitations.**
- Liveness is expiry-only: a live process that stops heartbeating and a dead one look the same until the TTL passes; there is no fencing token yet.
- The lease covers the working directory by path; a tool that writes elsewhere by absolute path is outside it (lesson 10).
- Leases are files on one machine; nothing coordinates across hosts.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01


## Vendor write gate

`reg.authority.vendor-write-gate.v1` · S5 · deterministic-gate · active · introduced in M02

**Purpose.** Refuse write and edit calls under vendor/ so that vendored code stays upstream's, whatever the model is asked.

**Absorbs.** `protected-path-mutation` — The smallest diff for a request is often inside a vendored file; a rule stated only in prose holds inconsistently under pressure.

**Mechanism.** `src/cp1-trace.ts` at `tool_call`

**May.**
- block a write or edit whose normalized path is under vendor/
- record the refusal and its reason in the trace

**May not.**
- block shell commands
- modify any file
- change what counts as protected

**Evidence.** `src/cp1-trace.test.ts`

**Limitations.**
- Lexical path check only: no symlink, hard-link or TOCTOU protection (lesson 10 hardens it).
- Covers the write and edit tools; bash and custom tools bypass it (lessons 05 and 10).

**Ownership.** course-lab · introduced 2026-09-21 · review by 2026-12-01


## Work contract gate

`reg.control.work-contract-gate.v1` · S3 · deterministic-gate · active · introduced in M06

**Purpose.** Refuse to dispatch a unit whose contract cannot be honoured: colliding decision ids, an unresolved decision that must be resolved before execution, a unit type the workload does not declare, or a workload the instance does not run. Dispatch happens only against a recorded, immutable contract version.

**Absorbs.** `implicit-delegation` — A task description hands S1 every decision the planner did not think of; the unit settles them by omission and the choices disappear into the diff.

**Mechanism.** `src/controller.ts` at `runUnit (before createUnit)`, `session_start (cp5-contract)`

**Channels.** consumes `work contract (S3)`, `workload definition` · emits nothing

**Scope.** subjects unit, contract · resources execution store

**May.**
- refuse dispatch
- record the contract version that governs execution

**May not.**
- write or amend a contract (S3 planning does that; a change is a new version)
- reclassify an unresolved decision as delegated
- grant a unit any regulatory capability

**Evidence.** `src/controller.test.ts`, `src/cp5-contract.test.ts`

**Limitations.**
- Checks the contract's shape and internal consistency only; it cannot tell whether the objective genuinely requires settling an unresolved decision — that shows up afterwards as an emergent decision in the report.
- Authority references on fixed decisions are strings; nothing verifies that the cited invariant or decision exists (lesson 12).
- The contract is loaded from a file path the session was given; the lease gate, not this gate, is what keeps another session from running under it.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01
