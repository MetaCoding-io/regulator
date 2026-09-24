# Lesson 15 — Packaging and operating your harness

**Part 6 · Proving it and shipping it** · ~60 min instruction · ~150 min lab · builds **checkpoint 14**

> It works on your laptop. How does your team run it on Monday, and who owns it in three months?

Fourteen lessons built a control plane and proved, headlessly, that it does what its
cards say. Every one of them ran against the same fixture, from the same checkout, by
the person who built it. A harness that works under those conditions is a prototype. This
lesson makes it infrastructure: something a second person installs into a repository
they know and you do not, runs on Monday without you, checks before trusting, upgrades
with evidence, and owns. The closing structural point is the course's own: the harness
is a viable system, so the model applies to it recursively — it has an identity, an
audit, a policy path and an owner, or it drifts like anything else.

**Prerequisites.** Checkpoint 13 passing. A second repository you did not write the
fixture for.

---

## 1. The question

Distribution is the easy half, and Pi does most of it: a package manifest, an install
command, a settings scope, extension precedence. The hard half is every assumption the
lab made about the fixture without noticing. `src/` and `test/` were writable because
the profile said so. `vendor/` was protected because the conventions found it. The test
command was discovered. The identity was seeded by `regulator fixture`, which also
created the repository. Install the same harness into a repository with `lib/`, an npm
test script and no `vendor/`, and the first unit cannot write anything, the closeout
protects nothing it should, and nobody wrote down what the harness believed about the
project. The portability lesson is that every one of those assumptions becomes either a
declaration a person makes, or a discovery the host makes and records — never a default
nobody can see.

The second half of the question is operating. A harness that only runs when a person
runs it reminds nobody, checks nothing on a schedule, and quietly falls behind its own
definition. Lesson 13 delivered to an outbox; nothing watched it. Lesson 14 gave every
card a review date; nothing failed when one passed. Lesson 12 decided identity in an
instance; nothing carried the decision back. This lesson closes those loops with
processes and commands, and says plainly which parts of operating stay the deployment's.

## 2. Concept

### Install into, never create

`regulator init` installs the definition into an existing git repository: it refuses a
dirty tree, a second init, and a definition that fails its own check; it seeds the
identity, ignores `.regulator/`, records credential-looking values from a committed
`.env` as canaries, commits the identity on the base branch, and writes the *instance
manifest*. The manifest is harness-owned, under `.regulator/`, written by a person: which
definition, at which harness revision, with how many regulators, under which Pi,
initialized when and by whom — and the layout the person declared, the prefixes a unit
may write under and the prefixes protected beyond the identity and the conventions. The
profile grant reads it (a declared prefix replaces the profile's; a read-only profile
stays read-only). The closeout checks read it. The trust rule is intact: the project's
own files still say nothing to the harness.

### Doctor before the first unit

One headless pass over what a person would check before trusting an installation: the
Node floor, git, the Pi pin against what is installed, the registry and definition
checks, review dates due within thirty days, and — in an instance — the manifest, whether
the instance was initialized under this definition revision, the identity's presence,
the base's cleanliness, and what is owed, undelivered or holding the whole instance.
Machine-readable, exit 1 on any problem. It is the CI entry point and the first command
of the day, and it fixes nothing.

### The base after the merge is a different tree

The closeout gate verifies a branch at its HEAD. Two units that change disjoint files
can break each other without a conflict: A renames an export and fixes its test; B,
branched earlier, adds a test against the old name; both pass at their own HEAD, the
merge is clean, and main is red. After every reintegration the loop now runs the
workload's `run_tests` and `run_checks` on the base at the merge commit and appends the
results to the audit log as evidence bound to that revision. A failure is not the unit's
— it closed on fresh evidence — it is the instance's: an audit finding with no unit,
which the router turns into an obligation owed to S3 that holds *every* dispatch until
S3 dispositions it. Nothing is reverted. A revert is a decision, and the record says who
made it.

### The words the glossary refuses

Lesson 14's sloppy report showed vocabulary drift measured by the graders and absorbed
by nothing. The identity's glossary now names the words this instance does not use,
with the word to say instead, in one section the host parses; at closeout
`glossary-lint` reads the branch's added comment lines under the writable prefixes and
its commit messages for them. Identifiers are not read: a variable named `task` is the
project's business; a comment that calls a unit a task is drift. The regenerated sloppy
report shows what that costs, and it is the over-regulation row this lesson owns: a
correct unit refused three times for a word in a commit message. The response is
attenuation — an advisory half and a blocking half — and the row is in `docs/DEBT.md`
until a workload declares it.

### Processes, not steps

`regulator watch` is the process a quiet instance was missing: each tick delivers what
is pending, reminds what is due, and forwards every outbox line it has not forwarded yet
to the channel command the deployment names — mail, chat, a webhook — with a cursor so
a restart forwards nothing twice and a failed forward moves nothing. The outbox stays
the record; the channel is the deployment's, and so is keeping the process alive. An
overdue review date now fails `regulator check`, and so `pnpm check`, and so CI: the
card is reviewed, moved, or retired, on the record.

### The release path

`regulator identity accept` decides for an instance. `regulator identity promote`
carries the decision to the definition: run by a person who may act as S5, it copies the
instance's identity file into the definition's seed, refuses a promotion that changes
nothing or would leave the seed's identity set invalid or lands on a dirty definition,
and commits in the definition's repository citing the instance and its revision. Every
later `init` starts from it. Memory, meanwhile, learned scope: a fact recorded for
research units is rendered to research units, not to every unit of the instance.

### The harness as a viable system

Apply the model to the thing you built. Its identity is `vsm/` for regulator and the lab's
`identity/` for the definition, changed by proposal and a person's decision. Its policy
is four files, changed by a pull request with `pnpm check` green on both Node versions.
Its audit is `pnpm check`, `regulator check`, the committed eval reports and the review
dates every card carries. Its intelligence is the Pi feature matrix and the upgrade path.
Its operations are whoever runs `doctor` and `watch`, answers what the outbox delivers,
and reads `regulator review --due` once a month. `OPERATING.md` says all of this in one
page, because the owner in three months has not read the course.

### Which level this is

The manifest, the doctor report and the registry's date rule are level 2: refusals with
an exit code. The glossary section and the post-merge finding are level 2 in the loop.
The watcher and the promotion command are processes a person runs; the channel, the
supervisor and the container are the deployment's, and the cards say so. Nothing in this
lesson is a prompt.

## 3. Mechanism

### `pi install ./packages/regulator-pi`

A Pi package is a directory with a `package.json` that names its extensions under
`pi.extensions`; the Pi host's (`packages/regulator-pi`) names the eleven session
extensions, and the control plane's (`packages/regulator`) `bin` is the `regulator` CLI. `pi install <path>` records it in user settings (`-l` for project
settings, shared with a team, installed on startup once the project is trusted);
`pi -e` loads the same files for one session. Pi runs `npm install` for a package from
npm or git; a workspace package is built where it lives.

### `--writable lib/,test/`

A declared prefix is a string that ends in `/`, does not start with one, and contains
no `..`; `init` checks the shape and trusts the wisdom. `isWritableUnder` is unchanged:
the profile's `writablePaths` are replaced by the declaration for profiles that have any,
and `write` and `edit` are the tools that honour it. The shell is still granted un-gated
by path (row 8).

### `git diff <base>...HEAD` and `git log <base>..HEAD` for words

The lint reads added lines with a comment marker — `//`, `/*`, a leading `*`, `#` — and
tests only the comment part of the line, plus every commit message on the branch, against
each refused term as a whole word with an optional plural. A malformed glossary line is
silently not a term; `regulator check` does not validate the section.

### `run_tests` on the base, then a finding with no unit

`verifyBase` reuses `runHostChecks` on the base checkout with the conventions discovered
there, prefixes the check names with `post-merge:`, binds the evidence to the unit that
landed the merge and to the merge commit, and records an audit finding whose envelope has
no `unit`. The router's one new rule: an audit finding without a unit blocks; every other
message without a unit still blocks nothing. `progressionVeto` now returns the unit's
blocking obligations and the instance's.

### A cursor file

`.regulator/outbox.cursor` holds a byte offset. The watcher forwards from the cursor to
the end, and advances the cursor only when every forward returned 0. Two watchers on one
outbox forward every line twice; the card says so.

### `.regulator/events.db`

The reporting tools' SQLite store moves beside the instance's other records, and the
span projection reads its rows as events on the unit they name. The GSD-era path is
gone from the code and the documents that described it.

## 4. Build: checkpoint 14

### The manifest — [`packages/protocol/src/instance.ts`](../../packages/protocol/src/instance.ts), [`packages/regulator/src/instance.ts`](../../packages/regulator/src/instance.ts)

`InstanceManifestSchema`; `initInstance`, `readManifest`, `doctor`, `definitionPin`.
`memory.ts` gains `scope`; `workload.ts` the `glossary-lint` check name;
`identity.ts` in core parses the glossary's refused words and `MemoryStore.current`
takes a unit type; `obligations.ts` lets an instance-level audit finding block and the
veto see it; `registry.ts` refuses an overdue review date when given today; `spans.ts`
gains `timelineFor` and reads the events store.

### The checks — [`packages/checks/src/verify.ts`](../../packages/checks/src/verify.ts)

`glossary-lint`, with `forbidden` and `writablePaths` options.

### The loop and the session — [`packages/regulator/src/controller.ts`](../../packages/regulator/src/controller.ts), [`profiles.ts`](../../packages/regulator-pi/src/profiles.ts), [`identity.ts`](../../packages/regulator-pi/src/identity.ts)

`verifyBase` after reintegration; protected and writable prefixes from the manifest at
closeout; the glossary's terms from the worktree's identity; the profile grant reads the
declaration; `remember` takes a scope and the memory section is filtered by the unit's
type.

### The processes — [`packages/regulator/src/deliver.ts`](../../packages/regulator/src/deliver.ts), [`packages/regulator/src/cli.ts`](../../packages/regulator/src/cli.ts)

`watchOutbox`; `regulator init | doctor | watch | identity promote`; `regulator check
--today`. The lab's `package.json` declares the extensions and the `bin`;
[`OPERATING.md`](../../packages/regulator/OPERATING.md) is the operating note.

### The suite — [`packages/regulator/evals/drift.json`](../../packages/regulator/evals/drift.json)

`glossary-lint` on every arm but control; a `no-glossary-lint` ablation arm; the three
reports regenerated with new interpretations. The workload's implement, verify and
integrate unit types declare the check; the identity's glossary carries the section.

### The read model and the control room

`UnitView.timeline` — the replay: every record about a unit in time order, from the span
projection, never the transcript — and `InstanceView.manifest`; the control room's unit
inspector shows the replay as a table and each instance its manifest line.

### Registry cards

`instance-manifest` (S5), `doctor` (S3\*), `post-merge-check` (S3\*), `glossary-lint`
(S3\*), `outbox-watcher` (S5), `identity-promotion` (S5). Forty-two records.
`docs/DEBT.md` strikes rows 11, 24, 27, 31, 32 and 34, narrows 26, reschedules 8, 15
and 29 with reasons, and opens 36–39.

## 5. Break it

Five drills; the first is the module's.

**Drill 1 — the unfamiliar repository.** Pick a real repository you did not write:
`lib/` or `packages/`, an npm test script, no `vendor/`. `regulator init` with no
declarations and `regulator doctor`, then drive `contracts/fix-known-issue.json`
against it with a live model. Write down everything that broke — the profile's write
refusals, the checks that were inconclusive, the objective that made no sense — and for
each, whether the fix is a declaration (`--writable`, `--protected`), a discovery the
host should make, or a contract that was the fixture's. Re-init with the declarations
and run it again. The list is the portability lesson; the diff between the two runs is
the evidence.

**Drill 2 — the red base.** In the instance from drill 1, reproduce the disjoint-files
break by hand: start unit B, reset its branch to the base before A, add a test against a
name A renames, close A, then close B. `regulator obligations` shows the finding with no
unit; `regulator unit dispatch` for anything is refused with "the instance itself".
Decide: revert, or a repair unit. Resolve the obligation with your decision as the
rationale and watch the veto lift. Then answer row 37: what would a pre-merge trial
cost, and would you pay it?

**Drill 3 — the word.** Read the regenerated sloppy report's treatment column, then
`regulator eval packages/regulator/evals/drift.json --behaviour sloppy --arm no-glossary-lint
--reps 1`. Six units refused three times each for a commit message. Change the check in
a copy of the lab so the commit-message half is advisory (an audit finding at `advisory`,
not failing evidence) and the comment half blocking, run the suite again, and write the
interpretation the attenuated report deserves. Row 36 is yours to close.

**Drill 4 — Monday.** Set the interaction policy's reminder to a minute, open an
obligation owed to a person, and run `regulator watch --exec <a command that reaches
you>`. Kill it, restart it: nothing arrives twice. Make the command fail once: the line
arrives on the next tick. Then `regulator doctor --today <a date after every card's
review date>` and read the exit code. Decide who on your team runs each of these, and
write their names into your copy of `OPERATING.md`.

**Drill 5 — the harness's own viability.** Use the model on the harness. For each of
S1–S5 and S3\*, name the mechanism in this repository that plays it for the harness
itself (not for a unit), and the one that is missing. Then propose, in the lab's own
proposal format, the invariant you think `vsm/INVARIANTS.md` lacks, and say which
mechanism would check it. This is the capstone's first page.

## 6. Field study: distribution, and the channels the harness can speak

**GSD-Pi.** Its distribution story — a scoped npm package, a guided installer, migration
instructions for a shadowed global binary — and its extension surface for
project-specific commands, tools, skills and UI. Compare with `pi install ./packages/regulator-pi`
and `regulator init`: what GSD installs into a project versus what this harness refuses
to read from one, and why the second is a security posture rather than a limitation.

**Pi.** `docs/packages.md` at `v0.87.0` (sources, scope, dedup, filtering);
`settings.md` (user, project, precedence); `containerization.md` (what real isolation
looks like); `json.md` and `rpc.md` (a non-Node host driving a session). For your notes:
which of the lab's gates would survive a unit running inside a container it controls, and
which would not.

**Portability appendix (a survey, not a lab).** Three channels a harness can speak
without surrendering authority to them. MCP, for tools administered remotely: a tool the
harness did not write is still a tool with a declared effect, and the profile grant and
the effect table are where it is admitted. A2A, for tasks between agents: a task from
another agent is a contract from S3 or it is nothing, and its result is a report the gate
checks. The Agent Control Standard, for portable runtime policy: a policy the harness did
not author is a routing or budget policy it validates on load, or it is refused. In every
case the channel carries variety in and evidence out, and authority stays where the
registry says it is. The mapping onto other harnesses' hook systems is the same exercise
as lesson 02's, one column per harness.

## 7. Checkpoint

You have finished checkpoint 14 when:

1. `pnpm check` passes — including the manifest, memory-scope, glossary-terms and
   overdue-review cases in core, `glossary-lint` in checks, `instance.test.ts` (the
   portability drill: init, doctor, the declared prefixes in the session, one unit end
   to end in an unfamiliar repository), the post-merge case in the controller test,
   `deliver.test.ts` (the watcher), the lesson-15 CLI test (`init`, `doctor`, `watch`,
   `identity promote`), the memory-scope case in the identity checkpoint test, the
   replay and manifest in the read model test, and the registry tests with forty-two
   records and the five-arm suite.
2. Drill 1's list is written down, with each item classed as declaration, discovery or
   the fixture's.
3. Drill 2's decision is an obligation's rationale in your instance.
4. Drill 3's attenuated report has an interpretation.
5. `OPERATING.md` in your copy names who runs `doctor`, `watch` and `review --due`.
6. `docs/DEBT.md` has rows 11, 24, 27, 31, 32 and 34 struck and rows 36–39 added.
7. Your notes hold drills 1–5 and the field-study answers; drill 5 is the start of the
   capstone.

## Further reading

- Pi docs at `v0.87.0`: `packages.md`, `settings.md`, `containerization.md`,
  `environment-variables.md`, `json.md`, `rpc.md`, `sdk.md`.
- Stafford Beer, *The Heart of Enterprise*, on recursion: the viable system that contains
  the one you built is the one that has to keep it viable.
- This repository's [`packages/regulator/OPERATING.md`](../../packages/regulator/OPERATING.md),
  [`docs/DEBT.md`](../../docs/DEBT.md), [`vsm/`](../../vsm/), and the capstone brief in
  [`course/ASSESSMENT.md`](../ASSESSMENT.md).
