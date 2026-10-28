# Pathologies — how the whole arrangement fails, and what absorbs it

The registry says what each regulator does and which failure class it absorbs: every
record carries `absorbs.failureClass`, and `regulator docs` renders them. The glossary's
[diagnostic table](GLOSSARY.md#_5-diagnostic-table-from-observed-failure-to-mechanism)
goes from one observed failure to one mechanism. This page is the third view. It catalogs
the *characteristic* ways a viable system fails as a whole: a function is missing, or
absorbed by its neighbour, or disconnected from the one it must talk to, or a channel
carries the wrong variety. For each of those it says what the failure looks like in an
instance, which regulator absorbs it, which fixture reproduces it, and what nothing
absorbs yet.

The tables are rendered. Their rows live in
[`packages/regulator/registry/pathologies.json`](../packages/regulator/registry/pathologies.json),
beside the regulator records, and `regulator docs --write` renders them here between
marker comments; `regulator check` refuses a row that names a regulator the registry does
not hold as active, and `docs --check` fails when a table is stale. The same rows are the
residual uncertainty of the [viability case](../packages/regulator/VIABILITY.md). The
prose around the tables is written by hand.

The taxonomy follows Pérez Ríos's diagnosis of viable systems, which sorts pathologies
into structural, functional and information-channel kinds; his 2025 paper applies it to
AI systems. The agent-specific rows follow the MAST failure taxonomy of multi-agent LLM
systems, whose categories are specification and design, inter-agent misalignment, and
verification and termination. Neither taxonomy is reproduced here. The rows are this
project's translation of them, and a row with an empty "reproduced by" column is a
pathology the lab has not yet built a fixture for.

Read the columns in order, because each one depends on the one before it. A pathology you
cannot name is a pile of symptoms. One you can name but cannot reproduce is a diagnosis
without a test. One you can reproduce but nothing absorbs is a row for `docs/DEBT.md`.

## 1. Structural pathologies — a function is missing or misplaced

<!-- pathologies:structural -->
| Pathology (after Pérez Ríos) | In an instance it looks like | Absorbed by | Reproduced by (course module) | Not absorbed |
| --- | --- | --- | --- | --- |
| **No S3\***: audit has collapsed into operations, so the executor certifies its own work | Units close on their own reports. `regulator unit evidence` shows no host records, or only records older than the revision | `closeout-gate`, `evidence-preflight` and `result-report-gate` (M09), and INV-003 | the drift suite's control arm, where `run_tests` is the only check and the report is believed for everything else | — |
| **S3\* that reads what S1 wrote**: the auditor runs the suite the unit edited | `run_tests` passes on a branch that deleted the failing tests, and the defect is closed as fixed | `inherited-tests-check` (the suite at the branch point judges the unit's tree, and a shrunk inherited file fails; added after M15) (M09) | the self-certifier behaviour; the `no-inherited-tests` arm shows it closing green | an expectation rewritten to the current output inside an exempt file (`inherited-tests-check` limitation 1) |
| **S5 collapsed into S3**: identity is whatever the last operator or unit wrote | A unit edits `regulator/identity/`, or a README rule becomes policy nobody decided | `identity-write-gate`, `identity-untouched-check`, `s5-decision` and `proposal-intake` (M10, M12), and INV-001 and INV-002 | the drifter, which edits the glossary and is refused, and the sloppy unit, which writes rules into the README (DEBT row 34 is paid by `glossary-lint`; the README rule itself is still only measured, by `memoryRules`) | a rule written in prose outside the writable prefixes shows up as a grader's number; no check refuses it |
| **No S4**: nothing watches the environment, so the system learns of change by failing | A dependency advisory, a platform change or a new statement is found by a unit mid-work, or never | `intelligence-intake` (M11); the `research` unit type; in the finance workload, nothing yet | `contracts/research-vendored-helper.json` | S4 triggers that would raise a research unit unasked (archived CONTROL-REGISTRY.md §7); in the finance example a statement's arrival is handled by hand |
| **Missing recursion**: the harness is regulated only as a tool, never as a viable system of its own | Nobody owns a regulator, review dates pass, and the definition drifts from the instances | `regulator-lifecycle` (a passed review date fails CI), `doctor` and `instance-manifest` (M14, M15); OPERATING.md's ownership section | `regulator check --today 2027-01-01`, which makes every card overdue | the definition's own S4 (the Pi upgrade path) is a checklist a person runs |
| **S2 absorbed by S3**: every coordination is an orchestrator decision | Units serialize behind the loop, and a conflict becomes a replan instead of a signal | `unit-lease`, `reintegration` and `thrash-detector` (M05); leases and worktrees coordinate without S3, and a conflict is a coordination signal | `fixture-oscillation` | semantic commitments between units (issue #14) |
<!-- /pathologies -->

## 2. Functional pathologies — a function exists but does its neighbour's job, or none

<!-- pathologies:functional -->
| Pathology (after Pérez Ríos) | In an instance it looks like | Absorbed by | Reproduced by (course module) | Not absorbed |
| --- | --- | --- | --- | --- |
| **S3 overload / micromanagement**: every local decision becomes S3's | Attention is spent on questions the contract should have delegated, and `regulator obligations` fills with clarifications | `work-contract-gate` (fixed / delegated / unresolved) and `interaction-contract` (the attention budget) (M06, M13) | `contracts/underscore-unresolved.json`, an unresolved decision the unit must surface rather than settle | the metrics that would show it (undelegated decisions discovered, replans attributable to the contract) are DEBT row 40 |
| **S3/S4 disconnection**: intelligence never reaches operations | A research unit's finding sits in the log, and the next unit repeats the mistake | `intelligence-intake` (an obligation that holds the units it names until it is dispositioned) and `progression-veto` (M11) | `research-vendored-helper` followed by a unit it names | an advisory nobody ever dispositions holds its units forever (a wait ceiling is DEBT row 30's sibling) |
| **S4 acting as S3**: intelligence replans on its own | A finding rewrites a contract or a policy | `intelligence-intake` (`report_intelligence` records the finding and returns, and only S3 dispositions it) and `proposal-intake` (a proposal never mutates policy) (M10, M11) | every proposal path test | — |
| **Weak S5 / no algedonic path**: nothing can interrupt the loop | A unit spends its ceiling on a question a person could have answered in a minute, or it asks about everything | `interaction-contract`, `pause-gate`, `algedonic-delivery` and `disposition-authority` (M13); consent waits, recap does not, and silence is never consent | the headless consent case in `algedonic.test.ts`, the consent gate in `authority.test.ts`, and the finance example's `f5-prepare-payment` | a consent grant is enforced on the named tool's calls only, and declared, not derived from effects (#121) |
| **Oscillation**: S1 units undo each other, and S2 does not see it | The same file flips between two states across attempts or units | `thrash-detector` (the coordination signal) and `recovery-router` (clarify) (M05, M08) | `fixture-oscillation` | oscillation across *units* rather than within one (a coordination-oscillation signal is part of #14) |
| **Recovery as retry**: every failure gets the same response | Six identical attempts at an environment failure | `failure-observer` and `recovery-router` (under a versioned policy) (M08) | the recovery cases in `controller.test.ts`, and the drifter's `repair → repair → replan` | — |
| **Budget without a limit behaviour**: the ceiling is reached and nothing happens | A unit runs until the provider cuts it off | `budget-guard` and `model-router` (M07) | `budget.test.ts` | a reserve for verification and recovery at the instance level is not declared (the viability-theory framing; unscheduled) |
| **Recovery per unit hides a shared cause**: the same failure is recovered once per unit, and the instance never notices | Six units each take `environment → remediate` for one missing dependency, six decisions and no signal | nothing at the instance level: `recovery-router` counts occurrences per cause per unit by design (its limitation 3), and `progression-veto` holds progression only on an obligation something else opened | none; a fixture whose tool fails identically for every unit would show it | a level-2 count over recovery decisions that opens an obligation on the instance when N units hit one cause in a window (the [agent-engineering books note](https://github.com/MetaCoding-io/regulator/blob/main/docs/research/2026-10-25-agent-engineering-books.md) §4 item 8, after Lanham §8.3.7's circuit breaker); recorded as a backlog row, not debt, because the card names the per-unit count as a limit |
| **The undeclared action**: the domain's irreversible act reaches the harness as a write prefix and an advice line, so whether it needs a yes is the model's to notice | A trade list, a payment or a publish is a file the unit writes under a prefix the profile allows; the advice says to ask first, and a hurried unit writes without asking, or asks once per item until the person stops reading | `declared-tool` (the action is a tool the workload declares with its effect, and the consent is derived from `sideEffects: "irreversible"` before the call runs) and `interaction-contract` (a consent grant on a path prefix where no tool is declared) | the portfolio's careless close (`portfolio.test.ts`): `place_trade` called without asking is refused by the derived consent, the tree unchanged | the derivation reads one value of one axis, and an irreversibility outside the tree (a network call the program makes) is declared, not observed (`declared-tool` limitations 2 and 4) |
<!-- /pathologies -->

## 3. Information and channel pathologies — the channel exists but carries the wrong variety

<!-- pathologies:channel -->
| Pathology (after Pérez Ríos) | In an instance it looks like | Absorbed by | Reproduced by (course module) | Not absorbed |
| --- | --- | --- | --- | --- |
| **Channel without transduction**: a signal is not an audit, and an audit is not a policy | A finding is filed as a proposal, or an uncertainty is treated as a decision | `obligation-router` (the routing floors) (M02, M10, M11); typed channels with authority per kind (the `reporting` tools) | the smuggled-authority tests in `packages/regulator-pi` | — |
| **Attention decay**: the unit still speaks fluently, but has stopped keeping the small rules it is shown every turn | Forty turns in, the marker the prompt asks for on every reply disappears; the next thing dropped is a fixed decision | `behavioral-canary` (reads every reply and records the silence, advisory), `budget-guard` (the turn and token ceilings end the attempt eventually) and `contract-preserving-compaction` (what the loop needs survives eviction) | the canary case in `identity.test.ts` (scripted replies; no model) | what S3 does with the finding: no recovery cause names it (DEBT row 42), and a model that keeps the marker and still drifts is not seen |
| **Compaction discards the constraint** | After context eviction the unit forgets a fixed decision | `contract-preserving-compaction` (M07) | the compaction case in `budget.test.ts` | a model summary can still be wrong, and only the deterministic block is guaranteed (a permanent limit) |
| **Summary discards the uncertainty** | The report says "done", and the residual uncertainty never reaches the next decision | `result-report-gate` (residual uncertainty, deviations and emergent decisions are typed fields) and `obligation-router` (`uncertainty` signals routed by their declared impact) (M06, M11) | `contract.test.ts` | observation versus inference is not a typed distinction on evidence, and retraction dependencies are not tracked |
| **Data absorbed as control**: the environment instructs the regulator | A comment in the repository redirects a unit, or a tool result carries an instruction | `project-trust-rule` (nothing from the project is loaded), `canary-watch` and `identity-write-gate` (M10) | `fixture-injection` | poisoned operational memory driving a later unit is untested. Memory is rendered as facts and never as instructions, and that rendering is the whole defence; the candidate fixture is `fixture-poisoned-memory`, one false environment fact under valid provenance and a near review date ([#130](https://github.com/MetaCoding-io/regulator/issues/130), after #46; the [agent-engineering books note](https://github.com/MetaCoding-io/regulator/blob/main/docs/research/2026-10-25-agent-engineering-books.md) §6) |
| **Vocabulary drift**: the same word means two things across the log | Comments say task and the log says ticket, so a reader cannot tell a unit from an obligation | `identity-context` (the glossary rendered into context) and `glossary-lint` (M12, M15) | the sloppy behaviour | the attenuation of the commit-message half (DEBT row 36) |
| **Feedback delay**: the signal that a unit went wrong arrives after five more units | Drift accumulates before anything refuses | `pre-merge-trial` (runs the checks on the merged tree before anything lands; it replaced `post-merge-check`, which ran on the base after every merge) and `eval-harness` (the drift suite measures the accumulation) (M14, M15) | the drift scenario under the control arm | a coupling that `run_tests` and `run_checks` do not exercise lands (`pre-merge-trial` limitation 1); the trial itself was DEBT row 37, paid by #48 |
| **Self-report as control variety**: the unit's own confidence or relevance score is the signal that routes it | High reported confidence, failing checks, unit closed; or a "low consequence" claim that lowers a severity | `obligation-router` (reported severity is an input under policy, with floors), `closeout-gate` (the report satisfies nothing) and `budget-guard` (halts on the ledger, never on the unit's estimate) | none yet; a fifth scripted behaviour, `confident`, that reports high confidence and low consequence while `run_tests` fails ([#130](https://github.com/MetaCoding-io/regulator/issues/130), after #46; the [agent-engineering books note](https://github.com/MetaCoding-io/regulator/blob/main/docs/research/2026-10-25-agent-engineering-books.md) §6) | `confidence` on an intelligence signal is recorded and never calibrated; it is a `model-judgment` instrument once the prediction record exists (open questions §4) |
<!-- /pathologies -->

## 4. Agent-specific rows (after MAST)

<!-- pathologies:agent -->
| MAST category | This project's name for it | Absorbed by | Reproduced by |
| --- | --- | --- | --- |
| Disobey task specification | a fixed decision overridden | `work-contract-gate`, `behaviour-check` (`export-signature`) and `result-report-gate` (deviations) | the drifter (a two-argument `slugify` against a fixed one-argument signature) |
| Disobey role specification | a profile's grant exceeded | `profile-write-grant` and `identity-write-gate`; the instance manifest's protected prefixes cover `vendor/`, where `vendor-write-gate`, the course's first gate, is retired | the drifter's vendor edit, and `profiles.test.ts` |
| Loss of conversation history | a constraint lost to compaction | `contract-preserving-compaction` | `budget.test.ts` |
| Unaware of termination conditions | a unit that never reports, or reports twice | `result-report-gate` (one report per attempt), `budget-guard` and `recovery-router` (the `no-report` recovery cause) | `controller.test.ts` |
| Fail to ask for clarification | an unresolved decision settled silently | `work-contract-gate` (an unresolved decision must be surfaced) and `result-report-gate` | `underscore-unresolved` |
| Task derailment | a unit outside its contract's scope | `result-report-gate` (deviations of kind `scope`) and `closeout-gate` (the writable prefixes) | the drifter's root-level config |
| Information withholding | a finding not reported | `intelligence-intake` (`report_intelligence` is typed and recorded) and `result-report-gate` (the result report's `residualUncertainty` is typed and recorded); nothing forces their use | not reproduced: a unit that finds and does not tell has no fixture |
| Ignored other agent's input | intelligence not consumed | `intelligence-intake` (the obligation) and `progression-veto` (its veto) | `research-vendored-helper` |
| Reasoning-action mismatch | the report claims what the tree does not show | `closeout-gate` and `inherited-tests-check`; under either, the report's claims satisfy nothing | the self-certifier |
| Premature termination | closed before verification | `closeout-gate` (runs before reintegration) and `pre-merge-trial` (runs before the merge lands) | every closeout test |
| No or incomplete verification | tests not run, or run by the unit only | `closeout-gate` (host-run) and `inherited-tests-check` (the host-owned suite) | the control arm, and the self-certifier |
| Incorrect verification | the wrong thing verified | `closeout-gate` (evidence bound to the criterion) and `behaviour-check` (`export-signature` observed by content) (M09, M14) | `verify.test.ts` |
<!-- /pathologies -->

## 5. Using the catalog

In the course, each "Break it" section already reproduces two or three of these rows, and
the drift suite's four scripted behaviours (reference, drifter, sloppy, self-certifier)
are the rows with a committed report. A learner's harness is diagnosed by walking sections
1 to 3 and naming, for each row, the mechanism that absorbs it or the DEBT row that owes
it.

In the capstone, the viability case's boundary statement (the course's `ASSESSMENT.md`,
Artifact B item 4) is generated from the registry's limitations, and this page is the list
of pathologies a reviewer attacks from in the crit's adversarial twelve minutes.

In an instance, the control room's lifecycle and assurance views show which rows have a
regulator with fresh evidence. A row whose regulator's ablation arm shows no lift marks a
regulator to retire; it is not evidence that the pathology is cured. The registry record's
retirement condition says when that retirement is due.

As the registry grows, a new regulator names the failure class it absorbs, and if that
class is not yet a row here, the row is added. A new row with nothing in "absorbed by" is
a DEBT row first, because by the reading order above it is a failure the lab can name and
reproduce but has not yet built the mechanism for.

A row is edited in `packages/regulator/registry/pathologies.json`, never in this page:
name the regulators that absorb it by their record id, the invariants by theirs, the
course modules that build them, and anything else as a note, then run
`pnpm --filter @metacoding.io/regulator registry:docs`. `regulator check` warns on an
active record that no row names, which is the prompt to add one.
