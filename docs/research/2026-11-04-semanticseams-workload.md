# A SemanticSeams project as a software workload

- **Status:** open. No issue yet; the next step is in §7.
- **Source:** [SemanticSeams](https://github.com/MetaCoding-io/SemanticSeams), MetaCoding's
  model-driven application toolchain: one RDF graph holds every layer of an application
  (architecture, SHACL data shapes, IFML screens, BPMN processes, DMN decisions, a
  statechart lifecycle, ODRL permissions, deployment), the generators derive the app's
  templates, routes, compose files and tests from it, and a generic runtime interprets the
  BPMN and DMN unchanged. Cited below by its ADRs (`docs/adr/`), its principles page
  (`docs/project/principles.md`), its CLI reference (`docs/reference/seams-cli.md`) and
  the expense tutorial (`docs/tutorials/expenses/`), all at its revision of 2026-11-03.
  The second source is the conversation of 2026-11-03 that asked what regulator could
  take from it; the first answer, six mechanisms to borrow into the control plane, is
  recorded in §6 so it is not lost, and the note's proposal is the second answer.
- **Question:** can regulator run a software-development workload whose domain is a
  SemanticSeams project, so that units build the application a person asked for by
  growing the model, and the gates are the seams toolchain run by the host? What would
  the control plane have to grow to run it well?

Claims about what regulator's code does today cite the file. Claims about what
SemanticSeams does cite its ADR, page or command. The rest is proposal.

## 1. Why this domain, and why it is different from the first workload

The `software-development` workload
([`packages/regulator/workload/software-development.json`](../../packages/regulator/workload/software-development.json))
treats the domain as source files and tests. Its host checks run the project's own test
command and check commands, compare the inherited suite, and diff the protected prefixes
([`docs/reference/host-checks.md`](../reference/host-checks.md)). What a unit *writes* is
free text, and the gates can only say whether the suite still passes and whether a
declared export kept its arity. The closeout gate's first limitation says the rest:
evidence binds to a criterion by class, so a passing suite that never exercised the
changed behaviour satisfies a test-class criterion
([`registry/regulators/closeout-gate.json`](../../packages/regulator/registry/regulators/closeout-gate.json)).

A SemanticSeams project is a different kind of domain. The unit does not write the
application; it writes the *model* of the application, and a deterministic toolchain
writes the application from the model. That moves most of what regulator wants to
enforce out of advice and into the domain's own gates:

| regulator's premise | What SemanticSeams already does, mechanically |
| --- | --- |
| *Types describe* the artifact a unit writes | The model is validated against the 98 SHACL node shapes before anything is generated (`ontology/shapes/seam-shapes.ttl`); each result names the element and the fact. "A model that passes the shapes must generate" is principle 5. |
| An unresolved decision is surfaced, never settled by the unit | A generator that meets a missing or ambiguous fact raises `GeneratorError(subject, predicate, detail)` and writes nothing (ADR-0016). The project's rule "no domain literals in code, templates, stubs or drafts; if the model lacks a fact, raise it, do not hard-code it" is checked by golden tests, not by advice. |
| Generated output is never hand-edited | `seams check` compares every output with the hashes in `seams.lock` and reports each stale, missing, hand-edited or orphaned file; a flagged lock fails it (CLI reference, "seams check"). |
| Evidence should bind to content, not class | Every generated line has a sidecar naming the template line and the model elements behind it (ADR-0019), so a changed output line maps to the model fact that changed. |
| The behaviour the person asked for actually runs | Scenarios, decision examples and shape examples stated in the model become pytest files (ADR-0014); `seams coverage` lists the process paths no scenario runs, the transitions nothing fires and the permissions with no deny test, and `coverage = ["paths"]` makes `seams check` fail on them. |
| A change to stored data is a decision for a person | `seams diff OLD NEW` classifies each shape and operation-contract change as compatible or breaking from a published table and exits 1 on any breaking one; `seams plan` turns the diff into release notes. |
| A security invariant has a mechanism | `seams.toml` lists gate queries; the shipped one fails the check when any UI event can reach a data write that no policy governs (`docs/queries/gates/ungoverned-writes.rq`). |
| What runs is what was verified | `seams status` reads each running container's model hash and says current, behind, ahead or unreachable. |
| Hand-written code has a declared context | `seams context TASK` prints the hashed model facts a service task's handler depends on, with a hash over them; a changed item hash says which fact moved. |

None of this is regulator's to build. It is what the workload's fixture brings, as the
ledger brought its reconciliation and the portfolio its arithmetic
([`docs/guide/authoring-a-workload.md`](../guide/authoring-a-workload.md) step 2: write the
checks first; if the domain has no deterministic check of its own, stop).

## 2. The domain and who writes what

The domain is one seams project directory, in the shape of the expense tutorial's
chapter checkpoints (`examples/expenses/chapter-09/`):

| Path | What | Written by |
| --- | --- | --- |
| `<app>.trig`, `*.bpmn`, `*.dmn` | the model: the seams graph and the native process and decision payloads | the `modeller` profile |
| `seams.toml` | the project file: the model, the generators and their output directories, the gates, the coverage rule, the environments | the `modeller` profile, under a contract that fixes the generator list |
| `handlers/` | hand-written Python behind operations the model marks `seam:implementedBy` (ADR-0012); regeneration never touches it | the `handler-author` profile |
| `generated/`, `compose.*.yaml`, `*.trace.json`, `seams.lock` | the derived application, its tests, its smoke tests and the lock | the `regenerate` program only; protected from every session |
| `seed.json`, the fixture's README and test command | the person's | nobody under the loop |

The protected set is declared once in the instance manifest's `protectedPaths`
([`docs/concepts/definition-and-instance.md`](../concepts/definition-and-instance.md)), so
`identity-untouched` diffs it at every closeout and a unit that hand-edits a generated
file is refused by name, before `seams check` would also report it. Two layers for one
rule is deliberate: the first is regulator's, the second the domain's.

## 3. The workload

The expense tutorial's nine chapters are the unit types. Each adds one layer to one TriG
file and ends with something checkable (tutorial index, "The chapters"): architecture,
data, screens, process, rules, lifecycle, permissions, deployment, and hand-written code.
A plan unit reads the person's request and writes one contract per layer in that order.
The layers are one unit type with a layer parameter in the contract, not nine types,
because they run under the same profile and the same checks; what differs per layer is
which elements the contract lets the unit add (§4).

```json
{
  "name": "seams-app",
  "version": 1,
  "description": "An application built as a SemanticSeams model: units grow the model one layer at a time, a program regenerates the application from it, and the seams toolchain is the host's evidence.",
  "unitTypes": [
    { "name": "plan", "description": "Read the request and the model and write one contract per layer. Never changes the project.", "profile": "research", "checks": [], "requiresContract": false },
    { "name": "model-layer", "description": "Add one layer's elements to the model under a contract that names the layer and the elements it may add. Writes the model files only.", "profile": "modeller",
      "checks": ["run_tests", "inherited-tests", "identity-untouched", "glossary-lint"], "requiresContract": true },
    { "name": "regenerate", "description": "Rewrite the application from the model. A program, not a session: deterministic, judgment-free, checked afterwards like a model's work.", "profile": "modeller",
      "runner": { "kind": "command", "argv": ["uv", "run", "seams", "generate", "--project", "."], "outputs": ["generated/", "compose.development.yaml", "compose.production.yaml", "seams.lock"] },
      "checks": ["run_tests", "identity-untouched"], "requiresContract": true },
    { "name": "write-handler", "description": "Write the Python behind one operation the model marks seam:implementedBy, starting from its generated stub, with the task's context manifest as the contract's fixed facts.", "profile": "handler-author",
      "checks": ["run_tests", "inherited-tests", "identity-untouched", "glossary-lint"], "requiresContract": true },
    { "name": "add-scenarios", "description": "State what the application should do: scenarios through the process, decision examples and shape examples, until seams coverage lists no path.", "profile": "modeller",
      "checks": ["run_tests", "inherited-tests", "identity-untouched"], "requiresContract": true },
    { "name": "verify", "description": "Read seams plan between the base and the unit's model, the coverage list and the trace sidecars, and say what the model now claims. Read-only.", "profile": "research",
      "checks": ["run_tests"], "requiresContract": true },
    { "name": "close", "description": "Confirm the evidence is fresh and the open items are dispositioned. Read-only.", "profile": "research", "checks": [], "requiresContract": true }
  ]
}
```

The shape is the workload schema as it stands
([`packages/protocol/src/workload.ts`](../../packages/protocol/src/workload.ts)): unit
types with a profile, checks and a runner, `command` included. Nothing in the file needs
a new field.

**The profiles.** `modeller` grants `read`, `write`, `edit`, `grep`, `find`, `ls`, the
reporting tools and `ask_human`, with `writablePaths` of the model files and
`seams.toml`, and no `bash`, so the grant is complete at the tool boundary. The
regenerate program names the same profile as its effect declaration, as the portfolio's
programs name `manager` (#122): its outputs are inside the profile's reach by prefix and
under no consent grant. `handler-author` writes `handlers/` only, and may run the
project's test command through `run_tests` but has no shell either. `research` is the
shipped read-only profile.

**Why regeneration is a program.** The authoring guide's three tests for a program
(step 4) all pass: `seams generate` has no judgment to report, its outputs sit inside the
writable paths and under no consent grant, and its reach is its declared outputs. It is
also the one unit type whose work must be *bit-identical* to what the host would produce
from the same model (SemanticSeams principle 6, "same model, same bytes"), which is what
lets `seams check` at closeout tell a regenerated file from a hand-edited one. A session
that ran the generator through a shell would be checked the same way, but the program
makes the rule a grant rather than a check.

## 4. Contracts: the model is the authority

The work contract's three kinds of decision
([`docs/concepts/contracts.md`](../concepts/contracts.md)) map onto the model directly.

- **Fixed decisions are model facts, by IRI.** The elements the layer builds on (the
  shape a screen writes, the process a form triggers, the transition a task fires) are
  fixed, with the model's own IRI as the subject. The `authorityRef` is the instance's
  identity, which holds the model's principles as invariants (§5), or a person. A contract
  for `write-handler` carries the task's `seams context` manifest as its fixed facts: each
  `<kind> <ref> <hash>` line is a fact the handler may depend on and may not change.
- **Delegated decisions are the layer's own elements, bounded by layer.** "Add the
  screens for submitting and listing expenses" delegates the IFML elements and their
  labels, with the bound that the unit adds elements of that layer's classes only. This
  is checkable without a new mechanism: `seams plan base:<app>.trig <app>.trig` lists the
  elements each layer adds and removes by IRI, so a check that the added elements fall
  in the contract's layer is a comparison over its JSON. The same bound is what
  SemanticSeams' domain profiles declare for its editor (ADR-0018, `seam:offersClass`),
  stated there for a person and here for a unit.
- **Unresolved decisions are the facts the model lacks.** Where the request does not
  say the approval threshold, the role that pays, or what happens on an error, the
  contract lists it as unresolved with `defer` or `policy-clarification`, and the
  generator's refusal to invent it is the mechanical half of "preserve the boundary": a
  unit that hard-codes the threshold in a handler or a template fails the golden test and
  the review check, not a reviewer's eye.
- **Expected evidence is the toolchain's output.** `run_tests` is the fixture's test
  command, and the fixture's test command is `seams check` followed by the generated
  pytest files; the smoke tests run against the compose stack under the e2e flag. A
  criterion "the submit form rejects an amount under zero" is observed by the shape
  example that states it and the test the `tests` generator derives, so the evidence is
  content-specific without a new `ExpectationCheck` kind.

**Consent.** Three things a unit may propose need a person's recorded yes before they
land: a breaking change to a stored shape (`seams diff` exits 1), a new permission for a
role (an `odrl:permission` added, which `seams plan` lists under policies), and the
production environment's deploy facts. The first two are consent grants on the model
files narrowed by a check rather than by a path, which the profile's `consent[]` does not
express today (`ConsentGrantSchema` takes a tool, paths or a bash pattern,
[`packages/protocol/src/profiles.ts`](../../packages/protocol/src/profiles.ts)). The
smallest honest version is a fixed decision in every `model-layer` contract ("no breaking
change to a stored shape; ask before adding a permission") whose deviation the verify
unit reads off `seams diff` and `seams plan`, with the contract-level consent rule in the
contract of the unit that commits, as the finance workload puts it. The declared version
is in §7.

## 5. Identity

The instance's identity set is the application's, not the toolchain's. `IDENTITY.md`
says what the application is for and who its parties are; `INVARIANTS.md` carries the
model's principles as invariants a fixed decision may cite: the model is the source of
truth and no domain literal lives in code; shapes before generation; generated files are
never hand-edited; every change goes through the model. `BOUNDARIES.md` says which
prefixes are the person's. `GLOSSARY.md`'s refused words are the ones the model's labels
replace, so `glossary-lint` over added comment lines keeps a unit from reintroducing a
status string the lifecycle names by IRI (SemanticSeams principle 9: IRIs for categories,
not strings).

What the identity does *not* hold is the ontology or the shapes. Those are the
toolchain's, installed with it, and a unit cannot write them because they are not in
the project. The one new question is whether the gate queries under `seams.toml`'s
`gates` are identity (an invariant's mechanism, protected) or declaration (the
workload's, under the modeller's grant). The note's answer is identity: a gate the
modeller may delete is not a gate. They live under a protected prefix beside
`regulator/identity/`, and `seams.toml` names them there.

## 6. What the first answer proposed, kept here

The conversation's first answer read SemanticSeams for mechanisms the control plane
could borrow, before the workload framing replaced it. The six are recorded so they are
not re-derived; each maps onto a row that already exists.

1. **Declared behaviour as content evidence.** ADR-0014's scenarios, decision examples
   and shape examples, and the deny test derived per party per permission, as the model
   for a `scenarios` block on a contract that the host turns into a criterion-specific
   check. Answers the closeout gate's first limitation; under this workload the domain
   supplies it without a new check kind (§4).
2. **Every gate has a broken example, or a reason.** SemanticSeams' shape/generator
   parity inventory (`tests/test_shape_generator_parity.py`) fails on a refusal with
   neither a broken fixture the shapes flag nor an entry naming why the shapes cannot
   state it. The regulator form: a registry record's `absorbs.failureClass` must be
   exercised by a scripted drifter or carry a "not scriptable because" field.
3. **Open the host-check list as the generators are opened.** ADR-0016's generator
   protocol (a frozen object with a name, a version, preconditions and a discovery group
   that refuses mismatched or duplicate names, the version recorded per output) as the
   shape for declared checks, which is the open "declared checks for non-Node domains"
   row ([ArticleMiner note §4.1](2026-09-25-articleminer-knowledge-production.md#41-convention-discovery-and-test-parsing-are-node-only)).
4. **Lenient preview and a scaffold that passes as written.** `seams generate --lenient`
   records faults in the lock instead of refusing, and `seams new-generator NAME
   --reference FILE` writes a package whose golden test passes immediately; the template
   for `regulator workload new` ([#61](https://github.com/MetaCoding-io/regulator/issues/61)).
5. **Diff and plan over definition versions.** `seams diff` and `seams plan`, with their
   compatible-or-breaking table, as the model for a `regulator plan OLD NEW` over the
   definition that generates the migration note `upgrade` prints by hand today.
6. **Coverage as a gate.** `seams coverage` (unfired transitions, permissions without a
   deny test, paths no scenario runs) as the runtime complement of typing the unit
   lifecycle ([ADT note §3.3](2026-11-02-algebraic-data-types.md#33-the-lifecycle-is-a-state-machine-held-as-data-not-as-a-type)):
   `UNIT_TRANSITIONS` rows no test takes, checks that never refused anything in the drift
   suite, writable prefixes no fixture touches.

None of the six is needed to run the workload in §3. They are what a workload author
would notice is missing after running it, and each has a row to land in.

## 7. What the control plane would have to grow

Read against the authoring guide's checklist, almost nothing. In order of what blocks
the first run:

| Need | Level | Existing seam | What is new |
| --- | --- | --- | --- |
| The domain's checks, in a Python domain | 2 | `run_tests` discovers `package.json`'s `scripts.test` ([`packages/checks/src/conventions.ts`](../../packages/checks/src/conventions.ts)) | **Decide this first**, as the statistics note did ([§4](2026-10-26-agentic-statistics-course.md#4-what-the-control-plane-would-have-to-grow)). The bridge is a `package.json` whose test script runs `uv run seams check --project .` and `uv run pytest -q generated/tests`; `run_checks` finds nothing to run and says so. The honest version is declared checks for non-Node domains (ArticleMiner §4.1), and this workload is its second consumer after the statistics report. Nothing else here waits on it. |
| `seams` on the instance's PATH | — | the environment the instance runs in | A deployment matter: `uv sync --all-packages` in the project, or the CLI published. `regulator doctor` could say when it is missing, as it says when `node` is. |
| The fixture | — | `regulator fixture <dest> --seams-app` ([`packages/regulator/src/cli.ts`](../../packages/regulator/src/cli.ts)) | Chapter 3 of the expense tutorial, the smallest checkpoint with a generated app and a running check, copied with its `seams.toml`, its lock and a `package.json`. Chapter 9 as the end state the scripted honest unit reaches. |
| Consent narrowed by a check, not a path (§4) | 2 | `ConsentGrantSchema` (tool, paths, pattern) | A grant of the form `{ "tool": "write", "paths": ["<app>.trig"], "when": { "check": "seams diff --json", "exit": 1 } }`: the host runs the check on the proposed write and asks only when it fails. Not needed for the first run; the fixed decision in §4 covers it. Fits the open "declared checks" row rather than a seam of its own. |
| Added elements fall in the contract's layer (§4) | 2 | `seams plan --json`; a contract's delegated bounds | A content check in the shape of `export-signature`: `{ "kind": "layer", "layers": ["interfaces"] }` on an expectation, satisfied when every element `seams plan` lists as added is in a named layer. The first `ExpectationCheck` kind a workload would contribute rather than the harness; its design is the declared-checks row's. |
| The scripted drifter | — | the drift suite's scripted behaviours ([`packages/regulator/src/evals-scripted.ts`](../../packages/regulator/src/evals-scripted.ts)) | Four shortcuts, each refused by a named seams finding: hand-edit a generated template (`hand-edited`), hard-code the approval threshold in a handler instead of the DMN table (the golden and review checks), add a form that writes a shape with no policy (the gate query), raise a `minCount` on a stored shape (`seams diff`). SemanticSeams keeps a broken example for each already, because its parity test requires one per refusal. |

What the workload does **not** need: a new runner kind, a new tool, a new policy, or
RDF anywhere in regulator. The model is the domain's; the control plane reads it only
through the toolchain's exit codes and JSON, as it reads the ledger through its tests.
That is the point of the fit: SemanticSeams' deferred-until-proven list and regulator's
("RDF/SHACL" in `AGENTS.md`) are the same decision made from both sides, and this
workload runs without either side moving.

## 8. What a person would experience

They describe the application. The plan unit writes contracts by layer, citing the
model's existing elements by IRI as fixed, delegating the layer's own elements, and
listing as unresolved every fact the request does not state. Units grow the model; the
regenerate program rewrites the application; the generated scenario tests and the smoke
tests run against the compose stack; the verify unit reads the generated change plan
rather than the unit's report. The person is asked where the toolchain cannot decide: a
breaking change to stored data, a new permission for a role, the production
environment. Everything else closes on the toolchain's evidence at the committed
revision.

Next step: decide the Python-domain question in §7 (recommendation: the `package.json`
bridge for the first run, with the declared-checks row as the destination), then the
fixture from chapter 3 under [#61](https://github.com/MetaCoding-io/regulator/issues/61).
