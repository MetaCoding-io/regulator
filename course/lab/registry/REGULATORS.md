# Regulators

Generated from `registry/regulators/*.json` by `regulator docs`. Do not edit by hand.

| ID | Name | Function | Level | Status | Review by |
| --- | --- | --- | --- | --- | --- |
| `reg.control.profile-write-grant.v1` | Profile write grant | S3 | deterministic-gate | active | 2026-12-01 |
| `reg.coordination.reintegration.v1` | Reintegration guard | S2 | deterministic-gate | active | 2026-12-01 |
| `reg.coordination.thrash-detector.v1` | Thrash detector | S2 | deterministic-gate | active | 2026-12-01 |
| `reg.coordination.unit-lease.v1` | Unit lease gate | S2 | deterministic-gate | active | 2026-12-01 |
| `reg.authority.vendor-write-gate.v1` | Vendor write gate | S5 | deterministic-gate | active | 2026-12-01 |

## Profile write grant

`reg.control.profile-write-grant.v1` · S3 · deterministic-gate · active · introduced in M04

**Purpose.** Limit direct write and edit calls to the paths the active capability profile grants, and limit the active tool surface to the profile's tools.

**Absorbs.** `ungranted-capability-use` — Work of one kind (research, implementation) reaching tools or paths it was never granted, because a persona prompt is the only thing saying otherwise.

**Mechanism.** `src/cp3-profiles.ts` at `session_start`, `tool_call`

**May.**
- set the active tool set when a profile is applied
- block a write or edit outside the profile's writable paths

**May not.**
- select a profile without a user command or CLI flag
- block shell commands
- grant a tool the host does not have

**Evidence.** `src/cp3-profiles.test.ts`

**Limitations.**
- Positive grant covers write and edit only; the implement profile grants bash, which is not path-gated.
- Read-only means declared read-only effects (effects.ts); a tool with an undeclared effect is refused from read-only profiles, not audited.
- Lexical path check only, as for the vendor write gate.

**Ownership.** course-lab · introduced 2026-09-21 · review by 2026-12-01


## Reintegration guard

`reg.coordination.reintegration.v1` · S2 · deterministic-gate · active · introduced in M05

**Purpose.** Merge a unit's branch back into the base only from a clean checkout on the base branch; on conflict, abort, leave the base exactly as found, and hand the conflicting paths to S3 as a coordination signal.

**Absorbs.** `hidden-coupling` — Work done in isolation looks finished until it meets the base; a merge that auto-resolves, or that lands on a dirty checkout, hides the coupling instead of surfacing it.

**Mechanism.** `src/worktree.ts` at `regulator unit finish`

**Channels.** consumes `unit branch`, `base branch` · emits `coordination-signal (conflict) → S3`

**Scope.** subjects unit · resources base branch, worktree

**May.**
- refuse to merge into a dirty checkout or from the wrong branch
- abort a conflicting merge and record the conflicting paths
- remove the worktree and branch and release the lease after a clean merge

**May not.**
- resolve a conflict
- rebase or rewrite history
- merge without a clean base

**Evidence.** `src/worktree.test.ts`, `src/unit.test.ts`

**Limitations.**
- Detects file-level conflicts only; two units can change disjoint files and still break each other (the S2 gap analysis's semantic-conflict case).
- Merge commits only; no rebase, squash or fast-forward policy.
- Nothing runs the checks after the merge yet; lesson 09 adds evidence at closeout.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01


## Thrash detector

`reg.coordination.thrash-detector.v1` · S2 · deterministic-gate · active · introduced in M05

**Purpose.** Count write and edit calls per file within a unit and emit a typed coordination signal past a threshold, so oscillation between two fixes becomes visible to S3 instead of burning budget silently.

**Absorbs.** `oscillation` — Fix A breaks B, fix B breaks A; each individual edit is locally reasonable and nothing in the loop notices the pattern.

**Mechanism.** `src/cp4-coordination.ts` at `tool_execution_end`

**Channels.** consumes `tool_execution_end (write, edit)` · emits `coordination-signal (oscillation) → S3`

**Scope.** subjects unit · resources file

**May.**
- record a coordination signal to .regulator/signals.ndjson and notify the user

**May not.**
- block a tool call
- pause or replan the unit (S3 decides, lesson 08)
- decide which of two fixes is right

**Evidence.** `src/cp4-coordination.test.ts`, `src/coordination.test.ts`

**Limitations.**
- Counts write and edit tool calls only; edits made through bash are invisible to it.
- Memory is per session: a unit resumed in a new session starts counting from zero.
- The threshold is a constant, not a policy; lesson 07 makes it a budget.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01


## Unit lease gate

`reg.coordination.unit-lease.v1` · S2 · deterministic-gate · active · introduced in M05

**Purpose.** Refuse every tool with a non-read-only effect unless the session's unit holds a live lease on the worktree it runs in, so two units cannot write the same checkout and a dead session cannot hold a claim forever.

**Absorbs.** `write-collision` — Two sessions writing one checkout corrupt each other's work; a session that died mid-unit blocks the resource until someone notices.

**Mechanism.** `src/cp4-coordination.ts` at `session_start`, `tool_call`, `turn_end`

**Channels.** consumes `lease (.regulator/leases)` · emits nothing

**Scope.** subjects unit, session · resources worktree

**May.**
- refuse any non-read-only tool call while no live lease covers the working directory
- renew the unit's lease at each turn end

**May not.**
- acquire or release a lease (the unit lifecycle does that)
- resolve which unit should hold a contested resource
- block read-only tools

**Evidence.** `src/cp4-coordination.test.ts`, `src/coordination.test.ts`

**Limitations.**
- Liveness is expiry-only: a live process that stops heartbeating and a dead one look the same until the TTL passes; there is no fencing token yet.
- The lease covers the working directory by path; a tool that writes elsewhere by absolute path is outside it (lesson 10).
- Leases are files on one machine; nothing coordinates across hosts.

**Ownership.** course-lab · introduced 2026-09-22 · review by 2026-12-01


## Vendor write gate

`reg.authority.vendor-write-gate.v1` · S5 · deterministic-gate · active · introduced in M02

**Purpose.** Refuse write and edit calls under vendor/ so that vendored code stays upstream's, whatever the model is asked.

**Absorbs.** `protected-path-mutation` — The smallest diff for a request is often inside a vendored file; a rule stated only in prose holds inconsistently under pressure.

**Mechanism.** `src/cp1-trace.ts` at `tool_call`

**May.**
- block a write or edit whose normalized path is under vendor/
- record the refusal and its reason in the trace

**May not.**
- block shell commands
- modify any file
- change what counts as protected

**Evidence.** `src/cp1-trace.test.ts`

**Limitations.**
- Lexical path check only: no symlink, hard-link or TOCTOU protection (lesson 10 hardens it).
- Covers the write and edit tools; bash and custom tools bypass it (lessons 05 and 10).

**Ownership.** course-lab · introduced 2026-09-21 · review by 2026-12-01
