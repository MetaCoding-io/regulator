# Paper 1 / #103 — Formal scaffold for a recursively governed agent harness

- **Status:** research draft v0.1, for adversarial review; **not a proof, implementation, or accepted architectural decision**.
- **Research track:** [Regulating the Regulator](2026-10-18-paper-regulating-the-regulator.md); [issue #103](https://github.com/MetaCoding-io/regulator/issues/103).
- **Internal grounding:** [ARCHITECTURE.md](../ARCHITECTURE.md), [Reflector note §§7–8](2026-10-18-harness2-recursive-harnessing.md), [accept-path split](2026-10-18-accept-path-split.md), [evidence model](../concepts/evidence-about-the-regulators.md). These documents distinguish what ships from proposals.
- **External theoretical anchors:** [Ashby (1956), ch. 11](https://ashby.info/Ashby-Introduction-to-Cybernetics.pdf), [Conant & Ashby (1970)](https://doi.org/10.1080/00207727008920220), [Beer (1984)](https://doi.org/10.1057/jors.1984.2), [Kephart & Chess (2003)](https://doi.org/10.1109/MC.2003.1160055), [Lahiri (2026)](https://doi.org/10.3389/frai.2026.1881783), [Harness² (2026)](https://arxiv.org/abs/2610.14224).
- **Parallel novelty review:** [issue #104](https://github.com/MetaCoding-io/regulator/issues/104); independently drafted [prior-art matrix](2026-10-18-paper-104-prior-art-novelty.md) may change this model.

## 1. Research question and epistemic status

**RQ:** Under which explicit assumptions can a system use its own operation as evidence for proposed revisions of its harness while preserving independent evaluation and preventing a proposal from authorizing itself?

This draft defines a **bounded two-level model**, not arbitrary-depth VSM recursion. It separates five kinds of claims:

1. **Axioms/assumptions:** trusted host, authentic authorization, complete enough relevant instrumentation, and constrained execution environment.
2. **Design obligations:** authority separation, resolvable references, checks at an identified revision, and decision logging.
3. **Potentially mechanized properties:** transition invariants that can be tested on the implementation or model-checked in a small abstract transition system.
4. **Empirical hypotheses:** whether the model helps discover better changes at acceptable cost, which are **not** implied by 1–3.
5. **Normative judgments:** whose purposes are preserved, who can veto them, and whether the human governance design is legitimate.

The paper must not present any of (3)–(5) as established just because they appear in an architecture diagram.

## 2. The two levels and the system-in-focus

**Level n: operational instance.** One instance `I_i` governs work in domain repository `W_i` using definition revision `D^v`. Its VSM interpretation has S1 operational units, S2 coordination, S3 contract/dispatch/verification/recovery, S3* independent host-run checks and audit, S4 bounded domain intelligence, and S5 instance identity plus authorized dispositions.

**Level n+1: governance of the definition.** Its *units of concern* are one or more regulated instances (a single instance suffices for the prototype). Higher-level S3 observes execution and regulator effectiveness, S3* evaluates regulatory claims and counterfactuals, S4/Reflector models recurrent conditions and makes predictions/proposals about the definition, and S5 consists of maintainers and authorized definition-acceptance procedures.

Calling this a second level is a **recursion hypothesis**, not evidence that all five VSM functions have already been independently instantiated there. The higher-level organizational identity, autonomy and relations among multiple instances remain partly specified by people. A one-instance demo shows a change-control pathway; it cannot demonstrate general viability of an organizational system.

### Candidate domain sets

| Symbol | Meaning | Authority / confidence |
| --- | --- | --- |
| `D^v` | Versioned harness definition: identity, grants, policies, workload, checks, advice, registry | Owned by authorized maintainers, validated by host mechanisms |
| `I_i(D^v)` | Instance initialized against definition revision v, with possible instance-scoped advice or identity copies | May diverge from seed; carries manifest/provenance |
| `U` | Operational units/contracts/tasks | S3 schedules; operational units cannot alter control-plane authority |
| `X_i(t)` | Instance execution/regulatory state at time t | Composite of orchestrator state and append-only regulatory records |
| `H_i[t_0,t_1]` | Observation history: attempts, changes, audit events, spans, costs and outcomes | Mixed trust: traces/agent assertions are NOT equivalent to host-run evidence |
| `E_i` | Verified evidence records tied to criterion, revision, method and environment | Host-produced evidence under stated trust boundary |
| `P` | Proposal: target class, diagnosis references, requested delta, prediction reference | Advisory until accepted, never a writer |
| `Q` | Prospectively stated prediction (metric, direction, baseline, probe/live horizons, disconfirmation) | Not yet evidence of an improvement |
| `C` | Contrast of a candidate against a baseline from an evaluation probe | Evidence limited to specified fixture, scorer and run distribution |
| `A` | Authorized actor set and authority-check procedure | Declared in policy; identity binding currently a deployment assumption |
| `J` | Decision: accept / reject / defer, actor, justification, evidence refs, authority scope | Authoritative **only** if policy and writer checks pass |
| `L` | Live resolution after adoption: observed outcomes against Q | Can confirm, disconfirm or be inconclusive; not a retroactive amendment of C |

Avoid conflating an event *claim* with a criterion-bound host-produced evidence record. The existing Regulator event vocabulary already keeps several of these separate; a prediction record and advice change path are proposed, not shipped.

## 3. Abstract transitions and authority graph

This is **candidate protocol semantics**, not a description of an executable formal specification.

1. **Execute:** `Run(I_i, D^v, contract, environment) -> (X', H, E)`. The host reports the revision and mechanism provenance. A unit's own result statement is a claim, never an acceptance verdict.
2. **Observe/diagnose:** `Reflect(H, E, D^v, objective) -> KEEP_BASE | P`. This is an S4 inference. It has no writer capability to `D^v` or any acceptance ledger. A diagnosis reference must resolve, but resolution establishes existence, **not truth or causal validity**.
3. **Specify prospectively:** `Predict(P, baseline, metric, horizon_probe, horizon_live, disconfirming_condition) -> Q`. Candidate effectiveness is asserted as a falsifiable forecast, not as a measurement.
4. **Probe:** `Probe(D^v, P.delta, fixture, grader, declared_runs) -> C`. Must isolate the candidate from the baseline and from hidden oracle data, hold declared comparability conditions, record inconclusive outcomes rather than manufacture significance.
5. **Authorize:** `Decide(a, P, C, policy) -> J`, where `a` must be authenticated (external assumption in current product), declared for the *specific* acceptance path, and distinct **in authority** from Reflector. Reject or defer must preserve the definition.
6. **Apply through typed path:** `Apply(D^v, P.delta, J) -> D^(v+1)` is possible **only** if class of target and authorized writer match: instance-scoped advice acceptance and later seed promotion; identity accept/promote; or reviewed definition-repository commit for executable/granting changes. Applying advice and promoting to seed are different state transitions.
7. **Re-observe:** `Resolve(Q, H_future, grader) -> L` after the stated live horizon. A disconfirmed result routes an obligation to reconsider; a result may be inconclusive. *Neither* an accepted decision nor a successful probe is itself evidence that the live prediction came true.

At every step, maintain the distinction between **who may make a proposal, who may evaluate it, and who may commit a policy change**. Physical process separation is not guaranteed: multiple logical functions could run on the same machine or depend on common model outputs. This should be stated as a possible common-mode failure.

### Writer / reader / veto matrix

| Component (level) | Reads | May write | Cannot do | Enforcement / status |
| --- | --- | --- | --- | --- |
| S1 operational unit (n) | Contract, permitted context/tools | Domain outputs, result claims, allowed operational signals | Authoritatively rewrite harness identity, grants or checks | Shipped path/profile gates, with documented shell/host limits |
| S3 orchestrator (n) | Contracts, leases, reports, host checks, obligations | Execution state, recovery routing and reintegration | Take S5 dispositions | Shipped generic loop |
| S3* host auditor (n) | Revision-bound domain artifacts and check results | Audit evidence, independent technical verdict | Authorize a policy edit | Shipped host-owned checks; host trust assumed |
| Domain S4 (n) | Assigned domain environment | Intelligence signal, possible obligation | Schedule or independently adopt proposals | Shipped demand-triggered research/intelligence path |
| Reflector S4 (n+1) | Declared subset of logs, evidence, metrics, definition | KEEP_BASE, advice/proposal/prediction **records** | Dispatch operational work; write acceptance, identity, grants or checks | Proposed `packages/reflector` / read-only unit |
| Meta-level evaluator S3* (n+1) | Baseline and candidate from same declared suite | Probe contrast, calibration evidence | Rewrite candidate or decide acceptance | Existing eval architecture, proposed advice override |
| S5 authorized maintainer (n+1) | Proposal, prediction, evaluation, interests/constraints | Recorded disposition; authorized commit path | Make observations true by fiat | Identity path shipped; advice path proposed; `--by` not authentication |
| Deployment / OS | Full program and credentials as configured | Process/filesystem/network permissions | Be assumed trustworthy without a specified configuration | Out of Regulator's application-level security boundary |

**Important nuance:** *independent evaluator* here means mechanically independent from the agent's self-report; it does not imply statistical independence from the proposer, independence from shared code bugs, or independent organizational ownership.

## 4. Candidate properties and counterexamples

These are candidates for formal specification and mechanism tests; none is a proven universal guarantee.

| Property | Suggested statement | Classification | Counterexample / test |
| --- | --- | --- | --- |
| **G1: proposal noninterference** | Emitting `P` alone cannot change the protected definition or commit a new authoritative revision | Mechanically testable under trusted-host assumptions | Reflector invokes write/bash/tool path and changes protected bytes |
| **G2: typed-path integrity** | A proposal changing advice is accepted only through advice acceptance; executable/grant/identity changes cannot be smuggled through that path | Mechanically testable once advice split ships | Modified grant nested in advice/profile payload passes acceptance |
| **G3: evidence provenance** | Every evidence ref required for `P` resolves to an existing recorded observation/revision | Mechanically testable but **not** evidence truth | Invalid ref passes; or valid but misleading ref is treated as causal proof |
| **G4: audit separation** | An S1 self-report never by itself satisfies a host-check criterion | Partly shipped and mechanically testable | Agent reports success after breaking invariant and passes closeout |
| **G5: revision-specific contrast** | Candidate probe is attributed to the evaluated change and baseline, with explicit environment and metric | Protocol + test; causality depends on design | Candidate edited unrelated files; changed model/fixture inadvertently |
| **G6: honest uncertainty** | An inconclusive probe does not count as confirmed improvement | Proposed schema + test | UI/CLI labels overlap of confidence intervals as success |
| **G7: decision authority** | Only an actor in `A` can adopt through each path | Policy check mechanized; **actor authenticity assumed** | Arbitrary `--by` string impersonates authorized maintainer |
| **G8: post-adoption reflexivity** | Every accepted claim with a live horizon is eligible for independent resolution and negative reconsideration | Proposed operational behavior, not proven | Drift occurs but cannot reach the evaluator or S5 |
| **G9: governance effectiveness** | Better safety/recovery per unit of combined token, time and human attention | Empirical hypothesis, not a mechanistic invariant | Baseline has same outcomes at lower cost; gates refuse correct work |

A finite transition-model or property-based test could establish G1/G2/G6 for a bounded state machine **relative to assumptions**, while real deployment security still depends on authentication, tool bypass, and containment.

## 5. VSM, recursive organization, and second-order observation

**VSM recursion:** an operational unit may itself be understood as a viable system; at the next level the system-in-focus has its own operational components, coordination, management, intelligence and identity. The relevant question is **what is the system-in-focus and whose purpose does it serve**. A level-n instance being considered operational at level n+1 is an architectural interpretation, not a theorem that all functions at level n+1 have been implemented.

**Second-order cybernetics:** an observer participates in or is implicated in the system of observation. Adding a model that reads logs does not *by itself* resolve the epistemic problem of who chooses measurements, who defines success, or how observations change behavior. Reflector's diagnosis and subsequent influence on the definition make observer effects material, but its own selection bias and self-fulfilling predictions must be studied. Original work by von Foerster and secondary critiques require fuller direct reading before manuscript claims are finalized.

**Ashby's variety:** constraint and regulatory response capacity are relevant to the disturbances a harness can absorb. It does **not** follow automatically that more gates or more tokens increase viability. The identity of the desirable outcomes and measured variety must be specified rather than inferred from the existence of a VSM mapping.

**Good-regulator theorem:** Conant and Ashby's theorem has assumptions about optimal, simple regulators and models. The paper should not derive “Reflector must exist” or “VSM is the only viable design” from that theorem.

**Critical governance:** Ulrich and Jackson raise the question of whose values and power are institutionalized. S5 authority can preserve a harmful status quo just as effectively as a desirable one. A paper about viability must acknowledge affected stakeholders, the legitimacy of human choice, appeal/contestation, and human attention cost rather than treating designated maintainers as automatically representative.

## 6. Diagram specifications for the eventual manuscript

1. **Figure A — two systems-in-focus:** lower-level unit/workload/regulators; higher-level instances as operational concern; explicitly mark human and deployment boundaries, and label proposed unimplemented mechanisms.
2. **Figure B — typed governance sequence:** Run -> observation -> Reflector diagnosis -> proposal/prediction -> probe -> authorized disposition -> apply -> live resolution, with writer authority and versioned artifacts.
3. **Figure C — protected write-path lattice:** identity via identity acceptance; advice via advice acceptance; executable/granting definition via reviewed code merge. Show that all three may be *proposed*, but have different acceptance paths.
4. **Figure D — two evaluation horizons:** pre-adoption probe against baseline and after-adoption live follow-up, including disconfirmed/inconclusive branches and reconsideration.

The existing hand-drawn figures in the Reflector note are **design illustrations**, not automatically generated evidence from a working two-level implementation.

## 7. Reviewer attack list / unresolved questions

1. Is the higher recursion level genuinely a viable system or only a useful governance *view* over a conventional release process? What observations distinguish the hypotheses?
2. What authority boundary is novel relative to MAPE-K, NIST separation of duties, or CI branch protection and policy-as-code?
3. If the very same LLM selects observations, suggests metrics and predicts effects, what does host-produced evidence actually validate beyond provenance?
4. Who defines “viable,” who benefits, and can a stakeholder contest the S5 decision? What prevents autocratic misuse?
5. If deployment cannot authenticate `--by` and agents can run unconfined shell commands, how narrow must the integrity claim be?
6. Does a read-only, human-authorized Reflector truly create an adaptive feedback loop, or merely document an advisory one?
7. Are live outcomes measured on a different population than the probe fixture? What happens under distribution shift, reused baselines and repeated selection?
8. Is closing a loop valuable enough to justify token expenditure, tool delays and human interrupts?

## 8. Initial cross-review with #104

The prior-art stream has already surfaced three threats that **narrow the novelty claim**:

- [AHE (2026)](https://arxiv.org/abs/2604.25850) pairs edits with self-declared predictions and subsequent outcomes: the prediction record alone is **not novel**.
- [Autonomic computing (2003/2006)](https://research.ibm.com/publications/autonomic-computing-architectural-approach-and-prototype) already provides human-stated objectives, self-management loops and architecture; a recursive feedback loop alone is **not novel**.
- [OPA](https://www.openpolicyagent.org/docs) and [NIST AC-5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) separate policy decision/enforcement and duties: a checked approval gate alone is **not novel**.

**Revised candidate contribution (tentative):** a *concrete, traceable combination* of organizationally recursive control channels and distinct, auditable proposals / prospective predictions / counterfactual evidence / authorized acceptance / live reconsideration over a versioned agent harness, with a bounded analysis of where the control and trust boundaries fail. This is a design/implementation contribution if demonstrated, not a theoretical invention of its constituent patterns. A strong null result could still be valuable.

## 9. Next research increments

- Produce a small labeled-transition-system or state machine for the three accept paths, including attempted bypass and an inconclusive probe.
- Cross-check all symbols and properties against the actual protocol implementations as Claude develops the admission/acceptance schema.
- Write one fully worked counterexample in which evidence for a diagnosis incorrectly appears to support the suggested remedy.
- Separate existing enforcement and future mechanisms in a checkable table with code/test references.
- After author review, promote stabilized definitions and diagrams into the manuscript; leave unsettled issues explicitly open.

**Status:** substantial draft of the formal model and challenge list. No formal proof, static verification, or empirical evaluation has been run.

## 10. Author clarification and cross-review (2026-10-18): S5, vocabulary and adaptive *subtraction*

This note records a discussion intended to **narrow** the scholarly claims without introducing new product requirements. See the parallel [#104 close-reading addendum](2026-10-18-paper-104-prior-art-novelty.md), including full text of [Jackson (1988)](https://doi.org/10.1111/j.1467-6486.1988.tb00047.x) and [Hu et al. (2026)](https://arxiv.org/abs/2609.32459).

### Same maintainer, two decision contexts

Distinguish **S5 as a governance function at a system-in-focus** from a human actor or organization's formal deliberation process. For a single-maintainer instance, the actor exercising operational S5 authority may be **the same** individual exercising meta-definition S5 authority. The two functions differ in **object/authority scope**:

- Operational S5: uphold the instance/workload's identity, boundaries, and policy dispositions within a given definition.
- Meta S5: decide whether to alter the definition's own advice, regulatory controls, scopes and evolution/retirement conditions, via its own acceptance paths.

Neither role is an extra AI agent; the upper-level Reflector is proposed as **S4, not S5**. A two-level VSM diagram cannot itself establish either that these are distinct persons or that the upper level is a fully self-standing viable organization. For a team, representation, procedural fairness and collective decision-making remain **organizational choices external to Regulator**; `--by` is attributable role assertion, **not authentication or a constitution**.

Jackson's deeper critique concerns not requiring a board everywhere but understanding **whose objectives a system can preserve**, whether they are contested, and whether a mechanically coherent design forecloses change. For Paper 1, treat purpose/legitimacy as a declared boundary condition rather than manufacture a team-democracy feature. Even in a solo system, ask whether existing instrumentation could mistake excessive conformance for viability.

### Reversibility and under-regulation versus over-regulation

Hu et al. find complex performance scaffolds are less beneficial for some stronger-model issue-repair tasks but more beneficial for stronger models on open-ended repository tasks. That is **not evidence that stronger models require weaker authorization boundaries**. Combine with Regulator's existing [per-regulator ablation switch/review/retirement](../concepts/evidence-about-the-regulators.md): the higher-level S4 should evaluate when to *propose removal or attenuation* of an unnecessary constraint as carefully as it evaluates additions. It must not retire any gate itself. The existing documented human-only registry retirement rule remains authoritative.

**Candidate research proposition G10 (not demonstrated):** With model/workload/risk/definition revision held appropriately fixed and independently observed, a governed proposal to attenuate optional scaffolding can lower resource/human costs without unacceptable deterioration in outcome or boundary metrics, provided an authorized acceptance path and live reversal mechanism exist. The null outcome (added machinery costs more than it saves, or a supposedly redundant guard is still essential) must be preserved.

**Proposed taxonomy for comparative measurement:** model family/version × task/workload family × mechanism class × outcome risk × probe/live horizon. Mechanism class distinguishes (a) performance scaffolding (optional advice/steps/context/delegation) from (b) assurance/authorization (gates, checkers, evidence, S5 routes). Evidence that one is redundant says nothing automatic about the other.

### VSM as a shared engineering vocabulary is itself a candidate contribution

The author emphasizes that the **consistent VSM vocabulary across practitioners and harness products** (as developed in the separate course and Regulator) is a core motivation, potentially independent of Regulator itself. This suggests two distinguishable publication claims:

1. **Conceptual/diagnostic contribution:** an operational *pattern language* that lets developers of heterogeneous agent systems identify S1 operations, S2 coordination, S3 orchestration, S3* independent auditing, S4 environment/future-facing intelligence, S5 identity/authority, and channel/pathology concepts **without confusing them with agent personas**. This can be specified in portable, platform-neutral terms rather than as names of classes in a Pi repository.
2. **Implementation/demonstration contribution:** Regulator/Reflector as *one* implementation of that vocabulary and of a bounded second-level proposal/evaluation/adoption protocol, including explicit scope and failure claims.

Neither contribution should be framed as inventing the VSM. Novelty might lie in a rigorous **translation into agent engineering**, concrete cross-harness mapping rules, and empirical demonstration of diagnostic use. To test the *vocabulary* claim scientifically, consider a modest independent exercise: have multiple practitioners label the same 2–3 agent architectures using a published glossary/coding rubric, measure agreement and disagreements, and compare the **identification of omitted regulatory functions and authority ambiguities** against unstructured descriptions or an ordinary MAPE-K vocabulary. This is a *suggested future study*, not required for the first bounded formal article; avoid claiming demonstrated transferability or inter-rater reliability prematurely.

**Reviewer challenge:** Why should practitioners adopt Beer vocabulary rather than MAPE-K, control theory, or existing software assurance terminology? Answer must be concrete: expressiveness, detection of otherwise-hidden distinctions, reproducible mappings, and reduced ambiguity, with **counterexamples where the VSM mapping adds no value**.
