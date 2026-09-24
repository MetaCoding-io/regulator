# Glossary and diagnostic table

Three columns on purpose. The first is the cybernetic term, the second is what it means
for a coding-agent harness, and the third is where the idea is already mechanism in Pi,
GSD-Pi, or regulator. A term that has no third-column entry is one the course teaches
learners to build themselves.

## 1. Cybernetics

| Term | In a harness | Where it lives |
| --- | --- | --- |
| **Variety** | The number of distinguishable states a thing can be in. A repository, a model, a test suite and a human each generate variety the harness must cope with. | — |
| **Requisite variety (Ashby)** | Only variety can absorb variety. A harness with less regulatory variety than the situation it faces will fail somewhere it cannot see. | The reason a good model plus a good prompt is not enough (M01). |
| **Attenuation** | Reducing incoming variety before it reaches the regulator: retrieval, tool narrowing, truncation, context shaping. | Tool result truncation, skills loaded on demand, compaction (M03, M04, M07). |
| **Amplification** | Increasing regulatory variety going out: checks, gates, retries, escalation. | `tool_call` gates, host-run verification, recovery routing (M08–M10). |
| **Regulator** | The component that keeps a system inside acceptable bounds. The harness is the regulator standing between model and environment. | The course's reference build is named for it. |
| **Feedback delay** | Time between a wrong assumption and the signal that reveals it. The dominant quality variable in agentic work. | Vertical-slice decomposition, early integration checkpoints (M06). |
| **Homeostat** | Two subsystems that pull against each other and are balanced by a higher function. In VSM, S3 (inside/now) and S4 (outside/then), balanced by S5. | Intelligence veto vs sprint commitment (M11). |
| **Recursion** | Every viable system contains and is contained by viable systems with the same structure. A subagent is a recursive S1; the harness itself is a viable system. | Subagent driver (M11); harness-as-viable-system (M15). |
| **Algedonic signal** | An exceptional alert that bypasses the normal reporting hierarchy — pain or pleasure, in Beer's term. | regulator `algedonic` channel, severity `[blocking, critical]`; escalation path (M13). |

## 2. VSM functions

| Term | In a harness | Where it lives |
| --- | --- | --- |
| **S1 — Operations** | The units that do the work and touch the environment. Specialized by capability profile, not persona. | GSD `execute-task`; regulator S1 capability profiles (M03, M04). |
| **S2 — Coordination** | Damping between operations: isolation, leases, sequencing, anti-oscillation, reintegration. Mechanism, not a coordinator persona. | GSD worktrees and leases; regulator S2 gap analysis (M05). |
| **S3 — Control** | Operational control: planning, dispatch, budgets, recovery, authoritative work state. | GSD lifecycle kernel, auto orchestration; regulator work contracts (M06–M08). |
| **S3\* — Audit** | Independent verification that does not depend on the executor's self-report. | GSD verification evidence and technical verdict; regulator audit finding and deterministic gates (M09, M10). |
| **S4 — Intelligence** | Environment- and future-facing observation. Produces advice, not policy. | GSD research milestones; regulator `intelligence` channel (M11). |
| **S5 — Identity / Policy** | What the system is: purpose, invariants, domain model, policy. Durable and version-controlled, never trapped in a context window. Not an agent. | `vsm/IDENTITY.md`, `vsm/INVARIANTS.md`, `AGENTS.md` (M12). |
| **Separation of duty** | The function that did the work cannot be the function that certifies it. | regulator independence domains in the functional projection (M04, M09). |

## 3. Channels and authority

| Term | In a harness | Where it lives |
| --- | --- | --- |
| **Channel** | A typed message path with a stated authority and destination. A signal is not an audit; an audit is not a policy decision. | `vsm/channels.yaml`; regulator INV-006. |
| **Authority** | What a mechanism permits, not what a role label claims. | `authorizeWrite(path, "operational")` in regulator's extension. |
| **Positive grant** | What a unit *may* do: its capability profile. | `pi.setActiveTools`, `--tools` allowlist (M04). |
| **Negative invariant** | What *nothing* may do: a protected path, a forbidden mutation. | `tool_call` blocking handlers, protected S5 paths (M10). |
| **Proposal** | A request to change identity or policy. Proposing confers no mutation authority. | `vsm_propose_policy_change`; regulator INV-002. |
| **Constraint** | S5's downward definition of the permitted operational space. | `constraint` channel; context files as advice, gates as enforcement. |
| **Signal** | Ordinary upward operational feedback, including residual uncertainty. | regulator uncertainty signal tool. |
| **Obligation** | A consequential signal that must remain visible until the metasystem has absorbed it: expose → acknowledge → resolve/escalate/supersede. | `packages/core/src/obligations.ts` and `packages/regulator/policies/routing.json` (M08, M11); design record archived as `docs/archive/2026-09/REGULATORY-STATE-AND-ROUTING.md`. |
| **Enforcement boundary** | The documented list of what a gate does *not* cover: shell, custom tools, other engines, TOCTOU. | `packages/regulator-pi/README.md`; registry `limitations`, from which `BOUNDARY.md` is generated. |
| **Effect contract** | What happens in the world when a tool runs — filesystem, execution, network, side effects — declared alongside its schema. A narrow schema says nothing about a narrow effect. | `packages/protocol/src/effects.ts`, `packages/core/src/effects.ts` (M03); read-only profiles are defined by effect (M04). |
| **Registry** | One typed, CI-checked record per regulator: purpose, failure absorbed, mechanism level, implementation, evidence, limitations, owner, review date, retirement condition. Documentation with a mechanism behind it. | `packages/regulator/registry/`; `regulator check`; the specification is archived as [CONTROL-REGISTRY.md](../docs/archive/2026-09/CONTROL-REGISTRY.md). |
| **Ablation / retirement** | Running the evals with one regulator switched off; retiring it when the failure it absorbed no longer occurs. A control system that only grows is not viable either. | Registry `ablation.switch` and `retirement.condition` on every active record; the drift suite's ablation arms (M14). |
| **Trust boundary** | Which sources may supply *control* (extensions, skills, packages) versus only *data* (repo files, tool results). | Pi `project_trust`, `ctx.isProjectTrusted()`, production-only package installs (M10). |
| **Injection** | Content meant as data absorbed as control. Attenuation failing at the trust boundary. | Injection drill (M10). |

## 4. Control vocabulary

| Term | In a harness | Where it lives |
| --- | --- | --- |
| **Mechanism hierarchy** | Type → deterministic gate → typed tool → model judgment → prompt. An ordering by reliability under adversarial pressure. | regulator prime directive; M02. |
| **Gate** | A deterministic check that can block. | `tool_call` preflight; closeout gate (M09). |
| **Capability profile** | A typed binding of tools, context, writable paths, model and thinking level for a kind of work. | `packages/protocol/src/profiles.ts`; `packages/regulator/profiles/*.json`, one per kind of work, named by the workload's unit types (M04). GSD phases are the comparison: routing keys, not grants. |
| **Unit** | The smallest dispatched, executable workflow step: one contract, one worktree, one or more attempts. | The orchestrator's unit record (`packages/protocol/src/execution.ts`); a workload's unit types (`plan`, `implement`, …). GSD units (`plan-slice`, `execute-task`) are the comparison. |
| **Phase** | A coarse routing bucket for model and reasoning selection. Not a unit. | GSD `research`, `planning`, `execution`, `validation`, `uat`… (M04, M07). |
| **Work contract** | What S3 authorizes a unit to decide: FIXED / DELEGATED / UNRESOLVED. | `WorkContract` in `packages/protocol/src/contracts.ts` (M06); design record archived as `docs/archive/2026-09/OPERATIONAL-WORK-CONTRACT.md`. |
| **Result report** | The unit's closing record: delegated choices made, evidence, deviations, emergent decisions, residual uncertainty. | `ResultReport` in `packages/protocol/src/contracts.ts`, written by `report_result` (M06). |
| **Residual uncertainty** | Where the unit's model of the system became uncertain. Regulatory information, not a confidence score. | `docs/ARCHITECTURE.md`; uncertainty signal (M06). |
| **Vertical slice** | The thinnest end-to-end path that produces an observable outcome and closes a feedback loop early. | A planning principle (`docs/ARCHITECTURE.md`); the slice-level contract designed for M06 was never built — a unit's `contribution` is the only trace of it. |
| **Budget** | A ceiling on tokens, time, attempts or money, enforced by the harness, with a defined behaviour at the limit. | Budget guard (M07). |
| **Compaction** | Context eviction with a policy for what must survive. | `session_before_compact`, custom summarization (M07). |
| **Attempt** | One immutable claimed execution of a unit against an observed revision. Succeeded / failed / interrupted. Does not by itself complete or cancel the work. | GSD Attempt Result (M08). |
| **Recovery action** | Exactly one response to a failure: retry, repair, replan, remediate, clarify, pause, abort — chosen under a named policy version. | GSD Recovery Action; recovery router (M08). |
| **Oscillation** | Fix A breaks B, fix B breaks A. Detected by S2, decided by S3. | Thrash detector (M05, M08). |
| **Lease** | A claim on a resource with an owner, a scope and an expiry — and a liveness story. | GSD milestone leases and dead-worker reclamation (M05). |
| **Reintegration** | Bringing isolated work back; where hidden coupling surfaces. | Worktree merge-back (M05). |
| **Evidence** | An observation tied to a criterion, an attempt, a source revision and an environment, produced by the host, with freshness. | GSD Verification Evidence (M09). |
| **Technical verdict** | Pass / fail / inconclusive derived mechanically from required evidence. | GSD (M09). |
| **Human acceptance** | A person's disposition of a subjective check, separate from the technical verdict. | GSD Subjective UAT (M09, M13). |
| **Interaction kind** | The contract for a human interaction: recap, choice, clarification, consent, uat. Determines whether an answer is required and whether work pauses; in the lab the rule is a protocol constant (`CONTINUES_WITHOUT_ANSWER`) no policy can relax. | GSD; `packages/protocol/src/interaction.ts` (M13). |
| **Consent** | Explicit authorization for an irreversible, public, paid, destructive or account-level action. Silence, cancellation and timeout are never consent; in the lab an unanswered consent pauses the unit by gate. | GSD; `packages/regulator-pi/src/algedonic.ts` (M13). |
| **Nonblocking recap** | Decisions and assumptions offered for correction while reversible work continues. The default interaction; attention management. In the lab, the one kind that continues without an answer, and the one that does not count against the attention budget. | GSD; `ask_human` kind `recap` (M13). |
| **Identity** | What the system is. Committed, reviewed, S5. | `vsm/` (M12). |
| **Operational memory** | What the system has learned about its environment. Durable, S3, agent-writable with provenance and expiry. Not identity. | `.regulator/memory.ndjson` and the `remember` tool (M12). |
| **Runtime evidence** | What happened this run. Append-only, replayable, never a competing source of truth. | `.regulator/*.ndjson`, projected as OpenTelemetry GenAI spans by `regulator spans` (M09, M14). |
| **Drift** | Architectural conformance decaying over many units. The longitudinal variable the control plane exists to slow. | regulator drift fixture (M12, M14). |
| **Control arm / treatment arm** | Matched runs with regulation off and on. Regulation owes evidence. | `packages/regulator/evals/drift.json`: arms change only what the definition declares (M14). |
| **Outcome grader / trajectory grader** | An outcome grader reads the resulting environment and never the transcript; a trajectory grader reads the records of how it got there. Both are needed. | `packages/regulator/src/graders.ts` (M14). |
| **Behaviour-bound check** | A criterion observed by content: an evidence expectation carries a check the host runs, and the record binds to that criterion alone. | `export-signature` (M14). |

## 5. Diagnostic table — from observed failure to mechanism

Use this in the order written: name the failure, diagnose it as a variety problem, then
reach for the mechanism. Reaching for the mechanism first is how harnesses accumulate
gates nobody can explain. For the ways the *whole arrangement* fails — a function
missing, absorbed by its neighbour, or disconnected — see [PATHOLOGIES.md](PATHOLOGIES.md).

| You observed… | Variety diagnosis | Reach for | Module |
| --- | --- | --- | --- |
| Confident, wrong completion on a real repo | Regulatory variety below environmental variety; feedback delay too long | Host-run checks, thin vertical slices | M01, M06, M09 |
| A rule in `AGENTS.md` is ignored under pressure | Enforcement at level 5 for a level-2 problem | `tool_call` gate or tool restriction | M02, M10 |
| Transcript bloated by raw tool output; agent loses the thread | Unattenuated incoming variety | Narrow typed tools, truncation, structured results | M03 |
| "Reviewer" persona approves its own work | No separation of duty; profile is costume | Capability profiles; audit independent of S1 | M04, M09 |
| Agent still fumbles a convention no gate could know | Advisory layer missing, not enforcement | A context file carrying only what gates cannot know | M04 |
| Two runs corrupt the same files | No isolation, no lease | Worktrees, leases with liveness | M05 |
| Fix A / fix B ping-pong | Oscillation; S2 detects, S3 decides | Thrash detector → recovery router | M05, M08 |
| Isolated work merges with surprises | Reintegration deferred, not designed | Merge-back step with conflicts as signals | M05 |
| Unrequested scope, silent library or schema choice | Decisions delegated by omission | Work contract: FIXED / DELEGATED / UNRESOLVED | M06 |
| Constraint forgotten after compaction | Eviction policy is not a regulatory decision | Contract-preserving compaction | M07 |
| Runaway cost or wall-clock | No budget, or no behaviour at the limit | Budget guard with declared limit behaviour | M07 |
| Everything stops when the provider hiccups | Single model; zero regulatory variety | Per-phase routing with fallback | M07 |
| Six identical retries of an environment failure | Retry as the only recovery action | Failure classification → recovery lattice | M08 |
| "Tests pass" with no tests run | Self-report accepted as evidence | Host-owned, criterion-bound, fresh evidence | M09 |
| Tests pass, and the unit wrote the tests | The auditor runs the suite the executor edited | `inherited-tests`: the base's suite judges the unit's tree; shrinkage fails | M09 |
| Green CI, changed behaviour untested | Evidence not bound to the criterion | Criterion-bound evidence, not "CI is green" | M09 |
| Agent edits an identity or policy file | Authority by role label, not mechanism | Protected paths, proposal-not-mutation | M10 |
| A "read-only" profile still changes the world | Read-only judged by tool names, not effects | Effect contracts; `isReadOnlyProfile` | M03, M04 |
| A gate nobody can explain, or justify keeping | Regulators accrete without records or review | Registry record; ablation arm; retirement condition | M02, M14 |
| Restart repeats a side effect that already happened | No effect journal, no idempotency key | Journal before effect; reconcile on restart | M08 |
| A comment in the repo redirects the agent | Data absorbed as control; trust boundary missing | Authority the content cannot reach; project trust | M10 |
| Stale advisory rewrites working code | Intelligence auto-applied as policy | Typed intelligence → controller decision | M11 |
| Advisory and sprint commitment collide, last-in wins | Unarbitrated S3–S4 homeostat | Policy-declared severity thresholds; obligation veto | M11, M12 |
| Behaviour changes with each model version | Identity living in context | Version-controlled identity, dual prose/code invariants | M12 |
| "Temporary" notes have become undocumented policy | Operational memory conflated with identity | Separate memory store with provenance and expiry | M12 |
| Agent never asks, or asks about everything | Algedonic channel absent or unattenuated | Interaction kinds; recap by default, consent for the irreversible | M13 |
| Headless run proceeds on timeout | Timeout treated as consent | Pause-and-record semantics | M13 |
| Regulation feels rigorous but nobody can prove it helped | No control arm | Two-arm evals with repetitions | M14 |
| Works on one laptop, breaks on the next repo | Assumptions baked into the harness | Packaging drill in a clean repo: `regulator init` with the instance manifest, `regulator doctor` | M15 |
