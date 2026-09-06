# AGENTS.md

This repository experiments with applying Stafford Beer's Viable System Model (VSM) to agentic software development using Pi and GSD.

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

- **Do not fork or modify GSD** unless an issue explicitly requires an upstream/kernel change.
- **Do not create a second source of truth for GSD workflow state.** GSD owns its lifecycle, attempts, task/slice/milestone state, retries, verification, and recovery.
- **S5 is not an agent.** Version-controlled system identity, architecture, invariants, domain model, and policy are authoritative. Agents may interpret them and propose changes.
- **Operational code must not directly mutate S5 artifacts.** Use an explicit S5-authority workflow or a typed proposal path.
- **S3* is not merely a reviewer prompt.** Prefer independent host-owned evidence, deterministic checks, and provenance. LLM review is an additional judgment layer.
- **S2 should mostly be mechanisms**, including tool contracts, isolation, scheduling, coordination, locks/leases, and anti-oscillation behavior—not a coordinator roleplay persona.
- **S1 profiles are operational capability profiles**, not personalities. Specialize by responsibility, tools, constraints, and evidence requirements.
- **S4 is environment/future-facing.** Keep environmental intelligence distinct from S3 operational control and S5 policy.
- **Typed channels carry control semantics.** A signal is not an audit; an audit is not a policy decision; a proposal does not mutate policy; an algedonic signal is exceptional escalation.

## Current M0 goal

Prove that a small TypeScript control plane can augment Pi/GSD without replacing GSD's orchestration kernel.

M0 should establish:

- typed VSM protocol and runtime schemas;
- protected S5 authority boundaries;
- a loadable Pi extension;
- typed policy-proposal and audit-finding tools;
- runtime trace/provenance;
- a GSD-aware adapter;
- one deterministic S3* architecture gate;
- one advisory LLM architecture-review path;
- one tiny longitudinal drift fixture.

RDF/SHACL, recursive VSM, broad S4 integrations, autonomous S5 mutation, and production-grade benchmarks are deliberately deferred.

## Repository conventions

- TypeScript first.
- Keep packages small and dependency direction explicit.
- Put shared protocol/schema definitions in `packages/protocol`.
- Put authority/routing/policy mechanisms in `packages/core`.
- Generic Pi integration belongs in `packages/pi-extension`.
- GSD-specific integration belongs in `packages/gsd-extension`.
- Deterministic S3* checks belong in `packages/checks`.
- User-facing CLI behavior belongs in `packages/cli`.
- Judgment-oriented agent prompts belong under `agents/` and should not contain authority that the runtime can enforce mechanically.
- Committed S5 artifacts belong under `vsm/`.
- Ephemeral run evidence/traces must not become a competing project source of truth.

## Pi/GSD integration rules

- Use Pi's TypeScript extension API and lifecycle events directly where possible.
- Prefer typed event narrowing (for example `isToolCallEventType`) over stringly-typed inspection.
- Use registered tools with runtime schemas for structured model-to-runtime communication.
- Use tool-call interception or active-tool restrictions for enforcement; do not rely only on instruction text.
- Treat GSD's state machine as authoritative during auto mode.
- Do not trigger ad-hoc autonomous turns inside GSD auto mode unless the integration is explicitly designed around GSD's lifecycle and recovery semantics.
- When a finding affects progression, route it through GSD's supported retry/pause/remediation mechanisms rather than inventing a parallel loop.

## Testing and evidence

Every implementation task should finish with exact evidence.

At minimum:

- run the relevant typecheck;
- run focused tests for changed behavior;
- run the broader project check/test command when practical;
- report the exact commands and whether they passed.

Do not claim a check passed without command output or equivalent host-owned evidence.

For extension work, test registration and handlers independently where possible using Pi's documented extension testing patterns and Node's built-in test runner.

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
3. GSD remains the workflow authority.
4. S5 mutation boundaries remain explicit.
5. Tests/typechecks were run and results are reported.
6. The final response lists files changed and exact verification commands.
