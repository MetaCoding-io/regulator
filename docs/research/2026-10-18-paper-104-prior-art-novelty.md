# Paper 1 / #104 — Prior art, alternative frameworks, and novelty stress test

- **Status:** structured literature review v0.1; source metadata and primary abstracts checked on 2026-10-18, **not a comprehensive systematic review** and **not a substitute for reading every full text**.
- **Research track:** [Regulating the Regulator](2026-10-18-paper-regulating-the-regulator.md); [issue #104](https://github.com/MetaCoding-io/regulator/issues/104); independently drafted [formal scaffold #103](2026-10-18-paper-103-formal-governance-model.md).
- **Review scope:** regulation/organizational cybernetics, critiques of VSM governance, self-adaptive computing, policy enforcement/separation of duties, empirical design-science methodology, and 2026 agent harness evolution. Primary publisher pages, primary preprints and official standards/tool documents are used below. Classify **published journal**, **preprint**, **book**, **industry engineering account**, and **official implementation/standard** separately.
- **Reading-depth key:** **text** = accessible source text or substantial primary excerpt inspected; **abstract** = publisher/arXiv abstract and bibliographic metadata verified, no claim of full-text reading; **catalog** = publisher or original author's bibliographic information, requires full reading before quoting arguments. Do not invent findings from abstracts.

## 1. Scope and falsification-first thesis

**Question:** Is recursively governed harness adaptation novel in any defensible way, or is it existing self-adaptive software management plus ordinary change control and a VSM diagram?

**Strongest prior-art objection:** An autonomic computing monitor–analyze–plan–execute loop already observes systems, predicts or decides adaptations, and operates under high-level human objectives. Policy-as-code engines and separation-of-duties controls already distinguish proposal, enforcement and authorized action; CI verifies a change at a revision; AI harness papers already study self-modification, predictions and candidate rollouts. Thus none of these *components*, nor combining a human reviewer with them, is novel.

**Surviving tentative claim:** Regulator + Reflector *might* contribute a reusable, inspectable design pattern for governing the *adaptation of the harness's own authority-bearing mechanisms* across two organizational levels: typed evidence grounded at revisions; independently evaluated advice changes; distinct proposal, forecast, decision and future-outcome records; and mechanical differentiation of human-authorized acceptance paths by consequence. Novelty would reside in the **precise integration and explicit limits**, supported by a runnable demonstration; it does not establish new cybernetic laws.

## 2. Source matrix — first pass (20 primary items)

Each entry reports (a) actual contribution as supported by material inspected, (b) evidence type/read depth, (c) strongest overlap, and (d) unanswered distinction or limitation for the paper. **Read depth is important:** entries marked abstract/catalog need full-text review before claiming they omit a feature.

| # | Source | Verified type / reading depth | Contribution and strongest overlap | Gap / research challenge (not a claim of proven absence) |
| --- | --- | --- | --- | --- |
| 1 | [Ashby (1956), *An Introduction to Cybernetics*, ch. 11](https://ashby.info/Ashby-Introduction-to-Cybernetics.pdf) | Book, original scan / **text**, ch. 11 §§11/6–11/7 | Derives constraints relating disturbance, regulator and outcome variety, not an exhortation to add gates | To invoke requisite variety, quantify disturbances, response capacity and desired outcome; more controls can be counterproductive |
| 2 | [Conant & Ashby (1970), *Every good regulator of a system must be a model of that system*](https://doi.org/10.1080/00207727008920220) | Peer-reviewed journal / **abstract** | Model-of-regulated-system theorem subject to specified conditions for maximal success and simplicity | Cannot conclude VSM/Reflector is uniquely required; formal assumptions matter |
| 3 | [Beer (1979), *The Heart of Enterprise*](https://www.wiley-vch.de/en/areas-interest/finance-economics-law/the-heart-of-enterprise-978-0-471-94837-7) | Book / **catalog**; original 1979, publisher linked 1994 edition | Theory of viability, metasystems, relationships of inside/now and outside/then, autonomy/constraint | Must properly justify placing Reflector at upper-level S4 rather than assume five names fit |
| 4 | [Beer (1984), *The Viable System Model: Its Provenance, Development, Methodology and Pathology*](https://doi.org/10.1057/jors.1984.2) | Peer-reviewed journal / **abstract** | Author's account of VSM methodology and interpretation | Treating VSM as five role labels loses its managerial and recursive logic |
| 5 | [von Foerster et al. (1974), *Cybernetics of Cybernetics*](https://search.worldcat.org/title/245683481) | Primary 1974 edited/course volume / **catalog** | Foundational source on cybernetics of observing/control of control | Observer situatedness is not equivalent to nesting two control charts; **full text needed before attributing a precise position** |
| 6 | [Ulrich (1983), *Critical Heuristics of Social Planning*](https://wulrich.com/publications.html) | Book / **author's bibliography** | Critical-systems/ethical boundary judgments concerning whose interests a designed system serves | Who designates S5, whose viability is prioritized, who can contest excluded values? **Read selected chapters before detailed attribution** |
| 7 | [Jackson (1988), *An Appreciation of Stafford Beer's ‘Viable System’ Viewpoint on Managerial Practice*](https://doi.org/10.1111/j.1467-6486.1988.tb00047.x) | Peer-reviewed journal / **text via author-posted excerpt and publisher metadata** | Substantial critique of VSM's assumptions, purpose determination, possible misuse as autocratic organizational control | Formal enforcement cannot make S5 legitimate; add critical governance limits and stakeholder discussion |
| 8 | [Kephart & Chess (2003), *The Vision of Autonomic Computing*](https://doi.org/10.1109/MC.2003.1160055) | Peer-reviewed IEEE Computer / **abstract** | Human-defined high-level objectives and self-managing computing; major precursor to adaptive control loops | The claim that an AI harness needs meta-regulation risks being a restatement of autonomic computing |
| 9 | [White et al. (2006), *Autonomic Computing: Architectural Approach and Prototype*](https://doi.org/10.3233/ICA-2006-13206) | Peer-reviewed journal / **abstract** via [IBM publication page](https://research.ibm.com/publications/autonomic-computing-architectural-approach-and-prototype) | Describes self-managing resources, interaction interfaces, self-configure/optimize/heal/protect and Unity prototype | Hard baseline: why does the proposed two-level VSM protocol differ beyond terminology? |
| 10 | [NIST SP 800-53, AC-5 Separation of Duties](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) | Government security standard / **text** | Distinct duties and access authorizations, including separating access administration and auditing | Separation of proposer/evaluator/decision-maker is established security practice |
| 11 | [Open Policy Agent, official philosophy and docs](https://www.openpolicyagent.org/docs/philosophy) | Open-source system's primary documentation / **text** | Decouples policy formulation, evaluation, and enforcement; can gate CI, tools and deployment | A typed gate is not novel; define what recursive intelligence and post-decision learning add. Also compare [OPA's agent tool-calling example](https://www.openpolicyagent.org/docs/agent-tool-calling) |
| 12 | [NIST AI RMF 1.0 (2023)](https://www.nist.gov/itl/ai-risk-management-framework) | Government framework / **official explanation** | Separates Govern, Map, Measure, Manage functions across AI lifecycle | High-level human governance and continuous measurement are not new; paper must supply mechanized semantics and assumptions |
| 13 | [Hevner et al. (2004), *Design Science in Information Systems Research*](https://aisel.aisnet.org/misq/vol28/iss1/6/) | Peer-reviewed MIS Quarterly / **abstract** | An artifact can constitute research if construction/application yield and evaluate new knowledge | The code artifact alone does not establish scholarly novelty: comparisons, evidence and evaluation remain necessary |
| 14 | [Peffers et al. (2007/08), *A Design Science Research Methodology for IS Research*](https://doi.org/10.2753/MIS0742-1222240302) | Peer-reviewed JMIS / **abstract** via [JMIS page](https://www.jmis-web.org/articles/765) | Six-stage design-science methodology: problem, objective, build, demonstrate, evaluate, communicate | Use as paper's methodological structure, not proof of effectiveness |
| 15 | [O'Rourke (2026), *The LLM as variety transducer*](https://doi.org/10.1108/K-03-2026-0482) | Peer-reviewed *Kybernetes* conceptual article (accepted June 2026, posted July 21) / **publisher abstract** | **Direct VSM-for-LLMs prior art**, with recursive model and second-order/reflexive acknowledgement | Cannot claim first application of Ashby/Beer to LLMs; distinguish explicit executable writer/authority boundary and evaluated meta-governance |
| 16 | [Lahiri (2026), *Agent-initiated socio-technical reconfiguration*](https://doi.org/10.3389/frai.2026.1881783) | Peer-reviewed *Frontiers in Artificial Intelligence*, July 3, 2026 / **text** | Already characterizes **recursive governance**, three tiers of agents reconfiguring coordination, and social vs technical controls | Cannot claim first identification of recursive governance; extend a sociotechnical taxonomy with narrowly testable artifact, not a universal solution |
| 17 | [Lin et al. (2026), *Agentic Harness Engineering*](https://arxiv.org/abs/2604.25850) | arXiv preprint v4 May 18 / **abstract** | **Decision observability already pairs harness edits with forecasts and later outcomes**, plus component/experience observability and iteration | Prediction/hypothesis attached to an edit is not novel. What can Regulator demonstrate about distinct independent audit, consent/adoption, revocation and live regression? |
| 18 | [Xu et al. (2026), *Harness²: Recursive Agent Harnessing for an Open World*](https://arxiv.org/abs/2610.14224) | arXiv preprint Oct 9 / **abstract + repo's detailed source-grounded analysis** | Propose–Probe–Compose harness edits, contrastive trajectories and retained experiences across two forms of recursion | Not first probe or recursion; proposal-to-authority separation and evidence provenance are candidate differences that **must be tested**, not declared unique |
| 19 | [Barbaste et al. (2026), *Harness Engineering: Anatomy, Architecture, and Evolution of Coding Agents*](https://arxiv.org/abs/2609.00006) | arXiv preprint; first submitted July 15, despite September arXiv identifier / **abstract** | Source-code analysis of 11 harnesses; catalog of canonical subsystems and recurring architectural patterns | A host seam, loop, permissions, memory and evaluation are ordinary architecture; narrow claims to specific cross-level protocol behavior |
| 20 | [Lopopolo (2026), OpenAI *Harness Engineering*](https://openai.com/index/harness-engineering/) | First-party engineering report, **not peer-reviewed** / **text** | Operational report emphasizing human steering, mechanically enforced invariants, feedback, repo-based knowledge and autonomous work | Human oversight and mechanically enforced invariants are practiced; evidence is an organization-specific engineering account, not general proof |

**Further primary sources to read next:** [Espejo (2021) enterprise complexity/VSM extensions](https://doi.org/10.1002/sres.2735), [Schwaninger (2006) competing theories of viability](https://doi.org/10.1002/sres.731), and [Flood & Jackson (1988) critical cybernetics/organization review](https://doi.org/10.1080/01969728808902154). The first review contains twenty sources, not twenty fully read papers. No automated citation count or systematic database inclusion/exclusion review has been performed.

## 3. Independent conceptual frameworks: comparison, not straw men

### A. Autonomic computing and MAPE-K (strongest functional competitor)

The monitor–analyze–plan–execute loop with a knowledge base can map most of the proposed workflow: telemetry capture (Monitor), Reflector diagnostics/prediction (Analyze), recommended adaptation (Plan), authorized application (Execute), historical/evidence store (Knowledge). IBM's prior work also includes high-level human objectives and self-managing resources. **Thus labeling this “the first recursively self-improving control loop” would be indefensible.**

A more precise difference to investigate is a **versioned authority-bearing adaptation**: a harness itself contains tools, profiles, checks, advice and policy; proposed changes are typed by **what authority they affect**; acceptance follows different mechanisms; a later independent evaluation assesses actual results. This can be built on top of MAPE-K, and must be described as compatible rather than as an alternative requiring VSM by necessity.

**Discriminating test:** Does the VSM framing predict a failure class or design obligation *not surfaced by an equivalent MAPE-K + policy-as-code architecture*? If not, the contribution is at most an implementable synthesis/design pattern and should be framed accordingly.

### B. Policy-as-code / separation of duties / routine software delivery

OPA's policy decision point vs enforcement point, NIST AC-5, CI, protected branches and code review already distinguish writing a request, satisfying checks, and authorizing a merge. The simplest skeptical reconstruction of Reflector is “an agent opens a pull request; CI runs; a human merges; dashboards report regressions.”

**Potential added value to test:** explicit **cross-level semantics** for observed failure -> recommendation -> pre-stated disconfirming prediction -> bounded probe -> typed acceptance path -> post-adoption reopening of obligation, with causally relevant revision-linked evidence and an inspectable registry of known limits/retirement conditions.

**Discriminating test:** Write the same governance case using an ordinary bot+PR+CI+OPA stack. Count which guarantees are already satisfied, what must be added, and whether Regulator reduces ambiguity or merely changes vocabulary. This is the most important practical control for #105 and #106.

### C. Existing recursive-learning / harness adaptation papers

AHE and Harness² both make **measured** claims of performance improvement through harness modification. AHE's declared edit-level predictions particularly undermine a claim that Reflector invents falsifiable self-improvement. Harness²'s execution contrasts undermine a claim that it invents probing.

The legitimate research question is the **separation of learning incentives and governance authority**: Who can edit the scoring system? Can a candidate alter guardrails or executable scripts? Who determines whether the outcome is admissible? What evidence survives after acceptance? Can later harm trigger reconsideration? These questions may be absent, answered differently, or constrained to an experimental sandbox in the comparator; a full-text study is needed before asserting which.

**Discriminating test:** Controlled adversarial adaptation case: a candidate that appears to improve task metric but weakens tests, permissions or provenance. Demonstrate mechanisms and costs; do not assume all adaptive harnesses lack comparable safeguards.

### D. Critical systems theory and the politics of viability

Ulrich and Jackson make the ethical issue central: a formally coherent system can preserve the power of those who define its purpose. Calling an authorized maintainer “S5” does not establish democratic legitimacy or alignment with affected people. If Reflector optimizes only token cost and completed tasks, important externalities may disappear from the success criterion.

**Discriminating analysis:** Explicitly identify boundary choices, affected actors, excluded evidence, contestation/appeal, and whether a refusal harms someone who cannot control S5. Add a “who decides viability?” paragraph to the formal model and paper, not just to the discussion section.

## 4. One-to-two-page novelty memo (working draft)

### Problem

An autonomous coding agent can both execute tasks and help reconfigure the harness that constrains it. When the same agent's diagnosis, proposed change, evaluation and acceptance share authority or a model-generated score, a performance improvement may carry an unrecognized regression in control capability. This is not a new category of self-referential system; recent autonomous-agent research makes it an urgent software design concern, and already supplies some adaptation tools.

### What the paper cannot claim

The paper is **not** the first to use VSM for LLMs (O'Rourke), the first to identify recursive governance (Lahiri), the first to invent self-adaptive control (Kephart/Chess, White et al.), the first to separate change approval from execution (NIST, OPA and CI practice), the first to attach predictions to harness changes (AHE), or the first to probe self-improving candidate harnesses (Harness²). It cannot infer better performance from a formal diagram and cannot claim robust identity-security without authenticated actors.

### Candidate contribution, conditional on implementation/evidence

A bounded design-science artifact and architectural account of **governed meta-adaptation**, in which higher-level environmental intelligence reads versioned host-backed evidence about lower-level operations, emits falsifiable change proposals without acquiring write authority, is checked against a separately declared evaluation, is adopted only through mechanically distinct permission paths, and remains accountable to later disconfirmation. The VSM is the organizing explanation of why those functions are **organizationally distinct** and why feedback reaches a recursive level, not a claim of uniqueness or mathematical necessity.

### Strongest prior-art objection

All components can be assembled from MAPE-K, OPA, GitHub branch protection and CI, plus an LLM that opens a PR. If there is no measurable distinction between that baseline and Regulator/Reflector in control invariants, transparency, adaptability, cost or failure detection, the paper adds little beyond packaging and labeling.

### Answer worth testing, not asserting

Regulator may make the lifecycle of a *regulatory change* a typed inspectable object: observation provenance, targeted definition class, stated predictions, probe conditions, scope-limited decision authority, and live re-evaluation. The claim survives only if the explicit cross-level representation enables a meaningful, reproducible analysis of **failure modes of the regulators themselves**, beyond what the ordinary PR pipeline captures without substantial additional machinery.

### Threats to originality and technical validity

- An apparently independent S3* can share host bugs, judge bias, instrumentation gaps or revision provenance with the producer.
- Advice is itself behavior-shaping policy; the identity/advice distinction is useful but not a proof that accepted advice cannot change real outcomes outside policy intent.
- Existence of evidence references does not prove truthful diagnosis or causal efficacy.
- “Human in the loop” is not a substitute for actor authentication, representative legitimacy or measurable human attention cost.
- A single repository, single test workload and successful demonstration are insufficient to claim general advantages.
- The act of measuring, evaluating and selecting adaptations may create Goodhart/selection effects and self-fulfilling forecasts.
- Because Regulator and Reflector share authorship with the researcher, confirmation bias and unconsciously favorable fixtures are serious threats.

## 5. Cross-review questions sent to #103

1. Does the second recursive level instantiate the VSM, or merely describe a conventional governance team? Specify what would distinguish them.
2. The prediction record in the formal model is not novel after AHE. Precisely what properties of *separate authorization and post-adoption resolution* are being studied?
3. Formalize the difference between logical independence of host checks and statistical/organizational independence from the proposing model.
4. Be clear that authenticated S5 identity is currently **external to the implementation**; don't promote a string field check into a security theorem.
5. Define an ordinary PR+CI+OPA baseline and a governance-cost measure.
6. Make whose viability is preserved and whose voices are excluded an explicit assumption/limitation.
7. Distinguish VSM recursion from second-order cybernetics rather than assuming an S4 observer creates the latter automatically.

## 6. Next steps to upgrade this review

- **Highest priority full texts:** O'Rourke (2026) vs Beer (1984); Lahiri (2026); AHE and Harness² main text and appendices; Kephart & Chess (2003) / White et al. (2006); Jackson (1988) and Ulrich (1983). The matrix is already a serious *screening review* but not all source interpretations are yet substantiated to manuscript standard.
- **Traceable comparison:** code-side, compare Regulator's actual tool/result/evidence/authority path to documented OPA/CI pathways. Avoid declarations of absence based solely on abstracts.
- **Expand search:** autonomic computing, self-adaptive systems assurance cases, runtime verification, continuous experimentation and organizational cybernetics critiques.
- **Draft journal-ready related-work prose** after source reading and reviewer/author approval. Do not turn this internal research note directly into AI-generated final journal prose where target venue policies prohibit it.
- **Preserve negative findings:** If a direct precedent demonstrates the entire proposed pattern, change the research claim instead of weakening source representation.

**Preliminary conclusion:** there is a defensible *candidate design-science contribution*, but the burden of proving it adds knowledge falls on a worked comparison to existing adaptive systems and software change-management tools. This is the strongest finding of research issue #104 so far.

## 7. Close reading addendum (2026-10-18): capability-dependent harness effects

**Source:** Hu, Zhang, Yu, Chen, Luo, Fang, Chen & Xiao, [*Beyond the Model: Demystifying Harness Effects in Software Engineering Agents*](https://arxiv.org/abs/2609.32459), arXiv preprint posted **2026-09-26**. **Reading depth:** full arXiv-rendered text, including design, results, component analyses, threat discussion. Not peer-reviewed as of this reading. This was found in response to a contemporaneous report that stronger models might need less harness scaffolding.

### Their research design, and what it actually establishes

- RQ1 compares **two harnesses** (minimal mini-SWE-agent and more feature-rich OpenCode) across **ten models** (five Qwen, five DeepSeek) and **three task types**. Although the benchmark catalogs include 731 SWE-bench Pro, 200 ProgramBench and 54 GitTaskBench tasks, the comparative runs use **300 sampled SWE-bench Pro**, **70 sampled ProgramBench** and **all 54 GitTaskBench** tasks. Same instances within matched conditions; temperature 0; 250-step cap for SWE/GitTask, 300 for ProgramBench; 6-hour task cap; container isolation for two sets; local workspace isolation for GitTaskBench (§§4.1–4.4).
- RQ2/RQ3 examine five components (tool registry, context compression, explicit planning, generic vs specialized subagents, lazy skills) with stronger Qwen3.7-Max and DeepSeek-V4-Pro on **all 200 ProgramBench tasks**. The contrast is **behavioral scaffolding**, not whether a regulatory control plane or human approval is needed. The paper groups permission/logging/evaluation among important but **not deeply studied** support modules (§2.1). A conclusion that 'governance gates become useless with model strength' is outside its measurements.
- For **issue repair**: OpenCode's Qwen3-Max gain over mini-SWE is about **+6 pp**, shrinking to **+2.67 pp** for Qwen3.7-Max. Strongest DeepSeek V4-Pro scores **34.3 vs 33.7** (+0.6 pp). The DeepSeek trend is **non-monotonic**: intermediate models gained more (§5.1.1). Authors also report older matched Claude model/SWE-bench Verified leaderboard data; treat public leaderboard comparisons as observational.
- For **open-ended repository generation and general repository tasks**, the paper finds the *opposite* interaction: stronger models often use complex harnesses **better**, while weaker ones fail to exploit their complexity (§5.1.2). **No universal monotonic law** of diminishing harness value follows.
- ProgramBench component ablations: tool registry **+4.57 pp** and task-specific subagents **+5.91 pp** for Qwen3.7-Max; **+3.54** and **+4.46** for DeepSeek-V4-Pro. Compression degrades scores **−4.86** and **−3.85 pp** despite reducing prompt tokens **54.29%** and **77.02%** respectively; general subagents also hurt. Full NanoHarness improves **+7.37** and **+6.21 pp** over mini-SWE, recovering most of OpenCode/Claude Code gains (§§5.2–5.3). Thus **more engineering structure is not monotonically better**, but 'simpler is always better' is equally unsupported.
- Observed failure classes include **excessive probing** (wasted exploratory calls) and **insufficient probing** (premature assumption of correctness); selected components regularize both extremes (§5.3.2). This is closer to a cybernetic 'appropriate regulatory response' framing than a blanket pro- or anti-harness slogan.

### Methodological cautions to carry into Paper 1 and 2

The authors acknowledge that only five representative components, two open-weight families and a task concentration on ProgramBench constrain generality (§7). The accessible text describes temperature 0 but I did **not locate evidence of independent stochastic repetitions or a variance/significance analysis for all comparisons**; do not infer population certainty from reported points. Model capability is indexed by a third-party coding ranking, not a randomized intervention on intelligence. Product harness vs minimal harness bundles multiple mechanisms; component ablations only cover two stronger models and one task set. Task-specific model training could partially explain convergence on issue repair (§5.1.2).

### Direct implications for the Regulator/Reflector research program

1. **Decompose 'harness' into two distinct cost/benefit classes:** (i) operational *performance scaffolding* (advice, planning, memory/compaction, delegation, optional skill packaging) and (ii) *assurance and governance* (authority boundaries, host checks, provenance, approval, rollback). The Hu et al. experiment directly measures mostly (i), not an empirical case for turning off (ii).
2. **Condition effects jointly on model × workload × mechanism**, not a scalar 'model intelligence' threshold. Record evaluator/model and task-family fingerprints when changing or promoting advice.
3. **Reflector must be able to recommend subtraction** (`KEEP_BASE`, shorten advice, remove a workflow step, attenuate redundant hint/check, or recommend a regulator's review/retirement) as well as addition. **A proposed removal is not permission to execute it**. Advice changes follow the proposed advice accept path; granting/executable/policy/check retirement goes through reviewed definition repository changes.
4. Regulator already has **registry-level ablation switch, review date, retirement condition, `review --due`** and human-only retirement (see [evidence-about-the-regulators](../concepts/evidence-about-the-regulators.md)). This is an existing *design strength*, not a brand-new Reflector feature. Reflector would read the ablation evidence, ask whether a mechanism still absorbs a failure at acceptable cost, and submit an S5 proposal supported by held-out observations.
5. Formulate a prospective question for [#105](https://github.com/MetaCoding-io/regulator/issues/105): **Under matched workload/model settings, can evidence-based attenuation of optional scaffolding reduce tokens/latency/human interruptions without worsening independent conformance and outcomes?** Avoid using 'a successful run' as evidence a check is redundant. A missing observed violation can be absence of exposure, not control effectiveness.
6. **Constrain interpretation of cybernetic variety:** regulation is not a count of gates. The objective is an appropriately allocated response capacity relative to environmental disturbances. Better models might need less procedural guidance while their increased scope of action demands equally strong—or stronger—mechanical authorization.

### Other recent research added to the reading queue

- Yu et al., [*Co-Evolving Harnesses and Models: On-Policy Correction Helps Weaker Models Catch Up Where Imitation Fails*](https://arxiv.org/abs/2609.09134), September 2026 **preprint**, full introduction and results summary inspected. Across seven enterprise tasks, expert-trajectory fine-tuning under an evolved harness regressed **4–30 points** even though the same imitation approach helped under the unmodified harness. The harness's fit to the agent's planning style matters; a model upgrade should trigger a **fresh calibration**, not blindly inherit an optimized harness. **Priority: high for Reflector compatibility and horizon rules.** Full appendices/methods remain to read.
- Gu, [*From Model Scaling to System Scaling: Scaling the Harness in Agentic AI*](https://arxiv.org/abs/2605.26112), May 2026 **preprint**, introduction and framework overview inspected. Identifies context governance, trustworthy memory, dynamic skill routing and verification/governance as system-level bottlenecks; provides a potential *opposite hypothesis* to the simplistic 'better models eliminate harnesses.' **Priority: medium for the paper's system-level motivation.**
- [*Agent Systems with Harness Engineering: A Systematic Survey*](https://doi.org/10.1007/s11704-026-61123-6), published online September 16, 2026 in *Frontiers of Computer Science* (publisher metadata/abstract reviewed). **Priority: medium**, useful for scope and source discovery; verify coverage and bibliographic details in the full article.

**Interim conclusion:** The new Hu et al. study supports a *calibrated-regulation* research question, **not** deregulation as a function of model size. It expands the novelty stress test: a regulated system should justify additions **and removals** of mechanisms from independent, scoped evidence. This should be a research proposition before becoming an implementation task.

## 8. Close reading addendum: what Jackson (1988) actually criticizes

**Source:** Michael C. Jackson, [*An Appreciation of Stafford Beer's 'Viable System' Viewpoint on Managerial Practice*](https://doi.org/10.1111/j.1467-6486.1988.tb00047.x), *Journal of Management Studies* 25(6):557–573, November 1988; **full author-uploaded text** [accessible here](https://www.researchgate.net/publication/229579205_An_Appreciation_of_Stafford_Beer%27s_Viable_System_Viewpoint_on_Managerial_Practice). Distinguish its sympathetic exposition (§'A Viable System Viewpoint') from its explicitly dialectical critique (§'Blindspots').

Jackson **praises** VSM's sophisticated organizational model, differentiation/integration, managerial information and decentralization. He does **not** contend that every VSM needs a democratic committee or that S5 at two recursive levels must have different human actors. His main criticism is that a model capable of regulating means toward goals **does not by itself establish who may define legitimate goals, how competing purposes are settled, or how culture and power affect real practice**. He also warns that institutionalized organizational structure can foreclose learning and can be used for top-down control despite a vocabulary of autonomy. He explicitly rejects the simplistic thesis that VSM *inevitably* creates authoritarian governance.

**Interpretation for a one-person Regulator deployment:** The same person may occupy S5 at the instance and meta-definition levels, since an S5 function is not the identity of the person performing it. Regulator need not prescribe multi-party governance. Its truthful scope is: identity, access roles, enforcement, proposals and an accountable disposition, with actor authentication and the substantive legitimacy of purpose outside the application. Jackson still adds an *epistemic* concern for solo systems: are the declared objectives and enforcement rules becoming too rigid or filtering contrary evidence?

**Interpretation for team deployments:** Separately declare the authorized S5 actor/group, and let teams determine deliberation, representation and dispute procedures externally. Recording `--by` is not authenticating the identity or validating the fairness of decision-making. Operational S5 and meta S5 may differ in **function and scope** but need not differ in personnel. Future research could ask whether an escalation/appeal path is missing; not essential product scope for Paper 1.

**Novelty correction:** Criticism about legitimacy cannot independently ground an 'S5 split' feature request; the conceptual split follows the system-in-focus at each recursion level. The interesting synthesis with Hu et al. is a second kind of critique: can the **regulatory apparatus itself become resistant to learning and improvement**? Regulator's ablation/retirement mechanisms and proposed Reflector meta-S4 provide a testable response without solving social legitimacy.
