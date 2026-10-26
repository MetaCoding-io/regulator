# Open questions and things to think about

- **Status:** open, running. Items are added as they come up and struck when they
  graduate to an issue, a debt row or an ADR. Not a roadmap; the roadmap is what has
  been decided. Items with a next step are rows in the roadmap's
  [threads](../../ROADMAP.md#threads--designed-not-yet-scheduled) table.
- **Source:** design conversations (2026-09-25 onward). Where an item is a reading of
  the code, the file is cited.

## 1. The control room should show how the declared system connects

**The complaint.** The control room's *Definition* view is a topology of six columns,
S5 to S1, one card per registry record (`packages/control-room/src/page.ts`, the
`.topology` grid). It says which function each regulator belongs to. It does not say
how they connect: what each consumes and emits, at which point in the loop or in the
host session it bites, or what a unit's path through all of them looks like. The
website's sequence diagram (`how-it-works.html`, "one unit through the S3 loop") and
its three-stores diagram are hand-drawn and say more than the product does, and they
are not generated, so they drift.

**What the data already holds.** Every registry record declares `channels`
(consumes → emits), `mechanism.enforcementPoints[]` and `scope`. The enforcement points
already name the two axes the diagram needs: the host's session lifecycle
(`session_start`, `before_agent_start`, `tool_call`, `tool_result`,
`tool_execution_end`, `turn_end`, `report_result`) and the loop's steps (`runUnit`,
`auditUnit`, `routeUnit`, `closeUnit`, `verifyBase`, `checkDefinition`) and the CLI
(`regulator identity accept`, `regulator watch`). A tally over the forty-three records
puts eight on `tool_call`, six on `runUnit`, five on `auditUnit`, four each on
`runHostChecks` and `session_start`. The diagram is a projection of the registry, not a
new drawing.

**Proposal (type first, then a generated view).**

- Make the enforcement point a typed field, not a string: `{ where: "host" | "loop" |
  "cli" | "check", point: <a closed list per where>, note? }`. The definition check
  refuses an unknown point. Today the strings are free text with the point as a prefix,
  which is why a tally has to split on a space.
- Generate the sequence view from it: swimlanes for the CLI, the orchestrator, the host
  session (Pi), the domain and the stores; the unit's path as the spine (the existing
  hand-drawn sequence); each regulator as a gate drawn *on the lane and at the step* its
  enforcement point names, with its channel arrows. Hovering a gate shows the card. The
  `BOUNDARY.md` renderer is the pattern: rendered from records, never drawn by hand.
- Render the same figure into the docs site and the website from the same generator, so
  the product, the reference and the marketing page show one system.
- The instance view gets the same spine with the *actual* trace of one unit laid over
  it: which gates fired, what they recorded, where the attempt stopped. The unit
  inspector's replay already has the events; it lists them, it does not place them.

The cybernetic reason this matters: the registry is the claim that every failure class
has a regulator; a picture that places every regulator on the path a unit takes is the
cheapest way to see a gap in that claim (a step with no gate on it) and an overlap (two
gates on the same step with the same channel).

**Wider than one figure.** Every diagram on the website's how-it-works page draws something
the definition already declares, or could:

| Website figure | Projection of | Gap |
| --- | --- | --- |
| One unit through the loop | registry `enforcementPoints` on the loop's steps | the points are free text (the typed field above) |
| Where the gates sit in a session | the same field on the host's lifecycle; *can refuse* vs *records only* from `mechanism.level` and `authority.may` | the same |
| Six unit types, one workload | the workload definition (unit types, profiles, closeout checks) | none: already data |
| The recovery lattice | `policies/recovery.json` | none: already data |
| Six states (the unit lifecycle) | ~~nothing yet — obligations have a transition table (`packages/core/src/obligations.ts`), units do not~~ `UNIT_TRANSITIONS` in `protocol`, enforced by the execution store (2026-10-13) | ~~a typed unit transition table in `protocol` that the loop enforces and the figure draws~~ landed: `renderLifecycleFigure` draws it, and the control room's Lifecycle view steps a unit's trajectory over it |
| Who writes where | roughly, `scope.resources` and `channels` | resources are free text (`.regulator/signals.ndjson` beside "the instance's .regulator/"); a closed list of stores |

So the generator is one module over `DefinitionView` that emits SVG per figure, and the
instance view paints the same figures: units per lifecycle state, the recovery decisions
actually taken on the lattice, one unit's replay placed at its steps. The gap and
overlap the picture shows can also be a `regulator check` warning (a warning: some steps
rightly carry no gate).

**Decided (2026-09-25).**

- The generated figures are additional views of the definition, alongside the six-column
  topology rather than in place of it; the topology stays. They need not share a screen
  with it — tabs, or any other arrangement, is a layout choice made when the page is
  built.
- The control room stays read-only (§5).
- `regulator docs --write` renders the SVGs into the docs site, so `docs --check` catches
  drift the way it does for `REGULATORS.md` and `BOUNDARY.md`.
- The website pulls copies of the generated SVGs rather than drawing its own; the
  generator is the only author of a figure.
- Order: typed enforcement points → the generator and `docs --write` → the control-room
  alternatives → the instance overlay. The first two pay in the docs even if the control
  room never changes.
- Writes are a separate question: §5.

**Landed (2026-09-29).** The typed field ([#76](https://github.com/MetaCoding-io/regulator/issues/76)):
`{ where: "host" | "tool" | "loop" | "cli" | "check", point, note? }`, the closed lists in
`packages/protocol/src/registry.ts` (`ENFORCEMENT_POINTS`), all forty-three records
migrated by hand from the survey (the function names — `bindEvidence`, `deliverPending`,
`piDispatcher`, `MemoryStore.record` — went into the point's note; `dispatcher` joined the
host list as the one point that is not an event, since the model router and the trust
rule bite where the host opens the session, not in it), the refusal by name, and tests
holding each list against the code (the host's subscribed events and registered tools,
the loop's functions, the usage line's subcommands, core's exports; `verifyBase` left the list with #48). The tally the figure
needs is now a group-by: `host:tool_call` carries eight records, `loop:runUnit` seven,
`loop:auditUnit` six. Next: the generator.

**Landed (2026-10-13).** The unit lifecycle, as the instance overlay the last bullet of
the proposal asked for, taken as its own slice because the figure it needs was the one
with no data behind it. The prompt was a post by @ohdearlordylord (2026-10-12): replace
the prose spec with the reducer, have the agent draw an interactive diagram from the
real events and the actual reducer code, step through the events, and ask "why" at a
decision. Here the reducer is the loop, and what was missing was its declaration:
`UNIT_TRANSITIONS` in `packages/protocol/src/execution.ts` is the closed table (six
statuses, twelve rows: from, to, the trigger, the loop step that takes it, whether the
loop takes it on its own), and `ExecutionStore.setStatus` refuses a change that is not a
row, so the table is enforced rather than described. The events are the records the
instance already keeps; `unitTrajectory` (`packages/core/src/trajectory.ts`) folds them
through the table in time order, each step carrying its why as the records state it and
the registry record it is the work of, and says when the fold and the unit record
disagree. The figure is `renderLifecycleFigure` (`packages/regulator/src/figures.ts`),
drawn from the table with `data-` attributes for a page to place records on, and the
control room's Lifecycle view steps through a unit's trajectory over it (`#unit=<i>/<id>@<step>`).
The "why" is deterministic: the control room stays read-only (§5) and asks no model;
*copy as a question for your agent* hands the step, its records and the reducer's
location to whatever agent the maintainer uses. What the store does not keep — a status
history — is DEBT row 47; the website's hand-drawn six states is still hand-drawn until
`regulator docs --write` renders this figure and the website copies it, which is the
thread's next step.

**Refined (2026-10-26).** The rule as decided binds a figure of what exists: one whose
every box and edge is a record, an enforcement point, a transition row or a store. Such a
figure the generator draws from the definition and a hand never does, because a drawn
copy of what the code states is a second copy and drifts. The reflector pair (the
[Harness² note §7](2026-10-18-harness2-recursive-harnessing.md#the-two-levels-drawn),
the docs' [What's coming](../project/whats-coming.md) page) showed two cases the rule did
not name, and the question came from the maintainer: some figures are not going to be
generated from a real harness, because they are a level above it.

- *A figure of what is designed and not built.* The "after" figure draws a reflector, an
  advice seed and a probe arm the definition does not have. No generator can draw it, and
  it would be wrong for one to: a generated figure asserts that the thing exists. It is a
  drawing, kept with its research note, shown only on a page that says it is a design,
  and replaced by the generated figure when the mechanism lands; the drawing becomes
  history in the note.
- *A figure that spans more than the definition describes.* The "before" figure's
  instance box is the one-level map the generator will draw. The frame around it (the
  definition band and its files, a person as S5, `identity promote`, the eval harness as
  S3\* one level up, the records column and what reads it) is a claim about the project's
  shape that no record states. For that part the figure is a drawing; for the part the
  definition describes it embeds the generated figure once that exists, and draws it by
  hand until then.

So the rule has three clauses. (1) A figure of what exists is generated from the
definition, never drawn. (2) A figure of what is designed is a drawing, labelled as a
design where it is shown, and replaced by the generated figure when the design lands.
(3) A figure that spans more than the definition describes embeds the generated figure
for the part it does describe and draws the rest. Clause 3 is what keeps the rule
honest at the seams: the drift protection sits exactly where drift can happen, and no
further. Its consequence for the generator is that it emits fragments with stable ids
(the one-level map as a `<g>` a frame can place, its hotspots carrying their cards) and
not only whole figures, so an embedding is a composition and not a copy. The
hand-written script that draws the reflector pair
([`figures/2026-10-18-reflector-figures.py`](figures/2026-10-18-reflector-figures.py))
is the first consumer: its instance box becomes the generated fragment when that exists.
The website copies a composed figure the way it copies a generated one. "Only author of a
figure" in the decision above reads, from here, as "only author of a figure of what
exists".

## 2. A person should be able to create S4 intelligence

**Today.** Intelligence enters the instance one way: a `research` unit under the
`intelligence` profile calls `report_intelligence`, a typed tool that writes an
`intelligence-signal` with the unit, revision and time as provenance the model does not
supply (`intelligence-intake`, `packages/regulator-pi/src/intelligence.ts`). The
router turns it into an obligation that holds the units it names. A person has no way
in: they cannot record "the vendor is deprecating this API in March" or "the statement
format changes next month" without dispatching a research unit to say it for them, which
spends a budget to launder a fact a person already holds. The finance example names the
gap (§5: "No S4. The statement arrives by hand").

**Proposal (typed tool on the CLI; the same record).**

- `regulator intelligence report --by <person> --claim … --observation … --confidence …
  --expires … --affects <unit>…` writes the same `intelligence-signal` with
  `source: "S4"` and provenance `human:<name>`, checked against the interaction policy's
  people the way every `--by` is. Same router, same obligation, same veto. A person is a
  sensor with a name; the record does not care that the sensor is not a model.
- Intelligence from outside: `regulator watch` already forwards the outbox to a channel
  command; the reverse direction — a channel command that *raises* an intelligence
  signal when something lands (a file under `statements/`, a webhook, an advisory feed)
  — is the "watcher that raises an obligation when a new statement lands" the finance
  example names as a short extension. Declare such sensors in a policy file
  (`policies/intelligence.json`: `sensors[]` with a command, a schedule or a path glob,
  and the provenance they write under), so a sensor is a declared part of the
  definition and `regulator check` sees it.
- The control room and `regulator intelligence` list what is held, by whom it was
  raised, what it holds, and when it expires. Expiry is already on the record and the
  router notes it; nothing re-raises a research obligation when a finding an active
  unit relied on goes stale (the card's third limitation). A person's intelligence
  should expire the same way, and an expired signal with an open consumer is worth an
  advisory obligation of its own.
- Keep the boundary: intelligence raises an obligation; it never replans (AGENTS.md).
  A person who wants to *act* on what they know dispatches a unit or dispositions an
  obligation; reporting it is a separate act, and the separation is the point.

## 3. Must every unit run a Pi session?

**No, and it never did.** The loop dispatches through a `Dispatcher` —
`(request) => Promise<{ sessionId? }>` (`packages/regulator/src/controller.ts`) — and the
host supplies one; the scripted dispatchers in `finance-scripted.ts` and
`evals-scripted.ts` run the whole loop without a session, which is how the finance close
runs under CI. A dispatcher that runs a deterministic program in the worktree and writes
a result report is a legal dispatcher today. What is missing is that it is not a
*declared* one: the workload names a profile per unit type, and a profile is a grant
over tool effects for a session. A unit type whose S1 is a parser, a normalizer or a
SHACL run has no session and so no profile that means anything.

**Proposal (the workload definition; a second dispatcher kind).**

- A unit type declares its `runner`: `{ kind: "session", profile }` (today's default) or
  `{ kind: "command", argv, profile? }` where the command runs in the workspace under
  the host's process runner, its exit and its declared outputs become the result
  report, and its effects are what the command declares (a `command` runner's profile
  is the *effect declaration* for the check that a read-only unit is read-only, not a
  tool grant). Budgets for a command runner are wall-clock, CPU and artifact size
  (the ArticleMiner note, §4.7); tokens and turns are zero by construction.
- The closeout does not change: the host re-runs the checks at the revision whether
  the revision was produced by a model or a program. The result-report gate does not
  change: a program's report has no delegated decisions to account for, and the check
  passes an empty list.
- This is what makes the ArticleMiner decomposition honest: `parse-source` and
  `normalize` are command runners; `interpret` is a session; `reconcile-parsers` may be
  either. It also answers the transcript's product claim directly — the loop coordinates
  deterministic and probabilistic units under one contract shape, and the picture in
  §1 shows both kinds on the same spine.

## 4. Predictive intelligence: S4 as a model of "outside and then"

**What S4 is today.** Two records do two jobs. `remember` writes operational memory — a
fact with provenance and an expiry, scoped to unit types, rendered into later units'
context: that is storage for later. `report_intelligence` writes an
`intelligence-signal` — `claim`, `observation`, `evidence`, `confidence`, `observedAt`,
`expiresAt`, `affectedUnits` (`packages/protocol/src/index.ts`) — and the router opens
one obligation *per affected unit*, owed to S3 at `advisory` or above under the shipped
routing policy, blocking at `blocking` or above; an expired signal is noted and raises
nothing (`routeMessages`, `packages/core/src/obligations.ts`). So intelligence today is
an interrupt with a hold, not a cache.

**The question.** Could S4 predict rather than report — the probability a unit escalates,
the attempts a contract shape will take, an instance drifting from its own baseline —
for S3 to allocate on and for a person handling an algedonic signal to read? This is
not a stretch of S4; it is Beer's S4, whose job was a model of the organization and its
environment that could be run forward. What makes it feel like machine-learning creep
is the word "model". It need not be trained.

**Proposal, in the mechanism hierarchy's order.**

1. *A prediction is an intelligence signal.* `claim` is about the future, with a
   `horizon` (when it resolves), a `confidence` that is a probability, and the evidence
   it was computed from. Same router, same obligation, same veto. It never replans and
   never moves a threshold; "S5 uses it" means either the prediction is shown beside the
   obligation a person dispositions, or it becomes a policy proposal (a routing floor,
   an attention budget) that a person accepts. A predictor that adjusts thresholds is
   autonomous S5 mutation, deferred.
2. *A prediction resolves.* When the unit closes or aborts the loop records the outcome
   against every open prediction that named it. A resolved prediction is a pair
   (probability, outcome); the record is regulatory state like an evidence record.
3. *The predictor is an instrument, not a regulator.* A prediction regulates nothing;
   a regulator may act on it as evidence. So a predictor does not get a regulator card
   by analogy. It gets its own kind of registry record — an *instrument* record —
   with what the two kinds share (purpose, implementation, tests, limitations, owner,
   review date, ablation) and what only an instrument has: the quantity it estimates,
   its `level` (below), the metric it is graded on and the report that last graded it.
   The registry then holds two things the control room can draw apart: gates that
   refuse, and instruments that inform. `regulator check` treats an instrument
   without a calibration report the way it treats a regulator without a limitation.

   Instrument levels, in the order the mechanism hierarchy suggests:

   | Level | What it is | Inspectable by |
   | --- | --- | --- |
   | `base-rate` | counts and rates over the execution store | recomputing the count |
   | `smoothed` | a chosen-parameter estimator (a moving or exponentially weighted average, a control chart) | reading the parameter and the window |
   | `fitted` | parameters learned from the instance's records (a regression, a sequence model) | the training set's fingerprint, the held-out score |
   | `model-judgment` | a language model asked to estimate, with its reasons | the prompt and the reasons; the weakest, and graded like the rest |

4. *Base rates first.* The first predictor is counts over the execution store — the
   escalation rate per unit type and cause, attempts per contract shape, cost per route
   — a deterministic level-2 mechanism anyone can read and recompute. A fitted model
   (a regression, a sequence model) is admitted only when the base-rate card's
   calibration is shown insufficient on the same metric, and it is a second card with
   its own ablation, never a replacement of the first by fiat.

**Consumers worth building for.** S3's route and budget resolution (expected cost and
attempts for this contract shape); the recovery policy's next revision (which action
has resolved which cause, as data for a proposal); the attention budget (how much of a
person's attention this week's plan will spend, before dispatch); drift (the instance
deviating from its own baseline in failure rate, oscillation or cost — the corpus-drift
monitor the ArticleMiner note wants, generalized).

**Hazards to record on the card.** A predictor that reads the instance's own trace and
feeds S3 is a feedback loop that can oscillate — the thrash detector's cousin one level
up — so its outputs are advice with a horizon, never a control input at the loop's
step. And it can be self-fulfilling: predict escalation, route to the cheaper model to
save budget, cause the escalation. Calibration catches that only if the resolution
records the route actually taken beside the outcome.

**Added 2026-10-25.** One more thing the instrument record grades, from Lanham's chapter 10 (*AI Agents in Action*, 2nd ed., §10.2.6–10.4.1; the [agent-engineering books note](2026-10-25-agent-engineering-books.md) §4 item 2): a unit's reported `confidence` on an intelligence signal is itself a model judgment about the future, and today it is recorded and never checked. It is an instrument at the `model-judgment` level like any other, and once predictions resolve it is graded on calibration the same way (the book's "metacognitive calibration", confidence against correctness, is the right metric). Until then nothing routes on it, which is the pathology catalog's new §3 row.

## 5. Should the control room write?

**Decided for now (2026-09-27): no.** The control room stays read-only; the figures of §1
are built on the read-only page. This entry holds the design for when the question is
reopened.

**Today.** It will not, by rule: every non-GET request is refused with 405
(`packages/control-room/src/server.ts`), citing the archived
[CONTROL-REGISTRY.md](../archive/2026-09/CONTROL-REGISTRY.md) §6 — "the moment it grows a
*raise budget* or *dismiss obligation* button it has quietly become an S3/S5 authority
surface." The same section leaves the door open: "Actions come later, only as typed
proposals or explicitly authorized commands with their own audit trail." A person who
sees an obligation in the control room has to switch to a terminal to answer it.

**What already exists.** The authorized commands are the CLI's dispositions —
`obligation ack | resolve | escalate`, `answer`, `unit accept`, `memory retract`,
`identity accept | reject` — each with a `--by` checked by `checkDispositionAuthority`
against the interaction policy's people before anything is written
(`packages/regulator/src/cli.ts`, `authorized`). The question is not whether the control
room gets authority; it is whether it may be a second front end to the authority the CLI
already carries.

**A shape that would keep the rule's intent.**

- *One command table, two front ends.* The disposition handlers move out of `cli.ts` into
  a module with runtime schemas for their inputs; the CLI and the server both call it.
  The server owns no write logic.
- *No new powers.* Only the commands that exist. Not dispatch or drive (execution
  authority stays with the orchestrator, and they are long-running); not budgets; not
  editing policies, profiles or the registry — a change to the definition goes through
  `propose_policy_change` → obligation → the S5 decision path, as it does now.
- *The actor is the weak point.* `--by` on the CLI is a name typed at a terminal; over
  HTTP any local process or a cross-site request can POST. At least: bind to
  127.0.0.1, a per-launch token the CLI prints, the actor chosen from the interaction
  policy's people rather than typed, and the surface recorded in the disposition's
  provenance (`via: control-room`).
- *It is a regulator surface, so it has a record.* The control room's write path becomes
  an enforcement point on `disposition-authority`, with the limitation stated (the
  actor is only as strong as the token) and a `docs/DEBT.md` row for it.
- *The rule changes by decision, not by deletion.* An ADR under `docs/decisions/` names
  the permitted commands and supersedes CONTROL-REGISTRY §6's read-only line; the 405
  test changes with it.

**Open.** Whether a first slice of obligations and answers only — what is owed to a
person, which is most of what a person needs to act on — is worth the surface; and
whether a person's identity should be stronger than a name before any of it ships
(the CLI has the same weakness, and fixing it there first fixes both).

## 6. Backlog — smaller things to think about

Items with no design yet. Each gets a section above when it has one.

| Item | Where it came from | Note |
| --- | --- | --- |
| A domain seam beyond git; an artifact store as the first slice | [ArticleMiner note](2026-09-25-articleminer-knowledge-production.md) §4.2 | the largest open design |
| Units as a declared graph with typed edges | same, §4.3 | after artifact refs |
| Declared checks for non-Node domains | same, §4.1 | smallest first slice; blocks any third workload that is not JavaScript |
| A numeric measure on an evidence record; compare attempts | same, §4.4 | the mechanical form of "the corrector does not certify its correction" |
| `authorityRef` to a versioned protected file; S5 decision path over declared semantic files | same, §4.5 | |
| Evidence-gated policy promotion; workload graders over a corpus | same, §4.6 | the adaptive loop's gate |
| Where the identity lives when the domain is not a repository | same, §6 | decides whether an instance is "a repository plus a domain" |
| The `regulator status` read model as JSON for other renderers | §1 above | the control room is the only consumer; a generated diagram needs the same projection |
| ~~Enforcement points as a typed field~~ | §1 above | Done ([#76](https://github.com/MetaCoding-io/regulator/issues/76)): `ENFORCEMENT_POINTS` in `protocol` — `host` (the events the Pi host subscribes to, plus `dispatcher`), `tool`, `loop`, `cli`, `check` — each list held by a test against the code; `regulator check` refuses an unknown place or point by name |
| Sensors as a declared part of the definition | §2 above | |
| A `command` runner per unit type | §3 above | |
| Predictions as intelligence signals that resolve; an instrument record kind in the registry with levels, graded on calibration | §4 above | the record, its resolution and the `harness-edit` payload are filed as [#138](https://github.com/MetaCoding-io/regulator/issues/138) (slice 2 of the accept-path split, 2026-10-26); the instrument record kind stays here until resolved predictions and a live report (#46) exist to calibrate against |
| ~~Eval metrics are a closed list of fifteen trajectory counts (`EVAL_METRICS`); a workload or an instrument cannot declare its own~~ | §4 above; the ArticleMiner note §4.6; the Harness² note §9; the portfolio note §5 | Done ([#129](https://github.com/MetaCoding-io/regulator/issues/129)): a `MetricDeclaration` beside the workload that owns it (`workload/<name>.json`'s `metrics[]`): a namespaced name, a kind, a direction, an optional instrument ref and a grader argv the host runs in the instance after each unit, emitting `{ metric, value, observation? }`; the fifteen are the built-in set and the committed drift reports regenerate byte-identical; a suite pre-registers declared names as built-in ones and may mark one as the optimisation target; a judged metric is refused until the instrument record exists with its held-out score. The first consumer is the portfolio's turnover (`evals/portfolio-turnover.json`). What remains of the four consumers: calibration (Brier) and #49's judged metrics wait on the instrument record kind (§4 above); the corpus F₁ on ArticleMiner's fixture; [#125](https://github.com/MetaCoding-io/regulator/issues/125)'s backtester metrics on the prediction record ([#138](https://github.com/MetaCoding-io/regulator/issues/138)) |
| ~~The docs do not explain intelligence, memory or evals as concepts~~ | this conversation | Done: [Intelligence and memory](../concepts/intelligence-and-memory.md) and [Evidence about the regulators](../concepts/evidence-about-the-regulators.md), linked from the control-plane page, the glossary, the running-units guide and the definition reference |
| Two books bought as references, held in the private `MetaCoding-io/library` repository. *Build a Robo-Advisor with Python (From Scratch)* opens a third workload, `portfolio`, under [#61](https://github.com/MetaCoding-io/regulator/issues/61): deterministic domain checks from its chapters 10, 13 and 14 (constraint bounds, threshold bands, the wash-sale window, the backtester), S4 sensors from drift and harvest triggers (§2 above), Monte Carlo success as a prediction (§4 above), risk tolerance as identity, consent derived from a `place_trade` tool's declared effect (`DEBT.md` row 29), and Black–Litterman (chapter 12) as the worked example of a bounded judgment entering an arithmetic pipeline. *Building LLM Applications with DSPy* opens no thread: its instruction optimisers (chapter 6: GEPA, SIMBA, MIPROv2) are the reflector's implementation reference in the [Harness² note](2026-10-18-harness2-recursive-harnessing.md) §4 and §7, its LLM-as-a-judge calibration (chapter 8) goes to [#49](https://github.com/MetaCoding-io/regulator/issues/49), and its metric functions are a third consumer of the open-metric row above | this conversation (2026-10-24) | Decided (2026-10-24, James): the robo-advisor book gets a design note and a threads row once read — written: [the portfolio workload note](2026-10-24-portfolio-workload.md); the DSPy book is additions to the three places named, not a note — landed 2026-10-25: the [Harness² note §9](2026-10-18-harness2-recursive-harnessing.md#9-implementation-reference-the-dspy-book-added-2026-10-25), an addition to #49, and this row's neighbour above. Both need the open-metric row; the portfolio fixture needs either declared checks for non-Node domains (the ArticleMiner row above) or the arithmetic ported to Node. *Build a Multi-Agent System (From Scratch)* was assessed and set aside until its chapter 9, the only one on A2A and multi-agent systems, is written; its Skills chapter (6) and its three human-in-the-loop patterns (8) are field-study foils for lessons 4 and 13. From the same bundle, *Build an AI Agent (From Scratch)* (Hur and Song) and *AI Agents in Action, Second Edition* (Lanham) were bought on their tables of contents and then read in full; neither opens a thread, and their yield is the [agent-engineering books note](2026-10-25-agent-engineering-books.md) and the additions it lists in its §7 (two pathology rows, two pilot cases, five issues, the five rows below) |
| What the delivered question carries: the outbox writes one line per obligation (`packages/regulator/src/deliver.ts`) and the recovery decision and evidence it cites sit behind `regulator obligation show`, so a person answering from a channel sees the question and not the grounds | Lanham §8.4.6, the second of its four HITL decisions ([books note](2026-10-25-agent-engineering-books.md) §4 item 10) | a bare question yields rubber stamps; the line should carry the evidence refs, or the watcher should render them |
| A review triggered by a model change: registry review dates are calendar-based (`regulator review --due`), the fingerprint records the model, and a route change re-opens nothing | Lanham §7.3.5 (revalidate the threshold when the rubric, the agent or the model changes); [books note](2026-10-25-agent-engineering-books.md) §4 item 9 | real for instruments (a calibration is against one model), arguable for gates; the instrument record kind above is where it lands |
| A shared cause recovered once per unit: six units each take `environment → remediate` for one missing dependency and the instance never notices | Lanham §8.3.7's circuit breaker; `recovery-router` limitation 3 (per cause per unit, by design); pathology catalog §2's new row | a level-2 count over recovery decisions that opens an obligation on the instance, no unit, when N units hit one cause in a window; related to [#46](https://github.com/MetaCoding-io/regulator/issues/46) |
| An idempotency key on `notify_owner` for the deliberate repeat the effect journal refuses | Lanham §8.3.4 (the journal's key, offered as a cache); [books note](2026-10-25-agent-engineering-books.md) §4 item 11 | small; the `effect-journal` card's limitation names the refusal |
| An answered consent should hold for the unit across its attempts: a person's yes on attempt 1 reaches attempt 2 as the hint, but when attempt 2 fails a check, attempt 3's hint is the recovery router's repair hint and nothing tells the unit it already has consent for the same action, so a live unit would ask again (the scripted portfolio close reads the ledger for an accepted consent obligation on its unit instead; `packages/regulator/src/portfolio-scripted.ts`) | the portfolio workload's scripted close ([#120](https://github.com/MetaCoding-io/regulator/issues/120)) | the consent obligation already records the action consented to; the next attempt's hint, or the pause gate's check, should read it and hold the yes while the action it names is unchanged, with a changed action asking again. Belongs with [#60](https://github.com/MetaCoding-io/regulator/issues/60), where the grant will know which call was consented to |
| A forced final tool: if the host's session API can require a tool choice on the last turn, `report_result` could be required rather than its absence routed as `no-report` afterwards | Hur and Song §4.7 (`final_answer` with `tool_choice="required"`); [books note](2026-10-25-agent-engineering-books.md) §4 item 12 | a question, not a decision: nothing in `packages/regulator-pi` uses a forced tool choice, and whether Pi exposes one is unknown |
| Attention as the scarcest budget, shown as one | the interaction policy | `attention.blockingPerAttempt` exists; nothing shows how much of a person's attention an instance has spent this week |
| The course and the product drift | the website's hand-drawn diagrams | anything drawn twice will disagree; generate or link. The figures: §1 (the website copies the generated SVGs) |
| A typed unit lifecycle transition table | §1 above | the lifecycle figure needs it; obligations already have one |
| A closed list of stores for `scope.resources` | §1 above | the who-writes-where figure needs it |
| ~~The shipped identity seed is over its context budget: it renders to 7005 characters against the 6000 a unit's prompt carries, so the tail of GLOSSARY.md (the refused words among it) has not reached units~~ | found paying DEBT row 25 ([#51](https://github.com/MetaCoding-io/regulator/issues/51)); `regulator check` now warns | Decided (2026-09-29, James): not shortened. [#91](https://github.com/MetaCoding-io/regulator/issues/91) raised the default to 12000 characters and made the limit the budget policy's `identity.maxChars`; `check` passes with no warning |
