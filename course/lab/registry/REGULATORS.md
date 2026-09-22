# Regulators

Generated from `registry/regulators/*.json` by `regulator docs`. Do not edit by hand.

| ID | Name | Function | Level | Status | Review by |
| --- | --- | --- | --- | --- | --- |
| `reg.control.profile-write-grant.v1` | Profile write grant | S3 | deterministic-gate | active | 2026-12-01 |
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
