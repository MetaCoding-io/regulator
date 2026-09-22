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
  registry/          one typed JSON record per regulator (see CONTROL-REGISTRY.md);
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
lives in this repository at [`course/lab/`](lab/) as the workspace package
`@metacoding/vsm-pi-course-lab`, one source file per checkpoint (`cp0-event-log.ts`,
`cp1-trace.ts`, …) with headless tests beside them. A checkpoint's Pi-free modules move
into `packages/` once two lessons depend on them, and the lab imports them from there. Keeping each checkpoint as its own
file rather than mutating one `regulator.ts` means a learner can diff checkpoint N
against N−1 and see exactly what a lesson added, and can load any checkpoint into Pi
without checking out history.

## What the course repo must ship

Production dependencies, tracked in [PRODUCTION-PLAN.md](PRODUCTION-PLAN.md):

- **Checkpoint files** under `course/lab/src/`, one per lesson, each loadable with
  `pi -e` and tested without a model. Checkpoints 0–8 exist. Their Pi-free modules have
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
  `cp5-contract` extension, the software-development workload definition and two example
  contracts. `packages/cli` ships `regulator status`, the read model the control room
  consumes. Checkpoint 6 adds the policy schema and the budget ledger (`protocol`), the
  budget meter, policy resolution, model choice and the preserved-context block (`core`),
  and in the lab the `cp6-budget` extension, the default policy, attempt ceilings with
  re-dispatch in the loop, and model failover in the dispatcher. Checkpoint 7 adds the
  recovery vocabulary — causes, actions, policy, observations, decisions, effect journal
  entries (`protocol`) — the router and the effect journal (`core`), and in the lab the
  `cp7-recovery` extension (failure observer, `notify_owner`), the recovery policy, and
  `routeUnit` / `driveUnit` in the loop. Checkpoint 8 adds the audit vocabulary — evidence
  records, technical verdicts, human acceptances (`protocol`) — the `packages/checks`
  package (host-run checks, evidence binding and the verdict, with the conventions
  discovery promoted from the lab), the audit log (`core`), and in the lab the closeout
  gate in the loop (`auditUnit`, `closeUnit`) and the `cp8-evidence` extension.
- **The regulator registry** — schema and check ship in `packages/`; the lab CLI and sixteen
  records live under `course/lab/registry/`; the control room is design only, but its
  read model exists (`regulator status --json`, [CONTROL-REGISTRY.md](CONTROL-REGISTRY.md)).
- **Target repository fixture** — a small but *realistically messy* app the learner
  automates against: a misleading README, a non-obvious test command, one flaky test, one
  genuinely ambiguous requirement, a `vendor/` directory that must not be edited, and a
  migration that must not be re-run. The fixture is where the failure drills live, so its
  defects are curriculum, not accident. `course/lab/fixture/` (slugkit) is the seed: a
  README wrong in two places, two failing tests, and a vendored helper. The flaky test,
  the ambiguous requirement and the migration are still to add.
- **Oscillation fixture** — two coupled tests that can be alternately satisfied, for M05.
  `course/lab/fixture-oscillation/` (slugkit with the known issue fixed and two
  contradictory underscore tests) — **exists**.
- **Injection fixture** — a planted instruction in a source comment and another in a
  tool result, for M10. It must be realistic enough that an ungated agent sometimes
  follows it; a drill nobody fails teaches nothing.
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
