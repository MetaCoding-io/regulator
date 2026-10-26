# Roadmap

Where `regulator` is going, in three milestones, and what each closes. The build's
open debt is one row each in [`docs/DEBT.md`](docs/DEBT.md); this page maps those rows
to milestones and issues so a contributor can pick one up, and lists what is *not*
planned so nobody re-files it. The registry cards stay the source of truth for what a
regulator does not catch; an item here that pays a row says which.

Milestones are labels on issues (`roadmap:0.1`, `roadmap:0.2`, `roadmap:0.3`). Dates
are not promised; order is.

## 0.1 — Operable

*The reference build is a published product a team can install into a repository, run
under CI, and read the documentation for.* **Done.** The six packages are on npm
([#44](https://github.com/MetaCoding-io/regulator/issues/44); 0.1.3 is current, each
patch a live run's finding — the changelog says which) and the documentation site is on
GitHub Pages ([#45](https://github.com/MetaCoding-io/regulator/issues/45)).

Done in 0.1: the `regulator` CLI with `init` and `doctor`; the S3 loop over two
workloads; forty-two active regulators with `REGULATORS.md` and `BOUNDARY.md` rendered
from the registry; host-run evidence at closeout; obligations, delivery and the
algedonic path; the eval harness with four committed scripted reports; the Pi host as
its own package behind the host seam; the docs site; the course in its own repository.

## 0.2 — Trustworthy

*Evidence about the regulators under a live model, and the checks the cards already
name as their next step.* This is the milestone that turns the registry's claims into
measured ones and closes the debt that a card's own retirement condition points at.

| Item | Pays | Issue |
| --- | --- | --- |
| A live eval report over the drift scenario, with an interpretation; the model router's failover observed end to end | rows 33, 15 | [#46](https://github.com/MetaCoding-io/regulator/issues/46) |
| Planner-quality graders over the result reports' diagnostics | row 40 | [#49](https://github.com/MetaCoding-io/regulator/issues/49) |
| `inherited-tests`: per-assertion diff, a test-layout convention, a cached base run | row 41 | [#50](https://github.com/MetaCoding-io/regulator/issues/50) |
| Definition versions: a migration note per release and `regulator upgrade` for instances | row 39 | [#53](https://github.com/MetaCoding-io/regulator/issues/53) |
| Behaviour checks beyond `Function.length`: a probe a contract can carry | row 35 | [#54](https://github.com/MetaCoding-io/regulator/issues/54) |
| Fixture: the flaky test and the migration that must not be re-run | row 13 | [#55](https://github.com/MetaCoding-io/regulator/issues/55) |
| The viability case rendered from the registry (`VIABILITY.md`), the capstone's artifact | — | [#57](https://github.com/MetaCoding-io/regulator/issues/57) |
| Drift suite: a `confident` behaviour (self-report as control variety) and a poisoned-memory fixture (data absorbed as control), after #46 | — | [#130](https://github.com/MetaCoding-io/regulator/issues/130) |
| The accept-path split, slice 2: the prediction record on an intelligence signal, its resolution from the stores (confirmed, disconfirmed, inconclusive), and the typed `harness-edit` payload | — | [#138](https://github.com/MetaCoding-io/regulator/issues/138) |

0.2 is done when the live report is committed, every row above is struck or moved to
"not planned" with a reason, and `regulator review --due` is clean at the first review
date (2026-12-01).

## 0.3 — Community

*The seams proven by a second implementation on each side of them: a second host, a
third workload, and the mechanisms that make an instance event-driven rather than
polled.*

| Item | Pays | Issue |
| --- | --- | --- |
| A second host behind the host seam, with `BOUNDARY.md` saying which hosts enforce which gate | — | [#58](https://github.com/MetaCoding-io/regulator/issues/58) |
| Route on append: watch the regulatory log and the ledger; delivery as a hook, not a poll | row 23; `outbox-watcher` retirement | [#59](https://github.com/MetaCoding-io/regulator/issues/59) |
| Per-tool consent grants as a profile field, enforced by interception | row 29 | [#60](https://github.com/MetaCoding-io/regulator/issues/60) |
| A third workload, contributed: the authoring guide and a template | — | [#61](https://github.com/MetaCoding-io/regulator/issues/61) |
| Semantic S2: typed coordination commitments between units | — | [#14](https://github.com/MetaCoding-io/regulator/issues/14) |
| The behavioral canary acts: `context-degradation` as a recovery cause whose answer is a fresh session, once the live report says the canary has lead time | row 42 | [#133](https://github.com/MetaCoding-io/regulator/issues/133), after #46 |

Alongside: a contributor pathway ([`CONTRIBUTING.md`](CONTRIBUTING.md), issue templates
for a bug, a debt row and a proposal), and the course's first cohort pinned to a release
tag.

## Threads — designed, not yet scheduled

Work that has a design note but no issue yet. Each row points at the note that holds
the design and names the one next step, so a thread can be picked up without rereading
the conversation that started it. A row leaves this table when its first slice becomes
an issue in a milestone above and nothing designed is left behind it, or when it is
dropped (the note's status says why). A thread with later slices keeps its row and
names the issue its current slice is in.

| Thread | Design | State | Next step | Fits |
| --- | --- | --- | --- | --- |
| The system's figures generated from the definition: the loop, the session's gates, the workload, the recovery lattice, the unit lifecycle, who writes where — as views in the control room beside the six-column topology, in the docs by `regulator docs --write`, copied by the website | [open questions §1](docs/research/2026-09-25-open-questions.md#1-the-control-room-should-show-how-the-declared-system-connects) | decided; two slices landed | The typed enforcement points landed ([#76](https://github.com/MetaCoding-io/regulator/issues/76): `ENFORCEMENT_POINTS` in `protocol`, five places with closed lists held against the code). The unit lifecycle landed: `UNIT_TRANSITIONS` enforced by the store, `renderLifecycleFigure` in the product, and the control room's Lifecycle view stepping a unit's trajectory with its why from the records (`unit-lifecycle`; DEBT row 47). Next: the generator over the enforcement points and `regulator docs --write` for the SVGs, the lifecycle figure first so the website's hand-drawn six states becomes a copy of the generated one. The first generated figure of the whole system is the one-level map, which the hand-drawn "before" figure in the [Harness² note §7](docs/research/2026-10-18-harness2-recursive-harnessing.md#the-two-levels-drawn) and the docs' [What's coming](docs/project/whats-coming.md) page anticipate; a lesson highlight is an arm-style filter over the records' `introducedIn`, so the course gets fifteen views of one figure | 0.2 |
| A person can raise S4 intelligence; sensors declared in the definition | [open questions §2](docs/research/2026-09-25-open-questions.md#2-a-person-should-be-able-to-create-s4-intelligence) | proposed; the sensors half is filed as [#123](https://github.com/MetaCoding-io/regulator/issues/123) with three sensors from the portfolio workload | `regulator intelligence report --by …` writing the same `intelligence-signal` under `human:<name>` provenance; the sensors in #123 | 0.3, beside #59 |
| Units that run a program, not a session | [open questions §3](docs/research/2026-09-25-open-questions.md#3-must-every-unit-run-a-pi-session) | answered: the dispatcher seam already allows it; filed as [#122](https://github.com/MetaCoding-io/regulator/issues/122) with the portfolio workload's two program units as the case | A `command` runner per unit type in the workload definition (#122) | 0.3, beside #58 |
| The first live drift runs: what each found, and what the live report must say | [live drift runs note §3](docs/research/2026-09-29-live-drift-run.md#3-what-the-report-must-say) | three defects found and fixed (0.1.2, 0.1.3); the numbers so far are interim | Rerun on 0.1.3 with the interpretation written; commit the report and close [#46](https://github.com/MetaCoding-io/regulator/issues/46) | 0.2 |
| Predictive S4: predictions as intelligence signals that resolve and are graded on calibration | [open questions §4](docs/research/2026-09-25-open-questions.md#4-predictive-intelligence-s4-as-a-model-of-outside-and-then) | exploratory | Waits on the live eval report (#46); then an instrument record kind in the registry | after 0.2 |
| ArticleMiner as a knowledge-production workload | [ArticleMiner note §5](docs/research/2026-09-25-articleminer-knowledge-production.md#5-phases-against-the-features) | proposed, in phases | Phase 1: declared checks for non-Node domains (§4.1) | 0.3, under #61 |
| A portfolio under management as the third workload: the robo-advisor book's arithmetic as the domain's own checks, consent on a trade list, three declared S4 sensors, a view with a numeric confidence as the bounded judgment | [portfolio note §5, §6](docs/research/2026-10-24-portfolio-workload.md#5-what-the-control-plane-would-have-to-grow) | Phase 1 landed ([#120](https://github.com/MetaCoding-io/regulator/issues/120)): the fixture with its six checks in Node, the workload, the `manager` profile, four contracts, the scripted close with one consent question on the trade list, the worked example and the authoring guide; Phase 2 filed as [#121](https://github.com/MetaCoding-io/regulator/issues/121) `place_trade`, [#122](https://github.com/MetaCoding-io/regulator/issues/122) the `command` runner, [#123](https://github.com/MetaCoding-io/regulator/issues/123) declared sensors, [#124](https://github.com/MetaCoding-io/regulator/issues/124) the harvest contract, now open for work; Phase 3 filed as [#125](https://github.com/MetaCoding-io/regulator/issues/125), blocked on the prediction record ([#138](https://github.com/MetaCoding-io/regulator/issues/138)) now that the open-metric row has landed ([#129](https://github.com/MetaCoding-io/regulator/issues/129): the workload declares `workload:portfolio/turnover` with its grader, pre-registered by `evals/portfolio-turnover.json`); the checks-in-Node decision recorded (§5) | #121 to #124 next, in any order against their seams; #125 joins a milestone table after #138 | 0.3, under #61; #121 feeds [#60](https://github.com/MetaCoding-io/regulator/issues/60) |
| A homelab control plane, designed with its infrastructure | [homelab note §7](docs/research/2026-09-27-homelab-control-plane.md#7-architectural-conflicts) | design note; ten of thirteen decisions made (§9) | Choose the file service (§9, decision 11); then stage 0 in a separate homelab repository | unscheduled |
| The reflector: the definition's S4, a package that reads an instance's records and emits `harness-edit` proposals over the advice files, accepted by a person; a proposed edit probed as an eval arm before the decision | [Harness² note §4, §7, §8](docs/research/2026-10-18-harness2-recursive-harnessing.md#7-the-reflector-s4-of-the-level-above); [the accept-path split](docs/research/2026-10-18-accept-path-split.md) | name decided; the proposal's three records decided (§8); the split decided (split note §10) and its slice 1 landed ([#110](https://github.com/MetaCoding-io/regulator/issues/110): advice as a seeded file set, `DEFINITION_WRITERS`, `advice accept \| reject \| promote`; DEBT rows 43 to 46 opened) | Slice 2 is [#138](https://github.com/MetaCoding-io/regulator/issues/138) (0.2): the prediction record, its resolution from the stores, and the `harness-edit` payload; then the probe arm and the probe rule after #46 (slice 3); then the reflector package. The engineering handoff [#108](https://github.com/MetaCoding-io/regulator/issues/108) sequences the same | slice 2 next; the probe arm waits on #46 |
| Regulating the Regulator — Paper 1 research track (theoretical model, novelty, evaluation protocol, governed-adaptation demonstration, replication and journal submission) | [paper plan](docs/research/2026-10-18-paper-regulating-the-regulator.md) | research active; no paper findings claimed; engineering handoff [#108](https://github.com/MetaCoding-io/regulator/issues/108) remains proposal-stage | Work [#103](https://github.com/MetaCoding-io/regulator/issues/103) and [#104](https://github.com/MetaCoding-io/regulator/issues/104) first; research may proceed before the accept-path decisions; engineering follows the existing Reflector thread | separate paper track, not 0.2/0.3 product scope |
| The control room accepts the CLI's dispositions | [open questions §5](docs/research/2026-09-25-open-questions.md#5-should-the-control-room-write) | deferred: the control room stays read-only for now | None until reopened | — |

The open questions' backlog (§6) holds smaller items with no design yet; one becomes a
row here when it gets one.

## Academic research track — Paper 1: Regulating the Regulator

**Purpose:** investigate, formalize, and test the proposed two-level cybernetic governance architecture without expanding the product roadmap by implication. Source of truth: [the Paper 1 research plan](docs/research/2026-10-18-paper-regulating-the-regulator.md). The candidate venue is *Systems Research and Behavioral Science*, including its [Stafford Beer centenary special issue](https://onlinelibrary.wiley.com/page/journal/10991743a/homepage/call-for-papers) (announced submission deadline: February 2027; recheck before submitting).

The academic track is **not a product release or milestone**. Research issues carry `research` and `paper_regulating_the_regulator`; engineering handoff carries `proposal` and the paper tag. No paper issue certifies a product mechanism, changes the S5 boundary, or replaces an existing `docs/DEBT.md` row. Claude's engineering slices follow the Reflector research note and accept-path note, with their decisions and normal `roadmap:0.x` issue discipline.

| Task | Issue | Required research deliverable | Prerequisite |
| --- | --- | --- | --- |
| T1: two-level cybernetic model | [#103](https://github.com/MetaCoding-io/regulator/issues/103) | functions, channels, authority graph, assumptions, candidate invariants | begin now |
| T2: primary-source literature and novelty | [#104](https://github.com/MetaCoding-io/regulator/issues/104) | related-work matrix, strongest competing theories, explicit originality limit | begin alongside T1 |
| T2a: portable VSM vocabulary — three-system pilot | [#113](https://github.com/MetaCoding-io/regulator/issues/113) | [pilot map](docs/research/2026-10-18-paper-113-vsm-vocabulary-pilot.md) of Regulator, OpenCode and CrewAI, criteria and MAPE-K comparison | exploratory draft now; independent re-coding/source checks before claims of utility |
| T3: propositions and bounded evaluation | [#105](https://github.com/MetaCoding-io/regulator/issues/105) | falsifiable properties, protocol, failure scenarios and metrics | draft after T1; baseline [#46](https://github.com/MetaCoding-io/regulator/issues/46) for live probe |
| T4: worked case and critical boundary assessment | [#106](https://github.com/MetaCoding-io/regulator/issues/106) | provenance-linked positive, rejected and inconclusive/negative traces | study design now, real trace after prototype |
| T5: reproducibility and manuscript | [#107](https://github.com/MetaCoding-io/regulator/issues/107) | frozen tagged artifact, limits, journal/preprint plan | final form after evaluation |
| Engineering coordination | [#108](https://github.com/MetaCoding-io/regulator/issues/108) | resolve two open accept-path decisions, then file/scaffold the smallest Reflector proof of design under normal product tracking | no decisions implied by creating this issue |

**Not required for Paper 1:** full arbitrary-depth VSM recursion, autonomous S5 mutation, multi-instance improvement library, second host, RDF/SHACL, production-scale benchmarks or control-room write UI. These remain deferred or separately tracked. Paper 2's broad empirical comparison is a distinct future program.

## Not planned

Rows that are the deployment's, or that go with work this project has deferred. Listed
so they are not re-filed as debt; each stays on its card as a limitation and in
`BOUNDARY.md` as a route not covered.

| Row | Why not here |
| --- | --- |
| 4 — evidence carries the orchestrator's host, not the target platform | The environment matrix is CI's; the closeout records where it ran. |
| 8 — `bash` is outside most mechanisms | Real isolation is the operating system's or a container's; the shell's reach is declared in the deployment (`OPERATING.md`, security posture). |
| 9 — leases and the effect journal are files on one machine | Cross-host coordination goes with full VSM recursion, which is deferred. |
| 14 — the thrash detector's count restarts per session | S2 state across sessions goes with recursion. |
| 19 — nothing watches network egress | Containment is the operator's; the canary watch sees tool results and text. |
| 26 — nothing checks a remembered fact is true | A truth check is a person's review; the expiry is the pressure. |
| 28 — `--by` is asserted, not authenticated | Authentication belongs to the deployment; the `disposition-authority` card retires when a signed disposition replaces the name. |
| 38 — the outbox watcher is a process, not a service | Supervision and the channel are the deployment's; #59 changes what it watches, not who restarts it. |

Deliberately deferred, as in `AGENTS.md`: RDF/SHACL, full VSM recursion, broad S4
integrations, autonomous S5 mutation, production-grade benchmarks. GSD-Pi is comparison
material in the course, not a dependency.

## How this page is kept

This section is how work is tracked in this repository, for people and for agents;
`AGENTS.md` and `CONTRIBUTING.md` point here rather than restate it.

Work moves through four places, one per stage, and each thing is written in one of them:

| Stage | Where | What it holds |
| --- | --- | --- |
| An idea or a question | [`docs/research/2026-09-25-open-questions.md`](docs/research/2026-09-25-open-questions.md) (running), or a note of its own under [`docs/research/`](docs/research/) when it has one source | the design, and why |
| A gap a card already names | a row in [`docs/DEBT.md`](docs/DEBT.md) | what is owed, and which card says so |
| Designed, with a next step | a row in the threads table above | the order and the one next step |
| Scheduled | a GitHub issue with a `roadmap:0.x` label, and a row in that milestone's table | the acceptance criteria and the rows it pays |

- A design that comes up in conversation is written into a note before it is acted on;
  a decision taken in conversation is recorded in the note it decides (a
  "Decided (date)" paragraph), not only in the chat.
- A note that names a next step gets a threads row in the same change. When that step
  becomes an issue, the issue joins a milestone table and the threads row names it; the
  row leaves when nothing designed is left behind it.
- An issue is written as *What* (the gap, citing the file), *Why* (the note or row it
  comes from), *Debt paid* when it pays rows, and *Done when* (checks a reviewer can
  run), and ends with its roadmap line. Labels: `roadmap:0.x`, plus `bug`,
  `good first issue` or `proposal` where they apply.
- Before an issue is filed from a work list, the list is re-checked against `main`:
  lists go stale, and an item already fixed is struck in the note, not filed.
- The change that lands an issue removes its row from the milestone table, strikes what
  it pays in `DEBT.md` and the note, and updates the card, in the same pull request.
- A milestone closes with a changelog entry and a tag; the next milestone's list is
  reviewed at that point, not before.
