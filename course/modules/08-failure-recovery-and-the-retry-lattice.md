# Lesson 08 — Failure, recovery, and the retry lattice

**Part 3 · S3 Control** · ~70 min instruction · ~120 min lab · builds **checkpoint 7**

> Attempt one failed. What is different about attempt two — and what must happen by
> attempt six?

Lesson 07 ended every runaway the same way: the unit is *blocked*, the lease is kept,
and the record says why. It left the next step to a person. This lesson builds the
function that takes it — S3's recovery router — and makes the two things a router needs
into records the router can read: what actually went wrong (not merely that the unit went
quiet), and a policy that says, for that cause, what to do the first time, the second
time, and the last. Then it turns to the failure no router can classify: the harness
itself dying after it acted on the world and before it wrote that down.

**Prerequisites.** Checkpoint 6 passing. A model configured for `pi`.

---

## 1. The question

Most harnesses have one recovery action, and it is `retry`. Attempt two is attempt one
again: same prompt, same environment, same missing module, plus the transcript's memory
of having failed. Attempt six is the same, minus the budget. Retry is a variety
*amplifier* pointed at the wrong target — it multiplies attempts, and therefore cost,
without adding a single bit of regulatory information. Nothing in the loop learns that
the failure was environmental, or that the report was refused for a reason the next
attempt could fix in one call, or that the unit is oscillating because a requirement is
undecided and no attempt will settle it.

So the question is not "how many retries?" It is: *what does the loop know after a
failure that it did not know before, and which action does that knowledge name?* And the
harder half: when the loop has spent what it was given, what does giving up look like as
a designed outcome rather than an accident?

## 2. Concept

### The lattice

Borrowing GSD-Pi's vocabulary, recovery has seven actions, and `retry` is one of them:

| Action | What it means | Who performs it | Spends an attempt |
| --- | --- | --- | --- |
| `retry` | Dispatch again under the same contract version, with a hint | the loop | yes |
| `repair` | Dispatch again to fix a specific defect the record names | the loop | yes |
| `replan` | A new contract version is needed | S3 planning (lesson 06) | no |
| `remediate` | The environment must change before any attempt can succeed | outside the unit | no |
| `clarify` | A decision is missing; a question is asked | the owner | no |
| `pause` | Wait; nothing further is decidable now | nobody | no |
| `abort` | Give the claim back; the unit is over | the loop | no |
| `escalate` | The policy is exhausted; S5 or a human must decide | algedonic channel | no |

Two things make it a lattice rather than a list. Actions are ordered by how much they
concede — a retry concedes nothing, a repair concedes the work was nearly right, a replan
concedes the contract was wrong, an escalation concedes the policy was — and the policy
walks *up* that order on repeated failure of the same cause. And the attempt ceiling from
lesson 07 is the floor under it: any action that would spend an attempt when none remain
collapses to `escalate`, mechanically, whatever the policy says.

### Cause before action

An action is selected from a **normalized failure cause**, never from the raw error. The
causes are a closed set — `no-report`, `invalid-report`, `budget-exhausted`,
`check-failure`, `tool-error`, `timeout`, `ambiguity`, `environment`, `conflict`,
`oscillation`, `dispatch-error`, `unknown` — and classification is a fixed precedence
over three kinds of record:

1. **What the orchestrator recorded**: the attempt's outcome and the block reason. A
   reintegration conflict, an exhausted budget, an error at dispatch.
2. **What S2 signalled**: lesson 05's thrash detector says *oscillation*; lesson 05's
   reintegration says *conflict*.
3. **What the session observed**: every tool error and provider error, normalized as it
   happened. This is what turns "the unit ended without a report" into "the tests could
   not load `left-pad`".

Precedence matters because a failure often has more than one true description. A unit
whose tests could not run and which then ran out of turns is *budget-exhausted* to the
orchestrator and *environment* to the session. The router takes the orchestrator's
record first, because it is the authority on execution state; the observation is kept as
evidence and shows up in the hint. The registry card says so as a limitation, because it
is one.

### Policy is versioned, decisions are immutable

The recovery policy is the fourth part of the definition — registry, workload, budgets,
recovery — and it is a file with a version. Each rule is a cause and a list of actions:
the Nth failure of that cause on one unit takes the Nth action, and the last action
repeats. Every decision the router makes is appended, never revised, with the cause, the
occurrence, the evidence it saw, the action, and the policy name *and version* that
produced it. Change the policy, and the record still says which one decided attempt
three. Without the version, a decision cannot be explained later; with it, lesson 14's
ablation can ask whether a policy change changed outcomes.

### Giving up is an outcome

A **poison unit** is one that fails every attempt for a reason no attempt can fix. The
naive loop discovers it when the budget is gone; a designed loop names it. Two designed
endings exist here. `abort` releases the lease, removes the worktree, and sets the unit's
status to `aborted` — the unit is over, and the record says under which policy. `escalate`
keeps the claim and sends an **algedonic signal** to S5: the exceptional channel from
lesson 02's protocol, which bypasses the hierarchy by design, with `requiresHumanAttention`
set. Neither is a failure of the loop. Both are the loop doing its job when the policy
says there is nothing further it may do alone.

### Durable execution

There is a failure the router cannot see, because the router runs after the attempt and
this failure happens *to the harness*. A tool sends a message, or calls an API, or runs a
migration; the process dies before it records the result. On restart there is no record,
so the natural thing is to do it again. Or the sandbox disappears mid-unit and nobody can
say whether the remote operation happened. Agent platforms separate the durable session
from disposable compute for exactly this reason. The mechanism is old: an **effect
journal**, written *before* the effect under an **idempotency key**, committed after, and
on restart **reconciled** — pending intentions checked against the world, not assumed
either way. A committed or confirmed key is never acted on again; the tool returns the
recorded result.

The limit is honest and important: reconciliation needs an observable world. An effect
that leaves no trace the harness can read back can only be recorded as absent, which is a
guess. So the checkpoint journals one tool whose world it can read — and not `bash`, whose
side effects are unknown by declaration (lesson 03).

## 3. Mechanism

### Where a run actually ends

`agent_end` fires when a low-level run ends — but Pi may still auto-retry, auto-compact
and retry, or continue with a queued follow-up. `agent_before_settle` is the final
*actionable* boundary: it can append entries and request one continuation, and it sees
the repaired projection after Pi's own retry backoff. `agent_settled` is final and
notification-only. Checkpoint 7 observes on `agent_end`, because a provider error there
is an observation whether or not Pi then retries; a unit-level decision belongs to the
orchestrator, after the session, not to a settle hook inside it.

### Observing rather than rewriting

`tool_result` handlers chain like middleware and *can* rewrite what the model sees — the
place, in principle, to normalize a raw error into a structured cause for the model. This
checkpoint does not. It records the observation on `tool_execution_end` and leaves the
result untouched, for a reason the registry card states as a limitation: a router that
reads rewritten results is reading its own opinion. The model and the router may
disagree about what happened; the record keeps both.

### `ctx.abort()`, forks, and what the loop does instead

`ctx.abort()` ends the current run at the next checkpoint (lesson 07 used it for the
ceiling). `/fork` and `session_before_fork` let a session continue from a clean branch of
its transcript instead of a polluted one. The loop uses neither for recovery: every
re-dispatch is a **fresh session** on the same worktree, with the contract from the store
and the router's **hint** appended to the prompt. The transcript is not the unit's memory;
the worktree and the record are. A retry that carries a hint knows exactly one more thing
than the attempt before it, and the record says what.

### The observer finds its unit the way the guard did

As in checkpoint 6: not from a flag, but from the lease whose resource is this worktree,
and the attempt number from the unit's record. No lease, no unit, nothing observed and
nothing journaled under a unit id — the tool still works, keyed without one.

## 4. Build: checkpoint 7

### The vocabulary — [`packages/protocol/src/recovery.ts`](../../packages/protocol/src/recovery.ts)

`FailureCauseSchema` and `RecoveryActionSchema` are closed literal unions.
`RecoveryPolicySchema` is `{ name, version, description, rules[], fallback[] }`, each rule
`{ cause, actions[] }` with at least one action. `FailureObservationSchema` is what the
session appends: unit, attempt, time, source (`tool` | `provider` | `orchestrator`), tool
name, cause, message. `RecoveryDecisionSchema` is the immutable record: id, unit,
attempt, cause, occurrence, evidence, action, `policy { name, version }`, rationale, an
optional hint (for actions that re-dispatch) and question (for `clarify`), `decidedAt`,
`decidedBy: "S3"`. `EffectJournalEntrySchema` is one journal line: key, tool, description,
status (`intended` | `committed` | `confirmed` | `absent`), time, optional unit and result.
`UnitStatus` gains `aborted`.

### The router — [`packages/core/src/recovery.ts`](../../packages/core/src/recovery.ts)

Pi-free and git-free. `causeFromError` normalizes error text to `timeout`,
`environment` or `tool-error` by regular expression. `classifyFailure` applies the
precedence of section 2 and returns the cause with the evidence lines it saw — the last
attempt's outcome and detail, the unit's reason, the last three observations of that
attempt. `decideRecovery` looks the cause up in the policy, takes the occurrence-th action
(last repeats), or the fallback, and collapses an attempt-spending action to `escalate`
when the ceiling is reached, saying so in the rationale. `hintFor` writes the next
attempt's one extra sentence; `questionFor` writes the clarification. `routeBlockedUnit`
does all of it over the execution store, counts the occurrence per cause from the
decisions already on disk, and appends the decision.

### The store — [`packages/core/src/execution-store.ts`](../../packages/core/src/execution-store.ts)

Two append-only files per unit beside the immutable contract and report versions:
`observations.ndjson` and `decisions.ndjson`, each line schema-checked on read and write.

### The journal — [`packages/core/src/effect-journal.ts`](../../packages/core/src/effect-journal.ts)

`effectKey(unitId, tool, args)` is a hash of the intention: the same unit, tool and
arguments always key the same. `EffectJournal` is append-only NDJSON under
`.regulator/effects.ndjson`; a key's state is the fold of its lines. `begin` refuses a
committed or confirmed key and returns the prior state; `commit` records the result;
`pending` lists intentions with no outcome; `reconcile(verify)` asks the world about each
one and records `confirmed` or `absent`. An `absent` key may be intended again.

### The loop — [`packages/regulator/src/controller.ts`](../../packages/regulator/src/controller.ts)

`routeUnit` routes one blocked unit and applies what the loop may apply: `abort` calls
`abandonUnit` (release the lease, remove the worktree, delete the branch) and sets
`aborted`; `escalate` appends an algedonic signal S3 → S5 citing the decisions file and
blocks the unit as *escalated*; `remediate`, `replan`, `clarify` and `pause` block the unit
as *awaiting* that action. `driveUnit` is the autoloop: run, and while the outcome is
blocked, route; if the action spends an attempt, run again with the hint; otherwise stop
and return every decision made. `runUnit` accepts the hint and the dispatcher appends it
to the prompt.

### The policy — [`packages/regulator/policies/recovery.json`](../../packages/regulator/policies/recovery.json)

Version 1. `no-report` retries twice then escalates; `invalid-report` repairs twice then
escalates; `budget-exhausted` retries once then replans; `environment` remediates then
escalates; `oscillation` and `ambiguity` clarify; `conflict` repairs then escalates;
anything unruled pauses. Read it with the attempt ceiling in mind: `implement` has three
attempts, so a second `no-report` retry is the last thing the loop does on its own.

### The extension — [`packages/regulator/src/cp7-recovery.ts`](../../packages/regulator/src/cp7-recovery.ts)

The session's two contributions. On `tool_execution_end` with `isError`, the error text is
flattened to one line and appended as an observation with its normalized cause; a refused
`report_result` is typed `invalid-report` directly, because the refusal is a contract
check, not a tool failure. On `agent_end`, an assistant message with `stopReason: "error"`
becomes a `provider` observation. And `notify_owner`: a tool that appends a line to an
outbox file outside the repository (`REGULATOR_OUTBOX`, default `.regulator/outbox`) —
an effect that cannot be unsent — journaled `intended` before the append and `committed`
after; a duplicate key returns *Already sent*; on `session_start`, every pending intention
is reconciled against the outbox before anything else runs, and the notice says whether
it had happened. Its effect is declared in the table from lesson 03 as `sideEffects:
"irreversible"`.

### The CLI and the read model

`regulator unit drive <contract>` runs the autoloop and prints each decision as
`attempt N: cause → action (recovery vN, occurrence N)`; `unit route <id>` routes one
blocked unit by hand and prints the rationale, evidence and hint; `unit show <id>` lists
decisions under the attempts; `effects` prints the journal. `regulator status` shows
`routed cause→action (recovery vN)` per unit, and the control room's units table and unit
inspector show the same, with the full decision list and its evidence.

### Registry cards

`recovery-router` (S3, gate) and `failure-observer` (S3, gate) are mechanism through and
through: no model call anywhere in the route. `effect-journal` is S2 — it coordinates the
harness with its own past — and its limitations say what it cannot reconcile. All three
carry `cost`. The registry now holds fourteen records.

## 5. Break it

Four drills. `regulator fixture` for a fresh repository each time; run `regulator` from
inside it.

**Drill 1 — naive retry versus the router.** Break the environment: in the fixture,
`mv vendor/left-pad.js vendor/left-pad.js.bak` and commit. Every test now fails to load.
First the naive loop: `regulator unit dispatch contracts/fix-known-issue.json` three
times, letting each attempt run. Watch each session discover the same thing, try to fix
it, be refused by the vendor write gate (lesson 02), and end. `regulator unit show u1`:
three attempts, `no-report` or `budget-exhausted`, and a refusal on the fourth dispatch.
Add up the ledgers. That is the cost of retry as the only action.

Now `regulator fixture` again, break it the same way, and `regulator unit drive
contracts/fix-known-issue.json`. After attempt 1 the router prints:

```
  attempt 1: environment → remediate (recovery v1, occurrence 1)
unit u1: awaiting remediate: environment (recovery v1)
```

and stops. One attempt. `regulator unit route u1` shows why: the evidence line
`tool run_tests: environment — Test command did not produce a test summary … Cannot find
module 'left-pad'` — the observation refined a silent end. Restore the file, commit, and
`regulator unit dispatch contracts/fix-known-issue.json` resumes attempt 2 on the same
worktree. Compare the two runs' total tokens; write both numbers in your notes.

**Drill 2 — the refused report, repaired.** Drive `contracts/underscore-unresolved.json`
against the oscillation fixture (`regulator fixture <dest> --oscillation`). When the model
settles the unresolved decision and calls `report_result` with an empty
`unresolvedOutcomes`, the tool refuses it (lesson 06). Without the router that is a silent
end. With it:

```
  attempt 1: invalid-report → repair (recovery v1, occurrence 1)
```

and attempt 2 starts with the hint *"Your previous attempt's report_result was refused:
… u-underscore … The work in the worktree stands; fix the report, not the contract."* Read
the second session's transcript: did it re-do the work, or only the report? If the
thrash detector fires instead, the router says `oscillation → clarify` and prints the
question; nothing is re-dispatched, because no attempt can answer it.

**Drill 3 — the policy exhausted.** Write a recovery policy where `no-report` is
`["retry", "retry", "retry", "retry"]` and drive the known-issue contract with a model that
is instructed, through the fixture's `AGENTS.md`, never to call `report_result`. The
policy names retry four times; the `implement` ceiling is three attempts. The third
decision is `no-report → escalate`, with the rationale *"names retry; the unit has used 3
of 3 attempt(s), so the policy is exhausted"*. `regulator status`: the unit is blocked
*escalated to S5*, an algedonic signal is in the unrouted signals, and the lease is still
held — an escalated unit keeps its claim until S5 decides. Then change the policy's
`fallback` to `["abort"]`, route a unit whose cause has no rule, and confirm the lease is
released, the worktree gone, and the unit's status `aborted` — not deleted.

**Drill 4 — the crash.** In a driven or dispatched session, have the model call
`notify_owner` with a message. `regulator effects`:

```
committed  3f0c…  notify_owner  u1  2026-…  notify owner: tests cannot run — sent 2026-…
```

Call it again with the same message: *Already sent (committed …)*. The outbox has one line.
Now the crash. The headless test does it with a hook that throws between the append and
the commit; do it by hand: start a session, call `notify_owner`, and kill the `pi` process
the moment the tool starts (or set `REGULATOR_OUTBOX` to a path on a slow filesystem and
`kill -9` during the call). `regulator effects` shows `intended` with no result; the outbox
has the line. Start a session again. The first thing it says:

```
regulator: reconciled effect 3f0c… (notify owner: …): it had happened; not repeating it
```

`regulator effects` now says `confirmed`. Call `notify_owner` with that message once more:
*Already sent (confirmed …)*. The outbox still has one line. Then the other case: delete
the outbox line by hand before restarting, and watch reconciliation record `absent`. That
is the only case in which the same message may be sent again — and it is a case the
journal *asked the world* about, not one it assumed.

## 6. Field study: kernel outcomes and obligations

**GSD-Pi.** In `CONTEXT.md` at `cc8779f`, the runtime vocabulary entries for **Failure
Observation**, **Recovery Action**, **Lifecycle Kernel** and **Kernel Outcome**. GSD's
kernel is *advance → execute → verify → route → closeout*, and every step returns a
normalized outcome the next step routes on; a failure observation is a record with a
cause, and a recovery action is chosen from it under a named policy. This checkpoint's
lattice borrows the vocabulary directly, and differs in where the router lives: GSD routes
inside the run, this loop routes after the session, from the store. Question for your
notes: GSD's kernel can route *verify* failures because it runs the verification. Where is
this loop's `check-failure` cause produced today, and what does lesson 09 have to add
before the router ever sees it?

**VSM-Pi.** [`REGULATORY-STATE-AND-ROUTING.md`](../../docs/archive/2026-09/REGULATORY-STATE-AND-ROUTING.md)
§1–2 (events are not obligations; the lifecycle *open → acknowledged → resolved |
escalated | superseded*, with no in-progress state), §8 (the routing table, which is
"policy, not prompt advice"), §12 (separation of duty: S1 cannot resolve its own
uncertainty by asserting confidence later), and §16 (the minimal subset). Hold the
checkpoint against it. A `remediate`, `clarify` or `pause` decision is recorded, the
unit waits, and nothing reminds anyone: the decision is an *event*, and what is missing is
the *obligation* it should open. Lesson 11 adds it. For your notes: which row of §8's
table does an `escalate` decision map to, and does the checkpoint honour that row's
*exposure* column today?

## 7. Checkpoint

You have finished checkpoint 7 when:

1. `pnpm check` passes — including `recovery.test.ts` (classification precedence; the
   Nth occurrence takes the Nth action and the last repeats; an attempt-spending action
   with no attempts left becomes `escalate`; one immutable decision per routed failure
   citing the policy version; the effect journal's intend/commit/reconcile), the
   controller's two recovery tests (retry then repair-with-hint then escalate; clarify
   stops with a question, remediate stops, abort releases the claim and marks the unit
   `aborted`), `cp7-recovery.test.ts` (tool and provider errors become observations;
   `notify_owner` sends once per key and a crash between send and record is reconciled;
   the real-session load with the effect declared), and the read-model tests.
2. Drill 1's driven unit stops after one attempt on `environment → remediate`, and the
   naive run's three attempts cost more than it.
3. Drill 3's third decision is an `escalate` whose rationale names the attempt ceiling;
   the algedonic signal is in the sink with `requiresHumanAttention: true`; the abort
   variant leaves no lease and no worktree and a unit whose status is `aborted`.
4. Drill 4's crash leaves an `intended` line, restart reconciles it to `confirmed`, and
   the outbox never has the message twice.
5. Attempt history and decisions are append-only on disk — `attempts.ndjson`,
   `decisions.ndjson` — and every decision carries `policy.name` and `policy.version`.
6. `regulator status` and the control room show each unit's last routing; the three
   registry cards pass `registry:check`; `REGULATORS.md` is regenerated.
7. Your notes hold drills 1–4 and the field-study answers.

## Further reading

- Pi docs at `v0.87.0`: `extensions.md` on `agent_end`, `agent_before_settle`,
  `agent_settled`, `tool_result`, `session_before_fork`; `sessions.md` on forking and
  the session tree.
- Upstream examples: `tool-result-rewrite`-style handlers in the extensions guide;
  `sdk/` examples on running a session per attempt.
- This repository's [`REGULATORY-STATE-AND-ROUTING.md`](../../docs/archive/2026-09/REGULATORY-STATE-AND-ROUTING.md)
  §17, the worked example on retry-state uncertainty, and [`course/GLOSSARY.md`](../GLOSSARY.md)
  rows for oscillation, six identical retries, and the repeated side effect.
- Ashby, *An Introduction to Cybernetics*, chapter 12, on the regulator that must act
  before it has finished learning what the disturbance was.
