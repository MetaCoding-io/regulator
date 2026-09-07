# VSM-Pi Design Roadmap

## Purpose

This document keeps the architectural workstreams explicit so implementation work does not cause VSM-Pi to optimize one seam while forgetting the rest of the control system.

The stable stack boundary is:

> **Pi executes. GSD orchestrates. VSM-Pi regulates. S5 defines identity.**

And the state boundary is:

> **GSD owns execution state. VSM-Pi owns regulatory obligations and operational-contract history.**

VSM-Pi should not become a second GSD scheduler. It projects VSM functions onto trusted GSD units/mechanisms, derives capabilities/hooks from that projection, maintains regulatory memory, defines bounded operational contracts, and evaluates regulatory/architectural boundaries.

---

## A. Core design problems

These are the major design problems identified so far. The first three were explicitly selected as the immediate architecture work; the next two were discovered while making them enforceable.

### A1. Regulatory obligation lifecycle — designed, implementation #10

Question: **How does a consequential signal remain present until the metasystem has actually absorbed it?**

Design:

```text
message/event
   -> deterministic routing
   -> zero or more obligations
   -> expose
   -> acknowledge
   -> resolve / escalate / supersede
```

Key rules:

- events are not automatically obligations;
- no `in-progress` state: GSD owns work-in-progress;
- terminal obligation history is immutable;
- reopening/invalidation creates a successor obligation;
- persistence uses dedicated VSM-Pi SQLite, not `.gsd/gsd.db`;
- boundary evaluation can veto progression, but never schedules the next GSD unit.

Reference: `REGULATORY-STATE-AND-ROUTING.md`.

### A2. Scope + routing — designed, implementation #10

Question: **Who must consume a concern, by when, and through which mechanism?**

Routing derives from trusted context and policy, not model self-assertion.

Important distinctions:

- required consumer;
- required mechanism;
- interested consumer;
- origin scope vs visibility scope;
- `mustExposeBy` vs `mustResolveBefore`.

This is also where regulatory attenuation belongs so every low-value signal does not become mandatory bureaucracy.

Reference: `REGULATORY-STATE-AND-ROUTING.md`.

### A3. Operational Work Contract — designed, implementation #11

Question: **What exactly is S3/S2 authorizing S1 to do, and how will the system know the delegated operation succeeded?**

Two levels:

- **Slice Delivery Contract**: what closed feedback loop the GSD slice must complete;
- **Task Work Contract**: what bounded contribution an `execute-task` operation may make.

The contract explicitly allocates consequential decisions as:

```text
FIXED       preserve this decision
DELEGATED   S1 may choose within stated bounds
UNRESOLVED  S1 may not silently settle this choice
```

A paired Operational Result Report records delegated choices, evidence, residual uncertainty, emergent decisions, and deviations against the exact immutable contract version.

Reference: `OPERATIONAL-WORK-CONTRACT.md`.

### A4. Functional projection + authority/capability — designed, implementation #5

Question: **Which VSM functions are participating in the current GSD operation, and what authority does that actually confer?**

VSM-Pi does not instantiate `S1Agent` through `S5Agent`. It projects functions onto GSD units and mechanisms.

```text
GSD unit/mechanism
 + phase/scope
 + separation-of-duty policy
      -> VSM functional participation
      -> capabilities
      -> hook profiles
```

Membership may be many-to-many, but permissions are not a naive union. S3* independence and S5 authority require stronger provenance/authority conditions.

Reference: `GSD-VSM-FUNCTIONAL-MAP.md`.

### A5. Hook/process integration — design partly complete, implementation #5/#10/#11

Question: **Where does VSM regulation enter the GSD loop without creating another loop?**

Primary integration points:

```text
plan/refine/replan
  -> regulatory + S5 context
  -> author/validate work contracts

execute-task
  -> immutable task contract
  -> S1-safe signal tools
  -> result + uncertainty

complete-slice
  -> unresolved obligations + audit evidence
  -> slice delivery feedback check

reassess-roadmap
  -> accumulated signals + S4 intelligence
  -> future planning correction

validate/complete milestone
  -> boundary evaluation
  -> GSD owns remediation/progression
```

A future VSM reconciler is allowed only for concerns with no natural GSD clock edge (time/staleness, external events, aggregation, maintenance). It may derive regulatory state/signals but must not schedule development work.

---

## B. Next design seam: planner-facing contract composition

Before implementing #11, define how contracts compose with GSD's existing planning surface.

The preferred model is **co-authorship at planning time**, not scraping/reconstructing `PLAN.md` after the fact:

```text
GSD plan-slice / refine-slice / replan-slice
        |
        +-- normal GSD plan/requirement tools
        |
        +-- VSM contract authoring seam
                |
                +-- receives host-derived S3/S2 authority
                +-- receives relevant S5/regulatory inputs
                +-- validates Slice Delivery Contract
                +-- validates Task Work Contracts
                +-- persists immutable contract versions in VSM SQLite
```

Questions to settle:

1. Does one `vsm_define_slice_contract` call create the parent contract and task contracts atomically, or should parent/task contract authoring be separate tools?
2. How are GSD task IDs correlated without VSM-Pi creating task state?
3. What contract fields can be inferred safely from GSD plan calls vs must be explicit?
4. At what point is a contract version considered bound to an execution attempt/context?
5. What happens when GSD replans a task/slice before execution vs after partial execution?
6. Which validation failures should block planning completion immediately and which should become regulatory obligations?
7. How should contract validation reference existing GSD acceptance/verification criteria without duplicating them?

Implementation principle:

> **Use GSD planning as the workflow authority and VSM contract tools as typed regulatory/decision-allocation outputs of that planning process.**

---

## C. Remaining architectural weak spots

These are intentionally tracked so the project does not mistake completion of A1-A5 for a complete VSM implementation.

### C1. S2 coverage

We have a strong theory that much of GSD already implements S2 structurally: worktrees, leases, tool contracts, dispatch guards, sequencing, dependency constraints. We still need a concrete gap analysis:

- interface ownership;
- cross-task contract compatibility;
- schema/version coordination;
- dependency ordering;
- integration prerequisites;
- anti-oscillation behavior across repeated replan/rework cycles.

Do not add an S2 persona merely to fill the box.

### C2. S4 operating model

S4 is conceptually defined but still operationally thin. Need to specify:

- demand-triggered research from obligations;
- GSD `research-*` integration;
- intelligence freshness/staleness;
- environment/security/dependency inputs;
- aggregation of recurring uncertainty into strategic concerns;
- when intelligence should propose S5 change vs simply influence S3 planning.

### C3. Machine-readable intended architecture

Current S5 is still mostly Markdown. S3* eventually needs a stronger target than “LLM reads prose.” Future work should model:

- module/ownership boundaries;
- allowed dependencies;
- domain states and lifecycle rules;
- interface/cardinality constraints;
- architecture invariants.

RDF/SHACL remains a likely later mechanism, but should follow a working deterministic-gate path rather than precede it.

### C4. Observed code-facts layer

A machine-readable intended model is only useful if VSM-Pi can also derive trustworthy facts about the implementation:

```text
INTENDED MODEL + OBSERVED CODE FACTS -> conformance evidence
```

Need extractors for imports/dependencies, APIs, domain states, schemas, and other facts relevant to chosen invariants.

### C5. Human/S5 governance

We know proposals cannot mutate S5. We still need an explicit owner workflow for:

- review;
- accept/reject/defer/modify;
- implication/evidence display;
- audited S5 transition;
- high-risk acceptance authority.

### C6. Recursion and scope

Task/slice/milestone/repository/project scopes are only the beginning. Later design should establish when a subsystem can be treated as a recursive viable unit and how regulatory obligations propagate between levels without becoming one global inbox.

### C7. Regulatory attenuation / overload

The regulator itself can suffer a variety explosion. Need policies for:

- severity thresholds;
- aggregation/deduplication;
- interested vs required consumers;
- aging/staleness;
- low-impact trace-only events;
- regulatory-debt summaries.

### C8. Evaluation and economics

The central experiment must measure whether regulation is worth its cost.

Compare GSD vs GSD+VSM-Pi on:

- architectural violations;
- unresolved regulatory debt;
- rework/replans;
- technical failures;
- human escalations;
- token/cost/wall-time overhead;
- emergent undelegated decisions;
- feedback-loop closure;
- final maintainability/conformance.

Issue #12 tracks initial planner-quality/contract-drift diagnostics.

---

## D. Implementation sequence

The near-term sequence should remain deliberately narrow:

```text
#3 / PR #9   generic native Pi authority seam
      |
      v
#4           typed model-facing signals/proposals/audit findings
      |
      v
#5           GSD -> VSM functional projection, capabilities, hook seam
      |
      v
#10          SQLite regulatory obligations + routing + boundaries
      |
      v
#11          slice/task operational contracts + result pairing
      |
      v
#6           deterministic S3* architecture gate over that machinery
      |
      v
#7 / #12     drift experiment + diagnostics
```

Design work may stay one step ahead of implementation, but should not add another orchestration kernel, planner database, or VSM persona fleet.

---

## E. Architectural litmus tests

Before accepting a new VSM-Pi feature, ask:

1. Is this regulatory state, or are we accidentally copying GSD execution state?
2. Can authority be derived mechanically from trusted host context rather than model claims?
3. Is the feature implementing a VSM function/channel, or merely naming an agent after one?
4. Can a deterministic mechanism replace a conversational role here?
5. Does the information remain present until an authorized consumer has actually absorbed it?
6. Does the feature shorten/close a feedback loop, or add process without better observability?
7. Does it preserve separation of duty, especially S1 vs S3* and ordinary GSD units vs S5?
8. Can the regulator attenuate this variety, or will the feature create uncontrolled regulatory overhead?
