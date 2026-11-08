# Plan for GSD — regulator, as of 2026-11-08

A planning input for [GSD](https://opengsd.net/pi): the open work of this repository as
tasks with their dependencies and their ties to the backlog, so GSD can cut milestones,
slices and tasks from it. It is a snapshot, not a source of truth. The sources are:

- `ROADMAP.md` — the milestone tables (0.2 Trustworthy, 0.3 Community), the threads
  table, and "How this page is kept", which is the tracking rule every task obeys.
- `docs/DEBT.md` — the numbered rows a task pays; a task that pays a row strikes it.
- The GitHub issues named below, each the task's full statement and done-when.
- `packages/regulator/CHANGELOG.md` — Unreleased holds everything since 0.1.4; the 0.2
  tag is cut when the evidence gate below closes.

Dates in this file are the day a thing was observed, not estimates.

## 1. The one gate: #46, the live drift report

Everything under "Evidence" waits on one thing: the live eval report over the drift
scenario (#46), run by the maintainer on the current main and committed under
`packages/regulator/evals/reports/`. Until it is committed:

- The drift suite is **frozen**: `evals/drift*.json`, its arms, fixtures, graders and
  everything under `evals/reports/` may not change. Every task below checks
  `git diff origin/main --stat -- packages/regulator/evals/reports` is empty before its PR.
- No task may change what a drift arm measures, because a changed instrument invalidates
  the comparison the report is for.

The report's interpretation must also say (per the 2026-10-25 comment on #46) whether the
behavioral canary fell silent before a refused attempt, how often, and with what lead
time; #133 reads that.

## 2. Tasks

Columns: the issue, the milestone or thread it belongs to, what it depends on, which
DEBT rows it pays, a size (S under a day of session work, M one to two, L more), and which
other tasks it is safe to run beside (same repository, different files).

### Stream A — control plane hardening (the ADT note, `docs/research/2026-11-02-algebraic-data-types.md`)

| Id | Task | Issue | Milestone | Depends on | Pays | Size | Parallel-safe with |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | Exhaustive matches over closed unions: `assertNever`, no absorbing `default:` | #160 | 0.2 | — | — | S | B, C, D |
| A2 | Unit records and loop outcomes keyed on status; each state carries only its fields | #161 | 0.2 | A1 (uses its helper) | — | M | B, C, D |
| A3 | The store writes the transition with its trigger; `UNIT_TRANSITIONS` as a type | #162 | 0.2 | A2 | row 47 | M | B, C, D |

A1 → A2 → A3 is a sequence: each edits the same protocol and core types
(`packages/protocol/src/execution.ts`, `packages/core/src/execution-store.ts`,
`packages/regulator/src/controller.ts`, the control room). Do not run two of them at once.
They touch the controller, so they must not run beside E1 or E2 either.

### Stream B — checks and fixtures (0.2, independent of each other and of A)

| Id | Task | Issue | Milestone | Depends on | Pays | Size | Parallel-safe with |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B1 | `inherited-tests`: per-assertion diff, a test-layout convention, a cached base run | #50 | 0.2 | — | row 41 | M | A, C, D, B2, B3 |
| B2 | Behaviour checks beyond `Function.length`: a probe a contract can carry | #54 | 0.2 | — | row 35 | M | A, C, D, B1, B3 |
| B3 | Fixture: the flaky test and the migration that must not be re-run | #55 | 0.2 | — | row 13 | S | A, C, D, B1, B2 |
| B4 | Planner-quality graders over the result reports, **deterministic half** | #49 | 0.2 | — | row 40 (part) | M | A, C, D |

B1 and B2 live in `packages/checks` and the check entries of the workloads; B3 adds a
fixture beside `fixture-portfolio/`. B4's graders live in `packages/regulator/src/graders.ts`;
its *judged* half is E3 below and must not be started here. B3 is the one task whose
fixture may be wanted by the drift suite later; it adds the fixture only and declares no
arm (the suite is frozen, §1).

### Stream C — the portfolio workload (sub-issues of #61; note `docs/research/2026-10-24-portfolio-workload.md`)

| Id | Task | Issue | Milestone | Depends on | Pays | Size | Parallel-safe with |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | Phase 2c: sensors declared in the definition (`policies/intelligence.json` `sensors[]`), three for the portfolio | #123 | thread (0.3 under #61) | #122 landed | — | M | A, B, D, C2 |
| C2 | Phase 2d: the harvest contract with exchangeable sets, the wash-sale check live, lots adjusted after an executed wash sale | #124 | thread | #122 landed (`harvest-losses` program) | — | M | A, B, D, C1 |
| C3 | Phase 3: a suite over the price history with the backtester as grader, ablation of the two new checks, views and success probability as predictions | #125 | thread | C2; #138 landed; the ablation half after §1 | — | L | A, B, D |

C1 is the first mechanism in the control plane for S4 sensors and touches
`packages/protocol/src/policy.ts`, core intelligence, and the intelligence-intake card.
C2 is workload-only (contracts, programs, fixture suite). C3's eval arms use the portfolio
suite, not the drift suite, so only the *comparison* half waits on §1; its fixture and
predictions half can start once C2 lands.

### Stream D — the fourth workload, a statistical report (#150; note `docs/research/2026-10-26-agentic-statistics-course.md`)

| Id | Task | Issue | Milestone | Depends on | Pays | Size | Parallel-safe with |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D1 | Decide the domain's checks: the Python-domain decision (note §4) | #150 | thread (under #61) | — | — | S (a decision, recorded in the note) | everything |
| D2 | The fixture with its seven refusals, the workload, the first contracts | #150 | thread | D1 | — | L | A, B, C |

The course's remaining lessons release on 16 and 30 November and are read by an existing
scheduled task that appends to the note and opens a PR per round (PR #164 was the first).
D2 should not start before D1 is recorded; the lessons may change D1.

### Stream E — evidence, after the gate (§1)

| Id | Task | Issue | Milestone | Depends on | Pays | Size | Parallel-safe with |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E0 | The live drift report, committed with its interpretation | #46 | 0.2 | the maintainer's run | rows 33, 15 | — | — |
| E1 | Drift suite: a `confident` behaviour and a poisoned-memory fixture | #130 | 0.2 | E0 | — | M | B, C, D |
| E2 | The behavioral canary acts: `context-degradation` as a recovery cause | #133 | 0.3 | E0 (the report says the canary has lead time) | row 42 | M | B, C, D |
| E3 | Planner-quality graders, **judged half** | #49 | 0.2 | E0, E4 | row 40 (rest) | M | B, C, D |
| E4 | The instrument record kind: levels, a calibration report, so a metric with an `instrument` ref passes `regulator check` | to file when E0 lands (owed by DEBT row 48; #129 closed 2026-11-08 as the declared half) | 0.2 | E0 | row 48 | M | B, C, D |
| E5 | Cut 0.2: version the Unreleased changelog, rewrite every `introducedIn: "unreleased"`, tag | — | 0.2 | every 0.2 row above | — | S | — |

E1 and E2 edit the drift suite and the controller: not beside A, and not beside each other.
E5 is the release and runs alone.

### Stream F — 0.3, not yet unblocked by anything in particular

| Id | Task | Issue | Depends on | Pays | Size |
| --- | --- | --- | --- | --- | --- |
| F1 | Semantic S2: typed coordination commitments between units | #14 | — (design reviewed 2026-10-27) | — | L |
| F2 | A second host behind the host seam; BOUNDARY.md says which host enforces which gate | #58 | — | — | L |
| F3 | Route on append: watch the regulatory log and the ledger, delivery as a hook | #59 | — | row 23; `outbox-watcher` retirement | L |
| F4 | #61's template half: the workload template, after the authoring guide (landed) | #61 | C, D as the cases | — | M |

### Not for GSD to schedule

- The Paper 1 research track (#103–#108, #113) is research, paced by its own plan
  (`docs/research/2026-10-18-paper-regulating-the-regulator.md`).
- The threads table's design-only rows (homelab, reflector, ArticleMiner, Terminal-Bench,
  SemanticSeams, Exo) have no issue yet; a row becomes a task only when an issue is filed,
  per "How this page is kept".
- DEBT row 50 (the host's extensions read the lab's definition root, not the instance's)
  is unscheduled; it becomes a task when a second definition root exists in practice.

## 3. A suggested order

Waves of work that can run at the same time without touching the same files. Each wave is
a set of independent sessions; a wave need not finish before the next begins, only the
named dependencies must.

1. **Now, in parallel:** A1, B1, C1, C2, D1. (B2 and B3 can join; they conflict with nothing.)
2. **When A1 lands:** A2, then A3. **When C2 lands:** C3's fixture and predictions half.
3. **When E0 lands:** E4 first (E3 needs it), then E1, E2 and E3; C3's comparison half.
4. **When every 0.2 row is struck:** E5, the release.
5. **After 0.2:** F1–F4, and D2 once D1 is recorded.

## 4. Rules every task carries

- Branch per task; never force-push; merge `origin/main` before the PR and resolve a
  generated-file conflict by regenerating (`pnpm --filter regulator registry:docs`), never by hand.
- Before the PR: `pnpm check` green (CI runs Node 22.19 and 24), `registry:check` clean,
  `pnpm --filter regulator-docs build` with no dead links, the reports diff empty (§1).
- The tracking rule: an issue scheduled in a milestone has a table row in `ROADMAP.md`;
  landing removes the row and strikes the DEBT rows it pays; a new limitation on a card
  that says "not yet" gets a DEBT row in the same change.
- A change to a definition file (workload, profile, advice, contract, policy, registry)
  gets a migration bullet in the changelog with the gate vocabulary
  (`check` / `scripted` / `live` / `none`).
- PR body sections: What, Decisions (each with the alternative not taken), What I did not
  do, How I verified.
