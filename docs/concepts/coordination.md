# Coordination

Several units running against one repository will interfere unless something keeps them
apart. Two sessions write the same checkout. A session dies and keeps its claim on a
resource. Two units change different files and break each other when both land. A unit
rewrites the same file back and forth and burns its budget. A crash between sending a
message and recording it sends the message twice on restart.

In the Viable System Model, S2 absorbs this kind of interference. It coordinates the
operational units so that S3 only has to decide what to do about a real conflict. In
`regulator`, S2 has no coordinator agent that negotiates on the units' behalf. It is a
set of mechanisms, each small and deterministic: isolation, leases, reintegration, a
thrash detector, an effect journal, and profiles that grant tools by what they do. Each
of them detects and records, and S3 decides what follows.

## One worktree per unit

Every unit runs in its own git worktree, `.regulator/worktrees/<unit>`, on its own
branch, `unit/<unit>`. A unit's changes are invisible to the base and to every other unit
until they are reintegrated. The worktree is where the session runs, it is what the host
checks read at closeout, and it is what the lease protects.

## Leases

A **lease** is a claim on a worktree. It names the unit, its owner, the resource, the
branch, and an expiry. The loop takes one before dispatch (ten minutes by default), and
the session renews it with a heartbeat at every turn.

The **lease gate** is what makes the claim binding. Inside the session, every tool with
an effect beyond reading is refused unless the session's unit holds a live lease on the
worktree it is running in. That covers `write`, `edit`, `bash`, `run_tests`, and any
tool whose effect is undeclared. The gate covers the shell too, because the condition
it tests belongs to the session as a whole and does not depend on a path.

Liveness is what distinguishes a lease from a lock file. A holder that stops
heartbeating loses the claim when the expiry passes, and another unit may then take the
resource. A lease that has already expired cannot be heartbeated back to life. It has to
be acquired again, so a session that went silent cannot quietly resume writing. A second
unit that asks for a resource with a live lease is refused and told who holds it.

## Reintegration

When a unit passes closeout, the loop merges its branch into the base. It merges only
from a clean checkout on the base branch, and a dirty base is refused. It merges with a
merge commit, so the unit's history stays intact. On a **conflict**, the merge is
aborted and the base is left exactly as it was found. Nothing is resolved automatically.
A `coordination-signal` names the conflicting paths for S3, and the unit is blocked with
the cause `conflict`. Under the shipped [recovery policy](/concepts/recovery) that is
`repair` first: the next attempt is told to merge the base into its branch, resolve the
conflict without changing what the contract fixes, and check again.

A clean merge proves only that no two units changed the same lines. Two units that change
different files can still break each other. So the merge is tried before it lands, in
the **pre-merge trial**. The loop merges the branch in a temporary worktree detached at
the base's HEAD, runs `run_tests` and `run_checks` on that merged tree, and records the
results as evidence bound to the trial commit. A tree that passes is landed by
fast-forward to the very commit that was verified, so what the base carries is what was
checked. A tree that fails lands nothing. The base is exactly as it was, S2 records a
`conflict` coordination signal saying what the merged tree failed, and the unit is
blocked with the cause `conflict`. Under the shipped policy that is again `repair`, with
the failing checks as the next attempt's hint. Until 0.1.3 the same checks ran *after*
the merge, and a failure held every dispatch through an obligation on the instance
itself while the base stayed red. That record, `post-merge-check`, is retired as
history.

## The thrash detector

A unit that cannot settle a requirement often shows it by rewriting the same file over and
over, trying one fix after another. The **thrash detector** counts `write` and `edit`
calls per file within a unit. Past a threshold (the policy's
`coordination.oscillationThreshold`, 4 by default) it emits a `coordination-signal` of
kind `oscillation`.

The detector itself decides nothing. The recovery router reads the signal, classifies
the unit's failure as `oscillation`, and the shipped policy answers `clarify`: the unit
waits for a person to say which behaviour is wanted. Retrying an oscillating unit would
only spend its budget on the same indecision.

## The effect journal

Some effects cannot be taken back: a message sent to the owner, a delivery to the outbox.
If the harness dies between the effect and its record, a naive restart either sends the
message again or forgets that it was sent. The **effect journal**
(`.regulator/effects.ndjson`) prevents both, in three steps:

1. Before the effect, it writes `intended` under an idempotency key, which is a hash of
   the unit, the tool and the arguments.
2. After the effect, it writes `committed` with the result.
3. On every session start, it reconciles each `intended` that has no outcome by asking
   the world whether the effect happened, and records `confirmed` or `absent`, before
   any new effect runs.

A key that is already committed or confirmed is never acted on again; the tool returns
the recorded result instead. `notify_owner` and the delivery of what is owed to a person
both go through the journal. `regulator effects` shows it.

## Profiles grant tools by effect

A capability profile says which tools a unit type may use and where it may write. What
makes a profile meaningful is that every tool declares its **effect** on four axes, and
a profile is judged by the effects of the tools it grants, whatever those tools are
called:

| Axis | Values |
| --- | --- |
| filesystem | `none`, `read`, `write` |
| execution | `none`, `project-code`, `arbitrary` |
| network | `none`, `unknown`, `open` |
| side effects | `none`, `reversible`, `irreversible`, `unknown` |

A tool is **read-only** when it writes nothing in the repository, executes nothing,
touches no network, and has no side effect beyond a reversible record in the control
plane's own stores. That definition admits `report_result`, `report_intelligence`,
`remember` and `propose_policy_change`, which only record things for S3. It excludes
`run_tests`. Its schema is a single string, but it runs whatever the project's test
suite does, so its effect is `project-code` with unknown side effects. A profile that
calls itself read-only and grants `run_tests` fails `regulator check`.

In the session, the profile grant limits the active tool surface to the profile's tools
and limits `write` and `edit` to the profile's writable prefixes. When the instance
manifest declares writable prefixes, they replace those of any profile that writes at
all. A profile with no writable prefixes stays read-only whatever the manifest says.
The [tools reference](/reference/tools) lists each tool's effect and which profiles
grant it.

## Where each mechanism acts

| Mechanism | When | Records | Sends to S3 |
| --- | --- | --- | --- |
| worktree and branch | dispatch | the unit's changes, in isolation | — |
| lease and lease gate | dispatch; every tool call; every turn | `.regulator/leases/<unit>.json` | a refusal the session sees |
| reintegration | close | a merge commit on the base | a `conflict` coordination signal |
| pre-merge trial | before every merge lands | evidence at the trial commit | a `conflict` coordination signal when the merged tree fails |
| thrash detector | after every write and edit | a count per file | an `oscillation` coordination signal |
| effect journal | around irreversible effects; session start | `.regulator/effects.ndjson` | — |
| profile grant | session start; every tool call | — | a refusal the session sees |

## What is not there yet

The [registry records](/reference/regulators) for each mechanism state its limitations.
In short:

- Everything is on one machine. Leases are files, and the effect journal is per base
  checkout. Two harnesses on two machines cannot see each other's claims or intentions.
- Liveness is expiry only. A live process that stops heartbeating looks dead until the
  lease expires, and there is no fencing token to refuse a late write from the old
  holder.
- The shell is not path-gated. The lease gate covers `bash`, but only the session's own
  worktree is leased. The write grant covers `write` and `edit`, and `bash` can still
  write elsewhere by absolute path.
- Conflicts are line-level, and the trial runs two checks. The pre-merge trial runs
  `run_tests` and `run_checks` on the merged tree, so a coupling those two do not
  exercise lands. A base that moves between the trial and the landing is refused, and
  it is not re-trialed.
- The thrash detector sees only `write` and `edit`. Edits made through `bash` are
  invisible to it, and its count restarts with each session.
- Only named effects are journaled. `bash` is not, because its side effects are unknown
  by declaration, and nothing can journal what it cannot name. The idempotency key is
  the arguments, so the same message sent twice on purpose is refused.
