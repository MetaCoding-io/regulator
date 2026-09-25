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

## 4. Backlog — smaller things to think about

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
| Attention as the scarcest budget, shown as one | the interaction policy | `attention.blockingPerAttempt` exists; nothing shows how much of a person's attention an instance has spent this week |
| The course and the product drift | the website's hand-drawn diagrams | anything drawn twice will disagree; generate or link |
