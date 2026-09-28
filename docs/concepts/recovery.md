# Recovery, budgets and model routes

An attempt fails. The simplest harness runs it again until it passes or somebody
notices. That hides the reason for the failure, spends the budget on the same mistake,
and makes the harness's behaviour depend on how patient it was written to be.

In `regulator`, what S3 does with a failed attempt is data. The failure is normalized to
a **cause**. A versioned **recovery policy** maps the cause, and how often it has
recurred on the unit, to exactly one **action**. The decision is recorded with the
policy version that produced it. Budgets bound what one attempt may spend, and model
routes bound what it may run on. Changing how the loop recovers is a change to a policy
file, reviewed like any other part of the definition, not a change to the loop.

## From failure to cause

When a unit is blocked, the recovery router reads what was recorded and names one cause:

| Cause | Typically from |
| --- | --- |
| `check-failure` | the technical verdict failed at closeout |
| `invalid-report` | `report_result` was refused, or the report did not validate |
| `no-report` | the session ended without a report |
| `budget-exhausted` | the budget guard halted the attempt |
| `timeout`, `environment`, `tool-error` | an error the session observed: a missing command or dependency, no model in the route, a timeout |
| `dispatch-error` | the dispatch itself failed |
| `conflict` | reintegration conflicted with the base |
| `oscillation` | S2's thrash detector signalled the unit is rewriting the same files |
| `unknown` | none of the above |
| `ambiguity` | nothing yet: the vocabulary and the shipped policy name it, but the router never classifies a failure this way |

The router reads three sources: the orchestrator's records (the attempt's outcome, the
unit's block reason), S2's coordination signals, and the **failure observations** the
session wrote. The failure observer normalizes every tool error and provider error in a
session to a cause as it happens. So an attempt that ends silently is routed by what went
wrong, not only by the fact that it went quiet.

When more than one applies, a fixed precedence decides. Reintegration problems come
first, then the attempt's recorded outcome, then an oscillation signal, then the
session's last observation. The orchestrator's record wins over the session's: a check
failure caused by a missing tool is routed as `check-failure`.

## From cause to action

The [recovery policy](/reference/definition#recovery-policy) lists, per cause, the
actions for its first, second and third occurrence on one unit. The shipped policy:

| Cause | 1st | 2nd | 3rd |
| --- | --- | --- | --- |
| `no-report` | retry | retry | escalate |
| `invalid-report` | repair | repair | escalate |
| `budget-exhausted` | retry | replan | |
| `check-failure` | repair | repair | replan |
| `tool-error` | retry | remediate | escalate |
| `timeout` | retry | retry | escalate |
| `environment` | remediate | escalate | |
| `conflict` | repair | escalate | |
| `oscillation` | clarify | | |
| `ambiguity` | clarify | | |
| `dispatch-error` | retry | remediate | escalate |
| anything else | pause (the fallback) | | |

Three rules shape how the table is read:

- **Occurrences count per cause, per unit.** The third `check-failure` on a unit takes
  the third action, however many other failures came between.
- **The last action repeats.** A fourth `check-failure` is `replan` again.
- **The attempt ceiling is a hard stop.** An action that needs another attempt, when the
  unit has used all its attempts, becomes `escalate`. The policy cannot talk the loop
  into a fourth try that the budget does not allow.

The decision is immutable. It records the cause, the occurrence, the evidence, the
action, the policy's name and version, and a rationale. For `retry` and `repair` it
also records the **hint** the next attempt is told. For `clarify` it records the
**question** someone must answer.

## The actions

| Action | What happens | Who acts |
| --- | --- | --- |
| `retry` | another attempt, with a hint about what went wrong | the loop, at once |
| `repair` | another attempt, told to fix what the verdict or the report gate named; the work in the worktree stands | the loop, at once |
| `remediate` | the environment needs fixing before the unit can run again | S3 |
| `replan` | the contract needs a new version | S3 |
| `clarify` | a question needs an answer | a person |
| `pause` | the unit waits | a person |
| `escalate` | the policy has nothing left to try; an algedonic signal goes out with the evidence | a person |
| `abort` | the lease is released, the worktree removed, and the unit is aborted | the loop, at once |

Retry and repair spend an attempt, and the loop applies them itself: `regulator unit
drive` keeps running the unit while the router answers retry or repair. It stops at the
first decision it cannot apply.

Every other action except `abort` leaves the unit blocked and opens an
[obligation](/concepts/obligations) for the consumer the routing policy names for that
action. Under the shipped policy remediate and replan are owed to S3, and clarify, pause
and escalate to a person. The unit's open S3 obligations are escalated into that one, so
the wait has a single owner. When someone dispositions it, the unit can run again. The
loop never performs a remediation or writes a new contract by itself.

A unit paused on an unanswered question is not routed at all. It is waiting for a
person, and the recovery policy has nothing to say until the person answers.

## Budgets

The [budget policy](/reference/definition#budget-and-model-policy) sets ceilings per
unit type, with a default:

| Ceiling | Per | Shipped default |
| --- | --- | --- |
| tokens | attempt | 400,000 |
| cost | attempt | 2 |
| wall-clock | attempt | 20 minutes |
| turns | attempt | 60 |
| attempts | unit | 3 |

Research, planning, verification and close units get smaller ceilings.

Inside the session, the **budget guard** meters each attempt's tokens, cost, wall-clock
and turns. When a ceiling is crossed, the guard halts the attempt and refuses every tool
with an effect from then on. The ledger is written to the execution store, so the
orchestrator closes on the ledger and never reads the budget off the transcript. A
halted attempt is routed as `budget-exhausted`. The attempt ceiling is the loop's: the
dispatch gate refuses a further attempt once it is used up.

## Model routes

The same policy names a **route** per unit type: a primary model and an ordered list of
fallbacks. The dispatcher runs a unit on the first model in its route that is available.
If a provider fails, it moves to the next fallback in a fresh session. Nothing outside
the route is ever tried, and every model an attempt ran on is recorded in its ledger, so
its cost is attributable. If no model in the route is available, dispatch fails with an
`environment` cause.

## Compaction that keeps the contract

A long attempt fills the context window, and the host compacts it. A default summary is
a model's judgement about what mattered, and it can drop a fixed decision. **Contract-
preserving compaction** replaces the summary with a deterministic block first:

- the unit, the attempt, and the contract's id, version and objective;
- the fixed, delegated and unresolved decisions;
- the evidence gathered so far, from `run_tests` and `run_checks`;
- the files modified, and the budget used.

A model summary of the conversation follows when a model is available. When it is not,
the block says so and stands alone. Nothing the loop needs depends on the summary being
good. The contract section in the system prompt is regenerated every turn anyway, so
compaction preserves the unit's progress; it is not the only copy of its contract.

## What is not there yet

The registry records for the [recovery router, the failure observer, the budget guard,
the model router and compaction](/reference/regulators) state their limitations. In
short:

- **Classification is a precedence over recorded facts.** A failure with two causes is
  routed by the first one the precedence finds.
- **Counting per cause can hide a pattern.** A unit that alternates between two causes
  never reaches the third action of either; the attempt ceiling stops it instead, and
  the alternation shows only in its decisions.
- **Observations are pattern matches.** The observer classifies error text with a regular
  expression, and sees only errors the tool layer reports as errors. A bash command that
  exits non-zero without the tool flagging it is invisible.
- **The budget guard checks between turns.** The turn that crosses a ceiling completes.
  A provider that reports no usage meters as zero, and wall-clock counts from session
  start.
- **Failover starts from scratch.** A fallback model does not see what the primary did,
  only the contract, and "available" means an API key is configured, not that the
  provider is up.
- **The compaction summary is unchecked.** Only the deterministic block is guaranteed,
  and it sees evidence from `run_tests` and `run_checks`, not from `bash`.
- **`ambiguity` has a rule and no source.** The shipped policy routes it to `clarify`,
  but no classification produces it yet.
- **Nothing performs a waiting action.** Remediate, replan, clarify and pause are
  recorded and owed to someone; the loop waits until that someone acts.
