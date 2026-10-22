# Wintercorn (2026): a run-time-generated knowledge graph read through the control plane

*Status: open. Written 2026-10-22 from Part I of the thesis (the summary chapters); the appended papers were not available.*

*One source, two questions, per the conventions in [`../README.md`](../README.md).* The source is a doctoral thesis on semantic interoperability for industrial systems of systems. It is not about agents. It is here because `AGENTS.md` defers RDF and SHACL, the [ArticleMiner note](../2026-09-25-articleminer-knowledge-production.md) is where they would return (a knowledge-production workload whose S3\* checks are `shacl`, `provenance-complete`, `identity-unique`), and this thesis is a careful account, from an unrelated field, of what it takes to trust a generated graph: which triples were asserted, which were entailed, which were derived by a step that is only as current as its last run, and why the pipeline that emits the graph is the thing to audit. Those are S3\* questions. Sections 1 to 7 summarise the thesis in enough detail to cite from. Section 8 answers the two questions. `todos.md` beside this file lists the concrete items; per [`ROADMAP.md`](../../ROADMAP.md) § "How this page is kept" they are candidates until they have a threads row or an issue.

## 1. The source

Oskar Wintercorn, *Bridging Engineering and Operations: Semantic Interoperability in Industrial Systems of Systems*. Doctoral thesis, Cyber-Physical Systems, Department of Computer Science, Electrical and Space Engineering, Luleå University of Technology, 2026. Supervisors Jan van Deventer and Eric Chiquito. ISBN 978-91-8142-118-7 (pdf), ISSN 1402-1544. Funded by the Chips Joint Undertaking Arrowhead fPVN project (Grant Agreement 101111977).

The file read is Part I only (88 pages): the six summary chapters plus references. Part II, the six appended papers, is not in the file. Statements below about the individual papers come from the thesis's own Chapter 6 abstracts and from how Chapters 4 and 5 use them, not from the papers themselves. Public artifacts named by the thesis:

| Artifact | Where |
| --- | --- |
| Arrowhead Framework Ontology (AFO), source and IDO alignment | `github.com/oskwin/Arrowhead-Framework-Ontology` |
| Pump-station alignment use case: three bridge ontologies, `lis-ext`, instance data, synthetic generator, SPARQL queries | `github.com/oskwin/afo-alignment-use-case` |
| IDO pump-station use case | `github.com/PCA-POSC-Caesar-Association/IDO_Use_Case_Pumpstation` |
| IDO digital product description (chemical supply chain) | `github.com/PCA-POSC-Caesar-Association/IDO_Use_Case_Supply_Chain_in_Chemical_Industry` |

The OWL representations of DEXPI and of STEP AP4K that two of the bridges target are not public (Torbjörn Holm, Plant&Bytes, Semantum; Holm and Alexander Svensson).

## 2. The problem as the thesis states it

Connectivity is not interpretation. Industrial systems now exchange data and invoke each other's services freely (IIoT, cyber-physical systems, service-oriented architectures), but a service interface confirms that two systems are connected without recording why, what a failure would affect, or how the current configuration compares to an earlier one. The thesis uses Tolk and Muguira's Levels of Conceptual Interoperability Model (LCIM) to place itself: it works at level 3, semantic, above technical (1) and syntactic (2), and deliberately below pragmatic (4), dynamic (5) and conceptual (6).

The running example is one pump described three ways by three disciplines, each authoritative for its purpose and revised on its own schedule:

| View | Identifier | Maintained by | Organised around | Drifts how |
| --- | --- | --- | --- | --- |
| Run-time | service `pumpSpeed` | the deployment itself | what is currently configured, including which provider a consumer is actually bound to | does not drift (it is current by definition), but leaves no record of earlier states |
| Plant design (P&ID, DEXPI) | tag `123PU001`, a functional location | process engineer | positions where a function is required; the tag is stable while units come and go | gradually, as small modifications outpace drawing updates |
| Lifecycle record (STEP AP4K) | serial `Pump 24C01213`, a physical unit | maintenance / asset management | the object and its history across locations | event-driven, when an intervention goes unrecorded |

Nothing records how the three map. Engineers bridge them through personal familiarity, ad hoc conversion tables, or bespoke integrations, all of which describe the plant as it was, not as it is. The thesis's framing of the fix: the three descriptions are not duplicates from which one authoritative version could be picked. Each keeps distinctions the others have no reason to keep. So the goal is not a universal model but to make their connections explicit while each keeps its own semantics. The agreement required is narrower: each party relates its own vocabulary to a small, published reference vocabulary that none of them owns.

A second idea runs underneath: the functional location versus the physical unit occupying it. IEC 81346 formalises the separation of function, position and object as independently identified aspects. The thesis defines a functional location as a named, hierarchically arranged place where a function is performed and which successive units occupy over the plant's life. This distinction is the hinge of every cross-domain trace, and the thesis found it less firmly established in existing vocabularies than its centrality suggests.

## 3. Research questions and method

- **RQ1.** How can a practical, reusable semantic description of an industrial system of systems be generated from the running system and kept current as the deployment changes?
- **RQ2.** How can a shared reference ontology mediate alignment between independently developed domain models while preserving domain-specific semantics?
- **RQ3.** What reasoning, validation and representational capabilities does a run-time-generated, ontology-based representation enable, and what does each make possible?

Method is Peffers et al.'s design science research process (identify, define, design, demonstrate, evaluate, communicate) with explicit iteration loops. The primary evaluation instrument is competency questions (CQs): questions stated in the user's vocabulary, formulated before building to bound scope and retained afterwards as the pass criterion. A CQ counts as answered only when three conditions hold:

1. the query executes over the instantiated graph after reasoning and returns the expected bindings;
2. it required no modification to any source model and no separate consultation of a domain model outside the shared vocabulary;
3. where the question concerns an inferred relation, that relation appears in the reasoner's materialised output and not in the source graphs before alignment.

Condition 3 separates entailment from new knowledge: most of what an alignment entails is an asserted fact re-expressed in the shared vocabulary, and that re-expression is exactly what lets one query cross vocabularies that do not otherwise meet. Three further forms of evidence: scenario coverage (healthy, malformed instance data, degraded with a missing provider, recovery after replacement), reasoning cost at scale over synthetically generated instance data, and paired generation of two representations from the same deployment so differences are attributable to paradigm alone.

## 4. Contributions

### 4.1 The Arrowhead Framework Ontology (RQ1, Paper D)

An OWL 2 ontology of an Arrowhead local cloud: systems, their husk (interface) and unit assets, hosts and servers, provided and consumed services, core-system roles (service registry, orchestrator, authorisation). The graph is populated by a pipeline from the running deployment, not authored. Snapshots are timestamped RDF exported from live systems, loaded into GraphDB, validated with SHACL, enriched by OWL 2 reasoning, and queried with SPARQL for diagnosis and impact analysis (which systems depend on this provider; what a failed service would affect). Because regeneration is re-running a pipeline, the view cannot drift; the price is that it describes only what the deployment exposes, not intent or rationale. Some facts, such as which provider a consumer is actually bound to, are settled at run-time and could not appear in a design-time description however well maintained. Scope is deliberately bounded to deployment topology, service dependencies and core roles; not control logic, telemetry, or authorisation policy. Paper D also experiments with a natural-language interface that generates SPARQL.

The thesis declines the Asset Administration Shell (AAS) as its representation. An AAS describes one asset as a container of submodels whose elements get meaning by pointing at a dictionary entry, so meaning is by reference, not by axioms, and the structure is a per-asset hierarchy rather than a graph of relations among many things. The thesis needs relations across disciplines to be derivable rather than enumerated. It treats this as a difference of purpose, not quality, and Paper F includes a system that emits AAS representations from the run-time graph.

### 4.2 Reference-mediated alignment (RQ2, Paper E)

The Industrial Data Ontology (IDO, ISO 23726-3, POSC Caesar Association) is used as a reference-layer vocabulary (systems, functional objects, physical artefacts and their relations). Each of three domain models is related to IDO by a bridge ontology: AFO (run-time), a DEXPI-based plant-design model, and the STEP-derived AP4K lifecycle model. A bridge imports the domain vocabulary and the reference vocabulary and adds only the axioms needed to relate them, almost all subclass and subproperty statements. No bridge asserts equivalence, because a domain model routinely carries structure IDO does not represent; the narrower subsumption claim is enough to make domain instances discoverable through the reference vocabulary without discarding anything. No bridge relates any two domain models directly. The three bridges total 66 axioms.

IDO lacked the functional-location granularity needed, so the alignment adds a small extension, `lis-ext`: a functional-location class, a class for the physical unit that may occupy it, and the relation between the two. Every hop of the cross-domain trace passes through these three terms. Because `lis-ext` is authored within the work, it does not inherit IDO's stability.

Why a reference rather than pairwise mapping. Both leave sources intact and both support cross-domain interpretation. The decisive difference is maintenance under change: under pairwise mapping every model revision is every other model's concern; under reference mediation a revision touches only that model's own bridge. The arrangement concentrates volatile dependencies where change is frequent and local (the bridges) and shared dependencies where change is rare (the published standard). The thesis is careful about the counting argument: with three models, pairwise and mediated need the same number of mappings; counting favours mediation only from the fourth model, whereas the maintenance argument applies from the second.

Why the correspondences are curated, not mined. Automatic ontology matching has advanced (embedding- and language-model-based matchers), but on benchmarks unlike this setting: here correspondences are few, terms technical, and the engineers who know what a term means are available. More important is the failure mode: a reasoner applies a wrong subsumption without judgement and produces a confident result, materialised alongside every other inferred fact and indistinguishable from them, propagated into every query that crosses it. The burden sits on the correctness of a small number of statements, so the bridges assert the least that suffices.

The cost that cannot be removed. A bridge axiom relates terms, never individuals. Where two graphs share no identifier, value or assertion, no terminological axiom can connect them. The run-time and plant-design graphs are in exactly this position: the deployment was not configured by consulting the plant design, and the plant design does not record what was deployed. So two kinds of correspondence must be asserted explicitly per deployment: one relating each deployed run-time asset to the functional location it serves, and one (recorded as ordinary lifecycle practice) stating which unit occupies which location over which interval. Both point at plant-design individuals, so at the instance level the plant-design view is where the other two meet. The alignment reduces these assertions to one per deployed asset and one per recorded installation, in place of an integration per pair of models; it does not eliminate them.

A further step is outside alignment entirely. Reasoning derives the unit-to-location relation for every recorded installation, current and historical alike, because nothing in the shared vocabulary distinguishes them. The *currently* installed unit is identified by a separate SPARQL update that selects the installation with no recorded end. Its result is derived deployment state, not entailment, and it holds only for the graph on which the update last ran.

Reasoning requirements and cost. Most bridge axioms work under any rule set, but the unit-to-location relation is a property chain over the lifecycle record. OWL-Horst lacks property chains and leaves that leg of the trace silently absent; OWL 2 RL or equivalent is required. On synthetic pump stations, materialisation time grows linearly, about a quarter of a second per station on a single-board computer, and the fixed load cost is dominated by the domain ontologies rather than the bridges.

### 4.3 What the layer buys (RQ3, Papers C, D, F)

- **Querying and diagnosis** at the level of the composed system rather than one interface: dependency and impact questions the Arrowhead core services do not answer, since they exist for discovery and orchestration, not retrospective composed queries.
- **Inference** of relations nobody configured and that exist only because of how independently developed systems happen to be composed at a moment.
- **Validation** with SHACL under a closed-world reading, carried from Paper C's supply-chain setting into run-time snapshots: catching a graph that is consistent but incomplete or unsuitable. The open-world (OWL) versus closed-world (SHACL) distinction is treated as a methodological result in its own right.
- **Traceability** from a run-time observation to engineering and lifecycle information and back, extended in Paper F into a structural failure-modes-and-effects basis: a system consumes the run-time graph, runs a fixed query set, and reports dependent services, components shared across otherwise separate functions, and structural conditions such as a command issued with no feedback consumed. Severity, occurrence and detection remain the analyst's.
- **Representational form.** Paper F generates an RDF graph (AFO) and a SysML v2 model from the same deployment and evaluates both against shared CQs. RDF suited semantic integration, cross-boundary querying and reasoning; SysML v2 suited structure, interfaces and behaviour. The conclusion is complementarity, which the thesis says bounds its own claims: the case for ontologies is a case for specific capabilities, not for the formalism in general, and generating a formal description from a running system is not tied to the ontology approach.

### 4.4 How the program developed

Two initially separate strands converged. Paper A (IECON 2023) is systems engineering with no semantics: "indistinguishable twins", a digital and a physical twin of a fischertechnik factory behind the same Arrowhead services so external systems cannot tell which they talk to. Its lesson is that a useful digital representation must participate in the operational environment as a service, which motivated the run-time orientation. Papers B (SysCon 2025) and C (2026) built the semantic toolkit on hand-authored models: IDO as reference on a pump station, then OWL reasoning plus SHACL validation for supply-chain compliance (Digital Product Passport adjacent, IDO plus ChEBI). Papers D, E and F combine both strands.

## 5. Limitations the thesis states about itself

- Lifecycle stages covered are plant design, lifecycle records and run-time operation; not requirements elicitation, not decommissioning.
- Every demonstrator is laboratory scale and single organisation: a climate-control local cloud, a lab pump station, a second climate-control deployment of eleven systems and fifty services federated with the pump-station graph. No externally operated deployment.
- Cross-organisational interoperability is not evaluated, though Paper C's named graphs per business partner and the bridges' indifference to who asserted the data suggest no architectural restriction.
- Ground truth: the representations describe configured or declared state, not independently verified physical reality. Paper F states that trust in a run-time-generated representation is inseparable from trust in the pipeline that generates it, and that artifacts were checked for structural completeness rather than full semantic conformance.
- A limitation discovered only after alignment: the architecture relates three views, of which one stays current by construction and two do not. A trace is only as current as the least current model it crosses. Two further dependencies bound it the same way: "currently installed" is as current as the last update run, and the explicit correspondences reference plant-design individuals and survive only while those keep their identifiers across design revisions. The thesis notes this is the same drift it criticised in hand-maintained conversion tables, reduced in number but not made immune.

## 6. Future work, as five threads

1. Scale and external validation: richer plant structures, multiple clouds, longer maintenance histories, deployments the author did not build.
2. Reducing the manual steps: deriving the asset-to-location correspondence from commissioning records or tag conventions; deciding mechanically when a SHACL violation should reject a snapshot versus preserve an imperfect one for root-cause analysis (today a judgement call made by applying SHACL selectively).
3. Behavioural validation: joining the structural backbone to time-series observations from the running plant, moving from configured traceability to validation against what a deployment does.
4. Pipeline trust: conformance testing, assurance, and security and disclosure controls for operational knowledge graphs.
5. Standards reach: extending the run-time bridge to AAS submodels alongside AFO.

## 7. Reading the thesis's references for our purposes

Worth pulling directly: Tolk and Muguira (2003) on LCIM; ISO/DIS 23726-3 (IDO); IEC 81346-1:2022; DEXPI P&ID specification 1.4 (2024); Nagy, Wisnesky, Carlson, Subrahmanian and Zardini (2026), *A categorical approach to semantic interoperability across building lifecycle* (the thesis cites it for the linear-versus-quadratic mapping argument); Blair, Bencomo and France (2009), *Models@run.time*; Hedberg, Bajaj and Camelio (2020) on graphs linking data across the product lifecycle; Maier (1998) on architecting principles for systems of systems; Noy (2004) and Euzenat and Shvaiko (2013) on ontology alignment.

## 8. Read through the control plane

### 8.1 What "maps onto S3\*" means, concretely

`docs/ARCHITECTURE.md` gives S3\* three layers: deterministic structural checks, semantic or domain checks, and LLM judgment for residual questions; and one rule: a unit's statement about its own work certifies nothing. `packages/protocol/src/audit.ts` makes that mechanical: an evidence record is bound to a revision, an environment, an attempt and the criteria it addresses; a verdict is pass, fail or inconclusive and is derived from the records that are fresh for the revision, never from what the report says; evidence from another revision is a memory. The thesis arrives at the same three distinctions from the other direction, as properties of a graph rather than of a harness:

| Thesis | regulator | Where it bites |
| --- | --- | --- |
| **Asserted** triples: what a source (the deployment export, a hand-authored model) put in the graph | the unit's result report, and the domain output in the repository: S1's claim, routing information, never evidence | a graph a unit emits is S1 output; its `rdf:type` and `prov:` triples are self-report |
| **Entailed** triples: materialised by the reasoner from assertions plus axioms; confident and indistinguishable from assertions once merged; a wrong axiom yields a wrong but confident fact in every query that crosses it | the semantic layer of S3\*: a check that derives a conclusion from the output under declared rules (a schema, a shape, an ontology). Its provenance must say which rules, because "the correcting model never gets authority to declare its own correction successful" ([ArticleMiner note](../2026-09-25-articleminer-knowledge-production.md) §4.4) applies to axioms too | keep entailments in their own named graph; a check that reads merged entailments cannot tell what the unit asserted |
| **Derived** state: "the installation with no recorded end is the current one", produced by an update step, neither assertion nor entailment, true only for the graph the step last ran on | the technical verdict: derived mechanically from evidence fresh for the revision; evidence from another revision is a memory | the thesis names the pathology regulator's freshness rule prevents: a derivation presented as current after the thing it was derived from changed |
| **SHACL** validation, closed world: a required value that is absent is a violation | the deterministic layer of S3\*: a host-run check with a `fail` verdict | `shacl` as a domain check in the ArticleMiner workload |
| **OWL** reasoning, open world: an absent statement is unknown, not false; a graph can lack information without being inconsistent | `inconclusive`: absence of evidence is not a fail. The three-valued verdict is the open-world reading | a criterion with no fresh evidence is inconclusive, not failed; a shape violation is failed |
| Selective SHACL: whether a violation rejects a snapshot or an imperfect snapshot is kept for root-cause analysis is "a judgement call", named as future work | the recovery router under a versioned recovery policy: severity per criterion is declared, not judged, mechanism level 2 | when `shacl` ships, severity belongs in the workload definition, not in a prompt |
| Trust in a generated representation is inseparable from trust in the pipeline that generates it; artifacts were checked for structural completeness rather than semantic conformance | host-owned evidence bound to a revision of the generator; `inherited-tests` as the pattern (the base's suite judges the unit's tree) | the generator pipeline is itself S1 work under a contract; its outputs are checked by checks the generator did not write |
| Named graph per originating party (Paper C) and per snapshot time | "who or what emitted a finding, what source revision it refers to, what authority acted on it" (`AGENTS.md`, change discipline) | the RDF row of the ArticleMiner note's isolation table: a named graph per unit |
| Two graphs that share no identifier cannot be joined by any axiom; the correspondence must be asserted per entity | [#14](https://github.com/MetaCoding-io/regulator/issues/14), semantic S2: two units asserting different identity keys for the same thing | a commitment over an identity key is an asserted correspondence with an owner, not something a reconciler can infer |

So "maps onto S3\* when the work resumes" means: when the knowledge-production workload ([#61](https://github.com/MetaCoding-io/regulator/issues/61), ArticleMiner) is picked up and `shacl`, `provenance-complete` and the rest become declared domain checks, the thesis supplies, from a field with no stake in agents, the exact vocabulary those checks need: which of a graph's triples are the unit's claim (asserted), which are a rule's consequence (entailed), which are a run-bound derivation, and the rule that a violation is a fail while an absence is inconclusive. It also supplies the one pathology the catalog does not yet name (§8.3).

### 8.2 Three evidence classes for graph outputs

A `shacl` check today would observe "conforms" or "does not conform" as text with a three-valued verdict. The thesis's three-condition competency-question criterion is a better-shaped observation, and each condition is a check regulator already has an analogue for:

1. *The query executes over the instantiated graph after reasoning and returns the expected bindings.* A criterion-bound check: the expectation names the query and the expected rows, the record binds to that criterion alone (the `export-signature` pattern, and the ArticleMiner note's "let a declared check name the expectation id it observes").
2. *No source model was modified and no domain model was consulted outside the shared vocabulary.* `identity-untouched` over the protected ontology prefix (the ArticleMiner note's §3, `regulator init --protected ontology/`), plus a check that the query's named graphs are the declared ones.
3. *An inferred relation appears in the reasoner's output and not in the sources before alignment.* The check that separates entailment from self-report: run the query against the asserted graphs alone and assert it does *not* return the rows, then against asserted plus entailed and assert it does. This is the graph form of "the auditor runs the suite the executor did not write" (`inherited-tests`), and it is the check that catches a unit that wrote the conclusion into its output directly.

### 8.3 A pathology the catalog does not name

`docs/PATHOLOGIES.md` maps whole-arrangement failures to the regulators that absorb them. The thesis's late-discovered limitation is one of them: an architecture relates several views, one of which stays current by construction (generated) while the others drift (hand-maintained), and a trace across them is silently only as current as the least current view. Two sub-forms: a derivation ("currently installed") presented as current after its inputs changed; and a correspondence that referenced an identifier which a later revision renamed. In regulator's terms: a verdict read as current after the revision moved, and an authority reference that no longer resolves. The first is absorbed by freshness in `audit.ts`; the second by authority-reference resolution. Neither is in the catalog as a row, and the longitudinal form (drift of the *description* of the system rather than of the system) is the one the control room's generated figures (the "figures from the definition" thread) exist to prevent.

### 8.4 What the control plane would have to grow

Checked against the code, not the thesis.

- **Named-graph awareness in the host.** The ArticleMiner note's isolation table has an RDF row (named graph per unit; revision is a hash of the canonical serialisation; reintegrate by merging into the base graph). The thesis adds that the base must itself be partitioned by source and by snapshot time, and that entailments must never be merged into a source graph. The domain seam would need a graph-naming rule, not only a per-unit graph.
- **A `derived` provenance kind.** Memory (`packages/protocol/src/memory.ts`) records who observed a fact, from which unit, at which revision, with expiry. A derived fact needs the same plus the step that derived it and the graph revision it holds for. Whether that is a memory kind or an evidence class is a design question; the thesis says only that it is a third thing.
- **Severity per shape, declared.** When `shacl` ships as a declared command, the workload definition carries `sh:severity` to verdict mapping (violation fails, warning records), so the reject-versus-keep decision the thesis left to judgement is level 2 here.
- **Nothing for the reasoner itself.** OWL 2 RL versus OWL-Horst is a workload concern (the thesis's property-chain leg would vanish silently under Horst). The host needs to know only that the check named the rule set it ran under, which is the environment field on an evidence record.

### 8.5 What not to take

The thesis's domain (Arrowhead local clouds, pumps, P&IDs) and its standards (IDO, DEXPI, STEP) have no role here. Its ontology-alignment architecture (a reference layer with thin bridges) is interesting for [#14](https://github.com/MetaCoding-io/regulator/issues/14) only as an existence proof that cross-vocabulary commitments can be few, additive and curated; it is not a design for semantic S2. And its competency-question method is already what regulator calls a criterion with host-run evidence; the thesis adds the three-condition shape, not the idea.
