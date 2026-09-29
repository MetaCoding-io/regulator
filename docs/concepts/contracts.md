# Work contracts and result reports

A unit given only a goal will make every decision the goal touches, including the ones
that were not its to make, and will then say it is done. Both halves of that are
failures the harness has to absorb. The unit settles questions nobody had settled, and
it asserts success where nothing independent has checked its work.

The **work contract** is how S3 divides the decisions before dispatch. The **result
report** is how the unit accounts for each of those decisions afterwards. Between the
two sit the host checks, which decide whether the work passed. The report is a claim
that stands beside that evidence, and it is never a substitute for it.

## Three kinds of decision

Every decision a contract names is one of three kinds, and the kind says who owns it.

| Kind | Who has decided | What the unit does | What the report must say |
| --- | --- | --- | --- |
| **Fixed** | someone with authority has already decided it | preserves the decision | nothing, unless the unit deviated; then it reports the deviation, with the decision it departs from |
| **Delegated** | S3 has handed it to the unit, within stated bounds | chooses within the bounds | the choice it made (unless the delegation says `requiredReport: false`) |
| **Unresolved** | nobody | leaves it unsettled and preserves the boundary | its outcome: `preserved` (left as found) or `surfaced` (raised for someone else) |

The split is the point of the contract. A fixed decision the unit silently reverses, a
delegated choice nobody hears about, and an open question the unit quietly answers are
three different failures, and each kind of decision has its own rule for catching one.

### Fixed decisions cite an authority that exists

Each fixed decision carries an `authorityRef`, which says where the decision came from.
It must take one of four forms, and it must resolve when the unit is dispatched:

| Form | Resolves to |
| --- | --- |
| `INV-nnn` | an invariant the instance's identity declares |
| `reg.<area>.<name>.v<n>` | a regulator the registry declares |
| `obligation:<id>` | an obligation the instance holds, typically a decision someone already made |
| `human:<name>` | a named person; the name is trusted as given |

Free text is refused. "Because the architect said so" is not an authority the loop can
check. `human:dana` at least names someone who can be asked.

### Delegations have bounds

A delegated decision states the `bounds` the unit may choose within. A delegation with
no bounds is abdication, so the schema refuses an empty one. The bounds themselves are
text, and nothing checks that the choice landed inside them. What the contract does
guarantee is that the report makes the choice visible, so that a person or a later
audit can judge it.

### Unresolved decisions stay unresolved

An unresolved decision says why nobody has decided it and how the contract handles
that gap. The `handling` field takes one of five values:

| Handling | Meaning |
| --- | --- |
| `resolve-before-execution` | the unit cannot proceed until someone decides. A contract with one of these is refused at dispatch: either resolve it, or reclassify it as delegated with bounds. |
| `defer` | the work can proceed without it |
| `stub-boundary` | the unit builds up to a seam and stops there |
| `research` | the answer needs a research unit (see [intelligence](/concepts/intelligence-and-memory)) |
| `policy-clarification` | the answer is a policy question for S5 |

The report has no outcome called *settled*. Settling an open question is not the unit's
to do, so the vocabulary gives it no way to say that it did.

## Expected evidence

A contract also lists the evidence that would show the work was done. Each entry in
`expectedEvidence[]` has an `id`, a description, a `class` and a flag saying whether it
is `required`. The class says what kind of observation counts as satisfying it:

| Class | Observed by |
| --- | --- |
| `test` | the host's run of the project's tests (`run_tests`, `inherited-tests`) |
| `command` | the host's deterministic checks (`run_checks`, `identity-untouched`, `glossary-lint`) |
| `file` | the host confirming that a cited file exists at the revision |
| `runtime`, `semantic`, `model` | no generic host check. A person accepts or rejects it, unless the expectation carries its own check |

Without more than a class, a host result binds to every expectation of that class, so a
passing suite that never exercises the changed behaviour still satisfies a `test`-class
criterion. That is the gap the **content checks** exist to close. An expectation can
carry one, and the host then runs it against that criterion specifically. Two exist:
`export-signature`, which confirms that a module's export keeps its declared arity, and
`inherited-tests`, which runs the suite the unit inherited against the unit's tree.

## The technical verdict

When the session ends, the host runs the checks the workload names for the unit type, at
the unit's revision, and derives the **technical verdict** from what it recorded. The
verdict is pass when every required expectation is satisfied by host evidence at this
revision, or accepted by a person at this revision. It is fail when a check failed, when
a person rejected a criterion, or when the host's evidence contradicts something the
report claims. It is inconclusive when evidence is missing, when it is stale because it
was recorded at another revision, or when it is still waiting for a person's acceptance.

The report is consulted for one thing only: to name the claims the evidence contradicts.
A report that says "tests pass" beside a failing host run makes the verdict fail. No
report can make a verdict pass.

A criterion no check can observe waits for a person to accept or reject it with
`regulator unit accept`. The acceptance is bound to the revision and the contract
version, so a later change to the code needs a new acceptance. The verdict and the
acceptance are separate records, because they answer different questions: the host
decides what it can observe, and a person decides the rest.

## The result report

The unit answers with `report_result`, once, as its last action. The model supplies the
[report's fields](/reference/definition#work-contracts): a summary, evidence references,
the delegated results and unresolved outcomes, and three kinds of news the contract did
not anticipate. Emergent decisions are choices or questions the contract did not
allocate, each with its consequence if wrong (`low`, `medium` or `high`). Deviations are
departures from a fixed decision, a constraint, the scope or an interface, and a
deviation from a fixed decision must name the decision it departs from. Residual
uncertainty is what the unit is still unsure of, again with the consequence if it turns
out to be wrong.

The host binds the report to the contract id and version, the unit and the attempt. A
report is never revised. A new attempt writes a new report.

The report is refused before it is written if any of the following holds:

- a delegated decision has no reported choice;
- an unresolved decision is missing, which means it was either settled silently or
  forgotten;
- a result names a decision the contract does not contain;
- a required expectation without its own check has no evidence reference of its class;
- it cites `test` or `command` evidence that does not match a passing run in this
  session, on a committed tree, at the current revision (the evidence preflight).

### What the report raises

Nothing the unit reports is left in the report alone. At close, the loop turns each item
into a message and routes it under the
[routing policy](/reference/definition#routing-policy):

| In the report | Becomes | At severity |
| --- | --- | --- |
| an emergent decision | an `operational-signal` | `low` → info, `medium` → advisory, `high` → blocking |
| a deviation | an `operational-signal` | blocking |
| residual uncertainty | an `uncertainty-signal` | its consequence mapped through the policy's impact table |

Under the shipped policy a blocking message opens an [obligation](/concepts/obligations)
that holds the unit. A unit that deviates from a fixed decision therefore cannot close
until someone has dispositioned that deviation.

## Versions, attempts and replanning

A contract has an `id` and a `version`. A further attempt at a blocked unit runs under
the same version, up to the budget's attempt ceiling. A different version means a
replan: a new contract, which names its `predecessor` and the reason it changed. The
loop refuses to dispatch a unit under any version other than the one it started with.

Only S3 writes contracts. `provenance.createdBy` must be `"S3"`, and no model-facing
tool sets it. The contract deliberately has no field for authority, capabilities or VSM
functions. What a unit may do is its profile's grant, and keeping that out of the
contract means a contract a model could edit cannot widen the grant.

## Where each part is enforced

| Rule | Mechanism |
| --- | --- |
| a contract's and a report's shape | runtime schemas (level 3) |
| authority references resolve; there is no `resolve-before-execution` decision; the unit type exists; the attempt ceiling is not used up; there is no open blocking obligation | the dispatch gate (level 2) |
| every delegated and unresolved decision is accounted for | the `report_result` check (levels 2 and 3) |
| the cited test and command runs happened here, at this revision, and passed | the evidence preflight (level 2) |
| the work passed | the technical verdict over host evidence (level 2) |
| the unit knows what the contract says | the contract rendered into the system prompt every turn (level 5) |

Everything the rendered contract tells the model is also enforced by one of the gates
above. The prompt exists so that the model is not surprised by them.

## What is not there yet

The registry records for the [contract gate, the report gate, the evidence preflight and
the closeout gate](/reference/regulators) state their limitations. In short:

- The report gate reads only the report. A unit can report an unresolved decision as
  `preserved` while its diff settles it, and the gate cannot see the difference.
  Catching that falls to audit.
- Bounds and consequences are text. Nothing checks that a delegated choice fell inside
  its bounds, or that `consequenceIfWrong` is honest. A `low` emergent decision is noted
  as trace, and nobody reads it.
- Evidence binds by class. Without a content check, a passing run of any test satisfies
  every `test`-class criterion.
- `runtime` criteria need a person. Apart from `export-signature`, no host mechanism
  observes runtime behaviour, so a `runtime` expectation without a content check waits
  for an acceptance.
- A named person is not a verified authority. `human:<name>` resolves by form alone. The
  loop does not check that the person held the authority, or that a `--by` name belongs
  to whoever typed it (`docs/DEBT.md` row 28).
