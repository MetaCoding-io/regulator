# Session tools

These are the tools a unit's session may call beyond the runtime's own `read`, `write`,
`edit`, `grep`, `find`, `ls` and `bash`. Each one is registered by one of the Pi host's
extensions with a runtime schema, and each declares its *effect*: filesystem, execution,
network or side effects. The effect is what a capability profile grants over, so a
profile that calls itself read-only may list only tools whose declared effect is
read-only, and the definition check refuses one that does not.

The active tool set of a session is exactly the profile's list. A tool the profile does
not name is never offered to the model at all, so there is nothing for a gate to refuse.

| Tool | Effect | Granted by (shipped profiles) | Records |
| --- | --- | --- | --- |
| [`read_conventions`](#read_conventions) | read-only | every profile | nothing |
| [`run_tests`](#run_tests-and-run_checks) | runs project code | `implement`, `bookkeeper` | a provenance entry in the session |
| [`run_checks`](#run_tests-and-run_checks) | read-only | every profile | a provenance entry in the session |
| [`report_result`](#report_result) | writes the execution store | every contracted session (see the note) | the result report |
| [`ask_human`](#ask_human) | irreversible: it spends a person's attention | `implement`, `intelligence`, `bookkeeper` | an `interaction` obligation |
| [`notify_owner`](#notify_owner) | irreversible: it sends a message | `implement`, `bookkeeper` | the effect journal, the outbox |
| [`remember`](#remember) | writes the memory store | `implement`, `bookkeeper` | a memory entry |
| [`report_intelligence`](#report_intelligence) | writes the regulatory log | `intelligence` | an `intelligence-signal` |
| [`propose_policy_change`](#propose_policy_change) | writes the regulatory log | `implement`, `intelligence`, `bookkeeper` | a `policy-proposal` |

::: tip `report_result` needs no grant
A contracted unit must be able to report, so when the contract loads the contract
extension puts `report_result` on the active tool surface, whatever the profile lists.
A profile does not need to name it. A session with no contract never sees it.
:::

## `read_conventions`

Returns what can be determined mechanically about the project, as opposed to what its
README claims: the real test command and where it was found (`package.json`
`scripts.test`, or `node --test` when a `test/` directory exists), the source
directories among `src/` and `lib/`, the protected paths (`vendor/` when it exists), and
the checks the project defines. It takes no input. The discovery is the same one the
host checks use at closeout, so a unit that reads it runs what the host will run.

## `run_tests` and `run_checks`

These are the session's own runs of the project's test command and its deterministic
checks. The output is bounded: a summary with counts and the names of failing tests,
plus at most a few thousand characters of output when something failed. `run_tests`
takes an optional `filter`, a test-name pattern that is applied when the harness owns
the command. Both tools throw only when the command could not run at all.

Two things distinguish them from the [host checks](/reference/host-checks) of the same
name.

The first is that they produce the session's evidence. Every result is stamped with the
revision it ran against and whether the tree was dirty, and stored as a session entry,
so a claim in the report can name what it rests on. The host's evidence is separate:
the closeout gate does not read these entries, and it re-runs the checks with its own
runner at the committed revision.

The second is that they feed the preflight on `report_result`. A report that cites
`test` or `command` evidence must correspond to a run in this session, on a committed
tree, at the current revision, that passed. Otherwise the report is refused before it is
written, and the refusal says why. This catches the cheap lie, a report that says "tests
pass" when no tests were run, at the point it is told.

## `report_result`

`report_result` is the one way a unit answers its contract. It is called once, as the
last action of a contracted unit, after the checks have been run. The model supplies
the [result report's fields](/reference/definition#work-contracts): `summary`,
`evidence[]`, `delegatedResults[]`, `unresolvedOutcomes[]`, `emergentDecisions[]`,
`deviations[]` and `residualUncertainty[]`. The host binds the report to the contract id
and version, the unit and the attempt, and writes it to the execution store. A report is
never revised; when a new attempt runs, it writes its own.

Two gates run before the report is written. The evidence preflight described above
refuses a report whose cited runs did not happen. The report check refuses one that
leaves a delegated decision unreported or a required expectation unaddressed. A session
that ends without calling `report_result` at all is recorded as `no-report`, which is a
cause the recovery policy answers.

The report's claims satisfy nothing at closeout; the host checks produce the evidence
there. What the report does feed is the regulatory log. Each `residualUncertainty`
entry becomes an `uncertainty-signal`, each `emergentDecision` and each `deviation`
becomes an `operational-signal`, and the router decides what obligations they open.

## `ask_human`

`ask_human` interrupts a person under an interaction contract. Its input:

| Field | Meaning |
| --- | --- |
| `kind` | `recap`, `choice`, `clarification`, `consent` or `uat` |
| `subject`, `question` | what the question is about, and the question itself, including what the unit would do under each answer |
| `options[]` | for a `choice`: two to six options. Required for that kind |
| `action` | for `consent`: the irreversible action a yes authorizes, stated concretely. Required for that kind |
| `evidence[]` | what the person needs in order to decide |

What each kind does:

| Kind | Waits | Severity | A yes means | Shipped timeout |
| --- | --- | --- | --- | --- |
| `recap` | no: it offers decisions for correction and continues | `advisory` | there is no yes to wait for; any answer is `fixed` | 30 s |
| `choice` | yes | `blocking` | `fixed` | 2 min |
| `clarification` | yes | `blocking` | `fixed` | 5 min |
| `consent` | yes | `blocking` | `accepted`; anything else is `rejected` | 5 min |
| `uat` | yes | `blocking` | `verified`; anything else is `rejected` | 10 min |

The call opens an `interaction` obligation owed to a person and records the request. In
an interactive session the host asks through its dialogs and waits the policy's timeout
for that kind. The answer is recorded as the person's disposition, and the session
continues, told what was decided. In a headless session, or after a timeout or a
cancellation, nothing is answered. The obligation stays open and is delivered to the
outbox, and for every kind but `recap` the pause gate refuses every tool with an effect
for the rest of the session. The unit's attempt is recorded as `paused`. Later,
`regulator answer` resolves the obligation, and the next attempt is told the answer as
its hint.

That only a recap continues without an answer is a protocol constant, so no policy can
make silence into consent. The policy's `attention.blockingPerAttempt` caps how many
waiting questions one attempt may ask, and the tool refuses once the cap is reached.
The cap exists because attention is the scarcest budget. [Asking a
person](/concepts/asking-a-person) explains why.

## `notify_owner`

`notify_owner` sends a message to the unit's owner, outside the repository, as one line
in the outbox (`REGULATOR_OUTBOX`, default `.regulator/outbox`). Its input is a
`message`. It is the shipped example of a *durable* side effect. Before it acts, the
call writes `intended` to the effect journal under an idempotency key made of the unit,
the tool and the message, and after it acts it writes `committed`. A key that is
already committed is refused, so sending the same message twice on purpose needs
different words. On every session start, each `intended` entry with no outcome is
reconciled against the outbox before any new effect runs. Together these mean that a
harness that loses its process between the effect and its record neither repeats the
effect nor forgets it.

## `remember`

`remember` records a fact about the environment for later units. Its input is a
`subject`, a `note`, `evidence[]`, a `reviewBy` date (required, in the future, and at
most 90 days out) and an optional `scope` of unit types. The host stamps the entry with
the unit, revision and time. The fact is rendered into the context of later units of
the scoped types until it expires. It is operational memory, and it never becomes
identity. See
[intelligence and memory](/concepts/intelligence-and-memory#operational-memory).

## `report_intelligence`

`report_intelligence` records what a research unit found out about the environment.
Its input is a `subject`, a `claim`, an `observation`, a `confidence`, a
`reportedSeverity`, `evidence[]` (at least one entry), `affectedUnits[]`, and
optionally `observedAt` and `expiresAt`. The call writes an `intelligence-signal` with
the unit, revision and time as provenance, and the router opens one obligation per
affected unit. Nothing else changes. See
[intelligence and memory](/concepts/intelligence-and-memory#intelligence).

## `propose_policy_change`

`propose_policy_change` asks for a change to identity or policy. Its input is a
`subject` (a path, an invariant or a policy field), a `rationale` and a
`requestedChange`. The call writes a `policy-proposal` to the regulatory log, and under
the shipped routing policy that proposal is owed to S5 at any severity. The call itself
changes nothing, because a proposal is not policy (INV-002). A person with `actAsS5`
decides it with `regulator identity accept` or `identity reject`, and an accepted file
is the only way an identity file changes.

## Tools that are not a unit's

`vsm_report_audit_finding`, `vsm_report_uncertainty` and `vsm_propose_policy_change`
belong to a separate, generic reporting extension that the Pi host exports for hosts
that embed it. They write the SQLite event store (`.regulator/events.db`), and the
extension is not among the eleven a unit's session loads, so a unit never sees these
tools. [Typed reporting](/REPORTING) describes them. A unit has no uncertainty tool; it
reports uncertainty through its result report.
