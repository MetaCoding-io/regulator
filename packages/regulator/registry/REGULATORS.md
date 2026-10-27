# Regulators

Generated from `registry/regulators/*.json` by `regulator docs`. Do not edit by hand.

Every regulator in the control plane has a record here: the failure it absorbs, the level of the mechanism hierarchy it
works at (a type, a deterministic gate, a typed tool, model judgment, or prompt advice), where in the code it bites,
the tests that show it, what it may and may not do, and — the field that matters most — what it does not catch. A gate
with no stated limitation does not pass `regulator check`; the limitations are collected into `BOUNDARY.md`, the
enforcement boundary. Each record also names the switch that turns it off for an eval arm, the condition under which it
would be retired, and the date by which a person reviews it; `regulator review --due` lists what is owed.

The table is the index; the cards below it, one per record, are the source of truth for what each regulator does and
does not do. `since` is the package version that first shipped the record.

| ID | Name | Function | Level | Status | Review by |
| --- | --- | --- | --- | --- | --- |
| `reg.identity.advice-context.v1` | Advice context | S5 | prompt | active | 2026-12-01 |
| `reg.authority.advice-decision.v1` | Advice decision path | S5 | deterministic-gate | active | 2026-12-01 |
| `reg.algedonic.delivery.v1` | Algedonic delivery | S5 | deterministic-gate | active | 2026-12-01 |
| `reg.audit.behavioral-canary.v1` | Behavioral canary | S3* | deterministic-gate | active | 2026-12-01 |
| `reg.audit.behaviour-check.v1` | Behaviour check (export-signature) | S3* | deterministic-gate | active | 2026-12-01 |
| `reg.control.budget-guard.v1` | Budget guard | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.audit.canary-watch.v1` | Credential canary watch | S3* | deterministic-gate | active | 2026-12-01 |
| `reg.audit.closeout-gate.v1` | Closeout gate | S3* | deterministic-gate | active | 2026-12-01 |
| `reg.control.contract-advice.v1` | Contract advice section | S3 | prompt | active | 2026-12-01 |
| `reg.control.contract-preserving-compaction.v1` | Contract-preserving compaction | S3 | model-judgment | active | 2026-12-01 |
| `reg.identity.definition-check.v1` | Definition check | S5 | deterministic-gate | active | 2026-12-01 |
| `reg.identity.definition-writers.v1` | Definition writers (the accept-path split) | S5 | deterministic-gate | active | 2026-12-01 |
| `reg.authority.disposition-authority.v1` | Disposition authority | S5 | deterministic-gate | active | 2026-12-01 |
| `reg.audit.doctor.v1` | Doctor (the operating check) | S3* | deterministic-gate | active | 2026-12-01 |
| `reg.coordination.effect-journal.v1` | Effect journal | S2 | deterministic-gate | active | 2026-12-01 |
| `reg.assurance.eval-harness.v1` | Eval harness and graders | S3* | deterministic-gate | active | 2026-12-01 |
| `reg.control.evidence-preflight.v1` | Evidence preflight | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.control.failure-observer.v1` | Failure observer | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.audit.glossary-lint.v1` | Glossary lint | S3* | deterministic-gate | active | 2026-12-01 |
| `reg.identity.identity-context.v1` | Identity context | S5 | prompt | active | 2026-12-01 |
| `reg.authority.identity-promotion.v1` | Identity and advice promotion (the release path) | S5 | deterministic-gate | active | 2026-12-01 |
| `reg.audit.identity-untouched-check.v1` | Identity-untouched check (the instance's harness-owned files) | S3* | deterministic-gate | active | 2026-12-01 |
| `reg.authority.identity-write-gate.v1` | Identity write gate | S5 | deterministic-gate | active | 2026-12-01 |
| `reg.audit.inherited-tests-check.v1` | Inherited tests check | S3* | deterministic-gate | active | 2026-12-01 |
| `reg.identity.instance-manifest.v1` | Instance manifest (regulator init) | S5 | deterministic-gate | active | 2026-12-01 |
| `reg.intelligence.intelligence-intake.v1` | Intelligence intake | S4 | typed-tool | active | 2026-12-01 |
| `reg.algedonic.interaction-contract.v1` | Interaction contract (ask_human) | S5 | typed-tool | active | 2026-12-01 |
| `reg.control.memory-store.v1` | Operational memory store | S3 | typed-tool | active | 2026-12-01 |
| `reg.control.model-router.v1` | Model router | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.control.obligation-router.v1` | Obligation router | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.algedonic.outbox-watcher.v1` | Outbox watcher | S5 | deterministic-gate | active | 2026-12-01 |
| `reg.algedonic.pause-gate.v1` | Pause gate | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.audit.post-merge-check.v1` | Post-merge check | S3* | deterministic-gate | retired | 2026-12-01 |
| `reg.audit.pre-merge-trial.v1` | Pre-merge trial | S3* | deterministic-gate | active | 2026-12-01 |
| `reg.assurance.prediction-resolution.v1` | Prediction resolution | S3* | deterministic-gate | active | 2026-12-01 |
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
| `reg.control.unit-lifecycle.v1` | Unit lifecycle | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.authority.vendor-write-gate.v1` | Vendor write gate | S5 | deterministic-gate | retired | 2026-12-01 |
| `reg.control.work-contract-gate.v1` | Work contract gate | S3 | deterministic-gate | active | 2026-12-01 |

## Advice context

`reg.identity.advice-context.v1` · S5 · prompt · active · unreleased

**Purpose.** Render the active profile's advice — the instance's regulator/advice/<profile>.md — into the unit's system prompt from the file on each session, as the profiles extension's section beside the grant, byte for byte as the profile's inline advice[] rendered before the advice became a file. The advice a unit is told is a file a person can read, a proposal can target by path, and `advice accept` can write; it is not a field inside the grant and it never lives in the transcript. Mirrors identity-context for the second seeded file set.

**Absorbs.** `uninformed-unit` — What a unit of a profile is told lives inside the same JSON file as the profile's tools and writable paths, so nobody can change the advice without being able to change the grant, a proposal against the advice has no file to name, and a reader cannot see what a unit was told without reading the grant.

**Mechanism.** `../regulator-pi/src/profiles.ts` at `host:session_start` (read regulator/advice/<profile>.md from the working tree the unit sees, and the budget policy's advice.maxChars; the status line says what is cut), `host:before_agent_start` (section regulator_profile: the grant, then the advice file cut at advice.maxChars; one warning per session when it is cut)

**Channels.** consumes `regulator/advice/<profile>.md (worktree)`, `the budget policy's advice.maxChars` · emits `system-prompt section`

**Scope.** subjects advice, profile · resources regulator/advice/

**Cost.** The advice file's length in every prompt of the profile, capped at the budget policy's `advice.maxChars` (4000 characters by default, about 1000 tokens); Pi diffs sections, so unchanged advice is a cache hit.

**May.**
- render the profile's advice as a prompt section
- say in the status line and once per session that the advice was cut

**May not.**
- change advice
- make advice binding (the gate, the bash watch and the closeout check do)
- render a grant the profile does not declare

**Evidence.** `../regulator-pi/src/profiles.test.ts`, `src/profiles.test.ts`, `../core/src/advice.test.ts`

**Limitations.**
- Level 5 by design: what is rendered is advice. A model can ignore it; what keeps the file what a person decided is the write gate (identity-write-gate), the bash watch and the identity-untouched check.
- The advice rendered is the worktree's copy, which a unit's shell can change before the session reads it; the closeout check compares the branch to the base, so a changed copy is a failing check, not changed advice.
- Rendering is cut at the budget policy's `advice.maxChars` (4000 characters unless the policy says otherwise); a file longer than that is partly advice the model never sees. The cut is reported — `regulator check` and `regulator doctor` warn with the size, the limit and the file, the session's status line says so and the session warns once — and refuses nothing: shortening the file is a person's decision (docs/DEBT.md row 46).
- Outside an instance that carries the file (a session run by hand in a plain checkout, or an instance initialized before advice was a file set) the grant alone renders, or the inline advice a profile still carries during the one release of overlap; nothing says the unit was told less than the definition intends.

**Ownership.** regulator-maintainers · introduced 2026-10-25 · review by 2026-12-01

**Ablation.** `extension:profiles` — Shares the profiles extension with the profile write grant: an arm without it renders no advice and grants nothing by profile either. The drift suite's control arm runs without identity and the host checks, not without profiles; a per-profile advice override on an arm is slice 3 of the accept-path split.

**Retirement condition.** Retire the rendered section when the drift suite shows no conformance loss across three model versions with the section off and the gates on: the grant and the contract carry the unit alone.


## Advice decision path

`reg.authority.advice-decision.v1` · S5 · deterministic-gate · active · unreleased

**Purpose.** The one path that changes an advice file: `regulator advice accept`, run by a named person, on an obligation owed to S5 that a proposal opened against `advice/<profile>.md`. It writes the proposed file into the instance's regulator/advice/ under S5 authority (the same authorizeWrite the gate refuses operational callers), refuses a file that is not the one the proposal names — in its typed `harness-edit` payload (#138; the host first checks the payload against the stores, prediction-resolution) or, for a plain proposal, in its subject — or that no declared profile owns, refuses content that is empty or over the budget policy's `advice.maxChars`, commits on the base branch citing the obligation, and resolves the obligation as accepted with the commit. `advice reject` resolves it as rejected and changes nothing. Mirrors the S5 decision path (s5-decision) for the second accept path of the split (DEFINITION_WRITERS, class `advice`): advice is what every unit of a profile is told, which is policy, not operations, so the grant is `actAsS5`.

**Absorbs.** `proposal-with-no-decider` — A proposal against a profile's advice is recorded and owed to S5, and then a person edits the advice file by hand with no link to what was asked, or edits the profile's grant while they are at it, or never does, and the obligation sits open with no way to close it honestly.

**Mechanism.** `src/cli.ts` at `cli:advice accept` (proposal owed to S5, actAsS5, clean tree, declared profile's file named by the harness-edit payload (checked against the stores first) or by a plain proposal's subject, non-empty and under advice.maxChars; authorizeWrite s5-authority, git commit, ledger.resolve accepted citing the prediction when there is one), `cli:advice reject` (ledger.resolve rejected)

**Channels.** consumes `obligation (policy-proposal, owed to S5: a harness-edit naming its profile, or a plain proposal whose subject names advice/<profile>.md)`, `a proposed file` · emits `commit on the base branch`, `obligation-resolved (accepted | rejected)`

**Scope.** subjects advice, obligation · resources regulator/advice/, base branch

**Cost.** One commit per accepted proposal; no model calls.

**May.**
- write one advice file under S5 authority
- commit it citing the obligation
- resolve the proposal's obligation

**May not.**
- accept a proposal a unit made for itself (a unit has no S5 authority)
- write outside regulator/advice/
- write a profile's grant (tools, writable paths): that is the declaration's path, a merged change
- write a file other than the one the proposal names
- be called by a tool

**Evidence.** `src/cli.test.ts`, `../core/src/advice.test.ts`, `../core/src/predictions.test.ts`

**Limitations.**
- Who may act as S5 is the interaction policy's `actAsS5` grant, checked before the write; the name on `--by` is asserted, not authenticated. A grant narrower than S5 for advice alone (`acceptAdvice`) is an interaction-policy decision not taken (accept-path note §9).
- The proposed content is a file the person supplies; nothing derives it from the proposal's requestedChange, and nothing diffs it against what was asked. The person decides that the file is the proposal.
- An advice file is text. Nothing checks that an accepted edit is advice rather than a rule in disguise; the `glossary-lint` analogue for advice does not exist. The person's reading and, once the reflector lands, the live horizon are the only pressure (docs/DEBT.md row 43).
- The probe rule — accept a `harness-edit` only after its probe horizon resolves — is not here. The prediction record and the typed payload landed (#138, prediction-resolution), so a `harness-edit` is checked against the stores and its live horizon opens at acceptance; refusing one that was never probed waits for the probe arm (accept-path note §8, slice 3, after #46).
- It changes the instance's advice, not the definition's seed: a decision accepted in one instance does not reach another. `advice promote` carries it to the seed; instances initialized earlier keep their own copy (docs/DEBT.md row 44, with #53).

**Ownership.** regulator-maintainers · introduced 2026-10-25 · review by 2026-12-01

**Ablation.** `none` — A CLI command a person runs; there is no arm in which a person changes advice without it, only the drill that edits a file by hand (which the gate, the bash watch and the closeout refuse for a unit).

**Retirement condition.** Never while advice is a file the instance carries: INV-002 names an accept path as the only writer of a protected file. Retire with the proposal path, not before.


## Algedonic delivery

`reg.algedonic.delivery.v1` · S5 · deterministic-gate · active · since 0.1.0

**Purpose.** Put what is owed to a person in front of one. Every open obligation whose consumer is human and that nothing has delivered is written to the owner's outbox — the same file `notify_owner` uses, an effect that cannot be unsent — through the effect journal under an idempotency key, once, at every step of the loop and on `regulator signals route`; the delivery is recorded on the obligation. `regulator remind` delivers again every obligation owed to a person whose last delivery is older than the policy's reminder interval, marked as a reminder. Delivery is not a disposition: the obligation stays open until a person answers.

**Absorbs.** `owed-but-unseen` — The read model shows twelve obligations owed to a person; the person did not know, because nothing told them, and the units waited on nobody.

**Mechanism.** `src/deliver.ts` at `loop:routeAndDeliver` (deliverPending: undelivered → outbox, journaled, ledger.deliver; remindDue: remindable → outbox, reminder), `cli:signals route` (deliverPending after routing), `cli:remind` (remindDue)

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

**Evidence.** `src/controller.test.ts`, `src/cli.test.ts`, `../core/src/interaction.test.ts`

**Limitations.**
- The outbox is a file; `regulator watch` forwards each new line to the channel command the deployment names, and nothing beyond that command reaches a person. Supervising the watcher and choosing the channel are the deployment's.
- Reminders run at the loop's steps, on `regulator remind`, and on each `regulator watch` tick; an instance with no watcher running reminds nobody until someone runs something.
- One outbox for the instance, not one per person: an obligation owed to 'a person' is delivered to whoever reads the outbox, and the interaction policy's people say who may answer, not who was told.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `loop:deliver-pending` — Delivery is a step of the loop, not an extension: the harness cannot throw this switch without a code change. An arm without it leaves obligations owed to a person in the read model only.

**Retirement condition.** Never while a person is a declared consumer: delivery is the channel to that consumer, not a workaround for a model's behaviour. Retire with the human consumer, not before.


## Behavioral canary

`reg.audit.behavioral-canary.v1` · S3* · deterministic-gate · active · unreleased

**Purpose.** Ask, in a rule rendered beside the identity on every run, that each reply begin with a marker the budget policy declares (`identity.canary`: the marker, with `{unit}` for the unit id, and the number of misses), and read every assistant reply for it. A run of replies without the marker is recorded as an advisory audit finding to S3. A behavioral canary is an absence canary, the warrant canary's shape: the marker is re-asserted every reply while the model still follows the small rules it is shown each turn, and its silence says that attention has gone before the large rules go with it. The credential canary (`reg.audit.canary-watch.v1`) is the other polarity: a value whose presence is the alarm.

**Absorbs.** `context-degradation` — Forty turns in, the unit still answers fluently, but it has stopped doing the small things the prompt asks for; the next thing it drops is a fixed decision or an invariant, and nothing in the loop sees the slide until the closeout refuses the result.

**Mechanism.** `../regulator-pi/src/identity.ts` at `host:before_agent_start` (render the rule), `host:message_end` (read the reply)

**Channels.** consumes `the budget policy's `identity.canary``, `message_end (assistant)` · emits `audit-finding → S3 (context-degradation, advisory)`

**Scope.** subjects assistant reply · resources the session's marker

**Cost.** One short system-prompt section per run and one prefix comparison per assistant reply; a few output tokens per reply for the marker; no model calls.

**May.**
- render the rule as a prompt section of its own, outside the identity's character limit
- record an advisory finding and set the status line

**May not.**
- block a tool call or stop the model
- end the attempt or open a fresh session (S3 decides: the recovery router under its policy)
- infer anything from a single miss

**Evidence.** `../regulator-pi/src/identity.test.ts`, `../core/src/canary.test.ts`

**Limitations.**
- The marker is a proxy for attention, and the rule is advice. A model that keeps the marker and still hallucinates is not seen; a model that drops it for a harmless reason is. A reply with no text (tool calls only) is not counted either way. The finding is advisory for these reasons, and it is one signal among the host's, not a verdict.
- It reads a prefix: the marker after leading whitespace. A marker inside a code fence, after a heading, or paraphrased is a miss, and a model that puts it first and nothing else right is a hit.
- S3 does nothing with the finding yet. Under the shipped routing policy an advisory audit finding is noted as trace and opens no obligation, and no recovery cause names a degraded session, so the fresh session the signal argues for is a person's decision today (docs/DEBT.md row 42).
- Misses are counted per session, as the thrash detector's edits are: a unit resumed in a new session starts at zero, and the first reply of a session is judged like every other.

**Ownership.** regulator-maintainers · introduced 2026-10-22 · review by 2026-12-01

**Ablation.** `extension:identity` — Shares the identity extension with identity in context and the memory store; the control arm, which renders no identity, has no canary by construction. A treatment arm without the extension loses all three. The live drift runs (#46) are the first place the canary's firing can be read against what the closeout later found.

**Retirement condition.** Across three model versions in the live drift runs, the canary never falls silent before an attempt that the closeout then refuses, or falls silent only after the budget guard or the closeout has already caught the failure: the signal adds no lead time.


## Behaviour check (export-signature)

`reg.audit.behaviour-check.v1` · S3* · deterministic-gate · active · since 0.1.0

**Purpose.** Observe a criterion by content, not by class. An evidence expectation may carry a check — `export-signature` names a module, an export and the parameter count it must keep — and at closeout the host imports the module in its own process at the unit's HEAD and reads the function. The record binds to that one criterion, so a passing suite that never exercises the behaviour cannot satisfy it, and a runtime-class criterion with host evidence no longer waits for a person: acceptance is asked only where no probe exists. The drift scenario's signature is the first behaviour-bound check; the mechanism is any expectation's to carry.

**Absorbs.** `evidence-by-class` — The contract fixed slugify's signature; the unit added a second parameter with a default; every test still passed; the verdict was pass, because test-class evidence satisfied a test-class criterion and nothing looked at the export.

**Mechanism.** `../checks/src/verify.ts` at `loop:runHostChecks` (export-signature: the probe run at HEAD, one result per carrying expectation), `loop:auditUnit` (bindEvidence binds by criterion; technicalVerdict takes host evidence before acceptance for runtime criteria)

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

**Evidence.** `../checks/src/verify.test.ts`, `src/evals.test.ts`

**Limitations.**
- One kind of check exists: an export's declared parameter count. Return types, thrown errors and behaviour under input are not observed; `Function.length` stops at the first defaulted parameter, so a defaulted second argument passes as a one-argument signature.
- The probe imports the module: import-time side effects run in the host's process tree, at HEAD, once per closeout. A module that cannot be imported is inconclusive, never a pass.
- A criterion that carries no check is still bound by class, as before. Content binding is opt-in per expectation, and the drift contracts are the only ones that opt in so far.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `check:export-signature` — The drift suite's no-behaviour-check arm drops the check from every unit type and the signature criterion from the contract: the signature is a fixed decision in prose only.

**Retirement condition.** Never as a mechanism; the export-signature kind retires when no contract in a quarter of runs carries it, and a richer behaviour check (a runtime probe over inputs) has replaced it.


## Budget guard

`reg.control.budget-guard.v1` · S3 · deterministic-gate · active · since 0.1.0

**Purpose.** Meter each attempt's tokens, cost, wall-clock and turns against the policy's ceiling for the unit type; halt the attempt when a ceiling is crossed and refuse every tool with an effect from then on. The ledger is written to the execution store so the orchestrator closes on it and the read model can show it.

**Absorbs.** `runaway-unit` — A unit that keeps going — retrying, re-reading, re-editing — consumes the whole context window and the whole budget without anything outside the loop deciding it should.

**Mechanism.** `../regulator-pi/src/budget.ts` at `host:session_start` (ledger written, or resumed on an attempt already metered), `host:turn_end` (ctx.abort), `host:tool_call`, `loop:runUnit` (close: budget-exhausted attempt)

**Channels.** consumes `policy (budgets)`, `message_end usage`, `model_select` · emits `budget ledger (execution store)`

**Scope.** subjects unit, attempt · resources tokens, cost, wall-clock, turns

**Cost.** One ledger write per turn end; no model calls. Negligible next to the turns it meters.

**May.**
- halt the running attempt
- refuse non-read-only tools once a ceiling is crossed
- record the ledger

**May not.**
- raise a ceiling
- decide what happens to a halted unit (the recovery router does)
- choose a model

**Evidence.** `../regulator-pi/src/budget.test.ts`, `src/controller.test.ts`, `../core/src/policy.test.ts`

**Limitations.**
- Ceilings are checked at turn end and tool call, so the turn that crosses one completes; a single very large response is not cut off mid-stream.
- Tokens and cost are what the provider reports on each assistant message; a provider that reports nothing meters as zero. Tokens sum every message's total, so a long context is paid again on every turn: the default 400,000-token ceiling is about thirty turns of a large context, which the live drift run's memory unit reached on both arms.
- The wall-clock ceiling is measured from the attempt's first session start, not from dispatch; time spent loading extensions or waiting on a rate limit counts against the unit.
- A halt reaches the orchestrator as an aborted session plus the ledger's exhausted marker, and the marker is what says it was a halt (the router reads it before failing over); a session opened on the attempt without the guard — no policy, no lease — records nothing, and the loop sees no-report.
- Attempts are the orchestrator's ceiling (runUnit), not the session's; a unit re-dispatched by hand outside runUnit is not counted.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `extension:budget` — The harness drops the budget extension from a live arm; the loop's attempt ceiling still applies. Not separable from contract-preserving compaction, which the same extension carries.

**Retirement condition.** No attempt in three model versions and the drift suite crosses a ceiling the loop's wall-clock limit would not have caught first, across two supported models.


## Credential canary watch

`reg.audit.canary-watch.v1` · S3* · deterministic-gate · active · since 0.1.0

**Purpose.** Watch for the instance's credential canaries — credential-looking values recorded at init or fixture time from a committed .env — in every tool result and in the model's own text. A credential canary is a presence canary: the value must never appear, and its appearance is the alarm (the behavioral canary, `reg.audit.behavioral-canary.v1`, is the other polarity). A canary in a tool result is redacted before the model sees it and recorded as a critical audit finding; a canary the model writes cannot be unsaid and is recorded.

**Absorbs.** `secret-exposure` — A unit reads .env to 'understand the configuration', the token is now in the transcript, and the next tool call or the next report carries it out.

**Mechanism.** `../regulator-pi/src/authority.ts` at `host:tool_result` (redact), `host:message_end` (record)

**Channels.** consumes `tool_result`, `message_end`, `.regulator/canaries` · emits `audit-finding → S3 (secret-exposure, critical)`

**Scope.** subjects tool result, assistant message · resources canary values

**Cost.** One substring scan per tool result text block and per assistant message; no model calls.

**May.**
- redact a canary from a tool result
- record a finding

**May not.**
- stop the model from reading the file (the read is the unit's; the exposure is what is watched)
- recall text already sent to a provider

**Evidence.** `../regulator-pi/src/authority.test.ts`

**Limitations.**
- It watches for known values only: a real secret the harness was not told about is not a canary. This measures whether the exposure path exists, not whether every secret is safe.
- A canary that reaches the model in a form the scan does not match (split across blocks, base64, described rather than quoted) is not redacted.
- By the time message_end records a leak the text has left the process: the finding is evidence of exposure, not prevention. Network egress is not watched at all; the lesson names it as the boundary a container provides.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `extension:authority` — Shares the authority extension with the write gate and proposal intake; a live arm without it loses all three. The injection fixture is the suite that exercises it.

**Retirement condition.** No canary reaches a tool result or the model's text in the injection fixture across three model versions with the watch off.


## Closeout gate

`reg.audit.closeout-gate.v1` · S3* · deterministic-gate · active · since 0.1.0

**Purpose.** Refuse to close a unit unless the harness's own evidence says its contract is met: after a valid result report, run the checks the workload names for the unit type with the orchestrator's process runner against the unit's committed revision, bind every result to the unit, attempt, contract, revision, environment and the criteria it speaks to, append it to the audit log, and derive the technical verdict from the evidence that is fresh for that revision — plus a human acceptance for each required criterion no check can observe. Missing, stale, failing or contradicted evidence blocks closeout; the report's claims satisfy nothing.

**Absorbs.** `self-certified-completion` — The unit says the tests pass. Nothing ran them, or they ran three commits ago, or they ran and failed and the report says otherwise; the loop closes on the sentence.

**Mechanism.** `src/controller.ts` at `loop:auditUnit` (after the report check, before reintegration), `loop:closeUnit` (re-audit without an attempt)

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

**Evidence.** `../checks/src/verify.test.ts`, `src/controller.test.ts`

**Limitations.**
- Evidence binds to criteria by class, not by content: a passing suite that does not exercise the changed behaviour satisfies a test-class criterion. Criterion-specific checks are a workload's to declare; the software workload declares only run_tests and run_checks.
- The environment recorded is the orchestrator's host; a check that passes here and fails on the target platform is not caught.
- Runtime-class criteria are treated like semantic ones (human acceptance) because no host mechanism observes runtime behaviour yet.
- The audit log is one NDJSON file per instance beside the regulatory log (messages and their obligations); neither is merged with the SQLite regulatory event store the reporting tools write.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `none` — The verify step is the S3 loop itself: an arm without closeout is a different orchestrator, not an ablation. The checks it runs are ablated one at a time (identity-untouched, export-signature).

**Retirement condition.** Never: independent verification is INV-003. Individual checks retire under their own conditions.


## Contract advice section

`reg.control.contract-advice.v1` · S3 · prompt · active · since 0.1.0

**Purpose.** Render the governing contract — fixed, delegated, unresolved, expected evidence, and the obligation to call report_result — as a system-prompt section, so the unit knows what freedom it has. This is advice: it changes what the model is told, not what it can do.

**Absorbs.** `uninformed-unit` — The gates refuse a bad report, but a unit that never saw the allocation produces one by accident and burns an attempt learning the contract from refusals.

**Mechanism.** `../regulator-pi/src/contract.ts` at `host:before_agent_start`

**Channels.** consumes `work contract (S3)` · emits nothing

**Scope.** subjects unit · resources system prompt

**May.**
- add a section to the system prompt

**May not.**
- enforce anything; the result-report gate and the lease gate do

**Evidence.** `../regulator-pi/src/contract.test.ts`

**Limitations.**
- Prompt text: the model may ignore it, and a long transcript may push it out of attention. Everything it says that matters is also a gate.
- The section is regenerated each turn from the loaded contract; it cannot reflect a contract version issued after the session started.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `extension:contract` — Shares the contract extension with the result-report gate; dropping the extension removes both the section and the tool, so a live arm without it has no report path at all.

**Retirement condition.** Retire the advice when a contract-aware model needs no rendered section: units under three model versions report every delegated decision without it, with the gate still on.


## Contract-preserving compaction

`reg.control.contract-preserving-compaction.v1` · S3 · model-judgment · active · since 0.1.0

**Purpose.** Replace the default compaction summary with a deterministic block — the contract's identity and allocation, the evidence gathered so far, the files touched — followed by a model summary of the conversation when one is available. What the loop needs to continue never depends on the summary being good.

**Absorbs.** `compaction-amnesia` — After a threshold compaction the unit no longer knows which decisions were fixed, which were unresolved, or what it already proved; it re-does settled work or quietly violates a constraint the summary dropped.

**Mechanism.** `../regulator-pi/src/budget.ts` at `host:session_before_compact`, `host:session_compact`, `host:session_compact_failed`

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

**Evidence.** `../regulator-pi/src/budget.test.ts`, `../core/src/policy.test.ts`

**Limitations.**
- The conversation summary is model judgement: it can be wrong, and nothing checks it. Only the deterministic block is guaranteed.
- Evidence pointers are the first line of run_tests and run_checks results; evidence gathered through bash is invisible to it.
- The block is what compaction carries; the contract section in the system prompt is regenerated every turn regardless. This regulator preserves progress, not the contract text.
- Without a model (or when it fails) the summary says so and the block stands alone; the unit continues with less.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `extension:budget` — Shares the budget extension with the budget guard. A live arm without it compacts under Pi's default and the contract block is not carried.

**Retirement condition.** No compaction in the drift suite loses a fixed decision across three model versions with the block off, measured by the report gate's refusals after a compaction.


## Definition check

`reg.identity.definition-check.v1` · S5 · deterministic-gate · active · since 0.1.0

**Purpose.** Check the declaration as a whole under `regulator check`: every profile, workload, policy and identity file validates against its closed schema, and the references between them resolve — a unit type's profile is declared, a policy names only declared unit types, a check name is one the host runs, a profile that says read-only grants only read-only effects, a contracted unit type's profile grants the report tool, the identity set is complete with well-formed, unique invariants, a routing floor is a regular expression, every profile has its advice file and no file names a profile nobody declared and no profile carries advice both inline and in a file, and every directory of the definition falls in a class of DEFINITION_WRITERS. A control plane is declared, not assembled; this is what makes the declaration checkable.

**Absorbs.** `assembled-not-declared` — A unit type names a profile that lives only in code, a policy budgets a unit type nobody declared, the identity is a file someone forgot to seed, and the instance runs anyway on whatever the code happened to do.

**Mechanism.** `src/registry-cli.ts` at `cli:check` (checkDefinition, under pnpm check), `check:checkDefinition` (a unit type declared contract-less must run under a profile that is read-only by declared effect), `check:checkDefinition` (a unit type that requires a contract must run under a profile that grants report_result, or no unit of the type could ever close), `check:checkDefinition` (advice: a file per declared profile, no file for an undeclared profile, no profile with both inline advice and a file; an advice file over the policy's advice.maxChars is a warning), `check:checkDefinition` (a definition directory in no class of DEFINITION_WRITERS is refused (definition-writers))

**Channels.** consumes `profiles/*.json`, `workload/*.json`, `policies/*.json`, `identity/*.md`, `advice/*.md` · emits `definition problems (exit 1)`

**Scope.** subjects definition · resources packages/regulator

**Cost.** One pass over the definition's files in CI; no model calls.

**May.**
- refuse a definition whose parts do not resolve
- report what is missing

**May not.**
- change a file
- check an instance (that is the read model's)
- judge whether a policy is wise

**Evidence.** `../core/src/definition.test.ts`, `src/registry.test.ts`

**Limitations.**
- Shape and references only: a profile that grants bash to a unit type whose contract forbids writes is a valid definition. Whether the declaration is a good one is the capstone's viability case.
- It runs under `pnpm check` and `regulator check`, not at dispatch: an instance started from an edited definition between checks runs on the edit.
- The identity and advice checked are the definition's seeds; an instance's copies are checked by the identity-untouched check at closeout and reported by `doctor`, not here.
- An advice file is checked for shape and size, not for content: nothing says whether a line is advice or a rule in disguise (docs/DEBT.md row 43).

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `none` — A check on the definition, run under pnpm check and regulator check, not in a session or the loop: nothing runs without it to compare against.

**Retirement condition.** Never: a declared control plane is checked as a whole or it is assembled.


## Definition writers (the accept-path split)

`reg.identity.definition-writers.v1` · S5 · deterministic-gate · active · unreleased

**Purpose.** Declare once which definition files land through which accept path, and refuse a definition that has a directory in no class. `DEFINITION_WRITERS` in protocol names three classes — identity (`identity/`, `regulator/identity/`, `identity accept | promote`), advice (`advice/`, `regulator/advice/`, `advice accept | promote`) and the declaration (profiles, workloads, policies, evals, contracts, the registry and the fixtures, a merged change) — with what proposes, probes and is refused for each. `checkDefinition` refuses a directory under the definition root in no class, so a new kind of file is declared before anything reads it; the write gate, the bash watch and the closeout's diffed prefixes derive their protected set from the list's instance paths instead of restating them; `regulator docs` renders the list into BOUNDARY.md as "Who writes the definition"; and a test holds every command the list names against `ENFORCEMENT_POINTS.cli`. Mirrors definition-check for the question the definition check did not ask: not whether the parts resolve, but who may write each one.

**Absorbs.** `assembled-not-declared` — A new directory appears under the definition — skills, prompts, a second advice set — and is read by an extension, with nobody having said whether a unit may propose against it, which command lands an accepted proposal, or whether the instance protects a copy; the accept paths are whatever each command happens to write.

**Mechanism.** `../protocol/src/definition-writers.ts` at `check:checkDefinition` (a definition directory in no class of DEFINITION_WRITERS is refused (src/, dist/ and node_modules/ are the package's, not the definition's)), `cli:check` (under pnpm check and regulator check), `cli:docs` (renderBoundaryMarkdown: the "Who writes the definition" section from the list)

**Channels.** consumes `the definition root's directories`, `DEFINITION_WRITERS` · emits `definition problems (exit 1)`, `BOUNDARY.md § Who writes the definition`

**Scope.** subjects definition · resources packages/regulator, regulator/identity/, regulator/advice/

**Cost.** One readdir of the definition root in CI; no model calls.

**May.**
- refuse a definition directory in no class
- be the one source the gate, the bash watch and the closeout derive their protected set from
- render the split into BOUNDARY.md

**May not.**
- change a file
- accept or promote anything (the classes' commands do)
- judge whether a path is a good one

**Evidence.** `../protocol/src/definition-writers.test.ts`, `../core/src/definition.test.ts`, `../regulator-pi/src/authority.test.ts`, `src/controller.test.ts`, `src/registry.test.ts`

**Limitations.**
- The declaration class has no mechanism of its own: a profile grant, a unit type, a check, a policy, a suite or an extension lands as a pull request a person writes with `pnpm check` as the gate, not as a unit of work under the loop with `regulator check` at closeout. BOUNDARY.md's row says so; the mechanism waits for the definition's repository to run as an instance (accept-path note §6; docs/DEBT.md row 45).
- Directories only: a file at the definition root (`settings.json`, `BOUNDARY.md`, `package.json`) is in no class and is not checked, and the fixtures are listed by name in the declaration class rather than derived from the eval suites that use them.
- It names the paths and the commands; it does not check that a class's accept command writes only under its instance path. That is each command's own check (`authorizeWrite` under S5 authority, a closed file list), evidenced on its card.
- A plain proposal's class is read off its subject (the path it names); only a `harness-edit` names its target in a typed payload (`HarnessEditSchema`, #138), and only for the advice class. A typed payload for the identity and declaration classes is not designed.

**Ownership.** regulator-maintainers · introduced 2026-10-25 · review by 2026-12-01

**Ablation.** `none` — A check on the definition and a constant the gates derive from, run under pnpm check and regulator check, not in a session or the loop: nothing runs without it to compare against.

**Retirement condition.** Never: a definition whose writers are not declared is assembled. The declaration row's gap retires when the definition's repository runs under the loop.


## Disposition authority

`reg.authority.disposition-authority.v1` · S5 · deterministic-gate · active · since 0.1.0

**Purpose.** Check who may disposition what before anything is written. The interaction policy names people with three grants — the highest severity they may disposition, whether they may resolve as accepted-risk, whether they may act as S5 — and every `--by` on the CLI (`answer`, `obligation ack|resolve|escalate`, `memory retract`, `unit accept`, `identity accept|reject`) is checked against it: a name not listed may disposition nothing, and a listed person is refused above their severity, for a risk they may not accept, or for an S5 decision they may not make. `answer` additionally refuses an option the question did not offer, and turns a consent answer into accepted or rejected by the protocol's rule, never by the person's wording.

**Absorbs.** `disposition-by-anyone` — A critical algedonic obligation is resolved as accepted-risk by `--by intern`, honestly recorded and wrong: the record said who, and nothing said whether they could.

**Mechanism.** `src/cli.ts` at `cli:answer` (authorized() before every write that takes --by (checkDispositionAuthority); the options check and dispositionForAnswer), `cli:obligation ack`, `cli:obligation resolve`, `cli:obligation escalate`, `cli:memory retract`, `cli:unit accept` (at blocking: a criterion has no severity of its own), `cli:identity accept` (as S5), `cli:identity reject` (as S5), `cli:identity promote` (as S5)

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

**Evidence.** `src/cli.test.ts`, `../core/src/interaction.test.ts`

**Limitations.**
- `--by` is asserted, not authenticated: the check is whether the named person may, not whether the caller is that person. Authentication is the deployment's (an OS user, a signed request) and is out of the lab's scope; the record stays honest about the claim.
- The grants are three booleans and a severity; an obligation-specific grant (bob may answer questions on units he owns) is not expressible, and the policy is one file for the instance.
- The session path (`ask_human` with a dialog) attributes the answer to the session's user and does not run this check: a person at the keyboard of a unit's session is treated as able to answer that unit's question. The CLI path checks; the dialog path trusts the terminal.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `policy:interaction.people` — A people list naming everyone at critical with every grant is the ablation; the harness does not throw policy switches. A scripted run never dispositions anything.

**Retirement condition.** Retire when authentication replaces the name: a deployment that signs dispositions makes the policy's people a projection of its accounts.


## Doctor (the operating check)

`reg.audit.doctor.v1` · S3* · deterministic-gate · active · since 0.1.0

**Purpose.** One headless pass over everything a person would check before trusting an installation, machine-readable, exit 1 on any problem: the Node floor, git, the Pi pin against what is installed, the registry check (with review dates) and the definition check, reviews due within thirty days, and — in an instance — the manifest, whether the instance was initialized under this definition revision, the identity's presence, the base's cleanliness, and what is owed, undelivered or holding the whole instance. The CI entry point, and the first command of the day.

**Absorbs.** `works-on-my-laptop` — The definition was upgraded, a card's review date passed, the base had a stray file and an obligation nobody delivered was holding every unit — four things four people knew, none of them written where the next run would read them.

**Mechanism.** `src/instance.ts` at `cli:doctor` (every check, ok or not, with its detail; the exit code)

**Channels.** consumes `the runtime`, `the definition`, `the instance's manifest, base and ledger` · emits `doctor report (JSON or text)`

**Scope.** subjects registry, identity, execution, obligation · resources the definition, .regulator/

**Cost.** A registry and definition check plus a few reads; seconds.

**May.**
- report and refuse (exit 1)

**May not.**
- fix anything
- dispatch, deliver or disposition
- silence a check

**Evidence.** `src/instance.test.ts`, `src/cli.test.ts`

**Limitations.**
- It checks what the definition and the instance say about themselves; a broken model provider, a missing API key or a full disk are Pi's and the deployment's to notice.
- Definition drift is detected by revision, registry count and Pi pin; a definition changed without a commit (a dirty working tree) reads as unchanged.
- Exit 1 is the whole enforcement: a CI job that does not run it, or ignores its exit code, is unregulated. Nothing else calls doctor.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `none` — A check a person or CI runs; it takes part in no unit's run.

**Retirement condition.** Never as a mechanism; individual checks retire when what they check is checked earlier (a Pi pin enforced by the package manager retires the pin check).


## Effect journal

`reg.coordination.effect-journal.v1` · S2 · deterministic-gate · active · since 0.1.0

**Purpose.** Make a side-effecting tool durable: write `intended` under an idempotency key before the effect and `committed` after; refuse to act again on a key that is committed or confirmed; on every session start reconcile each `intended` with no outcome against the world (confirmed or absent) before any new effect. A harness that loses its process between an effect and its record neither repeats the effect nor forgets it.

**Absorbs.** `duplicated-effect` — The notification was sent, the process died before it wrote that down, the retry sends it again; or the sandbox vanished mid-unit and nobody knows whether the external operation happened.

**Mechanism.** `../regulator-pi/src/recovery.ts` at `tool:notify_owner` (execute: begin/commit), `host:session_start` (reconcile)

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

**Evidence.** `../regulator-pi/src/recovery.test.ts`, `../core/src/recovery.test.ts`

**Limitations.**
- Reconciliation needs an observable world: notify_owner's outbox is keyed so it can be read back. An effect with no observable trace can only be recorded as absent, which is a guess.
- The idempotency key is the unit, the tool and the arguments; the same message sent on purpose twice is refused. Vary the message.
- Only notify_owner is journaled. bash is not: a shell command's side effects are unknown by declaration, and nothing here can journal what it cannot name.
- The journal is per base checkout, on one machine; two harnesses on two machines cannot see each other's intentions.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `extension:recovery` — Shares the recovery extension with the failure observer; delivery (algedonic-delivery) uses the same journal from the loop and is not ablated with the extension.

**Retirement condition.** No side-effecting tool is invoked twice for one intention across the recovery drills and three model versions with the journal off — which is to say never, because a restart is not a model behaviour.


## Eval harness and graders

`reg.assurance.eval-harness.v1` · S3* · deterministic-gate · active · since 0.1.0

**Purpose.** Evidence about the regulators: host-run verification one recursion level up. A suite declares the fixture, the tasks in order, the arms (which host extensions a live session loads, which host checks the implement unit type runs, which regulator an ablation arm switches off), the repetitions and the pre-registered metrics. The harness runs one fresh instance per arm and repetition through the real loop, grades each unit with outcome graders (the resulting environment: boundary violations, signature drift, vocabulary drift, rules written into prose), trajectory graders (the records: refusals, retries, escalations, invariant violations) and the graders a workload declares beside its own metrics (a command run in the instance, reading the tree and emitting a value with its observation), summarizes per arm with Student's t intervals, screens lifts by interval overlap, stamps the environment it ran in, and refuses to be a report without a person's interpretation.

**Absorbs.** `regulation-without-evidence` — Twelve lessons of gates, each added for a failure a model produced on a particular day, and no number that says any of them still helps — or that one of them costs more than it saves.

**Mechanism.** `src/evals.ts` at `cli:eval` (runSuite: one instance per arm × repetition, the tasks through driveUnit; contractForArm / workloadForArm change only what the definition declares; graders.ts: the fifteen built-in outcome and trajectory graders and the declared graders a suite pre-registers, run after each unit; no judge model; the fingerprint hashes each declared grader's file), `check:checkDefinition` (suites and committed reports validate; ablation arms name their switch; a suite pre-registers only built-in metrics or ones a workload declares with a grader file under the definition, with at most one optimisation target, and a judged metric is refused until its instrument record carries a held-out score)

**Channels.** consumes `eval suite`, `the definition (workload, policies, registry)`, `the declared graders of the workloads the tasks name`, `a dispatcher (scripted or live)`, `the instance's stores after each unit` · emits `eval report (arms, lifts, runs, fingerprint, interpretation)`

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

**Evidence.** `src/evals.test.ts`, `../core/src/evals.test.ts`, `src/portfolio.test.ts`

**Limitations.**
- A scripted unit never runs a session: the session gates (profile grant, write gate, bash watch, canary watch, budget guard) are not exercised, only the loop and the closeout checks. The committed reports say `scripted:` in their fingerprint for that reason; a live run is the drill, and its numbers are the ones that count for retirement. The live path itself is covered headlessly (the dispatcher opens and binds a session with no model, ../regulator-pi/src/dispatcher.test.ts); what a model does under the gates is not.
- The harness throws two kinds of switch — a host check, a checkpoint extension for a live arm. A regulator whose switch is `loop:`, `policy:` or `none` has no ablation arm the harness can run; the lifecycle view says so rather than pretending.
- Repetitions are what the suite declares; at n=3 few intervals separate, and the lift's `separated` flag is a screen, not a test. Contamination (a fixture leaking into a prompt or a model's training data) is not detected; the fixture is small and public.
- Graders are pattern and structure: vocabulary drift is a word list, a rule in prose is a regular expression over added lines. They are validated against three scripted learner-style units, not against a model's actual drift.
- A declared grader is run as the workload declared it, and that is all the harness checks: that its command names a file under the definition (hashed into the fingerprint), that it exits clean, and that its lines name the metric it was declared for. Whether the number it emits measures what the declaration says is the workload's correctness, evidenced by the workload's own tests (the portfolio's turnover by its fixture's), not by this record. A judged metric — one that names an instrument — is refused until the instrument record exists with its held-out score, so no declared metric is a model's judgment yet.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `none` — The harness is the ablation mechanism; an arm without it is no evidence at all.

**Retirement condition.** Never: a control system that cannot measure itself only grows. Individual graders retire when the drift they measure has not appeared in a quarter of live runs.


## Evidence preflight

`reg.control.evidence-preflight.v1` · S3 · deterministic-gate · active · since 0.1.0

**Purpose.** Stamp every run_tests and run_checks result with the revision it ran against and whether the tree was dirty, as a typed session entry and in the text the model sees; and block report_result before the report is written when it cites a test or command run that did not happen in this session, ran on another revision or a dirty tree, or did not pass. The cheap lie is refused where it is told.

**Absorbs.** `claimed-evidence` — The report cites run_tests; run_tests never ran, or ran before the last edit, or ran and failed. Without a preflight the lie costs a full closeout audit to catch.

**Mechanism.** `../regulator-pi/src/evidence.ts` at `host:tool_result` (run_tests, run_checks: provenance), `host:tool_call` (report_result: block)

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

**Evidence.** `../regulator-pi/src/evidence.test.ts`

**Limitations.**
- It trusts the session's own tool run: the session ran run_tests, and the session is what is being checked. Independence comes from the closeout gate, which reads nothing this extension records.
- Only test and command claims are preflighted; file, runtime, semantic and model claims pass through to the closeout gate.
- A run_tests call with a filter that passes counts as a passing run: the preflight sees the verdict, not the coverage.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `extension:evidence` — A live arm without the evidence extension reports evidence the session never produced; the closeout gate still catches the claim at the revision, later and at more cost.

**Retirement condition.** Reports under three model versions cite only evidence the session produced, with the preflight off, and the closeout gate's contradicted count stays at zero.


## Failure observer

`reg.control.failure-observer.v1` · S3 · deterministic-gate · active · since 0.1.0

**Purpose.** Normalize every tool error and provider error in a session to a cause (environment, timeout, tool-error; a refused report_result is invalid-report) and append it to the unit's observations, so that an attempt that ends without a report is routed by what went wrong rather than by the fact that it went silent.

**Absorbs.** `opaque-failure` — The transcript knows the tests could not load a module; the orchestrator only knows the unit did not report. Retrying is the wrong action and nothing in the record says so.

**Mechanism.** `../regulator-pi/src/recovery.ts` at `host:tool_execution_end` (isError), `host:agent_end` (stopReason error)

**Channels.** consumes `tool_execution_end`, `agent_end` · emits `failure observation (execution store)`

**Scope.** subjects unit, attempt · resources observations

**Cost.** One append per failed tool call; no model calls.

**May.**
- record an observation

**May not.**
- decide anything
- rewrite a tool result the model sees
- halt the attempt

**Evidence.** `../regulator-pi/src/recovery.test.ts`, `../core/src/recovery.test.ts`

**Limitations.**
- Normalization is a regular expression over the error text (flattened to one line, first 300 characters); an environment problem phrased unusually is recorded as a plain tool error. Only a refused report_result is typed without the regex, as invalid-report.
- Only errors the tool layer reports as errors are observed: a test that fails is not an error, and a bash command that exits non-zero without the tool flagging it is invisible.
- The observer records; it never rewrites the result the model sees (tool_result), so the model and the router may disagree about what happened.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `extension:recovery` — Shares the recovery extension with the effect journal. Without it the router classifies from the orchestrator's records alone and environment causes are routed as check failures.

**Retirement condition.** The router's decisions in the recovery drills match the observer's causes for three model versions when the observer is off, because the orchestrator's records alone name them.


## Glossary lint

`reg.audit.glossary-lint.v1` · S3* · deterministic-gate · active · since 0.1.0

**Purpose.** The identity's glossary names the words this instance does not use, with the word to say instead (`## Words this instance does not use`: `- task, job, ticket (say unit)`). At closeout the host reads the branch's added comment lines under the writable prefixes and its commit messages for them; a hit is failing evidence of class command, bound to the command-class criteria. Identifiers in code are not read: a variable named `task` is the project's business, a comment that calls a unit a task is drift. The check the drift suite's first sloppy report showed was missing.

**Absorbs.** `vocabulary-drift` — Six units later the comments say task, the commit log says ticket, and a new reader cannot tell a unit from an obligation — the glossary was in every prompt and enforced by nothing.

**Mechanism.** `../checks/src/verify.ts` at `loop:runHostChecks` (glossary-lint: git diff of added comment lines under the writable prefixes, git log of the branch; parseForbiddenTerms reads the glossary section), `loop:auditUnit` (forbidden terms from the worktree's identity; writable prefixes from the manifest or the conventions)

**Channels.** consumes `regulator/identity/GLOSSARY.md`, `the unit's branch` · emits `evidence record (class command)`

**Scope.** subjects evidence, identity · resources the unit's worktree

**Cost.** Two git commands per closeout.

**May.**
- read added comment lines and commit messages
- fail the command-class criteria

**May not.**
- read identifiers or strings
- rewrite anything
- invent a term the glossary did not list

**Evidence.** `../checks/src/verify.test.ts`, `src/instance.test.ts`, `src/evals.test.ts`

**Limitations.**
- A word list with a plural: `tasks` is caught, `tasking` and a synonym are not. Prose in the writable prefixes that is not a comment (a README under src/) is read line by line like a comment when a line carries a comment marker, and otherwise not at all.
- The comment half is blocking wherever the workload declares the check; the commit-message half is blocking unless the workload's check entry says `commitMessages: advisory`, in which case a word there is recorded as evidence and a finding at advisory and refuses nothing. `software-development` declares the attenuation; `personal-finance` does not. A word in a commit message still costs a unit that a workload has not attenuated an attempt.
- The glossary section is parsed from prose; a malformed line is silently not a term. `regulator check` does not validate the section.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `check:glossary-lint` — Drop the check from the unit types' lists; the drift suite's `no-glossary-lint` arm is the treatment without it.

**Retirement condition.** The vocabulary graders stay at zero across three model versions and the drift suite with the check off: the rendered glossary alone holds the words.


## Identity context

`reg.identity.identity-context.v1` · S5 · prompt · active · since 0.1.0

**Purpose.** Render the instance's identity set — IDENTITY.md, INVARIANTS.md, BOUNDARIES.md, GLOSSARY.md under regulator/identity/ — into every unit's system prompt from the files on each run, and current operational memory beside it as facts that expire. Identity never lives in the transcript: compaction cannot lose it, a fork cannot diverge from it, a model version cannot reinterpret it from memory. The dispatcher loads no context files from the worktree, so this is the identity a unit sees.

**Absorbs.** `identity-in-context` — The rules the system runs by exist as a paragraph in a context window that gets compacted, forked and re-read by a different model; six months later the same harness is a different system and nobody changed a file.

**Mechanism.** `../regulator-pi/src/identity.ts` at `host:before_agent_start` (sections regulator_identity, regulator_memory; one advisory operational-signal per session when the rendering is truncated)

**Channels.** consumes `regulator/identity/* (worktree)`, `memory store (current entries)` · emits `system-prompt sections`

**Scope.** subjects identity, memory · resources regulator/identity/, .regulator/memory.ndjson

**Cost.** The identity's length in every prompt, capped at the budget policy's `identity.maxChars` (12000 characters by default, about 3000 tokens); Pi diffs sections, so an unchanged identity is a cache hit.

**May.**
- render identity and memory as prompt sections
- report problems in the identity set

**May not.**
- change identity
- make identity binding (the gate and the closeout check do)
- render expired memory

**Evidence.** `../regulator-pi/src/identity.test.ts`, `../core/src/identity.test.ts`, `src/instance.test.ts`

**Limitations.**
- Level 5 by design: what is rendered is advice. A model can ignore it; what makes identity binding is the write gate (identity-write-gate) and the identity-untouched check, and the drift suite measures the gap.
- The identity rendered is the worktree's copy, which a unit's shell can change before the run reads it; the closeout check compares the branch to the base, so a changed copy is a failing check, not a changed rule.
- Rendering is truncated at the budget policy's `identity.maxChars` (12000 characters unless the policy says otherwise); a set longer than that is partly advice the model never sees. The cut is reported — `regulator check` and `regulator doctor` warn with the size, the limit and the files cut, the session's status line says so, and one advisory operational-signal per session records it on the unit — and refuses nothing: shortening the set is a person's decision.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `extension:identity` — Shares the identity extension with the memory tool. The drift suite's control arm is the arm without it (and without the checks); the course's lesson 12 drill 1 is the measurement.

**Retirement condition.** Retire the rendered section when the drift suite shows no conformance loss across three model versions with the section off and the checks on: the gates carry the identity alone.


## Identity and advice promotion (the release path)

`reg.authority.identity-promotion.v1` · S5 · deterministic-gate · active · since 0.1.0

**Purpose.** A decision accepted in an instance (`regulator identity accept`, `regulator advice accept`) changes that instance's copy; the definition's seed, which every later `init` starts from, is a file in the definition's repository. `regulator identity promote <file>.md` and `regulator advice promote <profile>.md` are the release path, one card for the two seeded file sets DEFINITION_WRITERS names: run by a person the interaction policy lets act as S5, each copies the instance's file into the definition's seed, refuses a promotion that would leave the seed's set invalid (the identity set, or the advice set against the declared profiles) or that changes nothing or that lands on a dirty definition, and commits in the definition's repository citing the instance and its revision. The decision paths (s5-decision, advice-decision) decide for an instance; this carries the decision to the definition, once, on the record.

**Absorbs.** `decision-stays-in-one-instance` — INV-005 was proposed, decided and committed in one instance; the next fixture started from the seed without it, and the decision had to be made again — or was forgotten.

**Mechanism.** `src/cli.ts` at `cli:identity promote` (authorized as S5; identical-content and dirty-definition refusals; trial validation of the seed set; authorizeWrite s5-authority; git commit in the definition), `cli:advice promote` (the same, for advice/<profile>.md: a declared profile, identical-content and dirty-definition refusals, trial validation of the advice set against the declared profiles)

**Channels.** consumes `the instance's regulator/identity/<file> or regulator/advice/<profile>.md`, `the definition's identity/ and advice/ seeds`, `the interaction policy's people` · emits `a commit in the definition's repository`

**Scope.** subjects identity, advice · resources <definition>/identity/, <definition>/advice/

**Cost.** One commit in the definition per promotion; no model calls.

**May.**
- write one seed file under S5 authority
- commit it in the definition citing the instance

**May not.**
- promote without an S5-capable person
- leave the seed's identity or advice set invalid
- promote an advice file for a profile the definition does not declare
- promote into a dirty definition
- be called by a tool

**Evidence.** `src/cli.test.ts`

**Limitations.**
- It promotes a file, not a decision: the obligation that decided it stays in the instance's ledger, and the commit message names the instance and its revision, not the obligation id. Linking the two across repositories is a convention, not a check.
- The definition's own review (a pull request, `pnpm check`) is outside this command: the commit lands on whatever branch the definition has checked out.
- Instances initialized before the promotion keep their own copy; nothing pushes the new seed into them (an instance's identity and advice are its own, proposed against and decided there). An instance initialized before advice was a file set carries no regulator/advice/ at all, and `doctor` says so; seeding it is a person's step (docs/DEBT.md row 44, with #53).

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `none` — A CLI command a person runs; the arm without it is a person copying a file by hand, which was docs/DEBT.md row 24.

**Retirement condition.** Retire when the definition is versioned and released (a package version per promotion) and the promotion is a pull request the release path already requires.


## Identity-untouched check (the instance's harness-owned files)

`reg.audit.identity-untouched-check.v1` · S3* · deterministic-gate · active · since 0.1.0

**Purpose.** INV-001 as a deterministic host check at closeout: diff the unit's branch against its base under every protected prefix — the instance's harness-owned directories (regulator/identity/ and regulator/advice/, derived from DEFINITION_WRITERS' instance paths, so the set is the gate's), the manifest's protected prefixes and whatever the project's conventions protect — with the orchestrator's own runner. Any change, committed or not, by any route the write gate and the bash watch did not see, is failing command-class evidence bound to the revision, and the unit does not close. The invariant is enforced in prose and in code, and the check is named by the workload's unit types.

**Absorbs.** `committed-around-the-gate` — A unit edits a protected file and commits in one shell command: the working tree is restored by the bash watch, the commit survives, git status is clean, and reintegration carries the change into the base.

**Mechanism.** `../checks/src/verify.ts` at `loop:runHostChecks` (identity-untouched), `loop:auditUnit` (before reintegration)

**Channels.** consumes `worktree branch vs base`, `protected prefixes (DEFINITION_WRITERS' instance paths + manifest + conventions)` · emits `evidence record (audit log)`, `audit-finding → S3 on fail (via the closeout gate)`

**Scope.** subjects unit, revision · resources regulator/identity/, regulator/advice/, vendor/, worktree

**Cost.** One `git diff --name-only` per closeout; no model calls.

**May.**
- fail the closeout of a unit whose branch changed a protected prefix

**May not.**
- revert the change (a person or a repair attempt does)
- decide what the unit does next (the recovery router does)
- check a prefix DEFINITION_WRITERS, the manifest or the conventions do not declare

**Evidence.** `../checks/src/verify.test.ts`, `src/controller.test.ts`

**Limitations.**
- Its name says identity; it protects every harness-owned directory of the instance (identity and advice), and the check name a workload declares stays `identity-untouched` so no definition has to change for the advice set to be covered.
- It reads the branch at closeout: a protected change is caught after the attempt, not before the commit. Prevention is the write gate's; this is the evidence that the gate was bypassed.
- The base is the branch the unit was created from; a unit whose base moved under it is compared against the base's current tip, so a protected change made on the base by a person is not the unit's finding.
- It binds to the command-class criterion by class, like every host check (docs/DEBT.md row 2); a contract with no command-class expectation records the failure as evidence and the verdict still fails on contradiction only if the report cited a command run.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `check:identity-untouched` — The drift suite's no-identity-check arm: the check is dropped from every unit type's list; the write gate and the bash watch still run in a live session.

**Retirement condition.** No protected path changes on any unit branch across three model versions and the drift suite with the check off — the session gates alone hold the line — measured by the boundary grader.


## Identity write gate

`reg.authority.identity-write-gate.v1` · S5 · deterministic-gate · active · since 0.1.0

**Purpose.** Refuse every write or edit that would touch the instance's harness-owned directories (regulator/identity/ and regulator/advice/, derived from DEFINITION_WRITERS' instance paths), the committed S5 artifacts, the project's protected paths, or any of their parents — through any spelling Pi expands, any traversal, and any filesystem alias (symbolic link, hard link, non-directory parent) — and execute exactly the normalized path that was checked. For bash, which no hook can sandbox, snapshot the protected files before the command and restore them after: a change is reverted from the snapshot, reported in the tool result, and recorded as an audit finding under INV-001.

**Absorbs.** `identity-mutation` — The unit edits the invariant that forbids editing invariants — directly, through a symlink named notes.md, or with a heredoc in bash — and the harness's own definition of itself is now whatever the last unit wanted.

**Mechanism.** `../regulator-pi/src/authority.ts` at `host:tool_call` (write, edit: prepareWritePath), `host:tool_call` (bash: snapshot), `host:tool_result` (bash: restore and report)

**Channels.** consumes `tool_call`, `tool_result`, `project conventions (protected paths)`, `regulator/identity/`, `regulator/advice/` · emits `audit-finding → S3 (INV-001, bash restored a protected path)`

**Scope.** subjects path, tool call · resources regulator/identity/, regulator/advice/, vsm/*, vendor/

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

**Evidence.** `../core/src/authority.test.ts`, `../regulator-pi/src/authority.test.ts`, `../regulator-pi/src/write-gate.test.ts`

**Limitations.**
- A tool-call hook protects calls routed through the hook. It does not sandbox the process: a shell command that commits a protected change, pushes it, or edits a copy of the repository elsewhere is outside it. The bash watch restores the working tree only; a commit made by the same command keeps the change in history, and reintegration would carry it.
- The snapshot-and-restore is not atomic: a command that reads a protected file it has just modified sees the modification before the restore.
- The alias walk is a preflight against a stable filesystem; a link created between the check and the write (TOCTOU) is not seen. Real isolation is the operating system's or a container's.
- Protected paths are the harness-owned directories DEFINITION_WRITERS names (identity, advice), the S5 artifacts and what the project's conventions declare (vendor/); a path the project protects by convention nobody declared is not protected.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `extension:authority` — Shares the authority extension with the canary watch and proposal intake. Without it the closeout check (identity-untouched) still refuses the change, at the cost of an attempt.

**Retirement condition.** No unit edits an identity file across three model versions and the drift suite with the gate off and the closeout check on, and the attempt cost of catching it late is judged acceptable.


## Inherited tests check

`reg.audit.inherited-tests-check.v1` · S3* · deterministic-gate · active · since 0.1.0

**Purpose.** The suite that judges a unit is the one it inherited: the test files and package.json at the branch point (the merge base of the unit's branch and the base), not whatever the base has become since — a change that landed after the branch is the post-merge check's business. At closeout the host stages that suite over the unit's committed tree and runs it, and runs the same suite against the branch point's own tree: a test that fails on both is the project's known issue, one that passed there and fails now is the unit's regression. It also compares each inherited test file at HEAD with the branch point by test and assertion lines: a file deleted or shrunk on the branch is a failing check. A unit may add cases under test/; it may not weaken the cases that were there, and its own run_tests says nothing about them. A contract exempts, by an expectation carrying an inherited-tests check, the files whose expectations it changes on purpose.

**Absorbs.** `self-weakened-verification` — The unit cannot make the failing test pass, so it makes the test stop failing: an assertion rewritten to the current output, a case deleted, a file removed. Its report cites run_tests passing, which is true of the suite it left behind, and the closeout that trusts that run closes a defect as fixed.

**Mechanism.** `../checks/src/verify.ts` at `loop:runHostChecks` (inherited-tests: git merge-base, then git ls-tree and git show at the branch point, two staged test runs, per-file line counts), `loop:auditUnit` (the base branch from the repository; exemptions from the contract's expectations)

**Channels.** consumes `the base ref and its test/ tree`, `the unit's committed tree`, `expectations carrying an inherited-tests check (exemptions)` · emits `evidence record (class test; bound to the carrying criterion when the contract has one, else to every test criterion)`

**Scope.** subjects evidence, unit · resources the unit's worktree, two temporary stage directories

**Cost.** Two extra runs of the project's test suite per closeout (the inherited suite against the branch point, and against the unit), plus one git show per inherited test file. For a suite that takes minutes this doubles the closeout; the branch-point run is the same for every unit off the same revision and is not cached.

**May.**
- run the base's suite against the unit's tree
- fail the test-class criteria
- refuse a branch that deleted or shrank an inherited test file

**May not.**
- run a suite the base did not have
- judge a test file the contract exempted
- read the unit's report
- edit anything in the worktree

**Evidence.** `../checks/src/verify.test.ts`, `src/evals.test.ts`, `src/instance.test.ts`

**Limitations.**
- The shrink half counts test and assertion lines; a kept assertion whose expected value was changed to the current output is not a shrink, and it is a regression only if the base's copy of that test passed. A test weakened inside a file the contract exempted is not seen at all.
- The base's package.json is staged with the base's tests, so a unit that legitimately adds a test dependency or changes the test script fails until the contract exempts package.json or the base takes the change first.
- Only test/ is inherited: a project whose tests live elsewhere (a src/**/*.test.js layout) inherits nothing and the check passes vacuously, with an observation saying so.
- Regressions are matched by test name; two tests with the same name are one, and a renamed test that fails looks like a new failure of a test the base never had.

**Ownership.** regulator-maintainers · introduced 2026-09-24 · review by 2026-12-01

**Ablation.** `check:inherited-tests` — Drop the check from the unit types' lists; the drift suite's no-inherited-tests arm is the treatment without it, and the self-certifier's committed report shows the unit closing green under that arm.

**Retirement condition.** The suiteWeakened grader stays at zero across three model versions and the drift suite with the check off: no unit under this definition edits an inherited test to make it pass.


## Instance manifest (regulator init)

`reg.identity.instance-manifest.v1` · S5 · deterministic-gate · active · since 0.1.0

**Purpose.** Install the definition into a repository as a declaration. `regulator init` refuses a dirty tree, a second init and a definition that fails its own check; it seeds the identity, ignores `.regulator/`, records canaries from a committed `.env`, commits the identity on the base branch, and writes `.regulator/instance.json`: which definition, at which harness revision, with how many regulators, under which Pi, initialized when and by whom, and the layout a person declared — the prefixes a unit may write under and the prefixes protected beyond the identity and the conventions. The profile grant and the closeout checks read the manifest; nothing reads project files to learn about the harness.

**Absorbs.** `layout-assumed` — Everything that worked on the fixture assumed `src/` and `test/` and `vendor/`; installed into a repository with `lib/`, the first unit could not write anything and the closeout protected nothing, and nobody had written down what the harness believed about the project.

**Mechanism.** `src/instance.ts` at `cli:init` (initInstance: refusals; identity seed; manifest written and validated; commit), `cli:doctor` (readManifest, schema-validated; drift from the definition revision), `host:session_start` (profiles: declared writable prefixes replace the profile's, never widen a read-only one), `loop:auditUnit` (declared protected prefixes and writable prefixes for identity-untouched and glossary-lint)

**Channels.** consumes `a git repository`, `the definition (registry, identity seed, package pin)`, `a person's declaration` · emits `.regulator/instance.json`, `a commit on the base branch (identity, .gitignore)`, `.regulator/canaries`

**Scope.** subjects identity, execution · resources .regulator/instance.json, regulator/identity/, .gitignore

**Cost.** One commit at init; one file read per session start and per closeout.

**May.**
- seed the identity and commit it
- record what a person declared about the layout
- refuse an init the definition or the tree does not allow

**May not.**
- create a repository
- re-init an instance (an upgrade is a person's, per OPERATING.md)
- read project settings, context files or extensions
- widen a read-only profile

**Evidence.** `src/instance.test.ts`, `src/cli.test.ts`

**Limitations.**
- The declaration is trusted as written: a person who declares `/` writable has granted everything; init checks the shape of a prefix, not its wisdom.
- The manifest records the definition's revision at init and `doctor` reports drift from it, but nothing migrates an instance to a newer definition: the upgrade path is a person reading OPERATING.md, and the manifest is not rewritten.
- Only `write` and `edit` honour the declared prefixes in the session; the shell is granted un-gated by path, as before (docs/DEBT.md row 8).

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `none` — Without init there is no instance; the profile's own prefixes and the discovered conventions are the arm without a declaration, which is what an instance had before `init` declared one.

**Retirement condition.** Never while the harness installs into repositories it did not create; the manifest is how it knows what it was told.


## Intelligence intake

`reg.intelligence.intelligence-intake.v1` · S4 · typed-tool · active · since 0.1.0

**Purpose.** Give a research unit exactly one way to say what it found out about the environment: report_intelligence, a typed tool that records an intelligence-signal (S4 → S3) in the regulatory log — claim, observation, evidence, confidence, recency, expiry, affected units — with the unit, revision and time as provenance the model does not supply. It changes nothing: no unit, no policy, no file. A research unit runs like any unit — its own contract, budget, model route and profile, dispatched by S3 — so intelligence has a source, a cost and a boundary.

**Absorbs.** `intelligence-as-authority` — A research finding is written straight into the plan, the code or the policy: the advisory that was true last month rewrites working code this month, and nobody can say who decided.

**Mechanism.** `../regulator-pi/src/intelligence.ts` at `tool:report_intelligence` (execute)

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

**Evidence.** `../regulator-pi/src/intelligence.test.ts`, `src/controller.test.ts`

**Limitations.**
- The tool trusts the profile grant to keep it in research units: an implement unit given the tool would be recorded as S4. The intelligence profile is what puts the tool in a session's surface; nothing in the tool checks the unit type.
- Evidence refs are stamped with the revision they were read at, but a ref to something outside the repository (an advisory URL, a registry version) is a claim the closeout gate cannot verify; only file refs are checked at HEAD.
- Expiry is the unit's estimate; the router notes expired intelligence and nothing re-raises a research obligation when a finding an active unit relied on goes stale.
- One question per contract by convention, not by mechanism: a research unit may call the tool as often as it likes within its budget.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `extension:intelligence` — A live arm without the intelligence extension has no research unit that can report; the router has nothing to hold units on.

**Retirement condition.** Retire when S4 has a second intake (a scheduled scan) and this tool's share of intelligence signals falls below what a person would read.


## Interaction contract (ask_human)

`reg.algedonic.interaction-contract.v1` · S5 · typed-tool · active · since 0.1.0

**Purpose.** Give a unit one typed way to interrupt a person, `ask_human`, under an interaction kind whose contract is fixed in the protocol: a recap offers decisions for correction and continues; choice, clarification and uat wait; consent asks authorization for an irreversible action and nothing but a yes is a yes. Every call opens an obligation owed to a person before anything is asked, records the request and its outcome (answered, timed out, cancelled, unavailable) beside it, and — with a person present — asks through Pi's dialogs with the policy's timeout for the kind. An answer given in the dialog is recorded as that person's disposition on the spot; consent needs a stated action, choice needs options, and a blocking question past the policy's attention budget is refused. The algedonic channel of VSM: from the unit straight to the person, bypassing the loop, typed.

**Absorbs.** `silence-as-consent` — A unit asks whether it may force-push, nobody is there, and it proceeds because the prompt said to 'use judgment' — or it asks five times per attempt until the person stops reading. The question and the non-answer were never a record anyone could act on.

**Mechanism.** `../regulator-pi/src/algedonic.ts` at `tool:ask_human` (execute: AskHumanInputSchema, CONTINUES_WITHOUT_ANSWER, attention budget, ledger.openObligation / requestInteraction / answerInteraction / resolve; ctx.ui.confirm / select / input with the policy's timeout)

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

**Evidence.** `../regulator-pi/src/algedonic.test.ts`, `../core/src/interaction.test.ts`

**Limitations.**
- The dialog answer is attributed to the OS user of the session (or the `person` option), not to an authenticated identity; in a session run by hand that is the person at the keyboard, which is what the record says.
- Whether an action is irreversible is the model's to notice: the tool contracts what consent means, and the profile advice says when to ask; nothing derives 'this needs consent' from the tool's effects (an effect-derived consent check is a later lesson).
- A recap is owed to a person and never delivered by this tool beyond the outbox; a person who never reads the outbox never corrects anything, which is the recap's contract — the work was reversible.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `extension:algedonic` — Shares the algedonic extension with the pause gate: the tool and the gate ablate together. Without them a unit proceeds on its own judgment, which the drift suite's control arm shows.

**Retirement condition.** Never for consent: an irreversible action without a yes is the failure class itself. The recap kind may retire when units stop offering decisions nobody reads.


## Operational memory store

`reg.control.memory-store.v1` · S3 · typed-tool · active · since 0.1.0

**Purpose.** Give units one typed way to record what they learn about the environment — remember — into an append-only store separate from identity and from evidence. Every entry carries host-stamped provenance (unit, revision, time) and a required review-by date within the store's limit, after which it is expired: shown by the read model, rendered to no unit. A retraction is an appended event by a named person. Nothing here can reach an identity file (INV-004).

**Absorbs.** `memory-becomes-policy` — A note that tests need FOO=1 is written into AGENTS.md as a temporary reminder; a year later it is an undocumented rule nobody can date, source or retire.

**Mechanism.** `../regulator-pi/src/identity.ts` at `tool:remember` (execute; MemoryStore.record bounds the expiry)

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

**Evidence.** `../regulator-pi/src/identity.test.ts`, `../core/src/identity.test.ts`

**Limitations.**
- A fact is text: nothing checks that it is true, current or about the environment rather than a preference. Expiry bounds how long a wrong fact lives; review is a person's.
- A fact is scoped to unit types only by the writer's claim (`remember`'s `scope`), and an unscoped fact is rendered to every unit of the instance; a large store still crowds the prompt before the 90-day limit retires anything.
- Retraction is by a person the interaction policy names, checked before the write (disposition-authority); the name is asserted, not authenticated.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `extension:identity` — Shares the identity extension with the identity context; the drift suite's control arm runs without it, and the memoryRules grader counts what units write into prose instead.

**Retirement condition.** The memoryRules grader stays at zero across three model versions and the drift suite with the tool off: units no longer write rules into prose when they have nowhere else to put a fact.


## Model router

`reg.control.model-router.v1` · S3 · deterministic-gate · active · since 0.1.0

**Purpose.** Run each unit type on the model the policy routes it to, and on a provider failure move to the next declared fallback in a fresh session on the same attempt. Nothing outside the route is ever tried, every model an attempt ran on is in its one ledger, and a halt by the budget guard is not a failure to fail over from.

**Absorbs.** `single-model-dependence` — A harness whose only model is rate-limited, deprecated or down has zero regulatory variety: every unit stops, and nothing records why.

**Mechanism.** `../regulator-pi/src/dispatcher.ts` at `host:dispatcher` (piDispatcher: model choice, failover; attemptEnd: halt vs provider failure, from the ledger), `host:model_select` (ledger)

**Channels.** consumes `policy (models)`, `model availability (ModelRuntime)`, `budget ledger (exhausted)` · emits `budget ledger models[]`

**Scope.** subjects unit type · resources model, provider

**Cost.** One availability lookup per dispatch; a failover repeats the unit's prompt on the fallback model, so a failed attempt can cost twice.

**May.**
- choose among the route's models by availability
- fail over to the next declared model after a provider error

**May not.**
- use a model the route does not name
- upgrade or downgrade on judgement of task difficulty
- change the route
- fail over an attempt the budget guard halted

**Evidence.** `../core/src/policy.test.ts`, `../regulator-pi/src/dispatcher.test.ts`

**Limitations.**
- Failover starts a fresh session: the fallback model does not see what the primary did, only the contract. The attempt's ledger is resumed, so the primary's spend counts against the same ceiling and the fallback has less to work with.
- Availability means Pi's registry knows the model and an API key is configured, not that the provider still serves it or the account can pay: a retired model (google/gemini-2.5-flash, 2026-09-29) or an account without credits fails on the first call and costs one session; nothing checks the route against the provider before dispatch.
- Failover with a model is exercised only live (the lesson's drill); the headless test covers the open-and-bind path and the halt-versus-failure decision, not a provider failing mid-route.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `policy:models.fallback` — An empty fallback list is the ablation; the harness does not throw policy switches, and failover needs a live dispatcher.

**Retirement condition.** No primary-model failure in a quarter of live runs, or a provider-side retry that makes the fallback redundant.


## Obligation router

`reg.control.obligation-router.v1` · S3 · deterministic-gate · active · since 0.1.0

**Purpose.** Route every message the instance records — findings, proposals, coordination and operational signals, uncertainty, intelligence, escalations — under the versioned routing policy: at or above the policy's line for its kind it opens an obligation for the named consumer (S3, S5 or a person) with the router's effective severity; below it, or with no rule, it is noted with the reason and stays trace. Recovery decisions the loop cannot apply open the obligation the unit waits on, and S3's own decision dispositions what S3 was routed. State is the fold of appended events: open → acknowledged → resolved | escalated | superseded, terminal records never reopen, an escalation always has a successor.

**Absorbs.** `signal-into-a-log` — A recovery decision, a proposal, an escalation or a finding is recorded and then nothing: nobody is named as owing a response, nothing reminds anyone, and the unit either waits forever or is quietly moved on.

**Mechanism.** `src/controller.ts` at `loop:runUnit` (after the session, after the audit, after the report's signals), `loop:closeUnit` (after the audit), `loop:routeUnit` (before and after the recovery decision), `cli:signals route`

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

**Evidence.** `../core/src/obligations.test.ts`, `src/controller.test.ts`

**Limitations.**
- Routing runs at the loop's steps and on `regulator signals route`; a message recorded by a session run by hand waits in the log until one of them. Nothing watches the file. A message with no unit opens an obligation that holds nothing, with one exception: an audit finding with no unit holds every dispatch until S3 dispositions it.
- A consumer is a name in the policy (S3, S5, human). What is owed to a person is delivered to the outbox and reminded by `algedonic-delivery`; what is owed to S3 or S5 is exposed by the read model and the control room and delivered to nobody, because S3 is the loop and S5 is a person reading the definition's proposals — a queue for S5 decisions is not built.
- Effective severity is the message's own except for uncertainty, whose reported impact is mapped through the policy, and for the routing policy's floors: a message whose subject or observation names an invariant or the identity path is raised to the floor's severity. A floor is a pattern; a message that concerns an invariant without naming it is not raised.
- Every disposition on the CLI is checked against the interaction policy's people by `disposition-authority`; the name itself is asserted, not authenticated, and the check does not run for a dialog answer inside a session.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `loop:route-messages` — Routing is a step of the loop; not ablatable by the harness. An arm without it leaves every message unrouted and nothing holds a unit.

**Retirement condition.** Never: an obligation is how a consequential signal stays visible until absorbed. Individual routing rules retire when a message kind is never raised.


## Outbox watcher

`reg.algedonic.outbox-watcher.v1` · S5 · deterministic-gate · active · since 0.1.0

**Purpose.** The process a quiet instance was missing. `regulator watch` ticks on an interval (or once, for CI): delivers what is pending, reminds what is due under the interaction policy, and forwards every outbox line it has not forwarded yet to the channel command the deployment names — mail, chat, a webhook — with the line as the command's last argument, remembering how far it got in a cursor file so a restart forwards nothing twice and a failed forward moves nothing. The outbox stays the record; the channel is the deployment's.

**Absorbs.** `owed-and-nobody-running` — Delivery ran at the loop's steps and on demand; an instance where nothing ran for a week reminded nobody, and an obligation owed to a person sat in a file nobody opened.

**Mechanism.** `src/deliver.ts` at `cli:watch` (watchOutbox tick: deliverPending, remindDue, forward from the cursor; the cursor advances only when every forward succeeded; --once, or the loop)

**Channels.** consumes `the obligation ledger`, `the outbox`, `.regulator/outbox.cursor` · emits `a channel command invocation per line`, `obligation-delivered (via delivery and reminders)`

**Scope.** subjects obligation · resources .regulator/outbox, .regulator/outbox.cursor

**Cost.** One ledger read and one outbox read per tick; one process per forwarded line.

**May.**
- deliver, remind and forward
- keep a cursor

**May not.**
- disposition anything
- remove or rewrite an outbox line
- choose the channel (a person names the command)

**Evidence.** `src/deliver.test.ts`, `src/cli.test.ts`

**Limitations.**
- A process, not a service: nothing restarts it, and an instance whose watcher is not running is that instance again. Supervising it is the deployment's (a systemd unit, a CI schedule).
- The channel command gets a line and an exit code; a channel that accepts the line and loses it downstream is forwarded once and never again. Delivery to a person is still not confirmation that a person read it.
- One watcher per instance and one cursor: two watchers on one outbox forward every line twice.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `none` — An operating process; an instance without it is the instance of every lesson before 15, and the read model still shows what is owed.

**Retirement condition.** Retire when delivery is a hook on the ledger's append (an event-driven channel) rather than a poll over the outbox.


## Pause gate

`reg.algedonic.pause-gate.v1` · S3 · deterministic-gate · active · since 0.1.0

**Purpose.** Make 'work waits for an answer' a mechanism in two places. In the session: once a blocking question (choice, clarification, consent, uat) went unanswered, the `tool_call` gate refuses every tool whose declared effect is not read-only except `report_result`, and `agent_before_settle` records the pause and ends the turn. In the loop: after the session, an open blocking interaction obligation on the unit records the attempt as `paused`, holds the unit as blocked awaiting a person, and the recovery router says nothing about it — no retry, no repair, no attempt spent; `runUnit` refuses re-dispatch through the progression veto until a person answers, and the next attempt carries the answer as its hint.

**Absorbs.** `waiting-in-name-only` — The tool told the model the question had no answer, and the model, with the tools still live, did the thing anyway — or the orchestrator, seeing an attempt with no close, retried the unit and it asked again, and again.

**Mechanism.** `../regulator-pi/src/algedonic.ts` at `host:tool_call` (paused → block unless read-only effect or report_result), `host:agent_before_settle` (regulator:paused entry, continue: false), `loop:runUnit` (open blocking interaction obligation → attempt outcome paused, status blocked; the progression veto refuses a re-dispatch until it is dispositioned), `loop:routeUnit` (no decision while paused)

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

**Evidence.** `../regulator-pi/src/algedonic.test.ts`, `src/controller.test.ts`

**Limitations.**
- The session gate keys on TOOL_EFFECTS by tool name: a tool the effect table does not know is refused (safe), and a read-only tool that lies about its effect runs. The table is the effect declaration; this gate does not inspect what a tool does.
- The pause is per session: a unit dispatched again by hand (`unit dispatch` after a manual `obligation resolve`) starts unpaused, because the obligation is closed; the veto is the only hold across sessions, and it is the obligation's, not this gate's.
- A paused unit holds its lease and its worktree while it waits, and by default nothing expires the wait: a question nobody answers is visible in the read model and the outbox (`algedonic-delivery`), and stays. The interaction policy may declare `waitCeilingMs`; past it the loop routes the unit under the recovery policy's `timeout` cause and releases the lease, but the question stays open with its veto — nothing answers on anyone's behalf, and the worktree is kept for the attempt that follows the answer.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `extension:algedonic` — Shares the algedonic extension with the ask_human tool; the loop's paused attempt is not ablatable. The pause in the session is what stops a model acting on silence.

**Retirement condition.** Never while a question can go unanswered: the gate is the meaning of 'waits'.


## Post-merge check

`reg.audit.post-merge-check.v1` · S3* · deterministic-gate · retired · since 0.1.0

**Purpose.** Retired in 0.1.4 — replaced by the pre-merge trial (reg.audit.pre-merge-trial.v1): the same checks run on a temporary merge commit before anything lands, and a failure refuses the reintegration instead of recording a red base for S3 to decide about. The instance-level obligation this check opened (an audit finding with no unit, holding every dispatch) is no longer produced by the loop; the router and the veto still honour one if something else raises it. Originally: The closeout gate verifies a unit's branch at its HEAD; the base after the merge is a different tree, and two units that change disjoint files can break each other without a conflict. After every reintegration the loop runs the workload's `run_tests` and `run_checks` on the base at the merge commit, appends the results to the audit log as evidence bound to that revision and to the unit that landed it, and — on a failure — records an audit finding with no unit: the router turns it into an obligation on the instance itself, owed to S3 and blocking, and the progression veto holds every dispatch until S3 dispositions it. Nothing is reverted: a revert is a decision, and the record says who made it.

**Absorbs.** `green-branches-red-base` — Unit A renamed an export and fixed its test; unit B, branched earlier, added a test against the old name. Both passed at their own HEAD, the merge had no conflict, and main was red until somebody noticed by hand.

**Mechanism.** `src/controller.ts` at `loop:finishUnit` (verifyBase ran after finishUnit: host checks on the base at the merge commit; evidence; the unit-less finding (retired: the step is gone, the trial runs inside finishUnit)), `loop:runUnit` (progressionVeto: an open blocking obligation with no unit holds every dispatch)

**Channels.** consumes `the base at the merge commit`, `the workload's check list` · emits `evidence (post-merge:<check>)`, `audit-finding with no unit → obligation on the instance`

**Scope.** subjects evidence, execution · resources the base checkout

**Cost.** The project's test command once more per close, on the base.

**May.**
- run the checks on the base
- record evidence and a finding
- hold every dispatch through the veto

**May not.**
- revert the merge
- block the merge (it has happened; this is evidence about it)
- decide the repair

**Evidence.** `src/controller.test.ts`, `src/instance.test.ts`

**Limitations.**
- It ran after the merge, not before: the base was red for the time it took S3 to decide. The pre-merge trial (0.1.4) refuses instead, at the cost of a second worktree per close — which is why this record is retired.
- Only `run_tests` and `run_checks` are run on the base; the branch-relative checks (identity-untouched, export-signature, glossary-lint) have no meaning there.
- The finding is owed to S3 under the routing policy; a routing policy that routes audit findings elsewhere routes this one elsewhere too.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `loop:post-merge` — A step of the close; not ablatable by the harness. The drift suite's sequential tasks share one base and would show a red base as later units' check failures.

**Retirement condition.** Retired in 0.1.4: the pre-merge trial replaced it (docs/DEBT.md row 37). The record stays as history, the way vendor-write-gate does.


## Pre-merge trial

`reg.audit.pre-merge-trial.v1` · S3* · deterministic-gate · active · unreleased

**Purpose.** The closeout gate verifies a unit's branch at its HEAD; the base after the merge is a different tree, and two units that change disjoint files can break each other without a conflict. Before anything lands, the loop merges the unit's branch in a temporary worktree detached at the base's HEAD, runs the workload's `run_tests` and `run_checks` on that merged tree, and appends the results to the audit log as evidence bound to the trial commit and to the unit that would land it. A tree that passes is landed by fast-forward to the very commit that was verified, so what the evidence is bound to is what the base carries. A tree that fails lands nothing: the base is exactly as it was, S2 records a `conflict` coordination signal saying what the merged tree failed, and the unit is blocked with the cause `conflict` — `repair` under the shipped recovery policy, with the failing checks as the hint. `unit finish` by hand runs the same trial with the project's own two checks. Replaces the post-merge check (reg.audit.post-merge-check.v1), which recorded a red base for S3 to decide about; here the base is never red.

**Absorbs.** `semantic-conflict` — Two units pass every check on their own branches, merge without a conflict, and the base fails its suite: a coupling neither could see from its worktree, and the post-merge form of this check found it only after the base carried it.

**Mechanism.** `src/worktree.ts` at `loop:finishUnit` (reintegrate with a trial: the temporary worktree under .regulator/trials/, the merge there, the trial, then merge --ff-only to the trial commit; trialMerge in controller.ts runs the workload's checks and binds the evidence), `cli:unit finish` (the same trial with run_tests and run_checks as the conventions discover them)

**Channels.** consumes `the unit's branch and the base at HEAD`, `the workload's run_tests and run_checks (the unit type's; the project's own from the CLI)` · emits `evidence (pre-merge:*) bound to the trial commit`, `coordination-signal (conflict, blocking) when the merged tree fails`

**Scope.** subjects unit, base · resources .regulator/trials/, .regulator/audit.ndjson, .regulator/signals.ndjson

**Cost.** A second worktree per close (`git worktree add --detach`, removed before the close returns) and the project's test command once more, on the merged tree, before it lands. Measured on the drift fixture with the scripted reference unit, treatment arm, three repetitions: see `measured`. (measured: no measurable difference against the post-merge check it replaced: 862 ms → 836 ms per closed unit (mean of 18 closes each, scripted reference unit, treatment arm, three repetitions, 2026-09-29, one machine). The checks ran once more either way; what the trial adds is a worktree add and remove and a fast-forward, tens of milliseconds, inside the noise.)

**May.**
- refuse a reintegration whose merged tree fails the workload's checks, and say what failed
- land exactly the commit that was verified, by fast-forward
- refuse to land when the base moved between the trial and the landing

**May not.**
- resolve a conflict or repair a failing tree
- revert anything: it lands or it does not
- run the branch-relative checks (identity-untouched, export-signature, glossary-lint, inherited-tests) on a merged tree, where they have no meaning

**Evidence.** `src/worktree.test.ts`, `src/controller.test.ts`, `src/instance.test.ts`, `src/finance.test.ts`

**Limitations.**
- Only `run_tests` and `run_checks` run on the merged tree; a coupling those two do not exercise lands. A workload cannot yet name a trial-only check.
- The trial worktree is the merged tree and nothing else: a project whose checks need installed dependencies has the same gap a unit's worktree has, and the conventions' discovery decides what runs there.
- A base that moves between the trial and the landing is refused (`base-moved`), not re-trialed: the next close tries again from the new base. Inside one loop the lease and the veto make this a person's intervention, not a race.
- An inconclusive trial (no test script discovered) lands, recorded as such; only a failing check refuses.

**Ownership.** regulator-maintainers · introduced 2026-09-29 · review by 2026-12-01

**Ablation.** `loop:pre-merge` — A step of the close; not ablatable by the harness. The drift suite's sequential tasks share one base; without the trial a semantic conflict would land and show as later units' check failures.

**Retirement condition.** Never while two units can share a base: the trial is what makes a clean merge mean something.


## Prediction resolution

`reg.assurance.prediction-resolution.v1` · S3* · deterministic-gate · active · unreleased

**Purpose.** Keep what is expected apart from what was seen and what was decided, and make the expectation resolve. An intelligence signal may carry a `prediction` block (the metric it stakes, built-in or declared; a baseline, a committed report's arm; a direction and a size; a probability in [0, 1] beside the three-valued confidence; the horizons it resolves at, each with the grader value that counts against it). It is routed exactly as any intelligence is and moves nothing. When a unit a live horizon names closes or aborts, the loop reads the named metric with the graders the eval harness uses — over the unit's records, the instance's tree and the workload's declared grader command, never the unit's report — compares it with the baseline and the disconfirming value, and appends a `prediction-resolution` to the regulatory log: confirmed, disconfirmed or inconclusive. A probe horizon resolves from the committed report it names by fingerprint, against the arm's interval. Inconclusive counts against the prediction's precision and never for the edit. A disconfirmed live horizon is a proposal from S3 to S5 to revert or re-decide the advice, routed under the routing policy into an obligation with the prediction's id in its subject; the advice file is not touched. The `harness-edit` proposal is the first thing that bets on a prediction: a typed `requestedChange` with a diagnosis (references to evidence records and signals, with the unit, attempt, revision and trajectory moment they were read at), a change (the diff against one advice file, by profile) and the prediction's id — three records, each a different kind. The schema refuses a payload that claims the kind and lacks a part; `advice accept` refuses one whose diagnosis references do not resolve in the stores or whose prediction names no signal with the block, takes the target from the payload, refuses a --file that disagrees, cites the prediction's id in the disposition, and the live horizon is open from that decision — read from the obligation, never from the rationale.

**Absorbs.** `remedy-adopted-on-its-diagnosis` — A trace that justified a diagnosis is read as evidence that the remedy works: the advice is edited, the edit is adopted on the strength of what was observed before it, and nothing afterwards says whether the metric it was meant to move moved, so a false premise propagates into every later edit (Harness²'s worst regression).

**Mechanism.** `../core/src/predictions.ts` at `loop:resolvePredictions` (after a unit's status becomes closed (closeVerifiedUnit) or aborted (routeUnit): every open live horizon naming the unit's type gets one reading from unitGrader (src/predictions.ts, the eval harness's graders over one unit); probe horizons from committedReports by SHA-256; a disconfirmed live horizon appends a policy-proposal to S5 and routes it), `cli:advice accept` (a harness-edit is read against the stores first (checkHarnessEdit: units, attempts, trajectory moments, evidence at the revision, signals; the prediction carries the block; the profile is declared); the target is the payload's, a disagreeing --file is refused, the disposition cites the prediction)

**Channels.** consumes `intelligence-signal with a prediction block (regulatory log)`, `policy-proposal whose requestedChange is a harness-edit`, `the unit's records, the instance's tree, the workload's declared graders (through graders.ts)`, `committed eval reports (evals/reports/, by fingerprint)`, `the proposal's obligation and its disposition` · emits `prediction-resolution (regulatory log)`, `policy-proposal S3 → S5 on a disconfirmed live horizon, routed into an obligation`, `the prediction's id in an accepted proposal's disposition`

**Scope.** subjects prediction, proposal, advice, unit · resources .regulator/signals.ndjson, .regulator/units/, .regulator/audit.ndjson, evals/reports/

**Cost.** At each close or abort, one fold over the regulatory log and, per open live horizon naming the unit's type, one grader run — a trajectory count is a read of the unit's records, an outcome grader a git diff over the instance, a declared grader the workload's own command. Nothing when no prediction is open. No model calls.

**May.**
- append a prediction-resolution for a unit the horizon names, once per unit
- read a metric with the harness's graders over the stores
- propose to S5 that a disconfirmed advice edit be reverted or re-decided, and route the proposal
- refuse a harness-edit whose parts do not resolve, before anything is written

**May not.**
- read a unit's report as the value of any metric
- revert, write or edit an advice file (an accept path does, after a person decides)
- resolve the obligation it raised
- change a prediction, a horizon or a threshold
- refuse a plain policy-proposal, which carries no prediction and is decided on the person's judgment
- refuse an unprobed harness-edit (the probe rule is slice 3's)

**Evidence.** `../protocol/src/prediction.test.ts`, `../core/src/predictions.test.ts`, `src/controller.test.ts`, `src/cli.test.ts`, `src/status.test.ts`

**Limitations.**
- The probe rule is not here: `advice accept` does not refuse a `harness-edit` whose probe horizon has not resolved, because nothing produces a probe report yet. The probe arm (`EvalArmSchema`'s `advice` override) and the refusal are slice 3 of the accept-path split, after the live report (#46); until then a probe horizon resolves only against a report a person committed and named by its fingerprint.
- A live horizon reads one unit's grader value against a committed report's arm mean, with no interval on the unit's side: one value either reaches the baseline moved by the magnitude or it does not. The probe horizon uses the arm's 95% interval. At three repetitions few intervals separate, so a probe resolves inconclusive more often than a live horizon; inconclusive counts against the prediction either way.
- The next N units are counted by the fold over the regulatory log — the resolutions recorded against the horizon — not by a scan of the execution store or an index, so the log is re-read at every close and abort, linear in its length, as the obligation ledger already is. A unit of a named type that closed before the horizon opened (before the harness-edit was accepted) is not a reading, by design: the edit was not in effect.
- A report's fingerprint is the SHA-256 of its committed file, so an interpretation edited after the fact is a different report and a prediction naming the old fingerprint resolves against nothing; `regulator check` does not warn about a prediction whose named report is absent, the resolution's reason does.
- The outcome graders run over the instance from its first commit, as the eval harness runs them from the fixture commit, so on a long-lived instance `boundaryViolations`, `vocabularyDrift` and `memoryRules` are cumulative, not the closing unit's alone; the trajectory counts and a declared grader are per unit or per run as their graders define them. A metric no grader observes here — another workload's declared metric, a name that is neither — is an inconclusive reading with that reason, never a zero.
- Nothing in this slice produces a prediction: a person appends the signal, or the reflector will. `report_intelligence` does not take the block, and no `regulator intelligence report` command exists (open questions §2). A signal's three-valued `confidence` is still recorded and never calibrated; the instrument record kind that would grade it waits on resolved predictions and a live report.

**Ownership.** regulator-maintainers · introduced 2026-10-26 · review by 2026-12-01

**Ablation.** `loop:resolve-predictions` — A step of the loop after a unit's status is written; not ablatable by the harness. An arm without it leaves every prediction open forever and no decision ever learns whether the metric it staked moved.

**Retirement condition.** Never while a proposal may carry a prediction: a bet nothing resolves is a sentence in a rationale, which is the failure this record exists to make unrepresentable. The three-valued rule may change when a live report says how often a probe at the shipped repetitions resolves inconclusive.


## Profile write grant

`reg.control.profile-write-grant.v1` · S3 · deterministic-gate · active · since 0.1.0

**Purpose.** Limit direct write and edit calls to the paths the active capability profile grants, and limit the active tool surface to the profile's tools. The grant only: what a unit of the profile is told is the advice file's, rendered by advice-context from the instance's copy, not this card's.

**Absorbs.** `ungranted-capability-use` — Work of one kind (research, implementation) reaching tools or paths it was never granted, because a persona prompt is the only thing saying otherwise.

**Mechanism.** `../regulator-pi/src/profiles.ts` at `host:session_start`, `host:tool_call`

**May.**
- set the active tool set when a profile is applied
- block a write or edit outside the profile's writable paths

**May not.**
- select a profile without a user command or CLI flag
- block shell commands
- grant a tool the host does not have

**Evidence.** `../regulator-pi/src/profiles.test.ts`

**Limitations.**
- Positive grant covers write and edit only; the implement profile grants bash, which is not path-gated.
- Read-only means declared read-only effects (effects.ts); a tool with an undeclared effect is refused from read-only profiles, not audited.
- Lexical path check only, as for the vendor write gate.

**Ownership.** regulator-maintainers · introduced 2026-09-21 · review by 2026-12-01

**Ablation.** `extension:profiles` — A live arm without the profiles extension lets a unit write anywhere its tools reach; the closeout checks catch protected prefixes only, and the boundary grader counts the rest.

**Retirement condition.** The boundary grader stays at zero across three model versions and the drift suite with the grant off: units write under src/ and test/ because the contract says so.


## Progression veto

`reg.control.progression-veto.v1` · S3 · deterministic-gate · active · since 0.1.0

**Purpose.** Refuse to dispatch or close a unit while an obligation at or above the routing policy's blocking line is open on it, whoever it is owed to. The S3–S4 homeostat, mechanised: intelligence that names a unit holds that unit until S3 or a person dispositions the obligation it raised — it never replans, never edits, never applies itself. A clarification a person answered reaches the next attempt as the hint.

**Absorbs.** `last-signal-wins` — An advisory arrives against a commitment and whichever came last decides: the unit is dispatched anyway because nothing stood in the loop's path, or the advisory rewrites working code because a prompt said it should.

**Mechanism.** `src/controller.ts` at `loop:runUnit` (before the lease is taken), `loop:closeUnit` (before the re-audit)

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

**Evidence.** `src/controller.test.ts`, `../core/src/obligations.test.ts`

**Limitations.**
- Checked at dispatch and at close only. A unit already running when the obligation opens finishes its attempt; the veto meets it at the next step.
- Blocking is a function of severity and the policy's line; the obligation's consumer is not consulted. An S5 proposal at blocking severity on a unit would hold the unit, which may or may not be wanted — the routing policy decides by setting the line.
- The veto names the unit id. Intelligence that affects a unit not yet contracted holds it once it exists; intelligence that affects a file, a dependency or a workload has no unit to hold and is an obligation for S3 to read.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `loop:progression-veto` — The veto is the loop's check on open obligations at dispatch and close; not ablatable by the harness.

**Retirement condition.** Never: a blocking obligation that does not block is a note.


## Project trust rule

`reg.authority.project-trust-rule.v1` · S5 · deterministic-gate · active · since 0.1.0

**Purpose.** Load into a unit's session the extensions the definition declares and nothing the project supplies. The SDK's resource loader discovers a project's own .pi/extensions, skills, prompt templates and themes from the working directory without asking — Pi's project_trust event is the CLI's, not the loader's — so the dispatcher builds every session with a loader that turns project resources off and filters the extensions it finds to the definition's list, recording what it refused. The CLI path answers project_trust with 'no' as well. A unit's project is data the unit works on, never a source of control for the harness.

**Absorbs.** `trust-boundary-crossing` — The target repository ships .pi/extensions/helpful.ts, which registers a tool that widens the surface or rewrites results; the harness loads it because the directory looked like a project.

**Mechanism.** `../regulator-pi/src/dispatcher.ts` at `host:dispatcher` (definitionResourceLoader: extensionsOverride, no project skills/prompts/themes), `host:project_trust` (authority.ts, CLI sessions)

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

**Evidence.** `../regulator-pi/src/authority.test.ts`, `../regulator-pi/src/dispatcher.test.ts`

**Limitations.**
- Trust is an input-loading guard. It keeps a project's own extensions, skills, prompt templates and themes out of the harness; it does nothing about instructions in the project's files, comments, test output or documentation — those are the injection drill, and the answer to them is that authority lives in gates the content cannot reach.
- The loader takes no context files from the worktree (noContextFiles) and the session runs on the definition's settings.json held in memory, so neither AGENTS.md nor .pi/settings.json in a target repository reaches a unit's session. What the model reads with its tools is still the project's to write: the trust rule closes loading, not reading.
- The filter is by resolved path against the definition's list; an operator's user/global extensions are refused too, which is the intended reading of 'declared, not assembled' but surprises anyone who expected their own extensions to ride along.
- The project_trust answer covers the CLI path (`pnpm cp9`); a learner who launches pi by hand with trust remembered as yes has trusted the project themselves.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `loop:definition-loader` — The dispatcher's loader would have to load the project's extensions, skills and context files; not ablatable without a code change. The injection fixture is the suite.

**Retirement condition.** Never: a target repository is data. Retire only with a sandbox that makes loading project code harmless.


## Proposal intake

`reg.authority.proposal-intake.v1` · S5 · typed-tool · active · since 0.1.0

**Purpose.** Give a unit a typed way to ask for a change to identity, policy or a protected path — propose_policy_change — that records a policy-proposal message on the proposal channel for S5 and changes nothing: no file, no policy, no grant. The right to ask is mechanically separate from the right to change (INV-002).

**Absorbs.** `proposal-as-policy` — A unit that cannot edit the invariant argues its case in the transcript and then edits the invariant; or a harness that lets a 'proposal' tool apply the change it proposes.

**Mechanism.** `../regulator-pi/src/authority.ts` at `tool:propose_policy_change` (execute)

**Channels.** consumes `tool call (propose_policy_change)` · emits `policy-proposal → S5 (regulatory log)`

**Scope.** subjects proposal · resources .regulator/signals.ndjson

**Cost.** One appended message per proposal; no model calls.

**May.**
- record a proposal with the unit as provenance

**May not.**
- apply the change
- grant authority
- decide the proposal (S5 or a person does, outside the loop)

**Evidence.** `../regulator-pi/src/authority.test.ts`

**Limitations.**
- A proposal is routed into an obligation owed to S5 and decided by a person through `regulator identity accept|reject`, which is the only writer of an identity file; the proposal's requestedChange is text a person turns into a file by hand. What is owed to S5 is not delivered to the outbox (algedonic-delivery delivers what is owed to a person): a person reads the read model for it.
- The proposal's source is S1 by construction; a proposal from S3 or S4 (a router that wants a policy change) has no tool yet.
- Evidence on a proposal is empty: the tool does not let the model attach evidence refs, because a claim about evidence is not evidence.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `extension:authority` — Shares the authority extension with the write gate and the canary watch. Without the tool a unit that wants a rule changed has only the identity gate's refusal.

**Retirement condition.** Retire when proposals arrive by another typed path (an S3 or S4 proposer) and units stop raising them.


## Recovery router

`reg.control.recovery-router.v1` · S3 · deterministic-gate · active · since 0.1.0

**Purpose.** Route every blocked unit: normalize the failure to one cause from the orchestrator's records, S2's signals and the session's observations; take the action the versioned recovery policy names for that cause on its Nth occurrence; record the decision immutably with the policy version; apply what the loop can apply (retry and repair with a hint, abort, escalate as an algedonic signal) and hold the rest for a decision from outside the loop.

**Absorbs.** `naive-retry` — A failed attempt is retried as-is, again and again: a variety amplifier pointed at the wrong target, multiplying cost without adding information, until the budget is gone and nobody can say why.

**Mechanism.** `src/controller.ts` at `loop:routeUnit` (after a blocked outcome), `loop:driveUnit` (the autoloop)

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

**Evidence.** `../core/src/recovery.test.ts`, `src/controller.test.ts`

**Limitations.**
- Classification is a fixed precedence over recorded facts; a failure with two causes is routed by the first the precedence finds. A check-failure whose root cause is environmental is routed as check-failure, because the orchestrator's record wins over the session's observation.
- Remediate, replan, clarify and pause are recorded and the unit waits on an obligation for the consumer the routing policy names; nothing in the loop performs them. A person who resolves the obligation is checked against the interaction policy's people but not authenticated.
- Occurrences are counted per cause per unit, by design: a unit that alternates between two causes never reaches the third action of either rule and is stopped by the attempt ceiling, and the alternation is visible in its decisions and obligations. A policy that wants a global count declares shorter rules.
- Escalation is an algedonic signal in the regulatory log and an obligation owed to a person, delivered to the outbox and reminded under the interaction policy. The outbox is a file: no channel beyond it exists in the lab.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `policy:recovery.rules` — A policy whose every rule is escalate is the ablation: every blocked unit goes to a person. The harness does not throw policy switches.

**Retirement condition.** Never as a mechanism; individual rules retire when a cause is not seen in a quarter of runs.


## Regulator lifecycle

`reg.identity.regulator-lifecycle.v1` · S5 · deterministic-gate · active · since 0.1.0

**Purpose.** Every regulator was added to absorb a failure a particular model produced on a particular day, and models change. Every active record now carries an ablation switch — the arm that turns it off, or `none` with the reason the harness cannot — and a retirement condition, or `regulator check` refuses it. `regulator review --due` lists what is overdue for review by the date each record carries; the read model and the control room's lifecycle view show, per record, the switch, whether a committed eval report covers it, and the condition under which it may go. Retiring a regulator is a recorded decision: the record's status becomes `retired` and it keeps its history.

**Absorbs.** `control-system-that-only-grows` — A workaround for one model's habit, still costing latency and attention on every run three model versions later, because nothing ever asked whether the habit persisted and nobody owned the question.

**Mechanism.** `../core/src/registry.ts` at `check:checkRegistry` (an active record without ablation or retirement is a problem; so is an overdue review date), `cli:review` (--due: reviewDue), `cli:status` (the lifecycle view of the read model, rendered by the control room)

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

**Evidence.** `../core/src/control-plane.test.ts`, `src/cli.test.ts`, `src/registry.test.ts`

**Limitations.**
- A retirement condition is prose; nothing checks that a committed report satisfies it. The lifecycle view shows coverage (an ablation arm exists for the record), not satisfaction; a person reads the report against the condition.
- Review dates are checked on demand, not scheduled: `regulator review --due` runs when someone runs it, and nothing under CI fails on an overdue record (docs/DEBT.md row 32).
- Most switches the registry names are `loop:`, `policy:` or `none`: named honestly, not runnable by the harness. Two of thirty-six records have a runnable ablation arm in the committed suite.
- Implementation and cited-test paths are verified only in a source checkout (a `src/` beside the registry). An installed package ships `dist/` and no sibling packages' sources, so there `checkRegistry` carries the paths as provenance and `doctor` says it did not verify them; the release's `pnpm check` is where they were verified.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `none` — A check on the registry; there is no run it participates in.

**Retirement condition.** Never: the record that decides retirement cannot retire before the last regulator does.


## Reintegration guard

`reg.coordination.reintegration.v1` · S2 · deterministic-gate · active · since 0.1.0

**Purpose.** Merge a unit's branch back into the base only from a clean checkout on the base branch; on conflict, abort, leave the base exactly as found, and hand the conflicting paths to S3 as a coordination signal.

**Absorbs.** `hidden-coupling` — Work done in isolation looks finished until it meets the base; a merge that auto-resolves, or that lands on a dirty checkout, hides the coupling instead of surfacing it.

**Mechanism.** `src/worktree.ts` at `loop:finishUnit`, `cli:unit finish`

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
- The merge itself verifies nothing: the branch was verified at closeout, and the base at the merge commit is verified afterwards by the post-merge check (reg.audit.post-merge-check.v1), so the base is red while S3 decides a failure there.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `none` — The merge is the loop's close step; an arm without it never lands work. Conflict handling is exercised by the coordination drills, not ablated.

**Retirement condition.** Never: reintegration is how domain output reaches the base. The conflict-signal path retires when two units cannot share a base.


## Result report gate

`reg.control.result-report-gate.v1` · S3 · deterministic-gate · active · since 0.1.0

**Purpose.** Close a unit only from a result report that honours the exact contract version: every delegated choice reported, every unresolved decision preserved or surfaced (never settled), required evidence present, fixed-decision deviations referenced. Refuses the report at the tool and again at close; a unit with no report or an invalid one is blocked, not closed.

**Absorbs.** `silent-closure` — A unit declares itself done; the decisions it made under uncertainty, the ones it quietly settled, and the constraints it bent are visible only to whoever reads the whole transcript.

**Mechanism.** `../regulator-pi/src/contract.ts` at `tool:report_result` (execute), `loop:runUnit` (close), `host:session_start` (a loaded contract puts report_result on the active tool surface, whatever the profile lists)

**Channels.** consumes `result report (S1, via report_result)` · emits `operational-signal → S3 (high-consequence emergent decisions, deviations)`

**Scope.** subjects unit, contract · resources execution store

**May.**
- refuse a report with reasons
- block a unit that ends without a valid report
- record emergent decisions and deviations as typed signals for S3

**May not.**
- certify that the work is correct (verification and audit do that)
- resolve an unresolved decision
- decide what to do about a blocked unit (the recovery router does)

**Evidence.** `../regulator-pi/src/contract.test.ts`, `src/controller.test.ts`, `../core/src/contracts.test.ts`

**Limitations.**
- Evidence is checked by class, not by content: a report can cite a test run it did not make. Host-run verification is what makes evidence independent of the report.
- A unit can describe an unresolved decision as 'preserved' while its diff settles it; the gate reads the report, never the diff, by design — catching that is audit's job.
- Every emergent decision, deviation and residual uncertainty in the report becomes a signal the routing policy routes; which of them opens an obligation is the policy's line, so a low-consequence decision is noted as trace, not read by anyone.
- report_result joins the tool surface when the contract loads at session_start; a profile switched by hand mid-session (/profile) resets the surface to the profile's list and drops it until the session restarts. The dispatcher never switches profiles.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `extension:contract` — Shares the contract extension with the contract section; without it a unit has no report_result tool and every attempt ends no-report.

**Retirement condition.** Never: the report is the loop's only typed input from a unit. Its checks (unresolved decisions, delegated choices) retire individually when three model versions never trip them.


## S5 decision path

`reg.authority.s5-decision.v1` · S5 · deterministic-gate · active · since 0.1.0

**Purpose.** The one path that changes an identity file: `regulator identity accept`, run by a named person, on an obligation owed to S5 that a proposal opened. It writes the proposed file under S5 authority (the same authorizeWrite the gate refuses operational callers), refuses a result that leaves the identity set invalid, commits on the base branch citing the obligation, and resolves the obligation as accepted with the commit. `identity reject` resolves it as rejected and changes nothing. INV-002 with a workflow: the right to ask is the proposal tool; the right to change is this, and only this.

**Absorbs.** `proposal-with-no-decider` — A proposal is recorded and owed to S5, and then a person edits the identity file by hand with no link to what was asked, or never does, and the obligation sits open with no way to close it honestly.

**Mechanism.** `src/cli.ts` at `cli:identity accept` (authorizeWrite s5-authority, readIdentity, git commit, ledger.resolve accepted), `cli:identity reject` (ledger.resolve rejected)

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

**Evidence.** `src/cli.test.ts`

**Limitations.**
- Who may act as S5 is the interaction policy's `actAsS5` grant, checked before the write; the name on `--by` is asserted, not authenticated.
- The proposed content is a file the person supplies; nothing derives it from the proposal's requestedChange, and nothing diffs it against what was asked. The person decides that the file is the proposal.
- It changes the instance's identity, not the definition's seed: a decision accepted in one instance does not propagate to the next fixture. Promoting a decision into the definition is a commit to packages/regulator/identity/ by hand.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `none` — A CLI command a person runs; there is no arm in which a person changes identity without it, only the drill that edits a file by hand.

**Retirement condition.** Never: INV-002 names it as the only writer. Retire with the proposal path, not before.


## Span projection (OpenTelemetry GenAI)

`reg.assurance.span-projection.v1` · S3* · type · active · since 0.1.0

**Purpose.** One read of every append-only record an instance keeps — units, attempts, budgets, evidence, verdicts, decisions, effects, obligations, interactions, memory — as OpenTelemetry GenAI spans (`invoke_agent` per attempt, `execute_tool` for checks, effects and deliveries, `chat` for what the budget ledger knows of the model calls), correlated by `vsm.unit.id`, `vsm.attempt`, `vsm.evidence.id`, `vsm.obligation.id`, `vsm.regulator.id` and the policy version, so a tracing backend joins runtime events to registry records without a vendor adapter. Every string attribute passes redaction — the instance's canaries and credential shapes — before it leaves the store, and a span that had something redacted says so. The transcript is never projected.

**Absorbs.** `evidence-nobody-can-join` — Six NDJSON logs and a SQLite store, each honest on its own, and no way to ask which regulator fired on which attempt of which unit without reading them all by hand — or a way that shipped the API key in the tool output.

**Mechanism.** `../core/src/spans.ts` at `cli:spans` (projectSpans: a schema-validated SpanRecord per record; redact on every string attribute), `cli:eval` (reportSpans: one span per eval run)

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

**Evidence.** `../core/src/spans.test.ts`, `src/cli.test.ts`

**Limitations.**
- Token usage is what the budget ledger holds — a total per attempt — so `gen_ai.usage.input_tokens` / `output_tokens` are not populated; the projection carries `vsm.usage.tokens` instead and says so by omission.
- Redaction is a value list and a pattern list: a credential with a shape neither knows passes through. The canaries file is the instance's own declaration, and a secret the instance never declared is not a canary.
- The reporting tools' SQLite store (`.regulator/events.db`) is projected as events on the unit its provenance names; an event with no unit in its provenance is not projected anywhere, and the store is opened read-only on every projection.
- Spans are a projection, not an export: nothing ships them to a collector. `regulator spans --json` writes NDJSON a collector can ingest; the wiring is the deployment's.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `none` — A read model over the stores; switching it off changes no run.

**Retirement condition.** Retire when the stores themselves are written as spans (one event store with the mapping built in) and the projection has nothing to translate.


## Thrash detector

`reg.coordination.thrash-detector.v1` · S2 · deterministic-gate · active · since 0.1.0

**Purpose.** Count write and edit calls per file within a unit and emit a typed coordination signal past a threshold, so oscillation between two fixes becomes visible to S3 instead of burning budget silently.

**Absorbs.** `oscillation` — Fix A breaks B, fix B breaks A; each individual edit is locally reasonable and nothing in the loop notices the pattern.

**Mechanism.** `../regulator-pi/src/coordination.ts` at `host:tool_execution_end`

**Channels.** consumes `tool_execution_end (write, edit)` · emits `coordination-signal (oscillation) → S3`

**Scope.** subjects unit · resources file

**May.**
- record a coordination signal to .regulator/signals.ndjson and notify the user

**May not.**
- block a tool call
- pause or replan the unit (S3 decides: the recovery router)
- decide which of two fixes is right

**Evidence.** `../regulator-pi/src/coordination.test.ts`, `../core/src/coordination.test.ts`

**Limitations.**
- Counts write and edit tool calls only; edits made through bash are invisible to it.
- Memory is per session: a unit resumed in a new session starts counting from zero.
- The threshold is the policy's `coordination.oscillationThreshold` (4 when a policy declares none); it is one number for every file and unit type, not a budget that varies by kind of work.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `extension:coordination` — Shares the coordination extension with the lease and worktree mechanics in the session; the oscillation fixture is the suite. The loop's attempt ceiling still stops a thrashing unit, later.

**Retirement condition.** No oscillation in the oscillation fixture across three model versions with the detector off: the models stop alternating on their own, or the ceiling catches it at acceptable cost.


## Unit lease gate

`reg.coordination.unit-lease.v1` · S2 · deterministic-gate · active · since 0.1.0

**Purpose.** Refuse every tool with a non-read-only effect unless the session's unit holds a live lease on the worktree it runs in, so two units cannot write the same checkout and a dead session cannot hold a claim forever.

**Absorbs.** `write-collision` — Two sessions writing one checkout corrupt each other's work; a session that died mid-unit blocks the resource until someone notices.

**Mechanism.** `../regulator-pi/src/coordination.ts` at `host:session_start`, `host:tool_call`, `host:turn_end`

**Channels.** consumes `lease (.regulator/leases)` · emits nothing

**Scope.** subjects unit, session · resources worktree

**May.**
- refuse any non-read-only tool call while no live lease covers the working directory
- renew the unit's lease at each turn end

**May not.**
- acquire or release a lease (the unit lifecycle does that)
- resolve which unit should hold a contested resource
- block read-only tools

**Evidence.** `../regulator-pi/src/coordination.test.ts`, `../core/src/coordination.test.ts`

**Limitations.**
- Liveness is expiry-only: a live process that stops heartbeating and a dead one look the same until the TTL passes; there is no fencing token yet.
- The lease covers the working directory by path; a tool that writes elsewhere by absolute path is outside the lease — the identity write gate refuses absolute paths, but bash is not path-gated.
- Leases are files on one machine; nothing coordinates across hosts.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `loop:lease` — Leases are taken by the loop; not ablatable by the harness. Two concurrent dispatches of one unit is the coordination test, not an eval arm.

**Retirement condition.** Never while two sessions can target one worktree.


## Unit lifecycle

`reg.control.unit-lifecycle.v1` · S3 · deterministic-gate · active · unreleased

**Purpose.** The unit's six statuses and the twelve transitions the S3 loop takes between them are one closed table, `UNIT_TRANSITIONS` in the protocol, and the execution store refuses a status change that is not a row of it. The table is what the figure of the lifecycle is drawn from and what a unit's history is replayed through: `unitTrajectory` (core) folds the attempt records, the verdicts, the recovery decisions and the obligations through the table in time order, gives each step its why as the records state it — the rule the router applied, the reasons the verdict carries, the obligation the unit waited on — and says when the fold and the record disagree. The control room's Lifecycle view steps through it.

**Absorbs.** `status-written-around-the-loop` — A unit marked closed by a hand edit, a test fixture or a branch of the loop nobody drew; a 'why did this unit stop?' answered by reading six logs by hand; a state diagram on the website the code had already outgrown.

**Mechanism.** `../core/src/execution-store.ts` at `loop:runUnit` (ExecutionStore.setStatus: dispatch, dispatch-refused, attempt-failed, verified; the table is UNIT_TRANSITIONS in ../protocol/src/execution.ts), `loop:closeUnit` (re-verified, re-audit-refused), `loop:routeUnit` (routed-waiting, abort), `loop:finishUnit` (reintegrated, reintegration-refused (closeVerifiedUnit, after the trial)), `cli:status` (unitTrajectory (../core/src/trajectory.ts): the fold on every unit view, which the control room steps through)

**Channels.** consumes `.regulator/units/<id>/unit.json`, `attempts.ndjson`, `decisions.ndjson`, `audit.ndjson (verdicts)`, `signals.ndjson (obligations)` · emits `a refusal on an undeclared status change`, `the unit's trajectory, in the status read model`

**Scope.** subjects execution · resources .regulator/units/

**Cost.** One table lookup per status change; one read of the unit's records per status view, which the read model makes anyway.

**May.**
- refuse a status change the table does not declare
- replay the records through the table
- say that the replay and the record disagree

**May not.**
- write a status
- infer a status from the repository or the transcript
- state a why the records do not carry

**Evidence.** `../core/src/contracts.test.ts`, `../core/src/trajectory.test.ts`, `src/status.test.ts`, `src/figures.test.ts`, `../control-room/src/server.test.ts`

**Limitations.**
- The gate is on the pair (from, to), not on the trigger: which row the loop took is read back from the records, not written down with the status. Three rows share blocked → blocked (a resumed dispatch refused, a re-audit refused, a waiting decision) and are told apart by the record beside them.
- The store keeps only the current status, so the history is a reconstruction. Three moves leave no record of their own — reintegrated, reintegration refused, and a dispatch refused before any attempt — and the fold places them at the record that follows (the decision, or the unit record's last write). A status history in the store, one line per transition with its trigger, would make the fold a read; not yet (DEBT row 47).
- The why is what the records say. A record that carries no rationale — an attempt that ended `error`, a verdict with no reasons — gives its step a detail string and nothing more; the fold does not read the transcript to improve on it.
- A status written around the loop is caught only where the fold and the record disagree; a forged history that happens to be a path through the table is not.

**Ownership.** regulator-maintainers · introduced 2026-10-13 · review by 2026-12-01

**Ablation.** `none` — A type and a store gate over the loop's own writes; switching it off changes no run the loop performs, only what a hand edit can do.

**Retirement condition.** Retire when the store writes the transition, with its trigger, instead of the status — the table as the store's own schema, with nothing left to replay.


## Vendor write gate

`reg.authority.vendor-write-gate.v1` · S5 · deterministic-gate · retired · since 0.1.0

**Purpose.** Retired in 0.1.0 — Every arm loads the authority extension (the identity write gate with the filesystem walk and the bash snapshot-and-restore), and the instance manifest's protected prefixes cover vendor/; the lexical gate of lesson 02 lives on only in the course's own lab. Originally: Refuse write and edit calls under vendor/ so that vendored code stays upstream's, whatever the model is asked.

**Absorbs.** `protected-path-mutation` — The smallest diff for a request is often inside a vendored file; a rule stated only in prose holds inconsistently under pressure.

**Mechanism.** `lab/src/cp1-trace.ts (in the Viable Agents course repository; retired here)` at `host:tool_call`

**May.**
- block a write or edit whose normalized path is under vendor/
- record the refusal and its reason in the trace

**May not.**
- block shell commands
- modify any file
- change what counts as protected

**Evidence.** `lab/src/cp1-trace.test.ts (Viable Agents course)`

**Limitations.**
- Lexical path check only: no symlink, hard-link or TOCTOU protection. The identity write gate supersedes it with the filesystem walk when both are loaded; this gate stays as the course's lesson 02 baseline.
- Covers the write and edit tools; bash and custom tools bypass it. The identity write gate adds the bash snapshot-and-restore for protected paths.

**Ownership.** regulator-maintainers · introduced 2026-09-21 · review by 2026-12-01

**Ablation.** `extension:cp1-trace` — The course's first gate; superseded in a live session by the identity write gate's preflight, which the same arm carries. The closeout check catches vendor/ at the revision without either.

**Retirement condition.** Already superseded: retired when the authority extension became the minimum an arm loads, keeping the record as history.


## Work contract gate

`reg.control.work-contract-gate.v1` · S3 · deterministic-gate · active · since 0.1.0

**Purpose.** Refuse to dispatch a unit whose contract cannot be honoured: colliding decision ids, an unresolved decision that must be resolved before execution, a unit type the workload does not declare, or a workload the instance does not run. Dispatch happens only against a recorded, immutable contract version.

**Absorbs.** `implicit-delegation` — A task description hands S1 every decision the planner did not think of; the unit settles them by omission and the choices disappear into the diff.

**Mechanism.** `src/controller.ts` at `loop:runUnit` (before createUnit), `host:session_start` (contract), `cli:unit start` (--type: the contract-less path refuses a unit type whose workload declares requiresContract)

**Channels.** consumes `work contract (S3)`, `workload definition` · emits nothing

**Scope.** subjects unit, contract · resources execution store

**May.**
- refuse dispatch
- record the contract version that governs execution

**May not.**
- write or amend a contract (S3 planning does that; a change is a new version)
- reclassify an unresolved decision as delegated
- grant a unit any regulatory capability

**Evidence.** `src/controller.test.ts`, `../regulator-pi/src/contract.test.ts`

**Limitations.**
- Checks the contract's shape and internal consistency only; it cannot tell whether the objective genuinely requires settling an unresolved decision — that shows up afterwards as an emergent decision in the report.
- Authority references on fixed decisions resolve — an invariant the instance's identity declares, a regulator the registry declares, an obligation the instance holds, or a named person — but a person's name is trusted as given, and whether that person held the authority is not checked (docs/DEBT.md row 20).
- The contract is loaded from a file path the session was given; the lease gate, not this gate, is what keeps another session from running under it.

**Ownership.** regulator-maintainers · introduced 2026-09-22 · review by 2026-12-01

**Ablation.** `loop:check-contract` — The contract check runs before anything is claimed; not ablatable by the harness. An unsound contract with no gate is dispatched as written.

**Retirement condition.** Never: an unsound contract cannot be verified against. Individual checks retire when three model versions of S3 planning never produce the defect.
