# Definition files

Every file the definition is made of, with its schema. The schemas are TypeBox objects
in `@metacoding.io/regulator-protocol` and are closed: an unknown field is rejected, so a
definition grows deliberately. `regulator check` validates the whole set together; the
shipped definition under `packages/regulator/` is the example for each.

## Workload

`workload/<name>.json` — the kinds of work the orchestrator may dispatch, and what each
runs under. The loop is generic; this file is where a workload's behaviour lives.

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | `^[a-z][a-z0-9-]*$` | the workload a contract names |
| `version` | integer ≥ 1 | bumped when unit types change; a contract names the version too |
| `description` | string | |
| `unitTypes[]` | | |
| `unitTypes[].name` | string | the `unitType` a contract may name |
| `unitTypes[].description` | string | shown to the session |
| `unitTypes[].profile` | string | the capability profile the unit runs under; must exist |
| `unitTypes[].checks` | [host check names](/reference/host-checks) | run by the host at the unit's revision to reach the technical verdict |
| `unitTypes[].requiresContract` | boolean | `false` only for a type that may run without a contract, which must then run under a read-only profile |

The shipped `software-development` workload declares `plan`, `research`, `implement`,
`verify`, `integrate` and `close`; `personal-finance` declares the monthly close over a
ledger. A contract is loaded with the workload it names, so an instance may run several.

## Capability profiles

`profiles/<name>.json` — what a unit may use and where it may write. A profile is a
grant over declared tool *effects*, not a personality: read-only means every granted
tool's effect is read-only, and the check refuses a profile that says otherwise.

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | string | named by a workload's unit type |
| `description` | string | |
| `tools[]` | tool names | the active tool set of the session; every tool declares its effect (filesystem, execution, network, side effects) |
| `writablePaths[]` | path prefixes | where `write` and `edit` may land; the manifest's `--writable` overrides it for an instance, never for a read-only profile |
| `thinkingLevel` | optional | the host's thinking setting for the session |
| `advice[]` | strings | rendered into context; advice, never authority |

Shipped: `implement` (write and edit under `src/` and `test/`, `bash` un-gated by
path), `research` (read-only), `intelligence` (read-only plus `report_intelligence`),
`bookkeeper` and `auditor` for the ledger.

## Budget and model policy

`policies/default.json` (and `finance.json`) — ceilings per attempt, attempts per unit,
and which models a unit type may use.

| Field | Type | Meaning |
| --- | --- | --- |
| `name`, `version`, `description` | | |
| `budgets.default` | ceiling | applied to every unit type not listed |
| `budgets.byUnitType.<type>` | partial ceiling | overrides field by field |
| `models.default` | route | `primary` and `fallback[]` in order; nothing outside the route is ever used |
| `models.byUnitType.<type>` | route | |
| `coordination.oscillationThreshold` | integer | reversals of the same file within one unit before the thrash detector raises `oscillation` |

A ceiling has `tokens`, `cost` (optional), `wallClockMs`, `turns` and `attempts`. The
budget meter counts as the session runs and ends the attempt at the first ceiling
reached; the cause is `budget-exhausted`.

## Recovery policy

`policies/recovery.json` — what S3 does with a blocked unit. The Nth failure of a cause
on one unit takes the Nth action of its rule; the last action repeats; a rule that runs
out falls through to `fallback`.

| Causes | Actions |
| --- | --- |
| `no-report`, `invalid-report`, `budget-exhausted`, `check-failure`, `tool-error`, `timeout`, `environment`, `conflict`, `oscillation`, `ambiguity`, `dispatch-error`, `unknown` | `retry`, `repair`, `remediate`, `replan`, `clarify`, `pause`, `escalate`, `abort` |

`retry` and `repair` spend an attempt and become `escalate` when the unit's attempt
ceiling is reached. The other five are *waiting* actions: the loop records the decision
and opens an obligation for the consumer the routing policy names, and the unit holds
until it is dispositioned.

## Routing policy

`policies/routing.json` — what the instance owes for each message it records, and who a
unit waits on.

| Field | Meaning |
| --- | --- |
| `rules[]` | per message `kind`, the `minSeverity` at which it opens an obligation and for which `consumer` (`S3`, `S5`, `human`); below the line it is noted and stays trace |
| `impactSeverity` | maps an uncertainty signal's *reported* impact (`low`…`critical`) to the severity the router uses; a claim is not a severity |
| `recovery` | the consumer for each waiting recovery action |
| `blocksAtOrAbove` | an open obligation at or above this severity, naming a unit, vetoes that unit's dispatch and close |
| `floors[]` | a regular expression over the message's subject and observation, and the severity it is raised to at least, with the reason; the shipped floor raises anything naming an invariant or the identity to `blocking` |

Severities, lowest first: `info`, `advisory`, `blocking`, `critical`.

## Interaction policy

`policies/interaction.json` — how the instance interrupts a person, and who may answer.

| Field | Meaning |
| --- | --- |
| `timeoutsMs` | per interaction kind (`recap`, `choice`, `clarification`, `consent`, `uat`); a timeout is recorded and the unit pauses |
| `attention.blockingPerAttempt` | blocking interrupts an attempt may spend before `ask_human` refuses; attention is the scarcest budget |
| `reminderAfterMs` | an obligation owed to a person and still open this long after its last delivery is delivered again (minimum one minute) |
| `people[]` | `name`, `resolveUpTo` (the highest severity this person may disposition), `acceptRisk`, `actAsS5` |

Only `recap` continues without an answer; that is a protocol constant, not a policy
choice, so no policy can make silence into consent. Every `--by` on the CLI is checked
here: a name not listed may disposition nothing. The name is asserted, not
authenticated; authentication is the deployment's.

## Work contracts

`contracts/**.json` — what one unit is for. Only S3 writes contracts; a model-facing
path never sets `provenance.createdBy`.

| Field | Meaning |
| --- | --- |
| `kind` | `task` |
| `id`, `version` | a new version is a new contract; the report names the version it answered |
| `unitId`, `unitType` | the type must exist in the workload named by `workload.name`/`workload.version` |
| `objective`, `contribution` | what, and why it matters to the whole |
| `constraintRefs[]` | regulator ids or invariant ids the unit runs under |
| `fixed[]` | decisions already made: `id`, `subject`, `decision`, `authorityRef` (an invariant, an accepted decision, a planning record), optional `rationale` |
| `delegated[]` | decisions the unit may make: `id`, `subject`, `bounds`; a delegation without bounds is abdication; the choice made must appear in the report unless `requiredReport` is `false` |
| `unresolved[]` | decisions nobody has made: `id`, `subject`, `reason`, `handling` (`resolve-before-execution`, `defer`, `stub-boundary`, `research`), optional `obligationRef` |
| `expectedEvidence[]` | `id`, `description`, `class` (`file`, `command`, `test`, `runtime`, `semantic`, `model`), `required`, and optionally a `check` the host can observe: `{ kind: "export-signature", module, export, arity }` or `{ kind: "inherited-tests", exempt[] }`. A `semantic` or `model` expectation without a check needs a human acceptance to count |
| `provenance` | `createdBy: "S3"`, `createdAt`, optional `sourceRevision` and `predecessor` |

The unit answers with a **result report**: its evidence refs, the choice made for each
delegated decision, the outcome of each unresolved one, emergent decisions, deviations
from a fixed decision, a constraint, the scope or an interface, and residual
uncertainty. A report is bound to a contract version and an attempt and is never
revised; the contract check refuses a report that leaves a delegated decision unreported
or a required expectation unaddressed.

## Eval suites

`evals/<name>.json` — a suite the harness runs headlessly against scripted behaviours
or live through the host.

| Field | Meaning |
| --- | --- |
| `fixture` | the fixture directory, relative to the definition |
| `tasks[]` | contract files, run in order in one instance per repetition |
| `arms[]` | `name`, `description`, `extensions[]` the dispatcher loads for a live run, `checks[]` the implement unit type runs under this arm, `identity` (whether the identity is seeded), and for an ablation arm the record it `ablates` and the `switch` (`none`, or `check:`, `extension:`, `loop:`, `policy:`, `tool:` and a target) |
| `repetitions`, `metrics[]`, `baseline` | how many runs per arm, the metrics the report summarizes (pre-registered, so the interpretation is a person's), and the arm the others are compared against |

The harness can throw `check` and `extension` switches without a code change; a `loop`,
`policy` or `tool` switch on a record says an ablation of that regulator needs one. A
report carries a fingerprint of the definition, the host pin and the suite, and is not
complete without an interpretation file. [Evidence about the
regulators](/concepts/evidence-about-the-regulators) explains arms, ablation, the
metrics and the interpretation rule.

## Registry records

`registry/regulators/<id>.json` — one per regulator. A record without a limitation does
not pass the check; a record whose `reviewBy` has passed fails it.

| Field | Meaning |
| --- | --- |
| `id` | `reg.<area>.<name>.v<n>` |
| `name`, `status` | `proposed`, `active` or `retired`; a retired record keeps its history and skips the implementation and evidence checks |
| `vsmFunction` | `S1`…`S5`, `S3*` |
| `purpose`, `absorbs.failureClass`, `absorbs.description` | what it is for and the failure it absorbs |
| `mechanism.level` | `type`, `deterministic-gate`, `typed-tool`, `model-judgment`, `prompt` |
| `mechanism.implementation`, `mechanism.enforcementPoints[]` | the file, and where in it the gate applies |
| `authority.may[]`, `authority.mayNot[]` | |
| `evidence.tests[]` | test files that must exist |
| `channels`, `scope`, `cost` | what it consumes and emits, what it applies to, what it costs |
| `limitations[]` | at least one; a limitation naming later work has a row in [build debt](/DEBT) |
| `ownership.owner`, `ownership.introduced`, `ownership.reviewBy` | |
| `ablation.switch`, `ablation.note` | the eval arm with this regulator off |
| `retirement.condition` | when it may be retired — typically no significant regression in ablation across model versions and suites |

[Regulators](/reference/regulators) and the [enforcement boundary](/reference/boundary)
are rendered from these records by `regulator docs`.

## Identity seed

`identity/IDENTITY.md`, `INVARIANTS.md`, `GLOSSARY.md`, `BOUNDARIES.md` — the four S5
files. `INVARIANTS.md` lists invariants as `INV-NNN` with a statement each; the parser
refuses a malformed one. `GLOSSARY.md` has a section, "Words this instance does not
use", that `glossary-lint` reads. `BOUNDARIES.md` is generated from the registry. The
seed is copied into an instance by `init`; the instance's copy is what units see and
what `identity accept` writes; `identity promote` carries an accepted file back.

## Instance manifest

Not part of the definition — written by `init` into the instance — but declared by a
person, so listed here. See the [instance layout](/reference/instance#the-manifest).
