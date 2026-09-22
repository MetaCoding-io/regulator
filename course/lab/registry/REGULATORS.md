# Regulators

Generated from `registry/regulators/*.json` by `regulator docs`. Do not edit by hand.

| ID | Name | Function | Level | Status | Review by |
| --- | --- | --- | --- | --- | --- |
| `reg.control.budget-guard.v1` | Budget guard | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.audit.canary-watch.v1` | Canary watch | S3* | deterministic-gate | active | 2026-12-01 |
| `reg.audit.closeout-gate.v1` | Closeout gate | S3* | deterministic-gate | active | 2026-12-01 |
| `reg.control.contract-advice.v1` | Contract advice section | S3 | prompt | active | 2026-12-01 |
| `reg.control.contract-preserving-compaction.v1` | Contract-preserving compaction | S3 | model-judgment | active | 2026-12-01 |
| `reg.coordination.effect-journal.v1` | Effect journal | S2 | deterministic-gate | active | 2026-12-01 |
| `reg.control.evidence-preflight.v1` | Evidence preflight | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.control.failure-observer.v1` | Failure observer | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.authority.identity-write-gate.v1` | Identity write gate | S5 | deterministic-gate | active | 2026-12-01 |
| `reg.intelligence.intelligence-intake.v1` | Intelligence intake | S4 | typed-tool | active | 2026-12-01 |
| `reg.control.model-router.v1` | Model router | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.control.obligation-router.v1` | Obligation router | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.control.profile-write-grant.v1` | Profile write grant | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.control.progression-veto.v1` | Progression veto | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.authority.project-trust-rule.v1` | Project trust rule | S5 | deterministic-gate | active | 2026-12-01 |
| `reg.authority.proposal-intake.v1` | Proposal intake | S5 | typed-tool | active | 2026-12-01 |
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


## Canary watch

`reg.audit.canary-watch.v1` · S3* · deterministic-gate · active · introduced in M10

**Purpose.** Watch for the instance's canary values — credential-looking values recorded at fixture time from a committed .env — in every tool result and in the model's own text. A canary in a tool result is redacted before the model sees it and recorded as a critical audit finding; a canary the model writes cannot be unsaid and is recorded.

**Absorbs.** `secret-exposure` — A unit reads .env to 'understand the configuration', the token is now in the transcript, and the next tool call or the next report carries it out.

**Mechanism.** `src/cp9-authority.ts` at `tool_result (redact)`, `message_end (record)`

**Channels.** consumes `tool_result`, `message_end`, `.regulator/canaries` · emits `audit-finding → S3 (secret-exposure, critical)`

**Scope.** subjects tool result, assistant message · resources canary values

**Cost.** One substring scan per tool result text block and per assistant message; no model calls.

**May.**
- redact a canary from a tool result
- record a finding

**May not.**
- stop the model from reading the file (the read is the unit's; the exposure is what is watched)
- recall text already sent to a provider

**Evidence.** `src/cp9-authority.test.ts`

**Limitations.**
- It watches for known values only: a real secret the harness was not told about is not a canary. This measures whether the exposure path exists, not whether every secret is safe.
- A canary that reaches the model in a form the scan does not match (split across blocks, base64, described rather than quoted) is not redacted.
- By the time message_end records a leak the text has left the process: the finding is evidence of exposure, not prevention. Network egress is not watched at all; the lesson names it as the boundary a container provides.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01


## Closeout gate

`reg.audit.closeout-gate.v1` · S3* · deterministic-gate · active · introduced in M09

**Purpose.** Refuse to close a unit unless the harness's own evidence says its contract is met: after a valid result report, run the checks the workload names for the unit type with the orchestrator's process runner against the unit's committed revision, bind every result to the unit, attempt, contract, revision, environment and the criteria it speaks to, append it to the audit log, and derive the technical verdict from the evidence that is fresh for that revision — plus a human acceptance for each required criterion no check can observe. Missing, stale, failing or contradicted evidence blocks closeout; the report's claims satisfy nothing.

**Absorbs.** `self-certified-completion` — The unit says the tests pass. Nothing ran them, or they ran three commits ago, or they ran and failed and the report says otherwise; the loop closes on the sentence.

**Mechanism.** `src/controller.ts` at `auditUnit (after the report check, before reintegration)`, `closeUnit (re-audit without an attempt)`

**Channels.** consumes `result report`, `workload unit-type checks`, `worktree at HEAD`, `human acceptance (audit log)` · emits `evidence record (audit log)`, `technical verdict (audit log)`, `audit-finding → S3 (closeout refused)`

**Scope.** subjects unit, attempt, criterion · resources worktree, audit log

**Cost.** One run of the unit type's checks per closeout — the project's own test suite and deterministic checks — with no model call. The same checks the unit already ran, run again by a runner the unit does not control: that duplication is the price of independence.

**May.**
- run the workload's checks against the committed revision
- record evidence and a verdict
- refuse closeout
- emit an audit finding to S3

**May not.**
- accept a criterion a check cannot observe (a person does that, separately)
- decide what happens to the blocked unit (the recovery router does)
- read the report as evidence
- run a check the workload does not name

**Evidence.** `../../packages/checks/src/verify.test.ts`, `src/controller.test.ts`

**Limitations.**
- Evidence binds to criteria by class, not by content: a passing suite that does not exercise the changed behaviour satisfies a test-class criterion. Criterion-specific checks are a workload's to declare; the software workload declares only run_tests and run_checks.
- The environment recorded is the orchestrator's host; a check that passes here and fails on the target platform is not caught.
- Runtime-class criteria are treated like semantic ones (human acceptance) because no host mechanism observes runtime behaviour yet.
- The audit log is one NDJSON file per instance beside the regulatory log (messages and their obligations, lesson 11); neither is merged with the SQLite regulatory event store the reporting tools write.

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


## Evidence preflight

`reg.control.evidence-preflight.v1` · S3 · deterministic-gate · active · introduced in M09

**Purpose.** Stamp every run_tests and run_checks result with the revision it ran against and whether the tree was dirty, as a typed session entry and in the text the model sees; and block report_result before the report is written when it cites a test or command run that did not happen in this session, ran on another revision or a dirty tree, or did not pass. The cheap lie is refused where it is told.

**Absorbs.** `claimed-evidence` — The report cites run_tests; run_tests never ran, or ran before the last edit, or ran and failed. Without a preflight the lie costs a full closeout audit to catch.

**Mechanism.** `src/cp8-evidence.ts` at `tool_result (run_tests, run_checks: provenance)`, `tool_call (report_result: block)`

**Channels.** consumes `tool_result`, `tool_call (report_result)` · emits `evidence-provenance entry (session)`

**Scope.** subjects report, tool run · resources session

**Cost.** Two git commands per stamped result and per preflight; a few dozen tokens of stamp per tool result; no model calls.

**May.**
- stamp a tool result
- block a report_result call with the reason

**May not.**
- certify the evidence (the closeout gate does, independently)
- rewrite what a tool reported
- block anything but report_result

**Evidence.** `src/cp8-evidence.test.ts`

**Limitations.**
- It trusts the session's own tool run: the session ran run_tests, and the session is what is being checked. Independence comes from the closeout gate, which reads nothing this extension records.
- Only test and command claims are preflighted; file, runtime, semantic and model claims pass through to the closeout gate.
- A run_tests call with a filter that passes counts as a passing run: the preflight sees the verdict, not the coverage.

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


## Identity write gate

`reg.authority.identity-write-gate.v1` · S5 · deterministic-gate · active · introduced in M10

**Purpose.** Refuse every write or edit that would touch the instance's identity (regulator/identity/), the committed S5 artifacts, the project's protected paths, or any of their parents — through any spelling Pi expands, any traversal, and any filesystem alias (symbolic link, hard link, non-directory parent) — and execute exactly the normalized path that was checked. For bash, which no hook can sandbox, snapshot the protected files before the command and restore them after: a change is reverted from the snapshot, reported in the tool result, and recorded as an audit finding under INV-001.

**Absorbs.** `identity-mutation` — The unit edits the invariant that forbids editing invariants — directly, through a symlink named notes.md, or with a heredoc in bash — and the harness's own definition of itself is now whatever the last unit wanted.

**Mechanism.** `src/cp9-authority.ts` at `tool_call (write, edit: prepareWritePath)`, `tool_call (bash: snapshot)`, `tool_result (bash: restore and report)`

**Channels.** consumes `tool_call`, `tool_result`, `project conventions (protected paths)`, `regulator/identity/` · emits `audit-finding → S3 (INV-001, bash restored a protected path)`

**Scope.** subjects path, tool call · resources regulator/identity/, vsm/*, vendor/

**Cost.** One filesystem walk of the target path per write or edit; one read of every protected file before and after each bash call. No model calls.

**May.**
- refuse a write or edit with the reason
- rewrite the path a tool executes to the one it checked
- restore a protected file from its pre-command snapshot
- record an audit finding

**May not.**
- grant s5-authority (no argument, prompt or proposal can)
- undo a commit, a push, or anything a shell did outside the working tree
- sandbox a process

**Evidence.** `../../packages/core/src/authority.test.ts`, `src/cp9-authority.test.ts`, `../../packages/pi-extension/src/index.test.ts`

**Limitations.**
- A tool-call hook protects calls routed through the hook. It does not sandbox the process: a shell command that commits a protected change, pushes it, or edits a copy of the repository elsewhere is outside it. The bash watch restores the working tree only; a commit made by the same command keeps the change in history, and reintegration would carry it.
- The snapshot-and-restore is not atomic: a command that reads a protected file it has just modified sees the modification before the restore.
- The alias walk is a preflight against a stable filesystem; a link created between the check and the write (TOCTOU) is not seen. Real isolation is the operating system's or a container's.
- Protected paths are the identity directory, the S5 artifacts and what the project's conventions declare (vendor/); a path the project protects by convention nobody declared is not protected.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01


## Intelligence intake

`reg.intelligence.intelligence-intake.v1` · S4 · typed-tool · active · introduced in M11

**Purpose.** Give a research unit exactly one way to say what it found out about the environment: report_intelligence, a typed tool that records an intelligence-signal (S4 → S3) in the regulatory log — claim, observation, evidence, confidence, recency, expiry, affected units — with the unit, revision and time as provenance the model does not supply. It changes nothing: no unit, no policy, no file. A research unit runs like any unit — its own contract, budget, model route and profile, dispatched by S3 — so intelligence has a source, a cost and a boundary.

**Absorbs.** `intelligence-as-authority` — A research finding is written straight into the plan, the code or the policy: the advisory that was true last month rewrites working code this month, and nobody can say who decided.

**Mechanism.** `src/cp10-intelligence.ts` at `report_intelligence (tool execute)`

**Channels.** consumes `tool call (report_intelligence)`, `lease (unit provenance)`, `worktree HEAD (revision provenance)` · emits `intelligence-signal → S3 (regulatory log)`, `regulator:intelligence (session entry)`

**Scope.** subjects intelligence, unit · resources .regulator/signals.ndjson

**Cost.** One appended message per finding, no model calls in the tool. The research unit itself is a session under the research budget in the policy — smaller than implement's, on a cheaper route.

**May.**
- record a finding with host-stamped provenance
- name the units the finding bears on

**May not.**
- apply the finding
- open, resolve or route an obligation
- set the severity the router acts on (it reports; the router derives)
- write to the repository (the intelligence profile grants no write, edit or shell)

**Evidence.** `src/cp10-intelligence.test.ts`, `src/controller.test.ts`

**Limitations.**
- The tool trusts the profile grant to keep it in research units: an implement unit given the tool would be recorded as S4. The intelligence profile is what puts the tool in a session's surface; nothing in the tool checks the unit type.
- Evidence refs are stamped with the revision they were read at, but a ref to something outside the repository (an advisory URL, a registry version) is a claim the closeout gate cannot verify; only file refs are checked at HEAD.
- Expiry is the unit's estimate; the router notes expired intelligence and nothing re-raises a research obligation when a finding an active unit relied on goes stale.
- One question per contract by convention, not by mechanism: a research unit may call the tool as often as it likes within its budget.

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


## Obligation router

`reg.control.obligation-router.v1` · S3 · deterministic-gate · active · introduced in M11

**Purpose.** Route every message the instance records — findings, proposals, coordination and operational signals, uncertainty, intelligence, escalations — under the versioned routing policy: at or above the policy's line for its kind it opens an obligation for the named consumer (S3, S5 or a person) with the router's effective severity; below it, or with no rule, it is noted with the reason and stays trace. Recovery decisions the loop cannot apply open the obligation the unit waits on, and S3's own decision dispositions what S3 was routed. State is the fold of appended events: open → acknowledged → resolved | escalated | superseded, terminal records never reopen, an escalation always has a successor.

**Absorbs.** `signal-into-a-log` — A recovery decision, a proposal, an escalation or a finding is recorded and then nothing: nobody is named as owing a response, nothing reminds anyone, and the unit either waits forever or is quietly moved on.

**Mechanism.** `src/controller.ts` at `runUnit (after the session, after the audit, after the report's signals)`, `closeUnit (after the audit)`, `routeUnit (before and after the recovery decision)`, `regulator signals route`

**Channels.** consumes `every message kind (regulatory log)`, `recovery decision`, `routing policy` · emits `obligation-opened / -acknowledged / -resolved / -escalated / -superseded (regulatory log)`, `message-noted (regulatory log)`

**Scope.** subjects message, obligation, unit · resources .regulator/signals.ndjson

**Cost.** No model calls. One appended event per routed message and per transition; the log is re-folded on every read, which is linear in its length.

**May.**
- open an obligation for a consumer the policy names
- note a message as trace with the reason
- derive effective severity from the policy, never from the emitter's claim
- resolve or escalate an S3 obligation by S3's own recovery decision

**May not.**
- resolve an obligation owed to S5 or a person
- perform what an obligation asks
- reopen a terminal record
- escalate without a successor
- change the routing policy

**Evidence.** `../../packages/core/src/obligations.test.ts`, `src/controller.test.ts`

**Limitations.**
- Routing runs at the loop's steps and on `regulator signals route`; a message recorded by a session run by hand waits in the log until one of them. Nothing watches the file.
- A consumer is a name in the policy (S3, S5, human). Nothing delivers an obligation to a person or reminds them; the read model and the control room expose what is owed, and lesson 13's algedonic channel is the delivery mechanism for the ones that cannot wait.
- Effective severity is the message's own except for uncertainty, whose reported impact is mapped through the policy. A message that names a protected invariant is not raised above its severity by that fact; policy floors by subject are lesson 12's.
- The CLI trusts `--by`: a resolution records who claimed to resolve it. Authority over dispositions (who may accept a risk at what severity) is not checked, and no dialog asks anyone (lesson 13).

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


## Progression veto

`reg.control.progression-veto.v1` · S3 · deterministic-gate · active · introduced in M11

**Purpose.** Refuse to dispatch or close a unit while an obligation at or above the routing policy's blocking line is open on it, whoever it is owed to. The S3–S4 homeostat, mechanised: intelligence that names a unit holds that unit until S3 or a person dispositions the obligation it raised — it never replans, never edits, never applies itself. A clarification a person answered reaches the next attempt as the hint.

**Absorbs.** `last-signal-wins` — An advisory arrives against a commitment and whichever came last decides: the unit is dispatched anyway because nothing stood in the loop's path, or the advisory rewrites working code because a prompt said it should.

**Mechanism.** `src/controller.ts` at `runUnit (before the lease is taken)`, `closeUnit (before the re-audit)`

**Channels.** consumes `open obligations naming the unit (regulatory log)`, `routing policy (blocksAtOrAbove)` · emits `contract problem: obligations (refusal)`

**Scope.** subjects unit · resources .regulator/signals.ndjson

**Cost.** One fold of the regulatory log per dispatch and per close; no model calls. A unit held on a stale concern costs the wait — which is the point: the cost is visible, and owed to someone.

**May.**
- refuse dispatch
- refuse close
- carry a person's resolution to the next attempt as advice

**May not.**
- resolve the obligation
- apply the intelligence
- replan the unit (a new contract version is S3 planning)
- hold a unit on an obligation below the policy's line

**Evidence.** `src/controller.test.ts`, `../../packages/core/src/obligations.test.ts`

**Limitations.**
- Checked at dispatch and at close only. A unit already running when the obligation opens finishes its attempt; the veto meets it at the next step.
- Blocking is a function of severity and the policy's line; the obligation's consumer is not consulted. An S5 proposal at blocking severity on a unit would hold the unit, which may or may not be wanted — the routing policy decides by setting the line.
- The veto names the unit id. Intelligence that affects a unit not yet contracted holds it once it exists; intelligence that affects a file, a dependency or a workload has no unit to hold and is an obligation for S3 to read.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01


## Project trust rule

`reg.authority.project-trust-rule.v1` · S5 · deterministic-gate · active · introduced in M10

**Purpose.** Load into a unit's session the extensions the definition declares and nothing the project supplies. The SDK's resource loader discovers a project's own .pi/extensions, skills, prompt templates and themes from the working directory without asking — Pi's project_trust event is the CLI's, not the loader's — so the dispatcher builds every session with a loader that turns project resources off and filters the extensions it finds to the definition's list, recording what it refused. The CLI path answers project_trust with 'no' as well. A unit's project is data the unit works on, never a source of control for the harness.

**Absorbs.** `trust-boundary-crossing` — The target repository ships .pi/extensions/helpful.ts, which registers a tool that widens the surface or rewrites results; the harness loads it because the directory looked like a project.

**Mechanism.** `src/dispatch-pi.ts` at `definitionResourceLoader (extensionsOverride, no project skills/prompts/themes)`, `project_trust (cp9-authority.ts, CLI sessions)`

**Channels.** consumes `resource loader (discovered extensions)`, `project_trust` · emits `refused extension list (dispatcher echo)`

**Scope.** subjects project · resources .pi/, .agents/skills

**Cost.** None: one event handler that returns a constant.

**May.**
- refuse a discovered extension the definition does not declare
- turn off project skills, prompt templates and themes for a session
- decline project trust for a CLI session

**May not.**
- make untrusted content safe (trust is an input-loading guard, not a sandbox)
- prevent context files (AGENTS.md) from loading: Pi loads them regardless of trust

**Evidence.** `src/cp9-authority.test.ts`

**Limitations.**
- Trust is an input-loading guard. It keeps a project's own extensions, skills, prompt templates and themes out of the harness; it does nothing about instructions in the project's files, comments, test output or documentation — those are the injection drill, and the answer to them is that authority lives in gates the content cannot reach.
- Context files (AGENTS.md, CLAUDE.md) and project settings are still read: Pi 0.87.0 loads context files regardless of trust, and the dispatcher does not yet substitute an in-memory settings manager, so a project's .pi/settings.json can still shape the session (compaction thresholds, for example).
- The filter is by resolved path against the definition's list; an operator's user/global extensions are refused too, which is the intended reading of 'declared, not assembled' but surprises anyone who expected their own extensions to ride along.
- The project_trust answer covers the CLI path (`pnpm cp9`); a learner who launches pi by hand with trust remembered as yes has trusted the project themselves.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01


## Proposal intake

`reg.authority.proposal-intake.v1` · S5 · typed-tool · active · introduced in M10

**Purpose.** Give a unit a typed way to ask for a change to identity, policy or a protected path — propose_policy_change — that records a policy-proposal message on the proposal channel for S5 and changes nothing: no file, no policy, no grant. The right to ask is mechanically separate from the right to change (INV-002).

**Absorbs.** `proposal-as-policy` — A unit that cannot edit the invariant argues its case in the transcript and then edits the invariant; or a harness that lets a 'proposal' tool apply the change it proposes.

**Mechanism.** `src/cp9-authority.ts` at `propose_policy_change (tool execute)`

**Channels.** consumes `tool call (propose_policy_change)` · emits `policy-proposal → S5 (regulatory log)`

**Scope.** subjects proposal · resources .regulator/signals.ndjson

**Cost.** One appended message per proposal; no model calls.

**May.**
- record a proposal with the unit as provenance

**May not.**
- apply the change
- grant authority
- decide the proposal (S5 or a person does, outside the loop)

**Evidence.** `src/cp9-authority.test.ts`

**Limitations.**
- A proposal is routed into an obligation owed to S5 (lesson 11) and shown by the read model; nothing delivers it to a person, and the S5 decision itself — accepting the proposal into identity — has no workflow yet (lesson 12).
- The proposal's source is S1 by construction; a proposal from S3 or S4 (a router that wants a policy change) has no tool yet.
- Evidence on a proposal is empty: the tool does not let the model attach evidence refs, because a claim about evidence is not evidence.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01


## Recovery router

`reg.control.recovery-router.v1` · S3 · deterministic-gate · active · introduced in M08

**Purpose.** Route every blocked unit: normalize the failure to one cause from the orchestrator's records, S2's signals and the session's observations; take the action the versioned recovery policy names for that cause on its Nth occurrence; record the decision immutably with the policy version; apply what the loop can apply (retry and repair with a hint, abort, escalate as an algedonic signal) and hold the rest for a decision from outside the loop.

**Absorbs.** `naive-retry` — A failed attempt is retried as-is, again and again: a variety amplifier pointed at the wrong target, multiplying cost without adding information, until the budget is gone and nobody can say why.

**Mechanism.** `src/controller.ts` at `routeUnit (after a blocked outcome)`, `driveUnit (the autoloop)`

**Channels.** consumes `attempt records`, `failure observations`, `coordination-signal (oscillation, conflict)`, `recovery policy` · emits `recovery decision (execution store)`, `algedonic-signal → S5 (policy exhausted)`, `obligation for the waiting action (via the obligation router)`

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
- Classification is a fixed precedence over recorded facts; a failure with two causes is routed by the first the precedence finds. A check-failure whose root cause is environmental is routed as check-failure, because the orchestrator's record wins over the session's observation.
- Remediate, replan, clarify and pause are recorded and the unit waits on an obligation for the consumer the routing policy names (lesson 11); nothing in the loop performs them, and a person who resolves the obligation is trusted by name.
- Occurrences are counted per cause per unit, by design: a unit that alternates between two causes never reaches the third action of either rule and is stopped by the attempt ceiling, and the alternation is visible in its decisions and obligations. A policy that wants a global count declares shorter rules.
- Escalation is an algedonic signal in the regulatory log and an obligation owed to a person (lesson 11); it is exposed by the read model and the control room, not delivered to anyone (lesson 13).

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
- Every emergent decision, deviation and residual uncertainty in the report becomes a signal the routing policy routes (lesson 11); which of them opens an obligation is the policy's line, so a low-consequence decision is noted as trace, not read by anyone.

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
- The lease covers the working directory by path; a tool that writes elsewhere by absolute path is outside the lease — checkpoint 9's write gate refuses absolute paths, but bash is not path-gated.
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
- Lexical path check only: no symlink, hard-link or TOCTOU protection. Checkpoint 9's identity write gate (lesson 10) supersedes it with the filesystem walk when both are loaded; this gate stays as the lesson 02 baseline.
- Covers the write and edit tools; bash and custom tools bypass it. Checkpoint 9 adds the bash snapshot-and-restore for protected paths.

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
