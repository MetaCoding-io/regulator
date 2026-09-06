# VSM-Pi Architecture

## Purpose

VSM-Pi augments Pi/GSD with explicit cybernetic control structures for agentic software development. It does **not** attempt to replace GSD's orchestration kernel. The initial design assumes GSD remains authoritative for lifecycle, task/slice/milestone state, attempts, verification, retries, recovery, and isolation.

The central architectural distinction is between **control functions** and **agents**. S1-S5 are responsibilities and communication relationships. An LLM may participate in one of those functions, but the function's authority should live in durable mechanisms wherever possible.

## Core rule

> **Prompts advise. Types describe. Gates enforce.**

Prompt engineering is used for interpretation and judgment. Mechanical facts and authority boundaries should preferentially be represented in TypeScript, runtime schemas, deterministic checks, and narrow tools.

## Functional model

```text
                         HUMAN / OWNER
                              |
                              v
                   +---------------------+
                   |         S5          |
                   | SYSTEM IDENTITY     |
                   | purpose / policy    |
                   | domain / invariants |
                   +----------+----------+
                              |
                     constraints / identity
                              |
               +--------------+---------------+
               |                              |
               v                              v
        +-------------+                +-------------+
        |     S4      |<-------------->|     S3      |
        | INTELLIGENCE|                | CONTROL     |
        +------+------+                +------+------+ 
               |                              |
               |                           +--v--+
               |                           | S2  |
               |                           |coord|
               |                           +--+--+
               |                              |
               |                    +---------+---------+
               |                    v         v         v
               |                  S1/API    S1/Data   S1/UI
               |                    |         |         |
               |                    +---------+---------+
               |                              |
               |                              v
               |                        +-----------+
               +----------------------->|    S3*    |
                                        |  AUDIT    |
                                        +-----+-----+
                                              |
                                              +---- evidence ---> S3
```

## Authority model

### S1 — Operations

S1 profiles perform implementation work. Profiles should represent capability/concern boundaries such as API, data, UI, infrastructure, migration, or integration. They are not theatrical personas.

S1 may:

- implement within the task's delegated scope;
- emit operational signals;
- propose changes to S5 identity/policy;
- emit an algedonic signal when normal regulation is insufficient.

S1 may **not** silently mutate protected S5 identity.

### S2 — Coordination

S2 is primarily mechanism rather than a conversational agent. Initial S2 responsibilities are expected to remain largely inside GSD:

- lifecycle/unit contracts;
- worktree/branch isolation;
- leases and claims;
- tool-surface restrictions;
- sequencing and dependency control;
- anti-oscillation behavior.

### S3 — Control

S3 is the operational controller. GSD already supplies much of this function through planning, dispatch, retries, recovery, budgets, and authoritative project state.

VSM-Pi should feed S3 typed signals and audit findings rather than creating a competing controller.

### S3* — Independent audit

S3* must be structurally separate from S1 self-certification. It has three intended layers:

1. deterministic structural checks;
2. semantic/domain checks;
3. LLM-based judgment for residual architectural questions.

A task can therefore be technically correct but architecturally non-conformant.

### S4 — Intelligence

S4 observes the future and environment: dependencies, platform changes, runtime behavior, security advisories, external APIs, user feedback, architecture options, and other signals that should affect future plans.

S4 outputs intelligence. Intelligence does not automatically become policy.

### S5 — Identity and policy

S5 is durable project identity. Its authoritative representation belongs in version-controlled artifacts, not inside an LLM's context window.

Agents may propose S5 changes through a typed proposal channel. The act of proposing does not confer mutation authority.

## Channel semantics

| Channel | Typical direction | Meaning |
| --- | --- | --- |
| `constraint` | S5 downward | Defines the permitted operational space |
| `signal` | S1 upward | Ordinary operational feedback |
| `audit` | S3* -> S3 | Independent evidence about conformance |
| `intelligence` | S4 -> S3/S5 | Environment/future-facing observation |
| `proposal` | S1/S3/S4 -> S5 | Requests a change to identity or policy |
| `algedonic` | any operational function -> S5/human | Exceptional signal that bypasses normal hierarchy |

A channel communicates information; it does not by itself grant authority to mutate S5.

## Committed identity vs runtime evidence

```text
vsm/                        .gsd/vsm-runtime/
----                        -----------------
WHAT THE SYSTEM IS          WHAT HAPPENED THIS RUN

committed                   generated
authoritative               evidentiary/replayable
human-reviewed              machine-written
S5 identity                 findings/traces/cache
```

The exact runtime storage may evolve as integration with GSD deepens, but committed identity and ephemeral execution evidence must remain conceptually separate.

## Mechanism hierarchy

For each requirement, ask in order:

1. Can TypeScript make invalid representation impossible?
2. Can a deterministic runtime gate decide it?
3. Can a typed tool/message represent it?
4. Does it require model judgment?
5. What prompt/context does that judgment require?

This ordering is deliberate. VSM-Pi should not encode deterministic authority as prose merely because an LLM is available.

## M0 boundaries

M0 proves the control-plane pattern only.

In scope:

- protocol types and schemas;
- protected S5 paths;
- typed policy proposal;
- typed audit finding;
- deterministic gate interface;
- Pi/GSD extension seam;
- traceable decisions/findings;
- one drift-oriented fixture.

Out of scope:

- complete VSM recursion;
- production-grade ontology extraction;
- RDF/SHACL enforcement;
- broad S4 integrations;
- autonomous S5 mutation;
- replacing GSD's scheduler/state machine.
