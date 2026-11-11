# Intelligence and memory

A unit learns things about the world outside the code while it works. There are two
places to put what it learns, and they do different jobs.

Intelligence is a finding that bears on work in progress, for example *the vendored
helper is a modified copy, and unit `u1` depends on the modification*. It is an S4
message to S3. It raises an obligation, and at blocking severity that obligation holds
the units the finding names until someone decides what to do.

Operational memory is a fact for later units, for example *the tests need `TZ` set*. It
is S3's note to itself. It is rendered into the context of later units until it
expires, and it raises nothing.

Neither of these is identity. What the system *is* (its invariants, its glossary, its
boundaries) lives in the S5 files, and a unit can only propose a change to them. The
three records are kept apart because each one exists to prevent a particular failure:
a finding that rewrote the plan by itself, or a note that became a rule because nobody
dated it.

## Side by side

| | Intelligence signal | Memory entry | Identity (for contrast) |
| --- | --- | --- | --- |
| **Function** | S4 → S3 | S3 | S5 |
| **Written by** | a `research` unit, through `report_intelligence` | a unit whose profile grants `remember` (`implement`, `bookkeeper`) | only the S5 decision path, when a named person accepts a proposal |
| **Holds** | subject, claim, observation, evidence, confidence, severity, when it was observed, when it expires, affected units; optionally a prediction (a metric, a baseline, a direction and size, a probability, the horizons it resolves at) | subject, note, evidence, scope (unit types), review-by date | invariants, glossary, boundaries |
| **Provenance** | unit, revision and time, stamped by the host | unit, revision and time, stamped by the host; `recordedBy: "S1"` | the proposal, the person who accepted it, the rationale |
| **Lives in** | `.regulator/signals.ndjson`, with the obligations it opened | `.regulator/memory.ndjson` | `regulator/identity/`, committed, write-protected |
| **Does** | opens an obligation per affected unit; vetoes their dispatch and close at blocking severity | is rendered into later units' context as facts that expire | is rendered into every unit's context; gates and host checks enforce it |
| **Expires** | when `expiresAt` passes: routed after that, it is noted and raises nothing | on `reviewBy`, which is required, in the future and at most 90 days out | never; it changes by decision |
| **Ends** | when a consumer dispositions the obligation | on expiry, or when a named person retracts it | by an accepted proposal |

All three are append-only. Nothing in any of them is ever edited in place; a retraction,
a disposition or a decision is recorded as a later event.

## Intelligence

### Who writes it

A unit of the `research` type in the software-development workload writes it. It runs
under the `intelligence` profile, which grants the read tools, `run_checks`,
`report_intelligence`, `report_result`, `ask_human` and `propose_policy_change`, and no
write, edit or shell tool. So a research unit can read the repository and report on it,
and it cannot change the repository. Like every unit, it has a contract, a budget, a
model route and a lease, and S3 dispatches it. Intelligence therefore has a source, a
cost and a boundary.
[`contracts/research-vendored-helper.json`](../../packages/regulator/contracts/research-vendored-helper.json)
is the example: it asks whether `vendor/left-pad.js` is a modified copy and tells the
unit to name `u1` as affected if it is.

`report_intelligence` is a typed tool, and the model supplies these fields:

| Field | Meaning |
| --- | --- |
| `subject` | what the finding is about: a dependency, a platform, an advisory, a behaviour |
| `claim` | the finding, in one or two sentences |
| `observation` | what was read or measured that supports the claim |
| `evidence[]` | at least one reference to the files, versions or dates the claim rests on |
| `confidence` | `low`, `medium` or `high` |
| `reportedSeverity` | `info`, `advisory`, `blocking` or `critical`, as the unit judges it |
| `affectedUnits[]` | the unit ids the finding bears on; empty if none |
| `observedAt`, `expiresAt` | when the environment was observed (defaults to now), and when the finding stops being current, if it does |

The host adds what the model does not choose: the unit id (taken from the lease on the
session's worktree), the revision the evidence was read at, and the time. The signal is
appended to the regulatory log with `source: "S4"` and `destination: "S3"`. The tool
makes no other change. It opens no obligation, touches no unit and moves no policy.
Everything that follows the append is the router's work, described next.

### What happens to it

The router reads every message it has not yet routed and applies the
[routing policy](/reference/definition#routing-policy). The loop runs the router at each
step, before it decides anything about a unit, and `regulator signals route` runs it by
hand. For an intelligence signal, routing goes like this:

1. The router derives the severity. It starts from the reported severity and applies
   the policy's floors, which are tested against the message's subject, observation and
   rationale (the claim is not tested). The shipped policy raises any of those that
   names an invariant (`INV-nnn`) or `regulator/identity/` to at least `blocking`,
   whatever the unit claimed.
2. Below the line, the finding is noted. The shipped rule for `intelligence-signal` is
   `advisory` and above, owed to S3. An `info` finding is recorded with the reason it
   raised nothing, and it stays in the trace.
3. Expired intelligence raises nothing. A finding whose `expiresAt` has passed by the
   time it is routed is noted as expired, so stale evidence cannot open an obligation.
4. One obligation is opened per affected unit. A finding that names `u1` and `u3` opens
   two obligations, so each veto lands on the unit it concerns. A finding that names no
   unit opens one obligation on the research unit itself (the unit id the host stamped
   from its lease), so at `blocking` it holds that unit's own close until someone
   dispositions it.
5. Blocking holds the unit. At or above the policy's `blocksAtOrAbove` line (`blocking`
   in the shipped policy), the obligation vetoes that unit's dispatch and close until it
   is dispositioned. An `advisory` obligation is owed but holds nothing.

A person dispositions an obligation with `regulator obligation resolve <id> --by <who>
--disposition <d> --rationale <text>`. The interaction policy decides whether `<who>`
may resolve that severity, so the same name check applies here as to every other
disposition from the CLI. The dispositions include `no-action`, `accepted-risk`,
`rework`, `replan` and `research-requested`; [obligations](/concepts/obligations) lists
them all. A recovery decision the loop takes on the unit also dispositions the unit's
open S3 obligations. Retry and repair resolve them as `rework`, abort resolves them as
`rejected`, and a waiting action (remediate, replan, clarify, pause, escalate) escalates
them into the `recovery-decision` obligation the unit now waits on.

Intelligence raises an obligation and never replans. The router decides what the
finding means for a unit, and a consumer decides what to do about it. No tool applies
a finding, and none should.

### Reading it

- `regulator obligations` lists what is open, including each intelligence obligation,
  whom it is owed to, and whether it blocks. `regulator obligation show <id>` shows the
  id of the signal it came from and everything that has happened to it since.
- `regulator status` and the control room show the same obligations on the unit they
  hold, along with any signals not yet routed.

## Predictions

An intelligence signal may carry a claim about the future. It is the same signal, on the
same channel, routed by the same router into the same obligation; what it adds is a
`prediction` block that says what the claim stakes and when it will be known whether it
held. The block is optional, and every part inside it is required:

| Field | Meaning |
| --- | --- |
| `metric` | one of the eval harness's built-in metrics (`refusals`, `attempts`, `closed`, …) or a metric a workload declares |
| `baseline` | a committed report's arm, named by the report's fingerprint (the SHA-256 of its file under `evals/reports/`) and the arm whose mean is the baseline value; or an arm by name alone, the arm a probe runs against |
| `direction`, `magnitude` | which way the metric is expected to move from the baseline, and by how much, in the metric's units |
| `probability` | a number in [0, 1]: what the emitter stakes. The signal's three-valued `confidence` stays beside it, as it was |
| `horizons[]` | where the prediction resolves: a `probe` horizon names a report by fingerprint and an arm; a `live` horizon names unit types and a count, the next N units of those types. Each horizon carries `disconfirmedBy`, the grader value that counts against the prediction |

A signal without the block is exactly what it was. A block missing any part, a
probability outside [0, 1] or a metric nobody declared is refused by the schema, so it
never reaches the log.

### How it resolves

A prediction resolves from the stores, never from a unit's report. When a unit a live
horizon names closes or aborts, the loop reads the named metric with the graders the
eval harness uses: the trajectory counts from the unit's own records, the outcome
graders over the instance's tree, a declared grader by the workload's own command. It
compares the value with the baseline and the disconfirming value and appends a
`prediction-resolution` to the regulatory log, one per unit, with the grader's
observation and what it was read from. A probe horizon resolves once, from the committed
report whose fingerprint it names, against the arm's 95% interval.

The resolution is three-valued, and the order matters:

1. **Disconfirmed** when the observed value is at or past `disconfirmedBy`, whatever the
   baseline says.
2. **Confirmed** when the observed value reaches the baseline moved by the magnitude in
   the predicted direction; at a probe horizon, when the arm's whole interval does.
3. **Inconclusive** otherwise, and whenever no baseline value could be read or no grader
   observes the metric here.

Inconclusive is not neutral. It counts against the prediction's precision and never for
the edit the prediction was made about: an effect too small to see at the budget the
probe had is not an effect. A disconfirmed live horizon raises a proposal from S3 to S5
to revert or re-decide the advice, with the prediction's id in its subject, routed under
the routing policy into an obligation like any proposal. Nothing reverts the advice file:
that is an accept path's, after a person decides.

### What bets on it

The first thing that bets on a prediction is a `harness-edit`, a proposal against a
profile's advice whose `requestedChange` is typed: a **diagnosis** (references to
evidence records and signals, with the unit, attempt, revision and trajectory moment they
were read at), a **change** (the diff against one advice file, named by profile) and a
**prediction** (the id of a signal with the block). Three parts, three kinds of record:
the diagnosis is evidence that something happened and nothing more, the change is the
thing asked for, and the prediction is a bet that resolves. The schema refuses a payload
that claims the kind and lacks a part; `advice accept` refuses one whose diagnosis
references do not resolve in the stores or whose prediction names no signal with the
block, takes the target from the payload, cites the prediction's id in the disposition,
and the live horizon is open from that decision. Units of the named types that closed
before the acceptance are not readings: the edit was not in effect.

`regulator status` lists every prediction with its horizons, what bet on it and how that
was decided, each reading's outcome, and a precision that counts inconclusive against.
[Evidence about the regulators](/concepts/evidence-about-the-regulators#pre-registration-one-level-down)
says why this is the eval harness's pre-registration rule applied to one proposal.

## Operational memory

### Who writes it

A unit whose profile grants `remember` writes it. The shipped profiles that do are
`implement` and `bookkeeper`. The model supplies a `subject`, a `note` (the fact,
written so a later unit can act on it), `evidence[]`, a `reviewBy` date and, optionally,
a `scope` of unit types. The host stamps the unit, the revision and the time, and
records `recordedBy: "S1"`.

The store refuses two kinds of entry. It refuses a `reviewBy` in the past, because a
fact that is already stale is not worth recording. And it refuses a `reviewBy` more
than 90 days out, because every entry is meant to come up for review within that
window. A fact that should hold indefinitely is probably a rule, and the path for a rule
is a proposal through `propose_policy_change`.

### What happens to it

At the start of every unit (`before_agent_start`), the session renders the current
entries into the system prompt. A current entry is one that has not expired and has
not been retracted. Each entry is rendered as a fact with its provenance and its
review-by date, under a heading that says facts are not rules and not identity. An
entry with a `scope` is rendered only to units of those types, and an entry without a
scope is rendered to every unit of the instance. A session run by hand with no leased
unit has no unit type, so it sees every current entry, scoped or not.

Memory never opens an obligation or holds a unit, and it never reaches an identity
file (INV-004). Rendering it into the prompt is prompt engineering, the lowest
mechanism level, and that placement is deliberate, because memory is advice. The
mechanism sits in the write path instead: the provenance is stamped, the expiry is
required and bounded, and the store is separate from identity.

### Expiry and retraction

When `reviewBy` passes, the entry is `expired`. The read model still shows it, and no
unit receives it. If a fact turns out to be wrong before then, a person retracts it:

```sh
regulator memory                      # current facts
regulator memory --all                # with expired and retracted ones
regulator memory retract <id> --by <who> --reason <text>
```

A retraction is appended as a later event, and nothing is deleted. The `<who>` must be
a person the interaction policy names. There is no command that renews an entry, so a
fact that is still true after its review date is recorded again by the next unit that
finds it.

## Which one?

| What the unit learned | Where it goes |
| --- | --- |
| The tests are flaky unless `TZ` is set | `remember`, scoped to the unit types that run the tests, reviewed in 30 days |
| The vendored helper is a modified copy, and unit `u1`'s fix depends on it | `report_intelligence`, naming `u1`, with the diff as evidence |
| The upstream API this workload calls is deprecated from March | `report_intelligence`, naming the units that call it, with `expiresAt` set to when the notice stops being news |
| Never edit `vendor/` | neither memory nor intelligence, since it is a rule. It belongs in the boundaries, and a unit proposes it with `propose_policy_change` |
| "GREENGROCER 114 is the weekly groceries shop" | `remember`, scoped to `categorize` and `reconcile`, reviewed in 60 days (the [household ledger](/examples/personal-finance) records this one) |

The test is what the record should do next. A fact that changes nothing about current
work but saves a later unit a turn is memory. A finding that should stop or redirect
work that is under way is intelligence. Something that should be true of every unit,
indefinitely, is identity, and only a person can accept that.

## What is not there yet

The registry records for [intelligence intake and the memory
store](/reference/regulators) state their limitations. The ones a reader is most likely
to run into:

- Only a research unit can report intelligence. A person who knows the statement
  format changes next month has no command to record it, and neither does a watcher on
  an advisory feed. `report_intelligence` is the only intake.
- Nothing re-raises intelligence when it goes stale. An expired finding is noted when
  it is routed. An obligation that is already open stays open after the finding behind
  it expires, and nothing reopens the research question.
- The tool trusts the profile. Nothing in `report_intelligence` checks the unit type.
  The profile grant is what keeps the tool out of an implement unit's session.
- A memory entry is text. Nothing checks that a fact is true or current, or that it is
  about the environment rather than a preference. The expiry limits how long a wrong
  fact lives, and review is a person's job. The scope is whatever the writer claims,
  and an unscoped fact is sent to every unit, so a large store crowds the prompt before
  the 90-day limit retires anything.
- Retraction names a person but does not authenticate one. The `--by` name is checked
  against the interaction policy and not verified further.
- Nothing produces a prediction yet. `report_intelligence` does not take the block, and
  no command records one by hand; a person appends the signal, or the reflector will.
  The probe rule (refusing a `harness-edit` that was never probed) and the probe arm wait
  on the live report; a signal's `confidence` is recorded and never calibrated until the
  instrument record kind exists.

The design notes on a person-raised intake and declared sensors are in the [open
questions](https://github.com/MetaCoding-io/regulator/blob/main/docs/research/2026-09-25-open-questions.md)
(§2); predictions that resolve are §4 there and §8 of the [Harness²
note](https://github.com/MetaCoding-io/regulator/blob/main/docs/research/2026-10-18-harness2-recursive-harnessing.md),
landed as slice 2 of the accept-path split (#138).
