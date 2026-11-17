# The wheel as a workload: an options cycle against a broker that answers

- **Status:** proposed; two decisions taken (§2); nothing built and no issue filed.
- **Source:** a conversation on 2026-11-17 that started from Hilpisch's *Python for
  Algorithmic Trading* (O'Reilly) and James's books and course material on the wheel
  from Freeman Publishing. **None of those has been read for this note.** The rules in
  §3 are the strategy as it is commonly described, written down so the design has
  something to hang on; Phase 0 (§7) replaces them with rules cited to the books by
  chapter, as the portfolio note cites its book. The books are not reproduced in this
  repository. The second source is tastytrade's public developer documentation, read on
  2026-11-17 and cited in §4 by page; what was not read is listed in §8.
- **Question:** can a wheel — cash-secured puts, assignment, covered calls, called
  away, again — run as a workload whose orders the harness places itself, and what
  must the control plane grow to do that with host-owned evidence for every number and
  a record that survives a lost process between an order and its acknowledgement?

Claims about what the code does today cite the file or the registry card. Claims about
tastytrade cite the page. The rest is proposal. Nothing here is financial advice, and a
regulator that holds a strategy inside its rules says nothing about whether the
strategy makes money.

## 1. Why this workload

The [portfolio workload](2026-10-24-portfolio-workload.md) deliberately asked for two
things less than this one: "it does not ask the harness to hold anything that moves
money" and "it does not ask for live market data" (its §5). The wheel is the case for
both, and for a third the existing workloads do not exercise: time.

- **The long-running thing is the instance, not a session.** A cycle on one underlying
  is weeks of nothing and a handful of decisions, some with a deadline at the close.
  No model's context holds it. What holds it is the execution store, the regulatory
  log and the broker's own records, which is the boundary `AGENTS.md` states: nothing
  reads its own progress off the domain.
- **Viability has a plain reading here.** The system stays inside its constraints
  (never an uncovered leg, never more capital on one name than declared) and stays
  able to act (data current, credentials valid, the person reachable) across restarts,
  model changes and market regimes. That is survival, not return.
- **The source material makes claims that resolve.** A book that says a given delta
  and expiry yield a given premium is a prediction with a horizon. The prediction
  record ([#138](https://github.com/MetaCoding-io/regulator/issues/138)) exists for
  that, so the instance can test its own sources.

## 2. Decisions

**Decided (2026-11-17, James).** The broker is tastytrade, the platform James uses.
Other data sources may be added where tastytrade does not carry what a phase needs
(§5 names the one known case, historical option quotes for a backtest).

**Decided (2026-11-17, James).** The harness may call an API that acts: an order is
placed by a tool, not written as a file for a person to execute. The design is made
against a mock of the tastytrade API first. This reverses, for this workload only, the
portfolio note's choice that nothing moves money; `place_trade` and the portfolio
workload are unchanged.

What the second decision does not decide: whether any order is ever placed without a
person's yes for that order. Every phase in §7 keeps per-order consent. A standing
mandate ("inside these limits, do not ask") widens what the system may do without a
person and is an S5 decision of its own (§6, row 5).

## 3. Design first: the six questions

The cycle, per underlying: cash → short put → (expired | closed | rolled | assigned) →
shares → short call → (expired | closed | rolled | called away) → cash. The state is
the broker's positions; the instance derives it and never stores a copy it trusts.

| Question | Answer for the wheel | Level |
| --- | --- | --- |
| The domain, and where the truth is | The broker account: positions, balances, orders, transactions. The instance's files (`positions/`, `transactions/`, `chains/`) are dated snapshots of it, written by an ingest program and protected from units, as the custodian's exports are in `fixture-portfolio` | 2 |
| S1 — units | `screen-underlying` (session: which names, bounded by the universe file), `select-strike` (program: the candidates inside the declared delta and expiry bands), `plan-order` (session: which candidate, and why), `confirm-order` (session: consent, then the order tool), `manage-position` (session: hold, close or roll, bounded by the contract), `ingest-account` (program: snapshot and reconcile), the period review | 1–3 |
| S2 — coordination | Collateral is a lease: a put reserves strike × multiplier × contracts in cash, and a second unit cannot reserve the same cash. One open cycle per underlying. A third roll of the same position inside a declared window is thrash, for the thrash detector | 2 |
| S3 — contract | Fixed: the underlying, the leg (put or call), the bands, the maximum capital. Delegated: the strike and expiry inside the bands. Unresolved: anything outside them, which is a question to a person, not a choice | 3 |
| S3\* — evidence | The workload's own arithmetic, run by the host: the put is cash-secured by the instance's cash, not by the broker's buying power; the call is covered by shares held; a call's strike is at or above the adjusted basis unless the contract says otherwise; delta and days-to-expiry inside the bands; no earnings date before expiry; open interest and spread above floors; the concentration cap. Beside it, the broker's own answer: a dry run of the exact order (§4) | 2 |
| S4 — sensors | Assignment or exercise in the transactions; a short call in the money before an ex-dividend date; an earnings date entering an open position's life; delta past its band; the profit target reached; a contract adjusted by a corporate action; the newest snapshot older than its limit | 2 |
| S5 — never | No uncovered short leg. No underlying outside the universe file. No more than the declared capital on one name. No order without a consent on the record for that order | 1–2 |
| The algedonic channel | Assignment; a drawdown past the declared limit; a rejected order; data stale inside a declared window before an expiry; a reconciliation that finds an order the journal does not know | 2 |

Strategy parameters (the bands, the profit target, the roll rule, the universe) live in
files the person owns, as `benchmark.json` and `harvest.json` do. A unit's write grant
does not reach them, and neither does the reflector's: an edit to a parameter is a
proposal to the person.

The source material sorts into three bins, and Phase 0 is the sorting:

1. **Checks** — a rule that is arithmetic over the snapshot. It becomes a test in the
   fixture's suite.
2. **Advice** — a heuristic that needs judgment. It becomes a line in the profile's
   advice file, where the reflector may later propose an edit.
3. **Predictions** — a claim about results. It becomes a prediction record with a
   horizon and a metric, resolved against the stores.

## 4. tastytrade's API, and the mock

Facts below are from tastytrade's developer documentation as read on 2026-11-17; each
cites its page under `https://developer.tastytrade.com`.

| What | Fact | Page | What it means here |
| --- | --- | --- | --- |
| Auth | OAuth2 only (the session endpoint was decommissioned in February 2026). Access token: 15 minutes. Refresh token: does not expire and is not rotated. Scopes `read`, `trade`, `openid`. A `User-Agent` is required | `/docs/authentication/oauth2/` | The refresh token is the one long-lived secret and never enters a session; it belongs to the tool's program. A `read`-scoped grant cannot place an order at all, which is a gate the broker enforces for us (§7, Phase 4) |
| Orders | `POST /accounts/{n}/orders`; `POST …/orders/dry-run` with the same body; `PUT` to replace, `DELETE` to cancel. A dry run returns the buying-power effect, the fees and warnings; a failed validation is a 422 | `/docs/guides/place-an-equity-order/` | The dry run is evidence the host can fetch itself: the broker's answer about the exact order, put in the consent question and bound to the order by its body's hash |
| Idempotency | None by header, and retries are not deduplicated. The order body carries a caller's `external-identifier`, echoed back; after a timeout the documented recovery is to list orders before resubmitting | `/docs/concepts/orders-and-order-types/` | `external-identifier` is the effect journal's idempotency key, and listing orders is its reconciliation: the "observable world" the journal's first limitation asks for |
| Lifecycle | Received, Routed, In Flight, Contingent; Live, Cancel Requested, Replace Requested; Filled, Cancelled, Rejected, Expired, Removed, Partially Removed. A partial fill is not a status | `/docs/concepts/order-lifecycle/` | The order's observations are a closed list the protocol can type; a fill is read from the legs, not from the status |
| Symbols | OCC form, with the root padded to six characters: `AAPL  220617P00150000` | `/docs/concepts/instruments-and-symbology/` | One parser in the fixture's library; a check refuses a symbol that does not round-trip |
| Balances and positions | `…/balances`, `…/positions`; fields include `cash-balance`, `derivative-buying-power`, `maintenance-requirement`; a position has `multiplier` and `expires-at` | `/docs/concepts/positions-and-balances/` | The cash-secured check reads `cash-balance` less the collateral leases, never a buying-power field |
| Quotes | A DXLink websocket (Quote, Trade, Summary, Greeks, Candle and more) under a token from `GET /api-quote-tokens` that lasts 24 hours; a REST read, `GET /market-data/by-type`, for up to 100 symbols; chains under `/option-chains/{symbol}` | `/docs/guides/stream-market-data/` | Phase 1 and 2 need only the REST read and the chain. The stream is for later, if a sensor needs it |
| Account stream | A websocket that pushes the full object on a change; orders are confirmed, other types unread | `/docs/guides/stream-account-updates/` | Not needed at first: the ingest program polls |
| Sandbox | A full copy at `api.cert.tastyworks.com` with simulated fills near the quote's mid and tickers scripted to reject or rest. **It resets every 24 hours** (positions and transactions cleared), and its REST quote endpoints return 502 | `/docs/sandbox` | The sandbox can prove the tool speaks the real API. It cannot hold a position overnight, so it cannot run a cycle (§7) |
| Limits | No published quota; a 429 carries no headers; back off with jitter | `/docs/guides/rate-limits-and-backoff/` | A recovery cause, not a crash |
| Specifications | Per-area OpenAPI 3.1 files under `/openapi/` (orders, balances and positions, transactions, market data, market sessions, backtesting and others) and an AsyncAPI file for the streams | `/llms.txt` | The mock's contract (below). Not yet read |

The documentation's own guidance to automated clients is the order this note adopts:
dry-run first, a unique `external-identifier`, the sandbox until verified, production
only after a person's explicit approval.

### The mock

An HTTP server in the fixture, `fixture-wheel/broker/`, that speaks the subset of the
API the workload uses, over a scenario file and a clock it is told. HTTP rather than an
in-process fake, because the order tool is a program that reaches the broker by a base
URL, and the same program must later point at the sandbox and then at production with
nothing changed but that URL and the credential.

- **Surface:** the token endpoint; balances; positions; orders (submit, dry-run, list,
  live, replace, cancel); transactions; the nested option chain; the REST quote read.
  No websocket in the first slice.
- **Contract:** every response the mock gives is validated in the fixture's suite
  against tastytrade's published OpenAPI files, so the mock cannot drift into an API
  that does not exist. Whether those files may be committed, or are fetched and pinned
  by hash, is open (§8).
- **Clock:** the mock's time is an input, advanced by the scenario. Expiry, the
  15-minute token and the market's hours all follow it. This is the replay clock of
  §5, and the fixture is where it is first needed.
- **Scenarios**, each a file, each the cause of a check or a recovery rule that must
  exist before it passes:

| Scenario | What the mock does | What it exercises |
| --- | --- | --- |
| Clean cycle | Put fills, expires worthless, again; then assignment, call fills, called away | The state machine and the lot arithmetic |
| Lost acknowledgement | Accepts the order, then drops the connection | The journal: `intended` with no outcome, reconciled by `external-identifier`, never placed twice |
| Rejected | 422 on submit after a clean dry run | A recovery cause, and a signal to a person |
| Resting | The order stays Live to the close and expires | The unit ends without a fill; nothing assumes one |
| Partial legs | A Filled order whose legs briefly lack fills | Reading the fill from the legs |
| Early assignment | A short call assigned before an ex-dividend date | The sensor, and the algedonic signal |
| Adjusted contract | A split changes the multiplier and the symbol | The coverage check under a multiplier that is not 100 |
| Expired token, 429 | 401 mid-run; a 429 with no headers | Refresh inside the tool; back-off as a recovery cause |
| Stale quote, closed market | A quote older than the limit; an order outside hours | The staleness gate |
| Unknown order | An order in the account that no journal entry names | Reconciliation as an alarm: the person, or another client, acted |

## 5. Data as a named input to evidence

The wheel does not need speed: a reading a minute old is enough near a decision. It
needs every number to say where it came from, which is the argument of the
[environment note](2026-11-09-nix-environment-as-evidence.md) (#178) made again for
quotes.

- **Snapshots are records.** The ingest program writes a quote or a chain as a file
  with its as-of time, its source and its hash; a check, a dry run and a consent
  question cite the snapshot they read. Today a sensor's network reach is unseen
  (`sensor-intake`, limitation 2), so a sensor that fetched its own quotes would leave
  nothing to cite.
- **A staleness gate.** The order tool refuses when the snapshot the plan cites is
  older than the declared limit, or the market-sessions calendar says closed.
- **One clock.** The mock, a backtest and a live run read the time from one declared
  input, so a replay cannot see a price from after its own moment.
- **The watcher.** Sensors run only while `regulator watch` runs, and a missed
  interval runs once (`sensor-intake`, limitation 3). Near an expiry the schedule must
  follow the calendar, and a watcher that is not running must itself be a signal.
- **History.** tastytrade lists backtesting endpoints; their content was not read, and
  no REST endpoint for historical option quotes was found. A backtest grader in the
  shape [#125](https://github.com/MetaCoding-io/regulator/issues/125) designs for the
  portfolio therefore probably needs a second, paid source. That choice waits for
  Phase 2 and for a reading of the backtesting specification.

## 6. What the control plane would have to grow

Everything in §3 that is a file, a check, a contract, a profile, a program unit or a
sensor runs today under the mechanisms the portfolio workload runs under. This table
lists what does not.

| # | Needed | Level | Seam | Exists as |
| --- | --- | --- | --- | --- |
| 1 | A declared tool whose effect is journaled | 2 | `DeclaredToolSchema` gains a reconcile program beside its program; `runDeclaredTool` writes `intended` and `committed` through the effect journal | The journal covers `notify_owner` alone (`effect-journal`, limitation 3), and a declared tool is not journaled because its reach is the worktree (`declared-tool`, limitation 4: "which is why … nothing moves money"). This row is the decision of §2 at its seam |
| 2 | Evidence fetched from outside the tree | 2 | A host check that runs the broker's dry run and records the answer with the order body's hash and the snapshot's | Host checks run commands in the worktree; none reaches a network |
| 3 | The data snapshot on evidence | 2 | A `data` reference beside `toolchain` on the evidence record | `toolchain` (#178) is the pattern; nothing names data |
| 4 | Consent with a deadline | 3 | An expiry on a consent question, after which the answer is no and the call is refused | `ask_human`'s outcomes include timed out; nothing ties a question to the close |
| 5 | A standing mandate | 1 | An S5 artifact a person writes: limits inside which a class of order needs no question | Nothing, by intent. Not in any phase of §7 |
| 6 | A signal that opens work | 3 | A contract template a sensor's obligation may be dispositioned into, by S3 or a person | Sensors hold a unit type and never replan; `manage-position` after "delta past its band" has no author today |
| 7 | Capital as a budget | 2 | A dimension on the budget policy, metered from the collateral leases | Budgets meter tokens, cost, turns and wall-clock |
| 8 | New recovery causes | 2 | `data-stale`, `order-rejected`, `market-closed`, `rate-limited` in the recovery policy | The router's causes are about attempts, not about a counterparty |
| 9 | A credential a tool holds and a session never sees | 2 | The tool's program reads the refresh token from the host's environment; the credential canary watches for it in a session | The canary exists; a per-tool secret does not |
| 10 | Calendar-aware sensor schedules | 2 | A schedule that reads the market-sessions snapshot | `everyMs` alone |

## 7. Phases

Durations are estimates, calibrated against the portfolio workload (its note on
2026-10-24, its last Phase 2 slice on 2026-11-08), which asked for less.

| Phase | What | Needs from §6 | Estimate |
| --- | --- | --- | --- |
| 0 | Read the books and the course material into the three bins of §3; read the unread specifications and the API terms (§8); settle the fixture's files | — | 1 week |
| 1 | `fixture-wheel` with its checks, the mock broker and its scenarios, the workload, the profile, the contracts, a scripted unit with a careless variant, and the order tool through the journal. Nothing leaves localhost | 1, 2, 4, 8 | 3–4 weeks |
| 2 | Data as evidence: snapshot records, the staleness gate, the calendar, the one clock; a backtest suite with declared metrics and ablation arms | 3, 7, 10 | 3–4 weeks, gated on a history source |
| 3 | The same tool against the sandbox: OAuth, the real response shapes, the scripted tickers. Scenarios of a day or less, since the sandbox resets | 9 | 1–2 weeks |
| 4 | A shadow run: a `read`-scoped grant on the real account for positions and quotes, with orders sent to the mock and filled from the real quotes. At least two full cycles and one assignment | 6 | 8–12 weeks of calendar time, which no effort shortens |
| 5 | Live: a `trade`-scoped grant, one contract on one underlying, a person's yes on every order | — | after Phase 4, by a decision recorded here |

Phase 4 is the finding of §4: a paper run cannot live in a sandbox that forgets every
night, so the long run is the mock fed by production's read side. Its fills are the
mock's guess at a fill, which is the limitation its card will carry.

Started now and worked alone, a first live contract is five to six months away. It
would not be worked alone: the roadmap's order puts the second live report
([#201](https://github.com/MetaCoding-io/regulator/issues/201)) and the reflector
package first, and this note does not change that order. The reflector matters here
for its own reason: with a horizon of 30 to 45 days a live cycle resolves perhaps ten
predictions a year per underlying, so a proposed edit to the advice is judged mostly by
a probe arm over the backtest suite, with a held-out slice, and the live resolutions
arrive slowly behind it.

## 8. What this note does not claim

- The rules in §3 are not the books'. They are placeholders until Phase 0 cites them.
- Not read: tastytrade's API terms of service, so whether they restrict unattended
  trading is unknown; the OpenAPI and AsyncAPI files; the transactions reference, so
  how an assignment, an exercise and an expiry appear is unknown, and the mock's
  assignment scenario waits on it; the backtesting and market-metrics references.
- Not known: which balance field a cash-secured put consumes at tastytrade, and
  whether the account is a cash or a margin account. The check in §3 is written so the
  answer does not matter to it.
- Open: whether tastytrade's specification files may be committed for the mock's
  contract test, or must be fetched and pinned by hash.
- Tax treatment of premium, assignment and wash sales across an option and its stock
  is jurisdiction-bound, as `tax.json` says for the portfolio. It is in no phase's
  checks until Phase 0 says which rules the fixture declares.
- Nothing here has been built, and the reflector is not a shipped feature.

## 9. Next step

Phase 0: read the unread tastytrade references and terms, and sort the books' rules
into the three bins, in this note. No issue is filed until that reading says what
Phase 1's acceptance criteria are; the phases then go under
[#61](https://github.com/MetaCoding-io/regulator/issues/61) as the portfolio's did.
