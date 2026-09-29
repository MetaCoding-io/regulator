# regulator Architecture

## Purpose

regulator is an agent harness on Pi with an explicit cybernetic control plane. It provides its own orchestrator, the S3 loop, which is generic over workloads, and it regulates that loop ([ADR 0001](decisions/0001-own-orchestrator.md)). The course uses GSD-Pi as comparison material; regulator does not depend on it.

The central architectural distinction is between control functions and agents. S1 to S5 name responsibilities and the communication relationships between them. An LLM may participate in one of those functions, but the function's authority should live in durable mechanisms wherever possible.

regulator therefore does not instantiate separate `S1Agent` through `S5Agent` subsystems. Instead, a unit runs under a capability profile that the workload names for its unit type. The profile is a grant the host derives from the effects the unit's tools declare, and the regulators are mechanisms placed around the loop. That assignment determines the unit's regulatory context, its capabilities and its hooks, and it preserves the separation-of-duty requirements. The [control plane](concepts/control-plane.md) page holds the current mapping.

## Core rule

> **Prompts advise. Types describe. Gates enforce.**

Prompt engineering is used for interpretation and judgment. Mechanical facts and authority boundaries should be represented, wherever that is possible, in TypeScript, runtime schemas, deterministic checks, and narrow tools. The mechanism hierarchy at the end of this page gives the order in which to try them.

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

S1 profiles perform the work. A profile is a capability boundary: it states what a unit may use and where it may write, and it says nothing about a personality. The shipped profiles are `implement`, `research`, `intelligence`, `bookkeeper` and `auditor`, and a workload declares its own.

S1 may:

- implement within the delegated scope of its contract;
- emit operational signals, including residual uncertainty about implementation decisions;
- propose changes to S5 identity/policy;
- emit an algedonic signal when normal regulation is insufficient.

S1 may not silently mutate protected S5 identity.

#### Residual uncertainty is operational feedback

Completing a unit must not collapse uncertain implementation choices into a falsely clean `done` signal. When an S1 unit makes a consequential choice under ambiguity, incomplete evidence, competing plausible designs, or an underspecified system model, it should report that residual uncertainty as structured operational feedback.

> S1 should report both what it did and where its model of the system became uncertain.

The useful signal is the decision and the regulatory information around it. A pseudo-precise probability would carry none of this:

- what decision was made;
- why the choice was uncertain;
- what alternatives were considered;
- what evidence supported the choice;
- what the consequence would be if the choice is wrong;
- what follow-up or escalation seems appropriate.

An uncertainty report travels as a subtype of the ordinary `signal` channel, so it carries no authority of its own. S1 may recommend a route, but the receiving control function decides how the report is handled. Typical routing looks like this:

- local implementation uncertainty goes to S3 for ordinary control;
- interface or sequencing uncertainty goes to S2/S3 coordination;
- architectural or domain-model uncertainty goes to S3, with a possible S3* audit;
- dependency, API or environment uncertainty goes to S4 intelligence;
- uncertainty about system purpose, policy, or identity becomes a proposal or an escalation toward S5.

Repeated uncertainty around the same subject is itself higher-level evidence. S4 and S5 should be able to detect recurring clusters and treat them as signs that the architecture, the constraints, the documentation, or the system representation are underspecified.

Cybernetically, these reports preserve information about variety that S1 could not confidently absorb locally. A development system that receives outputs but discards residual uncertainty destroys information its regulator may need later.

### S2 — Coordination

S2 is primarily mechanism, and the orchestrator supplies most of it:

- worktree/branch isolation and reintegration;
- unit leases with expiry;
- tool-surface restrictions by profile;
- the thrash detector (anti-oscillation within a unit).

Sequencing between units and semantic commitments across them are not built yet; issue
#14 holds them.

### S3 — Control

S3 is the operational controller. It is the orchestrator's loop (contract → dispatch → verify → route → close) together with budgets, the versioned recovery policy, and authority over execution state. It is the only thing that schedules. Regulators feed it typed signals and audit findings, and they can veto progression, but they never dispatch.

S3 should treat S1 uncertainty reports as routing information; a unit's statement about its own work certifies nothing. Low-consequence uncertainty may simply be recorded. Consequential architectural uncertainty may trigger targeted S3* inspection, replanning, research, or human escalation.

### S3* — Independent audit

S3* must be structurally separate from S1 self-certification. It has three intended layers:

1. deterministic structural checks;
2. semantic/domain checks;
3. LLM-based judgment for residual architectural questions.

Because the layers ask different questions, a unit's work can be technically correct and still architecturally non-conformant. S1 uncertainty signals are useful targeting information for S3*, but an S1 statement of confidence or uncertainty is never itself audit evidence.

### S4 — Intelligence

S4 observes the future and the environment: dependencies, platform changes, runtime behavior, security advisories, external APIs, user feedback, architecture options, and other signals that should affect future plans.

S4 outputs intelligence, and intelligence does not become policy on its own. When a finding calls for a policy change, S4 sends a proposal to S5, and S5 decides.

S4 may also aggregate uncertainty patterns across many S1 operations. Recurrent uncertainty in the same subsystem or concept can indicate a missing model, an unstable external assumption, or an architectural seam that deserves investigation and possibly an S5 proposal.

### S5 — Identity and policy

S5 is durable project identity. Its authoritative representation belongs in version-controlled artifacts; a copy inside an LLM's context window is advice, never the authority.

Agents may propose S5 changes through a typed proposal channel. Proposing a change confers no authority to make it.

## Operational decomposition: prefer closed-loop vertical slices

For feature work, regulator should generally prefer thin vertical slices over broad horizontal sweeps. A vertical slice crosses the minimum set of layers needed to produce an observable end-to-end behavior: for example, a stubbed UI wired to a mock endpoint before the full database, service, API, and UI layers are independently completed.

The slice is a decomposition strategy, and it is a different kind of thing from the S1 function itself. It tends to produce a better S1 work packet because the operation can close a feedback loop sooner:

```text
intent -> thin end-to-end implementation -> observable result -> verification -> correction
```

A horizontal sweep instead tends to defer useful feedback:

```text
all data work -> all service work -> all API work -> all UI work -> integration -> first end-to-end result
```

The cybernetic advantage of the vertical form is shorter feedback delay and lower unresolved variety. Problems in interfaces, assumptions, sequencing, and architecture become visible while the implementation surface is still small. Horizontal decomposition can accumulate locally plausible changes across several layers before S3 or S3* receives an integrated signal, which increases the coordination and rework required when an assumption proves wrong.

Planning should therefore prefer work units with:

- an explicit observable outcome;
- the thinnest end-to-end path that can demonstrate that outcome;
- a deterministic or reviewable done signal where possible;
- stubs/mocks at boundaries that are not yet implemented;
- an early integration checkpoint before additional complexity is added;
- residual uncertainty reported before the next layer of complexity compounds it.

Horizontal work remains allowed. Shared infrastructure, migrations, cross-cutting refactors, and enabling platform changes can be legitimate horizontal units. When a plan uses one, it should state why an end-to-end slice is impractical and what integration proof will close the feedback loop.

Today a contract's `contribution` is the only trace of the distinction. It should eventually become explicit planning metadata or a planning invariant, so that a check can see it instead of a reader inferring it from a naming convention.

## Channel semantics

| Channel | Typical direction | Meaning |
| --- | --- | --- |
| `constraint` | S5 downward | Defines the permitted operational space |
| `signal` | S1 upward | Ordinary operational feedback, including residual uncertainty |
| `audit` | S3* -> S3 | Independent evidence about conformance |
| `intelligence` | S4 -> S3/S5 | Environment/future-facing observation |
| `proposal` | S1/S3/S4 -> S5 | Requests a change to identity or policy |
| `algedonic` | any operational function -> S5/human | Exceptional signal that bypasses normal hierarchy |

A channel communicates information. Sending on one does not by itself grant authority to mutate S5; that authority comes from the mechanisms described above.

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

Runtime records live under an instance's `.regulator/`, and committed identity lives in version control. The two remain conceptually separate: the identity says what the system is, the evidence says what happened in one run, and neither is read as the other.

## Mechanism hierarchy

For each requirement, ask in order:

1. Can TypeScript make invalid representation impossible?
2. Can a deterministic runtime gate decide it?
3. Can a typed tool/message represent it?
4. Does it require model judgment?
5. What prompt/context does that judgment require?

This ordering is deliberate: each level holds up better under pressure than the one after it. regulator should therefore not encode deterministic authority as prose merely because an LLM is available.

## Deliberately deferred

- complete VSM recursion;
- production-grade ontology extraction;
- RDF/SHACL enforcement;
- broad S4 integrations;
- autonomous S5 mutation;
- production-grade benchmarks.

Everything the build still owes short of these deferrals has one row each in [DEBT.md](DEBT.md).
