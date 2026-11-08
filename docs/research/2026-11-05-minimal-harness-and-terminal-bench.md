# A minimal harness read against the control plane, and Terminal-Bench 2.0 as the first public eval

- **Status:** open. The next step is §5.6's first decision (how a unit runs in place, in a
  machine that is not a repository), then an issue for the Harbor adapter under the eval
  thread.
- **Source:** Paweł Huryn, "Agent Harness: How I Built My Own Claude Code, Step by Step",
  *The Product Compass*, 2026-11-05
  (<https://www.productcompass.pm/p/build-your-own-agent-harness>), and the companion
  repository <https://github.com/phuryn/mini-harness> (`mini`), read on the same day. The
  post is paid; sections 1 to 4 (what a harness is, the loop, the tools, the context
  window, a feature comparison) are free, and sections 5 onward (sessions and memory,
  permissions, subagents and goal mode, skills, MCP and cost) are behind the paywall and
  were not read. The repository's README carries the whole design, so the mechanisms below
  are cited from it and the post's claims from its free part. Where the two differ in
  wording, the README is quoted.
- **Why a note:** two reasons, and the second is the larger. The first is the usual pair
  of questions: `mini` is a complete harness in about 1,200 lines of Python, built to be
  read, and it makes several design rules explicit that regulator practises without
  stating. The second is its benchmark result. On Terminal-Bench 2.0 a harness with no
  contracts, no leases, no independent host checks and no protected identity sits in the
  top group with Claude Code. That is a result about regulation, and the drift suite
  cannot answer it, because the drift suite measures what a public benchmark does not.
  §5 designs the run that would.

Claims about what the code does today cite the file, at `main` `c5ff93c`. Claims about
`mini` cite its README; claims about Terminal-Bench and Harbor cite their documentation
and the benchmark's paper, fetched 2026-11-05.

## 1. What the source builds

`mini` describes itself as "an agent harness built for teaching: about 1,200 lines of
Python and two dependencies" (`anthropic`, `mcp`), with "a tool loop, five local tools plus
web search, sessions you can resume, compaction, Agent Skills, MCP servers, subagents, a
`/goal` mode with an independent reviewer, permission prompts with an optional AI judge,
and memory kept in markdown files." The post's one-line account of the division of labour
is "The model decides. The harness does." Its image for the model is "a very capable
colleague who can only talk," and for the harness "the hands, the notebook and the safety
rules around them."

The table maps each part to its counterpart here and to the mechanism level each side
reaches (`AGENTS.md`, "Prime directive": type, deterministic gate, typed tool, model
judgment, prompt).

| `mini` part (README) | regulator counterpart | `mini` level | regulator level |
| --- | --- | --- | --- |
| The loop: "send the conversation, stream the reply, run the tools the model asked for, send the results back, repeat until it stops asking" | Pi's loop; the S3 loop around it (`packages/regulator/src/controller.ts`, `runUnit`) | code | code, with the stopping rule outside the model (§3) |
| Append-only transcript: "the system prompt and tool list are frozen at session start; nothing already sent is ever edited" | Pi's session file; identity and advice as system-prompt sections diffed by Pi (`packages/regulator-pi/src/identity.ts`, `profiles.ts`) | code | code; the economics are not stated anywhere (§4.3) |
| Five tools plus web search | Pi's tools under the profile grant, by declared effect (`profiles/implement.json`; `packages/regulator-pi/src/profiles.ts`) | code | typed tool, with effects declared and read-only derived from them |
| Permissions: a path and command classification, with "Jev, a small decision model" for the middle band (§3) | the write gate, the alias walk, the bash snapshot-and-restore, the credential canary, the trust rule (`packages/core/src/authority.ts`; `packages/regulator-pi/src/authority.ts`) | gate for the ends, model judgment for the middle | deterministic gate, detect-and-repair, and a generated boundary statement (`BOUNDARY.md`) |
| Compaction at `compact_at`, "well below `window`"; server-side on Claude | contract-preserving compaction with a deterministic carried block (`packages/core/src/policy.ts`, `renderPreservedContext`; `packages/regulator-pi/src/budget.ts`) | model summary | deterministic block, then a model summary |
| Memory: `memory/INDEX.md` kept by the model; `/dream` tidies it | operational memory with provenance and expiry, separate from identity (`remember`; `packages/regulator-pi/src/identity.ts`) | prompt | typed tool with a store |
| Subagent: the `task` tool, "a fresh context that returns only its answer"; a `subagent_cheap` model | the research unit type under its own profile, budget and route (`workload/software-development.json`; `profiles/intelligence.json`) | code | a unit under a contract |
| `/goal`: work until `goal_done`, then the harness runs `--verify`, then "a reviewer subagent with an empty context checks the work" | the closeout gate over host-run checks bound to a revision; human acceptance separate from the technical verdict (`controller.ts`, `auditUnit`; `packages/checks`) | one command, then model judgment | deterministic checks; a model is at most an added layer |
| Budgets: `--max-turns`, `--budget` in dollars from `models.json` prices | the budget policy's ceiling per unit type: tokens, cost, wall-clock, turns, attempts (`packages/protocol/src/policy.ts`; `policies/default.json`) | code | declared policy, with the attempt ceiling held by the loop |
| Skills and MCP in Claude Code's formats | skills through Pi; MCP not in the definition | prompt / tool | the course mentions MCP twice; the product does not use it |
| Deliberately left out: "a full-screen UI, hooks, plugins, a sandbox, checkpoints (use git), forked or parallel subagents, OpenAI-format providers, mid-session model switching, and editor integration" | leases and worktrees, the recovery router, the model route with fallback, the obligation ledger, the algedonic path, the registry, the eval harness | | |

The last row is the shape of the difference. Everything `mini` has, regulator has at the
same or a higher mechanism level. Everything regulator has that `mini` lacks is a
regulator: a mechanism that exists because a particular failure was seen and is recorded
as such. `mini`'s README says the same of its own parts, "every part exists because
something specific broke without it," but keeps no record of which failure each part
absorbs, what it costs, or what it does not cover. The registry is that record.

## 2. Where the two agree

Three of `mini`'s rules are mechanisms here, stated more plainly than the docs state them.

1. **"The worker never grades itself."** This is INV-003 and the S3\* independence rule in
   six words. The docs say it as "the report is a claim that stands beside that evidence,
   and it is never a substitute for it" ([contracts](../concepts/contracts.md)). `mini`'s
   version is better and should be quoted where the rule is taught.
2. **"Every tool call gets an answer," including a denial, "so the transcript stays
   valid."** The write gate refuses with `{ block, reason }` and the reason reaches the
   model (`packages/regulator-pi/src/authority.ts`), so this holds, but nowhere here is
   transcript validity named as a reason for it. It is a reason: a refused call with no
   result leaves the provider's request malformed on the next turn.
3. **"Nothing already sent is ever edited."** `mini` freezes the system prompt and the tool
   list at session start and appends later instructions as system messages, for two stated
   reasons: prompt caching, and because current Claude models bind thinking blocks to
   earlier content. The identity and advice extensions render their text as system-prompt
   sections, which Pi diffs so an unchanged section is a cache hit; the course teaches
   that. What is not stated here is the cost side, which §4.3 takes up.

## 3. Where they part

**The stopping rule.** `mini`'s slogan has the model deciding and the harness executing.
The one decision regulator takes away from the model is the one the slogan leaves with it:
whether the work is done. In `mini`'s plain mode the loop ends when the model stops
asking for tools. In `/goal` mode the model calls `goal_done`, the harness runs one verify
command, and a reviewer with an empty context reads the result. That is three steps toward
the closeout gate and three differences from it. The goal is a string, where the contract
divides the decisions into fixed, delegated and unresolved before dispatch. The verify is
one command the goal names, where the workload declares checks per unit type and the
closeout binds their results to a revision (`auditUnit`: a dirty worktree is
inconclusive by construction). And the reviewer is a model, where the technical verdict
is deterministic and a model's reading is at most an added layer (`AGENTS.md`, "S3\* is
not merely a reviewer prompt"). One more thing: the reviewer runs on `mini`'s `subagent`
model, which may be the worker's model. The [agent-engineering books
note](2026-10-25-agent-engineering-books.md) §4 item 1 records why that is not
independence: a judge on the worker's model shares its blind spots, and
[#49](https://github.com/MetaCoding-io/regulator/issues/49)'s instrument record is where
that rule will be held.

**The permission judge.** `mini` classifies every call into three bands. Reads, searches
and edits inside the project run freely. Reading outside the project or any
"likely-secret file" (`.env`, keys, `~/.ssh`, `~/.aws`, credentials), writing outside the
project, and writing to "files that run later" (`.git/`, `Makefile`, `package.json`)
always ask the person. The middle band, other shell commands and MCP calls, asks the
person in `ask` mode or "Jev, a small decision model" in `judge` mode, which "answers in
about 0.3 seconds for a fraction of a cent." The README calls the whole arrangement "a
gate, not a sandbox."

Regulator refuses the judge on purpose. The band it covers, a shell command whose effect a
hook cannot read, is the problem the write gate cannot solve and the bash watch answers
differently: remember what the protected files held, compare after, restore and report
(`packages/regulator-pi/src/authority.ts`, `snapshotProtected` / `restoreProtected`). That
is a level-2 mechanism with a stated limitation (a commit the same command made is not
undone; `BOUNDARY.md`). A judge is a level-4 mechanism with an unstated one: whatever the
small model is persuaded by. The prime directive's order is an order by reliability under
pressure, and a permission decision is under pressure by definition, since the content
that wants the permission is in the window when the judge reads it. Nothing here changes.

What `mini`'s design does get right is the shape around the judge: the judge never sees
the ends. Secrets and later-run writes go to a person whatever the mode, and in headless
runs "anything not covered by `--allow` is denied." That is the same shape as the
interaction policy's kinds (consent for the irreversible, recap by default), and §4.1 and
§4.2 take the two classes it names.

**The benchmark as evidence.** `mini`'s README reports Terminal-Bench 2.0 on what it
calls "the official 10-task sample," five runs per harness, eight harnesses, same model
for every harness. With Claude Haiku 5.5 at high effort, `mini` averaged 9.2 of 10 tasks
passed, Pi and mini-swe-agent 8.8, Hermes Agent and Claude Code 8.4, OpenCode 8.2,
Terminus 2 8.0 and Kilo Code 7.6. With DeepSeek V4.1 Flash, mini-swe-agent 8.8, OpenCode
8.6, Hermes 8.4, `mini` and Claude Code 8.4, Pi and Terminus 2 8.2, Kilo Code 8.0. The
author's own reading is the right one: "in the top group on both models, not the best,"
with gaps under about one task being noise, since "one harness moved by up to four tasks
between runs." One task, `build-cython-ext`, scored zero for three harnesses until a
uv-managed Python was installed elsewhere, after which all three passed it five of five.
Regulator has no comparable number, by decision: `AGENTS.md` defers "production-grade
benchmarks," and the only evidence about the regulators is the drift suite, scripted so
far ([#46](https://github.com/MetaCoding-io/regulator/issues/46) owes the live report).
§5 is about whether that decision should stand.

## 4. What it adds

Ranked. Each is proposed at a mechanism level and against an existing seam.

### 4.1 "Files that run later" as a protected class

`mini` always asks before a write to `.git/`, `Makefile` or `package.json`, because those
execute on someone's next command and not on this one. Regulator's protected set is the
identity and advice file sets (`DEFINITION_WRITERS` in `packages/protocol`), what the
conventions discover (`packages/checks/src/conventions.ts`, `vendor/`), and the prefixes
an instance manifest declares (`packages/protocol/src/instance.ts`, `protectedPaths`).
There is no named class for files whose content runs later: git hooks, `package.json`'s
`scripts`, a `Makefile`, CI workflow files, shell profiles. A unit can write any of them
under a plain `write` grant if the project's writable prefixes reach them, and
`inherited-tests` already meets one consequence (DEBT row 41: the base's `package.json`
is staged with the base's tests).

**Proposal.** A closed list in `protocol` of executes-later path patterns, rendered into
`BOUNDARY.md` under "Who writes the definition" as a fourth class, and read by
`prepareWritePath` (`packages/core/src/authority.ts`) as protected with cause
`executes-later`. A workload may extend the list; nothing may shorten it. The bash watch's
snapshot covers the same files. Mechanism level: deterministic gate. Seam: the authority
preflight and the manifest. The limitation goes on the card: a command that writes one
and runs it in the same shell is detected and restored, not prevented, as today. It also
gives the OWASP ASI05 row (unexpected code execution) a control of its own instead of
"containment is the operating system's."

### 4.2 A read gate on secret-shaped paths

`mini` gates reads of `.env`, key files, `~/.ssh` and `~/.aws` because "whatever the
model reads goes to the API and into the session file." The credential canary watch
(`packages/regulator-pi/src/authority.ts`, `REDACTION`) catches a declared value after the
read and records the case it cannot undo, the model having already said it. A read-side
preflight on a declared set of secret-shaped paths is cheaper and earlier, and it catches
secrets the instance did not know to declare as canaries.

**Proposal.** `read` (and `grep`, `find` over those paths) refused with cause `secret-path`
for a closed list in `protocol` plus the manifest's additions; the refusal names the canary
mechanism as the reason, so a unit that needs a configuration value asks for it. Mechanism
level: deterministic gate. Seam: the same `tool_call` handler the write gate uses. The
canary watch stays, because a secret read through `bash` reaches no path gate, and the
card says so.

### 4.3 The cost of the cached prefix

The post measures `mini`'s start cost at about 8,200 tokens and attributes two thirds of
it to the hosted web-search tool's definition; it prices cached input at $0.20 per million
tokens against $4 uncached on the model it names. Regulator records what it needs to say
the same about itself and does not say it. The budget ledger keeps `cacheRead` and
`cacheWrite` per message (`packages/regulator-pi/src/budget.ts:138`), and every registry
record has a `cost` field, as prose. So three things the live report could carry are
missing: the cache-hit ratio per attempt, the cache-write tokens a regulator's context
section costs on a change, and the prefix invalidation a profile switch or
`setActiveTools` call causes mid-run. The drift note's cost row (29% more tokens on the
gated arm, [live drift runs](2026-09-29-live-drift-run.md) §1) cannot say how much of that
was advice re-sent uncached.

**Proposal.** The ledger summary and `regulator status` report cache read and write beside
total tokens; the eval report's `tokens` metric gains `cacheWrite` as a built-in beside it
(a schema change, so a minor version); and `advice-context` and `identity-context`
state in their `cost` prose what a change to the file costs in cache writes on the next
turn. Mechanism level: reporting over records that exist. Seam: `BudgetLedgerSchema`,
`EVAL_METRICS`.

### 4.4 The reviewer's model as a declared choice

`mini` lets `models.json` name the reviewer's model separately from the worker's and does
not require them to differ. Regulator has no model reviewer, so nothing to fix today; but
the research unit type and any future #49 judge run on a route the policy declares per
unit type, and nothing refuses a `verify` route equal to the `implement` route. The books
note already proposes the rule. This source is a second instance of the same gap in the
untyped version, and the rule should land as `regulator check` refusing a judged
instrument whose model is the unit's route model, when #49 lands. No new proposal.

### 4.5 For the course

Three things, for the course's own repository and recorded here only as pointers. `mini`
is a compact, well-documented foil for the field-study slots: its `/goal` mode is the S3
loop with S3\* folded into a model reviewer, and its list of what was left out is a list
of regulators not built, each with the failure it would have absorbed. Its three-band
permission model is a worked example of the interaction kinds. And the post is the genre
the course competes with: fifteen parts, one paste-ready prompt each, an hour or two,
under ten cents in model calls. The distinction the course has to draw is parts against
control: `mini` teaches what the parts are, and leaves no record of what each part does
not cover.

### 4.6 What it does not add

Compaction, memory, subagents and skills are all weaker versions of what is here (§1).
MCP is the one place `mini` is ahead, and that is a question for the course's feature
coverage, not for the control plane: a tool served over MCP is a tool like any other
once it declares an effect, and nothing in the definition prevents one.

## 5. Terminal-Bench 2.0 with regulator

### 5.1 Why run it, and what a result would and would not show

The decision to defer benchmarks was right while the question was whether the control
plane could be built at all. The question now is different. A harness with none of
regulator's regulators matches the leading product on a public benchmark. Either
regulation costs nothing on short-horizon task success and buys things the benchmark
cannot see, or it costs something there and the cost has to be priced against what it
buys. Both are claims the course and the paper make, and neither has a number.

A run would answer four pre-registered questions, in the eval harness's own frame (arms,
repetitions, declared metrics, a fingerprint, an interpretation a person writes):

| | Question | What answers it |
| --- | --- | --- |
| H1 | Does the regulated arm resolve as many tasks as the bare arm? | resolution rate per arm, with the interval; the benchmark's own grader |
| H2 | What does regulation cost per task? | tokens, cache writes, wall-clock, turns per arm |
| H3 | How often does the loop refuse to close work the grader would have accepted? | units blocked at closeout whose task the verifier resolved anyway (§5.3 says why this can be read off) |
| H4 | How often does a session gate fire at all? | write-gate refusals, bash-watch restores, canary redactions, budget halts per arm |

H3 is the over-regulation row the drift scenario asks for in its last paragraph, on a
dataset nobody here wrote. H4 is the honest expectation: on a fresh machine with nothing
to protect, most of the authority gates should fire zero times, and the number says which
regulators the benchmark can see.

What a result would not show: anything about drift, since every task starts a fresh
environment; anything about a person, since no one can be asked; anything about
contamination, since the tasks and their solutions have been public since 2025-11-07 and
the model may have seen them (the eval harness's own stated limitation). It is a
short-horizon measurement, and the interpretation must say so.

### 5.2 What a task is

From Harbor's documentation
([tasks/overview](https://docs.harborframework.com/tasks/overview.md),
[tasks/instruction](https://docs.harborframework.com/tasks/instruction.md),
[tasks/configuration](https://docs.harborframework.com/tasks/configuration.md)): "a Harbor
task is an instruction, environment, and test script." A task directory holds
`instruction.md`, `task.toml`, `environment/` (a Dockerfile), `solution/solve.sh` and
`tests/test.sh`. The instruction "is markdown passed to the agent at the start of a trial"
and "is *not* passed to the agent as a file in the environment." The verifier runs after
the agent, uploads `tests/` to `/tests/`, and "must produce a numerical reward at
`/logs/verifier/reward.txt`," usually 1 or 0. `task.toml` sets `agent.timeout_sec` and
`verifier.timeout_sec` (900 seconds each for `build-cython-ext`), and resources (one CPU,
2 GB, internet allowed, for the same task).

Terminal-Bench 2.0 is 89 tasks (the paper, [arXiv
2601.11868](https://arxiv.org/abs/2601.11868): "a carefully curated hard benchmark
composed of 89 tasks"); the paper ran each model and agent pair "at least five times."
Three things to know before choosing it. No official ten-task sample was found in the
repository, the registry or the docs, so `mini`'s "official 10-task sample" is either
Harbor's `-l 10` limit or the author's own selection, and a run here should name its
tasks. Terminal-Bench 2.1 (2026-05-06) "fixes 28 tasks" of 2.0, and the current
leaderboard is 4.0 (2026-08-28), so 2.0 is a frozen dataset chosen for comparability with
`mini`'s table, not for currency. And the leading published result on 2.0 is Codex CLI
with GPT-5.2 at 63% over the full set, which puts `mini`'s nine of ten in perspective:
the ten were not the hard ones.

### 5.3 The fit problem

Regulator is a software-development harness whose domain is a repository. Terminal-Bench's
domain is a machine. Four places where that shows.

**Isolation.** A unit runs in a git worktree the loop creates
(`packages/regulator/src/worktree.ts`, `createUnitWorktree`: `git worktree add -b`), and
`startUnit` requires a base checkout (`unit.ts`). `regulator init` refuses a directory
that is not a repository (`instance.ts:92`). A task's `/app` is not one, and much of what
a task asks for is not in `/app` at all: packages installed, services configured, files
written under `/etc` or `/usr`. Git captures none of that, so the worktree is isolating
the wrong thing. The adapter can `git init` the task directory, but a unit that works in
`.regulator/worktrees/<unit>` while the verifier reads `/app` has done its work in the
wrong directory until reintegration copies it back.

**Closeout and the grader.** The verifier is the one independent S3\* the benchmark
offers, and the harness cannot run it: `tests/` arrives after the agent is gone. So the
closeout has nothing of the `test` class to bind to unless the task ships a suite, and a
contract's required evidence would be `semantic` or `runtime`, which waits for a person
who is not there. Two consequences. A unit that cannot close stays on its branch, the
base is unchanged, and the verifier scores zero: in this setting, a refusal to close *is*
the failure, which is why H3 can be read directly off the records against the reward.
And a unit that writes its own tests to satisfy a `test`-class criterion is the
self-certifier the drift suite's fourth behaviour models.

**Contracts.** The loop dispatches a contract, not a string, and the instruction is a
string. Something has to write the fixed, delegated and unresolved decisions, the
constraints and the expected evidence.

**Time.** `agent.timeout_sec` is a wall-clock ceiling the benchmark enforces from
outside. The loop's attempts, recovery routing and reintegration all spend it, and a
recovery decision to retry after a budget halt is a decision to spend the benchmark's
clock on a second session.

### 5.4 The design

**The adapter.** A Harbor installed agent
([agents/custom-agents](https://docs.harborframework.com/agents/custom-agents.md):
`BaseInstalledAgent`, `install()`, `run(instruction, environment, context)`, passed to
`harbor run -a module:Class`). `install()` puts Node 22, pnpm, the published
`@metacoding.io/regulator` and `regulator-pi` packages and Pi's pinned version into the
task environment, runs `git init` and an initial commit in the task directory, and
`regulator init` with `--writable /` scoped as §5.6 decides. `run()` writes the contract
(below), runs `regulator unit drive` with the arm's extensions and a wall-clock ceiling
under the task's, and on close leaves the base checkout as the unit's branch merged.
`populate_context_post_run` reads the budget ledger for tokens and cost, and the trace for
the trajectory (§5.5). The model is `self.model_name`, mapped onto the route the arm's
policy declares; `--ak arm=<name>` selects the arm.

**The contract.** First slice: a template. The objective is the instruction verbatim; no
fixed decisions; one delegation, everything the instruction leaves open, bounded by the
instruction; no unresolved decisions; constraint refs to the registry's authority gates;
expected evidence of class `command`, one entry, a check the contract itself declares as
the instruction's own acceptance where it states one (a file exists, a command exits
zero), else none required. That is a `terminal` workload with one unit type, `solve`,
under a profile that grants `bash` and writes anywhere the manifest allows, and `checks:
[]` beyond `identity-untouched`. A later slice replaces the template with a `plan` unit
that reads the instruction and writes the contract, which is model judgment and costs a
session on the benchmark's clock; that is the course's lesson 06 question asked of a
benchmark, and it is worth asking only after the template arm has a number.

**The arms.** Three, and the first is the control the drift suite does not have:

| Arm | What runs | What it is for |
| --- | --- | --- |
| `bare` | Pi alone, the same model, no extensions, the instruction as the prompt | Pi's own row in `mini`'s table, reproduced locally, so the harness is compared against its substrate and not against another product |
| `operational` | the loop with `tools`, `profiles`, `coordination`, `contract`, `budget`, `recovery`, `evidence` | the S3 loop and its budgets with no authority gates: what the control plane costs |
| `regulated` | every extension, identity seeded, the full check list the `terminal` workload declares | what the whole arrangement costs, and whether anything in it fires |

Each arm is an `evals/terminal-bench.json` suite in the definition, so `regulator check`
validates it and the fingerprint carries the arm, the model, the harness revision and the
task set. The runner is Harbor, not `regulator eval`: Harbor owns the environments, the
grader and the trials, and regulator is the agent. The report the interpretation rule
asks for is written over Harbor's job output by hand for the first run, with the per-arm
means and intervals in the eval report's shape; folding Harbor's reward into a declared
metric (`workload:terminal/resolved`, graded from `/logs/verifier/reward.txt` when the
adapter can read it) is a second slice.

**The tasks.** Ten tasks named in the suite, five repetitions each, three arms: 150
trials. `mini`'s README gives 31 minutes and $0.11 per run on Haiku 5.5, without saying
whether a run is one task or the sample, so the budget is planned from the first arm's
first repetition. The ten should overlap `mini`'s where its ten can be recovered from its
repository, and `build-cython-ext` is one, since the author documents the environment
defect on it and a harness that reads its own failure observations should classify a
missing interpreter as `environment`, not retry it.

### 5.5 What the control plane would have to grow

In the order they are needed.

1. **A unit that runs in place.** A workload declares its isolation as it declares its
   runner (#122): `isolation: "worktree"` (today's behaviour, the default) or
   `isolation: "in-place"`, under which the unit's worktree is the base checkout itself,
   the lease is still taken on the directory, the branch is still created and checked out
   in place, and reintegration is a fast-forward. The S2 cards (`unit-lease`,
   `thrash-detector`, `reintegration`) say what in-place does not give: two units
   cannot run in one instance, and nothing outside the repository is isolated or restored.
   Mechanism level: definition field plus loop code (`loop:` ablation switch).
   `regulator check` refuses in-place under a workload with more than one unit type that
   writes. This is the one change without which nothing else runs, and it is the first
   decision (§5.6).
2. **The `terminal` workload** and its `solve` unit type, profile, policy and contract
   template: definition files only, as `personal-finance` and `portfolio` were.
3. **A dispatch that takes the instruction.** `regulator unit drive --contract-from-template
   <file> --objective <text>` writing the contract file before dispatch, so the adapter
   calls one command. CLI only.
4. **The Harbor adapter**, in Python, in a directory of its own (`bench/harbor/`), with
   the install script and the two `run` paths (bare and regulated). It is not a host: it
   drives the CLI from outside, as a person would, which is why the fingerprint is the
   definition's and not the adapter's.
5. **ATIF export.** Harbor's trajectory format
   ([agents/atif](https://docs.harborframework.com/agents/atif.md): steps with
   `tool_calls`, `observation.results` and per-step `metrics`) is a second projection of
   the same records the OpenTelemetry GenAI spans project (`span-projection`). A
   `regulator trace export --format atif` beside the spans. Reporting only.
6. **Reward as a declared metric** (§5.4), once the adapter can read the verifier's output
   back, and `cacheWrite` as a built-in metric (§4.3), so the cost row is complete.

Nothing above touches the authority boundary, the stores or the loop's steps. The one
piece of loop code is item 1, and it is a new case of an existing field's shape.

### 5.6 Decisions before the first run

For James, in order:

1. **In-place isolation** (§5.5 item 1): a declared mode, or an adapter trick (`git init`,
   then a worktree, then copy back)? The trick measures a harness that does not exist; the
   mode is honest about what S2 gives up on a machine. Proposed: the mode.
2. **The writable prefix.** `/` under the manifest, or the task directory only? Tasks
   that install packages need the former through `bash`, which the gate does not read
   anyway; the manifest's `writablePaths` governs `write` and `edit`. Proposed: the task
   directory for `write`/`edit`, `bash` unrestricted as the `implement` profile already
   has it, and the H4 count says what the gate saw.
3. **2.0 or 2.1.** 2.0 for comparability with `mini`'s table and the paper; 2.1 for
   current tasks. Proposed: 2.0 for the first run, named as frozen, since the comparison
   is the point.
4. **The ten tasks.** `mini`'s ten if recoverable, else the first ten of the repository
   listing in order, named in the suite before any run.
5. **The model.** Haiku 5.5 at high effort, as `mini` ran, so one row of its table is
   reproduced before anything is compared.
6. **Publish or not.** A result goes in `evals/reports/` with its interpretation; whether it
   goes to the leaderboard is a separate decision after the interpretation is written, and
   the leaderboard is 4.0 now in any case.

## 6. Where this lands

- §4.1, §4.2 and §4.3 are proposals against the authority preflight, the `tool_call`
  handler and the ledger; each is an issue when a person decides, and §4.1 opens a DEBT
  row on `identity-write-gate`'s limitations the day it lands.
- §5 is a thread: the roadmap's threads table carries it, next step §5.6 decision 1.
- §2's three rules and §4.5 are the course's, and this note is their record.
- Nothing is a shipped feature, and no number in §5 exists yet.

## 7. Reading

- Paweł Huryn, the post (above), and `phuryn/mini-harness`'s README and `AGENTS.md`.
- The Terminal-Bench paper, arXiv 2601.11868, §3 (the protocol: at least five trials per
  pair, Harbor on Daytona) and §4 (the headline results).
- Harbor's documentation: `tasks/overview`, `tasks/instruction`, `tasks/configuration`,
  `tasks/verifier`, `agents/custom-agents`, `agents/atif`, `jobs/run-a-job`.
- The [Harness² note](2026-10-18-harness2-recursive-harnessing.md) §3 on what a
  benchmark-bound loop cannot see, and the [books note](2026-10-25-agent-engineering-books.md)
  §4 item 1 on the judge's model.
- [Evidence about the regulators](../concepts/evidence-about-the-regulators.md), for the
  frame §5 reuses: arms, repetitions, pre-registered metrics, the fingerprint, the
  interpretation rule.
