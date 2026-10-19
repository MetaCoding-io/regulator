# Paper 1 — Regulating the Regulator: recursive governance of agent harnesses

- **Status:** active research track; architectural proposal and research protocol **not yet validated**. No manuscript or empirical claims are complete.
- **Started:** 2026-10-18. **Target venue (provisional):** *Systems Research and Behavioral Science* (SRBS), potentially its Stafford Beer centenary special issue. The announced deadline is **February 2027**, subject to verification before submission.
- **Working title:** *Regulating the Regulator: A Cybernetic Architecture for Governed Self-Improvement in Autonomous Agent Systems*.
- **Research lead:** author/maintainer, with research work developed separately from product implementation.
- **Engineering handoff:** Claude may work on individually scoped Regulator/Reflector development issues; this note does not grant permission to bypass decisions or alter existing enforcement boundaries.
- **Related designs:** [architecture](../ARCHITECTURE.md), [Harness² and Reflector](2026-10-18-harness2-recursive-harnessing.md) §§4, 7–8, [accept-path split](2026-10-18-accept-path-split.md) §§3–10, [predictive S4](2026-09-25-open-questions.md#4-predictive-intelligence-s4-as-a-model-of-outside-and-then), [evidence about regulators](../concepts/evidence-about-the-regulators.md), [roadmap](../../ROADMAP.md).
- **Issues:** [formal model #103](https://github.com/MetaCoding-io/regulator/issues/103), [prior art #104](https://github.com/MetaCoding-io/regulator/issues/104), [propositions/evaluation #105](https://github.com/MetaCoding-io/regulator/issues/105), [worked cases/boundary critique #106](https://github.com/MetaCoding-io/regulator/issues/106), [reproducibility/publication #107](https://github.com/MetaCoding-io/regulator/issues/107), [engineering handoff #108](https://github.com/MetaCoding-io/regulator/issues/108). Tags: \`research\` for research tasks and \`paper_regulating_the_regulator\` for all paper-related tasks.

## 1. Purpose and contribution under examination

**Research question:** How can an autonomous system modify the mechanisms that regulate it without letting the mechanisms proposing changes independently authorize their adoption?

**Prospective contribution:** an explicitly *recursive governance architecture* distinguishing operational work, observed evidence, future-oriented diagnosis/prediction, evaluation of candidate adaptations, and authoritative policy decisions. The novelty cannot be merely using the VSM for agents, noticing that harnesses adapt, or inserting a human-approval step. The testable contribution is an enforceable separation of **proposal / probe / authorized adoption**, represented across two recursion levels, and a candid account of what that separation buys and costs.

**Paper kind:** a conceptual + design-science article with a small, reproducible implementation and bounded evaluation, not a general quantitative claim of superior agent performance. A larger controlled performance study belongs to Paper 2, not this track.

**Do not claim:** (a) a proven general theorem, (b) autonomous S5 editing, (c) adversarial-security guarantees beyond the documented host/deployment trust boundary, (d) that VSM recursion and second-order cybernetics are identical, (e) that Refector/Reflector already works or improves agent performance, or (f) empirical effects before results exist.

## 2. Initial analytic model (a scaffold, not a theorem)

At level n, an instance runs under a checked, versioned definition \`D_n\`. It produces an operational record \`H_n\` containing attempted work, independent checks, audit events, interventions, and costs. A higher-level S4 process reads appropriately scoped records and *proposes* \`P_(n+1) = Reflect(H_n, D_n)\`. An independent probe yields a contrast \`E(P, D, fixture)\`; a separately authorized S5 disposition can adopt or reject the proposal. Subsequent runs produce evidence about the **adopted change**, which may differ from the probe prediction.

The mathematical vocabulary, trusted parties, admissible states, and authority relations require formal definitions in #103. At minimum, separate:

| Function | Can originate | Cannot authorize |
| --- | --- | --- |
| Instance S1/S3 | task outcomes, operational feedback | its own S5 definition mutation |
| S3* (host-owned) | observations at a revision, check results | policy adoption |
| Higher-level S4 / Reflector | diagnosis, proposal, prediction, requested change | writing identity, executable grants, or checks; scheduling arbitrary units |
| Evaluation mechanism | independently observed baseline-vs-candidate contrast | final governance decision |
| S5-authorized maintainer | accept/reject and accountable change path | the truth of an unobserved prediction by declaration alone |

**Candidate invariants (to specify and test, not assume proven):**
1. A proposal record never changes an authoritative definition by itself.
2. An advice edit can land only via the declared acceptance path and authorized actor; changes to executable or capability-granting definitions require a different reviewed merge path.
3. A result report or model interpretation is not independent audit evidence; observed evidence is tied to the evaluated revision and criterion.
4. A probe outcome does not silently substitute for post-adoption performance; an inconclusive result cannot be promoted as a confirmed benefit.
5. Contradictions or disconfirmed live predictions remain visible and are routed for reconsideration rather than quietly assimilated into policy.

**Trust assumptions to name explicitly:** the deployment establishes the identity behind \`--by\`; host checks and event stores are not corrupted; OS/container boundaries constrain shell/custom-tool effects; evaluator and proposer may share systematic bias; a person can approve a mistaken action; the human time and social effects of governance count as real costs.

## 3. Research questions and methodological scope

- **RQ1 — separation:** What authority and evidence invariants can the design enforce mechanically, and where must it rely on a deployment or human assumption?
- **RQ2 — reflexivity:** Can a higher-level observer formulate a trace-grounded, falsifiable adaptation proposal without acquiring authority to implement it?
- **RQ3 — evaluation:** Can pre-adoption and live observations distinguish supported improvements, harmful changes, and inconclusive evidence?
- **RQ4 — cost/limits:** What additional runs, tokens, human decisions, latency, and false refusals does this structure impose, and where does it fail to protect the system?

Methods proposed: formal conceptual model; traceable design choices; a working, *bounded* two-level implementation; model-free adversarial mechanism tests; at least one end-to-end demonstration with recorded positive, rejected and inconclusive/negative outcomes; limited live-model probes where justified. Distinguish deterministic enforcement from stochastic behavior. Do not infer a population-level performance benefit from a single case or from scripted tests.

## 4. Worked scenarios for a minimal evaluation

| Case | Expected observation | What can disconfirm the claim |
| --- | --- | --- |
| Valid bounded advice proposal | diagnosis references actual evidence; probe compares against a baseline; S5 may accept | adoption without authorization, unverifiable evidence IDs |
| KEEP_BASE / no change | Reflector finds insufficient reason to propose and does not force an edit | system invents or automatically accepts a change |
| Unsupported evidence / false premise | proposal rejected or marked unsupported; evidence cannot certify remedy | nonexistent event reference passes a required check |
| Grant/check mutation disguised as advice | acceptance path refuses it; proposed executable change goes to reviewed definition path | proposal modifies grant/check by advice command |
| Inconclusive counterfactual probe | distinct inconclusive outcome, human sees uncertainty/cost | inconclusive treated as confirmed |
| Live regression after accepted advice | new evidence opens a decision/reconsideration path | unobserved or silently ignored regression |

Link all scenarios to actual fixture paths and exact commands as implementation lands, never to hypothetical outputs. A full multi-instance learner or full arbitrary-depth VSM recursion is **not** required.

## 5. Implementation boundary and dependencies

The application already has the versioned definition, S3 loop, protected S5, independent checks, obligations, eval arms, and a regulator registry. The **paper's engineering dependencies** are the *existing planned research designs*, not a mandate to implement all deferred features:

1. Complete the real-model control/treatment baseline [#46](https://github.com/MetaCoding-io/regulator/issues/46) before claiming a validated probe.
2. **Resolve (do not presume resolved)** two decisions in the [accept-path note §10](2026-10-18-accept-path-split.md#10-what-this-asks-of-the-reader): advice as seeded files, and \`advice accept | reject | promote\`. After explicit decisions, follow the note's §8 slice 1 and create the corresponding \`roadmap:0.2\` issue and roadmap row.
3. Implement evidence-grounded prediction and \`harness-edit\` records; admission rules validate references, baseline, metric, horizons and disconfirmation criteria.
4. Add the advice-override eval arm and probe/adoption rule **after** the baseline.
5. Add the smallest read-only \`packages/reflector\` implementation, able to return KEEP_BASE or one typed proposal; no authority over the definition.
6. Test the entire path adversarially, including unauthorized write attempts and misleading evidence. Capture revision-bound records and a named human disposition.

Product engineering stays in the normal [ROADMAP.md](../../ROADMAP.md) thread → decision → milestone issue → code/registry/DEBT workflow, with the developer-level task coordination in [#108](https://github.com/MetaCoding-io/regulator/issues/108). Do not create a new regulation mechanism purely because this paper could mention it. No changes to \`docs/DEBT.md\` are implied by beginning research: future actual registry debt must follow existing rules.

## 6. Research issues and initial sequence

| Task | Issue | Deliverable | Start when |
| --- | --- | --- | --- |
| T1: formal two-level model | [#103](https://github.com/MetaCoding-io/regulator/issues/103) | definitions, trust/authority graph, tentative invariants | now |
| T2: literature/novelty matrix | [#104](https://github.com/MetaCoding-io/regulator/issues/104) | primary-source matrix, strongest competing explanation | now, parallel T1 |
| T3: falsifiable propositions and study protocol | [#105](https://github.com/MetaCoding-io/regulator/issues/105) | preregistered-style design, measures, negative cases | after T1 draft; can start outline |
| T4: worked case, failure/boundary critique | [#106](https://github.com/MetaCoding-io/regulator/issues/106) | provenance-linked case and counterexample | design now; finalize after implementation |
| T5: replication and publication | [#107](https://github.com/MetaCoding-io/regulator/issues/107) | exact commit, reproduction instructions, journal-ready report | plan now; finalize after evidence |
| Product handoff | [#108](https://github.com/MetaCoding-io/regulator/issues/108) | decisions and appropriately scoped issues in product roadmap | Claude/development stream |

Research and product can proceed in parallel. **Research task completion is not a reason to close the product-development work**, and finishing an engineering slice does not resolve an untested academic proposition.

## 7. Reading and novelty work: seed, not a finished review

Primary works to read critically and verify at the point of use:

- W. Ross Ashby, *An Introduction to Cybernetics* (1956) and *Design for a Brain*; requisite variety, adaptation and regulation.
- Stafford Beer, *Brain of the Firm* and *The Heart of Enterprise*; VSM recursion, S3–S4 homeostat and S5 identity.
- Conant & Ashby, "Every good regulator of a system must be a model of that system" (1970).
- Second-order cybernetics: Heinz von Foerster and related work on observers within observed systems. Distinguish observer participation from organizational recursion.
- Autonomic computing / MAPE-K: compare managed-element, monitor–analyze–plan–execute–knowledge loops, and authority separation; treat as strong competing prior art, not merely background.
- Xu et al., [*Harness²: Recursive Agent Harnessing for an Open World*](https://arxiv.org/abs/2610.14224) (2026).
- Barbaste et al., [*Harness Engineering: Anatomy, Architecture, and Evolution of Coding Agents*](https://arxiv.org/abs/2609.00006) (2026).
- Current AI/VSM and recursive governance work, including the independently published studies named in issue #104; verify bibliographic and peer-review status before using them as novelty evidence.
- Critical VSM / critical systems heuristics, e.g. Ulrich: who defines "viable," whose interests and interruptions are outside the measurements?

The paper must confront a likely objection: splitting proposing, testing, and authorizing is already known in security and operations engineering. The contribution must explain the **recursive organization, typed channels and checkable change paths**, plus the costs and limits, that make this an advance over an approval workflow with cybernetic vocabulary.

## 8. Publication and reproducibility

**Primary venue under consideration:** [SRBS aims](https://onlinelibrary.wiley.com/page/journal/10991743a/homepage/productinformation.html), [author instructions](https://onlinelibrary.wiley.com/page/journal/10991743a/homepage/forauthors.html), [centenary call for papers](https://onlinelibrary.wiley.com/page/journal/10991743a/homepage/call-for-papers). Announced special-issue deadline **February 2027**. Scope explicitly welcomes VSM theoretical extensions, governance, and dialogues with AI. The regular journal remains fallback; check the live call at submission.

Plan a blinded journal manuscript plus separately attributed public code and replication artifacts. Capture the versioned source/fixtures, model names and availability, policies, evaluation settings, commands, evidence records, all negative/inconclusive results, costs and data-handling/redaction notes. Do not publish proprietary/private course material in the public repo. Review author instructions, journal AI-use policy, preprint treatment and conflicts of interest before submitting. The author is responsible for scholarship and final claims; assistance from models is not independent scientific evidence.

**Suggested paper structure:** problem and novelty; cybernetic foundations and limitations; recursively governed architecture; prototype/authority model; worked scenarios and evaluation; results; threats to validity and critical governance; implications and future empirical work.

## 9. Deliberately out of scope

No new product milestone solely for the paper; no unrestricted autonomous S5 mutation; no full recursion, RDF/SHACL rollout, second host, S2 semantic commitments, dashboard, production-scale cross-model benchmarking, or general-purpose learning library. The paper should distinguish a minimal *proof of design* from a general demonstration of improved productivity.

## 10. Next working session (author + research assistant)

Start **T1 and T2**, without waiting for Claude's engineering:
1. Write a one-page novelty memo: one sharp claim, strongest prior-art objection, one potential falsifier.
2. Draft the authority table with trusted boundaries and one diagram of the two recursion levels.
3. Build the first literature matrix of 8–12 essential papers/books: actual claimed contribution, evidence, differences, and what could invalidate our originality.
4. Choose the primary worked example and decide what the paper explicitly cannot prove.

Then use those results to refine T3's test protocol before product implementation locks the schema.
