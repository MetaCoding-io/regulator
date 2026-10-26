# Authoring a workload

The control plane is generic over workloads only if a third one can be written by
someone who did not build the first two. This page is the recipe from the
[household ledger](../examples/personal-finance.md) turned into a checklist, written
from the experience of adding the [managed portfolio](../examples/portfolio.md), with
one question answered at every step: *is this yours to decide, or the harness's?* A
workload author decides what the domain is, what may touch it and how it is checked.
The harness decides how a decision is enforced, verified, recovered from and owed.

## What is yours, and what is the harness's

| You decide | The harness decides |
| --- | --- |
| The domain output and the source of truth, and which prefixes are protected | That a protected prefix is diffed against the base at every closeout (`identity-untouched`), and that the manifest's prefixes join the harness-owned ones |
| The unit types: their names, the profile each runs under, and which host checks judge each one | Which checks exist (`HOST_CHECK_NAMES`), how each is run, and that a verdict comes from fresh evidence at the committed revision, never from the report |
| The profiles: the tools by declared effect, the writable prefixes, whether there is a shell | That `write` and `edit` are refused outside the prefixes, that a read-only profile grants only read-only effects, and that a contracted type's profile must grant `report_result` |
| The domain's own checks and the test command that runs them | That the command is discovered from `package.json` or a `test/` directory, run by the host at closeout and again on the merged tree before anything lands, and that an inherited test file may not shrink |
| The budgets and model routes per unit type | That a ceiling crossed ends the attempt, that attempts are counted, and that the recovery policy decides what happens next by cause |
| Each contract: what is fixed, delegated and unresolved, the authority each fixed decision cites, and the evidence expected | That a fixed decision's authority must resolve (an invariant, a regulator, an obligation or a person), that a delegated choice must be reported, and that an unresolved decision has no "settled" outcome |
| When a person must be asked, what the question names, and how many questions a list of actions deserves | That an unanswered question pauses the unit, is owed to a person, is delivered to the outbox and reminded about, that silence is never consent, and that the answer reaches the next attempt as its hint |
| The advice: what a unit is told that no gate can know | That advice is a file per profile, seeded into the instance, rendered under a budget and changed only by `advice accept` |
| The fixture's data, so each check has something to refuse | — |
| The scripted behaviours: one that keeps the contracts and one that drifts in the ways the checks exist to catch | That the drifting one is refused by name, routed to repair, and lands nothing on the base until it passes |

Two things are never yours. A unit may not read its own progress off the domain: what
is done is execution state in the orchestrator's store, and a check reads the tree, not
the unit's report. And a rule the harness can enforce mechanically is not solved by
writing it into the advice; the advice is the bottom of the hierarchy by definition.

## The checklist

Each step names the check that proves it before the next step starts.

1. **Name the domain output and the source of truth.** Decide what is protected and
   which files are the person's. Write the fixture: a directory with its data, a
   `README.md` saying who writes what, and a `package.json` whose `scripts.test` runs
   the domain's checks (`node --test` is enough). Put `lib/` and `test/` and the person's
   files outside every prefix a unit may write.
   *Proof:* `cd <fixture> && npm test` passes on the shipped data.

2. **Write the checks first.** If the domain has no deterministic check of its own,
   stop: you are about to build a system whose only verification is self-report. Each
   check is an assertion over the tree, with a message that names the file and the
   number. A number a check reads has to live in the tree; a contract can fix it, but
   the check cannot read the contract.
   *Proof:* the same `npm test`, and a scratch copy of the fixture with one deliberate
   fault per check, each refused by its own assertion.

3. **Register the fixture.** Add its directory to the `declaration` class in
   [`packages/protocol/src/definition-writers.ts`](../../packages/protocol/src/definition-writers.ts),
   or the definition check refuses it as a definition directory in no class; then
   regenerate `BOUNDARY.md` (`pnpm --filter @metacoding.io/regulator registry:docs`).
   *Proof:* `regulator check` passes.

4. **Declare the workload.** `workload/<name>.json`: the unit types, each with its
   profile and its checks. A read-only type gets `run_tests`, `inherited-tests` and
   `identity-untouched`; a writing type adds `run_checks` and `glossary-lint`; a type
   that only confirms gets none.
   *Proof:* `regulator check` passes with the new workload counted.

5. **Declare the profiles.** `profiles/<name>.json` with the tools by effect and the
   writable prefixes, and `advice/<name>.md` beside it — the definition check refuses a
   profile with no advice file. Reuse a shipped profile where the grant is the same
   (the portfolio reuses the `auditor`). No shell for a profile whose grant must be
   complete at the tool boundary.
   *Proof:* `regulator check`; the tests that enumerate the shipped profiles and advice
   files (`profiles.test.ts`, `instance.test.ts`, `cli.test.ts`, `registry.test.ts`)
   updated to include the new one.

6. **Set budgets and routes.** `policies/<name>.json`, per unit type. A unit that asks
   for consent spends its first attempt on the question, so give it one more than the
   work needs.
   *Proof:* `regulator check` refuses a policy that names a unit type no workload
   declares.

7. **Write one contract per unit of the first piece of work.** Fixed, delegated,
   unresolved, expected evidence. Cite an invariant or a person for every fixed
   decision. Put the consent rule in the contract of the unit that commits, as a fixed
   decision that says what the question names and how many questions a list gets.
   *Proof:* `regulator contract check <file>` says `dispatchable` for each.

8. **Script the close.** `src/<name>-scripted.ts` with two behaviours and
   `src/<name>.test.ts` in the shape of `finance.test.ts`: an instance from the fixture,
   the units driven under the workload and its policy, the evidence read off the audit
   log, the consent question paused and answered, the protected prefixes compared byte
   for byte with the fixture afterwards. The drifting behaviour has to drift in the ways
   the checks exist to catch, which means the fixture's data has to carry those
   situations: a lot inside the wash-sale window, a deposit inside the period, a
   position outside the universe.
   *Proof:* `node --test packages/regulator/dist/<name>.test.js`, then `pnpm check`.

9. **Declare your metric and its grader.** If the workload has a number worth
   comparing across arms — the portfolio's turnover, a corpus F₁ — declare it in
   `workload/<name>.json` under `metrics[]`: the name as `workload:<name>/<metric>`, its
   kind and direction, and a `grader.argv` naming a file under the definition
   (`workload/<name>/<metric>.mjs`) that the host runs in the instance after each unit.
   The grader reads the tree through the fixture's own `lib/` and writes one JSON line,
   `{ metric, value, observation }`; it never reads a unit's report, and it is not a
   model. Put the arithmetic in `lib/` as a pure function with a test. Then a small
   suite under `evals/` pre-registers the metric beside the built-ins. A metric that
   needs a model's judgment names an instrument and waits for the instrument record.
   *Proof:* `regulator check` passes with the declaration (it refuses a name the
   workload does not own, a grader naming no file, a second optimisation target), and
   `regulator eval evals/<suite>.json --behaviour <name>` prints the metric per arm
   with its interval.

10. **Give the fixture a flag.** `regulator fixture <dest> --<name>` in `src/cli.ts`
   (the usage line is the CLI reference page), and the directory in `package.json`'s
   `files`, or the published package ships without it.
   *Proof:* `regulator fixture /tmp/x --<name>` and `regulator init` there, then
   `regulator doctor`.

11. **Write the worked example** to the shape of the ledger's: the six questions and
    the level of every answer, the declaration file by file, how to run it, what it does
    not do. Link it from the docs navigation.
    *Proof:* `pnpm --filter regulator-docs build` passes its dead-link check.

12. **Track it.** The roadmap row, the design note's status line, and a debt row for
    any limitation that names later work.

## What the portfolio had to decide, and what it was given

Writing the third workload against this checklist, these were the decisions that were
actually the author's. Everything else was already decided.

- **Where a check's number lives.** The rebalance band is fixed by the contract, but a
  check cannot read a contract, so the band has to be in a file, and the file has to be
  one no unit can write. The portfolio puts it in `benchmark.json`, beside the subset
  tolerances; the contract names the same number. A first draft put it in the target
  file a unit writes, which would have let the unit widen the band it was checked
  against. If a check's number lives in a file under a write grant, the check is
  reading what the unit wrote.
- **How many questions a trade list gets.** One. A rebalance is one decision with many
  legs. The question names every leg, the lot each sell comes from and the tax it
  realises, because that is what the person consents to; the attempt ceiling allows
  for the attempt that asked.
- **What the drifting behaviour does.** Each shortcut was chosen so one named assertion
  refuses it: a sell past the target, a sell from a lot the portfolio does not hold, a
  loss sale inside the window of a recent fill. The data had to be arranged so the
  honest plan avoids each one and the careless plan walks into each one.
- **What "reconcile" means for the lots.** The lots file is derived from the person's
  fills and reconciled to the custodian's export of the date it says it is current to;
  a position the custodian carries without a fill has no lot and is an open item,
  never a guess.
- **Which rules wait.** The design names checks on a harvest's benefit and on an
  executed wash sale's cost-basis adjustment; there is no harvest unit yet, so the
  checks are not written. The design puts a risk tolerance in the identity; the number
  is not set, so the check is not written. A rule without the number it needs is
  recorded as waiting, not approximated.

And these were the harness's, found by running the checklist rather than by reading
about them: the definition check refused the fixture directory until it had a class
and the profile until it had an advice file; the shipped tests that enumerate profiles
and advice files refused the sixth; `inherited-tests` passed by construction because no
unit may write under `test/`; the merged tree was checked before each merge landed
without anything being declared for it; the paused attempt, the outbox delivery and
the hint on the next attempt came for free from one `ask_human` with `kind=consent`;
and the glossary's refused words applied to the scripted unit's commit messages, since
the branch is read whatever wrote it.

[#61](https://github.com/MetaCoding-io/regulator/issues/61) also asks for a template, a
`regulator workload new <name>` that writes these files with the check passing. Until
it exists, the checklist above is the template, and the portfolio's files are the copy
to start from.
