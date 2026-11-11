# The behavioral canary

- **Status:** graduated: slice 2's mechanism landed 2026-11-10 under
  [#133](https://github.com/MetaCoding-io/regulator/issues/133) (`roadmap:0.3`), and the policy
  decision is open. `context-degradation` is a recovery cause, classified from the canary's
  finding, whose retry is a fresh session on the degraded attempt's ledger (§6); the shipped
  recovery policy declares no rule for it, and #133 stays open until a live report shows lead
  time or the card retires. Slice 1 (§3) landed with this note in
  [#132](https://github.com/MetaCoding-io/regulator/pull/132): `reg.audit.behavioral-canary.v1`,
  the `Canary` glossary row and the rename of `reg.audit.canary-watch.v1` to the *credential
  canary watch*. The lead-time reading of §5.1 was asked of #46's interpretation and is
  recorded in §6; so is the marker question of §5.3.
- **Source:** a post by Yarchi (@undefinedKi, 2026-10-22) describing a practice it
  attributes to Peter Steinberger: one line in `CLAUDE.md` asking the model to begin every
  reply with the user's name. While the name keeps appearing, the context is healthy; when
  it stops, the model has begun dropping small rules, which precedes inventing facts, and
  the remedy is a fresh chat. The post gives no primary source for the attribution; the
  mechanism stands on its own.
- **Why a note:** the repository already had something called a canary, and it was not
  this. Before building the second kind, the two had to be told apart, named, and placed
  against the mechanisms that already answer the failure the post's canary is a proxy for.

Claims about what the code does today cite the file. The rest is proposal, except the
"Decided" paragraph at the end.

## 1. Two canaries, told apart by polarity

The security industry uses *canary* for two shapes that differ in what the signal is.

| | Credential canary | Behavioral canary |
| --- | --- | --- |
| What is planted | a value | a rule |
| Signal | the value appears | the behavior stops |
| Polarity | presence | absence |
| Observed where | tool results, the model's text, spans | every assistant reply |
| What it infers | an exposure path exists | attention to small rules has gone |
| Nearest prior art | canary token, honeytoken | warrant canary, heartbeat, the coal-mine bird |

The credential canary is what `regulator init` and `regulator fixture` record from a
committed `.env` (`packages/regulator/src/unit.ts`, `canariesFromEnv`) and what the
authority extension redacts from tool results and records when the model writes it
(`packages/regulator-pi/src/authority.ts`). Its card already used the word in the
presence sense: "a real secret the harness was not told about is not a canary". The name
*credential canary watch* says what the planted thing is and matches the card's
`secret-exposure` failure class; the id stays, because the generated `REGULATORS.md`,
`BOUNDARY.md` and the docs key off it and a rename would cost a `v2` for a word.

The behavioral canary is the post's kind. The warrant canary is the exact analogue: a
statement re-asserted every period, whose absence says something upstream has changed,
and whose author cannot be compelled to keep asserting it. Here, upstream is the model's
attention.

## 2. What the control plane already does about the failure

The post's canary is a human's instrument for one question: has the model lost a rule it
was given? regulator answers that question at mechanism levels one to three rather than
five, and each answer leaves a gap the canary covers.

| Mechanism | What it guarantees | What it does not see |
| --- | --- | --- |
| `identity-context` (`packages/regulator-pi/src/identity.ts`) renders the identity set into the system prompt from the files on every run | the rule cannot be lost from a transcript it never lived in | whether the model still *follows* it |
| `contract-preserving-compaction` (`packages/regulator-pi/src/budget.ts`) | what the loop needs survives eviction without trusting the summary | attention that decays with no compaction at all |
| `budget-guard` halts an attempt at a token, turn, cost or wall-clock ceiling, and the loop re-dispatches in a fresh session | the post's "start a new chat", mechanized | it fires at a number, not at a symptom; the ceiling is forty turns too late or ten too early |
| `glossary-lint`, `behaviour-check`, `identity-untouched` at closeout (`packages/checks`) | drift is caught in the output, as evidence, independent of self-report | nothing before the closeout; the attempt is spent |
| `thrash-detector` (`packages/core/src/coordination.ts`) | oscillation between fixes is visible to S3 | a session that is calm and wrong |

So the gap is specific: no in-session, per-reply signal that the model's instruction
following is decaying, before the closeout reads the result. The canary is a level-two
observation of level-five advice, and it is cheap: one short prompt section and one prefix
comparison per reply.

## 3. The mechanism, as landed (slice 1)

Declared, not assembled: the budget policy carries it, the identity extension runs it, a
registry card states what it does not catch.

- **Policy.** `identity.canary` on a policy (`packages/protocol/src/policy.ts`): `marker`,
  what every reply must begin with, with `{unit}` standing for the unit id so the marker is
  the instance's and not one a model could have learned; and `misses`, the consecutive
  replies without it that count. `identity.maxChars` became optional beside it. The shipped
  `default` policy declares `[{unit}]` with two misses; `personal-finance` declares none.
- **Core.** `BehavioralCanary` (`packages/core/src/canary.ts`) reads one reply's text:
  a reply that begins with the marker after leading whitespace is a hit and resets the run;
  a reply with no text (tool calls only) is not a reply and is not counted; the signal is
  raised at the declared count and at each multiple while the silence lasts, as the thrash
  detector signals at each multiple of its threshold. `canaryMarker` substitutes the unit id;
  `renderCanarySection` is the rule as the model sees it.
- **Host.** The identity extension builds the canary at `session_start` from the policy and
  the lease's unit, renders the rule at `before_agent_start` as a section of its own
  (`regulator_canary`), so the identity's character limit never cuts the rule the canary
  depends on, and reads each assistant message at `message_end`. A signal is an advisory
  `audit-finding` of class `context-degradation` from S3* to S3, with the run length as
  runtime evidence and a suggested action; the status line says how long the silence is.
- **Card.** `reg.audit.behavioral-canary.v1`, S3*, deterministic gate, ablated with the
  identity extension (the control arm, which renders no identity, has no canary by
  construction). Its retirement condition is the lead-time question of §5.

Why S3* and not S2: the thrash detector is coordination because oscillation is a relation
between operations. The canary is an independent observation of one unit's conformance to
a rule, which is what audit is here, and it is recorded on the audit channel as the
credential canary is. Why advisory: the marker is a proxy (§4), and the routing policy's
`blocksAtOrAbove` is `blocking`; a proxy should not hold a unit on its own.

## 4. What it does not see

The card's limitations, in prose. A model that keeps the marker and still hallucinates is
not seen; the marker measures attention to one small rule, not correctness. A model that
drops it for a harmless reason, a one-word answer or a reply that is all code, is counted.
The check is a prefix: a marker inside a code fence or after a heading is a miss. The run
is the session's, as the thrash detector's count is, so a resumed unit starts at zero. And
S3 does nothing with the finding yet (§5). The post's version has the same limits and one
more: a person has to be watching.

## 5. What comes next

1. **Read the live runs for lead time.** The committed drift reports ran scripted units
   and never opened a session, so the canary has not fired anywhere a model was present. The
   first live runs on a revision carrying it answer the question the retirement condition
   asks: does the canary fall silent *before* an attempt the closeout then refuses, or only
   after the budget guard or the closeout has already caught the failure? If the latter
   across three model versions, the card retires; the signal adds nothing. The live report
   (#46) should say which, in its interpretation.
2. **Let S3 act (slice 2; DEBT row 42).** If the lead time is real, the silence becomes a
   failure observation under a new recovery cause, `context-degradation`, and the shipped
   recovery policy answers it with a retry in a fresh session, the attempt's ledger carried
   as the budget guard's halt is today (`packages/regulator-pi/src/dispatcher.ts`,
   `attemptEnd`). The thrash detector's `oscillation` cause is the model: a coordination
   signal the recovery router already classifies. The finding stays advisory on the audit
   channel; the cause is what the loop reads. Nothing in this slice makes the canary decide.
3. **Marker design, if the live runs show false silences.** A marker the model drops for
   formatting reasons (a reply that is all a code block) is noise; the fix is in the rule's
   wording or in reading the first text block rather than the whole reply, not in a larger
   `misses`. Decide from transcripts, not in advance.

## 6. Slice 2 as landed, and what the first live report says (2026-11-10)

**The reading (§5.1).** The first live report
(`packages/regulator/evals/reports/drift-live-2026-11-08.json`; its interpretation's fourth
paragraph, and the [live-run note](2026-09-29-live-drift-run.md) §1b) is one model version,
`anthropic/claude-sonnet-4-5`, three repetitions. The canary fell silent in 12 of the 18
treatment units, one episode each, 28 findings in all. No attempt was refused at closeout
and none ended without a report: every second attempt followed a budget halt. Every silent
unit closed on the attempt in which it fell silent. So there is no instance of a silence
preceding a failure the closeout caught. The issue closes
as not planned only when lead time is absent across runs, and the card retires across three
model versions; one version with silences and no failures reaches neither branch.

What the reading does show is the base rate. On this model the silence appears in two
thirds of units that go on to close, so a rule that acted on the silence alone would have
restarted 12 of 18 units that were about to close. The cause as landed does not do that: it
is read only when an attempt has already ended without a report, and the report has no such
attempt, so with the rule declared this run would have been routed exactly as it was. That
is the reason not to declare it yet, in two halves. Nothing in the run shows the rule
helping, and a silent end on this model is as likely to carry the finding by coincidence as
by cause, in which case the rule would give the retry the old attempt's remaining budget
where `no-report` gives it a new one.

**The mechanism (§5.2).**

- *The cause.* `context-degradation` joins `FailureCauseSchema`
  (`packages/protocol/src/recovery.ts`). `classifyFailure`
  (`packages/core/src/recovery.ts`) reads the canary's finding by its `invariant`
  (`CANARY_INVARIANT`, the one constant the identity extension writes and the router reads),
  for the unit, inside the last attempt's own start and end. A finding from an earlier
  attempt does not count: that session and its count are gone.
- *When it applies.* Only when the attempt ended without a report and nothing else explains
  the end. The precedence is: reintegration, the attempt's recorded outcome (a budget halt,
  a refused report, a failed closeout, an error), S2's oscillation signal, the session's
  last observed failure, and then the canary. Each of the earlier ones names something a
  fresh context does not fix, and `budget-exhausted` in particular must win, because a
  retry on an exhausted ledger has nothing to spend. The session's observation wins even
  when it is only a `tool-error`, and the last one of the attempt is the one read, so a
  session that logged a failed command and later ended silently is routed by that error.
  That makes the cause rare by construction; placing it above `tool-error` is the
  alternative, and it is the first thing to revisit when a rule is declared. On every other cause the finding is a
  line of evidence on the decision, so a refused attempt that carries it records the
  lead-time instance §5.1 asks for without anyone reading a transcript.
- *The policy adopts it.* A cause that rests on an advisory finding is routed under that
  cause only when the recovery policy declares a rule for it (`causeUnderPolicy`). With no
  rule the unit is routed as `no-report`, never by the fallback, which is `pause` in the
  shipped policy. Adopting the cause is one line:
  `{ "cause": "context-degradation", "actions": ["retry", "escalate"] }`.
- *The action.* The retry is a new attempt record, capped by the attempt ceiling like any
  other, in a new session. What differs is the ledger: before dispatch the loop opens the
  new attempt's ledger on what the degraded attempt consumed (`carriedLedger`, written by
  `runUnit` from the decision on record), and the session's meter resumes it the way a
  fallback session resumes an attempt's ledger. `carried` on the ledger says how much of the
  consumption is the earlier attempt's and which attempt, so a sum over a unit's ledgers
  counts each token once (`ownConsumption`, used by the graders and the spans). The earlier
  attempt's time is added, not re-measured, so a wait between the attempts is nobody's wall
  clock.
- *What did not change.* The finding is advisory on the audit channel and opens no
  obligation under the shipped routing policy. Nothing stops the model mid-attempt. The
  canary's reading (the marker, the misses, the finding) is slice 1's and is as it was.

Shown headlessly in `packages/regulator-pi/src/dispatcher.test.ts`: real sessions opened by
`openUnitSession` with the definition's extensions bound and no model, scripted replies, the
finding recorded by the identity extension, the loop routing under a test policy that
declares the rule, and the second session's ledger continuing the first's.

**False silences (§5.3).** The report holds, per unit, the number of findings (hence the
episode's length to within one reply, since a finding is recorded every two misses), the
turns and the attempts. It does not hold the audit log or a reply's text, so it cannot show
whether any missed reply was all a code block or began with a heading. The live-run note's
reading of the instances is the only source for their shape: each episode begins at the
second reply, after a first reply that carried the marker, and runs for up to ten
consecutive replies. Two things follow from that shape and the counts.

It is not the formatting artefact §5.3 names. A reply that is all a code block or opens
with a heading would be a scattered miss, and the policy already needs two in a row. Here
the misses are consecutive runs of two to ten, with the same onset in all twelve units; in
`d2-options` of the first repetition the run is at least ten of at most fifteen replies.
Reading the first text block would change nothing, since the canary's prefix check on the
reply's text is already a check on its first text block.

It is not obviously context degradation either. The onset is the second reply, where the
context is the smallest it will be, and not "forty turns in". The same rule on
`google/gemini-3.8-flash` was kept on every reply, marker-only replies included (the
live-run note, §1a). One reading the shape allows is that this model takes "reply" to mean
its answer to the prompt and does not repeat the marker on the short messages it writes
between tool calls. If so, these are false silences of a kind §5.3 did not anticipate, and
the fix would be in the rule's wording. The repository cannot settle it: the text of the
missed replies is in the run's session files, which are not committed. So no change is made
to the rule's wording, to what the canary reads, or to `misses`. The next live report owes
the text of the first two missed replies of each episode, quoted in its interpretation, and
the wording is decided from that.

## Decided (2026-11-10)

Slice 2's mechanism lands without a shipped rule. `context-degradation` is classified only
for an attempt that ended without a report and that nothing else explains, and is routed
under a rule the recovery policy declares; the shipped policy declares none and says why in
its description. A retry under the cause is a new attempt in a new session on the degraded
attempt's ledger. The canary's rule, reading and `misses` are unchanged: the report shows no
formatting artefact, and the wording question waits on transcripts. #133 stays open for the
policy decision, which the next live report informs; DEBT row 42 is reworded, not struck.

## Decided (2026-10-22)

The word *canary* is kept for both kinds and qualified: *credential canary* (presence)
and *behavioral canary* (absence). The glossary row names both. `reg.audit.canary-watch.v1`
keeps its id and is named the credential canary watch. The behavioral canary is S3*,
advisory, declared on the budget policy under `identity.canary`, run by the identity
extension, ablated with it, and declared in the shipped `default` policy. It decides
nothing; what S3 does with the silence is slice 2 and waits on the live runs.
