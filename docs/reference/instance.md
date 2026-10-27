# Instance layout

`regulator init` creates the layout below in a repository, and the loop writes into it
as units run. The repository itself is the domain. `.regulator/` holds the instance's
state and is ignored by git. `regulator/identity/` and `regulator/advice/` are the two
harness-owned directories that are committed; they are the instance paths of the two
seeded classes of `DEFINITION_WRITERS`, and every gate that protects them derives its
list from there.

## In the repository

| Path | Owner | What |
| --- | --- | --- |
| `regulator/identity/IDENTITY.md`, `INVARIANTS.md`, `GLOSSARY.md`, `BOUNDARIES.md` | S5 | the instance's identity, seeded from the definition and committed on the base branch. It is protected by the write gate, by the bash snapshot-and-restore and by the `identity-untouched` check, and only `identity accept` writes it |
| `regulator/advice/<profile>.md`, one per declared profile | S5 | what every unit of the profile is told beyond its grant, seeded from the definition's `advice/` and committed with the identity. Protected by the same three mechanisms, rendered into the session by the profiles extension and cut at the policy's `advice.maxChars`, and only `advice accept` writes it |
| `.gitignore` | `init` | gains the `.regulator/` line |
| `.env` (if committed) | the project | any credential-looking value in it is recorded as a credential canary and watched for in every tool result |

## Under `.regulator/`

| Path | Store | What |
| --- | --- | --- |
| `instance.json` | manifest | the [manifest](#the-manifest) |
| `units/` | execution | one record per unit, holding the contract version, the attempts, the budgets consumed, the decisions and the report. Only the loop writes it |
| `leases/` | execution | one lease per running unit, with its TTL and liveness |
| `worktrees/<unit>/` | execution | the unit's git worktree on its own branch, removed on reintegration |
| `trace.ndjson` | regulatory | every schema-validated trace event, append-only |
| `signals.ndjson` | regulatory | the regulatory log, append-only. It holds every typed message a session or the loop recorded, the obligation events the router and the consumers appended (opened, acknowledged, resolved, escalated, delivered, noted), and the interaction requests and answers. [Obligations](/concepts/obligations) are the fold of it |
| `events.db` | regulatory | the SQLite event store the generic `vsm_*` reporting tools write. A unit's session does not load those tools, so an instance driven by the loop keeps it empty |
| `audit.ndjson` | regulatory | evidence records, technical verdicts and human acceptances, append-only |
| `effects.ndjson` | regulatory | the effect journal: every side-effecting tool call, its outcome, and its reconciliation on restart |
| `memory.ndjson` | regulatory | operational memory: facts with provenance and expiry, and their retractions, scoped by unit type |
| `outbox` | delivery | one line per delivery of an obligation owed to a person. `watch` forwards new lines to a channel command, and `REGULATOR_OUTBOX` moves the file |
| `outbox.cursor` | delivery | how far `watch` has forwarded, so that a restart forwards nothing twice |
| `canaries` | manifest | the credential canaries: the credential-looking values `init` found in a committed `.env`, one per line. They are watched for in every tool result and redacted from spans |

Execution state and regulatory state live in different stores on purpose. The loop
decides what a unit may do next by reading the regulatory log, and the regulators never
read the loop's progress off the repository. So the record under `units/` says what the
loop did with a unit, while the regulatory files say what was observed, what was
recorded and what is still owed.

## The manifest

`.regulator/instance.json` is written by `init`, rewritten by `upgrade`, and read by the
profile grant, the closeout and `doctor`. It is the only file under `.regulator/` that
carries a person's declaration, and even so it is not edited by hand. `init` refuses to
run twice, so changing the declared layout means creating a new instance. A definition
newer than the one recorded shows as `definition-drift` in `doctor` until a person runs
`regulator upgrade`, which rewrites the manifest with the new version and revision and
appends one entry to its history.

| Field | Meaning |
| --- | --- |
| `version` | `1` |
| `definition.root`, `definition.name` | the definition this instance runs under |
| `definition.registry` | how many regulators the definition declared at init |
| `definition.harnessRevision` | the definition's git revision at init. A later revision shows as `definition-drift` in `doctor` |
| `definition.pi` | the Pi version the definition pins |
| `definition.packageVersion` | the definition's package version at init or at the last upgrade. Absent on a manifest written before `upgrade` existed; `upgrade` reads such a manifest as the changelog's migration floor (0.1.3) and writes the field |
| `writablePaths[]` | optional. Where the implement profile may write in this repository, in place of its own default |
| `protectedPaths[]` | optional. Prefixes the closeout refuses a change under, in addition to the harness-owned directories (`regulator/identity/`, `regulator/advice/`) and the discovered conventions |
| `initializedAt`, `initializedBy` | when the instance was initialized and by whom: the `--by` given, or else the user and host. This is recorded as provenance and is not checked against the interaction policy |
| `upgrades[]` | optional, oldest first: one entry per `regulator upgrade`. Each records `from` and `to` (package version and harness revision), `report` (the SHA-256 of the committed report under the definition's `evals/reports/` whose fingerprint names the target revision, or `none`), `reportFile` when there is one, `by` (checked against the interaction policy as S5) and `at`. `doctor` reports the last entry: which evidence the instance's definition rests on |

## Environment

| Variable | Meaning |
| --- | --- |
| `REGULATOR_OUTBOX` | where `notify_owner` and delivery write. The default is `<repo>/.regulator/outbox` |
| `REGULATOR_INTERACTION_POLICY` | a different interaction policy, for a session run by hand |
| `REGULATOR_HOST` | the host package `unit dispatch` and `unit drive` load. The default is `@metacoding.io/regulator-pi`, and `--host` overrides it for one run |
| `PI_*`, provider keys | Pi's own environment. The harness reads none of them |

Nothing else in the instance is configuration. The Pi settings a unit's session runs
under come from the definition's `settings.json`, which the dispatcher holds in memory.
The repository's own `.pi/settings.json` is never read.
