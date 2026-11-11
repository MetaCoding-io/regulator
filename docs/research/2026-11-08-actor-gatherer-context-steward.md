# Actor-Gatherer read through the control plane: a context steward

- **Status:** open, proposed. Nothing here is decided; §8 names the slices and the one
  that is the next step.
- **Source:** the Actor-Gatherer framework (UC Berkeley EPIC and Sky labs; Zeighami,
  Akillioglu, Biswal, Cheung, Gonzalez, Parameswaran), as released on 2026-10-17:
  the [project page](https://ucbepic.github.io/actor-gatherer/) with its results, the
  [docs](https://ucbepic.github.io/actor-gatherer/docs.html), the
  [repository](https://github.com/ucbepic/actor-gatherer) and the `actor-gatherer`
  0.1.0 source distribution on PyPI, read file by file where this note cites it. The
  announcement is [this thread](https://x.com/SepantaZeighami/status/2112592578239725699).
- **Why a note:** the framework's claim is that *context management* should be a function
  of its own, separate from the agent that acts, and it ships a Pi adaptor. regulator
  already separates knowing from acting at the unit level (the `research` type against
  `implement`), renders what a unit knows once per attempt, and has nothing that shapes
  a unit's context between model calls. The question is whether a per-call context
  function belongs in the control plane, as what, and at which seam. The conversation
  that raised it also asked whether this is "a workload"; §4 answers that first because
  the answer decides the shape of everything after it.

Claims about what the code does today cite the file. Claims about what Actor-Gatherer
does cite its files. The rest is proposal.

## 1. The question, and the answer in one paragraph

Actor-Gatherer is implementable in regulator, and not as a workload. A workload is a
closed set of unit types (`packages/protocol/src/workload.ts`, `UnitTypeSchema`:
`name`, `description`, `profile`, `runner`, `checks`, `requiresContract`,
`additionalProperties: false`), and a unit, whether a session or the program a command
runner spawns ([#122](https://github.com/MetaCoding-io/regulator/issues/122)), is
dispatched, leased and closed once per attempt; a Gatherer is not a kind of work the
loop dispatches but a function that runs before every model call of every unit. In regulator's vocabulary it is a **regulator over
the context channel**: a registry card, a policy file, a store under `.regulator/`, and
an enforcement point at Pi's `context` event, which the pinned Pi has and regulator does
not yet use. Half of what the framework claims is worth having here and is cheap: a
per-call refresh of what the control plane already knows (memory, obligations,
intelligence, a re-issued contract, the lease and the budget), with no model involved,
and the same store serving a failover session. The other half, LLM-built context across
parallel agents, is bounded in regulator by worktree isolation and in tension with
audit independence, and should be measured as an eval arm with the framework's own Pi
extension before any of it is ported. The name proposed for the component is the
**context steward**: it stewards what a unit is shown, and it owns none of what it shows.

## 2. What Actor-Gatherer is

The framework separates an **Actor** (a coding harness: Claude Code, Codex, OpenCode or
Pi) from a **Gatherer**, a server the Actor's adaptor talks to. Before every model call
the adaptor turns the harness's whole message list into typed events, posts them, and
receives the message list the model should see instead (`ag/integrations/tools/
ag_orchestrator/call_ag.ts`: one `rewrite` request per call; `null` on any failure, and
the harness then sends its own messages). The event types are `user_message`,
`agent_message`, `tool_call`, `tool_output`, `context`, `agent_reasoning`,
`environment_update` and `context_stream` (`ag/ag_interface/event.py`; the policy's two
outside types in `ag/ag_policies/proactive_context_manager/events.py`). Events carry
properties: `channel` (the session), `cwd`, `poller`. An event with no channel is visible
to every session; that is how a poller's events reach everyone.

**Pollers** bring the environment in (`ag/ag_interface/poller.py`). The one shipped is a
directory mtime walk, `FileChangePoller` (`ag/ag_pollers/file_changes.py`), which emits
`environment_update { subject, what, timestamp, source }` for files changed since the
last poll, at most 500 per poll, skipping hidden directories and `node_modules`.

The **policy** decides each session's context (`ag/ag_interface/policy.py`: `read(store,
read) -> Context`, called before every model call; slow work goes to background jobs).
The shipped `ProactiveContextManager` (`ag/ag_policies/proactive_context_manager/
policy.py`, 761 lines, over a toolkit of about 1,500 more) does three things:

- It cuts history into **tasks** with a model (`tools/segmentation.py`), decides at each
  user message whether a new task has started (`tools/boundary.py`, one low-effort call;
  any failure reads as "continuation"), and builds condensed sections of earlier tasks in
  the background. The running task stays verbatim; the context is held under
  `max_context_tokens`, and when a build is adopted the running task is cut and
  summarised as "This task so far".
- It inserts **notices** as developer messages: a file the conversation referred to has
  changed on disk (not when the agent's own tool call could have written it, decided by
  a regular expression over the call text, `writes()`), and what another channel of the
  same gatherer asked for since the last build (`parallel_message`). The events
  themselves never reach the model.
- It places stable material early and volatile material late, for KV-cache reuse.

Every event and **every context ever sent** is stored in one SQLite file per gatherer
(`~/.ag/gatherers/<name>/context.db`; `ag/ag_harness/store/schema.py`: `events`,
`_reads`, `_read_items`, `_made_items`, `_polls`), so a context can be audited later.
The Gatherer's own LLM is configured separately from the Actor's (`ag model
provider/model`, through LiteLLM, or a coding agent run as the model).

**The Pi adaptor** (`ag/integrations/harnesses/pi/setup/setup.ts`) is a Pi extension. It
handles the `context` event and returns the Gatherer's messages; it cancels
`session_before_compact` while the Gatherer is answering, because condensing history is
the Gatherer's job (`AG_PI_COMPACTION=allow` keeps Pi's); the channel is the Pi session
id; a named gatherer (`--ag-gatherer NAME`) is shared across sessions. Pi's own entries
(`custom`, `bashExecution`, `compactionSummary`, `branchSummary`) are carried as
`context` events, verbatim (`adaptor/to_events.ts`). A call that fails or times out
(default 300 s) leaves Pi's messages unchanged.

**The evidence** is the authors' own and is four weeks old. On their single-agent suite
(a SWE-bench variant with the specification moved into history; a BIRD-Interact
variant; questions about a past session) they report 91% accuracy for AG-Codex against
59% for the best baseline (Mem0) and 32% for plain Codex. On their multi-agent tests
(one session needs another's knowledge; a file changes mid-task) they report 100%
against 69% for Codex told where the other traces are and 0% for plain Codex. Across
harnesses on the coding task they report similar accuracy, with AG-Pi the fastest and
cheapest. No independent replication exists; the page states no limitations section and
one trade-off, that a context rewrite invalidates the KV cache and adds latency.

Their framing of what existing approaches miss is the useful part for this note:
compaction is lossy; memory systems retrieve by similarity and can be wrong; tool-based
approaches (the agent searches its own history) miss **unknown unknowns**, the
information an agent does not know it needs. The Gatherer's two moves against that are
that *insertion is automatic* (a hook captures everything; no model decides what to
save) and *retrieval is pushed* (before the call, not on request).

## 3. What regulator does today

Where a unit's context comes from, and what touches it, cited:

| What | Where | When |
| --- | --- | --- |
| profile advice, contract, identity, operational memory | `before_agent_start` sections: `packages/regulator-pi/src/profiles.ts`, `contract.ts`, `identity.ts` | once per `session.prompt()`, and the dispatcher prompts once per session (`packages/regulator-pi/src/dispatcher.ts`, the single prompt with the recovery hint), so **once per attempt** |
| evidence provenance; canary redaction and the bash-watch notice | `tool_result` rewrites: `evidence.ts`, `authority.ts` | per tool result |
| the preserved block and a model summary | `session_before_compact`: `budget.ts`, `renderPreservedContext` in `packages/core/src/policy.ts` | per compaction |
| the pause entry | `agent_before_settle`: `algedonic.ts` | when paused |

Nothing subscribes to Pi's `context` event. The host's enforcement points are a closed
list held against the code by a test (`packages/protocol/src/registry.ts`,
`ENFORCEMENT_POINTS.host`; `packages/regulator-pi/src/enforcement-points.test.ts`), and
`context` is not in it. Two registry cards describe the contract section as regenerated
"every turn" (`contract-advice`, `contract-preserving-compaction`); for a dispatched unit
that is every attempt, since there is one prompt. The `contract-advice` card already
names the consequence as a limitation: the section cannot reflect a contract version
issued after the session started. The `model-router` card names another: a fallback
model starts a fresh session and sees only the contract, not what the primary did.

What the control plane knows, and shares across units by construction, lives under
`.regulator/` (`packages/core/src/paths.ts`): the execution store, the regulatory log
(`signals.ndjson`, where intelligence lives), the audit log, operational memory
(`memory.ndjson`), the effect journal, and the reporting tools' SQLite store
(`events.db`). Intelligence is routed to S3 as obligations that veto dispatch and close
(`packages/core/src/obligations.ts`); it is **never delivered into a running unit's
context**. Memory is rendered at attempt start and filtered by unit type
(`MemoryStore.current`, `renderMemorySection` in `packages/core/src/memory.ts`); a fact
another unit records after this unit started is not seen until the next attempt.
`vsm/channels.yaml` has six channels and none carries context to S1; the protocol's
header says information is typed by control semantics rather than treated as generic
context (`packages/protocol/src/index.ts`).

Two further facts shape the design. Session units run **in-process**: the dispatcher opens each
session with `createAgentSession` from the pinned `@earendil-works/pi-coding-agent`
0.87.0, with a loader that refuses the worktree's extensions, context files and settings
(`dispatcher.ts`, `definitionResourceLoader`; the `project-trust-rule` card). And the
loop runs **one unit per CLI invocation** (`packages/regulator/src/cli.ts`, `unit
dispatch` and `unit drive`); parallelism is separate processes sharing `.regulator/`,
coordinated by leases and one worktree per unit (`docs/concepts/coordination.md`). A
unit's changes are invisible to every other unit until reintegration.

Two notes on `main` already touch this seam from other sides. The [minimal-harness
note](2026-11-05-minimal-harness-and-terminal-bench.md) reads a harness's compaction and
markdown memory against contract-preserving compaction and `remember`, and calls them
weaker versions of what is here; the [Exo note](2026-11-06-exo-runtime-self-improvement.md)
places compaction and context assembly among the harness components an agent edits
mid-task, which regulator refuses. Neither proposes a per-call context function; this
note does, and it keeps the two refusals (the carried block, the record the agent cannot
edit).

The span projection states a principle this note has to respect: **the transcript is
never read** by the orchestrator (`packages/core/src/spans.ts`). The conventions say the
same from the other side: run traces must not become a competing source of truth
(`AGENTS.md`, "Repository conventions").

Verified against the pinned Pi's types (`dist/core/extensions/types.d.ts` of 0.87.0):
`ContextEvent { type: "context"; messages: AgentMessage[] }` fires before each LLM call
and a handler may return `{ messages }`; the messages exclude the system prompt, and Pi
restores the prompt and tool state after the handler returns, so a handler cannot drop
them. `context_with_system` follows it with the full transcript, and
`before_provider_request` can replace the provider payload. `session_before_compact`
may return `{ cancel: true }`.

## 4. Why it is not a workload

A workload in regulator is declarative data. The loop reads three things from a unit
type: the profile to dispatch under, the checks to run at verify
(`packages/regulator/src/controller.ts`, `runUnit` and `auditUnit`), and, since
[#122](https://github.com/MetaCoding-io/regulator/issues/122), the runner: a session
under the profile's grant, or a declared program the control plane runs itself in the
unit's worktree with no host and no model (`packages/protocol/src/workload.ts`,
`RunnerSchema`; `packages/regulator/src/runner.ts`; the `portfolio` workload's
`harvest-losses` and `place-trade` types are the first). Either way what runs is a
unit: contracted, leased, dispatched, routed and closed, once per attempt, and its
output is a report. Nothing in a workload observes another unit's session or sits
between a model and its input. A Gatherer does both, on every call of every unit, and
is never itself dispatched or closed. Declaring it as a unit type, even a command one,
would misdescribe it. It is on every unit's path, which in this system is what a
regulator is.

The one place the workload is touched is sharing (§5, "policy"): *which unit types may
be shown which other unit types' history* is a property of the kind of work, so it is a
field on the unit type, not on the steward. That is a later slice and the only schema
change this note proposes.

The question the conversation also raised, a domain that writes to git **and** a
database, is a different seam and is not this note's: it is the `Domain` interface of
the [ArticleMiner note §4.2](2026-09-25-articleminer-knowledge-production.md#42-the-domain-is-a-git-repository),
with the effect journal (`packages/core/src/effect-journal.ts`) as what exists today for
a side-effecting write. The steward's own store is control-plane state and sits under
`.regulator/` like `events.db`; it is not domain output and needs none of that seam.

## 5. The mapping

| Actor-Gatherer | regulator | Mechanism level |
| --- | --- | --- |
| `insert`: the adaptor sends every message before every call | a host extension records what the session saw and did, from the hooks already subscribed (`message_end`, `tool_execution_end`, `tool_result`) and from the typed records other extensions already append | 2: deterministic capture, no model |
| the gatherer server and its SQLite | a store under `.regulator/` shared by every unit of the instance, append-only, with every context sent recorded for audit | 3: typed records |
| `get_context`: the policy's `read` before each call | a `context` handler that returns Pi's messages with the steward's items added or replaced | 2 for the model-free slice; 4 where a model builds a section |
| pollers (`FileChangePoller`) | **sensors**, the declared part of the definition proposed in [open questions §2](2026-09-25-open-questions.md#2-a-person-should-be-able-to-create-s4-intelligence): the regulatory log and the ledger (what [#59](https://github.com/MetaCoding-io/regulator/issues/59) will watch), the memory store, the lease, the budget ledger, the worktree's mtimes for what `bash` or a person changed | 2 |
| the context policy and `gatherer.toml` | `policies/context.json`: what is pinned, the token budget per section, which notices are shown, and (later) which unit types share | declared, checked by `regulator check` |
| a named gatherer shared across sessions | the instance; the steward is per instance and the unit is the channel | — |
| `ag model …`, the Gatherer's own LLM | a model route in the budget policy, metered against the unit it serves | — |

What the steward would render per call, in the model-free slice, is all state that
exists today and is currently shown once or never:

- memory entries recorded since the attempt started, scoped as now;
- obligations opened on this unit since dispatch, and intelligence that names it, with
  severity and what it holds, so a unit under a blocking hold learns of it before its
  next action rather than at close;
- a contract version issued after the session started (the `contract-advice`
  limitation);
- the lease's remaining time and the budget's remaining tokens and turns, which the
  budget guard checks between turns but never tells the model;
- for a failover session, the primary's preserved block, so the fallback does not start
  from the contract alone (the `model-router` limitation).

Each is a rendering of a typed record the system already holds, with its provenance.
That is the resolution of the "no channel carries context to S1" point: the steward
adds no channel. A notice is a view of a `memory-recorded`, an `obligation`, an
`intelligence-signal`, a contract file or a ledger entry, and says which. The glossary
already has the word for the function: attenuation, "reducing incoming variety before it
reaches the regulator, by retrieval, tool narrowing, truncation, or context shaping"
(`docs/GLOSSARY.md`).

## 6. Where it conflicts, and how each is resolved

1. **Compaction.** The framework's Pi adaptor cancels `session_before_compact`, so
   `contract-preserving-compaction` would never fire and its deterministic block (the
   contract's identity and allocation, the evidence so far, the files touched) would be
   replaced by the policy's model-built sections. The card's whole point is that what the
   loop needs never depends on a summary being good. Resolution: the preserved block is a
   **pinned item** in the steward's policy, present in every context it returns; and the
   steward never cancels compaction unless its own policy carries the block. In the
   model-free slice compaction is untouched.
2. **Audit independence.** Showing a `verify` unit the `implement` unit's narrative hands
   S3* the S1 self-report the architecture keeps it independent of (`AGENTS.md`, "S3* is
   not merely a reviewer prompt"). Resolution: sharing is declared per unit type, default
   none; `verify` and `close` receive nothing from other units' transcripts; `integrate`
   and `plan` are the types that would. A share the policy does not declare is not made.
3. **Budgets.** A Gatherer spends tokens on a model the unit never calls. The budget
   guard meters the session's own usage (`budget.ts`). Resolution: the steward's model
   calls are metered into the unit's ledger as a named dimension, or the steward has its
   own ceiling in the budget policy; either way the spend is declared and visible, never
   unmetered. The model-free slice spends nothing.
4. **The transcript is never read.** A Gatherer reads transcripts by definition.
   Resolution is placement: the steward is a host extension on the session's side of the
   seam, like the `tool_result` rewrites, and never the orchestrator's. Its store is
   evidence (what a unit was shown, when, from which records), which `regulator status`
   and the replay view may show, and which the loop never reads to decide anything. The
   orchestrator keeps deciding from the execution store, the logs and the host checks.
5. **Mechanism level.** Context shaping is level 5 in the hierarchy. The identity,
   contract and profile sections stay system-prompt sections that Pi restores after the
   `context` handler, so the steward cannot remove what the gates rely on; and what the
   steward adds is advice with provenance, like memory, whose mechanism sits in the write
   path (`docs/concepts/intelligence-and-memory.md`, "Rendering it into the prompt is
   prompt engineering … The mechanism sits in the write path instead"). The same
   argument holds here: the steward's mechanism is the capture and the store, and the
   rendering is advice.
6. **Trust.** Pollers' events are visible to every session, and the framework's file
   poller reads the working directory. In regulator a unit's worktree is project content
   under the trust rule, "data absorbed as control" is a named pathology, and a notice
   that a file changed is data about the domain, not an instruction. The steward renders
   a change as a fact with its source (the sensor, the path, the time) and never the
   file's content.

## 7. Where it pays, and where less than the paper suggests

**Unknown unknowns, measured here already.** Lesson 14's graders found that `remember`
changes what a unit *can* do, not what a prose-preferring model *will* do (`docs/DEBT.md`
row 26). A tool-based save-for-later depends on the model choosing to save and a later
model knowing to ask. Automatic capture and pushed rendering remove both choices. That
is the same instinct as host-run evidence over self-reporting, applied to what a unit
knows, and it is the strongest reason to have a steward at all.

**Failover.** The `model-router` limitation is exactly a Gatherer's single-agent case:
two sessions, one task, the second blind to the first. No sharing between units, no
audit question, and the preserved block already exists to carry.

**The control plane as the environment.** The framework's environment is the file
system because its harnesses have no control plane. Here a unit's worktree does not
change under it (one worktree per unit; the base moves, the worktree does not), so a
file poller finds little except a person's edits and `bash`'s. The environment worth
sensing is the regulatory state: a hold that just landed on this unit, a fact another
unit just recorded, a lease about to lapse. Those are typed, append-only and already
under `.regulator/`, which makes the sensors deterministic and cheap.

**Lateral awareness is bounded.** Worktree isolation is the S2 mechanism that makes
parallel units safe, and it also makes them mutually blind until reintegration; the
result report and reintegration are the hand-off. A steward can give `integrate` what
`implement` tried and `plan` what the last `verify` found, and should give `verify`
nothing (§6.2). The framework's 100%-against-0% result is a measurement of a gap
regulator closes differently, by contracts and reports, so the gain here is the residue
those leave, and it has to be measured, not assumed.

**Long attempts.** The segment-and-build policy is a more capable summary than the one
`contract-preserving-compaction` makes with one model call. Whether that capability
shows up as fewer lost decisions in the drift suite is the question for the eval arm.

## 8. Slices

Cheapest first, each with its done-when. Slice 1 is this change.

**Slice 1: this note and its threads row.** Done when the row is in
[`ROADMAP.md`](../../ROADMAP.md#threads--designed-not-yet-scheduled) and this note is in
the [research index](README.md).

**Slice 2: the model-free context steward.** The next step.

- `"context"` joins `ENFORCEMENT_POINTS.host` (`packages/protocol/src/registry.ts`), and
  `enforcement-points.test.ts` is updated with the extension that subscribes to it.
- A twelfth extension in `packages/regulator-pi` (`context.ts`), loaded by the
  dispatcher's `EXTENSIONS` list, with a `context` handler that appends the steward's
  items to Pi's messages as `custom` entries, each item keyed so it is shown once and
  then only its change. It renders the five items of §5 and nothing a model wrote.
- A store under `.regulator/` (`context.ndjson`, or a table in `events.db`): per call,
  the unit, attempt, call index, and the ids of the records rendered. The replay view
  shows it.
- Sensors in `policies/context.json`: the stores to read and what to render from each;
  `regulator check` refuses an unknown sensor. The worktree mtime sensor is optional and
  off by default.
- A registry card, `context-steward`, `vsmFunction: S3`, level `deterministic-gate` (the
  schema's word for a model-free mechanism, `MechanismLevelSchema`; it refuses nothing,
  which its limitations say) for this slice, with the limitations stated (advice; shows only what the stores hold;
  nothing from other units' transcripts), an ablation switch (`extension:context`) and a
  retirement condition.
- Done when: `pnpm check` passes; a dispatched unit under a blocking obligation opened
  mid-attempt sees the hold in its next call (a test with a scripted unit); a memory
  fact recorded by another process mid-attempt is rendered on the next call; a failover
  session's first call carries the primary's preserved block; the `contract-advice` and
  `model-router` cards' limitations are narrowed and the debt rows updated.

**Slice 3: the eval arm with the framework's own Pi extension.** Measures "is it
useful" before anything is ported.

- The dispatcher's loader takes an additional extension path declared by the arm
  (eval-only; the trust rule still refuses the worktree's), pointing at
  `ag/integrations/harnesses/pi/setup/setup.ts`, with `AG_HOME` under `.regulator/` and
  the Gatherer's model set to the unit's route.
- Arms: `contract-preserving-compaction` on (today), the framework's steward on with
  compaction cancelled (its default), and both, with the preserved block pinned by the
  arm's policy.
- Done when: a committed report under `evals/` with the interpretation the eval harness
  requires, over the drift scenario, with the graders the suite has (fixed decisions
  lost after compaction; `suiteWeakened`; the report gate's refusals). Waits on
  [#46](https://github.com/MetaCoding-io/regulator/issues/46), the first live report,
  because scripted runs need no host (`packages/regulator/src/host.ts`) and so never compact.

**Slice 4: a model-backed steward, only if slice 3 shows a gain.**

- Port the policy's three moves (segment, build in the background, pin and place) to
  TypeScript in `packages/regulator-pi` or a package of its own, with the preserved block
  pinned, under a model route and a ceiling in the budget policy, metered into the unit's
  ledger.
- The one workload change: a `context` field on the unit type naming the unit types
  whose history it may be shown (`shares`), default none, checked by the definition check
  against the audit rule (§6.2: a type under a read-only audit profile shares nothing
  in).
- The card's level becomes `model-judgment`, and its limitations say what the model
  decides and what the deterministic part guarantees, as the compaction card does.

## 9. Open questions

- **Whose budget.** A steward's model calls serve one unit per call but one build serves
  many calls. Metering per call to the unit it serves is simplest; a steward ceiling of
  its own is more honest about what the build costs. Decide at slice 4.
- **Is shown-context evidence?** The framework stores every context sent so it can be
  audited. Here that store would say what a unit was told, which bears on whether a
  deviation was the model's or the harness's. Whether it joins the audit log or stays
  its own file is a question for the replay view's owner.
- **The `custom` entry versus a system section.** Pi restores the system prompt after
  `context`, so volatile state cannot go there from this handler; a `custom` message is
  the framework's own choice for Pi. Whether a steward item should instead be a
  `before_agent_start` section refreshed by re-prompting is a Pi-API question to settle
  in slice 2.
- **A person as a sensor.** Open questions §2 proposes `regulator intelligence report
  --by`. A steward makes that intelligence reach a running unit, which §2 does not
  address; the two threads should land with the same record and the same provenance.
- **Push against pull, and against the unit's own note** (added 2026-11-11). Three
  other proposals put something in a unit's context mid-attempt: the
  [Exo note](2026-11-06-exo-runtime-self-improvement.md)'s `read_budget` (§4 item 3),
  the unit's ledger as a read-only tool it calls; its `note_to_self` (§8.3), a line the
  unit appends to the preserved compaction block for the rest of the attempt; and the
  [agent-memory note](2026-11-08-components-of-agent-memory.md)'s `recall` (§6 item 6),
  facts by subject on request. The steward pushes the budget remaining and the facts
  recorded mid-attempt into every call without a call. Slice 2 decides whether
  `read_budget` is subsumed by the steward's budget item; `note_to_self` and `recall` are
  the reflector thread's and stay distinct.

## 10. For the record

The framework's results are its authors' and four weeks old at the time of writing; this
note treats them as the reason to run slice 3, not as a finding. The conversation that
started this note first asked whether a Gatherer could be "a design of workloads"; §4 is
why not, and the only workload change proposed is the `shares` field of slice 4. It also
asked whether adding tools to save into a common store would do: the tools exist
(`remember`, `report_intelligence`, the reporting tools over `events.db`), and the
reason they are not a steward is §7's first paragraph, that a tool is a choice the model
has to make, and the steward exists to remove that choice.
