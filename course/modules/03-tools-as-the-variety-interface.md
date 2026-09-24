# Lesson 03 — Tools as the variety interface

**Part 1 · S1 Operations** · ~75 min instruction · ~90 min lab · builds **checkpoint 2**

> Every effect the agent has on the world goes through a tool. How wide should that
> opening be, and who defines its shape?

Lessons 01 and 02 watched the loop and learned where to intervene. This lesson is about
the loop's only outlet: the tool call. You will replace "run whatever shell command
seems right" with three typed tools that know the project better than its README does,
and you will learn the one design rule that makes a tool's failures useful instead of
poisonous.

**Prerequisites.** Checkpoint 1 passing; the two-rule comparison table from lesson 02.

---

## 1. The question

Give an agent `bash` and it can do anything — which is the problem. Every command it
runs is a decision the model made about *how* to do something, and every result comes
back as raw text the model must interpret. The width of the opening is the amount of
variety the harness has chosen not to absorb.

Narrow the opening too far and the agent cannot do its job. The question is not
"shell or no shell"; it is *which operations deserve a shape of their own*, and what
that shape should promise.

## 2. Concept

### S1 is where the variety meets the world

In the Viable System Model, S1 is *operations*: the units that actually do the work and
touch the environment. Everything else — coordination, control, audit, intelligence,
identity — exists to keep S1 viable. In a coding harness, S1's contact with the
environment is the tool surface, and nothing else.

### A tool is a channel with a schema

Think of each tool as a channel between the model and the repository, and the schema as
the channel's *bandwidth in the cybernetic sense*: the set of distinct requests that can
cross it. `bash` has effectively infinite bandwidth. `run_tests({ filter?: string })`
has two. Which one is easier to regulate is not a close call.

What narrowing buys you, in the vocabulary of lesson 02:

| Wide tool (`bash "node --test"`) | Narrow tool (`run_tests`) |
| --- | --- |
| The model decides the command (level 4) | The harness knows the command (level 2–3) |
| Wrong command → an error the model must diagnose | Wrong command is not expressible |
| Raw output, unbounded | Structured summary, bounded |
| Failure looks like any other text | Failure has a shape the harness can act on |

### Results are context you are choosing to buy

The other half of a tool is what it returns. A tool result becomes part of the
transcript, so it is context the harness has decided to *spend* — on every subsequent
turn, until compaction. Ten thousand lines of test output is not information; it is
variety dumped into the model's working memory, and the model will pay for it in
attention on every turn afterwards.

So result design is an attenuation problem. A good tool returns the smallest thing that
lets the model act correctly, and keeps the rest somewhere it can be fetched if needed.

### The error contract

The rule this lesson turns on. A tool has exactly two ways to come back:

- **It could not do its job.** The test runner would not start; the command timed out;
  there is no test command in this project. This is a *harness-level* fact. The tool
  should **throw**, which Pi turns into an `isError` result — and the model should get a
  short, specific reason, not a stack trace.
- **It did its job, and the answer is bad news.** The tests ran and two failed. A check
  did not pass. This is *operational* information the model can act on. The tool should
  **return normally**, with the bad news structured.

Collapsing these two — returning a failing test run as an "error," or throwing a raw
stack trace when the runner was missing — is how tool failures poison the next three
turns. The model cannot tell whether to fix the code or fix the environment, so it
guesses.

### Schema versus effect

One more distinction, and it is the one a reviewer of this course caught the reference
build getting wrong. A tool's **schema** says what the model may *ask for*. Its
**effect** says what *happens* when it runs. They are independent, and a narrow schema
says nothing about a narrow effect.

`run_tests({ filter?: string })` is the clearest case. One optional string. It runs the
project's test suite — and a test suite can write files, open sockets, read environment
variables, call out to services, or delete a database if that is what someone wrote.
The tool's *effect surface* is the project's, not the schema's.

So every tool declares an effect alongside its schema. The `ToolEffect` shape is in
[`packages/protocol/src/effects.ts`](../../packages/protocol/src/effects.ts); the
declarations for Pi's built-ins and the lab's tools are in
[`packages/core/src/effects.ts`](../../packages/core/src/effects.ts):

```ts
export interface ToolEffect {
  filesystem: "none" | "read" | "write";
  execution: "none" | "project-code" | "arbitrary";
  network: "none" | "unknown" | "open";
  sideEffects: "none" | "reversible" | "irreversible" | "unknown";
}
```

`read_conventions` is read-only on every axis. `run_checks` is too — `node --check`
parses without executing, and `git status` reads. `run_tests` is
`{ filesystem: "write", execution: "project-code", network: "unknown", sideEffects: "unknown" }`,
and *unknown is not none*. Lesson 04 uses these declarations to decide what a read-only
profile may contain; lesson 10 uses them to decide what needs a sandbox; lesson 13 uses
`sideEffects: "irreversible"` to decide what needs a human's consent. The declaration is
one line per tool, and it is the line that connects the whole course's authority story
back to S1.

### Facts, not claims

One more distinction you will build directly. The README in the fixture says the tests
run with `npm test`. That is a *claim*. `package.json` has no `test` script and there is
a `test/` directory; that is a *fact*, and the harness can determine it. A tool that
reports facts the harness determined is a different kind of thing from a tool that reads
a document back to the model. Lesson 09 makes this the basis of evidence; here it is
just a good tool.

## 3. Mechanism

### Anatomy of `pi.registerTool`

```ts
pi.registerTool({
  name: "run_tests",                      // what the model calls
  label: "Run tests",                     // what the human sees
  description: "…",                       // the model's contract: what it does, what it returns, when it throws
  promptSnippet: "…",                     // one line in the system prompt's tool list
  promptGuidelines: ["Use run_tests instead of invoking a test runner through bash."],
  parameters: Type.Object({ filter: Type.Optional(Type.String({ description: "…" })) }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    return { content: [{ type: "text", text: "…" }], details: { … } };
  },
});
```

The parts that matter for regulation:

- **`parameters`** is a TypeBox schema. Pi validates the model's arguments against it
  *before* `execute` runs — this is level 3 of the hierarchy, and it is free. Use
  `StringEnum` from `@earendil-works/pi-ai` for enums; `Type.Union` of literals does not
  work with every provider.
- **`content`** goes to the model. **`details`** does not — it is for rendering, the
  session record, and your own harness. This split is how you return a bounded summary
  to the model and keep the full structure for yourself.
- **Throwing** from `execute` is the only way to set `isError`. Returning an object never
  does, whatever fields it contains. That is what makes the error contract mechanical.
- **`description`, `promptSnippet`, `promptGuidelines`** are the model-facing contract.
  They are level 5 — advice — and lesson 04 is about writing them well. The point here
  is that they exist *alongside* the schema, not instead of it.
- **`prepareArguments`** rewrites arguments from an older session before validation.
  Keep the public schema strict and use this for compatibility, not the other way round.
- **`terminate: true`** on a result ends the tool batch without a follow-up model call.
  `structured-output.ts` upstream uses it to make a final typed answer the last thing
  that happens.

### Running things: `pi.exec`

```ts
const result = await pi.exec("node", ["--test"], { cwd: ctx.cwd, timeout: 120_000, signal });
// result.stdout, result.stderr, result.code, result.killed
```

`cwd` is the reason your tools run in the project rather than wherever Pi was launched.
`signal` is `ctx`'s abort signal; pass it through so Esc actually stops the process.
`killed` is how you learn about a timeout.

### Bounding output

Pi exports what you need: `truncateHead` (keep the start — file reads, search results),
`truncateTail` (keep the end — logs, test output), `truncateLine`, and the constants
`DEFAULT_MAX_BYTES` (50 KB) and `DEFAULT_MAX_LINES` (2000) that the built-in tools use.
The rule from the upstream docs is blunt: *tools MUST truncate their output.* Tell the
model when you did and where the rest went.

### The rest of the surface

You will not need these for checkpoint 2, but they are the tool story's remaining
chapters, and each is a short example upstream:

- **Overriding built-ins** — register a tool named `read` and yours replaces Pi's
  (`tool-override.ts`). The route to a sandboxed or remote filesystem.
- **Dynamic tools** — register and activate tools at runtime (`dynamic-tools.ts`).
- **Remote execution** — the same tool shapes, executed over SSH (`ssh.ts`).
- **Custom rendering** — `renderCall` and `renderResult` for the TUI.

### Testing a tool without a model

The same two patterns as lesson 02's gate, now for tools: a mock `pi` that records
`registerTool` and — because tools run things — actually executes commands; and the
SDK, loading the built checkpoint into a real session and calling the registered tool's
`execute` directly. This repository's `scripts/reporting-smoke.mjs` is the SDK pattern
in the wild.

One trap you will hit if your tools run tests: a `node --test` spawned from inside a
`node --test` process refuses to run ("called recursively"), because the child inherits
`NODE_TEST_CONTEXT`. The lab's test support strips that variable from the environment of
processes *it* spawns, and leaves the process itself alone — the first attempt deleted it
globally and silently collapsed two test files into one uncounted test. A fix that makes
the numbers wrong is worse than the bug.

## 4. Build: checkpoint 2

Two files. Read both in full before continuing.

### Facts about a project — [`packages/checks/src/conventions.ts`](../../packages/checks/src/conventions.ts)

No Pi dependency, same rule as `trace.ts`. `discoverConventions(cwd)` looks at the
project and reports what can be known mechanically:

```ts
export interface ProjectConventions {
  testCommand: string[];           // argv, or empty
  testCommandSource: "package.json scripts.test" | "node --test (test/ directory present)" | "none";
  sourceDirs: string[];            // which of src/, lib/ exist
  protectedPaths: string[];        // vendor/, if present
  checks: Check[];                 // syntax checks per source file; protected paths untouched
}
```

Notice what it does *not* do: read the README. The README's claims are the model's
problem; the harness deals in what it can verify. `parseNodeTestSummary` reads the test
runner's output into `{ pass, fail, failures }` and returns `undefined` when there is no
summary — the signal that the tests did not run at all. `boundedTail` keeps the last N
characters and says so.

A field note on that parser, because it failed in CI while this lesson was being
written. The first version read TAP (`# pass 2`, `not ok 3 - name`), which is what
`node --test` printed when piped on Node 22. On Node 24 the default reporter is `spec`
even when piped — `ℹ pass 2`, `✖ name (1.2ms)` — and `run_tests` started throwing
"did not produce a test summary" on one CI matrix leg. The fix has two parts, and both
are lessons: where the harness *owns* the argv it now pins `--test-reporter tap`,
because a default is not a fact; and where it does not — a project's own `npm test`
script prints whatever it prints — the parser accepts both formats. A tool that reports
facts must not quietly depend on a default that changes under it.

### Three tools — [`packages/regulator-pi/src/tools.ts`](../../packages/regulator-pi/src/tools.ts)

**`read_conventions`** — no parameters. Returns the conventions as four lines for the
model and the full structure in `details`. Its guideline tells the model to call it
first in a new project; that is the tool's job: to be cheaper and more reliable than
reading the README.

**`run_tests`** — `{ filter?: string }`. Discovers the real test command, runs it in
`ctx.cwd` (pinning the reporter when the command is Node's own runner), parses the
summary, and returns *counts and failing test names* — plus a bounded tail of raw output
only when something failed. Read the error contract in the code:

```ts
if (conventions.testCommand.length === 0) {
  throw new Error("No test command discovered: …");           // could not do the job
}
// …
if (!summary) {
  throw new Error(`Test command did not produce a test summary (exit ${result.code}) …`);
}
return { content: [{ type: "text", text: lines.join("\n") }], details: { …summary, truncated } };  // did the job
```

Two throws for "could not run"; one normal return for "ran, here is what happened,"
whether or not tests passed. The tests in `tools.test.ts` pin both sides.

**`run_checks`** — no parameters. Runs every check the project defines and returns one
verdict per check: `ok  syntax:src/slugify.js`, `FAIL protected-untouched — M vendor/left-pad.js`.
A check that could not start throws; a check that ran and failed is a verdict.

Each of the three has an entry in `TOOL_EFFECTS`. Read them against the tools and ask,
for each axis, whether you could have inferred it from the schema. You could not — which
is the point.

### Run it

```sh
pnpm build
pnpm --filter @metacoding/viable-agents-lab cp2
```

Try, in order:

> What is the real test command for this project?

Watch whether the model calls `read_conventions` or reads the README. Then:

> Run the tests and tell me what fails.

You should see `run_tests` called and a short structured answer come back. If you want
the trace from checkpoint 1 alongside, Pi takes `-e` more than once:

```sh
cd packages/regulator/fixture && pi -e ../dist/cp1-trace.js -e ../dist/tools.js
```

**Exercise.** From the trace, compare the token usage of a turn that called `run_tests`
with a turn in lesson 01's log where the agent ran the tests through `bash`. Same
information; different price.

## 5. Break it: wide versus narrow

Two drills, both with checkpoint 1 loaded so you get per-turn token counts.

**Drill 1 — the same job through two openings.** Prompt:

> Run the tests, fix whatever is failing, and run them again to confirm.

Condition A — shell only, no typed tools:

```sh
cd packages/regulator/fixture && pi -e ../dist/cp1-trace.js
```

Condition B — typed tools available:

```sh
cd packages/regulator/fixture && pi -e ../dist/cp1-trace.js -e ../dist/tools.js
```

Reset the fixture between runs (`git checkout -- .`). Three runs each. Record:

| Condition | Run | How it ran the tests | Total tokens (trace) | Turns | Tests pass at end? | Touched `vendor/`? |
| --- | --- | --- | --- | --- | --- | --- |
| A (shell) | 1–3 | | | | | |
| B (typed) | 1–3 | | | | | |

Expect B to be cheaper and more consistent — and if it is not, look at *why*: did the
model ignore the typed tools? Then the guideline text is the thing to fix, which is
lesson 04's subject.

**Drill 2 — poison the well.** Make the tests un-runnable and watch each condition
cope. In the fixture, add to `package.json`:

```json
"scripts": { "test": "node -e \"process.exit(3)\"" }
```

Now `read_conventions` will report `npm test` as the command (a fact: the script
exists), and `run_tests` will throw with a one-line reason. Under condition A, the shell
returns whatever `npm` prints. Prompt:

> Run the tests.

Record what the model concluded in each condition, and how many turns it spent working
out that the *environment* was broken rather than the code. Then restore
`package.json`.

## 6. Field study: tools as domain operations

**GSD-Pi.** Read the release highlights in the README at `cc8779f`, and then find the
implementations of two tools:

- `gsd_plan_slice` warns when a plan persists zero non-skipped tasks. The tool knows
  what a plausible plan looks like; the model does not have to be told.
- `uat_result_save` *rejects* a PASS verdict that cites failed `uat_exec` evidence. That
  is validation living inside the tool: the schema plus a rule, enforced at the point of
  entry, so a model cannot record a contradiction no matter how it is prompted.

Both are level 3 in the hierarchy doing work that a persona prompt would have tried to
do at level 5. Notice that neither is generic. They are *domain operations*, shaped to
GSD's lifecycle, and their names say what they are for.

**VSM-Pi.** Open [`packages/regulator-pi/src/reporting-tools.ts`](../../packages/regulator-pi/src/reporting-tools.ts)
and read all three tools. Then notice:

- their schemas are imported from `packages/protocol`, which has no Pi dependency —
  the same rule as `conventions.ts`, applied to a control plane;
- the first thing each `execute` does is check a host-supplied authority, and throw
  `Reporting authority denied` if it is absent. That is the error contract: an
  unauthorized call *could not do its job*, so it fails loudly, and the model cannot
  turn it into a success by phrasing;
- the tools are "content-only": they record, and explicitly do not verify, resolve,
  pause, or retry anything. A tool that did all of those would be a wide opening again.

Question for your notes: which of the three tools you built this lesson is closest to a
*domain operation* in GSD's sense, and which is closest to a generic wrapper? Would you
ship the generic one in a real harness?

## 7. Checkpoint

You have finished checkpoint 2 when:

1. `pnpm --filter @metacoding/regulator test` passes — including the test that
   loads the built checkpoint into a real Pi 0.87.0 session and executes
   `read_conventions` and `run_checks` through it with no model.
2. A real run in the fixture shows the model using `run_tests` rather than `bash` to run
   tests, visible in `.regulator/trace.ndjson` or `events.ndjson`.
3. Your lab notes hold both drill records from section 5.

## Further reading

- Pi docs at `v0.87.0`: `extensions.md`, "Custom Tools" through "Output Truncation";
  examples `tools.ts`, `truncated-tool.ts`, `structured-output.ts`, `tool-override.ts`.
- This repository's [`docs/REPORTING.md`](../../docs/REPORTING.md): three tools, their
  payloads, and the host seam that authorizes them.
- Ashby again, briefly: the width of a channel is a design decision about how much
  variety you are prepared to regulate on the other side of it.
