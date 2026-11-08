# Exo read through the control plane

- **Status:** open. No issue yet; the next step is in §7.
- **Source:** *Exo: A Harness Architecture for Runtime Self-Improvement*, Krentsel,
  Ratnasamy, Stoica (UC Berkeley), Casado (a16z) and Goyal (Braintrust),
  [arXiv 2611.00463](https://arxiv.org/abs/2611.00463) (30 Oct 2026), read from the HTML
  version and the PDF. The paper cites its code at
  [exoharness/exo](https://github.com/exoharness/exo), commit `c5c1963`; the code was not
  read for this note, so every claim about Exo below is the paper's.
- **Why a note:** the [Harness² note](2026-10-18-harness2-recursive-harnessing.md) read the
  first well-measured loop in which a harness edits itself between tasks. Exo is the first
  well-measured runtime in which the harness edits itself *during* a task, and it does so
  on top of exactly the two things this project calls the boundary: an append-only record
  the editor cannot reach, and a guardian outside the editor that decides whether an edit
  takes effect. Its guardian is a build check. Its future-work section describes ours.
  Both halves belong on the record, and the architecture is close enough to this one that
  the gaps are precise.

Claims about what Exo does cite the paper by section. Claims about what regulator does
cite the file. The rest is proposal.

## 1. What Exo is

An agent is a model plus a harness; the harness's *policy* is everything programmable
around the model: tool implementations and selection, prompting, context assembly and
compaction, memory and skill retrieval, external integrations, and "the strategy for
deciding when and how to attempt further improvements" (§2.1). Today that policy is
tuned by an external optimizer (Meta-Harness, GEPA, AlphaEvolve) that proposes candidates
and runs them on benchmarks. The paper's objection is practical: benchmarks are often
absent (it cites a production study in which three quarters of teams evaluate without
one), long tasks make each candidate run expensive, and the policy stays fixed while the
agent works, even when the agent can see the gap (§2.2).

**The collapsed loop.** Exo moves the optimizer inside the agent (§3.1, figure 2). Two
properties make that possible. *Optimizer symmetry*: a harness revision is a sequence of
ordinary actions, inspect source, edit files, run tests, request activation, so revising
the harness is a choice available beside task actions. *Operational homoiconicity*: the
policy is code in files the agent can read with the tools it already has. Because the
improvement strategy is itself policy, the agent can revise how it revises.

**The two contracts** (§3.2). Runtime state is a triple: durable data `d` (history,
memory, artifacts), the sandbox `e`, and the active executor `π`. A protected operator
`K` applies every action. The *storage contract* says canonical history is append-only
(the history at `t` is a prefix of the history at `t+1`) and that memory and artifacts
keep prior versions. The *replacement contract* says a candidate executor `π'` becomes
active only if a guardian `G(s, π')` outside the executor returns one; otherwise the old
executor stays. Replacement requests and outcomes are themselves history events. The
appendix proves by induction that if `K` mediates every write and preserves the contract
at each step, the contract holds after any finite run, "independently of how the
executor chooses edits" (§A).

**The partition** (§4.1, figure 3). Below the line, modelled on the exokernel: the
append-only history with cost annotations, a versioned artifact store, credential
storage, the sandbox API, and the guardian. Above it, the *executor*: everything else,
including compaction, context assembly, the model call, and the improvement procedure.
The executor's source is mounted into the sandbox; a tool requests replacement; the
default guardian checks that the candidate builds (§4.2). Executor, durable state and
sandbox roll back independently, and history supports forking from an earlier event
while keeping the record of what was tried (§4.2).

**Internal legibility** (§4.3). Every model-message event carries cost and token counts,
cached tokens included, and a reporting tool summarises spend, cached-input share,
repeated tool calls and context composition, so the agent can see whether a context
revision cut input tokens without losing cache reuse. The runtime is about twenty
thousand lines, the base policy about a thousand, and the paper says it has served on the
order of ten thousand tasks in production.

**What it measures** (§5). Two facets: efficiency within a long task, and whether the
learned tools and policies transfer. In an emulated RuneScape through RS-SDK, against
Codex and Pi on the same model, Exo finishes combat and crafting at lower model cost and
earns more currency per model dollar, and transfer runs on fresh accounts cut cost
further; table A1 is one run per cell, on shared servers. Inside the combat run (§5.2.1)
Exo spends more than either comparison for the first ten minutes, then its spend rate
drops; the paper calls the early premium the *specialization cost*, and the comparisons'
cumulative spend overtakes Exo's at twenty-five and eighty-six minutes. Sixteen self-edits
are recorded, among them a batched combat tool revised after repeated failures, and a
context policy that keeps four turn summaries and moves older strategy to durable memory.
On the least repetitive objective (quests), Exo costs more per quest point than both
comparisons: specialization does not repay where there is no reuse.

On graded tasks against the same starting policy with self-editing removed (§5.4):
AppWorld held-out cost per task falls from $0.359 to $0.141 at an identical 96.9% pass
rate, with total cost including learning down from $57.36 to $32.70 and cached-input
share up from 57.5% to 86.1%; on SREGym, median diagnosis time falls from 81 to 53
seconds and model rounds from 16 to 10 over twenty held-out incidents, with the gain
coming from an incident-snapshot tool revised five times; on Continual Learning Bench
coding, shell steps and cost fall by about a seventh with every issue resolved in both
arms. The learned harnesses differ across seeds, and the paper counts that as a feature.
With a weaker model (gpt-5-mini) three seeds made few edits, reused nothing and gained
nothing: the paper names an *intelligence floor* below which self-editing is inert.

**What it concedes.** The contracts "do not on [their] own guarantee improved behavior or
continued progress" (§3.2). Guardian acceptance establishes only the property the guardian
checks, and "build success alone guarantees neither task correctness nor improvement";
preservation does not give liveness, so stopping a hung executor needs independent
authority; snapshots omit process memory and host-mounted source; nothing reverses
external effects; and "the broadly writable development configuration does not enforce
these restrictions" (§A). The discussion's open question is "how to match validation
effort to a revision's consequences while retaining an independent enforcement
boundary", and its sketch of a richer guardian is one that would "present proposed
revisions, supporting evidence, and validation results to a human for approval or
rejection before activation" (§7).

## 2. The same split, two guardians

Exo and regulator draw the same line and put different things on each side of it. Exo
protects the record and the activation path and lets the model edit everything else,
including compaction and its own improvement procedure. regulator protects the record,
the activation path *and the definition*, and lets the model edit the domain; the
definition changes by proposal, probe and a person's decision (the [accept-path
split](2026-10-18-accept-path-split.md)). Both are the exokernel move; what differs is
what counts as the kernel.

| Exo (the paper's term) | regulator's nearest thing | The difference |
| --- | --- | --- |
| Storage contract: history append-only, artifacts versioned (§3.2) | The regulatory log, the audit log, operational memory and the effect journal, each append-only NDJSON (`INSTANCE_STORES`, `packages/protocol/src/instance.ts`); the SQLite event store, whose triggers abort any `UPDATE` or `DELETE` (`packages/core/src/event-store.ts`) | Holds here, and holds per record kind with provenance and authority on every line; Exo's history is one stream of messages and replacement events |
| `K` keeps storage and replacement outside the executor's editing authority (§3.2, §A) | The write gate on `write`/`edit` with the alias walk, the bash snapshot-and-restore and the `identity-untouched` closeout check (`packages/regulator-pi/src/authority.ts`, `packages/checks`), over the protected set `DEFINITION_WRITERS` derives (`packages/protocol/src/definition-writers.ts`) | Both are file-level and in-process, and both papers say the same thing about it: Exo's appendix, that the development configuration does not enforce the contract; DEBT row 8, that `bash` is outside most mechanisms and the container is the boundary |
| Replacement contract: `G` outside the executor; replacement events in history (§3.2) | `identity accept`, `advice accept` and a merged change under `regulator check`, by accept path (`DEFINITION_WRITERS`); each accept resolves an obligation in the regulatory log, so activation is recorded | Exo's `G` is one function, and the shipped one checks the build. regulator's is three paths, chosen by what the file can do, each with a person in it. Exo's §7 asks how to match validation effort to consequence; this is an answer |
| "`G = 1` implies property `C`" (§A) | For declarations, `regulator check` and the tests before the merge; for advice, the probe arm's graders (slice 3, not landed); for identity, a person | The paper's `C` is "it builds". The one `C` regulator can state mechanically is a declaration's well-formedness; whether advice *helps* is a prediction that resolves later (`packages/protocol/src/prediction.ts`), and the design refuses to call a probe an adoption |
| Independent rollback of executor, durable state, sandbox; fork from an earlier event (§4.2) | Definition versioning in git with `regulator upgrade` and its migration bullets (`packages/core/src/upgrade.ts`); a worktree per unit; the recovery router's decisions appended, and a fresh session on re-dispatch (`packages/protocol/src/recovery.ts`) | Equivalent, and Exo's "retain evidence of what it tried after a rollback" is INV-003 said another way |
| Liveness needs authority outside the executor (§A) | Leases with expiry and heartbeat (`packages/core/src/coordination.ts`); the budget guard's `abort` | Holds |
| External effects are not reversed by any snapshot (§A) | The effect journal's intend-then-commit (`packages/core/src/effect-journal.ts`); consent derived from a declared irreversible effect before the call (`declared-tool`) | regulator is ahead: it does not reverse them either, but it asks first and records the intention |
| Credential storage below the line (§4.1) | The credential canary watch; secrets never rendered | Alike in posture; Exo keeps credentials out of sandbox files, regulator detects their appearance |
| Cost and cache annotations on every event, and a reporting tool the agent can call (§4.3) | The budget ledger per attempt with `cacheRead` and `cost` (`TokenUsageSchema`, `packages/protocol/src/trace.ts`; written by `packages/regulator-pi/src/budget.ts`), shown on the session's status line and to `regulator status` (`packages/regulator/src/status.ts`) | The data exists and the unit never sees it. The status line and the ledger command are the person's UI; no tool returns the ledger to the model, `summarizeLedger` (`packages/core/src/policy.ts`) reports tokens and turns and not cost or cache, the span projection carries input and output tokens and no cache attribute (`packages/protocol/src/spans.ts`), and `EVAL_METRICS` has `tokens` and nothing about cache or cost (`packages/protocol/src/evals.ts`). This is the one row where Exo has a mechanism regulator lacks |
| The executor edits compaction and context assembly (§4.1) | `contract-preserving-compaction` and `identity.maxChars`/`advice.maxChars` in the budget policy, a declaration file | Deliberately not editable by a unit here; see §5 |
| Agent-built tools (`train combat`, the incident snapshot, `appworld api docs`) (§5.2.1, §5.4) | A unit may write code under its writable prefixes and run it through `bash`, which the `implement` profile grants un-gated (`packages/regulator/profiles/implement.json`); a tool the *workload* declares carries an effect the gate reads (`DeclaredToolSchema`, `packages/protocol/src/workload.ts`) | Most of Exo's gain is here, and it is the step the Harness² note flagged: the editor writes the script and the executor runs it with nothing between. §4 item 5 draws the line regulator can draw |
| The improvement strategy is itself editable policy (§3.1) | `AGENTS.md`'s deferral of autonomous S5 mutation; the reflector is read-only and emits proposals (Harness² note §7) | The one thing regulator will not hand over, and the thing Exo's design is for |

## 3. Exo against the pathology catalog

Read as an arrangement, Exo is healthier than Harness² and still shows two rows of
[`docs/PATHOLOGIES.md`](../PATHOLOGIES.md) by construction. The paper is candid about
both; the catalog's job is to name them.

- **No S3\***. The guardian checks that the candidate builds. Nothing independent of the
  editing model judges what the candidate *does*; the paper's "richer guardians" are
  future work (§7). The cost and cache annotations are an independent reading of
  resources, which is more than Harness² had, and they are still read by the policy that
  is being judged.
- **S5 collapsed into S3**. The executor owns the prompts, the context policy and the
  procedure for revising itself, and the model rewrites all three mid-task. The paper's
  bitter-lesson argument (§7) makes this a goal: "placing all harness policy, including
  how it improves itself, under model control, retaining only the mechanisms needed for
  safe self-evolution". Identity is whatever the last accepted executor says it is.
- **Self-report as control variety**, partly. The cost signal is the host's, not the
  model's; but whether a revision helped is the model's own reading of its own history,
  and the three seeds that produced three different harnesses (§5.4.1) show how wide the
  space of readings is.
- **Data absorbed as control**, defended. The sandbox API and credential store are below
  the line, and the executor's source is mounted into the sandbox as data the model
  edits. The paper does not analyse what a planted file in the sandbox could do to the
  next executor; Harness² at least named the problem.

What Exo does *not* exhibit, and Harness² did: **missing recursion** in its first sense.
The record survives the regulator that reads it. Every replacement is a history event,
every rollback keeps the evidence, and the appendix proves it. regulator has the same
property for a different reason (the stores are append-only under the write gate), and
Exo's proof is a cleaner statement of why that property is the one to insist on.

## 4. What regulator could take, at the mechanism level

Each item sits on a seam that exists, and none lets a model write a definition file.
Ordered by cost.

1. **Cached-input share as a built-in metric.** Exo's densest signal was cache share, and
   its largest single AppWorld change (moving the changing task list out of the standing
   prompt) shows as a jump from 57.5% to 86.1% (§5.4.1). The ledger already records
   `cacheRead` and `input` per attempt. Add `cacheShare` to `EVAL_METRICS` with its grader
   over the attempts' ledgers (`packages/regulator/src/graders.ts`), surface it on the
   unit in `regulator status` and the control room beside the budget ledger, and project
   it onto the spans under the GenAI cached-input attribute if the pinned semantic
   conventions have one, else under a `vsm.` attribute. Level 2, small, and it gives the
   reflector's prediction record a metric worth betting on: a `harness-edit` to advice
   that promises a higher cache share is the shape of Exo's own best edit.

2. **Cost as a metric, and two costs on the probe report.** `EVAL_METRICS` has `tokens`
   and no `cost`, though the ledger carries the provider's figure. Exo reports *held-out
   cost* and *total cost including learning and reflection* separately (§5.1, §5.4.1), and
   draws the cumulative-spend crossover (figure 5). When slice 3 of the accept-path split
   lands the probe arm, its report should carry both: the cost of the `reflect` unit and
   the probe arm, and the held-out cost of the units after acceptance, with the crossover
   as a figure in the report. That is RQ4 of [Paper 1](2026-10-18-paper-regulating-the-regulator.md)
   and the Pareto row the Harness² note asked for; Exo shows the honest version of it,
   quests included.

3. **The unit's own ledger as a read-only tool.** Exo's reporting tool is the mechanism
   behind its claim that "runtime legibility enables better decision making" (§7). The
   host here has the same numbers and shows them to the person only. A `read_budget` tool
   on the profiles that already carry `remember`, with a read-only effect, returning the
   attempt's ledger (tokens, cost, cache share, turns, the ceiling and what remains) and
   the thrash detector's edit counts per file, is a signal the unit may act on and no
   authority: the ceiling stays the policy's and the halt stays the guard's. Level 3. It
   is also the behavioral canary's companion from the other side: the canary reads the
   unit's decay for S3, and this lets the unit read its own. Hazard for the card: a unit
   that optimises the number it is shown. The number is the host's and not the unit's
   report, so the hazard is the ordinary one of a proxy, and the card says so.

4. **A model-tier arm.** The intelligence floor (§5.4.3) is a threat to the validity of
   every claim the reflector thread will make: a probe that shows no gain may be showing
   the floor and not the edit. The live report for [#46](https://github.com/MetaCoding-io/regulator/issues/46)
   should name the model each arm ran, and the reflector's calibration report should run
   at two tiers before it says a proposal helps. An arm today differs in extensions,
   checks and identity (`EvalArmSchema`); a `route` override naming a model route of the
   budget policy is the field it lacks. Level 2.

5. **Agent-built tools: domain until reused, declared when promoted.** Exo's efficiency
   came from procedures the agent wrote and reused, not from prompt edits (§5.2.1, §5.4.2).
   regulator permits the first half already: a unit writes a script under `src/` and runs
   it with `bash`, and the closeout judges the tree. What it refuses is the second half,
   the script becoming part of the harness. The line to draw, as the Harness² note drew
   it for lessons: *a script a unit wrote is domain code; a script units keep reusing is a
   candidate declared tool*. The reflector, reading the spans for the same program run by
   several units, emits a `harness-edit` of the declaration class, which lands as a
   `DeclaredToolSchema` entry with its effect through the merged-change path and nothing
   else. The grant is written by a person; the symmetry Exo prizes is kept for the cheap
   half and broken for the half that grants. Design item for the reflector package, not a
   slice yet.

6. **The replacement event as a record kind.** Exo logs every activation request and its
   outcome into history (§3.2). regulator records an acceptance as a disposition on the
   obligation and a commit. What it does not record is a *refusal* of an accept by the
   checks (`advice accept` refusing an unprobed edit, `check` refusing a declaration). A
   refused activation is evidence too, and the prediction record's "inconclusive counts
   against" rule wants it. A line in the regulatory log for a refused accept, with the
   reason, is level 2 and belongs with slice 3.

7. **Exo's formalism, for #103.** The triple `(d, e, π)`, the protected operator `K`, the
   guardian `G`, and the induction over transitions (§3.2, §A) are a cleaner scaffold
   than the one in the Paper 1 note's §2, and the five candidate invariants map onto it:
   the storage contract is invariant 3 (a report is not evidence; the record is), the
   replacement contract is invariants 1 and 2 (a proposal changes nothing; an accept goes
   through a declared path), and invariants 4 and 5 (a probe is not an adoption; a
   disconfirmed prediction stays visible) are what Exo's `G` cannot express, because its
   `C` is decidable at activation and ours resolves at a horizon. Research, now.

## 5. What not to take

- **Runtime edits to compaction and context assembly by the unit.** Here those are the
  budget policy, a declaration; `contract-preserving-compaction` guarantees that what the
  loop needs survives eviction *without* trusting the summary. Hand the policy to the
  unit and the guarantee is the unit's.
- **A build-only guardian**, or any `G` that is one check. The accept-path split exists so
  that the check matches the consequence; collapsing it into a single function is the
  pathology Exo's own appendix warns about.
- **The improvement strategy as editable policy.** This is the deferral in `AGENTS.md`
  and the reason the reflector is read-only. Exo's bitter-lesson argument is that the
  mechanism layer should shrink as models improve; regulator's answer is that what
  shrinks is the *advice*, and the boundary between advice, identity and grant is what
  stays.
- **The results as evidence about correctness.** Every headline is a cost or time at a
  matched pass rate on a graded benchmark, or a cost on an emulated game with one run per
  cell. The paper is clear about this; a reader of the abstract may not be.

## 6. What this gives Paper 1

Three things, none of them a claim before its evidence exists.

- **A sharp line for the novelty memo.** Exo supplies the contracts (append-only record,
  guardian outside the editor) with a proof, and names "how to match validation effort to
  a revision's consequences while retaining an independent enforcement boundary" as open
  (§7). The accept-path split is an answer: three paths chosen by what the file can do,
  an audit function independent of the editor, a prediction that resolves after adoption,
  and a person on every path. Exo's own sketch of a richer guardian (§7) is this design
  with the names changed. That is the strongest prior-art objection and the reply to it in
  one place.
- **A reading list for #104.** The related-work section (§6) is the matrix's next twelve
  rows: LogAct (a shared log with decoupled voters admitting actions), Self-Healing
  Harness (behavioural rules admitted by replay or forward trial), JIT-Agent (immutable
  history with mutable controller state), Continual Harness (a periodic refiner over
  prompts, subagents, skills and memory), DeepSeek Harness (replaceable plugins over an
  append-only event log), RRSI, TTHE, the Self-Defining Operator, Hyperagents, the Gödel
  agent and the Darwin Gödel Machine, and Meta-Harness and AutoHarness as the external
  optimizers. Each is to be read at the source before it enters the matrix.
- **Two threats to validity for RQ3 and RQ4.** The intelligence floor (a null result on a
  probe may be the model, not the edit) and the specialization cost (a probe over few
  units cannot see a payback that arrives later, and the quest result shows a payback
  that never arrives). Both go into the study protocol in #105 as things the design must
  distinguish, not as findings.

- **The opposing claim, stated so it can be tested.** On architecture the two agree: protect
  the record, keep the guardian outside the editor, log every activation. On who the
  guardian is they sit at different points of one axis, and Exo's §7 concedes the axis.
  Where they oppose each other is the *timescale of adaptation*. Exo bets that a harness
  edit made mid-task pays back inside that task, and its figure 5 says it does after an
  early premium. regulator's path for the same edit is proposal, probe, a person, and
  then the next units; the unit that saw the waste never gets the fix. The cost gains Exo
  reports are therefore the price of the boundary, less whatever share of them is
  reachable without crossing it (§8 argues that share is large). The second opposition
  is philosophical and unmeasured on both sides: Exo's bitter-lesson reading is that the
  mechanism layer shrinks toward the minimum needed for safety as models improve;
  regulator's is that what shrinks is the advice, and the lines between advice, identity
  and grant stay. Exo's intelligence floor (§5.4.3) bears on both: self-editing gained
  nothing below the floor, so the boundary costs less there and more above it. Paper 1
  should state the timescale claim as a proposition with a number against it (§8's
  experiment), and the bitter-lesson claim as a position, not a finding.

## 7. Next step

No issue from this note on its own. Items 1, 2, 4 and 6 of §4 are additions to the
done-when list of the probe-arm issue (the accept-path split's slice 3) when it is filed
after [#46](https://github.com/MetaCoding-io/regulator/issues/46); item 7 and §6 go into
[#103](https://github.com/MetaCoding-io/regulator/issues/103),
[#104](https://github.com/MetaCoding-io/regulator/issues/104) and
[#105](https://github.com/MetaCoding-io/regulator/issues/105) now, as research. Item 3,
the read-only ledger tool, can be filed on its own under `roadmap:0.2` once a card is
written for it; item 5 waits for the reflector package. From §8: the asking bullet
(§8.2, gap 1) landed on the seed with the `research` and `auditor` grant (decided
2026-11-08, §8.2); the self-advice tool (§8.3) is a design item for the reflector thread,
probed under the drift suite as the experiment §6 names, after #46. The threads table in
[`ROADMAP.md`](../../ROADMAP.md) carries this order.

## 8. The point the note walked past: can units feed the loop? (added 2026-11-07)

§2 said Exo is the strongest published argument for the thing regulator refuses, a unit
editing its own harness mid-task, and then did not say what regulator does with that
argument. A reader asked three questions: can units raise a signal to the reflector
directly, the way a manager asks the team for ideas; is the better focus §4 item 5, the
scripts one unit writes becoming tools every unit may call; and is regulator making
claims that oppose the paper's. §6's last bullet answers the third. This section answers
the first two.

### 8.1 What regulator refuses, precisely

Not proposing, and not building. A unit may propose any change to the definition
(`propose_policy_change` is on the `implement`, `bookkeeper` and `manager` profiles,
`packages/regulator/profiles/`), may record what it learned for later units (`remember`,
same profiles; scoped by unit type, `packages/protocol/src/memory.ts`), and may write and
run any code it likes under its writable prefixes, `bash` included
(`packages/regulator/profiles/implement.json`). What it may not do is three things: write
a definition file (the write gate and the bash watch over `DEFINITION_WRITERS`'s
instance paths, `packages/regulator-pi/src/authority.ts`); have its proposal take effect
without an accept (INV-002); and change the harness that is running it, compaction and
context assembly first of all, which are the budget policy's and not the unit's
(`packages/regulator-pi/src/budget.ts`). The first two are the boundary. The third is
where Exo's timescale claim lives, and it is the only one of the three a reader could
call a refusal of adaptation rather than of authority.

### 8.2 The manager asking the team: that is this design, and it has three gaps

The analogy describes regulator, not Exo. In Exo the employee rewrites their own job
description and HR checks that it parses. Here S1 proposes and S5 decides, which is the
VSM's own picture of the channel, and the reflector as designed (Harness² note §7) reads
precisely the records a unit's ideas land in: the regulatory log for proposals and
uncertainty reports, the memory store for facts. So the channel exists. Why it does not
yet deliver what Exo delivers:

1. **Nothing asks.** No shipped advice file tells a unit that a repeated procedure, a
   tool it had to build, or a context waste it noticed is wanted output, and where to
   put it (a fact for later units goes to `remember`; a change to how units are run goes
   to `propose_policy_change`). Exo's base policy carries its improvement strategy, and
   Harness²'s editor is asked for two candidates per task. One paragraph per advice file,
   landed by `advice promote`, and the proposal channel has a sender. Level 5, and the
   right level: the asking is advice, the channel it feeds is typed.

2. **The reader is not built.** A unit's proposal today is an obligation owed to a
   person, which is correct and slow. A unit cannot file a typed `harness-edit` itself:
   the prediction block rides on an intelligence signal
   (`packages/protocol/src/prediction.ts`), and `report_intelligence` is on the
   `intelligence` profile alone. So ideas from `implement` units arrive as plain text,
   and the component that would aggregate them across units, attach the prediction and
   shape the `harness-edit` is the reflector, designed and unbuilt. This is the same
   dependency §4 item 5 has, not a new one.

3. **The latency stays.** With both fixed, the unit that noticed the waste still never
   benefits from the fix. That is the timescale claim of §6, and no amount of asking
   closes it. §8.3 is what does, partly.

**Decided (2026-11-08, James).** Gap 1 is closed on the seed: every shipped advice file
ends with the asking bullet (`packages/regulator/advice/`), varied by what the profile
can do (a script to `remember` for `implement`; a repeated step or a misfit line to
`propose_policy_change` for all; the unanswerable question for `intelligence`). The
`research` and `auditor` profiles gain `propose_policy_change`, so every profile has the
channel: a proposal is a control-plane record, which `isReadOnlyEffect`
(`packages/core/src/effects.ts`) admits, so both stay read-only by declared effect and
the `plan` unit type, which runs without a contract, stays legal. Landed as a change to
the definition's repository with `regulator check` as the gate, which is the third
accept path, and recorded in the product changelog's migration note: an instance
initialized earlier keeps its advice files and takes the bullet by `advice accept` or by
hand.

### 8.3 How much of Exo's gain is reachable without crossing the line

More than §4 made clear, and in two parts.

**Tools.** Most of Exo's measured gain came from procedures the agent wrote and reused:
the batched combat tool, the incident snapshot revised five times, the API-docs fetch
(§5.2.1, §5.4). A regulator unit can do the first half today: write the script under a
writable prefix, run it through `bash`, and `remember` where it is and what it does, with
a scope, so the next unit of the type finds the fact rendered into its context. No
mechanism changes; the asking paragraph of §8.2 is what makes a unit do it. What Exo has
and this does not is in its §2.1: a policy-level tool is "wired directly into context
assembly" while code in the environment "must be remembered and managed entirely by
model reasoning". §4 item 5 is the mechanism that closes that gap without a unit ever
writing the harness: the reflector sees the same program in several units' spans, and
proposes it as a declared tool with an effect (`DeclaredToolSchema`), landing through the
merged-change path under a person. So the answer to the second question is yes: item 5
is where the proposal channel turns into the thing Exo measured, and it should be the
focus once the reflector exists.

**Context.** Exo's other large edit was to context policy: keep four turn summaries,
move older strategy to durable memory (§5.2.1); on AppWorld, move the changing task list
out of the standing prompt (§5.4.1). regulator refuses a unit editing compaction, and
should. But there is a middle the note did not have. A unit could be granted a tool,
call it `note_to_self`, whose only effect is to append a short note to the unit's own
rendered context for the rest of the *current attempt*: carried in the deterministic
block of contract-preserving compaction (`renderPreservedContext`,
`packages/core/src/policy.ts`) so it survives eviction, recorded as a signal in the
regulatory log with the unit and revision, and offered to the reflector at close as the
diagnosis half of a draft `harness-edit`. Nothing under the definition is touched;
identity still renders from the files; the canary still reads every reply; the closeout
checks are unchanged. What the unit gets is Exo's timescale restricted to advice, scoped
to one attempt, and logged: it can tell itself, mid-task, "the test output is noise past
the first failure; stop reading it", and the next compaction keeps that sentence. What
the instance gets is a record of what units tell themselves, which is the evidence the
reflector needs to propose the same sentence as advice for every unit.

Hazards, for the card: a unit telling itself to skip a rule. The rules a unit must keep
are in the identity set and the contract, neither of which the note can touch, and
`glossary-lint`, `behaviour-check` and `identity-untouched` judge the output regardless.
A note is advice to itself at level 5, and the design's claim is that level 5 cannot
override levels 1 to 3; if the drift suite shows otherwise, the tool is wrong, which is
why it is probed first. Second hazard: self-report as control variety, if a note were
read by anything as more than a note. It is rendered to the unit that wrote it and read
by the reflector as a diagnosis; the router never sees it.

**The experiment.** Run the drift suite with `note_to_self` on and off, under the
regulators enabled, and read cost, cache share and the drift graders. That puts a number
on §6's timescale claim from regulator's side: how much of Exo's within-task payback
survives when the edits are restricted to a unit's own advice and the harness stays
where it is. It is a live-model run and waits on
[#46](https://github.com/MetaCoding-io/regulator/issues/46) like everything else here.

### 8.4 Where this leaves the refusal

regulator still refuses the thing Exo does: a unit editing compaction, context assembly,
grants and its own improvement procedure, with activation gated by a build. What §8
adds is that the refusal is narrower than §2's sentence made it sound. Proposing is
open; building is open; remembering is open; advising oneself for an attempt can be
opened without moving the line; and turning a unit's script into everyone's tool is a
proposal away. The one thing kept is that the harness is changed by a path with a
person on it, and the one thing that costs is latency, which §8.3's experiment measures
instead of asserting.
