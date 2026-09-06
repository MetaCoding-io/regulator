# VSM-Pi Invariants

These are initial architectural invariants for the project itself. They are intentionally few.

## INV-001 — S5 mutation requires explicit authority

Ordinary S1/S2/S3/S4 execution must not directly mutate protected committed S5 artifacts. Such changes require an explicit S5-authority path.

## INV-002 — Proposal is not policy

A policy/identity proposal may request an S5 change but cannot itself modify S5 state.

## INV-003 — Audit is independent of self-report

An S1 executor's claim that work is correct cannot, by itself, satisfy S3* audit.

## INV-004 — Deterministic facts should not depend on model agreement

If a rule can be represented reliably as a TypeScript invariant or deterministic runtime check, the control plane should not rely on an LLM prompt as the sole enforcement mechanism.

## INV-005 — GSD remains workflow authority

VSM-Pi must not create a second competing source of truth for GSD task/slice/milestone lifecycle state.

## INV-006 — Channel type carries control semantics

Audit, intelligence, proposal, operational signal, constraint, and algedonic messages must remain distinguishable in the protocol. They must not collapse into a generic untyped "context" message at the control-plane boundary.

## INV-007 — Runtime-specific code stays out of core

`packages/protocol` and `packages/core` must not depend on Pi or GSD runtime packages.
