# Open questions and things to think about

- **Status:** open, running. Items are added as they come up and struck when they
  graduate to an issue, a debt row or an ADR. Not a roadmap; the roadmap is what has
  been decided.
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
| Six states (the unit lifecycle) | nothing yet — obligations have a transition table (`packages/core/src/obligations.ts`), units do not | a typed unit transition table in `protocol` that the loop enforces and the figure draws |
| Who writes where | roughly, `scope.resources` and `channels` | resources are free text (`.regulator/signals.ndjson` beside "the instance's .regulator/"); a closed list of stores |

So the generator is one module over `DefinitionView` that emits SVG per figure, and the
instance view paints the same figures: units per lifecycle state, the recovery decisions
actually taken on the lattice, one unit's replay placed at its steps. The gap and
overlap the picture shows can also be a `regulator check` warning (a warning: some steps
rightly carry no gate).

**Decided (2026-09-25).**

- The generated figures sit *beside* the six-column topology in the Definition view, as
  alternatives the viewer switches between; the topology stays.
- `regulator docs --write` renders the SVGs into the docs site, so `docs --check` catches
  drift the way it does for `REGULATORS.md` and `BOUNDARY.md`.
- The website pulls copies of the generated SVGs rather than drawing its own; the
  generator is the only author of a figure.
- Order: typed enforcement points → the generator and `docs --write` → the control-room
  alternatives → the instance overlay. The first two pay in the docs even if the control
  room never changes.
- Writes are a separate question: §5.

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

## 5. Should the control room write?

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
| Enforcement points as a typed field | §1 above | a small protocol change with a definition-check rule |
| Sensors as a declared part of the definition | §2 above | |
| A `command` runner per unit type | §3 above | |
| Predictions as intelligence signals that resolve; an instrument record kind in the registry with levels, graded on calibration | §4 above | |
| Eval metrics are a closed list of fifteen trajectory counts (`EVAL_METRICS`); a workload or an instrument cannot declare its own | §4 above; the ArticleMiner note §4.6 | calibration (Brier) and a corpus F₁ both need an open metric with a declared grader |
| ~~The docs do not explain intelligence, memory or evals as concepts~~ | this conversation | Done: [Intelligence and memory](../concepts/intelligence-and-memory.md) and [Evidence about the regulators](../concepts/evidence-about-the-regulators.md), linked from the control-plane page, the glossary, the running-units guide and the definition reference |
| Attention as the scarcest budget, shown as one | the interaction policy | `attention.blockingPerAttempt` exists; nothing shows how much of a person's attention an instance has spent this week |
| The course and the product drift | the website's hand-drawn diagrams | anything drawn twice will disagree; generate or link. The figures: §1 (the website copies the generated SVGs) |
| A typed unit lifecycle transition table | §1 above | the lifecycle figure needs it; obligations already have one |
| A closed list of stores for `scope.resources` | §1 above | the who-writes-where figure needs it |
