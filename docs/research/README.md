# Research notes

Design notes on where `regulator` could go next, written before any of it is on the
[roadmap](../../ROADMAP.md). Each note takes one source — a paper, a system, a
conversation — and asks two questions of it: what could run under the control plane
today, and what the control plane would have to grow to run it well.

A note is not a commitment. The roadmap's
[threads](../../ROADMAP.md#threads--designed-not-yet-scheduled) table lists every open
note's next step, so the notes are found from there. A note graduates by becoming
something that is: an issue with acceptance criteria, a row in [`DEBT.md`](../DEBT.md) when a card's limitation names it,
an ADR under [`decisions/`](../decisions/) when it changes the architecture, or a roadmap
item. When it does, the note says so at the top and stays as the record of why.

Conventions:

- One file per source, named `<date>-<topic>.md`, with a status line (`open`,
  `graduated: #NN`, `dropped: <reason>`).
- Claims about what the code does today cite the file. Claims about what a source does
  cite the source. The two are kept apart, because the gap between them is the point.
- Features are proposed at a [mechanism level](../ARCHITECTURE.md#mechanism-hierarchy)
  and against an existing seam where one exists (the host seam, the workload
  definition, the check names, the policy files).

Like `archive/`, this directory is not built into the documentation site.

| Note | Status |
| --- | --- |
| [ArticleMiner as a knowledge-production workload](2026-09-25-articleminer-knowledge-production.md) | open |
| [Open questions and things to think about](2026-09-25-open-questions.md) — the control room's system view, person-raised S4 intelligence, units without a session, predictive S4, whether the control room should write, and a running backlog | open, running |
| [Documentation and website gaps](2026-09-25-docs-and-site-gaps.md) — a coverage audit of the docs site and the product website, with one probable product bug and a ranked work list | open, work list |
| [The first live drift runs](2026-09-29-live-drift-run.md) — what three live runs of the drift suite found (an unbound session, a halt failed over as a provider failure, a retired fallback model), the interim numbers, and what the committed report must say | open until #46 closes |
| [Homelab control plane](2026-09-27-homelab-control-plane.md) — building infrastructure and its control plane together: evidence before authority, a proposed stack, staging and production from one environment spec, and twelve conflicts with the architecture | open |
| [Harness² read through the control plane](2026-10-18-harness2-recursive-harnessing.md) — Google's recursive harness-editing loop mapped onto the VSM functions and the pathology catalog: what it has that regulator lacks (a measured learning loop over the harness), what it lacks that regulator has (S5, independent audit, a person), and the proposal-not-adoption slice regulator could take; §7 names the component (the reflector, decided) as the S4 of the level above, with before-and-after figures; §9 reads the DSPy book as the reflector's implementation reference (GEPA and SIMBA as Propose and Compose, the saved program as the `harness-edit` change, the judge chapter as the instrument's calibration procedure) | open |
| [The accept-path split on `BOUNDARY.md`](2026-10-18-accept-path-split.md) — which definition files land through which accept path, as data: advice becomes a file set seeded like identity, the split is a closed list in `protocol` rendered into `BOUNDARY.md`, the commands are `advice accept | reject | promote`, and the third path is a merged change under the loop; four slices with their done-when lists | graduated: slice 1 is #110, slice 2 is #138 (landed); slices 3–4 open |
| [Paper 1 — Regulating the Regulator](2026-10-18-paper-regulating-the-regulator.md) — formal two-level governance model, novelty/critical literature, falsifiable study protocol, minimal Reflector demonstration, replication package and SRBS publication plan; tracked in issues #103–#108 | active research track; separate from product milestones |
| [The behavioral canary](2026-10-22-behavioral-canary.md) — two things called a canary, told apart by polarity: the credential canary (a value whose presence is the alarm) and the behavioral canary (a rule whose silence is); the mechanism as landed in the identity extension, what it does not see, and the slice that lets S3 act on it | graduated: slice 1 landed in #132; slice 2 is #133, after #46 |
| [Paper 1 / #113 — Cross-harness VSM vocabulary pilot](2026-10-18-paper-113-vsm-vocabulary-pilot.md) — exploratory, evidence-coded mapping of Regulator, OpenCode and CrewAI against S1–S5/S3*/recursion, counterexamples, MAPE-K comparison and an independent-rater study design | exploratory; awaiting review and source-level reproduction |
| [A portfolio under management as the third workload](2026-10-24-portfolio-workload.md) — the robo-advisor book read as a workload: its rebalancing, wash-sale and return arithmetic as the domain's deterministic checks, consent on a trade list through a tool with a declared irreversible effect, three S4 sensors, Black–Litterman as a bounded judgment in numbers, and what the control plane must grow (the `command` runner, declared sensors, workload graders, the prediction record); three phases, Phase 1 under #61 | graduated: Phase 1 is #120; Phase 2 is #121–#124; Phase 3 is #125 (blocked) |
| [Two agent-engineering books read against the control plane](2026-10-25-agent-engineering-books.md) — Hur and Song's `scratch_agents` and Lanham's *AI Agents in Action* read in full as the untyped versions of what regulator types: a ranked list of fourteen findings and where each landed (two pathology rows, two pilot cases, five issues, five backlog rows), five things the books get right that regulator does not, and two scripted foils for the drift suite | graduated: the two foils are #130 (after #46); the rest landed as additions |
| [A statistical report as the fourth workload](2026-10-26-agentic-statistics-course.md) — Sumpter's free *Agentic AI for Statistics and Data Science* course and the public template it is taught from, read as a workload: the template's twenty-one-rule contract mapped rule by rule to its mechanism level and its counterpart here, the text checks a fixture would own, the Python-domain decision, three things the untyped version gets right (friction as the product, a gate on bias rather than harm, the record beside the argument), and the article series the course outlines; thirteen lessons still to land through 30 November | open; filed as [#150](https://github.com/MetaCoding-io/regulator/issues/150) under #61 |
