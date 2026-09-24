# Pathologies — how the whole arrangement fails, and what absorbs it

The registry says what each regulator does and the failure class it absorbs
(`absorbs.failureClass` on every record; `regulator docs` renders them). The glossary's
[diagnostic table](GLOSSARY.md#5-diagnostic-table--from-observed-failure-to-mechanism)
goes from one observed failure to one mechanism. This page is the third view: the
*characteristic* ways a viable system fails as a whole — a function missing, absorbed by
its neighbour, disconnected from the one it must talk to, or a channel that carries the
wrong variety — and for each, what it looks like in an instance, which regulator absorbs
it, which fixture reproduces it, and what nothing absorbs yet.

The taxonomy follows Pérez Ríos's diagnosis of viable systems (structural, functional and
information-channel pathologies; his 2025 paper applies it to AI systems) and, for the
agent-specific rows, the MAST failure taxonomy of multi-agent LLM systems (specification
and design, inter-agent misalignment, verification and termination). Neither is
reproduced here; the rows are this project's translation, and a row with an empty
"reproduced by" column is a pathology the lab has not yet built a fixture for.

Read the columns in order. A pathology you cannot name is a pile of symptoms; one you can
name but cannot reproduce is a diagnosis without a test; one you can reproduce but nothing
absorbs is a row for `docs/DEBT.md`.

## 1. Structural pathologies — a function is missing or misplaced

| Pathology (after Pérez Ríos) | In an instance it looks like | Absorbed by | Reproduced by | Not absorbed |
| --- | --- | --- | --- | --- |
| **No S3\*** — audit collapsed into operations; the executor certifies its own work | Units close on their reports; `regulator unit evidence` shows no host records, or records older than the revision | `closeout-gate`, `evidence-preflight`, `result-report-gate` (M09); INV-003 | the drift suite's **control arm** (`run_tests` is the only check; the report is believed for the rest) | — |
| **S3\* that reads what S1 wrote** — the auditor runs the suite the unit edited | `run_tests` passes on a branch that deleted the failing tests; the defect is closed as fixed | `inherited-tests-check` (M09, added after M15): the suite at the branch point judges the unit's tree, and a shrunk inherited file fails | the **self-certifier** behaviour; the `no-inherited-tests` arm shows it closing green | an expectation rewritten to the current output inside an exempt file (`inherited-tests-check` limitation 1) |
| **S5 collapsed into S3** — identity is whatever the last operator or unit wrote | A unit edits `regulator/identity/`, or a README rule becomes policy nobody decided | `identity-write-gate`, `identity-untouched-check`, `s5-decision`, `proposal-intake` (M10, M12); INV-001, INV-002 | the **drifter** (edits the glossary; refused) and the **sloppy** unit (writes rules into the README; DEBT row 34 paid by `glossary-lint`, the README rule itself still measured only: `memoryRules`) | a rule in prose outside the writable prefixes is a grader's number, not a check's refusal |
| **No S4** — nothing watches the environment; the system learns of change by failing | A dependency advisory, a platform change or a new statement is found by a unit mid-work, or never | `intelligence-intake` and the `research` unit type (M11); in the finance workload, none yet | `contracts/research-vendored-helper.json` | S4 triggers that raise a research unit unasked (archived CONTROL-REGISTRY.md §7; the finance example's statement arrival is by hand) |
| **Missing recursion** — the harness is regulated as a tool, not as a viable system of its own | Nobody owns a regulator; review dates pass; the definition drifts from the instances | `regulator-lifecycle` (review dates fail CI), `doctor`, `instance-manifest` (M14, M15); OPERATING.md's ownership section | `regulator check --today 2027-01-01` (every card overdue) | the definition's own S4 (the Pi upgrade path) is a checklist a person runs |
| **S2 absorbed by S3** — every coordination is an orchestrator decision | Units serialize behind the loop; a conflict is a replan instead of a signal | `unit-lease`, `reintegration`, `thrash-detector` (M05): leases and worktrees coordinate without S3; a conflict is a coordination signal | `fixture-oscillation` | semantic commitments between units (issue #14) |

## 2. Functional pathologies — a function exists but does its neighbour's job, or none

| Pathology | In an instance it looks like | Absorbed by | Reproduced by | Not absorbed |
| --- | --- | --- | --- | --- |
| **S3 overload / micromanagement** — every local decision becomes S3's | Attention spent on questions the contract should have delegated; `regulator obligations` full of clarifications | `work-contract-gate` (fixed / delegated / unresolved, M06); the attention budget in `interaction-contract` (M13) | `contracts/underscore-unresolved.json` (an unresolved decision the unit must surface, not settle) | the metrics that would show it — undelegated decisions discovered, replans attributable to the contract — are DEBT row 40 |
| **S3–S4 disconnection** — intelligence never reaches operations | A research unit's finding sits in the log; the next unit repeats the mistake | `intelligence-intake` → obligation that holds the units it names until dispositioned; `progression-veto` (M11) | `research-vendored-helper` followed by a unit it names | an advisory nobody ever dispositions holds its units forever (a wait ceiling is DEBT row 30's sibling) |
| **S4 acting as S3** — intelligence replans on its own | A finding rewrites a contract or a policy | `report_intelligence` records and returns; only S3 dispositions (M11); a proposal never mutates policy (M10) | every proposal path test | — |
| **Weak S5 / no algedonic path** — nothing can interrupt the loop | A unit spends its ceiling on a question a person could have answered in a minute; or asks about everything | `interaction-contract`, `pause-gate`, `algedonic-delivery`, `disposition-authority` (M13): consent waits, recap does not, silence is never consent | `cp12-algedonic.test.ts` headless consent; the finance example's `f5-prepare-payment` | whether an action needs consent is the model's to notice (DEBT row 29) |
| **Oscillation** — S1 units undo each other; S2 does not see it | The same file flips between two states across attempts or units | `thrash-detector` → coordination signal → `recovery-router` clarify (M05, M08) | `fixture-oscillation` | oscillation across *units* rather than within one (a coordination-oscillation signal is part of #14) |
| **Recovery as retry** — every failure gets the same response | Six identical attempts at an environment failure | `failure-observer`, `recovery-router` under a versioned policy (M08) | `controller.test.ts` recovery cases; the drifter's `repair → repair → replan` | — |
| **Budget without a limit behaviour** — the ceiling is reached and nothing happens | A unit runs until the provider cuts it off | `budget-guard`, `model-router` (M07) | `cp6-budget.test.ts` | a reserve for verification and recovery at the instance level is not declared (viability-theory framing; unscheduled) |

## 3. Information and channel pathologies — the channel exists but carries the wrong variety

| Pathology | In an instance it looks like | Absorbed by | Reproduced by | Not absorbed |
| --- | --- | --- | --- | --- |
| **Channel without transduction** — a signal is not an audit, an audit is not a policy | A finding is filed as a proposal; an uncertainty is treated as a decision | typed channels with authority per kind (`reporting` tools, `obligation-router`, routing floors) (M02, M10, M11) | `packages/pi-extension` smuggled-authority tests | — |
| **Compaction discards the constraint** | After context eviction the unit forgets a fixed decision | `contract-preserving-compaction` (M07) | `cp6-budget.test.ts` compaction case | a model summary can still be wrong; only the deterministic block is guaranteed (permanent limit) |
| **Summary discards the uncertainty** | The report says "done"; the residual uncertainty never reaches the next decision | `result-report-gate`: residual uncertainty, deviations and emergent decisions are typed fields; `uncertainty` signals routed by declared impact (M06, M11) | `cp5-contract.test.ts` | observation versus inference is not a typed distinction on evidence; retraction dependencies are not tracked |
| **Data absorbed as control** — the environment instructs the regulator | A comment in the repository redirects a unit; a tool result carries an instruction | `project-trust-rule` (nothing from the project is loaded), `canary-watch`, `identity-write-gate` (M10) | `fixture-injection` | poisoned operational memory driving a later unit is untested; memory is rendered as facts, never instructions, and that is the whole defence |
| **Vocabulary drift** — the same word means two things across the log | Comments say task, the log says ticket; a reader cannot tell a unit from an obligation | `identity-context` (the glossary rendered), `glossary-lint` (M12, M15) | the **sloppy** behaviour | the attenuation of the commit-message half (DEBT row 36) |
| **Feedback delay** — the signal that a unit went wrong arrives after five more units | Drift accumulates before anything refuses | `post-merge-check` on the base after every merge (M15); the drift suite measures the accumulation (M14) | the drift scenario under the control arm | a pre-merge trial (DEBT row 37) |

## 4. Agent-specific rows (after MAST)

| MAST category | This project's name for it | Absorbed by | Reproduced by |
| --- | --- | --- | --- |
| Disobey task specification | a fixed decision overridden | `work-contract-gate`, `behaviour-check` (`export-signature`), `result-report-gate` deviations | the **drifter** (two-argument `slugify` against a fixed one-argument signature) |
| Disobey role specification | a profile's grant exceeded | `profile-write-grant`, `vendor-write-gate`, `identity-write-gate` | the drifter's vendor edit; `cp3-profiles.test.ts` |
| Loss of conversation history | a constraint lost to compaction | `contract-preserving-compaction` | `cp6-budget.test.ts` |
| Unaware of termination conditions | a unit that never reports, or reports twice | `result-report-gate` (one report per attempt), `budget-guard`, the `no-report` recovery cause | `controller.test.ts` |
| Fail to ask for clarification | an unresolved decision settled silently | `work-contract-gate` (unresolved must be surfaced), `result-report-gate` | `underscore-unresolved` |
| Task derailment | a unit outside its contract's scope | `result-report-gate` deviations of kind `scope`; the closeout's writable prefixes | the drifter's root-level config |
| Information withholding | a finding not reported | `report_intelligence` and `report_uncertainty` are typed and journaled; nothing forces their use | — (a unit that finds and does not tell is not reproduced) |
| Ignored other agent's input | intelligence not consumed | `intelligence-intake` obligation and veto | `research-vendored-helper` |
| Reasoning–action mismatch | the report claims what the tree does not show | `closeout-gate`, `inherited-tests-check`: the report's claims satisfy nothing | the **self-certifier** |
| Premature termination | closed before verification | `closeout-gate` runs before reintegration; `post-merge-check` after | every closeout test |
| No or incomplete verification | tests not run, or run by the unit only | `closeout-gate` (host-run), `inherited-tests-check` (host-owned suite) | the control arm; the self-certifier |
| Incorrect verification | the wrong thing verified | evidence bound to the criterion, `export-signature` by content (M09, M14) | `verify.test.ts` |

## 5. Using the catalog

- **In the course.** Each "Break it" section already reproduces two or three of these
  rows, and the drift suite's four scripted behaviours (reference, drifter, sloppy,
  self-certifier) are the rows with a committed report. A learner's harness is diagnosed
  by walking sections 1–3 and naming, for each row, the mechanism or the DEBT row.
- **In the capstone.** The viability case's boundary statement (`ASSESSMENT.md`,
  Artifact B item 4) is generated from the registry's limitations; this page is the
  list of pathologies a reviewer attacks from in the crit's adversarial twelve minutes.
- **In an instance.** The control room's lifecycle and assurance views show which rows
  have a regulator with fresh evidence; a row whose regulator's ablation arm shows no
  lift is a regulator to retire, not a pathology cured.
- **As the registry grows.** A new regulator names the failure class it absorbs; if that
  class is not a row here, add the row. A new row with nothing in "absorbed by" is a
  DEBT row first.
