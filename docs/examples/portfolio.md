# Worked example — a portfolio under management

> *"I want a set of agents to manage my investments."*

The [household ledger](personal-finance.md) was the second domain under `regulator`, and
it showed which parts of the design are yours to make. This example is the third: a
portfolio of exchange-traded funds held at a custodian, rebalanced against a target once
a period, with a tax-lot ledger beside it. The design is in
[`docs/research/2026-10-24-portfolio-workload.md`](../research/2026-10-24-portfolio-workload.md);
this page is what the design's first phase became, file by file, what it found, and
what the second phase's first two slices changed in it: the `command` runner, so that
the two unit types whose work is arithmetic run as programs, and `place_trade`, a tool
the workload declares with an effect contract, so that the consent on a trade list is
derived by the gate from the declared effect rather than listed as a path a profile
guards.

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
changed for the first phase. Two things changed for the second: the loop can run a unit
type's declared program in place of a session
([#122](https://github.com/MetaCoding-io/regulator/issues/122)), and a workload can
declare a tool with an effect contract, from which the gate derives the consent
([#121](https://github.com/MetaCoding-io/regulator/issues/121)); this workload is the
case that asked for both. The first half of this page is the part you do before
writing any of that; the [authoring guide](../guide/authoring-a-workload.md) is the same material as a
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
| Domain output | `targets/<date>.json`, the target weights; `trades/proposed/<date>.json`, a trade list a program computed and nobody has agreed to, and `trades/proposed/harvest-<date>.json`, the lots a program found at a loss; `trades/pending/<date>.json`, a trade list the household has agreed to execute; `lots/lots.csv`, the tax-lot ledger derived from executed trades, with `lots/lots.json` saying the date it is current to; `reports/<period>.md`, the period review. |
| Source of truth | `positions/`, the custodian's exports of holdings and cash, and `prices/`, the closing prices on each export date. The harness reads them and never writes them. If the lots and the positions disagree, the lots are wrong. |
| The person's record | `trades/executed/`, what was actually traded, written by the person from the custodian's confirmations. A unit never writes there. |
| The person's choices | `universe.json`, the ETFs the portfolio may hold, grouped into sets the person considers exchangeable but not substantially identical; `tax.json`, the rates, the long-term cutoff, the wash-sale window and the jurisdiction; `benchmark.json`, the reference weights and the subsets a target holds within a tolerance of them. A unit never extends any of them. |
| The domain's own checks | `test/portfolio.test.js`, eight assertions: the target is feasible; a trade list, proposed or pending, moves toward the target and not past it and lands inside the band, every sell in it names a held lot, and no trade in it creates a wash sale against the lot history; a pending list carries the trades the proposed list of its date computed; every harvest candidate is an open lot at a loss with the loss as the arithmetic says; the lots reconcile to the executed trades and to the positions; and the report's return is the positions' time-weighted return. |

The one rule carries over unchanged: **nothing reads its own progress off the
portfolio.** Whether September is ingested, targeted, rebalanced or reviewed is
execution state in the orchestrator's store. What the lots file contains is domain
state. What was verified about it is regulatory state.

### S1 — What are the units of work, and what may each one touch?

Seven unit types, five sessions and two programs, each under a capability profile. For
a session the profile is a grant over declared tool *effects*; for a program it is the
*effect declaration* the definition check reads, since a program calls no tool. The
"may write" column is what the profile permits for a session and what the program
declares as its outputs; the last column is what the host runs against the unit's
committed revision at closeout, whichever produced it:

| Unit type | Runner | Profile | May write | Checks the host runs at closeout |
| --- | --- | --- | --- | --- |
| `ingest-positions` | session | manager | `lots/`, `targets/`, `trades/proposed/`, `reports/` | `run_checks`, `run_tests`, `inherited-tests`, `identity-untouched`, `glossary-lint` |
| `propose-target` | session | manager | same | same |
| `plan-rebalance` | command: `node workload/portfolio/plan-rebalance.mjs` | manager, as an effect declaration | `trades/proposed/` | same |
| `confirm-trades` | session | manager | same as `ingest-positions`; `trades/pending/` through `place_trade` alone | same |
| `harvest-losses` | command: `node workload/portfolio/harvest-losses.mjs` | manager, as an effect declaration | `trades/proposed/harvest-` | same |
| `review` | session | auditor | nothing | `run_tests`, `inherited-tests`, `identity-untouched` |
| `close-period` | session | auditor | nothing | — |

Five decisions in this table matter. The manager gets no shell, as the bookkeeper did
not, so the write grant is complete at the tool boundary — and a profile with a shell
could not be a program's effect declaration at all, since a program's reach is its
declared outputs and nothing wider. `lib/`, `test/`, `universe.json`, `tax.json` and
`benchmark.json` are under no profile's writable prefixes, so neither a unit nor a
program can weaken the check that judges it or widen the universe it may trade. The two
unit types whose work is wholly arithmetic are programs: the loop runs the declared
command in the worktree under a wall-clock budget, with no session and no model, and
checks what it wrote exactly as it checks a model's work. The rebalance is split in
two because a program cannot ask: `plan-rebalance` writes its list under
`trades/proposed/`, a prefix no consent guards, and `confirm-trades`, a session, puts
that list to a person. And `trades/pending/` is under no write grant at all: the one
way a pending list comes to exist is `place_trade`, the tool the workload declares with
an irreversible effect, whose program copies the proposed list byte for byte after the
yes. The gate derives the consent question from that declared effect, so the question
is asked because the tool is what it is, not because the profile's advice said so, and
"copied unchanged" is a property of the tool rather than a sentence the model keeps.
The `auditor` profile is the ledger's, reused as it is.

### S2 — What stops units from tripping over each other?

Unchanged: one worktree and one lease per unit, reintegration by the orchestrator after
the pre-merge trial, the thrash detector. One period belongs to one unit at a time. A
trade list is a file, so two units cannot each write half of one.

### S3 — What is a unit told, and what is fixed, delegated, unresolved?

The contract for `plan-rebalance`, a program, has only one kind of decision, because a
program has no judgment to report and the loop refuses a contract that delegates to one:

- Fixed, which the program implements: the target is `targets/2026-09-30.json` and is
  not changed; the universe and the exchangeable sets are `universe.json`; the band is
  0.02 of the portfolio's value, the number `benchmark.json` carries, and no trade moves
  a position past its target; the tax parameters and the wash-sale window are
  `tax.json`; which lots each sell comes from is the tax ordering as a rule (a loss
  before a gain, long-term before short-term among gains, never a lot whose sale is a
  wash sale), with every sell naming its lots and the tax each realises; the extent is
  all the way to the target in whole shares; a position the target does not name is
  not traded; the list is written under `trades/proposed/` and nothing under
  `trades/pending/`; `trades/executed/` is the person's. What the session's contract
  delegated in the first phase — the lot choice, the extent — is fixed here, since a
  program chooses nothing.

The contract for `confirm-trades`, the session that follows it, keeps what a program
cannot do:

- Fixed: the list is `trades/proposed/2026-09-30.json`, the program's, and is not
  changed by this unit — `place_trade` writes the pending file byte for byte from it;
  no file is written under `trades/pending/` until a person answers yes to one
  question naming every trade, its lots and its tax, and naming the call the yes
  authorizes; `trades/executed/` is the person's.
- Unresolved, which the unit never settles and instead surfaces: two shares of VNQ, a
  position the custodian's export carries that the universe does not name. Nobody has
  said what it is or what it cost. Its handling is *defer*: nothing trades it, and the
  review carries it as an open item. The program's contract cannot carry it, since a
  program surfaces nothing; the session's does.

The contract for `harvest-losses`, the second program, fixes the lots, the tax
parameters and one thing more: candidates only. Every lot under water at the date's
prices is listed with its loss, with no threshold and no benefit-versus-cost judgment;
that arithmetic, and the replacement from the ticker's exchangeable set, is the harvest
contract's ([#124](https://github.com/MetaCoding-io/regulator/issues/124)).

The contract for `propose-target` delegates one thing that is judgment, and bounds it:
the expected-return inputs. In this phase no view has been raised, so the inputs are
the benchmark's own weights read as the equilibrium, a tilt from them stays inside
every subset's tolerance, and the tilt is reported with its reason. The design's §4
says what that bound becomes when a view with a numeric confidence exists.

Budgets are set per attempt and per unit type in a policy file. The read-only types get
one attempt; `confirm-trades` gets three, because its first is spent asking for consent
and a refused list still deserves a repair. The two programs are budgeted in wall-clock
alone, with a second attempt in case the first is refused: their tokens and turns are
zero by construction.

### S3\* — How do we know the plan is right without believing the unit?

The host runs `test/portfolio.test.js` against the committed revision and binds the
result to the unit, the attempt, the contract and the revision, whether a model or a
program produced it. A unit's "rebalanced, within band, no wash sales" satisfies
nothing, and a program's exit 0 satisfies nothing either; the suite's result does. The
attempt record says which program ran, by its file and its hash, so the evidence is
bound to the program as well as to the revision. The
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
| A trade list is written only after a person's yes to one question naming every trade | the contract fixes it; `trades/pending/` is outside every write grant, and `place_trade`, the one tool that reaches it, is declared `irreversible`, so the gate derives the consent and refuses the call without a recorded yes for it; `ask_human` with `kind=consent` opens a blocking obligation and the pause gate refuses every tool with an effect until a person answers; silence is never consent, a protocol constant. A program may not write there at all: a program's outputs are its reach, and the plan's are `trades/proposed/` |
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
| A harvest candidate is an open lot at a loss, with the loss as the arithmetic says | 2, a deterministic check | — |
| A harvest's benefit exceeds its costs | 2, a check, once a harvest exists | the program finds the candidates and judges none; the check arrives with the harvest contract ([#124](https://github.com/MetaCoding-io/regulator/issues/124)) |
| The pending list is the list the person was asked about | 3, the tool's program copies the proposed file byte for byte, plus 2, a deterministic check | the suite's assertion still runs at every closeout, and what it guards now is a bug in `place-trade.mjs`, not a model's shortcut: a session cannot write the file |
| A program's output is right | 2, the same checks at the revision the program produced | nothing reads the program; its exit and its claim satisfy nothing, and a wrong program is refused by the suite and escalated when the policy's attempts are spent |
| Consent before a trade list | 2, a gate (the consent derived from `place_trade`'s declared effect, refusing the call without a recorded yes), plus 3, a typed tool (`place_trade`, with an effect contract; `ask_human`, `kind=consent`), plus 2, a gate (pause) | — ([#121](https://github.com/MetaCoding-io/regulator/issues/121): derived from the declaration, with no profile naming the tool) |
| Which lot a sale comes from | 2, a rule the program implements, checked by the suite (held lots, no wash sale) | was judgment in the first phase; a program has no judgment, so the ordering is a fixed decision on its contract and the choice among equals is the ordering's tie-break |
| Which exchangeable ETF replaces a harvested one | 4, judgment bounded by the set and the wash-sale check | no harvest yet; the sets are declared so the check has them |
| The expected-return inputs | 4, judgment bounded by the subset tolerances, reported | it is judgment; the cap is fixed, the inputs are reported |
| Tone, thoroughness, "check the lots first" | 5, advice in the profile | advice by definition |

---

## 2. The declaration

A control plane is declared, and the declaration is a set of files. What follows is the
whole of it for the portfolio, file by file. Nothing in the orchestrator changed for the
first phase; the second phase's runner is a declaration too, `runner` on a unit type,
and the two programs are files under the definition beside the graders. Three things
outside the orchestrator changed for the first phase, and the authoring guide lists
them: a new profile needs its advice file, a new fixture directory needs a class in
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
  trades/proposed/               a list a program computed; not yet agreed
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
    { "name": "plan-rebalance",   "profile": "manager", "runner": { "kind": "command", "argv": ["node", "workload/portfolio/plan-rebalance.mjs"], "outputs": ["trades/proposed/"] }, "checks": ["run_checks", "run_tests", "inherited-tests", "identity-untouched", "glossary-lint"], "requiresContract": true },
    { "name": "confirm-trades",   "profile": "manager", "checks": ["run_checks", "run_tests", "inherited-tests", "identity-untouched", "glossary-lint"], "requiresContract": true },
    { "name": "harvest-losses",   "profile": "manager", "runner": { "kind": "command", "argv": ["node", "workload/portfolio/harvest-losses.mjs"], "outputs": ["trades/proposed/harvest-"] }, "checks": ["run_checks", "run_tests", "inherited-tests", "identity-untouched", "glossary-lint"], "requiresContract": true },
    { "name": "review",           "profile": "auditor", "checks": ["run_tests", "inherited-tests", "identity-untouched"], "requiresContract": true },
    { "name": "close-period",     "profile": "auditor", "checks": [], "requiresContract": true }
  ]
}
```

The descriptions are elided, and so is the tool the workload declares beside its unit
types:

```json
{
  "tools": [
    {
      "name": "place_trade",
      "description": "Place the trade list a person has agreed to: copy trades/proposed/<date>.json byte for byte to trades/pending/<date>.json, where a file is a commitment …",
      "parameters": { "type": "object", "properties": { "proposed": { "type": "string", "pattern": "^trades/proposed/[0-9]{4}-[0-9]{2}-[0-9]{2}\\.json$" } }, "required": ["proposed"], "additionalProperties": false },
      "effect": { "filesystem": "write", "execution": "none", "network": "none", "sideEffects": "irreversible" },
      "program": { "argv": ["node", "workload/portfolio/place-trade.mjs"], "outputs": ["trades/pending/"] }
    }
  ]
}
```

`regulator check` refuses a unit type whose profile is not
declared or whose check the host does not run, and for a command runner one without an
argv, one naming no file under the definition, one under a profile granting a shell, an
output outside the profile's writable paths or under one of its consent grants; for a
declared tool, a built-in's name, a schema that is not an object's, an effect that says
arbitrary execution or disagrees with the outputs, a program with no file under the
definition, and a profile that grants the tool beside a plain write under its outputs.
It passes with three workloads, two programs and one declared tool.

### The profile: [`manager.json`](../../packages/regulator/profiles/manager.json), with [`advice/manager.md`](../../packages/regulator/advice/manager.md)

```json
{
  "name": "manager",
  "tools": ["read", "write", "edit", "grep", "find", "ls", "read_conventions", "run_tests", "run_checks", "remember", "ask_human", "notify_owner", "propose_policy_change", "report_result", "place_trade"],
  "writablePaths": ["lots/", "targets/", "trades/proposed/", "reports/"],
  "thinkingLevel": "medium"
}
```

The profile grants `place_trade` by name, as it grants a built-in, and lists no consent
grant: `trades/pending/` is outside its writable paths, and the yes a trade list needs is
derived from the tool's declared effect. The advice is a file of its own, as every
profile's is since the accept-path split: the exports and the fills are never edited;
check the lots first and say which lot each sell comes from, with its tax; a position
the universe does not name is not yours to trade or to explain; a list under
`trades/proposed/` is the program's, confirmed by asking and then placing it. The line
the first phase carried — ask before writing a trade list, and write nothing without a
yes — is gone: the refusal says it, naming the call, and a rule a gate enforces is not
restated as advice. The definition check refuses a profile with no advice file.

### The policy: [`packages/regulator/policies/portfolio.json`](../../packages/regulator/policies/portfolio.json)

Budgets per unit type (tokens, turns, wall-clock and attempts; `review` and
`close-period` get one attempt, `confirm-trades` three, the two programs a minute of
wall-clock and two attempts) and model routes (the read-only types on the cheaper
route; a program has none). Recovery, routing and interaction are the lab's own
policies, unchanged.

### The contracts: [`packages/regulator/contracts/portfolio/`](../../packages/regulator/contracts/portfolio/)

There are six, one per unit of the September close. The program's contract fixes
everything and delegates nothing:

```json
{
  "id": "tc-p3-plan-rebalance", "unitId": "p3-plan-rebalance", "unitType": "plan-rebalance",
  "workload": { "name": "portfolio", "version": 1 },
  "objective": "Plan September's rebalance: write trades/proposed/2026-09-30.json — the trades that move every position toward targets/2026-09-30.json at the 2026-09-30 prices, each sell naming the lots it comes from with the gain and the tax it realises — as a list a program computed and nobody has agreed to.",
  "constraintRefs": ["reg.control.command-runner.v1", "reg.control.profile-write-grant.v1", "reg.audit.closeout-gate.v1"],
  "fixed": [
    { "id": "f-target",    "subject": "the target", "decision": "The target is targets/2026-09-30.json and is not changed by this unit.", "authorityRef": "human:alice" },
    { "id": "f-universe",  "…": "…" }, { "id": "f-band", "…": "…" }, { "id": "f-tax", "…": "…" },
    { "id": "f-lots",      "subject": "which lots each sell comes from", "decision": "The tax ordering is a rule here, not a choice: a loss before a gain, and among gains a long-term lot before a short-term one; never a lot whose sale is a wash sale… Every sell names its lots with the gain or loss and the tax each realises.", "authorityRef": "human:alice" },
    { "id": "f-extent",    "subject": "how far to trade", "decision": "All the way to the target in whole shares and never past it…", "authorityRef": "human:alice" },
    { "id": "f-untouched", "subject": "a position the target does not name", "decision": "Not traded. VNQ… stays as it is; the review carries it as an open item, since a program surfaces nothing.", "authorityRef": "human:alice" },
    { "id": "f-proposed",  "subject": "nothing is agreed", "decision": "The list is written under trades/proposed/ and nowhere else. Nothing is written under trades/pending/: a file there is a commitment, and consent is a session's to ask (confirm-trades).", "authorityRef": "human:alice" },
    { "id": "f-executed",  "…": "…" }
  ],
  "delegated": [], "unresolved": [],
  "expectedEvidence": [
    { "id": "e-portfolio-checks", "class": "test", "required": true, "description": "run_tests: the portfolio's own suite passes at the committed revision — the proposed list moves every position toward its target and not past it…" },
    { "id": "e-checks", "class": "command", "required": true, "description": "run_checks: the static checks pass and the protected prefixes are untouched" }
  ]
}
```

And this is the session's, which carries the consent rule and the unresolved position,
with its decisions sorted as §1 says:

```json
{
  "id": "tc-p4-confirm-trades", "unitId": "p4-confirm-trades", "unitType": "confirm-trades",
  "workload": { "name": "portfolio", "version": 1 },
  "objective": "Confirm September's rebalance: read trades/proposed/2026-09-30.json, the list the plan-rebalance program computed, put it to a person as one consent question naming every trade, the lots each sell comes from and the tax it realises, and after the yes place it with place_trade — the workload's declared tool, which writes it unchanged to trades/pending/2026-09-30.json.",
  "constraintRefs": ["reg.algedonic.interaction-contract.v1", "reg.control.declared-tool.v1", "reg.algedonic.pause-gate.v1", "reg.control.profile-write-grant.v1", "reg.audit.closeout-gate.v1"],
  "fixed": [
    { "id": "f-proposed", "subject": "the list", "decision": "The list is trades/proposed/2026-09-30.json, computed by the plan-rebalance program, and is not changed by this unit: place_trade writes the pending file byte for byte from it, and the suite refuses a pending list that does not carry the proposed trades.", "authorityRef": "human:alice" },
    { "id": "f-consent",  "subject": "consent before a trade list", "decision": "No file is written under trades/pending/ until a person answers yes to one consent question that names every trade, the lots each sell comes from and the tax it realises — one question per list, not one per trade — and names the call: place_trade with proposed trades/proposed/2026-09-30.json. The harness refuses the call without that yes on the record. Silence is not consent.", "authorityRef": "human:alice" },
    { "id": "f-executed", "subject": "trades/executed/", "decision": "The record of what was traded is the person's; a unit never writes there.", "authorityRef": "human:alice" }
  ],
  "delegated": [],
  "unresolved": [
    { "id": "u-vnq", "subject": "VNQ, 2 shares the custodian's export carries and universe.json does not name", "reason": "Nobody has said what it is or what it cost…", "handling": "defer" }
  ],
  "expectedEvidence": [
    { "id": "e-portfolio-checks", "class": "test", "required": true, "description": "run_tests: the portfolio's own suite passes at the committed revision — the pending list is the proposed one…" },
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
(say *trade*; the tool is `place_trade`) and `rebalance` for anything but the whole
list. `glossary-lint` then enforces them on the branch.

---

## 3. Running it

With the lab built (`pnpm install && pnpm build`) and `regulator` on the path, as
`OPERATING.md` describes, the close runs like this:

```sh
regulator fixture ~/portfolio --portfolio     # the managed portfolio as a git repository
cd ~/portfolio
regulator init --writable lots/,targets/,trades/proposed/,reports/ \
               --protected positions/,prices/,trades/executed/ --by alice   # never trades/pending/: that is place_trade's
regulator doctor                              # exit 1 on any problem

L=packages/regulator/contracts/portfolio; P=packages/regulator/policies/portfolio.json
regulator unit drive $L/p1-ingest-positions.json --policy $P
regulator unit drive $L/p2-propose-target.json --policy $P
regulator unit drive $L/p3-plan-rebalance.json --policy $P    # a program: no host, no model; closes on the suite
regulator unit drive $L/p4-confirm-trades.json --policy $P    # asks once, naming the place_trade call; nobody answers; pauses
regulator obligations                          # consent: the September trade list — owed to a person, veto
regulator answer <obligation> --by alice --answer yes
regulator unit drive $L/p4-confirm-trades.json --policy $P    # the next attempt's place_trade call runs on the recorded yes
regulator unit drive $L/p5-harvest-losses.json --policy $P    # a program: where the losses are
regulator unit drive $L/p6-review.json --policy $P
regulator unit evidence p3-plan-rebalance      # the portfolio's checks, bound to the revision the program produced
regulator unit show p3-plan-rebalance          # the attempt: the program's file, its hash, its exit; zero tokens
regulator status --definition packages/regulator --instance .
```

Without a model, the same close runs scripted. `node --test packages/regulator/dist/portfolio.test.js`
drives it with two behaviours for the sessions — the `manager`, which does what the
contracts ask, and the `careless`, which calls `place_trade` without asking anyone —
while the two programs run as the loop runs them, with nothing standing in, and the
tool's program runs through the same runner the host's extension calls. A third test runs a deliberately wrong program in the plan's place. What
the tests assert is what you would look for in the control room:

- Units p1 and p2 close on evidence the host produced: `run_checks`, `run_tests` (the
  portfolio's eight assertions and the turnover arithmetic's test, discovered from
  `package.json`), `inherited-tests`,
  `identity-untouched` and `glossary-lint`, each bound to the unit's committed revision,
  and, before each merge lands, `pre-merge:run_tests` on the merged tree.
- The lots on the base are current to 30 September, with the 2 September fill as a lot
  of its own. The report states 2.71%, the return chained over the three exports with
  the deposit valued on its day, and carries VNQ under *Open items*.
- Unit p3 closes on its first attempt with no session: the loop ran
  `plan-rebalance.mjs` in the worktree, the attempt record carries the program's file,
  its hash and exit 0, the ledger carries wall-clock and zero tokens, the report's
  delegated and unresolved lists are empty, and the list under `trades/proposed/` —
  BND sold from the 2 September lot, because the older lot's loss would be a wash sale
  against that fill, every sell with its gain and its tax — passed the same checks a
  model's work would. Nothing exists under `trades/pending/`.
- Unit p4 pauses. One consent question is a blocking obligation owed to a person, and
  it names every trade, the lots each sell comes from and the tax it realises, as the
  program computed them, and the call a yes authorizes: `place_trade` with the proposed
  list. The attempt is recorded as `paused`, the question is delivered to the outbox,
  the recovery policy is not consulted, and nothing exists under `trades/pending/`.
  After `alice` answers yes, the next attempt's `place_trade` call runs on the recorded
  yes, the tool writes the proposed list byte for byte under `trades/pending/`, the
  report cites the file with the program that placed it by file and hash, and the unit
  closes.
- Unit p5 closes as p3 did: three lots under water at the 30 September prices, listed
  with their losses and nothing said about whether to take them.
- Unit p6 is verified by the host although it writes nothing.
- The careless confirmation calls `place_trade` without asking and is refused by the
  consent gate before anything exists — the consent derived from the tool's declared
  effect, with no profile grant naming it — as an operational-signal with the tree
  unchanged; it then asks. After the yes, its next call runs on the yes already
  recorded, the tool copies the program's list, and the unit closes on its first
  verified attempt. The shortcut the first phase's careless unit took, a pending list
  that was not the one the person was asked about, is impossible by construction: a
  session does not write the file. The suite's assertion that holds the pending list to
  the proposed one still runs at every closeout, and now guards a bug in the tool's
  program rather than a model's shortcut.
- The wrong program, a second argv on a test-only copy of the unit type, sells past the
  target. The suite refuses it at closeout by name on both attempts the policy grants,
  the recovery router says repair and then escalate, an algedonic signal reaches S5,
  and its list never lands. Nothing read the program to decide any of that; the attempt
  records say which program ran.
- After every close, `positions/`, `prices/` and `trades/executed/` on the base are byte
  for byte what the fixture shipped.
- The memory recorded by p1 (VNQ has no fill and no basis; a person has to say what it
  is) is scoped to `ingest-positions`, `confirm-trades` and `review` and is rendered to
  no other unit type; a program reads no memory.

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
  this close. A live run with a model is the drill. The two programs are not scripted:
  the loop runs them as it would in production, so what this close shows of the runner
  is the real thing.
- The consent on a trade list is derived from `place_trade`'s declared effect and from
  nothing else: a declared tool whose side effects are `unknown` derives no consent,
  and a built-in's irreversible effect never does. The tool's program is trusted to be
  the workload's, as the two command runners are; what it does beyond its declared
  outputs is unseen, and the session's other effect gates treat it as a tool of
  undeclared effect, which is safe and imprecise. The
  [declared tool](../../packages/regulator/registry/regulators/declared-tool.json) record
  lists the rest.
- The programs are trusted to be the workload's programs, as `npm test` is trusted to
  be the project's suite. The runner inspects nothing beyond the effect declaration and
  the outputs; what a program imports or reaches by an absolute path is unseen, and a
  program cannot ask, which is why the rebalance is a program followed by a session
  rather than one unit.
- There is no S4. The exports arrive by hand. The three sensors the design names are
  [#123](https://github.com/MetaCoding-io/regulator/issues/123).
- There is no harvest, only its candidates. The program says where the losses are and
  nothing about whether to take them, so two of the design's checks have nothing to
  check yet: a harvest's benefit against its costs, and the cost-basis adjustment an
  executed wash sale forces on the lots ([#124](https://github.com/MetaCoding-io/regulator/issues/124)).
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
a number a check reads has to live in the tree, not in the contract alone; that the
fixture's data is a design decision — it has to carry the thing each check exists to
refuse, or the careless behaviour cannot be caught; and, from the second phase, when a
step is a program's rather than a session's (no judgment to report, outputs under no
consent grant, no shell on its profile), that a step whose output needs a yes is two
units, a program that proposes and a session that confirms, and that the domain's own
dangerous action is a tool the workload declares with an effect contract rather than a
prefix the model writes under: the consent is then derived from the declaration, the
copy is the tool's, and the advice line that said to ask is deleted, since a rule a gate
enforces is not restated as advice.
