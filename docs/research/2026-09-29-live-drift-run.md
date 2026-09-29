# The first live drift runs

- **Status:** open until the live report is committed ([#46](https://github.com/MetaCoding-io/regulator/issues/46)).
- **Source:** three runs of `regulator eval packages/regulator/evals/drift.json --arm control --arm treatment --reps 1` from an installed package against live models (2026-09-25 on 0.1.1, 2026-09-28 on 0.1.1, 2026-09-29 on 0.1.2), read through the report, `regulator unit show`, and Pi's session files for each unit.
- **Why a note:** each run found a defect the workspace could not have found, because nothing in it drives a live session through the dispatcher. The defects, what they say about the arrangement, and what the report must say are recorded here before the report is written, so the report's interpretation cites them rather than rediscovering them.

## 1. What each run found

| Run | Version | Outcome | Cause | Fixed in |
| --- | --- | --- | --- | --- |
| 2026-09-25, twice | 0.1.1 | every unit `no-report`, zero tokens metered | invalid provider keys in the shell; then, with keys, the dispatcher never called `session.bindExtensions`, so no session-bound regulator started and the model ran as a plain coding agent that could not report | [#82](https://github.com/MetaCoding-io/regulator/pull/82) (0.1.2) |
| 2026-09-28 | 0.1.1 | same | same: the session was unbound | #82 |
| 2026-09-29 | 0.1.2 | ten of twelve units closed; `d5-memory` blocked on both arms as a dispatch error | the budget guard halted the attempt at the 400,000-token ceiling (31 and 29 turns); the dispatcher read the abort as a provider failure, failed over to a fallback with no credits and then to a retired model, and each fallback session overwrote the attempt's ledger | 0.1.3 |

The 0.1.2 numbers, one repetition, before the fix:

| Metric | control | treatment |
| --- | --- | --- |
| closed | 5 of 6 | 5 of 6 |
| any drift grader nonzero | no | no |
| memory facts recorded | 0 | 1 |
| tokens per unit, mean | 163,764 | 211,884 |
| turns per unit, mean | 14.8 | 16.3 |

Both arms blocked on the same unit for the same reason, so the block says nothing about the arms; the cost rows do: the gated arm spent about 29% more tokens for the same six units, with no drift for the graders to catch in either arm. That is the honest row the scenario asks for (`packages/regulator/drift/SCENARIO.md`, last paragraph), and the interpretation will have to say whether a model that does not drift on this fixture is a fixture too easy or a model too good.

## 2. What the 0.1.2 run says about the arrangement

- **The guard worked; the router misread it.** The budget guard halted `d5-memory` in both arms at its ceiling, which is what it is for. Pi records the guard's abort as an errored assistant message, and the dispatcher's failover rule read the message and not the ledger, so a policy decision (the ceiling) was treated as an environment failure (a provider down). The recovery router then took the `dispatch-error` rule (`retry, remediate, escalate`) instead of `budget-exhausted` (`retry, replan`), and the unit sat "awaiting remediate: environment" for a person. The distinction between a halt and a failure is mechanical, and the ledger already carried it; the rule just had to read it.
- **One attempt, one ledger.** Each fallback session created a fresh meter for the same attempt number and wrote over the ledger, so by the time the loop closed the attempt the ledger showed the last fallback's zero tokens and one turn, and the exhausted marker was gone. An attempt's cost is attributable only if every session that ran it writes to the same ledger.
- **The route was declared against Pi's registry, not the provider.** `google/gemini-2.5-flash` is in the pinned Pi registry and retired by Google for new keys; `regulator check` cannot know that, and a dead fallback costs one session per halt or failure. The OpenAI fallback failed for want of credits on the account, which is the same class: availability is a key in the environment, not a provider that will answer.
- **The 400,000-token ceiling is about thirty turns of this fixture.** Tokens sum every message's total, so a long context is paid on every turn. `d6-cleanup` closed on the treatment arm at 402,976 tokens by reporting on the turn that crossed the ceiling; `d5-memory` did not. The ceiling is policy and stays; the report must price it.

**Decided (2026-09-29).** A halt by the budget guard is the attempt's end, not a provider failure, and is never failed over; the dispatcher decides from the ledger (`attemptEnd` in `packages/regulator-pi/src/dispatcher.ts`), and a session that opens on an attempt another session already metered resumes that ledger (`BudgetMeter` `resume`). The default routes fall back to `google/gemini-3.8-flash`. The token ceiling is unchanged. Recorded on the `model-router` and `budget-guard` cards and in the 0.1.3 changelog.

## 3. What the report must say

The committed live report will be the first evidence about the regulators under a model, and its interpretation (`--interpretation`, refused as a placeholder by `regulator check` since 0.1.2) has to carry:

1. The version it ran on and these three defects as its provenance: a report on 0.1.3 is the first whose sessions were bound, metered and routed as the cards describe.
2. The cost row: what the treatment arm's checks and context cost per unit against the control arm, in tokens and turns, and whether any drift was there to catch.
3. The `d5-memory` row after the fix: whether the unit closes on a retry under `budget-exhausted → retry`, and what the retry cost.
4. One repetition is an observation, not an interval; the Student's t intervals over six units say so. More repetitions are a spend decision for the person running it.

## 4. Next step

Rerun on 0.1.3 with the interpretation written, commit the report under `packages/regulator/evals/reports/` and the interpretation under `evals/interpretations/`, strike DEBT row 33, and close #46. Row 15 (no headless test drives failover with a model) stays: the headless test now covers the open-and-bind path and the halt-versus-failure decision, not a provider failing mid-route.
