# Enforcement boundary

Generated from `registry/regulators/*.json` by `regulator docs`. Do not edit by hand.

A gate protects the calls that reach it. This statement lists, for every mechanical regulator, where it is
enforced and what it does not cover — the routes around it. A route that is not named here is not known
to be covered. Nothing below is a sandbox: real isolation comes from the operating system or a container.

## Budget guard (`reg.control.budget-guard.v1`)

Enforced at `turn_end (ctx.abort)`, `tool_call`, `runUnit (close: budget-exhausted attempt)` in `src/cp6-budget.ts`; S3, deterministic-gate.

Not covered:

- Ceilings are checked at turn end and tool call, so the turn that crosses one completes; a single very large response is not cut off mid-stream.
- Tokens and cost are what the provider reports on each assistant message; a provider that reports nothing meters as zero.
- The wall-clock ceiling is measured from session start, not from dispatch; time spent loading extensions or waiting on a rate limit counts against the unit.
- Attempts are the orchestrator's ceiling (runUnit), not the session's; a unit re-dispatched by hand outside runUnit is not counted.

## Canary watch (`reg.audit.canary-watch.v1`)

Enforced at `tool_result (redact)`, `message_end (record)` in `src/cp9-authority.ts`; S3*, deterministic-gate.

Not covered:

- It watches for known values only: a real secret the harness was not told about is not a canary. This measures whether the exposure path exists, not whether every secret is safe.
- A canary that reaches the model in a form the scan does not match (split across blocks, base64, described rather than quoted) is not redacted.
- By the time message_end records a leak the text has left the process: the finding is evidence of exposure, not prevention. Network egress is not watched at all; the lesson names it as the boundary a container provides.

## Closeout gate (`reg.audit.closeout-gate.v1`)

Enforced at `auditUnit (after the report check, before reintegration)`, `closeUnit (re-audit without an attempt)` in `src/controller.ts`; S3*, deterministic-gate.

Not covered:

- Evidence binds to criteria by class, not by content: a passing suite that does not exercise the changed behaviour satisfies a test-class criterion. Criterion-specific checks are a workload's to declare; the software workload declares only run_tests and run_checks.
- The environment recorded is the orchestrator's host; a check that passes here and fails on the target platform is not caught.
- Runtime-class criteria are treated like semantic ones (human acceptance) because no host mechanism observes runtime behaviour yet.
- The audit log is one NDJSON file per instance beside the signal sink; it is not yet merged with the SQLite regulatory event store the reporting tools write.

## Effect journal (`reg.coordination.effect-journal.v1`)

Enforced at `notify_owner (execute: begin/commit)`, `session_start (reconcile)` in `src/cp7-recovery.ts`; S2, deterministic-gate.

Not covered:

- Reconciliation needs an observable world: notify_owner's outbox is keyed so it can be read back. An effect with no observable trace can only be recorded as absent, which is a guess.
- The idempotency key is the unit, the tool and the arguments; the same message sent on purpose twice is refused. Vary the message.
- Only notify_owner is journaled. bash is not: a shell command's side effects are unknown by declaration (lesson 03), and nothing here can journal what it cannot name.
- The journal is per base checkout, on one machine; two harnesses on two machines cannot see each other's intentions.

## Evidence preflight (`reg.control.evidence-preflight.v1`)

Enforced at `tool_result (run_tests, run_checks: provenance)`, `tool_call (report_result: block)` in `src/cp8-evidence.ts`; S3, deterministic-gate.

Not covered:

- It trusts the session's own tool run: the session ran run_tests, and the session is what is being checked. Independence comes from the closeout gate, which reads nothing this extension records.
- Only test and command claims are preflighted; file, runtime, semantic and model claims pass through to the closeout gate.
- A run_tests call with a filter that passes counts as a passing run: the preflight sees the verdict, not the coverage.

## Failure observer (`reg.control.failure-observer.v1`)

Enforced at `tool_execution_end (isError)`, `agent_end (stopReason error)` in `src/cp7-recovery.ts`; S3, deterministic-gate.

Not covered:

- Normalization is a regular expression over the error text (flattened to one line, first 300 characters); an environment problem phrased unusually is recorded as a plain tool error. Only a refused report_result is typed without the regex, as invalid-report.
- Only errors the tool layer reports as errors are observed: a test that fails is not an error, and a bash command that exits non-zero without the tool flagging it is invisible.
- The observer records; it never rewrites the result the model sees (tool_result), so the model and the router may disagree about what happened.

## Identity write gate (`reg.authority.identity-write-gate.v1`)

Enforced at `tool_call (write, edit: prepareWritePath)`, `tool_call (bash: snapshot)`, `tool_result (bash: restore and report)` in `src/cp9-authority.ts`; S5, deterministic-gate.

Not covered:

- A tool-call hook protects calls routed through the hook. It does not sandbox the process: a shell command that commits a protected change, pushes it, or edits a copy of the repository elsewhere is outside it. The bash watch restores the working tree only; a commit made by the same command keeps the change in history, and reintegration would carry it.
- The snapshot-and-restore is not atomic: a command that reads a protected file it has just modified sees the modification before the restore.
- The alias walk is a preflight against a stable filesystem; a link created between the check and the write (TOCTOU) is not seen. Real isolation is the operating system's or a container's.
- Protected paths are the identity directory, the S5 artifacts and what the project's conventions declare (vendor/); a path the project protects by convention nobody declared is not protected.

## Model router (`reg.control.model-router.v1`)

Enforced at `piDispatcher (model choice, failover)`, `model_select (ledger)` in `src/dispatch-pi.ts`; S3, deterministic-gate.

Not covered:

- Failover starts a fresh session: the fallback model does not see what the primary did, only the contract, and the ledger of the first session records the wasted attempt cost.
- Availability means an API key is configured, not that the provider is up; a provider that fails on the first call still costs one session.
- The dispatcher itself is exercised only with a live model (the lesson's drill); the route resolution it relies on is what the tests cover.

## Profile write grant (`reg.control.profile-write-grant.v1`)

Enforced at `session_start`, `tool_call` in `src/cp3-profiles.ts`; S3, deterministic-gate.

Not covered:

- Positive grant covers write and edit only; the implement profile grants bash, which is not path-gated.
- Read-only means declared read-only effects (effects.ts); a tool with an undeclared effect is refused from read-only profiles, not audited.
- Lexical path check only, as for the vendor write gate.

## Project trust rule (`reg.authority.project-trust-rule.v1`)

Enforced at `definitionResourceLoader (extensionsOverride, no project skills/prompts/themes)`, `project_trust (cp9-authority.ts, CLI sessions)` in `src/dispatch-pi.ts`; S5, deterministic-gate.

Not covered:

- Trust is an input-loading guard. It keeps a project's own extensions, skills, prompt templates and themes out of the harness; it does nothing about instructions in the project's files, comments, test output or documentation — those are the injection drill, and the answer to them is that authority lives in gates the content cannot reach.
- Context files (AGENTS.md, CLAUDE.md) and project settings are still read: Pi 0.87.0 loads context files regardless of trust, and the dispatcher does not yet substitute an in-memory settings manager, so a project's .pi/settings.json can still shape the session (compaction thresholds, for example).
- The filter is by resolved path against the definition's list; an operator's user/global extensions are refused too, which is the intended reading of 'declared, not assembled' but surprises anyone who expected their own extensions to ride along.
- The project_trust answer covers the CLI path (`pnpm cp9`); a learner who launches pi by hand with trust remembered as yes has trusted the project themselves.

## Proposal intake (`reg.authority.proposal-intake.v1`)

Enforced at `propose_policy_change (tool execute)` in `src/cp9-authority.ts`; S5, typed-tool.

Not covered:

- Proposals land in the signal sink with every other unrouted message; nothing routes them to a person yet (lesson 11's obligations), so a proposal nobody reads is a proposal nobody decides.
- The proposal's source is S1 by construction; a proposal from S3 or S4 (a router that wants a policy change) has no tool yet.
- Evidence on a proposal is empty: the tool does not let the model attach evidence refs, because a claim about evidence is not evidence.

## Recovery router (`reg.control.recovery-router.v1`)

Enforced at `routeUnit (after a blocked outcome)`, `driveUnit (the autoloop)` in `src/controller.ts`; S3, deterministic-gate.

Not covered:

- Classification is a fixed precedence over recorded facts; a failure with two causes is routed by the first the precedence finds. A check-failure whose root cause is environmental is routed as check-failure, because the orchestrator's record wins over the session's observation.
- Remediate, replan, clarify and pause are recorded and the unit waits; nothing in the loop performs them, and nothing yet reminds anyone that they are waiting (lesson 11's obligations).
- Occurrences are counted per cause per unit; a unit that alternates between two causes never reaches the third action of either rule and is stopped by the attempt ceiling instead.
- Escalation is an algedonic signal in the signal sink; until obligations exist it is exposed by the read model, not delivered.

## Reintegration guard (`reg.coordination.reintegration.v1`)

Enforced at `regulator unit finish` in `src/worktree.ts`; S2, deterministic-gate.

Not covered:

- Detects file-level conflicts only; two units can change disjoint files and still break each other (the S2 gap analysis's semantic-conflict case).
- Merge commits only; no rebase, squash or fast-forward policy.
- Nothing runs the checks after the merge yet; lesson 09 adds evidence at closeout.

## Result report gate (`reg.control.result-report-gate.v1`)

Enforced at `report_result (tool execute)`, `runUnit (close)` in `src/cp5-contract.ts`; S3, deterministic-gate.

Not covered:

- Evidence is checked by class, not by content: a report can cite a test run it did not make. Host-run verification (lesson 09) is what makes evidence independent of the report.
- A unit can describe an unresolved decision as 'preserved' while its diff settles it; the gate reads the report, never the diff, by design — catching that is audit's job.
- Emergent decisions below high consequence are recorded in the report only; nothing routes them yet.

## Thrash detector (`reg.coordination.thrash-detector.v1`)

Enforced at `tool_execution_end` in `src/cp4-coordination.ts`; S2, deterministic-gate.

Not covered:

- Counts write and edit tool calls only; edits made through bash are invisible to it.
- Memory is per session: a unit resumed in a new session starts counting from zero.
- The threshold is a constant, not a policy; lesson 07 makes it a budget.

## Unit lease gate (`reg.coordination.unit-lease.v1`)

Enforced at `session_start`, `tool_call`, `turn_end` in `src/cp4-coordination.ts`; S2, deterministic-gate.

Not covered:

- Liveness is expiry-only: a live process that stops heartbeating and a dead one look the same until the TTL passes; there is no fencing token yet.
- The lease covers the working directory by path; a tool that writes elsewhere by absolute path is outside the lease — checkpoint 9's write gate refuses absolute paths, but bash is not path-gated.
- Leases are files on one machine; nothing coordinates across hosts.

## Vendor write gate (`reg.authority.vendor-write-gate.v1`)

Enforced at `tool_call` in `src/cp1-trace.ts`; S5, deterministic-gate.

Not covered:

- Lexical path check only: no symlink, hard-link or TOCTOU protection. Checkpoint 9's identity write gate (lesson 10) supersedes it with the filesystem walk when both are loaded; this gate stays as the lesson 02 baseline.
- Covers the write and edit tools; bash and custom tools bypass it. Checkpoint 9 adds the bash snapshot-and-restore for protected paths.

## Work contract gate (`reg.control.work-contract-gate.v1`)

Enforced at `runUnit (before createUnit)`, `session_start (cp5-contract)` in `src/controller.ts`; S3, deterministic-gate.

Not covered:

- Checks the contract's shape and internal consistency only; it cannot tell whether the objective genuinely requires settling an unresolved decision — that shows up afterwards as an emergent decision in the report.
- Authority references on fixed decisions are strings; nothing verifies that the cited invariant or decision exists (lesson 12).
- The contract is loaded from a file path the session was given; the lease gate, not this gate, is what keeps another session from running under it.

## Advice and judgment

These regulators do not enforce; they inform. A rule that only they carry is not enforced.

- Contract advice section (`reg.control.contract-advice.v1`, prompt): Prompt text: the model may ignore it, and a long transcript may push it out of attention. Everything it says that matters is also a gate.
- Contract-preserving compaction (`reg.control.contract-preserving-compaction.v1`, model-judgment): The conversation summary is model judgement: it can be wrong, and nothing checks it. Only the deterministic block is guaranteed.
