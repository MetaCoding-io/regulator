# Archived design records (September 2026)

These documents are kept for the record and are **not maintained**. Nothing in them is
a statement about what the build does today; for that, read the registry
(`course/lab/registry/REGULATORS.md`), the protocol schemas under
`packages/protocol/src/`, `docs/ARCHITECTURE.md` and `docs/DEBT.md`.

Six of them were written between 6 and 7 September 2026, when VSM-Pi was scoped as a
regulation layer *on* GSD-Pi. That scope was retired on 22 September 2026 — VSM-Pi
provides its own orchestrator — and the decision is recorded in
[`docs/decisions/0001-own-orchestrator.md`](../../decisions/0001-own-orchestrator.md).
Two are the course's planning documents, superseded by the built registry and by the
project roadmap.

| Document | What it was | What replaced it |
| --- | --- | --- |
| [DESIGN-ROADMAP.md](DESIGN-ROADMAP.md) | The GSD-era workstreams (A–E) and, in its §0, the decision that retired them | ADR 0001; the project roadmap |
| [OPERATIONAL-WORK-CONTRACT.md](OPERATIONAL-WORK-CONTRACT.md) | The two-level work contract (slice and task) and the result report | The task-level `WorkContract` and `ResultReport` in `packages/protocol/src/contracts.ts` (lesson 06), under different field names; the slice level was never built |
| [PLANNER-CONTRACT-COMPOSITION.md](PLANNER-CONTRACT-COMPOSITION.md) | How contracts would compose with GSD's planning tools | Contracts are JSON files the orchestrator commits immutably at dispatch; there is no planner tool |
| [REGULATORY-STATE-AND-ROUTING.md](REGULATORY-STATE-AND-ROUTING.md) | Obligations, dispositions, routing and boundaries | `packages/core/src/obligations.ts`, the routing and interaction policies (lessons 11–13, 15); scope, required mechanisms and exposure boundaries remain unbuilt |
| [S2-COORDINATION-GAP-ANALYSIS.md](S2-COORDINATION-GAP-ANALYSIS.md) | What GSD did for S2 and what was missing | Leases, worktrees, reintegration and the thrash detector (lesson 05); the semantic-commitment half is issue #14 |
| [GSD-VSM-FUNCTIONAL-MAP.md](GSD-VSM-FUNCTIONAL-MAP.md) | Projecting VSM functions onto GSD's units | Capability profiles keyed by unit type (lesson 04); none of its capability names exist |
| [PRODUCTION-PLAN.md](PRODUCTION-PLAN.md) | The course's build sequencing and its dependencies on VSM-Pi milestones | The lessons are written; the roadmap and `docs/DEBT.md` track what is owed |
| [CONTROL-REGISTRY.md](CONTROL-REGISTRY.md) | The specification of the regulator registry and the control room | Both are built: `packages/protocol/src/registry.ts`, `regulator check`, `packages/control-room` |

Where a course lesson cites one of these as field-study material, it is citing a design
record on purpose: the exercise is to compare the design with what was built.
