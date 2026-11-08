# LearnHarness and a generated explainer of it, read against the control room

- **Status:** open. The next step is the sequence view the figures thread already
  names ([open questions §1](2026-09-25-open-questions.md#1-the-control-room-should-show-how-the-declared-system-connects)),
  with §4's first three items folded into its design; the remaining items are backlog
  rows there.
- **Source:** a post by Yi-Yi (@yiyibuilds, 2026-11-06) reviewing
  [LearnHarness](https://github.com/amosblomqvist/learnharness) ("Agent harness for
  learning difficult things", AGPL, a Next.js application in an Electron host on the Pi
  runtime), with a 57-second video. The post's verdict: the live learning graph is the
  best part, and the system "tested rather than taught". Before using it the author ran
  [Teachable Code](https://github.com/ywEdAi/teachable-code), an agent skill that turns a
  repository into a static interactive lesson, over the LearnHarness repository; the
  first half of the video is that generated page ("How LearnHarness runs a lesson"), the
  second half is LearnHarness itself. Read 2026-11-08: the post through a mirror of the
  X API, the video as frames at four-second intervals, LearnHarness's `README.md`,
  `docs/architecture.md`, `docs/getting-started.md`, `docs/keyboard.md` and
  `docs/teaching-methodology.md`, and Teachable Code's `README.md`,
  `references/lessons.md` and `references/running-code.md`.
- **Why a note:** two sources in one video, and they bear on two different things. The
  harness is a well-built single-agent product on the same runtime regulator hosts on,
  with no control plane, which makes it a clean comparison for the usual question (what
  does it have at which mechanism level). The explainer page is the more useful of the
  two: it is a figure of a harness that a reader learns by *replaying a recorded run over
  it*, with every box labelled by what kind of thing it is and whether it ran. That is
  the sequence view the figures thread has as its next step, built by someone else for
  someone else's harness, and it shows what the control room's version should carry.

Claims about what the code does today cite the file, at `main` `f55af41`. Claims about
LearnHarness cite its docs; claims about the explainer page cite the video, since the
page itself was not published.

## 1. What the video shows

**The explainer page (0:00–0:30).** A static page titled "How LearnHarness runs a
lesson" with:

- a **route** of seven numbered concepts across the top (Probe to handoff; Plan,
  refusal, quiz; Three readers, one record; The real plan; Settle to next session; What
  the graph stores; Ideas the code assumes), with a progress line at the top right
  ("8 concepts to learn · predictions 0/1");
- a **system map** of the harness as boxes grouped into swimlanes by where the code
  runs (Browser; Server turn; Built fresh every turn; On disk; Background, after the
  turn), with a **legend** of five kinds: *Ran it*, *Pure logic*, *Needs an LLM / AI
  service*, *Needs infrastructure*, *Known limitation*. Each box is coloured by its kind;
- a **scenario bar** that replays a recorded session (its golden fixture is named,
  `chat_mv27rra`) over the static map: a caption "5 / 15 The handler reads the whole
  transcript to decide who runs", the active box and edge lit, a running message count
  on the edge ("25 messages", "59 msgs"), with Step, Pause, Restart and a speed
  control; three scenarios for the one map;
- a **right-hand panel** that states provenance in plain words: "Ran here, on committed
  fixtures: hasProbeDone, toLlmMessages, parseMermaidPlan, ... Read, not run: the server,
  the browser, every model and the extraction agents. Model outputs on this page are
  recorded messages";
- modes: *Knowledge layer* (a second layer of concept cards, "Transcript as state",
  "Placeholder result", "Position from tags", each with *Here*, *Common trap* and *Used
  in the code at*, and a "Did this node make sense? Fuzzy / Lost" pair), *Predict mode*
  (ask what the next step does before it plays), *Repro lens*;
- a second figure, "What the graph stores", that draws real propositions and chains from
  the committed knowledge-graph ledgers ("298 node lines derive to 278 propositions, plus
  173 chains") and says which session they came from.

Teachable Code's own documentation confirms the method behind the legend without using
its words: every input and output in a lesson carries `prov` (`ran`, `read` or
`illustrative`) and the lesson carries a `limits` list of what was not run
(`references/lessons.md`); code runs for real only when it uses the standard library or
pure logic, heavy imports are stubbed and everything downstream of a stub is marked toy
(`references/running-code.md`); the build pins a commit and fails on a changed clone; a
checker plays every step in a browser, and the docs say that proves the page runs, not
that it teaches. The legend wording is what the skill produced for this lesson.

**LearnHarness (0:30–0:57).** A dark two-pane application: a sessions sidebar with a
Teaching / Practice / All filter and a per-session state line ("Waiting for input",
"Working…"); a **status pill** at the top right that reads *Probing*, then *Planning*; a
probe question in a dock with four options, "I don't know", a confidence slider and a
"your thinking" box; a collapsible "Agent's thinking" and collapsed tool-call rows
(`LIST_SESSIONS ›`); the probe's concluding assessment as four named gaps, each with a
floor, a ceiling and a starting point; the plan as a vertical graph; a **footer** with
context used over window and cost so far ("18.4k / 272k · $0.0079"), a model picker and
an effort picker; a "Background agents" entry at the foot of the sidebar.

## 2. The harness, read against the control plane

Both sit on Pi. LearnHarness builds "a fresh native Pi Agent from saved history" each
turn (`docs/architecture.md`); regulator resolves a host by name through the `Host` seam
(`packages/regulator/src/host.ts`) and `regulator-pi` is that host. The mechanism
levels are `AGENTS.md`'s: type, deterministic gate, typed tool, model judgment, prompt.

| LearnHarness part (its docs) | regulator counterpart | LearnHarness level | regulator level |
| --- | --- | --- | --- |
| Three agents over one transcript: Prober, Teacher, Practitioner; the handoff is a successful `probe_done` tool call, after which a fresh Teacher is built | S1 capability profiles dispatched by the loop under a contract (`packages/regulator/src/controller.ts`, `runUnit`; `profiles/*.json`) | code (which agent is derived from the record) | a unit under a contract, a profile as a grant over effects |
| The transcript is the state: "current/visited positions derive from tagged calls, not grades"; the phase is read off the record, never stored as a flag that could disagree with it | `unitTrajectory` folds the records through `UNIT_TRANSITIONS` and says when the fold and the unit record disagree (`packages/core/src/trajectory.ts`; `packages/protocol/src/execution.ts`) | code | type (the closed table) and a check (the fold against the record) |
| Save before inference: "Accepted input is saved before inference. Failed input writes refuse inference" | the effect journal: a side-effecting tool's intent journalled before the effect and reconciled on restart (`packages/core/src/effects.ts`) | code | deterministic gate, with reconciliation |
| One turn per chat, else HTTP 409 | leases with liveness; a second attempt on a leased unit refused (`packages/core/src/coordination.ts`) | code | deterministic gate |
| The plan is "a validated Mermaid DAG, replaceable through `plan_init`"; a cycle is refused by name ("Edge b → a would create a cycle") | the work contract and result report, schema-checked at intake (`packages/core/src/contracts.ts`); the recovery lattice as a declared policy (`policies/recovery.json`) | typed tool | typed tool and a declared policy |
| Background jobs as `jobs/*.json`, independent workers, results delivered by "steering a live agent at a native boundary" or waking an idle session; "single-process coordination over JSON files, not a transactional queue" | the obligation ledger and router; what is owed to a person delivered to the outbox through the effect journal, with reminders (`packages/core/src/obligations.ts`; `packages/regulator/src/deliver.ts`) | code | typed records with a consumer, a severity and a disposition authority |
| Safety: a "sensitive-path guard" over known private locations, "path-based defense in depth, not a content scanner, sandbox, or allowed-folders setting" | the write gate at the Pi hook, the alias walk, the bash snapshot-and-restore, the credential canary, the manifest's writable and protected prefixes (`packages/regulator-pi/src/write-gate.ts`, `authority.ts`) | deterministic gate | deterministic gate, detect-and-repair, and a declared boundary |
| Verification of the learner: self-reported confidence ("not an independent assessment", its own words) and graded quizzes | host-run checks bound to a revision; the technical verdict separate from human acceptance (`packages/checks`; `controller.ts`, `auditUnit`) | model judgment over self-report | deterministic checks; a model is at most an added layer |
| Memory: a knowledge graph of propositions and chains in JSONL, "not ratings of your ability", read by later sessions | operational memory with provenance and expiry, scoped by unit type (`remember`; `packages/core/src/memory.ts`) | typed store | typed tool with a store, provenance and expiry |
| Two UI streams: a per-chat replay-plus-live stream, and a window-level "something changed, refetch" signal with no replay | `regulator status` as a read model; the control room polls it every five seconds (`packages/control-room/src/page.ts`, `schedule`) | push | poll |
| Cost and context legibility: a footer with context used over window and dollars so far, per session | the budget ledger per attempt in the execution store; `regulator status` prints consumed over ceiling; the control room's budget cell | code | declared policy and a ledger, but not shown to the unit ([Exo note §4](2026-11-06-exo-runtime-self-improvement.md) item 1) |
| No declared control plane: the handoff rule, the planning rule and "waiting for the learner's reply to the plan" are, in its own words, "prompt doctrine, not an acceptance transaction" | the definition: the registry, profiles, policies and workload, checked by `regulator check` | prompt | a checked definition |

The shape is the one the [`mini` note](2026-11-05-minimal-harness-and-terminal-bench.md)
found: what LearnHarness has, regulator has at the same or a higher level; what regulator
has that LearnHarness lacks is a regulator. The one row where LearnHarness is ahead is
the second-to-last, and it is the same row Exo was ahead on: the unit can see what it
has spent. The row above it is the one that bears on the control room: push, not poll.

One principle is shared and worth naming, because LearnHarness states it as a concept
card and regulator practises it as a mechanism: **the state is the record, and the phase
is derived**. LearnHarness derives "which agent runs" by scanning the transcript for a
successful `probe_done`; regulator derives a unit's trajectory by folding the records
through the transition table and refuses a status change that is not a row. LearnHarness
applies it to one chat, regulator to an instance.

The post's complaint is the instructive part. LearnHarness measures the learner (probe,
check, grade, confidence) more than it teaches, and its own methodology document locks a
check after every reasoning step. In the vocabulary here, that is an S3\* with no S5
saying what good looks like: the audit is thorough and nothing states the purpose it
audits against. The pathology catalog has no row for it because regulator's identity set
is that statement; the row would be "audit without identity".

## 3. The explainer page as a figure of what exists

The figures thread decided (§1, 2026-09-25, refined 2026-10-26) that a figure of what
exists is generated from the definition and never drawn, and that its next step is the
sequence view: swimlanes for the CLI, the orchestrator, the host session, the domain and
the stores, the unit's path as the spine, every gate placed at the step its enforcement
point names, with one unit's actual trace laid over it. The thread said of the
inspector's replay: "it lists them, it does not place them."

The explainer page is that figure for a different harness, and it was made by an agent
from the repository rather than from a definition, which is why it had to *run* parts of
the code to know what they do and label the rest "read, not run". regulator does not
have that problem: the definition states what each regulator is, where it bites and
what it does not catch, so the page's provenance legend is a projection of fields the
registry already carries. What the page shows that the design in §1 did not yet say:

1. **The legend is the mechanism hierarchy.** The page's five kinds (ran, pure logic,
   needs a model, needs infrastructure, known limitation) are what a reader needs to
   trust a box. The registry's `mechanism.level` (`packages/protocol/src/registry.ts`,
   `MechanismLevelSchema`) is the same axis for a regulator, and every record carries a
   `limitations` list. The control room renders the level as a grey chip on the card
   (`page.ts`, `renderDefinition`) and the limitation only in the inspector. A figure
   that colours each gate by level and marks the ones with limitations makes the
   boundary visible on the path, which `BOUNDARY.md` states only as a list.
2. **The lanes are the enforcement point's `where`.** The page groups boxes by where
   they run. `ENFORCEMENT_POINTS` has five `where` values (`host`, `tool`, `loop`,
   `cli`, `check`) with a closed list of points under each; the sequence view's lanes
   are that field, and the position on the lane is the point.
3. **The replay is a recorded run, named.** The page replays a golden fixture it names
   and says so. The control room's lifecycle stepper replays a live instance's records;
   it has nothing to show with no instance attached. The eval harness's committed
   reports (`packages/regulator/evals/reports/drift-scripted-*.json`) carry arms, runs
   and metrics but not the stores a trajectory folds from, so there is nothing committed
   today that the control room could replay. A scripted drift run whose `.regulator/`
   directory is kept as a fixture would give the control room, the docs and the course
   one recorded unit to step through, labelled as recorded.
4. **The route is the lesson strip.** The page's seven numbered concepts are its reading
   order and its progress. The roadmap row already names a lesson highlight as an
   arm-style filter over the records' `introducedIn`; the page shows what it looks like
   as a strip above the figure, one view per concept, with the rest dimmed.
5. **Predict mode is the prediction record, shown.** The page asks what the next step
   does before it plays. The regulatory log carries a `prediction` block on an
   intelligence signal and a `prediction-resolution` line when the loop resolves it
   (`packages/protocol/src/prediction.ts`). Placing the prediction beside the step it
   bet on, before the outcome, is the honest way to show calibration on the figure.
6. **A card has a fixed shape.** *Here*, *Common trap*, *Used in the code at*. The
   inspector shows the whole record, which is right (the record, not a summary of it).
   A header in that shape above it, built from `purpose`, the first `limitations` entry
   and the enforcement points, is a projection, not a summary, and reads before the
   scroll.
7. **"Ran here" and "read, not run" are said in words.** Any replay the control room
   shows from a fixture says, in the same place and the same words, that it is a
   recorded run and which one.

From the application rather than the page, three smaller things:

8. **A status pill derived from the record.** *Probing*, *Planning*: the instance's
   phase as a count of units per lifecycle state, folded from the execution store, in
   the header.
9. **The footer.** Consumed over ceiling, model route, turns, per unit, in the inspector
   and on the lifecycle stepper. The Exo note's `cacheShare` lands beside it when it
   lands.
10. **"Waiting for input" as a badge.** The one thing a person needs first from the
    control room is what is owed to them. Open obligations with consumer `human`, as a
    count in the header and in the instance list. Answering stays with the CLI (§5).

The control room today refreshes by polling every five seconds. LearnHarness's second
stream, a window-level "something changed, refetch" signal with no payload and no
replay, is a GET-only shape (server-sent events over the store files' mtimes) that stays
inside the read-only rule and removes the five-second lag from the live overlay. It is
not a figure, so it is a backlog row, not part of the sequence view.

## 4. What to take, ordered by cost

Each item sits on a seam that exists and none of them writes anything.

1. **Level and limitation on the generated figures** (§3 items 1, 6). The fragment
   contract already puts a card on every node and edge; the card gains the level as a
   class and the first limitation as a line, and the lifecycle and map figures gain a
   legend drawn from `MechanismLevelSchema`. Level 1 (a projection of typed fields).
   Part of the sequence view's design, and applicable to the two figures that exist.
2. **Lanes from `where`, gates at their point** (§3 item 2). This is the sequence view
   as §1 designed it; the page confirms the lane axis and adds nothing the field does
   not have. Level 1.
3. **A recorded unit as a fixture** (§3 items 3, 7). The eval harness keeps one scripted
   run's `.regulator/` under `packages/regulator/fixture*/` or beside the reports, the
   control room's `--instance` accepts it like any other, and the page says "recorded"
   with the run's fingerprint where the live view says "as of". Level 2 (a committed
   artifact `docs --check` can hold current). Its value is beyond the control room: the
   docs' control-room guide and the course get a unit to step through.
4. **The lesson strip** (§3 item 4). Already a roadmap sentence; the strip is the
   layout. Level 1. Waits on the sequence view.
5. **Predictions on the step** (§3 item 5). Level 1 over records that exist; waits on
   the sequence view and on a live run that resolves a prediction (#46).
6. **Header phase, footer budget, owed badge** (§3 items 8–10). Level 1 over the read
   model. Small; could land before any of the above.
7. **A change signal instead of polling.** Level 2 (a GET endpoint that emits when a
   store file changes). Independent of the figures.

## 5. What not to take

- The confidence slider and self-reported assessment. The post's author found them
  hollow, and they have no place in a control plane that insists on host-owned evidence
  and keeps the technical verdict separate from a person's acceptance.
- The sessions sidebar and the composer. LearnHarness is a conversation surface; the
  control room is an observation surface, and §5 of the open questions keeps it so.
- Deriving the figure from the code by running it. Teachable Code must, because a
  repository declares nothing; here the definition declares what exists and the
  generator draws from it. The page's labels are right; its method is the one regulator
  avoids by having a definition.

## 6. Decided (2026-11-08)

- The sequence view's design in open questions §1 takes §4 items 1 and 2 as part of it:
  the lanes are `ENFORCEMENT_POINTS`' `where`, each gate is coloured by
  `mechanism.level` and marked when it carries a limitation, with the legend drawn from
  the schema, on the sequence view and retrofitted to the lifecycle and map fragments.
- A recorded instance as a fixture (item 3) is the sequence view's first overlay, so the
  view has something to show without a live run; the page labels it as recorded.
- Items 4 to 7 are backlog rows in open questions §6 until the sequence view lands.
- The control room stays read-only (§5); nothing here reopens that.
