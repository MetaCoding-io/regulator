# Packages

Six packages, published together from one repository, all Apache-2.0. Dependency
direction is explicit and points one way: the control plane never imports a host.

```
regulator-protocol  ◄──  regulator-core  ◄──  regulator-checks
                                                   ▲
                    regulator (control plane) ─────┘
                       ▲                ▲
              regulator-pi (Pi host)    control-room
```

## `@metacoding.io/regulator`

The product: the `regulator` CLI (`bin`), the S3 loop, the stores, the host seam, and
the definition beside the code — registry, identity seed, profiles, policies,
workloads, evals, contracts and fixtures. `regulator init` copies the identity seed
into a repository; every other command runs against the definition as shipped.

The host seam is a name: `unit dispatch` and `unit drive` resolve
`@metacoding.io/regulator-pi` (or `--host` / `REGULATOR_HOST`) from the project, then
beside the CLI, and call its dispatcher. `doctor`, `status`, `check` and a scripted eval
need no host.

## `@metacoding.io/regulator-pi`

The Pi host. Eleven session extensions, each one concern — `tools`, `profiles`,
`coordination`, `contract`, `budget`, `recovery`, `evidence`, `authority`,
`intelligence`, `identity`, `algedonic` — declared under `pi.extensions` so
`pi install <path>` loads them into a hand-run session; the dispatcher that runs a unit's
session through the Pi SDK with the definition's settings; the write gate and the typed
reporting tools. Pi is a peer dependency at a pinned version, and `doctor` compares the
pin with what is installed.

## `@metacoding.io/regulator-protocol`

The typed protocol: every schema the definition and the instance are validated against
— messages and trace, effects, profiles, registry records, work contracts and result
reports, workloads, execution records, policies, obligations, interaction, memory,
evals, spans, the instance manifest — as TypeBox schemas with runtime validation.

## `@metacoding.io/regulator-core`

Pi-free mechanisms: the event store, the lease store, the thrash detector, the contract
and report checks, the execution store, the budget meter and policy resolution, the
recovery router, the effect journal, the obligation ledger and the router with the
progression veto, identity parsing and rendering, authority-reference resolution, the
memory store, the definition check and the registry renderer.

## `@metacoding.io/regulator-checks`

The deterministic S3\* checks: the [host checks](/reference/host-checks), the technical
verdict, the audit log, the write preflight the Pi extension and the CLI share, and the
conventions that discover a project's test and check commands.

## `@metacoding.io/regulator-control-room`

A read-only page over the `status` read model: instances, units, obligations, budgets,
review dates, and a replay view of a unit's records. It renders; it has no command that
changes anything, and that is deliberate.

## Versions and releases

All six are released together at one version (`0.1.0`), from a `v*` tag, after
`pnpm check` passes on both supported Node versions. The
[changelog](/project/changelog) is the package's; the course,
[Viable Agents](https://metacoding-io.github.io/regulator-website/index.html), pins the version
each cohort builds against.
