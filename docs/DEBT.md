# Build debt

What the build knows it has not yet absorbed. One row per gap that is *debt* — taken on
deliberately, with a place it will be paid — as opposed to a permanent limit of a
mechanism. The registry cards under `course/lab/registry/regulators/` remain the source
of truth for what each regulator does not catch; this file indexes the subset that is
owed, so nothing is stated twice and nothing is stated only in a card's fourth bullet.

Rules:

- A new registry limitation that names a later lesson, milestone or "not yet" gets a row
  here in the same change (AGENTS.md, "Before finishing an issue").
- A row is closed by the change that pays it: strike the row, cite the commit or PR, and
  update the card's limitation to say what the mechanism now does.
- "Resolves in" is the lesson or milestone the course plan assigns, not a promise of a
  date. Anything with no owner in the plan says *unscheduled*.

| # | Item | Recorded in | Resolves in | Taken on |
| --- | --- | --- | --- | --- |
| 1 | The audit log is an NDJSON file (`.regulator/audit.ndjson`) beside the signal sink, not the SQLite regulatory event store the reporting tools write (`.gsd/vsm-runtime/vsm.db`). Two append-only stores for regulatory state; one should absorb the other, and the SQLite path still carries a GSD-era name. | `closeout-gate` limitation 4; `docs/REPORTING.md` | lesson 11 (obligations need one event store) | lesson 09 |
| 2 | Evidence binds to contract criteria by class, not by content: a passing suite that does not exercise the changed behaviour satisfies a test-class criterion. The software workload declares only `run_tests` and `run_checks`; a behaviour-bound check is a workload's to declare. | `closeout-gate` limitation 1; `result-report-gate` limitation 1 | lesson 12 (workload-declared domain checks) | lesson 09 |
| 3 | Runtime-class evidence is treated like semantic evidence (human acceptance) because no host mechanism observes runtime behaviour. | `closeout-gate` limitation 3 | lesson 12 | lesson 09 |
| 4 | The environment an evidence record carries is the orchestrator's host; a check that passes here and fails on the target platform is not caught. | `closeout-gate` limitation 2 | unscheduled | lesson 09 |
| 5 | Remediate, replan, clarify, pause and escalate are recorded and the unit waits; nothing performs them, reminds anyone, or delivers the algedonic signal beyond the read model. | `recovery-router` limitations 2 and 4 | lesson 11 (obligation lifecycle), lesson 13 (algedonic delivery) | lesson 08 |
| 6 | Capability profiles are code (`course/lab/src/profiles.ts`), not a declared part of the definition; `regulator status` reports them as pending. | `course/CONTROL-REGISTRY.md` status; `packages/cli/src/status.ts` (`pending: profiles`) | lesson 12 (the complete identity set) | lesson 06 |
| 7 | Path gates are lexical: no symlink, hard-link, absolute-path or TOCTOU protection in the vendor write gate, the profile write grant, or the lease's coverage of the working directory. | `vendor-write-gate` limitation 1; `profile-write-grant` limitation 3; `unit-lease` limitation 2 | lesson 10 (the six-route protected-path drill) | lesson 02 |
| 8 | `bash` is outside the mechanisms: invisible to the thrash detector, the path gates, the effect journal, and the failure observer's non-error exits; the implement profile grants it un-gated. | `thrash-detector` limitation 1; `vendor-write-gate` limitation 2; `profile-write-grant` limitation 1; `effect-journal` limitation 3; `failure-observer` limitation 2 | lesson 10 (bash interception), lesson 12 (effect declaration for shell) | lesson 03 |
| 9 | Leases and the effect journal are files on one machine: no fencing token, no cross-host coordination, and two harnesses on two machines cannot see each other's intentions. | `unit-lease` limitations 1 and 3; `effect-journal` limitation 4 | unscheduled (deferred with full recursion) | lesson 05 |
| 10 | Authority references on fixed decisions are strings; nothing verifies that the cited invariant or decision exists. | `work-contract-gate` limitation 2 | lesson 12 | lesson 06 |
| 11 | Reintegration detects file-level conflicts only; two units can change disjoint files and break each other, and nothing runs the checks on the merged base. The closeout gate verifies the unit's branch at its HEAD, not the merge result. | `reintegration` limitations 1 and 3; `docs/S2-COORDINATION-GAP-ANALYSIS.md` | lesson 12 (integrate unit type with post-merge evidence) | lesson 05 |
| 12 | Emergent decisions below high consequence, and residual uncertainty, are recorded in the report only; nothing routes them. | `result-report-gate` limitation 3 | lesson 11 (uncertainty routing) | lesson 06 |
| 13 | The fixture lacks the flaky test and the migration that must not be re-run; drills that need them (lessons 08 and 09) describe the setup by hand. | `course/PRODUCTION-PLAN.md`, next actions | Phase 2 fixture work | lesson 05 |
| 14 | The thrash detector's memory is per session and its threshold is a constant; a resumed attempt starts counting from zero. | `thrash-detector` limitations 2 and 3 | lesson 11 (signals as obligations with history) | lesson 05 |
| 15 | The model router's dispatcher is exercised only with a live model; no headless test drives failover end to end. | `model-router` limitation 3 | lesson 14 (eval harness) | lesson 07 |
| 16 | The recovery router counts occurrences per cause; a unit alternating between two causes never reaches either rule's third action and stops at the attempt ceiling. Whether that is the intended behaviour is undecided. | `recovery-router` limitation 3 | unscheduled (decide in lesson 11's design) | lesson 08 |

Permanent limits, listed so nobody re-files them as debt: prompt sections are advice and
can be ignored (`contract-advice`); a model summary can be wrong and only the
deterministic block is guaranteed (`contract-preserving-compaction`); the evidence
preflight trusts the session's own tool run by design, and independence is the closeout
gate's (`evidence-preflight`); an effect with no observable trace can only be
reconciled as absent (`effect-journal`); the gate reads the report, never the diff
(`result-report-gate`).
