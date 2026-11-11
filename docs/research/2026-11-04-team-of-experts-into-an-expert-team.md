# A team of experts into an expert team, read against the control plane

- **Status:** open.
- **Source:** Brian "Ponch" Rivera, *Turning a Team of Experts into an Expert Team*,
  [Conceptual Spiral](https://www.conceptualspiral.com/p/turning-a-team-of-experts-into-an),
  2026. The post takes DeepMind's *The Economics of Intelligence* (Imas, Koh and Legg) at
  its word that "the individual AI agent is the wrong economic object" and that
  "competence sets the potential productivity level; coordination determines how big an
  organization can get", and asks what team science already knows about that. The
  science it reaches for is TADMUS, the Office of Naval Research programme started in
  1990 after the USS *Vincennes* shot down Iran Air 655, whose anchoring question
  (Eduardo Salas) gives the post its title; Naval aviation's Crew Resource Management and
  its seven DAMCLAS skills; shared mental models; the Flow System's boundary spanners
  and coaching; and Boyd's orientation, which Rivera adds on his own account. Its one
  concrete instrument is a three-line read-back at every handoff, with the sender
  marking the misses and the team reviewing the list at its next debrief.
- **Why a note:** the post is regulator's thesis in another vocabulary, and it names,
  from forty years of team science rather than from a harness, two things the build's
  own cards already admit are missing: a read-back at the handoff, and a measure of
  what survives one. It also disagrees with the build on one point worth stating
  plainly, because the disagreement is testable.

Claims about what the code does today cite the file, at `main` `c5ff93c`. Claims about
what the post says cite the post.

## 1. The shared thesis

The post's economics is the glossary's requisite variety: a good model plus a good
prompt is not enough ([`GLOSSARY.md`](../GLOSSARY.md) §1). Where Rivera says an expert
team is made at the boundaries between its members, and that individual skill is
necessary and insufficient, the build says *prompts advise, types describe, gates
enforce* ([`ARCHITECTURE.md`](../ARCHITECTURE.md) § Core rule). Both put the work at the
seam, not in the worker. The difference is where each thinks the seam's intelligence
should live, and §4 is about that.

## 2. The post's concepts, where each already is a mechanism

| In the post | In the build | Where |
| --- | --- | --- |
| Handoffs compress context into lossy summaries, and at scale "implicit assumptions drop out" | The work contract is a typed handoff from S3 to S1. Its fixed, delegated and unresolved decisions make the loss explicit, and an `unresolved` decision is "what was left out", named before the work starts rather than discovered after it | [contracts](../concepts/contracts.md); `work-contract-gate` |
| The receiver says what it thinks was left out | The result report's `emergentDecisions`, `deviations` and `residualUncertainty`: the three kinds of news the contract did not anticipate, each with its consequence if wrong | `report_result`; `protocol/src/contracts.ts:151`; the pathology row *Summary discards the uncertainty* ([`PATHOLOGIES.md`](../PATHOLOGIES.md) §3) |
| Shared mental model: a collective understanding every member holds | The committed identity and the current memory entries, rendered into every unit's context every turn. The build gives that copy no authority: identity in a context window is advice, and the authority is the file and the gate around it | [identity](../concepts/identity.md); [intelligence and memory](../concepts/intelligence-and-memory.md) § Operational memory; INV-004 |
| Boundary spanners between teams and multiteam systems | S2 is a set of mechanisms with no agent in it: leases, worktree isolation, reintegration and the pre-merge trial between units; the hint between attempts; the obligation and the person's answer between a person and a unit | [coordination](../concepts/coordination.md); `regulator/src/controller.ts:30` (the answer reaches the next attempt as the hint) |
| Coaching capacity inside the team, developing self-leading units | The advice files seeded per profile, accepted and promoted as decisions (`advice accept \| reject \| promote`); and the reflector, the definition's own S4, which reads an instance's records and proposes `harness-edit` changes to those files | [the accept-path split](2026-10-18-accept-path-split.md); [Harness² §7](2026-10-18-harness2-recursive-harnessing.md#7-the-reflector-s4-of-the-level-above) |
| Orientation (Boyd) shapes what the team observes and decides; mismatched orientation gives fast action in the wrong direction | S5 identity is the orientation. The wrong-direction case is drift, and whether regulation slows it is the one experiment the project answers to | [evidence about the regulators](../concepts/evidence-about-the-regulators.md); `evals/drift.json` |
| "Teams live or die by what the team leader does" | S3 is the only thing that schedules and the only writer of contracts (`provenance.createdBy` must be `"S3"`) | [contracts](../concepts/contracts.md) § Versions, attempts and replanning |
| Humans and agents coached as one team | A person is in the loop by typed obligation, under an interaction policy that names who may answer, and never by a dialog the model chooses to open | [asking a person](../concepts/asking-a-person.md); `interaction-contract`, `disposition-authority` |

The seven DAMCLAS skills map the same way, and the mapping is worth a line in the
course because it is the one place a learner from aviation or medicine will already
have the vocabulary: decision making is the three kinds of decision; assertiveness is
`ask_human` and the algedonic path; mission analysis is the contract; communication is
the typed channels with authority per kind; leadership is S3 and S5; adaptability is
the versioned recovery policy; situational awareness is S4, the memory store and the
control room.

## 3. What the post has that the build does not

### 3.1 The read-back at dispatch

Rivera's one instrument: after a handoff, the receiver writes three lines, its
understanding of the goal, its next step, and what it thinks was left out; the sender
marks every miss. The build has the sender's half (the contract) and a form of the
receiver's half after the fact (the report), and nothing in between. The dispatcher
renders the contract into the system prompt every turn
(`regulator-pi/src/contract.ts`) and the unit starts. Whether the unit understood the
contract is first observed at closeout, by the report gate, after the budget is spent.

The seam already exists. A `recap` is the one interaction kind that continues without an
answer (`protocol/src/interaction.ts:39`, `CONTINUES_WITHOUT_ANSWER`), it is advisory, it
does not count against the attention budget, and it reaches the outbox. A **dispatch
recap** is a recap the unit is told to offer before its first effectful tool call, with a
typed body: the goal in its own words, its first step, and what it thinks the contract
left out. Three mechanism levels, in order:

1. the shape is a typed message (level 3): three required strings on a `recap` whose
   `subject` is the contract id, recorded like any interaction;
2. whether one was offered is a deterministic gate (level 2): the lease gate already
   refuses every effectful tool without a live lease, and the same interception can
   refuse the first effectful call of an attempt until the dispatch recap is on record.
   A scripted behaviour that skips it is the cheapest test;
3. whether it matches is judgment (level 4) or a person's: the recap sits in the
   outbox beside the contract, and a person marks the miss with the existing
   `regulator answer` on the advisory obligation. A model judge comparing the two is
   the same `model-judgment` instrument as #49's, with the same calibration duty.

What it buys is early. The post's point is that the miss found at the read-back costs
three lines, and the same miss found at the debrief costs the work. Here the miss found
at the dispatch recap costs one turn, and the same miss found by the report gate costs
an attempt. Under the shipped budget that is the difference between a note in the
outbox and a `repair`. The third line, "what was left out", is also the one input the
contract's own authors never get today: a planner is told that a delegation had no
bounds only when the schema refuses the empty array at dispatch, and is told that a decision
was missing only when a unit settles it and the report gate catches the settlement, if
it does. The dispatch recap tells S3 before the unit does anything.

What it does not buy: a unit that reads back the contract perfectly and then drifts.
The behavioral canary's row says why a fluent restatement proves nothing about the
fortieth turn ([`PATHOLOGIES.md`](../PATHOLOGIES.md) § Attention decay). The read-back
tests the handoff, not the work, and the post is careful to say the same.

### 3.2 Handoff fidelity as a declared metric

The post's last recommendation is team benchmarks: measure how well a multi-agent
system shares context across handoffs, since every public benchmark scores one model
against one person. The drift suite pre-registers its metrics before a run
(`evals/drift.json`, `metrics[]`), and every one of them measures drift on the base:
boundary violations, signature drift, vocabulary drift, memory that became a rule, a
weakened suite. None measures the handoff.

The graders the post asks for are already named, in DEBT row 40 and #49, in the
build's own words: undelegated consequential decisions discovered during execution,
fixed-decision deviations, delegated-decision completion, planned versus emergent
uncertainty, and replans attributable to the contract. Every one of them is a field of
every result report (`delegatedResults`, `unresolvedOutcomes`, `emergentDecisions`,
`deviations`, `residualUncertainty`) and nothing reads them. Read through the post, row
40 is the handoff benchmark: each is a miss, counted at the boundary between the
contract and the unit. Two additions the post's framing suggests, both deterministic
over the stores:

- **misses per handoff**, a sum over the row-40 counts per attempt, so a suite can
  compare arms on it and the interpretation rule applies as it does to drift;
- **misses by boundary**: the same count keyed by which seam it crossed (contract to
  unit; attempt to attempt via the hint; unit to unit via the base; person to unit via
  an answer). That is the post's second recommendation, *locate the gaps*, as a
  table. The architecture page already says S4 should detect recurring uncertainty
  clusters across units and treat them as a sign the system is underspecified
  ([`ARCHITECTURE.md`](../ARCHITECTURE.md) § S4); this is the count that would let it,
  and it is not built.

With the dispatch recap on record, a third one becomes possible: the miss the read-back
caught against the miss the report gate caught, per contract. If the first is not
smaller than the second the recap is costing a turn for nothing, and that is the
ablation arm the read-back's card would name.

### 3.3 The sender marks the miss

In the post the sender grades the read-back. In the build nobody grades what a unit
reported against what S3 meant: the contracts page says a `low` emergent decision "is
noted as trace, and nobody reads it", and the bounds of a delegation are text that
nothing checks ([contracts](../concepts/contracts.md) § What is not there yet). The
prediction record is the nearest existing thing: a claim with a horizon, resolved from
the stores and never from the unit's own report
([intelligence and memory](../concepts/intelligence-and-memory.md) § Predictions). The
dispatch recap's advisory obligation gives the sender's mark a place to be recorded,
and row 40's graders give it a place to be counted.

### 3.4 The debrief

The post's team reviews the miss list at its next debrief. The build has no
retrospective over an instance's records: the reflector is the designed one, and it is
after #46 ([`ROADMAP.md`](../../ROADMAP.md) § Threads). A `regulator misses` read over
the stores, the row-40 counts by contract and by boundary, is the debrief's input and
costs nothing the reflector does not already need.

### 3.5 Between units

The post puts its boundary spanners where teams meet. Between two units the build has
line-level merge and the pre-merge trial, which runs the two checks on the merged tree
([coordination](../concepts/coordination.md) § Reintegration); a semantic commitment one
unit makes and another depends on is #14. Nothing in the post changes that design. What
it adds is the argument for ordering: the handoff that has no read-back and no measure
is the one the post would expect the misses to cluster at, and §3.2's by-boundary count
is how to find out before building #14's commitments.

## 4. Where the post and the build disagree

TADMUS's result, which the post inherits, is that expert teams coordinate *implicitly*:
under load they communicate less and rely on the shared mental model, and the training
investment goes into that model. The build bets the opposite for agents. A shared model
held in a context window does not survive compaction or attention decay (two rows of
[`PATHOLOGIES.md`](../PATHOLOGIES.md) §3), and it does not survive a model change at all, so the model of the team lives
in the definition, the copy a unit holds is advice, and coordination between units is
explicit and typed. Nothing between two units is implicit on purpose.

The reconciliation is to ask whose shared mental model the post is talking about. Here
the team is the people and the definition. The people hold the model; the definition is
its written form; the units are handed it every turn and held to it by gates. That is
not a rejection of the post's finding but a statement about which members of the team
can be trusted to hold a model between one turn and the next.

It is also a claim the harness can test, and today it does not. The drift suite's
`control` arm has no identity and no checks; `treatment` has both; each ablation arm
drops one check. No arm has the identity rendered and no check: the *shared mental
model only* arm, the post's bet run as an experiment. One arm, declared in
`evals/drift.json` with `identity: true` and `checks: ["run_tests"]`, with the
pre-registered drift metrics and the interpretation rule as they are, would say what
the gates add beyond the shared model, and, with §3.2's count, what the shared model
adds to the handoff. The course's lesson on identity is the place the result belongs.

## 5. What to do with it

| Slice | Level | Seam | Where it lands |
| --- | --- | --- | --- |
| The dispatch recap: typed body, refused-until-offered on the first effectful call, a scripted behaviour that skips it | 3, 2 | `ask_human` and the lease interception in `regulator-pi` | an issue under `roadmap:0.2`, after #46; one registry record with its ablation switch |
| Misses per handoff and by boundary, over the report fields row 40 names | 2 | `regulator/src/graders.ts`; `metrics[]` | an addition to #49's done-when list, not a new issue |
| The *model-only* arm | — | `evals/drift.json` | one arm in the suite, under #46's live run |
| `regulator misses`: the debrief's read over the stores | 2 | the read model | the reflector thread, as its first input |

None of these is scheduled by this note. The first is the one the post's evidence is
strongest for, and it is small.

## 6. Reading

- Salas, E., Cannon-Bowers, J. A. and Johnston, J. H., *How can you turn a team of
  experts into an expert team? Emerging training strategies*, in Zsambok and Klein
  (eds), *Naturalistic Decision Making*, 1997, the source of the post's question; and
  Cannon-Bowers and Salas (eds), *Making Decisions Under Stress*, 1998, the TADMUS
  volume, for the shared mental model and the implicit-coordination finding §4 argues
  with.
- Marschak, J. and Radner, R., *Economic Theory of Teams*, 1972, which the post cites
  for the claim that a team's information structure, not its members, sets its value.
  It is the formal version of §1, and the vocabulary pilot's formal model (#103) should
  cite it.
- Boyd, J., *Organic Design for Command and Control*, 1987, for orientation as the
  thing that shapes observation; the post's own addition to the TADMUS material, and
  the reading behind §2's line that S5 identity is the orientation.
