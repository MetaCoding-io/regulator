# Research notes

Design notes on where `regulator` could go next, written before any of it is on the
[roadmap](../../ROADMAP.md). Each note takes one source — a paper, a system, a
conversation — and asks two questions of it: what could run under the control plane
today, and what the control plane would have to grow to run it well.

A note is not a commitment. It graduates by becoming something that is: an issue with
acceptance criteria, a row in [`DEBT.md`](../DEBT.md) when a card's limitation names it,
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
