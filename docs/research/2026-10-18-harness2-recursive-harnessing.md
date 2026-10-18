# Harness² read through the control plane

- **Status:** open.
- **Source:** *Harness²: Recursive Agent Harnessing for an Open World*, Xu et al., Google
  Cloud AI Research and Northwestern, [arXiv 2610.14224](https://arxiv.org/abs/2610.14224)
  (9 Oct 2026), the code at
  [google-research/harness2](https://github.com/google-research/harness2) (Apache 2.0),
  and the [project page](https://harness2.github.io/). Read from the HTML version of the
  paper, the README and the page; the summary of the release that prompted the read is
  [a post by Akshay Pachaar](https://x.com/akshay_pachaar/status/2111753928031531232)
  (18 Oct 2026), which also quotes his own June article on Comet's Opik and Ollie.
- **Why a note:** the paper is the first well-measured system in which the harness edits
  itself, and it edits exactly the files this project holds under S5, a profile grant or
  a check. It is the strongest case so far for one of the things `AGENTS.md` defers,
  autonomous mutation of the definition, and it comes with the regressions that are the
  reason for deferring it. Both halves are worth having on the record, and the method
  has three pieces regulator could take without giving up the boundary.

Claims about what Harness² does cite the paper. Claims about what regulator does cite the
file. The gap between the two is the point.

## 1. What Harness² is

An agent is a frozen model plus an editable harness. The harness is eight component
files, grouped by role: system prompt, guardrails, memory and skills (context
construction); tool guidance and scripts (tool interface); subagents (orchestration);
plugins (middleware). *Harnessing* is editing those files while the weights stay fixed.
The problem the paper sets itself is the open world: the task was unseen when the harness
was designed, and there is no ground-truth verifier online to say whether an edit helped.

Two recursion levels answer it.

**Task-level recursion: Propose, Probe, Compose.** The current harness runs once on the
task, giving a reference trajectory and deliverable. An *editor* (Claude Opus 4.8 in the
main experiments; the executors are Gemini 3.5 Flash and GLM-5 under OpenCode or Codex)
reads the task, the harness, the reference, the history and the improvement library, and
drafts two candidate harnesses: an *invariant* edit aimed at a weakness that recurs
across domains (planning, tool use, context, delegation) and a *domain-specific* edit
aimed at this task's procedures and constraints. Every edit must trace to a moment in the
trajectory; `KEEP_BASE` is a valid answer. Each candidate is *probed*: run on the same
task under the same settings, and its trajectory and deliverable are compared with the
reference. That comparison is the *behavioural contrast*, and it is the only signal: no
label, no score. A *composer* then reads the reference, the candidates, their diffs and
the contrasts and may merge supported edits, revise conflicting ones, adopt one, or keep
the base, citing a concrete observation for each decision. The composed harness runs and
delivers. With a budget `k > 1`, candidates run in parallel (wider) or the step repeats
with the refined harness carried forward (deeper), and a *selector* picks among
anonymized deliverables without seeing which harness made them. The paper calls the
result adoption, not verified optimality.

**Harnessing-level recursion: the improvement library.** After each task a *reflector*
reviews the whole record. A lesson is kept only if an execution contrast supports it;
having been selected is not enough. A library entry is an executable harness plus an
`EXPERIENCE.md` (the situation it applies to, the lessons, the evidence) under an index.
The next task starts again from the base harness; the library is consulted by the
editor in Propose, so components are reused by proposal, never inherited. The library
starts empty per benchmark.

**What it reports.** One step improves every one of four model-and-substrate pairs on
three professional benchmarks: up to +11.5 on WorkBuddy-Bench (GLM-5, OpenCode), +4.5 on
JobBench, +11.8 percentage points on LAB's partial pass rate. On WorkBuddy with Gemini
3.5 Flash the base scores 72.4, one step 77.5, and `k = 5` 80.8, against 73.4 for
ReasoningBank, 75.3 for Harness Scaling and 76.4 for Meta-Harness. Ablating skills costs
the most on code and web tasks, ablating scripts the most on office tasks. A harness
refined for Gemini 3.5 Flash transfers unchanged to GLM-5 and to Opus 4.8 with gains that
vary widely.

**What it concedes.** Appendix F: the loop costs extra executions and editor sessions,
and the signal is behavioural contrast under execution noise and *shared model bias*, so
it guarantees neither correctness nor transfer. Appendix E.6 sorts nine regressions into
three kinds: the selector preferring a narrower deliverable, a *false premise propagated
across candidates* (a wrong assumption adopted once becomes the premise of every later
candidate, at a cost of 2 to 11 points), and noisy attribution. The safeguards are mostly
prompt-level: no grader, rubric or score in any context; files under the context
directory are to be treated as data; the editor does not execute scripts it finds in a
candidate; a validator rejects harnesses with unnamed skills, template braces or missing
scripts; rollouts are capped. There is no reward-hacking analysis. The README's security
note says executor network access is unrestricted and Codex runs with its sandbox off,
and warns that public benchmark rubrics are reachable online.

**What the post flattens.** The post's summary is accurate as far as it goes; three things
are lost. "Turn any harness into a self-improving system" is a claim about two substrates
and an eight-file component model. "No grader or correct answer" is true of the online
loop and not of the numbers: the gains are measured by the benchmarks' graders, and the
editor is a stronger model than either executor, so part of what the harness "learns" is
a stronger model's judgment written into the weaker model's files. And what persists is
not a better harness but a library the next task may draw on; the base harness is reset
every time, and the recursion's increments shrink. The second half of the post is an
advertisement for Opik's Ollie, whose loop (a production trace becomes a diagnosis, a
proposed fix the user approves, and a regression test that is kept) is, as it happens,
closer to this project's posture than Harness² is: a person approves, and the thing kept
is a host-run test.

## 2. The same object, two questions

Harness² and regulator act on the same object, the set of files around a model, and ask
different questions of it. Harness² asks how the harness gets *better at the task*.
regulator asks how the harness *stays inside its boundaries* while it works, and how
anyone would know (`vsm/IDENTITY.md`, "Purpose"). Each has, by design, what the other
lacks: Harness² has a learning loop over the harness and no S5, no S3\* independent of a
model, and no path to a person; regulator has all three and no learning loop over the
definition at all. The definition changes only when a person accepts a proposal
(`regulator identity accept`, `docs/concepts/identity.md`, "The only way to change
identity") and carries it back to the seed (`identity promote`), and the eval harness
measures the regulators, not task performance (`docs/concepts/evidence-about-the-regulators.md`).

Piece by piece:

| Harness² | VSM function | regulator's nearest thing | The difference |
| --- | --- | --- | --- |
| The base harness: eight component files | the definition | the definition: registry, profiles, policies, workloads, identity, evals (`docs/concepts/definition-and-instance.md`) | Harness² edits all eight per task. regulator versions and checks them (`regulator check`) and changes them by decision |
| *Guardrails*, an editable component | S5 | `regulator/identity/`, write-protected by four layers and INV-001 | This is the one component regulator would never hand to the loop. In Harness² the agent rewrites its own guardrails per task |
| *Skills*, *scripts*, *plugins*, *subagents* | S1 profile, S2, the host | profile grants over tool effects (`packages/regulator/profiles/`); the trust rule, under which a project's skills, extensions and prompt templates never configure a unit's session (`project-trust-rule`); unit types declared in the workload | In Harness² the editor writes scripts and skills the executor then runs, with unrestricted network. That is a control channel opened from inside the loop; the paper's mitigations are a validator and a prompt instruction |
| *System prompt*, *tool guidance*, *memory* | advice | identity rendered into context (level 5), `contract-advice`, `remember` | The same level in both systems. Here the two systems agree: this is where a loop may edit |
| The editor proposes two candidates with evidence | S4 → S5 | `propose_policy_change`: a typed proposal that changes nothing and opens an obligation owed to S5 (INV-002; `packages/core/src/obligations.ts`) | Harness² has no S5. The composer adopts. In this project's terms, *proposal is policy* in Harness² |
| Probe: run the candidates, compare trajectories | evidence | host-run checks at a revision; deterministic graders over the stores | Harness²'s evidence is a model's reading of a trajectory, and the paper names the shared-bias problem. Under INV-003 and INV-004 that reading is self-report, not audit |
| Compose: adopt, merge, revise or keep, citing an observation | the decision | the eval report's `interpretation`, by a named person, which must say where the gated arm lost; retirement written on the card by a person | Harness² keeps the discipline (a cited observation, `KEEP_BASE`, downside weighed as heavily as upside) and gives the decision to a model |
| The selector over anonymized deliverables | S3 close | the closeout gate: technical verdict, then human acceptance, kept separate | Harness² closes on a model's choice among outputs |
| The improvement library: harness + `EXPERIENCE.md` + evidence | S4's model, operational memory | `remember`: a fact with host-stamped provenance, a required expiry of at most 90 days, a scope, retraction by a named person (`memory-store` card) | A lesson in Harness² has evidence and no expiry, no owner, no review date, no retraction. The paper's future work, "revising outdated experience", is the memory-store card's failure class, *memory-becomes-policy*, and in Harness² a lesson *is* an edit to the harness, so the failure is the design |
| Recursion budget `--k` | budget | the budget policy, metered per attempt (`budget-guard`) | Alike. Harness² counts total tokens; its Pareto analysis is the honest row |
| "Recursion" | VSM recursion | the *missing recursion* pathology: the harness regulated as a viable system of its own, with owners, review dates and retirement (`regulator-lifecycle`, `doctor`) | Harness²'s recursion is optimization recursion. The harness is tuned as a parameter vector; nothing regulates it as a system |

## 3. Harness² against the pathology catalog

Read as an arrangement rather than a method, Harness² exhibits several rows of
`docs/PATHOLOGIES.md` by construction. This is not a complaint about the paper, which is
a benchmark result and says what it does not guarantee; it is what the catalog is for.

- **No S3\***. The composer and selector judge the executor's trajectories, and the paper
  says the signals "are sensitive to shared model biases". Anonymized selection and the
  hidden rubric help; they do not make the judge independent of the judged.
- **S5 collapsed into S3**. The system prompt and the guardrails are rewritten by the
  loop, so identity is whatever the last composition wrote. The *propagated false
  premise* regression is this pathology measured: a wrong assumption adopted once
  becomes the premise of every later candidate.
- **Memory becomes policy**. By design: a lesson is kept as an executable harness.
- **Data absorbed as control**. `EXPERIENCE.md` and the harness files are the model's
  output and its next input. The defence, "treat files under the context directory as
  data", is a prompt instruction, the lowest mechanism level.
- **Missing recursion**. No library entry has an owner, a review date or a retirement
  condition; nothing in the loop can ask a person, and the whole thing is benchmark-bound.

And two rows it does *not* exhibit, which regulator should notice:

- **Feedback delay**, in the form this project's thesis is about: Harness² measures the
  effect of every change it adopts, on the task, before the next task. regulator measures
  the regulators under a drift suite and has never measured a change to a profile's
  advice or a contract's advice at all. The definition is versioned and checked; it is
  not evaluated.
- **No S4**. Harness² has a model of "what worked, in what situation, on what evidence"
  that is consulted before each task. regulator's S4 is "an interrupt with a hold, not a
  cache" ([open questions §4](2026-09-25-open-questions.md#4-predictive-intelligence-s4-as-a-model-of-outside-and-then)),
  and the predictive note is exploratory.

## 4. What regulator could take, at the mechanism level

Each item is proposed against a seam that exists. None of them lets a model write a
definition file.

1. **A harness-edit proposal kind.** The Propose step produces exactly what
   `propose_policy_change` carries: a change, a reason and the evidence. A proposal
   whose payload is a diff against an advice-level definition file (a profile's advice,
   a contract's advice, a skill the workload declares) plus the trajectory moment it
   traces to, routed as every proposal is (an obligation owed to S5), and accepted by a
   person with the `identity accept` command generalized to the definition's advice
   files. Level 3 (typed tool and schema) and level 2 (the router). This is the proposal
   half of Harness² with the adoption half left where INV-002 puts it. The editor is a
   `research`-type unit under a read-only profile; it needs nothing it does not already
   have (`packages/regulator/profiles/research.json`).

2. **Probe as an eval arm.** Harness² runs a candidate before adopting it. The eval
   harness already runs arms over a suite with deterministic graders and declared
   metrics, and an arm may differ in extensions, checks and identity
   (`packages/regulator/evals/drift.json`). Let an arm also differ in an advice file, and
   a proposed edit can be run as an arm against the workload's fixture before a person
   decides: Probe with the suite's graders instead of a model's reading, and the
   interpretation rule instead of the composer. This is the pre-merge trial (DEBT row 37)
   for the definition rather than the domain. It is also the one place regulator could
   answer Harness²'s open-world problem on its own terms: where there is a fixture,
   probe against it; where there is none, the proposal waits for a person, and the
   obligation says so.

3. **Lessons go to memory or to a proposal, never to the harness.** If a reflector is
   ever built, its output is one of two records that already exist: `remember`, when the
   lesson is a fact for later units (advice, expiring, scoped, retractable), or a
   proposal, when it is a rule. Harness² has one discipline here regulator lacks and
   should adopt as a schema field: a lesson must cite an execution contrast. A `remember`
   entry and a proposal could be required to cite an observation the host can resolve, a
   unit and a revision, the way an authority reference must resolve to an invariant that
   exists (DEBT row 10, paid). The host cannot check that the fact is true (the
   `memory-store` card's first limitation); it can check that the evidence points at
   something.

4. **The library is an instrument, not a regulator.** Harness²'s leave-one-out analysis
   (the score with the library versus without it) is the calibration report the
   instrument record kind in [open questions §4](2026-09-25-open-questions.md#4-predictive-intelligence-s4-as-a-model-of-outside-and-then)
   would require. If regulator grows an experience store, it gets an instrument card:
   the quantity it estimates (that adopting this advice improves this metric), the level
   (model-judgment, the weakest), the metric it is graded on and the report that last
   graded it; and `regulator check` refuses it without one.

5. **The component split, written down.** Harness²'s eight components give a clean way
   to say which parts of the definition a loop may touch, and `BOUNDARY.md` should say
   it: *never editable by a loop* (guardrails, that is identity, the profile grants and
   the checks); *proposable* (the system prompt's advice, tool guidance, contract advice,
   skills, memory); *declared, not learned* (subagents, which are unit types in the
   workload; plugins, which are extensions under the trust rule).

## 5. The experiment the two projects suggest together

regulator's one experiment asks whether regulation slows architectural drift. Harness²
is its mirror: a loop that improves task score by editing the harness, with regressions
of 2 to 11 points from a false premise that propagated. Those regressions are drift,
measured on task score instead of on boundaries. The experiment both projects suggest
is to run a Propose-Probe-Compose step over the advice files of the software workload,
under the drift suite, with the regulators ablated versus enabled, and ask two
questions the paper could not: whether the gates catch a propagated false premise
before it lands (the write gate and the trust rule should refuse an edit to a guardrail
or a script outright; the proposal path should hold one to an advice file until a person
looks), and what the regulators cost in the task-score gain Harness² reports. That is a
live-model experiment and waits on the first live report
([#46](https://github.com/MetaCoding-io/regulator/issues/46)) like the predictive note
does.

Until then, Harness² joins GSD-Pi as comparison material: not a harness to integrate
with, but another system's answer to the same question, with the answer measured.

## 6. Next step

Item 1 is the slice with a seam ready for it: a `harness-edit` proposal payload in the
protocol, routed as a proposal, with a `definition accept` path that writes an advice
file under S5 authority the way `identity accept` writes an identity file. It needs a
design decision first on which definition files count as advice (item 5), recorded on
`BOUNDARY.md`. Items 2 to 4 wait on #46.
