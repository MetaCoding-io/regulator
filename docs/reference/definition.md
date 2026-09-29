# Definition files

The definition is made of the files below, and each has a schema. The schemas are
TypeBox objects in `@metacoding.io/regulator-protocol`, and they are closed: an unknown
field is rejected, so a definition grows only when someone adds a field on purpose.
`regulator check` validates the whole set together, and the shipped definition under
`packages/regulator/` is the worked example for every file on this page.

## Workload

`workload/<name>.json` declares the kinds of work the orchestrator may dispatch, and what
each kind runs under. The loop itself is generic, so this file is where a workload's
behaviour lives.

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | `^[a-z][a-z0-9-]*$` | the workload a contract names |
| `version` | integer ≥ 1 | bumped when the unit types change; a contract names the version as well as the name |
| `description` | string | |
| `unitTypes[]` | | |
| `unitTypes[].name` | string | the `unitType` a contract may name |
| `unitTypes[].description` | string | shown to the session |
| `unitTypes[].profile` | string | the capability profile the unit runs under; it must exist |
| `unitTypes[].checks` | [host check names](/reference/host-checks), each a name or `{ "name", "options" }` | the checks the host runs at the unit's revision to reach the technical verdict. Only `glossary-lint` takes an option, `commitMessages: "blocking" \| "advisory"`, and an option given to a check that does not take one fails the definition check |
| `unitTypes[].requiresContract` | boolean | `false` only for a type that may run without a contract; such a type must then run under a read-only profile |

The shipped `software-development` workload declares the unit types `plan`, `research`,
`implement`, `verify`, `integrate` and `close`. The `personal-finance` workload declares
the monthly close over a ledger. A contract is loaded together with the workload it
names, so one instance may run several workloads.

A unit type and the profile it runs under are named separately on purpose, and the
names do not line up one to one. In the shipped workload, `implement` and `integrate`
both run under the `implement` profile. `plan`, `verify` and `close` run under
`research`, which is read-only. The `research` unit type runs under `intelligence`,
which is `research` plus `report_intelligence`. The two names describe different
things: the profile is the grant, while the unit type is the kind of work and the
checks that judge it, so several kinds of work can share one grant.

## Capability profiles

`profiles/<name>.json` declares what a unit may use and where it may write. A profile is
a grant over the *effects* the tools declare, and the definition check reads it that
way: in a read-only profile every granted tool's declared effect must be read-only, and
the check refuses a profile that calls itself read-only while granting anything else.

Writing a record into the control plane's own stores does not count as a write to the
domain. `report_result`, `report_intelligence`, `propose_policy_change` and `remember`
all write there, so a read-only profile can grant them and still report. A profile that
a contracted unit type runs under must grant `report_result`, since without it no unit
of that type could close.

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | string | the name a workload's unit type refers to |
| `description` | string | |
| `tools[]` | tool names | the active tool set of the session. Every tool declares its effect: filesystem, execution, network or side effects |
| `writablePaths[]` | path prefixes | where `write` and `edit` may land. The manifest's `--writable` overrides it for an instance, but never for a read-only profile |
| `thinkingLevel` | optional | the host's thinking setting for the session |
| `advice[]` | strings | rendered into the session's context. It is advice and carries no authority |

The shipped profiles are `implement`, `research`, `intelligence`, `bookkeeper` and
`auditor`. `implement` may write and edit under `src/` and `test/`, and its `bash` is
not gated by path. `research` is read-only, and `intelligence` is read-only plus
`report_intelligence`. `bookkeeper` and `auditor` are the profiles for the ledger.
[Coordination](/concepts/coordination#profiles-grant-tools-by-effect) explains the
effect axes and what counts as read-only.

## Budget and model policy

`policies/default.json`, and `finance.json` beside it, set the ceilings per attempt, the
attempts per unit, and the models each unit type may use.

| Field | Type | Meaning |
| --- | --- | --- |
| `name`, `version`, `description` | | |
| `budgets.default` | ceiling | the ceiling applied to every unit type the policy does not list |
| `budgets.byUnitType.<type>` | partial ceiling | overrides the default field by field |
| `models.default` | route | `primary` and `fallback[]`, tried in that order; a model outside the route is never used |
| `models.byUnitType.<type>` | route | |
| `coordination.oscillationThreshold` | integer | the number of reversals of the same file within one unit before the thrash detector raises `oscillation` |
| `identity.maxChars` | integer, optional | the number of characters of rendered identity a unit's prompt carries before the rendering is cut; 12000 unless set. `check`, `doctor` and the session all measure against it and warn once it is passed, and nothing is refused |

A ceiling is made of `tokens`, `cost` (which is optional), `wallClockMs`, `turns` and
`attempts`. The budget meter counts as the session runs and ends the attempt at the
first ceiling it reaches. The recovery policy then sees that failure under the cause
`budget-exhausted`.

## Recovery policy

`policies/recovery.json` says what S3 does with a blocked unit. Each rule is a list of
actions for one cause. The Nth failure of that cause on one unit takes the Nth action of
the rule, and once the rule runs out the last action repeats. `fallback` is the rule for
a cause no rule names, which covers `unknown` and any cause a shorter policy leaves out.

| Causes | Actions |
| --- | --- |
| `no-report`, `invalid-report`, `budget-exhausted`, `check-failure`, `tool-error`, `timeout`, `environment`, `conflict`, `oscillation`, `ambiguity`, `dispatch-error`, `unknown` | `retry`, `repair`, `remediate`, `replan`, `clarify`, `pause`, `escalate`, `abort` |

`retry` and `repair` spend an attempt, and once the unit's attempt ceiling is reached
either of them becomes `escalate`. The other five, every action except `abort`, are
*waiting* actions. For those, the loop records the decision and opens an obligation for
the consumer the routing policy names, and the unit holds until that obligation is
dispositioned. [Recovery, budgets and model routes](/concepts/recovery) explains how a
failure becomes a cause and how a cause becomes an action.

## Routing policy

`policies/routing.json` says what the instance owes for each message it records, and
who a unit waits on.

| Field | Meaning |
| --- | --- |
| `rules[]` | one rule per message `kind`: the `minSeverity` at which a message of that kind opens an obligation, and the `consumer` it is opened for (`S3`, `S5` or `human`). A message below that line is noted and stays in the trace |
| `impactSeverity` | maps the impact an uncertainty signal *reports* (`low` to `critical`) to the severity the router uses. The mapping exists because a reported impact is a claim, and a claim is not a severity |
| `recovery` | the consumer for each waiting recovery action |
| `blocksAtOrAbove` | the severity at or above which an open obligation that names a unit vetoes that unit's dispatch and close |
| `floors[]` | each floor is a regular expression over the message's subject and observation, the severity a matching message is raised to at least, and the reason. The shipped floor raises anything naming an invariant or the identity to `blocking` |

The severities, from lowest to highest, are `info`, `advisory`, `blocking` and
`critical`.

## Interaction policy

`policies/interaction.json` says how the instance interrupts a person, and who may
answer.

| Field | Meaning |
| --- | --- |
| `timeoutsMs` | a timeout per interaction kind (`recap`, `choice`, `clarification`, `consent`, `uat`). When one expires, the timeout is recorded and the unit pauses |
| `attention.blockingPerAttempt` | how many blocking interrupts an attempt may spend before `ask_human` refuses the next one. Attention is the scarcest budget |
| `reminderAfterMs` | an obligation owed to a person that is still open this long after its last delivery is delivered again; the minimum is one minute |
| `waitCeilingMs` | optional. A unit paused on a question nobody has answered for this long is routed under the recovery policy's `timeout` cause and its lease is released. The question itself stays open and keeps its veto. When the field is unset, which is the shipped default, the unit waits |
| `people[]` | one entry per person: `name`, `resolveUpTo` (the highest severity this person may disposition), `acceptRisk` and `actAsS5` |

Only `recap` continues without an answer. That rule is a protocol constant, so no policy
can make silence into consent. Every `--by` on the CLI is checked against `people[]`,
and a name that is not listed may disposition nothing. The check matches the name as it
was asserted; authenticating that the person is who they claim is the deployment's job.
[Asking a person](/concepts/asking-a-person) explains the kinds, the pause and the
attention budget.

## Work contracts

`contracts/**.json` are the work contracts, and each says what one unit is for. Only S3
writes contracts, and no model-facing path ever sets `provenance.createdBy`.

| Field | Meaning |
| --- | --- |
| `kind` | `task` |
| `id`, `version` | a new version is a new contract, and the report names the version it answered |
| `unitId`, `unitType` | the unit type must exist in the workload named by `workload.name`/`workload.version` |
| `objective`, `contribution` | what the unit is to do, and why that matters to the whole |
| `constraintRefs[]` | the regulator ids or invariant ids the unit runs under |
| `fixed[]` | decisions already made, each with `id`, `subject`, `decision`, `authorityRef` and an optional `rationale`. An authority reference takes one of four forms and must resolve, or the contract is refused: `INV-nnn` (an invariant the instance's identity declares), `reg.<area>.<name>.v<n>` (a registry record), `human:<name>` (a person, whose name is trusted as given), or `obligation:<id>` (an open obligation, typically an accepted decision) |
| `delegated[]` | decisions the unit may make, each with `id`, `subject` and `bounds`. A delegation without bounds is abdication. The choice the unit made must appear in the report unless `requiredReport` is `false` |
| `unresolved[]` | decisions nobody has made, each with `id`, `subject`, `reason`, a `handling` (`resolve-before-execution`, `defer`, `stub-boundary`, `research` or `policy-clarification`) and an optional `obligationRef` |
| `expectedEvidence[]` | each with `id`, `description`, a `class` (`file`, `command`, `test`, `runtime`, `semantic` or `model`), `required`, and optionally a `check` the host can observe, either `{ kind: "export-signature", module, export, arity }` or `{ kind: "inherited-tests", exempt[] }`. A `runtime`, `semantic` or `model` expectation without a check needs a human acceptance before it counts |
| `provenance` | `createdBy: "S3"`, `createdAt`, and optionally `sourceRevision` and `predecessor` |

The unit answers its contract with a result report, sent through `report_result` (see
[session tools](/reference/tools#report_result)). The report has these fields:

| Field | Meaning |
| --- | --- |
| `summary` | what was done |
| `evidence[]` | evidence references, each with a `class` (`file`, `command`, `test`, `runtime`, `semantic` or `model`), an optional observation and an optional revision |
| `delegatedResults[]` | one per delegated decision: the `decisionId`, the `choice` and an optional `rationale`. An entry is required unless the delegation said `requiredReport: false` |
| `unresolvedOutcomes[]` | one per unresolved decision, either `preserved` (left as found) or `surfaced` (raised for someone else). There is no *settled* outcome, because settling an unresolved decision is not the unit's to do |
| `emergentDecisions[]` | decisions the contract did not allocate, each with a `subject`, a `choiceOrQuestion` and a `consequenceIfWrong` (`low`, `medium` or `high`) |
| `deviations[]` | departures from a `fixed-decision`, a `constraint`, the `scope` or an `interface`, each with an optional `ref` |
| `residualUncertainty[]` | each with a `subject`, a `reason` and a `consequenceIfWrong` |

A report is bound to one contract version and one attempt, and it is never revised. The
contract check refuses a report that leaves a delegated decision unreported or a
required expectation unaddressed. At close, each emergent decision and each deviation
becomes an `operational-signal`, and each residual uncertainty becomes an
`uncertainty-signal`; the router then treats them like any other message. [Work
contracts and reports](/concepts/contracts) explains why the contract is shaped this
way and how the verdict reads it.

## Eval suites

`evals/<name>.json` describes a suite. The harness runs a suite either headlessly,
against scripted behaviours, or live, through the host.

| Field | Meaning |
| --- | --- |
| `fixture` | the fixture directory, relative to the definition |
| `tasks[]` | contract files, run in order in one instance per repetition |
| `arms[]` | each arm has a `name`, a `description`, the `extensions[]` the dispatcher loads for a live run, the `checks[]` the implement unit type runs under this arm (names, or names with options, as in the workload), and `identity`, which says whether the identity is seeded. An ablation arm also names the record it `ablates` and the `switch`: `none`, or one of `check:`, `extension:`, `loop:`, `policy:` and `tool:` followed by a target |
| `repetitions`, `metrics[]`, `baseline` | how many runs each arm gets, the metrics the report summarizes, and the arm the others are compared against. The metrics are pre-registered, so the interpretation of the result is a person's |

The harness can throw a `check` or `extension` switch without a code change. A `loop`,
`policy` or `tool` switch on a record means the opposite: an ablation of that regulator
needs a code change. An eval report carries a fingerprint of the definition, the host pin
and the suite, together with a person's interpretation. `regulator eval` writes a
placeholder in place of the interpretation when it is run without `--interpretation`,
and `regulator check` refuses a report under `evals/reports/` that still carries that
placeholder. [Evidence about the
regulators](/concepts/evidence-about-the-regulators) explains arms, ablation, the
metrics and the interpretation rule.

## Registry records

`registry/regulators/<id>.json` holds one record per regulator. A record without a
limitation does not pass the check, and a record whose `reviewBy` date has passed fails
it too.

| Field | Meaning |
| --- | --- |
| `id` | `reg.<area>.<name>.v<n>` |
| `name`, `status` | the status is `proposed`, `active` or `retired`. A retired record keeps its history and skips the implementation and evidence checks |
| `vsmFunction` | `S1` to `S5`, or `S3*` |
| `purpose`, `absorbs.failureClass`, `absorbs.description` | what the regulator is for, and the failure it absorbs |
| `mechanism.level` | one of `type`, `deterministic-gate`, `typed-tool`, `model-judgment` or `prompt` |
| `mechanism.implementation`, `mechanism.enforcementPoints[]` | the implementing file, and the places where the gate bites. Each enforcement point is `{ where, point, note? }`. `where` is one of `host` (a session event the Pi host subscribes to, or `dispatcher`), `tool` (a registered tool's execute), `loop` (a step of the S3 loop or the unit lifecycle), `cli` (a `regulator` subcommand) or `check` (`checkRegistry` or `checkDefinition`), and `point` comes from that place's closed list in `packages/protocol/src/registry.ts` (`ENFORCEMENT_POINTS`). A point that is not on its list fails the check |
| `authority.may[]`, `authority.mayNot[]` | |
| `evidence.tests[]` | test files that must exist |
| `channels`, `scope`, `cost` | what the regulator consumes and emits, what it applies to, and what it costs |
| `limitations[]` | at least one is required, and a limitation that names later work has a row in [build debt](/DEBT) |
| `ownership.owner`, `ownership.introduced`, `ownership.reviewBy` | |
| `ablation.switch`, `ablation.note` | the eval arm that runs with this regulator off |
| `retirement.condition` | when the regulator may be retired, typically once ablation shows no significant regression across model versions and suites |

The [regulators](/reference/regulators) page and the
[enforcement boundary](/reference/boundary) are both rendered from these records by
`regulator docs`.

## Identity seed

The four S5 files are `identity/IDENTITY.md`, `INVARIANTS.md`, `GLOSSARY.md` and
`BOUNDARIES.md`. A person writes them and the parser reads them. `init` copies the seed
into an instance, and from then on the instance's copy is what units see and what
`identity accept` writes. `identity promote` carries an accepted file back from the
instance to the definition.

`INVARIANTS.md` declares one invariant per section. The parser refuses a file that
declares none, and it refuses a malformed heading. A section looks like this:

```markdown
## INV-005 — The statement is the bank's

No unit writes under `statements/`.

Checked by: the manifest's protected prefixes at the profile grant; `identity-untouched` at closeout.
```

The shipped seed declares four invariants. INV-001 says the identity is
write-protected, INV-002 says a proposal is not policy, INV-003 says audit is
independent of self-report, and INV-004 says memory is not identity. Each one names the
mechanism that checks it. A contract cites an invariant as `authorityRef: "INV-003"`,
and the routing policy's shipped floor raises any message that names one to `blocking`.

`GLOSSARY.md` has a section headed `## Words this instance does not use`, and
`glossary-lint` reads it. Each line in that section is a refused word, or a
comma-separated list of them, followed by the word to say instead:

```markdown
- task, job, ticket (say unit)
```

`BOUNDARIES.md` is the identity's own statement of what the system does not do, and it
is written by hand. It is a different document from the enforcement boundary
(`BOUNDARY.md`), which is rendered from the registry records.

## Instance manifest

The manifest is not part of the definition, since `init` writes it into the instance. A
person declares its contents, though, so it belongs beside the definition files. The
[instance layout](/reference/instance#the-manifest) describes its fields.
