# VSM-Pi Architecture

## Purpose

VSM-Pi augments Pi/GSD with explicit cybernetic control structures for agentic software development. It does **not** attempt to replace GSD's orchestration kernel. The initial design assumes GSD remains authoritative for lifecycle, task/slice/milestone state, attempts, verification, retries, recovery, and isolation.

VSM-Pi does, however, maintain a distinct class of **regulatory state**: unresolved signals, audit findings, intelligence, policy proposals, required acknowledgements, routing obligations, and their dispositions. This state exists to ensure regulatory information is not lost between GSD units. It must not become a competing scheduler or duplicate GSD workflow state.

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

For feature work, VSM-Pi should generally prefer **thin vertical slices** over broad horizontal sweeps. A vertical slice crosses the minimum set of layers needed to produce an observable end-to-end behavior: for example, a stubbed UI wired to a mock endpoint before the full database, service, API, and UI layers are independently completed.

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

GSD already uses the word *slice* as a workflow unit; VSM-Pi should not assume every GSD slice is automatically vertical. The distinction should eventually become explicit planning metadata or a planning invariant rather than a naming convention.

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

## Regulatory state and obligations

VSM-Pi requires runtime state of its own, but this state is **regulatory rather than operational**.

The ownership boundary is:

```text
GSD state                           VSM-Pi regulatory state
---------                           -----------------------
what unit runs next                what unresolved signals exist
task/slice/milestone lifecycle     who must consume/acknowledge them
attempts and retries               what evidence/findings remain open
worktrees and execution state      what policy proposals/intelligence exist
workflow recovery                  what must be resolved before a boundary
```

The rule is:

> **GSD owns execution state. VSM-Pi owns regulatory obligations.**

VSM-Pi must not derive or maintain a shadow copy of the GSD scheduler. Instead, it records information that GSD units must be able to consume before GSD decides whether and how to advance.

### Regulatory-input lifecycle

A regulatory record should have an explicit lifecycle rather than disappearing into an append-only log:

```text
emit -> route -> expose -> acknowledge -> resolve / escalate / supersede
```

Examples include uncertainty signals, audit findings, S4 intelligence, policy proposals, and eventually algedonic events. A record may be informational or may create an obligation for one or more VSM functions.

A minimal conceptual record includes:

```ts
interface RegulatoryRecord {
  id: string;
  kind: "uncertainty" | "audit" | "intelligence" | "proposal" | "algedonic";
  source: VsmSystem;
  subject: string;
  status: "open" | "acknowledged" | "resolved" | "escalated" | "superseded";
  requiredConsumers: VsmSystem[];
  acknowledgedBy: VsmSystem[];
  scope?: {
    milestone?: string;
    slice?: string;
    task?: string;
    subsystem?: string;
  };
  mustResolveBefore?: "slice-complete" | "milestone-validation" | null;
  evidence?: EvidenceRef[];
  resolution?: {
    action: string;
    evidence?: EvidenceRef[];
  };
}
```

This shape is illustrative; protocol details should evolve through typed schemas rather than this document becoming an accidental wire contract.

### Exposure to GSD units

The GSD adapter should mechanically compose relevant open regulatory inputs into the context for an appropriate subsequent GSD unit. A planner, reassessment unit, audit unit, or research unit should not have to remember to scan an arbitrary trace file.

Conceptually:

```text
GSD selects next unit
        |
        v
VSM-Pi queries relevant open regulatory records
        |
        v
GSD normal context + applicable S5 constraints + regulatory inputs
        |
        v
unit runs
        |
        v
acknowledgement / resolution / escalation events
```

The adapter should eventually be able to answer questions such as:

- Which open S1 uncertainty signals are relevant to this slice?
- Which S3* findings still require S3 disposition?
- Which S4 intelligence items should influence the next planning step?
- Which policy proposals are awaiting S5/human action?
- Which obligations must be resolved before slice completion or milestone validation?

Routing may be suggested by an agent, but required consumers and blocking boundaries should be validated by host-owned policy.

### Graded obligations, not universal blocking

An uncertainty signal is not automatically a failure. Regulatory records need graded handling.

Examples:

```text
low-impact implementation uncertainty
    -> record / acknowledge / continue

high-impact architecture uncertainty
    -> targeted S3* audit before milestone validation

external dependency uncertainty
    -> S4 research, then S3 disposition

identity/policy ambiguity
    -> proposal or escalation toward S5/human
```

This avoids both bad extremes: treating every uncertainty as a blocker, or treating uncertainty as telemetry nobody is required to consume.

### Regulatory debt

Open obligations constitute **regulatory debt**: information the metasystem knows it has not yet absorbed or resolved.

This debt should eventually be visible by scope and severity. Its existence is not necessarily pathological; a viable system can knowingly defer low-risk questions. The dangerous state is invisible or unbounded regulatory debt, where GSD continues to produce work while unresolved architecture, environment, or identity questions accumulate without disposition.

Repeated residual uncertainty is also feedback about the regulator itself. If plans repeatedly claim to have resolved a decision that S1 then has to rediscover under uncertainty, S3's planning/decomposition process is itself producing inadequate control information.

### Persistence model

The runtime representation should favor an append-only event history plus a derived current-state projection rather than mutable ad hoc files. For example:

```text
.gsd/vsm-runtime/
├── events.jsonl        # durable runtime history: emitted/routed/acknowledged/resolved events
├── state.json          # rebuildable projection of currently open regulatory records
├── traces/
└── cache/
```

The exact storage backend may change. The important invariants are:

- regulatory history is traceable;
- current open obligations are queryable without replaying prose;
- projections are rebuildable from authoritative runtime events where practical;
- GSD workflow state is referenced/correlated, not duplicated;
- committed S5 identity remains separate from machine-written runtime regulatory state.

## Committed identity vs runtime regulatory state

```text
vsm/                        .gsd/vsm-runtime/
----                        -----------------
WHAT THE SYSTEM IS          WHAT THE METASYSTEM STILL KNOWS/OWES

committed                   generated
authoritative identity      regulatory/evidentiary state
human-reviewed              machine-written
S5 policy/invariants        signals/findings/intelligence/obligations
                            correlated to, but not duplicating, GSD state
```

The exact runtime storage may evolve as integration with GSD deepens, but committed identity, GSD workflow state, and VSM-Pi regulatory state must remain conceptually distinct.

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
- typed S1 uncertainty signal;
- append-only regulatory trace/event foundation;
- deterministic gate interface;
- Pi/GSD extension seam;
- traceable decisions/findings/signals;
- one drift-oriented fixture.

Out of scope:

- complete regulatory router/obligation scheduler;
- full regulatory-state projection/query service;
- complete VSM recursion;
- production-grade ontology extraction;
- RDF/SHACL enforcement;
- broad S4 integrations;
- autonomous S5 mutation;
- replacing GSD's scheduler/state machine.
