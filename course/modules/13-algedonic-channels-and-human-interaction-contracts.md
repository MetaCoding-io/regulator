# Lesson 13 — Algedonic channels and human interaction contracts

**Part 5 · S4, S5 & the algedonic channel** · ~60 min instruction · ~120 min lab · builds **checkpoint 12**

> Normal regulation is not working and the loop cannot close. Who gets interrupted, how fast, and what counts as an answer?

Lesson 11 gave every consequential signal somewhere to go: an obligation, owed to a
consumer, open until dispositioned. Lesson 12 made the person who dispositions it a
named authority. Between them the build has carried its largest single piece of debt
for two lessons: an obligation owed to a person was *visible* — in the read model, in the
control room — and delivered to nobody. Nothing told anyone. Nothing reminded anyone. A
unit that needed a yes had no way to ask for one, and a person who answered was trusted
by the name they typed. This lesson pays that row with the last channel Beer's model
names: the algedonic signal, from the unit straight to the person, bypassing the loop —
and it makes the one rule that matters about that channel a gate rather than a sentence.

**Prerequisites.** Checkpoint 11 passing. A model configured for `pi`.

---

## 1. The question

Two design failures bracket the problem. The agent that never escalates grinds to a
wrong answer: it force-pushes because the prompt said to use judgment, it drops the
table because nobody was there to say no, and the transcript shows it *considered*
asking. The agent that asks about everything destroys its own value: five interrupts per
attempt, each one a demand on the scarcest resource in the whole system, until the
person stops reading and answers yes to make it stop. Both are the same failure — the
absence of a contract about what a question *is* — and both are usually addressed with
prompt text, which is to say not addressed.

The contract has three parts. What kinds of question exist, and for each: does work
wait, and what does no answer mean. How many questions an attempt may spend, because
attention is a budget like tokens are. And who may answer, at what severity, because a
disposition by anyone is a record with a hole in it. The first part is fixed by the
protocol and no policy can relax it. The second and third are declared, checked, and
enforced before anything is written.

## 2. Concept

### A recap is not consent

GSD-Pi's interaction vocabulary makes the distinction explicit and the lab keeps it:
a **recap** offers decisions and assumptions for correction while reversible work
continues, and does not wait; a **choice** and a **clarification** wait for an answer;
**consent** is explicit authorization for an irreversible, public, paid, destructive or
account-level action, and nothing but a yes is a yes; **uat** is subjective acceptance of
something no check can observe, and waits. A recap should be the default — it is the
attention-management device, the way a unit says what it decided without demanding
anything — and consent should be rare, because the things that cannot be undone are.

### Silence is never consent, and no policy can say otherwise

The rule is a value the type system holds: `CONTINUES_WITHOUT_ANSWER` maps each kind to
whether the unit goes on without an answer, and only `recap` is true. The interaction
policy declares *how long* to wait per kind, how many blocking questions an attempt may
ask, when to remind, and who may answer. It has no field that could make a timeout a
yes, and `ask_human` reads the constant, not the policy. When a dialog times out, is
cancelled, or has nobody to show it to, the outcome is recorded as exactly that —
`timed-out`, `cancelled`, `unavailable` — the obligation stays open, and for every kind
but recap the unit is paused. Pi's `confirm` returns `false` for no, cancel and timeout
alike; the lab never distinguishes a false into a yes.

### Paused is a gate, twice

"Work waits" is not a sentence in the tool's description. In the session, once a
blocking question went unanswered, the `tool_call` gate refuses every tool whose declared
effect is not read-only, except `report_result`, and `agent_before_settle` records the
pause and ends the turn. The model can still read and still report; it cannot act. In
the loop, an open blocking interaction obligation on the unit after the session records
the attempt as `paused`, holds the unit as blocked awaiting a person, and the recovery
router says nothing about it: no retry, no repair, no attempt spent. Re-dispatch is
refused through the progression veto lesson 11 built, until a person answers; the answer
reaches the next attempt as its hint. The wrong design — timeout, then proceed — costs an
unauthorized irreversible action. The right one costs time.

### Attention is the scarcest budget

Lesson 07 metered tokens, turns and wall-clock. This lesson meters interrupts: the policy
says how many blocking questions an attempt may ask, and the tool refuses past the cap
with the two things the unit can do instead — record the decision as residual
uncertainty in its report, or offer it as a recap. A recap is never counted. The cap is
per attempt, like every other budget, and starts over with the next session; what is
owed stays owed.

### Delivery is not disposition

An obligation owed to a person is now written to the owner's outbox — the same file
`notify_owner` used in lesson 08, an effect that cannot be unsent — through the effect
journal, under an idempotency key, once, at every step of the loop and on
`regulator signals route`; the delivery is recorded on the obligation, with the channel.
A reminder is a second delivery after the policy's interval, marked as one.
`regulator remind` runs it. None of this closes anything: the obligation is open until a
person dispositions it, and the read model shows what was delivered, where, and how many
times.

### Who may answer

The interaction policy names people with three grants: the highest severity they may
disposition, whether they may resolve as `accepted-risk`, whether they may act as S5.
Every `--by` on the CLI — `answer`, `obligation ack|resolve|escalate`, `memory retract`,
`unit accept`, `identity accept|reject` — is checked before anything is written: a name
not listed may disposition nothing; a listed person is refused above their severity, for
a risk they may not accept, for an S5 decision they may not make. The name is asserted,
not authenticated, and the card says so; what changed is that the record no longer has
the hole. `answer` additionally refuses an option the question did not offer, and turns a
consent answer into `accepted` or `rejected` by the protocol's rule, never by the
person's wording: *yes but only on staging* is a no.

### Which level this is

The kinds and the rule are level 1: a type and a constant. The pause is level 2 in the
session (`tool_call`) and level 2 in the loop (an attempt outcome and the veto). The
question itself is level 3: one typed tool, with a schema that makes consent name its
action and choice list its options. The policy — timeouts, attention, reminder, people —
is level 3, checked by `regulator check`. What remains at level 5 is the judgment of
*when* to ask: the profile's advice says consent before the irreversible and a recap
otherwise, and the card is honest that nothing derives "this needs consent" from a
tool's effects yet.

## 3. Mechanism

### `ctx.hasUI` and `ctx.mode` — is anyone there?

The dispatcher's sessions are headless: `hasUI` is false and no dialog can be shown. A
session a person runs with `pi -e` has a TUI; one driven over RPC has a client that can
render a question. `ask_human` reads both to decide whether to ask and what channel to
record — `tui`, `rpc`, or `none` — and the request carries the channel as provenance.
A question that could not be shown is not a question that was declined.

### `ctx.ui.confirm`, `select`, `input` with `{ timeout }`

Pi's dialogs take a timeout in milliseconds and resolve as if dismissed when it passes.
The lab passes the policy's timeout for the kind: consent through `confirm`, choice
through `select` with the options, everything else through `input`. A thrown dialog is
`cancelled`. The dialog's title names the kind and the unit, its body carries the
question, the action a yes would authorize, and the evidence references, so the person
decides from what the unit saw.

### `tool_call` as the pause

The same hook lessons 04 and 10 used for grants and protected paths refuses tools by
their declared effect once `paused` is set. `TOOL_EFFECTS` is the table; a tool it does
not know is refused, which is the safe direction. The refusal names the question and the
obligation, and tells the model the one thing it may still do.

### `agent_before_settle` with `continue: false`

A paused session ends its turn with a `regulator:paused` entry in the transcript and no
further model call. The record does not depend on the model calling anything, and the
orchestrator reads the obligation, not the transcript, to know the unit is paused.

### The outbox through the effect journal

`deliverPending` and `remindDue` reuse lesson 08's journal: `begin` under
`deliver:<obligation>:<n>`, append the line, `commit`, then `ledger.deliver`. A crash
between the append and the commit is reconciled on restart like any other effect; a
delivery is never made twice for the same key.

### `checkDispositionAuthority`

A pure function in core: policy, name, and what is being asked — severity, disposition,
S5 — to either nothing or the reason. The CLI calls it before every write. A test can call
it with a policy literal, which is how the rules are tested without a repository.

## 4. Build: checkpoint 12

### The vocabulary — [`packages/protocol/src/interaction.ts`](../../packages/protocol/src/interaction.ts)

Interaction kinds and `CONTINUES_WITHOUT_ANSWER`; the request (kind, subject, question,
options, action, severity, unit, attempt, obligation, evidence, provenance, timeout,
channel); the two events, `interaction-requested` and `interaction-answered` with an
outcome; the person and the interaction policy. `obligations.ts` gains the `interaction`
concern, the `accepted` disposition and the `obligation-delivered` event; `execution.ts`
gains the `paused` attempt outcome. The regulatory log's entry type is now a message, a
routing event, or an interaction event.

### The rules — [`packages/core/src/interaction.ts`](../../packages/core/src/interaction.ts)

`continuesWithoutAnswer`, `severityForKind`, `dispositionForAnswer`,
`checkDispositionAuthority`, `remindable`, `undelivered`. The ledger gains `deliver`,
`requestInteraction`, `answerInteraction` and `interactions`, and folds deliveries onto
the obligation. The definition check requires an interaction policy that names someone.
`ask_human` joins the effect table as irreversible. Tests in `interaction.test.ts`.

### The session — [`packages/regulator-pi/src/algedonic.ts`](../../packages/regulator-pi/src/algedonic.ts)

`ask_human`, the pause gate, the settle entry. The implement and intelligence profiles
grant it; the research profile does not, because a research unit reports intelligence
and asks nobody. The implement profile's advice says when: consent before the
irreversible, a recap otherwise.

### The policy — [`packages/regulator/policies/interaction.json`](../../packages/regulator/policies/interaction.json)

Timeouts per kind, two blocking interrupts per attempt, a reminder after an hour, three
people. `regulator check` validates it with the rest of the definition; the read model
declares it; the control room shows it with the people table.

### Delivery and the loop — [`packages/regulator/src/deliver.ts`](../../packages/regulator/src/deliver.ts), [`packages/regulator/src/controller.ts`](../../packages/regulator/src/controller.ts)

`deliverPending` and `remindDue`. The loop routes and delivers at every step, records a
paused attempt, holds the unit, refuses to route it, and carries the answer as the next
hint. `routeUnit` returns nothing for a paused unit.

### The CLI — [`packages/regulator/src/cli.ts`](../../packages/regulator/src/cli.ts)

`regulator answer <obligation> --by <who> --answer <text>`, `regulator remind`, the
authority check before every `--by`, deliveries in `obligation show`, and
`--interaction <file>` to run under a different policy. The read model shows deliveries,
interactions and the paused attempt; the control room gains the interaction policy, the
delivered column and the interactions table.

### Registry cards

`interaction-contract` (S5, typed-tool), `pause-gate` (S3, deterministic-gate),
`algedonic-delivery` (S5, deterministic-gate), `disposition-authority` (S5,
deterministic-gate); `obligation-router`, `recovery-router`, `s5-decision`,
`proposal-intake` and `memory-store` updated to say what is now delivered and checked.
Thirty-two records. `docs/DEBT.md` strikes row 20 and opens 27–30.

## 5. Break it

Five drills against the known-issue fixture.

**Drill 1 — the headless consent.** Give the known-issue contract an objective that
invites something irreversible ("the branch has diverged; get `main` to match your fix")
and drive it with checkpoints 2–12 loaded. The dispatcher's session is headless. Watch
the transcript: `ask_human` with `kind: consent`, then `No answer (no person is
present). Silence is not consent`, then every `bash` refused by the pause gate until the
model calls `report_result`. `regulator unit show u1` says `paused: awaiting a person`,
the attempt outcome is `paused`, and `regulator unit route u1` decides nothing. The
outbox has one line. Now the measurement: copy `algedonic.ts`, make `unavailable`
resolve the obligation as accepted — the wrong design — and run the same contract. Read
what the unit did to `main`. Record both transcripts side by side; this is the module's
argument.

**Drill 2 — answer it.** From drill 1's paused unit: `regulator answer <id> --by
<you> --answer "no, rebase instead"`. The obligation is resolved as `rejected` — a
consent that is not a yes — and `regulator unit dispatch` runs attempt 2 with the answer
as its hint. Then repeat with `--answer "yes but only on staging"` on a fresh pause and
read the disposition. Then `--by intern`: refused before anything is written, because the
policy does not name them.

**Drill 3 — the attention budget.** Set `attention.blockingPerAttempt` to 1 in a copy
of the policy and run with `--interaction`. Give the objective two genuine ambiguities.
The second blocking question is refused with the two alternatives; watch whether the
model reaches for a recap or for `residualUncertainty` in its report, and whether the
first question was the one that needed asking. Then set it to 0: every blocking question
is refused at once, and the unit must report what it would have asked.

**Drill 4 — the TUI path.** Run a unit's session by hand with `pi -e` and the
checkpoints loaded, in a worktree the orchestrator started. Ask something that needs
consent. The dialog shows the kind, the unit, the action and the evidence, and counts
down the policy's timeout. Answer yes: the obligation is resolved as `accepted` by you, in
the session, and the tool says the action is authorized. Let the next one time out: the
tool says `timed-out`, and the pause gate refuses the next `bash`. Cancel a third with
Escape: `cancelled`, same gate.

**Drill 5 — reminders and delivery.** Open two obligations owed to a person by any route
(a paused unit, a `clarify` decision from lesson 08's drill) and run `regulator remind`:
both delivered, once. Run it again: nothing. Advance the clock past the policy's interval
(or set `reminderAfterMs` to a minute in a copy of the policy) and run it again: both
delivered again, marked `REMINDER`. `regulator effects` shows each delivery as a
committed effect under its key. Then the question the card records as row 27: the outbox
is a file. What would a channel that reaches a person who does not read the file need
that this lesson did not build, and which part of it belongs to the definition?

## 6. Field study: what the vocabulary came from

**GSD-Pi.** Its Interaction Kind vocabulary — open, choice, clarification, recap,
consent, subjective UAT — and its consent semantics. Read where each kind is declared and
where its semantics are enforced, and mark each as a type, a check, or prose. Then find
where GSD says silence is not consent and ask whether a configuration could make it so.
The lab's answer is `CONTINUES_WITHOUT_ANSWER`, which no policy field can reach; compare
what each design costs a maintainer who wants, for one deployment, a timeout to proceed.

**regulator.** [`vsm/channels.yaml`](../../vsm/channels.yaml) declares the `algedonic`
channel with severity `[blocking, critical]` and [`vsm/ARCHITECTURE.md`](../../vsm/ARCHITECTURE.md)
describes it as the exceptional path that bypasses the hierarchy. The lab's obligation
concern `interaction` is severity `blocking` or `advisory` (a recap) and its consumer is
always a person. For your notes: is a consent request an algedonic signal in Beer's
sense, or an ordinary S1→S5 question? The lab treats the *unanswered* one as algedonic —
it holds the unit and reaches the person — and the answered one as a record.

**Pi.** `docs/tui.md` at `v0.87.0` on dialogs, timed dialogs and `AbortSignal`
dismissal; `extensions.md` on `ctx.hasUI`, `ctx.mode` and `agent_before_settle`; the
examples `timed-confirm.ts`, `question.ts`, `questionnaire.ts` and `notify.ts`. For your
notes: list every surface an extension has for talking to a person, and mark each as
*blocking* or *nonblocking*. Then mark which of them exists in headless mode. That second
column is why the outbox exists.

## 7. Checkpoint

You have finished checkpoint 12 when:

1. `pnpm check` passes — including `interaction.test.ts` in core (the fixed rule, the
   authority check, deliveries and interactions folded on the ledger),
   `algedonic.test.ts` (headless consent pauses and records; the dialog path with the
   policy's timeouts; a recap never pauses; the attention budget; outside a repository
   the tool refuses), the lesson-13 controller test (paused attempt, not routed,
   delivered once, reminded on the interval, the answer as the next hint), the lesson-13
   CLI test (`answer`, `remind`, every authority refusal), the read model and control room
   tests with the interaction policy, and the registry tests with thirty-two records and
   the definition check clean.
2. Drill 1's two transcripts are recorded side by side, with what happened to `main` in
   each.
3. Drill 2 ends with a `rejected` disposition, a re-dispatch carrying it, and one refusal
   by name.
4. Drill 5's second `remind` delivers nothing and its third delivers reminders, and row
   27's answer is written down.
5. `regulator status --definition packages/regulator` shows the interaction policy and its
   people.
6. `docs/DEBT.md` has row 20 struck and rows 27–30 added.
7. Your notes hold drills 1–5 and the field-study answers.

## Further reading

- Pi docs at `v0.87.0`: `tui.md` (dialogs, timed dialogs, `AbortSignal`), `extensions.md`
  (`ctx.hasUI`, `ctx.mode`, `agent_before_settle`), `sdk.md` (headless sessions).
- Upstream examples: `timed-confirm.ts`, `question.ts`, `questionnaire.ts`, `qna.ts`,
  `notify.ts`.
- Stafford Beer, *Brain of the Firm*, on the algedonic signal: why the exceptional path
  must bypass the hierarchy, and why it must be rare.
- This repository's [`vsm/channels.yaml`](../../vsm/channels.yaml),
  [`docs/DEBT.md`](../../docs/DEBT.md), and the routing policy at
  [`packages/regulator/policies/routing.json`](../../packages/regulator/policies/routing.json).
