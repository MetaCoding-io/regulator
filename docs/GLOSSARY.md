# Glossary and diagnostic table

Each table has three columns. The first is the cybernetic term, the second says what it
means for an agent harness, and the third says where the idea already exists as mechanism
in Pi, GSD-Pi, or regulator. A term that has no third-column entry is one the course
teaches learners to build themselves.

## 1. Cybernetics

| Term | In a harness | Where it lives |
| --- | --- | --- |
| **Variety** | The number of distinguishable states a thing can be in. A repository, a model, a test suite and a human each generate variety, and the harness must cope with all of it. | — |
| **Requisite variety (Ashby)** | Only variety can absorb variety. A harness with less regulatory variety than the situation it faces will fail somewhere it cannot see. | This is the reason a good model plus a good prompt is not enough. |
| **Attenuation** | Reducing incoming variety before it reaches the regulator, by retrieval, tool narrowing, truncation, or context shaping. | Tool result truncation, skills loaded on demand, and compaction. |
| **Amplification** | Increasing the regulatory variety going out, by checks, gates, retries, and escalation. | `tool_call` gates, host-run verification, and recovery routing. |
| **Regulator** | The component that keeps a system inside acceptable bounds. The harness is the regulator standing between model and environment. | The course's reference build is named for it. |
| **Feedback delay** | The time between a wrong assumption and the signal that reveals it. It is the dominant quality variable in agentic work. | Vertical-slice decomposition and early integration checkpoints. |
| **Homeostat** | Two subsystems that pull against each other and are balanced by a higher function. In VSM these are S3 (inside/now) and S4 (outside/then), balanced by S5. | The intelligence veto against the sprint commitment. |
| **Recursion** | Every viable system contains, and is contained by, viable systems with the same structure. A subagent is a recursive S1, and the harness itself is a viable system. | The subagent driver, and the harness treated as a viable system. |
| **Algedonic signal** | An exceptional alert that bypasses the normal reporting hierarchy: pain or pleasure, in Beer's term. | regulator's `algedonic` channel at severity `[blocking, critical]`, and the escalation path. See [Asking a person](concepts/asking-a-person.md). |

## 2. VSM functions

| Term | In a harness | Where it lives |
| --- | --- | --- |
| **S1 (Operations)** | The units that do the work and touch the environment. They are specialized by capability profile, never by persona. | GSD `execute-task`, and regulator's S1 capability profiles. |
| **S2 (Coordination)** | Damping between operations: isolation, leases, sequencing, anti-oscillation and reintegration. It is mechanism, with no coordinator persona. | GSD worktrees and leases, and regulator's S2 gap analysis. See [Coordination](concepts/coordination.md). |
| **S3 (Control)** | Operational control, which covers planning, dispatch, budgets, recovery, and the authoritative work state. | The GSD lifecycle kernel and auto orchestration, and regulator's work contracts. |
| **S3\* (Audit)** | Independent verification that does not depend on the executor's self-report. | GSD's verification evidence and technical verdict; regulator's audit finding and deterministic gates. |
| **S4 (Intelligence)** | Environment- and future-facing observation. It produces advice, and what it produces is never policy. | GSD research milestones, and regulator's `intelligence` channel. See [Intelligence and memory](concepts/intelligence-and-memory.md). |
| **S5 (Identity / Policy)** | What the system is: purpose, invariants, domain model and policy. It is durable and version-controlled, it is never trapped in a context window, and it is not an agent. | An instance's `regulator/identity/` (the files `IDENTITY.md`, `INVARIANTS.md`, `GLOSSARY.md` and `BOUNDARIES.md`), seeded from the definition. This repository's own identity is `vsm/`. See [Protecting identity](concepts/identity.md). |
| **Separation of duty** | The function that did the work cannot be the function that certifies it. | regulator's independence domains in the functional projection. |

## 3. Channels and authority

| Term | In a harness | Where it lives |
| --- | --- | --- |
| **Channel** | A typed message path with a stated authority and destination. A signal is not an audit, and an audit is not a policy decision. | The message kinds in `packages/protocol` and the routing policy. The [control plane](concepts/control-plane.md#typed-channels) page lists them. |
| **Authority** | What a mechanism permits. A role label's claim is not authority. | `authorizeWrite(path, "operational")` in regulator's extension. |
| **Positive grant** | What a unit *may* do, which is its capability profile. | `pi.setActiveTools` and the `--tools` allowlist. |
| **Negative invariant** | What *nothing* may do: a protected path, or a forbidden mutation. | `tool_call` blocking handlers and the protected S5 paths. |
| **Proposal** | A request to change identity or policy. Proposing confers no mutation authority. | `propose_policy_change`, and INV-002 in the identity seed. See [Protecting identity](concepts/identity.md). |
| **Constraint** | S5's downward definition of the permitted operational space. | The `constraint` channel. Context files carry it as advice, and gates carry it as enforcement. |
| **Signal** | Ordinary upward operational feedback, including residual uncertainty. | regulator's uncertainty signal tool. |
| **Obligation** | A consequential signal that must remain visible until the metasystem has absorbed it: expose → acknowledge → resolve/escalate/supersede. | `packages/core/src/obligations.ts` and `packages/regulator/policies/routing.json`, with the design record archived as `docs/archive/2026-09/REGULATORY-STATE-AND-ROUTING.md`. |
| **Enforcement boundary** | The documented list of what a gate does *not* cover: the shell, custom tools, other engines, and TOCTOU. | `packages/regulator-pi/README.md`, and the registry's `limitations`, from which `BOUNDARY.md` is generated. |
| **Effect contract** | What happens in the world when a tool runs (filesystem, execution, network, side effects), declared alongside its schema. A narrow schema says nothing about a narrow effect. | `packages/protocol/src/effects.ts` and `packages/core/src/effects.ts`. Read-only profiles are defined by effect. See [Coordination](concepts/coordination.md). |
| **Registry** | One typed, CI-checked record per regulator, giving its purpose, the failure it absorbs, its mechanism level, implementation, evidence, limitations, owner, review date, and retirement condition. It is documentation with a mechanism behind it. | `packages/regulator/registry/`, checked by `regulator check`. The specification is archived as [CONTROL-REGISTRY.md](archive/2026-09/CONTROL-REGISTRY.md). |
| **Ablation / retirement** | Running the evals with one regulator switched off, and retiring it when the failure it absorbed no longer occurs. A control system that only grows is not viable either. | The registry's `ablation.switch` and `retirement.condition` on every active record, and the drift suite's ablation arms. See [Evidence about the regulators](concepts/evidence-about-the-regulators.md). |
| **Trust boundary** | Which sources may supply *control* (extensions, skills, packages) and which may supply only *data* (repo files, tool results). | Pi's `project_trust` and `ctx.isProjectTrusted()`, and production-only package installs. |
| **Injection** | Content meant as data that is absorbed as control instead. It is attenuation failing at the trust boundary. | The injection drill. |

## 4. Control vocabulary

| Term | In a harness | Where it lives |
| --- | --- | --- |
| **Mechanism hierarchy** | Type → deterministic gate → typed tool → model judgment → prompt. It is an ordering by reliability under adversarial pressure. | The regulator prime directive. |
| **Gate** | A deterministic check that can block. | The `tool_call` preflight and the closeout gate. |
| **Capability profile** | A typed binding of tools, context, writable paths, model and thinking level for a kind of work. | `packages/protocol/src/profiles.ts`, and `packages/regulator/profiles/*.json`, one file per kind of work, named by the workload's unit types. GSD phases are the comparison: they are routing keys, and they grant nothing. See [Coordination](concepts/coordination.md). |
| **Unit** | The smallest dispatched, executable workflow step. It has one contract, one worktree, and one or more attempts. | The orchestrator's unit record (`packages/protocol/src/execution.ts`), and a workload's unit types (`plan`, `implement`, …). GSD's units (`plan-slice`, `execute-task`) are the comparison. |
| **Phase** | A coarse routing bucket for model and reasoning selection. A phase is not a unit. | GSD's `research`, `planning`, `execution`, `validation`, `uat` and so on. |
| **Work contract** | What S3 authorizes a unit to decide. Each decision in it is FIXED, DELEGATED or UNRESOLVED. | `WorkContract` in `packages/protocol/src/contracts.ts`, with the design record archived as `docs/archive/2026-09/OPERATIONAL-WORK-CONTRACT.md`. See [Work contracts and reports](concepts/contracts.md). |
| **Result report** | The unit's closing record. It carries the delegated choices the unit made, its evidence, its deviations, its emergent decisions, and its residual uncertainty. | `ResultReport` in `packages/protocol/src/contracts.ts`, written by `report_result`. See [Work contracts and reports](concepts/contracts.md). |
| **Residual uncertainty** | Where the unit's model of the system became uncertain. It is regulatory information, never a confidence score. | `docs/ARCHITECTURE.md`, and the uncertainty signal. |
| **Vertical slice** | The thinnest end-to-end path that produces an observable outcome and closes a feedback loop early. | A planning principle (`docs/ARCHITECTURE.md`). The slice-level contract the course designed in lesson 06 was never built, and a unit's `contribution` is the only trace of it. |
| **Budget** | A ceiling on tokens, time, attempts or money, enforced by the harness, with a defined behaviour at the limit. | The budget guard. See [Recovery, budgets and model routes](concepts/recovery.md). |
| **Compaction** | Context eviction with a policy for what must survive it. | `session_before_compact` and custom summarization. See [Recovery, budgets and model routes](concepts/recovery.md). |
| **Attempt** | One immutable claimed execution of a unit against an observed revision. It ends succeeded, failed or interrupted, and it does not by itself complete or cancel the work. | GSD's Attempt Result. |
| **Recovery action** | Exactly one response to a failure, chosen under a named policy version: retry, repair, remediate, replan, clarify, pause, escalate or abort. | GSD's Recovery Action, and the recovery router. See [Recovery, budgets and model routes](concepts/recovery.md). |
| **Oscillation** | Fix A breaks B, and fix B breaks A. S2 detects it and S3 decides what to do about it. | The thrash detector. See [Coordination](concepts/coordination.md). |
| **Lease** | A claim on a resource with an owner, a scope, an expiry, and a liveness story. | GSD milestone leases and dead-worker reclamation. See [Coordination](concepts/coordination.md). |
| **Reintegration** | Bringing isolated work back. This is where hidden coupling surfaces. | Worktree merge-back. See [Coordination](concepts/coordination.md). |
| **Evidence** | An observation produced by the host and tied to a criterion, an attempt, a source revision and an environment, with a freshness. | GSD's Verification Evidence. |
| **Technical verdict** | A pass, fail or inconclusive result, derived mechanically from the required evidence. | GSD. |
| **Human acceptance** | A person's disposition of a subjective check, kept separate from the technical verdict. | GSD's Subjective UAT. |
| **Interaction kind** | The contract for a human interaction, one of recap, choice, clarification, consent or uat. It determines whether an answer is required and whether work pauses. In the lab that rule is a protocol constant (`CONTINUES_WITHOUT_ANSWER`) that no policy can relax. | GSD, and `packages/protocol/src/interaction.ts`. See [Asking a person](concepts/asking-a-person.md). |
| **Consent** | Explicit authorization for an irreversible, public, paid, destructive or account-level action. Silence, cancellation and timeout are never consent. In the lab an unanswered consent pauses the unit by gate. | GSD, and `packages/regulator-pi/src/algedonic.ts`. See [Asking a person](concepts/asking-a-person.md). |
| **Nonblocking recap** | Decisions and assumptions offered for correction while reversible work continues. It is the default interaction and a form of attention management. In the lab it is the one kind that continues without an answer, and the one that does not count against the attention budget. | GSD, and the `ask_human` kind `recap`. |
| **Identity** | What the system is. It is committed and reviewed, and it belongs to S5. | `regulator/identity/` in an instance, and `vsm/` for this repository. See [Protecting identity](concepts/identity.md). |
| **Operational memory** | What the system has learned about its environment. It is durable, it belongs to S3, and agents may write it with provenance and expiry. It is not identity. | `.regulator/memory.ndjson` and the `remember` tool. See [Intelligence and memory](concepts/intelligence-and-memory.md). |
| **Runtime evidence** | What happened this run. It is append-only and replayable, and it is never a competing source of truth. | `.regulator/*.ndjson`, projected as OpenTelemetry GenAI spans by `regulator spans`. |
| **Drift** | Architectural conformance decaying over many units. It is the longitudinal variable the control plane exists to slow. | The regulator drift fixture. |
| **Control arm / treatment arm** | Matched runs with regulation off and with regulation on, because regulation owes evidence. | `packages/regulator/evals/drift.json`, where the arms change only what the definition declares. See [Evidence about the regulators](concepts/evidence-about-the-regulators.md). |
| **Outcome grader / trajectory grader** | An outcome grader reads the resulting environment and never the transcript. A trajectory grader reads the records of how the environment got there. Both are needed. | `packages/regulator/src/graders.ts`. |
| **Behaviour-bound check** | A criterion observed by content: an evidence expectation carries a check the host runs, and the record binds to that criterion alone. | `export-signature`. |

## 5. Diagnostic table — from observed failure to mechanism

Use the columns in the order written: name the failure, diagnose it as a variety problem,
and only then reach for the mechanism. Reaching for the mechanism first is how harnesses
accumulate gates nobody can explain. For the ways the *whole arrangement* fails (a
function missing, absorbed by its neighbour, or disconnected from the one it must talk to)
see [PATHOLOGIES.md](PATHOLOGIES.md).

| You observed… | Variety diagnosis | Reach for | Course module |
| --- | --- | --- | --- |
| Confident, wrong completion on a real repo | Regulatory variety is below environmental variety, and the feedback delay is too long | Host-run checks, and thin vertical slices | M01, M06, M09 |
| A rule in `AGENTS.md` is ignored under pressure | Enforcement at level 5 for a level-2 problem | A `tool_call` gate or a tool restriction | M02, M10 |
| Transcript bloated by raw tool output; agent loses the thread | Unattenuated incoming variety | Narrow typed tools, truncation, and structured results | M03 |
| "Reviewer" persona approves its own work | There is no separation of duty; the profile is a costume | Capability profiles, and an audit independent of S1 | M04, M09 |
| Agent still fumbles a convention no gate could know | The advisory layer is missing; enforcement is not the problem | A context file carrying only what gates cannot know | M04 |
| Two runs corrupt the same files | No isolation and no lease | Worktrees, and leases with liveness | M05 |
| Fix A / fix B ping-pong | Oscillation: S2 detects it and S3 decides | Thrash detector → recovery router | M05, M08 |
| Isolated work merges with surprises | Reintegration was deferred instead of designed | A merge-back step with conflicts as signals | M05 |
| Unrequested scope, silent library or schema choice | Decisions delegated by omission | A work contract: FIXED / DELEGATED / UNRESOLVED | M06 |
| Constraint forgotten after compaction | The eviction policy is not a regulatory decision | Contract-preserving compaction | M07 |
| Runaway cost or wall-clock | No budget, or no behaviour at the limit | A budget guard with a declared limit behaviour | M07 |
| Everything stops when the provider hiccups | A single model, so zero regulatory variety | Per-phase routing with fallback | M07 |
| Six identical retries of an environment failure | Retry is the only recovery action | Failure classification → recovery lattice | M08 |
| "Tests pass" with no tests run | Self-report accepted as evidence | Host-owned, criterion-bound, fresh evidence | M09 |
| Tests pass, and the unit wrote the tests | The auditor runs the suite the executor edited | `inherited-tests`: the base's suite judges the unit's tree, and shrinkage fails | M09 |
| Green CI, changed behaviour untested | Evidence not bound to the criterion | Criterion-bound evidence in place of "CI is green" | M09 |
| Agent edits an identity or policy file | Authority by role label instead of by mechanism | Protected paths, and proposal instead of mutation | M10 |
| A "read-only" profile still changes the world | Read-only judged by tool names instead of by effects | Effect contracts; `isReadOnlyProfile` | M03, M04 |
| A gate nobody can explain, or justify keeping | Regulators accrete without records or review | A registry record, an ablation arm, and a retirement condition | M02, M14 |
| Restart repeats a side effect that already happened | No effect journal and no idempotency key | Journal before the effect, and reconcile on restart | M08 |
| A comment in the repo redirects the agent | Data absorbed as control, because the trust boundary is missing | Authority the content cannot reach, and project trust | M10 |
| Stale advisory rewrites working code | Intelligence auto-applied as policy | Typed intelligence → controller decision | M11 |
| Advisory and sprint commitment collide, last-in wins | The S3 and S4 homeostat is unarbitrated | Policy-declared severity thresholds, and the obligation veto | M11, M12 |
| Behaviour changes with each model version | Identity living in context | Version-controlled identity, with dual prose/code invariants | M12 |
| "Temporary" notes have become undocumented policy | Operational memory conflated with identity | A separate memory store with provenance and expiry | M12 |
| Agent never asks, or asks about everything | The algedonic channel is absent or unattenuated | Interaction kinds, with recap by default and consent for the irreversible | M13 |
| Headless run proceeds on timeout | Timeout treated as consent | Pause-and-record semantics | M13 |
| Regulation feels rigorous but nobody can prove it helped | No control arm | Two-arm evals with repetitions | M14 |
| Works on one laptop, breaks on the next repo | Assumptions baked into the harness | A packaging drill in a clean repo: `regulator init` with the instance manifest, and `regulator doctor` | M15 |
