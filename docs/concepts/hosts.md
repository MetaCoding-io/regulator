# Hosts

`regulator` is a control plane, not an agent. Something else has to run a unit's session:
load a model, give it tools, and let it work in a worktree. That something is a
**host**. The only host today is `@metacoding.io/regulator-pi`, over
[Pi](https://pi.dev/). The control plane never imports it. It resolves a host by name at
run time, and most of what it does needs no host at all.

The split is deliberate. The loop, the stores, the host checks, the router and the
verdict should not depend on one agent runtime's API, and they should be able to run
where no model is: under CI, in `doctor` and `status`, in a scripted eval.

::: tip Two senses of "host"
This page means the **agent host**: the package that runs a session. The
[host checks](/reference/host-checks) are named for the other sense, the machine the
orchestrator runs on: checks the control plane runs itself, with its own process runner,
outside any session. They need no agent host, and a session cannot influence them.
:::

## The seam

The loop runs a unit through a **dispatcher**: a function that takes a dispatch request
and resolves when the session has ended.

| Request field | What the host is given |
| --- | --- |
| `unitId`, `attempt` | which unit, and which attempt this is |
| `worktree` | the directory the session runs in |
| `contract`, `contractPath` | the work contract, and the immutable file it was loaded from |
| `profile` | the capability profile the workload declares for the unit type |
| `route` | the models the policy routes this unit type to, primary first |
| `policyPath` | the budget policy the session meters itself against |
| `hint` | what the recovery router or a person's answer told this attempt, when there is one |

It returns at most a session id. Everything else the loop learns, it reads from its own
stores.

A **host** is the package that supplies a dispatcher for one runtime, together with the
session extensions that enforce the control plane inside that runtime's sessions. It
exports one object, `host`:

| Field | Meaning |
| --- | --- |
| `name` | the package |
| `runtime` | the agent runtime it binds to, and the version it pins |
| `extensions` | the session extensions it loads for a unit, by name, in load order |
| `extensionPath(name)` | where a named extension's built module is |
| `dispatcher(options)` | a dispatcher; `options.extensions` loads a subset instead of the full list (an eval arm) |

`unit dispatch` and `unit drive` resolve the host from `--host` or `REGULATOR_HOST` if
given. Otherwise they look for `@metacoding.io/regulator-pi` in the operator's project,
then beside the control plane. If none is installed, they say so and name the package to
install. `doctor`, `status`, `check`, `review` and a scripted eval never load a host.

## What the loop reads back

The loop never reads a transcript, and never takes the session's word for anything. After
the dispatcher returns, it reads records and runs its own checks:

| Record | Where | What the loop does with it |
| --- | --- | --- |
| the result report for this attempt | the execution store | checks it against the contract; missing is `no-report` |
| the budget ledger | the execution store | an exhausted ledger with no report is `budget-exhausted` |
| signals, findings, proposals, intelligence, interactions | the regulatory log | routes them into obligations; an unanswered question pauses the unit |
| failure observations | the execution store | refines the cause when the attempt ended without a report |
| commits | the unit's worktree | runs the workload's host checks against them, at that revision |

That table is the contract between a host and the loop. A host that runs a session and
writes those records can drive a unit end to end. The technical verdict is the control
plane's either way: the checks run with the orchestrator's own process runner, not
through the host.

## Which regulators live where

The registry records where each regulator is implemented, and the split follows the
seam. Of the active regulators:

- **In the control plane** (22): the contract gate, the closeout gate and every host
  check, the obligation router and the progression veto, the recovery router,
  reintegration and the pre-merge trial, the S5 decision path and identity promotion,
  delivery and the outbox watcher, disposition authority, the definition check, the
  eval harness, the span projection, and the instance manifest. These run the same under
  any host, and under none.
- **In the host's session** (20): the lease gate and the thrash detector, the profile
  grant, the report gate and the evidence preflight, the budget guard, the model router
  and compaction, the failure observer and the effect journal, the write gate, the bash
  watch, the canary watch, proposal intake and the trust rule, identity in context and
  the memory store, intelligence intake, the interaction contract and the pause gate.

The second group exists only where a host implements it. A dispatcher that runs no
session, such as the scripted units the drift suite and the household-ledger example use
in CI, exercises the whole first group and none of the second. The eval reports say
`scripted:` in their fingerprint for that reason.

## The Pi host

`@metacoding.io/regulator-pi` implements every host-side concern as one of eleven Pi
extensions, each a single concern:

| Extension | Concern |
| --- | --- |
| `tools` | `read_conventions`, `run_tests` and `run_checks` |
| `profiles` | the profile's tool surface and write grant |
| `coordination` | the lease gate, the heartbeat, the thrash detector |
| `contract` | the contract in context, and `report_result` |
| `budget` | the budget guard, compaction, the model ledger |
| `recovery` | the failure observer, and `notify_owner` through the effect journal |
| `evidence` | provenance on test and check results, and the evidence preflight on `report_result` |
| `authority` | the write gate, the bash watch, proposals, the canary watch |
| `intelligence` | `report_intelligence` |
| `identity` | identity and memory in context, and `remember` |
| `algedonic` | `ask_human` and the pause gate |

Its dispatcher runs each unit's session through the Pi SDK. It uses a resource loader
that loads only these extensions and nothing the project supplies (the
[trust rule](/concepts/identity#the-layers)), and the definition's `settings.json` held
in memory. It walks the model route, moving to the next fallback in a fresh session when
a provider fails. Pi is a peer dependency at a pinned version: `doctor` compares the pin
with what is installed, and an eval report records the version it ran under. The same
extensions are declared under `pi.extensions`, so `pi install` loads them into a session
a person runs by hand.

## What is not there yet

- **The seam has one implementation.** Until a second host exists, "host-agnostic" is a
  claim about the code's structure. [Issue #58](https://github.com/MetaCoding-io/regulator/issues/58)
  asks for one, with a manifest that declares which of the eleven concerns it does not
  implement, so `doctor` can say what a unit under that host is not protected by.
- **A host's coverage is not declared.** Nothing records, per host, which session-side
  regulators it enforces. The [enforcement boundary](/reference/boundary) describes the
  Pi host's gates.
- **The session-side gates are only exercised live.** Scripted runs cover the control
  plane; the dispatcher itself and every host-side gate are covered by their own tests
  and by live drills, not by the committed eval reports.
- **Every unit runs a session.** A unit whose work is a deterministic program (a parser,
  a normalizer) still needs a session under a profile. A `command` runner per unit type
  is designed in the
  [open questions](https://github.com/MetaCoding-io/regulator/blob/main/docs/research/2026-09-25-open-questions.md)
  (§3); the dispatcher seam already allows it.
