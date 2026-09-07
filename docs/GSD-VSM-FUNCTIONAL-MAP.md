# GSD → VSM Functional Projection

## Status

Design document. This mapping is intentionally **descriptive and provisional** until the GSD-aware adapter in issue #5 is implemented against GSD's supported extension/context API.

The central rule is:

> **VSM-Pi projects cybernetic functions onto the existing GSD lifecycle and mechanisms. It does not instantiate separate S1-S5 agent subsystems.**

GSD remains the concrete operational system. VSM functional membership is a host-derived interpretation of what a GSD unit or mechanism is doing at a given point in the workflow.

Functional membership:

- is derived from trusted GSD runtime context, never claimed by the model;
- may be many-to-many;
- determines regulatory context, capabilities, and hooks;
- does not by itself erase separation-of-duty requirements;
- does not make a GSD unit literally identical to a VSM system function.

A concise formulation is:

> **Pi executes. GSD orchestrates. VSM-Pi regulates. S5 defines identity.**

And the state boundary remains:

> **GSD owns execution state. VSM-Pi owns regulatory obligations.**

---

## 1. Projection model

```text
                       GSD runtime
                           │
              ┌────────────┴────────────┐
              │                         │
             units                  mechanisms
              │                         │
      plan / execute /            worktrees / leases /
      reassess / validate         tool contracts / gates
              │                         │
              └────────────┬────────────┘
                           │
                           ▼
                 VSM functional projection
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
       capabilities   regulatory     hook profiles
                       context
```

The projection is not a role-playing prompt. It is host-owned policy.

Conceptually:

```ts
export type VsmFunction = "S1" | "S2" | "S3" | "S3*" | "S4" | "S5";

export interface FunctionalProjection {
  functions: readonly VsmFunction[];
  hookProfiles: readonly string[];
  authorityProfile: string;
  independenceDomain?: string;
}
```

The implementation should not necessarily use this exact type. The important point is that **authority comes from runtime context plus policy**, not from fields supplied by an LLM.

---

## 2. Initial GSD unit → VSM mapping

Current GSD has a declared unit registry with phase routing and scoped tool contracts. VSM-Pi should use supported GSD context APIs to identify the active unit, then apply a versioned projection maintained in the GSD adapter.

| GSD unit | Primary VSM participation | Regulatory interpretation | Important hooks |
| --- | --- | --- | --- |
| `research-milestone` | S4 | Environment/future-facing investigation that should inform planning but not set policy | inject unresolved S4 research obligations; capture intelligence |
| `research-slice` | S4 | Scoped investigation for an upcoming operational slice | inject scoped research questions; capture intelligence/evidence |
| `plan-milestone` | S3 | Operational control: translate purpose/requirements into a milestone plan | inject S5 constraints + open regulatory inputs; validate plan-level obligations |
| `plan-slice` | S3 + S2 | Operational design plus coordination/interface decomposition | inject open scoped obligations; require/validate Operational Work Contracts |
| `refine-slice` | S3 + S2 | Tighten decomposition/contracts before execution | same as `plan-slice`; emphasize unresolved decisions and interfaces |
| `replan-slice` | S3 + S2 | Correct an operational design after new evidence | inject triggering findings/uncertainties; validate revised contracts |
| `replan-task` | S3 | Correct local delegated work in response to evidence | inject triggering evidence and unresolved obligations |
| `execute-task` | S1 | Delegated operation: implementation inside a bounded work contract | inject work contract + S5 constraints; enable uncertainty/proposal signals; capture residual uncertainty |
| `execute-task-simple` | S1 | Simplified delegated operation | same S1 authority profile; potentially narrower context |
| `reactive-execute` | S1 | Reactive operational work | same S1 signal authority; ensure scope/provenance are explicit |
| `complete-slice` | S3, with an S3* boundary | S3 integrates task results and decides disposition; verification evidence is consulted at closeout | expose open slice obligations and audit findings; require disposition before closeout where policy says so |
| `reassess-roadmap` | S3 + S4 | Operational control incorporates intelligence/new evidence into future plans | expose accumulated uncertainty, intelligence and audit findings; allow routing/replanning |
| `run-uat` | S3* | Independent acceptance evidence against intended behavior | inject observable outcomes/acceptance criteria; capture typed evidence |
| `gate-evaluate` | S3* | Evaluate a defined gate independently of S1 implementation claims | inject relevant constraints/evidence; emit gate finding/verdict |
| `validate-milestone` | S3 + S3* boundary | S3 decides whether milestone can advance using independent validation evidence | enforce resolution boundaries; expose all blocking obligations; preserve audit independence |
| `complete-milestone` | S3 | Final operational closeout after validation | require boundary-clear regulatory state; persist completion-related dispositions if needed |
| `discuss-milestone` / `discuss-slice` | S3-facing, S5-adjacent input | Human discussion may change requirements/identity assumptions, but the unit does not itself become S5 authority | expose relevant S5 context; convert identity changes into explicit proposals/owner decisions |

### Notes on multi-membership

Many-to-many membership is expected. For example:

- `plan-slice` participates in **S3** because it allocates/decomposes operational work and in **S2** because it establishes coordination boundaries and interfaces.
- `reassess-roadmap` participates in **S3** because it changes operational control and in **S4** because it interprets changing conditions and newly learned information.
- `validate-milestone` touches **S3** and **S3***, but that does **not** mean the same model/session may both produce and independently certify the same evidence.

Membership is therefore not a simple permission union.

---

## 3. GSD mechanism → VSM mapping

Some of the strongest VSM functions are mechanisms rather than agent units. This is especially important for S2 and S3*.

| GSD mechanism | VSM function | Why |
| --- | --- | --- |
| worktree/branch isolation | S2 | prevents operational interference between concurrent work |
| leases/claims/dispatch ownership | S2 | coordinates who may act on which work |
| scoped unit tool contracts | S2 | constrains interaction surfaces and prevents oscillatory/uncoordinated behavior |
| sequencing/dependency rules | S2 | coordinates operational dependencies |
| dispatch guards / default-deny delegation | S2 | prevents invalid coordination paths |
| auto-loop authoritative state and dispatch | S3 | determines operational progression and recovery |
| retry/recovery/replan machinery | S3 | corrects operations using feedback while retaining workflow authority |
| post-unit verification / verification gates | S3* | independent host-side evidence outside S1 self-certification |
| source-revision-bound verification evidence | S3* | prevents stale evidence from certifying a changed implementation |
| UAT evidence/gates | S3* | independent acceptance evidence about delivered behavior |
| milestone/slice research | S4 | gathers environmental/technical intelligence for future control |
| roadmap reassessment | S3 + S4 | turns intelligence/evidence into changed operational direction |
| committed `vsm/` identity + human owner decisions | S5 | durable purpose, architecture, policy and invariants |

This is why VSM-Pi should **not** create an `S2Agent` merely to have something named S2. Much of GSD's existing coordination machinery already performs the function more faithfully than a conversational persona would.

---

## 4. Capabilities

Capabilities are host-owned permissions to perform regulatory actions. They are **not tool arguments** and cannot be self-asserted by the model.

Initial vocabulary:

```ts
export type VsmCapability =
  | "read-regulatory-context"
  | "emit-operational-signal"
  | "report-uncertainty"
  | "report-audit-finding"
  | "report-intelligence"
  | "propose-policy-change"
  | "request-audit"
  | "request-research"
  | "acknowledge-obligation"
  | "resolve-operational-obligation"
  | "accept-risk"
  | "emit-algedonic-signal"
  | "mutate-s5";
```

The exact implementation vocabulary may change. The security property should not.

### Baseline function → capability policy

| Function | Capabilities normally available | Explicitly not implied |
| --- | --- | --- |
| S1 | read scoped regulatory context; emit operational signal; report uncertainty; propose S5 change; emit algedonic signal | audit its own work; resolve its own high-impact obligations; accept architectural risk; mutate S5 |
| S2 | host/mechanism coordination actions; read relevant interface/ordering obligations | conversational authority; S5 mutation; independent audit merely because coordination occurred |
| S3 | read regulatory context; acknowledge/disposition operational obligations; request audit; request research; replan through GSD; propose S5 change | independent S3* certification of its own control decisions; unrestricted S5 mutation |
| S3* | read constraints/evidence; emit audit findings; produce independent verification evidence | change implementation; resolve the obligation it is auditing as S3; mutate S5 |
| S4 | read relevant open questions; report intelligence; propose S5 change | operational scheduling; automatic policy mutation; independent audit unless separately qualified |
| S5 | approve/reject identity/policy changes; accept high-level risk; mutate protected S5 through explicit authority workflow | ordinary implementation authority by default |

### Risk acceptance

`accept-risk` should be impact-sensitive rather than a blanket S3 power. A likely policy is:

- low operational risk: S3 may accept with rationale;
- medium architectural/domain risk: S3 may accept only when policy allows and evidence is present;
- high/critical identity, security or architectural risk: require S5/human authority or explicit configured policy.

---

## 5. Capability derivation

Capabilities must be derived from more than functional membership:

```text
active GSD unit/mechanism
        +
functional membership
        +
current phase
        +
regulatory scope
        +
separation-of-duty policy
        +
configured project policy
        ↓
     capabilities
```

Conceptually:

```ts
const projection = projectGsdContext(activeGsdContext);
const capabilities = deriveCapabilities({
  projection,
  scope,
  independence,
  policy,
});
```

This prevents unsafe logic such as:

```text
functions = [S3, S3*]
therefore union(all S3 powers, all S3* powers)
```

The same GSD unit may participate in multiple VSM functions while particular actions still require an independent context.

---

## 6. Separation of duty and independence domains

S3* is only useful if it is structurally independent from S1 self-certification.

The following may count as independent S3* evidence, depending on policy:

- deterministic host-side checks executed outside the S1 model's control;
- a separately dispatched reviewer session with its own context;
- a separately owned GSD validation/UAT unit;
- a semantic/architecture checker whose facts and verdict are generated independently of the implementing agent.

The following does **not** automatically count:

```text
S1 implementation session:
  "Now switching hats to S3*. I approve my own work."
```

A useful future concept is an `independenceDomain`, e.g.:

```text
execution attempt A17
review session R03
host verification V44
```

An audit finding may only satisfy an obligation when its independence domain is valid relative to the work being certified.

Likewise, S5 authority cannot be obtained by a normal GSD unit merely receiving an `S5` tag. In the default architecture **ordinary GSD units should not receive S5 membership at all**. They consume S5 constraints, propose changes to S5, or escalate to S5. Actual S5 mutation requires an explicit owner/authority flow.

---

## 7. Hook profiles

Functional membership determines which VSM hook profiles participate at GSD boundaries.

### Unit-start hooks

| Hook profile | Triggered for | Behavior |
| --- | --- | --- |
| `s1-operation-start` | S1 execution units | inject Operational Work Contract, applicable S5 constraints, scoped open obligations; expose S1-safe model tools |
| `s3-control-start` | S3 planning/reassessment/closeout | inject unresolved regulatory inputs requiring S3 disposition; expose control-safe tools |
| `s2-coordination-start` | planning/coordination contexts | inject interface/dependency/ordering obligations and applicable coordination constraints |
| `s3star-audit-start` | independent verification/validation contexts | inject intended constraints, observable outcomes, source revision, relevant evidence; expose audit-only tools |
| `s4-intelligence-start` | research/intelligence contexts | inject open research questions, stale assumptions and scoped uncertainties; expose intelligence tool |

S5 is normally injected as **read-only constraint context**, not as a transient unit hook granting S5 authority.

### Unit-end hooks

| Hook profile | Behavior |
| --- | --- |
| `s1-operation-end` | capture residual uncertainty and operational signals; create/reroute obligations as policy requires |
| `s3-control-end` | require explicit dispositions for obligations this unit was required to consume; persist routing/replanning outcomes |
| `s2-coordination-end` | record deterministic coordination outcomes/conflicts where applicable |
| `s3star-audit-end` | persist independent findings/evidence with source revision and independence provenance |
| `s4-intelligence-end` | persist intelligence, staleness/validity metadata and any recommended S5 proposal |

### Boundary hooks

Some checks are better attached to GSD transition boundaries than to model turns:

```text
before task close
before slice close
before roadmap reassessment completion
before milestone validation
before milestone completion
```

Examples:

- a high-impact obligation with `mustResolveBefore = milestone-validation` may remain open while useful work continues, but the milestone-validation boundary fails closed until it has a valid disposition;
- a blocking architecture finding may cause the existing GSD closeout/recovery machinery to return `needs-rework` or `needs-remediation` rather than VSM-Pi scheduling a new unit itself.

---

## 8. Regulatory state interaction

Functional projection is how durable VSM regulatory state becomes impossible to "forget" merely because a later agent did not read a log file.

```text
S1 emits uncertainty
      ↓
VSM event persisted
      ↓
routing policy creates obligation
      ↓
GSD chooses next unit normally
      ↓
functional projection of that unit
      ↓
relevant obligation automatically injected
      ↓
authorized consumer acknowledges/dispositions it
      ↓
VSM state projection updates
```

GSD still decides **what happens next**.

VSM-Pi determines **what regulatory information and authority are present when it happens**, and whether a defined boundary is allowed to pass.

---

## 9. Operational Work Contract relationship

Planning units participating in S3/S2 should eventually produce or validate an Operational Work Contract for S1 work.

The contract should distinguish at least:

```text
FIXED decisions
  already constrained by S5/S3; S1 may not silently change them

DELEGATED decisions
  intentionally left to S1 within defined limits

UNRESOLVED decisions
  known uncertainty that should be routed/handled rather than silently guessed
```

This is a direct mechanism for variety allocation.

An S1 residual uncertainty becomes especially significant when it concerns a decision that was neither delegated nor declared unresolved: that is evidence the plan/work contract failed to expose a consequential choice before execution.

---

## 10. Declarative representation sketch

The GSD adapter should eventually keep the mapping declarative and versioned rather than scattering membership tests across hooks.

Illustrative only:

```yaml
units:
  execute-task:
    functions: [S1]
    authority_profile: s1-operation
    hook_profiles: [s1-operation]

  plan-slice:
    functions: [S3, S2]
    authority_profile: operational-planning
    hook_profiles: [s3-control, s2-coordination]

  reassess-roadmap:
    functions: [S3, S4]
    authority_profile: roadmap-reassessment
    hook_profiles: [s3-control, s4-intelligence]

  validate-milestone:
    functions: [S3, "S3*"]
    authority_profile: milestone-validation
    hook_profiles: [s3-control, s3star-audit]
    separation_of_duty:
      audit_requires_independent_evidence: true

mechanisms:
  worktree-isolation:
    functions: [S2]

  host-verification:
    functions: ["S3*"]
    independence: host
```

The mapping may ultimately live as TypeScript data rather than YAML so it can be checked exhaustively against GSD's supported unit vocabulary. The important design requirement is **one declaration point with tests for completeness and drift**.

---

## 11. Fail-closed rules

The adapter should default conservatively:

1. Unknown GSD unit → no privileged VSM capabilities. Read-only context may be permitted.
2. Ambiguous projection → do not infer S3*, S4 or S5 authority.
3. Missing independence provenance → audit result cannot satisfy an independent-audit obligation.
4. Model-supplied `source`, `authority`, `functions`, `capabilities`, or `requiredConsumers` never overrides host-derived values.
5. Normal GSD unit membership never grants `mutate-s5`.
6. Failure to load regulatory state at a blocking boundary should fail closed or pause according to explicit configured policy rather than silently advance.

---

## 12. Implementation consequences for issue #5

The first GSD-aware adapter does not need to implement the entire policy above. It should establish the seam correctly:

1. obtain active GSD unit/phase/scope through supported APIs;
2. derive a host-owned functional projection from a single mapping declaration;
3. expose projection in diagnostic/status output;
4. derive a minimal capability set mechanically;
5. make context/tool behavior conditional on derived capabilities, never model-claimed roles;
6. preserve provenance for every VSM event;
7. test unknown/no-state behavior fail-closed;
8. keep GSD workflow state authoritative and avoid direct DB access.

Later milestones can add obligation routing, Operational Work Contracts, S4 intelligence, architectural checks and boundary enforcement without changing this authority model.

---

## 13. Design invariant

> **VSM-Pi may remember, constrain, observe, route, and veto. GSD schedules and advances work.**

The GSD → VSM projection is the bridge between those two responsibilities.