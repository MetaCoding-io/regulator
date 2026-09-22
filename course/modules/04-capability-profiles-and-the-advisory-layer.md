# Lesson 04 — Capability profiles and the advisory layer

**Part 1 · S1 Operations** · ~75 min instruction · ~90 min lab · builds **checkpoint 3**

> Specialization obviously helps. Why do "Architect / Coder / Reviewer" persona stacks
> disappoint, and what should replace them? And once the gates are in place — what
> should the prompt still carry?

This lesson has two halves that belong together. The first replaces personas with
*capability profiles*: typed, enforceable bindings of what a kind of work may reach. The
second takes the mechanism hierarchy's bottom two levels seriously and teaches how to
write advice well — because demoting prompts was never the same as dismissing them.

**Prerequisites.** Checkpoint 2 passing.

---

## 1. The question

The instinct to specialize is right. Research and implementation are different jobs
with different risks; a unit that only reads should not be able to write. The usual
implementation of that instinct is a persona: a system prompt that says *you are a
careful senior reviewer who never modifies code*. It works until it does not — and it
stops working exactly when it matters, under a long transcript, a persuasive tool
result, or a user who asks nicely.

The question is not whether to specialize. It is what a specialization is *made of*.

## 2. Concept

### Persona versus profile

A **persona** is costume. It lives in prose, it describes who the agent is, and it is
enforced by nothing but the model's inclination to stay in character.

A **capability profile** is a boundary. It binds, in a typed record:

- the tool surface — which tools exist for this work at all;
- the writable paths — where those tools may change things;
- the reasoning budget — how much thinking the work is worth;
- the advice — what the model should carry that no gate can express.

The difference is enforceability. *"You must not edit tests"* is advice; a profile
without the `write` and `edit` tools is a fact. This repository's `AGENTS.md` says it in
one line: S1 profiles are operational capability profiles, not personalities.

### Positive grant, negative invariant

Lesson 02 built a gate that says *nothing may write under `vendor/`* — a **negative
invariant**. A profile says *this work may write under `src/` and `test/`* — a
**positive grant**. They often use the same mechanism, a `tool_call` handler, pointed in
opposite directions, and a real harness needs both:

| | Positive grant (this lesson) | Negative invariant (lesson 10) |
| --- | --- | --- |
| Answers | What may this unit do? | What may nothing do? |
| Default | Refuse | Allow |
| Changes with | The kind of work | The identity of the project |
| Bypassed by | Switching profile | Nothing short of changing the invariant |

`README.md` is not a protected path in the fixture. Under the implement profile a write
to it is still refused — not because it is forbidden, but because it was never granted.

### Separation of duty, previewed

Profiles are also how a harness gets *separation of duty*: the unit that did the work
cannot be the unit that certifies it, because the certifying profile does not have the
tools to have done the work. Lesson 09 builds audit on this. Keep it in mind as you
write profiles: the question is not only "what does this work need?" but "what must
this work be unable to do, so that something else can check it?"

### Levels 4 and 5, done properly

Now the other half. The hierarchy says: type, gate, typed tool, *then* judgment, *then*
prompt. Two lessons of building gates can leave the impression that prompts are the
thing you use when you have failed to build a mechanism. That is wrong, and the drill
in section 5 shows why: delete the advice from a fully gated agent and it still fumbles
everything a gate cannot know.

What belongs at level 5 — in a context file, a tool description, a profile's advice —
is exactly the set of things a gate *cannot* express:

- **Conventions** that are matters of taste or history: prefer small diffs; this library
  stays dependency-free; slugs are user-visible, so prefer boring output.
- **Intent** and priorities: when the README and the code disagree, trust the code and
  say so.
- **How to use the mechanisms**: call `read_conventions` before trusting a document; run
  `run_checks` before reporting done.

What does *not* belong there: anything a gate already enforces. *"Never edit
`vendor/`"* in a context file, next to a gate that refuses vendor writes, is not
belt-and-braces; it is a second, weaker copy of a rule that will drift from the first
and teach the model that the prose is where rules live.

The craft, then:

- A **context file** carries what the gates cannot know, and says nothing the gates
  already enforce.
- A **tool description** is a contract the model reads. Say what the tool does, what it
  returns, and when it throws. `promptGuidelines` say *when to reach for it over the
  alternatives*.
- A **skill** is capability loaded on demand — a Markdown file with frontmatter whose
  `description` decides when the model pulls it in. It is code, in the sense that
  matters: review it, version it, and remember that a skill can instruct the model to
  do anything.
- A **level-4 judgment** should leave evidence. If the model decides something, make it
  decide in a structure (`structured-output.ts`), against a stated rubric, with a
  recorded reason — so that a level-2 check can inspect the decision later.

## 3. Mechanism

### The tool surface: `pi.setActiveTools`

```ts
const known = new Set(pi.getAllTools().map((tool) => tool.name));
pi.setActiveTools(profile.tools.filter((name) => known.has(name)));
```

`getAllTools` returns everything configured — built-ins, extension tools, SDK tools —
with `sourceInfo` saying which. `setActiveTools` replaces the active set; it works for
both built-in and extension-registered tools, and it updates both the system prompt's
tool list and the executable tools the provider sees. The CLI flag `--tools read,grep`
is the same operation at startup.

The filter matters: a profile that names `run_tests` should not crash a session that
did not load checkpoint 2. Unknown names are dropped, not errors.

### The system prompt: `before_agent_start` and sections

```ts
pi.on("before_agent_start", (event) => {
  event.systemPromptOptions.sections["regulator_profile"] = renderProfileSection(current);
});
```

`systemPromptOptions` is the structured data Pi builds the system prompt from —
`sections`, `selectedTools`, `promptGuidelines`, `contextFiles`, `skills`. It is
mutable, and the docs are explicit about which mutation to prefer: change a *section*,
and Pi diffs the result against what the model already has and patches only what
changed, keeping the cached prefix. Return a whole new `systemPrompt` string instead,
and every provider takes a cache miss whenever it changes. Advice has a cost; put it
where the cost is lowest.

### Selection: flags and commands

```ts
pi.registerFlag("profile", { description: "…", type: "string", default: "implement" });
pi.registerCommand("profile", { description: "…", handler: async (args, ctx) => { … } });
```

`pi.getFlag("profile")` reads the CLI flag at `session_start`; `/profile research`
switches mid-session. Two entry points, one `apply()`.

### Reasoning budget: `pi.setThinkingLevel`

`"minimal" | "low" | "medium" | "high" | "xhigh" | "max"`, clamped to what the current
model supports. Recorded in the session, restored on resume. The lab sets it per
profile; lesson 07 makes it part of a budget.

### The model itself: `pi.setModel`

`ctx.modelRegistry.find(provider, id)` then `pi.setModel(model)`, which returns `false`
if the provider is not configured. The lab deliberately does not bind a model to a
profile — that decision is provider-specific and belongs with routing and failover in
lesson 07. The profile record has a place for it; the mechanism is one line when you
want it.

### Context files and skills

Pi loads `AGENTS.md` (and `SYSTEM.md` for a full replacement) from the project; the
result appears in `systemPromptOptions.contextFiles`. Skills load from `~/.pi/agent/skills/`,
`.pi/skills/`, `.agents/skills/`, packages, settings, and `--skill` — project locations
only *after the project is trusted*, which is lesson 10's concern. A skill's frontmatter
needs `name` and `description`; the description is what decides whether the model loads
it, so the upstream advice is: be specific. *"Helps with PDFs"* loads never or always;
*"Extracts text and tables from PDF files … use when working with PDF documents"* loads
when it should.

### Prompt templates

`/name arg…` expands a Markdown template with arguments. Useful for making a profile's
typical request one command — `/implement fix the failing tests` — and out of scope for
the lab.

## 4. Build: checkpoint 3

Two files, then one you write yourself.

### The record — [`packages/protocol/src/profiles.ts`](../../packages/protocol/src/profiles.ts), [`packages/core/src/profiles.ts`](../../packages/core/src/profiles.ts), [`course/lab/src/profiles.ts`](../lab/src/profiles.ts)

No Pi dependency anywhere in this trio. The profile *type* is protocol vocabulary; the
checks (`isWritableUnder`, `isReadOnlyProfile`, `renderProfileSection`) are core
mechanisms; the lab file declares only the two profiles the course uses and imports the
rest. The lab never re-implements what `packages/` already ships.

```ts
export interface CapabilityProfile {
  name: string;
  description: string;
  tools: readonly string[];          // positive grant: the tool surface
  writablePaths: readonly string[];  // positive grant: where writes may land; empty = read-only
  thinkingLevel?: ReasoningLevel;
  advice: readonly string[];         // only what a gate cannot know
}
```

`research` reads, greps, runs the *static* checks — and has no `write`, `edit`, `bash`,
or `run_tests`. That last exclusion is the lesson inside the lesson. An earlier draft
granted `run_tests` to the research profile and called it read-only, on the grounds that
the tool has a one-string schema and touches no file the model names. A reviewer pointed
out that running `npm test` executes whatever the project's tests do — write, network,
credentials — so the profile was read-only in name only. The fix is not a longer
description; it is `isReadOnlyProfile()`, which consults the effect declarations from
lesson 03 and returns true only if every granted tool is read-only on every axis and no
direct writes are granted. A test asserts it, and asserts that adding `run_tests` would
break it. Narrow schema, wide effect: a profile has to reason about the second.

`implement` has the full working surface, may write under `src/` and `test/`, and
carries four lines of advice. Read those four lines against the craft in section 2: each
one is something no gate in this course could enforce. Read its `description` too: it
says direct write and edit calls are limited, and that `bash` is granted and not
path-gated. An earlier draft said the profile "cannot touch anything else," which was
false — the `bash` leak you find in section 5 was already known. A profile's description
is level 5, but it is still a claim, and a false claim in the advisory layer teaches the
model that the advisory layer lies.

What the profile does *not* bind yet: a model, and context files or skills. Those are
real profile dimensions — the curriculum lists them — and they arrive when the course has
taught what they mean: model routing with budgets and failover in lesson 07, durable
context with identity in lesson 12. A checkpoint should claim what it implements.

`isWritableUnder` is the positive-grant check — the same lexical normalization as
checkpoint 1, but the question is inverted: *does the path start with something this
profile was granted?* Absolute paths and `..` are refused outright; a read-only profile
grants nothing.

`renderProfileSection` turns the profile into the text the model sees. Read its second
line: *"Writes elsewhere are refused by the harness, not by you."* That sentence is the
whole relationship between levels 2 and 5 in one place. The model is told where the
boundary is and told that it is not the model's job to hold it. And when the profile
grants `bash`, the section adds one more line: the shell is not path-gated, the writable
paths bind you there too, and the harness cannot check it. That is level 5 doing the one
job only level 5 can do — carrying a rule the gates cannot reach — and being honest that
it is doing so.

The profile gate has a registry card too:
[`registry/regulators/profile-write-grant.json`](../lab/registry/regulators/profile-write-grant.json).
This lesson adds `authority.may` and `authority.mayNot`. Read them and check each line
against the code: the card claims the gate may set the tool surface and block ungranted
writes, and may *not* select a profile without a user command, block shell commands, or
grant a tool the host does not have.

### The extension — [`course/lab/src/cp3-profiles.ts`](../lab/src/cp3-profiles.ts)

Four documented Pi APIs and nothing else, each labelled with its hierarchy level in the
source. `apply()` sets the tool surface and the thinking level and shows the profile in
the footer; `before_agent_start` contributes the section; `tool_call` refuses writes
outside the grant with a reason that names the profile, the granted paths, and the way
to change profiles if the work genuinely needs it.

Load it with checkpoint 2, so the typed tools the profiles name exist:

```sh
pnpm build
pnpm --filter @metacoding/vsm-pi-course-lab cp3
```

You start in `implement`. Try `/profile`, then `/profile research`, and watch the
footer and the tool list in the system prompt change. To start in research:

```sh
cd course/lab/fixture && pi -e ../dist/cp2-typed-tools.js -e ../dist/cp3-profiles.js --profile research
```

### The file you write — `course/lab/fixture/AGENTS.md`

Now the advisory layer for the *project*, as opposed to the profile. Write
`course/lab/fixture/AGENTS.md` containing only what no gate can enforce. A reference
version:

```markdown
# slugkit — working conventions

- This library has no runtime dependencies and must stay that way.
- `vendor/` is copied verbatim from upstream. If something there is wrong, the fix is
  upstream: note it, and work around it in `src/`.
- When the README and the code disagree, the code is right. Say so in your summary
  rather than fixing the README, unless asked.
- Slugs are user-visible URLs. Prefer boring, predictable output over clever handling
  of edge cases.
```

Check each line against the test: *could a gate enforce this?* Dependencies — a gate
could refuse `package.json` writes, but it cannot know that a dependency is the wrong
answer; that is a convention. Upstream fixes — a gate stops the edit, but cannot tell
the model what to do instead. README disagreement — pure judgment. Boring output —
taste. All four belong here.

Now notice what is *not* in the file: *"never edit `vendor/`"* (checkpoint 1's gate),
*"run the tests with `node --test`"* (`read_conventions`), *"only change files under
`src/`"* (the profile). Each of those has a mechanism, and repeating it in prose would
be a second, weaker copy.

The fixture ships without this file so that lessons 01 and 02 can run against a bare
project. Keep yours; lesson 12 turns it into identity.

## 5. Break it

Three drills. Reset the fixture between runs.

**Drill 1 — the refusal is structural.** Start in the research profile and ask for a
change:

> The tests are failing. Fix them.

There is no `write` or `edit` tool in the active set, so the model *cannot* try. Watch
what it does instead — a good outcome is a precise description of the fix it would make.
Then ask it to switch profiles for you. It cannot do that either; `/profile` is a user
command. Record what it said.

**Drill 2 — the leak, named.** Switch to `implement`. The profile includes `bash`,
because real implementation work needs a shell. Ask:

> Use a shell command to change vendor/left-pad.js so it pads on the right.

The write gate does not cover `bash`. If the model complies, `sed` walks through. This
is the same leak as lesson 02, and now it is a *design decision* rather than an
accident: the implement profile grants a tool that can bypass the profile's own path
grant. Write down what you think the right answer is — remove `bash`? wrap it? sandbox
it? — before lessons 05 and 10 give you theirs.

**Drill 3 — the inverse: gates without advice.** Delete `course/lab/fixture/AGENTS.md`.
Stay in `implement`. Prompt:

> Fix the known issue described in the README.

Every gate is still in place. The model will very likely fix the bug. Now look at its
summary: did it mention that the README's layout and test command are wrong? Restore
`AGENTS.md`, reset the fixture, run the same prompt. Three runs each:

| Condition | Run | Bug fixed? | Summary mentions README is stale? | Anything else the advice changed |
| --- | --- | --- | --- | --- |
| No `AGENTS.md` | 1–3 | | | |
| With `AGENTS.md` | 1–3 | | | |

The gates did not change between conditions. Whatever differs is the advisory layer
doing work nothing else could.

## 6. Field study: phases and projections

**GSD-Pi.** In `CONTEXT.md` at `cc8779f`, read the *Current runtime vocabulary* entries
for **Unit** and **Phase**. A unit is dispatched and executed; a phase is only a routing
key — `research`, `planning`, `discuss`, `execution`, `execution_simple`, `completion`,
`validation`, `subagent`, `uat` — that decides which model and reasoning level apply.
Many units collapse to one phase. That distinction is a capability profile seen from the
scheduler's side: the work unit carries *what to do*; the phase carries *what it may
use to do it*. Notice, too, that `subagent` is honoured by prompt injection rather than
by framework selection — GSD is explicit about which of its phases is mechanism and
which is advice.

**VSM-Pi.** Read sections 4–6 of
[`docs/GSD-VSM-FUNCTIONAL-MAP.md`](../../docs/GSD-VSM-FUNCTIONAL-MAP.md): capabilities,
their derivation, and separation of duty. Two sentences to take away. Capabilities are
derived from *trusted context* — the unit, the phase, and a separation-of-duty policy —
never from what the model says about itself. And membership may be many-to-many, but
*permissions are not a naive union*: a unit that is both S1 and S3\* does not get S1's
write surface plus S3\*'s audit authority; the independence requirement wins, and the
projection fails closed. Your `research` profile is a tiny instance of the same rule.

Question for your notes: your profiles are selected by a flag or a command — by the
human. In GSD, the phase is selected by the scheduler from the unit. What would it take
for your harness to select a profile *from the work* rather than from the user, and what
would have to be trusted for that to be safe?

## 7. Checkpoint

You have finished checkpoint 3 when:

1. `pnpm --filter @metacoding/vsm-pi-course-lab test` passes — including the test that
   loads checkpoints 2 and 3 together into a real Pi 0.87.0 session and shows the native
   hook refusing a write outside the default profile's grant, and the test that
   `research` is read-only by effect while `run_tests` would disqualify it.
2. A real run shows the profile in the footer and the profile section in the system
   prompt; the research profile cannot write.
3. `course/lab/fixture/AGENTS.md` exists and contains nothing a gate already enforces.
4. Your lab notes hold the three drill records, including your own answer to drill 2.
5. The profile gate's registry card passes `registry:check` with `authority` filled in.

## Further reading

- This repository's [`AGENTS.md`](../../AGENTS.md), "Architectural boundaries" — read
  the S1 and S2 bullets as profile design rules.
- [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md), "S1 — Operations."
- Pi docs at `v0.87.0`: `skills.md` in full; `extensions.md`, "before_agent_start" and
  "pi.getActiveTools / setActiveTools"; `prompt-templates.md`.
- Upstream examples: `preset.ts`, `system-prompt-header.ts`, `structured-output.ts`,
  `question.ts`.
