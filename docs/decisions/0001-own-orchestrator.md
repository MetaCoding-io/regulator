# ADR 0001 — VSM-Pi provides its own orchestrator

- **Status:** accepted, 2026-09-22
- **Deciders:** the maintainer
- **Supersedes:** the GSD-hosted scope recorded in
  [`docs/archive/2026-09/`](../archive/2026-09/README.md)

## Context

Until 22 September 2026 the project was scoped as a regulation layer *on* GSD-Pi: GSD
would own the workflow kernel and VSM-Pi would project VSM functions onto its units.
Four course checkpoints of gates, effects, profiles, trace and registry had by then run
on bare Pi without GSD.

## Decision

VSM-Pi provides its own orchestrator. It is the production form of `regulator`, the
harness the course builds. GSD-Pi remains in the course as comparison material; there is
no GSD adapter and `packages/` has no GSD dependency.

## Reasons

- GSD-Pi was mid-cutover to a database-authoritative lifecycle (its ADR-046); an adapter
  written then would have been written twice.
- OpenGSD was fanning out (gsd-path, gsd-workbench), narrowing the "what GSD is missing"
  framing each quarter.
- The course lab had demonstrated that the regulation layer needs *an* orchestrator, not
  GSD's.
- The research question — does regulation slow architectural drift? — is cleaner as
  *our orchestrator with regulators ablated versus enabled* than as GSD versus
  GSD+VSM-Pi.

## Consequences

**Definition and instance.** The control plane is declared, not assembled. An *instance*
runs from a *definition*:

```text
definition = regulator registry      what regulates, at which level, evidenced how, bounded how
           + capability profiles     positive grants over declared tool effects
           + policies                budgets, recovery, routing, interaction
           + workload                unit types, their profiles and host checks
```

The definition is versioned and checked (`regulator check`); changing it is an S5 act.
Instance state is the orchestrator's execution store plus the regulatory stores under
`.regulator/`, and an instance can be rehydrated from those alone.

**The orchestrator, sized.** It is the S3 loop and nothing more:

```text
contract → dispatch (Pi SDK) → verify (host-run) → route (recovery lattice) → close
```

with leases, budgets, and attempts as immutable records, generic over workloads. What
made GSD heavy — fixed phases, milestone lifecycles, UAT, projections — is *workload*,
and lives in a workload definition, not in the loop.

**Workloads.** The software-development autoloop is the first workload definition (unit
types `plan`, `research`, `implement`, `verify`, `integrate`, `close`); `personal-finance`
is the second, and a second workload is a second definition, not a fork of the loop.

**Where the GSD-era workstreams went.** Each has a lesson:

| Workstream | Built in |
| --- | --- |
| Operational work contract | lesson 06 |
| Obligations, routing, attenuation | lessons 08, 11, 13 |
| Capabilities and separation of duty | lessons 04, 09, 10, 12, 13 |
| Hook and process integration | lessons 02–03 |
| S2 coverage | lesson 05 (execution-level); issue #14 (semantic) |
| S4 operating model | lesson 11 |
| Human/S5 governance | lessons 12–13 |
| Evaluation and economics | lesson 14 |

**Still deferred.** RDF/SHACL, full VSM recursion, broad S4 integrations, autonomous S5
mutation, production-grade benchmarks (AGENTS.md).
