# A handoff layer: the same check at every crossing

- **Status:** open. Proposed; nothing decided, no issue. §9 names the next step, which
  needs no decision.
- **Source:** a conversation on 2026-11-24, during a review of the course against `main`
  and the planning of a later course on meaning between agents. The note has no outside
  source of its own. It joins three designs this directory already holds and one issue:
  the read-back at dispatch and the sender's mark
  ([team-of-experts note](2026-11-04-team-of-experts-into-an-expert-team.md) §3), refused
  calls and the remaining moves
  ([state-defined interface note](2026-11-10-state-defined-interface.md) §4.1, §4.2),
  the judged half of the planner-quality graders
  ([#49](https://github.com/MetaCoding-io/regulator/issues/49), DEBT row 48), and typed
  commitments between units
  ([#14](https://github.com/MetaCoding-io/regulator/issues/14)). The frame in §3 is from
  C. S. Peirce's account of communication, in a 1906 draft letter to Lady Welby. That
  passage **was not read for this note**: the dictionary that quotes it was unreachable
  on the day, so §3 paraphrases from memory and quotes nothing.
- **Why a note:** the four designs above were each written from a different source and
  each is tracked on its own. Read together they are one mechanism applied at different
  places, and seeing that changes two things: the order they should be built in, and
  where a model's judgment is allowed to sit. It also shows that most of the layer needs
  no new store.

Claims about what the code does today cite the file. They were read on `main` at
`226d4c6`, for `packages/*/src` without tests.

## 1. The question, and the answer in one paragraph

Work crosses from one party to another at a small number of known places. At each one the
build checks the two sides separately: the contract is valid before dispatch, the report
answers it at close. Since #49 it also counts what went wrong at each crossing after the
fact. What nothing does, at the crossing, is check that what arrived means what was sent.
A handoff layer would add the same three things at every crossing: what the sender meant
is on record; what the receiver took it to mean is on record before it acts; and a
comparison of the two is on record. Whether a reading was offered is a gate. Whether it
matches is a judgment, made by a person or by an instrument that informs and never
refuses. "Layer" is this note's word for a pattern. It is not a package, a store or a
loop.

## 2. What crosses today

The build already names four crossings. `HANDOFF_SEAMS` in
`packages/regulator/src/graders.ts` is `contract`, `attempt`, `base`, `answer`, and
`seamOf` assigns each attempt to one by the rule the controller uses to choose the hint
it carries.

| Seam | Sender to receiver | What is handed | Checked before | Checked after | Counted |
| --- | --- | --- | --- | --- | --- |
| `contract` | S3 to a unit, first attempt | The work contract, rendered as a system-prompt section every turn (`packages/regulator-pi/src/contract.ts`, `before_agent_start`) | `checkContract`; authority references resolve (`checkAuthorityRefs`, `packages/core/src/identity.ts`) | `report_result` refuses a report that leaves a required choice or an unresolved decision out (`checkResultReport`, `packages/core/src/contracts.ts`) | `missesAtContract` |
| `attempt` | S3 to the same unit, next attempt | The worktree and the router's hint | The recovery decision under a versioned policy | The next report | `missesAtAttempt` |
| `base` | An earlier unit to a later one | The merged tree | The pre-merge trial runs `run_tests` and `run_checks` on the merged tree (`packages/regulator/src/worktree.ts`) | Nothing typed, except a replan decided on a reintegration `conflict` | `missesAtBase` |
| `answer` | A person to a unit | The answer, carried to the next attempt as the hint (`packages/regulator/src/controller.ts`, header) | Disposition authority (`checkDispositionAuthority`, `packages/core/src/interaction.ts`) | The next report | `missesAtAnswer` |

Three more are crossings by the same definition and are not counted:

| Seam | Sender to receiver | What is handed | What exists |
| --- | --- | --- | --- |
| `question` | A unit to a person | An `ask_human` interaction | Five kinds with a fixed continue-without-answer rule; delivery to the outbox; reminders; `obligation-delivered` as its own event (`packages/protocol/src/obligations.ts`) |
| `proposal` | A unit to S5 | A `policy-proposal` | Proposal intake; the request is a string. The typed `harness-edit` exists and no unit can emit one |
| `refusal` | A gate to a unit | A `{ block, reason }` on `tool_call` | The reason is prose written at each gate. A refused consent-guarded call is recorded as an operational signal (`packages/regulator-pi/src/authority.ts`); other refusals leave no record |

In every row the middle is empty. The unit starts on the contract, and "whether the unit
understood the contract is first observed at closeout, by the report gate, after the
budget is spent" (team-of-experts note, §3.1). `docs/concepts/contracts.md` says the same
of the content: "Bounds and consequences are text. Nothing checks that a delegated choice
fell inside its bounds."

## 3. The frame

Peirce's account, as recalled: a communication involves three interpretants, not one. The
first is what the utterer means by the sign. The second is what the sign does in the
interpreter. The third is what is established between them, and it needs a ground both
already share before the sign is uttered. He names that shared ground the *commens*.

The frame earns its place because it says exactly what the build is missing, and sorts
the missing parts by mechanism level.

| In the frame | In the build | State |
| --- | --- | --- |
| The sign | The contract version, the hint, the answer, the question, the proposal, the refusal reason | On record |
| What the sign is about | References that resolve: a file at a revision, an evidence record, an invariant, a named person | Partly: authority references and evidence bindings resolve; a report's `deviations[].ref` is optional and unresolved |
| What the sender means | The sign itself, with its stated bounds and its references | On record |
| What the receiver takes it to mean | A read-back made before the first effect | **Missing** at every seam |
| What is established between them | A comparison, by whom, with a verdict | **Missing** at every seam |
| The shared ground | The identity set and the glossary, rendered from files into every session; the contract | On record, and protected |

Two things follow. The read-back is a typed message and offering it can be a gate, so it
sits at levels 3 and 2. The comparison is a judgment, level 4, and the prime directive
says where that may sit: it informs a decision that something else takes. Nothing in the
frame supports a model's comparison refusing a dispatch.

Niklas Luhmann makes the same cut as three selections (information, utterance,
understanding) with acceptance as a fourth that belongs to the next communication. The
obligation ledger already keeps those apart for signals: delivered, acknowledged and
dispositioned are three events. That source was not read for this note either.

## 4. Where each part already is

| Part of the layer | Designed in | State |
| --- | --- | --- |
| A read over the stores of what crossed each seam, per unit | team-of-experts note §3.4, as `regulator misses` | Proposed; placed in the reflector thread as its first input |
| Misses per handoff and by seam | team-of-experts note §3.2 | Landed 2026-11-15: ten built-in trajectory metrics (`handoffMisses`), pre-registered in both drift suites |
| The read-back at dispatch | team-of-experts note §3.1 | Proposed; undecided between refused-until-offered and advisory |
| The sender's mark | team-of-experts note §3.3 | Proposed. The seat exists: a recap is an advisory obligation a person can answer |
| A model's comparison | team-of-experts note §3.1 item 3; #49 | Waits on the instrument record kind (DEBT row 48) |
| Refused calls recorded and counted; one table from gate to remaining moves | state-defined interface note §4.1, §4.2 | Proposed |
| Commitments between units | #14 | Open, `roadmap:0.3`. The issue carries the design |
| Carrying what was established across compaction | Not designed | New here (§5.8) |

So one part is new, one has landed, and the rest are designed and separately tracked.
What this note adds is the claim that they are one mechanism, and what follows from
treating them as one.

## 5. Proposals

In build order. Each is at a mechanism level and against a seam that exists.

### 5.1 The seam ledger

A read model: for one unit, every crossing in its life and what was handed across it.
Which contract version; which hint, from which recovery decision; which answer, from
which obligation; which base revision; which memory entries were in scope; which advice
file. Everything is already in the execution store, the regulatory log and the manifest.
The read joins them. The pathology row "Records nobody can join" is absorbed today by
the span projection and the unit lifecycle; this is the same kind of read, keyed by seam.

Level: a read over records, like `regulator status`. Seam: `packages/regulator/src/status.ts`.
No schema change, no new store, no decision needed. This is the team-of-experts note's
`regulator misses` with the misses' inputs shown beside them.

### 5.2 The handoff as a projection, not a record kind

It is tempting to add a `handoff` record to the regulatory log. Do not. The first
architectural boundary in `AGENTS.md` is that the orchestrator owns execution state,
regulators own regulatory state, and neither infers the other. A handoff spans both: the
attempt and the contract are execution state, the obligation and the answer are
regulatory state. A stored handoff record would be a third copy that can disagree with
the other two, and `INSTANCE_STORES` is a closed list for that reason.

So the handoff is a type in `protocol` that the read model *projects*: seam, sender,
receiver, channel, what was sent (a reference), what it is about (references), the
read-back (a reference, absent until offered), the comparison (by whom, a verdict). Only
the last two are new facts, and both already have a home (§5.4, §5.5).

Level: type and read model.

### 5.3 A reference that is given must resolve

A contract's `authorityRef` must resolve, and a `harness-edit`'s diagnosis is read against
the stores at `advice accept`. A result report's `deviations[].ref` is optional and
nothing resolves it; `handoffMisses` prints `(no ref)` when it is absent. Proposal: where
a report, a read-back or a proposal carries a reference, the gate that accepts it
resolves it, by the forms `checkAuthorityRefs` already knows plus a file at the unit's
revision and an evidence id. An unresolved reference is refused at the tool, as a
malformed report is today.

This does not make references mandatory, which would be a contract and report schema
change. It makes a claim that points point at something.

Level: deterministic check. Seam: `checkResultReport` and its siblings. Limitation for
the card: a reference that resolves is not a reference that supports the claim.

### 5.4 The read-back

The team-of-experts note §3.1 is the design and this note does not restate it: a recap
the unit offers before its first effectful call, with three required strings (the goal in
its own words, its first step, what it thinks the contract left out), on the one
interaction kind that continues without an answer (`CONTINUES_WITHOUT_ANSWER` in
`packages/protocol/src/interaction.ts`) and does not spend the attention budget (the
budget counts blocking questions only, `packages/regulator-pi/src/algedonic.ts`).

Three additions from reading it as a layer:

1. **The same tool serves three seams.** On a first attempt its subject is the contract.
   On a further attempt its subject is the hint: what the unit takes the router's
   decision to ask of it. After an answer, its subject is the answer's obligation: what
   the unit will now do differently. `seamOf` already tells the three apart.
2. **Gate, not advice.** The lease gate refuses every effectful tool without a live lease
   (`packages/regulator-pi/src/coordination.ts`, the `tool_call` handler, which passes
   read-only effects by `isReadOnlyEffect`). The same interception can refuse the first
   effectful call of an attempt until a read-back is on record. An advisory read-back
   that units skip produces a metric nobody can read. Recommended: the gate, with an
   ablation switch, and the eval arm of §6 as the evidence for keeping it.
3. **It is not a second contract.** The read-back binds nothing. A unit that reads back
   one goal and pursues another is caught where it is caught today, at the report gate
   and the closeout. The read-back's job is to make the mismatch visible a turn in, not
   an attempt in.

Level: typed message (3), deterministic gate (2). Seam: `ask_human` and the lease
interception.

### 5.5 The comparison

A recap already opens an advisory obligation and reaches the outbox, and a person can
answer it. `dispositionForAnswer` treats a recap's answer as content and records the
disposition `fixed` (`packages/core/src/interaction.ts`). So the sender's mark has a seat
today, and what it lacks is a type: nothing distinguishes "matches" from "you left out
the vendored helper".

Proposal, in two parts.

1. **A typed mark.** For a dispatch recap, the answer carries a verdict (`match`, `miss`)
   and, on a miss, which of the three lines missed and the correction. The correction
   reaches the unit the way any answer does. The planner-quality counts gain the reading
   the team-of-experts note asks for: misses caught at the read-back against misses
   caught at the report gate, per contract.
2. **An instrument, when the record kind exists.** A model asked one question of two
   texts (does this read-back state the contract's goal) is the `model-judgment`
   instrument #49's judged metrics wait on, with the same duties: a labelled held-out
   set, a calibration report, a model that is not the route model of the unit it reads.
   Its reading is recorded on the recap's obligation as advice. It dispositions nothing
   and refuses nothing. Whether a class of miss holds a unit is the routing policy's
   decision, as it is for intelligence: an instrument may raise what a person or S3 then
   decides, and never decides itself.

A small decision model that returns a yes or no with a probability is the natural first
instrument here, because its question is about two texts and not about an effect in the
world. The [minimal-harness note](2026-11-05-minimal-harness-and-terminal-bench.md) §3
refuses such a model as a permission judge. That refusal stands and this is a different
seat.

Level: typed message (3) for the mark; model judgment (4) behind the instrument record
for the rest. Seam: `regulator answer`; DEBT row 48.

### 5.6 A refusal that says what remains

A refusal is a handoff from a gate to a unit, and the one seam where the sender is a
mechanism. The state-defined interface note's §4.1 and §4.2 are the design: record
refused calls per gate, and render the remaining valid moves from one table in `protocol`
into every refusal. Nothing is added here except the reason it belongs in the same layer:
the pathology row "The constraint arrives as a refusal" is a handoff with no read-back,
and the refused-call count is its seam metric.

### 5.7 Commitments between units

This is #14, unchanged. The issue specifies `CoordinationCommitment` (a subject, a kind,
a provider, consumers, a compatibility policy), commitments in the regulatory log,
contract references to them checked like `authorityRef`, host-run checks at closeout, and
a `coordination-drift` obligation that holds the consumers.

Read as part of the layer, two things are worth recording on the issue:

- A commitment is the `base` seam's missing sign. Today the base hands a later unit code
  and nothing says what the earlier unit meant by it. Provider and consumers are sender
  and receiver.
- A unit whose contract consumes a commitment should name it in its read-back. That is
  the consumer's side on record before it acts, and it costs one line.

The team-of-experts note §3.5 argues for finding out where misses cluster before building
#14. That order holds. `missesAtBase` is zero under the shipped recovery policy by
construction (a conflict is repaired and escalated, never replanned), so the second live
report will not settle it and a fixture that pulls on the base seam is needed first.

### 5.8 What was established outlives the context

`renderPreservedContext` (`packages/core/src/policy.ts`) is the deterministic block a
compaction summary must begin with: the contract's decisions, the evidence pointers, the
files modified. A read-back and its mark are established once, early, and are exactly
what a long session loses. Proposal: the block carries the unit's read-back and the
comparison's verdict and correction, by reference to the obligation, and the hint on a
further attempt carries the same. Deterministic; nothing in it comes from a model.

Level: deterministic. Seam: `renderPreservedContext`; the controller's hint.

## 6. How it would be judged

- **Metrics.** The seam metrics that exist. One new pair when §5.5 lands: misses marked at
  the read-back, and misses first seen at the report gate. The refused-call count when
  §5.6 lands. Seam metrics for `question` and `proposal` wait for a definition of a miss
  there (§8).
- **Arms.** The layer on; the read-back off; the mark off. Each part gets a registry card
  with an ablation switch, as every regulator does.
- **The retirement reading.** A miss at the read-back costs a turn. The same miss at the
  report gate costs an attempt. If, over the suites and model versions a card names, the
  read-back does not catch more than the report gate catches without it, retire the gate.
- **A suite that can fail.** The first live report had nothing to catch. A handoff suite
  needs tasks that pull toward a misreading: a contract term with two readings that a
  check separates; a hint that contradicts the contract it follows; a later unit that
  depends on an earlier one's unstated choice. And two scripted behaviours as the
  plumbing test: one that skips the read-back, and one that reads back a goal the
  contract does not state.
- **Direction.** The decision of 2026-11-16 holds: a metric that counts what a unit
  reports about its own work is not ranked, or candour loses to silence. A mark made by
  a person or an instrument is not the unit's report and may be ranked.
- **Cost.** One turn per attempt, in a build whose first live report priced regulation at
  65% more tokens with nothing to catch. The cost is the reason for the ablation arm and
  not an argument against measuring.

## 7. What it does not do, and what not to take

- **It tests the handoff and not the work.** A unit can read a contract back perfectly
  and stop following small rules forty turns later. The behavioral canary's findings say
  how often that happens.
- **It cannot recover an intention nobody wrote down.** It can show that the receiver's
  reading added something, which is how a planner learns its contract left a decision
  out before a unit settles it.
- **No new store, no new loop.** §5.2. A finding that affects progression goes through
  the recovery lattice and the router, as `AGENTS.md` requires.
- **No judge that refuses.** §5.5. The comparison is advice whoever makes it.
- **No implicit coordination.** The team-of-experts note §4 records the disagreement with
  the research on human teams, and nothing here softens it: what is shared lives in the
  definition, and the copy a unit holds is advice.
- **No identifiers for meaning yet.** Citing a glossary term or a model fact by a stable
  identifier is the right destination and belongs with the knowledge-production
  workloads, where RDF and SHACL are deferred. It is not in this layer.

## 8. Open questions

1. Is the read-back refused-until-offered, or advisory? §5.4 recommends the gate.
2. Does a read-back on a further attempt and after an answer use the same tool and the
   same gate, or only the first attempt's? §5.4 recommends the same.
3. What is a miss at the `question` seam and at the `proposal` seam? Candidates: a
   question re-asked on the same subject after its answer; a proposal refused for an
   unresolved reference. Neither is decided, and a metric without a definition should not
   be added to `EVAL_METRICS`.
4. Does the typed mark of §5.5 extend the interaction answer, or is it a field on the
   recap's obligation?
5. Is this tracked as one thread, with the dispatch recap and the state-defined
   interface rows pointing here, or do the three rows stay as they are with this note as
   the reading that orders them?
6. Does a refusal belong in `HANDOFF_SEAMS`, given that its sender is a gate and its
   metric is a count and not a miss?

## 9. Next step

Build the seam ledger of §5.1: the read over the stores of what crossed each seam for a
unit, with the misses that exist today shown beside what was handed. It needs no
decision, changes no schema, is the reflector's first input by the team-of-experts
note's own table, and is the instrument the rest of this note is judged by. Then decide
question 1, which the dispatch recap's own threads row already asks.

## 10. Reading

Not read for this note; listed so the frame can be checked before it is repeated
anywhere that matters.

- C. S. Peirce, draft letter to Lady Welby, 1906, in *The Essential Peirce*, volume 2:
  the three interpretants of communication and the commens. T. L. Short, *Peirce's
  Theory of Signs* (2007), as the guide.
- Niklas Luhmann, *Social Systems* (1984), the chapter on communication and action.
- Gordon Pask, *Conversation Theory* (1976), for teachback, the read-back's older name.
- The handoff failure modes the
  [agent-engineering books note](2026-10-25-agent-engineering-books.md) §4 records from
  Lanham (shape, context leakage, instruction injection), which #14 already cites.
