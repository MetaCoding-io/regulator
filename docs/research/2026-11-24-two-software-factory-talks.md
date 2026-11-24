# Two software-factory talks read against the control plane

- **Status:** open. No issue yet; §6 names six next steps and the order to take them in.
- **Sources:** two talks from the AI Engineer channel, about twenty minutes each.
  Dex Horthy (Factory, formerly HumanLayer), "12 Rules for a Software Factory That
  Doesn't Ship Slop" ([video](https://www.youtube.com/watch?v=-NFMsM2y0Vk)); and Armin
  Ronacher (Earendil), "Build the Workshop Before the Software Factory"
  ([video](https://www.youtube.com/watch?v=JNexz3Tbiu8)). Both were read from YouTube's
  auto-generated captions. The slides and charts were not visible, so figures are as
  spoken, some product and model names are garbled, and the numbering of Horthy's rules
  is a reconstruction. Each talk's numbers are the speaker's own and were not checked
  against the benchmark paper or the session data.
- **Why a note:** the talks pull in opposite directions and regulator already sits
  between them. Horthy argues for building the factory with more automated pressure on
  both ends. Ronacher, who works on Pi (regulator pins
  `@earendil-works/pi-coding-agent` 0.87.0), argues that the harness matters less each
  model release and that human attention sets the pace. Both name one failure regulator
  does not measure, and Ronacher reports two trends that widen holes the registry
  already states.

Claims about what the code does today cite the file. They were read on `main` at
`226d4c6`. One of the fifty-three registry cards (`sensor-intake`) was read in full;
limitations on the others may add detail.

## 1. What Horthy says

A software factory is ordinary engineering plus two forces: *forward pressure*, which
starts work, and *back pressure*, which lets agents improve an outcome without a person.
The rules, as far as the audio gives them:

1. **Forward and back pressure.** Route feature requests and incidents to the factory;
   put agentic review, tests, CI and linters behind the build step.
2. **Know your enemy.** Unattended models do not keep a codebase maintainable over time.
   He cites SlopCodeBench, which scores a model on evolving a codebase across
   checkpoints; top scores are around 15 to 16%.
3. **Plan before you build**, scaled by "expected pain": how likely a decision is to
   change, times how hard it is to change.
4. **Align visually.** Mock-ups, tables and charts in place of walls of text.
5. **Help agents test their work** with screenshots, browsers and real builds.
6. **Fight slop with lint rules** written from what models actually produce.
7. **Slop is a tool.** Prototypes and flagged experiments do not need the full standard.
8. **Compound over time:** evaluate everything and learn from past sessions.
9. **Unify your forge:** keep designs and decisions beside the code.
10. **You cannot buy verification.** Only the team knows how its code should be tested.

The second half is an anti-slop manifesto. Its working definition: slop is output that
cost its producer less effort than it costs its reader to understand. Its operating
claim: verifiers and linters are useful and not sufficient, so people still review a
subset, chosen by stakes.

## 2. What Ronacher says

Build the workshop first: use agents to make more ambitious, higher-quality software,
not simply more of it. His claims, with the figures he gives from his own Pi sessions:

- **The harness has not changed; the models have.** Pi's core tools are the same as a
  year ago. Harness tricks he relied on, such as an auto-research plugin, are no longer
  needed.
- **Agents run longer and need less correcting.** The 90th-percentile run in response to
  one task went from about 2.5 minutes to 14 minutes or more. His corrections per session
  fell with each model.
- **Agents reach for the shell.** Current models use bash far more than the other
  provided tools, with no configuration change.
- **Human attention sets the pace.** His prompts stay at roughly 120 to 190 a day while
  agent-active time grew to several working days per day. He started 141 repositories in
  a year and returns regularly to 10 to 15.
- **Full automation does not replace caring.** A friend automated an open-source project
  end to end, then turned it off when he lost interest and wanted the tokens elsewhere.
- **Know when to push back.** An agent is rewarded for completing the goal, which is easy
  to check; whether the system still fits together is not.
- **Stay inside your own understanding.** He has the agent produce a short executive
  summary and a typeset HTML page before it starts verification, about 70% through a
  run, because he often no longer reads the code.
- **Resist uncontrolled growth.** Agents make it cheap to reimplement any format or fork
  any project, and the implementations then diverge. Shared standards and upstreaming
  are human-coordination problems.
- **Aim at excellence:** verified software, memory-safe languages, lower memory use.
- **Where the harness still has work:** durable agents that suspend, resume and restart
  themselves on long runs, and "code mode", where the agent writes a script that makes
  many tool calls outside the context, with cheap classifier models at its decision
  points.

## 3. Where the talks agree and differ

They agree on the diagnosis and differ on the remedy.

| Question | Horthy | Ronacher | Regulator today |
| --- | --- | --- | --- |
| Do agents erode a codebase over time? | Yes; cites a benchmark | Yes; from experience | Untested: the live run saw no drift in six units |
| What is scarce? | Human review time | Human attention | Same: an attention budget per attempt |
| Should work start automatically? | Yes: route requests and incidents in | Doubtful: the automated project was switched off | No: a sensor opens an obligation and a person decides |
| How much does the harness matter? | A lot: rules, linters, verifiers | Less each release; most tricks expire | A lot, with a retirement condition on every regulator |
| How should a person keep up? | Visual plans and mock-ups | A typeset summary before verification | Typed reports and one-line outbox questions |
| Is unreviewed output acceptable? | Yes, where stakes are low | Not addressed | No tiering: one check list per unit type |
| Where does the harness go next? | More verification and review agents | Durable runs and code mode | Leases, resume and the effect journal exist; code mode is unaddressed |

The sharpest difference is the harness row. Horthy's rules are harness engineering;
Ronacher's data says the model did most of the improving while his harness stood still.
Regulator's own evidence so far is closer to Ronacher's: the first live report
(`packages/regulator/evals/interpretations/drift-live-2026-11-08.md`) reads itself as a
cost measurement, 65% more tokens per unit under the treatment arm with every drift
grader at zero in both.

## 4. Against the control plane

### 4.1 Covered today

| What the talks ask for | Who | Where it is |
| --- | --- | --- |
| Verification the agent does not control | Both | Host-run checks at closeout (`packages/checks/src/verify.ts`); `inherited-tests` judges a unit by the base's suite |
| Plan before building | Horthy | Contracts with fixed, delegated and unresolved decisions, each fixed one citing an authority (`packages/protocol/src/contracts.ts`) |
| Durable, resumable runs | Ronacher | Leases with liveness, `resumeUnit`, the effect journal reconciled on restart, a fresh session on the same budget ledger |
| Attention as a budget | Both | `attention.blockingPerAttempt` in `policies/interaction.json`; human acceptance separate from the technical verdict |
| A summary offered mid-run | Ronacher | A non-blocking `recap` interaction kind (`packages/protocol/src/interaction.ts`) |
| Expiring harness tricks | Ronacher | `ablation` and `retirement` on every registry record; `regulator review --due` |
| Forward-pressure plumbing | Horthy | Sensor intake is complete and workload-generic (`packages/core/src/sensors.ts`); `policies/intelligence.json` declares three sensors, all the portfolio's |
| Quality-metric plumbing | Both | A workload declares a metric with a grader (`packages/protocol/src/metrics.ts`); `workload/software-development.json` declares none |

### 4.2 Covered once the backlog lands

| Item | State | What it would cover |
| --- | --- | --- |
| Declared checks, [#199](https://github.com/MetaCoding-io/regulator/issues/199) | 0.3, undecided between two options | Lint packs, quality commands and formal-verification runs as host checks. Today `run_checks` discovers only `node --check` per file and a protected-paths status check (`packages/checks/src/conventions.ts`), so a project's linter reaches closeout only inside `npm test`. |
| A numeric measure on evidence, with a comparison check ([ArticleMiner note §4.4](2026-09-25-articleminer-knowledge-production.md)) | open-questions backlog row, no issue | The substrate of a quality ratchet. As designed it compares attempt with attempt and asks for improvement; a ratchet compares a unit with its base and asks for "not worse". |
| The declared grader run at unit close ([Evolving Agent Teams note §4 item 2](2026-11-10-evolving-agent-teams.md#4-what-regulator-could-take-at-the-mechanism-level)) | proposed, no issue | The loop sees the quality number, not only the eval harness |
| The second live report, [#201](https://github.com/MetaCoding-io/regulator/issues/201) | 0.2, only the run remains | Each regulator's own ablation row: the first evidence on whether the cost buys anything |
| The dispatch recap ([team-of-experts note §3.1](2026-11-04-team-of-experts-into-an-expert-team.md#31-the-read-back-at-dispatch)) | proposed, undecided | The unit reads the contract back before its first effectful call |
| What a delivered question carries (open questions §6) | backlog row | The outbox sends one line; a person answering sees the question and not the grounds |
| Route on append, [#59](https://github.com/MetaCoding-io/regulator/issues/59) | 0.3 | Event-driven routing in place of polling |
| A behaviour probe a contract can carry, [#54](https://github.com/MetaCoding-io/regulator/issues/54) | 0.2 | A route to browser or screenshot evidence |
| The reflector | next after 0.2 | Learning from past sessions, as proposals a person accepts |

### 4.3 Genuine gaps

1. **Nowhere for erosion to show.** The drift fixture is 32 lines of source
   (`packages/regulator/fixture/src/`) over seven units, every drift metric in
   `evals/drift.json` measures conformance, and no row of the pathology catalog names
   structural erosion. Both speakers call this the main risk. The live-run note's answer
   to "a fixture that pulls toward drift" is the two scripted foils, which test boundary
   violations and not accretion over many features.
2. **No intake.** Work starts only from `unit drive <contract.json>`, and a contract's
   `provenance.createdBy` is the literal `"S3"`, written by hand. The `plan` unit type is
   declared, budgeted and routed, and no code consumes it; no tool drafts a contract.
3. **The shell.** `docs/DEBT.md` row 8 records that `bash` is outside the thrash
   detector, the effect journal and most of the failure observer, and the roadmap lists
   it as not planned: real isolation is the container's. Ronacher's data says the shell
   is becoming the main tool, so the uncovered share grows with each model.
4. **Code mode.** Regulator enforces at Pi's tool-call hook
   (`packages/regulator-pi/src/authority.ts`), and nothing in `packages/regulator-pi`
   mentions code mode. Whether tool calls made from an agent-written script pass that
   hook is not known. This is an inference from the enforcement point, not a tested
   failure.

Smaller: no cap on diff size per unit (the budget's dimensions are tokens, cost, wall
clock, turns and attempts), no lighter tier for prototypes, no visual evidence class, and
no suspend-for-cost. Budget ceilings are policy numbers, but the default 20-minute wall
clock in `policies/default.json` sits close to the 14-minute runs Ronacher now sees at
the 90th percentile.

### 4.4 Disagreements to decide

- **Should a signal start work?** Horthy says yes. `AGENTS.md` says intelligence raises
  an obligation and never replans, and the `sensor-intake` card says "Nothing here
  dispatches." Ronacher's switched-off project is evidence for regulator's side. A middle
  path keeps the invariant: a sensor opens an obligation, a `plan` unit drafts a contract
  as a proposal, and a person accepts it, as with `advice accept`. A blocking sensor can
  hold the unit that would answer it, which is why the portfolio's `new-export` is
  advisory; a red-base sensor would need the same care.
- **Is the control plane worth its cost?** Ronacher's year of data says model gains
  dwarfed harness changes. Regulator's live report shows the cost and no drift caught.
  This is the project's own central question, and it currently has cost evidence only.
- **Who may orchestrate?** Code mode has the agent compose workflows and sub-agents on
  demand. Regulator holds that the orchestrator is the only execution authority, and its
  form of the same idea is a declared `command` runner or a declared tool.
- **Block on lint, or measure first?** Horthy says add the rules. Regulator's convention
  is a metric, then advisory, then blocking after an ablation arm shows the check earns
  its place.

## 5. What not to take

- Routing feature requests and incidents straight to dispatch (§4.4, first item).
- Agent reviewers as the back pressure. `AGENTS.md`: S3\* is not merely a reviewer
  prompt; a model review is a judgment layer on top of host-owned evidence, and a judged
  metric waits on the instrument record kind (`docs/DEBT.md` row 48).
- The manifesto as identity text. Its claims are advice; the parts that can be checked
  are the gaps in §4.3.

## 6. Next step

In order, cheapest and most decisive first:

1. **Add one structural metric to the drift suite before the #201 run is spent.** A
   grader file and a declaration in `workload/software-development.json`, pre-registered
   in `evals/drift.json`, with no product change.
2. **Check code mode against Pi.** Establish whether script-made tool calls pass the
   tool-call hook at the pinned version and at current Pi. If they do not, this is a
   boundary hole that widens on upgrade.
3. **Revisit `docs/DEBT.md` row 8.** "Not planned" was decided when the shell was one
   tool among several. Record a decision on whether rising shell use changes that.
4. **Decide #199 as declared checks.** The ratchet check, lint packs and verification
   runs all depend on it.
5. **Write the software-sensor and plan-intake design** as §4.4's middle path, in this
   note or its own, before anything is built.
6. **Scope a fixture that can erode.** The largest piece of new work, and no thread
   covers it: many incremental features on a codebase big enough for structure to
   matter. It decides whether the drift experiment can produce benefit evidence at all.
