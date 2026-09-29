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
| Attenuated glossary lint: comments blocking, commit messages advisory, declared per workload | row 36 | [#47](https://github.com/MetaCoding-io/regulator/issues/47) |
| Pre-merge trial on a temporary merge commit, retiring the post-merge check | row 37 | [#48](https://github.com/MetaCoding-io/regulator/issues/48) |
| Planner-quality graders over the result reports' diagnostics | row 40 | [#49](https://github.com/MetaCoding-io/regulator/issues/49) |
| `inherited-tests`: per-assertion diff, a test-layout convention, a cached base run | row 41 | [#50](https://github.com/MetaCoding-io/regulator/issues/50) |
| A wait ceiling for paused units, declared in the interaction policy | row 30 | [#52](https://github.com/MetaCoding-io/regulator/issues/52) |
| Definition versions: a migration note per release and `regulator upgrade` for instances | row 39 | [#53](https://github.com/MetaCoding-io/regulator/issues/53) |
| Behaviour checks beyond `Function.length`: a probe a contract can carry | row 35 | [#54](https://github.com/MetaCoding-io/regulator/issues/54) |
| Fixture: the flaky test and the migration that must not be re-run | row 13 | [#55](https://github.com/MetaCoding-io/regulator/issues/55) |
| The viability case rendered from the registry (`VIABILITY.md`), the capstone's artifact | — | [#57](https://github.com/MetaCoding-io/regulator/issues/57) |

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
| The system's figures generated from the definition: the loop, the session's gates, the workload, the recovery lattice, the unit lifecycle, who writes where — as views in the control room beside the six-column topology, in the docs by `regulator docs --write`, copied by the website | [open questions §1](docs/research/2026-09-25-open-questions.md#1-the-control-room-should-show-how-the-declared-system-connects) | decided; first slice landed | The typed enforcement points landed ([#76](https://github.com/MetaCoding-io/regulator/issues/76): `ENFORCEMENT_POINTS` in `protocol`, five places with closed lists held against the code). Next: the generator over them and `regulator docs --write` for the SVGs | 0.2 |
| Documentation and website gaps: wrong CLI facts, missing concept and reference pages, the website's links into the docs | [docs and site gaps §7](docs/research/2026-09-25-docs-and-site-gaps.md#7-suggested-order) | re-verified 2026-09-29 against `main`: §1's four facts are fixed (707f4d7, #77); of §2's twelve docs gaps, eleven have landed and the twelfth's parts are struck one by one; §4's stale claims are struck but for the course-vocabulary sweep; §8's seven concept pages have all landed; the website's §3 has its docs links, install path, operating, algedonic, identity, budgets and channels sections | §3 item 7's three short sections (evals, S4 versus memory, registry card anatomy) on the website; then the course-vocabulary sweep over the cards (§7 item 6), last | beside #45 |
| A person can raise S4 intelligence; sensors declared in the definition | [open questions §2](docs/research/2026-09-25-open-questions.md#2-a-person-should-be-able-to-create-s4-intelligence) | proposed | `regulator intelligence report --by …` writing the same `intelligence-signal` under `human:<name>` provenance | 0.3, beside #59 |
| Units that run a program, not a session | [open questions §3](docs/research/2026-09-25-open-questions.md#3-must-every-unit-run-a-pi-session) | answered: the dispatcher seam already allows it | A `command` runner per unit type in the workload definition | 0.3, beside #58 |
| The first live drift runs: what each found, and what the live report must say | [live drift runs note §3](docs/research/2026-09-29-live-drift-run.md#3-what-the-report-must-say) | three defects found and fixed (0.1.2, 0.1.3); the numbers so far are interim | Rerun on 0.1.3 with the interpretation written; commit the report and close [#46](https://github.com/MetaCoding-io/regulator/issues/46) | 0.2 |
| Predictive S4: predictions as intelligence signals that resolve and are graded on calibration | [open questions §4](docs/research/2026-09-25-open-questions.md#4-predictive-intelligence-s4-as-a-model-of-outside-and-then) | exploratory | Waits on the live eval report (#46); then an instrument record kind in the registry | after 0.2 |
| ArticleMiner as a knowledge-production workload | [ArticleMiner note §5](docs/research/2026-09-25-articleminer-knowledge-production.md#5-phases-against-the-features) | proposed, in phases | Phase 1: declared checks for non-Node domains (§4.1) | 0.3, under #61 |
| A homelab control plane, designed with its infrastructure | [homelab note §7](docs/research/2026-09-27-homelab-control-plane.md#7-architectural-conflicts) | design note; ten of thirteen decisions made (§9) | Choose the file service (§9, decision 11); then stage 0 in a separate homelab repository | unscheduled |
| The control room accepts the CLI's dispositions | [open questions §5](docs/research/2026-09-25-open-questions.md#5-should-the-control-room-write) | deferred: the control room stays read-only for now | None until reopened | — |

The open questions' backlog (§6) holds smaller items with no design yet; one becomes a
row here when it gets one.

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
