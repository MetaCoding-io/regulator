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
| `run_tests` | the project's test command, discovered from `package.json` scripts or a `test/` directory | the run's summary reports no failing test in the unit's worktree. Output with no summary the host can parse is `inconclusive`, not a failure |
| `run_checks` | the checks the host discovers from the project's layout: `syntax:<file>`, which is `node --check` on each `.js` and `.mjs` file directly under `src/` and `lib/`, and `protected-untouched`, which is `git status` over the protected paths. It does not run a project's lint, typecheck or build | every syntax check exits 0, and nothing under a protected path is modified |
| `inherited-tests` | the base's test files and `package.json`, staged over the unit's tree and run, then compared with the base's own run at the merge base | the suite the unit inherited still passes against its tree, and no inherited test file shrank. A contract may `exempt` files it changes on purpose |
| `identity-untouched` | a diff of the protected prefixes (the harness-owned directories `regulator/identity/` and `regulator/advice/`, the manifest's `protectedPaths`, and the discovered conventions: `vendor/`, and `flake.nix`, `flake.lock`, `devenv.nix`, `devenv.lock` and `devenv.yaml` when present) between the base ref the unit branched from and its revision | nothing under a protected prefix changed. A contract that means to change the environment names the files on an expectation carrying `{ "kind": "identity-untouched", "exempt": [...] }`; only those five names are admitted, and the record binds to that expectation |
| `export-signature` | for each contract expectation with an `export-signature` check, reads the named module and export | the export exists with the declared arity. The check observes the module's content itself and does not rely on the report |
| `file:<ref>` | for every `file`-class evidence reference in the unit's report, `git cat-file -e HEAD:<ref>`. Not named in a workload: the host adds one record per reference | the file is in the tree at the unit's revision |
| `glossary-lint` | the words under "Words this instance does not use" in the instance's `GLOSSARY.md`, checked over the comment lines the unit added under the writable prefixes and over its branch's commit messages | none of the refused words appear in the comments. A refused word in a commit message fails the check too, unless the workload's entry says `{ "name": "glossary-lint", "options": { "commitMessages": "advisory" } }`; in that case it is recorded as evidence and as an `audit-finding` at `advisory`, and it refuses nothing. The software workload declares this option; the finance and portfolio workloads do not. Code identifiers are the project's business and are not read |

Every record names the environment it ran in: `node`, `platform`, `arch` and, when one
is found in the worktree the check ran in, the `toolchain` by hash (`nix-store`, `lock` or
`package-lock`, tried in that order; see the [instance reference](/reference/instance)).
Two records under different toolchains can be told apart; nothing compares the hash with
a target platform's.

## What a check is not

- A check is not a sandbox. The checks read the worktree at a revision, and they do not
  confine the session. Real isolation is the operating system's or a container's, and
  the [enforcement boundary](/reference/boundary) lists what each gate does not cover.
- A check is not the model's review. A `verify` unit may also read the diff and say what
  it found in its result report. That is a `model-judgment` layer on top of the checks,
  and whatever it reports as an emergent decision, a deviation or a residual uncertainty
  is routed like any other report finding.
- A check is not a criterion no host can observe. An expectation of class `semantic`,
  `model` or `runtime` without a content check waits for `unit accept <id> <criterion> --by <who>`,
  and the acceptance is recorded beside the verdict instead of being folded into it.

## Adding a check

Adding a check means changing several places together. The new name is added to
`HOST_CHECK_NAMES` in the protocol, the check is implemented in
`@metacoding.io/regulator-checks`, the workloads that need it name it, and it gets a
registry record with its limitations and its ablation arm. The `inherited-tests` check
is the worked example: its record, its `no-inherited-tests` arm and the `suiteWeakened`
grader in the drift suite all landed together.
