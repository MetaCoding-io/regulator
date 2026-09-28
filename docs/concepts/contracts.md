# Work contracts and result reports

A unit given only a goal will make every decision the goal touches, including the ones
that were not its to make, and will then say it is done. Both halves of that are
failures the harness has to absorb. It settles questions nobody had settled, and it
asserts success where nothing independent has checked it.

The **work contract** is how S3 divides the decisions before dispatch. The **result
report** is how the unit accounts for each one afterwards. Between them, the host
checks decide whether the work passed; the report is a claim beside that evidence, never
a substitute for it.

## Three kinds of decision

Every decision a contract names is one of three kinds, and the kind says who owns it.

| Kind | Who has decided | What the unit does | What the report must say |
| --- | --- | --- | --- |
| **Fixed** | someone with authority, already | preserves it | nothing, unless it deviated; then the deviation, with the decision it departs from |
| **Delegated** | S3 has handed it to the unit, within stated bounds | chooses within the bounds | the choice it made (unless the delegation says `requiredReport: false`) |
| **Unresolved** | nobody | leaves it unsettled and preserves the boundary | its outcome: `preserved` (left as found) or `surfaced` (raised for someone else) |

The split is the point of the contract. A fixed decision the unit silently reverses, a
delegated choice nobody hears about, and an open question the unit quietly answers are
three different failures, and each kind has its own rule.

### Fixed decisions cite an authority that exists

Each fixed decision carries an `authorityRef`: where the decision came from. It must be
one of four forms, and it must resolve when the unit is dispatched:

| Form | Resolves to |
| --- | --- |
| `INV-nnn` | an invariant the instance's identity declares |
| `reg.<area>.<name>.v<n>` | a regulator the registry declares |
| `obligation:<id>` | an obligation the instance holds, typically a decision someone already made |
| `human:<name>` | a named person; the name is trusted as given |

Free text is refused. "Because the architect said so" is not an authority the loop can
check; `human:dana` at least names someone who can be asked.

### Delegations have bounds

A delegated decision states the `bounds` the unit may choose within. A delegation with
no bounds is abdication, and the schema refuses an empty one. The bounds are text:
nothing checks that the choice landed inside them. The report makes the choice
visible, and a person or a later audit judges it.

### Unresolved decisions stay unresolved

An unresolved decision says why nobody has decided it and how the contract handles
that (`handling`):

| Handling | Meaning |
| --- | --- |
| `resolve-before-execution` | the unit cannot proceed until someone decides. A contract with one of these is **refused at dispatch**: resolve it, or reclassify it as delegated with bounds. |
| `defer` | the work can proceed without it |
| `stub-boundary` | the unit builds up to a seam and stops there |
| `research` | the answer needs a research unit (see [intelligence](/concepts/intelligence-and-memory)) |
| `policy-clarification` | the answer is a policy question for S5 |

The report has no outcome called *settled*. Settling an open question is not the unit's
to do, so the vocabulary does not let it say so.

## Expected evidence

A contract also lists the evidence that would show the work was done:
`expectedEvidence[]`, each with an `id`, a description, a `class` and whether it is
`required`. The class says what kind of observation counts:

| Class | Observed by |
| --- | --- |
| `test` | the host's run of the project's tests (`run_tests`, `inherited-tests`) |
| `command` | the host's deterministic checks (`run_checks`, `identity-untouched`, `glossary-lint`) |
| `file` | the host confirming a cited file exists at the revision |
| `runtime`, `semantic`, `model` | no generic host check. A person accepts or rejects it, unless the expectation carries its own check |

An expectation can carry a **content check** that the host runs against that criterion
specifically: `export-signature` (a module's export keeps its declared arity) or
`inherited-tests` (the suite the unit inherited, run against its tree). Without one, a
host result binds to every expectation of its class. That is the limit the content
checks exist to close: a passing suite that never exercises the changed behaviour still
satisfies a `test`-class criterion.

## The technical verdict

When the session ends, the host runs the checks the workload names for the unit type, at
the unit's revision, and derives the **technical verdict** from what it recorded:

- **pass**: every required expectation is satisfied by host evidence at this revision,
  or accepted by a person at this revision;
- **fail**: a check failed, a person rejected a criterion, or the host's evidence
  contradicts something the report claims;
- **inconclusive**: evidence is missing, stale (recorded at another revision), or
  waiting for a person's acceptance.

The report is consulted for one thing: to name the claims the evidence contradicts. A
report that says "tests pass" beside a failing host run makes the verdict fail. It
cannot make a verdict pass.

A criterion no check can observe waits for a person to accept or reject it with
`regulator unit accept`. The acceptance is bound to the revision and the contract
version, so a later change to the code needs a new acceptance. The verdict and the
acceptance are separate records: the host decides what it can observe, and a person
decides the rest.

## The result report

The unit answers with `report_result`, once, as its last action. The model supplies the
[report's fields](/reference/definition#work-contracts): a summary, evidence
references, the delegated results and unresolved outcomes, and three kinds of news the
contract did not anticipate:

- **emergent decisions**: choices or questions the contract did not allocate, each with
  its consequence if wrong (`low`, `medium`, `high`);
- **deviations**: from a fixed decision, a constraint, the scope or an interface. A
  fixed-decision deviation must name the decision;
- **residual uncertainty**: what the unit is still unsure of, and the consequence if it
  is wrong.

The host binds the report to the contract id and version, the unit and the attempt.
A report is never revised: a new attempt writes a new report.

The report is refused before it is written if:

- a delegated decision has no reported choice;
- an unresolved decision is missing, which means it was either settled silently or
  forgotten;
- a result names a decision the contract does not contain;
- a required expectation without its own check has no evidence reference of its class;
- it cites `test` or `command` evidence that does not match a passing run in this
  session, on a committed tree, at the current revision (the evidence preflight).

### What the report raises

Nothing the unit reports is left in the report alone. At close the loop turns it into
messages and routes them under the [routing policy](/reference/definition#routing-policy):

| In the report | Becomes | At severity |
| --- | --- | --- |
| an emergent decision | an `operational-signal` | `low` → info, `medium` → advisory, `high` → blocking |
| a deviation | an `operational-signal` | blocking |
| residual uncertainty | an `uncertainty-signal` | its consequence mapped through the policy's impact table |

Under the shipped policy a blocking message opens an [obligation](/concepts/obligations)
that holds the unit, so a unit that deviates from a fixed decision cannot close until
someone has dispositioned that deviation.

## Versions, attempts and replanning

A contract has an `id` and a `version`. A further attempt at a blocked unit runs under
the same version, up to the budget's attempt ceiling. A different version is not a retry
but a replan: a new contract, which names its `predecessor` and the reason it changed.
The loop refuses to dispatch a unit under a version other than the one it started with.

Only S3 writes contracts. `provenance.createdBy` must be `"S3"`, and no model-facing
tool sets it. The contract deliberately has no field for authority, capabilities or VSM
functions. What a unit may do is its profile's grant, and a contract a model could edit
cannot widen it.

## Where each part is enforced

| Rule | Mechanism |
| --- | --- |
| a contract's and a report's shape | runtime schemas (level 3) |
| authority references resolve; no `resolve-before-execution`; the unit type exists; the attempt ceiling; no open blocking obligation | the dispatch gate (level 2) |
| every delegated and unresolved decision is accounted for | the `report_result` check (levels 2 and 3) |
| cited test and command runs happened here, at this revision, and passed | the evidence preflight (level 2) |
| the work passed | the technical verdict over host evidence (level 2) |
| the unit knows what the contract says | the contract rendered into the system prompt every turn (level 5) |

Everything the rendered contract tells the model is also enforced by one of the gates
above. The prompt keeps the model from being surprised by them.

## What is not there yet

The registry records for the [contract gate, the report gate, the evidence preflight and
the closeout gate](/reference/regulators) state their limitations. In short:

- **The report gate reads the report, not the diff.** A unit can report an unresolved
  decision as `preserved` while its diff settles it. Catching that is audit's job.
- **Bounds and consequences are text.** Nothing checks that a delegated choice fell
  inside its bounds, or that `consequenceIfWrong` is honest; a `low` emergent decision
  is noted as trace and nobody reads it.
- **Evidence binds by class.** Without a content check, a passing run of any test
  satisfies every `test`-class criterion.
- **`runtime` criteria need a person.** Apart from `export-signature`, no host mechanism
  observes runtime behaviour, so a `runtime` expectation without a content check waits
  for an acceptance.
- **A named person is not a verified authority.** `human:<name>` resolves by form. The
  loop does not check that the person held the authority, or that a `--by` name belongs
  to whoever typed it (`docs/DEBT.md` row 28).
