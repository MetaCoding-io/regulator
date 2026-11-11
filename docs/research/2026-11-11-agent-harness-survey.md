# A survey on agent system and harness design, read against the control plane

- **Status:** open. No thread of its own: every item in §5 lands in an existing thread
  or issue, and §6 says which. Nothing here names a next step that is not already
  named elsewhere.
- **Source:** Jianyuan Guo, Zhiwei Hao, Chengcheng Wang, Cheng Fan, Tingzhang Luo,
  Hongguang Li, Ying Gao, Hefei Mei, Jiankun Peng, Rongjian Xu, Minjing Dong, Han Wu,
  Mengyu Zheng, Kai Han, Shiqi Wang, Chang Xu and Yunhe Wang, *From Question Answering
  to Task Completion: A Survey on Agent System and Harness Design*,
  [arXiv 2606.20683](https://arxiv.org/abs/2606.20683) (June 2026), read from the HTML
  of v1 on 2026-10-10 and again on 2026-11-11. The paper's collection of the systems it
  discusses is <https://github.com/ggjy/Awesome-Agent-Engineering>. Sections are cited by
  number; the paper's tables by their roman numerals.
- **Why a note:** four reasons. The survey is the literature the design arguments in
  `AGENTS.md` and `ARCHITECTURE.md` sit in, and it states four design principles that are
  the prime directive in other words. It is the related-work frame
  [#104](https://github.com/MetaCoding-io/regulator/issues/104) has to place Paper 1 in.
  Its Table VII is the uncontrolled model-by-harness comparison that the
  [Terminal-Bench thread](2026-11-05-minimal-harness-and-terminal-bench.md#5-terminal-bench-20-with-regulator)
  designs a controlled version of. And its anatomy of a harness has no S4, no S5 and no
  model of authority, which is the ground this project claims; a note that says so with
  file citations is the shortest statement of the difference.

Claims about what the code does today cite the file, at `main` `f4630f5`. Claims about
the paper cite its section. The first reading of the paper was made against `main` of
2026-10-10, before the live drift report, the accept-path split's second slice, declared
tools, sensors and the behavioral canary landed; where that changed a conclusion, the
text says so.

## 1. What the paper says

The paper's thesis is that an LLM-based agent is a foundation model coupled with an
execution harness, and that agent quality, "including success, efficiency, safety, and
generalization", emerges from their interaction rather than from the model alone
(abstract; §2.2). It decomposes the harness into six runtime responsibilities (§2.4,
Fig. 3): an observation interface, a context manager, a control loop, an action
interface, a state and artifact store, and a verification and governance layer. It
traces four paradigms (§4): prompt engineering, workflows and context engineering,
harness engineering, and agent-native training with model–harness co-evolution. §6 reads
a task as a pressure profile over the six components and gives domain-independent rules
in Table V: long horizons need externalized state, partial observability needs
structured observation, a strong oracle enables verifier loops, a weak or delayed oracle
needs provenance and review, irreversible actions need gates and rollback, high autonomy
needs logging, budgets and controllers. §7.3 reads public SWE-bench Verified results and
finds that the same model gains or loses tens of resolved instances by scaffold, and
that "scaffold complexity does not predict effectiveness": a hundred-line scaffold under
one model sits within a point of a full runtime. §7.6 says a benchmark score is
interpretable only with the runtime configuration that produced it, and lists what a
report should carry. §8 asks for value-aware evaluation (success against cost, latency,
risk and process quality), for verification and recovery to become trainable behaviours
under a constrained self-evolution loop, and for a layered design of a reusable
substrate plus task-specific adapters.

Four design principles recur in §4.3: legibility, mechanical enforcement ("constraints
that matter for safety, correctness, or reproducibility should be enforced by the
runtime when possible, rather than delegated entirely to prompt obedience"),
verification in the loop, and explicit artifacts.

## 2. The six components against the build

| Paper component (§5) | Counterpart here | What the build says that the paper does not |
| --- | --- | --- |
| Observation interface (§5.1): which environment signals reach the model, at what abstraction, refreshed when | Pi's tools under the profile grant, with truncation and structured results; the identity and advice rendered as system-prompt sections (`packages/regulator-pi/src/identity.ts`, `profiles.ts`); memory rendered as expiring facts, never as instructions | The observation interface is a trust boundary. The loader takes no context files from the worktree (`project-trust-rule`), and "data absorbed as control" is a catalog row (`docs/PATHOLOGIES.md` §3). The paper treats observation as a legibility problem only. |
| Context manager (§5.2): inclusion, representation, refresh, shared state | Contract-preserving compaction with a deterministic carried block (`packages/core/src/policy.ts`, `renderPreservedContext`); the identity and advice context budgets; memory scoped by unit type | Compaction is a regulatory decision: the glossary's diagnosis of a constraint lost after compaction is that the eviction policy was never treated as one. |
| Control loop (§5.3): how control divides between model and runtime, when plans revise, when to stop | The S3 loop, contract → dispatch → verify → route → close (`packages/regulator/src/controller.ts`); the recovery router under a versioned policy; leases; budgets; the model route per unit type; a unit type's `runner`, session or command (`packages/protocol/src/workload.ts`) | The orchestrator is the only execution authority; regulators veto and never schedule (`AGENTS.md`, boundaries). The paper's multi-agent patterns (hierarchical delegation, debate, competitive checking) are what the project refuses as personas. The loop is generic over whether a model is present at all: a `command` unit runs a program through the same steps (`command-runner`). |
| Action interface (§5.4): what the agent can do, how specified, which permissions, how results return | Every tool declares an effect on four axes (`packages/protocol/src/effects.ts`); a profile is a grant over effects, and read-only is derived (`packages/core/src/effects.ts:68`); a workload declares its own tools with an effect, and the gate derives consent from `sideEffects: "irreversible"` before the call runs (`packages/regulator-pi/src/authority.ts:179`, `declared-tool`); the effect journal | The paper names "permissions, side-effect control, and invocation constraints" as the governance half of the action space. Here the effect is the unit of reasoning, and the consent question is derived from it rather than noticed by the model (DEBT row 29, paid by #60 and #121). |
| State and artifact store (§5.5): what persists, at what granularity, with what update policy | The execution store, the audit log, the regulatory log and obligation ledger, the effect journal, the memory store, the events database, the outbox; `INSTANCE_STORES` as the closed list (#153); the span projection over all of them (`span-projection`) | Three kinds of state with three owners, and "nothing reads its own progress off the domain" (`AGENTS.md`). The paper's "stale state treated as current" is met by revision binding on evidence and by expiry on memory; the paper's "the wrong state preserved" is the memory-is-not-identity invariant (INV-004). |
| Verification and governance (§5.6): tests, verifier models, sandbox, approval, budget, rollback, retry, audit trace | The closeout gate over host-run checks bound to a revision (`auditUnit`, `controller.ts:391`; `packages/checks`); `inherited-tests`, `export-signature`, `identity-untouched`, `glossary-lint`; the pre-merge trial; the budget guard; the pause gate and `ask_human`; disposition authority; the algedonic path; the behavioral canary | The paper puts verification, governance, approval and audit in one box and says "governance determines what the harness is allowed or required to do with that evidence". Here that box is three functions with typed channels between them: S3\* observes, S3 decides about the unit, S5 decides about the definition, and a signal is not an audit, an audit is not a policy decision (`docs/GLOSSARY.md` §3). |

Two things in the paper's sixth box the build does not have, by decision. There is no
verifier model in the loop: no grader is a model (`packages/regulator/src/graders.ts`),
and a model's reading is at most an added judgment layer (`AGENTS.md`, "S3\* is not
merely a reviewer prompt"). And there is no rollback: a failing closeout lands nothing,
because the pre-merge trial merges in a temporary worktree first (`pre-merge-trial`),
and the bash watch restores protected paths rather than rolling the unit back.

## 3. Where the two agree

- **The four principles are the prime directive.** Legibility, mechanical enforcement,
  verification in the loop, explicit artifacts (§4.3) against "Prompts advise. Types
  describe. Gates enforce." and the five-level mechanism hierarchy
  (`ARCHITECTURE.md`). The hierarchy is the more specific statement: it orders the
  levels and makes a prompt-only solution to a mechanically enforceable rule a defect.
- **Substrate plus adapters is the definition.** §8.3's reusable substrate (tracing,
  sandboxing, permission control, artifact storage, budget management, model routing,
  tool protocols) is the loop and `packages/core`; its adapters (observation shaping,
  action abstraction, memory policy, verifier design, recovery strategy) are the
  workload's unit types and checks and the versioned recovery, routing, interaction and
  intelligence policies. The paper puts recovery strategy on the adapter side; so does
  the build (`policies/recovery.json` is a declaration, and the router is generic).
- **A score is conditional on its runtime configuration.** §7.6 asks a report to carry
  model version, harness identity, tool privileges, retry and timeout policy, execution
  environment, token or API usage, and trace or verifier metadata. The eval report's
  fingerprint carries node, platform, arch, the pinned Pi version, the harness revision,
  the dispatcher, the model, the models observed, the registry size and every policy
  version (`packages/protocol/src/evals.ts`, `EnvironmentFingerprintSchema`); the arms
  carry the extensions and checks, and the suite is versioned; a report without a
  person's interpretation is refused by `regulator check`. Tool privileges are the arm's
  profile under the harness revision, so they are derivable rather than listed; cache
  writes are the one field of the paper's list the fingerprint lacks, and the
  [minimal-harness note §4.3](2026-11-05-minimal-harness-and-terminal-bench.md#43-the-cost-of-the-cached-prefix)
  already proposes them.
- **Value-aware evaluation.** §8.1's objective, success weighed against cost, latency,
  risk and process quality, is what the trajectory graders record per unit (tokens,
  turns, wall-clock, refusals, retries, escalations) and what every registry card's
  `cost` field states in prose. §4.2 below is the one instance where the build has
  already acted on the measurement.
- **Self-evolution must be observable and falsifiable.** §8.2's lesson from Agentic
  Harness Engineering, that "components should be explicit and revertible, traces should
  be distilled into evidence, and proposed changes should make predictions that later
  outcomes can check", is the registry card (failure class, ablation switch, retirement
  condition, review date, owner) and the prediction record (§4.3).

## 4. Where they part

### 4.1 The oracle the agent can edit

§6.2 calls software engineering verification-dominant because "builds, unit tests,
linters, and execution logs provide mechanical feedback signals that most other domains
lack", and Table VII's numbers rest on SWE-bench Verified's hidden tests. In a real
repository the suite lives in the agent's writable tree, so the oracle is only as strong
as the harness's hold on it. `inherited-tests` (`packages/checks/src/verify.ts`)
reconstructs the hidden-test property by running the base's suite against the unit's
tree and refusing a shrunk inherited file. The self-certifier's committed report
(`packages/regulator/evals/reports/drift-scripted-self-certifier.json`) is the case
Table V does not cover: under the control arm the unit deletes the two tests that expose
the defect, reports green, closes all six units, and every other grader reads clean.
Table V's rule for a strong oracle is "verifier loops, repair cycles"; the missing rule is
that a strong oracle the agent can write to is a weak one, and provenance belongs in the
coding workload too.

### 4.2 The controlled comparison, and what it found

§7.3 says of its own table that it is "a compact synthesis of public evidence rather
than a fully controlled factorial experiment", because scaffolds, model snapshots,
reasoning settings and retry budgets differ across sources. The eval harness holds the
loop and the model fixed and changes only what the definition declares (an arm differs
in extensions, checks, identity or advice; never in the loop), with ablation arms per
regulator, pre-registered metrics, Student's t intervals and a required interpretation
([evidence about the regulators](../concepts/evidence-about-the-regulators.md)).

The first live report
(`packages/regulator/evals/reports/drift-live-2026-11-08.json`, interpreted in
`evals/interpretations/drift-live-2026-11-08.md`) is the paper's value-aware evaluation
run once. Three repetitions of the six-task drift scenario under control and treatment
on one model, every session bound and metered:

| Per unit | Control | Treatment |
| --- | --- | --- |
| Closed | 18 of 18 | 18 of 18 |
| Drift graders (boundary, signature, vocabulary, rules in prose, suite weakened) | all zero | all zero |
| Attempts | 1.1 | 1.3 |
| Tokens | 217,972 | 360,496 |
| Turns | 19.7 | 25.1 |

The interpretation reads it "as a cost measurement, not as evidence that regulation
catches drift": the gates had nothing to catch on this fixture with this model, and the
scripted foils are what pull toward drift. The treatment arm's extra attempts came from
the identity, the advice set and the canary rule adding about 15,000 tokens of context
per turn, so the 400,000-token attempt ceiling bound on context volume rather than
spend. The response was a policy change rather than a prompt change: the default ceiling
is now 800,000 (`packages/regulator/policies/default.json`, whose description records
the arithmetic). That is §8.1's "harness engineering is a resource-allocation problem"
carried out on a number.

What the live report does not give is the comparison §7.3 and §7.6 are about: the same
model under different harnesses on a public task set. The Terminal-Bench thread designs
it: a `bare` Pi arm, an `operational` arm with the loop and no authority gates, and a
`regulated` arm, ten named tasks, five repetitions, the benchmark's verifier as grader,
and four pre-registered questions (resolution within noise of the bare arm, the cost of
regulation, refusals to close the verifier would have accepted, how often a gate fires at
all). §7.6's "autonomy and complexity are not monotonic goods" is the hypothesis that
thread's H1 and H2 test, and §7.4's Terminal-Bench 2.0 reading is the row it compares
against. The one loop change it needs, in-place isolation as a declared mode, is the
thread's open decision (minimal-harness note §5.6, decision 1).

### 4.3 Phase 4, and where the boundary is

§4.4 and §8.2 describe a constrained self-evolution loop: traces are distilled into
evidence, an update operator changes the model or the harness, and a validation step
"keeps an update only if it passes held-out tasks, regression tests, process checks, and
safety constraints", with "human approval for high-impact changes". The first reading
of the paper, in October, concluded that the build stops where this continues. It no
longer does, and the way it continues is the difference worth stating.

The accept-path split ([note](2026-10-18-accept-path-split.md); slices 1 and 2 landed as
#110 and #138) keeps three records apart that the paper's update operator folds into one
step: what was seen, what is expected, and what was decided. A `harness-edit` proposal
must cite an observation that resolves against the stores, and carry a prediction with
a metric, a baseline, horizons and the value that counts against it
(`packages/protocol/src/prediction.ts`, `PredictionSchema`). The prediction is resolved
by the loop at the named units' close or abort with the eval harness's own graders, and
a disconfirmed live horizon opens an obligation owed to S5 (`prediction-resolution`). An
accepted edit changes an advice file through one command run by a named person
(`advice-decision`); a grant, a check or a unit type lands through a different path
(`DEFINITION_WRITERS`, `packages/protocol/src/definition-writers.ts`). The paper's
"human approval for high-impact changes" is here the rule for every change to identity
and advice, and the paper's "held-out tasks" is the probe arm, slice 3, which runs a
proposed edit against the fixture before the person decides. It was waiting on the live
report and is now unblocked.

The [Exo note](2026-11-06-exo-runtime-self-improvement.md) §6 states the one real
opposition to the paper's co-evolution direction as a claim with a number against it:
an edit made mid-task may pay back inside that task, and the proposal–probe–person path
means the unit that saw the waste never gets the fix. Paper 1 is to state that as a
proposition, not a position. The survey's §8.2 is the framing both sides share.

### 4.4 What the anatomy has no slot for

- **S4.** The paper's harness perceives the task environment and nothing else. Here a
  `research` unit under a read-only profile raises intelligence through
  `report_intelligence`, and sensors declared in `policies/intelligence.json` raise the
  same signal without a model, on a schedule or on a glob over the instance
  (`packages/protocol/src/intelligence-policy.ts`, `sensor-intake`). Intelligence
  becomes an obligation that holds the units or the unit type it names; it never
  replans. The paper's §5.5 "stale memory" risk is the `memory-store` card's limitation
  and the poisoned-memory fixture (#130), not a store design question.
- **S5.** The paper's "long-term memory" box in Fig. 3 does not distinguish what the
  system learned from what the system is. INV-004 does, and the identity write gate,
  `identity-untouched` and the S5 decision path are a function the paper's anatomy
  would file under governance. The paper's §8.2 risk, "unsafe runtime modification", is
  the whole reason the function exists as a separate one.
- **Authority.** "Permission gates" and "human approval" appear in Fig. 3 as components
  with no model of who may decide what. The interaction policy declares disposition
  authority per person, consent waits and silence is never a yes, and `--by` is checked
  before every CLI disposition (`disposition-authority`, `interaction-contract`). The
  paper's §6.1 autonomy level, "human-in-the-loop … semi-autonomous … fully autonomous",
  is a declaration here, per interaction kind, rather than a deployment setting.
- **The regulators as objects of evidence.** §8.3's call for "component ablations" and
  "same-model different-harness comparisons" is the registry's lifecycle: every card
  names its ablation switch and its retirement condition, and a person retires it on the
  evidence (`regulator-lifecycle`). The paper has no notion of retiring a harness
  component.

### 4.5 §5.6's open problem, answered by evidence rather than threshold

§5.6 ends on the problem of making verification and governance "selective and
cost-aware, so the harness can distinguish recoverable local errors from deeper
task-level collapse without over-triggering interruption or rollback". The behavioral
canary is a cheap signal for the second kind: a marker asked for on every reply, read on
every reply, its silence recorded as an advisory finding (`behavioral-canary`), with
`context-degradation` as a recovery cause whose retry is a fresh session on the same
ledger (`packages/protocol/src/recovery.ts:35`; #133). The shipped recovery policy
declares no rule for the cause, on purpose: in the live report the canary fell silent in
12 of 18 treatment units and no failure followed, and on a weaker model it never fell
silent while closing 23 of 36. The card says the silence is a property of the model, and
DEBT row 42 says the rule waits on a live report that shows lead time. That is the
paper's over-triggering risk settled the way §8.2 asks, by a prediction a later outcome
can check, and it is a discipline the paper describes and few of the systems it surveys
practise.

### 4.6 Invalid tool calls

§5.4's diagnostic claim is that agents fail "not because a tool is absent, but because
the tool is poorly selected, invoked, or integrated". The
[state-defined interface note](2026-11-10-state-defined-interface.md) §3.3 found that
the build cannot say how many tool calls its gates refuse: a refused call returns text
and no record, and the `refusals` grader counts refused closeouts only
(`packages/regulator/src/graders.ts:121`). The survey makes that note's §4.1 (record and
count refused calls, per gate) the instrument for a claim the field already makes.

## 5. What it adds

Ranked. Each names where it lands; none is a new thread.

1. **The reporting fields, for the live and Terminal-Bench reports.** §7.6's list is the
   checklist the next report's interpretation should walk, and the Terminal-Bench run's
   report should carry every field by name so a reader of the survey can read it.
   Lands in the Terminal-Bench thread (minimal-harness note §5.4, "the report"), with
   `cacheWrite` from its §4.3 as the field the fingerprint lacks. Reporting only; no
   schema change beyond the one §4.3 already proposes.
2. **Related-work rows for #104.** The survey itself, as the frame; NLAH (harness logic
   as an editable artifact), Meta-Harness (harness configuration as a search space) and
   Agentic Harness Engineering (harness components evolved from observability-driven
   feedback with the model fixed), from §1.1 and §4.3, as the three "learnable harness"
   systems Paper 1's proposal–probe–adoption separation must be distinguished from; and
   §4.4's three layers (multi-model, learnable, co-evolving) as the axis the novelty memo
   places the reflector on. Table VII's scaffolds (Agentless, SWE-agent, mini-SWE-agent,
   OpenHands, AutoCodeRover, PatchPilot) are rows for the course's comparison material
   rather than for the paper. Lands in #104's matrix; the Exo note §6 already names the
   twelve rows it sits beside.
3. **Confirmations, with no new action.** The survey's survey of verifier models (§5.6)
   confirms the rule the books note put into #49's done-when: a judged instrument's model
   may not be the route model of a unit type the suite grades, and `regulator check`
   refuses one that is (DEBT row 48 holds the instrument record kind). §7.3's
   "environmental artifacts" caveat is #178's toolchain hash on evidence and the
   fingerprint. §5.4's invalid-tool-calls claim is the state-defined interface note's
   §4.1. Table V's oracle-strength rule, read as a field a workload declares, would serve
   the docs only, since the portfolio and finance workloads already carry the mechanisms
   it prescribes; it is not proposed.
4. **For the course.** The four paradigms (§4) are a one-page frame for lesson 1's
   "where the bottleneck moved"; Fig. 3 against the one-level map (#153) shows a reader
   of both what a sixth box looks like when it is three functions; and Table VII's
   scaffolds broaden the comparison case beyond GSD-Pi, with the paper's own caveat that
   its rows are not controlled. Pointers only, for the course's repository.

## 6. Where this lands

- Item 1 in the Terminal-Bench thread's next report; the thread's roadmap row is
  unchanged, and its next step is still §5.6 decision 1.
- Item 2 in [#104](https://github.com/MetaCoding-io/regulator/issues/104)'s matrix, in
  the Paper 1 research track.
- Item 3 is already held by #49, #178 and the state-defined interface note.
- Item 4 is the course's.

This note names no next step of its own, so it has no threads row.

## 7. Reading

- The paper, §2.4 (the six components), §4.3 (the principles), §6.3 (Table V), §7.3 and
  §7.6 (the SWE-bench reading and the reporting list), §8 (the three directions).
- SWE-agent (arXiv 2405.15793), for the first controlled "same model, different
  interface" result the paper builds on.
- The [Harness² note](2026-10-18-harness2-recursive-harnessing.md) §7–§8 and the
  [Exo note](2026-11-06-exo-runtime-self-improvement.md) §6, for the boundary this
  note's §4.3 restates.
- The [minimal-harness note](2026-11-05-minimal-harness-and-terminal-bench.md) §5, for
  the run this note's §4.2 points at.
