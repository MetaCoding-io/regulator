# Definition, instance, domain

Three things with three owners. Keeping them apart is what lets one control plane run
against many repositories, and what stops a run's traces from becoming a second source
of truth.

## The definition

The definition is what the control plane *is*: versioned, checked, shipped with the
package. It is declared, not assembled.

| Part | Where | What it declares |
| --- | --- | --- |
| Registry | `registry/regulators/*.json` | one record per regulator |
| Identity seed | `identity/*.md` | the four S5 files every instance starts from |
| Profiles | `profiles/*.json` | what a unit type may use and write |
| Policies | `policies/*.json` | budgets and model routes, recovery, routing, interaction |
| Workloads | `workload/*.json` | unit types, their profiles and their checks |
| Evals | `evals/*.json` | suites with declared arms and ablations |
| Contracts and fixtures | `contracts/`, `fixture*/` | the examples the package runs against itself |
| Settings | `settings.json` | the Pi settings a unit's session runs under |

`regulator check` validates all of it together: every profile a workload names exists,
every tool a profile grants is declared with its effect, a contract-less unit type runs
under a read-only profile, every registry record cites tests that exist and states a
limitation, no review date has passed. The check runs under `pnpm check`, so the
definition cannot drift from the code that enforces it. The
[definition reference](/reference/definition) documents each file.

A change to the definition is a pull request. The identity seed has one more path: an
identity decision accepted in an instance is promoted into the seed with
`regulator identity promote`, so every later `init` starts from it.

## The instance

An instance is one repository running under one definition at one revision. `regulator
init` creates it; the [instance layout](/reference/instance) lists what it holds. Two
kinds of state live there, in different stores, and neither infers the other:

- **Execution state** — units, attempts, leases, budgets consumed, worktrees — in the
  orchestrator's store. Only the loop writes it.
- **Regulatory state** — trace, signals, obligations, evidence, verdicts, memory, the
  effect journal — in append-only logs and the event store. Regulators write it; the
  loop reads it to decide what a unit may do next.

Nothing in `.regulator/` is configuration and a person edits none of it by hand. What a
person *declares* about an instance — the writable and protected prefixes, who
initialized it — is in the manifest, written by `init` and read by the profile grant
and the closeout. The manifest also pins the definition's revision: an instance
initialized under an older revision shows `definition-drift` in `doctor` until a person
reads the upgrade note and runs the next unit.

The repository's own files — `.pi/`, `AGENTS.md`, extensions, skills — say nothing to
the harness. That is the trust rule: the project is the domain, and the domain does not
configure its regulator.

## The domain

The domain is the repository: the code, the tests, the ledger, whatever the workload is
about. Units change it, in worktrees, on branches, and the loop reintegrates what
verified. The harness reads it as evidence at a revision (the host checks) and never as
state. Two files are the exception, and they are the domain's only harness-owned
content: `regulator/identity/` — the instance's copy of the S5 files, committed, and
protected by the write gate, the bash snapshot-and-restore and the `identity-untouched`
check — and the `.regulator/` line in `.gitignore`.

## Why the split matters

- A run's trace under `.regulator/` can be deleted and the definition still says exactly
  what the control plane does.
- Two repositories under the same definition behave the same way, differing only in
  what their manifests declare.
- The eval harness can run the same suite against a fixture under different arms
  because an arm is a definition-level choice — which extensions load, which checks
  run, whether identity is seeded — not a property of an instance.
- Promotion has a direction: instance → definition, by a person, with a rationale,
  committed in the definition's repository. Nothing flows the other way by itself.
