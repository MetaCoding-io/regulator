# Worked example — a portfolio under management

> *"I want a set of agents to manage my investments."*

The [household ledger](personal-finance.md) was the second domain under `regulator`, and
it showed which parts of the design are yours to make. This example is the third: a
portfolio of exchange-traded funds held at a custodian, rebalanced against a target once
a period, with a tax-lot ledger beside it. The design is in
[`docs/research/2026-10-24-portfolio-workload.md`](../research/2026-10-24-portfolio-workload.md);
this page is what the design's first phase became, file by file, and what it found.

It is a good third domain for one reason above the others. The ledger's work was
judgment sitting on arithmetic. A portfolio inverts the ratio: nearly all of it is
arithmetic, and the judgment is confined to a few named inputs. So the domain supplies,
in its own terms, the thing the ledger's recipe says to write first and most domains
lack: deterministic checks a reader can recompute. Whether a target is feasible, whether
a trade list moves toward the target and not past it, whether a sale is a wash sale,
whether the lots agree with the custodian, whether a stated return is the time-weighted
one: each is a sum, a band, a date window or a product, and none needs an optimiser.
The dangerous action is also plural here. A rebalance is many trades at once, so consent
has to be asked once for a list, not once per leg.

Everything below runs today. The fixture, the workload, the profile, the contracts and a
scripted manager are in [`packages/regulator`](../../packages/regulator/), and
[`packages/regulator/src/portfolio.test.ts`](../../packages/regulator/src/portfolio.test.ts)
drives the September close end to end under `pnpm check`. Nothing in the control plane
changed for it. The first half of this page is the part you do before writing any of
that; the [authoring guide](../guide/authoring-a-workload.md) is the same material as a
checklist, with what this example had to decide separated from what the harness decided
for it.

---

## 1. Design first: six questions, and the level each answer sits at

The method is the ledger's. For each function of the Viable System Model, ask the
regulatory question it exists to answer, then answer it with a *mechanism* at the
highest level of the hierarchy that fits (type → gate → typed tool → judgment →
prompt), and give a reason whenever the answer sits below the top.

### The domain, and where the truth is

| | For the portfolio |
| --- | --- |
| Domain output | `targets/<date>.json`, the target weights; `trades/pending/<date>.json`, a trade list the household has agreed to execute; `lots/lots.csv`, the tax-lot ledger derived from executed trades, with `lots/lots.json` saying the date it is current to; `reports/<period>.md`, the period review. |
| Source of truth | `positions/`, the custodian's exports of holdings and cash, and `prices/`, the closing prices on each export date. The harness reads them and never writes them. If the lots and the positions disagree, the lots are wrong. |
| The person's record | `trades/executed/`, what was actually traded, written by the person from the custodian's confirmations. A unit never writes there. |
| The person's choices | `universe.json`, the ETFs the portfolio may hold, grouped into sets the person considers exchangeable but not substantially identical; `tax.json`, the rates, the long-term cutoff, the wash-sale window and the jurisdiction; `benchmark.json`, the reference weights and the subsets a target holds within a tolerance of them. A unit never extends any of them. |
| The domain's own checks | `test/portfolio.test.js`, six assertions: the target is feasible, the trade list moves toward the target and not past it and lands inside the band, every sell names a held lot, no trade creates a wash sale against the lot history, the lots reconcile to the executed trades and to the positions, and the report's return is the positions' time-weighted return. |

The one rule carries over unchanged: **nothing reads its own progress off the
portfolio.** Whether September is ingested, targeted, rebalanced or reviewed is
execution state in the orchestrator's store. What the lots file contains is domain
state. What was verified about it is regulatory state.

### S1 — What are the units of work, and what may each one touch?

Five unit types, each under a capability profile. A profile is a grant over declared
tool *effects*, so the "may write" column is what the profile permits, and the last
column is what the host runs against the unit's committed revision at closeout:

| Unit type | Profile | May write | Checks the host runs at closeout |
| --- | --- | --- | --- |
| `ingest-positions` | manager | `lots/`, `targets/`, `trades/pending/`, `reports/` | `run_checks`, `run_tests`, `inherited-tests`, `identity-untouched`, `glossary-lint` |
| `propose-target` | manager | same | same |
| `plan-rebalance` | manager | same | same |
| `review` | auditor | nothing | `run_tests`, `inherited-tests`, `identity-untouched` |
| `close-period` | auditor | nothing | — |

Three decisions in this table matter. The manager gets no shell, as the bookkeeper did
not, so the write grant is complete at the tool boundary. `lib/`, `test/`,
`universe.json`, `tax.json` and `benchmark.json` are under no profile's writable
prefixes, so a unit can neither weaken the check that judges it nor widen the universe
it may trade. And `plan-rebalance` is a session in this phase although its work is
wholly arithmetic: the design says it should be a *command* runner, a program under a
wall-clock budget whose output the host checks the same way, and that runner is the
first thing this workload asks the control plane for ([#122](https://github.com/MetaCoding-io/regulator/issues/122)).
The `auditor` profile is the ledger's, reused as it is.

### S2 — What stops units from tripping over each other?

Unchanged: one worktree and one lease per unit, reintegration by the orchestrator after
the pre-merge trial, the thrash detector. One period belongs to one unit at a time. A
trade list is a file, so two units cannot each write half of one.

### S3 — What is a unit told, and what is fixed, delegated, unresolved?

The contract for `plan-rebalance` sorts its decisions into the three kinds:

- Fixed, which the unit preserves: the target is `targets/2026-09-30.json` and is not
  changed by this unit; the universe and the exchangeable sets are `universe.json`; the
  band is 0.02 of the portfolio's value, the number `benchmark.json` carries, and no trade
  moves a position past its target; the tax parameters and the wash-sale window are
  `tax.json`, and the jurisdiction is the one it declares; no file is written under
  `trades/pending/` until a person answers yes to one question naming every trade, its
  lots and its tax; `trades/executed/` is the person's.
- Delegated, which the unit chooses within bounds and reports: which lots each sell
  comes from, within the tax ordering (a loss before a gain, long-term before short-term
  among gains) and never a lot whose sale is a wash sale, reported per sell with the
  tax it realises; and whether to trade all the way to the target or only back inside
  the band, reported with the tax consequence of each.
- Unresolved, which the unit never settles and instead surfaces: two shares of VNQ, a
  position the custodian's export carries that the universe does not name. Nobody has
  said what it is or what it cost. Its handling is *defer*: the unit does not trade it,
  and the review carries it as an open item.

The contract for `propose-target` delegates one thing that is judgment, and bounds it:
the expected-return inputs. In this phase no view has been raised, so the inputs are
the benchmark's own weights read as the equilibrium, a tilt from them stays inside
every subset's tolerance, and the tilt is reported with its reason. The design's §4
says what that bound becomes when a view with a numeric confidence exists.

Budgets are set per attempt and per unit type in a policy file. The read-only types get
one attempt; `plan-rebalance` gets three, because its first is spent asking for consent
and a refused list still deserves a repair.

### S3\* — How do we know the plan is right without believing the unit?

The host runs `test/portfolio.test.js` against the committed revision and binds the
result to the unit, the attempt, the contract and the revision. A unit's "rebalanced,
within band, no wash sales" satisfies nothing; the suite's result does. The
`identity-untouched` check diffs `positions/`, `prices/`, `trades/executed/` and the
identity against the base, so an edit that got around a gate still fails at closeout.
Before every merge the merged tree is checked again, and only a passing tree lands.

The design's backtester is *not* a closeout check. A closeout check asks whether this
plan at this revision kept the contract. A backtester asks whether a strategy over a
history did well, which is the eval harness's question one level up, and it belongs in
a suite ([#125](https://github.com/MetaCoding-io/regulator/issues/125)).

### S4 — What changes in the environment matter?

This is where the portfolio earns its place, and none of it is in this phase. A drift
band crossed, a lot's unrealised loss crossing the harvest threshold, a new export
landing under `positions/`: each is a sensor that raises an intelligence signal with an
affected unit and an expiry, and the router opens the obligation
([#123](https://github.com/MetaCoding-io/regulator/issues/123)). Capital-market
assumptions with a publication date are what `remember` with an expiry was built for.
A view with a confidence is a prediction, consumed by `propose-target` under a fixed
decision that caps its weight. In this phase the exports arrive by hand, as the
statement did.

### S5 — What must the system never be able to do?

| Invariant | Checked by |
| --- | --- |
| The custodian's exports and the price history are never written by a unit | `positions/` and `prices/` are outside the writable prefixes, so the profile grant refuses the write in the session; `--protected` in the manifest means `identity-untouched` refuses the closeout if anything got past the grant |
| A trade list is written only after a person's yes to one question naming every trade | the contract fixes it; `ask_human` with `kind=consent` opens a blocking obligation and the pause gate refuses every tool with an effect until a person answers; silence is never consent, a protocol constant |
| What was traded is the person's record | `trades/executed/` is outside the grant and protected |
| A unit never extends the universe, the exchangeable sets or the tax parameters | the three files are outside every writable prefix |
| The portfolio's risk stays inside the person's tolerance | *not yet*: the design puts a volatility bound in the identity and a check on a target's predicted volatility; the bound is a number a person has not set and the check needs a covariance input, so neither exists in this phase (§5) |

The last row is the one the ledger could not have, and this phase does not have it
either. A risk tolerance is a fact about the person, versioned, changed by a decision
and by nothing else; it is S5 policy in exactly the sense `AGENTS.md` means, and it is
a number a check can read once someone has written it down.

### The algedonic channel — When must a person be interrupted?

Once per trade list, before the file exists. The question names every trade, the lots it
sells from and the tax it realises, because that is what a person is consenting to. Not
once per trade: a rebalance is one decision with many legs, and asking several times is
the attention budget spent on the wrong thing. The unresolved position does not
interrupt anyone. It is an open item on the review, owed to a person as an obligation,
delivered to the outbox and reminded about, and it stops nothing while it waits.

### Every rule, and its level

| Rule | Level | Why not higher |
| --- | --- | --- |
| The target is feasible under the declared constraints | 2, a deterministic check (`test/portfolio.test.js`) | — |
| The trade list moves toward the target, not past it, and lands inside the band | 2, a deterministic check | — |
| No trade creates a wash sale | 2, a deterministic check | — |
| Every sell names a held lot; the lots reconcile to executed trades and positions | 2, a deterministic check | — |
| The report's return is the time-weighted return | 2, a deterministic check | — |
| A harvest's benefit exceeds its costs | 2, a check, once a harvest exists | there is no harvest unit in this phase; the check arrives with the harvest contract ([#124](https://github.com/MetaCoding-io/regulator/issues/124)) |
| Consent before a trade list | 3, a typed tool (`ask_human`, `kind=consent`), plus 2, a gate (pause) | *whether* an action needs consent is still the model's to notice (`docs/DEBT.md` row 29). A `place_trade` tool declared `irreversible` would let a gate derive it ([#121](https://github.com/MetaCoding-io/regulator/issues/121)) |
| Which lot a sale comes from | 4, judgment bounded by the tax ordering, reported | the ordering is a rule; the choice among equals is the unit's |
| Which exchangeable ETF replaces a harvested one | 4, judgment bounded by the set and the wash-sale check | no harvest yet; the sets are declared so the check has them |
| The expected-return inputs | 4, judgment bounded by the subset tolerances, reported | it is judgment; the cap is fixed, the inputs are reported |
| Tone, thoroughness, "check the lots first" | 5, advice in the profile | advice by definition |

---

## 2. The declaration

A control plane is declared, and the declaration is a set of files. What follows is the
whole of it for the portfolio, file by file. Nothing in the orchestrator changed for it.
Three things outside the orchestrator did, and the authoring guide lists them: a new
profile needs its advice file, a new fixture directory needs a class in
`DEFINITION_WRITERS`, and the `fixture` command needs its flag.

### The domain: [`packages/regulator/fixture-portfolio/`](../../packages/regulator/fixture-portfolio/)

```
managed-portfolio/
  universe.json                  the ETFs, in exchangeable sets (the person's)
  tax.json                       rates, cutoff, window, jurisdiction (the person's)
  benchmark.json                 reference weights and subset tolerances (the person's)
  positions/                     the custodian's exports — protected
    2026-07-31.csv/.json  2026-08-31  2026-09-15 (a deposit)  2026-09-30
  prices/                        closing prices on each export date — protected
  trades/executed/               what was traded — protected
    2025-03-14.json  2026-09-02.json
  trades/pending/                a file here is a commitment
  lots/lots.csv, lots.json       the open lots, current to 2026-08-31
  targets/2026-08-31.json        August's target
  reports/2026-08.md             August's review
  lib/portfolio.js, test/        the portfolio's own checks — outside every write grant
  package.json                   scripts.test = node --test  (what run_tests discovers)
```

The data is arranged so the checks have something to refuse. A deposit lands on 15
September, so the period's time-weighted return (2.71%) differs from the naive one
(3.98%). A lot of BND was bought on 2 September, inside the wash-sale window of the
September close, so a sell from the older BND lot at a loss is a wash sale while a sell
from the new lot is not. Two shares nobody can explain sit outside the universe.

### The workload: [`packages/regulator/workload/portfolio.json`](../../packages/regulator/workload/portfolio.json)

```json
{
  "name": "portfolio",
  "version": 1,
  "unitTypes": [
    { "name": "ingest-positions", "profile": "manager", "checks": ["run_checks", "run_tests", "inherited-tests", "identity-untouched", "glossary-lint"], "requiresContract": true },
    { "name": "propose-target",   "profile": "manager", "checks": ["run_checks", "run_tests", "inherited-tests", "identity-untouched", "glossary-lint"], "requiresContract": true },
    { "name": "plan-rebalance",   "profile": "manager", "checks": ["run_checks", "run_tests", "inherited-tests", "identity-untouched", "glossary-lint"], "requiresContract": true },
    { "name": "review",           "profile": "auditor", "checks": ["run_tests", "inherited-tests", "identity-untouched"], "requiresContract": true },
    { "name": "close-period",     "profile": "auditor", "checks": [], "requiresContract": true }
  ]
}
```

The descriptions are elided. `regulator check` refuses a unit type whose profile is not
declared or whose check the host does not run, and now passes with three workloads.

### The profile: [`manager.json`](../../packages/regulator/profiles/manager.json), with [`advice/manager.md`](../../packages/regulator/advice/manager.md)

```json
{
  "name": "manager",
  "tools": ["read", "write", "edit", "grep", "find", "ls", "read_conventions", "run_tests", "run_checks", "remember", "ask_human", "notify_owner", "propose_policy_change", "report_result"],
  "writablePaths": ["lots/", "targets/", "trades/pending/", "reports/"],
  "thinkingLevel": "medium"
}
```

The advice is a file of its own, as every profile's is since the accept-path split: the
exports and the fills are never edited; check the lots first and say which lot each sell
comes from, with its tax; a position the universe does not name is not yours to trade
or to explain; ask once per list, naming every trade, and write nothing without a yes.
The definition check refuses a profile with no advice file.

### The policy: [`packages/regulator/policies/portfolio.json`](../../packages/regulator/policies/portfolio.json)

Budgets per unit type (tokens, turns, wall-clock and attempts; `review` and
`close-period` get one attempt, `plan-rebalance` three) and model routes (the read-only
types on the cheaper route). Recovery, routing and interaction are the lab's own
policies, unchanged.

### The contracts: [`packages/regulator/contracts/portfolio/`](../../packages/regulator/contracts/portfolio/)

There are four, one per unit of the September close. This is the one that carries the
consent rule, with its decisions sorted as §1 says:

```json
{
  "id": "tc-p3-plan-rebalance", "unitId": "p3-plan-rebalance", "unitType": "plan-rebalance",
  "workload": { "name": "portfolio", "version": 1 },
  "objective": "Plan September's rebalance: write trades/pending/2026-09-30.json — the trades that move every position toward targets/2026-09-30.json at the 2026-09-30 prices, each sell naming the lots it comes from — after a person consents to the whole list.",
  "constraintRefs": ["reg.algedonic.interaction-contract.v1", "reg.algedonic.pause-gate.v1", "reg.control.profile-write-grant.v1", "reg.audit.closeout-gate.v1"],
  "fixed": [
    { "id": "f-target",   "subject": "the target", "decision": "The target is targets/2026-09-30.json and is not changed by this unit.", "authorityRef": "human:alice" },
    { "id": "f-universe", "subject": "the universe and the exchangeable sets", "decision": "…a trade names a ticker the target names, and the file is not extended.", "authorityRef": "human:alice" },
    { "id": "f-band",     "subject": "the band", "decision": "The band is 0.02 of the portfolio's value…; it is the number benchmark.json carries. No trade moves a position past its target.", "authorityRef": "human:alice" },
    { "id": "f-tax",      "subject": "the tax parameters", "decision": "The rates, the long-term cutoff and the wash-sale window are tax.json; the jurisdiction is the one it declares…", "authorityRef": "human:alice" },
    { "id": "f-consent",  "subject": "consent before a trade list", "decision": "No file is written under trades/pending/ until a person answers yes to one consent question that names every trade, the lots each sell comes from and the tax it realises — one question per list, not one per trade. Silence is not consent.", "authorityRef": "human:alice" },
    { "id": "f-executed", "subject": "trades/executed/", "decision": "The record of what was traded is the person's; a unit never writes there.", "authorityRef": "human:alice" }
  ],
  "delegated": [
    { "id": "d-lots",   "subject": "which lots each sell comes from", "bounds": "Within the tax ordering…and never a lot whose sale is a wash sale against the lot history. Report the lot chosen for every sell, with the gain or loss and the tax it realises." },
    { "id": "d-extent", "subject": "whether to trade all the way to the target or only back inside the band", "bounds": "Every targeted position lands inside the band either way. Report the choice with the tax consequence of each." }
  ],
  "unresolved": [
    { "id": "u-vnq", "subject": "VNQ, 2 shares the custodian's export carries and universe.json does not name", "reason": "Nobody has said what it is or what it cost…", "handling": "defer" }
  ],
  "expectedEvidence": [
    { "id": "e-portfolio-checks", "class": "test", "required": true, "description": "run_tests: the portfolio's own suite passes at the committed revision…" },
    { "id": "e-checks", "class": "command", "required": true, "description": "run_checks: the static checks pass and the protected prefixes are untouched" }
  ]
}
```

### The identity, in your definition

The lab's `identity/` is the software harness's, so the contracts cite the person who
fixed each decision (`authorityRef: "human:alice"`), as the ledger's do. A portfolio
definition is a fork of the lab with `identity/` rewritten. These are the additions, in
the form the identity parser reads:

```markdown
## INV-005 — The custodian's record is the custodian's

No unit writes under `positions/`, `prices/` or `trades/executed/`. The lots are
reconciled *to* the exports; a disagreement is corrected in the lots.

Checked by: the instance manifest's protected prefixes at the profile grant, and the
`identity-untouched` host check at closeout.

## INV-006 — Nothing is committed to without consent

A file under `trades/pending/` is written only after a person answers yes to one
consent question naming every trade in it, the lots each sell comes from and the tax
it realises.

Checked by: `ask_human` opens a blocking obligation; the pause gate refuses every tool
with an effect until it is answered; silence, timeout and cancellation are never a yes.

## INV-007 — The universe, the tax parameters and the benchmark are the person's

No unit writes `universe.json`, `tax.json` or `benchmark.json`.

Checked by: the three files are outside every profile's writable prefixes.

## INV-008 — The portfolio's risk stays inside the person's tolerance

The annualised volatility of a target, under the declared covariance, does not exceed
the bound below.

Checked by: nothing yet — the bound is a number the person sets here, and the check
over a target's predicted volatility is written when the covariance input exists.
```

The fork also adds, in `GLOSSARY.md`, the words this instance does not use: `order`
(say *trade*, until a `place_trade` tool exists) and `rebalance` for anything but the
whole list. `glossary-lint` then enforces them on the branch.

---

## 3. Running it

With the lab built (`pnpm install && pnpm build`) and `regulator` on the path, as
`OPERATING.md` describes, the close runs like this:

```sh
regulator fixture ~/portfolio --portfolio     # the managed portfolio as a git repository
cd ~/portfolio
regulator init --writable lots/,targets/,trades/pending/,reports/ \
               --protected positions/,prices/,trades/executed/ --by alice
regulator doctor                              # exit 1 on any problem

L=packages/regulator/contracts/portfolio; P=packages/regulator/policies/portfolio.json
regulator unit drive $L/p1-ingest-positions.json --policy $P
regulator unit drive $L/p2-propose-target.json --policy $P
regulator unit drive $L/p3-plan-rebalance.json --policy $P    # asks once; nobody answers; pauses
regulator obligations                          # consent: the September trade list — owed to a person, veto
regulator answer <obligation> --by alice --answer yes
regulator unit drive $L/p3-plan-rebalance.json --policy $P    # the next attempt carries the answer
regulator unit drive $L/p4-review.json --policy $P
regulator unit evidence p3-plan-rebalance      # the portfolio's checks, bound to the revision
regulator status --definition packages/regulator --instance .
```

Without a model, the same close runs scripted. `node --test packages/regulator/dist/portfolio.test.js`
drives it with two behaviours: the `manager`, which does what the contracts ask, and
the `careless`, which writes a trade list that sells past the target, sells from a lot
the portfolio does not hold and sells the older lot at a loss inside the wash-sale
window, and takes the router's repair. What the test asserts is what you would look for
in the control room:

- Units p1 and p2 close on evidence the host produced: `run_checks`, `run_tests` (the
  portfolio's six assertions and the turnover arithmetic's test, discovered from
  `package.json`), `inherited-tests`,
  `identity-untouched` and `glossary-lint`, each bound to the unit's committed revision,
  and, before each merge lands, `pre-merge:run_tests` on the merged tree.
- The lots on the base are current to 30 September, with the 2 September fill as a lot
  of its own. The report states 2.71%, the return chained over the three exports with
  the deposit valued on its day, and carries VNQ under *Open items*.
- Unit p3 pauses. One consent question is a blocking obligation owed to a person, and
  it names every trade, the lots each sell comes from and the tax it realises. The
  attempt is recorded as `paused`, the question is delivered to the outbox, the recovery
  policy is not consulted, and nothing exists under `trades/pending/`. After `alice`
  answers yes, the next attempt writes the list it asked about — BND sold from the 2
  September lot, because the older lot's loss would be a wash sale against that fill —
  and closes.
- Unit p4 is verified by the host although it writes nothing.
- The careless close is refused at the first attempt that writes, by the three named
  assertions, and the hint the router gives the repair attempt is their output. The
  base carries the repaired list and never the refused one.
- After both closes, `positions/`, `prices/` and `trades/executed/` on the base are byte
  for byte what the fixture shipped.
- The memory recorded by p1 (VNQ has no fill and no basis; a person has to say what it
  is) is scoped to `ingest-positions`, `plan-rebalance` and `review` and is rendered to
  no other unit type.

---

## 4. What the control room shows

`regulator status` and the control room read the same records, and for this instance
they read as they do for the ledger: three workloads in the definition view now, six
profiles, the portfolio budget policy beside the other two; the instance's manifest
line with its writable and protected prefixes; the units with their status, attempts,
verdict and what is owed; the consent obligation with the veto marked while it is
open, and the interaction row followed by its answer. The ledger page's screenshots are
of the ledger instance; this one reads the same way.

---

## 5. What this example does not do

- The scripted units never run a session, so the gates *inside* one (the profile grant,
  the identity write gate, the pause gate) are exercised by their own tests and not by
  this close. A live run with a model is the drill.
- Whether an action needs consent is the model's to notice (`docs/DEBT.md` row 29). A
  `place_trade` tool whose declared effect is `irreversible` would let a gate derive it,
  and this workload is the case for it ([#121](https://github.com/MetaCoding-io/regulator/issues/121)).
- `plan-rebalance` runs as a session. Its work is arithmetic and should be a program
  under a wall-clock budget, checked by the host like a model's ([#122](https://github.com/MetaCoding-io/regulator/issues/122)).
- There is no S4. The exports arrive by hand. The three sensors the design names are
  [#123](https://github.com/MetaCoding-io/regulator/issues/123).
- There is no harvest, so two of the design's checks have nothing to check yet: a
  harvest's benefit against its costs, and the cost-basis adjustment an executed wash
  sale forces on the lots ([#124](https://github.com/MetaCoding-io/regulator/issues/124)).
  The exchangeable sets are declared so those checks have them.
- The risk tolerance is not identity, and the volatility check on a target does not
  exist: the bound is a number nobody has set and the check needs a covariance input.
- The price history carries closing prices and no dividends. Cash is the custodian's,
  and the return treats a deposit as the one kind of external flow.
- The band lives in `benchmark.json`, a person's file outside every write grant, and
  the trade-list check reads it there. A first draft put it in the target file, which
  `propose-target` writes under a fixed decision; that let a unit write the number a
  check judges it by, the catalog's *S3\* that reads what S1 wrote*, so it moved.
- VNQ is carried as an open item and never resolved. Resolving it would take a
  `clarification` question to a person, which this close does not ask.

## 6. What this example added to the recipe

The ledger's §6 is the recipe, and it held. What this domain added is in the
[authoring guide](../guide/authoring-a-workload.md): the three places a new workload has
to register itself before the definition check will have it; that a consenting unit's
first attempt is spent on the question, so its attempt ceiling has to allow for it; that
a number a check reads has to live in the tree, not in the contract alone; and that the
fixture's data is a design decision — it has to carry the thing each check exists to
refuse, or the careless behaviour cannot be caught.
