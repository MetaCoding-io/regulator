# Uber's Legal Redlining Agent: a workload, and a source of regulators

- **Status:** open
- **Sources:** [Building Uber's Legal Redlining Agent](https://www.uber.com/in/en/blog/building-ubers-redlining-agent/)
  (Uber Engineering blog; read 2026-10-10) and a design conversation (2026-10-10) that
  read it against the control plane. Claims about what `regulator` does today cite the
  file; claims about what the LRA does cite the article. The two are kept apart.
- **Question:** three. Does the LRA read as a viable system, and where does the reading
  disagree with it? Could contract redlining be the third workload
  ([#61](https://github.com/MetaCoding-io/regulator/issues/61))? And does the article
  carry mechanisms the registry does not yet have a card for?

> Nothing here is implemented. The fixture, the workload and the cards are proposed;
> the one decision this note asks for is in §6.

## 1. What the LRA is

A Word add-in for Uber's lawyers. A counterparty returns a contract with tracked
changes; for each change the system infers the intent, assigns a risk level,
recommends ACCEPT, REJECT or MODIFY, drafts the comment that states Uber's position,
and for MODIFY drafts compromise language. A lawyer reviews every suggestion. The
pipeline the article draws (its figure 3) is document review → intent detection →
policy-aligned adjudication → tone modification → rules processing, on a LangGraph back
end with OpenSearch for a rules index and a feedback index, and Redis for session state.

The parts that matter to a control plane, in the article's own order of discovery:

1. **RAG over playbooks failed first**: imprecise matching, wrong tone, no
   generalization to scenarios the playbook did not cover.
2. **A feedback loop** then stored every lawyer decision (the decision, the original
   text, the redline, the lawyer's edits and reasoning) and retrieved them as few-shot
   examples — about twenty per query after metadata filtering, then an LLM filter on
   intent alignment.
3. **The feedback index is keyed on the counterparty's intent, not the text**, "allowing
   us to catch semantically identical changes phrased differently".
4. **Few-shot examples are sampled with exponential time decay** (`exp(-λ × age_days)`, a
   365-day half-life) "while maintaining a balanced distribution of agree and disagree
   examples", against concept drift in Uber's own stance.
5. **A rules database replaced the playbook.** Lawyers select text in the template and
   attach a rule: Uber's stance, fallback positions, an exemplar response. Because every
   negotiation starts from the same source contract, a redline to a sentence is a
   redline to a known anchor. "For non-negotiable policies, we use a deterministic Rules
   Engine. Unlike standard RAG, this triggers only on strict semantic matches against a
   target sentence. If a rule matches, it acts as a hard guardrail, overriding the
   model." Negotiable matters (tone, strategy) stay with the probabilistic feedback loop.
6. **Tone is a single-pass "proactive and pessimistic" reflection**: the prompt assumes
   the draft already exhibits the known failure modes and corrects them once, instead of
   looping to convergence. "The lack of loops also limits token usage and latency."
7. **The legal team owns the content of the output-shaping prompt; engineering owns its
   anatomy.** The article's stated lesson: "prompts directly influencing output format
   should be crafted and managed by the application's subject matter experts".
8. **MODIFY drafting is constrained by rules and precedent** because "simple generative
   text often hallucinates terms or drifts from the contract's defined terms".
9. **Evaluation** is continuous LLM-as-a-judge on `document_quality_metric` (retrieved
   context) and `rule_adherence_metric`, plus a labelled dataset from lawyer decisions.
   Reported: a 20% reduction in review time and 91% decision accuracy; the article does
   not say how the 91% was measured.
10. **Next**, they write, are agentic harnesses (Claude Code, OpenCode) "in conjunction
    with skills to structure and automate workflows", and legal ontologies.

## 2. The VSM reading

| Function | In the LRA (per the article) | In `regulator` today | Where the reading disagrees with the LRA |
| --- | --- | --- | --- |
| S1 | per-change adjudication: intent, risk, decision, comment, compromise text | a unit under a profile, in a worktree, under a contract (`packages/protocol/src/contracts.ts`) | the LRA's unit of work is a sentence against a stable template, chosen so the deterministic layer can address it; ours is a contract against a revision. Same principle: pick the unit the checks can address |
| S2 | intent and risk nodes run in parallel; session state in Redis | leases, isolation, reintegration, the thrash detector; nothing semantic ([#14](https://github.com/MetaCoding-io/regulator/issues/14)) | a defined term changed in clause 1 changes the meaning of clause 14. The article meets this only as "drift from defined terms" at drafting time. It is #14's semantic commitment, in a domain where it is the whole game |
| S3 | the lawyer: accept / reject / modify every suggestion | the loop, the contract (fixed / delegated / unresolved), budgets, the recovery router | the LRA has no contract: what the model may decide is implicit in the prompt. A non-negotiable rule is a fixed decision; a fallback list is a delegated decision with bounds; a change no rule or precedent covers is unresolved and should be surfaced, not guessed |
| S3\* | a final LLM step checks the output against the retrieved rule; LLM-as-a-judge metrics; the lawyer | host-run checks bound to a revision (`packages/checks`), `closeout-gate`, `inherited-tests` | the LRA's audit is model judgment by the same model family that produced the output, with a deterministic override only where a rule anchors. Nothing in the article is evidence the unit cannot author. The 91% has no control arm and no stated method; under `EvalReportSchema` it would be "a table" (`packages/protocol/src/evals.ts`, `interpretation` required) |
| S4 | the feedback index with time decay; planned ontologies | `report_intelligence` → obligation; `remember` with provenance, scope and a ≤90-day `reviewBy` (`packages/protocol/src/memory.ts`) | the LRA's memory decays smoothly and is never retracted: a wrong lawyer decision persists with a 365-day half-life. Ours expires on a cliff and can be retracted but not renewed. Each has what the other lacks (§4.3) |
| S5 | the rules database: stance, fallbacks, exemplar, attached to template text; the legal team's ownership of prompt content | the identity files, protected prefixes, `authorityRef`, the S5 decision path | the same split, arrived at empirically: SMEs own content, engineers own mechanism. The LRA does not version the rules or say who may change one; ours does and theirs would need to |
| algedonic | the risk level "to highlight clauses needing deeper review by the lawyers" | interaction kinds, the attention budget, `CONTINUES_WITHOUT_ANSWER` (`packages/protocol/src/interaction.ts`) | every LRA suggestion is reviewed, so the channel is unattenuated and the attention budget is spent at 100%; the risk level is the attenuator they are starting to build. The 20% is the gain from it |

Four observations the table does not hold, each a cybernetic reading of an engineering
choice:

- **A deterministic consequence hung on a probabilistic sensor.** The rules engine
  "overrides the model" (level 2), but what fires it is "a strict semantic match"
  (level 4). The guardrail's reliability is bounded by the sensor's recall: a
  non-negotiable clause the counterparty paraphrases far enough evades the hard rule
  and falls to the feedback loop. The mechanism hierarchy's question is whether the
  trigger could be deterministic. It largely could: every negotiation starts from the
  same template, so a redline *to an existing sentence* has a known anchor without any
  embedding. Only *inserted* text needs the semantic path. That split (anchor first,
  semantic match for the unanchored residue) is §4.1.
- **Intent as a transducer.** Keying the feedback index on intent rather than text is
  Beer's transducer: the counterparty's channel carries surface variety (phrasings) and
  the regulator needs decision variety (what this change does to Uber's position). The
  transduction is lossy on purpose and it is the attenuator that makes retrieval work.
  Its cost is that a misclassified intent loses the precedent match silently, which is
  why it must sit *behind* the anchor, never in front of it.
- **Feedforward instead of feedback.** The pessimistic single-pass reflection replaces a
  feedback loop (critique, revise, re-critique until converged) with feedforward
  correction: assume the disturbance, compensate once. Feedforward is cheaper and cannot
  oscillate, and it works exactly when the disturbance is predictable. The failure modes
  of a legal comment are predictable, and so are a unit's: the registry's
  `absorbs.failureClass` is a catalogue of them (§4.5).
- **Balanced agree and disagree exemplars** keep the regulator's variety across both
  outcomes. A precedent store that only recorded accepted suggestions would collapse the
  model toward agreeing. The article states the balancing without saying why; this is
  why.

## 3. As a workload: `contract-redlining`

The finance example's recipe (`docs/examples/personal-finance.md` §6), applied. The
domain is synthetic: a short master services agreement, a house rules file and
counterparty redlines written for the fixture. No real contract, no Uber content, and
nothing here is legal advice.

### The domain, and where the truth is

| | For the deal review |
| --- | --- |
| Domain output | `dispositions/<deal>.json`, one record per inbound change (intent, risk, decision, the rule or precedent it cites or `none`, the comment, the proposed text for MODIFY); `response/<deal>.md`, the assembled response |
| Source of truth | `inbound/<deal>/redline.json`, the counterparty's changes against the template. The harness reads it and never writes it. If a disposition and the redline disagree about what was proposed, the disposition is wrong |
| The house's law | `template/msa.md` (clauses numbered, defined terms in §1) and `rules/msa.json` (per clause anchor: stance, `nonNegotiable`, `fallbacks[]`, an exemplar comment). Protected; cited by contracts as authority; changed only by a person |
| The person's record | `precedent/`, the lawyer's final decisions with reasoning. Written by the acceptance path, never by a unit |
| The domain's own checks | `test/review.test.js`: every inbound change has exactly one disposition; a change on a `nonNegotiable` anchor is REJECT unless the disposition cites an `accepted-risk` obligation; a MODIFY's proposed text is one of the anchor's fallbacks or is marked `novel` and surfaced; every capitalised term in proposed text is defined in template §1 or in the redline itself; proposed text stays inside the change's span; the response's counts are the dispositions'; the risk level is from the taxonomy |

The one rule that makes it work is the finance example's: nothing reads its own progress
off the dispositions file. Whether a deal is ingested, adjudicated or assembled is
execution state in the orchestrator's store.

### S1 — unit types and grants

| Unit type | Profile | May write | Checks at closeout | Runner |
| --- | --- | --- | --- | --- |
| `ingest` | paralegal | `dispositions/` | `run_checks`, `run_tests`, `inherited-tests`, `identity-untouched`, `glossary-lint` | a session today; a `command` runner once one exists (open questions §3): parsing a redline needs no model |
| `adjudicate` | paralegal | `dispositions/` | same | session |
| `draft` (MODIFY only) | paralegal | `dispositions/` | same | session |
| `verify` | auditor | nothing | `run_tests`, `inherited-tests`, `identity-untouched` | session |
| `assemble` | paralegal | `response/` | same as ingest | session |
| `close` | auditor | nothing | — | session |

The `paralegal` profile is the `bookkeeper` with the prefixes changed: no `bash`, so the
grant is complete at the tool boundary; `lib/` and `test/` under no grant, so a unit
cannot weaken the check that judges it. Intent classification stays inside
`adjudicate` for the first slice; it becomes its own unit type when §4.4 gives it a
declared vocabulary to classify against.

### S2

Unchanged from the lab: one deal, one unit, one lease; reintegration by merge; the
thrash detector catches a disposition that flips between ACCEPT and REJECT across
attempts. What this workload adds is the clearest fixture #14 could want: a redline
that changes a defined term in §1 and a second unit adjudicating §14, which uses it. The
fixture should carry that case even while nothing absorbs it, so the row in
`PATHOLOGIES.md` ("semantic commitments between units") has a reproduction.

### S3 — the contract

One contract per deal for the first slice (per clause group later). For `adjudicate`:

- Fixed: for every touched anchor whose rule is `nonNegotiable`, the decision is REJECT
  and the comment states the stance. `authorityRef` is the rule, which today must be
  cited through a person (`human:<counsel>`), as the finance taxonomy is; a resolvable
  reference to a versioned protected file is the ArticleMiner note's §4.5.
- Delegated: the comment's wording (bounds: first person, direct, states Uber's position,
  no idle conversation — the article's style section, verbatim as advice); the fallback
  chosen for a MODIFY (bounds: the anchor's `fallbacks[]`).
- Unresolved: a change on an anchor with no rule and no precedent, and any inserted
  text. Handling `defer`: the disposition records `decision: "surfaced"` and the close
  carries it as an open item. The unit does not guess. This is the unknown merchant.

### S3\*

The host runs `test/review.test.js` at the committed revision; the unit's report
satisfies nothing. `identity-untouched` over `template/`, `rules/`, `inbound/` and
`precedent/` catches an edit committed around the grant. `glossary-lint` carries the
house's refused words. The defined-terms check is the domain's `glossary-lint` turned
around: not words the instance refuses, but words it may only use if defined.

### S4

A lawyer's stance changes ("we no longer accept unlimited liability caps in SaaS
deals") is intelligence a person holds, and today a person has no intake for it
(open questions §2). Until that lands, the stance change is a pull request to
`rules/msa.json`, which is honest: it is S5, not S4. What *is* S4 here is the precedent
store (§4.3), and a watcher on `inbound/` that raises an obligation when a redline
lands, as the finance example names for `statements/`.

### S5 — what the system must never do

| Invariant | Checked by |
| --- | --- |
| A counterparty's redline is never edited by a unit | `inbound/` outside every grant and under `--protected`; `identity-untouched` at closeout |
| A non-negotiable rule is never overridden by a unit | the domain check: REJECT, or a disposition citing an `accepted-risk` obligation a named person resolved (`PersonSchema.acceptRisk`) |
| Nothing is the house's position until a person accepts it | the `assemble` contract's criterion "this response is what counsel would send" is a human acceptance (`regulator unit accept`), separate from the technical verdict; the harness holds no tool that sends anything, as the finance harness holds nothing that moves money |
| `rules/` and `precedent/` are written by a person | outside every grant, under `--protected`; a unit may `propose_policy_change` |

### Scripted behaviours, for the eval

A `paralegal` that does what the contracts ask, and a `careless` that overrides a
non-negotiable rule with a MODIFY, invents a capitalised term, edits the redline to
match its disposition, and settles the no-rule change silently. Each is caught by a
different check, which is what the report should show.

### Why this is a good third workload, and what it costs

For: it is a domain where most of the work is judgment on top of structure that can be
checked without judgment (the finance property); the hard guardrail is a real
invariant with a real override path (a named person accepting risk); feedback *is* the
product, so it tests the memory and precedent design harder than any repository does;
and it needs the mechanisms the ArticleMiner note already asks for (a command runner,
semantic S2, a person-raised S4, a resolvable authority reference to a protected file)
without needing the one that note says is largest (a non-git domain). A Node fixture
means `run_tests` works today; phase 1 is a definition change plus a fixture, with no
change to the loop.

Against: it is a second non-code example before ArticleMiner, which tests
"generic over workloads" more severely (parsers and a model in one loop; a graph as
output). The two are not exclusive — #61 asks for an authoring guide and a template, and
two examples make a better guide than one — but if only one is built first, this one
is cheaper and ArticleMiner is more informative.

## 4. Mechanisms the article carries, as cards the registry does not have

Each at the level the hierarchy suggests, against the seam it hangs on, with the
limitation that would go on the card. Ordered by how much of the article's value each
one carries.

### 4.1 Anchored constraints (deterministic gate; the contract and the closeout)

**Absorbs:** *constraint-by-prose*. A fixed decision is prose with an `authorityRef`
(`FixedDecisionSchema`); nothing ties it to the place in the domain it protects, so a
unit that touches that place without honouring the decision is caught only if a check
happens to cover it. `PATHOLOGIES.md` records the gap ("a rule written in prose outside
the writable prefixes shows up as a grader's number; no check refuses it").

**Mechanism:** a fixed decision may carry an `anchor` — a path, or a path with a
selector (a clause id, an exported symbol, a JSON pointer). At closeout, if the diff
`base...HEAD` touches an anchor, the report must account for that decision: a
`delegatedResults`/`deviations` entry naming it, or evidence from a check bound to it.
A touched anchor with no account is a failed criterion. `export-signature` is already
this for one anchor kind (module, export, arity); the card generalizes the *trigger*
and leaves the *verification* to the check the expectation names.

**Where the LRA's version differs:** the trigger there is a semantic match. Anchoring
by location is level 2 where the LRA is level 4, and it is possible because, like the
LRA's template, our base is known. Inserted text (a new clause, a new file) has no
anchor and still needs judgment; the card's first limitation says so, and the contract
handles it as an unresolved decision.

**Cost:** one diff per closeout, already computed by `identity-untouched`.

### 4.2 Bounded delegation (deterministic gate; the result-report gate)

**Absorbs:** *out-of-bounds choice*. `DelegatedDecisionSchema.bounds` is a string, so
whether a reported choice is within bounds is model judgment at report time and a
person's at review. The finance taxonomy and the LRA's fallback positions are both
closed lists, and the glossary's own table puts "which category a merchant gets" at
level 4 "because it is judgment" when the *membership* of the choice is not.

**Mechanism:** `bounds` may be `string | { options: string[] }`. `result-report-gate`
refuses a `delegatedResults` entry whose choice is not in `options`; a unit that needs
an option the list lacks reports it as an emergent decision, which is what
`emergentDecisions` is for. The choice itself stays judgment; its membership becomes a
gate.

**Cost:** a protocol change of one field; `contract check` and the report gate grow one
comparison each. Pays nothing in `DEBT.md` directly; adds a row to the glossary's
"every rule and its level" table in the finance example (the category becomes level 2
by membership, level 4 by choice).

### 4.3 Precedent: a person's dispositions as weighted memory (typed tool + prompt; the audit log and the memory store)

**Absorbs:** *decisions-nobody-learns-from*. A human acceptance (`HumanAcceptanceSchema`
in `packages/protocol/src/audit.ts`), an answer, an obligation's resolution rationale:
each is the highest-provenance fact the instance holds about what a person wants, and
each is written to the audit log and read by nothing downstream. The next unit asks
again. The LRA's whole second iteration was built on not throwing these away.

**Mechanism, in two parts.**

- *The write path* (level 3). The CLI's disposition handlers also record a memory entry
  with `recordedBy: "human:<name>"`, `subject` set to the decision's subject (the
  contract's `fixed[].subject`/`delegated[].subject`, which is the intent key the LRA
  uses), the disposition and the note as the fact, and the acceptance as evidence. A
  correction (a rejection, an edited text, a rationale) is recorded with a marker that
  distinguishes it from an unchanged acceptance.
- *The render path* (level 5, and the card says so). Rendering weights entries by age
  with a half-life the budget policy declares (the LRA's `exp(-λ × age)`), renders both
  accepted and rejected exemplars for a subject (the LRA's balance), and weights
  corrections over unchanged acceptances.

**Why the last clause.** The LRA does not say it, and it is the hazard of any precedent
store: accepted suggestions become exemplars for future suggestions, so a lawyer who
rubber-stamps trains the system on itself. It is the self-fulfilling loop the open
questions already name for predictive S4 (§4, hazards). A disagreement carries
information; an agreement with no edit may carry none. The card's first limitation is
that the weighting attenuates this and nothing removes it.

**What stays as it is.** `reviewBy` stays required and bounded for S1-written memory.
Human-written precedent may carry a longer horizon under the same half-life, and
retraction stays a person's. The LRA has decay and no retraction; we have retraction
and a cliff; the card has both.

### 4.4 A declared intent vocabulary (type + model judgment; the workload definition and the routing floors)

**Absorbs:** *surface-keyed regulation*. Routing floors test a signal's `subject`,
`observation` and `rationale` as text (`policies/routing.json`); memory and precedent
are keyed on `subject`, which is free text. The same change phrased two ways is two
subjects.

**Mechanism:** a workload may declare `intents[]`, a closed list (`widen-scope`,
`shift-liability`, `change-defined-term`; for software, `relax-check`,
`change-public-signature`, `add-dependency`). A unit's report classifies each change it
made against the list (level 4 against a level-1 vocabulary); the routing floors and
the precedent render may key on the intent. `deviations.kind` and `emergentDecisions`
are already a small vocabulary of this shape.

**Limitation, stated up front:** this is the weakest proposal here because the
classification is judgment, and a misclassification loses the match silently. It belongs
behind the anchor (§4.1), never in front of it, exactly as the LRA's feedback index sits
behind its rules engine.

### 4.5 A registry-rendered critique (prompt; `agent_before_settle` or the `report_result` tool)

**Absorbs:** *refusal-by-surprise*. A unit is refused at closeout for a failure class
the registry already names, and spends an attempt learning what the gate would have told
it. The LRA's pessimistic reflection corrects known failure modes in one feedforward
pass before the output is judged.

**Mechanism:** before a report is written, render the `absorbs.failureClass` and
`absorbs.description` of every regulator the unit's declared checks and gates
correspond to, as a checklist the unit answers: assume each is present, show where it is
not. Generated from the registry, so it cannot drift from what the gates check. Level 5
by construction, and the card says so; its value is measurable, as attempts per unit
and refusals under an ablation arm, which the eval harness already does for every
prompt-level card (`contract-advice`, `identity-context`).

**Not** a loop. The recovery router already loops (repair → repair → replan); this is
the one pass before the first attempt is judged.

### 4.6 Severity to interaction kind (deterministic gate; the interaction policy)

**Absorbs:** part of *whether-to-ask-is-the-model's* (`DEBT.md` row 29). The LRA's risk
level decides how much lawyer attention a change gets. Here, whether an action needs
consent or acceptance is the model's to notice.

**Mechanism:** an anchored constraint (§4.1) carries a severity, and the interaction
policy maps severity to the interaction kind the closeout requires: a touched
`nonNegotiable` anchor requires a `uat` acceptance by a person with `acceptRisk`; an
advisory anchor requires a `recap`. The mapping is a table in a policy file, so the
derivation is level 2 for anchored cases. Unanchored cases stay as row 29 says, and
[#60](https://github.com/MetaCoding-io/regulator/issues/60) (per-tool consent grants)
covers the tool side. Depends on §4.1.

### 4.7 An agreement instrument (not a regulator; open questions §4)

The LRA's labelled dataset is the agreement between the model's disposition and the
lawyer's. In the open questions' terms that is a base-rate *instrument*: agreement per
subject or intent, per unit type, computed from the audit log's acceptances against the
reports' `delegatedResults`, graded on calibration. It informs; it refuses nothing. The
LRA's `rule_adherence_metric` is the same quantity measured by a model instead of a
count; where §4.1 anchors the rule, the count is available and the model is not needed.
Waits on the live eval report (#46), as the open questions say.

### 4.8 What the article lacks, as course material

The reading in §2 is also a field study. Each row below is a lesson the article makes
concrete, by showing a production system that has the function in the left column
only partly:

| What the LRA does | What it does not say | Lesson |
| --- | --- | --- |
| a final LLM step checks the output against the rule | the auditor is the executor's model family; nothing is evidence the unit cannot author | M09, evidence not claims |
| 91% accuracy, 20% faster | no control arm, no method, no interpretation | M14, two-arm evals |
| a deterministic engine on a semantic match | what the match does not catch (a paraphrase); no stated enforcement boundary | M10 and `BOUNDARY.md` |
| exemplars decay with a 365-day half-life | no provenance per exemplar, no retraction | M12, memory with provenance and expiry |
| drafting constrained to avoid defined-term drift | the coupling between clauses is handled at drafting, not as coordination | M05 and #14 |
| "agentic harnesses … with skills to structure workflows" | which failure each skill absorbs | M01: the harness is the regulator |

## 5. What this note does not propose

- A Word add-in, OpenSearch, LangGraph or any of the LRA's stack. The fixture is plain
  files and the checks are Node, so the loop runs it today.
- Real legal content, or a workload that gives legal advice. The fixture's agreement is
  written for the fixture.
- Replacing the semantic match with the anchor. The anchor handles the redline to known
  text; inserted text still needs judgment, as an unresolved decision the report must
  account for. The LRA's hybrid is right; this note makes the two halves explicit and
  puts the deterministic one first.
- A new loop. Every proposal in §4 is a field on an existing record, a rule in an
  existing gate, or a rendering of an existing store.

## 6. Next step

Decide whether `contract-redlining` is built under
[#61](https://github.com/MetaCoding-io/regulator/issues/61) beside or before
ArticleMiner. If yes: the fixture (`packages/regulator/fixture-redlining/`), the
workload (`workload/contract-redlining.json`), the `paralegal` profile, one contract
per unit of the first deal, the scripted `paralegal` and `careless`, and the worked
example under `docs/examples/`, with no change to the loop. §4.1 (anchored constraints)
is the one card the workload needs to be honest about its hard guardrail; §4.2 and §4.3
are small and pay in every workload; §4.4 to §4.7 wait.
