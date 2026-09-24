# Instance layout

What `regulator init` creates in a repository and what the loop writes there. The
repository is the domain; `.regulator/` is the instance's state and is ignored by git;
`regulator/identity/` is the one harness-owned directory that is committed.

## In the repository

| Path | Owner | What |
| --- | --- | --- |
| `regulator/identity/IDENTITY.md`, `INVARIANTS.md`, `GLOSSARY.md`, `BOUNDARIES.md` | S5 | the instance's identity, seeded from the definition, committed on the base branch; protected by the write gate, the bash snapshot-and-restore and the `identity-untouched` check; written only by `identity accept` |
| `.gitignore` | `init` | gains the `.regulator/` line |
| `.env` (if committed) | the project | any credential-looking value in it is recorded as a canary and watched in every tool result |

## Under `.regulator/`

| Path | Store | What |
| --- | --- | --- |
| `instance.json` | manifest | the [manifest](#the-manifest) |
| `units/` | execution | one record per unit: contract version, attempts, budgets consumed, decisions, the report; only the loop writes it |
| `leases/` | execution | one lease per running unit with its TTL and liveness |
| `worktrees/<unit>/` | execution | the unit's git worktree on its own branch; removed on reintegration |
| `trace.ndjson` | regulatory | every schema-validated trace event, append-only |
| `signals.ndjson` | regulatory | messages recorded and not yet routed; `signals route` and the loop drain it into obligations |
| `events.db` | regulatory | the SQLite event store: obligations, findings, proposals, escalations, with provenance |
| `audit.ndjson` | regulatory | evidence records, technical verdicts, human acceptances, append-only |
| `effects.ndjson` | regulatory | the effect journal: every side-effecting tool call, its outcome, and its reconciliation on restart |
| `memory.ndjson` | regulatory | operational memory: facts with provenance and expiry, and their retractions; scoped by unit type |
| `outbox` | delivery | one line per delivery of an obligation owed to a person; `watch` forwards new lines to a channel command; `REGULATOR_OUTBOX` moves it |

Execution state and regulatory state are in different stores on purpose: the loop
decides what a unit may do next by reading the regulatory log, and the regulators never
read the loop's progress off the repository.

## The manifest

`.regulator/instance.json` is written once by `init` and read by the profile grant, the
closeout and `doctor`. It is the only file under `.regulator/` a person's declaration
goes into, and it is not edited by hand: re-run `init` to change it.

| Field | Meaning |
| --- | --- |
| `version` | `1` |
| `definition.root`, `definition.name` | the definition this instance runs under |
| `definition.registry` | how many regulators it declared at init |
| `definition.harnessRevision` | the definition's git revision; a later revision shows `definition-drift` in `doctor` |
| `definition.pi` | the Pi version the definition pins |
| `writablePaths[]` | optional; where the implement profile may write in this repository instead of its own default |
| `protectedPaths[]` | optional; prefixes the closeout refuses a change under, in addition to `regulator/identity/` and the discovered conventions |
| `initializedAt`, `initializedBy` | when and who; `--by` is checked against the interaction policy |

## Environment

| Variable | Meaning |
| --- | --- |
| `REGULATOR_OUTBOX` | where `notify_owner` and delivery write; default `<repo>/.regulator/outbox` |
| `REGULATOR_INTERACTION_POLICY` | a different interaction policy for a session run by hand |
| `REGULATOR_HOST` | the host package `unit dispatch` and `unit drive` load; default `@metacoding/regulator-pi`; `--host` overrides it for one run |
| `PI_*`, provider keys | Pi's own environment; the harness reads none of them |

Nothing else in the instance is configuration. The Pi settings a unit's session runs
under are the definition's `settings.json`, held in memory by the dispatcher; the
repository's `.pi/settings.json` is never read.
