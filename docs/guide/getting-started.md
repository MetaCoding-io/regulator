# Getting started

`regulator` installs into a git repository you already have and runs *units* of work
against it: each unit is a coding-agent session under a work contract, in its own
worktree, verified by checks the host runs, and closed only when the evidence says so.
This page takes you from an empty shell to a first closed unit.

## What you need

- Node 22.19 or later (both Node 22 and 24 are tested).
- [Pi](https://pi.dev/) 0.87.0 — the coding agent the units run on — and at least one
  model provider key in Pi's environment (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, …).
  The model routes in the default policy name Anthropic, OpenAI and Google models; edit
  [`policies/default.json`](/reference/definition#budget-and-model-policy) if you use
  others.
- A git repository with a clean tree, on the branch units should land on.

## Install

Two packages. `@metacoding/regulator` is the control plane: the `regulator` CLI and the
definition (registry, identity, profiles, policies, workload) beside the code.
`@metacoding/regulator-pi` is the Pi host: the session extensions and the dispatcher
that runs a unit's session. The CLI finds the host by name and needs none for `doctor`,
`status` or a scripted eval.

```sh
pnpm add -D @metacoding/regulator @metacoding/regulator-pi
```

::: tip Until 0.1.0 is on npm
Clone the repository, `pnpm install && pnpm build`, and link the two packages
(`pnpm link --global` in `packages/regulator` and `packages/regulator-pi`). Everything
below is the same.
:::

## Install into your repository

```sh
cd /path/to/your/repo
regulator init --writable src/,test/ --protected vendor/ --by alice
```

`init` does five things, and commits them on your branch:

1. seeds the identity — `IDENTITY.md`, `INVARIANTS.md`, `GLOSSARY.md`, `BOUNDARIES.md` —
   under `regulator/identity/`, the files no unit may write;
2. adds `.regulator/` to `.gitignore`: that directory is the instance's state, never source;
3. records any credential-looking value in a committed `.env` as a *canary*, watched in
   every tool result;
4. writes the instance manifest, `.regulator/instance.json`: which definition, at which
   revision, under which Pi, initialized when and by whom (`--by`, or your user and
   host), and the layout you declared;
5. refuses to run twice: there is no re-init, only a definition upgrade by a person.

`--writable` is where the implement profile may write directly (its own default is
`src/` and `test/`); `--protected` adds to what the closeout refuses to accept a change
under. `regulator/identity/` is always protected, and `vendor/` is when it exists.

## Check the instance

```sh
regulator doctor
```

`doctor` is the operating check and the CI entry point: the runtime, git, the Pi pin
against what is installed, the definition, review dates, the manifest, whether the base
is clean, what is owed and undelivered. It exits 1 on any problem and prints what to
do. `regulator doctor --json` is the same for a script.

## Write a contract

A unit runs under a *work contract*: what it is for, what is fixed, what is delegated
and within which bounds, what nobody has decided yet, and the evidence that will show
it is done. Contracts are JSON, validated against the schema and the workload:

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
package ships three contracts against its own fixture under `contracts/` to copy from.

## Drive the unit

```sh
regulator unit drive contracts/fix-flaky-date-test.json
```

`drive` is the autoloop. It leases the unit, creates a worktree and a branch, opens a
Pi session under the `implement` profile with the contract in context, and waits. When
the session ends it runs the host checks the workload names for the unit type —
`run_checks`, `run_tests`, `inherited-tests`, `identity-untouched`, `export-signature`,
`glossary-lint` — against the unit's revision, reaches a technical verdict, and either
closes the unit and reintegrates its branch, or routes the failure through the recovery
policy and runs again while the budget and the policy allow. What the policy cannot
resolve on its own becomes an obligation owed to you.

```sh
regulator unit show u1        # the record: attempts, decisions, the report, obligations
regulator unit evidence u1    # the audit log: evidence, verdicts, acceptances
regulator obligations         # what is owed, to whom, and what it blocks
```

## Answer what is owed

A unit that needs a decision asks for one through `ask_human`; the question is an
obligation owed to a person, delivered to `.regulator/outbox`, and the unit pauses.
Answer it and drive again:

```sh
regulator answer 3f2a --by alice --answer "Strip accents; do not transliterate."
regulator unit drive contracts/fix-flaky-date-test.json
```

Findings above the routing policy's line, proposals to change the identity, and
escalations the recovery policy hands to a person are all obligations of the same kind,
each dispositioned with `obligation resolve`, `identity accept` or `identity reject`.
[Running units](/guide/running-units) walks the whole cycle; [Operating](/guide/operating)
is how a team keeps an instance running.
