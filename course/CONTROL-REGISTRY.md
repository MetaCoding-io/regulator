# The regulator registry and the maintainer's control room

Every regulator the course teaches learners to build carries obligations beyond its
code: the failure it absorbs, the level it enforces at, its evidence, its boundary, its
cost, its owner, and the condition under which it should be retired. Fifteen modules of
that produces a harness nobody can explain six months later — unless the obligations
are recorded somewhere that is checked, not merely written.

This document specifies that somewhere. It has two halves: a **registry** the learner
maintains from lesson 02 onward, and a **control room** they build at the end that
projects the registry and the runtime evidence into one inspectable view.

## 1. Why not a folder of Markdown

The obvious answer — a `meta/` directory of prose notes per regulator — is the wrong
one, for the same reason the course prefers gates to prompts. Prose drifts. Nothing fails
when a note points at a test that was deleted, when a "read-only" claim stops being true,
or when a review date passes. The registry has to be **machine-readable, typed, and
checked in CI**, with the human-readable form generated from it.

Four kinds of thing, kept distinct:

| Kind | Where | Maintained by | Example |
| --- | --- | --- | --- |
| **Committed control design** | `registry/regulators/*.json` | the learner, by hand, one record per regulator | "the vendor write gate exists, absorbs protected-path mutation, is a deterministic gate at `tool_call`, is bounded by…" |
| **Executable mechanisms** | `src/` | the learner, as code | the `tool_call` handler |
| **Runtime evidence** | `.regulator/` (gitignored) | the harness, append-only | "at 20:41 the gate blocked `write vendor/left-pad.js` in attempt 2" |
| **Generated views** | `registry/REGULATORS.md`, `TOPOLOGY.md`, the control room | a generator, never by hand | the table a reviewer reads |

The principle the course already holds — *no second source of truth* — applies here
with force. The registry describes what regulators *should* exist. The event store
records what they *did*. Neither is ever copied into the other by a person.

## 2. The record

A regulator record is its identity card. The schema lives in
[`packages/protocol/src/registry.ts`](../packages/protocol/src/registry.ts), the check
and docs generator in [`packages/core/src/registry.ts`](../packages/core/src/registry.ts);
the seed records in [`lab/registry/regulators/`](lab/registry/regulators/). Abbreviated:

```jsonc
{
  "id": "reg.authority.vendor-write-gate.v1",   // stable; versioned
  "name": "Vendor write gate",
  "status": "active",                           // proposed | active | retired
  "vsmFunction": "S5",                          // which function this regulator serves
  "purpose": "…",
  "absorbs": { "failureClass": "protected-path-mutation", "description": "…" },
  "mechanism": {
    "level": "deterministic-gate",              // the mechanism-hierarchy level, named
    "implementation": "src/cp1-trace.ts",       // must exist
    "enforcementPoints": ["tool_call"]
  },
  "authority": { "may": ["…"], "mayNot": ["…"] },
  "evidence": { "tests": ["src/cp1-trace.test.ts"], "lastVerifiedRevision": "…" },
  "limitations": ["Lexical path check only…", "bash bypasses it…"],
  "ownership": { "owner": "…", "introduced": "2026-09-21", "reviewBy": "2026-12-01" },
  "retirement": { "condition": "…" },
  "introducedIn": "M02"
}
```

Fields that later modules add: `channels` (consumes/emits, M05), `cost` (M07),
evidence freshness rules (M09), `policy` references (M12), and an `ablation` entry
(M14). The schema is closed — unknown fields are rejected — so growth is deliberate.

## 3. `regulator check`

Documentation with a mechanism behind it. The check fails when, among other things:

- a record is not valid JSON or does not match the schema;
- two records share an id;
- an active regulator's `implementation` path does not exist;
- an active regulator cites no tests, or cites a test that does not exist;
- a regulator at the `deterministic-gate` level states no `limitations` — a gate without
  a boundary statement is exactly the dishonesty the course forbids;
- (later) a runtime event names a regulator id the registry does not know;
- (later) a retired regulator is still emitting enforcement events;
- (later) `reviewBy` has passed.

`regulator docs --check` fails when the committed `REGULATORS.md` differs from what the
records generate. Both run under `pnpm check`, so a learner cannot merge a regulator
whose card is stale.

Today's CLI is `node dist/registry-cli.js <check | docs>`; the production target is a
`regulator` binary with `add`, `check`, `status`, `graph`, `explain <id>`, and
`review --due`.

## 4. How the record grows with the course

Learners do not fill in twenty fields in lesson 02. Each module adds the fields it has
taught the learner to mean:

| Lesson | Fields the learner can now fill honestly |
| --- | --- |
| 02 | `purpose`, `absorbs`, `mechanism.level`, `mechanism.implementation`, `evidence.tests`, first `limitations` (the `bash` leak) |
| 03 | tool effect declarations feeding `limitations` |
| 04 | `authority.may` / `mayNot` |
| 05 | `channels` (consumes/emits), resource claims, coordination scope |
| 07 | `cost` metrics and budget references |
| 09 | evidence freshness requirements, `lastVerifiedRevision` |
| 10 | the full `limitations` list — the enforcement boundary statement, now mandatory |
| 12 | `ownership`, `policy` relationship |
| 14 | `ablation`, `reviewBy`, `retirement.condition` |
| 15 | operational ownership on hand-over |

The capstone's *mechanism ledger* and *enforcement boundary statement* are then
generated from the registry rather than written as a separate essay.

## 5. Regulator retirement

Every regulator was added to absorb a failure that a particular model, on a particular
day, actually produced. Models change. A workaround that was essential for one model is
dead weight for the next — still costing latency, tokens, and the human's attention on
every run. A control system that only ever grows is not viable either.

So every active record must eventually carry:

- the failure it addresses, and **evidence that the failure still occurs** without it;
- its operating cost;
- a review date;
- an **ablation test** — the eval arm with this regulator switched off;
- a **retirement condition** — typically "ablation shows no significant regression
  across N supported model versions and M eval suites."

Lesson 14 adds the ablation arm to the eval harness; `regulator review --due` lists what
is overdue. Retiring a regulator is a recorded decision, not a deletion: the record's
`status` becomes `retired` and it keeps its history.

## 6. The control room

The maintainer's interface is a projection of *registry ∪ event store ∪ eval results*.
It owns no state. It answers four distinct questions, and they get four views rather
than one enormous diagram:

1. **Design topology.** S1–S5 and S3\* as nodes; declared channels as edges; where
   authority lives. Built from the registry alone.
2. **Live operations.** Which units are active, who holds which lease, which attempt is
   running, budget consumed, gates that fired recently, escalations pending. Built from
   the event store.
3. **Assurance.** Which regulators have fresh evidence; which acceptance criteria are
   uncovered; which claims rest only on self-report; which gates blocked what. Built
   from the event store and eval results.
4. **Lifecycle.** Which regulators are expensive, overdue for review, ineffective in
   ablation, or candidates for retirement. Built from the registry and eval results.

A fifth, **replay**, scrubs through one run: contract → dispatch → tool calls → failure
→ recovery → evidence → obligation → escalation → closeout.

Interface rules, in order of importance:

- **Read-only first.** The control room is an S3\*/S4 observation surface. The moment it
  grows a "raise budget" or "dismiss obligation" button it has quietly become an S3/S5
  authority surface. Actions come later, only as typed proposals or explicitly
  authorized commands with their own audit trail.
- Every visible node has a stable registry id; every edge is a *declared* channel, never
  an inferred conversation.
- Design mode shows committed structure; live mode overlays runtime state; diff mode
  shows what changed between registry revisions.
- The inspector for any node always shows purpose, mechanism, authority, evidence,
  boundary, cost, owner, and retirement condition — the record, not a summary of it.
- "Healthy" means *evidenced and current*, never merely "no errors reported."

For events to join to records, every runtime event carries the ids that make the join
possible — `regulatorId`, `runId`, `unitId`, `attemptId`, `policyVersion` — and lesson
14 maps those spans onto the OpenTelemetry GenAI conventions (`invoke_agent`,
`execute_tool`, and so on) with mandatory redaction, since prompts and tool output can
carry credentials.

## 7. Where this lands in the course

- **Lesson 02** seeds the registry with the first real gate and runs `regulator check`
  as part of the checkpoint.
- **Lessons 03–12** each add their fields (table above); the check grows stricter as the
  schema does.
- **Lesson 14** adds ablation, review dates and retirement conditions, and the control
  room's assurance and lifecycle views.
- **Lesson 15** ships the control room as the harness's operating surface, and the
  capstone's viability case is generated from the registry.

Status: the registry schema (`protocol`), `check` and the docs generator (`core`), the
lab CLI and eight records exist and run under CI. The control room's read model exists as
`regulator status --json` in `packages/cli` (lesson 06): definition (registry, workload;
policies declared as files since lesson 07; profiles still in code) and instance (units with
contract, report, attempts and budget ledger; leases; unrouted signals). `packages/control-room` serves the first page over
it: the design topology (regulators by function, with the channels each declares), the
workloads, every instance's units, leases and unrouted signals, and an inspector that shows
the whole record for a regulator or a unit. It is read-only by construction (every non-GET
request is refused). Assurance, lifecycle and replay views are still design.
