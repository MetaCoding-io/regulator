# Operational Work Contract

## Status

Design document. This defines the contract by which GSD planning delegates bounded operational work to S1 while preserving observable feedback, decision authority, and regulatory provenance.

It complements:

- `docs/GSD-VSM-FUNCTIONAL-MAP.md` — which VSM functions/capabilities are active in a GSD context;
- `docs/REGULATORY-STATE-AND-ROUTING.md` — which unresolved concerns must be carried forward and dispositioned;
- this document — what S3/S2 is actually authorizing S1 to do, what must remain fixed, and how success will be observed.

The core rule is:

> **S3/S2 must not hand S1 only a task description. They hand S1 a bounded operation: objective, observable feedback, constraints, decision authority, and known unresolved regulatory inputs.**

The contract is not a task tracker and not another scheduler. GSD remains authoritative for milestones, slices, tasks, attempts, retries, completion, and progression.

---

## 1. Why a contract is needed

A plain implementation task such as:

```text
Add deployment cancellation support.
```

leaves many decisions implicit:

- whether cancellation is a new lifecycle state or a boolean flag;
- which APIs may change;
- whether backwards compatibility is fixed or negotiable;
- which invariants must still hold;
- what evidence demonstrates success;
- whether retries, rollback, or approval semantics are in scope;
- what S1 is authorized to decide locally.

That is exactly where locally plausible agent changes can accumulate into architectural drift.

The Operational Work Contract makes the **allocation of variety** explicit before execution:

```text
               S5 / prior decisions
                       │
                       ▼
               fixed constraints
                       │
                       ▼
S3/S2 planning ──► Operational Work Contract
                       │
              ┌────────┼────────┐
              │        │        │
            fixed   delegated unresolved
          decisions  decisions  decisions
              │        │        │
              └────────┼────────┘
                       ▼
                      S1
                       │
                       ▼
                result + evidence
                + residual uncertainty
```

The contract does **not** remove all S1 autonomy. It states where autonomy exists.

---

## 2. Two levels: slice delivery and task work

A key distinction is necessary because GSD already uses a **slice** containing one or more tasks.

A vertical slice is primarily a **delivery property of the GSD slice**, not necessarily of each individual task.

Therefore VSM-Pi should use a small contract family rather than forcing every `execute-task` unit to pretend it is end-to-end.

### 2.1 Slice Delivery Contract

Owned/produced by S3 + S2 planning around `plan-slice`, `refine-slice`, or `replan-slice`.

It answers:

> **What closed feedback loop is this slice intended to complete?**

It defines:

- delivery shape (`vertical`, `horizontal-enabling`, `integration`);
- intended observable outcome;
- end-to-end path or integration proof;
- relevant S5 constraints/invariants;
- important interfaces/boundaries;
- regulatory obligations/known uncertainties that must be carried through the slice;
- verification expectations at slice close.

### 2.2 Task Work Contract

Owned/produced by S3/S2 planning and bound to one GSD task/`execute-task` context.

It answers:

> **What part of the parent slice may this S1 operation change, what decisions may it make, and what evidence must it return?**

It defines:

- task objective/contribution to the parent slice outcome;
- scope/boundaries;
- fixed decisions;
- delegated decisions;
- unresolved decisions and their handling;
- applicable constraints/invariants;
- expected evidence;
- relevant known uncertainty/regulatory inputs.

This structure allows a vertical slice to contain several task-level operations without falling back into an unconstrained horizontal build.

Example:

```text
Slice Delivery Contract
  shape: vertical
  outcome: user can cancel a pending deployment through public API

  Task T1
    add lifecycle/domain transition

  Task T2
    wire cancellation command through service/API

  Task T3
    add end-to-end acceptance/integration evidence
```

The slice closes only when the parent observable outcome is demonstrated.

---

## 3. Slice Delivery Contract

Illustrative shape:

```ts
interface SliceDeliveryContract {
  id: string;
  version: number;

  scope: {
    project?: string;
    repository?: string;
    milestone: string;
    slice: string;
  };

  objective: string;
  requirementRefs: string[];

  workShape: "vertical" | "horizontal-enabling" | "integration";

  observableOutcomes: ObservableOutcome[];

  endToEndPath?: string[];
  horizontalJustification?: string;
  integrationProof?: ObservableOutcome[];

  constraintRefs: string[];
  interfaceRefs: string[];
  regulatoryInputIds: string[];

  planningProvenance: PlanningProvenance;
}
```

The exact implementation type may differ. The semantics matter more than these field names.

### 3.1 Observable outcomes

An outcome describes something the system can actually observe, not merely an implementation activity.

Illustrative:

```ts
interface ObservableOutcome {
  id: string;
  description: string;
  evidenceClass:
    | "test"
    | "command"
    | "runtime"
    | "metric"
    | "user-visible"
    | "structural"
    | "semantic";

  oracle?: string;
  required: boolean;
}
```

Good:

```text
POST /deployments/{id}/cancel transitions a PENDING deployment to CANCELLED
and returns the resulting lifecycle state.
```

Weak:

```text
Implement cancellation classes and repository methods.
```

The first describes feedback. The second describes activity.

### 3.2 Vertical

`vertical` means the slice crosses the minimum set of system boundaries required to demonstrate meaningful end-to-end behavior.

It requires:

- at least one observable end-to-end outcome;
- a plausible end-to-end path;
- evidence that can be evaluated at slice close.

A vertical slice may use stubs/mocks for boundaries outside the current increment as long as the contract makes those boundaries explicit.

### 3.3 Horizontal-enabling

Horizontal work is allowed, but must prove why it exists.

A valid horizontal-enabling contract requires:

1. **justification** — why a thin end-to-end slice is not appropriate yet;
2. **integration proof** — what observable condition demonstrates that the enabling work is actually usable by the larger feedback loop it supports.

Example:

```text
shape: horizontal-enabling

justification:
Create the versioned deployment-state contract shared by three upcoming slices.

integration proof:
Existing consumers compile against the new contract and compatibility tests
prove the old wire representation is preserved.
```

The design principle is not "vertical always good, horizontal always bad." It is:

> **Every slice must close a meaningful feedback loop or explicitly show how it enables one.**

### 3.4 Integration

`integration` is for work whose primary purpose is connecting already-built components or independently produced S1 outputs.

It still requires an observable integrated condition.

---

## 4. Task Work Contract

Illustrative shape:

```ts
interface TaskWorkContract {
  id: string;
  version: number;
  parentSliceContractId: string;
  parentSliceContractVersion: number;

  scope: {
    project?: string;
    repository?: string;
    milestone: string;
    slice: string;
    task: string;
  };

  objective: string;
  contributionToSliceOutcome: string;

  constraintRefs: string[];
  interfaceRefs: string[];
  regulatoryInputIds: string[];

  fixedDecisions: FixedDecision[];
  delegatedDecisions: DelegatedDecision[];
  unresolvedDecisions: UnresolvedDecision[];

  expectedEvidence: EvidenceExpectation[];

  planningProvenance: PlanningProvenance;
}
```

The contract deliberately does **not** contain GSD task status, attempt status, retry count, dispatch ownership, or completion state.

---

## 5. Decision allocation: the core of the contract

The strongest part of the contract is explicit decision allocation.

```text
FIXED
  already decided; S1 must preserve it

DELEGATED
  S1 is authorized to choose within defined bounds

UNRESOLVED
  the system knows the choice is still open;
  S1 may not silently settle it by omission
```

This is a concrete representation of **variety allocation**.

### 5.1 Fixed decisions

A fixed decision has authority/provenance.

Illustrative:

```ts
interface FixedDecision {
  id: string;
  subject: string;
  decision: string;
  authorityRef: string; // S5 invariant, accepted ADR/decision, S3 planning decision, etc.
  rationale?: string;
}
```

Example:

```text
subject: cancellation lifecycle representation

decision:
Cancellation is represented as an explicit lifecycle state, not a boolean flag.

authority:
INV-STATE-004 / accepted planning decision D17
```

S1 may discover that the fixed decision is impossible or harmful. It may report uncertainty, deviation, or propose a change. It may not silently reinterpret the decision.

### 5.2 Delegated decisions

A delegated decision defines real autonomy.

Illustrative:

```ts
interface DelegatedDecision {
  id: string;
  subject: string;
  bounds: string;
  requiredReport?: boolean;
}
```

Example:

```text
subject:
private helper decomposition for cancellation validation

bounds:
May introduce private helpers inside the deployment domain module;
must not alter public API signatures or lifecycle semantics.
```

A contract should not enumerate trivial choices. It should name decisions whose architectural/behavioral consequences are material enough that explicit delegation is useful.

### 5.3 Unresolved decisions

An unresolved decision is a known gap that planning has not legitimately allocated to S1.

Illustrative:

```ts
interface UnresolvedDecision {
  id: string;
  subject: string;
  reason: string;
  obligationId?: string;
  handling:
    | "resolve-before-execution"
    | "defer"
    | "stub-boundary"
    | "research"
    | "policy-clarification";
}
```

Critical rule:

> **If completing the task necessarily requires settling an unresolved decision, the contract is invalid unless an authorized planning context resolves it or explicitly reclassifies it as delegated.**

Otherwise we are pretending the planner preserved uncertainty while forcing S1 to guess anyway.

Example:

```text
UNRESOLVED:
Does rollback remain valid after cancellation?

handling:
stub-boundary

obligation:
O44 — S3/S4 must resolve before milestone validation
```

S1 can implement cancellation while preserving the rollback boundary without inventing policy.

---

## 6. Implementation authority is not VSM authority

The contract delegates **implementation decisions**. It does not grant VSM regulatory capabilities.

This distinction must be mechanical.

```text
Task contract says:
"S1 may choose private persistence helper design"

DOES NOT imply:
"S1 may acknowledge audit obligations"
"S1 may accept architectural risk"
"S1 may mutate S5"
```

VSM capabilities still come from trusted GSD -> VSM functional projection, phase, scope, and separation-of-duty policy.

A model-facing contract schema must not accept fields such as:

```text
authority: S5
capabilities: [mutate-s5]
functions: [S3*]
requiredConsumers: ...
```

as a way to self-promote authority.

---

## 7. Regulatory inputs are part of planning

A contract is partly compiled from current regulatory memory.

Planning should receive:

```text
S5 constraints
+ GSD requirements/plan context
+ open regulatory obligations
+ audit findings
+ relevant S4 intelligence
+ prior planning decisions
```

and produce a contract that explicitly references the regulatory inputs it considered.

This gives us a useful invariant:

> **A high-impact obligation relevant to the task/slice may not vanish merely because planning produced a new task.**

The router/projection decides which obligations are relevant. The contract records their IDs so later execution and closeout can show what planning was expected to account for.

---

## 8. Prospective uncertainty and residual uncertainty

The contract is where **prospective uncertainty** becomes explicit.

Before execution:

```text
What consequential decisions remain unresolved?
```

After execution, S1 reports **residual uncertainty**:

```text
What consequential decisions did I still have to make under uncertainty?
```

Comparing them reveals planning quality.

### Example

Contract:

```text
fixed: cancellation is explicit state

delegated: internal validation helper structure

unresolved: rollback-after-cancel semantics
```

S1 result:

```text
Delegated choice:
introduced validateCancellationTransition()

Emergent consequential decision:
retrying deployments currently use FAILED + retry_count;
cancellation interactions depend on whether FAILED is terminal.
```

That emergent decision was neither fixed, delegated, nor declared unresolved.

The correct response is not to retroactively pretend it was delegated. It becomes regulatory information:

```text
contract-deviation/emergent-decision event
        ↓
routing
        ↓
S3 / possible S3* obligation
```

That is how the system can detect that S3's plan failed to expose a consequential choice.

---

## 9. Operational Result Report

A contract without a structured result is only half a feedback loop.

Each executed task should produce a minimal result tied to the exact contract version.

Illustrative:

```ts
interface OperationalResultReport {
  contractId: string;
  contractVersion: number;

  evidence: EvidenceRef[];

  delegatedDecisionResults: Array<{
    decisionId: string;
    choice: string;
    rationale?: string;
  }>;

  uncertaintySignalIds: string[];

  emergentDecisions: Array<{
    subject: string;
    choiceOrQuestion: string;
    consequenceIfWrong: "low" | "medium" | "high";
  }>;

  deviations: Array<{
    kind: "fixed-decision" | "constraint" | "scope" | "interface";
    ref?: string;
    description: string;
  }>;
}
```

Again, exact fields may differ.

The report should not self-certify success. It supplies evidence and observations.

GSD/S3*/host verification determines whether required technical and regulatory conditions are actually met.

### Delegated decisions should close explicitly

If the contract names a consequential delegated decision, the result should record what S1 chose.

That prevents delegated architectural choices from disappearing into the diff.

### Emergent decisions are not automatically failures

An emergent decision may be harmless or unavoidable. Its significance is that planning did not allocate it explicitly.

Policy/routing decides whether it is:

- trace-only;
- a planning-quality signal;
- an S3 obligation;
- a targeted S3* audit trigger;
- an S4 research question;
- an S5 proposal/escalation.

---

## 10. Contract lifecycle and versioning

Contracts should be immutable once bound to execution.

Do not use a mutable lifecycle such as:

```text
draft -> active -> in progress -> complete
```

because GSD already owns execution lifecycle.

Instead, think in immutable versions:

```text
Slice Contract SC-12 v1
Task Contract TC-31 v1
     │
     └── GSD executes against TC-31 v1

new evidence / replan
     │
     ▼
Slice Contract SC-12 v2
Task Contract TC-31 v2
```

Historical results remain tied to the version that governed their execution.

### Important provenance

A contract version should carry enough host-owned provenance to answer:

- which GSD milestone/slice/task was this for?
- which parent slice contract governed the task?
- what planning unit/session produced it?
- which regulatory obligations were visible?
- which S5 constraints/invariants were referenced?
- what source/plan revision existed when the contract was created?

A later contract version should link to the predecessor and explain why replanning occurred.

---

## 11. GSD integration points

### 11.1 `plan-slice` / `refine-slice` / `replan-slice`

Functional membership: S3 + S2.

VSM-Pi should:

```text
inject:
  applicable S5 constraints
  open scoped obligations
  relevant audit findings/intelligence

allow:
  host-authorized contract definition/update

validate:
  shape rules
  feedback loop
  decision allocation
  regulatory carry-through
```

A likely model-facing tool is conceptually:

```text
vsm_define_work_contract
```

using a closed discriminated schema for `slice` vs `task` contracts.

The exact name is less important than the authority rule: the tool is only useful because the host has already established an S3/S2 planning context.

### 11.2 `execute-task`

Functional membership: S1.

VSM-Pi should automatically inject:

```text
exact Task Work Contract version
+ parent Slice Delivery Contract outcome summary
+ applicable S5 constraints
+ scoped known regulatory inputs
```

S1 may:

- execute within the contract;
- report uncertainty;
- report result evidence/decisions/deviations;
- propose S5 changes through the normal proposal channel.

S1 may not:

- mutate/reissue the active contract;
- convert unresolved decisions to delegated;
- waive fixed decisions;
- accept high-level risk simply because implementation is inconvenient.

### 11.3 task close

A VSM/GSD boundary hook can check:

- required result report exists when policy requires it;
- named delegated decisions have outcomes;
- fixed-decision/constraint deviations are surfaced;
- emergent consequential decisions are routed;
- required evidence references exist.

It still does not schedule the next task.

### 11.4 slice close

The parent Slice Delivery Contract becomes the important object.

S3/S3* should ask:

> **Did the slice actually close the feedback loop it promised?**

That includes ordinary GSD verification plus VSM architecture/domain evidence where relevant.

A slice whose tasks all individually "completed" can still fail its contract if the promised integrated outcome is absent.

---

## 12. Relationship to GSD verification

VSM-Pi does not replace GSD verification. It broadens the target of verification.

```text
GSD technical verification
  compilation / tests / lint / runtime checks

+

Work Contract verification
  promised outcome
  fixed decisions
  constraints
  decision allocation
  evidence completeness
  emergent decision reporting

+

S3* architectural/domain verification
  conformance to intended system representation
```

This gives three useful questions:

```text
Does the code work?
Does it conform?
Did the planned feedback loop actually close?
```

---

## 13. Storage

Use the dedicated VSM-Pi SQLite store introduced by the regulatory-state layer, for example:

```text
.gsd/vsm-runtime/vsm.db
```

The contract store is regulatory/control metadata, not GSD workflow truth.

For M0, do not over-normalize.

A reasonable first design is:

```text
work_contracts
  id
  version
  kind (slice|task)
  parent_id/version
  project/repository/milestone/slice/task refs
  canonical_payload_json
  predecessor_id/version
  created_at
  planning provenance

work_results
  id
  contract_id/version
  canonical_payload_json
  source revision
  created_at
```

plus indexes for scope lookup.

The validated canonical payload may remain JSON while the schema is evolving. Normalize individual decision/outcome tables later only if query patterns justify it.

All write operations should be transactional and append/version oriented.

---

## 14. Contract validation rules

The validator should be deterministic wherever possible.

### Slice contract

At minimum:

1. `vertical` requires an observable end-to-end outcome.
2. `integration` requires an observable integrated condition.
3. `horizontal-enabling` requires `horizontalJustification` and integration proof.
4. Every required outcome has an evidence expectation/oracle class.
5. S5 constraint refs cannot be silently weakened by model fields.
6. Required regulatory inputs for the scope are represented or explicitly dispositioned by authorized planning context.

### Task contract

At minimum:

1. parent slice contract/version exists;
2. fixed/delegated/unresolved decision IDs do not collide;
3. fixed decisions carry authority/provenance refs;
4. delegated decisions have meaningful bounds;
5. unresolved decisions have explicit handling/obligation refs where required;
6. a task cannot require an unresolved decision to complete unless that decision is resolved or reclassified by authorized planning;
7. contract fields cannot grant VSM capabilities;
8. active contract versions are immutable to S1.

### Result report

At minimum:

1. exact contract ID/version exists;
2. delegated result references must name delegated decision IDs from that contract;
3. deviations cannot be hidden inside free-form summary only;
4. emergent consequential decisions are converted to typed regulatory events when policy requires;
5. evidence is source-revision-aware where relevant.

---

## 15. Worked example: deployment cancellation

### Slice Delivery Contract

```text
SC-12 v1

shape:
vertical

objective:
A client can cancel a pending deployment through the public API.

observable outcome:
POST /deployments/{id}/cancel on PENDING returns CANCELLED and persists the
new lifecycle state.

end-to-end path:
public API -> command/service -> domain transition -> persistence -> response

constraints:
INV-STATE-001 terminal states do not transition back to active
INV-API-003 existing deployment representation remains backwards compatible
```

### Task T1 Work Contract

```text
TC-31 v1

objective:
Introduce the domain transition required by SC-12.

FIXED
- cancellation is an explicit lifecycle state
- public wire compatibility is preserved

DELEGATED
- internal transition-validation helper structure
- exact private error-class decomposition

UNRESOLVED
- rollback-after-cancel semantics
  handling: stub-boundary
  obligation: O44

expected evidence:
state-transition tests for PENDING -> CANCELLED and invalid terminal transitions
```

### S1 result

```text
Delegated decision:
used validateCancellationTransition() inside deployment domain module

Evidence:
state-transition tests pass

Residual/emergent uncertainty:
retrying deployments are represented as FAILED + retry_count; it is unclear
whether FAILED is semantically terminal, which changes cancellation validity.
Impact if wrong: high
```

The retry question was not in the contract.

VSM-Pi records it as an emergent/regulatory signal rather than accepting the new implicit state semantics.

S3 may route it to S3* or replan.

The parent slice does not close merely because T1 passes; later tasks still have to produce the observable API behavior promised by SC-12.

---

## 16. Planning-quality feedback

The contract gives us a new higher-order feedback loop.

Over time VSM-Pi can compare:

```text
prospective uncertainty
vs
residual uncertainty

allocated decisions
vs
emergent decisions

promised outcomes
vs
closed outcomes
```

Useful future metrics include:

- undelegated consequential decisions per task/slice;
- fixed-decision deviations;
- residual uncertainty density;
- recurring uncertainty hotspots;
- replans caused by missing planning decisions;
- slice feedback-loop closure rate;
- regulatory obligations created from contract omissions.

These are not reasons to score models with fake precision. They are signals about whether S3/S2 is successfully attenuating and allocating variety before S1 execution.

Repeated emergent uncertainty around the same concept is especially interesting:

```text
many task contracts miss the same decision
        ↓
S4/S3 detects planning/model weakness
        ↓
architecture/specification improvement
        ↓
possible S5 proposal
```

That is regulation of the regulator.

---

## 17. Minimal M0 implementation

M0 should prove the control pattern without building a general planning DSL.

Minimum useful implementation:

1. runtime schemas for Slice Delivery Contract, Task Work Contract, and Operational Result Report;
2. SQLite persistence/versioning tied to GSD scope;
3. host-derived S3/S2 capability to define contracts;
4. deterministic contract validation;
5. automatic injection of exact task contract into `execute-task`;
6. S1-safe result/uncertainty reporting;
7. one emergent undelegated decision routed into regulatory state;
8. slice-close access to the parent observable outcome.

Deferred:

- rich UI;
- general contract DSL;
- automatic architecture extraction;
- full planner-quality analytics;
- semantic/RDF contract generation;
- automatic contract synthesis without planner judgment;
- project-wide learned routing/decision templates.

---

## 18. Design invariants

1. **GSD owns workflow state; contracts do not recreate task lifecycle.**
2. **A contract allocates implementation authority, not VSM regulatory authority.**
3. **Every slice closes a feedback loop or explicitly proves how it enables one.**
4. **Fixed decisions cannot be silently overridden.**
5. **Delegated decisions represent intentional S1 autonomy and must have bounds.**
6. **Unresolved decisions cannot become implicit delegation by omission.**
7. **The exact contract version governing execution is immutable and auditable.**
8. **A structured result closes the contract loop but does not self-certify success.**
9. **Emergent consequential decisions become regulatory information rather than invisible architecture.**
10. **Replanning creates a new contract version; history is never rewritten.**

A concise formulation is:

> **The task tells S1 what work exists. The contract tells S1 what freedom it has, what must remain true, and how the rest of the system will know whether the work succeeded.**
