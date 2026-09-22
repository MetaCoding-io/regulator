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
| 05 | Isolation, leases, anti-oscillation | What stops two operations from fighting? | project trust, bash hooks, sandbox/containers |
| 06 | Work contracts | What am I actually authorizing this run to decide? | SDK runtime, custom tools, session entries |
| 07 | Context as a regulated resource | What do I spend, and on what? | compaction hooks, `getContextUsage`, provider hooks |
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

The reference build lives in [`lab/`](lab/) as a workspace package
(`@metacoding/vsm-pi-course-lab`): each checkpoint is a loadable Pi extension with
headless tests that run under `pnpm check`, so CI keeps every lesson's code honest
against the pinned Pi version. [`lab/fixture/`](lab/fixture/) is the deliberately messy
target project the failure drills run against.

## Status

This directory is a **course design** with the first four lessons written end to end
as vertical slices, per the production plan. It specifies the
offering, the module contracts, the reference build, and the assessment scheme so
production can start against a fixed target. Build sequencing, dependencies on VSM-Pi
milestones, risks, and open decisions are tracked in
[PRODUCTION-PLAN.md](PRODUCTION-PLAN.md).
