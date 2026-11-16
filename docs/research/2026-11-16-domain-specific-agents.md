# Domain-specific agents read against the workload

- **Status:** open. No issue yet; §4 names three proposals, and §4.1 (a workload as a
  package `regulator` installs) is the one on the roadmap's threads table.
- **Source:** Justin Schroeder (Standard Agents), *Why Domain-specific Agents Are the
  Future*, a talk for the Agentic AI Foundation
  ([video](https://www.youtube.com/watch?v=wIPr9GmLRaQ)), read from the auto-generated
  captions James supplied in conversation on 2026-11-16; the captions mangle several
  product names, so no claim below rests on one. Read beside it: an earlier delivery of
  the same talk at AI Engineer World's Fair 2026
  ([talk page with transcript](https://ai.engineer/talks/spNAUEgq_A8-future-is-domain-specific-agents)),
  and the [Standard Agent Specification](https://standardagentspec.org/) the talk
  promises, at 0.2.0: the overview and the packaging, models and agents pages. The other
  specification pages were not read.
- **Why a note:** the talk argues for the thing a workload is — an agent built around
  one business process, with only the tools that process needs and its own evals — and
  argues it to an audience that has never heard of a control plane. It puts one thing
  on the table the build does not have, an agent that installs like a package, and it
  leaves unanswered the question the build exists to answer. Both are worth recording.

Claims about what the talk and the specification say cite them. Claims about what the
code does today cite the file, read on `main` at `a0706e7`.

## 1. What the talk says

The opening picture is a factory before electrification: one steam engine, and a line
shaft through the walls with a belt down to every workstation. Schroeder's claim is that
agents are in that era. One large model sits in the middle and every task is belted to
it, by a skill or an MCP server. What he wants is a motor at each workstation: a small
agent built around one or two tasks.

His definition of an agent is "deterministic software that utilizes non-deterministic
results produced by a model in pursuit of a desired objective", which he says is the same
thing as a harness. Its parts, bottom up: a model, a system prompt, tools (a function, a
sub-prompt for one small inference, or a whole sub-agent), hooks that run
deterministically at fixed points, and agent rules such as how many steps a side may
take. A filesystem and code execution usually come with it.

He gives three reasons businesses build these in spite of the advice to ship an MCP
server and stop:

- **Integration.** A business is its processes, each "a line that has a start and an
  end point". His example is an HVAC shop's fleet maintenance: report the issue, assess
  the priority, schedule the repair, update the record, return the truck. The owner has
  no interest in a general agent owning the whole shop "even if it completely works".
  An offer to make that one process right is interesting.
- **Trust.** A Gmail agent asked to check another service answers that it cannot,
  because it has no such tool. A general agent with a Gmail skill has every tool it was
  ever given. He names least privilege, composition over inheritance and separation of
  concerns as the old ideas being applied unevenly.
- **Efficacy.** Public benchmarks tell the shop nothing. A narrow process can be
  evaluated exactly, which a general agent full of other context cannot. Models are
  uneven, so a narrow agent can be pinned to a cheap model that happens to be good at
  its one job. He cites a small model as 137 times cheaper per task than a frontier one
  and "substantially reduced token spend" in internal tests; neither figure comes with
  a workload or a baseline.

The turn in the talk is that the electric motor did not change the factory. For thirty
years it replaced the steam engine at the end of the same shaft, which he compares to
upgrading the model in the middle of the same skills. What changed the factory was a
standard for voltage and frequency, so a motor could be bought instead of built. His
standard: an agent is domain-specific, carries its whole harness, installs like a
package, is vendor-agnostic as a format but runs on "the same model from the same
provider, at the same quant" wherever it is installed, and composes with other agents.

Two questions from the floor matter here. Asked how a fleet of agents on different
models is governed, he answers that there should be platforms where an IT department
sees every small agent and holds its own evals, and that an agent doing its process
right should stay on its model until the model is deprecated. Asked about tuning the
agent against tuning the model, he calls switching models in a tool's menu an
anti-pattern, since nothing verifies the result.

The specification as published follows the talk. A packed agent is an npm package whose
entry point exports its agents, prompts, tools, models, hooks and effects, marked by a
`standardagent` field in `package.json`; its required behaviour must not depend on a
runtime's private interfaces. A model definition names a provider and a model and may
list `fallbacks`. An agent has two sides, each backed by a person, a prompt or a
handler (deterministic code), with `maxSteps` per side and an optional
`maxSessionTurns`.

## 2. Where the build already has this

| The talk | The build |
| --- | --- |
| A process with a start and an end | A workload's unit types, in order: the portfolio close is eight (`packages/regulator/workload/portfolio.json`) |
| The agent has only the tools its process needs | A profile is a grant over declared tool effects with writable prefixes (`packages/regulator/profiles/`); a workload's own dangerous action is a declared tool whose irreversible effect derives the consent question ([authoring guide](../guide/authoring-a-workload.md), step 4) |
| Agent rules: a step limit, no runaway | Budgets per unit type in tokens, cost, wall clock, turns and attempts (`packages/regulator/policies/portfolio.json`) |
| A handler takes a turn instead of a model | A unit type's `command` runner: a program under a wall-clock budget, checked by the host like a model's work |
| A small model where the task is small | Model routes per unit type: the portfolio's `review` and `close-period` run on a cheaper route than the rest |
| Your own evals, not public benchmarks | A workload's declared metrics and graders; suites that pre-register them (`packages/regulator/evals/`) |
| An IT department sees every agent | The registry, the audit log, `regulator status` and the control room over it |

So a workload under the loop is a domain-specific agent in the talk's sense. The
authoring guide's second step is stricter than anything in the talk: a domain with no
deterministic check of its own is refused as a workload, because its only verification
would be self-report.

## 3. Where they part

**The talk has no audit.** Its trust argument ends at the tool list. An agent that has
only the claim-submission tool can still submit the wrong claim and report success. The
talk has no check run by something other than the agent, no evidence bound to a
revision, no rule that a report is not a verdict. The specification's termination
controls are a step cap and a stop tool the agent calls itself. The governance answer
from the floor describes a platform that does not exist in the talk. This is the half
the build has: S3\* evidence at closeout, a contract with fixed and delegated
decisions, obligations owed to a person.

**The build has no package.** A workload cannot be added without changing the product.
The authoring guide says so step by step:

- step 3 adds the fixture's directory to a closed list in `protocol`
  (`packages/protocol/src/definition-writers.ts:58`, the `declaration` class's `seed`),
  or `regulator check` refuses it;
- step 5 updates the shipped tests that enumerate profiles and advice files;
- step 10 adds a flag to a chain of conditionals in `packages/regulator/src/cli.ts:343`
  and a directory to `packages/regulator/package.json`'s `files`.

All three workloads live inside `packages/regulator` and ship with it. The definition's
root is already a parameter (`--definition <dir>` on `init`, `doctor`, `upgrade` and
`status`; the instance manifest records the root it was initialized from), so the
definition can be somewhere else. It cannot yet be assembled from more than one place.

**They disagree about fallback, and the build's own evidence sides with the talk.** A
route here is a primary and a list of fallbacks, and the shipped portfolio policy falls
back from `anthropic/claude-sonnet-4-5` to `openai/gpt-5`: another vendor's model that
no suite has run that workload on. The fourth live drift run ran every unit on the
route's last fallback and closed 23 of 36 units where the primary later closed all of
them ([live drift runs note §1a](2026-09-29-live-drift-run.md)). The eval harness now
refuses a run whose primary is unavailable and records `modelsObserved` on the
fingerprint, so a report can no longer be about the wrong model. An instance in
operation still fails over silently, a route change re-opens nothing (a row in the
[open questions' backlog](2026-09-25-open-questions.md#6-backlog--smaller-things-to-think-about)
since the books note), and failover under a real provider failure is unobserved
(`DEBT.md` row 15).

## 4. Proposals

### 4.1 A workload as a package `regulator` installs

The form of "npm install an agent" that fits the build: a workload published as its own
package and added to a definition by a command, with no edit to `packages/regulator` or
`packages/protocol`.

What a workload package would carry is what the authoring guide already lists: the
workload file with its programs, tools and graders; its profiles and advice; its policy;
its contracts; its suites; its fixture with the domain's own checks. What it must not
carry is anything the guide's right-hand column owns: host checks, gates, the recovery
policy, registry records for the harness's regulators.

Questions the design has to settle, none decided here:

1. **Composition.** Whether an installed workload is copied into the definition (as
   identity and advice are seeded into an instance) or resolved from `node_modules` at
   load. Copying keeps `regulator check` and the definition's revision as they are;
   resolving keeps one copy and makes the package's version an input to every evidence
   record.
2. **Names.** Metrics are already namespaced (`workload:<name>/<metric>`). Profiles,
   policies, tools and unit types are not, and two packages can both declare a
   `manager`.
3. **Trust.** A workload package ships programs the control plane runs: command
   runners, tool programs, graders. Installing one is a grant, so it is a person's
   recorded decision, and the package's version and integrity hash belong where the
   toolchain hash now is (the manifest, the evidence record, the eval fingerprint).
   `regulator check` on the composed definition is the admission test; whether a
   package must also pass its own scripted close before it is admitted is open.
4. **The fixture's class.** `DEFINITION_WRITERS` names six fixture directories. A
   package's fixture needs its class derived from what the package declares, not from a
   list in `protocol`.
5. **What the specification is for.** Its packaging page is a worked answer to the same
   problem (an entry point of named registries, a marker field in `package.json`, a
   rule against depending on a runtime's private interfaces). Read it as prior art for
   the package's shape. Conforming to it is not proposed: see §4.4.

**First slice, no packaging needed.** Derive the fixture list from the definition
instead of the closed list, and replace the flag chain with
`regulator fixture <dest> --workload <name>`. That removes two of the three product
edits in §3 and is a precondition for any answer to question 1. It sits under
[#61](https://github.com/MetaCoding-io/regulator/issues/61) beside the template that
issue already asks for: the template writes a workload's files, and this makes them
loadable from outside the product.

### 4.2 A route change is a change with evidence

The talk's rule is that an agent stays on the model it was evaluated on until that
model is deprecated. The mechanism-level form here:

- a suite's report already names the route it ran on; a policy whose primary for a unit
  type differs from the route of the latest committed report for that workload is a
  `regulator check` warning, by name;
- a fallback is a second route and is evaluated or marked unevaluated in the policy
  file, so failing over to it in operation is recorded as a finding and not only in the
  ledger;
- a provider's deprecation notice is an S4 sensor's signal that opens an obligation,
  which is the one event the talk says should force a change.

This is the existing backlog row (a review triggered by a model change) with a source
and three concrete parts. It is level 2 throughout. `AGENTS.md` already holds the Pi
version to this standard; the model deserves the same.

### 4.3 A cheaper route as an eval arm

The talk's cost claim is testable here and nowhere in the talk. An arm that changes only
the route, on a workload whose checks are arithmetic (the portfolio), reports whether
the cheaper model closes the same units with the same verdicts and at what cost per
closed unit. The second live report ([#201](https://github.com/MetaCoding-io/regulator/issues/201))
is the place to ask whether an arm switch for the route exists or needs adding. If the
checks hold on the cheaper route, that is the talk's efficacy argument with a number
under it, and the number is ours.

### 4.4 Not taken

- **Agents that call agents in plain language.** The talk's coordinator asks a Gmail
  agent a question in English and reads the answer. Here a handoff is a contract and
  the answer is checked by the host; the
  [team-of-experts note](2026-11-04-team-of-experts-into-an-expert-team.md) is where
  what a handoff loses is being measured. A workload that runs another workload as a
  unit is VSM recursion, which `AGENTS.md` defers.
- **Conforming to the specification.** It is at 0.2.0, the one runtime named is its
  authors' commercial product, and the talk says nothing about who governs it or how
  conformance is tested. A workload is also not a Standard Agent: the specification's
  unit is a conversation thread with two sides, and a workload's unit is a contracted
  piece of work with evidence at its close. Watch it; revisit if a second runtime
  appears.
- **The sub-prompt as a tool.** A tool that runs one small inference on a named model
  is a real gap in the declared-tool shape (a declared tool is a program). No workload
  has asked for it, so it stays a sentence here.

## 5. For the course and the website

The talk's vocabulary reaches people the cybernetic vocabulary does not. Three pieces
are worth borrowing as framing, with the attribution:

- the process as a line with a start and an end, for what a workload is;
- the shop owner who will not hand the whole business to a general agent "even if it
  completely works", for why the unit of adoption is one process;
- the question from the floor (who governs a fleet of small agents on different
  models), for what the control plane is. The talk's answer is a platform to be built.
  The registry, the audit log and the control room are that platform's parts, and the
  line the talk stops at, the tool list, is where the course's lesson on evidence
  starts.

**Decided (2026-11-16, James):** the course page keeps its vocabulary, since the
cybernetics is what it teaches. The product gains a second page for a second audience,
the person with one process to hand to an agent and the person who must approve it:
`site/one-process.html` in the website repository, on the portfolio close, with no VSM
terms, the process-as-a-line framing credited to the talk, and neither the HVAC shop nor
"Doug" by name. It is written from the product's intended shape, so it describes a
workload as a package (§4.1) without saying that is not shipped; the website's
`site/README.md` records that.

## 6. Reading

- Schroeder, *Why Domain-specific Agents Are the Future*, Agentic AI Foundation:
  <https://www.youtube.com/watch?v=wIPr9GmLRaQ>
- The same talk at AI Engineer World's Fair 2026, with chapters and transcript:
  <https://ai.engineer/talks/spNAUEgq_A8-future-is-domain-specific-agents>
- Standard Agent Specification 0.2.0: <https://standardagentspec.org/>, in particular
  [Packaging](https://standardagentspec.org/0.2.0/distribution/packaging.md),
  [Models](https://standardagentspec.org/0.2.0/specification/models.md) and
  [Agents](https://standardagentspec.org/0.2.0/specification/agents.md)
