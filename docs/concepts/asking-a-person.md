# Asking a person

Most of what a unit does needs no one's attention: the gates hold, the host checks
decide, and the loop routes what fails. Some things need a person. A choice nobody has
made, an action that cannot be undone, a judgement no check can observe. In Beer's
model the channel that reaches past the hierarchy to someone who can act is the
**algedonic** one, pain and pleasure. In `regulator` it is narrow on purpose, because
a person's attention is the scarcest thing the system spends.

A person is reached in two ways:

- **A unit asks**, through one typed tool, `ask_human`, under an interaction contract.
- **The loop escalates**: when the [recovery policy](/concepts/recovery) has nothing
  left to try, it answers `escalate`, and the loop emits an `algedonic-signal` with the
  evidence. The routing policy turns it into an obligation owed to a person.

Either way, what is owed to a person is an [obligation](/concepts/obligations): it holds
the unit it names, it is delivered to the outbox and reminded, and it is closed by a
named person the interaction policy allows.

## Interaction kinds

A unit does not just "ask". Every question is one of five kinds, and the kind is a
contract about what happens next:

| Kind | Use it for | Work |
| --- | --- | --- |
| `recap` | decisions and assumptions offered for correction, while the work stays reversible | continues |
| `choice` | picking one of two to six options | waits |
| `clarification` | an open question | waits |
| `consent` | authorization for an irreversible, public, paid, destructive or account-level action | waits |
| `uat` | acceptance of something no check can observe | waits |

The [tools reference](/reference/tools#ask_human) lists each kind's inputs, severity and
shipped timeout.

## Silence is never consent

The rule that matters most is not in any policy, because no policy may relax it. The
protocol fixes, as a constant, which kinds may continue without an answer: only `recap`.
For every other kind, a timeout, a cancellation, or the absence of anyone to ask is
recorded as exactly that, and the work waits.

Consent is stricter still. Only an explicit yes (`yes`, `approve`, `confirm`,
`proceed` and a few more) counts. Any other answer, including a thoughtful paragraph, is
recorded as `rejected`. A `uat` answer works the same way: yes is `verified`, anything
else `rejected`. The answer to a `choice` or a `clarification` is recorded as the
disposition, with the answer as its rationale, and a `choice` answered from the CLI must
be one of the offered options.

The tool's description tells the model all of this, but the description is not what
enforces it. The gate below does.

## What happens when a unit asks

1. **The obligation comes first.** Before anything is asked, the tool records the request
   and opens an `interaction` obligation owed to a person: `blocking` for every kind
   that waits, `advisory` for a recap. The request exists even if nothing else does.
2. **With a person present**, the host asks through its dialogs and waits the
   interaction policy's timeout for the kind. An answer is recorded as that person's
   disposition on the spot, and the unit continues, told what was decided. A consent
   refused tells the unit not to perform the action.
3. **With no answer** (headless, as every dispatched session is; a timeout; a
   cancellation), the unit is **paused**.

## The pause

A paused unit cannot keep working around the question. The **pause gate** refuses every
tool with any effect for the rest of the session. That is stricter than read-only:
even a record in the control plane's own stores is refused, and only pure reads remain.
The pause is recorded where the session ends, so it does not depend on the model
calling anything.

The loop then:

- records the attempt with the outcome `paused` (it counts against the unit's attempt
  ceiling) and blocks the unit;
- does **not** route it: a paused unit is not a failure, and the recovery policy has
  nothing to say until someone answers;
- delivers the question to the outbox, and reminds after the policy's interval.

A person answers from the CLI:

```sh
regulator answer <obligation> --by <who> --answer <text>
```

The name is checked against the interaction policy's people before anything is written.
The answer resolves the obligation, and the next attempt starts with it as its hint: the
question, who answered, and what they decided.

## Attention is a budget

Every blocking question stops a person, and a unit that may ask freely will ask instead
of deciding. So the interaction policy caps it:

| Setting | Shipped | Meaning |
| --- | --- | --- |
| `attention.blockingPerAttempt` | 2 | blocking questions one attempt may ask |
| `timeoutsMs` | recap 30 s, choice 2 min, clarification 5 min, consent 5 min, uat 10 min | how long a dialog waits before the question is recorded as timed out |
| `reminderAfterMs` | 1 hour | when an undisposed obligation owed to a person is delivered again |

A recap does not count against the cap. Past it, `ask_human` refuses a blocking question
and tells the unit what to do instead: record the decision as residual uncertainty in its
[result report](/concepts/contracts#the-result-report), where the routing policy decides
what it costs, or offer it as a recap.

## Escalation

Escalation is the other path to a person, and the unit does not choose it. When the
recovery policy runs out of actions, or the attempt ceiling turns a retry into
`escalate`, the loop emits an `algedonic-signal` to S5 with the evidence and the
decision that produced it. Under the shipped routing policy an algedonic signal at
`blocking` or above opens an obligation owed to a person. The unit stays blocked until
that person dispositions it. The signal and the obligation both cite the recovery
decision, so the person sees why the loop gave up, not only that it did.

## What is not there yet

The [registry records](/reference/regulators) for the interaction contract, delivery,
the outbox watcher and disposition authority state their limitations. In short:

- **Whether an action needs consent is the model's to notice.** The tool defines what
  consent means once asked; nothing derives "this needs consent" from a tool's declared
  effects yet.
- **A dialog answer is trusted to the terminal.** An answer typed into a session's
  dialog is attributed to the session's user and is not checked against the interaction
  policy; the CLI path checks. Neither authenticates the name (`docs/DEBT.md` row 28).
- **One outbox, one watcher.** An obligation owed to "a person" is delivered to whoever
  reads the outbox, and without `regulator watch` running nothing forwards it anywhere.
  Delivery is not confirmation that anyone read it.
- **A recap reaches only the outbox.** A person who never reads it never corrects
  anything. That is the recap's contract, since the work was reversible.
- **Attention is capped, not measured.** The cap is per attempt. Nothing yet shows how
  much of a person's attention an instance has spent in a week, which the
  [open questions](https://github.com/MetaCoding-io/regulator/blob/main/docs/research/2026-09-25-open-questions.md)
  name as a gap.
