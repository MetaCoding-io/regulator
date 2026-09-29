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

| Pathology (after Pérez Ríos) | In an instance it looks like | Absorbed by | Reproduced by (course module) | Not absorbed |
| --- | --- | --- | --- | --- |
| **No S3\***: audit has collapsed into operations, so the executor certifies its own work | Units close on their own reports. `regulator unit evidence` shows no host records, or only records older than the revision | `closeout-gate`, `evidence-preflight` and `result-report-gate` (M09), and INV-003 | the drift suite's control arm, where `run_tests` is the only check and the report is believed for everything else | — |
| **S3\* that reads what S1 wrote**: the auditor runs the suite the unit edited | `run_tests` passes on a branch that deleted the failing tests, and the defect is closed as fixed | `inherited-tests-check` (M09, added after M15): the suite at the branch point judges the unit's tree, and a shrunk inherited file fails | the self-certifier behaviour; the `no-inherited-tests` arm shows it closing green | an expectation rewritten to the current output inside an exempt file (`inherited-tests-check` limitation 1) |
| **S5 collapsed into S3**: identity is whatever the last operator or unit wrote | A unit edits `regulator/identity/`, or a README rule becomes policy nobody decided | `identity-write-gate`, `identity-untouched-check`, `s5-decision` and `proposal-intake` (M10, M12), and INV-001 and INV-002 | the drifter, which edits the glossary and is refused, and the sloppy unit, which writes rules into the README (DEBT row 34 is paid by `glossary-lint`; the README rule itself is still only measured, by `memoryRules`) | a rule written in prose outside the writable prefixes shows up as a grader's number; no check refuses it |
| **No S4**: nothing watches the environment, so the system learns of change by failing | A dependency advisory, a platform change or a new statement is found by a unit mid-work, or never | `intelligence-intake` and the `research` unit type (M11); in the finance workload, nothing yet | `contracts/research-vendored-helper.json` | S4 triggers that would raise a research unit unasked (archived CONTROL-REGISTRY.md §7); in the finance example a statement's arrival is handled by hand |
| **Missing recursion**: the harness is regulated only as a tool, never as a viable system of its own | Nobody owns a regulator, review dates pass, and the definition drifts from the instances | `regulator-lifecycle` (a passed review date fails CI), `doctor` and `instance-manifest` (M14, M15), and OPERATING.md's ownership section | `regulator check --today 2027-01-01`, which makes every card overdue | the definition's own S4 (the Pi upgrade path) is a checklist a person runs |
| **S2 absorbed by S3**: every coordination is an orchestrator decision | Units serialize behind the loop, and a conflict becomes a replan instead of a signal | `unit-lease`, `reintegration` and `thrash-detector` (M05). Leases and worktrees coordinate without S3, and a conflict is a coordination signal | `fixture-oscillation` | semantic commitments between units (issue #14) |

## 2. Functional pathologies — a function exists but does its neighbour's job, or none

| Pathology | In an instance it looks like | Absorbed by | Reproduced by (course module) | Not absorbed |
| --- | --- | --- | --- | --- |
| **S3 overload / micromanagement**: every local decision becomes S3's | Attention is spent on questions the contract should have delegated, and `regulator obligations` fills with clarifications | `work-contract-gate` (fixed / delegated / unresolved, M06), and the attention budget in `interaction-contract` (M13) | `contracts/underscore-unresolved.json`, an unresolved decision the unit must surface rather than settle | the metrics that would show it (undelegated decisions discovered, replans attributable to the contract) are DEBT row 40 |
| **S3/S4 disconnection**: intelligence never reaches operations | A research unit's finding sits in the log, and the next unit repeats the mistake | `intelligence-intake` → an obligation that holds the units it names until it is dispositioned, and `progression-veto` (M11) | `research-vendored-helper` followed by a unit it names | an advisory nobody ever dispositions holds its units forever (a wait ceiling is DEBT row 30's sibling) |
| **S4 acting as S3**: intelligence replans on its own | A finding rewrites a contract or a policy | `report_intelligence` records the finding and returns, and only S3 dispositions it (M11); a proposal never mutates policy (M10) | every proposal path test | — |
| **Weak S5 / no algedonic path**: nothing can interrupt the loop | A unit spends its ceiling on a question a person could have answered in a minute, or it asks about everything | `interaction-contract`, `pause-gate`, `algedonic-delivery` and `disposition-authority` (M13). Consent waits, recap does not, and silence is never consent | the headless consent case in `algedonic.test.ts`, and the finance example's `f5-prepare-payment` | whether an action needs consent is the model's to notice (DEBT row 29) |
| **Oscillation**: S1 units undo each other, and S2 does not see it | The same file flips between two states across attempts or units | `thrash-detector` → coordination signal → `recovery-router` clarify (M05, M08) | `fixture-oscillation` | oscillation across *units* rather than within one (a coordination-oscillation signal is part of #14) |
| **Recovery as retry**: every failure gets the same response | Six identical attempts at an environment failure | `failure-observer` and `recovery-router` under a versioned policy (M08) | the recovery cases in `controller.test.ts`, and the drifter's `repair → repair → replan` | — |
| **Budget without a limit behaviour**: the ceiling is reached and nothing happens | A unit runs until the provider cuts it off | `budget-guard` and `model-router` (M07) | `budget.test.ts` | a reserve for verification and recovery at the instance level is not declared (the viability-theory framing; unscheduled) |

## 3. Information and channel pathologies — the channel exists but carries the wrong variety

| Pathology | In an instance it looks like | Absorbed by | Reproduced by (course module) | Not absorbed |
| --- | --- | --- | --- | --- |
| **Channel without transduction**: a signal is not an audit, and an audit is not a policy | A finding is filed as a proposal, or an uncertainty is treated as a decision | typed channels with authority per kind (the `reporting` tools, `obligation-router`, and the routing floors) (M02, M10, M11) | the smuggled-authority tests in `packages/regulator-pi` | — |
| **Compaction discards the constraint** | After context eviction the unit forgets a fixed decision | `contract-preserving-compaction` (M07) | the compaction case in `budget.test.ts` | a model summary can still be wrong, and only the deterministic block is guaranteed (a permanent limit) |
| **Summary discards the uncertainty** | The report says "done", and the residual uncertainty never reaches the next decision | `result-report-gate`, in which residual uncertainty, deviations and emergent decisions are typed fields, and `uncertainty` signals routed by their declared impact (M06, M11) | `contract.test.ts` | observation versus inference is not a typed distinction on evidence, and retraction dependencies are not tracked |
| **Data absorbed as control**: the environment instructs the regulator | A comment in the repository redirects a unit, or a tool result carries an instruction | `project-trust-rule` (nothing from the project is loaded), `canary-watch` and `identity-write-gate` (M10) | `fixture-injection` | poisoned operational memory driving a later unit is untested. Memory is rendered as facts and never as instructions, and that rendering is the whole defence |
| **Vocabulary drift**: the same word means two things across the log | Comments say task and the log says ticket, so a reader cannot tell a unit from an obligation | `identity-context` (the glossary rendered into context) and `glossary-lint` (M12, M15) | the sloppy behaviour | the attenuation of the commit-message half (DEBT row 36) |
| **Feedback delay**: the signal that a unit went wrong arrives after five more units | Drift accumulates before anything refuses | `post-merge-check` runs on the base after every merge (M15), and the drift suite measures the accumulation (M14) | the drift scenario under the control arm | a pre-merge trial (DEBT row 37) |

## 4. Agent-specific rows (after MAST)

| MAST category | This project's name for it | Absorbed by | Reproduced by |
| --- | --- | --- | --- |
| Disobey task specification | a fixed decision overridden | `work-contract-gate`, `behaviour-check` (`export-signature`), and `result-report-gate` deviations | the drifter (a two-argument `slugify` against a fixed one-argument signature) |
| Disobey role specification | a profile's grant exceeded | `profile-write-grant`, `vendor-write-gate` and `identity-write-gate` | the drifter's vendor edit, and `profiles.test.ts` |
| Loss of conversation history | a constraint lost to compaction | `contract-preserving-compaction` | `budget.test.ts` |
| Unaware of termination conditions | a unit that never reports, or reports twice | `result-report-gate` (one report per attempt), `budget-guard`, and the `no-report` recovery cause | `controller.test.ts` |
| Fail to ask for clarification | an unresolved decision settled silently | `work-contract-gate` (an unresolved decision must be surfaced), and `result-report-gate` | `underscore-unresolved` |
| Task derailment | a unit outside its contract's scope | `result-report-gate` deviations of kind `scope`, and the closeout's writable prefixes | the drifter's root-level config |
| Information withholding | a finding not reported | `report_intelligence` and the result report's `residualUncertainty` are typed and recorded, but nothing forces their use | not reproduced: a unit that finds and does not tell has no fixture |
| Ignored other agent's input | intelligence not consumed | the `intelligence-intake` obligation and its veto | `research-vendored-helper` |
| Reasoning-action mismatch | the report claims what the tree does not show | `closeout-gate` and `inherited-tests-check`, under which the report's claims satisfy nothing | the self-certifier |
| Premature termination | closed before verification | `closeout-gate` runs before reintegration, and `pre-merge-trial` runs before the merge lands | every closeout test |
| No or incomplete verification | tests not run, or run by the unit only | `closeout-gate` (host-run), and `inherited-tests-check` (the host-owned suite) | the control arm, and the self-certifier |
| Incorrect verification | the wrong thing verified | evidence bound to the criterion, and `export-signature` observed by content (M09, M14) | `verify.test.ts` |

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
