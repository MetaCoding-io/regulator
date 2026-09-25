# Session tools

The tools a unit's session may call, beyond the runtime's own `read`, `write`, `edit`,
`grep`, `find`, `ls` and `bash`. Each is registered by one of the Pi host's extensions
with a runtime schema, and each declares its *effect* — filesystem, execution, network,
side effects — which is what a capability profile grants over. A profile that calls
itself read-only may list only tools whose declared effect is read-only, and the
definition check refuses one that does not.

The active tool set of a session is exactly the profile's list. A tool the profile does
not name is not merely refused; the model never sees it.

| Tool | Effect | Granted by (shipped profiles) | Records |
| --- | --- | --- | --- |
| [`read_conventions`](#read_conventions) | read-only | every profile | nothing |
| [`run_tests`](#run_tests-and-run_checks) | runs project code | `implement`, `bookkeeper` | a provenance entry in the session |
| [`run_checks`](#run_tests-and-run_checks) | read-only | every profile | a provenance entry in the session |
| [`report_result`](#report_result) | writes the execution store | every contracted session (see the note) | the result report |
| [`ask_human`](#ask_human) | irreversible: attention | `implement`, `intelligence`, `bookkeeper` | an `interaction` obligation |
| [`notify_owner`](#notify_owner) | irreversible: a message | `implement`, `bookkeeper` | the effect journal, the outbox |
| [`remember`](#remember) | writes the memory store | `implement`, `bookkeeper` | a memory entry |
| [`report_intelligence`](#report_intelligence) | writes the regulatory log | `intelligence` | an `intelligence-signal` |
| [`propose_policy_change`](#propose_policy_change) | writes the regulatory log | `implement`, `intelligence`, `bookkeeper` | a `policy-proposal` |

::: tip `report_result` needs no grant
A contracted unit must be able to report, so the contract extension puts
`report_result` on the active tool surface when the contract loads, whatever the
profile lists; a profile need not name it. A session with no contract never sees it.
:::

## `read_conventions`

What can be determined mechanically about the project, as opposed to what its README
claims: the real test command and where it was found (`package.json` `scripts.test`,
or `node --test` when a `test/` directory exists), the source directories among `src/`
and `lib/`, the protected paths (`vendor/` when it exists), and the checks the project
defines. Takes no input. The same discovery the host checks use at closeout, so a unit
that reads it runs what the host will run.

## `run_tests` and `run_checks`

The session's own run of the project's test command and deterministic checks, bounded:
a summary with counts and the names of failing tests, and at most a few thousand
characters of output when something failed. `run_tests` takes an optional `filter`
(a test-name pattern, applied when the harness owns the command). Both throw only when
the command could not run at all.

Two things distinguish them from the [host checks](/reference/host-checks) of the same
name:

- **They are the session's evidence, not the host's.** Every result is stamped with the
  revision it ran against and whether the tree was dirty, as a session entry, so a
  claim in the report can name what it rests on. The closeout gate does not read them;
  it re-runs the checks with its own runner at the committed revision.
- **They feed the preflight on `report_result`.** A report that cites `test` or
  `command` evidence must correspond to a run *in this session*, *on a committed tree*,
  *at the current revision*, that *passed*. Otherwise the report is refused before it is
  written, with the reason. This catches the cheap lie — "tests pass" with no tests run
  — at the point it is told.

## `report_result`

The one way a unit answers its contract. Called once, as the last action of a
contracted unit, after running the checks. The model supplies the
[result report's fields](/reference/definition#work-contracts): `summary`,
`evidence[]`, `delegatedResults[]`, `unresolvedOutcomes[]`, `emergentDecisions[]`,
`deviations[]` and `residualUncertainty[]`. The host binds it to the contract id and
version, the unit and the attempt, and writes it to the execution store. A report is
never revised: a new attempt writes its own.

Before it is written, two gates run. The evidence preflight above refuses a report
whose cited runs did not happen. The report check refuses one that leaves a delegated
decision unreported or a required expectation unaddressed. A session that ends without
calling it is recorded as `no-report`, a cause the recovery policy answers.

The report's claims satisfy nothing at closeout. Each `residualUncertainty` entry
becomes an `uncertainty-signal`, each `emergentDecision` and each `deviation` an
`operational-signal`, and the router decides what they open.

## `ask_human`

Interrupt a person under an interaction contract. Input:

| Field | Meaning |
| --- | --- |
| `kind` | `recap`, `choice`, `clarification`, `consent` or `uat` |
| `subject`, `question` | what it is about, and the question with what the unit would do under each answer |
| `options[]` | for a `choice`: two to six options; required for that kind |
| `action` | for `consent`: the irreversible action a yes authorizes, concretely; required for that kind |
| `evidence[]` | what the person needs to decide |

What each kind does:

| Kind | Waits | Severity | A yes means | Shipped timeout |
| --- | --- | --- | --- | --- |
| `recap` | no: offers decisions for correction and continues | `advisory` | — (any answer is `fixed`) | 30 s |
| `choice` | yes | `blocking` | `fixed` | 2 min |
| `clarification` | yes | `blocking` | `fixed` | 5 min |
| `consent` | yes | `blocking` | `accepted`; anything else is `rejected` | 5 min |
| `uat` | yes | `blocking` | `verified`; anything else is `rejected` | 10 min |

The call opens an `interaction` obligation owed to a person and records the request.
In an interactive session the host asks through its dialogs and waits the policy's
timeout for the kind; the answer is recorded as the person's disposition and the
session continues, told what was decided. Headless, or on a timeout or a cancellation,
nothing is answered: the obligation stays open, it is delivered to the outbox, and for
every kind but `recap` the **pause gate** refuses every tool with an effect for the
rest of the session. The unit's attempt is recorded as `paused`; `regulator answer`
resolves the obligation and the next attempt is told the answer as its hint.

That only a recap continues without an answer is a protocol constant, so no policy can
make silence into consent. The policy's `attention.blockingPerAttempt` caps how many
waiting questions one attempt may ask; the tool refuses past it. Attention is the
scarcest budget.

## `notify_owner`

Send a message to the unit's owner, outside the repository: one line in the outbox
(`REGULATOR_OUTBOX`, default `.regulator/outbox`). Input: `message`. It is the shipped
example of a *durable* side effect. The call writes `intended` to the effect journal
under an idempotency key (the unit, the tool, the message) before it acts, and
`committed` after; a key already committed is refused, so the same message sent twice
on purpose needs different words; and on every session start each `intended` with no
outcome is reconciled against the outbox before any new effect runs. A harness that
loses its process between the effect and its record neither repeats it nor forgets it.

## `remember`

Record a fact about the environment for later units. Input: `subject`, `note`,
`evidence[]`, `reviewBy` (required, in the future, at most 90 days out) and an optional
`scope` of unit types. The host stamps the unit, revision and time. Rendered into the
context of later units of the scoped types until it expires; never identity. See
[intelligence and memory](/concepts/intelligence-and-memory#operational-memory).

## `report_intelligence`

Record what a research unit found out about the environment. Input: `subject`, `claim`,
`observation`, `confidence`, `reportedSeverity`, `evidence[]` (at least one),
`affectedUnits[]`, and optionally `observedAt` and `expiresAt`. Writes an
`intelligence-signal` with the unit, revision and time as provenance; the router opens
one obligation per affected unit. Changes nothing else. See
[intelligence and memory](/concepts/intelligence-and-memory#intelligence).

## `propose_policy_change`

Ask for a change to identity or policy. Input: `subject` (a path, an invariant, a policy
field), `rationale`, `requestedChange`. Writes a `policy-proposal` to the regulatory
log, owed to S5 under the shipped routing policy at any severity. It changes nothing: a
proposal is not policy (INV-002). A person with `actAsS5` decides it with
`regulator identity accept` or `identity reject`, and the accepted file is the only way
an identity file changes.

## Tools that are not a unit's

`vsm_report_audit_finding`, `vsm_report_uncertainty` and `vsm_propose_policy_change`
are a separate, generic reporting extension the Pi host exports for hosts that embed
it; they write the SQLite event store (`.regulator/events.db`) and are not among the
eleven extensions a unit's session loads. [Typed reporting](/REPORTING) describes them.
A unit reports uncertainty through its result report, not a tool.
