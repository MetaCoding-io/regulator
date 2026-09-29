# Obligations

A message records that something happened. An obligation records that the control
plane has not yet shown it absorbed what happened: a finding nobody has dispositioned,
a question nobody has answered, a proposal nobody has decided. Obligations are how the
instance keeps count of what it owes and to whom. They are also the only thing in the
loop that can stop a unit without spending an attempt.

Three rules make them useful:

- The router opens them, and a consumer closes them. No tool, no model and no loop step
  resolves an obligation. A named function (S3, S5) or a named person does, with a
  disposition and a rationale, and the record says who.
- An open obligation can veto. At or above the routing policy's line, an obligation
  that names a unit refuses that unit's dispatch and its close until it is dispositioned.
  The veto itself is deterministic, because it is a check over open records. The
  disposition that ends it is a judgment.
- Records never reopen. Resolve, escalate and supersede are terminal. Later evidence
  opens a successor that cites its predecessor, so an obligation's history is its record.

## Where they come from

S3 opens obligations from two sources, and each one lands in the regulatory log
(`.regulator/signals.ndjson`) beside the message it came from.

The first source is a routed message. At each step of the loop, and on
`regulator signals route`, the router reads every message not yet routed and applies the
[routing policy](/reference/definition#routing-policy). The policy has a rule per
message kind, and the rule names the severity at which a message of that kind opens an
obligation, and for which consumer. Below the line the message is *noted* with the
reason and stays in the trace. An intelligence signal past its expiry is noted as well,
and never becomes an obligation. An intelligence signal that names affected units opens
one obligation per unit, so each veto lands on the unit the concern is about.

The second source is a recovery decision the loop cannot apply on its own. When the
[recovery policy](/reference/definition#recovery-policy) answers a blocked unit with a
*waiting* action (`remediate`, `replan`, `clarify`, `pause` or `escalate`), the loop
opens a blocking `recovery-decision` obligation for the consumer named in the routing
policy's `recovery` section, and the unit holds. The unit's open S3 obligations are
escalated into that one, so the wait has one successor and one owner. The other actions
do not wait: `retry` and `repair` resolve the unit's open obligations as `rework`, and
`abort` resolves them as `rejected`.

There is a third shape, and the router does not open it. A question a unit asks a
person through `ask_human` is the `interaction` concern. The session itself opens it
under the interaction policy, and it blocks for every kind of question except a recap.
The [tools reference](/reference/tools#ask_human) describes the tool.

## What one holds

| Field | Meaning |
| --- | --- |
| `subject` | what it is about, from the message or the decision |
| `unit` | the unit it holds, when it is about one; absent for an obligation on the instance itself |
| `concern` | the message kind it came from, `recovery-decision`, or `interaction` |
| `sources[]` | the message ids, decision ids or predecessor obligations it was opened from |
| `severity` | the *effective* severity: the router's, under policy, never the emitter's claim |
| `consumer` | who must disposition it: `S3`, `S5` or `human` |
| `blocks` | whether it vetoes the unit's dispatch and close while open |
| `question` | for an interaction: what must be answered |
| `openedAt`, `openedBy` | when, and which function routed it |

### Severity

There are four levels, lowest first. The router assigns them, and a message's own claim
is only an input to that assignment.

| Severity | Means | Under the shipped policies |
| --- | --- | --- |
| `info` | worth recording | below every rule's line except `policy-proposal`; noted as trace |
| `advisory` | owed, but holds nothing | opens an obligation for coordination and intelligence signals; a recap question |
| `blocking` | holds the unit it names until dispositioned | the veto line (`blocksAtOrAbove`); every waiting question; a waiting recovery action |
| `critical` | blocking, and only a person with `resolveUpTo: critical` may close it | anything the floors raise, and an uncertainty whose reported impact is `critical` |

Two adjustments happen before the rule is applied. An uncertainty signal's *reported
impact* is mapped through `impactSeverity`, because a claim of impact is not yet a
severity. Then the policy's *floors* raise any message whose subject, observation or
rationale matches a pattern to at least the named severity. The shipped floor raises
anything naming an invariant (`INV-nnn`) or the identity path to `blocking`, whatever
the emitter said.

### The veto

`progressionVeto` is the check the loop runs before a dispatch and before a close. It
collects every open obligation with `blocks: true` that names this unit, plus every one
that names *no* unit. The second case is deliberate: an audit finding about the instance
itself, such as the base failing its checks after a merge, holds every unit until S3
dispositions it. `regulator obligations` marks the ones that currently veto.

## Lifecycle

```
open ──► acknowledged ──► resolved     (a disposition, with a rationale)
                     ├──► escalated    (a successor for another consumer; the veto moves with it)
                     └──► superseded   (a successor replaced it)
```

| Transition | Command | What it means |
| --- | --- | --- |
| acknowledge | `obligation ack <id> --by <who>` | seen by a consumer who may handle it. It is not agreement and not a finding of correctness, and the veto stands |
| resolve | `obligation resolve <id> --by <who> --disposition <d> --rationale <text>` | closed with a disposition |
| escalate | `obligation escalate <id> --by <who> --to <consumer> --rationale <text>` | this consumer cannot legitimately resolve it. A successor is opened for another consumer (or an existing open one is linked) and this one closes as escalated. It is never valid without a successor |
| answer | `answer <id> --by <who> --answer <text>` | for an `interaction`: the answer is recorded and the obligation resolves with the disposition the answer means |
| decide | `identity accept` / `identity reject` | for a `policy-proposal`: the S5 decision, by a person with `actAsS5` |
| deliver | the loop, `remind`, `watch` | put in front of its consumer, and recorded per delivery with the channel. Delivery is not a disposition |

Supersede has no command of its own. The loop uses it when a later record replaces an
earlier one.

### Dispositions

A disposition is the outcome, and it is recorded separately from the status because the
status alone does not say how something ended: every disposition below closes the record
as resolved. `obligation resolve` takes one of:

| Disposition | Use when |
| --- | --- |
| `no-action` | the concern was noted and nothing needs to change |
| `accepted-risk` | the concern stands and the consumer accepts it; only a person with `acceptRisk` may |
| `rework` | the unit will be run again under the same contract; the loop records this on retry and repair |
| `replan` | the contract is wrong; a new version follows |
| `fixed` | the concern was addressed; the default meaning of an answered question |
| `verified` | independently confirmed; a `uat` question answered yes |
| `rejected` | the claim, proposal or request is declined; consent answered no; an aborted unit's obligations |
| `accepted` | accepted into identity or policy by the S5 decision path; consent answered yes |
| `research-requested` | a research unit should answer it first |
| `audit-requested` | an S3\* check should look before anyone decides |
| `policy-clarification-requested` | the policy is unclear on this; S5 is asked |

An answer to a question maps to a disposition mechanically. `consent` is `accepted` on a
yes and `rejected` on anything else. `uat` is `verified` on a yes and `rejected`
otherwise. Every other kind is `fixed`. Silence, a timeout and a cancellation are never a
yes. That rule is a protocol constant, so no policy field can relax it.

## Who may disposition

Every `--by` on the commands above is checked against the
[interaction policy's](/reference/definition#interaction-policy) `people` before anything
is written. The name must be listed, `resolveUpTo` must reach the obligation's severity,
`acceptRisk` must be set for that disposition, and `actAsS5` must be set for an identity
decision. The check is on the name only: nothing verifies that the person typing it is
who they say, and authentication is left to the deployment. A function (`S3`)
dispositions through the loop, never by hand. An `interaction` obligation, one a unit
opened by asking, is closed with `regulator answer`, and
[asking a person](/concepts/asking-a-person) covers that path and the pause it ends.

## Delivery

An obligation owed to a person is delivered as one line to `.regulator/outbox`, and the
delivery is recorded as an event with the channel. After the policy's `reminderAfterMs`
passes with no disposition, it is delivered again and marked as a reminder.
`regulator remind` runs one tick of that. `regulator watch` runs the ticks and forwards
each new outbox line to a channel command, keeping a cursor in `.regulator/outbox.cursor`
so that a restart forwards nothing twice. Delivery is not a disposition: an obligation
stays open until someone closes it.

## Reading them

- `regulator obligations` lists what is open: status, consumer, severity, whether it
  vetoes, the unit, the concern, and the last delivery. `--all` includes what was
  dispositioned.
- `regulator obligation show <id>` shows one obligation with the messages it came from
  and every event since.
- `regulator unit show <id>` shows the obligations that name a unit, beside its attempts
  and decisions.
- The control room's *Instances* view lists the same ledger, and its *Inspector* replays
  a unit's obligations in time order with everything else that happened to it.
