# managed-portfolio

A portfolio under management as plain files, used by the course's third worked example
([`docs/examples/portfolio.md`](../../../docs/examples/portfolio.md)). It is the *domain*
the portfolio workload works on: the harness never reads its own progress off these
files.

## Layout

| Path | What it is | Who writes it |
| --- | --- | --- |
| `positions/` | the custodian's exports: one CSV of holdings and one summary (cash, external flows) per export date | the person, from the custodian; **protected** |
| `prices/` | the closing prices on each export date, for every ETF in the universe and everything held | the person, from the custodian; **protected** |
| `lots/` | the tax-lot ledger: `lots.csv`, the open lots, and `lots.json`, the date it is current to | units under the `manager` profile |
| `targets/` | one target per date: the weights; the band it is rebalanced within is `benchmark.json`'s | units |
| `trades/proposed/` | a list a program computed; not yet agreed: `<date>.json`, the rebalance the `plan-rebalance` program planned, and `harvest-<date>.json`, the lots the `harvest-losses` program found at an unrealised loss | the workload's programs, under no consent; checked by the suite as a pending list is |
| `trades/pending/` | trade lists the household has agreed to execute; a file here is a commitment, and it carries the very trades the proposed list of its date computed | units, after consent |
| `trades/executed/` | what was actually traded, one file per fill date, from the custodian's confirmations | the person; **protected** |
| `reports/` | the period review: the valuation, the time-weighted return, the open items | units |
| `universe.json` | the ETFs the portfolio may hold, grouped into exchangeable sets | the person |
| `tax.json` | the rates, the long-term cutoff, the wash-sale window, the jurisdiction | the person |
| `benchmark.json` | the reference weights, the subsets a target holds within a tolerance of them, and the rebalance band | the person |
| `lib/`, `test/` | the portfolio's own checks | the person; outside every unit's write grant |

Money is written with two decimals and share counts are whole, so a holding's value is
exact. The custodian exports on every day a deposit or withdrawal lands, so a flow is
valued on its own day and the time-weighted return chains exactly over the export dates.
A lot is named by its fill date and ticker (`2025-03-14-VTI`): one buy of a ticker per
day is the custodian's convention and this ledger's.

As shipped, August 2026 is closed: its report is under `reports/`, its target under
`targets/`, and its rebalance was executed on 2 September. The lots are current to
31 August. September's exports, with a deposit on the 15th, are in `positions/` and
`prices/`, and the September close — bring the lots up to date, propose a target, plan
the rebalance, review — is the workload's work. Two shares of VNQ, which the universe
does not name, have been in the account since before the opening purchases; nobody has
said what they are, and every close carries them as an open item.

## Checks

```sh
npm test
```

`test/portfolio.test.js` is what the harness runs at every closeout and again on the
merged tree before anything lands. Eight assertions, each the domain's own arithmetic:
every target is feasible (long-only, summing to one, naming only the universe, each
benchmark subset within its tolerance); every pending or proposed trade list moves each
position toward its target, not past it, and lands every targeted position inside the
band; every sell names lots the portfolio holds; no trade in a pending or proposed list
creates a wash sale against the lot history; a pending list carries the trades the
proposed list of its date computed; every harvest candidate is an open lot at an
unrealised loss at its date's prices, with the loss as the arithmetic says; the lots
reconcile to the executed trades and to the custodian's positions; and a period's
report states the positions' time-weighted return and carries every position outside
the universe as an open item. A unit cannot weaken these, and a program cannot either:
`lib/` and `test/` are not under any profile's writable prefixes, and a program's
reach is its declared outputs.

`test/turnover.test.js` covers `turnover` in `lib/portfolio.js`, the one-way turnover a
target implies against the current weights. It is not a check over the tree; it is the
arithmetic the portfolio workload's declared metric (`workload:portfolio/turnover`, in
the definition's `workload/portfolio.json`) reads through its grader command.
