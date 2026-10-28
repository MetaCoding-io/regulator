# A portfolio under management as the third workload

- **Status:** Phase 1 landed ([#120](https://github.com/MetaCoding-io/regulator/issues/120), `roadmap:0.3`, under
  [#61](https://github.com/MetaCoding-io/regulator/issues/61)): the fixture, its six checks, the workload, the `manager` profile, the four
  contracts, the scripted close and the worked example ([`docs/examples/portfolio.md`](../examples/portfolio.md)),
  with the authoring guide ([`docs/guide/authoring-a-workload.md`](../guide/authoring-a-workload.md)). What it found is in the
  example's §5: the band lives in `benchmark.json` (a first draft had it in the target file, a unit's file), the harvest checks and the risk-tolerance check wait for their inputs, and
  `plan-rebalance` ran as a session until #122. Phase 2b landed ([#122](https://github.com/MetaCoding-io/regulator/issues/122)): the `command`
  runner, with `plan-rebalance` and `harvest-losses` as programs writing under `trades/proposed/` and a `confirm-trades` session that
  asks and copies the list under `trades/pending/`; the consent decision is recorded in §3 under the S1 table. Phase 2a landed ([#121](https://github.com/MetaCoding-io/regulator/issues/121), 2026-10-27): `place_trade`, a tool the workload declares with an
  irreversible effect, from which the gate derives the consent; the path grant on `trades/pending/` and the advice line are gone, and the
  landed paragraphs are in §3 and §5 row 2. Phase 2's other items are
  [#123](https://github.com/MetaCoding-io/regulator/issues/123) and [#124](https://github.com/MetaCoding-io/regulator/issues/124), open for work; Phase 3 is filed as [#125](https://github.com/MetaCoding-io/regulator/issues/125),
  blocked on the prediction record ([#138](https://github.com/MetaCoding-io/regulator/issues/138)); its other blocker, the
  open-metric row, landed as [#129](https://github.com/MetaCoding-io/regulator/issues/129) with this workload's turnover as the first declared metric. All six are sub-issues of
  #61 so they are found together. Filed 2026-10-25, ahead of the order §8 first gave, so
  the designed slices are not lost.
- **Source:** *Build a Robo-Advisor with Python (From Scratch)*, Rob Reider and Alexander
  Michalka, Manning 2025, cited below by chapter and section. The book is held in the
  private `MetaCoding-io/library` repository and is not reproduced here; a reader of this
  note needs the book for the arithmetic, not for the design. The second source is the
  finance example's own list of what it does not do
  ([`docs/examples/personal-finance.md`](../examples/personal-finance.md) §5), which this
  workload pays item by item. The decision to read the book for this purpose is the
  2026-10-24 row of [open questions §6](2026-09-25-open-questions.md#6-backlog--smaller-things-to-think-about).
- **Question:** can a portfolio under management, with rebalancing and tax-loss
  harvesting, run as a third workload under the control plane today, and what would the
  control plane have to grow to run it *well*: with host-owned evidence for every
  number, consent on every commitment, and S4 that senses rather than waits?

Claims about what the code does today cite the file. Claims about what the book does cite
the chapter. The rest is proposal.

## 1. What the book builds, and what of it is a check

The book builds a robo-advisor in Python: portfolio construction by convex optimisation
(ch. 10), risk parity (ch. 11), Black–Litterman (ch. 12), rebalancing against a target
with tax lots and a backtester (ch. 13), tax-loss harvesting under the wash-sale rule
(ch. 14), with financial planning by Monte Carlo (ch. 5) and reinforcement learning
(ch. 6), return measurement (ch. 7), asset location (ch. 8) and withdrawal sequencing
(ch. 9) around them.

The reason it is the right source for a third workload is the mechanism hierarchy. The
household ledger was chosen because most of its work is judgment sitting on arithmetic
that can be checked without judgment. A portfolio inverts the ratio: nearly all of it is
arithmetic, and the judgment is confined to a few named inputs. The book therefore
supplies, chapter by chapter, the thing the recipe in the finance example says to write
first and most domains lack: the domain's own deterministic checks.

| What the book computes | Where | What it is under the control plane |
| --- | --- | --- |
| Weights long-only and summing to one; a position bounded; a subset of assets held within a tolerance of a benchmark's weights | 10.2.1, 10.2.2, 10.3.2 | a level-2 check over a target file |
| A trade list that does not increase a deviation, does not trade past the target, and lands every position within a band of its target | 13.3.2 (the constraint classes) | a level-2 check over a trade list against positions and a target |
| Which tax lot a sale comes from, ordered by effective tax rate and holding period | 13.2.3, 13.3.2 | a delegated decision with a check that every sell names a lot the portfolio holds |
| Whether a sale or a purchase would create a wash sale, given the lots and a 30-day window | 14.2.1, 14.2.2 | a level-2 check over a trade list against the lot history |
| The cost-basis adjustment a wash sale forces | 14.2.2 | a level-2 check over the lots file after an executed trade |
| Whether a harvest's tax benefit exceeds its trading cost and its opportunity cost | 14.3.1, 14.3.2, 14.3.3 | a level-2 check on a harvest the unit proposes; the opportunity cost needs a volatility input, which is a fixed decision |
| Turnover, tax cost, spread cost, mean and maximum deviation from target, over a history | 13.4.4 | graders for an eval suite, not closeout checks |
| The time-weighted and the dollar-weighted return of a portfolio with deposits | 7.1.1, 7.1.2 | a level-2 check on any return a report claims |
| A target allocation from expected returns, a covariance matrix and constraints | 10.3 | a program's output, verified by the checks above, never trusted as a claim |
| Expected returns updated by views with stated confidence | 12.3 | a judgment entering the pipeline as a typed, bounded input (§4) |
| The probability a plan succeeds over a horizon | 5.5, 5.6 | a prediction that resolves (§4) |
| A glide path by reinforcement learning | 6.1 to 6.4 | advice: an optimiser's output a person may adopt, never a decision |

The book's own position on verification is instructive. Chapter 10 §10.1.3 prefers
`cvxpy` over `scipy.optimize` because a disciplined convex program either solves or
refuses; it never returns a plausible wrong answer. That is the same preference the
prime directive states for the harness, and it is why the optimiser's *output* can be
checked by arithmetic a reader can recompute while the optimiser itself stays a program.

## 2. Why a third workload, not a larger ledger

The ledger's §5 lists five things it does not do. Each one has a natural home in a
portfolio and none has one in a ledger:

| The ledger does not… | The portfolio… |
| --- | --- |
| automate S4: the statement arrives by hand | has three sensors with thresholds the book defines: a drift band crossed (13.2.2), an unrealised loss worth harvesting (14.3), a new positions export or price file landing |
| derive consent from a tool's effect (DEBT row 29) | has a `place_trade` tool whose declared side effect is `irreversible`, writing a trade list a person executes, so the gate can derive the consent question from the effect declaration instead of the model noticing (landed, #121) |
| make its invariants identity | has a risk tolerance (2.5), a universe and a jurisdiction that are the person's, versioned, and written only through `identity accept` |
| resolve the unknown merchant | has the same open-item shape (a view the person has not given, a corporate action nobody has explained) and, in Black–Litterman, a way to carry a missing view as "no view" rather than a guess |
| run a session | is the first workload where several unit types *should not* run a session at all: rebalancing and harvesting are deterministic given their inputs, which is the `command` runner of [open questions §3](2026-09-25-open-questions.md#3-must-every-unit-run-a-pi-session) with a concrete case |

The ledger stays what it is: the small example with one dangerous action. The portfolio
is the example where the dangerous action is many trades at once, where the arithmetic is
real, and where S4 has something to sense.

## 3. Design first: the six questions

The method is the finance example's. Each answer sits at the highest mechanism level that
fits, with a reason whenever it sits lower.

### The domain, and where the truth is

| | For the portfolio |
| --- | --- |
| Domain output | `targets/<date>.json`, the target weights; `trades/pending/<date>.json`, a trade list the household has agreed to execute; `lots/lots.csv`, the tax-lot ledger derived from executed trades; `reports/<period>.md`, the period's review |
| Source of truth | `positions/`, the custodian's export of holdings and cash, and `prices/`, the price and dividend history. The harness reads them and never writes them. If the lots file and the positions disagree, the lots file is wrong. |
| The person's record | `trades/executed/`, what was actually traded, written by the person from the custodian's confirmations. A unit never writes there. |
| The person's choices | `universe.json`, the ETFs the portfolio may hold, grouped into sets the person considers exchangeable but not substantially identical (14.2.1, 14.3.3); `tax.json`, the rates, the long-term cutoff and the wash-sale window; `benchmark.json`, the reference weights a subset constraint holds to (10.3.2). A unit never extends any of them, as a unit never extends `categories.json`. |
| The domain's own checks | `test/portfolio.test.js`, the table in §1 as assertions: the target is feasible under the constraints, the trade list moves toward the target and not past it, every sell names a held lot, no trade in the list creates a wash sale against the lot history, the lots reconcile to the executed trades and to the positions, the report's return is the positions' time-weighted return, and a harvest's benefit exceeds its declared costs. |

The one rule carries over unchanged: **nothing reads its own progress off the
portfolio.** Whether a period is ingested, targeted, rebalanced or reviewed is execution
state in the orchestrator's store. What the lots file contains is domain state. What was
verified about it is regulatory state.

### S1 — What are the units of work, and what may each one touch?

| Unit type | Runner | Profile | May write | Checks at closeout |
| --- | --- | --- | --- | --- |
| `ingest-positions` | session | manager | `lots/`, `reports/` | `run_checks`, `run_tests`, `inherited-tests`, `identity-untouched`, `glossary-lint` |
| `propose-target` | session | manager | `targets/`, `reports/` | same |
| `plan-rebalance` | command (§5): `node workload/portfolio/plan-rebalance.mjs` | manager, as an effect declaration | `trades/proposed/` | same |
| `confirm-trades` | session | manager | `reports/`; `trades/pending/` through `place_trade` alone (#121) | same |
| `harvest-losses` | command (§5): `node workload/portfolio/harvest-losses.mjs` | manager, as an effect declaration | `trades/proposed/harvest-` | same |
| `review` | session | auditor | nothing | `run_tests`, `inherited-tests`, `identity-untouched` |
| `close-period` | session | auditor | nothing | — |

Three decisions in this table matter. The manager profile gets no shell, as the
bookkeeper does not, so the write grant is complete at the tool boundary — and a profile
with a shell could not be a program's effect declaration, since a program's reach is its
declared outputs and nothing wider. `lib/` and `test/` are under no profile's writable
prefixes, so a unit cannot weaken the check that judges it. And the two unit types whose
work is wholly arithmetic are command runners: the plan is produced by a program, under
a budget of wall-clock and not tokens, and the host checks the plan the same way it
checks a model's. Until #122 these two ran as sessions, which was the weaker of the two
and the reason the runner was the first thing this workload asked the control plane for.

**Decided (2026-10-27, consent and a program; #122).** The first draft of this table
had `plan-rebalance` writing under `trades/pending/`, the prefix the manager's consent
grant guards. A program cannot call `ask_human`, and #60 made "nothing exists under
`trades/pending/` before a yes" a gate, not advice; so a command runner declares its
outputs, and the definition check refuses one whose declared output prefix falls under
a consent grant of its profile — a program may not write where a yes is required.
Therefore `plan-rebalance` as a program writes the computed list to
`trades/proposed/<date>.json`, a manager-writable prefix under no grant, listed in the
fixture README as "a list a program computed; not yet agreed", and the consent plus the
write under `trades/pending/` stay with a session unit, `confirm-trades`, until #121's
`place_trade` takes the execution: the former p3 session, re-objectived to read the
proposed list, ask once naming every trade, and copy it unchanged after the yes, with
one assertion more in the suite holding the pending list to the proposed one, since the
consent records the path and not the content. `harvest-losses` is a command runner on
the same terms, writing every lot at an unrealised loss to
`trades/proposed/harvest-<date>.json` with no threshold and no benefit-versus-cost
check — that arithmetic is #124's, said so in the program's header. The lot choice and
the extent, delegated to the session before, are fixed decisions on the program's
contract, because a program has no judgment to report and the loop refuses a contract
that delegates to one.

**Landed (2026-10-27, #121).** `place_trade` took the execution. The workload declares
it under `tools[]` — a name, the schema the model sees, an effect on the four axes
(`sideEffects: "irreversible"`) and a program in the command runner's shape,
`workload/portfolio/place-trade.mjs`, run in the unit's worktree with the call's
arguments on stdin and `trades/pending/` as its whole reach — and the host registers it
generically from the definition. The consent is derived by the gate from the declared
effect, scoped to workload-declared tools: the `manager` profile grants `place_trade` by
name, lists no `consent[]` entry, and no longer writes under `trades/pending/` at all,
which the definition check now requires of a profile that grants an irreversible
declared tool (a plain write under its outputs would need no yes). The advice line that
said to ask before writing a trade list is deleted, since the refusal says it naming the
call. `confirm-trades` asks once, naming the call, and places the list with the tool
after the yes; the tool copies the proposed file byte for byte, so "copied unchanged" is
the tool's property and the suite's pending-equals-proposed assertion guards a bug in
the program, not a model's shortcut — the careless unit of #120 that trimmed the list
after the yes is impossible by construction, and the careless behaviour is now a unit
that calls the tool without asking, refused by the derived consent before the file
exists. One decision the prompt left open was taken against its own letter: it asked
that a declared tool's writes be refused when they land outside the writable paths of
every granting profile, and also that `trades/pending/` leave the manager's writable
paths; the two cannot both hold, and the second is what keeps the derived consent from
being bypassed by a plain write, so the check refuses the converse — a granting profile
that reaches the outputs directly. The record is `declared-tool`.

### S2 — What stops units from tripping over each other?

Unchanged: one worktree and one lease per unit, reintegration by the orchestrator, the
pre-merge trial, the thrash detector. One period belongs to one unit at a time. A trade
list is a file, so two units cannot each write half of one.

### S3 — What is a unit told, and what is fixed, delegated, unresolved?

The contract for `plan-rebalance` sorts its decisions into the three kinds:

- **Fixed:** the target is `targets/<date>.json` and is not changed by this unit; the
  universe and the exchangeable sets are `universe.json`; the band is the one the
  contract names (13.3.2's maximum-deviation constraint, with the tolerance as a number
  in the contract); the tax parameters and the wash-sale window are `tax.json`; the
  jurisdiction is the one `tax.json` declares, and the rules are its rules.
- **Delegated:** which lots a sale comes from, within the tax ordering (13.2.3), reported
  per sell; whether to trade all the way to the target or only back inside the band
  (13.2.3, *incomplete trading*), reported with the tax consequence of each.
- **Unresolved:** a position the custodian's export carries that the universe does not
  name. Its handling is *defer*: the unit does not trade it and the review carries it as
  an open item.

The contract for `propose-target` delegates one thing that is judgment and bounds it:
the expected-return inputs. §4 says how.

### S3\* — How do we know the plan is right without believing the unit?

The host runs `test/portfolio.test.js` against the committed revision and binds the
result to the unit, the attempt, the contract and the revision. A unit's "rebalanced,
within band, no wash sales" satisfies nothing; the suite's result does. The
`identity-untouched` check diffs `positions/`, `prices/`, `trades/executed/` and the
identity against the base, so an edit that got around a gate still fails at closeout.
After every merge the base is checked again.

The book's backtester (13.4.2) is *not* a closeout check, and the distinction matters.
A closeout check asks whether this plan at this revision kept the contract. The
backtester asks whether a strategy over a history did well, which is the eval harness's
question one level up, and it belongs in a suite (§5).

### S4 — What changes in the environment matter?

This is where the portfolio earns its place. Four kinds of intelligence, each with a
source the book names:

1. **A sensor over the domain.** A drift band crossed (13.2.2), a lot's unrealised loss
   crossing the harvest threshold net of costs (14.3), a new file under `positions/` or
   `prices/`. Each raises an `intelligence-signal` with an affected unit and an expiry,
   and the router opens the obligation. This is the sensor [open questions
   §2](2026-09-25-open-questions.md#2-a-person-should-be-able-to-create-s4-intelligence)
   proposes declaring in the definition, with three concrete sensors to declare.
2. **External intelligence with a shelf life.** Capital market assumptions published by
   asset managers (3.1.4) are expected returns with a publication date; they are what
   `remember` with an expiry and the intelligence signal's `observedAt` and `expiresAt`
   were built for, and the finance workload has nothing like them.
3. **A view.** Black–Litterman (12.3) takes an investor's view, a linear statement about
   returns with a confidence, and updates equilibrium returns under Bayes' rule, with the
   confidence bounding how far the view can move the result. Read through the control
   plane, a view is an intelligence signal whose claim is about the future, with a
   `confidence` that is a probability: the shape [open questions
   §4](2026-09-25-open-questions.md#4-predictive-intelligence-s4-as-a-model-of-outside-and-then)
   gives a prediction. It is raised by a `research` unit or a person, and consumed by
   `propose-target` under a fixed decision that caps the view's weight. This is the one
   place the book hands the architecture something new: a formal, numeric example of
   *intelligence can raise an obligation; it never replans on its own*, where "never
   replans" is a matrix the optimiser reads and a person set.
4. **A prediction that resolves, and one that cannot.** The probability a spending plan
   succeeds over a horizon (5.5) is a prediction with a horizon, a confidence and the
   evidence it was computed from; at the horizon it resolves, and the resolved pair is
   regulatory state. The same simulation over a retiree's lifetime (5.10) is a
   prediction that never resolves inside the instance's life, and the instrument card
   should say so: it is graded on calibration against nothing, which is a limitation
   worth having on the record rather than discovered.

None of this is scheduled by this note. The sensors are the first slice because they
have a seam (`regulator watch` already runs a channel command, `packages/regulator/src/deliver.ts`).

### S5 — What must the system never be able to do?

| Invariant | Checked by |
| --- | --- |
| The custodian's export and the price history are never written by a unit | `positions/` and `prices/` are outside the writable prefixes; `--protected` in the manifest means `identity-untouched` refuses the closeout if anything got past the grant |
| A trade list is written only after a person's yes to a consent question naming every trade | the contract fixes it; `ask_human` with `kind=consent` opens a blocking obligation and the pause gate refuses every tool with an effect until a person answers; silence is never consent (a protocol constant). `place_trade` is declared `irreversible` and the gate derives the question from that (#121, landed): the call is refused without the yes on the record, and `trades/pending/` is under no write grant |
| What was traded is the person's record | `trades/executed/` is outside the grant and protected |
| A unit never extends the universe, the exchangeable sets or the tax parameters | the three files are outside every writable prefix |
| The portfolio's risk stays inside the person's tolerance | the volatility bound (2.5, 10.2.1) is a number in the identity, and the target check refuses a target whose predicted volatility exceeds it |

The last row is the one the ledger could not have. A risk tolerance is a fact about the
person, versioned, changed by a decision and by nothing else; it is S5 policy in exactly
the sense `AGENTS.md` means, and it is a number a check can read.

### The algedonic channel — When must a person be interrupted?

Once per trade list, before the file exists. The question names every trade, the lots it
sells from and the tax it realises, because that is what a person is consenting to. Not
once per trade: a rebalance is one decision with many legs, and asking twelve times is
the attention budget spent on the wrong thing. The unresolved position and a missing
view do not interrupt; they are open items on the review, owed to a person, delivered to
the outbox and reminded about. A view the unit wants and does not have is a
`clarification`, which waits.

### Every rule, and its level

| Rule | Level | Why not higher |
| --- | --- | --- |
| The target is feasible under the declared constraints | 2, a deterministic check | — |
| The trade list moves toward the target, not past it, and lands inside the band | 2, a deterministic check | — |
| No trade creates a wash sale | 2, a deterministic check | — |
| Every sell names a held lot; the lots reconcile to executed trades and positions | 2, a deterministic check | — |
| A harvest's benefit exceeds its costs | 2, a check, with the volatility input a fixed decision | the opportunity cost prices an option (14.3.2); the input is a number the person fixes, not a judgment the unit makes |
| The report's return is the time-weighted return | 2, a deterministic check | — |
| Consent before a trade list | 2, the gate deriving it from `place_trade`'s declared effect, plus 3, the tool's effect contract, plus 2, the pause gate | — (landed, #121) |
| Which lot a sale comes from | 4, judgment bounded by the tax ordering, reported | the ordering is a rule; the choice among equals is the unit's |
| Which exchangeable ETF replaces a harvested one | 4, judgment bounded by the set and the wash-sale check | 14.3.3's ordering is advice; the check is what refuses a wrong one |
| The expected-return inputs | 4, judgment bounded by the view's confidence cap | it is judgment; the cap is fixed, the view is reported |
| Tone, thoroughness, "check the lots first" | 5, advice in the profile | advice by definition |

## 4. The architectural idea: a bounded judgment, in numbers

The control plane already has the words for a judgment that enters a mechanical process
without taking it over: a *delegated decision* with *bounds*, reported; an *intelligence
signal* with a *confidence*; an obligation the consumer dispositions. What it has not had
is an example where the bound is arithmetic.

Black–Litterman (ch. 12) is that example. The prior is the equilibrium return implied by
a reference portfolio (12.1.1). A view is a linear statement with a confidence (12.3.2).
The posterior is the Bayesian update (12.3.3), and as the confidence in a view falls, the
posterior returns to the prior and the optimised portfolio returns to the reference
(12.4.1, the paragraph after table 12.2). So the person who sets the view's confidence,
or caps it, sets exactly how far one judgment can move the result, and the mechanism that
enforces the cap is a matrix product anyone can recompute.

For the course this is a worked case of three things at once: a delegated decision whose
bounds are a number; an S4 signal consumed under S5 policy; and the difference between
*advising* S3 (the view) and *replanning* (the optimiser, which only ever runs under the
cap). For the control plane it is a candidate shape for the `confidence` of a prediction
record: not a label from `low` to `high`, but a number a consumer may weigh.

## 5. What the control plane would have to grow

Everything in §3 that is a file, a check, a contract or a profile runs today under the
mechanisms the finance workload runs under. The table lists what does not, at its level
and against its seam, in the order the phases (§6) need it.

| Needed | Level | Seam | Exists as |
| --- | --- | --- | --- |
| The domain's checks in Node | 2 | `test/portfolio.test.js` under `npm test`, discovered as the ledger's are (`packages/checks/src/conventions.ts`) | nothing new. **Decided here:** the checks are ported to plain JavaScript. They are arithmetic (sums, bands, date windows, lot reconciliation, a time-weighted return); none needs an optimiser. The alternative, declared checks for a non-Node domain (the ArticleMiner note §4.1), stays the right slice for ArticleMiner and is not forced by this workload |
| A `place_trade` tool with a declared effect | 3 | a workload-declared tool with `sideEffects: "irreversible"` (`packages/protocol/src/effects.ts`), writing under `trades/pending/` | **Landed (2026-10-27, #121).** `tools[]` on the workload definition (`DeclaredToolSchema`: name, description, parameters, effect, program), registered by the host's `declared-tools` extension and run through `runDeclaredTool` under the tool's declared outputs with the arguments on stdin; `consentRequiredFor` in core derives a bare grant from a declared tool's irreversible effect beside the profile's `consent[]`, read by the host's interception and the lab's `consentGate` alike, so `--amend` and consent across attempts hold as for a path grant; `readOnlyViolations`, `isReadOnlyProfile` and `effectOf` read the declared effects; `regulator check` refuses a declared tool with a built-in's name, a non-object schema, arbitrary execution, an effect that disagrees with its outputs, no program file, or a granting profile that writes under its outputs directly, and `regulator doctor` refuses an instance manifest whose writable prefixes reach them. The record is `declared-tool`; this workload was the case, as #60 needed, without a tool that moves money |
| The `command` runner for `plan-rebalance` and `harvest-losses` | 2 | the workload definition's unit type gains a `runner` (open questions §3) | landed as [#122](https://github.com/MetaCoding-io/regulator/issues/122): `runner: { kind: "command", argv, timeoutMs?, outputs[] }` on the unit type, the loop running the program itself through the same dispatcher seam under the policy's `wallClockMs`, the program's file hashed into the attempt record, its exit and last stdout line as the report, a write outside `outputs` undone and refused, and the definition check refusing a program without a file under the definition, under a shell-granting profile, or writing outside the writable paths or under a consent grant (`command-runner`). The two programs are plain JavaScript over `lib/portfolio.js`, not the book's Python: the arithmetic needed no optimiser, as §5's first row found for the checks |
| Sensors declared in the definition | 2 | `policies/intelligence.json` with `sensors[]` (open questions §2) | proposed; no issue. Three sensors here: a path glob over `positions/` and `prices/`, a drift-band command, a harvest-threshold command |
| Workload-declared metrics and graders | 2 | `workload/<name>.json` gains `metrics[]`, each with its grader argv; `EVAL_METRICS` becomes the built-in set (open questions §6, the ArticleMiner note §4.6) | landed as [#129](https://github.com/MetaCoding-io/regulator/issues/129): `workload:portfolio/turnover`, the one-way turnover the latest target implies against the custodian's positions, by `workload/portfolio/turnover.mjs` over `lib/portfolio.js`, pre-registered by `evals/portfolio-turnover.json`. The book's other summary statistics (13.4.4: tax cost, spread cost, mean and maximum deviation) and the backtester as the grader are #125's to declare the same way |
| The prediction record | 3 | the intelligence signal with `horizon` and a numeric `confidence` (open questions §4; the Harness² note §8 orders it second after #110) | designed; sequenced behind the accept-path split |

Two things this workload deliberately does not ask for. It does not ask the harness to
hold anything that moves money: a trade list is a file a person executes, as a pending
payment is. And it does not ask for live market data: the fixture carries a price history
as files, and a sensor over `prices/` fires when a file lands, which is how the statement
arrives in the ledger today.

## 6. Phases

**Phase 1 — the close, scripted (nothing new in the control plane).** [#120](https://github.com/MetaCoding-io/regulator/issues/120). The fixture: the
book's six-ETF universe and target (10.3, 13.3.4), a lots file in the shape of 13.3.2's
inputs, two periods of positions and prices as files, `universe.json`, `tax.json`,
`benchmark.json`, and `test/portfolio.test.js` with the checks of §1 ported to
JavaScript. The workload file, the `manager` profile (the `auditor` is reused), the
finance policy's sibling with budgets per unit type, and four contracts: ingest, propose
a target, plan a rebalance, review. The rebalance plan is produced by a scripted unit
with two behaviours, as the ledger's are: the `manager`, which keeps the contract, and
the `careless`, which trades past the target, sells from a lot it does not hold, and
creates a wash sale, each refused by the suite at the first attempt and repaired at the
second. Consent on the trade list through `ask_human`, paused, answered, closed. The
worked example page, written to the recipe in the finance example §6. This is what #61
asks for, with its authoring guide written from the experience of writing it.

**Phase 2 — the mechanisms the workload is the case for.** `place_trade` under #60
([#121](https://github.com/MetaCoding-io/regulator/issues/121), landed 2026-10-27: §3's landed paragraph says what the tool is and what the gate
derives from it); the `command` runner with the plan and the harvest candidates as programs
([#122](https://github.com/MetaCoding-io/regulator/issues/122), landed 2026-10-27: §3's decided paragraph says where a program may write and
where a session still asks); the three sensors ([#123](https://github.com/MetaCoding-io/regulator/issues/123)); the harvest contract with the
exchangeable sets and the wash-sale check live, the benefit-versus-cost check over the candidates the harvest program now
lists, and the lots adjusted for an executed wash sale (14.2.2) ([#124](https://github.com/MetaCoding-io/regulator/issues/124)). Each is its own issue against the seam named in §5.

**Phase 3 — evidence.** A suite over the fixture's price history with the book's
backtester as the grader and its summary statistics as pre-registered metrics; arms with
and without the band check and the wash-sale check, so the two regulators the workload
adds get ablation evidence; views as prediction records with a probe horizon; the
success-probability prediction with its horizon and the longevity one with its
limitation. [#125](https://github.com/MetaCoding-io/regulator/issues/125); waits on the prediction record ([#138](https://github.com/MetaCoding-io/regulator/issues/138)). The open-metric row ([#129](https://github.com/MetaCoding-io/regulator/issues/129)) landed with turnover as the first declared metric, so the suite's remaining metrics are declarations in the same shape.

## 7. What this note does not claim

- The book's tax rules are the United States' (14.1.2, ch. 8, ch. 9). The fixture
  declares its jurisdiction in `tax.json` as a fixed decision; it does not pretend to be
  neutral, and a second jurisdiction is a second file.
- The book is Python. Phase 1 needs none of it at runtime, because a scripted unit
  produces the plan and the checks are arithmetic. Phase 2's optimiser is the first time
  the book's code runs under the harness, and it runs as a program the host never
  trusts.
- Nothing here has been built. The checks in §1 are the book's listings read as
  assertions, not assertions that exist. The first thing Phase 1 will find is which of
  them a scripted careless unit actually trips.
- A view with a numeric confidence is a candidate shape for the prediction record, not a
  decision about it. The record's design is open questions §4's and the Harness² note's.

## 8. Next step

Build Phase 1 ([#120](https://github.com/MetaCoding-io/regulator/issues/120)), with §3's tables as the acceptance criteria and §5's
first row as its one recorded decision. Phase 2's issues ([#121](https://github.com/MetaCoding-io/regulator/issues/121) to
[#124](https://github.com/MetaCoding-io/regulator/issues/124)) open for work when #120 is merged, each against the seam §5 names;
#121 and #122 have landed, and #124 now starts from the candidates its program lists.
Phase 3 ([#125](https://github.com/MetaCoding-io/regulator/issues/125)) becomes a milestone row after the prediction record ([#138](https://github.com/MetaCoding-io/regulator/issues/138));
the open-metric row ([#129](https://github.com/MetaCoding-io/regulator/issues/129)) has landed.

**Decided (2026-10-25, James).** All three phases are filed at once rather than Phase 2
waiting for Phase 1 to merge and Phase 3 for its blockers, so the designed slices have a
number and are not re-derived; the order of work is unchanged.
