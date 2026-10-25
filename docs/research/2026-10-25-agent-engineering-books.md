# Two agent-engineering books read against the control plane

- **Status:** graduated: the two scripted foils of §6 are [#130](https://github.com/MetaCoding-io/regulator/issues/130) (`roadmap:0.2`, after #46);
  everything else landed as additions to existing notes, pages and issues (listed in
  §7), and this note is the record of why.
- **Sources:** *Build an AI Agent (From Scratch)*, Jungjun Hur and Younghee Song,
  Manning 2026, and *AI Agents in Action, Second Edition*, Micheal Lanham, Manning 2026.
  Both came from Manning's bundle 233 and were bought on the table-of-contents
  assessment recorded in the [open questions backlog](2026-09-25-open-questions.md#6-backlog--smaller-things-to-think-about)
  (the 2026-10-24 row). Both are held in the private `MetaCoding-io/library` repository
  and are cited here by chapter and section, never reproduced. Two books in one note
  departs from the one-source convention because they were read for the same question
  and their findings are ranked together.
- **Question:** the two the research README asks of every source, plus a third this pair
  earns: what in these books could run under the control plane today; what would the
  control plane have to grow; and, since both books build the untyped version of things
  regulator types, where does the untyped version get something right that regulator
  does not.
- **How they were read:** each book was read in full, chapter by chapter, by a
  delegated reader with the repository open beside it, each producing a chapter map and
  a ranked list; the chapters those readers flagged (Hur and Song 6, 9 and 10; Lanham 7,
  8, 9 and 10) were then read directly before anything below was written. Where a
  reader's table-of-contents guess from the bundle assessment turned out wrong, the
  chapter map says so.

## 1. Verdicts

**Hur and Song** is a complete, fully sourced Python reference harness (`scratch_agents`)
for a GAIA research agent: tools and MCP, a ReAct loop, callbacks, sessions with a
pause-and-resume consent protocol, long-term memory, planning and reflection as tools, a
code sandbox, skills, three multi-agent patterns plus A2A, and an evaluation chapter
built on open coding. Almost nothing in it sits above regulator's mechanism level. Its
value is that it is the best documented *untyped* version of five things regulator types
(consent, memory, planning, dispatch, evaluation), with the source in the book, which
makes it the right fourth case for the vocabulary pilot and the right comparison material
for the course's field-study slots. Two things it does that regulator does not (§5).

**Lanham** is an OpenAI Agents SDK and MCP tutorial, Python, aimed at single-operator
agents and small multi-agent flows. Most of it is below regulator's level, and the parts
that are not are a production checklist (chapter 8) and an evaluation chapter (7) with
three passages that sharpen regulator's own design: evaluator collusion, rubric
revalidation on model change, and human-in-the-loop as four decisions rather than a
dialog. Its chapter 10, a "cognitive agent" that gates on its own confidence, is the
cleanest statement of a pathology this project had not yet named. Three things it gets
right that regulator does not (§5).

Neither book opens a thread of its own. Both are additions.

## 2. Hur and Song, chapter by chapter

| Chapter | What it builds | Counterpart in regulator | Disposition |
| --- | --- | --- | --- |
| 1 Agents | agency decomposed on three axes: who produces the step, who decides the next step, who defines the available steps (§1.3); "agent = model + harness" (§1.5.5) | unit / S3 / the definition | foil: a one-line framing for the course's control-plane lesson |
| 2 LLMs | structured output; "if intent is clear, act; ask only when ambiguous" (§2.3.2); single-run comparisons on ten problems (§2.4) | the interaction policy; [evidence about the regulators](../concepts/evidence-about-the-regulators.md) ("one run proves nothing") | foil |
| 3 Tools, MCP | schemas from signatures; identifiers the code already has are not resupplied by the model (§3.2.3) | unit id and revision stamped from the lease, not the model | below level; the one rule matches |
| 4 The ReAct agent | `ExecutionContext`, one mutable store for events, scratch state, step counter and result (§4.3); a provider adapter with failover and errors as values (§4.5); a forced `final_answer` tool via `tool_choice="required"` (§4.7) | the three stores of `AGENTS.md`; `model-router` and `failure-observer`; the `no-report` recovery cause | §4.7 is a candidate borrow (§4 item 8) |
| 5 RAG, callbacks | `before_tool_callback` short-circuits, `after_tool_callback` rewrites (§5.5.2); consent keyed on a `DANGEROUS_TOOLS` name list (§5.5.3) | tool-call interception; consent by declared effect, not tool name | foil for the tool-effects lesson; the name list is what `AGENTS.md` forbids |
| 6 Memory | events immutable, the request a projection (§6.2); deterministic compaction before model summary (§6.2.4–6.2.6); `PendingToolCall`, `ToolConfirmation{approved, reason, modified_arguments}`, `requires_confirmation` on the tool, whitelist resume (§6.3.5–6.3.8); `TaskMemory` extracted and deduplicated by a model and injected as instruction (§6.4) | `contract-preserving-compaction`; the pause gate and "silence is never consent"; `remember` with provenance, scope and expiry | §4 items 1, 2 and 6 |
| 7 Planning, reflection | `create_tasks` regenerates a checklist string; `reflection(analysis, need_replan)` records free text; four ReAct failure modes (table 7.1) | the work contract (S3-written, versioned replan); the recovery router; the report gate | foil; `need_replan` touches #49 (§4 item 5) |
| 8 Code execution, skills | E2B sandbox; tool source shipped into the sandbox and called from generated code (§8.3); skills read from the sandbox filesystem (§8.5); everything funnels through two gateway tools (§8.5.5) | `ROADMAP.md` not-planned row 8 (isolation is the deployment's); the project trust rule | §8.3 is the consent bypass in §4 item 2 |
| 9 Multi-agent | Workflow, Agent-as-Tool, Transfer (an enum of valid targets is the only check), A2A agent card and `RemoteAgent` (§9.3–9.6) | orchestrator-only dispatch; #14; #58 | §4 item 4: the fourth pilot case; the A2A card is discovery, not commitment |
| 10 Evaluation | OpenTelemetry pillars (§10.1); dataset → traces → open coding → taxonomy → binary rubric (§10.2); evidence-grounded judge prompt (§10.3.2); evaluation-gated deployment and the quality flywheel (§10.4) | `span-projection`; #49; the interpretation rule and the probe arm | §10.2–10.3 is the one borrow (§4 item 3); §10.4 is contradicted (§4 item 7) |

Guesses corrected: chapter 4's LLM layer is a provider adapter, not a host seam, because
in this book the agent *is* the host; chapter 9's A2A card against #14 was wrong (a card
is a discovery record with no provider, consumer or compatibility policy); chapter 9
against #58 holds only as the boundary case in §4 item 4.

## 3. Lanham, chapter by chapter

| Chapter | What it says | Counterpart in regulator | Disposition |
| --- | --- | --- | --- |
| 1 Rise of agents | a graduated approval model, goal-level approval with gated high-stakes actions (table 1.1); tools sorted by influence on the environment (§1.3.2); three topologies (§1.4) | the five interaction kinds in [asking a person](../concepts/asking-a-person.md); the four effect axes in [coordination](../concepts/coordination.md) | foil; topologies are shapes, not functions, for the pilot's rubric |
| 2 LLMs, prompting | strict JSON schemas (§2.3.3); "tools are decisions" (§2.4.1) | the mechanism hierarchy's level 3; the profile grant | below level |
| 3 MCP | defence in depth: allowlisting, sandboxing, output validation, budget caps, HITL on irreversible actions (§3.2.4); a shared journal across agents on one server (§3.4.2) | `project-trust-rule`, `canary-watch`, `budget-guard`, `profile-write-grant`; `unit-lease` | foil, one-to-one |
| 4 Multi-agent architecture | decision, control and communication as separate axes (§4.1); constrain agency at the boundaries that matter, agency earned by reliability (§4.1.3); decisions pulled into code (§4.2.3); handoffs make dependencies implicit (§4.3.1); guardrail cost ordering and "the validator can be wrong in the same direction as the agent" (§4.4); three handoff failure modes: shape, context leakage, instruction injection (§4.4.3) | S3 against S1; #14; the pilot's D2 | §4.4.3 lands in #14 (§4 item 7); §4.4 in D2 |
| 5 Reasoning, planning | a critic that "requires knowing the correct answer" (§5.3.2); a `how_correct_is_answer` oracle (§5.4.3); the plan re-read every step as a property of the architecture (§5.1.3) | the self-certifier; the contract rendered every turn | foil |
| 6 RAG, memory | a hybrid memory agent whose whole discipline is a prompt (§6.4.3); "the instruction tells the model what you want; verification tells you whether it did it" (§6.3.2) | [intelligence and memory](../concepts/intelligence-and-memory.md); the prime directive | foil; the §6.4.5 "forgetting" guess was wrong (it is clustering) |
| 7 Evaluation, feedback | evaluator collusion: a grounding agent on the unit's model validates the same errors, so evaluate with a different model, add human review of flagged and a random sample of unflagged outputs, log every agent-to-agent message, limit each agent's authority to its role (§7.1 sidebar); test-driven agent development with known-bad answers, run three times (§7.2); the retry ceiling's fourth attempt (§7.3); a grounding guardrail reading the unit's context on the unit's model (§7.3.3); rubrics validated against human judgment, threshold set where agreement peaks, revalidated when rubric, agent or model changes (§7.3.4–7.3.5); annotations become a regression set (§7.4.4) | #49's instrument paragraph; the scripted behaviours; the recovery router's rules; the registry's review dates | §4 items 1 and 9 |
| 8 Deployment | idempotency key as SHA-256 of canonical name and arguments, offered as a cache (§8.3.4); version everything, promote through offline, shadow, canary, rollout with auto-rollback, pin model and tool per turn (§8.3.5); timeouts at the caller, fallbacks, circuit breakers on repeated tool failures (§8.3.7); policy enforced outside the agent in a registry, overrides logged with reason codes, no record of the policy version if it lives in a prompt; HITL as four decisions (§8.4.6) | the effect journal; #53 and the fingerprint; the recovery router; the prime directive and the recovery decision's policy version | §4 items 3, 5, 6 and 8 |
| 9 The agentic loop | L1 inner loop; L2 task loop with goal, plan, state and decision in code, "the tool is the agent itself"; L3 meta loop where an agent controls the loop (§9.1–9.3); termination layered as hard limit, budget, goal satisfaction (self-assessed, so a second agent is proposed), quality threshold, stagnation (§9.2.4) | the S3 loop; the orchestrator boundary `AGENTS.md` draws; `budget-guard` and `thrash-detector` | §4 item 4; the guess that L2 was the reflector was wrong |
| 10 The cognitive agent | evaluation as an LLM emitting a `confidence_delta` (§10.2.6); an "attention" module routing deterministically over numbers the LLM modules wrote (§10.2.7); confidence gate, stagnation, knowledge boundary all computed from self-assigned scores (§10.3.4–10.3.6); metacognitive calibration, confidence against correctness (§10.4.1) | [obligations](../concepts/obligations.md) ("a claim of impact is not yet a severity"); the closeout gate; open questions §4's calibration | §4 item 2, the new pathology row; §10.4.1's metric is correct and is kept |
| 11 Tips | an `escalate_to_human` tool the agent chooses to call (§11.2) | escalation is the loop's, never the unit's choice | foil |

## 4. Findings, ranked across both books

Each finding names its kind in the research README's terms: (a) something to borrow,
(b) a foil that sharpens a page or lesson, (c) a confirmation or sharpening of a design
already recorded.

1. **The judge must not share the unit's model.** Lanham §7.1 sidebar, §7.3.3, §7.3.5.
   (c). #49's calibration paragraph covers *data* leakage with a held-out slice and says
   nothing about *model* leakage: a judge on the unit's route model shares its blind
   spots, and the book's line that an evaluation layer colluding with what it evaluates
   is worse than none is right. Lands in #49 as a done-when: the instrument record names
   the judge's model, `regulator check` refuses an instrument whose judge model is the
   primary of the route of any unit type the suite grades, and the report fingerprint
   records both. The pilot's D2 gains the book's grounding guardrail as a documented
   countercase beside CrewAI's string guard.

2. **Self-report as control variety.** Lanham chapter 10 end to end. (b), with one (a).
   Every gate in the cognitive agent is code, and every number the code reads was
   written by the model about itself: confidence, relevance, progress. Regulator's
   counterparts already refuse this at three points (reported severity is an input under
   policy with floors; the report is consulted only to name contradicted claims; the
   budget guard halts on the ledger, not the unit's estimate), but the catalog had no row
   for it. Lands as a row in `docs/PATHOLOGIES.md` §3 and a candidate fifth scripted
   behaviour, `confident`, which reports high confidence and low consequence while
   `run_tests` fails. The one thing to keep is §10.4.1's metacognitive calibration: the
   unit's reported `confidence` on an intelligence signal is itself a `model-judgment`
   instrument, and once the prediction record exists it is graded on calibration like
   any other (open questions §4, dated paragraph).

3. **An auditable judgment: open coding first, PASS/FAIL per item, evidence quoted.**
   Hur and Song §10.2.3, §10.2.4, §10.3.2. (a). The method is: read fifty to a hundred
   traces and note the *first* error in free text; group into a taxonomy; write binary
   items before any scale; then a judge that must ground every FAIL in a quoted span and
   the ids of the evidence it read, is forbidden outside knowledge, and does not reward
   length. The worked example of an open-coding note (the tool failed and the agent
   claimed success) is the catalog's reasoning–action mismatch row. #49's two judged
   metrics gain this as their output contract, and the labelled set is built in that
   order from the scripted behaviours' reports. One more line for #49 from chapter 7:
   "replans attributable to the contract" must separate a replan S3 decided after a
   failure from one the unit asked for, because the untyped system cannot tell them
   apart and the metric should.

4. **The fourth and fifth pilot cases, and the reflector placed among the loops.** Hur
   and Song §9.3–9.6 and §8.5.5; Lanham §9.1–9.3. (b). `scratch_agents` has its full
   source in the book, so the pilot's documentation-only caveat does not apply to it,
   and it is close to what a course learner builds; Lanham's L2 and L3 loops are two
   shapes the pilot's D5 needed a worked instance of. Codings are in the pilot note's new
   §9. Two consequences: the reflector (Harness² note §7) is not Lanham's L3 meta loop,
   because it holds none of decide, state or schedule; and the smallest second host (#58)
   is bounded from below by what an A2A `RemoteAgent` cannot write (one text, an
   unchanged context, none of the five records the host read-back table requires).

5. **Consent with amended arguments.** Hur and Song §6.3.5. (c), the sharpening. The
   book's `ToolConfirmation` lets a person approve *with changed arguments*. Regulator's
   consent is yes or `rejected`, so an amendment costs a rejection, a second attempt and
   a second consent question against a cap of two. Lands in #60 as a done-when (the
   `consent` grant's answer may carry `amendedArguments`, recorded as the person's
   disposition, the interception passing the amended call and the unit told what
   changed) and in [asking a person](../concepts/asking-a-person.md) under "what is not
   there yet" until then.

6. **Where the consent requirement lives, and the sandbox bypass.** Hur and Song §5.5.3
   → §6.3.6 → §8.3. (b) and (c). The book moves the requirement from a name list in a
   callback to an attribute on the tool; #60 moves it one step further, onto the
   profile. The sharpening the book does not state: a tool whose source runs inside the
   sandbox and is called from generated code fires neither the callback nor the
   attribute. The same hole exists for #60 wherever a profile grants `bash` beside a
   consent-granted tool. Lands in #60's done-when as a `regulator check` warning and a
   stated limitation on the `interaction-contract` card.

7. **Handoff failure modes are the untyped coordination commitment.** Lanham §4.4.3,
   §4.3.1, §4.1.3. (b). Shape failure, context leakage and instruction injection are
   what a commitment's `kind` and compatibility policy must cover; the book's advice to
   put guardrails on high-stakes handoffs (writes, sends, irreversible work) is
   effect-based placement, which is #60's declaration. Lands in #14 as a paragraph.
   The A2A agent card is not a commitment (item 4), so #14 gains nothing from chapter 9.

8. **A shared cause recovered per unit.** Lanham §8.3.7 (circuit breakers that trip on
   repeated tool failures). (b). The `recovery-router` card's third limitation counts
   occurrences per cause per unit by design, so six units each taking
   `environment → remediate` for one missing dependency is six decisions and no
   instance-level signal. The card calls this a design choice, not a debt, and offers
   shorter rules; the book's pattern says the instance should notice. Lands as a row in
   `docs/PATHOLOGIES.md` §2 with nothing in "absorbed by", and a backlog row in the open
   questions, not a DEBT row, because the card names it as a limit. Related to #46.

9. **Review triggered by model change, and the migration note's gates.** Lanham §7.3.5,
   §8.3.5. (c) and one gap. The book revalidates thresholds whenever the rubric, the
   agent or the model changes; the registry's review dates are calendar-based
   (`regulator review --due`), the fingerprint records the model, and a route change
   re-opens nothing. For instruments that is a real gap; for gates it is arguable.
   Lands as a backlog row. The release sequence (offline, shadow, canary, rollout) lands
   in #53: the migration note states which gate each definition change passed. The
   book's auto-rollback on SLO degradation is the step regulator leaves to a person; the
   Harness² note §8 records it so it is not re-proposed.

10. **Reviewer context at delivery.** Lanham §8.4.6, the four HITL decisions. (c), one
    gap. Regulator answers three of the four (trigger on declared effect; durable state
    with timeout and escalation under the interaction policy; rate limits, caps and audit
    around it). The second, what the reviewer sees, it answers only half: the outbox
    delivers one line per obligation (`packages/regulator/src/deliver.ts`), and the
    recovery decision and evidence it cites sit behind `regulator obligation show`. The
    book is right that a bare question yields rubber stamps. Lands as a backlog row.

11. **Idempotency by inputs against the effect journal.** Lanham §8.3.4. (b), one (a).
    The book's key is the effect journal's key, offered as a cache with no intended,
    committed or reconcile step, and it names email as the non-idempotent case without
    handling it: a teaching contrast for the course's effects lesson. The small borrow
    is an explicit idempotency-key argument on `notify_owner` for the deliberate repeat
    the journal's limitation refuses today. Backlog row.

12. **A forced final tool.** Hur and Song §4.7. (a), candidate. The book guarantees a
    structured last action by requiring a tool choice, so a run cannot end in free text;
    regulator handles the same failure afterwards as the `no-report` cause and spends
    attempts on it. Whether Pi's session API exposes a forced tool choice is unknown
    (nothing in `packages/regulator-pi` uses one). Backlog row, as a question.

13. **Gated deployment and the flywheel, contradicted.** Hur and Song §10.4. (c). The
    book gates deployment on an automatic pass-rate threshold against the previous
    version; regulator's interpretation rule refuses to commit a report nobody has read,
    and the probe arm refuses adoption from a report without an interpretation. Kept.
    The flywheel's fourth step edits the evaluator from production failures, and that
    does carry a consequence: a `harness-edit` and a change to the suite it is probed
    under cannot be one change, and the probe runs under the suite at the baseline
    report's fingerprint, or the reflector grades itself on a test it also wrote. Lands
    in the Harness² note §7.

14. **Memory as instruction, the fixture.** Hur and Song §6.4. (b), with a fixture.
    `TaskMemory` has no unit, revision, expiry, scope or retraction and is injected into
    every request as an instruction to imitate or avoid. The catalog's "data absorbed as
    control" row says poisoned memory is untested; the book gives the fixture its shape:
    a false environment fact under valid provenance and a near review date, seeded into
    `.regulator/memory.ndjson`, run under the drift suite, graded by
    `boundaryViolations` and `memoryFacts`. Candidate `fixture-poisoned-memory`, named
    in the row.

Where the books are only foils and nothing is proposed: Hur and Song's single
`state: dict` store (the three stores), tools that read the context to check
permissions (gates sit outside the tool), context isolation against worktree isolation
(the book isolates what the parent sees, regulator what the unit can touch), §10.1
(duplicates `span-projection`); Lanham's listing 8.8 (an allowlist and an instruction
hierarchy written into a prompt, the pilot's D3 in one listing), §6.4.3 as the `remember`
foil, and §11.2's agent-chosen escalation.

## 5. What the books get right that regulator gets wrong

Five items, all hedged, in the order they matter.

- **Judge independence by model** (Lanham §7.1). Nothing in regulator requires a model
  judgment, a future #49 judge or any S3* review on a model, to run on a model other
  than the unit's route. No mechanism and no card limitation names it. Item 1 fixes the
  first; the second is a line on the `eval-harness` card when the instrument record
  lands.
- **Reviewer context at delivery** (Lanham §8.4.6). The outbox line carries the
  question; the evidence is a command away. Item 10.
- **Review triggered by model change** (Lanham §7.3.5). Item 9.
- **Approval with amended arguments** (Hur and Song §6.3.5). A real third disposition
  that regulator makes expensive under the attention cap. Item 5.
- **The final action forced by tool choice** (Hur and Song §4.7). Mechanically stronger
  than detecting `no-report` afterwards, if the host API allows it. Item 12.

Nothing else. Everywhere else the books' choice is the untyped version of regulator's,
and Hur and Song's own argument in §6.3.7, that framework guarantees belong inside the
loop and not in user callbacks because callbacks cannot reorder what the model sees, is
the prime directive stated from the other side.

## 6. Two scripted foils for the drift suite

The suite's four behaviours (reference, drifter, sloppy, self-certifier) reproduce the
catalog rows that have a committed report. The two books add two candidates, each the
reproduction column of a row that has none:

| Candidate | Row it reproduces | What it does | Graded by |
| --- | --- | --- | --- |
| `confident` behaviour | §3 self-report as control variety (new) | reports `high` confidence and `low` consequence on every signal and report while `run_tests` fails | the closeout verdict against the report's claims; later, the calibration of its reported confidence |
| `fixture-poisoned-memory` | §3 data absorbed as control | seeds one false environment fact with valid provenance and a near `reviewBy`, then runs the reference behaviour | `boundaryViolations`, `memoryFacts`, and whether the fact reached a decision |

Filed together as [#130](https://github.com/MetaCoding-io/regulator/issues/130) on 2026-10-25, blocked on #46's live report, since a new
behaviour or fixture is a change to the suite and the suite is held still until that
report is committed (the accept-path note's rule that a suite is a declaration-class
file).

## 7. Where everything landed

| Addition | Where |
| --- | --- |
| Two pathology rows (§4 items 2, 8) and a named candidate fixture (item 14) | `docs/PATHOLOGIES.md` §2 and §3 |
| Fourth and fifth pilot cases, D2's countercase, §6's citation (items 1, 4) | [pilot note](2026-10-18-paper-113-vsm-vocabulary-pilot.md) §4, §6, §9 |
| The reflector against the loop layers and the flywheel (items 4, 13); auto-rollback left to a person (item 9) | [Harness² note](2026-10-18-harness2-recursive-harnessing.md) §7, §8 |
| Reported confidence as an instrument (item 2); five backlog rows (items 8–12); the 2026-10-24 row updated | [open questions](2026-09-25-open-questions.md) §4, §6 |
| Consent is yes or no (item 5) | [asking a person](../concepts/asking-a-person.md), "what is not there yet" |
| Judge model, output contract, open-coding order, replan provenance (items 1, 3) | [#49](https://github.com/MetaCoding-io/regulator/issues/49) |
| Amended arguments; the sandbox bypass (items 5, 6) | [#60](https://github.com/MetaCoding-io/regulator/issues/60) |
| Handoff failure modes; the A2A card (items 7, 4) | [#14](https://github.com/MetaCoding-io/regulator/issues/14) |
| The migration note states its gates (item 9) | [#53](https://github.com/MetaCoding-io/regulator/issues/53) |
| The `RemoteAgent` boundary case (item 4) | [#58](https://github.com/MetaCoding-io/regulator/issues/58) |

---
**Decided (2026-10-25, James).** Both bundle books are read in full rather than from
their tables of contents, and their yield lands as additions to the notes, pages and
issues above, with this note as the record; neither opens a thread. The one next step,
the two scripted foils of §6, was filed the same day as #130 at James's request, blocked on #46 rather than waiting for the suite to grow.
