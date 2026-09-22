# Viable Agents — Build Your Own Coding-Agent Harness

**A course offering built on Pi, GSD-Pi, and the VSM-Pi control-plane research.**

> Most agent courses teach you the buttons. This one teaches you the control system,
> and you leave holding a harness you wrote yourself.

## The pitch

[Pi](https://pi.dev/) is a *minimal agent harness*: a loop, a tool surface, a session
format, and a TypeScript extension API that lets you replace or intercept almost every
part of it. That minimality is the pedagogical opportunity. A feature tour of Pi teaches
a learner what Pi *has*. Building a harness on top of Pi teaches them why each feature
exists — because they hit the failure it was invented to regulate.

This course uses Stafford Beer's Viable System Model (VSM) and Ashby's Law of Requisite
Variety as the organizing spine. Each module opens with a **regulatory question** that
an autonomous coding agent forces on you, derives the mechanism that answers it, and
then shows the Pi feature that implements it, the production example in GSD-Pi, and the
typed control-plane treatment in VSM-Pi.

The learner leaves with three things:

1. **A harness they own** — `regulator`, a small but real Pi-based harness built across
   the course (see [REFERENCE-BUILD.md](REFERENCE-BUILD.md)).
2. **Working fluency in Pi's feature base** — extensions, tools, skills, sessions,
   compaction, model routing, SDK, RPC, packages, evals — learned as answers, not as a
   catalogue.
3. **A design vocabulary that survives the next model release** — variety, attenuation,
   amplification, feedback delay, authority, channel, audit independence, algedonic
   escalation. Model capabilities move; regulatory structure does not.

## Who it is for

| Audience | What they get |
| --- | --- |
| Senior/staff engineers running agents on real codebases | A principled reason for every guardrail, and a harness tuned to their repo |
| Platform & DevEx teams | A design method for an internal agent platform, plus evaluation machinery to prove it helps |
| Agent-tool builders | Deep Pi extension/SDK competence and a structural critique of "5 agents in a trench coat" frameworks |
| Technical leaders evaluating autonomy | A vocabulary for where autonomy is safe, and what evidence would show it |

**Not for**: people looking for prompt packs, persona libraries, or a no-code agent builder.

## Prerequisites

- Comfortable TypeScript (async, generics at a reading level, `tsc`).
- Node >= 22.19, git, a terminal.
- Access to at least one model provider key (any of Pi's 15+ providers).
- Having used *some* coding agent for real work. No cybernetics background required;
  the course teaches the cybernetics it uses.

## Learning outcomes

By the end, a participant can:

1. Describe a coding-agent harness as a control system: what regulates what, over which
   channel, with what authority, closing which feedback loop.
2. Apply the **mechanism hierarchy** — *type → deterministic gate → typed tool → model
   judgment → prompt* — instead of solving every problem with prompt text.
3. Extend Pi confidently: register typed tools, intercept the tool-call lifecycle, shape
   context, route models per phase, drive it from the SDK or RPC, and package the result.
4. Design work units as **contracts** (what is fixed, what is delegated, what may not be
   silently settled) rather than as prose task descriptions.
5. Build audit that does not depend on the executor's self-report.
6. Keep system identity durable and version-controlled instead of trapped in a context window.
7. Decide when a human must be interrupted, and build the channel that does it.
8. Measure whether their regulation actually improved outcomes, with a control arm.

## Shape of the offering

The same curriculum ships in three envelopes:

| Envelope | Length | Format | Primary artifact |
| --- | --- | --- | --- |
| **Self-paced** | ~40 h + capstone (a hypothesis until the pilot measures it) | Repo + written modules + recorded walkthroughs + graded labs | `regulator` at checkpoint 14 |
| **Cohort** | 6 weeks | 2 × 90 min live sessions/week, labs between, design reviews, capstone crit | Capstone harness + viability case |
| **Team intensive** | 2 days on-site/remote | Modules 01, 02, 03, 09 and 10 only, labs on *the team's own repo* | A guardrail layer for the team's codebase |

Every module is a fixed unit: **question → concept → Pi mechanism → build step → break
it → field study → checkpoint.** The "break it" drill is not optional garnish; the
failure demo is how the regulatory need becomes felt rather than asserted.

## Syllabus at a glance

| # | Module | Regulatory question | Primary Pi surface |
| --- | --- | --- | --- |
| 01 | The harness is the regulator | Why doesn't a good model plus a good prompt suffice? | CLI, TUI, sessions, `-e` |
| 02 | Anatomy of a turn | Where exactly can I intervene? | Extension event lifecycle |
| 03 | Tools as the variety interface | How does the agent act on the world, and how narrowly? | `registerTool`, typebox, truncation |
| 04 | Capability profiles and the advisory layer | How do I specialize work without roleplay, and what should prompts still carry? | `setActiveTools`, skills, AGENTS.md, scoped models |
| 05 | Isolation, leases, and the anti-oscillation problem | What stops two operations from fighting? | `pi.exec`, worktrees, tool execution events, no-sandbox position |
| 06 | Work contracts: what you are actually authorizing | What am I actually authorizing this run to decide? | SDK sessions as a driver, typed session entries, extension flags |
| 07 | Context and budget as regulated resources | What do I spend, and on what? | compaction hooks, `ctx.abort`, `model_select`, `ModelRuntime` |
| 08 | Failure, recovery, retry lattice | What happens on attempt two, and on attempt six? | `agent_end`, `agent_before_settle`, recovery routing |
| 09 | Evidence, not claims | How do I know the work is done? | `tool_call`/`tool_result` hooks, host-run checks |
| 10 | Authority boundaries | What must the agent never be able to change? | permission gates, protected paths, proposals |
| 11 | Environmental intelligence | How does the system learn about its world? | subagents, plan mode, dynamic resources, RPC |
| 12 | Durable identity and policy | What keeps the system itself from drifting? | context files, settings, packages, S5 artifacts |
| 13 | Algedonic channels | When must a human be interrupted? | dialogs, timed confirm, notify, status widgets |
| 14 | Observability, evals, drift | Did any of this actually help? | session format, fork/tree, evals package |
| 15 | Packaging and operating | How does my team run this on Monday? | pi packages, SDK embed, RPC, CI/headless |
| — | Capstone | Present a viability case for your harness | everything |

Full module specs: [CURRICULUM.md](CURRICULUM.md). Two reference documents sit
alongside them: [GLOSSARY.md](GLOSSARY.md) maps each cybernetic term to its harness
meaning and to where it already exists as mechanism in Pi, GSD-Pi or VSM-Pi, and ends
with a *failure → diagnosis → mechanism* table; [FEATURE-MATRIX.md](FEATURE-MATRIX.md)
lists every Pi documentation page and extension API area against the module that
teaches it, so the "you learn the feature base anyway" claim is checkable rather than
asserted. [CONTROL-REGISTRY.md](CONTROL-REGISTRY.md) specifies the third thread: a typed,
CI-checked record per regulator the learner builds, and the read-only control room that
projects those records and the runtime evidence for the harness's maintainer.

## What the learner builds

`regulator` — a harness that starts as a twenty-line Pi extension and finishes with:

- typed operational tools with narrow schemas and host-run verification;
- capability profiles binding tool surface, context, model, and thinking level per phase;
- a work-contract record for every dispatched unit, with delegated/unresolved decisions;
- an independent check layer whose verdict the executing agent cannot author;
- protected identity files that the agent may propose changes to but never write;
- an algedonic path that stops the run and asks a human, with explicit timeout semantics;
- an append-only event store, replayable, with a control-vs-treatment eval harness.

Staging, checkpoints and starter-kit requirements: [REFERENCE-BUILD.md](REFERENCE-BUILD.md).

## How it uses the three repositories

| Repo | Role in the course |
| --- | --- |
| **Pi** (`earendil-works/pi`) | The substrate. Every build step uses documented Pi APIs — no forks, no monkey-patching. |
| **VSM-Pi** (this repo) | The product. `regulator`, the harness learners build, *is* VSM-Pi's reference build; its checkpoints promote into `packages/` as they stabilize. Channels, invariants, effects, profiles, the registry, contracts and obligations are the course's own material, not a reference to something else. |
| **GSD-Pi** (`open-gsd/gsd-pi`) | The comparison. A production harness that answered the same regulatory questions differently — lifecycle, worktrees, leases, attempts, recovery, verification evidence, human-interaction contracts. Each module reads the part of GSD that solves that module's problem, so learners see what their own answer is standing beside. |

The course never asks a learner to adopt VSM-Pi's answers. It asks them to understand
the regulatory question well enough to accept, reject, or redesign any specific answer —
including ours.

## Assessment

Labs are auto-graded where mechanically checkable (the course grader is itself a
deterministic gate — the medium is the message). Design work is reviewed against the
**Viability Review rubric**: for each of S1–S5 and S3\*, name the mechanism, the channel,
the authority, the evidence, and the failure mode it does not cover.

See [ASSESSMENT.md](ASSESSMENT.md).

## Lessons written so far

| Lesson | Checkpoint | Lab code |
| --- | --- | --- |
| [01 — The harness is the regulator](modules/01-the-harness-is-the-regulator.md) | 0: event log | [`lab/src/cp0-event-log.ts`](lab/src/cp0-event-log.ts) |
| [02 — Anatomy of a turn](modules/02-anatomy-of-a-turn.md) | 1: schema-validated trace + first gate + registry seed | [`lab/src/cp1-trace.ts`](lab/src/cp1-trace.ts), [`lab/registry/`](lab/registry/); trace and registry in [`packages/`](../packages/) |
| [03 — Tools as the variety interface](modules/03-tools-as-the-variety-interface.md) | 2: three typed tools with error and effect contracts | [`lab/src/cp2-typed-tools.ts`](lab/src/cp2-typed-tools.ts), [`lab/src/conventions.ts`](lab/src/conventions.ts); effects in [`packages/core/src/effects.ts`](../packages/core/src/effects.ts) |
| [04 — Capability profiles and the advisory layer](modules/04-capability-profiles-and-the-advisory-layer.md) | 3: profiles as positive grants + advice | [`lab/src/cp3-profiles.ts`](lab/src/cp3-profiles.ts), [`lab/src/profiles.ts`](lab/src/profiles.ts) |
| [05 — Isolation, leases, and the anti-oscillation problem](modules/05-isolation-leases-and-anti-oscillation.md) | 4: leases with liveness, worktree isolation + reintegration, thrash detector, unit lifecycle CLI | [`lab/src/cp4-coordination.ts`](lab/src/cp4-coordination.ts), [`lab/src/coordination.ts`](lab/src/coordination.ts), [`lab/src/worktree.ts`](lab/src/worktree.ts), [`lab/src/unit.ts`](lab/src/unit.ts), [`lab/src/lab-cli.ts`](lab/src/lab-cli.ts); [`lab/fixture-oscillation/`](lab/fixture-oscillation/) |
| [06 — Work contracts: what you are actually authorizing](modules/06-work-contracts.md) | 5: typed work contract, result report tool with a gate, the first slice of the S3 loop, the first workload definition, `regulator status` | [`lab/src/cp5-contract.ts`](lab/src/cp5-contract.ts), [`lab/src/controller.ts`](lab/src/controller.ts), [`lab/src/dispatch-pi.ts`](lab/src/dispatch-pi.ts), [`lab/workload/`](lab/workload/), [`lab/contracts/`](lab/contracts/); contracts and execution store in [`packages/`](../packages/), read model in [`packages/cli`](../packages/cli) |
| [07 — Context and budget as regulated resources](modules/07-context-and-budget-as-regulated-resources.md) | 6: policy (budgets + model routes), budget guard with halt and gate, contract-preserving compaction, model failover, attempt ceilings and re-dispatch | [`lab/src/cp6-budget.ts`](lab/src/cp6-budget.ts), [`lab/policies/`](lab/policies/), [`lab/src/dispatch-pi.ts`](lab/src/dispatch-pi.ts); meter and preserved block in [`packages/core/src/policy.ts`](../packages/core/src/policy.ts) |
| [08 — Failure, recovery, and the retry lattice](modules/08-failure-recovery-and-the-retry-lattice.md) | 7: recovery router over blocked units under a versioned policy (retry, repair, replan, remediate, clarify, pause, abort, escalate), failure observations, the autoloop, the effect journal with reconciliation on restart | [`lab/src/cp7-recovery.ts`](lab/src/cp7-recovery.ts), [`lab/policies/recovery.json`](lab/policies/recovery.json), [`lab/src/controller.ts`](lab/src/controller.ts); router and journal in [`packages/core/src/recovery.ts`](../packages/core/src/recovery.ts), [`packages/core/src/effect-journal.ts`](../packages/core/src/effect-journal.ts) |
| [09 — Evidence, not claims](modules/09-evidence-not-claims.md) | 8: the closeout gate — host-run checks bound to the revision, environment, attempt and criterion; technical verdict separate from human acceptance; audit findings; evidence provenance and the report preflight in the session | [`lab/src/cp8-evidence.ts`](lab/src/cp8-evidence.ts), [`lab/src/controller.ts`](lab/src/controller.ts); checks and verdict in [`packages/checks/`](../packages/checks/), audit log in [`packages/core/src/audit-log.ts`](../packages/core/src/audit-log.ts) |
| [10 — Authority boundaries and protected state](modules/10-authority-boundaries-and-protected-state.md) | 9: protected identity seeded with INV-001; the identity write gate with the filesystem alias walk; the bash snapshot-and-restore; `propose_policy_change`; the trust rule in the dispatcher's loader; the canary watch; `BOUNDARY.md` generated from the registry | [`lab/src/cp9-authority.ts`](lab/src/cp9-authority.ts), [`lab/identity/`](lab/identity/), [`lab/fixture-injection/`](lab/fixture-injection/), [`lab/BOUNDARY.md`](lab/BOUNDARY.md); the preflight in [`packages/core/src/authority.ts`](../packages/core/src/authority.ts), shared with [`packages/pi-extension`](../packages/pi-extension) |
| [11 — Environmental intelligence and the obligation lifecycle](modules/11-environmental-intelligence-and-obligations.md) | 10: the research unit type under its own profile, budget and route; `report_intelligence` with host-stamped provenance; the obligation ledger folded from the regulatory log (open → acknowledged → resolved / escalated / superseded); the router under a versioned routing policy; the progression veto at dispatch and close; recovery decisions and proposals as obligations owed to someone | [`lab/src/cp10-intelligence.ts`](lab/src/cp10-intelligence.ts), [`lab/policies/routing.json`](lab/policies/routing.json), [`lab/contracts/research-vendored-helper.json`](lab/contracts/research-vendored-helper.json), [`lab/src/controller.ts`](lab/src/controller.ts); the vocabulary in [`packages/protocol/src/obligations.ts`](../packages/protocol/src/obligations.ts), the ledger and router in [`packages/core/src/obligations.ts`](../packages/core/src/obligations.ts) |
| [12 — Durable identity and policy](modules/12-durable-identity-and-policy.md) | 11: the complete identity set (purpose, four invariants, glossary, boundaries) seeded into every instance, rendered into context from the files, write-protected; INV-001 as a host check (`identity-untouched`) at closeout; authority references that must resolve; profiles and settings as declared parts of the definition, and `regulator check` over the whole declaration; the operational memory store with `remember`; the S5 decision path for proposals; routing floors and the thrash threshold as policy; the drift scenario for lesson 14 | [`lab/src/cp11-identity.ts`](lab/src/cp11-identity.ts), [`lab/identity/`](lab/identity/), [`lab/profiles/`](lab/profiles/), [`lab/settings.json`](lab/settings.json), [`lab/drift/SCENARIO.md`](lab/drift/SCENARIO.md), [`lab/src/lab-cli.ts`](lab/src/lab-cli.ts); identity, memory and the definition check in [`packages/core/`](../packages/core/), the host check in [`packages/checks/src/verify.ts`](../packages/checks/src/verify.ts) |
| [13 — Algedonic channels and human interaction contracts](modules/13-algedonic-channels-and-human-interaction-contracts.md) | 12: `ask_human` under interaction kinds whose rule is fixed in the protocol (only a recap continues without an answer; silence, cancellation and timeout are never consent); dialogs with the policy's timeout when a person is present; the pause gate in the session and the paused attempt in the loop, held by the veto until a person answers; the attention budget per attempt; delivery of what is owed to a person to the outbox through the effect journal, with reminders; disposition authority declared per person and checked before every `--by` | [`lab/src/cp12-algedonic.ts`](lab/src/cp12-algedonic.ts), [`lab/policies/interaction.json`](lab/policies/interaction.json), [`lab/src/deliver.ts`](lab/src/deliver.ts), [`lab/src/controller.ts`](lab/src/controller.ts), [`lab/src/lab-cli.ts`](lab/src/lab-cli.ts); the vocabulary in [`packages/protocol/src/interaction.ts`](../packages/protocol/src/interaction.ts), the rules in [`packages/core/src/interaction.ts`](../packages/core/src/interaction.ts) |
| [14 — Observability, evals, and longitudinal drift](modules/14-observability-evals-and-longitudinal-drift.md) | 13: the eval harness over the drift scenario — a declared suite with control, treatment and per-regulator ablation arms, repetitions, pre-registered metrics, outcome and trajectory graders, Student's t intervals and an environment fingerprint, with a person's interpretation required; three committed reports against scripted learner-style units, honest about where the gated arm loses; `export-signature`, a criterion observed by content; the instance's records as OpenTelemetry GenAI spans with redaction; `ablation` and `retirement` on every registry record and `regulator review --due` | [`lab/src/evals.ts`](lab/src/evals.ts), [`lab/src/graders.ts`](lab/src/graders.ts), [`lab/src/evals-scripted.ts`](lab/src/evals-scripted.ts), [`lab/evals/`](lab/evals/), [`lab/contracts/drift/`](lab/contracts/drift/), [`lab/src/lab-cli.ts`](lab/src/lab-cli.ts); the vocabulary in [`packages/protocol/src/evals.ts`](../packages/protocol/src/evals.ts) and [`spans.ts`](../packages/protocol/src/spans.ts), the arithmetic and the projection in [`packages/core/`](../packages/core/), the check in [`packages/checks/src/verify.ts`](../packages/checks/src/verify.ts) |
| [15 — Packaging and operating your harness](modules/15-packaging-and-operating-your-harness.md) | 14: the lab as an installable pi package with the `regulator` CLI and `OPERATING.md`; `regulator init` into an existing repository with the instance manifest (definition, revision, Pi pin, the declared writable and protected prefixes — read by the profile grant and the closeout); `regulator doctor` as the CI entry point; post-merge checks on the base with an obligation on the instance itself; `glossary-lint` over the identity's refused words; the outbox watcher with a channel command and a cursor; `identity promote` as the release path into the definition's seed; memory scoped by unit type; the events store under `.regulator/`; the replay view | [`lab/src/instance.ts`](lab/src/instance.ts), [`lab/src/deliver.ts`](lab/src/deliver.ts), [`lab/src/controller.ts`](lab/src/controller.ts), [`lab/src/lab-cli.ts`](lab/src/lab-cli.ts), [`lab/OPERATING.md`](lab/OPERATING.md), [`lab/package.json`](lab/package.json); the manifest in [`packages/protocol/src/instance.ts`](../packages/protocol/src/instance.ts), the check in [`packages/checks/src/verify.ts`](../packages/checks/src/verify.ts) |

The reference build lives in [`lab/`](lab/) as a workspace package
(`@metacoding/vsm-pi-course-lab`): each checkpoint is a loadable Pi extension with
headless tests that run under `pnpm check`, so CI keeps every lesson's code honest
against the pinned Pi version. [`lab/fixture/`](lab/fixture/) is the deliberately messy
target project the failure drills run against.

## Status

This directory is a **course design** with all fifteen lessons written end to end
as vertical slices, per the production plan. It specifies the
offering, the module contracts, the reference build, and the assessment scheme so
production can start against a fixed target. Build sequencing, dependencies on VSM-Pi
milestones, risks, and open decisions are tracked in
[PRODUCTION-PLAN.md](PRODUCTION-PLAN.md).
