# Packages

The project is six packages, published together from one repository, all under
Apache-2.0. The dependency direction is explicit and points one way: the control plane
never imports a host. In the diagram, each arrow points from a package to the package
it imports.

```
regulator-protocol  ◄──  regulator-core  ◄──  regulator-checks
                                                   ▲
                    regulator (control plane) ─────┘
                       ▲                ▲
              regulator-pi (Pi host)    control-room
```

## `@metacoding.io/regulator`

This package is the product. It holds the `regulator` CLI (its `bin`), the S3 loop, the
stores and the host seam, and it ships the definition beside the code: the registry, the
identity seed, the profiles, the policies, the workloads, the evals, the contracts and
the fixtures. The one command that copies any of this out is `regulator init`, which
places the identity seed into a repository. Every other command runs against the
definition as shipped.

The host seam is a package name. `unit dispatch` and `unit drive` resolve
`@metacoding.io/regulator-pi` (or whatever `--host` / `REGULATOR_HOST` names instead)
from the project first and then from beside the CLI, and they call the dispatcher it
exports. The commands that run no session need no host at all, so `doctor`, `status`,
`check` and a scripted eval all work without one. [Hosts](/concepts/hosts) explains the
seam in full and lists what a host must write back for the loop to read.

## `@metacoding.io/regulator-pi`

This package is the Pi host, the only host today. It holds eleven session extensions,
each covering one concern: `tools`, `profiles`, `coordination`, `contract`, `budget`,
`recovery`, `evidence`, `authority`, `intelligence`, `identity` and `algedonic`. They
are declared under `pi.extensions`, so `pi install <path>` can load them into a session
that someone runs by hand. The package also holds the dispatcher, which runs a unit's
session through the Pi SDK with the definition's settings, together with the write gate
and the typed reporting tools. Pi itself is a peer dependency at a pinned version, and
`doctor` compares that pin with what is actually installed.

## `@metacoding.io/regulator-protocol`

This package is the typed protocol. It holds every schema that the definition and the
instance are validated against, written as TypeBox schemas with runtime validation:
messages and the trace, effects, profiles, registry records, work contracts and result
reports, workloads, execution records, policies, obligations, interaction, memory,
evals, spans and the instance manifest. Every other package depends on it.

## `@metacoding.io/regulator-core`

This package holds the mechanisms that do not depend on Pi: the event store, the lease
store, the thrash detector, the contract and report checks, the execution store, the
budget meter and policy resolution, the recovery router, the effect journal, the
obligation ledger and the router with the progression veto, identity parsing and
rendering, authority-reference resolution, the memory store, the definition check and
the registry renderer. Nothing in it imports a host.

## `@metacoding.io/regulator-checks`

This package holds the deterministic S3\* checks. It has the
[host checks](/reference/host-checks), the technical verdict, the audit log, the write
preflight that the Pi extension and the CLI share, and the conventions that discover a
project's test and check commands.

## `@metacoding.io/regulator-control-room`

The control room is a read-only page over the `status` read model. It shows instances,
units, obligations, budgets and review dates, and it has a replay view that walks
through a unit's records. It only renders. It has no command that changes anything, and
that is deliberate.

## Writing a host

A host is a package that exports one object, `host`. The control plane resolves that
package by name at run time and never imports it:

```ts
export const host: Host = {
  name: "@your/regulator-host",
  runtime: { name: "<the agent runtime package>", pin: "<its version>" },
  extensions: ["tools", "profiles", …],       // the session-side gates, in load order
  extensionPath: (name) => "<absolute path of the built extension>",
  dispatcher: (options) => async (request) => { /* run one attempt; return { sessionId } */ },
};
```

The dispatcher receives one `DispatchRequest` per attempt. The request carries the unit
id, the worktree, the contract and the file it was loaded from, the profile name, the
attempt number, the model route, the policy file, and the hint left by the previous
attempt. The dispatcher runs a session with the definition's settings, the profile's
tools and the contract in context, and it returns when the session ends. Everything the
loop needs afterwards (the report, the evidence, the trace) is already in the stores,
and the dispatcher writes nothing else. Which gates a host enforces inside the session
is the host's own to declare, and the enforcement boundary records which host enforces
which.

`unit dispatch` and `unit drive` find the host in a fixed order: `--host <package>`
first, then `REGULATOR_HOST`, then `@metacoding.io/regulator-pi`. Whichever name wins is
resolved from the project first and then from beside the CLI. `doctor` reads the runtime
pin the host declares and reports it against what is installed. A second host behind
this seam is tracked as [#58](https://github.com/MetaCoding-io/regulator/issues/58).

## Versions and releases

All six packages are released together at one version (`0.1.4` today). A release is cut
from a `v*` tag, and only after `pnpm check` passes on both supported Node versions. The
[changelog](/project/changelog) is the packages' own. The course,
[Viable Agents](https://metacoding-io.github.io/regulator-website/index.html), pins the
version that each cohort builds against.
