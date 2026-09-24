# Lesson 11 — Environmental intelligence and the obligation lifecycle

**Part 5 · S4, S5 & the algedonic channel** · ~60 min instruction · ~110 min lab · builds **checkpoint 10**

> The repository is not the world. How does the system learn about its dependencies,
> its platform, its own runtime — and how does that knowledge get a say without
> becoming the decision?

Ten lessons have built a loop that faces *inside and now*: the contract, the worktree,
the tests, the verdict, the retry. Nothing in it looks outward. A dependency advisory,
a platform deprecation, a service that changed its answer last Tuesday — the loop can
only find those out by accident, in a failing test, after the fact. Beer's S4 is the
function that faces *outside and then*, and his most useful structural claim about it is
that S3 and S4 pull against each other by design: the sprint commitment and the advisory
are supposed to disagree, and something above both has to arbitrate. This lesson builds
the mechanism for that arbitration. It also pays a debt every lesson since 08 has been
carrying: a recovery decision the loop could not apply, a proposal, an escalation — each
was recorded in a file, and nobody was named as owing a response.

**Prerequisites.** Checkpoint 9 passing. A model configured for `pi`.

---

## 1. The question

Two questions, one mechanism. First: when a research finding arrives — *the vendored
helper is a modified copy; the fix you are about to ship depends on the modification* —
what happens? Three bad answers are common. The finding is applied: a prompt says "act on
what research tells you" and a stale advisory rewrites working code. The finding is
ignored: it lands in a log and the unit is dispatched anyway, because nothing stood in
the loop's path. Or whichever arrived last wins. The good answer is that the finding is
*intelligence*: typed, provenanced, weighed under policy, and — when it matters enough —
able to hold a unit until someone with the authority decides. Never to move it.

Second: what is the difference between a message and an obligation? Lesson 08's router
wrote a decision — `clarify`, with a question — and the unit stopped. Lesson 10's
proposal tool wrote a `policy-proposal` and the unit continued. The recovery card and the
proposal card both said the same thing in their limitations: *nothing reminds anyone*.
That is the difference. A message records that something happened. An **obligation**
records that the metasystem has not yet shown it absorbed the thing — and names who owes
the showing.

## 2. Concept

### Intelligence is not authority

A research finding is an input to a decision, not the decision. regulator's channel
vocabulary has said so since lesson 02: the `intelligence` channel carries S4 → S3 advice,
and `channelCanMutateS5` returns `false` for every channel. What this lesson adds is the
mechanism that makes the sentence true under pressure. Intelligence is produced by a
**research unit** — a real unit, dispatched by S3 under its own contract, budget, model
route and profile — through one typed tool, `report_intelligence`, whose provenance (which
unit, which revision, when) the harness stamps and the model cannot supply. The finding
carries a claim, the observation behind it, evidence refs, a confidence, an `observedAt`,
an optional expiry, and the units it bears on. It carries a *reported* severity. What the
router acts on is the *effective* severity it derives under policy.

Recursion is why the research unit is a unit and not a prompt. A subagent is a recursive
S1 with its own miniature S1–S5, which is why it needs its own contract, budget, tool
surface and result schema. Give it those and it is a unit; give it a persona and it is a
paragraph. Multi-agent work is not free, and the module's decision rule is worth writing
down: spawn a second agent only when parallel exploration materially reduces wall-clock,
context isolation improves signal-to-noise, separation of duty requires it, a distinct
trust or tool boundary requires it, or a specialized model changes the economics.
Research qualifies on the last three — read-only surface, S4's separation from S3, a
cheaper route — and on nothing else.

### Events are not obligations

The design record for this — [`REGULATORY-STATE-AND-ROUTING.md`](../../docs/archive/2026-09/REGULATORY-STATE-AND-ROUTING.md),
now archived — has been in the repository since before the course. Its lifecycle is deliberately
small:

```text
open → acknowledged → resolved | escalated | superseded
```

No `in-progress`: the orchestrator owns work-in-progress, and an obligation is not a
task. *Acknowledged* means received by a consumer authorized to handle it — not agreed
with, not correct. *Resolved* carries a disposition and a rationale; the dispositions
(`rework`, `accepted-risk`, `fixed`, `rejected`, `research-requested`, …) are a separate
vocabulary from the states, because every outcome is not a state. *Escalated* is valid
only with a successor: "someone else should probably look at this" is not an escalation.
*Superseded* likewise names what replaced it. And terminal records never reopen in
place; later evidence opens a successor that cites the predecessor. State is the fold of
appended events, so an obligation's history is its record.

### Routing is policy

Which messages become obligations, for whom, and which open obligations veto a unit's
progression is declared in a versioned **routing policy**, not decided by the emitting
model and not coded into the loop. One rule per message kind: at or above this severity,
an obligation for this consumer (S3, S5, or a person); below it, the message is *noted* —
a routing event that cites it, with the reason, so nothing is silently dropped and
nothing is left unrouted. An uncertainty's reported impact is mapped through the policy
to an effective severity, because the model's estimate of its own risk is a claim. And
the policy draws the line at which an open obligation naming a unit holds that unit.

### The homeostat, mechanised

Now the two questions meet. Intelligence above the policy's line, naming a unit, opens an
obligation on that unit that *blocks*. The loop's dispatch and close steps check for open
blocking obligations and refuse. The unit waits — not on the model's judgement, not on
the last signal to arrive, but on a disposition by the consumer the policy named, made
outside the loop and recorded with a rationale. Then it proceeds, and if the disposition
was an answer to a question, the answer reaches the next attempt as the hint. S3's own
recovery decision is treated the same way: retry, repair and abort *resolve* what S3 was
routed for the unit, with the decision as the rationale; a waiting action (remediate,
replan, clarify, pause, escalate) opens the obligation the unit now waits on and
escalates the S3 ones to it. Nothing in the loop performs an obligation. The loop reads
dispositions; people and functions make them.

### Which level this is

Prompts advise, types describe, gates enforce. The obligation vocabulary and the routing
policy are types with runtime schemas (level 1 and 3). The router and the veto are
deterministic (level 2). `report_intelligence` is a typed tool (level 3) whose
description says it changes nothing — and the reason that sentence can be trusted is that
there is no tool that changes anything: no `apply_intelligence`, no `resolve_obligation`.
The absence is the mechanism.

## 3. Mechanism

### One log, two kinds of line

`.regulator/signals.ndjson` has held typed messages since lesson 05. It now also holds
the events that say what became of each one — `obligation-opened`, `-acknowledged`,
`-resolved`, `-escalated`, `-superseded`, `message-noted` — validated on write and read
against `RegulatoryEntrySchema`. The ledger folds them; "unrouted" is a derived property
(no event cites the message), not a flag. Lesson 09's audit log stays its own file; the
two are still not the SQLite store the reporting tools write, and `docs/DEBT.md` row 1
says where that goes.

### The research unit through the existing loop

Nothing in `controller.ts` knows a research unit is special, and that is the point. The
workload declares a `research` unit type under the `intelligence` profile with no
host-run checks; the policy gives it a smaller budget on a cheaper route; its contract
expects `file`-class evidence, so the closeout gate verifies the files the finding cites
exist at the committed revision. It calls `report_intelligence` for the finding and
`report_result` to close the contract, like any unit. The profile is what puts the tool
in its surface: `implement` does not list it.

### Where routing runs

The loop routes the log at its own steps: after the session returns (what the session's
extensions recorded — proposals, canary findings, oscillation), after the audit (the
closeout finding), after the report's signals at close, and in `routeUnit` before and
after the recovery decision. `regulator signals route` does the same for a session run by
hand. Nothing watches the file; the card says so.

### Pi surfaces this lesson touches

The curriculum names `subagent`, `plan-mode`, `dynamic-resources`, `handoff.ts`,
`github-issue-autocomplete.ts`, RPC and JSON event-stream modes. Read the subagent
example for its *security model* section — project-local agents are repo-controlled
prompts, and the example refuses them by default — and notice that it spawns a separate
`pi` process per agent with a delegated tool and model configuration: a recursive S1.
Read `plan-mode` for the read-only bash allowlist and the disabled write tools, which is
lesson 04's profile idea done inside one session. Neither ships in this checkpoint: the
orchestrator already dispatches sessions with their own tool surface and budget, and a
research unit is that dispatch under a different unit type. RPC mode is how a non-Node
consumer would drive the same loop; lesson 15's.

## 4. Build: checkpoint 10

### The vocabulary — [`packages/protocol/src/obligations.ts`](../../packages/protocol/src/obligations.ts)

`ObligationSchema` (id, subject, unit, concern, sources, effective severity, consumer,
blocks, question, opened at/by), the five states, the disposition vocabulary, the six
event shapes, `RoutingPolicySchema` (rules by message kind with a minimum severity and a
consumer; the impact map; who a unit waits on per recovery action; the blocking line), and
`RegulatoryEntrySchema` — a message or an event. `IntelligenceSignalSchema` gains the
structured fields: `claim`, `confidence`, `observedAt`, `affectedUnits`. `severity.ts`
holds the order.

### The ledger and the router — [`packages/core/src/obligations.ts`](../../packages/core/src/obligations.ts)

`ObligationLedger` over the log: `obligations()` folds, `open(unitId?)`, `unrouted()`, and
the transitions — each an appended event, each refused on a terminal record.
`routeMessages(ledger, { policy })`: every unrouted message becomes an obligation or a
note; expired intelligence is noted; intelligence with affected units opens one
obligation per unit. `progressionVeto(ledger, unitId)`: the open blocking ones.
`dispositionByDecision`: S3's decision applied to S3's obligations. Four tests.

### The loop — [`packages/regulator/src/controller.ts`](../../packages/regulator/src/controller.ts)

`runUnit` and `closeUnit` take the routing policy, route at their steps, and refuse on
the veto with one problem per open blocking obligation. `routeUnit` routes before it
decides and dispositions after. A re-dispatch after a person resolved a
`recovery-decision` obligation carries the resolution as the hint. Every emergent
decision, deviation and residual uncertainty in a report now becomes a signal; the
policy decides which are obligations.

### The extension — [`packages/regulator-pi/src/intelligence.ts`](../../packages/regulator-pi/src/intelligence.ts)

One tool. `report_intelligence` takes the finding, stamps unit (from the lease), revision
(from the tree) and time, records the signal, appends a session entry, and tells the
model that nothing has been applied. The test asserts the registered tool set is exactly
that one name.

### The definition — [`packages/regulator/policies/routing.json`](../../packages/regulator/policies/routing.json), the workload, the profile

`routing` v1: algedonic and proposals always open (a person, S5); findings, operational
and uncertainty signals at blocking; coordination and intelligence at advisory; the veto
at blocking; clarify, pause and escalate wait on a person, remediate and replan on S3.
`software-development` v1 gains `research`; `default` v1 gives it a budget and a route;
`profiles.ts` gains `intelligence`, honest that it is not read-only by effect because two
tools write — to the instance, never the repository. The read model recognizes all three
policy shapes now, so `recovery.json` stops showing as a problem.

### The CLI and the read model

`regulator obligations`, `obligation show|ack|resolve|escalate`, `signals route`; `unit
show` lists what is owed on the unit; a refused dispatch prints the obligation. `regulator
status` shows obligations (open, by consumer, with the veto marked) and the recovery and
routing policies; the control room gains the obligations table per instance, the two
policies in the definition, and an obligations section in the unit inspector. Still
read-only: the page has no resolve button, by the rule the archived `CONTROL-REGISTRY.md` §6 set.

### Registry cards

`obligation-router` (S3), `progression-veto` (S3) and `intelligence-intake` (S4,
typed-tool); `recovery-router`, `proposal-intake`, `result-report-gate` and
`closeout-gate` updated. Twenty-three records. `docs/DEBT.md` strikes rows 5, 12 and 16
and narrows rows 1 and 14; read the three new cards' limitations before the drills.

## 5. Break it

Five drills. Use the known-issue fixture and the research contract
[`contracts/research-vendored-helper.json`](../../packages/regulator/contracts/research-vendored-helper.json).

**Drill 1 — auto-apply, then don't.** Before anything else, run the failure the module
is about. Take a copy of `intelligence.ts` and make `report_intelligence` do what a
helpful tool would: when `affectedUnits` names a unit whose worktree exists, write the
claim into that worktree's `NOTES.md` and commit. Dispatch the research contract, then
the known-issue contract, and read the merged history. Then put the checkpoint back and
repeat: `regulator unit dispatch contracts/research-vendored-helper.json`, then
`regulator unit dispatch contracts/fix-known-issue.json`. The second is refused —
*obligation … (S3, blocking, intelligence-signal) is open on unit "u1"* — and
`regulator obligations` shows who it is owed to. Resolve it as `accepted-risk` with a
rationale and dispatch again. Write down which of the two runs you could explain to a
reviewer six months later, and from which file.

**Drill 2 — the stale advisory.** Edit the research contract's objective to ask for an
`expiresAt` in the past ("this finding is current until 2020"), or record the signal by
hand with `appendSignal`. Route. The message is noted — *intelligence expired at …; stale
evidence cannot raise an obligation* — and the unit is not held. Then argue with the
policy: should stale intelligence about an *active* unit open a refresh obligation for
S4 instead? The design record says yes; the card says nothing does it yet; decide what
your routing policy v2 would say, and where it would need a field the schema lacks.

**Drill 3 — the clarify that reaches the next attempt.** Drive the known-issue contract
against the oscillation fixture with checkpoints 2–10 (`unit drive`). The thrash
detector signals, the router says `clarify`, and now `regulator obligations` shows an
obligation owed to a person with the question. `unit dispatch` the same contract: refused
by the veto. `obligation resolve <id> --by you --disposition fixed --rationale
"underscores are preserved; the second test is wrong"` and dispatch again: the model's
first turn opens with your rationale as the orchestrator's hint. Then look at the log:
the coordination signal's S3 obligation is `escalated` with the wait as its successor,
and the wait is `resolved` by you. Two records, one story.

**Drill 4 — the line.** Set `blocksAtOrAbove` to `advisory` in a copy of the routing
policy and dispatch with `--routing`. Every advisory oscillation signal now holds its
unit; every advisory intelligence finding vetoes. Then set it to `critical` and watch a
blocking closeout finding stop holding anything — the unit is still blocked, by the
attempt record, but the obligation no longer vetoes and a person could dispatch around
it. Neither is wrong. The point is that the line is a declared, versioned number and the
obligation cites the version that opened it.

**Drill 5 — the proposal nobody read, now read.** Repeat lesson 10's drill 5. The
proposal is an obligation owed to S5, not blocking, and `regulator status` says so
under *obligations* rather than *unrouted signals*. Resolve it as `rejected` with a
rationale as S5. Then the harder question, which is row 21: what would *accepting* it
mean, mechanically? The identity file is write-protected and the proposal channel cannot
mutate S5. Lesson 12 builds the S5 workflow; until then, accepting a proposal is a
person editing identity under their own authority and citing the obligation id in the
commit.

## 6. Field study: two routers and one homeostat

**regulator.** [`REGULATORY-STATE-AND-ROUTING.md`](../../docs/archive/2026-09/REGULATORY-STATE-AND-ROUTING.md)
§§1–8 against this checkpoint. Three things to check. The lifecycle shipped as written,
including "no in-progress state" and "escalated only with a successor". The routing table
in §8 has more columns than `routing.json` — required *mechanism*, exposure and
resolution *boundaries*, scope and visibility — and the checkpoint has consumer,
severity and one veto. For your notes: which of the missing columns would have changed a
decision in drills 1–5, and which are bureaucracy until a second workload exists? Then
§8's child-obligation pattern (O31 → O32 research → I18 intelligence → O31 resolved):
trace it through this checkpoint's records using `research-requested` as the disposition
and the research unit as the child, and name the link the schema does not yet hold.

**GSD-Pi.** Its research milestones and subagent phase: research is prompt-injected —
a phase in a workflow prompt tells the model to investigate and summarize — not
framework-dispatched. Compare with a research unit here: what does GSD-Pi's approach
save, and what does it lose when the summary is wrong? The `intelligence` channel's S3/S5
destinations exist because a finding about the environment can be operational (S3) or
about identity (S5); GSD-Pi has no such distinction. Where would its research land if it
found that the project's stated architecture no longer matched its dependencies?

**Pi.** `examples/extensions/subagent/` at `v0.87.0`: `index.ts` for the process
boundary and the `agentScope` rule; `agents/scout.md` for what a read-only specialist's
prompt says when the tool surface, not the prompt, is what keeps it read-only. And
`plan-mode/index.ts` for the bash allowlist. For your notes: the subagent example tracks
turns, tokens and cost per agent and shows them — what does it *do* when a subagent
exceeds them, and what does checkpoint 6 do?

## 7. Checkpoint

You have finished checkpoint 10 when:

1. `pnpm check` passes — including `obligations.test.ts` in core (routing under policy
   with noting and idempotence, the lifecycle with terminal refusals and successors,
   intelligence with expiry and affected units, dispositions by decision),
   `intelligence.test.ts` (provenance from the lease and the tree; the one-tool
   surface; refusal outside a known repository), the two new controller tests (the
   obligation flow through the loop with the veto and the hint; the research unit whose
   intelligence holds another unit until dispositioned and never touches the domain),
   the read-model and control-room tests with obligations, and the registry tests with
   twenty-three records.
2. Drill 1 is recorded both ways, with the file you would show a reviewer named.
3. Drill 3's log shows the escalation with its successor and the resolution with its
   rationale, and the next attempt's hint quotes the rationale.
4. `regulator obligations` on your instance shows nothing unrouted after every drill.
5. `docs/DEBT.md` has the rows this lesson pays struck and the rows it opens added.
6. Your notes hold drills 1–5 and the field-study answers.

## Further reading

- Pi docs at `v0.87.0`: `extensions.md` on `registerTool` and `appendEntry`; `sdk.md` on
  driving sessions programmatically; `rpc.md` and `json.md` for non-Node consumers.
- Upstream examples: `subagent/`, `plan-mode/`, `dynamic-resources/`, `handoff.ts`,
  `file-trigger.ts`, `github-issue-autocomplete.ts`.
- Stafford Beer, *The Heart of Enterprise*, on the S3–S4 homeostat and why S5 must
  arbitrate it rather than either side winning by default.
- This repository's [`REGULATORY-STATE-AND-ROUTING.md`](../../docs/archive/2026-09/REGULATORY-STATE-AND-ROUTING.md)
  and [`docs/DEBT.md`](../../docs/DEBT.md).
