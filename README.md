# VSM-Pi

**Cybernetic control for agentic software development.**

VSM-Pi is a coding-agent harness on [Pi](https://pi.dev/) with an explicit cybernetic control plane. It asks whether Stafford Beer's Viable System Model can be made operational inside an autonomous software-development system—not as five chatbot personas, but as explicit functions, authority boundaries, typed channels, verification gates, and feedback loops—and it provides its own orchestrator to find out.

The course under [`course/`](course/) builds VSM-Pi lesson by lesson: its lab, `regulator`, is the reference build, and each checkpoint promotes into `packages/` as it stabilizes. [GSD-Pi](https://github.com/open-gsd/gsd-pi) appears throughout the course as a comparison—another system's answer to the same problems—not as a dependency.

The project starts from a simple premise:

> **Prompts advise. Types describe. Gates enforce.**

Prompt engineering remains useful where judgment is required, but VSM-Pi prefers TypeScript types, runtime schemas, deterministic checks, narrow tool contracts, and host-owned verification whenever the system can know or enforce something mechanically.

## Design goals

- Keep the orchestrator small: the S3 loop—contract → dispatch → verify → route → close—with leases and budgets, generic over workloads.
- Declare the control plane rather than assemble it: an instance runs from a versioned, checked definition (regulator registry, capability profiles, policies, workload).
- Make S5 identity and policy durable, version-controlled, and independent of individual model context windows.
- Keep S3* audit independent of S1 self-reporting.
- Differentiate S1 workers by operational capability profiles, not roleplay personas.
- Give S4 explicit mechanisms for environmental intelligence and future-facing research.
- Represent feedback as typed channels with provenance and authority, rather than as undifferentiated prompt context.
- Prefer deep Pi TypeScript integration over prompt-only orchestration.

## Working VSM mapping

| VSM function | Initial VSM-Pi interpretation |
| --- | --- |
| **S1 — Operations** | Coding, data, UI, infrastructure, migration, and integration capability profiles |
| **S2 — Coordination** | Tool contracts, worktree isolation, leases with liveness, reintegration, and anti-oscillation mechanisms |
| **S3 — Control** | The orchestrator: work contracts, dispatch, budgets, the recovery lattice, and execution-state authority |
| **S3\* — Audit** | Harness-run verification plus architectural/domain checks and independent audit findings |
| **S4 — Intelligence** | Read-only specialists and external/environmental intelligence feeding planning and reassessment |
| **S5 — Identity/Policy** | Versioned product identity, architecture, domain model, invariants, and policy |

## Mechanism hierarchy

When adding a feature, prefer mechanisms in this order:

1. **Can this be a TypeScript invariant?** Use the type system.
2. **Can this be deterministically checked at runtime?** Write a gate/check.
3. **Can this be represented as a structured tool or protocol?** Use a runtime schema and typed message.
4. **Does this require interpretation or judgment?** Use an LLM.
5. **Does the LLM need additional context?** Apply prompt/context engineering.

## Where it is

Shipped in `packages/`: the typed VSM protocol and channel vocabulary, committed S5 artifacts, protected S5 write paths in a loadable Pi extension, typed policy-proposal / audit-finding / uncertainty tools, and a SQLite regulatory event store.

Built in `course/lab` so far (checkpoints 0–3): a lifecycle event log; a schema-validated per-turn trace with the first gate and the regulator registry seed; typed tools with error and effect contracts; capability profiles as positive grants over declared effects.

Next, in course order: coordination (leases, reintegration, anti-oscillation), the orchestrator (work contracts, budgets, recovery), independent audit, then intelligence, identity, escalation, evals and packaging. The one experiment the whole project answers to—does regulation slow architectural drift?—runs as the orchestrator with regulators ablated versus enabled.

No RDF/SHACL, recursive VSM, or elaborate S4 network yet. Those come after the control-plane pattern proves useful.

## Repository layout

```text
packages/
  protocol/       Typed VSM vocabulary and runtime schemas
  core/           Authority, routing, policy, and finding logic
  pi-extension/   Pi lifecycle integration
  checks/         Deterministic S3* checks
  cli/            vsm init/check/status/trace

agents/           Judgment-oriented S1/S4/S3* prompt profiles
course/           The "Viable Agents" course; course/lab is the reference build
docs/             Architecture, roadmap, and design notes
experiments/      Longitudinal drift scenarios and run artifacts
fixtures/         Tiny projects used by checks and experiments
vsm/example/      Example committed S5 artifacts
```

## Course: Viable Agents

`course/` is where VSM-Pi gets built. Instead of a feature-by-feature tour of Pi,
learners build their own agent harness—`regulator`, which *is* VSM-Pi's reference
build—and acquire Pi's feature base as the answer to successive regulatory questions.
GSD-Pi is read throughout as the comparison case.

Start with [the course overview](course/README.md); module specifications are in
[course/CURRICULUM.md](course/CURRICULUM.md); lessons 01–04 are written and their
checkpoints run under `pnpm check`. Production status is in
[course/PRODUCTION-PLAN.md](course/PRODUCTION-PLAN.md).

## Status

Early. The control-plane primitives exist and are tested; the orchestrator does not
exist yet and is the next thing the course builds. The decision to provide our own
orchestrator rather than integrate with GSD is recorded in
[docs/DESIGN-ROADMAP.md](docs/DESIGN-ROADMAP.md).

## Development

Use Node **>=22.19.0** and **pnpm 10.12.1** (pinned in `packageManager`).

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm check
```

`pnpm check` runs the complete workspace verification surface: build, TypeScript checks, and
Node's built-in runtime tests. Root commands build workspace dependencies in
topological order so they work before any `dist/` files exist. Dependencies are
pinned and `pnpm-lock.yaml` is committed; CI installs with `--frozen-lockfile`
and runs `pnpm check` on Node 22.19.0 and 24 for pushes and pull requests.

After `pnpm build`, run either focused suite with:

```sh
pnpm --filter @metacoding/vsm-pi-protocol test
pnpm --filter @metacoding/vsm-pi-core test
```

## Pi extension (M0.2)

After `pnpm build`, run `pnpm pi` from the project root to load the native Pi
extension. It mechanically blocks operational `write` and `edit` calls to
protected S5 artifacts and rejects unsafe paths. Ordinary project writes
continue normally. Run `pnpm --filter @metacoding/vsm-pi-extension test` for the
focused handler tests and a model-free smoke test with Pi's real loader.

See [the extension guide](packages/pi-extension/README.md) for loading into
another project, SDK compatibility, path rules, and the native-hook enforcement
boundary. Shell/custom tools and execution engines that bypass that hook require
separate enforcement.

## Typed reporting (M0.3)

Three content-only tools record policy proposals, independent audit findings,
and operational uncertainty signals. A trusted host supplies reporting grants;
the default context is unprivileged. Successful calls append to the separate
`.gsd/vsm-runtime/vsm.db` SQLite event store and return committed event receipts.
The store never opens `.gsd/gsd.db` or mutates S5 artifacts.

Run `pnpm smoke:reporting` for model-free examples using the real Pi SDK and a
temporary SQLite database. See [the reporting guide](docs/REPORTING.md) for the
host seam, payloads, internal messages, and replay/receipt examples.
