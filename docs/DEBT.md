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
| 1 | The audit log is an NDJSON file (`.regulator/audit.ndjson`) beside the regulatory log (`.regulator/signals.ndjson`), and neither is the SQLite regulatory event store the reporting tools write (`.gsd/vsm-runtime/vsm.db`), whose path still carries a GSD-era name. Lesson 11 decided that obligations fold from events in the same log as the messages they route, so the instance has two NDJSON histories, not three; absorbing them into one store is the observability work. | `closeout-gate` limitation 4; `docs/REPORTING.md` | lesson 14 (event store with the OTel span mapping) | lesson 09 → narrowed lesson 11 |
| 2 | Evidence binds to contract criteria by class, not by content: a passing suite that does not exercise the changed behaviour satisfies a test-class criterion. The software workload declares only `run_tests` and `run_checks`; a behaviour-bound check is a workload's to declare. | `closeout-gate` limitation 1; `result-report-gate` limitation 1 | lesson 12 (workload-declared domain checks) | lesson 09 |
| 3 | Runtime-class evidence is treated like semantic evidence (human acceptance) because no host mechanism observes runtime behaviour. | `closeout-gate` limitation 3 | lesson 12 | lesson 09 |
| 4 | The environment an evidence record carries is the orchestrator's host; a check that passes here and fails on the target platform is not caught. | `closeout-gate` limitation 2 | unscheduled | lesson 09 |
| ~~5~~ | ~~Remediate, replan, clarify, pause and escalate are recorded and the unit waits; nothing performs them, reminds anyone, or delivers the algedonic signal beyond the read model. Policy proposals (lesson 10) land in the same sink with the same fate.~~ Paid in lesson 11: each waiting action opens an obligation owed to the consumer the routing policy names, proposals and escalations are obligations owed to S5 or a person, the veto holds the unit until a disposition, and the disposition reaches the next attempt. Delivery and reminders remain row 20. | `recovery-router` limitations 2 and 4; `proposal-intake` limitation 1 | — | lesson 08 → paid lesson 11 |
| 6 | Capability profiles are code (`course/lab/src/profiles.ts`), not a declared part of the definition; `regulator status` reports them as pending. | `course/CONTROL-REGISTRY.md` status; `packages/cli/src/status.ts` (`pending: profiles`) | lesson 12 (the complete identity set) | lesson 06 |
| ~~7~~ | ~~Path gates are lexical: no symlink, hard-link, absolute-path or TOCTOU protection in the vendor write gate, the profile write grant, or the lease's coverage of the working directory.~~ Paid in lesson 10: `prepareWritePath` (core) walks the filesystem for aliases and refuses absolute paths and traversal; checkpoint 9's gate supersedes the lexical ones when loaded. TOCTOU between the walk and the write remains a stated limit, not debt. | `identity-write-gate` limitations 1–3 | — | lesson 02 → paid lesson 10 |
| 8 | `bash` is outside most mechanisms: invisible to the thrash detector, the effect journal, and the failure observer's non-error exits; the implement profile grants it un-gated. Lesson 10 added the snapshot-and-restore for protected paths, which narrows this to non-protected effects. | `thrash-detector` limitation 1; `profile-write-grant` limitation 1; `effect-journal` limitation 3; `failure-observer` limitation 2 | lesson 12 (effect declaration for shell) | lesson 03 |
| 9 | Leases and the effect journal are files on one machine: no fencing token, no cross-host coordination, and two harnesses on two machines cannot see each other's intentions. | `unit-lease` limitations 1 and 3; `effect-journal` limitation 4 | unscheduled (deferred with full recursion) | lesson 05 |
| 10 | Authority references on fixed decisions are strings; nothing verifies that the cited invariant or decision exists. | `work-contract-gate` limitation 2 | lesson 12 | lesson 06 |
| 11 | Reintegration detects file-level conflicts only; two units can change disjoint files and break each other, and nothing runs the checks on the merged base. The closeout gate verifies the unit's branch at its HEAD, not the merge result. | `reintegration` limitations 1 and 3; `docs/S2-COORDINATION-GAP-ANALYSIS.md` | lesson 12 (integrate unit type with post-merge evidence) | lesson 05 |
| ~~12~~ | ~~Emergent decisions below high consequence, and residual uncertainty, are recorded in the report only; nothing routes them.~~ Paid in lesson 11: every emergent decision, deviation and residual uncertainty becomes a signal, and the routing policy decides which open an obligation and which are noted as trace with the reason. | `result-report-gate` limitation 3 | — | lesson 06 → paid lesson 11 |
| 13 | The fixture lacks the flaky test and the migration that must not be re-run; drills that need them (lessons 08 and 09) describe the setup by hand. | `course/PRODUCTION-PLAN.md`, next actions | Phase 2 fixture work | lesson 05 |
| 14 | The thrash detector's memory is per session and its threshold is a constant; a resumed attempt starts counting from zero. Lesson 11 gave the signal a history — an oscillation becomes an obligation that outlives the session and holds the unit through clarify — but the count itself still restarts and the threshold is not policy. | `thrash-detector` limitations 2 and 3 | lesson 12 (the threshold as a declared policy value) | lesson 05 → narrowed lesson 11 |
| 15 | The model router's dispatcher is exercised only with a live model; no headless test drives failover end to end. | `model-router` limitation 3 | lesson 14 (eval harness) | lesson 07 |
| ~~16~~ | ~~The recovery router counts occurrences per cause; a unit alternating between two causes never reaches either rule's third action and stops at the attempt ceiling. Whether that is the intended behaviour is undecided.~~ Decided in lesson 11: by design. Per-cause occurrence is the policy's contract, the attempt ceiling is the global stop, and the alternation is visible in the unit's decisions and obligations; a policy that wants a global count declares shorter rules. The card states it as a limit, not debt. | `recovery-router` limitation 3 | — | lesson 08 → decided lesson 11 |
| 17 | A protected change made *and committed* by one shell command survives the bash watch: the working tree is restored, the commit is not, and the closeout gate's `protected-untouched` check reads `git status`, which is clean. A check that diffs the unit branch against its base under the protected prefixes would catch it at closeout. | `identity-write-gate` limitation 1; lesson 10 drill 1, row 6 | lesson 12 (workload-declared checks) | lesson 10 |
| 18 | The dispatcher's loader refuses the project's extensions, skills, prompts and themes, but still reads the project's context files and `.pi/settings.json`: a target repository can still shape a unit's session. | `project-trust-rule` limitation 2 | lesson 12 (settings as part of the definition) | lesson 10 |
| 19 | Nothing watches network egress; the canary watch sees tool results and assistant text only. Pi's security doc names the container as the boundary. | `canary-watch` limitation 3 | unscheduled (containment is the operator's) | lesson 10 |
| 20 | An obligation owed to a person is exposed by the read model and the control room, not delivered: nothing notifies, nothing reminds, and the CLI trusts `--by` — who may accept a risk at what severity is not checked and no dialog asks anyone. | `obligation-router` limitations 2 and 4; `recovery-router` limitation 4 | lesson 13 (algedonic delivery, interaction-kind timeouts, disposition authority) | lesson 11 |
| 21 | A proposal is an obligation owed to S5, but the S5 decision itself has no workflow: accepting one is a person editing identity under their own authority and citing the obligation id. | `proposal-intake` limitation 1 | lesson 12 (the S5 workflow) | lesson 11 |
| 22 | Effective severity is the message's own (uncertainty impact aside); a message that names a protected invariant is not raised by that fact. Policy floors by subject are not declared. | `obligation-router` limitation 3 | lesson 12 (policy floors with the identity set) | lesson 11 |
| 23 | Routing runs at the loop's steps and on `regulator signals route`; a session run by hand leaves its messages unrouted until then. Nothing watches the log. | `obligation-router` limitation 1 | unscheduled (a file trigger is a lesson 14/15 operating concern) | lesson 11 |

Permanent limits, listed so nobody re-files them as debt: prompt sections are advice and
can be ignored (`contract-advice`); a model summary can be wrong and only the
deterministic block is guaranteed (`contract-preserving-compaction`); the evidence
preflight trusts the session's own tool run by design, and independence is the closeout
gate's (`evidence-preflight`); an effect with no observable trace can only be
reconciled as absent (`effect-journal`); the gate reads the report, never the diff
(`result-report-gate`).
