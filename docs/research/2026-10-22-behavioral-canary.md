# The behavioral canary

- **Status:** open. Slice 1 (§3) landed with this note: `reg.audit.behavioral-canary.v1`,
  the `Canary` glossary row and the rename of `reg.audit.canary-watch.v1` to the
  *credential canary watch*. Slice 2 (§5) is DEBT row 42 and a threads row; it waits on
  the live drift runs ([#46](https://github.com/MetaCoding-io/regulator/issues/46)).
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

## Decided (2026-10-22)

The word *canary* is kept for both kinds and qualified: *credential canary* (presence)
and *behavioral canary* (absence). The glossary row names both. `reg.audit.canary-watch.v1`
keeps its id and is named the credential canary watch. The behavioral canary is S3*,
advisory, declared on the budget policy under `identity.canary`, run by the identity
extension, ablated with it, and declared in the shipped `default` policy. It decides
nothing; what S3 does with the silence is slice 2 and waits on the live runs.
