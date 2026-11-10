# Algebraic data types read against "Types describe"

- **Status:** graduated, and §3.1 has landed (see its **Landed** line): §3.1 is [#160](https://github.com/MetaCoding-io/regulator/issues/160),
  §3.2 is [#161](https://github.com/MetaCoding-io/regulator/issues/161), and §3.3 is
  [#162](https://github.com/MetaCoding-io/regulator/issues/162) (all `roadmap:0.2`; #162 pays
  DEBT row 47). §3.4 (the optional-field survey) and §3.5 (branded identifiers) are open and
  sit in the open questions' backlog.
- **Source:** a post by 工业聚 (@guyingjie129, 2026-11-01), written in Chinese and quoting
  David Khourshid's "Statecharts in 2 minutes". It argues that a state machine is too
  low-level, because a few dozen nodes and their arrows already exceed what a person can
  track, and that thinking in state machines is the gateway to thinking in algebraic data
  types. Product and sum types give the state space an algebra (their sizes multiply and
  add). The Curry–Howard correspondence lets a type be read as a proposition. In TypeScript,
  types can be read as sets: `never` is the empty set, `unknown` is the set of everything,
  and `a extends b` means a is a subset of b. A function type `a -> b` has |b|^|a| values,
  and covariant and contravariant positions in a signature read as *produce* and *consume*.
  The payoff is type-driven development in which many illegal states can't be represented.
- **Why a note:** `AGENTS.md`'s prime directive ranks "TypeScript type or compile-time
  invariant" first among mechanisms. The post gives a precise way to ask how much of the
  build actually works at that level, and how much is a runtime gate that could be moved up
  a level.

Claims about what the code does today cite the file. Counts are from `main` at `4b33df3`,
for `packages/*/src` without tests.

## 1. The post's ideas, mapped to this code

| Idea | What it means here | Where it shows up today |
| --- | --- | --- |
| Sum type | one of several tagged cases | `Type.Union` of `Type.Literal`s and tagged `Type.Object`s, about 86 in `packages/` |
| Product type | all of several fields | `Type.Object` with `additionalProperties: false` |
| Optional field (`1 + a`) | a sum type hidden inside a product | `Type.Optional`, about 118 in `packages/protocol/src` |
| `b^a` (a function type, or a total map) | one `b` for every `a` | `CONTINUES_WITHOUT_ANSWER: Record<InteractionKind, boolean>` (`protocol/src/interaction.ts`) |
| `never` is the empty set | an exhaustive match leaves nothing behind | no `assertNever` in the repository |
| `a extends b` is a subset | narrowing one type to part of another | `UnitTransitionStep = Extract<…ENFORCEMENT_POINTS…>` (`protocol/src/execution.ts`) |
| Variance (produce/consume) | which side of a signature a type sits on | not used as a design tool |
| Illegal states unrepresentable | the type admits only legal values | partly: see §2 and §3 |

## 2. Where the build already works at the type level

- **Channels are tagged sum types.** Each message pins `kind`, `channel`, `source` and
  `destination` to literals. An audit finding is always `S3*` to `S3`, and a policy proposal
  can only be addressed to `S5` (`protocol/src/index.ts:40-80`). Most of the sentence "a
  signal is not an audit" is held by the type.
- **One definition gives both the type and the check.** `Static<typeof Schema>`, used about
  144 times, derives the TypeScript type from the TypeBox schema that validates at runtime,
  so the two can't drift apart.
- **Some outcomes are tagged unions.** `RunUnitOutcome` (`regulator/src/controller.ts:122`)
  is `refused | closed | blocked`, and only a `closed` outcome carries a `report` and a
  `sha`.
- **Total maps instead of switches.** `CONTINUES_WITHOUT_ANSWER` is a `Record` over the
  interaction kinds, so the compiler refuses a new kind until someone states whether it
  continues without an answer. This is the post's `b^a` in practice, and it's the pattern
  §3.1 extends.
- **Strict compiler settings.** `tsconfig.base.json` sets `strict`,
  `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`. With
  `exactOptionalPropertyTypes`, an absent field and `undefined` are different types, which
  §3.2 depends on.

## 3. Where it stops short

### 3.1 Matches that a new case passes through silently

Five switches over closed unions either end in a `default:` that groups unlisted cases, or
have no `default` and no exhaustiveness check:

- `core/src/interaction.ts:33`: `recap`, `choice` and `clarification` fall into
  `default: "fixed"`.
- `core/src/recovery.ts:110`: eight of the thirteen `FailureCause`s get the "ended without
  a report" hint, including `ambiguity` and `oscillation`, where that text is wrong.
- `regulator/src/consent.ts:62`: `default: ""` turns a new verdict into an empty refusal
  message.
- `core/src/reporting.ts:44`: the tool name is an open string, so the switch can't be
  exhaustive.
- `core/src/trajectory.ts:180`: no `default`, and nothing makes a new `AttemptOutcome`
  fail to compile.

**Proposal ([#160](https://github.com/MetaCoding-io/regulator/issues/160)):** export
`assertNever` from `protocol`, list every case, and prefer a `Record<Union, …>` table where
the switch only maps one value to another. Mechanism level: type.

**Landed (2026-11-10, [#160](https://github.com/MetaCoding-io/regulator/issues/160)).**
`assertNever` is `protocol/src/exhaustive.ts`. The five switches list every member and end
in it, and so does a sixth this section missed: `regulator/src/predictions.ts` switched
over the built-in metrics with the nine trajectory metrics in `default:`. `reporting.ts`
narrows the name with `isReportingToolName` first and keeps its refusal. `hintFor` had seven
causes in its `default:`, not eight (the union has thirteen members with
`context-degradation`), and each now has a hint that is true of it. No switch became a
`Record` table: each of the six computes from more than the tag. The other `default:`
matches in `packages/*/src` are object keys (a policy's `budgets.default`, a flag's
default value), not switch branches.

### 3.2 Products with optional fields that admit states the loop never means

`UnitRecord` is `status` plus `reason?`, so a closed unit with a reason is valid, and so is a
blocked unit without one. `setStatus(unitId, status, reason?)`
(`core/src/execution-store.ts:104`) accepts a reason for any status. The `blocked` case of
`RunUnitOutcome` puts eleven reasons together with `problems?`, `detail?` and `verdict?`
in any combination. In the post's algebra, each optional field doubles the state space,
and most of those combinations mean nothing.

**Proposal ([#161](https://github.com/MetaCoding-io/regulator/issues/161)):** key both types
on status, so each case carries exactly what it means and nothing else. Mechanism level:
type, with the schema kept as the check on records read from disk.

### 3.3 The lifecycle is a state machine held as data, not as a type

`UNIT_TRANSITIONS` (`protocol/src/execution.ts:54`) is the post's state machine: twelve
rows over six statuses, enforced by `setStatus` at runtime (`execution-store.ts:107`). The
gate is real and the figure is generated from it. The compiler, though, knows nothing about
the table: `setStatus(id, "closed")` called from `contracted` compiles. The gate checks the
`(from, to)` pair rather than the trigger, and the store keeps only the current status, so
the trajectory is reconstructed (`unit-lifecycle` limitations 1 and 2; DEBT row 47).

**Proposal ([#162](https://github.com/MetaCoding-io/regulator/issues/162)):** declare the
table `as const`, derive `TriggerFrom<S>` from it, write a transition by trigger rather than
by status, and append the transition to a history. This moves the lifecycle from a gate
(level 2) to a type (level 1) where the caller's status is known, keeps the gate for
records read from disk, and meets the card's retirement condition.

### 3.4 Open: a survey of the remaining optional fields

After #161, the other optional fields in the protocol should be sorted into three groups:
fields that are genuinely optional, fields that are optional because their meaning depends
on a sibling tag (to become a sum type), and fields kept for compatibility with existing
records on disk (to keep, with a comment saying why). There's no issue yet. Backlog row in
the [open questions](2026-09-25-open-questions.md#6-backlog--smaller-things-to-think-about).

### 3.5 Open: branded identifiers

Unit, contract, obligation and regulator identifiers, SHAs and paths are all `string`
(`NonEmpty`), so passing a `contract.id` where a `unitId` is expected compiles. A brand
(`string & { readonly __brand: "UnitId" }`) produced by the schema's decode would catch
that. The cost is a cast at every boundary where a value enters, and so far no bug has
come from a mixed-up identifier. Backlog row only, until one does.

## 4. What the post's framing doesn't change

- **The runtime gate stays.** Records are read from disk and messages come from a model,
  so a type describes only what has already been validated. `AGENTS.md`'s order is about
  where a rule is *first* held, not a reason to remove the check below it.
- **Variance as a design tool** (produce/consume) matters most in APIs built from higher-order
  functions. This codebase is mostly schemas and stores, and nothing here asks for it yet.
- **The post's "x^10" claim** is a slogan, not a measurement. What the build can measure is
  narrower: how many gates are reached at level 1 rather than level 2, which a registry
  card's `mechanism.level` already records.

## 5. Further reading

- Scott Wlaschin, *Domain Modeling Made Functional* (Pragmatic Bookshelf, 2018). The
  practical treatment of making illegal states unrepresentable, including turning a status
  field with optional fields into a sum type (§3.2). F#, but it translates directly to
  TypeScript.
- Sandy Maguire, *Thinking with Types*, chapters 1–3. The algebra the post sketches:
  counting the values of a type, exponentials, and variance.
- Bartosz Milewski, *Category Theory for Programmers*, the lecture series on YouTube. The
  early lectures cover product and sum types, function types as exponentials, and
  Curry–Howard.
