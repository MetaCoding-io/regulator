# Host checks

A host check is evidence the harness produces itself, at the unit's revision, after the
session has ended. Because it runs after the session and against the committed
revision, its result does not depend on anything the session said about its own work.
A workload names the checks each unit type runs. The results are
recorded in the audit log and summarized into the technical verdict, and a failed check
reaches the recovery policy as a `check-failure`. The session's own claim that it ran
the tests is recorded beside this evidence, and it never counts as the evidence.

| Check | What it runs | Passes when |
| --- | --- | --- |
| `run_tests` | the project's test command, discovered from `package.json` scripts or a `test/` directory | the command exits 0 in the unit's worktree |
| `run_checks` | the project's check commands (lint, typecheck, build), discovered the same way | every command exits 0 |
| `inherited-tests` | the base's test files and `package.json`, staged over the unit's tree and run, then compared with the base's own run at the merge base | the suite the unit inherited still passes against its tree, and no inherited test file shrank. A contract may `exempt` files it changes on purpose |
| `identity-untouched` | a diff of the protected prefixes (`regulator/identity/`, the manifest's `protectedPaths`, and discovered conventions such as `vendor/`) between the base ref the unit branched from and its revision | nothing under a protected prefix changed |
| `export-signature` | for each contract expectation with an `export-signature` check, reads the named module and export | the export exists with the declared arity. The check observes the module's content itself and does not rely on the report |
| `glossary-lint` | the words under "Words this instance does not use" in the instance's `GLOSSARY.md`, checked over the comment lines the unit added under the writable prefixes and over its branch's commit messages | none of the refused words appear in the comments. A refused word in a commit message fails the check too, unless the workload's entry says `{ "name": "glossary-lint", "options": { "commitMessages": "advisory" } }`; in that case it is recorded as evidence and as an `audit-finding` at `advisory`, and it refuses nothing. The software workload declares this option and the finance workload does not. Code identifiers are the project's business and are not read |

## What a check is not

- A check is not a sandbox. The checks read the worktree at a revision, and they do not
  confine the session. Real isolation is the operating system's or a container's, and
  the [enforcement boundary](/reference/boundary) lists what each gate does not cover.
- A check is not the model's review. A `verify` unit may also read the diff and say what
  it found in its result report. That is a `model-judgment` layer on top of the checks,
  and whatever it reports as an emergent decision, a deviation or a residual uncertainty
  is routed like any other report finding.
- A check is not a criterion no host can observe. An expectation of class `semantic` or
  `model` without a content check waits for `unit accept <id> <criterion> --by <who>`,
  and the acceptance is recorded beside the verdict instead of being folded into it.

## Adding a check

Adding a check means changing several places together. The new name is added to
`HOST_CHECK_NAMES` in the protocol, the check is implemented in
`@metacoding.io/regulator-checks`, the workloads that need it name it, and it gets a
registry record with its limitations and its ablation arm. The `inherited-tests` check
is the worked example: its record, its `no-inherited-tests` arm and the `suiteWeakened`
grader in the drift suite all landed together.
