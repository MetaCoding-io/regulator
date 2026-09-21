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
  evals/             fixture tasks, arms, report generator
  BOUNDARY.md        enforcement boundary statement
```

`protocol/` has no Pi dependency — the same discipline VSM-Pi applies with INV-007. It
should be possible to reason about the control plane without reading a single harness API
call, and it is a teaching point that this is achievable.

## Checkpoints

| # | Module | Capability added | Passes when |
| --- | --- | --- | --- |
| 0 | M01 | Event logging extension | A full prompt→tool→result cycle is in `events.ndjson` |
| 1 | M02 | Structured per-turn trace | Trace records validate against a schema; two-rule comparison table produced |
| 2 | M03 | Three typed operational tools | Tools registered and unit-tested with no live model |
| 3 | M04 | Capability profiles | Read-only profile provably cannot write |
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

The build lives in this repository at [`course/lab/`](lab/) as the workspace package
`@metacoding/vsm-pi-course-lab`, one source file per checkpoint (`cp0-event-log.ts`,
`cp1-trace.ts`, …) with headless tests beside them. Keeping each checkpoint as its own
file rather than mutating one `regulator.ts` means a learner can diff checkpoint N
against N−1 and see exactly what a lesson added, and can load any checkpoint into Pi
without checking out history.

## What the course repo must ship

Production dependencies, tracked in [PRODUCTION-PLAN.md](PRODUCTION-PLAN.md):

- **Checkpoint files** under `course/lab/src/`, one per lesson, each loadable with
  `pi -e` and tested without a model. Checkpoints 0 and 1 exist.
- **Target repository fixture** — a small but *realistically messy* app the learner
  automates against: a misleading README, a non-obvious test command, one flaky test, one
  genuinely ambiguous requirement, a `vendor/` directory that must not be edited, and a
  migration that must not be re-run. The fixture is where the failure drills live, so its
  defects are curriculum, not accident. `course/lab/fixture/` (slugkit) is the seed: a
  README wrong in two places, two failing tests, and a vendored helper. The flaky test,
  the ambiguous requirement and the migration are still to add.
- **Oscillation fixture** — two coupled tests that can be alternately satisfied, for M05.
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

The reference build is not a GSD competitor and should not accumulate:

- a scheduler that outgrows a single dispatch loop;
- persistence beyond an append-only event store plus small typed records;
- a plugin ecosystem, a web UI, or multi-repo orchestration;
- RDF/SHACL, ontology extraction, or full VSM recursion beyond the single subagent case.

When a learner wants those, the honest answer the course gives is: that is what GSD-Pi
already is — go read it, or extend it, rather than rebuilding it in a teaching repo.
