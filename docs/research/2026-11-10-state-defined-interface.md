# A state-defined interface read against "Gates enforce"

- **Status:** open. No issue yet; §4 names four proposals and the order to take them in.
- **Source:** a post by 工业聚 (@guyingjie129,
  [2026-11-09](https://x.com/guyingjie129/status/2119973431819309300)) with two
  infographics, answering a post by @jevonduve: "write your agent harness as a coalgebra on
  a polynomial functor." The same author is the source of the
  [algebraic data types note](2026-11-02-algebraic-data-types.md). This note was written
  from screenshots, which cut off the post's opening lines and showed two of what appear to
  be four images, so it covers the visible part only.
- **Why a note:** the post claims an agent's tool list should be a function of its state,
  and that the harness should enforce the same menu it shows the model. `AGENTS.md`'s prime
  directive already separates the two halves ("Prompts advise. … Gates enforce."). The post
  gives a precise way to ask where what a session is *shown* and what it is *allowed* come
  from one declaration here, and where they are two things that can drift.

Claims about what the code does today cite the file. They were read on `main` at `36cb222`,
for `packages/*/src` without tests.

## 1. What the post says

A fixed tool list is the wrong model for a harness. The current state should reveal a menu
of allowed operations, and each choice should determine the next state. The author calls
this a deeper characterization than the state-machine framing, because the interface itself
changes with the state.

The formal statement is a coalgebra on a polynomial functor:

```
P(X) = Σ_{i ∈ I} X^{A_i}        α : S → P(S)        α(s) = (i, next),  next : A_i → S
```

Here `i` is the current interface and `A_i` is its set of allowed operations. The loop is:
observe the interface, choose an allowed operation, move to the next state. The model holds
both what is available and how each choice changes the state.

The practical claim has two halves: expose only the current capabilities to the LLM, and
enforce the same rules in the harness. The stated payoff is fewer invented actions and
invalid tool calls. The post goes further and says that the more domain knowledge is encoded
this way, the more efficient and correct the agent's work becomes. It offers no measurement
for either.

The infographic's task-policy example is Explore (Search, Read), then Implement (Edit, Run),
then Verify (Test, Inspect). It names three existing mechanisms that already work this way:

| Mechanism | What it constrains | The post's example |
| --- | --- | --- |
| HATEOAS | the next available calls, carried as links in each response | a shipped order links to view order, track shipment and get receipt |
| GraphQL union branches | what can be observed, by the type of the result | a `Document` that is `Draft`, `Review`, `Ready` or `Published` exposes different fields per branch |
| Codata method chains | which transitions compose, by type | `draft.submit().publish()` is rejected because `Review` has no `publish()` |

The post keeps the last two apart: GraphQL constrains parameterized observations and does
not change state, while codata interfaces constrain typed transitions.

## 2. Where the build already has this shape

- **The unit lifecycle is the post's coalgebra, at the loop's level.** `UNIT_TRANSITIONS`
  (`protocol/src/execution.ts:54`) is a closed table of twelve rows, and
  `unitTransition(from, on)` reads it as "from this status, this trigger leads there". The
  status is the state, the triggers out of it are the menu, and the row is the
  continuation. [#162](https://github.com/MetaCoding-io/regulator/issues/162) moves a write
  from status to trigger, which is the codata reading: a `reported` unit has no
  `dispatch`.
- **The menu is indexed by unit type.** A unit type names its profile
  (`UnitTypeSchema.profile`, `protocol/src/workload.ts`), and the profile's `tools` become
  the session's surface through `pi.setActiveTools` (`regulator-pi/src/profiles.ts:139`).
  The post's Explore → Implement → Verify policy is, here, a research unit under a
  read-only profile, an implementing unit, and the host's checks at closeout. The phase
  boundary is a unit boundary, and the transition between phases belongs to the loop
  rather than to the model.
- **Show and enforce share a source for the profile grant.** The same profile produces the
  tool surface (level 3), the write refusal (level 2, `profiles.ts:116`) and the section
  the model reads (`renderProfileSection`, `core/src/profiles.ts:54`), which says where
  writes are refused and which calls need consent.
- **Several refusals already name the next valid move.** The budget gate ends with "Call
  report_result if you can, otherwise stop" (`regulator-pi/src/budget.ts:174`). The pause
  gate says the same (`algedonic.ts:119`). The consent gate appends the decision's
  `instruction` (`authority.ts:200`), the lease gate names the command that starts the unit
  (`coordination.ts:110`), and the write gate names `vsm_propose_policy_change` for a
  protected path (`write-gate.ts`). This is HATEOAS in prose.

## 3. Where it stops short

### 3.1 Inside a session, the menu doesn't move with the state

The surface is set when a profile is applied, and once more when a contract loads to add
`report_result` (`regulator-pi/src/contract.ts:70`). Those are the only two
`setActiveTools` calls in the host. Session state changes after that — the budget runs
out, the unit pauses on an unanswered question, the lease lapses — and each change is held
by a `tool_call` gate that refuses. The tools the gate now refuses are still listed. The
budget gate, for example, refuses every tool whose effect is not read-only, by
`isReadOnlyEffect` (`core/src/effects.ts:68`), while the model still sees `write`, `edit`
and `bash`.

The enforcement is correct, and it's the half that matters. What's missing is the post's
first half for these states: after the ceiling, the session is shown a menu that is mostly
refusals, and learns its real menu one refused call at a time.

### 3.2 The next valid move is prose written at each site

Seven files in `regulator-pi/src` return `block: true`, and each composes its own reason
string. Pi's `ToolCallEventResult` carries only `block` and `reason`, so the model
can only be told in text. But nothing on this side of the seam is typed either: there is no
table from a gate to the tools that remain valid after it refuses, so the advice in the
message and the behaviour of the gate are kept in step by hand.

### 3.3 A refused call leaves no record

`ToolCallRecord` has `blocked` and `reason` fields (`protocol/src/trace.ts:30`), and
`TurnTracker.toolBlocked` writes them (`core/src/trace.ts:33`). No package constructs a
`TurnTracker` outside `core`'s own test, so no session records a refused call this way.
Nearby events are recorded by other routes: a bash command that changed a protected path
is undone and raises an audit finding (`authority.ts:244`), and the thrash detector raises
a signal on repeated edits to one file (`coordination.ts:178`). Neither is a refused call.
The budget, pause, lease, write-gate and profile-path refusals return text and nothing
else. The consent gate keeps a record of asks and answers, and its refusals were not traced
for this note.

The built-in `refusals` metric counts attempts that ended `check-failure` or
`invalid-report` (`regulator/src/graders.ts:120`). It is a count of refused closeouts and
says nothing about refused tool calls.

This matters for the post's claim. "Fewer invalid tool calls" is its payoff, and the build
can't currently say how many it has.

### 3.4 Menu edits are not a typed kind of change

A change to a profile's `tools` is a definition change that lands through an accept path
and is checked by `regulator check`. A `harness-edit` (`HarnessEditSchema`,
`protocol/src/prediction.ts`) carries diagnosis references and a diff by profile over the
advice files. There is no typed proposal that says "remove this tool from this profile" or
"add this unit type", so the reflector, when it exists, can propose a change to what a unit
is told but not to what a unit may reach.

## 4. Proposals

In the order to take them. Each is stated at a
[mechanism level](../ARCHITECTURE.md#mechanism-hierarchy) and against an existing seam.

### 4.1 Record refused calls, and count them

Wire the tracker (or a smaller recorder) into the Pi host so every `block: true` writes a
record with the gate's name beside the reason, and add a built-in trajectory metric for
refused tool calls, per gate. Level 2 for the record; the metric joins `EVAL_METRICS`
(`protocol/src/evals.ts:48`) with its grader.

This goes first because it's the instrument the other three are judged by. It also gives
the drift suite a number for the post's claim: refused calls per attempt, by arm.

A second step, once the count exists: a signal when one gate refuses the same session N
times in an attempt, on the thrash detector's pattern. A session that keeps reaching for a
refused tool has a picture of its situation that differs from the definition's, and that is
a coordination signal to S3, not an audit finding.

### 4.2 One table from gate to remaining moves

A `Record<GateName, …>` in `protocol` naming, for each session gate, the tools that remain
valid after it refuses. Each `block` site renders its "what you can do now" sentence from
the table instead of composing it. Level 1 for the table (the compiler refuses a new gate
without a row, the pattern `CONTINUES_WITHOUT_ANSWER` already uses); the message stays
level 5.

This is the HATEOAS half. It changes no behaviour, and it makes §4.3 a small step.

### 4.3 Narrow the surface when a session gate closes

When the budget is exhausted or the unit pauses, call `setActiveTools` with the row from
§4.2's table, so the model is shown the menu the gate will enforce. Level 3, on top of the
level 2 gate, which stays: the surface is advice to the model about what exists, and the
gate is what holds when the model is wrong.

Two things to settle before an issue:

- **Cache cost.** Changing the tool list mid-session rewrites a part of the prompt that is
  otherwise stable. The
  [minimal-harness note](2026-11-05-minimal-harness-and-terminal-bench.md) proposes cache
  writes in the ledger; this change should be measured against that, and only made for
  states that are terminal for the attempt (budget, pause), where the session has few turns
  left to pay for.
- **Whether it helps.** §4.1's count is the test. If refused calls after a ceiling are
  already near zero because the refusal text works, this is not worth a card.

### 4.4 Menu edits as a typed proposal

Extend the typed proposal path so a requested change can name a grant edit: a tool added to
or removed from a profile, or a unit type added. `regulator check` already validates the
result, and the accept path already separates who may write a grant from who may write
advice (`DEFINITION_WRITERS`). Level 3.

This is the second-order half, and it waits for the reflector. §4.1's per-gate counts are
the evidence such a proposal would cite: a gate that refuses often in one unit type is
either absorbing a real failure or marking a menu that is wrong for the work.

## 5. What the post's framing doesn't change

- **No phase machine inside a unit.** The infographic draws Explore → Implement → Verify as
  states of one agent with a changing tool list. Here that boundary is the unit boundary,
  with a contract and a closeout on each side, and the loop takes the transition. A second
  lifecycle inside the session would be a state the orchestrator doesn't own, which the
  first architectural boundary in `AGENTS.md` rules out.
- **The gate stays under every narrowed surface.** A tool the model can't see can still be
  called by name, and a surface is set by the host through an API that may change. The
  post's "enforce the same rules in the harness" is the half this build already treats as
  primary.
- **It only covers what can be enumerated.** A state-defined menu works where the states
  are known in advance. Open-ended work produces situations nobody declared, and those are
  what signals, findings and the algedonic path are for. The menu attenuates variety before
  the choice; the regulators absorb what is left after it.
- **The category theory is vocabulary.** A table of state → operation → next state carries
  the content, and `UNIT_TRANSITIONS` already is one. Polynomial functors do give a
  language for composing such tables across levels, which may be useful to Paper 1's formal
  model; that is the one place the formalism could earn more than its name.

## 6. For the course and Paper 1

- **Conant and Ashby.** "Every good regulator of a system must be a model of that system."
  The coalgebra is that model written down, and it doubles as the control surface. A lesson
  on the unit lifecycle can say so in one paragraph.
- **Bateson's learning levels.** Choosing from the menu is Learning I. Changing the menu is
  Learning II. §4.4 is the mechanism that would make the second one a typed, accepted,
  recorded act, which is the subject of "Who regulates the regulator".
- **Paper 1.** A regulator on a regulator, in the post's terms, is a higher coalgebra whose
  state is the lower one's interface and whose operations are edits to it. That reading is
  this note's, not the post's. If the formal model
  ([#103](https://github.com/MetaCoding-io/regulator/issues/103)) wants a compact notation
  for two levels, this is a candidate to compare with Exo's state-and-replacement contracts.

## 7. Further reading

- Nelson Niu and David Spivak, *Polynomial Functors: A Mathematical Theory of Interaction*.
  The source of the formalism, including mode-dependent interfaces and how dynamical
  systems wire together.
- Roy Fielding's dissertation, chapter 5, for hypermedia as the engine of application
  state: the original statement that a response should carry its own next moves.
- Roger Conant and W. Ross Ashby, "Every good regulator of a system must be a model of that
  system" (1970).
