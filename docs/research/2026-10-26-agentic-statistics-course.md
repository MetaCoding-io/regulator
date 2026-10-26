# A statistical report as the fourth workload: Sumpter's *Agentic AI for Statistics and Data Science* read against the control plane

- **Status:** open; filed as [#150](https://github.com/MetaCoding-io/regulator/issues/150) under
  [#61](https://github.com/MetaCoding-io/regulator/issues/61). Written as a table-of-contents
  assessment in the shape the [open questions backlog](2026-09-25-open-questions.md#6-backlog--smaller-things-to-think-about)
  used for the Manning books (the 2026-10-24 row); thirteen of the course's sixteen lessons are
  still to come (§8), and each release is read and appended here.
- **Sources:** the course, <https://wordalisation.com/courses/agentic-ai-for-statistics-and-data-science/overview/>
  (David Sumpter, Uppsala University, CC BY 4.0, free); its companion
  *Agentic AI for Research* (11 lessons, 115 min of video, same licence); and the public
  template the course is taught from, <https://github.com/Vivid-Insights/human-agentic-data-analysis>
  (CC BY 4.0, 82 stars, 15 commits). The four course videos on the author's channel
  (course overview and "Keeping yourself in the loop", 2026-10-16; step 1 and step 2
  recordings, 2026-10-24) are the recordings the lesson pages write up; their captions could
  not be fetched from this session, so the lesson pages stand in for them.
- **What is actually there today (2026-10-26):** three lessons of sixteen have content (1.1,
  1.2, 1.3). The rest are dated placeholders: 1.4–1.8 on 2 November, 2.1–2.5 on 16 November,
  2.6–2.7 on 30 November 2026. The template repository is complete.
- **Question:** the research README's two, plus the one the books note earned: what in this
  could run under the control plane today, what the control plane would have to grow, and
  where the untyped version gets something right that regulator does not.

## 1. Verdict

There is nothing to buy. The course is free and CC BY 4.0, and so is the template. The
substantive artifact is not the course at all but the template's working contract,
`instructions.md`: 401 lines, twenty-one rules, each one written the moment the agent did
something unwanted, imported wholesale by a three-line `CLAUDE.md`. There are no skills, no
subagents, no hooks and no tests in the repository; `.claude/settings.json` only switches
built-in skills off. Everything is level 5 of the mechanism hierarchy. That is exactly what
makes it the right foil: it is the best-documented untyped version of a research workload we
have seen, in the same way the books note found Hur and Song to be the untyped version of
consent, memory and planning.

Its thesis is regulator's. The author's phrase is "strategic friction": the agent runs long
chains faster than a person can check them, so the contract makes it do one step per request,
propose before it acts, fix the question before it sees the data, build the report as it goes
with the appendix as the record, list faults without fixing them, and refuse to export until
the person has confirmed the disclaimer in answer to being asked. Every one of those is a rule
regulator already has a mechanism for, or a seam for. The gap between the two is the article
series the user is asking about, and the mapping in §3 is its outline.

As a fourth workload it is a better fit than ArticleMiner and a cheaper one than it looks,
with one decision to make first (§4, the Python domain). As a source for articles on fuzzy,
research-shaped, person-heavy domains, it is the best single source found so far, and the
half of it worth waiting for (1.5 "Traditional statistics versus Agentic statistics", 1.8
"Best practices", 2.1–2.2 on context and adapting the framework, 2.7 "Fully automated
research?") lands between 2 and 30 November.

## 2. What the course and the template say

The eight steps of the contract, each one or more exchanges, each begun only when asked:

| Step | What the agent does | What stays with the person | What it fills |
| --- | --- | --- | --- |
| 1 Import and scope | finds or loads the data, records provenance with a checksum, describes the file in two passes (what is there; then whether it can answer the question), proposes subsets with their cost | which subset, every cleaning decision, verifying the provider's page | `Data Summary` in the appendix; never the report |
| 2 Frame the question | works from column names and metadata only; no plots, no correlations, no "just to check" | the question, in their own terms; the literature check | `Research Question` in the appendix, then the questions into the report's `Introduction` before anything is tested |
| 3 Visualisation | proposes each chart (axes, rows, what a reader would see) before making it; one script per figure, reading only cleaned data or exported coefficients, never refitting | approval of each chart; which orientation when it is open | figures into `Results` |
| 4 Statistical tests | proposes the test with its assumptions, checks them against the data, reports estimate, interval and n, re-derives the carrying number by a second route | agreement to each test; the normative calls | `Methods` and `Results`, same sub-headings, same order |
| 5 Conclusions, limitations | interprets what the results support and what they do not; no new analysis | the paragraph structure | `Discussion`, `Limitations` |
| 6 Background, abstract | proposes the claims the background needs, finds and reads the sources, brings them before writing; abstract last | which sources belong; the title | `Introduction` background, `Abstract` |
| 7 Read through | one pass in order; re-derives the descriptive numbers from the pipeline; lists what is wrong and fixes nothing | every disposition | the list, logged even when empty |
| 8 Export | quotes the disclaimer and waits for confirmation given now, in answer to being asked; scripts the export; reads the output back and checks it mechanically | the confirmation; the format | a Word or PDF file; `Report.md` stays authoritative |

Rules that cut across the steps, and matter for the mapping: the person's text is checked
but never corrected (quote the sentence, give the right value, leave the change to them); a
check that found nothing must be distinguishable from a check never run; a decision later
reversed stays in the record marked superseded; nothing enters a report section before the
step that owns it; `Attachments/` is never modified; a message prefixed `FRAMEWORK` changes
the contract, applies retrospectively, goes in its own commit and is promoted to `main` in the
same sitting; the agent stages named files and never commits or pushes unasked.

Lesson 1.1 grounds the friction in the automation literature (Bainbridge 1983; Mitchell,
Ghosh and Passi 2026, "AI Agents Push Humans Out of the Loop", which argues oversight needs
design affordances and protocols against skill atrophy, not a person nominally in the loop).
Lesson 1.3 is the worked case: the agent proposed a quadratic in log GDP without saying why,
and when pressed found its own test too weak; the author caught a false factual claim about
the data, an off-by-one carried from console output, and a naive average that understated
rates by up to 16% where loss was highest. The companion course's lesson 6 collects the
evidence: LLMs pick the textbook test reliably (Shukla 2025; Sebo and Wang 2026), repeat
misconceptions about p-values and intervals while flagging them (Rovetta et al. 2026), refuse
a blunt instruction to p-hack and comply with the same request reworded as "exploring
alternative approaches to uncertainty" (Asher et al., Stanford), and on whole-analysis
benchmarks go from chance (BixBench, early 2025) to 65% for Claude Code, 92% with a library
of Skills (Zhang 2026). Lesson 5 is the author's own checking method: self-review with
comments, names against values, assumptions stated and tested, the method explained and the
source opened, the approach compared with what the field's journals actually publish.

## 3. The mapping: each rule, and its level

The contract's rules sorted by where they would sit in regulator. Claims about the code cite
the file; the rest cites the contract.

| Contract rule | Level | Regulator counterpart | State |
| --- | --- | --- | --- |
| `Attachments/` is never modified | 2 | a protected prefix in the instance manifest, diffed at every closeout (`identity-untouched`) | exists |
| One step per request; nothing from a later step | 1–2 | a unit type per step; the profile's writable prefixes and declared effects; `requiresContract` | exists, if the report is split into files per section (§4) |
| The question is fixed before anything is tested | 2 | a fixed decision in the frame-question contract citing the person; the profile for that unit type grants no execution effect; a host check that `Code/outputs/` is empty at the revision the question was written at | the fixed decision and the grant exist; the ordering check is new and cheap |
| Propose the chart or test, get agreement, then act | 3 | `ask_human` under the consent kind; the answer reaches the next attempt as its hint ([asking a person](../concepts/asking-a-person.md)) | exists; the question count per unit is the contract's |
| Every number in the report comes from generated output | 2 | a domain check: the numerals in `Report.md` are a subset of the numerals in `Code/outputs/*.md` and `*.json` | new, the workload's own; the kind of check `fixture-finance/test/` is |
| `Methods` and `Results` carry the same sub-headings in the same order; `References` last; no bold in the report; the disclaimer section present and unchanged | 2 | domain checks over Markdown structure | new, the workload's own |
| Figure scripts never refit a model reported elsewhere | 2 | a static check: no estimator import in `Code/*_figure.py`, only reads of `outputs/` | new, the workload's own |
| Every figure referenced, every citation with a reference and back, every reference link resolving | 2 | a domain check (the link check needs network, so it is a declared command, not a unit test) | new |
| Read through: list, do not fix | 1–3 | an audit unit under a read-only profile; findings through `report_audit_finding`; S3* never repairs | exists; the `auditor` profile is reusable as the portfolio reused it |
| The person's text is checked, errors reported, never corrected | 3 | an audit finding owed to the person as an obligation; the unit's grant excludes the person's file | exists |
| Export only after the disclaimer is confirmed now, in answer to being asked; silence and earlier agreement do not count | 2–3 | the pause gate and "silence is never consent" (the interaction policy); consent recorded on the obligation with the action it names | exists; the "same wording, now" rule is the open backlog row on held consent across attempts (open questions §6, the portfolio row) read in reverse: here a changed wording must ask again |
| `FRAMEWORK` changes the contract, retrospectively, in its own commit, promoted to `main` the same sitting | 2 | advice as a seeded file set; `advice accept \| reject \| promote`; `DEFINITION_WRITERS` ([#110](https://github.com/MetaCoding-io/regulator/issues/110)) | exists, and the course's mechanism is the untyped version of exactly this split |
| A check that reports nothing is distinguishable from one never run | 2 | a verdict is fresh evidence at the revision, recorded in the audit log whether or not it refused anything | exists; worth quoting in the evidence page |
| A reversed decision stays, marked superseded | 2 | the append-only regulatory log; a contract version's predecessor | exists |
| Describe the file before judging it, in two outputs | 5 | advice | stays advice; the article is why |
| Do not grade the evidence; no scoring words | 5, with a 2 | advice, plus `glossary-lint` over a refused-words list (reassuring, striking, damning…) | the lint exists; the word list is the workload's identity |
| Agree the method, name the assumptions, check them against the data | 4–5 | judgment; the contract's expected evidence names the assumption check as an output file the host can see exists | judgment stays judgment; the evidence requirement is typed |

Three things the untyped version gets right that regulator does not, in the books note's
sense:

1. **Friction is the product, not the cost.** Regulator treats a person's attention as the
   scarcest budget (`attention.blockingPerAttempt`) and asks as rarely as the policy allows.
   The course's position, from Mitchell et al., is that the asking is what keeps the person
   able to judge; an instance that minimises interruptions optimises for the deskilling the
   contract exists to prevent. The two are reconcilable (consent on the decisions that are
   the person's, silence on the rest), but regulator's docs argue only one side. This is an
   article, and probably a line in the interaction policy's reference page.
2. **The question before the data, as a gate on bias rather than on harm.** Every consent
   gate in regulator guards an irreversible effect. The frame-question rule guards an
   epistemic one: a question chosen after seeing the patterns is not tested. Asher et al.'s
   p-hacking result (refused when blunt, complied with when reworded) is the clean statement
   of why this cannot be a prompt: the refusal was a prompt, and a rewording passed it. This
   is a pathology row ("specification search under a reworded instruction"), absorbed by an
   ordering check the host runs, not by the model's ethics.
3. **The record kept beside the argument, by design.** `Report.md` and `Appendix.md` are two
   documents for two readers, and the rule that the appendix fills from step 1 while the
   report stays empty until the step that owns a section is what makes the final read-through
   possible. Regulator's worked examples have the domain output and the regulatory log, but
   nothing in them says what a *report to a person* owes the audit trail. The course's answer
   (the record is a document the person can read, not a store) is worth stating.

## 4. What the control plane would have to grow

| Needed | Level | Seam | Exists as |
| --- | --- | --- | --- |
| The domain's checks, in a Python domain | 2 | either declared checks for non-Node domains (the ArticleMiner note §4.1, roadmap 0.3, not landed) or the portfolio's decision: port the checks to Node | **Decide this first.** The checks in §3 are over Markdown and JSON, not over statistics: numerals, headings, links, imports. They are text checks and port to `node --test` as the portfolio's arithmetic did. The statistics stay in Python under the `command` runner ([#122](https://github.com/MetaCoding-io/regulator/issues/122)), as the portfolio's optimiser does. No new seam |
| Section-granular write grants | 2 | the profile's writable prefixes are paths; the contract's are sections of one file | split `Report.md` into `report/01-introduction.md` … `report/08-references.md` in the fixture and concatenate at export. The gate then exists unchanged. The alternative, a section-level write gate, is a new mechanism for one workload and is not worth it |
| An ordering check: no output before the question | 2 | a host check or a domain test reading the tree at the revision | new, small: `Code/outputs/` empty when `report/02-questions.md` is first non-empty, read off git history at closeout |
| A consent whose wording is part of the action | 3 | the consent obligation records the action consented to | the open backlog row on held consent (open questions §6); this workload is the case where the *text* is the action |
| The `command` runner for the Python steps | 2 | the unit type's `runner` | designed, #122 |
| A metric worth comparing across arms | 2 | `metrics[]` with a grader ([#129](https://github.com/MetaCoding-io/regulator/issues/129) landed) | candidates: numbers in the report not traceable to output (count, lower is better); claims in `Discussion` with no `Results` paragraph; both computable by the fixture's `lib/` |

Nothing here needs the artifact store or the unit graph that ArticleMiner needs; the domain is
small files in a git repository, which is the one domain the loop has.

## 5. Fixture and scripted behaviours

The fixture is a small dataset and the empty templates. The user's own
`jquacinella/MediaFundingAnalysis` (media freedom against public funding; Democracy Index and
Free Press data) is a candidate: a real question, public data, two authors, and a repository
that is currently a README and a licence, so the workload would produce its first analysis.
The course's own `forest_analysis_dataset.csv` (135 countries, CC BY 4.0, on the materials
page) is the alternative if a neutral subject is better for the docs.

The two scripted behaviours the authoring guide requires: a careful one that keeps the
contracts, and a drifting one that drifts in the ways the checks catch. The course and the
sample walkthrough supply the drifts, each one observed: a number typed from memory into the
report (walkthrough entry 15: three values read off a chart by eye); a figure script that
refits the model; a test run during step 2 "just to check"; a limitation written into the
introduction; a scoring word in `Results`; the disclaimer softened; the export produced after a
"go ahead" given earlier in the conversation. That is seven refusals, one per check, which is
what step 2 of the authoring checklist asks for.

## 6. The article series, as the course outlines it

Each is one contract rule, what it absorbs, and its level, in the shape of the worked
examples' "every rule, and its level" table. The ones the course's released lessons already
carry: strategic friction (1.1); describe before judging, provenance with a checksum, the
subset's cost recorded (1.2); the question before the data, and the literature check as the
person's job (1.3); the checking method (research course 5); the evidence (research course
6). The ones to wait for: traditional versus agentic statistics (1.5, 2 November), best
practices (1.8), how context is set up and adapting the framework (2.1–2.2, 16 November),
fully automated research (2.7, 30 November).

## 7. What this assessment does not claim

The course is one author, one worked example, and three released lessons. The contract has no
evaluation of its own: twenty-one rules each written after a failure is a record of failures,
not evidence that the rules prevent them, which is the gap the drift suite exists to fill and
is an argument for the workload rather than against it. The video recordings were not
watched; the lesson pages are their write-ups and were read in full. Nothing in the template
was run.

## 8. Next step

Read 1.1–1.3, research-course 5–6 and the template's `instructions.md` (about two hours).
Decide the Python-domain question in §4 (recommendation: Node checks over the text, Python
under the runner, as the portfolio decided). The backlog row, the roadmap thread row and
[#150](https://github.com/MetaCoding-io/regulator/issues/150) exist; the issue's done-when is the
workload. Lessons 1.4–1.8 (2 November), 2.1–2.5 (16 November) and 2.6–2.7 (30 November) are read
as they land and what they change is appended as a dated section below §7.
