# Viability case

Generated from `registry/regulators/*.json` and `registry/pathologies.json` by `regulator docs`. Do not edit by hand.

This is the case for trusting an instance of the reference build: not what the harness can do, but how it is regulated,
where each rule is enforced, what evidence stands behind each regulator, and what nothing absorbs yet. It is the
artifact the course's capstone asks a team to produce for a harness of their own, in the capstone's order: a system
map, a channel table, a mechanism ledger, an enforcement boundary statement, the evidence, the residual uncertainty and
a boundary critique. Five of the seven are rendered from the registry below. The channel table and the boundary
critique are a team's own judgment, so they stand as headed placeholders: a deployment copies this file beside its
instance, completes those two sections there, and regenerates the rest when its definition changes.

[`REGULATORS.md`](registry/REGULATORS.md) is the cards and [`BOUNDARY.md`](BOUNDARY.md) is what the gates do not cover; this
page cites both rather than repeating them. The pathologies behind section 6 are catalogued in
[`docs/PATHOLOGIES.md`](../../docs/PATHOLOGIES.md), rendered from the same rows.

## 1. System map

Where each VSM function lives, and whether it is held by mechanism (a type, a deterministic gate or a typed tool) or by
judgment (a model's judgment or prompt advice). A function held only by judgment is advised, not regulated.

| Function | Mechanism | Judgment |
| --- | --- | --- |
| **S1** — operations: the units that do the work | none: the units are S1, and what regulates them is listed under S2, S3 and S3\* | — |
| **S2** — coordination between units | deterministic-gate: `effect-journal`, `reintegration`, `thrash-detector`, `unit-lease` | — |
| **S3** — operational control: the loop, its contracts, budgets and routing | deterministic-gate: `budget-guard`, `command-runner`, `evidence-preflight`, `failure-observer`, `model-router`, `obligation-router`, `pause-gate`, `profile-write-grant`, `progression-veto`, `recovery-router`, `result-report-gate`, `unit-lifecycle`, `work-contract-gate` · typed-tool: `declared-tool`, `memory-store` | model-judgment: `contract-preserving-compaction` · prompt: `contract-advice` |
| **S3\*** — audit: evidence the unit does not control | type: `span-projection` · deterministic-gate: `behavioral-canary`, `behaviour-check`, `canary-watch`, `closeout-gate`, `doctor`, `eval-harness`, `glossary-lint`, `identity-untouched-check`, `inherited-tests-check`, `pre-merge-trial`, `prediction-resolution` | — |
| **S4** — intelligence: the environment and the future | typed-tool: `intelligence-intake` | — |
| **S5** — identity and policy: who may change what the system is | deterministic-gate: `advice-decision`, `algedonic-delivery`, `definition-check`, `definition-writers`, `disposition-authority`, `identity-promotion`, `identity-write-gate`, `instance-manifest`, `outbox-watcher`, `project-trust-rule`, `regulator-lifecycle`, `s5-decision` · typed-tool: `interaction-contract`, `proposal-intake` | prompt: `advice-context`, `identity-context` |

50 active regulators: 46 mechanism, 4 judgment. 2 retired records stay in the registry as history and appear nowhere below.

## 2. Channel table

*A team's own; not rendered.* The capstone asks for every message that crosses a boundary of the system, with its type,
the authority it carries, its destination, and whether it can mutate policy. The registry holds what each regulator
consumes and emits, not the system's channels, so this table is written by hand.

| Message | Type | Authority | Destination | Mutates policy |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |

## 3. Mechanism ledger

Each regulator, the failure class it absorbs, the level of the mechanism hierarchy it holds that rule at, and where it
bites; the last column counts the limitations its card states, which section 4 reads. The capstone also asks why a rule
is not enforced one level higher; the registry has no field for that, so the card's purpose and limitations are where
the reasoning lives, and a team states it here for its own rules.

| Regulator | Absorbs | Level | Enforced at | Switch | Limitations |
| --- | --- | --- | --- | --- | --- |
| `advice-context` | `uninformed-unit` | prompt | `host:session_start`, `host:before_agent_start` | `extension:profiles` | 4 |
| `advice-decision` | `proposal-with-no-decider` | deterministic-gate | `cli:advice accept`, `cli:advice reject` | `none` | 5 |
| `algedonic-delivery` | `owed-but-unseen` | deterministic-gate | `loop:routeAndDeliver`, `cli:signals route`, `cli:remind` | `loop:deliver-pending` | 3 |
| `behavioral-canary` | `context-degradation` | deterministic-gate | `host:before_agent_start`, `host:message_end` | `extension:identity` | 4 |
| `behaviour-check` | `evidence-by-class` | deterministic-gate | `loop:runHostChecks`, `loop:auditUnit` | `check:export-signature` | 3 |
| `budget-guard` | `runaway-unit` | deterministic-gate | `host:session_start`, `host:turn_end`, `host:tool_call`, `loop:runUnit` | `extension:budget` | 6 |
| `canary-watch` | `secret-exposure` | deterministic-gate | `host:tool_result`, `host:message_end` | `extension:authority` | 3 |
| `closeout-gate` | `self-certified-completion` | deterministic-gate | `loop:auditUnit`, `loop:closeUnit` | `none` | 4 |
| `command-runner` | `trusted-program` | deterministic-gate | `loop:runUnit`, `check:checkDefinition`, `cli:unit dispatch`, `cli:unit drive` | `loop:runner` | 5 |
| `contract-advice` | `uninformed-unit` | prompt | `host:before_agent_start` | `extension:contract` | 2 |
| `contract-preserving-compaction` | `compaction-amnesia` | model-judgment | `host:session_before_compact`, `host:session_compact`, `host:session_compact_failed` | `extension:budget` | 4 |
| `declared-tool` | `undeclared-action` | typed-tool | `tool:declared`, `host:tool_call`, `host:session_start`, `check:checkDefinition` | `extension:declared-tools` | 6 |
| `definition-check` | `assembled-not-declared` | deterministic-gate | `cli:check`, `check:checkDefinition`, `check:checkDefinition`, `check:checkDefinition`, `check:checkDefinition`, `check:checkDefinition` | `none` | 4 |
| `definition-writers` | `assembled-not-declared` | deterministic-gate | `check:checkDefinition`, `cli:check`, `cli:docs` | `none` | 4 |
| `disposition-authority` | `disposition-by-anyone` | deterministic-gate | `cli:answer`, `cli:obligation ack`, `cli:obligation resolve`, `cli:obligation escalate`, `cli:memory retract`, `cli:unit accept`, `cli:identity accept`, `cli:identity reject`, `cli:identity promote` | `policy:interaction.people` | 3 |
| `doctor` | `works-on-my-laptop` | deterministic-gate | `cli:doctor` | `none` | 3 |
| `effect-journal` | `duplicated-effect` | deterministic-gate | `tool:notify_owner`, `host:session_start` | `extension:recovery` | 4 |
| `eval-harness` | `regulation-without-evidence` | deterministic-gate | `cli:eval`, `check:checkDefinition` | `none` | 5 |
| `evidence-preflight` | `claimed-evidence` | deterministic-gate | `host:tool_result`, `host:tool_call` | `extension:evidence` | 3 |
| `failure-observer` | `opaque-failure` | deterministic-gate | `host:tool_execution_end`, `host:agent_end` | `extension:recovery` | 3 |
| `glossary-lint` | `vocabulary-drift` | deterministic-gate | `loop:runHostChecks`, `loop:auditUnit` | `check:glossary-lint` | 3 |
| `identity-context` | `identity-in-context` | prompt | `host:before_agent_start` | `extension:identity` | 3 |
| `identity-promotion` | `decision-stays-in-one-instance` | deterministic-gate | `cli:identity promote`, `cli:advice promote` | `none` | 3 |
| `identity-untouched-check` | `committed-around-the-gate` | deterministic-gate | `loop:runHostChecks`, `loop:auditUnit` | `check:identity-untouched` | 4 |
| `identity-write-gate` | `identity-mutation` | deterministic-gate | `host:tool_call`, `host:tool_call`, `host:tool_result` | `extension:authority` | 4 |
| `inherited-tests-check` | `self-weakened-verification` | deterministic-gate | `loop:runHostChecks`, `loop:auditUnit` | `check:inherited-tests` | 4 |
| `instance-manifest` | `layout-assumed` | deterministic-gate | `cli:init`, `cli:upgrade`, `cli:doctor`, `host:session_start`, `loop:auditUnit` | `none` | 3 |
| `intelligence-intake` | `intelligence-as-authority` | typed-tool | `tool:report_intelligence` | `extension:intelligence` | 4 |
| `interaction-contract` | `silence-as-consent` | typed-tool | `tool:ask_human`, `host:tool_call`, `host:tool_result`, `cli:answer`, `check:checkDefinition` | `extension:algedonic` | 5 |
| `memory-store` | `memory-becomes-policy` | typed-tool | `tool:remember` | `extension:identity` | 3 |
| `model-router` | `single-model-dependence` | deterministic-gate | `host:dispatcher`, `host:model_select` | `policy:models.fallback` | 3 |
| `obligation-router` | `signal-into-a-log` | deterministic-gate | `loop:runUnit`, `loop:closeUnit`, `loop:routeUnit`, `cli:signals route` | `loop:route-messages` | 4 |
| `outbox-watcher` | `owed-and-nobody-running` | deterministic-gate | `cli:watch` | `none` | 3 |
| `pause-gate` | `waiting-in-name-only` | deterministic-gate | `host:tool_call`, `host:agent_before_settle`, `loop:runUnit`, `loop:routeUnit` | `extension:algedonic` | 3 |
| `pre-merge-trial` | `semantic-conflict` | deterministic-gate | `loop:finishUnit`, `cli:unit finish` | `loop:pre-merge` | 4 |
| `prediction-resolution` | `remedy-adopted-on-its-diagnosis` | deterministic-gate | `loop:resolvePredictions`, `cli:advice accept` | `loop:resolve-predictions` | 6 |
| `profile-write-grant` | `ungranted-capability-use` | deterministic-gate | `host:session_start`, `host:tool_call` | `extension:profiles` | 4 |
| `progression-veto` | `last-signal-wins` | deterministic-gate | `loop:runUnit`, `loop:closeUnit` | `loop:progression-veto` | 3 |
| `project-trust-rule` | `trust-boundary-crossing` | deterministic-gate | `host:dispatcher`, `host:project_trust` | `loop:definition-loader` | 4 |
| `proposal-intake` | `proposal-as-policy` | typed-tool | `tool:propose_policy_change` | `extension:authority` | 3 |
| `recovery-router` | `naive-retry` | deterministic-gate | `loop:routeUnit`, `loop:driveUnit` | `policy:recovery.rules` | 4 |
| `regulator-lifecycle` | `control-system-that-only-grows` | deterministic-gate | `check:checkRegistry`, `cli:review`, `cli:status` | `none` | 4 |
| `reintegration` | `hidden-coupling` | deterministic-gate | `loop:finishUnit`, `cli:unit finish` | `none` | 3 |
| `result-report-gate` | `silent-closure` | deterministic-gate | `tool:report_result`, `loop:runUnit`, `host:session_start` | `extension:contract` | 4 |
| `s5-decision` | `proposal-with-no-decider` | deterministic-gate | `cli:identity accept`, `cli:identity reject` | `none` | 3 |
| `span-projection` | `evidence-nobody-can-join` | type | `cli:spans`, `cli:eval` | `none` | 4 |
| `thrash-detector` | `oscillation` | deterministic-gate | `host:tool_execution_end` | `extension:coordination` | 3 |
| `unit-lease` | `write-collision` | deterministic-gate | `host:session_start`, `host:tool_call`, `host:turn_end` | `loop:lease` | 4 |
| `unit-lifecycle` | `status-written-around-the-loop` | deterministic-gate | `loop:runUnit`, `loop:closeUnit`, `loop:routeUnit`, `loop:finishUnit`, `cli:status` | `none` | 4 |
| `work-contract-gate` | `implicit-delegation` | deterministic-gate | `loop:runUnit`, `host:session_start`, `cli:unit start` | `loop:check-contract` | 3 |

### What switches each one off, and when it may go

The ablation switch is the eval arm that runs with the regulator off, and the retirement condition is the evidence under
which it would be removed. A regulator whose switch is `none` cannot be shown to help by ablation; its note says why.

- **Advice context** (`advice-context`). Ablation: `extension:profiles` — Shares the profiles extension with the profile write grant: an arm without it renders no advice and grants nothing by profile either. The drift suite's control arm runs without identity and the host checks, not without profiles; a per-profile advice override on an arm is slice 3 of the accept-path split. Retirement condition: Retire the rendered section when the drift suite shows no conformance loss across three model versions with the section off and the gates on: the grant and the contract carry the unit alone.
- **Advice decision path** (`advice-decision`). Ablation: `none` — A CLI command a person runs; there is no arm in which a person changes advice without it, only the drill that edits a file by hand (which the gate, the bash watch and the closeout refuse for a unit). Retirement condition: Never while advice is a file the instance carries: INV-002 names an accept path as the only writer of a protected file. Retire with the proposal path, not before.
- **Algedonic delivery** (`algedonic-delivery`). Ablation: `loop:deliver-pending` — Delivery is a step of the loop, not an extension: the harness cannot throw this switch without a code change. An arm without it leaves obligations owed to a person in the read model only. Retirement condition: Never while a person is a declared consumer: delivery is the channel to that consumer, not a workaround for a model's behaviour. Retire with the human consumer, not before.
- **Behavioral canary** (`behavioral-canary`). Ablation: `extension:identity` — Shares the identity extension with identity in context and the memory store; the control arm, which renders no identity, has no canary by construction. A treatment arm without the extension loses all three. The live drift runs (#46) are the first place the canary's firing can be read against what the closeout later found. Retirement condition: Across three model versions in the live drift runs, the canary never falls silent before an attempt that the closeout then refuses, or falls silent only after the budget guard or the closeout has already caught the failure: the signal adds no lead time.
- **Behaviour check (export-signature)** (`behaviour-check`). Ablation: `check:export-signature` — The drift suite's no-behaviour-check arm drops the check from every unit type and the signature criterion from the contract: the signature is a fixed decision in prose only. Retirement condition: Never as a mechanism; the export-signature kind retires when no contract in a quarter of runs carries it, and a richer behaviour check (a runtime probe over inputs) has replaced it.
- **Budget guard** (`budget-guard`). Ablation: `extension:budget` — The harness drops the budget extension from a live arm; the loop's attempt ceiling still applies. Not separable from contract-preserving compaction, which the same extension carries. Retirement condition: No attempt in three model versions and the drift suite crosses a ceiling the loop's wall-clock limit would not have caught first, across two supported models.
- **Credential canary watch** (`canary-watch`). Ablation: `extension:authority` — Shares the authority extension with the write gate and proposal intake; a live arm without it loses all three. The injection fixture is the suite that exercises it. Retirement condition: No canary reaches a tool result or the model's text in the injection fixture across three model versions with the watch off.
- **Closeout gate** (`closeout-gate`). Ablation: `none` — The verify step is the S3 loop itself: an arm without closeout is a different orchestrator, not an ablation. The checks it runs are ablated one at a time (identity-untouched, export-signature). Retirement condition: Never: independent verification is INV-003. Individual checks retire under their own conditions.
- **Command runner (a unit that runs a program)** (`command-runner`). Ablation: `loop:runner` — A step of the loop; not ablatable by the harness. Without the runner a command unit type has no way to run. The deliberately wrong program in src/portfolio.test.ts is the test that the closeout, not the runner, judges a program's output: its list is refused by the portfolio's own suite, and nothing read the program to decide that. Retirement condition: Never while a workload declares a unit type whose work is a program: the runner is what makes the declaration mean something, and what gives a program a lease, a budget and a record.
- **Contract advice section** (`contract-advice`). Ablation: `extension:contract` — Shares the contract extension with the result-report gate; dropping the extension removes both the section and the tool, so a live arm without it has no report path at all. Retirement condition: Retire the advice when a contract-aware model needs no rendered section: units under three model versions report every delegated decision without it, with the gate still on.
- **Contract-preserving compaction** (`contract-preserving-compaction`). Ablation: `extension:budget` — Shares the budget extension with the budget guard. A live arm without it compacts under Pi's default and the contract block is not carried. Retirement condition: No compaction in the drift suite loses a fixed decision across three model versions with the block off, measured by the report gate's refusals after a compaction.
- **Declared tool (a workload's own action, with an effect contract)** (`declared-tool`). Ablation: `extension:declared-tools` — Without the extension no declared tool is registered: a unit whose work needs one has no way to act, and nothing is left for the derived consent to guard, since the outputs are outside every write grant. The arm measures absence, not bypass; the bypass arm is a profile that writes under the outputs directly, which the definition check refuses, so it cannot be declared. Retirement condition: Never while a workload declares a tool: the declaration is what the gate derives from, and what gives the action an effect a profile can be judged by.
- **Definition check** (`definition-check`). Ablation: `none` — A check on the definition, run under pnpm check and regulator check, not in a session or the loop: nothing runs without it to compare against. Retirement condition: Never: a declared control plane is checked as a whole or it is assembled.
- **Definition writers (the accept-path split)** (`definition-writers`). Ablation: `none` — A check on the definition and a constant the gates derive from, run under pnpm check and regulator check, not in a session or the loop: nothing runs without it to compare against. Retirement condition: Never: a definition whose writers are not declared is assembled. The declaration row's gap retires when the definition's repository runs under the loop.
- **Disposition authority** (`disposition-authority`). Ablation: `policy:interaction.people` — A people list naming everyone at critical with every grant is the ablation; the harness does not throw policy switches. A scripted run never dispositions anything. Retirement condition: Retire when authentication replaces the name: a deployment that signs dispositions makes the policy's people a projection of its accounts.
- **Doctor (the operating check)** (`doctor`). Ablation: `none` — A check a person or CI runs; it takes part in no unit's run. Retirement condition: Never as a mechanism; individual checks retire when what they check is checked earlier (a Pi pin enforced by the package manager retires the pin check).
- **Effect journal** (`effect-journal`). Ablation: `extension:recovery` — Shares the recovery extension with the failure observer; delivery (algedonic-delivery) uses the same journal from the loop and is not ablated with the extension. Retirement condition: No side-effecting tool is invoked twice for one intention across the recovery drills and three model versions with the journal off — which is to say never, because a restart is not a model behaviour.
- **Eval harness and graders** (`eval-harness`). Ablation: `none` — The harness is the ablation mechanism; an arm without it is no evidence at all. Retirement condition: Never: a control system that cannot measure itself only grows. Individual graders retire when the drift they measure has not appeared in a quarter of live runs.
- **Evidence preflight** (`evidence-preflight`). Ablation: `extension:evidence` — A live arm without the evidence extension reports evidence the session never produced; the closeout gate still catches the claim at the revision, later and at more cost. Retirement condition: Reports under three model versions cite only evidence the session produced, with the preflight off, and the closeout gate's contradicted count stays at zero.
- **Failure observer** (`failure-observer`). Ablation: `extension:recovery` — Shares the recovery extension with the effect journal. Without it the router classifies from the orchestrator's records alone and environment causes are routed as check failures. Retirement condition: The router's decisions in the recovery drills match the observer's causes for three model versions when the observer is off, because the orchestrator's records alone name them.
- **Glossary lint** (`glossary-lint`). Ablation: `check:glossary-lint` — Drop the check from the unit types' lists; the drift suite's `no-glossary-lint` arm is the treatment without it. Retirement condition: The vocabulary graders stay at zero across three model versions and the drift suite with the check off: the rendered glossary alone holds the words.
- **Identity context** (`identity-context`). Ablation: `extension:identity` — Shares the identity extension with the memory tool. The drift suite's control arm is the arm without it (and without the checks); the course's lesson 12 drill 1 is the measurement. Retirement condition: Retire the rendered section when the drift suite shows no conformance loss across three model versions with the section off and the checks on: the gates carry the identity alone.
- **Identity and advice promotion (the release path)** (`identity-promotion`). Ablation: `none` — A CLI command a person runs; the arm without it is a person copying a file by hand, which was docs/DEBT.md row 24. Retirement condition: Retire when the definition is versioned and released (a package version per promotion) and the promotion is a pull request the release path already requires.
- **Identity-untouched check (the instance's harness-owned files)** (`identity-untouched-check`). Ablation: `check:identity-untouched` — The drift suite's no-identity-check arm: the check is dropped from every unit type's list; the write gate and the bash watch still run in a live session. Retirement condition: No protected path changes on any unit branch across three model versions and the drift suite with the check off — the session gates alone hold the line — measured by the boundary grader.
- **Identity write gate** (`identity-write-gate`). Ablation: `extension:authority` — Shares the authority extension with the canary watch and proposal intake. Without it the closeout check (identity-untouched) still refuses the change, at the cost of an attempt. Retirement condition: No unit edits an identity file across three model versions and the drift suite with the gate off and the closeout check on, and the attempt cost of catching it late is judged acceptable.
- **Inherited tests check** (`inherited-tests-check`). Ablation: `check:inherited-tests` — Drop the check from the unit types' lists; the drift suite's no-inherited-tests arm is the treatment without it, and the self-certifier's committed report shows the unit closing green under that arm. Retirement condition: The suiteWeakened grader stays at zero across three model versions and the drift suite with the check off: no unit under this definition edits an inherited test to make it pass.
- **Instance manifest (regulator init)** (`instance-manifest`). Ablation: `none` — Without init there is no instance; the profile's own prefixes and the discovered conventions are the arm without a declaration, which is what an instance had before `init` declared one. Retirement condition: Never while the harness installs into repositories it did not create; the manifest is how it knows what it was told.
- **Intelligence intake** (`intelligence-intake`). Ablation: `extension:intelligence` — A live arm without the intelligence extension has no research unit that can report; the router has nothing to hold units on. Retirement condition: Retire when S4 has a second intake (a scheduled scan) and this tool's share of intelligence signals falls below what a person would read.
- **Interaction contract (ask_human)** (`interaction-contract`). Ablation: `extension:algedonic` — Shares the algedonic extension with the pause gate: the tool and the gate ablate together. Without them a unit proceeds on its own judgment, which the drift suite's control arm shows. Retirement condition: Never for consent: an irreversible action without a yes is the failure class itself. The recap kind may retire when units stop offering decisions nobody reads.
- **Operational memory store** (`memory-store`). Ablation: `extension:identity` — Shares the identity extension with the identity context; the drift suite's control arm runs without it, and the memoryRules grader counts what units write into prose instead. Retirement condition: The memoryRules grader stays at zero across three model versions and the drift suite with the tool off: units no longer write rules into prose when they have nowhere else to put a fact.
- **Model router** (`model-router`). Ablation: `policy:models.fallback` — An empty fallback list is the ablation; the harness does not throw policy switches, and failover needs a live dispatcher. Retirement condition: No primary-model failure in a quarter of live runs, or a provider-side retry that makes the fallback redundant.
- **Obligation router** (`obligation-router`). Ablation: `loop:route-messages` — Routing is a step of the loop; not ablatable by the harness. An arm without it leaves every message unrouted and nothing holds a unit. Retirement condition: Never: an obligation is how a consequential signal stays visible until absorbed. Individual routing rules retire when a message kind is never raised.
- **Outbox watcher** (`outbox-watcher`). Ablation: `none` — An operating process; an instance without it is the instance of every lesson before 15, and the read model still shows what is owed. Retirement condition: Retire when delivery is a hook on the ledger's append (an event-driven channel) rather than a poll over the outbox.
- **Pause gate** (`pause-gate`). Ablation: `extension:algedonic` — Shares the algedonic extension with the ask_human tool; the loop's paused attempt is not ablatable. The pause in the session is what stops a model acting on silence. Retirement condition: Never while a question can go unanswered: the gate is the meaning of 'waits'.
- **Pre-merge trial** (`pre-merge-trial`). Ablation: `loop:pre-merge` — A step of the close; not ablatable by the harness. The drift suite's sequential tasks share one base; without the trial a semantic conflict would land and show as later units' check failures. Retirement condition: Never while two units can share a base: the trial is what makes a clean merge mean something.
- **Prediction resolution** (`prediction-resolution`). Ablation: `loop:resolve-predictions` — A step of the loop after a unit's status is written; not ablatable by the harness. An arm without it leaves every prediction open forever and no decision ever learns whether the metric it staked moved. Retirement condition: Never while a proposal may carry a prediction: a bet nothing resolves is a sentence in a rationale, which is the failure this record exists to make unrepresentable. The three-valued rule may change when a live report says how often a probe at the shipped repetitions resolves inconclusive.
- **Profile write grant** (`profile-write-grant`). Ablation: `extension:profiles` — A live arm without the profiles extension lets a unit write anywhere its tools reach; the closeout checks catch protected prefixes only, and the boundary grader counts the rest. Retirement condition: The boundary grader stays at zero across three model versions and the drift suite with the grant off: units write under src/ and test/ because the contract says so.
- **Progression veto** (`progression-veto`). Ablation: `loop:progression-veto` — The veto is the loop's check on open obligations at dispatch and close; not ablatable by the harness. Retirement condition: Never: a blocking obligation that does not block is a note.
- **Project trust rule** (`project-trust-rule`). Ablation: `loop:definition-loader` — The dispatcher's loader would have to load the project's extensions, skills and context files; not ablatable without a code change. The injection fixture is the suite. Retirement condition: Never: a target repository is data. Retire only with a sandbox that makes loading project code harmless.
- **Proposal intake** (`proposal-intake`). Ablation: `extension:authority` — Shares the authority extension with the write gate and the canary watch. Without the tool a unit that wants a rule changed has only the identity gate's refusal. Retirement condition: Retire when proposals arrive by another typed path (an S3 or S4 proposer) and units stop raising them.
- **Recovery router** (`recovery-router`). Ablation: `policy:recovery.rules` — A policy whose every rule is escalate is the ablation: every blocked unit goes to a person. The harness does not throw policy switches. Retirement condition: Never as a mechanism; individual rules retire when a cause is not seen in a quarter of runs.
- **Regulator lifecycle** (`regulator-lifecycle`). Ablation: `none` — A check on the registry; there is no run it participates in. Retirement condition: Never: the record that decides retirement cannot retire before the last regulator does.
- **Reintegration guard** (`reintegration`). Ablation: `none` — The merge is the loop's close step; an arm without it never lands work. Conflict handling is exercised by the coordination drills, not ablated. Retirement condition: Never: reintegration is how domain output reaches the base. The conflict-signal path retires when two units cannot share a base.
- **Result report gate** (`result-report-gate`). Ablation: `extension:contract` — Shares the contract extension with the contract section; without it a unit has no report_result tool and every attempt ends no-report. Retirement condition: Never: the report is the loop's only typed input from a unit. Its checks (unresolved decisions, delegated choices) retire individually when three model versions never trip them.
- **S5 decision path** (`s5-decision`). Ablation: `none` — A CLI command a person runs; there is no arm in which a person changes identity without it, only the drill that edits a file by hand. Retirement condition: Never: INV-002 names it as the only writer. Retire with the proposal path, not before.
- **Span projection (OpenTelemetry GenAI)** (`span-projection`). Ablation: `none` — A read model over the stores; switching it off changes no run. Retirement condition: Retire when the stores themselves are written as spans (one event store with the mapping built in) and the projection has nothing to translate.
- **Thrash detector** (`thrash-detector`). Ablation: `extension:coordination` — Shares the coordination extension with the lease and worktree mechanics in the session; the oscillation fixture is the suite. The loop's attempt ceiling still stops a thrashing unit, later. Retirement condition: No oscillation in the oscillation fixture across three model versions with the detector off: the models stop alternating on their own, or the ceiling catches it at acceptable cost.
- **Unit lease gate** (`unit-lease`). Ablation: `loop:lease` — Leases are taken by the loop; not ablatable by the harness. Two concurrent dispatches of one unit is the coordination test, not an eval arm. Retirement condition: Never while two sessions can target one worktree.
- **Unit lifecycle** (`unit-lifecycle`). Ablation: `none` — A type and a store gate over the loop's own writes; switching it off changes no run the loop performs, only what a hand edit can do. Retirement condition: Retire when the store writes the transition, with its trigger, instead of the status — the table as the store's own schema, with nothing left to replay.
- **Work contract gate** (`work-contract-gate`). Ablation: `loop:check-contract` — The contract check runs before anything is claimed; not ablatable by the harness. An unsound contract with no gate is dispatched as written. Retirement condition: Never: an unsound contract cannot be verified against. Individual checks retire when three model versions of S3 planning never produce the defect.

## 4. Enforcement boundary

The statement is [`BOUNDARY.md`](BOUNDARY.md), rendered from the same records: for every mechanical regulator, where it is
enforced and the routes around it, with the accept paths of the definition. This case carries the count, not a second
copy: 187 stated limitations across 50 active regulators, of which 46 enforce and 4 advise or judge,
counted per regulator in the ledger's last column. A gate with no stated limitation does not pass `regulator check`, so a
count of zero there is an advice or judgment record, and a limitation that names later work has a row in
[`docs/DEBT.md`](../../docs/DEBT.md).

## 5. Evidence

Two kinds of evidence stand behind the registry. The tests a card cites run under `pnpm check` at every revision and show
the mechanism does what the card says, without a model. The eval harness compares arms over a scenario — control
against treatment, and a treatment with one regulator off against the full treatment — and that is the evidence that a
regulator helps. In the definition, the `drift` suite declares 6 arms, 4 of them ablation arms; the `portfolio-turnover` suite declares 2 arms, 0 of them ablation arms.

**No ablation result is reported here.** The live report over the drift scenario is [#46](https://github.com/MetaCoding-io/regulator/issues/46)'s
work and is not yet committed. The committed reports ran scripted units, so they validate the graders and say nothing
about a model ([`docs/DEBT.md`](../../docs/DEBT.md) row 33). When the live report lands, the ablation column below is where
its per-arm lift belongs; until then the honest entry is that the arm exists and has not been run live.

| Regulator | Tests cited | Last verified revision | Ablation arm |
| --- | --- | --- | --- |
| `advice-context` | `../regulator-pi/src/profiles.test.ts`, `src/profiles.test.ts`, `../core/src/advice.test.ts` | not stated | switch `extension:profiles`; no arm declares it |
| `advice-decision` | `src/cli.test.ts`, `../core/src/advice.test.ts`, `../core/src/predictions.test.ts` | not stated | none |
| `algedonic-delivery` | `src/controller.test.ts`, `src/cli.test.ts`, `../core/src/interaction.test.ts` | not stated | switch `loop:deliver-pending`; no arm declares it |
| `behavioral-canary` | `../regulator-pi/src/identity.test.ts`, `../core/src/canary.test.ts` | not stated | switch `extension:identity`; no arm declares it |
| `behaviour-check` | `../checks/src/verify.test.ts`, `src/evals.test.ts` | not stated | `no-behaviour-check` (drift) |
| `budget-guard` | `../regulator-pi/src/budget.test.ts`, `src/controller.test.ts`, `../core/src/policy.test.ts` | not stated | switch `extension:budget`; no arm declares it |
| `canary-watch` | `../regulator-pi/src/authority.test.ts` | not stated | switch `extension:authority`; no arm declares it |
| `closeout-gate` | `../checks/src/verify.test.ts`, `src/controller.test.ts` | not stated | none |
| `command-runner` | `src/controller.test.ts`, `src/portfolio.test.ts`, `../core/src/definition.test.ts`, `../protocol/src/workload.test.ts` | not stated | switch `loop:runner`; no arm declares it |
| `contract-advice` | `../regulator-pi/src/contract.test.ts` | not stated | switch `extension:contract`; no arm declares it |
| `contract-preserving-compaction` | `../regulator-pi/src/budget.test.ts`, `../core/src/policy.test.ts` | not stated | switch `extension:budget`; no arm declares it |
| `declared-tool` | `../regulator-pi/src/declared-tools.test.ts`, `../regulator-pi/src/enforcement-points.test.ts`, `src/declared-tools.test.ts`, `src/portfolio.test.ts`, `../core/src/consent.test.ts`, `../core/src/definition.test.ts`, `../protocol/src/workload.test.ts` | not stated | switch `extension:declared-tools`; no arm declares it |
| `definition-check` | `../core/src/definition.test.ts`, `src/registry.test.ts` | not stated | none |
| `definition-writers` | `../protocol/src/definition-writers.test.ts`, `../core/src/definition.test.ts`, `../regulator-pi/src/authority.test.ts`, `src/controller.test.ts`, `src/registry.test.ts` | not stated | none |
| `disposition-authority` | `src/cli.test.ts`, `../core/src/interaction.test.ts` | not stated | switch `policy:interaction.people`; no arm declares it |
| `doctor` | `src/instance.test.ts`, `src/cli.test.ts` | not stated | none |
| `effect-journal` | `../regulator-pi/src/recovery.test.ts`, `../core/src/recovery.test.ts` | not stated | switch `extension:recovery`; no arm declares it |
| `eval-harness` | `src/evals.test.ts`, `../core/src/evals.test.ts`, `src/portfolio.test.ts` | not stated | none |
| `evidence-preflight` | `../regulator-pi/src/evidence.test.ts` | not stated | switch `extension:evidence`; no arm declares it |
| `failure-observer` | `../regulator-pi/src/recovery.test.ts`, `../core/src/recovery.test.ts` | not stated | switch `extension:recovery`; no arm declares it |
| `glossary-lint` | `../checks/src/verify.test.ts`, `src/instance.test.ts`, `src/evals.test.ts` | not stated | `no-glossary-lint` (drift) |
| `identity-context` | `../regulator-pi/src/identity.test.ts`, `../core/src/identity.test.ts`, `src/instance.test.ts` | not stated | switch `extension:identity`; no arm declares it |
| `identity-promotion` | `src/cli.test.ts` | not stated | none |
| `identity-untouched-check` | `../checks/src/verify.test.ts`, `src/controller.test.ts` | not stated | `no-identity-check` (drift) |
| `identity-write-gate` | `../core/src/authority.test.ts`, `../regulator-pi/src/authority.test.ts`, `../regulator-pi/src/write-gate.test.ts` | not stated | switch `extension:authority`; no arm declares it |
| `inherited-tests-check` | `../checks/src/verify.test.ts`, `src/evals.test.ts`, `src/instance.test.ts` | not stated | `no-inherited-tests` (drift) |
| `instance-manifest` | `src/instance.test.ts`, `src/cli.test.ts` | not stated | none |
| `intelligence-intake` | `../regulator-pi/src/intelligence.test.ts`, `src/controller.test.ts` | not stated | switch `extension:intelligence`; no arm declares it |
| `interaction-contract` | `../regulator-pi/src/algedonic.test.ts`, `../core/src/interaction.test.ts`, `../regulator-pi/src/authority.test.ts`, `../core/src/consent.test.ts`, `../core/src/definition.test.ts`, `src/cli.test.ts`, `src/finance.test.ts`, `src/portfolio.test.ts`, `../regulator-pi/src/declared-tools.test.ts` | not stated | switch `extension:algedonic`; no arm declares it |
| `memory-store` | `../regulator-pi/src/identity.test.ts`, `../core/src/identity.test.ts` | not stated | switch `extension:identity`; no arm declares it |
| `model-router` | `../core/src/policy.test.ts`, `../regulator-pi/src/dispatcher.test.ts` | not stated | switch `policy:models.fallback`; no arm declares it |
| `obligation-router` | `../core/src/obligations.test.ts`, `src/controller.test.ts` | not stated | switch `loop:route-messages`; no arm declares it |
| `outbox-watcher` | `src/deliver.test.ts`, `src/cli.test.ts` | not stated | none |
| `pause-gate` | `../regulator-pi/src/algedonic.test.ts`, `src/controller.test.ts` | not stated | switch `extension:algedonic`; no arm declares it |
| `pre-merge-trial` | `src/worktree.test.ts`, `src/controller.test.ts`, `src/instance.test.ts`, `src/finance.test.ts` | not stated | switch `loop:pre-merge`; no arm declares it |
| `prediction-resolution` | `../protocol/src/prediction.test.ts`, `../core/src/predictions.test.ts`, `src/controller.test.ts`, `src/cli.test.ts`, `src/status.test.ts` | not stated | switch `loop:resolve-predictions`; no arm declares it |
| `profile-write-grant` | `../regulator-pi/src/profiles.test.ts` | not stated | switch `extension:profiles`; no arm declares it |
| `progression-veto` | `src/controller.test.ts`, `../core/src/obligations.test.ts` | not stated | switch `loop:progression-veto`; no arm declares it |
| `project-trust-rule` | `../regulator-pi/src/authority.test.ts`, `../regulator-pi/src/dispatcher.test.ts` | not stated | switch `loop:definition-loader`; no arm declares it |
| `proposal-intake` | `../regulator-pi/src/authority.test.ts` | not stated | switch `extension:authority`; no arm declares it |
| `recovery-router` | `../core/src/recovery.test.ts`, `src/controller.test.ts` | not stated | switch `policy:recovery.rules`; no arm declares it |
| `regulator-lifecycle` | `../core/src/control-plane.test.ts`, `src/cli.test.ts`, `src/registry.test.ts` | not stated | none |
| `reintegration` | `src/worktree.test.ts`, `src/unit.test.ts` | not stated | none |
| `result-report-gate` | `../regulator-pi/src/contract.test.ts`, `src/controller.test.ts`, `../core/src/contracts.test.ts` | not stated | switch `extension:contract`; no arm declares it |
| `s5-decision` | `src/cli.test.ts` | not stated | none |
| `span-projection` | `../core/src/spans.test.ts`, `src/cli.test.ts` | not stated | none |
| `thrash-detector` | `../regulator-pi/src/coordination.test.ts`, `../core/src/coordination.test.ts` | not stated | switch `extension:coordination`; no arm declares it |
| `unit-lease` | `../regulator-pi/src/coordination.test.ts`, `../core/src/coordination.test.ts` | not stated | switch `loop:lease`; no arm declares it |
| `unit-lifecycle` | `../core/src/contracts.test.ts`, `../core/src/trajectory.test.ts`, `src/status.test.ts`, `src/figures.test.ts`, `../control-room/src/server.test.ts` | not stated | none |
| `work-contract-gate` | `src/controller.test.ts`, `../regulator-pi/src/contract.test.ts` | not stated | switch `loop:check-contract`; no arm declares it |

No record states a last verified revision; the tests run at every revision under `pnpm check`, and the field is where a record would name the one a person verified.

## 6. Residual uncertainty

What nothing absorbs yet, from the pathology catalog's "not absorbed" column: for each characteristic way a viable
system fails, the part of it the registry does not cover. Where a row names an issue or a debt row, that is what would
resolve it; a row that names none is unscheduled. The open rows of [`docs/DEBT.md`](../../docs/DEBT.md) are the scheduled
part of this list and are linked, not copied: a debt row is what the build owes, and the catalog says what it costs.

| Pathology | Not absorbed |
| --- | --- |
| **S3\* that reads what S1 wrote** (structural pathologies) | an expectation rewritten to the current output inside an exempt file (`inherited-tests-check` limitation 1) |
| **S5 collapsed into S3** (structural pathologies) | a rule written in prose outside the writable prefixes shows up as a grader's number; no check refuses it |
| **No S4** (structural pathologies) | S4 triggers that would raise a research unit unasked (archived CONTROL-REGISTRY.md §7); in the finance example a statement's arrival is handled by hand |
| **Missing recursion** (structural pathologies) | the definition's own S4 (the Pi upgrade path) is a checklist a person runs |
| **S2 absorbed by S3** (structural pathologies) | semantic commitments between units (issue #14) |
| **S3 overload / micromanagement** (functional pathologies) | the metrics that would show it (undelegated decisions discovered, replans attributable to the contract) are DEBT row 40 |
| **S3/S4 disconnection** (functional pathologies) | an advisory nobody ever dispositions holds its units forever (a wait ceiling is DEBT row 30's sibling) |
| **Weak S5 / no algedonic path** (functional pathologies) | a consent grant is enforced on the named tool's calls only, and declared, not derived from effects (#121) |
| **Oscillation** (functional pathologies) | oscillation across *units* rather than within one (a coordination-oscillation signal is part of #14) |
| **Budget without a limit behaviour** (functional pathologies) | a reserve for verification and recovery at the instance level is not declared (the viability-theory framing; unscheduled) |
| **Recovery per unit hides a shared cause** (functional pathologies) | a level-2 count over recovery decisions that opens an obligation on the instance when N units hit one cause in a window (the [agent-engineering books note](https://github.com/MetaCoding-io/regulator/blob/main/docs/research/2026-10-25-agent-engineering-books.md) §4 item 8, after Lanham §8.3.7's circuit breaker); recorded as a backlog row, not debt, because the card names the per-unit count as a limit |
| **Attention decay** (information and channel pathologies) | what S3 does with the finding: no recovery cause names it (DEBT row 42), and a model that keeps the marker and still drifts is not seen |
| **Compaction discards the constraint** (information and channel pathologies) | a model summary can still be wrong, and only the deterministic block is guaranteed (a permanent limit) |
| **Summary discards the uncertainty** (information and channel pathologies) | observation versus inference is not a typed distinction on evidence, and retraction dependencies are not tracked |
| **Data absorbed as control** (information and channel pathologies) | poisoned operational memory driving a later unit is untested. Memory is rendered as facts and never as instructions, and that rendering is the whole defence; the candidate fixture is `fixture-poisoned-memory`, one false environment fact under valid provenance and a near review date ([#130](https://github.com/MetaCoding-io/regulator/issues/130), after #46; the [agent-engineering books note](https://github.com/MetaCoding-io/regulator/blob/main/docs/research/2026-10-25-agent-engineering-books.md) §6) |
| **Vocabulary drift** (information and channel pathologies) | the attenuation of the commit-message half (DEBT row 36) |
| **Feedback delay** (information and channel pathologies) | a coupling that `run_tests` and `run_checks` do not exercise lands (`pre-merge-trial` limitation 1); the trial itself was DEBT row 37, paid by #48 |
| **Self-report as control variety** (information and channel pathologies) | `confidence` on an intelligence signal is recorded and never calibrated; it is a `model-judgment` instrument once the prediction record exists (open questions §4) |

One row has no regulator at all: **Recovery per unit hides a shared cause**. By the catalog's reading order that is a failure the lab can name and reproduce but has not built the mechanism for.

14 active regulators absorb a failure class no pathology row names, so the catalog does not say what each would cost to lose: `advice-context` (`uninformed-unit`), `advice-decision` (`proposal-with-no-decider`), `command-runner` (`trusted-program`), `contract-advice` (`uninformed-unit`), `declared-tool` (`undeclared-action`), `definition-check` (`assembled-not-declared`), `definition-writers` (`assembled-not-declared`), `effect-journal` (`duplicated-effect`), `identity-promotion` (`decision-stays-in-one-instance`), `memory-store` (`memory-becomes-policy`), `outbox-watcher` (`owed-and-nobody-running`), `prediction-resolution` (`remedy-adopted-on-its-diagnosis`), `span-projection` (`evidence-nobody-can-join`), `unit-lifecycle` (`status-written-around-the-loop`). `regulator check` warns on each until a row names it.

## 7. Boundary critique

*A team's own; not rendered.* The capstone asks who defined "viable" and who pays for it, in four answers of a sentence
each after Ulrich's critical systems heuristics: who may define or amend the system's purpose, and by which path in the
definition; who is affected by its decisions but cannot challenge one; what work its success metric conceals; and under
what condition the system itself, not a regulator, should be retired.

- Who may define or amend the purpose, and by which path: —
- Who is affected but cannot challenge a decision: —
- What the success metric conceals: —
- When the system itself should be retired: —
