# regulator Architecture

## Purpose

regulator is an agent harness on Pi with an explicit cybernetic control plane. It provides its own orchestrator — the S3 loop, generic over workloads — and regulates it ([ADR 0001](decisions/0001-own-orchestrator.md)). GSD-Pi is comparison material in the course, not a dependency.

The central architectural distinction is between **control functions** and **agents**. S1-S5 are responsibilities and communication relationships. An LLM may participate in one of those functions, but the function's authority should live in durable mechanisms wherever possible.

regulator therefore does not instantiate separate `S1Agent` through `S5Agent` subsystems. A unit runs under a capability profile the workload names for its unit type; the profile is a host-derived grant over declared tool effects, and the regulators are mechanisms around the loop, not personas. That assignment determines regulatory context, capabilities, and hooks while preserving separation-of-duty requirements. The [control plane](concepts/control-plane.md) page is the current mapping.

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

S1 profiles perform the work. A profile is a capability boundary — what a unit may use and where it may write — not a persona: the shipped ones are `implement`, `research`, `intelligence`, `bookkeeper` and `auditor`, and a workload declares its own.

S1 may:

- implement within the task's delegated scope;
- emit operational signals, including residual uncertainty about implementation decisions;
- propose changes to S5 identity/policy;
- emit an algedonic signal when normal regulation is insufficient.

S1 may **not** silently mutate protected S5 identity.

#### Residual uncertainty is operational feedback

Task completion must not collapse uncertain implementation choices into a falsely clean `done` signal. When an S1 unit makes a consequential choice under ambiguity, incomplete evidence, competing plausible designs, or an underspecified system model, it should report that residual uncertainty as structured operational feedback.

> **S1 should report not only what it did, but where its model of the system became uncertain.**

The useful signal is not a pseudo-precise probability. It is the decision and the regulatory information around it:

- what decision was made;
- why the choice was uncertain;
- what alternatives were considered;
- what evidence supported the choice;
- what the consequence would be if the choice is wrong;
- what follow-up or escalation seems appropriate.

An uncertainty report is a subtype of the ordinary `signal` channel, not a new authority-bearing channel. S1 may recommend a route, but the receiving control function decides how it is handled. Typical routing includes:

- local implementation uncertainty -> S3 for ordinary control;
- interface/sequencing uncertainty -> S2/S3 coordination;
- architectural or domain-model uncertainty -> S3 with possible S3* audit;
- dependency/API/environment uncertainty -> S4 intelligence;
- uncertainty about system purpose, policy, or identity -> proposal/escalation toward S5.

Repeated uncertainty around the same subject is itself higher-level evidence. S4/S5 should be able to detect recurring clusters and treat them as signs that architecture, constraints, documentation, or the system representation are underspecified.

Cybernetically, these reports preserve information about variety that S1 could not confidently absorb locally. A development system that receives outputs but discards residual uncertainty destroys information its regulator may need.

### S2 — Coordination

S2 is primarily mechanism rather than a conversational agent. The orchestrator supplies it:

- worktree/branch isolation and reintegration;
- unit leases with expiry;
- tool-surface restrictions by profile;
- the thrash detector (anti-oscillation within a unit).

Sequencing between units and semantic commitments across them are not built (issue #14).

### S3 — Control

S3 is the operational controller: the orchestrator's loop — contract → dispatch → verify → route → close — with budgets, the versioned recovery policy, and authority over execution state. It is the only thing that schedules; regulators feed it typed signals and audit findings and can veto progression, never dispatch.

S3 should treat S1 uncertainty reports as routing information rather than self-certification. Low-consequence uncertainty may simply be recorded; consequential architectural uncertainty may trigger targeted S3* inspection, replanning, research, or human escalation.

### S3* — Independent audit

S3* must be structurally separate from S1 self-certification. It has three intended layers:

1. deterministic structural checks;
2. semantic/domain checks;
3. LLM-based judgment for residual architectural questions.

A task can therefore be technically correct but architecturally non-conformant. S1 uncertainty signals are useful targeting information for S3*, but an S1 statement of confidence or uncertainty is never itself audit evidence.

### S4 — Intelligence

S4 observes the future and environment: dependencies, platform changes, runtime behavior, security advisories, external APIs, user feedback, architecture options, and other signals that should affect future plans.

S4 outputs intelligence. Intelligence does not automatically become policy.

S4 may also aggregate uncertainty patterns across many S1 operations. Recurrent uncertainty in the same subsystem or concept can indicate a missing model, unstable external assumption, or architectural seam that deserves investigation and potentially an S5 proposal.

### S5 — Identity and policy

S5 is durable project identity. Its authoritative representation belongs in version-controlled artifacts, not inside an LLM's context window.

Agents may propose S5 changes through a typed proposal channel. The act of proposing does not confer mutation authority.

## Operational decomposition: prefer closed-loop vertical slices

For feature work, regulator should generally prefer **thin vertical slices** over broad horizontal sweeps. A vertical slice crosses the minimum set of layers needed to produce an observable end-to-end behavior: for example, a stubbed UI wired to a mock endpoint before the full database, service, API, and UI layers are independently completed.

This is not a claim that a vertical slice literally *is* an S1. It is a decomposition strategy that tends to produce a better S1 work packet because the operation can close a feedback loop sooner:

```text
intent -> thin end-to-end implementation -> observable result -> verification -> correction
```

A horizontal sweep instead tends to defer useful feedback:

```text
all data work -> all service work -> all API work -> all UI work -> integration -> first end-to-end result
```

The cybernetic advantage of the vertical form is **shorter feedback delay and lower unresolved variety**. Problems in interfaces, assumptions, sequencing, and architecture become visible while the implementation surface is still small. Horizontal decomposition can accumulate locally plausible changes across several layers before S3/S3* receives an integrated signal, increasing the amount of coordination and rework required when an assumption proves wrong.

Planning should therefore prefer work units with:

- an explicit observable outcome;
- the thinnest end-to-end path that can demonstrate that outcome;
- a deterministic or reviewable done signal where possible;
- stubs/mocks at boundaries that are not yet implemented;
- an early integration checkpoint before additional complexity is added;
- residual uncertainty reported before the next layer of complexity compounds it.

Horizontal work is not forbidden. Shared infrastructure, migrations, cross-cutting refactors, and enabling platform changes can be legitimate horizontal units. When used, their plan should state why an end-to-end slice is impractical and what integration proof will close the feedback loop.

The distinction should eventually become explicit planning metadata or a planning invariant rather than a naming convention; today a contract's `contribution` is the only trace of it.

## Channel semantics

| Channel | Typical direction | Meaning |
| --- | --- | --- |
| `constraint` | S5 downward | Defines the permitted operational space |
| `signal` | S1 upward | Ordinary operational feedback, including residual uncertainty |
| `audit` | S3* -> S3 | Independent evidence about conformance |
| `intelligence` | S4 -> S3/S5 | Environment/future-facing observation |
| `proposal` | S1/S3/S4 -> S5 | Requests a change to identity or policy |
| `algedonic` | any operational function -> S5/human | Exceptional signal that bypasses normal hierarchy |

A channel communicates information; it does not by itself grant authority to mutate S5.

## Committed identity vs runtime evidence

```text
vsm/                        .regulator/
----                        -----------------
WHAT THE SYSTEM IS          WHAT HAPPENED THIS RUN

committed                   generated
authoritative               evidentiary/replayable
human-reviewed              machine-written
S5 identity                 findings/traces/cache
```

Runtime records live under an instance's `.regulator/`; committed identity and ephemeral execution evidence remain conceptually separate.

## Mechanism hierarchy

For each requirement, ask in order:

1. Can TypeScript make invalid representation impossible?
2. Can a deterministic runtime gate decide it?
3. Can a typed tool/message represent it?
4. Does it require model judgment?
5. What prompt/context does that judgment require?

This ordering is deliberate. regulator should not encode deterministic authority as prose merely because an LLM is available.

## Deliberately deferred

- complete VSM recursion;
- production-grade ontology extraction;
- RDF/SHACL enforcement;
- broad S4 integrations;
- autonomous S5 mutation;
- production-grade benchmarks.

What the build owes short of these is one row each in [DEBT.md](DEBT.md).
