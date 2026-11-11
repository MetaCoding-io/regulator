# Anthropic's "components of agent memory" read against operational memory

- **Status:** open. No issue yet; the next steps are in §6.
- **Source:** *Components of agent memory*, Lance Martin, Anthropic Engineering,
  [anthropic.com/research/components-of-agent-memory](https://www.anthropic.com/research/components-of-agent-memory)
  (6 Nov 2026). Read in full. Its figures come from four settings: a database task from
  Continual Learning Bench 1.0 with a persistent memory directory, Pokémon Red as an
  open-ended test of salience, a 350,000-file internal corpus (Stainless) with graded
  questions, and Harvey's legal-brief tasks. Every claim about the article below is the
  article's; none of the experiments was reproduced here.
- **Why a note:** the article is the first published account from a frontier lab of what
  a memory system around its own models should be built from, with measurements of what
  goes wrong. regulator has one memory mechanism, `remember` into an append-only store
  ([`intelligence-and-memory`](../concepts/intelligence-and-memory.md)), and a designed
  component, the reflector, that would read the record back
  ([Harness² note §7](2026-10-18-harness2-recursive-harnessing.md#7-the-reflector-s4-of-the-level-above)).
  The article describes a four-layer hierarchy and an offline pass over it. Reading one
  against the other says which of regulator's choices the article's evidence supports,
  which it argues against, and what the reflector should do first.

Claims about what the article found cite the article. Claims about what regulator does
cite the file. The rest is proposal.

## 1. What the article says

**Scope.** Agent memory is knowledge the model gains from experience and keeps between
sessions. The article excludes three things that are sometimes called memory: the
weights, in-context learning within one conversation, and compaction, the summary that
replaces older turns.

**Four layers.** The article draws a hierarchy, bottom to top: *transcripts*, "a
searchable event log", which it calls the foundation; *memory notes*, observations
Claude writes during a session when a user asks or when something is "clearly worth
remembering"; *memory representations*, structures built from the notes, the example
being a wiki, "a collection of pages written and maintained by Claude" that link to one
another; and *injected context*, the small top layer loaded into every session, kept as
an index with links rather than as content.

**Dreaming.** The process that maintains the layers is an offline pass the article calls
dreaming, after hippocampal replay and Letta's sleep-time compute: it reads the
transcripts and notes, corrects notes against what the transcript shows, builds and
prunes the representations, and decides what the injected layer holds.

**Memory as prediction.** Writing a note is a bet that the pattern will recur; a verified
fact is a prediction that a later session can rely on it without re-checking. The models
that gained from memory on the database task were the ones that recorded *validated*
rules with the evidence for them. A model that recorded untested theories gained almost
nothing (0.330 stateless against 0.364 with memory for Sonnet 4.6, until it was prompted
to read memory and test its theories, at which point it reached 0.641).

**Salience.** On Pokémon Red, Sonnet 3.7 wrote 413 memory files across 225 folders,
spent its steps on memory upkeep, and earned one badge; Fable 5 wrote nine files plus one
`global.md`, recorded only what was not visible on screen (strategy, tested rules), and
earned four. The article's lesson is that salience is the model's to judge and that fixed
rules about what to record hurt: "record only failures" cut Opus 5's gain by 0.234 and
Opus 4.7's by 0.150, while the bare statement that a memory folder was available was
enough.

**Correction.** A wrong note (a PokéCenter placed on the wrong side of Mt Moon) was
trusted and caused repeated failures; the run with raw notes and the run without memory
never got past the mountain. Dreaming checked the note against the transcript, fixed it,
and the corrected run reached the next city.

**Representations.** Over the Stainless corpus, a wiki built by dreaming raised 25 graded
questions from 13% to 48% of criteria as the number of dreaming sessions went from 2 to
128; search plus wiki scored 61% against 53% for search alone and saved about 20,000
tokens per question. The gain was on multi-document questions (87% against 73% on a
merger task) and absent on single-document lookups; on one task the wiki grew to 1.77
times the corpus.

**Shared writes.** When several agents wrote one shared table of contract terms,
overwrites dropped facts: 41 of 57 reached the brief. One page per contract, with terms
quoted, gave 57 of 57.

**Injected context.** It costs tokens on every call, a wrong note in it is carried into
every session, and longer instruction files reduce adherence. Claude Code's auto memory
loads only the first 200 lines or 25 KB of `MEMORY.md` and treats it as an index.

## 2. What regulator has, layer by layer

| The article's layer | regulator's nearest thing | The difference |
| --- | --- | --- |
| Transcripts: a searchable event log, "the foundation" | None kept. "The loop never reads a transcript, and it never takes the session's word for anything" ([`docs/concepts/hosts.md`](../concepts/hosts.md)). The foundation is typed records: the regulatory log, the audit log, the execution store, the effect journal, the trace and the SQLite event store, every one append-only (`INSTANCE_STORES`, `packages/protocol/src/instance.ts`) | A different base by design. What happened is kept as records with provenance and authority on each line, not as conversation. Neither is searchable by a unit: no tool reads the stores back to the model |
| Memory notes | `remember`: subject (≤120 characters), note (≤1000), evidence refs, an optional scope of unit types, and a `reviewBy` the tool requires (`RememberInputSchema`, `packages/regulator-pi/src/identity.ts`). The host stamps unit, revision and time. The store refuses a review date in the past or more than 90 days out (`MemoryStore.record`, `packages/core/src/memory.ts`) | The closest match, with two things the article's notes lack: an expiry every note must carry, and provenance the model did not write |
| Memory representations: wikis the model maintains | None. The one durable synthesised body of knowledge is S5 identity (`regulator/identity/`), written only through `identity accept` by a person | A refusal, not a gap: a model-maintained durable representation is what INV-004 and the `memory-becomes-policy` failure class exist to prevent (`packages/regulator/registry/regulators/memory-store.json`) |
| Injected context | Three system-prompt sections per unit: identity, cut at `identity.maxChars` with the cut signalled (`identityContextBudget`, `packages/core/src/identity.ts`); advice, cut at `advice.maxChars`, 4000 characters by default (`advice-context` card); memory, every current fact rendered in full under a heading that says facts are not rules (`renderMemorySection`, `packages/core/src/memory.ts`), with no cap | Identity and advice follow the article's rule. Memory does not: it is content, not an index, and it is the one section without a budget |
| Dreaming | The reflector: a package that reads the stores and the eval reports and emits `remember` entries, intelligence signals and `harness-edit` proposals, none of which take effect without an accept (Harness² note §7; named, not built) | The same slot one level up, with a person between the output and the file. The article's dreaming writes memory and corrects it directly |
| Compaction, excluded | Excluded the same way: `session_before_compact` carries the contract, the evidence pointers and the touched files as a deterministic block, and nothing the loop needs depends on the summary (`packages/regulator-pi/src/budget.ts`) | Agreement |

## 3. Where the article's evidence supports the design

1. **Memory as prediction is mechanical here.** The article's framing is that a note is
   a bet. In regulator the bet has a stated horizon: `reviewBy` is required, bounded, and
   when it passes the fact is rendered to nobody. The store's own comment on `record`
   says the reason: "memory without an expiry is policy in disguise." On intelligence signals the
   bet goes further, to a `prediction` block that resolves to confirmed, disconfirmed or
   inconclusive from the stores (`packages/protocol/src/prediction.ts`,
   [`intelligence-and-memory`](../concepts/intelligence-and-memory.md#predictions)).
   A memory entry carries no such resolution; §6 item 3 returns to that.
2. **General guidance, not fixed rules.** The article found that "record only failures"
   cost the models most of their gain and that one sentence saying memory was available
   was enough. The shipped implement advice is one general sentence: record what a later
   unit would need, with a review date (`packages/regulator/advice/implement.md`). The
   constraint regulator does impose is on the record's *shape* (fields, lengths, an
   expiry), not on *what* is worth recording, which is the line the article's evidence
   draws.
3. **One writer per record.** The article's shared contract table lost sixteen facts to
   overwrites, and the fix was one page per contract. regulator cannot have the failure:
   every fact is its own appended line, a retraction is a later event, and nothing is
   edited in place (`MemoryStore`, `packages/core/src/memory.ts`).
4. **A wrong note carried into every session.** The article names this as the cost of
   injected context. It is the `memory-store` card's failure class, stated from the other
   side: "a note that tests need FOO=1 is written into AGENTS.md as a temporary reminder;
   a year later it is an undocumented rule nobody can date, source or retire." The
   answers are the dated expiry, the provenance, and INV-004.
5. **Compaction is not memory.** Both exclude it, for the same reason: a summary is lossy
   and the record must not depend on it.
6. **Scope by consumer.** The article suggests tuning memory "in service of a particular
   goal" and gives per-person memory as an example. Unit-type scope on a fact
   (`remember`'s `scope`, rendered only to units of those types) is that, shipped in
   lesson 15.

## 4. Where the article's evidence argues against the design

1. **No correction loop.** The article's strongest single result is a wrong note fixed
   against the transcript. In regulator a wrong fact lives until a named person retracts
   it or the review date passes; the card says it plainly: "nothing checks that a fact is
   true, current or about the environment" (`memory-store` limitation 1; DEBT row 26). The
   poisoned-memory foil in [#130](https://github.com/MetaCoding-io/regulator/issues/130)
   is the article's PokéCenter case, unbuilt.
2. **No pressure on volume.** Sonnet 3.7's 413 files against Fable 5's nine is the
   article's salience story. regulator bounds a note's length and its lifetime and not
   its count, and the card admits the consequence: "a large store still crowds the prompt
   before the 90-day limit retires anything" (limitation 2). The memory section is the
   only injected section without a character budget, and the article's own finding that
   longer injected text reduces adherence applies to it first.
3. **No consolidation.** There is no command that renews an entry, so "a fact that is
   still true after its review date is recorded again by the next unit that finds it"
   ([`intelligence-and-memory`](../concepts/intelligence-and-memory.md#expiry-and-retraction)).
   The article's representation layer exists to fold repeats of one subject into one
   place. Here duplicates of a subject accumulate until each expires, and the render
   shows all of them.
4. **No retrieval.** Everything current is injected on `before_agent_start`. That
   sidesteps the article's finding that a weaker model will not read memory unless told
   to (Sonnet 4.6 read it under half the time; Sonnet 5 nine times in ten), at the price
   of item 2. The article's recommended shape, a small preloaded index with search and
   links beneath it, has no counterpart: no tool returns a fact, a signal or a record to a
   unit on request.
5. **The graders measure hygiene, not help.** `memoryRules` counts rule-shaped lines
   written into README, AGENTS and docs; `memoryFacts` counts facts recorded with an
   expiry (`packages/regulator/src/graders.ts`). The committed scripted reports show what
   they were built to show: the treatment arms record facts (0.33 to 1 per repetition)
   and the control arms, with no tool, write a rule into prose (0.33 on the drifter and
   the sloppy foils) (`packages/regulator/evals/reports/`). What nothing measures is
   whether a later unit was faster or more correct *because* a fact was there. That is
   the article's headline metric, the loop closed on the database task, and the drift
   scenario has no task that needs an earlier task's fact.
6. **The record a corrector would read is missing.** Dreaming corrects notes against the
   transcript. regulator keeps no transcript under `.regulator/`; the trace holds the
   gated events and the stores hold what the host observed. For a verdict that is the
   right position, and `hosts.md` says why. For a reflector asked whether a fact was ever
   true, it may not be enough: the evidence a unit cited is a reference, and the
   observation behind it is in a session nobody kept.

## 5. Where regulator is ahead of the article

- **Three records, three authorities.** The article does not distinguish a fact for later
  from a finding that should change work under way from a rule. regulator keeps
  operational memory (S3's note to itself, renders and raises nothing), intelligence (S4
  to S3, opens an obligation that can hold a unit) and identity (S5, a person's decision)
  apart, each with its own writer, lifetime and consequence, and the concept page names
  the failure each separation prevents.
- **Provenance the host stamps.** Unit, revision and time come from the lease and the
  worktree, not from the model's own account. The article's notes carry whatever the
  model wrote, and its wrong-note case is a note nobody could date against a state.
- **Memory never gains authority.** The article's wikis and injected notes become de
  facto policy by being loaded every session. Here a fact that wants to be a rule has one
  path, `propose_policy_change`, and it takes effect only when a person accepts it
  (INV-002, INV-004).
- **The corrector is held to the same rule as the units.** Dreaming writes memory as the
  model judges. The reflector's design emits records that exist and writes no definition
  file; `identity accept` and `advice accept` stay the only writers.

## 6. What to take, at the mechanism level

1. **A budget on the memory section.** `memory.maxChars` in the budget policy beside
   `identity.maxChars` and `advice.maxChars`, the cut reported the way identity
   truncation is (an advisory operational-signal from the unit, once per session, and the
   status line). Which facts are cut is a policy choice; the obvious rule is newest first
   by `recordedAt`, scoped before unscoped, so a fact for this unit type survives a
   crowded store. Level 2, against an existing seam; pays the card's limitation 2 in part
   and DEBT row 26's "crowds the prompt" clause.
2. **The reflector's first output is a correction, not a proposal.** A `reflect` unit
   that takes each current fact, reads its evidence references against the stores and the
   unit's recorded commands and results, and emits a retraction with the contradicting
   record as its reason, or a reaffirmation with a new review date. That is the dreaming
   result the article's own narrative rests on, and it needs one decision: today only a
   person the interaction policy names may retract. The options are a `memory-reaffirmed`
   event a reflector may append (a renewal, which the design has so far refused) and a
   retraction under `S4` provenance routed as a proposal owed to a person at advisory
   severity, so the fact stays rendered until someone agrees. The second keeps the rule
   and adds a line to the regulatory log; it is the one to take first.
3. **A fact that resolves.** Memory as prediction wants what the intelligence signal has:
   a horizon and a reading. A `remember` entry could name the unit types that will rely
   on it and the thing a later unit's record would show if it held (a command that
   succeeds, a check that passes). The loop already reads the stores at a unit's close to
   resolve a prediction (`prediction-resolution`); the same pass could mark a fact
   *relied on* when a later unit of a scoped type closed without re-discovering it, and
   *contradicted* when its evidence failed. Design item, after item 2; it is the
   instrument record kind's question (open questions §4) asked of memory.
4. **A closed-loop task in the drift scenario.** `d5-memory` records the TZ fact
   (`packages/regulator/contracts/drift/d5-memory.json`). A `d6` that cannot pass its
   tests without that fact, graded on whether the unit set TZ from memory or rediscovered
   it (the trajectory shows the attempts; a scripted unit can be told either way), turns
   `memoryFacts` from a count into the article's metric. The poisoned-memory foil in #130
   is the same fixture with the fact wrong, and the two should land together.
5. **Fold by subject at render time.** Before any representation layer, the cheapest
   consolidation: when several current facts share a subject, render the newest with a
   count of the earlier ones, and let `regulator memory` show the history. Level 2, in
   `renderMemorySection`. A wiki is not proposed; the article's own numbers say the wiki
   paid on multi-document synthesis over a very large corpus and not on lookups, and
   regulator's facts are lookups.
6. **A read-only recall tool, before any transcript.** The article's base layer is
   search. The exo note's item 3 proposed `read_budget`, the unit's own ledger as a
   read-only tool ([Exo note §4](2026-11-06-exo-runtime-self-improvement.md#4-what-regulator-could-take-at-the-mechanism-level)).
   A `recall` tool of the same shape, returning expired and scoped-away facts by subject
   and the signals routed on a unit, gives a unit the article's "search beneath the
   index" without keeping a transcript. Whether the trace should keep enough of a session
   for item 2's corrector to read is the one question this note leaves open: the answer
   decides whether `.regulator/trace.ndjson` grows a record kind or the reflector is
   limited to what the host observed, and `hosts.md`'s rule argues for the second until a
   corrector shows it needs more.

## 7. Next step

Item 1 is small enough to file now as an issue against the budget policy and the
identity extension, with the card's limitation 2 and DEBT row 26 as its acceptance
criteria. Items 2 and 4 belong to the reflector thread and #130 respectively and are
recorded here for when those are picked up, after
[#46](https://github.com/MetaCoding-io/regulator/issues/46). Items 3, 5 and 6 are design
items for the same thread. The threads table in [`ROADMAP.md`](../../ROADMAP.md) carries
this order.
