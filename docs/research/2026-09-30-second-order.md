# Second-order cybernetics: who regulates the regulator

- **Status:** open. The decisions taken so far are in §9; each proposal graduates on its
  own.
- **Source:** a design conversation (2026-09-30) that began from a question — can agents
  develop their own workload definition, given that signals today either reach a person
  or reach a model as text? — and a second model's answer to it, checked against `main`
  at `e208871`. Claims about the code cite the file; claims about the cyberneticians are
  about their published positions, paraphrased.
- **Why a note:** the question touches the definition, the S5 decision path, the eval
  harness, the registry and the course at once. The parts of an answer already exist in
  three other notes; this one says how they fit, what is missing, and where the design
  work lives.

## 1. The question, and a frame for it

First-order cybernetics describes a regulator from outside: the controller, the
controlled, the feedback. Second-order cybernetics puts the observer inside the
description. The distinctions a regulator draws, the measures it takes and the
boundaries it assumes are its own choices, and its own actions show up in what it later
observes. For `regulator` that turns one question into two:

- *Operational:* why does this unit keep failing its checks?
- *Reflexive:* are the checks classifying useful work as failure, and are the retries
  producing the failures they count?

Gregory Bateson's levels of learning give the question an order that maps onto the code:

| Level | What changes | Here today |
| --- | --- | --- |
| Learning 0 | nothing: a fixed response | a gate refuses; a check fails (`packages/checks`) |
| Learning I | the choice, within a fixed set of alternatives | the recovery router picks an action under a versioned policy (`packages/protocol/src/recovery.ts`) |
| Learning II | the set of alternatives | the workload, the checks, the success measure. Today: a person, by pull request |
| Learning III | how sets of alternatives are made | nothing, and §8 argues it stays with people |

Lessons 01–13 build Learning 0 and I. Lesson 14 starts on II by making regulators
objects of evidence. This note is about II, and about where III stops.

## 2. What is already second-order in the code

More than the question assumed:

- **Arms vary the definition.** An `EvalArm` overrides the implement unit type's checks,
  the extensions loaded and whether identity is carried, against a declared baseline
  (`EvalArmSchema`, `packages/protocol/src/evals.ts`). The report's
  `EnvironmentFingerprintSchema` records the definition versions a run used. A
  candidate definition evaluated against the incumbent is an arm, widened.
- **The regulators are already under evaluation.** `glossary-lint` refused correct work
  over commit-message vocabulary; the evidence showed the cost, and the workload made
  that half advisory (#47, `CheckOptionsSchema` in `packages/protocol/src/workload.ts`,
  `docs/concepts/evidence-about-the-regulators.md`). That is a reflexive correction, made
  by hand.
- **Seed, accept, promote.** Instance identity is seeded from the definition, changed
  only through `identity accept` under S5 authority, and carried back into the seed by
  `identity promote`, which refuses a dirty definition (`packages/regulator/src/cli.ts`).
  This is a working two-level path between an instance and its definition.
- **Instruments and self-fulfilling predictions.** [Open questions §4](2026-09-25-open-questions.md#4-predictive-intelligence-s4-as-a-model-of-outside-and-then)
  proposes instrument records beside regulator cards, and names the predictor that
  causes the escalation it predicts.
- **Evidence-gated promotion and measures.** [ArticleMiner §4.4 and §4.6](2026-09-25-articleminer-knowledge-production.md#44-checks-are-a-closed-list-and-observe-nothing-numeric)
  propose a numeric `measure` on evidence, `improves-on`, workload-declared graders and
  `policy promote` gated on a report whose fingerprint matches.

What the second model got right, checked: `PolicyProposalSchema.requestedChange` is
`Type.Unknown()` in the protocol and a non-empty string at the tool
(`packages/protocol/src/index.ts`); replan, remediate and clarify end as "awaiting …" for
a person (`packages/regulator/src/controller.ts`); `AGENTS.md` defers autonomous S5
mutation. What it missed is §3.

## 3. The observer is part of the loop

The 2026-09-29 live drift run is the second-order failure this note is about, and it is
on record ([live drift runs §2](2026-09-29-live-drift-run.md#2-what-the-012-run-says-about-the-arrangement)).
The budget guard halted `d5-memory` at its ceiling — the regulator's own intervention —
and the dispatcher read the resulting abort as a provider failure, failed over to dead
models, and routed `dispatch-error` instead of `budget-exhausted`. The regulator
observed its own action as the environment failing. The failure observer's card already
states the blind spot: it classifies error text with a regular expression
(`docs/concepts/recovery.md`, limitations). The fix read the ledger; the general lesson
is wider than the fix.

The same run leaves a question its report cannot yet answer: no drift grader fired on
either arm — a fixture too easy, or a model too good? A grader that sees nothing and a
system with nothing to see look the same until the grader is calibrated against a
positive control.

**Proposal (type + deterministic check; the protocol and the registry).**

- *An observation names what preceded it.* A failure observation and an evidence record
  carry `precededBy`: the control actions taken on the same attempt before it was made
  (a guard halt, a compaction, a failover, a restart), read from the ledger and the
  effect journal, which already hold them. "Did we cause this?" becomes a join, not a
  judgment. The recovery router's precedence can then refuse to classify as
  environmental a failure that follows the system's own halt.
- *Instruments are declared as instruments.* Open questions §4's instrument record kind
  is the registry's place for graders and classifiers, not only predictors: the
  quantity observed, the distinction drawn, the report that last calibrated it.
  `regulator check` treats an instrument without a calibration report as it treats a
  regulator without a limitation. The scripted self-certifier and careless variants are
  the positive controls the drift graders are calibrated against.
- *Blind spots are typed.* A regulator record's `limitations` stays prose; beside it, an
  optional `observes` / `blindTo` pair names sources (tool errors, bash exit codes,
  network egress) so the control room can draw what no regulator sees. DEBT row 8
  (bash outside most mechanisms) is the first entry it would render.

Nothing here changes authority. It changes what an observation says about its observer.

## 4. Where redesign lives: one instance's S4 and S5

The conversation considered a second installation: an outer `regulator` instance whose
domain is the definition and whose units author workload changes for the inner one. It
is buildable — the definition is files in a repository, and an instance's domain is a
repository — and it is rejected (§9):

- *It splits the S3–S4 homeostat.* In Beer's model adaptation lives in the loop between
  S4 (proposed futures) and S3 (what operations can absorb). An outer installation puts
  S4 on the far side of an instance boundary from the S3 whose evidence it needs:
  `PATHOLOGIES.md`'s *S3/S4 disconnection*, designed in, then repaired with a channel.
- *The outer observer is an observer too.* It sees the inner only through what it
  measures, and optimizes what it measures. It needs the same instruments as §3, one
  level up, and a fixed point to stop the regress: a person. That fixed point exists
  already.
- *The separation would be an engineering boundary, not a level of the model.* Managing
  the definition is S4/S5 of the same viable system. The boundary earns its cost only
  when no single instance owns the thing being redesigned (many instances sharing one
  definition, §10), which is out of scope.

The real obstacle is smaller: **workloads exist only at the definition level.** The
definition's `workload/*.json` is shared by every instance; the instance has an
identity of its own but no workload of its own (`docs/reference/instance.md`). So an
instance that redesigns "its own" workload is editing everyone's. Identity already
solves the same problem.

**Proposal (type + deterministic gate; the instance, the S5 decision path, the CLI).**

1. *Seed.* `init` copies the workload files into the instance beside the identity
   files, under a protected prefix; the loop loads the instance's copy (§6.1 is the
   prerequisite).
2. *Propose.* `requestedChange` gains a typed variant, validated where the proposal is
   written:

   ```ts
   { kind: "workload-change",
     base: "software-development@3",     // the instance's current version
     candidate: WorkloadDefinition,       // validated by WorkloadDefinitionSchema and the definition check
     hypothesis: string,                  // what should improve, and why
     suite: "drift@2" }                   // the suite that will judge it; see the rule below
   ```

   A `design` unit type produces it: contract-less, so under a read-only profile, which
   the definition check already requires of a contract-less type. An S4 finding or a
   person can open the obligation it answers.
3. *Evaluate.* An eval arm may name a workload file (`arm.workload`), so the candidate
   runs as an arm against the incumbent as baseline. Today an arm overrides only the
   implement type's checks.
4. *Accept.* S5 accepts or rejects through the path that writes identity files, by a
   person with `actAsS5`. Nothing here is autonomous S5 mutation.
5. *Promote.* `workload promote <name>` carries an accepted instance workload into the
   definition's seed, refusing a dirty definition, and refusing unless a committed
   report with a matching fingerprint shows the version at or above baseline on the
   suite's pre-registered metrics — `policy promote` from ArticleMiner §4.6, for
   workloads.

**The rule that keeps the judge independent (deterministic gate).** A proposal that
changes a workload may not change what judges it. A `workload-change` whose suite was
not committed before the proposal was written, or which is accompanied by a change to
`evals/`, a grader or the suite's version, is refused at intake. Changing the work and
the measure of the work in one step makes improvement indistinguishable from moving the
goalposts. `inherited-tests` and pre-registered metrics are the same principle at the
unit level.

**Bands, not grants.** A class of changes can be authorized in advance without giving
an agent authority: S5 declares a band in the definition (retry counts between 1 and 4,
model routes from a declared set), and a deterministic gate checks that a candidate
lies inside it. That is S3 adjusting within S5's declared limits, not S5 mutation, and
it is compatible with "S5 is not an agent" as it stands. Moving the band stays a
proposal. Not proposed for the first slice.

## 5. Agreement by teachback

Gordon Pask's conversation theory holds that agreement is shown, not assumed: each party
restates the other's position in its own terms, and the restatements are compared. A
work contract today is read, not restated.

**Proposal (typed tool + deterministic comparison; the contract and the dispatcher).**
Before a unit's first write, it reports a teachback: its acceptance criteria and fixed
decisions in its own words, each bound to the criterion id it restates. The comparison
is mechanical where it can be — every criterion id restated, no fixed decision
contradicted by the unit's stated plan — and a mismatch opens a clarification
obligation instead of a dispatch. `ask_human` gets the same shape: the question, then
the person's answer restated back, so an answer misread is caught before it is acted
on. Cost: one turn per unit; measured as an arm before it is a default.

## 6. New mechanisms, for every user

Learning II in the strict sense is a new distinction: a check the system could not draw
before. Building mechanisms with `regulator` itself is ordinary software development on
a definition's repository, and the workload for it exists. The question is whether a
user who is not this repository's maintainer can do it. Today they cannot.

### 6.1 What blocks it

- **The loop does not honour a user's definition.** `init`, `doctor`, `status` and
  `identity promote` resolve the definition from the manifest's `definition.root` or
  `--definition`. The unit commands do not: `unit dispatch`, `drive` and `close` load
  the workload through `loadWorkloadFor(name)` with its default root, the package's own
  directory (`LAB_ROOT`, `packages/regulator/src/workload.ts`), and the registry from
  `labRoot` (`regulatorsP`, `packages/regulator/src/cli.ts`); policies are overridable
  only per file by flag. A user definition is recorded but not run. This is the first
  thing to fix, and may be a bug rather than a design gap.
- **Checks are a closed list.** `HOST_CHECK_NAMES` is a protocol constant and the
  definition check refuses an unknown name (ArticleMiner §4.4).
- **Enforcement points are a closed list.** A registry record's `enforcementPoints` must
  come from `ENFORCEMENT_POINTS` (`packages/protocol/src/registry.ts`, #76). A user can
  write a card; it cannot point at anything that is not this repository's code.

### 6.2 Proposal (declared shape + deterministic gate; the definition, the registry, the eval harness)

1. *The definition root is honoured everywhere.* The unit commands resolve workload,
   registry, profiles and policies from the manifest's `definition.root`, with the
   package's definition as the default.
2. *Declared checks.* ArticleMiner §4.1: a check entry may be
   `{ name, argv, okWhen }`, run by the host in the worktree at the revision, recorded as
   `run_checks:<name>`. Most user mechanisms are an S3\* observation, and a command
   carries one.
3. *Definition-local enforcement points.* A registry record in a user's definition may
   name a declared check (`check:<name>`) or a Pi extension shipped with the definition
   (`extension:<stem>`) as its enforcement point and as its ablation switch. The switch
   vocabulary already has both kinds (`AblationSwitchSchema`).
4. *Admission by evidence.* The registry's `status` already has
   `proposed | active | retired`. `proposed → active` becomes a gate: the card states
   the failure class it absorbs and a limitation, its tests exist, and a committed eval
   report runs an ablation arm that switches it off — on a suite committed before the
   mechanism was proposed — and shows the failure class absorbed at a stated cost. The
   same discipline the built-in regulators meet, made mechanical and open to everyone.

**Limitation to state on the card.** A declared check or extension is trusted code on
the host, exactly as a discovered `npm test` is. Admission shows a mechanism is
effective; it does not show it is safe. That stays the definition owner's call.

## 7. Oscillation one level up

The thrash detector counts edits to one file within one unit. A definition that is
promoted, degrades, is reverted and is proposed again is the same pathology over
definition versions — an eigenbehaviour of the redesign loop. When §4 lands, S2 gets a
declared number for it (`coordination.definitionOscillationThreshold`: changes to one
workload within a window) and a signal when it is crossed. Not needed before there is
a loop to oscillate.

## 8. What stays with people

Heinz von Foerster's position, paraphrased: only questions that are undecidable in
principle are ones we actually decide. "Does the candidate beat the baseline on the
pre-registered suite?" is decidable, so a gate can own it. "What counts as success for
this workload?" is not, so an accountable person owns it. That is the principled
footing under *authority to propose* versus *authority to activate*, and it says which
bands (§4) can ever be declared: only over questions a gate can decide.

His ethical imperative — act so as to increase the number of choices — is a criterion
the metrics do not carry. A candidate that removes an `ask_human` point, a rollback or a
pause to save the attention budget should meet a higher bar than its numbers alone set.
Recorded here as a review question for S5, not a check.

Learning III — changing how definitions are changed: the admission discipline, the
judge rule, the bands — stays a pull request reviewed by a person. Bateson thought
Learning III rare and disruptive in people; there is no reason to automate it here.

## 9. Decisions

### Decided (2026-09-30)

1. Redesign of a workload lives in one instance's S4 and S5 — a `design` unit proposes,
   an arm evaluates, S5 accepts, `workload promote` carries it upward — following the
   identity path. There is no outer regulator installation.
2. Many instances sharing one definition (fleet-level redesign) is out of scope.
3. New mechanisms are to be buildable by any user in their own definition, admitted by
   evidence (§6), not only by this repository's maintainer.
4. The course gains a part, *Who regulates the regulator*, of four lessons (§11).

### Open

- Whether `precededBy` (§3) belongs on the failure observation, the evidence record, or
  both.
- Whether the teachback comparison (§5) can stay mechanical for criteria no check
  observes.
- The shape of a band (§4) in the policy schema.

## 10. Not planned

| Item | Why not here |
| --- | --- |
| An outer installation managing the definition | §4: it splits S3 from S4, and the identity path already carries the upward recursion. |
| Fleet-level redesign across instances | Decided out of scope; the promote gate reads one instance's reports. |
| Agents changing the admission rules or the judge rule | §8: Learning III stays a pull request. |

## 11. Relationship to the course

A part after lesson 15 and before the capstone, *Who regulates the regulator*, one
checkpoint per lesson: 16, the observer in the loop (§3; the drift run as field study);
17, levels of learning (§4); 18, conversation and agreement (§5); 19, generating a new
mechanism (§6). The capstone's viability case gains one mechanism the learner designed,
with its admission evidence and its declared blind spot. The specs are in the course's
`CURRICULUM.md`.

Ordering constraint: lesson 17 needs §4 and lesson 19 needs §6.1–§6.2; lesson 16 and
most of 18 can be taught on today's code.

## 12. Order

1. §6.1: the unit commands honour the definition root. Smallest, and every later step
   depends on it.
2. §6.2 item 2, declared checks — shared with ArticleMiner phase 1.
3. §3: `precededBy`, and instrument records for the drift graders.
4. §4 items 1–3: the instance workload, the typed `workload-change`, `arm.workload`, the
   judge rule.
5. §6.2 items 3–4: definition-local enforcement points and admission.
6. §4 item 5 and §5: `workload promote`, then teachback as an arm.
