# Production plan

Status: **design under review; Phase 1 content complete.** Lessons 01–04 are written
end to end with checkpoints 0–3, headless graders, and the seed of the fixture
repository — the vertical slices the sequencing below calls for. This file exists so course production
can continue against a fixed target and so the dependencies on VSM-Pi's own milestones
stay visible.

## Sequencing

Production is itself decomposed into thin vertical slices — each phase ends with
something a real learner could run, not with a layer that is complete but unusable.

### Phase 1 — Pilot spine (Parts 0–1, modules 01–04)

Proves the *format* before scaling content.

- fixture target repository (messy-by-design app, with its defects catalogued) —
  **seeded** (`course/lab/fixture/`);
- checkpoints 0–3 and graders — **done**, under `pnpm check`;
- written modules 01–04 and their failure drills — **done**;
- one live pilot with 4–6 engineers, instrumented for confusion points.

Exit criterion: pilot participants finish checkpoint 3 and can state, unprompted, why a
capability profile differs from a persona.

### Phase 2 — Control and audit (Parts 2–4, modules 05–10)

The heart of the course and the hardest labs.

- oscillation fixture; lease/liveness lab; contract + result report protocol;
- budget guard and compaction lab; recovery router;
- audit layer and the adversarial protected-path drill (six routes), the injection
  fixture, and the secret-canary / egress fixture;
- durable-execution fixture for M08: a side-effecting tool, a harness kill between
  effect and record, restart and reconciliation;
- OWASP ASI01–ASI10 / ACS crosswalk table for M10 and the rubric;
- `BOUNDARY.md` discipline established.

Exit criterion: the adversarial graders pass against the reference solution *and* catch
three deliberately weak learner-style implementations.

### Phase 3 — Intelligence, identity, escalation (Part 5, modules 11–13)

- subagent driver with its own budget; typed intelligence record;
- identity set and the dual prose/code invariant;
- escalation with interaction-kind timeout semantics, including headless behaviour.

Exit criterion: headless run with a pending consent-class escalation terminates safely
and records the reason.

### Phase 4 — Proof and shipping (Part 6, modules 14–15, capstone)

- drift fixture and the control/treatment eval harness, with per-regulator ablation
  arms, confidence intervals, environment fingerprints, and outcome *and* trajectory
  graders;
- OpenTelemetry GenAI span mapping for the event store, with redaction rules;
- the control room: topology, live, assurance, lifecycle and replay views over
  registry ∪ events ∪ eval results, read-only;
- MCP / A2A / ACS portability appendix for M15, and the M03 MCP-export appendix;
- **adversarial grader fixtures**: a library of deliberately weak implementations per
  checkpoint that the graders must reject;
- packaging lab and the clean-second-repo portability drill;
- capstone rubric calibration against at least three real submissions.

Exit criterion: an eval report from the reference build that is honest about at least one
fixture where the gated arm loses.

## Review findings incorporated (2026-09-22)

An external design review of PR #17 produced six pre-merge findings and eight
additions. Disposition:

| Finding | Disposition |
| --- | --- |
| `research` profile granted `run_tests` and called itself read-only | **Fixed.** Effect declarations (`effects.ts`); `isReadOnlyProfile()` with a test; `run_tests` removed from research. Lessons 03–04 teach the correction. |
| Checkpoint 1 claimed schema validation; records were only typed | **Fixed.** `TurnRecordSchema` (TypeBox) validated in `TraceWriter.append`; test that malformed records are refused. |
| Curriculum promised profile fields the checkpoint did not bind | **Fixed.** Claim narrowed to what ships; model (M07) and context/skills (M12) named as the lessons that add them. |
| Implement profile described as "cannot touch anything else" while granting `bash` | **Fixed.** Description and system-prompt section now say so. |
| Graders in ASSESSMENT.md more ambitious than the tests | **Labelled.** Current tests are reference-build tests; adversarial graders are production work (below). |
| 40 h estimate optimistic | **Labelled** a hypothesis; the pilot measures median/p90. |

Additions accepted into the curriculum text: effect contracts (M03); durable execution
and idempotency (M08); the expanded threat model with an OWASP ASI01–ASI10 / Agent
Control Standard crosswalk (M10); a multi-agent decision rule and optional A2A mapping
(M11); eval methodology, OpenTelemetry GenAI span mapping, and regulator ablation and
retirement (M14); an MCP / A2A / ACS portability appendix (M15). The registry and
control room ([CONTROL-REGISTRY.md](CONTROL-REGISTRY.md)) are the review's structural
proposal, adopted: the registry is implemented and seeded; the control room is design.

Two things the review proposed that were *not* adopted as stated: a YAML registry (JSON
was chosen to avoid a parser dependency and keep the schema closed; the choice is
revisitable), and an immediate `regulator` binary (the CLI exists as `registry-cli.js`;
packaging it is lesson 15's concern).

## Dependencies on VSM-Pi

The course quotes this repository as its worked typed-control reference. Where the
repository is still design-only, the course must present it as design, not as shipped.

| Course element | Depends on | Current repo state |
| --- | --- | --- |
| M06 contracts | `docs/OPERATIONAL-WORK-CONTRACT.md`, `docs/PLANNER-CONTRACT-COMPOSITION.md` | designed, implementation pending |
| M08 recovery/obligations | `docs/REGULATORY-STATE-AND-ROUTING.md` | designed, implementation pending |
| M04 capability profiles | `docs/GSD-VSM-FUNCTIONAL-MAP.md` | designed, implementation pending |
| M09 audit findings | typed reporting tools (M0.3), `docs/REPORTING.md` | shipped |
| M10 protected paths | `packages/pi-extension` write gate + boundary README | shipped |
| M12 identity | `vsm/IDENTITY.md`, `vsm/INVARIANTS.md`, `vsm/channels.yaml` | shipped |
| M14 drift | longitudinal drift fixture | planned (M0) |
| M02+ registry | `course/lab/src/registry.ts`, seed records | shipped (course lab) |
| M14/M15 control room | [CONTROL-REGISTRY.md](CONTROL-REGISTRY.md) §6 | design only |

Two-way benefit worth stating plainly: the course is also a forcing function for this
repository. Teaching a mechanism exposes whether it is actually explicable, and every
place the course has to say "this part is still prose" is a prioritisation signal for
VSM-Pi's own roadmap.

## Version pinning

Pi and GSD-Pi both move quickly. The course pins exact versions per cohort and treats
upgrades as a maintenance unit with its own evidence:

- pin the Pi version in the starter repo's lockfile, as this repository pins
  `@earendil-works/pi-coding-agent`;
- pin the GSD-Pi commit referenced by every field study;
- the graders are the upgrade test — if they pass on a new Pi version, the content
  reference check is the only manual step left, and
  [FEATURE-MATRIX.md](FEATURE-MATRIX.md) is the checklist for that step: walk the rows,
  add one for any new documentation page before it is mentioned in a module.

Content that names an exact API (`pi.setActiveTools`, `session_before_compact`) must be
linked to the upstream doc section so drift is detectable by link-checking rather than by
a learner hitting it mid-lab.

## Risks

| Risk | Mitigation |
| --- | --- |
| **Cybernetics reads as decoration.** Learners hear "Beer" and expect vocabulary, not engineering. | Every concept is introduced by a failure they just watched happen. No module opens with theory. |
| **Upstream API drift breaks labs.** | Version pinning + graders as upgrade tests + doc-section links. |
| **Model cost per learner.** | Failure drills use small/cheap models where the failure is structural; transcript library covers budget-constrained learners; evals cap repetitions. |
| **Reference build scope creep into a GSD clone.** | Explicit non-goals in `REFERENCE-BUILD.md`; the honest answer to "I want more" is to read GSD-Pi. |
| **Learners over-regulate and stop shipping.** | M14 arms make over-regulation measurable; instructor notes call it out as a graded failure mode. |
| **Course claims outrun the repo.** | Dependency table above; design-stage material is labelled as design in the content itself. |
| **Provider access variance.** | Provider-agnostic labs; `StringEnum` and compatibility notes taught in M03; at least two providers validated per checkpoint. |

## Open decisions

1. ~~**Does `regulator` live in this repository or a separate course repo?**~~
   **Resolved:** it lives here, at `course/lab/`, as a workspace package with one file
   per checkpoint. The maintainer chose to keep all course work on one branch; the
   per-file checkpoint layout gives learners the diff-between-checkpoints property a
   tagged starter repo would have, without a second repository to keep in sync.
2. **Cohort size and instructor ratio.** The crit format (12 minutes adversarial per
   participant) caps a cohort at roughly 12 with one instructor.
3. **Is GSD-Pi a prerequisite or purely a field study?** Current assumption: field study
   only. Learners are never required to install GSD to finish a lab.
4. **Certification weight.** Whether the capstone crit is required for the base
   certificate or only for distinction.
5. **Open-sourcing the graders.** They are adversarial harness tests and would be useful
   on their own; publishing them also publishes the labs' answers.

## Deferred until production

Two artifacts were identified in design review and deliberately not written yet,
because both depend on pinned upstream commits that do not exist until the starter repo
does:

- **Field-study reading guide** — per module, the exact files in `open-gsd/gsd-pi` and
  this repository that the field study reads, pinned to a commit. Without it the field
  studies rot on the first upstream refactor.
- **Portability appendix** — how `regulator`'s concepts map onto other harnesses'
  hook systems, for learners whose team runs something other than Pi. Widens the
  audience without changing the substrate.

## Immediate next actions

1. Review lessons 01–04 for tone, length and lab friction (owner: project maintainer).
2. Extend the fixture with the flaky test, the ambiguous requirement and the migration
   that must not be re-run — lesson 05's oscillation fixture is the next one needed.
3. Lessons 05–06 with checkpoints 4–5 (leases and reintegration; work contracts), same
   vertical-slice discipline. Checkpoint 4 needs a second fixture worktree; plan it.
4. Run the Phase 1 pilot and record where learners got confused, as course-level
   residual uncertainty.
