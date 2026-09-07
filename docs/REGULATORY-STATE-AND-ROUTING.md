# Regulatory State and Routing

## Status

Design document. This defines the durable regulatory-memory model that sits between typed VSM messages and GSD workflow progression.

It complements [GSD → VSM Functional Projection](GSD-VSM-FUNCTIONAL-MAP.md):

- the functional projection answers **what VSM functions and capabilities are active in this GSD context?**;
- this document answers **what unresolved regulatory information must those functions consume, disposition, or escalate?**

The core boundary is:

> **GSD owns execution state. VSM-Pi owns regulatory obligations.**

VSM-Pi may remember, classify, route, expose, constrain, and veto at defined boundaries. GSD remains the clock and scheduler: it decides which workflow unit runs next.

---

## 1. Events are not obligations

A VSM message records something that happened or was observed. An **obligation** records something the metasystem still needs to absorb.

```text
S1 emits uncertainty U17
        │
        ▼
VSM event persisted
        │
        ▼
routing policy evaluates it
        │
        ├── low/local → no durable obligation, trace only
        │
        └── consequential → obligation O31
                            │
                            ▼
                    remains open until
                    validly dispositioned
```

This distinction prevents every signal from becoming bureaucracy while also preventing consequential signals from disappearing into a log.

### Regulatory event

An immutable fact in the runtime history, for example:

- uncertainty emitted;
- audit finding emitted;
- intelligence reported;
- policy proposal submitted;
- obligation opened;
- obligation acknowledged;
- child obligation created;
- obligation resolved/escalated/superseded;
- boundary evaluation performed.

### Regulatory obligation

A durable statement that a particular concern still requires authorized regulatory handling.

An obligation is **not** a GSD task. It does not mean work is running, queued, or scheduled. It only means the regulatory system has not yet demonstrated that the concern was absorbed.

> **No `in-progress` state belongs in the VSM obligation lifecycle. GSD already owns work-in-progress state.**

---

## 2. Obligation lifecycle

The intentionally small lifecycle is:

```text
                    ┌──────────────┐
                    │     OPEN     │
                    └──────┬───────┘
                           │ acknowledge
                           ▼
                    ┌──────────────┐
                    │ ACKNOWLEDGED │
                    └──────┬───────┘
                           │
           ┌───────────────┼────────────────┐
           │               │                │
           ▼               ▼                ▼
      ┌──────────┐   ┌───────────┐   ┌────────────┐
      │ RESOLVED │   │ ESCALATED │   │ SUPERSEDED │
      └──────────┘   └───────────┘   └────────────┘
```

An authorized consumer may resolve an `open` obligation atomically when no separate acknowledgment phase is useful. Such an action semantically includes acknowledgment; the event history should still make the disposition explicit.

### `open`

Required regulatory attention has not yet been demonstrated.

### `acknowledged`

An authorized consumer has explicitly considered the obligation, but further action/evidence is still required.

Acknowledgment is never equivalent to correctness. It means only **the information was received by a function authorized to handle it**.

### `resolved`

No further regulatory action is required under current policy. Resolution must carry a disposition and rationale; blocking/critical cases normally require evidence.

### `escalated`

The current authority level cannot legitimately resolve the concern and has created a successor obligation for a different/higher authority or mechanism.

`escalated` is only valid when the successor link exists. It must never mean "someone else should probably look at this."

### `superseded`

A newer decision, model revision, finding, or obligation has replaced the concern. Supersession requires an explicit successor/reference and rationale.

### Terminal records do not reopen in place

`resolved`, `escalated`, and `superseded` history remains immutable. If later evidence invalidates a prior resolution, create a **new successor obligation** linked with `reopens`/`invalidates` provenance. This keeps the audit trail truthful.

---

## 3. Dispositions are separate from states

Do not encode every outcome into the state enum.

Illustrative disposition vocabulary:

```ts
export type RegulatoryDisposition =
  | "no-action"
  | "accepted-risk"
  | "rework"
  | "replan"
  | "audit-requested"
  | "research-requested"
  | "policy-clarification-requested"
  | "fixed"
  | "verified"
  | "rejected";
```

Examples:

```text
state: resolved
disposition: fixed
```

```text
state: resolved
disposition: accepted-risk
```

```text
state: escalated
disposition: research-requested
successor: O44
```

Risk acceptance is authority-sensitive. A model cannot make a high-risk concern disappear merely by selecting `accepted-risk`.

---

## 4. Illustrative obligation shape

The implementation does not need to use this exact interface, but the semantics should remain explicit.

```ts
interface RegulatoryObligation {
  id: string;
  createdAt: string;
  sourceEventIds: string[];

  concern: RegulatoryConcern;
  effectiveSeverity: "info" | "advisory" | "blocking" | "critical";

  scope: RegulatoryScope;

  status:
    | "open"
    | "acknowledged"
    | "resolved"
    | "escalated"
    | "superseded";

  requiredConsumers: VsmSystem[];
  requiredMechanisms: string[];
  interestedConsumers: VsmSystem[];

  mustExposeBy?: RegulatoryBoundary;
  mustResolveBefore?: RegulatoryBoundary;

  acknowledgedBy: RegulatoryActorRef[];

  disposition?: RegulatoryDisposition;
  rationale?: string;
  evidence: EvidenceRef[];

  successorObligationIds: string[];
  sourceRevision?: string;
}
```

### Reported impact vs effective severity

Model-supplied confidence/severity is advisory input, not final policy.

For example, S1 may report:

```text
impact_if_wrong: medium
```

but a routing rule may discover that the uncertainty touches a protected invariant and derive:

```text
effectiveSeverity: blocking
```

The inverse must not happen merely because an agent under-reports risk. Hard policy/invariant matches set a floor on effective severity.

---

## 5. Scope

Every event and obligation needs scope so regulatory state does not become one global inbox.

Illustrative scope:

```ts
interface RegulatoryScope {
  project?: string;
  repository?: string;
  milestone?: string;
  slice?: string;
  task?: string;

  subsystem?: string;
  subjectRefs?: string[];
  invariantRefs?: string[];

  sourceRevision?: string;
}
```

GSD identifiers are **references** into GSD workflow state, not copies of that state.

### Origin scope and visibility are different

A concern can originate in one task but matter more broadly.

Example:

```text
origin: M001 / S02 / T03
subject: deployment lifecycle
visibility: milestone
```

Routing policy therefore derives how far an obligation should propagate rather than blindly equating origin scope with audience.

A useful initial visibility model is:

```ts
type RegulatoryVisibility =
  | "origin"
  | "slice"
  | "milestone"
  | "repository"
  | "project";
```

### Default propagation intuition

- task-local implementation detail → origin/slice;
- interface/coordination concern → slice or milestone;
- architectural/domain concern → milestone/repository;
- external/platform assumption → milestone/repository depending subject;
- policy/identity concern → project/S5;
- critical/algedonic concern → S5/human regardless of local origin.

The router, not the emitting model, owns this decision.

---

## 6. Consumers, mechanisms, and interested parties

Routing produces three different concepts.

### Required consumer

A VSM function must explicitly disposition or escalate the obligation.

Example:

```text
requiredConsumers: [S3]
```

### Required mechanism

A structural mechanism must execute before the concern can be considered resolved.

Example:

```text
requiredMechanisms: ["dependency-contract-check"]
```

This is particularly important for S2 and S3*. We should prefer mechanisms over conversational acknowledgment when a mechanical check exists.

### Interested consumer

A function should receive the information when relevant, but it does not itself block resolution.

Example:

```text
interestedConsumers: [S4]
```

This prevents "everyone must acknowledge everything" from becoming the system's own variety explosion.

---

## 7. Exposure and resolution boundaries

Two different deadlines are needed.

### `mustExposeBy`

By this GSD boundary, the obligation must be put in front of an appropriate consumer.

Exposure does not imply resolution.

### `mustResolveBefore`

This boundary is not allowed to pass while the obligation remains unresolved under policy.

Initial boundary vocabulary:

```ts
export type RegulatoryBoundary =
  | "task-publish"
  | "slice-close"
  | "roadmap-reassessment"
  | "milestone-validation"
  | "milestone-completion";
```

This supports useful asymmetry:

```text
medium architecture uncertainty
mustExposeBy: roadmap-reassessment
mustResolveBefore: milestone-validation
```

The system can keep doing useful work without forgetting the concern.

---

## 8. Initial routing table

This is policy, not prompt advice. The eventual implementation should make the table declarative/testable and allow project policy to refine it without allowing model input to weaken hard constraints.

| Input concern | Required consumer | Required mechanism / secondary route | Exposure | Resolution boundary | Notes |
| --- | --- | --- | --- | --- | --- |
| low-impact local implementation uncertainty | S3 | none | next S3 control boundary | none | may be aggregated/recorded without blocking |
| medium/high interface or sequencing uncertainty | S3 | S2 coordination/contract mechanism when available | next plan/refine/reassess | high: slice-close; medium: milestone-validation | S2 should usually be mechanism, not a chatbot |
| architecture/domain uncertainty, advisory | S3 | targeted S3* audit optional/policy-driven | next S3 control boundary | milestone-validation | expose relevant S5 constraints |
| architecture/domain uncertainty, blocking/high | S3 | independent S3* audit required | complete-slice or reassess | milestone-validation; earlier if invariant says so | executor cannot self-resolve |
| external API/dependency/platform uncertainty | S3 | S4 research child obligation | next reassess/plan | policy-dependent; high usually milestone-validation | S4 returns intelligence; S3 still dispositions operational effect |
| policy/identity ambiguity | S3 initially | S5/human successor obligation | immediate next control boundary | before affected operation/validation per severity | ordinary GSD unit does not become S5 |
| advisory audit finding | S3 | none or rework mechanism | next S3 closeout/reassess | none unless policy upgrades | independent evidence remains traceable |
| blocking audit finding | S3 | GSD rework/remediation path | immediate closeout | relevant slice/milestone boundary | S3* emits evidence; S3 dispositions |
| critical audit/security finding | S3 + S5/human | algedonic escalation / GSD pause seam | immediate | immediate/before progression | cannot be accepted by ordinary S3 if policy forbids |
| S4 intelligence, non-stale | S3 | none | next planning/reassessment | none by default | intelligence informs control but is not policy |
| stale/expired S4 intelligence still required by active plan | S3 | S4 refresh research obligation | next planning/reassessment | before boundary relying on assumption | stale evidence cannot certify current decision |
| policy proposal | S5/human | explicit owner approval workflow | when proposal relevant | before mutation; may remain pending if not blocking | proposal never mutates S5 itself |
| algedonic signal | S5/human | GSD-supported pause/attention seam | immediate | immediate according to configured severity | bypasses ordinary hierarchy by design |

### Routing is allowed to create child obligations

Example:

```text
U17: S1 uncertainty about external API behavior
        │
        ▼
O31: S3 must disposition U17
        │
        ├─ S3 acknowledges
        └─ route → research-requested
                    │
                    ▼
             O32: S4 must research API behavior
                    │
                    ▼
             I18: intelligence returned
                    │
                    ▼
             O32 resolved
                    │
                    ▼
             S3 resolves O31 using I18
```

The parent remains unresolved while its required child evidence is outstanding.

---

## 9. GSD consumption points

The functional projection determines which open obligations are automatically exposed at each GSD unit.

| GSD unit | Regulatory inputs that should be exposed |
| --- | --- |
| `execute-task` / S1 | Operational Work Contract, applicable S5 constraints, scoped known uncertainties; no privileged resolution capability |
| `plan-slice`, `refine-slice`, `replan-slice` / S3+S2 | open S3 obligations in scope, interface/coordination concerns, prior audit findings, applicable S5 constraints |
| `research-slice`, `research-milestone` / S4 | open S4 research obligations, stale assumptions, external/environment questions |
| `complete-slice` / S3 + S3* boundary | unresolved slice obligations, audit findings, boundary-blocking items |
| `reassess-roadmap` / S3+S4 | milestone-level uncertainty, intelligence, audit findings, unresolved planning assumptions |
| `run-uat`, `gate-evaluate` / S3* | explicit audit/acceptance obligations, intended observable outcomes, relevant source revision |
| `validate-milestone` / S3 + S3* boundary | all milestone/repository obligations whose resolution boundary is milestone validation or earlier |
| `complete-milestone` / S3 | unresolved completion-blocking obligations and accepted-risk rationale |

The adapter should inject relevant state automatically. Agents must not be expected to remember to read an `uncertainties.json` file.

---

## 10. Host API vs model-facing API

### Model-facing messages/tools

Models may report observations through narrow typed tools, for example:

```text
vsm_report_uncertainty
vsm_report_audit_finding
vsm_report_intelligence
vsm_propose_policy_change
```

The model reports the observation. It does not choose authoritative routing, capabilities, or final severity.

### Host/control API

The privileged regulatory API should be invoked only through capabilities derived from trusted GSD/VSM context.

Illustrative surface:

```ts
recordMessage(message, context): EventReceipt
routeEvent(eventId, context): RoutingResult

getOpenObligations(context): RegulatoryObligation[]
getRegulatoryContext(context): RegulatoryContext

acknowledgeObligation(id, authority, rationale): Receipt
resolveObligation(id, authority, disposition, evidence): Receipt
escalateObligation(id, authority, target, rationale): Receipt
supersedeObligation(id, authority, successor, rationale): Receipt

evaluateBoundary(context, boundary): BoundaryDecision
rebuildProjection(events): RegulatoryState
```

A future model-facing disposition tool may exist for S3/S4/S5-capable GSD contexts, but the tool itself must derive authority from host context. It must not accept a model-supplied `source: "S3"` as proof of S3 authority.

---

## 11. Boundary evaluation

A VSM boundary hook does not schedule remediation. It returns regulatory evidence to GSD's existing closeout/recovery machinery.

Illustrative result:

```ts
interface BoundaryDecision {
  allowed: boolean;
  boundary: RegulatoryBoundary;
  blockingObligationIds: string[];
  advisoryObligationIds: string[];
  reason?: string;
}
```

Example:

```text
before milestone-validation
        │
        ▼
evaluateBoundary(...)
        │
        ├── allowed → GSD continues normally
        │
        └── blocked → return blocking obligations/evidence
                      to GSD-supported rework/remediation/pause path
```

VSM-Pi does **not** decide which GSD unit runs next.

---

## 12. Separation of duty rules

Regulatory state must preserve the authority model from the functional projection.

Minimum invariants:

1. S1 may report uncertainty but cannot resolve a consequential obligation created from its own uncertainty merely by asserting confidence later.
2. S3* may emit independent audit evidence but does not disposition the operational obligation as S3.
3. A finding only counts as independent S3* evidence when provenance satisfies the configured independence policy.
4. S4 intelligence can satisfy a research obligation but does not automatically decide operational policy.
5. S3 may disposition ordinary operational concerns but high/critical risk acceptance can require S5/human authority.
6. Policy proposals cannot mutate S5.
7. Model-supplied `source`, `authority`, `functions`, `capabilities`, `requiredConsumers`, or `mustResolveBefore` cannot override host-derived policy.
8. Unknown/unmapped GSD contexts fail closed for privileged acknowledgment/resolution capabilities.

---

## 13. Revision and staleness semantics

Evidence must remain tied to the implementation/model revision it actually observed.

### Source changes

A passing audit tied to revision `abc123` cannot certify revision `def456` unless the checker explicitly proves that the relevant observed facts are unchanged.

A source change does not silently delete an old finding. Instead, policy may:

- mark the evidence stale for current-boundary purposes;
- create a re-verification obligation;
- supersede an implementation-specific concern when the offending code disappears, with evidence;
- keep historical findings immutable.

### Intelligence expiration

S4 intelligence may carry `expiresAt` or another validity condition. If an active plan still relies on expired intelligence, the projection/reconciler should create a refresh obligation rather than treating the old observation as current truth.

Time-based reconciliation is later work; the data model should preserve enough information now to support it.

---

## 14. Regulatory debt

Open obligations are **regulatory debt**: information the metasystem knows it has not yet absorbed.

This is intentionally not equivalent to failure.

A project may carry many low-impact open obligations while continuing productively. What matters is distribution by severity, age, scope, and required boundary.

Useful later metrics include:

```text
open obligations by severity
oldest unresolved obligation
blocking obligations by milestone
uncertainty generated per slice
prospective vs residual uncertainty
obligations reopened after prior resolution
regulatory overhead vs prevented rework
```

The regulator itself has a variety problem, so VSM-Pi should eventually aggregate/deduplicate repetitive low-impact signals instead of flooding every planning context.

---

## 15. Persistence model

The logical persistence model is:

```text
immutable regulatory events
        │
        ▼
rebuildable regulatory-state projection
```

The storage technology is deliberately not fixed by this design.

A minimal prototype may use an append-only JSONL event trace plus an atomic projection. However, if concurrent Pi/GSD processes can write regulatory state, a dedicated VSM-Pi SQLite store is preferable to pretending a shared JSONL file is a safe concurrent database.

Whichever representation is chosen:

- it must remain separate from GSD's workflow database;
- VSM-Pi must not read/write GSD's DB directly;
- GSD IDs are correlation references only;
- projection state must be reconstructable from durable regulatory history, or the chosen store must provide equivalent transactional history/projection semantics;
- persistence failures must fail closed for blocking regulatory actions.

---

## 16. Minimal M0 subset

The full design should not become an M0 bureaucracy cathedral.

The first implementation only needs to prove the control pattern:

```text
#4 typed event emitted
      ↓
minimal deterministic routing
      ↓
open obligation projected
      ↓
#5 GSD/VSM functional context determines authorized consumer
      ↓
obligation automatically exposed at a later GSD boundary
      ↓
authorized disposition/evidence recorded
      ↓
#6 architecture gate can block a boundary through existing GSD recovery semantics
```

M0 should initially support at least:

- uncertainty events from S1;
- audit findings from S3*;
- policy proposals as S5-facing pending state;
- scope correlated to GSD milestone/slice/task when available;
- `open`, `acknowledged`, `resolved`, `escalated`, `superseded` projection states;
- deterministic routing for the small set of cases in the initial routing table;
- querying relevant open obligations by GSD/VSM context;
- one boundary evaluation path used by the first architecture gate;
- append-only provenance sufficient to explain every disposition.

Explicitly defer:

- periodic autonomous reconciler loops;
- time-triggered S4 refresh;
- uncertainty clustering/deduplication;
- broad project-configurable policy DSL;
- cross-project recursion;
- autonomous S5 decisions;
- sophisticated risk scoring.

---

## 17. Worked example: retry-state uncertainty

S3 hands S1 a work contract to add automatic retries.

During execution S1 reports:

```text
U17
subject: deployment lifecycle
observation: represented retry as FAILED + retry_count
reason: architecture does not say whether retrying is a distinct state
impact_if_wrong: high
origin: M001/S02/T03
```

Routing derives:

```text
O31
concern: architecture/domain uncertainty
effectiveSeverity: blocking
requiredConsumers: [S3]
requiredMechanisms: [independent architecture audit]
mustExposeBy: slice-close
mustResolveBefore: milestone-validation
visibility: milestone
```

GSD continues to `complete-slice` according to its own loop. The VSM adapter injects O31 automatically because `complete-slice` participates in S3 and is in scope.

S3 acknowledges and requests audit. That creates child obligation O32 for an independent S3* mechanism.

S3* produces:

```text
A44
invariant: terminal FAILED means no automatic transition remains
finding: FAILED + retry_count violates lifecycle invariant
sourceRevision: abc123
```

S3 chooses rework through GSD's supported mechanism. After the implementation introduces `RETRYING`, independent verification passes on the new source revision.

O32 resolves as `verified`; S3 resolves O31 as `fixed` using the new audit evidence.

At milestone validation, the boundary evaluator sees no unresolved obligation whose deadline is `milestone-validation` and allows GSD to continue.

At no point did VSM-Pi schedule the rework task itself.

---

## 18. Design rules to preserve

> **A signal is not consumed merely because it was logged.**

> **Acknowledgment proves receipt, not correctness.**

> **An obligation cannot disappear; it terminates with explicit provenance or creates a successor.**

> **The model may report risk, but the host determines regulatory authority and effective policy.**

> **VSM-Pi remembers what must not be forgotten. GSD decides what happens next.**
