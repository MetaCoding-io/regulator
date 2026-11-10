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
| Planner-quality graders over the result reports' diagnostics | row 40 | [#49](https://github.com/MetaCoding-io/regulator/issues/49) |
| `inherited-tests`: per-assertion diff, a test-layout convention, a cached base run | row 41 | [#50](https://github.com/MetaCoding-io/regulator/issues/50) |
| Behaviour checks beyond `Function.length`: a probe a contract can carry | row 35 | [#54](https://github.com/MetaCoding-io/regulator/issues/54) |
| Fixture: the flaky test and the migration that must not be re-run | row 13 | [#55](https://github.com/MetaCoding-io/regulator/issues/55) |
| Exhaustive matches over closed unions: `assertNever`, and no `default:` that absorbs a new case ([ADT note §3.1](docs/research/2026-11-02-algebraic-data-types.md#31-matches-that-a-new-case-passes-through-silently)) | — | [#160](https://github.com/MetaCoding-io/regulator/issues/160) |
| Unit records and loop outcomes keyed on status, so each state carries only its own fields ([ADT note §3.2](docs/research/2026-11-02-algebraic-data-types.md#32-products-with-optional-fields-that-admit-states-the-loop-never-means)) | — | [#161](https://github.com/MetaCoding-io/regulator/issues/161) |
| The store writes the transition with its trigger: `UNIT_TRANSITIONS` as a type the compiler holds, after #161 ([ADT note §3.3](docs/research/2026-11-02-algebraic-data-types.md#33-the-lifecycle-is-a-state-machine-held-as-data-not-as-a-type)) | row 47 | [#162](https://github.com/MetaCoding-io/regulator/issues/162) |

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
| A third workload, contributed: the authoring guide and a template | — | [#61](https://github.com/MetaCoding-io/regulator/issues/61) |
| Semantic S2: typed coordination commitments between units | — | [#14](https://github.com/MetaCoding-io/regulator/issues/14) |
| The behavioral canary acts: the policy decision. The mechanism landed (`context-degradation` as a recovery cause whose retry is a fresh session on the same ledger), and the shipped recovery policy declares no rule for it: the first live report has silences and no failure for one to precede. Declare the rule when a live report shows lead time, and settle the rule's wording from the missed replies' text; retire the card after three model versions without it | row 42 | [#133](https://github.com/MetaCoding-io/regulator/issues/133), after the next live report |

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
| The system's figures generated from the definition: the loop, the session's gates, the workload, the recovery lattice, the unit lifecycle, who writes where — as views in the control room beside the six-column topology, in the docs by `regulator docs --write`, copied by the website | [open questions §1](docs/research/2026-09-25-open-questions.md#1-the-control-room-should-show-how-the-declared-system-connects) | decided; two slices landed | The typed enforcement points landed ([#76](https://github.com/MetaCoding-io/regulator/issues/76): `ENFORCEMENT_POINTS` in `protocol`, five places with closed lists held against the code). The unit lifecycle landed: `UNIT_TRANSITIONS` enforced by the store, `renderLifecycleFigure` in the product, and the control room's Lifecycle view stepping a unit's trajectory with its why from the records (`unit-lifecycle`; DEBT row 47). The fragment contract landed ([#147](https://github.com/MetaCoding-io/regulator/issues/147)): a figure is a `<g>` with ids from the definition and a card on every node and edge, `regulator docs --write` files it under `figures/` and `docs --check` holds it current, the docs copy it, and the reflector pair's script embeds it. The one-level map landed ([#153](https://github.com/MetaCoding-io/regulator/issues/153)): `INSTANCE_STORES` as the closed list of the stores, held by `regulator check`; the map drawn from the definition on the control-plane page and in the control room with the instance's units on it; the reflector pair stays drawn by decision (§1, 2026-10-27). Next: the sequence view, the gates placed on the unit's path. The first generated figure of the whole system is the one-level map, which becomes the instance box of the drawn reflector pair in the [Harness² note §7](docs/research/2026-10-18-harness2-recursive-harnessing.md#the-two-levels-drawn) and the docs' [What's coming](docs/project/whats-coming.md) page: a drawn frame around a generated part, the rule's third clause (§1, refined 2026-10-26: a figure of what exists is generated; a figure of what is designed is a drawing until it lands; a figure that spans more than the definition describes embeds the generated part), so the generator emits fragments with stable ids, not only whole figures ([#147](https://github.com/MetaCoding-io/regulator/issues/147)); a lesson highlight is an arm-style filter over the records' `introducedIn`, so the course gets fifteen views of one figure | 0.2 |
| A person can raise S4 intelligence; sensors declared in the definition | [open questions §2](docs/research/2026-09-25-open-questions.md#2-a-person-should-be-able-to-create-s4-intelligence) | the sensors half landed as [#123](https://github.com/MetaCoding-io/regulator/issues/123): `policies/intelligence.json` as the fifth policy kind, run by `regulator watch`, holding a unit *type* through the signal and the veto, one obligation per sensor and claim, an advisory when a held signal expires; three sensors from the portfolio workload (`sensor-intake`). The person's half is open | `regulator intelligence report --by …` writing the same `intelligence-signal` under `human:<name>` provenance (the `provenance` field and the `type:` hold are there for it), and `regulator intelligence` listing what is held | 0.3, beside #59 |
| Units that run a program, not a session | [open questions §3](docs/research/2026-09-25-open-questions.md#3-must-every-unit-run-a-pi-session) | landed as [#122](https://github.com/MetaCoding-io/regulator/issues/122): a unit type declares its `runner`, `session` by default or `command` with an argv and its outputs; the loop runs the program itself through the same dispatcher seam under a wall-clock budget, hashes it into the attempt record and checks its output at closeout as a model's; the definition check refuses a program under a consent grant or a shell; the portfolio's `plan-rebalance` and `harvest-losses` are the first two, with the consent kept by a session that confirms (`command-runner`) | the budget's other two dimensions, CPU and artifact size (DEBT row 49); ArticleMiner's `parse-source` and `normalize` as the next command runners, on the non-Node checks of its §4.1 | 0.3, beside #58 |
| The first live drift runs: what each found, and what the live report says | [live drift runs note §1b, §5](docs/research/2026-09-29-live-drift-run.md#1b-the-fifth-run-the-committed-report) | landed: the fifth run is the committed report ([#46](https://github.com/MetaCoding-io/regulator/issues/46) closed); five defects found and fixed on the way; no drift to catch and a 65% token cost is the honest row | The ablation arms under a model, and the two foils under a model: they landed with scripted reports ([#130](https://github.com/MetaCoding-io/regulator/issues/130), 2026-11-10), and `evals/drift-poisoned-memory.json` live is the reading a scripted unit cannot give; the canary's lead-time reading waits on a refused attempt, and its recovery rule on that reading ([#133](https://github.com/MetaCoding-io/regulator/issues/133); the mechanism landed without a shipped rule) | 0.2 |
| Predictive S4: predictions as intelligence signals that resolve and are graded on calibration | [open questions §4](docs/research/2026-09-25-open-questions.md#4-predictive-intelligence-s4-as-a-model-of-outside-and-then) | items 1 and 2 landed ([#138](https://github.com/MetaCoding-io/regulator/issues/138): the `prediction` block, `prediction-resolution` from the stores, the S5 obligation on a disconfirmed live horizon; `prediction-resolution` card); item 3, the instrument record kind, exploratory | Waits on the live eval report (#46) for predictions to calibrate against; then an instrument record kind in the registry, graded on the resolved predictions | after 0.2 |
| ArticleMiner as a knowledge-production workload | [ArticleMiner note §5](docs/research/2026-09-25-articleminer-knowledge-production.md#5-phases-against-the-features) | proposed, in phases | Phase 1: declared checks for non-Node domains (§4.1) | 0.3, under #61 |
| A portfolio under management as the third workload: the robo-advisor book's arithmetic as the domain's own checks, consent on a trade list, three declared S4 sensors, a view with a numeric confidence as the bounded judgment | [portfolio note §5, §6](docs/research/2026-10-24-portfolio-workload.md#5-what-the-control-plane-would-have-to-grow) | Phase 1 landed ([#120](https://github.com/MetaCoding-io/regulator/issues/120)): the fixture with its six checks in Node, the workload, the `manager` profile, four contracts, the scripted close with one consent question on the trade list, the worked example and the authoring guide; Phase 2: [#122](https://github.com/MetaCoding-io/regulator/issues/122) the `command` runner landed (the plan and the harvest candidates are programs under `trades/proposed/`; a session confirms the list) and [#121](https://github.com/MetaCoding-io/regulator/issues/121) `place_trade` landed (a tool the workload declares with an irreversible effect, from which the gate derives the consent; `trades/pending/` is reachable through the tool alone, and the manager's path grant and advice line are gone — `declared-tool`); [#123](https://github.com/MetaCoding-io/regulator/issues/123) declared sensors landed (the intelligence policy with three portfolio sensors run by `regulator watch`; `sensor-intake`) and [#124](https://github.com/MetaCoding-io/regulator/issues/124) the harvest landed (a `plan-harvest` session whose contract bounds which candidates to take and what replaces each, the wash-sale check live over a harvest list by its kind and set by set, `place_trade` widened to the harvest list, and the lots adjusted after an executed wash sale by one derivation the ingest and the suite share); Phase 3 filed as [#125](https://github.com/MetaCoding-io/regulator/issues/125), unblocked by the prediction record ([#138](https://github.com/MetaCoding-io/regulator/issues/138), landed) now that the open-metric row has landed ([#129](https://github.com/MetaCoding-io/regulator/issues/129): the workload declares `workload:portfolio/turnover` with its grader, pre-registered by `evals/portfolio-turnover.json`); the checks-in-Node decision recorded (§5) | Phase 2 is done; [#181](https://github.com/MetaCoding-io/regulator/issues/181) next (the harvest sensor fires on the harvest arithmetic, paying DEBT row 51); #125 (Phase 3) joins a milestone table after #138 | 0.3, under #61 |
| A homelab control plane, designed with its infrastructure | [homelab note §7](docs/research/2026-09-27-homelab-control-plane.md#7-architectural-conflicts) | design note; ten of thirteen decisions made (§9) | Choose the file service (§9, decision 11); then stage 0 in a separate homelab repository | unscheduled |
| The reflector: the definition's S4, a package that reads an instance's records and emits `harness-edit` proposals over the advice files, accepted by a person; a proposed edit probed as an eval arm before the decision | [Harness² note §4, §7, §8](docs/research/2026-10-18-harness2-recursive-harnessing.md#7-the-reflector-s4-of-the-level-above); [the accept-path split](docs/research/2026-10-18-accept-path-split.md) | name decided; the proposal's three records decided (§8); the split decided (split note §10) and its slice 1 landed ([#110](https://github.com/MetaCoding-io/regulator/issues/110): advice as a seeded file set, `DEFINITION_WRITERS`, `advice accept \| reject \| promote`; DEBT rows 43 to 46 opened) | Slice 3 is next, after #46: the probe arm (`EvalArmSchema`'s `advice` override) and the probe rule (`advice accept` refusing an unprobed `harness-edit`); then the reflector package, the first producer of a prediction. Slice 2 landed in [#138](https://github.com/MetaCoding-io/regulator/issues/138): the prediction record on the signal, `prediction-resolution` from the stores at close and abort, the S5 obligation on a disconfirmed live horizon, the typed `harness-edit` payload read against the stores at `advice accept`, the `prediction-resolution` card. The engineering handoff [#108](https://github.com/MetaCoding-io/regulator/issues/108) sequences the same | slice 3 next, after #46 |
| Regulating the Regulator — Paper 1 research track (theoretical model, novelty, evaluation protocol, governed-adaptation demonstration, replication and journal submission) | [paper plan](docs/research/2026-10-18-paper-regulating-the-regulator.md) | research active; no paper findings claimed; engineering handoff [#108](https://github.com/MetaCoding-io/regulator/issues/108) remains proposal-stage | Work [#103](https://github.com/MetaCoding-io/regulator/issues/103) and [#104](https://github.com/MetaCoding-io/regulator/issues/104) first; research may proceed before the accept-path decisions; engineering follows the existing Reflector thread | separate paper track, not 0.2/0.3 product scope |
| The control room accepts the CLI's dispositions | [open questions §5](docs/research/2026-09-25-open-questions.md#5-should-the-control-room-write) | deferred: the control room stays read-only for now | None until reopened | — |
| A statistical report as the fourth workload: a research-shaped domain where the checks are over the record (numbers traceable to output, section ownership by step, no refitting in figures, the question before any output) and the person's judgement is the product | [agentic-statistics note §3, §4](docs/research/2026-10-26-agentic-statistics-course.md#3-the-mapping-each-rule-and-its-level) | proposed; the Python-domain decision (§4) is the first step; the course's remaining lessons land 2, 16 and 30 November and are read as they do | [#150](https://github.com/MetaCoding-io/regulator/issues/150): decide the domain's checks, then the fixture with its seven refusals | 0.3, under #61 |
| Terminal-Bench 2.0 as the first public eval: regulator as a Harbor installed agent over ten named tasks, three pre-registered arms (`bare` Pi, `operational`, `regulated`), five repetitions, the benchmark's verifier as the grader; H1 resolution within noise of the bare arm, H2 the cost of regulation, H3 refusals to close that the verifier would have accepted, H4 how often a session gate fires at all | [minimal-harness note §5](docs/research/2026-11-05-minimal-harness-and-terminal-bench.md#5-terminal-bench-20-with-regulator) | proposed; no trial run; the control plane needs one loop change (in-place isolation, §5.5 item 1) and definition files | §5.6 decision 1 (in-place isolation as a declared mode or an adapter trick), then an issue for the `terminal` workload and the adapter; §4.1–§4.3 are three separate proposals against the authority preflight and the ledger, each an issue when decided | after #46; beside the paper's T3 |
| A SemanticSeams project as a software workload: units grow a model-driven application one layer at a time, a program regenerates it, and the seams toolchain (shapes, `seams check`, derived scenario tests, `seams diff`/`plan`, coverage, gate queries, trace sidecars) is the host's evidence; contracts cite model facts by IRI | [SemanticSeams workload note §3, §7](docs/research/2026-11-04-semanticseams-workload.md#3-the-workload) | proposed; the Python-domain decision (§7) is the first step, shared with the statistics workload | Decide the domain's checks (the `package.json` bridge first, declared checks as the destination), then the fixture from the expense tutorial's chapter 3 under [#61](https://github.com/MetaCoding-io/regulator/issues/61) | 0.3, under #61 |
| Exo, a runtime in which the harness edits itself mid-task under an append-only record and a guardian outside the editor, read against the boundary: the same exokernel split with the definition on the other side of it; cached-input share and cost as built-in metrics, two costs (learning and held-out) with the crossover on the probe report, a model-tier arm, a refused accept as a record, the unit's own ledger as a read-only tool, agent-built scripts as domain code until the reflector proposes them as declared tools, Exo's state-and-replacement contracts as the scaffold for Paper 1's formal model, and §8's answer to whether units can feed the loop (an advice paragraph that asks; `note_to_self`, a unit's advice to itself for one attempt, logged and read by the reflector; the timescale claim as the one real opposition, with the drift-suite run that measures it) | [Exo note §4, §6, §8](docs/research/2026-11-06-exo-runtime-self-improvement.md#4-what-regulator-could-take-at-the-mechanism-level) | proposed; no issue | the asking paragraph (§8.2) lands in the shipped advice files by `advice promote` now; §4 items 1, 2, 4 and 6 join the done-when of the probe-arm issue (accept-path split slice 3) when it is filed after [#46](https://github.com/MetaCoding-io/regulator/issues/46); §4 item 7 and §6 into [#103](https://github.com/MetaCoding-io/regulator/issues/103) and [#104](https://github.com/MetaCoding-io/regulator/issues/104) now; the `read_budget` tool (item 3) filed on its own once it has a card; item 5 and `note_to_self` (§8.3) wait for the reflector package, the latter probed under the drift suite after #46 | 0.2, beside slice 3; the research half with Paper 1 |
| A state-defined interface: what a session is shown and what it is allowed, from one declaration. Refused tool calls recorded per gate and counted as a built-in metric; one table in `protocol` from each session gate to the tools that remain valid, rendered into every refusal; the tool surface narrowed when the budget or pause gate closes; a grant edit as a typed proposal for the reflector | [state-defined interface note §3, §4](docs/research/2026-11-10-state-defined-interface.md#4-proposals) | proposed; no issue | §4.1 first (the record and the count), since it is the instrument the rest are judged by; §4.2 with it or after; §4.3 only if the count shows refused calls after a ceiling, and after cache writes are in the ledger; §4.4 waits for the reflector | unscheduled; §4.1 beside the eval work |
| What a suite is made of and how a report is read, from an article on eval-driven development: a per-task table in the report beside the per-arm means; a statement of whether the baseline arm failed at all, so a report with nothing to catch is labelled cost-only and is not retirement evidence; a path from one unit's record in an instance to a candidate eval task a person accepts; and a rule against re-measuring a gate on the fixture it was tuned on | [eval-driven development note §3, §4](docs/research/2026-11-10-eval-driven-development.md#4-proposals) | proposed; the four kept by decision (2026-11-10); no issue | §4.1 first (the per-task table: a report-schema addition computed from the runs already kept), then §4.2, both before the next live report (owed by the [live-run note §5](docs/research/2026-09-29-live-drift-run.md#5-what-the-next-report-owes)) runs, as one issue in 0.2; §4.3 starts by hand at the first live closeout refusal, with its four open questions settled before an issue; §4.4 is a sentence in the interpretation rule and `CONTRIBUTING.md` | §4.1 and §4.2 in 0.2, before the next live report; §4.3 and §4.4 unscheduled |

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
