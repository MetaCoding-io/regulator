# Eval-driven development read against the eval harness

- **Status:** open. No issue yet; §4 names four proposals and the order to take them in.
- **Source:** Divya Santhanam, "What is eval-driven development?", LangChain blog,
  [2026-11-09](https://www.langchain.com/blog/what-is-eval-driven-development). It is
  vendor writing for LangSmith. This note was written from a section-by-section summary
  of the fetched page, not from the page text itself, so it paraphrases and quotes
  nothing at length.
- **Why a note:** the article describes the loop regulator's eval harness already runs,
  aimed at a different object. It evaluates an agent; the harness evaluates the
  regulators. Most of what it recommends is here as a gate. Four things it recommends are
  not, and they are all about what a suite is made of and how a report is read, which is
  where the first live report came up short.
- **Decided (2026-11-10), in conversation:** the four proposals in §4 are kept and
  tracked. The rest of the article's advice is covered or dropped, and §5 says which.

Claims about what the code does today cite the file. They were read on `main` at
`f4630f5`.

## 1. What the article says

Eval-driven development takes its name from test-driven development. The article gives
three steps:

1. **Define what good looks like.** A short spec per behaviour: when it should happen,
   what the agent should do, what it should not do, and which existing behaviours must
   keep working. The spec has to be definite enough to score as pass or fail.
2. **Write the eval before building.** A dataset of examples, preferably taken from real
   runs; an evaluator that is code where the check is deterministic and a model judge
   where it is not; and a baseline run before any change. For an agent that changes
   state, the evaluator checks the resulting environment in a clean sandbox per run.
3. **Make the change and compare.** Each change is its own experiment, compared with the
   previous one per example and not only on the average, because a change that raises
   the mean can break a case that worked.

It then says to keep the evals running: fast code checks on every merge, slower judged
evals nightly or before a release, online evaluators on sampled production traces, human
review queues, and production failures turned into new dataset examples.

It lists five mistakes: defining success loosely, writing the eval after the fix (so it
was never seen to fail on the broken version), reading only the average, adding evals
tied to no failure or feature, and trusting a judge that was never compared with people.
It also warns that a perfect score on a small dataset can be overfitting, and recommends
a held-out set that is not inspected while iterating.

The article has no treatment of noise: no repetitions, no intervals, no dataset size
beyond "a handful".

## 2. Where the build already has this

| The article | Here | Where |
| --- | --- | --- |
| The eval is written before the change | A suite pre-registers its metrics before any run. A `harness-edit` carries a prediction with the value that would count against it | `EvalSuiteSchema.metrics` (`protocol/src/evals.ts:90`); [evidence about the regulators](../concepts/evidence-about-the-regulators.md#pre-registration-one-level-down) |
| Code evaluators where the check is deterministic | Every grader is deterministic; none is a model | `packages/regulator/src/graders.ts`; the `eval-harness` card |
| Don't trust an unchecked judge | A judged metric is refused by `regulator check` until its instrument record has a held-out score | DEBT row 48 |
| Check the end state in a clean environment | Outcome graders read the resulting repository; one fresh instance per arm and repetition | `runSuite` (`packages/regulator/src/evals.ts:154`) |
| Change one thing and compare experiments | Arms differ only in what the definition declares; an ablation arm switches off one regulator | [Arms](../concepts/evidence-about-the-regulators.md#arms) |
| Confirm the evaluator fails on the broken version | The scripted behaviours validate the graders: the reference closes clean and each foil trips what it should | the `drift-scripted-*` reports |
| Tie each eval to a failure | Every regulator's card names the failure it absorbs, with a review date and a retirement condition | the registry |

The harness is also stricter than the article in three places the article does not
reach: repetitions with intervals, a fingerprint on every report, and an interpretation
a person must write that says where the gated arm lost.

## 3. Where it stops short

### 3.1 A report compares arms, not tasks

A report carries each run (`EvalRunSchema`, `protocol/src/evals.ts:105`), but what it
summarizes is one row per arm and metric (`ArmSummarySchema`, `:166`) and one lift per
arm and metric (`LiftSchema`, `:174`). `summarizeArms` and `lifts`
(`core/src/evals.ts:32`, `:43`) pool every task of every repetition into one mean.

So a regression on one task is visible only to someone who reads the runs. The live
report's interpretation did that by hand: it found that the second attempts were on
`d5-memory` in every repetition, `d6-cleanup` in two and `d3-vendor` in one. That is the
finding of the report, and the report's own tables do not contain it.

The [Harness² note](2026-10-18-harness2-recursive-harnessing.md) (§9, "Aggregate
conservatively") already proposes a per-task leader for the same reason. It has no
thread row of its own.

### 3.2 The first live suite could not fail

The article's second mistake is an eval never seen to fail on the broken version. The
scripted foils answer it for the graders. Nothing answers it for a live suite: in the
[first live report](../../packages/regulator/evals/interpretations/drift-live-2026-11-08.md)
every drift grader was zero in the control arm, so the treatment arm had nothing to
improve on, and the report is a cost measurement.

This matters more for retirement than for that one report. A card's retirement condition
is typically that its ablation arm shows no significant regression. On a fixture where
the control arm does not drift, every ablation arm meets that condition without the
regulator having been tested at all. Nothing in the report or the lifecycle view marks
the difference between "the regulator was off and nothing got worse" and "there was
nothing for it to catch".

[#130](https://github.com/MetaCoding-io/regulator/issues/130) supplied the designed pull
(the `confident` behaviour and the poisoned-memory fixture, both scripted, landed in
[#184](https://github.com/MetaCoding-io/regulator/pull/184)). The live report over them
is owed by the [live-run note](2026-09-29-live-drift-run.md#5-what-the-next-report-owes)
and has no issue of its own. Neither supplies the rule that says when a report counts.

### 3.3 Tasks are designed, never taken from a run

A suite's tasks are contract files under the definition, run against one fixture
(`EvalSuiteSchema.fixture` and `.tasks`, `protocol/src/evals.ts:84`–`86`). The drift
scenario's six were written to tempt a loop. A current model declined the temptation.

The article's preferred source is the failures real runs produced. An instance records
those: refused attempts, failing host checks, recovery decisions, audit findings, and,
once the [state-defined interface note](2026-11-10-state-defined-interface.md) §4.1
lands, refused tool calls per gate. No path takes one of those records and makes a task
from it, so the suite grows only when someone invents a scenario.

### 3.4 A gate has been tuned and re-measured on the same fixture

The sloppy report on `slugkit` showed `glossary-lint` refusing correct work over a word
in a commit message (DEBT row 36). The check was attenuated in
[#47](https://github.com/MetaCoding-io/regulator/issues/47), and the regenerated sloppy
report on `slugkit` is the evidence that the attenuation works. That report shows the
change does what it was written to do on the case it was written for. It is not evidence
about any other case.

The Harness² note (§9, "Three sets, not one") makes this point for the reflector's probe
arm. It applies equally to a person changing a gate by hand, and nothing says so.

## 4. Proposals

In the order to take them, which is cheapest first and not the order of value. §4.3 is
the one that changes what the project can learn; §4.1 and §4.2 make the next live
report worth more and should land before it runs. Each is stated at a
[mechanism level](../ARCHITECTURE.md#mechanism-hierarchy) and against an existing seam.

### 4.1 A per-task table in the report

Add to the report, beside `arms` and `lifts`, a summary per task: for each task, arm and
metric, the mean over repetitions, and for each non-baseline arm the difference from the
baseline's mean on that task and which arm leads. Computed in `core/src/evals.ts` from
the runs the report already keeps; an optional field on `EvalReportSchema`, so the
committed reports stay valid. Level 1 for the schema, level 2 for the computation.

`regulator eval` and the control room's Assurance view print it under the arm table. The
interpretation rule gains one sentence: name the task where the gated arm lost most.

Two limits to state on the card. Tasks run in order in one instance, so a task's row
includes what the earlier tasks left behind; the table shows where in the sequence a
difference appears, not six independent results. And at three repetitions a per-task
mean is three numbers, so the table is for reading, with no interval and no `separated`
flag.

### 4.2 A baseline that discriminates

Give the report a derived statement of whether the baseline arm failed at all: for each
outcome metric the suite pre-registered, whether the baseline's maximum over its runs is
above zero. A report where none is carries that fact as a field, `regulator eval` prints
"nothing to catch: cost only", and the lifecycle view does not count an ablation arm of
such a report as evidence toward a retirement condition. Level 2.

With it, a procedure for a live run, written into `OPERATING.md`: run the baseline arm
alone for one repetition first (`--arm` already selects arms), and pay for the other
arms only if it drifted.

To settle before an issue:

- **Which metrics count.** The five outcome graders are the obvious set. Declared
  metrics carry a direction and built-in ones do not, so "above zero" needs either a
  direction on the built-ins or a named list in `protocol`.
- **Whether it refuses.** A cost-only report is still worth committing, as the first
  live one was. The proposal is a label and an exclusion from retirement evidence, not a
  refusal by `regulator check`.

This was not added to #130: that issue was the two scripted foils and closed with #184.
It is owed, with §4.1, before the next live run, and the two would be one issue in 0.2.

### 4.3 From a record to a task

A way to turn one unit's record in an instance into a candidate eval task: the contract
the unit ran under, the repository at the unit's base revision as the fixture, and the
check or gate that refused as the thing the task is expected to exercise. A person
accepts a candidate into a suite; the harness never adds one. Level 2 for the capture,
with the acceptance as a decision on the record.

This is the article's "production failures become dataset examples", and it is the only
proposal here with no earlier note behind it. It is also the direct answer to §3.2:
tasks drawn from where a model did fail pull toward failure in a way designed ones may
not.

To settle before an issue:

- **One fixture per suite.** A captured task brings its own repository state, and a
  suite has one fixture for all its tasks. Either a captured task is a suite of one, or
  a task may name its own fixture.
- **Whose code it is.** An instance's repository belongs to whoever runs it. A capture
  must be a deliberate export by that person, with the redaction the span export
  already applies, and nothing leaves the instance by default.
- **What counts as a failure worth keeping.** A closeout refusal that a retry repaired
  is the clearest case. A budget halt is a cost event, and the live runs have many.
- **Sequence.** The drift suite measures accumulation over six units. A captured task
  is one unit, so it tests whether a gate catches a known failure, not whether drift
  builds up. Both are wanted; they are different suites.

The first step needs no mechanism: when a live run next produces a closeout refusal,
write the task by hand and record in this note what the capture would have had to carry.
The five live runs so far produced harness defects and budget halts and no refused
drift, so there is nothing to capture from them yet.

### 4.4 Do not re-measure a gate on the fixture it was tuned on

A rule, stated once: when a regulator is changed because of a report, the report cited
as evidence that the change works must come from a fixture or tasks other than the ones
that motivated it, or its interpretation must say that it is the same case and shows
only that the change does what it was written to do.

Level 5 today: a sentence in the interpretation rule of
[evidence about the regulators](../concepts/evidence-about-the-regulators.md#the-interpretation-rule)
and in `CONTRIBUTING.md`. It could become level 2 if a card's evidence named the report
that motivated a change, since `regulator check` could then refuse the same suite and
fixture as the evidence for it. That waits until there is a second fixture to cite.

Two consequences now:

- The regenerated sloppy report's interpretation should say it is the tuned-on case
  (§3.4).
- The Terminal-Bench tasks in the
  [minimal-harness note](2026-11-05-minimal-harness-and-terminal-bench.md#5-terminal-bench-20-with-regulator)
  are the first held-out set the project would have. They keep that value only if no
  gate is adjusted in response to a result on them.

## 5. What is not taken

- **Advice on judges** (narrow questions, pass or fail, agreement with people first).
  Already designed: #49's judged metrics and the instrument record kind (DEBT row 48).
  The pass-or-fail point is worth carrying into #49 when it is picked up.
- **Single-fault foils.** The drifter trips several checks at once, so every ablation
  arm closes nothing and no regulator gets a row of its own. A foil per regulator would
  fix that. It would be a follow-up to #130's two foils and is not tracked separately.
- **Tiered runs** (fast checks on every merge, slow evals before a release). The
  committed reports are validated under `pnpm check` (`evals.test.ts`); whether the
  scripted reports should also be regenerated and compared in CI was not looked into.
- **"A handful of examples is enough to start."** True for improving an agent. Not for
  a retirement claim, where the `eval-harness` card's third limitation already says
  three repetitions separate few intervals.
- **Online evaluators and dashboards.** The host checks run on every unit and the
  control room reads the stores; these are the article's product, not a gap.

## 6. Where this lands

A threads row in `ROADMAP.md` with §4.1 as the next step. No `DEBT.md` row: no card's
limitation changes until one of these is built. §4.1 and §4.2 fit in 0.2, before the next live
report;
§4.3 and §4.4 are unscheduled.
