# Getting started

`regulator` installs into a git repository you already have and runs *units* of work
against it. Each unit is an agent session that runs under a work contract, in a worktree
of its own. The host verifies the unit with checks it runs itself, and the unit closes
only when that evidence says the work is done. This page takes you from an empty shell
to a first closed unit.

## What you need

- Node 22.19 or later. Both Node 22 and 24 are tested.
- [Pi](https://pi.dev/) 0.87.0, the agent runtime the units run on, with at least one
  model provider key in Pi's environment (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, …).
  The model routes in the default policy name Anthropic, OpenAI and Google models. If
  you use other providers, copy
  [`policies/default.json`](/reference/definition#budget-and-model-policy) out of the
  installed package, change the routes, and pass the copy as `--policy <file>` to
  `unit drive` (see [customizing the definition](/guide/operating#customizing-the-definition)).
- A git repository with a clean tree, checked out on the branch that units should land
  on.

## Install

There are two packages, and running a unit needs both. `@metacoding.io/regulator` is the
control plane: it provides the `regulator` CLI and carries the definition (the registry,
the identity, the profiles, the policies and the workload) beside the code.
`@metacoding.io/regulator-pi` is the Pi host: it holds the session extensions and the
dispatcher that runs a unit's session. The CLI finds the host by name when it needs one,
and `doctor`, `status` and a scripted eval need no host at all.

```sh
pnpm add -D @metacoding.io/regulator @metacoding.io/regulator-pi
```

::: tip From source
To run the unreleased head, clone the repository, run `pnpm install && pnpm build`, and
link the two packages with `pnpm link --global` in `packages/regulator` and
`packages/regulator-pi`. Everything below is the same from there.
:::

## Install into your repository

```sh
cd /path/to/your/repo
regulator init --writable src/,test/ --protected vendor/ --by alice
```

`init` does five things and commits them on your branch:

1. It seeds the identity under `regulator/identity/`: `IDENTITY.md`, `INVARIANTS.md`,
   `GLOSSARY.md` and `BOUNDARIES.md`, the files no unit may write.
2. It adds `.regulator/` to `.gitignore`, because that directory holds the instance's
   state and is never source.
3. It records any credential-looking value found in a committed `.env` as a *canary*,
   and every tool result is then watched for that value.
4. It writes the instance manifest, `.regulator/instance.json`. The manifest records
   which definition the instance runs, at which revision, under which Pi, when it was
   initialized and by whom (`--by`, or else your user and host), and the layout you
   declared.
5. It refuses to run twice. There is no re-init; an existing instance moves to a new
   definition only through an upgrade that a person performs.

`--writable` names the paths where the implement profile may write directly; the
profile's own default is `src/` and `test/`. `--protected` adds to the set of paths under
which the closeout refuses to accept a change. `regulator/identity/` is always protected,
and so is `vendor/` whenever it exists.

## Declare who may answer

Every command that dispositions something takes `--by <who>` and checks that name
against the `people` list in the
[interaction policy](/reference/definition#interaction-policy) before it writes
anything. The commands are `answer`, `obligation resolve`, `obligation
ack`, `obligation escalate`, `identity accept`, `identity reject`, `identity promote` and
`memory retract`. A name the policy does not list may disposition nothing. The shipped
policy names three people, `course-lab`, `alice` and `bob`, which is why the examples on
this site say `--by alice`.

To act under your own name, copy the policy out of the installed package, add yourself
to it, and point the CLI at your copy:

```sh
cp node_modules/@metacoding.io/regulator/policies/interaction.json regulator/interaction.json
```

```json
{ "name": "sam", "resolveUpTo": "critical", "acceptRisk": true, "actAsS5": true }
```

```sh
regulator answer 3f2a --by sam --answer "yes" --interaction regulator/interaction.json
export REGULATOR_INTERACTION_POLICY=$PWD/regulator/interaction.json   # for sessions you run by hand
```

`resolveUpTo` is the highest severity the person may resolve. `acceptRisk` says whether
they may disposition an obligation as `accepted-risk`, and `actAsS5` whether they may
accept or reject an identity proposal. `unit accept` is checked at `blocking`, since a
criterion has no severity of its own. Two commands, `init` and `eval`, record `--by`
without checking it; there the name is kept as provenance and grants no authority.

## Check the instance

```sh
regulator doctor
```

`doctor` is the operating check, and it is also the entry point for CI. It checks the
runtime, git, the Pi pin against what is installed, the definition, the review dates,
the manifest, whether the base is clean, and what is owed and undelivered. It exits 1 on
any problem and prints what to do about it. `regulator doctor --json` gives the same
result in a form a script can read.

## Write a contract

A unit runs under a *work contract*. The contract says what the unit is for, what is
fixed, what is delegated and within which bounds, what nobody has decided yet, and what
evidence will show that the work is done. Contracts are JSON, validated against the
schema and against the workload the contract names:

```json
{
  "kind": "task",
  "id": "tc-fix-flaky-date-test",
  "version": 1,
  "unitId": "u1",
  "unitType": "implement",
  "workload": { "name": "software-development", "version": 1 },
  "objective": "Make test/date.test.js deterministic: it fails when the month has 31 days.",
  "constraintRefs": [],
  "fixed": [
    { "id": "f-api", "subject": "public API", "decision": "formatDate keeps its signature.", "authorityRef": "human:alice" }
  ],
  "delegated": [
    { "id": "d-fix", "subject": "how the test is fixed", "bounds": "Inside test/date.test.js and src/date.js; no new dependencies." }
  ],
  "unresolved": [],
  "expectedEvidence": [
    { "id": "e-tests", "description": "run_tests reports every test passing", "class": "test", "required": true }
  ],
  "provenance": { "createdBy": "S3", "createdAt": "2026-09-24T00:00:00.000Z" }
}
```

```sh
regulator contract check contracts/fix-flaky-date-test.json
```

The [definition reference](/reference/definition#work-contracts) lists every field. The
package also ships three contracts against its own fixture under `contracts/`, which you
can copy from.

## Drive the unit

```sh
regulator unit drive contracts/fix-flaky-date-test.json
```

`drive` is the autoloop. It leases the unit, creates a worktree and a branch for it,
opens a Pi session under the `implement` profile with the contract in context, and waits
for the session to end. It then runs the host checks that the workload names for the
unit type (`run_checks`, `run_tests`, `inherited-tests`, `identity-untouched`,
`export-signature` and `glossary-lint`) against the unit's revision and reaches a
technical verdict. On a pass it closes the unit and reintegrates its branch. On a
failure it routes the cause through the recovery policy and runs again, for as long as
the budget and the policy allow. Whatever the policy cannot resolve on its own becomes
an obligation owed to you.

```sh
regulator unit show u1        # the record: attempts, decisions, the report, obligations
regulator unit evidence u1    # the audit log: evidence, verdicts, acceptances
regulator obligations         # what is owed, to whom, and what it blocks
```

## Answer what is owed

A unit that needs a decision asks for one through `ask_human`. The question becomes an
obligation owed to a person, it is delivered to `.regulator/outbox`, and the unit pauses
until someone answers. Answer it and drive again:

```sh
regulator answer 3f2a --by alice --answer "Strip accents; do not transliterate."
regulator unit drive contracts/fix-flaky-date-test.json
```

Findings above the routing policy's line, proposals to change the identity, and
escalations the recovery policy hands to a person are all obligations of the same kind,
and each one is dispositioned with `obligation resolve`, `identity accept` or
`identity reject`. [Running units](/guide/running-units) walks through the whole cycle,
and [Operating](/guide/operating) describes how a team keeps an instance running.
