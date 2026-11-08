# Paper 1 / #113 — Pilot: VSM as a portable diagnostic vocabulary for agent harnesses

- **Status:** documentation-grounded **exploratory coding pilot**, 2026-10-18. Not peer reviewed; no developer interviews, replicated expert annotation, systematic code audits, model tests, or controlled experiment have been performed.
- **Research question:** can the VSM vocabulary describe three differently structured agent systems while making the distinction between work, coordination, management, independent audit, future-oriented intelligence and organizational authority more **inspectable** than terms such as “supervisor,” “reviewer,” or “agent”?
- **Cases:** (a) `regulator` software-development workload (local implementation, 0.1.3 documented reference); (b) OpenCode coding-agent session (official V1 documentation, as accessed on 2026-10-18); (c) CrewAI with a hierarchical `Crew` inside an optional `Flow` (official v1.15.28 documents). The CrewAI case is a **configuration of a framework**, not a claim about all CrewAI applications.
- **Research context:** [formal model #103](https://github.com/MetaCoding-io/regulator/issues/103), [prior-art review #104](https://github.com/MetaCoding-io/regulator/issues/104), [new pilot issue #113](https://github.com/MetaCoding-io/regulator/issues/113), [paper program](2026-10-18-paper-regulating-the-regulator.md).
- **Methodological warning:** Regulator was built with VSM, so it is a **positive control**, not an independent demonstration that the vocabulary is generally useful. This exercise is **hypothesis generation** and may exhibit confirmation bias. The other frameworks are broad extensible products: “not shown in the selected reference configuration” never means “not supported by the framework.”
- **No product changes requested.** This pilot does not require implementing Reflector, adding gate mechanisms to CrewAI/OpenCode, or altering the Regulator roadmap.

## 1. Unit of analysis and rubric fixed before coding

**System-in-focus:** a configured agent application doing a bounded project/workload under one operator. For Regulator this is one initialized software-development instance; for OpenCode one human-initiated coding session using default Build/Plan/subagent tools with configured permissions; for CrewAI one hierarchical research/report-writing Crew, optionally called from a Flow that defines orchestration and human review.

We code **functions and authority relations, not agent labels**. One program component can participate in several VSM functions; a feature, tool name or plausible configuration is *not* proof a function is instantiated. The S5 actor may be the same human at more than one recursion level. The meta-level means **the harness/its regulatory arrangements become the object of governance**, not merely that a Flow calls a Crew or an agent calls a subagent.

### Criteria

| Code | Question and positive evidence requirement | Common false positive |
| --- | --- | --- |
| **S1 operations** | What produces the workload's domain output? Tasks/units, allowed effects, owned outputs | “Specialized” label without an operational output |
| **S2 coordination** | Which mechanism constrains/coordinates simultaneous operations, shared resources or commitments? | Calling any “manager” S2 merely because it delegates |
| **S3 management** | What assigns work/budget, checks operational completion and intervenes when execution fails? | Treating prompting about planning as an enforced control loop |
| **S3* audit** | What checks externally observable outcomes or boundary conditions **independently of the agent's claim** at a defined revision/run? | An LLM checking its **own** answer, or tracing without a criterion |
| **S4 intelligence** | Who collects/assesses the **environment and future** to inform strategic adjustment, and through what channel? | Any browser/search/research tool regardless of consumer or future model |
| **S5 identity/policy** | What establishes persistent purpose/constraint priorities and who can authorize changes to them? | An agent role's `goal`/`backstory`; a manager delegating tasks; prompt advice alone |
| **Recursion/meta-governance** | Is the **control system itself** observed, evaluated and amendable through an explicitly authorized feedback loop? | A subagent hierarchy, cyclic graph, or trace viewer alone |

### Evidence codes

- **I — explicitly implemented in Regulator's cited checked reference configuration**, per repo documents; stronger claims require code/tests.
- **D — documented built-in/feature present in the selected comparator configuration**, without independent runtime verification.
- **C — configurable capability supported by primary documentation but **not evidenced as active** in the chosen example.**
- **H — performed by an external human/deployment process**, not as a framework enforcement claim.
- **N — not evidenced in the chosen case by the inspected sources.** NOT an assertion of feature absence.
- **M — mixed or conditional:** some of the function is documented, stronger interpretation unsupported or depends on an assumption.

All status codes are **within the chosen system-in-focus**, not global ratings of software quality. Do not add the letters together into a “VSM completeness score.”

## 2. Primary evidence references (frozen documentary snapshot)

### Regulator (reference case)

- [Repository `ROADMAP.md`](../../ROADMAP.md): completed 0.1 scope, #46 live-baseline limitation, 0.2 work, Reflector as *designed*, not implemented.
- [`AGENTS.md`](../../AGENTS.md): the declared S1–S5/S3* boundaries; orchestrator, store and owner rules.
- [Evidence about the regulators](../concepts/evidence-about-the-regulators.md): one-level-up eval arms, ablation, registry/retirement, interpretation, and the distinction between unit checks and regulatory evidence.
- [Definition and instance](../concepts/definition-and-instance.md): which entity writes/reads each store, what an instance copies, and how authorized identity differs from operational outputs.
- [Reflector design](2026-10-18-harness2-recursive-harnessing.md) §§7–8 and [accept-path design](2026-10-18-accept-path-split.md): proposed meta-level intelligence/change pathway, not shipped.

### OpenCode (official primary documentation, V1 docs as accessed)

- [Agents and subagents](https://docs.opencode.ai/docs/agents/): Build/Plan, read-only Explore/Scout, tool-task permissions, primary/subagent distinction.
- [Tool permissions](https://docs.opencode.ai/docs/permissions/): `allow | ask | deny`, glob/path/command constraints; explicit default behavior and limitations of a permission policy.
- [Plugins and hooks](https://docs.opencode.ai/docs/plugins/): tool-call pre/post hooks, session/permission events and custom plugins.
- [Rules / project instructions](https://docs.opencode.ai/docs/rules/): `AGENTS.md` and other instructional context. Distinguish advice from tool permissions.
- **Version caveat:** OpenCode is transitioning to a V2 surface; [V2 permission documentation](https://dev.opencode.ai/v2/docs/permissions/) uses different `permissions/shell/subagent` fields. This pilot deliberately cites V1 consistently rather than silently mixing versions. Rerun the map for an exact release and configuration before publication.

### CrewAI (official v1.15.28 primary documentation as accessed)

- [Agents](https://docs.crewai.com/v1.15.28/en/concepts/agents): role, goal, backstory, tools, delegation, execution budgets. A role is not automatically a VSM system function.
- [Crews and hierarchical management](https://docs.crewai.com/v1.15.28/en/concepts/crews), [Processes](https://docs.crewai.com/v1.15.28/en/concepts/processes): task sequencing and optional manager-agent/manager-LLM.
- [Tasks and guardrails](https://docs.crewai.com/v1.15.28/en/concepts/tasks): both Python-function guards and LLM-based guards; their evidentiary independence is **not the same**.
- [Flows and persistence](https://docs.crewai.com/v1.15.28/en/concepts/flows): event-driven orchestration, state persistence, conditional execution.
- [Human-in-the-loop](https://docs.crewai.com/v1.15.28/en/learn/human-in-the-loop): optional human feedback for tasks/Flows; not necessarily framework configuration/identity change authority.
- [Testing](https://docs.crewai.com/v1.15.28/en/concepts/testing): CLI multiple-execution evaluation exists, but the availability of run scores alone does not make checks revision-bound independent S3*.

## 3. First pass: the function map

The text after each code says **what is evidenced in the fixed application** rather than what the framework could theoretically be made to do. The Regulator column is based on its own documentation and should not be treated as independently audited.

| Function | Regulator (software workload) | OpenCode (default coding session) | CrewAI (hierarchical Crew ± Flow) |
| --- | --- | --- | --- |
| **S1** | **I** — typed operational units, work contracts, profiles; results in domain repo | **D** — Build agent performs edits/commands; subagents complete bounded tasks | **D** — researcher/writer task agents produce task outputs, using tools |
| **S2** | **I** — leases, worktree coordination/reintegration, anti-thrash, typed tool and effects contracts | **M** — primary/subagent task permissions and session hierarchy coordinate delegation; no claim of default lease/worktree semantic coordination | **D** — crew process orders task execution and passes task context; Flow events coordinate boundaries. Parallel/shared-resource semantics must be separately checked |
| **S3** | **I** — explicit contract → dispatch → host verify → route/recover → close, budgets and obligations | **M** — session/agent executes tool loop, subagent orchestration and permission decisions; no independent S3 control-plane role is inferred merely from “Build agent” | **D** — hierarchical manager allocates work/reviews outputs; Flow route and state transitions can manage intertask progression |
| **S3*** | **I** — host-owned checks and technical verdict tied to revision, distinct from S1 result claims; limits documented | **C/N** — plugin hooks and tool events permit independent external checks, but no configured revision-bound criterion in this default case is evidenced | **M** — callable task guards can check output by code; LLM string guards use the assigned agent's LLM and do **not** alone establish independent evidence; `crewai test` is evaluation but not a shown host-bound criterion gate |
| **S4** | **I/M** — demand-triggered `research`/`report_intelligence` routes intelligence to obligations; continuing anticipatory meta-S4 remains proposed | **M** — Scout and Explore can research environment/dependencies, but no default persistent future-oriented strategic signal to governance is evidenced | **M** — research agent can observe external environment, yet in this example its research is **domain output** (S1); strategic intelligence requires a named recipient, decision and update channel |
| **S5** | **I/H** — instance identity and invariants are checked files; `identity accept` is typed authorized change; `--by` actor authentication is external | **H/D** — human/project controls `AGENTS.md` instructions and permission config; permission engine enforces configured tools; standard role labels are not policy decision-makers | **H/C** — human authors crew/Flow goals, tools and process; optional HITL feedback is supported, but is not by itself versioned harness policy-authority governance |
| **Meta-recursion** | **M** — eval/ablation and human lifecycle-review of regulators exist; Reflector-driven proposals/probes/accepted advice and live-resolution are **designed, not shipped** | **N/C** — hooks/events permit extension, but ordinary subagent invocation, compaction and session logs do not themselves demonstrate a separate governance loop over tool grants/rules | **N/C** — nesting Crew within Flow allows hierarchy/orchestration, but does not by itself show the *rules managing that Flow/Crew* being evaluated and changed through an authorized feedback loop |

**Source constraints:** This map is based on official product docs and Regulator repo artifacts, *not* a code-level comparison or an installation probe. In the two comparator cases, features described as configurable (C) must not be converted into “framework cannot.” Different configuration choices would legitimately yield different rows.

## 4. Diagnostic yield: where functional vocabulary changes the question

### D1. CrewAI “manager” is not necessarily S5

A hierarchical crew manager delegates tasks and evaluates execution in a crew. That is principally **S3** in the specified system-in-focus. The *person creating the crew configuration*, or the organization's authorized owner of objectives, is the more plausible locus of S5. A managerial **agent role** is not automatically an identity/constitutional authority. The VSM vocabulary makes that distinction more precise than the word *manager* alone. ([CrewAI Processes](https://docs.crewai.com/v1.15.28/en/concepts/processes))

**Countercheck:** An application could give a manager formal policy-change authority; then it performs an S5-relevant function too. Our coding is about the chosen configuration and its documented authority, not the class name.

### D2. A guardrail is not automatically independent audit (S3*)

A CrewAI **function-based** output validator can perform checks independent of the task agent's self-report, depending on where the data originates, when it runs and whether it measures the actual artifact. A **string-based LLM guardrail using the same agent's LLM** is an additional judgment step, not necessarily independent audit. Both are called guardrails. Regulator's reference requires host-produced, revision-bound technical evidence; OpenCode provides hooks that can implement independent checking but cannot be assumed to do so in a default session.

The diagnostic question is **who evaluates which artifact, with which mechanism, and whose outcome can it overrule?** This distinguishes quality review, deterministic conformance, and independent technical audit without alleging other frameworks cannot support the latter. ([CrewAI Tasks](https://docs.crewai.com/v1.15.28/en/concepts/tasks), [OpenCode Plugins](https://docs.opencode.ai/docs/plugins/))

**Added 2026-10-25.** A documented countercase from a different tradition: Lanham (*AI Agents in Action*, 2nd ed., §7.3.3) builds a grounding guardrail whose agent reads the task agent's context through a tool over a global the task agent filled, on the same model, and the book's own §7.1 sidebar names the consequence (an evaluator sharing the unit's model shares its blind spots and "validates the same hallucinations"; an evaluation layer that colludes is worse than none). Hur and Song's `LoopWorkflow` (*Build an AI Agent (From Scratch)*, §9.3) is the same shape: a reviewer agent on the writer's model, in the shared context, with a code `stop_condition` that reads the reviewer's score. Both are guardrails by name; neither is S3*. The diagnostic question above separates them without any claim about the frameworks.

### D3. Advice and enforced authority are not interchangeable

OpenCode's `AGENTS.md` instructions, agent-specific prompts, and permission rules are different kinds of influence on behavior. A human-written rule in a prompt is not identical to a tool permission that can refuse an action. CrewAI's role/goal/backstory similarly shape behavior but do not on their own establish protected S5 authority. Regulator's “prompts advise, types describe, gates enforce” is an implementation of a more general vocabulary distinction, **not proof that competing frameworks lack gates**. ([OpenCode Rules](https://docs.opencode.ai/docs/rules/), [Permissions](https://docs.opencode.ai/docs/permissions/), [CrewAI Agents](https://docs.crewai.com/v1.15.28/en/concepts/agents))

### D4. “Research agent” can be S1, S4, or both depending on the output consumer

A CrewAI researcher collecting evidence for a user-facing report is acting operationally at **S1**; a Regulator research unit contributes an **S4** function when it emits typed intelligence about environmental change that reaches a managerial decision path. A tool named `search` or an agent named `research` does not establish S4. A component may have both roles at different times, so force-fitting exclusive class labels creates false precision.

### D5. Nested workflows do not prove recursive governance

CrewAI's Flow may call a Crew, and OpenCode can delegate to child sessions. Those are **execution/delegation recursions**, not necessarily the *governance* recursion in which the control system's own constraints and evidence mechanisms become objects of examination, modification and authority. Regulator already ablates and reviews regulators; the proposed Reflector is one possible S4 contributor at the higher level. Distinguishing these two kinds of recursion appears to be a portable conceptual benefit worth testing.

## 5. Negative cases: when VSM adds little or can mislead

1. **Simple sequential single-agent script:** If a small coding tool has no independent concurrent units and changes are reviewed in a normal PR, decomposing into “five internal subsystems” can be needlessly baroque. S1/S5 may be adequate to describe it; S2/S4 need not become extra agents.
2. **Existing policy engine with well-defined decision and enforcement points:** Ordinary access-control language may express a tool permission more precisely than naming it “S5.” VSM is not a substitute for an actual authorization standard.
3. **Overly rigid S3* interpretation:** A purely deterministic output guardrail can be valuable without the full Regulator evidence schema; calling it “not S3*” should not imply it is worthless.
4. **Ambiguous system boundary:** The same “researcher” might be S4 when looking one level above a coding team, but S1 when writing a report for a customer. Without declaring the system-in-focus **before** coding, the vocabulary can produce contradictory labels.
5. **Framework versus application conflation:** OpenCode and CrewAI allow extensive plugins/custom tools. A pilot cannot conclude that a function is *impossible* just because the reference configuration does not document it.

## 6. Comparison with an alternative vocabulary: MAPE-K

This is a **conceptual dual coding**, not a controlled evaluation. A MAPE-K analyst could make most of the following observations using its monitor/analyze/plan/execute/knowledge categories plus explicit policy descriptions:

| Cross-cutting issue | MAPE-K framing | VSM framing | Tentative incremental diagnostic value |
| --- | --- | --- | --- |
| Agent produces artifact | Execute + managed element | S1 operational component | Usually small; merely renaming execution adds little |
| Manager assigns task and handles retries | Plan/Execute | S3 managerial regulation | Moderate when separating operational coordination from higher-level policy |
| Tool permission guard | Policy constraint on Execute | S5 policy **expressed through** S3/S2 mechanism | Small if policy-engine vocabulary already specifies owners and enforcement |
| Independent post-execution check | Monitor/Analyze with independent observer | Explicit S3* audit channel | Potentially useful **prompt to ask about independence and evidentiary status**, not proof MAPE-K lacks it |
| Conflicting parallel subagents | Resource/coordination logic in Execute/Plan | Explicit S2 horizontal coordination problem | Potentially useful distinction, contingent on workload |
| External future-facing intelligence | Monitor/Analyze over environment | S4 concerned with outside/then | Helps distinguish operational telemetry from future and environmental change, but MAPE-K can do this too |
| Who defines/changes system identity? | Human policy/objectives, governance around autonomic manager | Explicit S5 identity/authority function | Helps ask whether purpose/acceptance changes are distinct from task planning; ordinary governance models can ask too |
| Improve the harness itself | Higher-order MAPE-K supervising lower-order loops | Higher recursive VSM system-in-focus | Similar design space; distinctive VSM value must be demonstrated, not asserted |

**Provisional conclusion:** a VSM function vocabulary may help authors make *hidden obligations* explicit, especially S2, S3* and S5, but cannot claim to be the only or inherently superior language. MAPE-K can be extended with organizational governance and independent audit. The paper should compare **what is easier to see or describe**, not whether other approaches are philosophically incapable of expressing it.

**Added 2026-10-25.** One piece of evidence for the conclusion from plain production vocabulary: Lanham §8.4.6 arrives at the advice/enforcement line and versioned policy with no cybernetic framing at all ("policies are best enforced outside the agents themselves where they can be audited"; a policy registry of machine-enforceable rules; "log overrides with reason codes"; a policy in a prompt leaves "no record of which policy version was active when a decision was made"). The distinction D3 draws is reachable without VSM, which supports the modest reading here: the vocabulary's value, if any, is in making the obligation *expected*, not in making it expressible.

## 7. From pilot to evidence: suggested follow-on test

A future small independent *practitioner coding study* could estimate whether the vocabulary actually improves analysis.

- **Study material:** three short, vendor-neutral architecture vignettes modeled on distinct real designs (one single-agent coding system, one role-based crew, one regulated workflow), with seeded but independently checkable questions about writer authority, review independence, horizontal interference, and harness self-change. Preserve the underlying truthful configuration.
- **Conditions:** VSM rubric with example glossary vs MAPE-K rubric vs conventional architecture/agent terminology. Avoid straw-man baseline: give each group equivalent time and appropriately detailed instructions. Participants should not know which vocabulary the authors developed.
- **Measurements:** time-to-identify concrete authority ambiguities; precision and recall for *predefined* missing responsibilities/unsafe paths; false alarms; inter-rater agreement per concept; clarity and cognitive burden reported by participants.
- **Pre-registration:** define ground-truth tasks and scoring before showing subjects the cases. Account for familiarity with VSM, years of experience and order effects. Include at least one negative case where elaborate VSM mapping offers no improvement.
- **Interpretation:** if VSM improves clarity but not accuracy, or is too hard for novices, both are reportable outcomes. This should be a *study-design proposal* rather than a claimed result. Recruitment/ethics/privacy rules would need review before any actual human-subject research.

An immediate **non-human pilot** is also possible: have two researchers independently code the same six evidence passages with a rubric, report disagreements and refine definitions. This is not a substitute for independent practitioner data.

## 8. Interim result and targeted next edits

**Result of the documentation-based first pass:** the vocabulary is *applicable* across three unlike systems and yields at least five candidate distinctions (manager != S5; guardrail != independent S3*; prompt != enforced policy; research role != S4; hierarchy != governance recursion). It does **not** establish that these distinctions are unique to VSM or empirically useful to practitioners. Nor does it prove any framework is lacking a feature.

Before including this as journal evidence:

1. Pin exact released revisions of OpenCode and CrewAI, inspect relevant source paths and at least one runnable sample configuration in each. Current source base is documentation only.
2. Independently recode the cases, publish disagreements, and revise the rubric to handle multi-function components without coding by name.
3. Try to build the *same* governance demonstration with existing OpenCode/CrewAI primitives; measure how much additional machinery is needed, not a subjective completeness score.
4. Compare output from an impartial MAPE-K analyst and seek adversarial review of all framework claims. Where a competing system already solves the problem, revise the novelty argument accordingly.
5. Keep Regulator's implementation advantage/positive-control status explicit; do not treat the cross-framework mapping as an endorsement of Regulator.

**No software implementation or governance change follows automatically from this exploratory mapping.**

## 9. Two further cases from full source (added 2026-10-25)

Two books read in full for the [agent-engineering books note](2026-10-25-agent-engineering-books.md)
supply cases the first pass lacked. Unlike OpenCode and CrewAI, both come with complete
source in the book, so the "documentation only" caveat of §3 does not apply to them, and
the first is close to what a course learner builds. Coded under §1's rubric by one coder,
not yet independently recoded (§8 item 2 applies).

**Case (d): `scratch_agents`** (Hur and Song, *Build an AI Agent (From Scratch)*,
Manning 2026, chapters 4–9), configured as its chapter 9 multi-agent examples:

| Function | Code | Evidence |
| --- | --- | --- |
| **S1** | **D** | one role and tool set per agent (§9.3); effects are undeclared, and two gateway tools (`execute_python`, `bash_tool`, §8.5.5) carry arbitrary execution |
| **S2** | **N** | `ParallelWorkflow` merges concurrent agents' events into one context (§9.3.3); no lease, no resource isolation, no commitment between agents |
| **S3** | **M** | an orchestrator agent delegates by description (§9.4, §9.5); `max_steps` and `max_iterations` are the only budgets, and a child's steps are not counted against the parent's |
| **S3\*** | **N/M** | `LoopWorkflow`'s reviewer is the same model in the shared context scoring the writer; `stop_condition` is code but reads the model's score (§9.3.4) — D2 again. Chapter 10's evaluation is offline over a dataset, not a gate at a revision |
| **S4** | **N** | no channel from environment or future to anything that decides |
| **S5** | **H** | instructions are strings the developer writes; nothing is protected, versioned or authorized |
| **Recursion** | **N** | the quality flywheel (§10.4.2) is a developer process, not a loop the system runs |

Two consequences for open issues, recorded there: an A2A agent card (§9.6.1) is a
discovery record (name, description, url, capabilities) and not a commitment in #14's
sense; and `RemoteAgent.run` (§9.6.3) returns one text and an unchanged context, so an
A2A-backed dispatcher would write none of the five records the host read-back table
requires and would declare all eleven concerns unimplemented — the lower bound for #58.

**Case (e): the three loop layers** (Lanham, *AI Agents in Action*, 2nd ed., Manning
2026, §9.1–9.3, listings 9.5 and 9.8). The book names an L1 inner loop inside the agent,
an L2 task loop where goal, plan, state and decision are in code and "the tool is the
agent itself", and an L3 meta loop where an agent controls the loop. L2 codes as S3 in
code (**M**: budgets and a decision point exist; no contract, no evidence bound to a
revision), S3* as **N** (`goal_satisfied` is the unit's own flag; the book concedes the
bias and proposes a second LLM agent, which is D2's string guard), S2 as **N**. L3 codes
as execution recursion, D5's exact negative: an agent that dispatches agents, with
nothing examining or amending the rules it runs under. Regulator's reflector (Harness²
note §7) is neither L2 nor L3, because it holds none of decide, state or schedule; it
proposes.

**What the two cases add to the pilot's claims.** D2 and D5 each gain a worked instance
with source, which is the kind of evidence §8 item 1 asks for. Nothing here changes the
methodological warning: both cases were coded by a reader who knows regulator, and the
codings should be recoded before they are cited as more than illustration.
