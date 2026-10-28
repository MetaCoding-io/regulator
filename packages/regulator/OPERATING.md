# Operating `regulator`

How a team runs the reference build on Monday, and who owns it in three months. The
harness is infrastructure: it has a distribution, a version, a settings scope, an
upgrade path, a security posture and an owner. This file is the operating note the
package ships with; the course's lesson 15 (Viable Agents) is the long version.

## Install

Two packages. `@metacoding.io/regulator` is the control plane: the `regulator` CLI is its
`bin`, and the definition — registry, identity, profiles, policies, workload, evals —
ships beside the code. `@metacoding.io/regulator-pi` is the Pi host: the session
extensions (declared in its `package.json` under `pi.extensions`) and the dispatcher
that runs a unit's session. The CLI finds the host by name — in the project, then
beside itself — and needs none for `doctor`, `status`, `check` or a scripted run.

```sh
pnpm add -D @metacoding.io/regulator @metacoding.io/regulator-pi   # released; `regulator` is on the path via pnpm
pnpm regulator doctor
```

From source, for the unreleased head:

```sh
git clone https://github.com/MetaCoding-io/regulator && cd regulator
pnpm install && pnpm build          # both Node versions CI runs are fine: >= 22.19
pi install ./packages/regulator-pi          # every session extension, into user settings; -l for project settings
# or, for one session without installing:
pi -e ./packages/regulator-pi/dist/tools.js -e … -e ./packages/regulator-pi/dist/algedonic.js
```

`pnpm --filter @metacoding.io/regulator regulator -- <command>` runs the CLI from
the workspace; a global link (`pnpm link --global` in `packages/regulator`) gives `regulator`
on the path.

## Install into a repository

The harness installs into an existing git repository; it does not create one.

```sh
cd /path/to/your/repo               # clean tree, on the branch units should land on
regulator init --writable lib/,test/ --protected vendor/ --by alice
regulator doctor                    # exit 1 on any problem
regulator unit drive packages/regulator/contracts/fix-known-issue.json
```

`init` seeds the identity under `regulator/identity/` and the profiles' advice under
`regulator/advice/`, ignores `.regulator/`, records
any credential-looking value in a committed `.env` as a credential canary, writes
`.regulator/instance.json` — the *instance manifest*: which definition, at which
revision, under which Pi, initialized when and by whom, and the layout you declared —
and commits the identity on the base branch. Everything the lab once assumed about the
fixture's layout is a declaration here or a discovered convention:

| The lab assumed | Now |
| --- | --- |
| `src/` and `test/` are writable | the profile's prefixes, or `--writable` in the manifest (a read-only profile stays read-only) |
| `vendor/` is protected | `regulator/identity/` and `regulator/advice/` always (the instance paths of `DEFINITION_WRITERS`); `vendor/` when it exists (convention); `--protected` for the rest |
| `npm test` or `node --test` | discovered from `package.json` scripts or a `test/` directory (`packages/checks/src/conventions.ts`) |
| the glossary's words | `regulator/identity/GLOSSARY.md`, "Words this instance does not use", read by `glossary-lint` |
| the tests a unit may not weaken | the base's `test/` and `package.json`, staged and run by `inherited-tests` against the unit's tree; a contract exempts the files it changes on purpose |

For a domain that is not software, the same steps with different prefixes:
`regulator fixture ~/ledger --finance`, then `init --writable ledger/,reports/,payments/pending/
--protected statements/,payments/executed/` — the worked example in
[`docs/examples/personal-finance.md`](../../docs/examples/personal-finance.md) walks the design
and the declaration; `regulator fixture ~/portfolio --portfolio`, then `init --writable
lots/,targets/,trades/proposed/,reports/ --protected positions/,prices/,trades/executed/`
(never `trades/pending/`, which only the workload's `place_trade` tool reaches), is
the third workload's ([`docs/examples/portfolio.md`](../../docs/examples/portfolio.md)).

The manifest is harness-owned and written by a person. The project's own files —
`.pi/`, `AGENTS.md`, extensions, skills — still say nothing to the harness (the trust
rule, lesson 10).

## Settings and environment

| Where | What |
| --- | --- |
| `packages/regulator/settings.json` | the Pi settings a unit's session runs under, held in memory by the dispatcher; the project's `.pi/settings.json` is never read |
| `packages/regulator/policies/*.json` | budgets and model routes, recovery, routing, interaction (timeouts, attention, reminders, people) |
| `packages/regulator/profiles/*.json` | what a unit type may use and write |
| `REGULATOR_OUTBOX` | where `notify_owner` and delivery write (default `<repo>/.regulator/outbox`) |
| `REGULATOR_INTERACTION_POLICY` | a different interaction policy for a session run by hand |
| `PI_*`, provider keys | Pi's own environment (`docs/environment-variables.md`); the harness reads none of them |

Nothing in the instance is configuration: `.regulator/` holds records, the manifest and
the outbox, and a person edits none of it by hand.

## Customizing the definition

The definition ships with the package and is read from there. Nothing in an instance
overrides it by being edited in place; a change is a file you pass, so it is visible on
the command line and in the record.

| To change | Pass | To which commands |
| --- | --- | --- |
| budgets and model routes | `--policy <file>` (a copy of `policies/default.json`) | `unit drive`, `unit dispatch`, `unit route`; `REGULATOR_POLICY` for a session run by hand |
| what S3 does with a blocked unit | `--recovery <file>` (a copy of `policies/recovery.json`) | `unit drive`, `unit route` |
| what becomes an obligation, for whom, and what vetoes | `--routing <file>` (a copy of `policies/routing.json`) | `unit drive`, `unit dispatch`, `unit route`, `unit close` |
| who may answer, timeouts, reminders, attention | `--interaction <file>` (a copy of `policies/interaction.json`) | every command that takes `--by`, and `answer`, `remind`, `watch`, `unit route`, `unit close`; `REGULATOR_INTERACTION_POLICY` for a session run by hand |
| the identity seed, profiles, workloads, registry | a forked definition directory | `init --definition <dir>`; `identity promote --definition <dir>`; `status --definition <dir>`; `doctor --definition <dir>` |

A copied policy keeps its `name` and bumps its `version`; the read model and the
eval fingerprint record which version ran. The shipped interaction policy names
`course-lab`, `alice` and `bob`; a team's first change is a copy with its own people
(see [getting started](../../docs/guide/getting-started.md#declare-who-may-answer)).

A forked definition is the way to change what a copied policy cannot: the identity
seed's invariants and glossary for your domain, a profile's grant, a workload's unit
types, a registry record. Copy the package's definition directory, change it, run its
check (`node dist/registry-cli.js check` in the copy, or `regulator doctor --definition
<dir>`), and initialize instances from it. The worked example under
[`docs/examples/personal-finance.md`](../../docs/examples/personal-finance.md) is a fork
of exactly this kind.

## Headless and CI

- `regulator doctor --json` — runtime, git, the Pi pin against what is installed, the
  registry and definition checks, review dates (overdue is a problem; due within 30
  days is listed), the instance manifest, whether the instance was initialized under
  this definition revision, the base's cleanliness, what is owed and undelivered.
  Exit 1 on any problem. Run it in CI and before the first unit of the day.
- `regulator check` (`node dist/registry-cli.js check`) — the definition's own check,
  under `pnpm check`; an overdue review date fails it.
- `regulator eval <suite> --behaviour reference --reps 1 --out <file>` — the harness's
  own smoke test, headless.
- `regulator watch --once --exec <cmd>` — one delivery tick; without `--once` it is the
  daemon a quiet instance needs: deliver, remind, forward each new outbox line to the
  channel command, with a cursor so a restart forwards nothing twice.
- `pi --mode json` / RPC for a non-Node host: a unit's session is an ordinary Pi
  session; the dispatcher (`dispatcher.ts`) is the SDK embedding to copy.

## Upgrading

Two things move under an instance: the definition (a package version, with a git
revision behind it) and the Pi the host pins. Each is a change with evidence, and the
manifest says which the instance is at.

### The definition

An instance's manifest records the package version and the revision it was initialized
or last upgraded under. When a newer package is installed, `doctor` reports
`definition-drift` and says to run `regulator upgrade`; the command carries the
instance forward and nothing else does.

```sh
pnpm add -D @metacoding.io/regulator@latest @metacoding.io/regulator-pi@latest
regulator doctor                       # definition-drift: the installed package is newer — run `regulator upgrade`
regulator upgrade --check              # the plan: what would be seeded, which versions are crossed, the notes
regulator upgrade --by alice           # apply, print the notes, commit, rewrite the manifest
regulator doctor                       # green: the version, the history and what it was checked against
```

What `upgrade` applies is a closed list, each step idempotent and reported: it seeds any
file of a harness-owned directory the instance lacks from the definition's seed
(`regulator/advice/` for an instance initialized before advice was a file set; a
profile's advice file added since; `regulator/identity/` if it were ever absent) and
never overwrites a file that exists, since a decided identity or advice file is the
instance's own; and it adds the `.regulator/` line to `.gitignore`. `init` renders no
other file into an instance, so there is nothing to re-render. Everything else a release
changed — a policy, a workload, a profile, the registry, the seed of a file the instance
already has — is read from the definition or is the person's to act on, and `upgrade`
prints it verbatim from the release's migration note, under a heading per version
crossed, with the gate each change passed before it landed: `check` (`regulator check`
only), `scripted` or `live` (a committed eval report, by the SHA-256 of its file), or
`none`. The note is a `### Migration` section under each version of `CHANGELOG.md`,
in a shape the command parses; a version between the instance's and the installed one
without a section refuses the whole upgrade, so no instance is carried through a version
nobody wrote the note for.

The command refuses a dirty base checkout, an instance ahead of the installed package,
and a definition whose own `regulator check` fails; `--by` is checked against the
interaction policy as S5, the way `identity accept` and `advice accept` are, because the
seeds land under the directories only S5 writes. It commits what it changed on the base
branch in one commit citing from and to, and rewrites `.regulator/instance.json` with
the version, the revision, the registry count, the pin and one entry in `upgrades[]`:
from, to, who, when, and the fingerprint of the committed report under `evals/reports/`
whose `harnessRevision` is the target's — the evidence the instance's definition now
rests on — or `none`, with a printed warning, when no report ran at that revision. The
fingerprint is read, never computed; `upgrade` runs no eval. A second run on the same
instance changes nothing and says so. The manifest is written by `init` and `upgrade`
only; `doctor` reports it and upgrades nothing. A manifest written before the package
version existed (0.1.0 to 0.1.3) is read as 0.1.3, the changelog's migration floor.

The definition's own release path: an identity decision accepted in an instance
(`regulator identity accept`) is promoted into the seed with
`regulator identity promote <file>.md --by <who> --rationale <text>`, which commits in
the definition's repository so every later `init` starts from it; an advice decision
(`regulator advice accept`) the same way with `regulator advice promote <profile>.md`.
A promoted seed reaches an instance that already has its own copy only as a bullet of
the next release's migration note: `upgrade` seeds what is absent and leaves a decided
file alone. The release itself is a person's step (CONTRIBUTING.md § Releasing): the
commit that bumps the version turns `[Unreleased]` and its migration note into the
version's.

### The Pi pin

The Pi version is pinned (`peerDependencies` in `packages/regulator-pi/package.json`;
`doctor` compares it with what is installed, and the manifest records it). An upgrade
is a change with evidence:

1. Bump the pin; run `pnpm install`.
2. Walk the course's feature matrix (`FEATURE-MATRIX.md` in the Viable Agents repository): every Pi surface a module uses is a row.
3. `pnpm check` on both CI Node versions.
4. Run the drift suite headlessly (`regulator eval packages/regulator/evals/drift.json
   --behaviour reference`) and, with a model, live; commit the live report with an
   interpretation. A committed report at the release's revision is what `upgrade`
   records as the fingerprint an instance was upgraded against.
5. Release: the pin change is a definition change the migration note names with its
   gate, and instances meet it through `regulator upgrade` — the manifest's `pi` is
   rewritten with the rest, and `doctor` is green again. There is no re-init.

## Security posture

- Real isolation is the operating system's or a container's (Pi's
  `docs/containerization.md`); the gates protect the calls that reach them and
  `BOUNDARY.md` — generated from the registry — lists what each does not cover.
- The shell is granted to the implement profile un-gated by path; the bash watch
  restores protected paths and the closeout diff catches the rest at the revision.
  For untrusted or unattended runs, the container declares the shell's reach.
- Credentials: credential canaries from a committed `.env` are watched in tool results and
  redacted from spans; anything else is the deployment's secret manager.
- Authority: no tool can supply S5 authority; a person runs `identity accept`,
  `advice accept` and their `promote` siblings, checked against the interaction
  policy's people (asserted names, not authenticated ones). `BOUNDARY.md` § Who writes
  the definition says which files each command may write, and that a grant changes
  only by a merged change.

## Ownership: the harness as a viable system

Apply the model to the harness itself:

- **Identity (S5):** this repository's `vsm/` for regulator; the lab's `identity/` for the
  definition. Changed by proposal and a person's decision, never by a unit.
- **Policy:** the four policy files; a change is a pull request with `pnpm check`
  green on both Node versions.
- **Audit (S3\*):** `pnpm check`, `regulator check`, the drift suite's committed
  reports, and the review dates every registry record carries.
- **Intelligence (S4):** the Pi feature matrix, the migration note per release and the upgrade path above.
- **Operations (S3):** whoever runs `doctor` and `watch`, answers what the outbox
  delivers, and reads `regulator review --due` once a month.

Each active registry record names its owner and its review date. When the date passes
the check fails; the record is reviewed, moved, or retired — a recorded decision, not a
deletion.
