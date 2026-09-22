# AGENTS.md

This repository builds **VSM-Pi**: a coding-agent harness on [Pi](https://pi.dev/) with an explicit cybernetic control plane, applying Stafford Beer's Viable System Model (VSM) as a control architecture. VSM-Pi provides its own orchestrator. The course under `course/` builds it lesson by lesson; the course lab (`regulator`) is the reference build, and its checkpoints promote into `packages/` as they stabilize.

The project is intentionally **not** a collection of themed chatbot personas. Treat S1–S5 as control-system functions, authority boundaries, channels, and feedback loops.

## Prime directive

> **Prompts advise. Types describe. Gates enforce.**

When implementing a rule, prefer mechanisms in this order:

1. TypeScript type or compile-time invariant.
2. Deterministic runtime check or gate.
3. Typed tool / protocol with runtime schema validation.
4. LLM judgment.
5. Prompt/context engineering.

Prompt engineering is valuable, but do not solve a mechanically enforceable rule only by adding prompt text.

## Architectural boundaries

- **The orchestrator owns execution state; regulators own regulatory state; neither infers the other.** Execution state (units, attempts, leases, budgets consumed) lives in the orchestrator's store. Regulatory state (obligations, evidence, findings, escalations) lives in the append-only event store. Domain output (the code, the files) lives in the repository. Nothing reads its own progress off the domain.
- **The control plane is declared, not assembled.** An instance runs from a *definition*: the regulator registry, capability profiles, policies, and a workload. The definition is versioned and checked (`regulator check`); the orchestrator is generic over workloads.
- **The orchestrator stays small.** It is the S3 loop — contract → dispatch → verify → route → close — with leases and budgets. Workload-specific behaviour (the software-development autoloop, first) is declared in a workload definition, not coded into the loop.
- **S5 is not an agent.** Version-controlled system identity, architecture, invariants, domain model, and policy are authoritative. Agents may interpret them and propose changes.
- **Operational code must not directly mutate S5 artifacts.** Use an explicit S5-authority workflow or a typed proposal path.
- **S3\* is not merely a reviewer prompt.** Prefer independent host-owned evidence, deterministic checks, and provenance. LLM review is an additional judgment layer.
- **S2 should mostly be mechanisms**, including tool contracts, isolation, scheduling, coordination, locks/leases, reintegration, and anti-oscillation behavior—not a coordinator roleplay persona.
- **S1 profiles are operational capability profiles**, not personalities. Specialize by responsibility, tools, constraints, and evidence requirements. A profile is a grant over declared tool *effects*; read-only means read-only by effect, not by tool name.
- **S4 is environment/future-facing.** Keep environmental intelligence distinct from S3 operational control and S5 policy. Intelligence can raise an obligation; it never replans on its own.
- **Typed channels carry control semantics.** A signal is not an audit; an audit is not a policy decision; a proposal does not mutate policy; an algedonic signal is exceptional escalation.
- **Every regulator has a registry record.** Purpose, failure absorbed, mechanism level, implementation, tests, limitations, owner, review date. A gate without a stated limitation does not pass `regulator check`.

## Current goal

Build `regulator` — VSM-Pi's reference build — through the course, one checkpoint per lesson, promoting stable pieces into `packages/`.

Exists today: typed VSM protocol and runtime schemas (messages, trace, effects, profiles, registry, work contracts and result reports, workload and execution records); protected S5 write paths; a loadable Pi extension; typed policy-proposal, audit-finding and uncertainty tools; a SQLite regulatory event store; the lease store, thrash detector, contract/report checks, the execution store, the budget meter and policy resolution, the recovery router and the effect journal, and host-run checks with the technical verdict and the audit log (all in `packages/`, with the checks in `packages/checks`); the `regulator status` read model in `packages/cli` and the read-only control room page over it in `packages/control-room`; and checkpoints 0–8 in `course/lab` (event log; schema-validated trace with the first gate and the registry seed; typed tools with effect contracts; capability profiles; leases, worktree isolation and reintegration; the first slice of the S3 loop with the software-development workload definition; budgets, model routes and contract-preserving compaction under a declared policy; the recovery router over blocked units under a versioned recovery policy, failure observations, and a durable side-effecting tool reconciled on restart; the closeout gate over host-run evidence bound to a revision, with human acceptance separate from the technical verdict).

Next: authority boundaries (protected identity, the proposal path, the trust rule), then environmental intelligence; the control room grows one view per lesson.

Deliberately deferred: RDF/SHACL, full VSM recursion, broad S4 integrations, autonomous S5 mutation, production-grade benchmarks. **GSD-Pi is comparison material in the course, not a dependency; there is no GSD adapter.**

## Repository conventions

- TypeScript first.
- Keep packages small and dependency direction explicit.
- Put shared protocol/schema definitions in `packages/protocol`.
- Put authority/routing/policy mechanisms in `packages/core`.
- Pi integration belongs in `packages/pi-extension`.
- Deterministic S3\* checks belong in `packages/checks`.
- User-facing CLI behavior belongs in `packages/cli`.
- `course/lab` is the reference build. A checkpoint's Pi-free modules move to `packages/protocol` or `packages/core` once two lessons depend on them, and the lab imports them from there; the lab never re-implements what `packages/` already ships.
- Judgment-oriented agent prompts belong under `agents/` and should not contain authority that the runtime can enforce mechanically.
- Committed S5 artifacts belong under `vsm/`.
- Regulator registry records belong beside the code they describe; `regulator check` and the generated `REGULATORS.md` run under `pnpm check`.
- Ephemeral run evidence/traces must not become a competing project source of truth.

## Pi integration rules

- Use Pi's TypeScript extension API and lifecycle events directly where possible.
- Prefer typed event narrowing (for example `isToolCallEventType`) over stringly-typed inspection.
- Use registered tools with runtime schemas for structured model-to-runtime communication. Every tool declares its effect (filesystem, execution, network, side effects).
- Use tool-call interception or active-tool restrictions for enforcement; do not rely only on instruction text.
- Pin the Pi version. Treat an upgrade as a change with evidence: the course's feature matrix is the checklist, and both CI Node versions must pass.
- When a finding affects progression, route it through the orchestrator's recovery lattice rather than inventing a parallel loop.

## Testing and evidence

Every implementation task should finish with exact evidence.

At minimum:

- run the relevant typecheck;
- run focused tests for changed behavior;
- run the broader project check/test command when practical;
- report the exact commands and whether they passed.

Do not claim a check passed without command output or equivalent host-owned evidence.

For extension work, test registration and handlers independently where possible using Pi's documented extension testing patterns and Node's built-in test runner. Test without a live model wherever the behavior is mechanical; live-model runs are for drills and evals.

## Change discipline

- Prefer small, reviewable diffs.
- Do not expand issue scope merely because an adjacent improvement is attractive.
- If an implementation reveals an architectural conflict, record it explicitly rather than silently changing the architecture to fit the code.
- If a requested change would violate an explicit invariant, stop and surface the conflict or create the appropriate typed proposal.
- Preserve provenance: who/what emitted a finding, what source revision/evidence it refers to, and what authority acted on it.

## Before finishing an issue

Confirm:

1. The implementation satisfies the issue acceptance criteria.
2. No new prompt-only enforcement was introduced where a typed/mechanical mechanism was reasonable.
3. The orchestrator remains the only execution authority; regulators do not schedule.
4. S5 mutation boundaries remain explicit.
5. Tests/typechecks were run and results are reported.
6. Every new registry limitation that names a later lesson, a milestone or "not yet" has a row in `docs/DEBT.md`; a change that pays a row strikes it.
7. The final response lists files changed and exact verification commands.
