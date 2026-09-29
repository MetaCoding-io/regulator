# ADR 0001 — regulator provides its own orchestrator

- Status: accepted, 2026-09-22 (the project was still named VSM-Pi at the time; it
  became `regulator` on 2026-09-24, together with the repository)
- Deciders: the maintainer
- Supersedes: the GSD-hosted scope recorded in
  [`docs/archive/2026-09/`](../archive/2026-09/README.md)

## Context

Until 22 September 2026 the project was scoped as a regulation layer *on* GSD-Pi. Under
that scope, GSD would own the workflow kernel and regulator would project VSM functions
onto its units. By the time of the decision, four course checkpoints of gates, effects,
profiles, trace and registry had already run on bare Pi, with no GSD underneath.

## Decision

regulator provides its own orchestrator. That orchestrator is the production form of
`regulator`, the harness the course builds. GSD-Pi remains in the course as comparison
material only. There is no GSD adapter, and `packages/` has no GSD dependency.

## Reasons

- GSD-Pi was in the middle of a cutover to a database-authoritative lifecycle (its
  ADR-046). An adapter written during the cutover would have had to be written twice.
- OpenGSD was fanning out into gsd-path and gsd-workbench, and each quarter that
  narrowed the "what GSD is missing" framing the project had been using.
- The course lab had demonstrated that the regulation layer needs *an* orchestrator,
  and that the orchestrator does not have to be GSD's.
- The research question (does regulation slow architectural drift?) is cleaner to ask
  as *our orchestrator with regulators ablated versus enabled* than as GSD versus
  GSD+regulator.

## Consequences

The control plane is declared rather than assembled. An *instance* runs from a
*definition*, and the definition has four parts:

```text
definition = regulator registry      what regulates, at which level, evidenced how, bounded how
           + capability profiles     positive grants over declared tool effects
           + policies                budgets, recovery, routing, interaction
           + workload                unit types, their profiles and host checks
```

The definition is versioned and checked by `regulator check`, and changing it is an S5
act. Instance state is the orchestrator's execution store plus the regulatory stores
under `.regulator/`, and an instance can be rehydrated from those alone.

The orchestrator itself is small. It is the S3 loop and nothing more:

```text
contract → dispatch (Pi SDK) → verify (host-run) → route (recovery lattice) → close
```

with leases, budgets and attempts kept as immutable records, and the whole of it generic
over workloads. What made GSD heavy (fixed phases, milestone lifecycles, UAT,
projections) is *workload*, so it lives in a workload definition and stays out of the
loop.

Workloads follow from that split. The software-development autoloop is the first
workload definition, with the unit types `plan`, `research`, `implement`, `verify`,
`integrate` and `close`. `personal-finance` is the second. A second workload is a second
definition; the loop is not forked for it.

Each of the GSD-era workstreams was built in a lesson of the course:

| Workstream | Built in |
| --- | --- |
| Operational work contract | lesson 06 |
| Obligations, routing, attenuation | lessons 08, 11, 13 |
| Capabilities and separation of duty | lessons 04, 09, 10, 12, 13 |
| Hook and process integration | lessons 02 and 03 |
| S2 coverage | lesson 05 (execution-level) and issue #14 (semantic) |
| S4 operating model | lesson 11 |
| Human/S5 governance | lessons 12 and 13 |
| Evaluation and economics | lesson 14 |

Some things remain deferred: RDF/SHACL, full VSM recursion, broad S4 integrations,
autonomous S5 mutation and production-grade benchmarks. AGENTS.md keeps that list.
