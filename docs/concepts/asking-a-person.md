# Asking a person

Most of what a unit does needs no one's attention: the gates hold, the host checks
decide, and the loop routes what fails. Some things do need a person, though, such as a
choice nobody has made yet, an action that cannot be undone, or a judgement no check can
observe. In Beer's model the channel that reaches past the hierarchy to someone who can
act is the **algedonic** one, the channel for pain and pleasure. In `regulator` that
channel is narrow on purpose, because a person's attention is the scarcest thing the
system spends.

A person is reached in two ways. A unit can ask, through one typed tool, `ask_human`,
under an interaction contract. Or the loop can escalate: when the
[recovery policy](/concepts/recovery) has nothing left to try, it answers `escalate`,
and the loop emits an `algedonic-signal` with the evidence. The routing policy turns
that signal into an obligation owed to a person.

Either way, what is owed to a person is an [obligation](/concepts/obligations). It holds
the unit it names, it is delivered to the outbox and reminded, and it is closed by a
named person the interaction policy allows.

## Interaction kinds

Every question a unit asks is one of five kinds, and the kind is a contract about what
happens next, including whether the work waits for the answer:

| Kind | Use it for | Work |
| --- | --- | --- |
| `recap` | decisions and assumptions offered for correction, while the work stays reversible | continues |
| `choice` | picking one of two to six options | waits |
| `clarification` | an open question | waits |
| `consent` | authorization for an irreversible, public, paid, destructive or account-level action | waits |
| `uat` | acceptance of something no check can observe | waits |

The [tools reference](/reference/tools#ask_human) lists each kind's inputs, severity and
shipped timeout. Only a recap lets the work continue, and the next section covers why
that line is fixed in the protocol.

## Silence is never consent

The rule that matters most is fixed in the protocol as a constant, which puts it out of
any policy's reach: no policy may relax it. The constant says which kinds may continue
without an answer, and the only one is `recap`. For every other kind, a timeout, a
cancellation, or the absence of anyone to ask is recorded as exactly that, and the work
waits.

Consent is stricter still. Only an explicit yes (`yes`, `approve`, `confirm`, `proceed`
and a few more) counts. Any other answer, including a thoughtful paragraph, is recorded
as `rejected`. A `uat` answer works the same way: yes is `verified`, and anything else is
`rejected`. The answer to a `choice` or a `clarification` is recorded as the disposition,
with the answer as its rationale, and a `choice` answered from the CLI must be one of the
offered options.

The tool's description tells the model all of this. Enforcement is a separate matter,
and it belongs to the gate described below.

## What happens when a unit asks

1. The obligation comes first. Before anything is asked, the tool records the request
   and opens an `interaction` obligation owed to a person. The obligation is `blocking`
   for every kind that waits and `advisory` for a recap. So the request exists on the
   record even if nothing else happens afterwards.
2. With a person present, the host asks through its dialogs and waits the interaction
   policy's timeout for the kind. An answer is recorded as that person's disposition on
   the spot, and the unit continues, told what was decided. A refused consent tells the
   unit not to perform the action.
3. With no answer, the unit is **paused**. That is the case for every dispatched
   session, since they run headless, and it is also where a timeout or a cancellation
   ends up.

## The pause

A paused unit cannot keep working around the question. The **pause gate** refuses every
tool with any effect for the rest of the session. That is stricter than read-only: even
a record in the control plane's own stores is refused, and only pure reads remain. The
pause is recorded where the session ends, so it does not depend on the model calling
anything.

The loop then does four things. It records the attempt with the outcome `paused`, which
counts against the unit's attempt ceiling, and blocks the unit. It does not route the
unit, because a paused unit is not a failure and the recovery policy has nothing to say
until someone answers. It delivers the question to the outbox, and reminds after the
policy's interval. And by default it keeps waiting.

An interaction policy that declares `waitCeilingMs` changes one thing about that wait.
A unit paused past the ceiling is routed under the recovery policy's `timeout` cause
(retry, retry, escalate by the shipped rules, one occurrence per routing past the
ceiling) and its lease is released, so a unit going nowhere does not hold the worktree.
The question itself stays open, with its veto: a retry cannot run until someone answers,
and nothing answers on anyone's behalf.

A person answers from the CLI:

```sh
regulator answer <obligation> --by <who> --answer <text>
```

The name is checked against the interaction policy's people before anything is written.
The answer resolves the obligation, and the next attempt starts with the answer as its
hint: the question, who answered, and what they decided.

## Attention is a budget

Every blocking question stops a person, and a unit that may ask freely will ask instead
of deciding. So the interaction policy caps how much a unit may ask:

| Setting | Shipped | Meaning |
| --- | --- | --- |
| `attention.blockingPerAttempt` | 2 | blocking questions one attempt may ask |
| `timeoutsMs` | recap 30 s, choice 2 min, clarification 5 min, consent 5 min, uat 10 min | how long a dialog waits before the question is recorded as timed out |
| `reminderAfterMs` | 1 hour | when an undisposed obligation owed to a person is delivered again |

A recap does not count against the cap. Once the cap is reached, `ask_human` refuses a
blocking question and tells the unit what to do instead: record the decision as residual
uncertainty in its [result report](/concepts/contracts#the-result-report), where the
routing policy decides what it costs, or offer it as a recap.

## Escalation

Escalation is the other path to a person, and the unit does not choose it. When the
recovery policy runs out of actions, or the attempt ceiling turns a retry into
`escalate`, the loop emits an `algedonic-signal` to S5 with the evidence and the
decision that produced it. Under the shipped routing policy an algedonic signal at
`blocking` or above opens an obligation owed to a person. The unit stays blocked until
that person dispositions it. The signal and the obligation both cite the recovery
decision, so the person can see the reasoning that led the loop to give up, and not
only the fact that it did.

## What is not there yet

The [registry records](/reference/regulators) for the interaction contract, delivery,
the outbox watcher and disposition authority state their limitations. In short:

- Whether an action needs consent is the model's to notice. The tool defines what
  consent means once it is asked for; nothing yet derives "this needs consent" from a
  tool's declared effects.
- A dialog answer is trusted to the terminal. An answer typed into a session's dialog
  is attributed to the session's user and is not checked against the interaction
  policy, whereas the CLI path does check. Neither path authenticates the name
  (`docs/DEBT.md` row 28).
- There is one outbox and one watcher. An obligation owed to "a person" is delivered to
  whoever reads the outbox, and without `regulator watch` running nothing forwards it
  anywhere. Delivery is not confirmation that anyone read it.
- A recap reaches only the outbox. A person who never reads it never corrects anything.
  That is the recap's contract, since the work was reversible.
- Attention is capped per attempt, and nothing measures it over time. Nothing yet shows
  how much of a person's attention an instance has spent in a week, which the
  [open questions](https://github.com/MetaCoding-io/regulator/blob/main/docs/research/2026-09-25-open-questions.md)
  name as a gap.
