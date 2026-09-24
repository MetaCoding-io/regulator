# Planner-Facing Contract Composition

## Status

Design document. This specifies how VSM-Pi Operational Work Contracts compose with GSD's existing DB-backed planning tools without wrapping, replacing, or scraping GSD's planning system.

It complements:

- `GSD-VSM-FUNCTIONAL-MAP.md` — which VSM functions/capabilities are active;
- `REGULATORY-STATE-AND-ROUTING.md` — which unresolved concerns must persist;
- `OPERATIONAL-WORK-CONTRACT.md` — the Slice Delivery Contract / Task Work Contract semantics;
- this document — how those contracts are authored, correlated, validated, versioned, and bound to GSD execution.

The core rule is:

> **GSD owns the plan. VSM-Pi owns the regulatory contract that constrains how that plan may be executed.**

VSM-Pi must not reconstruct contracts by scraping rendered `PLAN.md` artifacts and must not introduce a second plan/task write path.

---

## 1. Current GSD planning seam

GSD `plan-slice` is already structured and DB-backed. The planner is required to:

1. call `gsd_plan_slice` for slice metadata;
2. call `gsd_plan_task` once per task;
3. rely on those DB-backed tools as the canonical planning write path rather than direct `PLAN.md` writes.

The VSM integration should therefore compose with those structured calls, not replace them.

```text
GSD planner
   |
   +-- gsd_plan_slice  ---------> GSD DB / GSD plan truth
   |
   +-- gsd_plan_task T1 --------> GSD DB
   +-- gsd_plan_task T2 --------> GSD DB
   +-- gsd_plan_task T3 --------> GSD DB
   |
   +-- vsm_commit_work_contracts
              |
              v
        VSM-Pi SQLite
        regulatory contract truth
```

The two stores intentionally answer different questions:

```text
GSD DB:      What work is planned / what unit runs next?
VSM SQLite:  What feedback, constraints and delegated decision authority govern that work?
```

---

## 2. Do not duplicate GSD's task schema

The planner should not have to retype fields that GSD already captured structurally.

VSM-Pi should observe successful structured GSD planning calls during the active planning unit and retain a **planning capture** containing the relevant call inputs/receipts for contract composition.

The planning capture is ephemeral host context, not another source of truth.

Safe host-captured GSD fields include, where exposed by the supported tool path:

### Slice

- milestone ID;
- slice ID;
- goal;
- success criteria;
- proof level;
- integration closure;
- observability impact;
- target repositories.

### Tasks

- milestone/slice/task IDs;
- title and description;
- files;
- inputs;
- expected outputs;
- verification commands;
- required workflow tools;
- observability impact;
- target repositories.

VSM-Pi may persist a canonical snapshot/hash of those structured planning inputs as **provenance** so historical contracts remain auditable after later replans. That snapshot is not GSD workflow truth and must never be used to decide task status/progression.

---

## 3. One atomic planner-facing contract-set tool

For the first implementation, prefer one model-facing planning tool:

```text
vsm_commit_work_contracts
```

The exact public name may change, but the semantic operation should be atomic for one GSD slice planning context.

Why one contract-set call rather than independent slice/task writes:

- parent and child contracts can be validated together;
- every planned task can be required to have exactly one Task Work Contract;
- cross-task coverage of the slice feedback loop can be checked;
- SQLite persistence is atomic;
- a failed VSM validation cannot leave a partially committed contract family;
- fewer model calls reduce contract-authoring overhead.

The planner still calls GSD's normal tools first. VSM-Pi then validates the VSM-specific annotations against the successful GSD planning capture.

```text
gsd_plan_slice
      |
gsd_plan_task x N
      |
      v
VSM planning capture
      +
VSM-specific contract payload
      |
      v
validate entire contract set
      |
      +-- reject -> no VSM contract version committed
      |
      `-- accept -> atomic SQLite commit
```

---

## 4. Planner-facing payload

The model should provide only VSM-specific semantics plus GSD identifiers needed to correlate with the captured plan.

Illustrative shape:

```ts
interface CommitWorkContractsInput {
  milestoneId: string;
  sliceId: string;

  slice: {
    workShape: "vertical" | "horizontal-enabling" | "integration";

    observableOutcomes: Array<{
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
      gsdEvidenceRefs?: string[];
    }>;

    endToEndPath?: string[];
    horizontalJustification?: string;
    integrationProof?: string[];

    interfaceRefs?: string[];
    additionalConstraintRefs?: string[];
  };

  tasks: Array<{
    taskId: string;
    contributionToSliceOutcome: string;

    fixedDecisions: Array<{
      id: string;
      subject: string;
      decision: string;
      authorityRef?: string;
      rationale?: string;
    }>;

    delegatedDecisions: Array<{
      id: string;
      subject: string;
      bounds: string;
      reportChoice?: boolean;
    }>;

    unresolvedDecisions: Array<{
      id: string;
      subject: string;
      reason: string;
      handling:
        | "resolve-before-execution"
        | "defer"
        | "stub-boundary"
        | "research"
        | "policy-clarification";
      obligationId?: string;
    }>;

    expectedEvidence?: Array<{
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
      gsdEvidenceRefs?: string[];
    }>;

    interfaceRefs?: string[];
    additionalConstraintRefs?: string[];
  }>;
}
```

This is illustrative, not a frozen wire format.

### Host-filled fields

The model must **not** supply authoritative values for:

- contract IDs or versions;
- predecessor/successor contract links;
- VSM functions/capabilities/authority;
- planning provenance identity;
- source revision;
- required regulatory consumers/mechanisms;
- effective severity or resolution boundaries;
- mandatory applicable S5 constraints;
- execution binding IDs.

Those are derived from trusted host context, regulatory policy and the GSD functional projection.

---

## 5. What is inferred vs what must be explicit

### Safely inferred from structured GSD planning / host context

- milestone/slice/task scope;
- task existence and ordering;
- task files/inputs/expected outputs;
- GSD verify commands;
- GSD success criteria/proof level/integration closure;
- target repositories;
- current source revision when available;
- currently relevant regulatory obligation IDs;
- mandatory S5 constraints/invariants selected by host policy;
- planner GSD unit/session provenance.

### Must remain explicit VSM planning judgment

- slice work shape;
- the actual closed-loop observable outcome(s);
- end-to-end path or horizontal-enabling justification/proof;
- how each task contributes to the parent feedback loop;
- consequential fixed/delegated/unresolved decision allocation;
- delegation bounds;
- unresolved-decision handling strategy;
- interface/boundary semantics that are important but not mechanically inferable;
- evidence expectations beyond what GSD already captures.

Do not infer these from prose after the fact. They are the regulatory/design content of the contract.

---

## 6. Correlation with GSD IDs

The model may name `milestoneId`, `sliceId`, and `taskId`, but those values are selectors, not authority.

The host must verify that they match successful structured GSD planning calls captured in the same authorized planning context.

Minimum validation:

```text
contract slice ID == captured gsd_plan_slice slice ID
contract milestone ID == captured milestone ID

for each captured successful GSD task:
    exactly one Task Work Contract exists

for each Task Work Contract:
    matching captured GSD task exists
```

A model cannot create an authoritative VSM contract for an invented GSD task ID merely by naming it.

---

## 7. GSD verification is referenced, not retyped

VSM-Pi should not duplicate GSD verification commands into a second editable planning schema.

Instead, an outcome/evidence expectation may reference captured GSD plan evidence, for example conceptually:

```text
gsd:slice:successCriteria
gsd:task:T03:verify[0]
gsd:task:T03:verify[1]
```

The host validates such references against the planning capture and stores enough immutable provenance to reproduce what they meant when the contract version was committed.

VSM-specific verification can add evidence not represented by ordinary GSD checks, such as:

- architecture invariant evidence;
- semantic/domain validation;
- observable runtime behavior;
- independent S3* findings.

The rule is:

> **Reuse GSD evidence where it already exists; add regulatory evidence where GSD's notion of validity is intentionally being broadened.**

---

## 8. Validation classes

Contract validation should distinguish deterministic invalidity from uncertainty that belongs in regulatory state.

### Reject the tool call mechanically

Examples:

- contract references a task not present in the captured GSD plan;
- a captured task has no Task Work Contract;
- `vertical`/`integration` has no observable end-to-end outcome;
- `horizontal-enabling` lacks justification or integration proof;
- the same consequential decision appears in more than one allocation class;
- delegated decision has no meaningful bounds;
- unresolved decision required for completion has no valid handling path;
- unresolved decision references a nonexistent/out-of-scope obligation;
- evidence reference points to a nonexistent captured GSD criterion/verify entry;
- scope IDs mismatch the host planning context;
- model payload attempts to smuggle authority/capability/routing fields.

No contract version is persisted on deterministic validation failure.

### Accept but create/expose regulatory attention

Examples:

- planner cannot establish whether a boundary is architecturally sound;
- a necessary external API assumption remains unverified but can be stubbed safely;
- an unresolved decision has a valid deferral/research path;
- the planner explicitly identifies a high-impact uncertainty whose work can continue without immediately resolving it.

The contract can reference the resulting/open regulatory obligation while policy determines when it becomes blocking.

---

## 9. Missing contract is a regulatory failure, not a second planner state

GSD may successfully persist a slice plan even if the planner fails to commit its VSM contract set. VSM-Pi must not mark the GSD plan itself incomplete in a competing lifecycle.

Instead, a completed planning unit without a valid contract set creates a VSM regulatory obligation such as:

```text
concern: missing-operational-contract
scope: M001/S02
effectiveSeverity: blocking
mustResolveBefore: task-dispatch
requiredConsumer: S3
```

This introduces a useful boundary:

```text
task-dispatch
```

A planned task may exist in GSD while VSM-Pi refuses to authorize S1 execution until an applicable Task Work Contract can be bound.

GSD still owns the decision about what workflow unit occurs next. VSM-Pi only reports that the execution boundary is not regulatory-clear.

---

## 10. Execution binding

A contract version becomes immutable once committed, but an **execution binding** records which exact version governs a particular S1 execution context.

Illustrative host-owned record:

```ts
interface ExecutionContractBinding {
  id: string;
  boundAt: string;

  sliceContractId: string;
  sliceContractVersion: number;
  taskContractId: string;
  taskContractVersion: number;

  milestoneId: string;
  sliceId: string;
  taskId: string;

  gsdUnitType: "execute-task";
  gsdUnitId: string;

  sourceRevision?: string;
  sessionId?: string;
}
```

If a supported GSD API later exposes a durable attempt identifier, VSM-Pi may correlate it. It must not invent/copy attempt lifecycle state merely to have an ID.

At `execute-task` start:

```text
trusted GSD scope
      |
      v
lookup latest valid applicable Task Work Contract
      |
      +-- none -> block task-dispatch boundary
      |
      `-- found -> create immutable execution binding
                     |
                     v
               inject contract into S1 context
```

The binding, not "latest contract" lookup after the fact, determines which contract a result is judged against.

---

## 11. Replanning semantics

### Before execution

If GSD replans before any S1 binding exists:

```text
SC v1 / TC v1
      |
GSD replan
      v
SC v2 / TC v2
```

The new version supersedes the old version for future binding. Historical v1 remains immutable.

### After partial execution

If some tasks have already executed against v1:

```text
T1 -> TC-T1 v1 -> Result R1
T2 not yet executed

replan

T1 historical binding/result remain on v1
T2 future execution binds TC-T2 v2
```

Do not rewrite historical expectations merely because the plan changed later.

### Task-only replan

A local `replan-task` may create a successor Task Work Contract while the parent Slice Delivery Contract remains unchanged when the slice feedback loop itself did not change.

A slice-level replan creates a new parent contract version when the observable outcome, work shape, interfaces, or slice-wide constraints change.

Every successor version records predecessor + reason/provenance.

---

## 12. Result reporting and GSD completion

S1 should not mutate its contract. It should report against the active execution binding.

Preferred model-facing operation:

```text
vsm_report_operational_result
```

The result contains only S1 observations/evidence:

- evidence refs;
- choices made for named delegated decisions;
- residual uncertainty signal refs;
- emergent consequential decisions;
- declared deviations.

The host fills the active binding/contract identity.

A strong enforcement seam is to guard the GSD `gsd_task_complete` call:

```text
S1 calls gsd_task_complete
      |
      v
VSM preflight:
  active contract binding exists?
  required result report exists?
  blocking task-dispatch/task-close obligations clear?
      |
      +-- no -> block completion call with structured reason
      |
      `-- yes -> allow GSD completion tool to proceed
```

VSM-Pi does not complete the task itself. It validates whether the GSD completion operation has the regulatory evidence required to proceed.

---

## 13. Planner tool visibility in GSD auto mode

This must be tested as a host-integration concern, not assumed from ordinary Pi extension behavior.

GSD auto mode deliberately narrows the active tool surface by unit. VSM-Pi tools therefore need an explicit GSD-adapter mechanism that exposes only the tools allowed by the host-derived VSM capability set.

The current GSD ecosystem extension wrapper exposes:

- current phase/active unit;
- `getAllTools()` / `getActiveTools()` / `setActiveTools()`;
- normal extension event registration.

The adapter should use the supported GSD lifecycle/context seam to make the appropriate VSM tools active for projected units, for example:

```text
plan-slice / refine / replan
  -> expose vsm_commit_work_contracts

execute-task
  -> expose vsm_report_uncertainty
  -> expose vsm_report_operational_result
  -> expose proposal tool if allowed

S3* contexts
  -> expose audit-finding tool
```

Do not use the model to request its own VSM tool surface.

Also do not rely on `adjust_tool_set` to add missing tools: that event is a final narrowing/reordering seam, not the authority source for expanding a unit's capabilities.

A representative #5 integration test should prove that a VSM ecosystem tool registered under `.gsd/extensions` remains visible in the intended GSD auto-mode unit after GSD's own tool scoping, and absent in an unauthorized unit.

---

## 14. Hook map

### Planning unit start / `before_agent_start`

- derive S3/S2 functional projection and contract-authoring capability;
- inject relevant S5 + regulatory context;
- expose planner contract tool only when authorized;
- initialize ephemeral planning capture.

### GSD planning tool calls/results

- observe successful `gsd_plan_slice` / `gsd_plan_task` / supported replan calls;
- capture structured inputs/receipts for correlation/provenance;
- do not modify GSD's plan payload merely to fit VSM-Pi.

### Contract commit

- validate VSM payload against captured GSD plan + host policy;
- persist parent/task contract versions atomically in VSM SQLite;
- resolve/supersede missing-contract obligation if applicable.

### Planning unit end

- if GSD unit completed without a valid applicable contract set, record a blocking missing-contract obligation;
- do not attempt to reschedule or reopen the GSD planning unit directly.

### Execute-task start

- evaluate `task-dispatch` boundary;
- create immutable execution binding;
- inject exact bound contract + parent slice observable outcome.

### Execute-task completion

- require structured Operational Result Report;
- allow GSD's own `gsd_task_complete` only when the task-close regulatory preconditions are satisfied;
- route emergent/deviating decisions into regulatory state.

---

## 15. Capabilities

The functional projection should eventually distinguish contract-specific capabilities such as:

```text
author-slice-contract
author-task-contract
commit-contract-set
bind-execution-contract        # host-only
report-operational-result      # S1
```

Suggested policy:

- `plan-slice` / `refine-slice` / `replan-slice` (S3+S2) may author/commit the full slice contract set;
- `replan-task` (S3) may revise a Task Work Contract within an unchanged parent contract, subject to policy;
- S1 may report against a binding but cannot author/revise the contract;
- binding is always host-owned;
- no operational contract capability implies S5 mutation, S3* certification, or regulatory risk acceptance.

---

## 16. Design decisions from the open questions

1. **Atomic parent + task commit:** yes for M0. Prefer one contract-set operation after GSD plan calls.
2. **GSD ID correlation:** validate against successful structured GSD planning calls captured in the authorized planning unit; IDs are references only.
3. **Inference vs explicit:** infer GSD mechanics/scope/evidence; require explicit VSM feedback-loop and decision-allocation semantics.
4. **Binding:** commit immutable versions during planning; create a host-owned execution binding at `execute-task` start.
5. **Replanning:** successor contract versions; historical execution/result bindings remain attached to prior versions.
6. **Validation:** deterministic schema/correlation/authority errors reject the contract commit; legitimate unresolved uncertainty becomes regulatory state with boundaries.
7. **Verification reuse:** reference captured GSD success criteria/verify entries rather than retyping them; add VSM-specific evidence where validity is intentionally broader.

---

## 17. Architectural invariant

> **A GSD task may be planned without VSM-Pi copying its task state, but S1 may not execute it under VSM-Pi without an immutable, host-bound operational contract.**

That is the seam by which VSM-Pi broadens GSD's definition of a valid operation without becoming the workflow engine.
