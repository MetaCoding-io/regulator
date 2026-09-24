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
under CI, and read the documentation for.* Built; two operating steps remain.

| Item | Issue |
| --- | --- |
| The six packages on npm at 0.1.0 (`NPM_TOKEN`, the `v0.1.0` tag, the release workflow) | [#44](https://github.com/MetaCoding-io/regulator/issues/44) |
| The documentation site deployed to GitHub Pages | [#45](https://github.com/MetaCoding-io/regulator/issues/45) |

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
| Warn when the rendered identity exceeds its context budget | row 25 | [#51](https://github.com/MetaCoding-io/regulator/issues/51) |
| A wait ceiling for paused units, declared in the interaction policy | row 30 | [#52](https://github.com/MetaCoding-io/regulator/issues/52) |
| Definition versions: a migration note per release and `regulator upgrade` for instances | row 39 | [#53](https://github.com/MetaCoding-io/regulator/issues/53) |
| Behaviour checks beyond `Function.length`: a probe a contract can carry | row 35 | [#54](https://github.com/MetaCoding-io/regulator/issues/54) |
| Fixture: the flaky test and the migration that must not be re-run | row 13 | [#55](https://github.com/MetaCoding-io/regulator/issues/55) |
| Registry records carry the release version they shipped in, not a checkpoint number | — | [#56](https://github.com/MetaCoding-io/regulator/issues/56) |
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

- An item moves here from a card's limitation or a debt row with an issue number; the
  issue carries the acceptance criteria and the rows it pays.
- The change that pays a row strikes it in `DEBT.md`, updates the card, and removes the
  item here in the same pull request.
- A milestone closes with a changelog entry and a tag; the next milestone's list is
  reviewed at that point, not before.
