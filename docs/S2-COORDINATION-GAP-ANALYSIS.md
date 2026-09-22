# S2 Coordination Gap Analysis

> **Status (2026-09-22): design record.** Written while VSM-Pi was scoped as a regulation
> layer on GSD-Pi. VSM-Pi now provides its own orchestrator
> ([DESIGN-ROADMAP.md](DESIGN-ROADMAP.md) §0); where this document says "GSD unit",
> "GSD remains the scheduler", or "GSD owns execution state", read "the orchestrator".
> The mechanisms described are unchanged and are built through the course.

## Status

Design analysis. This asks what coordination function GSD already performs, what remains weak from a VSM/System 2 perspective, and what VSM-Pi should add without inventing an `S2Agent` or duplicating GSD's scheduler.

Core conclusion:

> **GSD is already strong at coordinating execution resources. The remaining S2 gap is coordinating semantic commitments between operational units.**

In Stafford Beer's VSM, System 2 is not a manager above System 1. It dampens oscillation and coordinates peer operational units so they can retain local autonomy without continually destabilizing one another. For agentic software development, the most useful translation is therefore not another conversational persona but mechanisms that keep independently delegated coding operations compatible.

---

## 1. What GSD already does that is substantially S2

GSD already contains a large amount of structural coordination. VSM-Pi should treat these mechanisms as existing S2 participation rather than recreate them.

### 1.1 Single-host concurrency and exclusion

GSD's coordination layer uses shared SQLite WAL with worker records, milestone leases, unit dispatches, cancellation requests, and a command queue. Milestone leases use fencing tokens and dispatch claiming prevents duplicate ownership of the same unit. This is real anti-conflict coordination, not prompt convention.

VSM interpretation: **resource/ownership coordination between concurrent operational units**.

VSM-Pi action: observe and respect it; do not build another lease/task ownership system.

### 1.2 Worktree and write isolation

GSD enforces worktree/root safety and can fail closed when an execution unit cannot prove it is operating in a safe source-writing root.

VSM interpretation: **spatial separation of operational activity**.

VSM-Pi action: use GSD's trusted working-root/scope information; do not create competing filesystem isolation.

### 1.3 Dependency and readiness coordination

GSD models milestone/slice dependencies and its reactive task graph can derive task dependencies from structured input/output file signatures. It selects ready tasks and can fall back when the graph is ambiguous.

VSM interpretation: **temporal/sequencing coordination**.

VSM-Pi action: do not invent its own task DAG. Where VSM discovers a semantic dependency that GSD does not know about, surface a coordination obligation or planning failure rather than scheduling directly.

### 1.4 File-level conflict attenuation

The reactive task path detects overlapping task outputs and avoids dispatching conflicting writes concurrently.

VSM interpretation: **mechanical attenuation of obvious shared-resource conflict**.

VSM-Pi action: extend coordination above the file level rather than reproducing file-lock/conflict logic.

### 1.5 Tool and capability scoping

GSD narrows model-facing tools by workflow unit and declares required workflow tools. VSM-Pi's functional projection should compose with this mechanism.

VSM interpretation: **behavioral coordination through constrained local affordances**.

VSM-Pi action: project VSM capabilities onto the GSD tool surface; do not bypass unit scoping.

### 1.6 Repository/path targeting

GSD supports slice/task target repositories and validates planned paths against the selected working scope.

VSM interpretation: **coordination of where operational responsibility may act**.

VSM-Pi action: consume this scope as trusted provenance.

### 1.7 Integration closure and boundary-map planning

GSD already asks planners to think in concrete cross-slice boundaries. Its roadmap template tells planners to name APIs, event payloads, shared types/interfaces, persisted shapes, CLI/file-format contracts and invariants, and to state what downstream slices consume. `reassess-roadmap` revisits whether those boundary contracts remain accurate.

This is very close to the semantic S2 problem conceptually.

However, GSD currently persists the milestone boundary map as `boundaryMapMarkdown`: a prose block rather than a typed compatibility object. That is the main seam VSM-Pi can strengthen.

---

## 2. The actual gap: semantic coordination

GSD can coordinate **who runs, where, when, with which files and tools** much better than it can mechanically coordinate **what one operation promises another operation about the system**.

Two tasks can safely write different files while still making incompatible semantic choices.

Example:

```text
T01: API task
  changes deployment state response:
  FAILED now means terminal-only

T02: retry worker task
  assumes FAILED includes retry-in-progress

files overlap: none
worktrees: safe
dispatch: valid
local tests: possibly green
semantic compatibility: broken
```

This is the remaining S2 problem.

### 2.1 Boundary contracts are mostly prose

GSD's Boundary Map is a strong planning convention, but the runtime does not have a first-class typed object it can reliably ask:

- Which operation provides this interface?
- Which operations consume it?
- What compatibility assumption did the consumer plan against?
- Has the provider changed that promise since the consumer was planned?
- Is the change additive/backwards-compatible or breaking?
- Which evidence demonstrates that the producer and consumer still agree?

### 2.2 File conflict is not semantic conflict

Output overlap catches two agents editing the same file. It does not catch:

- API producer and client in separate files;
- schema writer and serializer in separate repositories;
- event publisher and consumer using incompatible payload meanings;
- two modules separately interpreting the same state enum;
- migration and application code disagreeing about lifecycle/cardinality semantics.

### 2.3 Interface ownership is implicit

The design currently lacks a typed answer to "who is allowed to change this shared commitment?"

A shared API, event schema, state transition, or persisted record shape should not be changed merely because an S1 task happens to touch a related file.

This is an implementation-decision authority problem at the S2/S3 boundary, distinct from S5 policy authority.

### 2.4 Compatibility expectations are not versioned with execution

Operational Work Contracts give us immutable versions for delegated work, but we have not yet specified a stable representation of the cross-operation commitments that those contracts rely upon.

Without that, a task can execute against a contract whose local expectations are unchanged while an upstream semantic boundary has drifted.

### 2.5 Coordination oscillation is not yet modeled

GSD has liveness/retry/reconciliation machinery, but that is different from detecting semantic oscillation such as:

```text
A changes interface X
B adapts to X
C changes X back for another local reason
B replans
A reworks
```

Repeated rework around the same shared commitment is itself a regulatory signal: local autonomy is producing unresolved oscillation that S2 failed to attenuate.

This should eventually become visible to S3, but not necessarily be an M0 blocker.

---

## 3. Proposed VSM-Pi addition: typed coordination commitments

Do **not** create an S2 workflow or S2 agent.

Add a small typed representation of semantic commitments that can be referenced by Operational Work Contracts and checked by deterministic mechanisms.

Illustrative shape:

```ts
interface CoordinationCommitment {
  id: string;
  version: number;

  subjectRef: string;
  kind:
    | "api"
    | "event"
    | "type"
    | "schema"
    | "file-format"
    | "state-model"
    | "resource-contract"
    | "other";

  providerScope: RegulatoryScope;
  consumerScopes: RegulatoryScope[];

  promise: string;
  compatibility:
    | "exact"
    | "backward-compatible"
    | "additive"
    | "versioned"
    | "custom";

  sourceRefs: string[];
  evidenceExpectations: EvidenceRef[];
  sourceRevision?: string;
}
```

The exact schema can evolve. The important semantics are:

- a provider states what downstream work may rely on;
- consumers explicitly bind to that commitment/version or compatibility policy;
- ownership/source is traceable;
- changes create successor versions rather than rewriting history;
- violations create regulatory events/obligations; they do not create a new task scheduler.

This is structurally close to Promise Theory: operational units make explicit promises about what they provide, and peer units state what they rely on. S2's job is not to centrally perform their work but to keep those commitments mutually compatible.

---

## 4. How this composes with Operational Work Contracts

The Operational Work Contract remains the delegation artifact. Coordination commitments are cross-contract semantics.

### Slice Delivery Contract

May declare/reference:

```text
provides:
  deployment-status-api@v2

consumes:
  auth-context@v1
  persisted-deployment-record@v3
```

### Task Work Contract

May state:

```text
contributesTo:
  deployment-status-api@v2

consumes:
  persisted-deployment-record@v3

mayChange:
  none of the consumed commitments
```

A task does not receive authority to modify a shared commitment merely because it references it.

If S1 discovers it must change one, it reports an emergent decision/uncertainty. S3/S2-capable planning must then issue a successor contract/commitment or escalate as appropriate.

### Important M0 restraint

Issue #11 should not grow into a complete interface registry.

For M0, it is enough that work contracts preserve stable interface/coordination references and leave room for future compatibility checking. The fuller commitment registry/checking mechanism should be a later issue built on #5, #10 and #11.

---

## 5. S2 checks worth implementing later

A future S2 coordination layer should prefer deterministic checks wherever possible.

### 5.1 Provider/consumer existence

Before task dispatch:

```text
consumer requires commitment C@v3
        ↓
Does a valid provider/version exist in current planning/regulatory context?
```

Missing provider/version -> blocking coordination obligation, not a VSM task state.

### 5.2 Compatibility check

If provider moves from v3 -> v4:

```text
consumer bound to v3
compatibility policy = backward-compatible
        ↓
mechanical/semantic compatibility evidence
```

Failure -> `coordination-drift` finding/obligation exposed to S3/S2 planning.

### 5.3 Ownership check

If a task attempts to redefine a shared commitment outside its delegated authority:

```text
S1 result reports change
        ↓
contract authority check
        ↓
undelegated shared-boundary change
        ↓
regulatory obligation / replan
```

### 5.4 Dependency consistency

If typed provider/consumer relationships imply ordering that is absent from GSD's task/slice dependency graph, VSM-Pi should surface a planning/coordination error.

VSM-Pi does **not** modify GSD's DAG itself.

### 5.5 Semantic conflict despite disjoint files

Two ready tasks may have disjoint output files but both modify the same shared commitment. VSM-Pi can report that they are not coordination-safe for parallel execution.

GSD remains responsible for whether/how dispatch is changed.

### 5.6 Oscillation signal

Repeated incompatible successor versions, repeated rework around the same commitment, or alternating decisions should eventually aggregate into a higher-level `coordination-oscillation` signal for S3/S4.

This is useful telemetry/diagnosis before it becomes hard policy.

---

## 6. What VSM-Pi should explicitly not add

- no `S2Agent` whose primary job is to chat with S1 agents;
- no duplicate worker leases, task locks, retry scheduler, worktree manager or DAG;
- no separate task status for "waiting on interface";
- no parser that pretends free-form Boundary Map markdown is equivalent to a typed semantic contract;
- no automatic rewrite of GSD dependencies behind GSD's back;
- no requirement that every local/private function become a coordination commitment.

S2 representation should be reserved for **shared commitments where one delegated operation can destabilize another**.

---

## 7. Coordination attenuation policy

Not every dependency deserves S2 state. Otherwise the regulator recreates the variety explosion it is meant to attenuate.

Create first-class coordination commitments primarily for boundaries that are:

1. consumed by more than one operational unit or subsystem;
2. cross-repository/process/runtime boundaries;
3. externally/publicly observable;
4. protected by S5/S3 invariants;
5. historically unstable/high-risk;
6. consequential enough that an incompatible local change would force downstream rework.

Private helper structure normally remains delegated S1 variety.

---

## 8. Revised assessment of S2 coverage

The earlier concern that "S2 is our weakest VSM function" was too broad.

A more accurate statement is:

> **GSD already supplies a strong execution-level S2. VSM-Pi is weak specifically on semantic S2: explicit, machine-checkable commitments between independently delegated operations.**

This is a much narrower and more tractable gap.

It also suggests a clean layering:

```text
GSD S2 mechanisms
  leases / worktrees / sequencing / file conflict / tool scope
            +
VSM-Pi semantic S2
  boundary commitments / compatibility / ownership / drift
            ↓
coordinated S1 autonomy
```

The purpose is not to centralize S1 decisions in S3. It is to let S1 remain autonomous **within a space where peer commitments stay compatible**.
