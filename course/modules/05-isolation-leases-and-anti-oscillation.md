# Lesson 05 — Isolation, leases, and the anti-oscillation problem

**Part 2 · S2 Coordination** · ~75 min instruction · ~120 min lab · builds **checkpoint 4**

> Two operations, one repository. What stops them from overwriting each other — and
> what stops *one* operation from oscillating forever between two "fixes"?

Part 1 built a single operation that is honest about what it does, what it may reach,
and what it should be told. Part 2 asks what happens when there is more than one — or
when one is left alone long enough to fight itself. This lesson builds the three
standard answers as mechanisms: a lease with liveness, an isolation boundary with a
reintegration path, and a detector that notices thrash and *says so* rather than
acting on it.

**Prerequisites.** Checkpoint 3 passing. Git 2.35 or later on the path.

---

## 1. The question

Give an agent a repository and a task and it will change files. Give two agents the
same repository and they will change the same files, at the same time, with no idea of
each other. The result is not two half-finished pieces of work; it is one corrupted
one, because each agent's tool results were true when read and false when acted on.

Now give one agent a task whose acceptance test cannot be satisfied — two tests that
contradict each other, or a requirement nobody has actually decided. The agent will fix
A, see B fail, fix B, see A fail, and continue. Each step is locally rational. Nothing
inside the loop can see the loop.

These are two faces of the same failure. Beer calls the function that absorbs it
**System 2**: coordination, the damping of oscillation between operational units that
would otherwise interfere. The word to hold onto is *damping*. S2 does not plan, does
not decide who is right, and does not do the work. It stops the work from destroying
itself.

## 2. Concept

### Three failures, three mechanisms

| Failure | What it looks like | The standard answer |
| --- | --- | --- |
| **Collision** | Two units write one checkout; each corrupts the other's view | A **lease**: an exclusive, expiring claim on a resource |
| **Hidden coupling** | Two units in isolation both change the same thing for different reasons | **Isolation with reintegration**: the merge is where the coupling surfaces |
| **Oscillation** | One unit alternates between two fixes; every step is locally reasonable | A **detector** that counts and signals — and something *outside* the loop that decides |

None of these is a coordinator persona. A prompt that says *"check whether another
agent is working on this"* is a wish; the model cannot see other sessions, and would
not be believed if it could. All three answers below are mechanism.

### Leases need liveness

A lock file is not a lease. The difference is what happens when the holder dies. A
lock file held by a crashed process blocks the resource until a human notices; a lease
carries an expiry and must be renewed, so a holder that stops heartbeating loses its
claim on its own. GSD-Pi's release notes put it plainly — *reclaim milestone leases
held by verifiably-dead local workers* — and the phrase "verifiably dead" is the whole
design problem. Expiry is the simplest verifiable-death test: no heartbeat for one TTL.
It has a cost, which section 5 measures.

### Isolation is half of S2

A worktree per unit prevents collision by construction: two units cannot write the same
checkout because they do not share one. But a change made in isolation has to come
back, and the merge is where two units that each thought they owned a function find
out otherwise. A coordination design that isolates without a reintegration path has
*deferred* the collision, not prevented it — and deferred it to the moment when the
most context has been lost.

So reintegration is a first-class step, and it has one rule: **a conflict is a
coordination signal, not a problem the harness solves.** The merge is attempted; if it
conflicts, it is aborted, the base is left exactly as it was found, the conflicting
paths are recorded, and a typed signal goes to S3. Pi's own `git-merge-and-resolve.ts`
example does the opposite — it hands conflict blocks back to the model to resolve —
and that is a legitimate choice for a single-user session. It is the wrong choice for
a harness, because the model resolving a conflict between two units is one unit
deciding for both, with no authority to.

### S2 detects; S3 decides

The thrash detector is the smallest regulator in the course, and its smallness is the
lesson. It counts completed edits per file per unit and, past a threshold, emits a
signal. It does not abort the turn. It does not block the next edit. It does not
suggest a fix. In the oscillation fixture the two tests contradict each other because
*nobody has decided what an underscore means* — and that decision is not the agent's,
not the detector's, and not the harness's. It belongs to whoever owns the requirement.
The detector's job is to make the loop visible to the function that can end it.
Lesson 08's recovery router is that function; until then the signal lands in an
append-only file and the footer.

This is the first typed channel in the course whose source is S2. The protocol gained a
`coordination-signal` message kind for it: `signal` channel, source `S2`, destination
`S3`, a `coordination` subject of `conflict` or `oscillation`, evidence references, and
a severity. Note what it is *not*: not an audit finding (S3\* has not examined
anything), not a policy proposal, not an algedonic alarm. A signal is not a decision.

> **An S5 note.** Until this lesson, `vsm/channels.yaml` listed `signal` as a channel
> only S1 may author. This lesson's mechanism emits signals from S2. That is a change
> to an S5 artifact, and operational code may not make it: the build below emits the
> typed message the protocol allows, and the change to the channel table was raised as
> a proposal to the owner and adopted in its own commit. Watch for the same shape in
> your own work — a mechanism that quietly implies a policy change is exactly what the
> proposal path exists for.

### What the lease gate covers that the path gates could not

Lessons 02 and 04 both ended on the same leak: `bash` bypasses a path gate, because a
path gate looks at tool arguments and a shell command has none the gate can read. The
lease gate closes that particular hole *for this failure class* by being a different
kind of condition. It is not "may this tool touch this path" but "may this session
write at all, here, now". That is answerable for every tool by its declared effect,
which lesson 03 made a fact rather than a name: read-only effects pass; everything
else — `write`, `edit`, `bash`, `run_tests`, and any tool with no declared effect at
all — needs a live lease on the directory the session is running in. The shell is
covered because the session is covered.

It does not close the leak in general. A shell command can write outside the worktree
by absolute path, and the lease knows nothing about that. The registry card says so.
Lesson 10 is where the negative invariants get an answer for `bash`.

## 3. Mechanism

### Worktrees from the harness: `pi.exec`

Pi has no built-in notion of a unit, a lease, or a worktree, and its security document
is explicit that it has **no built-in sandbox**: tools run with the permissions of the
`pi` process, and real isolation must come from the operating system or a container
boundary. That is the right position for a coding agent and it means the harness owns
isolation. `pi.exec(command, args, { cwd })` is the extension-side shell, and every git
operation in this checkpoint goes through a tiny `Exec` interface so the same modules
run under Pi, under the lab CLI, and under tests.

Two upstream examples are worth reading against the build. `dirty-repo-guard.ts`
refuses a session switch when `git status --porcelain` is non-empty — the same
refusal this checkpoint's reintegration makes before a merge. `git-checkpoint.ts`
commits after each turn — the `/checkpoint` command here is the same idea, made
explicit so that a unit's commits are the unit's evidence.

### The gate, again: `tool_call` with effects

Checkpoint 3's gate asked the profile whether a path was granted. This one asks the
effect table whether a tool can change anything, and the lease store whether this
session may. It is the same `tool_call` handler shape returning `{ block, reason }`, and
it composes with the earlier gates by simple stacking: Pi runs every registered
handler, and the first block wins.

### Heartbeat: `turn_end`

A lease is renewed at the end of every turn. A session that hangs, is killed, or sits
idle stops renewing and the lease lapses after its TTL. Nothing else is needed for the
simplest liveness story — and nothing less is enough.

### Counting completed edits: `tool_execution_start` and `tool_execution_end`

The detector counts *completed* writes. A blocked call never executed; a failed edit
changed nothing. Pi's `tool_execution_end` event carries the result but not the
arguments, so the path is captured at `tool_execution_start` by `toolCallId` and
consumed at the end — a small illustration of why lesson 02 insisted on correlating by
id rather than by order.

### Steering and pending messages

Pi exposes `ctx.isIdle()`, `ctx.hasPendingMessages()` and `ctx.abort()`, and lets
extensions send steering messages and queued follow-ups. These are a coordination
surface — and this checkpoint deliberately does not use them, because the thrash
detector emitting a steering message to the model would be S2 deciding. When lesson 08
routes the signal, the router may choose to steer; that is S3 acting on S2's
observation, which is the right direction.

## 4. Build: checkpoint 4

Checkpoint 4 is four Pi-free modules, one extension, and a small CLI that drives the
unit lifecycle from outside the session — because starting and finishing a unit is an
orchestrator act, not something the session does to itself.

### Leases and the detector — [`packages/regulator/src/coordination.ts`](../../packages/regulator/src/coordination.ts)

`LeaseStore` keeps one JSON file per unit under `.regulator/leases/` in the base
checkout. `acquire` refuses a live lease held by another unit on the same resource,
reclaims an expired one, and renews the caller's own; `heartbeat` refuses to revive a
lease that has already expired (re-acquire instead — that is a new claim, and should
look like one); `release` removes it. Unit ids are validated before they become file
names.

`ThrashDetector` is a map from path to count. It raises a signal at each multiple of the
threshold (default 4) and refuses a threshold under 2: one edit is work, not
oscillation.

### Isolation and reintegration — [`packages/regulator/src/worktree.ts`](../../packages/regulator/src/worktree.ts)

`createUnitWorktree` makes branch `unit/<id>` from the base and checks it out under
`.regulator/worktrees/<id>`. `checkpoint` commits everything in the worktree.
`reintegrate` merges the unit branch into the base with `--no-ff` inside the main
checkout and returns a discriminated union — `merged`, `dirty-base`, `wrong-branch`,
or `conflict` with the conflicting paths — after `git merge --abort` has put the base
back exactly as it was found. The result is data; the caller decides what it means.

### The unit lifecycle — [`packages/regulator/src/unit.ts`](../../packages/regulator/src/unit.ts)

`startUnit` takes the lease *first* and only then creates the worktree, so a refused
claim leaves nothing behind. It refuses to run inside a worktree (the base checkout is
the only place a unit may be started from) and refuses to start a unit that is already
live: a start is a claim, not a renewal. `finishUnit` reintegrates; on success it
removes the worktree and branch and releases the lease; on conflict it writes a
`coordination-signal` with `coordination: "conflict"` and severity `blocking` to
`.regulator/signals.ndjson`, and the unit keeps its lease and worktree, because the
conflict is not resolved and the resource is still claimed.

### The extension — [`packages/regulator-pi/src/coordination.ts`](../../packages/regulator-pi/src/coordination.ts)

`createCoordinationExtension({ now, ttlMs, threshold })` registers a `--unit` flag
(with `REGULATOR_UNIT` as the fallback, which is how the headless test sets it), the
lease gate on `tool_call`, the heartbeat on `turn_end`, the detector on tool
execution, `/checkpoint` and `/lease`, and a footer status of `unit: u1 (lease ok)`,
`unit: u1 (no live lease)` or `unit: none (writes refused)`. Everything it needs it
finds from `ctx.cwd`: the base checkout via `git rev-parse --git-common-dir`, the lease
by unit id, and whether the lease's resource is the directory it is running in (by
`realpath`, so a symlinked temp directory does not fool it).

### The CLI — [`packages/regulator/src/cli.ts`](../../packages/regulator/src/cli.ts)

```
regulator fixture <dest> [--oscillation]     copy a fixture and make it a repo on main
regulator unit start <id> [--type <unitType>] [--ttl <minutes>]  lease, branch, worktree; prints the pi command. A type that requires a contract is refused (lesson 06)
regulator unit finish <id>                   reintegrate; release or signal
regulator unit status                        every lease and whether it is live
```

Run it as `pnpm --filter @metacoding/regulator regulator -- …`, or alias
`regulator` to `node packages/regulator/dist/cli.js`. A full cycle on the main fixture:

```
regulator fixture /tmp/slugkit
cd /tmp/slugkit
regulator unit start u1
# → unit u1: branch unit/u1 from main, worktree /tmp/slugkit/.regulator/worktrees/u1
# → next: cd …/u1 && pi -e …/tools.js -e …/coordination.js --unit u1
#   (do the work; /checkpoint when it is worth keeping)
regulator unit finish u1
# → unit u1: reintegrated as <sha>; worktree and branch removed; lease released
```

### The second fixture — [`packages/regulator/fixture-oscillation/`](../../packages/regulator/fixture-oscillation/)

The same slug helper with the known issue already fixed and two tests that cannot both
pass: one says underscores in identifiers survive, the other says an underscore is a
separator. Three of its four tests pass; the fourth cannot without failing the third.
Nobody has decided. That is the point.

### Registry cards

Three records under `packages/regulator/registry/regulators/`, all S2, all
`deterministic-gate`: `unit-lease.json`, `thrash-detector.json`, `reintegration.json`.
Each fills the fields this lesson makes meaningful — `channels` (what it consumes and
emits) and `scope` (which subjects and resources it coordinates) — and each states its
limitations: expiry-only liveness with no fencing token, per-directory rather than
per-path coverage, single-host lease files, a fixed threshold that cannot tell
oscillation from legitimately iterative work, and a reintegration that only sees
textual conflict. `regulator check` fails a card without them.

## 5. Break it

Five drills, the last optional. Use `regulator fixture` for a fresh repository each time.

**Drill 1 — collision, uncoordinated.** Make a fixture and open two Pi sessions in the
*same* directory, both with checkpoint 2 loaded and neither with checkpoint 4. Give
both the README's task at once. Watch `git status` from a third terminal. Record what
each session's tool results said the file contained and what it actually contained
when the other session's write landed. This is the failure the lease exists for; make
sure you have seen it before you trust the mechanism that prevents it.

**Drill 2 — collision, refused.** Same fixture, reset. `regulator unit start u1`, then
try `regulator unit start u1` again from another terminal:

```
regulator: resource /tmp/slugkit/.regulator/worktrees/u1 is leased by unit "u1" (owner you@host) until …
```

Now start `u2` — it succeeds, because it is a different resource — and launch Pi in
`u1`'s worktree *without* `--unit`. Ask it to fix the bug. Every write-capable tool is
refused with a reason that names the unit lifecycle; the read-only ones work. Launch
again with `--unit u1` and it proceeds. Then the part that matters: launch with
`--unit u1` from the *base checkout* instead of the worktree. Refused — the lease
covers a directory, not a session, and this is not that directory.

**Drill 3 — liveness.** `regulator unit start u1 --ttl 1`. Launch Pi in the worktree with
`--unit u1`, make one edit, then leave the session idle for two minutes. Run
`regulator unit status` from another terminal: the lease is `expired`. Return to the
session and try another edit. Refused, with the footer showing `no live lease`. Now
write down the number: a session that hung at minute 0 held the resource until minute
1, and a session that was merely *slow* for a minute lost its claim while still alive.
Both are wrong in opposite directions, and the TTL is the only knob. This is the cost
of expiry-as-liveness, and the registry card's first limitation. What would a
verifiable-death test need that expiry does not have? (GSD-Pi's answer involves
fencing tokens and a process check; the gap analysis §1.1 describes it.)

**Drill 4 — oscillation.** `regulator fixture /tmp/osc --oscillation`, start `u1`,
launch Pi in the worktree with checkpoints 2 and 4, and ask:

> Make the tests pass.

Watch the footer and the notifications. Somewhere around the fourth edit to
`src/slugify.js`:

```
4 edits to src/slugify.js within unit u1: the fix may be oscillating.
```

Let it run to the eighth if the model keeps going; note whether it ever *stops on its
own* and what it says when it does. Then read `.regulator/signals.ndjson` and check the
record against the protocol schema — `Value.Check(CoordinationSignalSchema, …)` in a
scratch file is enough. Record in your notes:

| Run | Edits before first signal | Did the model stop unaided? | What it said about the tests | Signal validates? |
| --- | --- | --- | --- | --- |
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

Then the question the drill is really about. The detector fired; nothing happened. Was
that right? Write down what you think S3 should do with the signal — abort the unit,
ask the human, lower the model's temperature, widen the task — and *who* would have
the authority to make each of those calls. Lesson 08 builds the router that makes one
of them; you should have an opinion before it does.

**Drill 5 (optional) — the seeded conflict.** Start `u1`, and in its worktree change
the first line of `src/slugify.js` and `/checkpoint`. In the base checkout, change the
same line differently and commit. `regulator unit finish u1`:

```
unit u1: conflict in src/slugify.js — merge aborted, nothing resolved, coordination signal recorded in .regulator/signals.ndjson
```

Confirm `git status` in the base is clean and the base's version is untouched. Then
resolve it yourself, the way a human would, and finish again. The harness did not
resolve it because it could not have known which of two units was right — and neither
could the model.

## 6. Field study: what GSD built, and what it did not

**GSD-Pi.** In `README.md` at `cc8779f`, the release highlight *Reclaim milestone
leases held by verifiably-dead local workers*; in `CHANGELOG.md` the corresponding
entry. Then §1.1 of this repository's
[`S2-COORDINATION-GAP-ANALYSIS.md`](../../docs/archive/2026-09/S2-COORDINATION-GAP-ANALYSIS.md) (archived):
GSD's coordination layer is a shared SQLite database with worker records, milestone
leases *with fencing tokens*, unit dispatches and a command queue. Your lease store is
the same shape without the fencing token and without the process check. Name what each
of those buys, and what it costs to add.

Notice the gap analysis's own restraint, in §1.1's last line and in §4's "Important M0
restraint": written while VSM-Pi was to sit *on* GSD, it says *do not build another
lease system*. That restraint was correct for that design and is lifted under this one
— VSM-Pi provides its own orchestrator now, so it provides its own leases. Read the
status banner at the top of the document for the mapping.

**VSM-Pi.** §2.5 and §5.6 of the same document describe *coordination oscillation* as
the gap GSD did not model: repeated rework around the same shared commitment, visible
to S3 as a signal before it becomes hard policy. Your thrash detector is the smallest
possible instance — one file, one unit, one counter. The analysis is about a larger
one: two units alternating over a shared *interface*. Question for your notes: what
would the detector have to count to see that, and where would it have to run, given
that neither unit's session can see the other?

## 7. Checkpoint

You have finished checkpoint 4 when:

1. `pnpm --filter @metacoding/regulator test` passes — including the lease
   store's refuse/reclaim/renew cases, the reintegration test that seeds a conflict and
   proves the base was left as found, the unit lifecycle test that refuses a second
   start, and the extension test that loads checkpoint 4 into a real Pi 0.87.0 session
   and shows a write refused without a lease and allowed with one.
2. A second `regulator unit start` on a live unit is refused; a Pi session without
   `--unit` cannot write; the same session with `--unit` inside the worktree can.
3. The oscillation fixture trips the detector, and the signal in
   `.regulator/signals.ndjson` validates against `CoordinationSignalSchema`.
4. A seeded conflict is surfaced as a signal, not resolved, and the base is clean
   afterwards.
5. The three registry cards pass `registry:check` with `channels`, `scope` and
   limitations filled, and `REGULATORS.md` is regenerated.
6. Your lab notes hold drills 1–4, including your TTL number from drill 3 and your
   answer to drill 4's authority question.

## Further reading

- This repository's [`AGENTS.md`](../../AGENTS.md), the S2 bullet: *mostly mechanisms
  … locks/leases, reintegration, and anti-oscillation behavior — not a coordinator
  roleplay persona.*
- The archived [`S2-COORDINATION-GAP-ANALYSIS.md`](../../docs/archive/2026-09/S2-COORDINATION-GAP-ANALYSIS.md)
  §1.1–1.2, §2.5, §5.6, §6.
- Pi docs at `v0.87.0`: `security.md` "No Built-in Sandbox"; `containerization.md` for
  the four isolation patterns; `extensions.md` on `pi.exec`, `tool_execution_start` /
  `tool_execution_end`, `user_bash`, and steering.
- Upstream examples: `dirty-repo-guard.ts`, `git-checkpoint.ts`,
  `git-merge-and-resolve.ts` (read it as the *other* choice), `bash-spawn-hook.ts`,
  `project-trust.ts`, and the `sandbox/` directory.
- Beer, *The Heart of Enterprise*, chapter 8 on System 2 as the damping of oscillation.
