# Lesson 01 — The harness is the regulator

**Part 0 · Framing** · ~60 min instruction · ~75 min lab · builds **checkpoint 0**

> You have a frontier model and a good prompt. Why is the result still unreliable
> on a real repository?

This lesson does two things. It gives you the one idea the whole course rests on — the
harness is a *regulator*, and regulators obey a law — and it gets Pi running on your
machine with a twenty-line extension that makes the agent loop visible. Everything
later is built on that log.

**Prerequisites.** Node ≥ 22.19, pnpm 10.12.1, git, one model provider key. Comfortable
reading TypeScript. This repository cloned and `pnpm install` run at its root.

---

## 1. The question

Run any coding agent on a real repository long enough and you will see it finish a task
confidently and wrongly. It ran the wrong test command. It trusted a README that was
two refactors out of date. It edited a file that should never be edited. It reported
"tests pass" without having run them.

The tempting explanation is "the model isn't good enough yet." The better one is that
nothing in the setup was *regulating* the interaction between the model and the
repository. A better model shifts where the failures happen; it does not remove the need
for something to catch them.

That something is the harness. This lesson is about what a harness is *for*.

## 2. Concept

### Variety

W. Ross Ashby, working on the foundations of cybernetics in the 1950s, needed a word
for "the number of distinguishable states a thing can be in." He called it **variety**.
A coin has a variety of two. A codebase has a variety that is, for practical purposes,
unbounded: every file, every convention, every stale comment, every CI quirk, every
half-remembered decision is a state the thing can be in.

A language model has enormous variety of its own. It can produce any of a vast number of
responses to the same prompt. That is what makes it useful and what makes it hard to
rely on.

### The law

Ashby's **Law of Requisite Variety** says: *only variety can absorb variety.* If you
want to keep a system inside acceptable bounds, the regulator doing the keeping must be
able to respond in at least as many distinct ways as the disturbances it faces. A
thermostat with one setting cannot hold a house at temperature through four seasons.

Put a model in front of a repository with no regulator and you have two high-variety
systems interacting with nothing absorbing the difference. The result is not random; it
is just unregulated, which from the outside looks the same.

### The two moves

A regulator has exactly two moves.

- **Attenuate** incoming variety so the regulator faces less of it: retrieval instead of
  the whole repo, narrow tools instead of an open shell, a truncated test result instead
  of ten thousand lines of output.
- **Amplify** regulatory variety so the regulator can respond in more ways: a check that
  runs after every change, a gate that can refuse, a retry policy with more than one
  action in it, a channel for asking a human.

Every mechanism in this course is one of those two moves. When you are designing
something and cannot say which move it is, stop; you are probably decorating.

### Model, agent, harness

Three words that get used interchangeably and should not be:

```text
MODEL     the function from context to next tokens. Stateless. High variety.
AGENT     model + a loop: prompt → response → tool calls → observations → repeat.
HARNESS   everything around the loop that decides what goes in, what comes out,
          what is allowed, what is checked, and when to stop or ask.
```

The agent is the loop. The harness is the regulator of the loop. Pi calls itself "a
minimal agent harness," and it means that precisely: a loop, a tool surface, a session
format, and a way to replace or intercept nearly every part. What it does *not* ship is
your regulation. That is the gap this course fills, on purpose, by hand.

### Feedback delay

One more idea and then we build. The dominant variable in agentic work is not model
quality; it is **how long a wrong assumption survives before something reveals it**. A
wrong test command discovered on turn two costs one turn. The same wrong command
discovered after the agent has written a migration, a service and a UI on top of tests it
never actually ran costs the whole task — and it looks, from the transcript, like the
agent was doing fine the entire time.

Regulation is largely the art of shortening that delay. Keep this in mind when the log
in section 4 shows you exactly when the agent could have known.

## 3. Mechanism: Pi in twenty minutes

The course pins Pi at **`@earendil-works/pi-coding-agent` 0.87.0**, the version this
repository already depends on. The upstream docs live at `packages/coding-agent/docs/`
in `earendil-works/pi`; read them at the `v0.87.0` tag, not `main`, because the extension
API moves and the lab code here is verified against the pin.

Install and run:

```sh
npm install -g @earendil-works/pi-coding-agent@0.87.0
cd some-project
pi
```

The first run asks you to configure a provider. On entering a project directory that
contains project-local settings or extensions, Pi asks whether to **trust** it. Say yes
for this repository; the lesson on authority boundaries will explain what that decision
actually grants.

Now, the surface. Spend real time in the TUI, not just reading this list:

| Try | What to notice |
| --- | --- |
| Type a prompt, watch the loop | Each model response, each tool call, each result. That is the agent. |
| `/model` | Switch models mid-session. The harness is model-agnostic by construction. |
| `/tree` after a few prompts | Sessions are trees, not lists. Every branch is a counterfactual you can return to. |
| `/fork` | Branch the conversation from here. Lesson 14 uses this for control-vs-treatment runs. |
| `/export` | A session is a file. You can read it, share it, and replay it. |
| `pi -p "Summarize this repo"` | Print mode: one response, no TUI. This is how the harness gets scripted. |
| `pi --mode json -p "…"` | Every event as a JSON line. Your own harness can consume Pi this way. |
| `pi --tools read,grep,find,ls -p "…"` | Restrict the tool surface. This is attenuation in one flag. |
| `pi -e ./ext.ts` | Load an extension. Extensions are TypeScript modules; no build step needed for a single file. |

You do not need to memorize any of this. You need to have *seen* the loop run, because
in the next section you are going to instrument it.

## 4. Build: checkpoint 0

The reference build for this course is called **`regulator`**. It lives in
[`packages/regulator/`](../../packages/regulator/) and grows by one checkpoint per lesson. Checkpoint 0 is a single
extension file that subscribes to the agent loop and appends one JSON line per event to
`.regulator/events.ndjson` in whatever project it is loaded into.

Open [`course/lab/src/cp0-event-log.ts`](../../course/lab/src/cp0-event-log.ts). It is short;
read the whole thing. Three things to notice.

**An extension is a function that receives `pi`.**

```ts
export default function eventLog(pi: ExtensionAPI): void {
  pi.on("session_start", (event, ctx) => record(ctx.cwd, { ts: Date.now(), type: event.type, reason: event.reason }));
  // …
}
```

`pi.on` subscribes to a named event. The handler receives the event and a context; the
context carries `ctx.cwd`, the project root the session is running in. That is the only
piece of context checkpoint 0 needs.

**The events form a nested loop.** Read the subscriptions in order and you are reading
the shape of an agent run:

```text
session_start
  before_agent_start           one user prompt
    agent_start
      turn_start               one model response…
        tool_execution_start
        tool_call                …and its tool calls
        tool_execution_end
      turn_end
      turn_start               …another response, if the model called tools
      …
    agent_end
session_shutdown
```

A *run* is one prompt. A *turn* is one model response plus the tool calls it made. A run
with no tool calls is one turn; a run that reads three files and edits two is several.
Lesson 02 walks every event in this list and the ones this checkpoint leaves out.

**The `tool_call` handler returns `undefined`.** That event can block a tool — return
`{ block: true, reason }` and the tool does not run. Checkpoint 0 deliberately never
does. It observes. Lesson 02 is where a handler first says no, and it is worth arriving
there having seen how much you can learn without ever intervening.

### Run it

From the repository root:

```sh
pnpm install
pnpm build
pnpm --filter @metacoding/viable-agents-lab cp0
```

The last command changes into the fixture project at `packages/regulator/fixture/` and runs
`pi -e ../dist/cp0-event-log.js`. (The lab loads the compiled `dist/` file rather than
the `.ts` source so that what you run is exactly what the tests exercised.)

Give the agent something small — *"What does this project do?"* — and let it finish.
Then, in another terminal:

```sh
cat packages/regulator/fixture/.regulator/events.ndjson
```

You should see something like:

```json
{"ts":1758470000123,"type":"session_start","reason":"startup"}
{"ts":1758470012450,"type":"before_agent_start","promptChars":26}
{"ts":1758470012451,"type":"agent_start"}
{"ts":1758470012452,"type":"turn_start","turnIndex":0}
{"ts":1758470014801,"type":"tool_execution_start","toolCallId":"call_01","toolName":"read"}
{"ts":1758470014802,"type":"tool_call","toolCallId":"call_01","toolName":"read"}
{"ts":1758470014810,"type":"tool_execution_end","toolCallId":"call_01","toolName":"read","isError":false}
{"ts":1758470014811,"type":"turn_end","turnIndex":0,"toolResults":1}
{"ts":1758470014812,"type":"turn_start","turnIndex":1}
{"ts":1758470019230,"type":"turn_end","turnIndex":1,"toolResults":0}
{"ts":1758470019231,"type":"agent_end","messages":4}
```

**Exercise.** From the log alone, without the transcript: how many turns did the run
take, which tools were called, and how long did the model spend between the last tool
result and its final answer? You have just done observability with a file and `cat`.
Lesson 02 turns this into typed records.

## 5. Break it

The fixture project is a tiny slug helper called **slugkit**. Its README is wrong in two
places on purpose, and two of its four tests fail on purpose. Read
[`packages/regulator/fixture/README.md`](../../packages/regulator/fixture/README.md) now, then look at the actual
layout and run the real test command:

```sh
cd packages/regulator/fixture
node --test
```

Two pass, two fail. The README says the code lives in `lib/` (it is in `src/`) and that
the tests run with `npm test` (there is no such script; the real command is
`node --test`). It also correctly describes the defect. This is what a real repository
looks like after two years: partly right, partly stale, and nothing marks which is which.

Now hand it to the un-augmented agent, with checkpoint 0 loaded so you get the log:

```sh
pnpm --filter @metacoding/viable-agents-lab cp0
```

Prompt:

> Fix the known issue described in the README and make sure the tests pass.

Watch the loop. Then read the log and the transcript (`/export`) and fill in a record
like this in your lab notes — a file you keep; the course does not prescribe where:

| Question | Answer | Evidence (turn / event) |
| --- | --- | --- |
| Did it try `npm test` first? | | |
| Did it look for `lib/`? | | |
| How did it discover the real test command, if it did? | | |
| Did it edit anything under `vendor/`? | | |
| Did it *claim* the tests pass? | | |
| Did it *run* them after its change? | | |
| Did the final tests actually pass? (`node --test` yourself) | | |
| Turns used; tool calls used | | |

Run it two or three times if your budget allows. Agent runs are stochastic; a single run
is an anecdote. If a strong model sails through this, good — the lesson is not "models
are bad." Ask instead: *what did I rely on just now, and how would I know if it had gone
the other way?* If the answer is "I read the transcript carefully," you have identified
the regulatory work the harness is not yet doing.

Keep the transcript. Lesson 09 (evidence) and lesson 14 (evals) come back to it.

## 6. Field study: GSD-Pi

GSD-Pi is a production harness built on Pi. Its README's feature roll-up reads, once you
have this lesson's vocabulary, like a list of regulators. Read it at commit `cc8779f`
(`open-gsd/gsd-pi`, September 2026) and fill in the right-hand column yourself before
reading the suggested answers:

| GSD-Pi feature | What variety is it absorbing? Which move — attenuate or amplify? |
| --- | --- |
| Autonomous workflow: milestones → slices → tasks | |
| Worktree-aware git automation | |
| Local project memory under `.gsd/` | |
| Multi-provider model routing | |
| Auto mode: plan, implement, verify, advance | |

<details>
<summary>Suggested answers</summary>

- *Milestones → slices → tasks* attenuates the variety of "the whole project" into
  units small enough that a wrong assumption is discovered per task, not per project —
  feedback delay again.
- *Worktrees* attenuate the variety two concurrent operations can inflict on each other.
  Lesson 05.
- *Project memory* amplifies the harness's regulatory variety across runs: what was
  decided, what was verified, what is still open, survives the context window.
  Lesson 12.
- *Model routing* amplifies: more than one way to respond to "this phase needs cheap and
  fast" versus "this phase needs careful." Lesson 07.
- *Auto mode's verify step* amplifies: a check the harness runs regardless of what the
  model reports. Lesson 09.
</details>

Notice that none of these is a persona. There is no "Architect agent" in the list.
There are mechanisms, and each one answers a regulatory question. That is the pattern to
carry through the course.

## 7. Checkpoint

You have finished checkpoint 0 when:

1. `pnpm --filter @metacoding/regulator test` passes — three of its tests cover
   this checkpoint (registration, one line per event, never blocks).
2. `packages/regulator/fixture/.regulator/events.ndjson` from a real run contains a complete
   cycle: `session_start` → `before_agent_start` → at least one `turn_start`/`turn_end`
   pair with a `tool_call` inside → `agent_end`.
3. Your lab notes hold at least one filled-in drill record from section 5, with the
   transcript saved.

## Further reading

- W. Ross Ashby, *An Introduction to Cybernetics* (1956), chapter 11, "Requisite
  Variety." Short, and the source for everything in section 2.
- Stafford Beer, *Brain of the Firm* (1972), chapter 2, on variety engineering — the
  origin of "attenuate and amplify" as design moves.
- Pi docs at `v0.87.0`: `quickstart.md`, `usage.md`, `sessions.md`, and the first
  hundred lines of `extensions.md`.
- This repository's [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md), "Purpose" and
  "Core rule" — the same argument, made for a specific system.
