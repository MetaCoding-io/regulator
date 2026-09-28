# Host checks

A host check is evidence the harness produces itself, at the unit's revision, after the
session has ended. A workload names the checks each unit type runs; the results are
recorded in the audit log and summarized into the technical verdict, and a failed check
is a `check-failure` for the recovery policy. The session's own claim that it ran the
tests is a claim beside the evidence, never the evidence.

| Check | What it runs | Passes when |
| --- | --- | --- |
| `run_tests` | the project's test command, discovered from `package.json` scripts or a `test/` directory | the command exits 0 in the unit's worktree |
| `run_checks` | the project's check commands (lint, typecheck, build), discovered the same way | every command exits 0 |
| `inherited-tests` | the base's test files and `package.json`, staged over the unit's tree and run; compared with the base's own run at the merge base | the suite the unit inherited still passes against its tree, and no inherited test file shrank — a contract may `exempt` files it changes on purpose |
| `identity-untouched` | a diff of the protected prefixes (`regulator/identity/`, the manifest's `protectedPaths`, discovered conventions such as `vendor/`) between the base ref the unit branched from and its revision | nothing under a protected prefix changed |
| `export-signature` | for each contract expectation with an `export-signature` check, reads the named module and export | the export exists with the declared arity; observed by content, not by the report |
| `glossary-lint` | the words under "Words this instance does not use" in the instance's `GLOSSARY.md`, over the comment lines the unit added under the writable prefixes and its branch's commit messages | none of the refused words appear there; code identifiers are the project's business and are not read |

## What a check is not

- **Not a sandbox.** The checks read the worktree at a revision; they do not confine the
  session. Real isolation is the operating system's or a container's, and the
  [enforcement boundary](/reference/boundary) lists what each gate does not cover.
- **Not the model's review.** A `verify` unit may also read the diff and say what it found
  in its result report; that is a `model-judgment` layer on top of the checks, and what it
  reports as an emergent decision, a deviation or a residual uncertainty is routed like
  any other report finding.
- **Not a criterion no host can observe.** An expectation of class `semantic` or `model`
  without a content check waits for `unit accept <id> <criterion> --by <who>`; the
  acceptance is recorded beside the verdict, not folded into it.

## Adding a check

A new check name is added to `HOST_CHECK_NAMES` in the protocol, implemented in
`@metacoding.io/regulator-checks`, named by the workloads that need it, and gets a registry
record with its limitations and its ablation arm. The `inherited-tests` check is the
worked example: its record, its `no-inherited-tests` arm and the `suiteWeakened` grader
in the drift suite landed together.
