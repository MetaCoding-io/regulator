# household-ledger

A plain-text ledger for one household's checking account, used by the course's
worked example ([`docs/examples/personal-finance.md`](../../../docs/examples/personal-finance.md)).
It is the *domain* the finance workload works on: the harness never reads its own
progress off these files.

## Layout

| Path | What it is | Who writes it |
| --- | --- | --- |
| `statements/` | the bank's exports, one CSV and one summary per period | the person, from the bank; **protected** |
| `ledger/` | one CSV per period: every statement row, categorized | units under the `bookkeeper` profile |
| `reports/` | the monthly close, one markdown file per period | units |
| `payments/pending/` | payments the household has agreed to make; a file here is a commitment | units, after consent |
| `payments/executed/` | what was actually paid | the person; **protected** |
| `categories.json` | the taxonomy a category must come from | the person |
| `lib/`, `test/` | the ledger's own checks | the person; outside every unit's write grant |

## Checks

```sh
npm test
```

`test/ledger.test.js` is what the harness runs at every closeout and again on the
base after every merge: every category is in the taxonomy, every period with a
statement balances to it row for row and in total, a report's totals are the ledger's,
and a pending payment is well formed. A unit cannot weaken these: `lib/` and `test/`
are not under any profile's writable prefixes.
