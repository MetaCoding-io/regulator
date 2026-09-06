# VSM-Pi

**Cybernetic control for agentic software development.**

VSM-Pi is an experimental TypeScript augmentation layer for [Pi](https://pi.dev/) and [GSD](https://github.com/open-gsd/gsd-pi). It explores whether Stafford Beer's Viable System Model can be made operational inside an autonomous software-development system—not as five chatbot personas, but as explicit functions, authority boundaries, typed channels, verification gates, and feedback loops.

The project starts from a simple premise:

> **Prompts advise. Types describe. Gates enforce.**

Prompt engineering remains useful where judgment is required, but VSM-Pi prefers TypeScript types, runtime schemas, deterministic checks, narrow tool contracts, and host-owned verification whenever the system can know or enforce something mechanically.

## Design goals

- Preserve GSD's lifecycle, task state, attempts, verification, recovery, and worktree machinery rather than replacing them.
- Treat GSD as the primary S2/S3 control substrate and extend around it.
- Make S5 identity and policy durable, version-controlled, and independent of individual model context windows.
- Keep S3* audit independent of S1 self-reporting.
- Differentiate S1 workers by operational capability profiles, not roleplay personas.
- Give S4 explicit mechanisms for environmental intelligence and future-facing research.
- Represent feedback as typed channels with provenance and authority, rather than as undifferentiated prompt context.
- Prefer deep Pi/GSD TypeScript integrations over prompt-only orchestration.

## Working VSM mapping

| VSM function | Initial VSM-Pi interpretation |
| --- | --- |
| **S1 — Operations** | Coding, data, UI, infrastructure, migration, and integration capability profiles |
| **S2 — Coordination** | Primarily GSD lifecycle/tool contracts, isolation, leases, and anti-oscillation mechanisms |
| **S3 — Control** | Primarily GSD planning, dispatch, recovery, budgets, retries, and project-state authority |
| **S3\* — Audit** | Host verification plus VSM-Pi architectural/domain checks and independent audit findings |
| **S4 — Intelligence** | Read-only specialists and external/environmental intelligence feeding planning and reassessment |
| **S5 — Identity/Policy** | Versioned product identity, architecture, domain model, invariants, and policy |

## Mechanism hierarchy

When adding a feature, prefer mechanisms in this order:

1. **Can this be a TypeScript invariant?** Use the type system.
2. **Can this be deterministically checked at runtime?** Write a gate/check.
3. **Can this be represented as a structured tool or protocol?** Use a runtime schema and typed message.
4. **Does this require interpretation or judgment?** Use an LLM.
5. **Does the LLM need additional context?** Apply prompt/context engineering.

## M0 — prove the control plane

The first milestone intentionally stays small:

- typed VSM protocol and channel vocabulary
- committed S5 example structure
- Pi/GSD extension skeleton
- protected S5 write paths
- typed identity-change proposal
- typed audit finding
- one deterministic architecture gate
- one advisory architecture-review path
- trace/event log
- a tiny longitudinal drift fixture for later control-vs-treatment experiments

No RDF/SHACL, recursive VSM, or elaborate S4 network is required for M0. Those belong in later milestones after the control-plane pattern proves useful.

## Repository layout

```text
packages/
  protocol/       Typed VSM vocabulary and runtime schemas
  core/           Authority, routing, policy, and finding logic
  pi-extension/   Generic Pi lifecycle integration
  gsd-extension/  GSD-aware integration
  checks/         Deterministic S3* checks
  cli/            vsm init/check/status/trace

agents/           Judgment-oriented S1/S4/S3* prompt profiles
docs/             Architecture and GSD/VSM mapping
experiments/      Longitudinal drift scenarios and run artifacts
fixtures/         Tiny projects used by checks and experiments
vsm/example/      Example committed S5 artifacts
```

## Status

Very early research/prototype stage. The immediate goal is to create a small executable extension and prove that typed authority boundaries and independent architectural audit can augment GSD without forking its orchestration kernel.

## Development

Use Node **>=22.18.0** and **pnpm 10.12.1** (pinned in `packageManager`).

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm check
```

`pnpm check` runs the complete M0.1 surface: build, TypeScript checks, and
Node's built-in runtime tests. Root commands build workspace dependencies in
topological order so they work before any `dist/` files exist. Dependencies are
pinned and `pnpm-lock.yaml` is committed; CI installs with `--frozen-lockfile`
and runs `pnpm check` on Node 22.18.0 and 24 for pushes and pull requests.

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
