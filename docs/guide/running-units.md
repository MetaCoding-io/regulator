# Running units

A unit is one piece of work, one contract, any number of attempts, one closure. This
page follows a unit through the loop and shows where each command sits. The
[CLI reference](/reference/cli) has every flag.

## The loop

```
contract ──► dispatch ──► verify ──► route ──► close
                ▲                       │
                └── retry / repair ◄────┘
                        clarify / escalate / pause ──► an obligation owed to someone
```

1. **Contract.** `regulator contract check <file>` validates the contract against the
   schema and the workload it names: the unit type must exist, and a type that requires
   a contract cannot run without one.
2. **Dispatch.** `unit drive` (or `unit dispatch` for a single attempt) takes a lease on
   the unit, creates `.regulator/worktrees/<id>` on a branch, resolves the unit type's
   profile, budget and model route, and opens a session through the host. The session
   sees the identity, the contract and the profile's advice; it may use only the tools
   the profile grants ([session tools](/reference/tools)), and may write directly only
   under the profile's paths.
3. **Verify.** When the session ends, the host runs the checks the workload names for
   the unit type at the unit's revision and records each as evidence. The technical
   verdict is theirs; the unit's own report is a claim beside it.
4. **Route.** A failed verdict, an exhausted budget or a missing report is a *cause*;
   the recovery policy maps the Nth occurrence of a cause on a unit to an action.
   `retry` and `repair` spend an attempt; `remediate`, `replan`, `clarify`, `pause` and
   `escalate` open an obligation for the consumer the routing policy names and hold the
   unit until it is dispositioned. `unit route <id>` routes one blocked unit by hand.
5. **Close.** A passing verdict with every required expectation met reintegrates the
   branch into the base and retires the lease. A criterion no check can observe waits
   for `unit accept <id> <criterion> --by <who>`; `unit close <id>` re-audits a blocked
   unit without a new attempt. After the merge the host runs `run_tests` and
   `run_checks` once more on the base at the merge commit: the branch passed on its own
   tree, and two units that change disjoint files can still break each other. A failure
   there is an audit finding with no unit, an obligation owed to S3 that holds every
   dispatch until it is dispositioned; nothing is reverted by itself.

## Working by hand

The loop is the normal path. When you want to sit in the session yourself:

```sh
regulator unit start u2 --type implement    # lease, worktree, branch
cd .regulator/worktrees/u2
pi                                          # with the host's extensions installed: pi install <path to @metacoding.io/regulator-pi>
cd -
regulator signals route                     # route what the session recorded
regulator unit finish u2                    # reintegrate, or surface the conflict
```

A hand-run session records the same trace, signals and effects as a dispatched one, but
nothing verifies it unless you ask: `unit close u2` runs the closeout over the unit's
revision.

## Obligations

`regulator obligations` is the ledger ([obligations](/concepts/obligations) is the long
version): what is owed, to whom (`S3`, `S5` or `human`),
at which severity, and whether it currently vetoes a unit's dispatch and close. An
obligation is closed by a disposition with a rationale, and the disposition is checked
against the interaction policy's people before anything is written:

| Command | What it records |
| --- | --- |
| `obligation ack <id> --by <who>` | seen, not yet resolved; the veto stands |
| `obligation resolve <id> --by <who> --disposition <d> --rationale <t>` | closed with a [disposition](/concepts/obligations#dispositions): `no-action`, `accepted-risk`, `rework`, `replan`, `fixed`, `verified`, `rejected`, `research-requested`, `audit-requested` or `policy-clarification-requested` |
| `obligation escalate <id> --by <who> --to <consumer> --rationale <t>` | a successor obligation for another consumer; the veto moves with it |
| `answer <id> --by <who> --answer <t>` | the answer to a unit's question; the next attempt carries it |
| `identity accept <id> --by <who> --file <name>.md --from <path> --rationale <t>` | the S5 decision on a proposal: the file is written and committed under S5 authority |
| `identity reject <id> --by <who> --rationale <t>` | the proposal is declined |

Obligations owed to a person are delivered to `.regulator/outbox`, one line each.
`regulator watch --exec <cmd>` forwards each new line to a channel command and repeats
the delivery after the policy's reminder interval; `regulator remind` is one such tick.

## Evidence

Everything a unit did is on record and replayable:

- `unit show <id>` — the execution record: attempts, budgets consumed, decisions, the
  report, the obligations that name it.
- `unit evidence <id>` — the audit log: each check's evidence, the technical verdict per
  attempt, human acceptances.
- `effects` — the effect journal: every side-effecting tool call, its outcome, and its
  reconciliation on restart.
- `memory` — operational memory: facts a unit recorded with `remember`, each with
  provenance and an expiry; `memory retract` appends a retraction. See
  [intelligence and memory](/concepts/intelligence-and-memory).
- `spans --json` — the instance as OpenTelemetry GenAI spans, with canaries redacted,
  for whatever collector you run.
- `status` — the read model the [control room](/guide/control-room) renders: units,
  obligations, budgets, review dates, on one page; `--json` for a script.
