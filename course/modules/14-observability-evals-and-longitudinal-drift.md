# Lesson 14 — Observability, evals, and longitudinal drift

**Part 6 · Proving it and shipping it** · ~60 min instruction · ~150 min lab · builds **checkpoint 13**

> You added all this regulation. Did it help, or does it just feel rigorous?

Thirteen lessons have added thirty-two regulators, each to absorb a failure a model
produced on a particular day. Every one of them costs something on every run: a child
process at closeout, a diff against the base, a section in every prompt, an attempt spent
on a refusal, a person's attention. The registry has said since lesson 02 what each one
absorbs and what it does not; nothing yet says whether any of them still *helps*, and
nothing says what one of them costs against what it saves. Lesson 09 refused to close a
unit on its own claim. This lesson refuses to keep a regulator on its own — the same
rule, one recursion level up. It builds the harness that produces evidence about the
regulators, the projection that lets anyone join that evidence to the records, and the
two fields every registry card now has to carry: how you switch it off, and when it may
go.

**Prerequisites.** Checkpoint 12 passing. A model configured for `pi` for the live drills;
the committed evidence is headless.

---

## 1. The question

Regulation is an intervention, and an intervention owes an experiment: a control arm
and a treatment arm on matched tasks, metrics declared before the run, repetitions
because agent runs are stochastic, and a report that says where it ran, since
infrastructure alone moves coding-agent scores by points. The short-horizon metrics —
did the unit close, how many attempts, how many tokens, how long — are the easy ones and
the ones most evals stop at. The longitudinal one is the reason this project exists:
after six related units, how much did the *architecture* drift, and did the treatment arm
drift less? Lesson 12 recorded the scenario for exactly this measurement. This lesson runs
it.

Two things make agent evals harder than they look, and the harness is built around
both. Outcome and trajectory are different questions: a unit can reach a clean
repository by a route the gates should have refused, and a clean trajectory can leave
drift no gate measures. So there are outcome graders that read the resulting
environment and never the transcript, and trajectory graders that read the records the
orchestrator and the regulators wrote, and both are reported. And the number is never
the conclusion: a report without a person's interpretation is a table, and the schema
refuses it.

## 2. Concept

### Arms change only what the definition declares

An arm is a declaration, not a fork of the loop: which checkpoint extensions a live
session loads, which host checks the implement unit type runs, and — for an ablation
arm — which registry record it switches off and by which switch. The harness applies an
arm by rewriting the workload's check lists and the contract's evidence expectations; the
loop, the policies and the stores are the same code under every arm. The control arm of
the drift suite is checkpoints 2–8 and the test suite as the only check; the treatment
arm is checkpoints 2–12 with the full list; the two ablation arms are the treatment minus
one check each. A control arm's contract asks only for what the arm can observe, so a
control run is not refused for lacking evidence it was never asked to collect.

### A criterion observed by content

Lesson 09 bound evidence to criteria by class, and `docs/DEBT.md` has carried the cost
since: a passing suite that never exercises the changed behaviour satisfies a test-class
criterion. An evidence expectation may now carry a *check* — `export-signature` names a
module, an export and the parameter count it must keep — and at closeout the host imports
the module in its own process at the unit's HEAD and reads the function. The record binds
to that one criterion, so nothing else can satisfy it; and a runtime-class criterion with
host evidence no longer waits for a person, because a probe observed it. It is the
drift scenario's signature check, and it is any expectation's to carry.

### Evidence anyone can join

Every append-only record an instance keeps — units, attempts, budgets, evidence, verdicts,
decisions, effects, obligations, interactions, memory — is now one read: OpenTelemetry
GenAI spans, `invoke_agent` per attempt, `execute_tool` for checks, effects and
deliveries, `chat` for what the budget ledger knows of the model calls, correlated by
`vsm.unit.id`, `vsm.attempt`, `vsm.evidence.id`, `vsm.obligation.id`, `vsm.regulator.id`
and the policy version. The transcript is never projected. Redaction is not optional:
every string attribute passes the instance's canary values and a list of credential
shapes before it leaves the store, and a span that had something redacted says so. The
join key the control room has needed since lesson 06 — which regulator fired on which
attempt of which unit — is an attribute on every span.

### Every regulator can be switched off, or says why not

Every active record now carries an ablation switch — `check:identity-untouched`,
`extension:cp9-authority`, or `none` with the reason the harness cannot throw it — and a
retirement condition, or `regulator check` refuses the record. The harness throws two
kinds of switch, a host check and a checkpoint extension for a live arm; a regulator
whose switch is `loop:`, `policy:` or `none` has no arm the harness can run, and the
lifecycle view says so rather than pretending. `regulator review --due` lists what is
overdue by the date each record carries. Retiring a regulator is a recorded decision: the
record's status becomes `retired` and it keeps its history.

### The honest row

The production plan's exit criterion for this phase asks for an eval report that is
honest about at least one row where the gated arm loses. The committed reports have
three. Against a unit that will not repair, the treatment arm closes nothing: the
signature check refuses the first unit three times, every later unit re-applies the same
fix, and six units cost eighteen attempts and land nothing — the gate is right and the
cost is real, and the interpretation says the recovery policy should hand a stubborn unit
to a person sooner than the third attempt. Against a unit that keeps every boundary and
drifts in prose and vocabulary, the treatment arm refuses nothing and the drift is
identical in both arms: the mechanisms absorb what they check and the graders measure the
rest. And a root-level configuration file passes every closeout check in both arms,
because the gate that would have refused it lives in the session and a scripted unit
never runs one. Over-regulation is a real failure mode; so is regulation that measures
the wrong thing. The response to either is attenuation and a better check, not a louder
prompt.

### Which level this is

The suite, the report and the span are level 1: schemas the definition check and the
projection validate. The harness, the graders and the lifecycle rule are level 2:
deterministic, and none of them is a judge model. The interpretation is deliberately
level 5, and required.

## 3. Mechanism

### Student's t, not the normal approximation

Three repetitions is the normal case for an agent eval, and at n=3 a normal interval is
a lie. The summary uses the t quantile for the degrees of freedom it has, and a lift
between arms reports whether the two intervals separate — a screen, not a significance
test, and the report says which. n counts runs, and the six tasks of one repetition are
not six independent trials: the interpretation has to say what n was.

### `Function.length` at HEAD

The signature probe imports the module in a child process and reads the export's
declared parameter count. It stops at the first defaulted parameter, so a defaulted
second argument passes as a one-argument signature — the caller's contract — and a
required second one fails. A module that cannot be imported is inconclusive, never a
pass.

### `git diff <base>..HEAD` and `<base>...<branch>`

The boundary grader reads what changed outside the writable prefixes on the base and on
every surviving unit branch, so drift a blocked unit left on its branch is counted even
though it never landed. The vocabulary grader reads added comment lines and commit
messages; the rules grader reads added lines of the root's prose files. Patterns and
structure, validated against three scripted units, not against a model's actual drift.

### Redaction before projection

A value list (the instance's canaries) and a pattern list (API keys, cloud credentials,
bearer tokens, `PASSWORD=` shapes, private-key blocks) over every string attribute, with a
length bound. A credential with a shape neither list knows passes through; the card says
so.

### `checkRegistry`, again

A record without `ablation` or `retirement` is a problem, like a gate without a
limitation was in lesson 02. The schema grew; the check grew with it; thirty-six records
pass.

## 4. Build: checkpoint 13

### The vocabulary — [`packages/protocol/src/evals.ts`](../../packages/protocol/src/evals.ts), [`spans.ts`](../../packages/protocol/src/spans.ts)

Arms, suites, runs, grader verdicts, metric summaries, lifts, the environment
fingerprint and the report; the ablation switch grammar; span records and the GenAI and
`vsm.*` attribute names. `contracts.ts` gains the expectation check; `workload.ts` the
`export-signature` check name; `registry.ts` the `ablation` field.

### The arithmetic and the projection — [`packages/core/src/evals.ts`](../../packages/core/src/evals.ts), [`spans.ts`](../../packages/core/src/spans.ts)

`summarize`, `summarizeArms`, `lifts`; `projectSpans`, `redact`, `reportSpans`;
`reviewDue` and the two new registry rules; the definition check validates suites and
committed reports.

### The check — [`packages/checks/src/verify.ts`](../../packages/checks/src/verify.ts)

`export-signature` from the contract's carrying expectations; `bindEvidence` binds by
content when a result names its criterion; `technicalVerdict` takes host evidence before
acceptance for a runtime criterion. `checkResultReport` no longer asks the unit to cite
evidence the host will produce.

### The harness — [`course/lab/src/evals.ts`](../lab/src/evals.ts), [`graders.ts`](../lab/src/graders.ts), [`evals-scripted.ts`](../lab/src/evals-scripted.ts)

`runSuite` (one instance per arm × repetition, the tasks through `driveUnit`),
`contractForArm`, `workloadForArm`, `fingerprintFor`, `ablationCoverage`; the five
outcome graders and the trajectory counts; three scripted learner-style units —
reference, drifter, sloppy — that the graders are validated against.

### The suite and the reports — [`course/lab/evals/drift.json`](../lab/evals/drift.json), [`course/lab/evals/reports/`](../lab/evals/reports/)

Six contracts under `contracts/drift/`, in order; four arms; three repetitions;
fourteen pre-registered metrics. Three committed reports, one per scripted unit, each
with its interpretation under `evals/interpretations/`, each stamped `scripted:` in its
fingerprint. `regulator check` validates all of it.

### The CLI — [`course/lab/src/lab-cli.ts`](../lab/src/lab-cli.ts)

`regulator eval <suite> [--behaviour …] [--arm …] [--reps n] [--out file]
[--interpretation file] [--by who] [--keep]`, headless with a scripted unit or live
through the Pi dispatcher under each arm's extensions; `regulator spans [--json]`;
`regulator review [--due] [--within days]`.

### The read model and the control room

`DefinitionView.evals`, `.reports` and `.lifecycle`; the assurance view (suites, arms,
every committed report as a metrics table with intervals and the overlap chip, the
interpretation) and the lifecycle view (review date, switch, coverage, condition) in the
control room; the inspector shows a regulator's lifecycle line.

### Registry cards

`behaviour-check` (S3\*), `eval-harness` (S3\*), `span-projection` (S3\*, level 1),
`regulator-lifecycle` (S5); every one of the thirty-two existing records gains
`ablation` and `retirement`. Thirty-six records. `docs/DEBT.md` strikes rows 1, 2 and 3,
narrows 26, reschedules 11 and 15 with reasons, and opens 31–35.

## 5. Break it

Five drills.

**Drill 1 — read the committed reports.** `regulator status --definition course/lab`
and the control room's assurance view. For each of the three reports, find the row where
the gated arm loses and check the interpretation's claim against the numbers: the
drifter's zero closed at eighteen attempts, the sloppy unit's identical vocabulary drift
in both arms, the config file no closeout check refused. Then read the intervals: which
lifts separate, and what n each one rests on. Write down the one you would not have
believed from the mean alone.

**Drill 2 — the live run.** `regulator eval course/lab/evals/drift.json --arm treatment
--reps 1 --keep` with a model configured: no `--behaviour`, so the Pi dispatcher runs
each unit under the arm's extensions. Read the report against the scripted one: does the
model drift where the drifter did, or where the sloppy unit did, or somewhere no scripted
unit went? Then `regulator spans --json` in a kept instance and join the `invoke_agent`
spans to the evidence spans by `vsm.attempt`. Keep the report out of `evals/reports/`
until you have interpreted it; then commit it with `--interpretation`.

**Drill 3 — the wrong screen.** Copy `packages/core/src/evals.ts` and replace the t
quantile with 1.96. Re-summarize the drifter report's `attempts` metric at n=3 (one
repetition, one task at a time). Count how many lifts now "separate" that did not. This
is the argument for the table in the code.

**Drill 4 — a check that lies by default.** Give the drifter's two-parameter `slugify`
a default on the second parameter and run the harness: `export-signature` passes,
because `Function.length` stops at the first default. Decide what the check should
observe instead — the parameter list from the source, the behaviour under two arguments —
and what each would cost at every closeout. Row 35 is the question; write your answer
under it.

**Drill 5 — retire one.** Pick the regulator you think has earned retirement (the
vendor write gate is the obvious candidate: checkpoint 9 supersedes it in every live
arm). Read its retirement condition and its switch. Write the suite that would satisfy
the condition, and say honestly whether the committed evidence does. Then set its status
to `retired` in a copy of the card and run `regulator check`: the record stays, the
`BOUNDARY.md` entry goes, and the history is intact.

## 6. Field study: publishing a cost claim with its measurement

**VSM-Pi.** The drift scenario under [`course/lab/drift/SCENARIO.md`](../lab/drift/SCENARIO.md)
against what the committed reports actually measured. Three of the five measures have a
grader; cost has the budget's numbers only in a live run; memory hygiene has the
rules grader and the memory store's count. For your notes: which measure in the scenario
did the harness change the meaning of by making it mechanical, and was the change honest?

**GSD-Pi.** Its token-consumption savings claim and the measurement it publishes beside
it. Read the claim for the four things a fingerprint carries here — model, harness
revision, dispatcher, environment — and for what the control arm was. A cost claim
without its arm is a number.

**Pi.** `docs/session-format.md` and `docs/sessions.md` at `v0.87.0`: the session file as
a durable record, and `/tree`, `/fork` and `/clone` as counterfactual branches from an
identical prefix. The harness never reads the session file; the spans are the evidence.
For your notes: which trajectory metric would a fork-based counterfactual give you that
the records cannot, and what would it cost in tokens per arm?

## 7. Checkpoint

You have finished checkpoint 13 when:

1. `pnpm check` passes — including `evals.test.ts` and `spans.test.ts` in core (the t
   table, summaries and lifts; the projection with redaction), the `export-signature`
   test in checks, `evals.test.ts` in the lab (the suite as a declaration, the three
   scripted units under both arms, the committed reports), the lesson-14 CLI test
   (`spans`, `review`, `eval`), the read model and control room tests with the assurance
   and lifecycle views, and the registry tests with thirty-six records and the definition
   check clean over the suite and the reports.
2. Drill 1's one surprising interval is written down with its n.
3. Drill 2's live report is committed with an interpretation, or the reason it is not is
   written down.
4. Drill 4's answer is under row 35.
5. `regulator review --due --within 90` lists what the next quarter owes.
6. `docs/DEBT.md` has rows 1, 2 and 3 struck and rows 31–35 added.
7. Your notes hold drills 1–5 and the field-study answers.

## Further reading

- OpenTelemetry semantic conventions for generative AI: `invoke_agent`, `execute_tool`,
  the `gen_ai.*` attributes, and what the conventions say about recording prompts.
- Pi docs at `v0.87.0`: `session-format.md`, `sessions.md`, `json.md`.
- Student's t and why small-n intervals are wide; pass@k versus reliability across
  repeated trials.
- This repository's [`docs/DEBT.md`](../../docs/DEBT.md), the committed reports under
  [`course/lab/evals/reports/`](../lab/evals/reports/), and the registry's
  ablation and retirement fields in [`course/lab/registry/REGULATORS.md`](../lab/registry/REGULATORS.md).
