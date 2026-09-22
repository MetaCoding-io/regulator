# Regulators

Generated from `registry/regulators/*.json` by `regulator docs`. Do not edit by hand.

| ID | Name | Function | Level | Status | Review by |
| --- | --- | --- | --- | --- | --- |
| `reg.algedonic.delivery.v1` | Algedonic delivery | S5 | deterministic-gate | active | 2026-12-01 |
| `reg.audit.behaviour-check.v1` | Behaviour check (export-signature) | S3* | deterministic-gate | active | 2026-12-01 |
| `reg.control.budget-guard.v1` | Budget guard | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.audit.canary-watch.v1` | Canary watch | S3* | deterministic-gate | active | 2026-12-01 |
| `reg.audit.closeout-gate.v1` | Closeout gate | S3* | deterministic-gate | active | 2026-12-01 |
| `reg.control.contract-advice.v1` | Contract advice section | S3 | prompt | active | 2026-12-01 |
| `reg.control.contract-preserving-compaction.v1` | Contract-preserving compaction | S3 | model-judgment | active | 2026-12-01 |
| `reg.identity.definition-check.v1` | Definition check | S5 | deterministic-gate | active | 2026-12-01 |
| `reg.authority.disposition-authority.v1` | Disposition authority | S5 | deterministic-gate | active | 2026-12-01 |
| `reg.coordination.effect-journal.v1` | Effect journal | S2 | deterministic-gate | active | 2026-12-01 |
| `reg.assurance.eval-harness.v1` | Eval harness and graders | S3* | deterministic-gate | active | 2026-12-01 |
| `reg.control.evidence-preflight.v1` | Evidence preflight | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.control.failure-observer.v1` | Failure observer | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.identity.identity-context.v1` | Identity context | S5 | prompt | active | 2026-12-01 |
| `reg.audit.identity-untouched-check.v1` | Identity-untouched check | S3* | deterministic-gate | active | 2026-12-01 |
| `reg.authority.identity-write-gate.v1` | Identity write gate | S5 | deterministic-gate | active | 2026-12-01 |
| `reg.intelligence.intelligence-intake.v1` | Intelligence intake | S4 | typed-tool | active | 2026-12-01 |
| `reg.algedonic.interaction-contract.v1` | Interaction contract (ask_human) | S5 | typed-tool | active | 2026-12-01 |
| `reg.control.memory-store.v1` | Operational memory store | S3 | typed-tool | active | 2026-12-01 |
| `reg.control.model-router.v1` | Model router | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.control.obligation-router.v1` | Obligation router | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.algedonic.pause-gate.v1` | Pause gate | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.control.profile-write-grant.v1` | Profile write grant | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.control.progression-veto.v1` | Progression veto | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.authority.project-trust-rule.v1` | Project trust rule | S5 | deterministic-gate | active | 2026-12-01 |
| `reg.authority.proposal-intake.v1` | Proposal intake | S5 | typed-tool | active | 2026-12-01 |
| `reg.control.recovery-router.v1` | Recovery router | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.identity.regulator-lifecycle.v1` | Regulator lifecycle | S5 | deterministic-gate | active | 2026-12-01 |
| `reg.coordination.reintegration.v1` | Reintegration guard | S2 | deterministic-gate | active | 2026-12-01 |
| `reg.control.result-report-gate.v1` | Result report gate | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.authority.s5-decision.v1` | S5 decision path | S5 | deterministic-gate | active | 2026-12-01 |
| `reg.assurance.span-projection.v1` | Span projection (OpenTelemetry GenAI) | S3* | type | active | 2026-12-01 |
| `reg.coordination.thrash-detector.v1` | Thrash detector | S2 | deterministic-gate | active | 2026-12-01 |
| `reg.coordination.unit-lease.v1` | Unit lease gate | S2 | deterministic-gate | active | 2026-12-01 |
| `reg.authority.vendor-write-gate.v1` | Vendor write gate | S5 | deterministic-gate | active | 2026-12-01 |
| `reg.control.work-contract-gate.v1` | Work contract gate | S3 | deterministic-gate | active | 2026-12-01 |

## Algedonic delivery

`reg.algedonic.delivery.v1` · S5 · deterministic-gate · active · introduced in M13

**Purpose.** Put what is owed to a person in front of one. Every open obligation whose consumer is human and that nothing has delivered is written to the owner's outbox — the same file `notify_owner` uses, an effect that cannot be unsent — through the effect journal under an idempotency key, once, at every step of the loop and on `regulator signals route`; the delivery is recorded on the obligation. `regulator remind` delivers again every obligation owed to a person whose last delivery is older than the policy's reminder interval, marked as a reminder. Delivery is not a disposition: the obligation stays open until a person answers.

**Absorbs.** `owed-but-unseen` — The read model shows twelve obligations owed to a person; the person did not know, because nothing told them, and the units waited on nobody.

**Mechanism.** `src/deliver.ts` at `deliverPending (undelivered → outbox, journaled, ledger.deliver)`, `remindDue (remindable → outbox, reminder)`, `routeAndDeliver in the loop`, `signals route / remind (CLI)`

**Channels.** consumes `obligation ledger (open, owed to a person, deliveries)`, `interaction policy (reminderAfterMs)` · emits `outbox line (deliver:<obligation>:<n>)`, `effect journal entry`, `obligation-delivered (channel outbox, reminder)`

**Scope.** subjects obligation · resources .regulator/outbox, .regulator/effects.ndjson, .regulator/signals.ndjson

**Cost.** One outbox line and one journal entry per delivery; reminders are bounded by the policy's interval.

**May.**
- write an obligation to the outbox once, and again after the interval
- record the delivery on the obligation

**May not.**
- disposition anything
- deliver what is owed to S3 or S5 (a person reads the read model for those)
- deliver a closed obligation
- deliver twice inside the interval

**Evidence.** `src/controller.test.ts`, `src/lab-cli.test.ts`, `../../packages/core/src/interaction.test.ts`

**Limitations.**
- The outbox is a file; no real channel (mail, chat, a daemon that watches the file) exists, so delivery reaches a person who reads the file. The channel is a property of the deployment, not of this lesson.
- Reminders run on demand (`regulator remind`) and at the loop's steps; nothing schedules them. A quiet instance reminds nobody until someone runs something.
- One outbox for the instance, not one per person: an obligation owed to 'a person' is delivered to whoever reads the outbox, and the interaction policy's people say who may answer, not who was told.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `loop:deliver-pending` — Delivery is a step of the loop, not an extension: the harness cannot throw this switch without a code change. An arm without it leaves obligations owed to a person in the read model only.

**Retirement condition.** Never while a person is a declared consumer: delivery is the channel to that consumer, not a workaround for a model's behaviour. Retire with the human consumer, not before.


## Behaviour check (export-signature)

`reg.audit.behaviour-check.v1` · S3* · deterministic-gate · active · introduced in M14

**Purpose.** Observe a criterion by content, not by class. An evidence expectation may carry a check — `export-signature` names a module, an export and the parameter count it must keep — and at closeout the host imports the module in its own process at the unit's HEAD and reads the function. The record binds to that one criterion, so a passing suite that never exercises the behaviour cannot satisfy it, and a runtime-class criterion with host evidence no longer waits for a person: acceptance is asked only where no probe exists. The drift scenario's signature is the first behaviour-bound check; the mechanism is any expectation's to carry.

**Absorbs.** `evidence-by-class` — The contract fixed slugify's signature; the unit added a second parameter with a default; every test still passed; the verdict was pass, because test-class evidence satisfied a test-class criterion and nothing looked at the export.

**Mechanism.** `../../packages/checks/src/verify.ts` at `runHostChecks (export-signature: the probe run at HEAD, one result per carrying expectation)`, `bindEvidence (criterion binding)`, `technicalVerdict (host evidence before acceptance for runtime criteria)`

**Channels.** consumes `contract expectations that carry a check`, `the worktree at HEAD` · emits `evidence record (class runtime, bound to the criterion)`

**Scope.** subjects evidence · resources the unit's worktree

**Cost.** One child process per carrying expectation at every closeout; no model calls.

**May.**
- import a module of the unit's tree at HEAD and read an export
- bind the result to the criterion that asked

**May not.**
- satisfy a criterion by class
- read source text instead of running it
- observe anything an expectation did not declare

**Evidence.** `../../packages/checks/src/verify.test.ts`, `src/evals.test.ts`

**Limitations.**
- One kind of check exists: an export's declared parameter count. Return types, thrown errors and behaviour under input are not observed; `Function.length` stops at the first defaulted parameter, so a defaulted second argument passes as a one-argument signature.
- The probe imports the module: import-time side effects run in the host's process tree, at HEAD, once per closeout. A module that cannot be imported is inconclusive, never a pass.
- A criterion that carries no check is still bound by class, as before. Content binding is opt-in per expectation, and the drift contracts are the only ones that opt in so far.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `check:export-signature` — The drift suite's no-behaviour-check arm drops the check from every unit type and the signature criterion from the contract: the signature is a fixed decision in prose only.

**Retirement condition.** Never as a mechanism; the export-signature kind retires when no contract in a quarter of runs carries it, and a richer behaviour check (a runtime probe over inputs) has replaced it.


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

**Ablation.** `extension:cp6-budget` — The harness drops checkpoint 6 from a live arm; the loop's attempt ceiling still applies. Not separable from contract-preserving compaction, which the same extension carries.

**Retirement condition.** No attempt in three model versions and the drift suite crosses a ceiling the loop's wall-clock limit would not have caught first, across two supported models.


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

**Ablation.** `extension:cp9-authority` — Shares checkpoint 9 with the write gate and proposal intake; a live arm without it loses all three. The injection fixture is the suite that exercises it.

**Retirement condition.** No canary reaches a tool result or the model's text in the injection fixture across three model versions with the watch off.


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

**Ablation.** `none` — The verify step is the S3 loop itself: an arm without closeout is a different orchestrator, not an ablation. The checks it runs are ablated one at a time (identity-untouched, export-signature).

**Retirement condition.** Never: independent verification is INV-003. Individual checks retire under their own conditions.


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

**Ablation.** `extension:cp5-contract` — Shares checkpoint 5 with the result-report gate; dropping the extension removes both the section and the tool, so a live arm without it has no report path at all.

**Retirement condition.** Retire the advice when a contract-aware model needs no rendered section: units under three model versions report every delegated decision without it, with the gate still on.


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

**Ablation.** `extension:cp6-budget` — Shares checkpoint 6 with the budget guard. A live arm without it compacts under Pi's default and the contract block is not carried.

**Retirement condition.** No compaction in the drift suite loses a fixed decision across three model versions with the block off, measured by the report gate's refusals after a compaction.


## Definition check

`reg.identity.definition-check.v1` · S5 · deterministic-gate · active · introduced in M12

**Purpose.** Check the declaration as a whole under `regulator check`: every profile, workload, policy and identity file validates against its closed schema, and the references between them resolve — a unit type's profile is declared, a policy names only declared unit types, a check name is one the host runs, a profile that says read-only grants only read-only effects, the identity set is complete with well-formed, unique invariants, a routing floor is a regular expression. A control plane is declared, not assembled; this is what makes the declaration checkable.

**Absorbs.** `assembled-not-declared` — A unit type names a profile that lives only in code, a policy budgets a unit type nobody declared, the identity is a file someone forgot to seed, and the instance runs anyway on whatever the code happened to do.

**Mechanism.** `src/registry-cli.ts` at `regulator check (checkDefinition, under pnpm check)`

**Channels.** consumes `profiles/*.json`, `workload/*.json`, `policies/*.json`, `identity/*.md` · emits `definition problems (exit 1)`

**Scope.** subjects definition · resources course/lab

**Cost.** One pass over the definition's files in CI; no model calls.

**May.**
- refuse a definition whose parts do not resolve
- report what is missing

**May not.**
- change a file
- check an instance (that is the read model's)
- judge whether a policy is wise

**Evidence.** `../../packages/core/src/definition.test.ts`, `src/registry.test.ts`

**Limitations.**
- Shape and references only: a profile that grants bash to a unit type whose contract forbids writes is a valid definition. Whether the declaration is a good one is the capstone's viability case.
- It runs under `pnpm check` and `regulator check`, not at dispatch: an instance started from an edited definition between checks runs on the edit.
- The identity checked is the definition's seed; an instance's copy is checked by the identity-untouched check at closeout, not here.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `none` — A check on the definition, run under pnpm check and regulator check, not in a session or the loop: nothing runs without it to compare against.

**Retirement condition.** Never: a declared control plane is checked as a whole or it is assembled.


## Disposition authority

`reg.authority.disposition-authority.v1` · S5 · deterministic-gate · active · introduced in M13

**Purpose.** Check who may disposition what before anything is written. The interaction policy names people with three grants — the highest severity they may disposition, whether they may resolve as accepted-risk, whether they may act as S5 — and every `--by` on the CLI (`answer`, `obligation ack|resolve|escalate`, `memory retract`, `unit accept`, `identity accept|reject`) is checked against it: a name not listed may disposition nothing, and a listed person is refused above their severity, for a risk they may not accept, or for an S5 decision they may not make. `answer` additionally refuses an option the question did not offer, and turns a consent answer into accepted or rejected by the protocol's rule, never by the person's wording.

**Absorbs.** `disposition-by-anyone` — A critical algedonic obligation is resolved as accepted-risk by `--by intern`, honestly recorded and wrong: the record said who, and nothing said whether they could.

**Mechanism.** `src/lab-cli.ts` at `authorized() before every write that takes --by (checkDispositionAuthority)`, `answer (options check, dispositionForAnswer)`

**Channels.** consumes `interaction policy (people)`, `the obligation's severity and concern` · emits `refusal (nothing written)`, `interaction-answered (channel cli)`, `obligation-resolved / acknowledged / escalated by a named, authorized person`

**Scope.** subjects obligation, interaction, identity, memory · resources .regulator/signals.ndjson

**Cost.** One policy read per command; no model calls.

**May.**
- refuse a disposition the policy does not grant
- record an authorized one under the person's name

**May not.**
- grant itself anything: the people are declared in the definition
- authenticate: the name is asserted
- disposition on anyone's behalf

**Evidence.** `src/lab-cli.test.ts`, `../../packages/core/src/interaction.test.ts`

**Limitations.**
- `--by` is asserted, not authenticated: the check is whether the named person may, not whether the caller is that person. Authentication is the deployment's (an OS user, a signed request) and is out of the lab's scope; the record stays honest about the claim.
- The grants are three booleans and a severity; an obligation-specific grant (bob may answer questions on units he owns) is not expressible, and the policy is one file for the instance.
- The session path (`ask_human` with a dialog) attributes the answer to the session's user and does not run this check: a person at the keyboard of a unit's session is treated as able to answer that unit's question. The CLI path checks; the dialog path trusts the terminal.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `policy:interaction.people` — A people list naming everyone at critical with every grant is the ablation; the harness does not throw policy switches. A scripted run never dispositions anything.

**Retirement condition.** Retire when authentication replaces the name: a deployment that signs dispositions makes the policy's people a projection of its accounts.


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

**Ablation.** `extension:cp7-recovery` — Shares checkpoint 7 with the failure observer; delivery (lesson 13) uses the same journal from the loop and is not ablated with the extension.

**Retirement condition.** No side-effecting tool is invoked twice for one intention across the recovery drills and three model versions with the journal off — which is to say never, because a restart is not a model behaviour.


## Eval harness and graders

`reg.assurance.eval-harness.v1` · S3* · deterministic-gate · active · introduced in M14

**Purpose.** Evidence about the regulators: lesson 09 one recursion level up. A suite declares the fixture, the tasks in order, the arms (which checkpoint extensions a live session loads, which host checks the implement unit type runs, which regulator an ablation arm switches off), the repetitions and the pre-registered metrics. The harness runs one fresh instance per arm and repetition through the real loop, grades each unit with outcome graders (the resulting environment: boundary violations, signature drift, vocabulary drift, rules written into prose) and trajectory graders (the records: refusals, retries, escalations, invariant violations), summarizes per arm with Student's t intervals, screens lifts by interval overlap, stamps the environment it ran in, and refuses to be a report without a person's interpretation.

**Absorbs.** `regulation-without-evidence` — Twelve lessons of gates, each added for a failure a model produced on a particular day, and no number that says any of them still helps — or that one of them costs more than it saves.

**Mechanism.** `src/evals.ts` at `runSuite (one instance per arm × repetition, the tasks through driveUnit)`, `contractForArm / workloadForArm (an arm changes only what the definition declares)`, `graders.ts (outcome and trajectory graders, no judge model)`, `checkDefinition (suites and committed reports validate; ablation arms name their switch)`

**Channels.** consumes `eval suite`, `the definition (workload, policies, registry)`, `a dispatcher (scripted or live)`, `the instance's stores after each unit` · emits `eval report (arms, lifts, runs, fingerprint, interpretation)`

**Scope.** subjects evidence, regulators · resources temporary instances under the OS temp directory, evals/reports/

**Cost.** One full loop per task per arm per repetition: minutes for a scripted run of the drift suite, hours and model spend for a live one.

**May.**
- run the loop under a declared arm in a throwaway instance
- grade the outcome and the records
- summarize and stamp

**May not.**
- change the loop, a policy or a card
- retire a regulator (a person does, on the record)
- conclude: the interpretation is a person's
- grade with a model

**Evidence.** `src/evals.test.ts`, `../../packages/core/src/evals.test.ts`

**Limitations.**
- A scripted unit never runs a session: the session gates (profile grant, write gate, bash watch, canary watch, budget guard) are not exercised, only the loop and the closeout checks. The committed reports say `scripted:` in their fingerprint for that reason; a live run is the drill, and its numbers are the ones that count for retirement.
- The harness throws two kinds of switch — a host check, a checkpoint extension for a live arm. A regulator whose switch is `loop:`, `policy:` or `none` has no ablation arm the harness can run; the lifecycle view says so rather than pretending.
- Repetitions are what the suite declares; at n=3 few intervals separate, and the lift's `separated` flag is a screen, not a test. Contamination (a fixture leaking into a prompt or a model's training data) is not detected; the fixture is small and public.
- Graders are pattern and structure: vocabulary drift is a word list, a rule in prose is a regular expression over added lines. They are validated against three scripted learner-style units, not against a model's actual drift.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `none` — The harness is the ablation mechanism; an arm without it is no evidence at all.

**Retirement condition.** Never: a control system that cannot measure itself only grows. Individual graders retire when the drift they measure has not appeared in a quarter of live runs.


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

**Ablation.** `extension:cp8-evidence` — A live arm without checkpoint 8 reports evidence the session never produced; the closeout gate still catches the claim at the revision, later and at more cost.

**Retirement condition.** Reports under three model versions cite only evidence the session produced, with the preflight off, and the closeout gate's contradicted count stays at zero.


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

**Ablation.** `extension:cp7-recovery` — Shares checkpoint 7 with the effect journal. Without it the router classifies from the orchestrator's records alone and environment causes are routed as check failures.

**Retirement condition.** The router's decisions in the recovery drills match the observer's causes for three model versions when the observer is off, because the orchestrator's records alone name them.


## Identity context

`reg.identity.identity-context.v1` · S5 · prompt · active · introduced in M12

**Purpose.** Render the instance's identity set — IDENTITY.md, INVARIANTS.md, BOUNDARIES.md, GLOSSARY.md under regulator/identity/ — into every unit's system prompt from the files on each run, and current operational memory beside it as facts that expire. Identity never lives in the transcript: compaction cannot lose it, a fork cannot diverge from it, a model version cannot reinterpret it from memory. The dispatcher loads no context files from the worktree, so this is the identity a unit sees.

**Absorbs.** `identity-in-context` — The rules the system runs by exist as a paragraph in a context window that gets compacted, forked and re-read by a different model; six months later the same harness is a different system and nobody changed a file.

**Mechanism.** `src/cp11-identity.ts` at `before_agent_start (sections regulator_identity, regulator_memory)`

**Channels.** consumes `regulator/identity/* (worktree)`, `memory store (current entries)` · emits `system-prompt sections`

**Scope.** subjects identity, memory · resources regulator/identity/, .regulator/memory.ndjson

**Cost.** The identity's length in every prompt, capped at 6000 characters; Pi diffs sections, so an unchanged identity is a cache hit.

**May.**
- render identity and memory as prompt sections
- report problems in the identity set

**May not.**
- change identity
- make identity binding (the gate and the closeout check do)
- render expired memory

**Evidence.** `src/cp11-identity.test.ts`, `../../packages/core/src/identity.test.ts`

**Limitations.**
- Level 5 by design: what is rendered is advice. A model can ignore it; what makes identity binding is the write gate (checkpoint 9) and the identity-untouched check (this lesson), and the drill measures the gap.
- The identity rendered is the worktree's copy, which a unit's shell can change before the run reads it; the closeout check compares the branch to the base, so a changed copy is a failing check, not a changed rule.
- Rendering is truncated at 6000 characters; an identity set longer than that is partly advice the model never sees, and the status line does not say so.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `extension:cp11-identity` — Shares checkpoint 11 with the memory tool. The drift suite's control arm is the arm without it (and without the checks); lesson 12's drill 1 is the measurement.

**Retirement condition.** Retire the rendered section when the drift suite shows no conformance loss across three model versions with the section off and the checks on: the gates carry the identity alone.


## Identity-untouched check

`reg.audit.identity-untouched-check.v1` · S3* · deterministic-gate · active · introduced in M12

**Purpose.** INV-001 as a deterministic host check at closeout: diff the unit's branch against its base under every protected prefix — the identity and whatever the project's conventions protect — with the orchestrator's own runner. Any change, committed or not, by any route the write gate and the bash watch did not see, is failing command-class evidence bound to the revision, and the unit does not close. The invariant is enforced in prose and in code, and the check is named by the workload's unit types.

**Absorbs.** `committed-around-the-gate` — A unit edits a protected file and commits in one shell command: the working tree is restored by the bash watch, the commit survives, git status is clean, and reintegration carries the change into the base.

**Mechanism.** `../../packages/checks/src/verify.ts` at `runHostChecks (identity-untouched)`, `auditUnit (before reintegration)`

**Channels.** consumes `worktree branch vs base`, `protected prefixes (identity + conventions)` · emits `evidence record (audit log)`, `audit-finding → S3 on fail (via the closeout gate)`

**Scope.** subjects unit, revision · resources regulator/identity/, vendor/, worktree

**Cost.** One `git diff --name-only` per closeout; no model calls.

**May.**
- fail the closeout of a unit whose branch changed a protected prefix

**May not.**
- revert the change (a person or a repair attempt does)
- decide what the unit does next (the recovery router does)
- check a prefix the identity or conventions do not declare

**Evidence.** `../../packages/checks/src/verify.test.ts`, `src/controller.test.ts`

**Limitations.**
- It reads the branch at closeout: a protected change is caught after the attempt, not before the commit. Prevention is the write gate's; this is the evidence that the gate was bypassed.
- The base is the branch the unit was created from; a unit whose base moved under it is compared against the base's current tip, so a protected change made on the base by a person is not the unit's finding.
- It binds to the command-class criterion by class, like every host check (docs/DEBT.md row 2); a contract with no command-class expectation records the failure as evidence and the verdict still fails on contradiction only if the report cited a command run.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `check:identity-untouched` — The drift suite's no-identity-check arm: the check is dropped from every unit type's list; the write gate and the bash watch still run in a live session.

**Retirement condition.** No protected path changes on any unit branch across three model versions and the drift suite with the check off — the session gates alone hold the line — measured by the boundary grader.


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

**Ablation.** `extension:cp9-authority` — Shares checkpoint 9 with the canary watch and proposal intake. Without it the closeout check (identity-untouched) still refuses the change, at the cost of an attempt.

**Retirement condition.** No unit edits an identity file across three model versions and the drift suite with the gate off and the closeout check on, and the attempt cost of catching it late is judged acceptable.


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

**Ablation.** `extension:cp10-intelligence` — A live arm without checkpoint 10 has no research unit that can report; the router has nothing to hold units on.

**Retirement condition.** Retire when S4 has a second intake (a scheduled scan) and this tool's share of intelligence signals falls below what a person would read.


## Interaction contract (ask_human)

`reg.algedonic.interaction-contract.v1` · S5 · typed-tool · active · introduced in M13

**Purpose.** Give a unit one typed way to interrupt a person, `ask_human`, under an interaction kind whose contract is fixed in the protocol: a recap offers decisions for correction and continues; choice, clarification and uat wait; consent asks authorization for an irreversible action and nothing but a yes is a yes. Every call opens an obligation owed to a person before anything is asked, records the request and its outcome (answered, timed out, cancelled, unavailable) beside it, and — with a person present — asks through Pi's dialogs with the policy's timeout for the kind. An answer given in the dialog is recorded as that person's disposition on the spot; consent needs a stated action, choice needs options, and a blocking question past the policy's attention budget is refused. The algedonic channel of VSM: from the unit straight to the person, bypassing the loop, typed.

**Absorbs.** `silence-as-consent` — A unit asks whether it may force-push, nobody is there, and it proceeds because the prompt said to 'use judgment' — or it asks five times per attempt until the person stops reading. The question and the non-answer were never a record anyone could act on.

**Mechanism.** `src/cp12-algedonic.ts` at `ask_human (tool execute: AskHumanInputSchema, CONTINUES_WITHOUT_ANSWER, attention budget, ledger.openObligation / requestInteraction / answerInteraction / resolve)`, `ctx.ui.confirm / select / input with the policy's timeout`

**Channels.** consumes `tool call (ask_human)`, `interaction policy (timeouts, attention)`, `lease (unit provenance)`, `ctx.hasUI / ctx.mode (channel)` · emits `obligation-opened (interaction, owed to a person)`, `interaction-requested / interaction-answered`, `obligation-resolved (answered in the session)`, `regulator:interaction (session entry)`

**Scope.** subjects interaction, obligation · resources .regulator/signals.ndjson, the session's dialogs

**Cost.** One obligation and two regulatory events per question; a dialog holds a person for up to the policy's timeout. Attention is the budget: the policy caps blocking questions per attempt.

**May.**
- open an obligation owed to a person
- ask through the session's dialogs
- record a dialog answer as the person's disposition
- refuse a question past the attention budget or without its required fields

**May not.**
- treat a timeout, a cancel or an absent person as an answer
- continue a blocking question without one (the pause gate)
- ask outside a repository the orchestrator knows
- widen what a kind means: the rule is the protocol's, not the policy's

**Evidence.** `src/cp12-algedonic.test.ts`, `../../packages/core/src/interaction.test.ts`

**Limitations.**
- The dialog answer is attributed to the OS user of the session (or the `person` option), not to an authenticated identity; in a session run by hand that is the person at the keyboard, which is what the record says.
- Whether an action is irreversible is the model's to notice: the tool contracts what consent means, and the profile advice says when to ask; nothing derives 'this needs consent' from the tool's effects (an effect-derived consent check is a later lesson).
- A recap is owed to a person and never delivered by this tool beyond the outbox; a person who never reads the outbox never corrects anything, which is the recap's contract — the work was reversible.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `extension:cp12-algedonic` — Shares checkpoint 12 with the pause gate: the tool and the gate ablate together. Without them a unit proceeds on its own judgment, which the drift suite's control arm shows.

**Retirement condition.** Never for consent: an irreversible action without a yes is the failure class itself. The recap kind may retire when units stop offering decisions nobody reads.


## Operational memory store

`reg.control.memory-store.v1` · S3 · typed-tool · active · introduced in M12

**Purpose.** Give units one typed way to record what they learn about the environment — remember — into an append-only store separate from identity and from evidence. Every entry carries host-stamped provenance (unit, revision, time) and a required review-by date within the store's limit, after which it is expired: shown by the read model, rendered to no unit. A retraction is an appended event by a named person. Nothing here can reach an identity file (INV-004).

**Absorbs.** `memory-becomes-policy` — A note that tests need FOO=1 is written into AGENTS.md as a temporary reminder; a year later it is an undocumented rule nobody can date, source or retire.

**Mechanism.** `src/cp11-identity.ts` at `remember (tool execute)`, `MemoryStore.record (expiry bounds)`

**Channels.** consumes `tool call (remember)`, `lease (unit provenance)`, `worktree HEAD (revision)` · emits `memory-recorded / memory-retracted (.regulator/memory.ndjson)`, `regulator:memory (session entry)`

**Scope.** subjects memory · resources .regulator/memory.ndjson

**Cost.** One appended line per fact; current facts ride in every prompt of every unit, so the review-by limit is also a context budget.

**May.**
- record a fact with provenance and an expiry
- render current facts to later units

**May not.**
- write identity or policy
- record a fact without an expiry, or with one beyond the limit
- retract (a person does, by name)
- treat a fact as a rule

**Evidence.** `src/cp11-identity.test.ts`, `../../packages/core/src/identity.test.ts`

**Limitations.**
- A fact is text: nothing checks that it is true, current or about the environment rather than a preference. Expiry bounds how long a wrong fact lives; review is a person's.
- Facts are rendered to every unit of the instance, not scoped to the units they concern; a large store crowds the prompt before the 90-day limit retires anything.
- Retraction is by a person the interaction policy names, checked before the write (lesson 13); the name is asserted, not authenticated.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `extension:cp11-identity` — Shares checkpoint 11 with the identity context; the drift suite's control arm runs without it, and the memoryRules grader counts what units write into prose instead.

**Retirement condition.** The memoryRules grader stays at zero across three model versions and the drift suite with the tool off: units no longer write rules into prose when they have nowhere else to put a fact.


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

**Ablation.** `policy:models.fallback` — An empty fallback list is the ablation; the harness does not throw policy switches, and failover needs a live dispatcher.

**Retirement condition.** No primary-model failure in a quarter of live runs, or a provider-side retry that makes the fallback redundant.


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
- A consumer is a name in the policy (S3, S5, human). What is owed to a person is delivered to the outbox and reminded by `algedonic-delivery` (lesson 13); what is owed to S3 or S5 is exposed by the read model and the control room and delivered to nobody, because S3 is the loop and S5 is a person reading the definition's proposals — a queue for S5 decisions is not built.
- Effective severity is the message's own except for uncertainty, whose reported impact is mapped through the policy, and for the routing policy's floors (lesson 12): a message whose subject or observation names an invariant or the identity path is raised to the floor's severity. A floor is a pattern; a message that concerns an invariant without naming it is not raised.
- Every disposition on the CLI is checked against the interaction policy's people by `disposition-authority` (lesson 13); the name itself is asserted, not authenticated, and the check does not run for a dialog answer inside a session.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `loop:route-messages` — Routing is a step of the loop; not ablatable by the harness. An arm without it leaves every message unrouted and nothing holds a unit.

**Retirement condition.** Never: an obligation is how a consequential signal stays visible until absorbed. Individual routing rules retire when a message kind is never raised.


## Pause gate

`reg.algedonic.pause-gate.v1` · S3 · deterministic-gate · active · introduced in M13

**Purpose.** Make 'work waits for an answer' a mechanism in two places. In the session: once a blocking question (choice, clarification, consent, uat) went unanswered, the `tool_call` gate refuses every tool whose declared effect is not read-only except `report_result`, and `agent_before_settle` records the pause and ends the turn. In the loop: after the session, an open blocking interaction obligation on the unit records the attempt as `paused`, holds the unit as blocked awaiting a person, and the recovery router says nothing about it — no retry, no repair, no attempt spent; `runUnit` refuses re-dispatch through the progression veto until a person answers, and the next attempt carries the answer as its hint.

**Absorbs.** `waiting-in-name-only` — The tool told the model the question had no answer, and the model, with the tools still live, did the thing anyway — or the orchestrator, seeing an attempt with no close, retried the unit and it asked again, and again.

**Mechanism.** `src/cp12-algedonic.ts` at `tool_call (paused → block unless read-only effect or report_result)`, `agent_before_settle (regulator:paused entry, continue: false)`, `runUnit (open blocking interaction obligation → attempt outcome paused, status blocked)`, `routeUnit (no decision while paused)`, `progression veto (re-dispatch refused until dispositioned)`

**Channels.** consumes `the session's own unanswered question`, `obligation ledger (open blocking interaction on the unit)` · emits `tool_call block`, `regulator:paused (session entry)`, `attempt record (paused)`, `unit status blocked: paused`

**Scope.** subjects execution, interaction · resources the session's tools, .regulator/units/

**Cost.** None until a question goes unanswered; then the rest of the session is read-only and the unit waits as long as the person does.

**May.**
- refuse tools with an effect for the rest of a paused session
- end the turn
- record the attempt as paused and hold the unit

**May not.**
- decide the question
- spend an attempt on the wait
- route the unit through the recovery policy
- release the unit without a disposition on the obligation

**Evidence.** `src/cp12-algedonic.test.ts`, `src/controller.test.ts`

**Limitations.**
- The session gate keys on TOOL_EFFECTS by tool name: a tool the effect table does not know is refused (safe), and a read-only tool that lies about its effect runs. The table is the effect declaration; this gate does not inspect what a tool does.
- The pause is per session: a unit dispatched again by hand (`unit dispatch` after a manual `obligation resolve`) starts unpaused, because the obligation is closed; the veto is the only hold across sessions, and it is the obligation's, not this gate's.
- A paused unit holds its lease and its worktree while it waits; nothing expires the wait itself. A question nobody answers is visible in the read model and the outbox (`algedonic-delivery`), and stays.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `extension:cp12-algedonic` — Shares checkpoint 12 with the ask_human tool; the loop's paused attempt is not ablatable. The pause in the session is what stops a model acting on silence.

**Retirement condition.** Never while a question can go unanswered: the gate is the meaning of 'waits'.


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

**Ablation.** `extension:cp3-profiles` — A live arm without checkpoint 3 lets a unit write anywhere its tools reach; the closeout checks catch protected prefixes only, and the boundary grader counts the rest.

**Retirement condition.** The boundary grader stays at zero across three model versions and the drift suite with the grant off: units write under src/ and test/ because the contract says so.


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

**Ablation.** `loop:progression-veto` — The veto is the loop's check on open obligations at dispatch and close; not ablatable by the harness.

**Retirement condition.** Never: a blocking obligation that does not block is a note.


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
- prevent the model from reading a project file that carries instructions

**Evidence.** `src/cp9-authority.test.ts`

**Limitations.**
- Trust is an input-loading guard. It keeps a project's own extensions, skills, prompt templates and themes out of the harness; it does nothing about instructions in the project's files, comments, test output or documentation — those are the injection drill, and the answer to them is that authority lives in gates the content cannot reach.
- Since lesson 12 the loader takes no context files from the worktree (noContextFiles) and the session runs on the definition's settings.json held in memory, so neither AGENTS.md nor .pi/settings.json in a target repository reaches a unit's session. What the model reads with its tools is still the project's to write: the trust rule closes loading, not reading.
- The filter is by resolved path against the definition's list; an operator's user/global extensions are refused too, which is the intended reading of 'declared, not assembled' but surprises anyone who expected their own extensions to ride along.
- The project_trust answer covers the CLI path (`pnpm cp9`); a learner who launches pi by hand with trust remembered as yes has trusted the project themselves.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `loop:definition-loader` — The dispatcher's loader would have to load the project's extensions, skills and context files; not ablatable without a code change. The injection fixture is the suite.

**Retirement condition.** Never: a target repository is data. Retire only with a sandbox that makes loading project code harmless.


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
- A proposal is routed into an obligation owed to S5 (lesson 11) and decided by a person through `regulator identity accept|reject` (lesson 12), which is the only writer of an identity file; the proposal's requestedChange is text a person turns into a file by hand. What is owed to S5 is not delivered to the outbox (lesson 13 delivers what is owed to a person): a person reads the read model for it.
- The proposal's source is S1 by construction; a proposal from S3 or S4 (a router that wants a policy change) has no tool yet.
- Evidence on a proposal is empty: the tool does not let the model attach evidence refs, because a claim about evidence is not evidence.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `extension:cp9-authority` — Shares checkpoint 9 with the write gate and the canary watch. Without the tool a unit that wants a rule changed has only the identity gate's refusal.

**Retirement condition.** Retire when proposals arrive by another typed path (an S3 or S4 proposer) and units stop raising them.


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
- Remediate, replan, clarify and pause are recorded and the unit waits on an obligation for the consumer the routing policy names (lesson 11); nothing in the loop performs them. A person who resolves the obligation is checked against the interaction policy's people (lesson 13) but not authenticated.
- Occurrences are counted per cause per unit, by design: a unit that alternates between two causes never reaches the third action of either rule and is stopped by the attempt ceiling, and the alternation is visible in its decisions and obligations. A policy that wants a global count declares shorter rules.
- Escalation is an algedonic signal in the regulatory log and an obligation owed to a person (lesson 11), delivered to the outbox and reminded under the interaction policy (lesson 13). The outbox is a file: no channel beyond it exists in the lab.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `policy:recovery.rules` — A policy whose every rule is escalate is the ablation: every blocked unit goes to a person. The harness does not throw policy switches.

**Retirement condition.** Never as a mechanism; individual rules retire when a cause is not seen in a quarter of runs.


## Regulator lifecycle

`reg.identity.regulator-lifecycle.v1` · S5 · deterministic-gate · active · introduced in M14

**Purpose.** Every regulator was added to absorb a failure a particular model produced on a particular day, and models change. Every active record now carries an ablation switch — the arm that turns it off, or `none` with the reason the harness cannot — and a retirement condition, or `regulator check` refuses it. `regulator review --due` lists what is overdue for review by the date each record carries; the read model and the control room's lifecycle view show, per record, the switch, whether a committed eval report covers it, and the condition under which it may go. Retiring a regulator is a recorded decision: the record's status becomes `retired` and it keeps its history.

**Absorbs.** `control-system-that-only-grows` — A workaround for one model's habit, still costing latency and attention on every run three model versions later, because nothing ever asked whether the habit persisted and nobody owned the question.

**Mechanism.** `../../packages/core/src/registry.ts` at `checkRegistry (active record without ablation or retirement is a problem)`, `reviewDue`, `regulator review --due (CLI)`, `the lifecycle view (read model, control room)`

**Channels.** consumes `registry records`, `eval suites and committed reports` · emits `registry problems`, `the lifecycle view`

**Scope.** subjects registry · resources registry/regulators/, evals/

**Cost.** Two fields per record and a date check; the eval runs that pay a retirement condition are the harness's cost.

**May.**
- refuse a record without a switch or a condition
- list what is due
- show what an eval covers

**May not.**
- retire anything
- run an ablation
- change a review date

**Evidence.** `../../packages/core/src/control-plane.test.ts`, `src/lab-cli.test.ts`, `src/registry.test.ts`

**Limitations.**
- A retirement condition is prose; nothing checks that a committed report satisfies it. The lifecycle view shows coverage (an ablation arm exists for the record), not satisfaction; a person reads the report against the condition.
- Review dates are checked on demand, not scheduled: `regulator review --due` runs when someone runs it, and nothing under CI fails on an overdue record (docs/DEBT.md row 32).
- Most switches the registry names are `loop:`, `policy:` or `none`: named honestly, not runnable by the harness. Two of thirty-six records have a runnable ablation arm in the committed suite.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `none` — A check on the registry; there is no run it participates in.

**Retirement condition.** Never: the record that decides retirement cannot retire before the last regulator does.


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

**Ablation.** `none` — The merge is the loop's close step; an arm without it never lands work. Conflict handling is exercised by the coordination drills, not ablated.

**Retirement condition.** Never: reintegration is how domain output reaches the base. The conflict-signal path retires when two units cannot share a base.


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

**Ablation.** `extension:cp5-contract` — Shares checkpoint 5 with the contract section; without it a unit has no report_result tool and every attempt ends no-report.

**Retirement condition.** Never: the report is the loop's only typed input from a unit. Its checks (unresolved decisions, delegated choices) retire individually when three model versions never trip them.


## S5 decision path

`reg.authority.s5-decision.v1` · S5 · deterministic-gate · active · introduced in M12

**Purpose.** The one path that changes an identity file: `regulator identity accept`, run by a named person, on an obligation owed to S5 that a proposal opened. It writes the proposed file under S5 authority (the same authorizeWrite the gate refuses operational callers), refuses a result that leaves the identity set invalid, commits on the base branch citing the obligation, and resolves the obligation as accepted with the commit. `identity reject` resolves it as rejected and changes nothing. INV-002 with a workflow: the right to ask is the proposal tool; the right to change is this, and only this.

**Absorbs.** `proposal-with-no-decider` — A proposal is recorded and owed to S5, and then a person edits the identity file by hand with no link to what was asked, or never does, and the obligation sits open with no way to close it honestly.

**Mechanism.** `src/lab-cli.ts` at `identity accept (authorizeWrite s5-authority, readIdentity, git commit, ledger.resolve accepted)`, `identity reject (ledger.resolve rejected)`

**Channels.** consumes `obligation (policy-proposal, owed to S5)`, `a proposed file` · emits `commit on the base branch`, `obligation-resolved (accepted | rejected)`

**Scope.** subjects identity, obligation · resources regulator/identity/, base branch

**Cost.** One commit per accepted proposal; no model calls.

**May.**
- write one identity file under S5 authority
- commit it citing the obligation
- resolve the proposal's obligation

**May not.**
- accept a proposal a unit made for itself (a unit has no S5 authority)
- write outside regulator/identity/
- leave the identity set invalid
- be called by a tool

**Evidence.** `src/lab-cli.test.ts`

**Limitations.**
- Who may act as S5 is the interaction policy's `actAsS5` grant, checked before the write (lesson 13); the name on `--by` is asserted, not authenticated.
- The proposed content is a file the person supplies; nothing derives it from the proposal's requestedChange, and nothing diffs it against what was asked. The person decides that the file is the proposal.
- It changes the instance's identity, not the definition's seed: a decision accepted in one instance does not propagate to the next fixture. Promoting a decision into the definition is a commit to course/lab/identity/ by hand.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `none` — A CLI command a person runs; there is no arm in which a person changes identity without it, only the drill that edits a file by hand.

**Retirement condition.** Never: INV-002 names it as the only writer. Retire with the proposal path, not before.


## Span projection (OpenTelemetry GenAI)

`reg.assurance.span-projection.v1` · S3* · type · active · introduced in M14

**Purpose.** One read of every append-only record an instance keeps — units, attempts, budgets, evidence, verdicts, decisions, effects, obligations, interactions, memory — as OpenTelemetry GenAI spans (`invoke_agent` per attempt, `execute_tool` for checks, effects and deliveries, `chat` for what the budget ledger knows of the model calls), correlated by `vsm.unit.id`, `vsm.attempt`, `vsm.evidence.id`, `vsm.obligation.id`, `vsm.regulator.id` and the policy version, so a tracing backend joins runtime events to registry records without a vendor adapter. Every string attribute passes redaction — the instance's canaries and credential shapes — before it leaves the store, and a span that had something redacted says so. The transcript is never projected.

**Absorbs.** `evidence-nobody-can-join` — Six NDJSON logs and a SQLite store, each honest on its own, and no way to ask which regulator fired on which attempt of which unit without reading them all by hand — or a way that shipped the API key in the tool output.

**Mechanism.** `../../packages/core/src/spans.ts` at `projectSpans (schema-validated SpanRecord per record; redact on every string attribute)`, `reportSpans (one span per eval run)`, `regulator spans (CLI)`

**Channels.** consumes `.regulator/units/`, `audit.ndjson`, `signals.ndjson`, `effects.ndjson`, `memory.ndjson`, `.regulator/canaries` · emits `span records (NDJSON)`

**Scope.** subjects evidence, execution, obligation · resources the instance's .regulator/

**Cost.** A full read of the instance's logs per projection; no model calls, nothing written.

**May.**
- read every store
- redact
- emit spans

**May not.**
- read the transcript
- write to any store
- emit an attribute that failed redaction
- invent a correlation the records do not carry

**Evidence.** `../../packages/core/src/spans.test.ts`, `src/lab-cli.test.ts`

**Limitations.**
- Token usage is what the budget ledger holds — a total per attempt — so `gen_ai.usage.input_tokens` / `output_tokens` are not populated; the projection carries `vsm.usage.tokens` instead and says so by omission.
- Redaction is a value list and a pattern list: a credential with a shape neither knows passes through. The canaries file is the instance's own declaration, and a secret the instance never declared is not a canary.
- The SQLite regulatory event store the reporting tools write (`.gsd/vsm-runtime/vsm.db`) is not projected: it is the Pi extension's store, not the lab instance's, and its path still carries a GSD-era name (docs/DEBT.md row 31).
- Spans are a projection, not an export: nothing ships them to a collector. `regulator spans --json` writes NDJSON a collector can ingest; the wiring is the deployment's.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `none` — A read model over the stores; switching it off changes no run.

**Retirement condition.** Retire when the stores themselves are written as spans (one event store with the mapping built in) and the projection has nothing to translate.


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
- The threshold is the policy's `coordination.oscillationThreshold` since lesson 12 (4 when a policy declares none); it is one number for every file and unit type, not a budget that varies by kind of work.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `extension:cp4-coordination` — Shares checkpoint 4 with the lease and worktree mechanics in the session; the oscillation fixture is the suite. The loop's attempt ceiling still stops a thrashing unit, later.

**Retirement condition.** No oscillation in the oscillation fixture across three model versions with the detector off: the models stop alternating on their own, or the ceiling catches it at acceptable cost.


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

**Ablation.** `loop:lease` — Leases are taken by the loop; not ablatable by the harness. Two concurrent dispatches of one unit is the coordination test, not an eval arm.

**Retirement condition.** Never while two sessions can target one worktree.


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

**Ablation.** `extension:cp1-trace` — Checkpoint 1's gate; superseded in a live session by checkpoint 9's preflight, which the same arm carries. The closeout check catches vendor/ at the revision without either.

**Retirement condition.** Already superseded: retire when checkpoint 9 is the minimum an arm loads, keeping the record as history.


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
- Authority references on fixed decisions resolve since lesson 12 — an invariant the instance's identity declares, a regulator the registry declares, an obligation the instance holds, or a named person — but a person's name is trusted as given, and whether that person held the authority is not checked (docs/DEBT.md row 20).
- The contract is loaded from a file path the session was given; the lease gate, not this gate, is what keeps another session from running under it.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `loop:check-contract` — The contract check runs before anything is claimed; not ablatable by the harness. An unsound contract with no gate is dispatched as written.

**Retirement condition.** Never: an unsound contract cannot be verified against. Individual checks retire when three model versions of S3 planning never produce the defect.
