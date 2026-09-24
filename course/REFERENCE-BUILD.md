# Reference build — `regulator`

The course's spine is a single artifact the learner builds across all fifteen modules.
It is deliberately small: a harness that is *legible* beats a harness that is impressive.
Every line must be something the learner could defend in the capstone.

## Design constraints

1. **Pi is the substrate, and it is not forked.** Every capability uses a documented
   extension, SDK, or RPC surface. If something cannot be built that way, that is a
   finding to report, not a reason to patch Pi in a teaching repo.
2. **No second source of truth.** `regulator` records regulatory state (contracts,
   evidence, attempts, obligations). Pi's session file remains authoritative for the
   conversation; git remains authoritative for the code.
3. **Mechanism before prose.** Any rule introduced in a module must be enforced at the
   highest feasible level of the mechanism hierarchy, and the lab grader checks that —
   a lab that only adds prompt text does not pass.
4. **Honest boundaries.** Each checkpoint that adds enforcement must also extend
   `BOUNDARY.md`: what this gate does *not* cover.
5. **Runs without a live model where possible.** Handlers, gates, routers, and schemas
   are unit-tested headlessly, following Pi's extension testing patterns; live-model runs
   are for the failure drills and evals, not for the correctness suite.

## Target layout

```text
regulator/
  src/
    protocol/        typed records: contract, result report, evidence, finding,
                     intelligence, proposal, escalation, attempt
    control/         dispatcher, budget guard, recovery router
    coordination/    leases, checkpoints, thrash detector
    audit/           host-run checks, evidence binding, closeout gate
    authority/       protected paths, write gate, proposal intake
    intelligence/    read-only subagent driver
    profiles/        capability profiles (tools, context, model, thinking, paths)
    telemetry/       event store, trace writer, replay
    ext/             the Pi extension entry point wiring the above
    cli/             headless entry point for CI and evals
  identity/          purpose, invariants, glossary, boundaries  (write-protected;
                     seeded in M10 with INV-001, completed in M12)
  memory/            operational memory: agent-writable, provenance + review-by date,
                     never identity
  registry/          one typed JSON record per regulator (schema in packages/protocol);
                     REGULATORS.md and TOPOLOGY.md generated from them, never edited
  decisions/         ADRs for policy and architecture choices
  evals/             fixture tasks, arms (including per-regulator ablation), report generator
  BOUNDARY.md        enforcement boundary statement, generated from registry limitations
```

`protocol/` has no Pi dependency — the same discipline VSM-Pi applies with INV-007. It
should be possible to reason about the control plane without reading a single harness API
call, and it is a teaching point that this is achievable.

## Checkpoints

| # | Module | Capability added | Passes when |
| --- | --- | --- | --- |
| 0 | M01 | Event logging extension | A full prompt→tool→result cycle is in `events.ndjson` |
| 1 | M02 | Structured per-turn trace + registry seed | Trace records validate against a runtime schema (malformed records refused); two-rule comparison table produced; first registry record passes `regulator check` |
| 2 | M03 | Three typed operational tools | Tools registered and unit-tested with no live model |
| 3 | M04 | Capability profiles (tools, writable paths, thinking level, advice) | Research profile is read-only *by declared effect*, not just tool names; implement profile's description is honest about `bash` |
| 4 | M05 | Leases, checkpoints, thrash detector, reintegration | Second concurrent session is refused; oscillation fixture trips detector; seeded conflict surfaced, not auto-resolved |
| 5 | M06 | Work contract + validated result report | Unresolved decision cannot be closed silently |
| 6 | M07 | Budget guard + contract-preserving compaction | Ceiling halts a runaway unit; contract survives compaction (asserted) |
| 7 | M08 | Recovery router with versioned policy | Attempt history immutable; cause→action recorded with policy version |
| 8 | M09 | Independent audit layer | Closeout refused on missing/stale evidence regardless of agent claims |
| 9 | M10 | Protected identity (seeded with INV-001) + proposal path + trust rule | Alias/traversal/symlink cases blocked; injection fixtures fail to move authority; `BOUNDARY.md` written |
| 10 | M11 | Read-only intelligence subagent | Typed intelligence produced and routed, never auto-applied |
| 11 | M12 | Complete identity set + operational memory store | One invariant enforced in both prose and code; memory entries carry provenance and expiry |
| 12 | M13 | Algedonic escalation | Safe under headless timeout; disposition recorded |
| 13 | M14 | Eval harness, two arms | Report committed with both arms and an interpretation |
| 14 | M15 | Packaged pi package | Installs and runs one unit in a clean second repo |
| 15 | Capstone | Viability case | Rubric in `ASSESSMENT.md` |

`regulator` is not a teaching copy of VSM-Pi; it *is* VSM-Pi's reference build. It
lives in this repository at [`packages/regulator/`](../packages/regulator/) as the workspace package
`@metacoding/regulator`, one source file per checkpoint (`cp0-event-log.ts`,
`cp1-trace.ts`, …) with headless tests beside them. A checkpoint's Pi-free modules move
into `packages/` once two lessons depend on them, and the lab imports them from there. Keeping each checkpoint as its own
file rather than mutating one `regulator.ts` means a learner can diff checkpoint N
against N−1 and see exactly what a lesson added, and can load any checkpoint into Pi
without checking out history.

## What the course repo must ship

What the course repository ships, and what of it is still owed (`docs/DEBT.md`):

- **Checkpoint files** under `packages/regulator/src/`, one per lesson, each loadable with
  `pi -e` and tested without a model. Checkpoints 0–14 exist. Their Pi-free modules have
  been promoted: trace, effect, profile and registry vocabulary to `packages/protocol`;
  the tracker/writer, effect declarations, profile checks and registry check to
  `packages/core`. The lab keeps `conventions.ts` (software-workload fact discovery),
  its two profile declarations, the checkpoints, the registry CLI and the seed records.
  Checkpoint 4 added the worktree/reintegration and unit lifecycle modules and the
  `regulator` lab CLI (`fixture`, `unit start|finish|status`); its lease store and thrash
  detector were promoted to `packages/core` when checkpoint 5 and the `regulator status`
  read model became their second and third consumers. Checkpoint 5 adds the contract and
  result-report schemas, the workload and execution-record schemas (`protocol`), the
  contract/report checks, the execution store and the signal sink (`core`), and in the lab
  the first slice of the S3 loop (`controller.ts`), the Pi SDK dispatcher, the
  `contract` extension, the software-development workload definition and two example
  contracts. `packages/cli` ships `regulator status`, the read model the control room
  consumes. Checkpoint 6 adds the policy schema and the budget ledger (`protocol`), the
  budget meter, policy resolution, model choice and the preserved-context block (`core`),
  and in the lab the `budget` extension, the default policy, attempt ceilings with
  re-dispatch in the loop, and model failover in the dispatcher. Checkpoint 7 adds the
  recovery vocabulary — causes, actions, policy, observations, decisions, effect journal
  entries (`protocol`) — the router and the effect journal (`core`), and in the lab the
  `recovery` extension (failure observer, `notify_owner`), the recovery policy, and
  `routeUnit` / `driveUnit` in the loop. Checkpoint 8 adds the audit vocabulary — evidence
  records, technical verdicts, human acceptances (`protocol`) — the `packages/checks`
  package (host-run checks, evidence binding and the verdict, with the conventions
  discovery promoted from the lab), the audit log (`core`), and in the lab the closeout
  gate in the loop (`auditUnit`, `closeUnit`) and the `evidence` extension.
  Checkpoint 9 promotes the write preflight (`prepareWritePath`: expansion, traversal,
  protected paths and parents, the filesystem alias walk) from the Pi extension into
  `core`, where both now use it, adds the boundary-statement generator, and in the lab
  the identity seed, the `authority` extension (write gate, bash watch, proposal
  intake, canary watch, trust answer), the trust rule in the dispatcher's loader, the
  injection fixture and `BOUNDARY.md`. Checkpoint 10 adds the obligation vocabulary and
  the routing policy (`protocol`), the obligation ledger, router, veto and disposition
  over the regulatory log (`core`), and in the lab the `research` unit type, the
  `intelligence` profile, the `intelligence` extension (`report_intelligence`), the
  routing policy, routing and the veto in the loop, and the obligation commands in the
  CLI; the read model and the control room show obligations and all three policy shapes.
  Checkpoint 11 adds the profile schema, the memory vocabulary, routing floors, the
  coordination threshold and the host check names (`protocol`); identity parsing and
  rendering, authority-reference resolution, the memory store and the definition check
  (`core`); the `identity-untouched` host check (`checks`); and in the lab the complete
  identity set, profiles as files, the definition's `settings.json`, the
  `identity` extension (`remember`, identity and memory sections), the trust rule
  extended to context files and settings in the dispatcher, the S5 decision path and
  memory commands in the CLI, and the drift scenario. Checkpoint 12 adds the interaction
  vocabulary — kinds with the fixed continue-without-answer rule, requests, outcomes,
  people and the interaction policy, the delivered event and the paused attempt outcome
  (`protocol`); the interaction rules, disposition authority, reminders and the ledger's
  deliveries and interactions (`core`); and in the lab the `algedonic` extension
  (`ask_human`, the pause gate), the interaction policy, delivery to the outbox through
  the effect journal, the paused path in the loop, and `answer`, `remind` and the
  authority check in the CLI; the read model and the control room show the interaction
  policy, deliveries and interactions. Checkpoint 13 adds the eval vocabulary (arms,
  suites, runs, summaries, lifts, fingerprints, reports, the ablation switch), the span
  records with the GenAI attribute names, the expectation check and the `export-signature`
  check name (`protocol`); the eval arithmetic, the span projection with redaction, the
  registry's lifecycle rules and the definition check over suites and reports (`core`); the
  `export-signature` check with content binding and host-first runtime verdicts
  (`checks`); and in the lab the harness, the graders, the scripted learner-style units
  (three at this lesson, four with the self-certifier after lesson 15), the six drift
  contracts, the drift suite and its committed reports, `regulator
  eval | spans | review`, and `ablation` and `retirement` on every registry card; the read
  model and the control room gain the assurance and lifecycle views. Checkpoint 14 adds
  the instance manifest, memory scope, the `glossary-lint` check name and the events
  store under `.regulator/` (`protocol`, `core`); the glossary's refused words, the
  instance-level veto, the overdue-review rule and the replay timeline (`core`);
  `glossary-lint` (`checks`); and in the lab `regulator init | doctor | watch |
  identity promote`, the post-merge check with an obligation on the instance, the
  manifest in the profile grant and the closeout, memory scope in `remember`, the
  outbox watcher, the lab as a pi package with `OPERATING.md`, and six registry cards;
  the read model and the control room gain the replay view and the manifest.
- **The regulator registry** — schema and check ship in `packages/`; the lab CLI and
  forty-three records live under `packages/regulator/registry/`; the read model (`regulator status
  --json`) and the control room (`packages/control-room`) are built.
- **Target repository fixture** — a small but *realistically messy* app the learner
  automates against: a misleading README, a non-obvious test command, one flaky test, one
  genuinely ambiguous requirement, a `vendor/` directory that must not be edited, and a
  migration that must not be re-run. The fixture is where the failure drills live, so its
  defects are curriculum, not accident. `packages/regulator/fixture/` (slugkit) is the seed: a
  README wrong in two places, two failing tests, and a vendored helper. The flaky test,
  the ambiguous requirement and the migration are still to add.
- **Oscillation fixture** — two coupled tests that can be alternately satisfied, for M05.
  `packages/regulator/fixture-oscillation/` (slugkit with the known issue fixed and two
  contradictory underscore tests) — **exists**.
- **Injection fixture** — a planted instruction in a source comment and another in a
  tool result, for M10, with a canary credential in a committed `.env`.
  `packages/regulator/fixture-injection/` — **exists**. Whether it is realistic enough that an
  ungated agent sometimes follows it is what drill 2 measures; a drill nobody fails
  teaches nothing.
- **Finance fixture** — a household ledger (`packages/regulator/fixture-finance/`): the bank's
  statements as a protected source of truth, a categorized ledger, a monthly close, a
  pending-payments directory a person acts on, and the ledger's own checks outside every
  write grant. The domain of the second workload, `personal-finance`, and of the worked
  example [examples/personal-finance.md](examples/personal-finance.md) — **exists**.
- **Drift fixture** — a longitudinal scenario (a sequence of related tasks) whose
  architectural conformance can be measured after N units, for M12 and M14.
- **Lab grader** — deterministic checks per checkpoint, runnable locally and in CI,
  including the "did you solve this with prose?" check where mechanically detectable
  (for example: the rule is claimed enforced, so the grader adversarially attempts the
  forbidden action).
- **Solution branches** — reference implementations, released per module after the lab
  window closes.
- **Transcript library** — recorded failure-drill sessions (Pi's `/export` and `/share`)
  so learners without spare budget can still study the failures.

## Deliberate non-goals for the build

The orchestrator stays the size of the S3 loop. The reference build should not
accumulate:

- a scheduler that outgrows a single dispatch loop with leases and budgets;
- workload-specific phases coded into the loop — the software-development autoloop is a
  *workload definition*, and a second workload is a second definition, not a fork;
- persistence beyond the orchestrator's execution store, the append-only event store,
  and the registry;
- a plugin ecosystem, a web UI beyond the read-only control room, or multi-repo
  orchestration;
- RDF/SHACL, ontology extraction, or full VSM recursion beyond the single subagent case.

GSD-Pi is the standing comparison for each of these: a system that chose a fixed
workflow and a larger kernel. Read it to see what the loop would become if it grew, then
keep the loop small.
