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
