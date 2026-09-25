# ArticleMiner as a knowledge-production workload

- **Status:** open
- **Sources:** [ArticleMiner: Ontology-Guided Knowledge Graph Construction from Scientific
  Publications](https://arxiv.org/abs/2609.25607) (ISWC 2026 submission) and its
  [implementation](https://github.com/Abrar2652/articleminer-iswc26); a design
  conversation (2026-09-25) that mapped its pipeline onto the control plane.
- **Question:** could `regulator` run ArticleMiner's pipeline as a workload, and what
  would it have to grow to run it *well* — that is, with the same evidence, authority
  and feedback structure the software and finance workloads have?

## 1. What ArticleMiner is

ArticleMiner reads a paper and its supplementary files, runs several PDF parser backends
(Docling, Marker, MinerU, PDFPlumber, Camelot) over them, reconciles what the parsers
found, asks a language model to extract quantitative facts under a domain **task
module**, normalizes and validates the result deterministically, and writes a knowledge
graph: JSON-LD, Turtle, a provenance log per extraction and a run manifest (parameters,
model ids, token counts). A task module is a human-authored Python file
(`src/ontology/ontology_<domain>.py`) that declares canonical names, surface-form
mappings, derivation rules, validity constraints, identity keys for tuple matching, and
RDF bindings — "what a task is allowed to emit", not every convention of a field. The
correction model may propose structural hints (header row, transposition, units row);
the deterministic parser is re-run under them. Model-suggested deletions are advisory;
only deletions matching conservative deterministic patterns are performed.

Two evaluation findings matter to a control plane. Removing validation drops F₁
measurably, so the deterministic layer is doing real work. And no parser strategy wins
everywhere: multi-backend consensus helps in some domains and a single backend beats it
in others, so *which backends run* is a policy with evidence behind it, not a default.

## 2. The mapping, and what is already true of it

The conversation's mapping of ArticleMiner's responsibilities onto S1–S5 holds, with one
correction: the task module does not split across S5 and S1 as neatly as stated. Its
declarative half (vocabulary, schema, invariants, identity keys, bindings) is S5 in the
sense the finance example already uses — a protected domain file a contract cites as
authority — and its procedural half (normalization, derivation) is an S1 mechanism whose
version S5 pins. Both are already expressible; see §3.

| Function | ArticleMiner responsibility | In `regulator` today |
| --- | --- | --- |
| S1 | parse, extract, normalize, build RDF | a unit under a profile, in a worktree, under a contract |
| S2 | deduplicate parser outputs, reconcile, join on identity keys, no output collisions | leases, worktree isolation, reintegration by merge; nothing semantic ([#14](https://github.com/MetaCoding-io/regulator/issues/14)) |
| S3 | pick the module, contract per paper, budgets, sequence stages, route failures | the loop, the budget policy, the recovery policy; no sequencing between units |
| S3\* | schema, vocabulary, identity uniqueness, ranges, provenance, SHACL, totals | `run_tests`/`run_checks` at the revision, plus the branch-relative checks; Node-only discovery |
| S4 | parser and model drift, new layouts, changing vocabularies, unknown terms | the `research` unit type, `report_intelligence` routed into obligations; the eval harness |
| S5 | what may be emitted: vocabulary, schema, invariants, identity key, provenance rules, bindings | the four identity files; protected prefixes in the manifest cited by `authorityRef` |
| algedonic | irreconcilable parser disagreement, unknown canonical term, missing supplement | `ask_human` by kind; an `unresolved` decision handled by `defer`; obligations owed to a person |

The recommendation stands: make this the first **knowledge-production workload**, and
the third workload [#61](https://github.com/MetaCoding-io/regulator/issues/61) asks for.
It is a better test of "generic over workloads" than another repository, because most of
the pipeline is not a language model: parsers, rules, validators and a person share the
loop with one.

## 3. What runs today

Checked against the code, not the README.

- **A contract per paper, one `extract-paper` unit type wrapping the whole CLI.** The
  workload schema (`packages/protocol/src/workload.ts`) needs a name, a profile and a
  list of host checks per unit type; nothing else. A profile with `bash` runs the Python
  CLI. This is the conversation's phase 1 and it is a definition change, not a code
  change — with the two snags in §4.1 and §4.2.
- **The task module's declarative half as S5.** `regulator init --protected
  ontology/` puts the module outside every write grant; `identity-untouched` refuses a
  closeout that changed it; a contract's fixed decision cites it. This is exactly how
  `categories.json` is held in the finance example
  ([`docs/examples/personal-finance.md`](../examples/personal-finance.md) §1, S5). A
  model may still *propose* a change to it through `propose_policy_change`; nothing
  accepts one mechanically (§4.5).
- **Model judgment proposes; mechanisms decide.** The corrector-never-certifies rule is
  the loop's structure: the unit writes a report, the host re-runs the checks at the
  committed revision, the report's claims satisfy nothing (`closeout-gate`). A repair
  attempt under the recovery policy is the "attempted recovery"; its evidence is bound
  to its own revision. What the loop does *not* do is compare an attempt's evidence with
  the previous attempt's (§4.4).
- **The unknown canonical term.** An `unresolved` decision with `handling: defer` and a
  report that records it as `surfaced` — the unknown merchant, verbatim. A parser
  disagreement nobody can settle is `ask_human` with `kind: clarification`; the unit
  pauses, the question is owed to a person, silence is not an answer.
- **Evidence bound to a revision, in a stated environment.** `EvidenceRecord` carries
  `revision` and `environment` (`packages/protocol/src/audit.ts`); the protocol does not
  say the revision is a git sha. The loop does (§4.2).
- **The adaptive loop's parts.** Intelligence raises an obligation; a proposal is owed
  to S5; the eval harness runs a suite over a fixture under declared arms with
  pre-registered metrics and a fingerprint; a definition change is a pull request. What
  is missing is the gate between them (§4.6).

## 4. What it asks the control plane to grow

Each item: the gap as observed in the code, what exists beside it, a proposal at a
mechanism level, and the seam it hangs on. Ordered by how early a first slice needs it.

### 4.1 Convention discovery and test parsing are Node-only

`discoverConventions` (`packages/checks/src/conventions.ts`) finds a test command in
`package.json` `scripts.test` or a `test/` directory, and finds checks by running
`node --check` over `.js` files under `src/` and `lib/`. `run_tests` then parses Node's
test-runner summary (`# pass N`, `ℹ pass N`) and records *inconclusive* when it finds
none. A Python pipeline's `pytest` or SHACL run therefore cannot be `run_tests` today
even behind an `npm test` shim, and `run_checks` would find nothing to run. The
conversation's "make `run_checks` execute ArticleMiner's validation" does not work as
stated.

**Proposal (deterministic gate; the workload definition).** Let a workload *declare*
its checks where it cannot rely on discovery: a unit type's check entry may be a
command — `{ name, argv, okWhen: "exit-zero" | "stdout-empty" | "tap" | "junit" }` —
run in the worktree at the revision like the discovered ones, recorded under
`run_checks:<name>` with the same binding. Discovery stays the default; declaration is
the workload's override. `regulator check` validates the shape. This is the smallest
change that lets a non-JavaScript domain produce host-owned evidence, and it is what
`test/ledger.test.js` already is for the finance workload, said explicitly.

Cost: a new card (or a limitation on `closeout-gate`) saying a declared command is
trusted to be the project's check, as the discovered `npm test` already is. Nothing
about independence changes: the host runs it, not the session.

### 4.2 The domain is a git repository

This is the largest gap and the one the conversation understates. The protocol is
domain-neutral; the loop is not. Every one of these assumes git:

| Where | Assumption |
| --- | --- |
| `unit.ts` `startUnit` / `resumeUnit` / `finishUnit` | isolation is a worktree on a branch; reintegration is `git merge --no-ff` into the base; a conflict is a git conflict |
| `controller.ts` `auditUnit` | the revision evidence binds to is `HEAD` of the worktree; a dirty worktree is inconclusive |
| `identity-untouched`, `glossary-lint`, `inherited-tests` | `git diff base...HEAD`, `git log`, `git ls-tree` |
| `file:` checks | a cited file exists at the revision, asked of git |
| `post-merge-check` | the base at the merge commit |
| the instance itself | `regulator/identity/` is committed *in the domain*; `.regulator/` sits beside it; the manifest's prefixes are paths |

For ArticleMiner the domain output is a graph — JSON-LD and Turtle per paper, with
provenance — and the inputs are PDFs, supplements, page images and parser intermediates.
Git holds the first badly and the second wrongly: a corpus of 163 papers with five
parsers' intermediates is not a repository, and a large PDF committed per unit is the
kind of thing the isolation model was never for. The same is true of any workload whose
truth lives in a database (a ledger in SQL, a triple store, a warehouse) rather than in
files.

**Proposal (type + deterministic gate; a new seam).** Abstract what the loop needs from
a domain into a `Domain` interface beside `Host` (`packages/regulator/src/host.ts` is
the pattern: resolved by name, never imported), with the git domain as the first and
only implementation for a while:

```ts
interface Domain {
  name: string;
  /** Give a unit an isolated workspace derived from the base; return a handle. */
  isolate(unitId: string): Promise<Workspace>;
  /** The exact, immutable state of a workspace: what evidence binds to. */
  revision(ws: Workspace): Promise<string>;
  /** Whether the workspace has state not yet part of a revision (a dirty worktree). */
  isSettled(ws: Workspace): Promise<boolean>;
  /** Make the workspace's state a revision (a checkpoint commit). */
  settle(ws: Workspace, note: string): Promise<{ changed: boolean; revision?: string }>;
  /** What changed under the protected prefixes between the base and the revision. */
  protectedDiff(base: string, revision: string, prefixes: string[]): Promise<string[]>;
  /** Bring the revision into the base; a conflict is data, never resolved here. */
  reintegrate(ws: Workspace): Promise<ReintegrationResult>;
  /** Release the workspace; the unit's records stay. */
  release(ws: Workspace): Promise<void>;
  /** Run a host check inside the workspace at its revision. */
  exec(ws: Workspace, argv: string[], opts?): Promise<ExecResult>;
}
```

What each later domain would mean by those words, so the seam is cut in the right
place:

| Domain | isolate | revision | reintegrate | conflict |
| --- | --- | --- | --- | --- |
| git (today) | worktree + branch | commit sha | merge into base | overlapping hunks |
| content-addressed artifact store | a unit-scoped namespace of blobs | hash of the unit's manifest (blob hashes by path) | publish the manifest into the base index | two units publish the same key with different hashes |
| RDF / triple store | a named graph per unit, seeded from the base graph | a hash of the graph's canonical serialization | merge the named graph into the base graph | the same subject under the same identity key with different values |
| SQL | a branch of the database (a schema copy, or a branching engine) | a snapshot id / transaction id | apply the unit's changes to the base | a row with the same key changed on both sides |

The checks that read git (`identity-untouched`, `glossary-lint`, `inherited-tests`) move
behind the same seam or become git-domain checks the definition check refuses for another
domain — `regulator check` already refuses a check the host does not run, so the mechanism
exists.

**The first slice is not the seam.** It is the artifact store beside git: contracts and
reports cite large inputs and intermediates by hash, git holds the manifests and the
graph, and the loop is unchanged. Concretely: an `artifact` evidence class (or an
`ArtifactRef { sha256, bytes, mediaType, uri }` a `file` ref may carry) in the protocol;
a `file:` check that verifies a cited hash against the store instead of asking git; a
declared store location in the instance manifest. That pays the conversation's point 3
without deciding the seam, and it is what ArticleMiner needs first: the PDFs never enter
the repository, the graph does.

Open questions the seam has to answer before it is cut (§6): where the instance's
identity lives when the domain is not a repository, and whether an instance may span
two domains (a git repository for the module and the graph, an artifact store for the
corpus).

### 4.3 Units have no graph

A workload lists unit types; a contract names one unit; the CLI drives contracts one at
a time by hand. Nothing says a `reconcile-parsers` unit needs five `parse-source` units
closed first, or that `interpret` consumes what `reconcile-parsers` published. `contract.provenance.predecessor`
is a contract *version's* predecessor, not a dependency. `ARCHITECTURE.md` records
sequencing as not built, beside the semantic commitments of #14 — but the two are
different: #14 is what units *promise* each other about a shared boundary; this is
which unit *runs after* which, with what inputs.

ArticleMiner needs fan-out (one paper × N parser backends), fan-in (reconcile the N),
then a chain (interpret → normalize → validate → publish). A single `extract-paper` unit
hides all of it inside the CLI, which is fine for phase 1 and useless for the control
room's purpose in phase 2: which parser found the table, where they disagreed, what the
rules changed, why the graph was accepted.

**Proposal (type + deterministic gate; the plan and the execution store).** A
`UnitGraph` record — a plan-level declaration, written by S3 like a contract, held in the
execution store like a unit — with nodes that are contract refs and edges that are typed:
`{ from, to, carries: ArtifactRef | "revision" }`. The loop gains one rule: a node is
dispatchable when every predecessor is closed, and its contract's inputs are the
predecessors' published outputs, bound by hash. Fan-out is a node template with a
`forEach` over a declared list (the backend policy's set, §4.6); fan-in is a node whose
predecessors are the template's instances. The graph is execution state; nothing reads
it off the domain. It stays small: no conditionals, no loops, no retries — those are the
recovery policy's, per node, as today.

This does not widen the orchestrator's authority: the graph is declared, the loop still
dispatches one contract at a time, and a regulator still cannot schedule. It does need
the artifact ref from §4.2 to type the edges, which is why it comes second.

### 4.4 Checks are a closed list, and observe nothing numeric

`HOST_CHECK_NAMES` is a constant in the protocol; adding a check is a change to the
protocol, the checks package and the registry, and the definition check refuses an
unknown name. That is deliberate — every check has a card with a limitation — and it is
right for the checks that are *the harness's* (identity, glossary, inherited tests). It
is wrong for checks that are *the domain's*: `jsonld-schema`, `shacl`, `identity-unique`,
`provenance-complete`, `composition-sum`, `controlled-vocabulary` are ArticleMiner's, and
the next workload has its own six.

§4.1 covers most of this: a declared command *is* a domain check, and a workload ships
it. Two things a command cannot carry:

- **Criterion binding.** `export-signature` binds its record to one expectation by
  content (`criterion`); a declared command binds by class, which is row 2's original
  problem. Let a declared check name the expectation id it observes, so a contract can
  say "the graph conforms to the shape" and the record binds to that and nothing else.
- **A numeric observation.** Every record's `observation` is text and its verdict is
  three-valued. ArticleMiner's correction loop and its S4 loop both need a *measure*:
  rows recovered, composition total, F₁ against a reference. Add an optional
  `measure: { name, value, unit }` to `EvidenceRecord`, and a check kind that compares an
  attempt's measure with the previous attempt's (`improves-on: <measure>`) so a repair
  that made things worse is a failing check, not a passing one that happens to differ.
  This is the mechanical form of "the correcting model never gets authority to declare
  its own correction successful": the host compares before and after.

A plugin interface in `packages/checks` (a check as a module the workload names, with a
registry record the definition check requires) is the longer form; the declared command
with a criterion and a measure covers the first workload without it. RDF and SHACL stay
deferred in the core, as `AGENTS.md` says; a workload that ships a `shacl` command is
not the core's.

### 4.5 S5 authority over domain semantics

`authorityRef` resolves to an invariant, a registry record, an obligation or a person
(`checkAuthorityRefs` in `packages/core/src/identity.ts`). The finance example's taxonomy is cited through a
person (`human:alice`) because it is not one of those. ArticleMiner's task module is the
same shape, and it changes: a vocabulary grows, an identity key is corrected, a binding
moves. Today the change is a pull request to the domain; the model's proposal (through
`propose_policy_change`, owed to S5) is text a person turns into a commit by hand, and
the S5 decision path (`regulator identity accept`) writes only the four identity files.

**Proposal (type + deterministic gate; authority resolution and the S5 decision path).**

- An `authorityRef` may name a protected domain artifact at a version:
  `domain:ontology/geochemistry.json@<sha256>`. The contract check resolves it against
  the store (§4.2) or the repository, and refuses a version that does not exist or a
  path the manifest does not protect. A fixed decision then pins the module version the
  unit ran under, which is what "version-pinned by S5" means mechanically.
- The S5 decision path accepts a *declared semantic file* under a protected prefix the
  manifest marks `s5: true`, with the same rules as an identity file: the only writer,
  an invalid result reverted (validated against the file's own schema, which the
  workload declares), a commit citing the obligation. Then a model's proposed vocabulary
  change is an obligation owed to S5, accepted or rejected by a person with `actAsS5`,
  and the next contract cites the new version.

Nothing here lets a unit change the module; that boundary is already
`identity-untouched` over the protected prefix.

### 4.6 The adaptive loop needs a gate between evidence and policy

The conversation's most valuable observation: which parser backends run is a policy, S3\*
records how the policy performed, S4 proposes a change, S5 accepts it, and the new
policy is evaluated against a reference corpus *before* promotion. The parts exist
(§3); three things do not.

- **A workload-level policy field.** The policy files carry budgets, model routes,
  recovery, routing, interaction. A backend set is none of those. Add a `workload`
  section to the policy schema — an object the workload's own schema validates
  (`{ backends: ["docling", "marker", ...], consensus: "majority" }`) — that a contract's
  fixed decision cites (`authorityRef: "policy:finance@3#workload.backends"`) and a
  `forEach` node (§4.3) expands over. A changed policy is a new version; nothing else
  about the mechanism is new.
- **Workload-declared outcome graders.** The eval harness's graders are the drift
  suite's (`packages/regulator/src/graders.ts`). A suite over a paper corpus with ground
  truth needs a grader the workload ships: a declared command that reads the instance's
  published outputs and the fixture's ground truth and emits the pre-registered metrics.
  The suite schema already carries `metrics[]`; it needs `graders[]` as commands.
- **Evidence-gated promotion.** `identity promote` carries an accepted identity file into
  the definition's seed, refusing a dirty definition. Its analogue for a policy version
  — `policy promote <file>` — should additionally refuse when no committed eval report
  with the current fingerprint shows the new version at or above the baseline on the
  suite's pre-registered metrics. That is the gate the conversation describes, and it is
  a small addition to an existing command: the report's fingerprint already records the
  policy versions the run used (`EnvironmentFingerprintSchema.policies`), so the command
  has what it needs to match a report to the version being promoted.

### 4.7 Budgets

A ceiling has `tokens`, `cost`, `wallClockMs`, `turns` and `attempts`; the conversation's
"not only tokens and turns" is half true — cost and wall-clock exist, metered from the
provider's reports and session start. Missing, and meaningful once §4.2 exists:
`artifactBytes` (what a unit may publish) and `cpuMs` (what a declared check or a
parser may spend). Both are counters the domain and the check runner can report. Small,
and after the seam, since without a store nothing can measure the first.

### 4.8 Isolation is the host's, not the profile's

The conversation asks for container isolation because ArticleMiner pulls in OCR and
vision libraries and may want a GPU. The project has already decided where that lives:
rows 8 and 19 of `DEBT.md` are *not planned*, real isolation is the operating system's
or a container's, and the deployment declares the shell's reach. Nothing here reopens
that. What ArticleMiner adds is a concrete case for the **second host**
([#58](https://github.com/MetaCoding-io/regulator/issues/58)): a host whose dispatcher
runs the unit's session inside a container with the workspace mounted, so the profile's
grant and the container's boundary are the same statement. `BOUNDARY.md` would then say
which host enforces which gate, as that issue already asks.

## 5. Phases, against the features

The conversation's four phases, restated so each names what it needs:

| Phase | What ships | Needs |
| --- | --- | --- |
| 1 — wrapped | `article-mining` workload, `article-miner` profile, one `extract-paper` unit type wrapping the CLI, a contract per paper, a fixture of a few small papers, a scripted unit | §4.1 (declared checks, `pytest`/`junit` parsing); PDFs in git for the fixture only |
| 2 — cited | inputs and intermediates by hash; the graph and manifests in git; a `file:` check against the store | §4.2 first slice (artifact refs, a store location in the manifest) |
| 3 — decomposed | `inspect-source`, `parse-source` ×N, `reconcile-parsers`, `interpret`, `normalize`, `validate`, `publish-graph`, `close`; the control room shows the disagreement | §4.3 (unit graph), §4.4 (criterion-bound checks with a measure) |
| 4 — governed | the task module under S5 authority; backend policy as a policy field; a corpus suite with a workload grader; promotion gated on the report | §4.5, §4.6 |
| later | a non-git domain end to end (an RDF store as the base) | §4.2 in full; §6 answered |

Phase 1 is a contribution under #61 and needs one small code change (§4.1). Phases 2
and 3 are the generalization the project wanted anyway — they make the third and fourth
workloads cheaper, not just this one. Phase 4 is the research claim: a control loop that
changes its own operating policy on evidence, with a person in the accepting seat.

## 6. Open questions

- **Where does the identity live when the domain is not a repository?** Today
  `regulator/identity/` is committed in the domain and protected there. A store or a
  database has no place for four Markdown files. The candidates: the instance keeps a
  repository of its own for identity and manifests (an instance *is* a small git
  repository plus a domain), or the identity moves under `.regulator/` and loses its
  history. The first keeps every mechanism that reads it; it means an instance spans two
  domains by construction.
- **May an instance span domains?** ArticleMiner wants git for the module and the graph
  and a store for the corpus. If the answer is yes, a unit's revision is a pair, and
  evidence binds to the pair.
- **What is a conflict in a graph?** Two units asserting different values for the same
  subject under the same identity key is the obvious one; two units asserting different
  *identity keys* for the same thing is #14's semantic conflict wearing RDF. The seam
  should return conflicts as data and let #14 decide what a commitment over a key means.
- **Does the S5 decision path grow to non-identity files, or does the workload get its
  own?** §4.5 assumes the former. The alternative is a `semantic-file` decision path
  per workload, which duplicates the writer.
- **Is a numeric measure an evidence record's, or a grader's?** §4.4 puts it on the
  record so a check can compare attempts. The harness's graders would read the same
  field. If measures belong only to evals, the correction loop has no mechanical form.

## 7. What the conversation got wrong, for the record

- "Make `run_checks` execute deterministic ArticleMiner validation": discovery is
  Node-only and the test parser reads Node's summary (§4.1). A declared check is needed
  first.
- "Budgets for API cost, wall time": both exist (`cost`, `wallClockMs`). CPU and artifact
  size do not.
- "Capability profiles do not provide process/container isolation": true, and decided
  — the boundary is the host's and the deployment's (§4.8), not a profile's.
- The task module "belongs to S5": its declarative half is a protected domain file cited
  as authority, which the finance example already does; what is missing is a resolvable
  `authorityRef` to a versioned file and an S5 path that accepts a change to one (§4.5).
- "A minimal implementation could work today": the workload, profile and contracts
  could; the checks could not produce evidence, and the PDFs would go into git. Phase 1
  needs §4.1 first; after it, phase 1 is a definition change plus a fixture.
