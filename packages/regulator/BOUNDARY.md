# Enforcement boundary

Generated from `registry/regulators/*.json` by `regulator docs`. Do not edit by hand.

A gate protects the calls that reach it. This statement lists, for every mechanical regulator, where it is
enforced and what it does not cover — the routes around it. A route that is not named here is not known
to be covered. Nothing below is a sandbox: real isolation comes from the operating system or a container.

## Who writes the definition

Every definition file is proposable (INV-002: a proposal changes nothing). What differs is the path an accepted
proposal takes, declared once as `DEFINITION_WRITERS` in `@metacoding.io/regulator-protocol`: the write gate, the
bash watch and the closeout diff protect the instance paths below, `regulator check` refuses a definition directory
in no class, and a test holds every command named here against the CLI.

| Class | Paths | Proposed by | Lands through | Probed by | Refused to |
| --- | --- | --- | --- | --- | --- |
| identity | `identity/`, `regulator/identity/` | `propose_policy_change` | `identity accept`, then `identity promote` | an eval arm's `identity` switch toggles the whole set; no per-file probe | every tool; `advice accept` (closed file list) |
| advice | `advice/`, `regulator/advice/` | a typed `harness-edit` (`HarnessEditSchema`: diagnosis references, a diff by profile, the id of a signal with a `prediction` block; checked against the stores at `advice accept`) or a plain proposal | `advice accept`, then `advice promote` | the prediction's horizons: a probe horizon resolves from a committed report by fingerprint, a live horizon from the next N units after acceptance (#138); an eval arm's `advice` override is slice 3 (accept-path note §8, after #46) | every tool; `identity accept` (closed file list) |
| declaration | `profiles/`, `workload/`, `policies/`, `evals/`, `contracts/`, `registry/`, `drift/`, `fixture/`, `fixture-finance/`, `fixture-injection/`, `fixture-oscillation/`, `fixture-portfolio/` | a plain proposal, `requestedChange` as text | a merged change to the definition's repository; a unit of work against the definition's repository under a contract, with `regulator check` and the tests at closeout and a merge by a person, waits for the definition's repository to run under the loop (accept-path note §6); until then the path is a pull request a person writes | the definition's own CI | `identity accept` and `advice accept`, by construction |

A path not named here is not known to be covered: a definition directory in no class does not pass `regulator check`,
and an instance path outside the list is protected only if the project's conventions or its manifest declare it.

## Advice decision path (`reg.authority.advice-decision.v1`)

Enforced at `cli:advice accept` (proposal owed to S5, actAsS5, clean tree, declared profile's file named by the harness-edit payload (checked against the stores first) or by a plain proposal's subject, non-empty and under advice.maxChars; authorizeWrite s5-authority, git commit, ledger.resolve accepted citing the prediction when there is one), `cli:advice reject` (ledger.resolve rejected) in `src/cli.ts`; S5, deterministic-gate.

Not covered:

- Who may act as S5 is the interaction policy's `actAsS5` grant, checked before the write; the name on `--by` is asserted, not authenticated. A grant narrower than S5 for advice alone (`acceptAdvice`) is an interaction-policy decision not taken (accept-path note §9).
- The proposed content is a file the person supplies; nothing derives it from the proposal's requestedChange, and nothing diffs it against what was asked. The person decides that the file is the proposal.
- An advice file is text. Nothing checks that an accepted edit is advice rather than a rule in disguise; the `glossary-lint` analogue for advice does not exist. The person's reading and, once the reflector lands, the live horizon are the only pressure (docs/DEBT.md row 43).
- The probe rule — accept a `harness-edit` only after its probe horizon resolves — is not here. The prediction record and the typed payload landed (#138, prediction-resolution), so a `harness-edit` is checked against the stores and its live horizon opens at acceptance; refusing one that was never probed waits for the probe arm (accept-path note §8, slice 3, after #46).
- It changes the instance's advice, not the definition's seed: a decision accepted in one instance does not reach another. `advice promote` carries it to the seed; instances initialized earlier keep their own copy, and `regulator upgrade` (#53) seeds only a file an instance lacks, never one it has (docs/DEBT.md row 44).

## Algedonic delivery (`reg.algedonic.delivery.v1`)

Enforced at `loop:routeAndDeliver` (deliverPending: undelivered → outbox, journaled, ledger.deliver; remindDue: remindable → outbox, reminder), `cli:signals route` (deliverPending after routing), `cli:remind` (remindDue) in `src/deliver.ts`; S5, deterministic-gate.

Not covered:

- The outbox is a file; `regulator watch` forwards each new line to the channel command the deployment names, and nothing beyond that command reaches a person. Supervising the watcher and choosing the channel are the deployment's.
- Reminders run at the loop's steps, on `regulator remind`, and on each `regulator watch` tick; an instance with no watcher running reminds nobody until someone runs something.
- One outbox for the instance, not one per person: an obligation owed to 'a person' is delivered to whoever reads the outbox, and the interaction policy's people say who may answer, not who was told.

## Behavioral canary (`reg.audit.behavioral-canary.v1`)

Enforced at `host:before_agent_start` (render the rule), `host:message_end` (read the reply) in `../regulator-pi/src/identity.ts`; S3*, deterministic-gate.

Not covered:

- The marker is a proxy for attention, and the rule is advice. A model that keeps the marker and still hallucinates is not seen; a model that drops it for a harmless reason is. A reply with no text (tool calls only) is not counted either way. The finding is advisory for these reasons, and it is one signal among the host's, not a verdict.
- It reads a prefix: the marker after leading whitespace. A marker inside a code fence, after a heading, or paraphrased is a miss, and a model that puts it first and nothing else right is a hit.
- S3 does nothing with the finding yet. Under the shipped routing policy an advisory audit finding is noted as trace and opens no obligation, and no recovery cause names a degraded session, so the fresh session the signal argues for is a person's decision today (docs/DEBT.md row 42).
- Misses are counted per session, as the thrash detector's edits are: a unit resumed in a new session starts at zero, and the first reply of a session is judged like every other.

## Behaviour check (export-signature) (`reg.audit.behaviour-check.v1`)

Enforced at `loop:runHostChecks` (export-signature: the probe run at HEAD, one result per carrying expectation), `loop:auditUnit` (bindEvidence binds by criterion; technicalVerdict takes host evidence before acceptance for runtime criteria) in `../checks/src/verify.ts`; S3*, deterministic-gate.

Not covered:

- One kind of check exists: an export's declared parameter count. Return types, thrown errors and behaviour under input are not observed; `Function.length` stops at the first defaulted parameter, so a defaulted second argument passes as a one-argument signature.
- The probe imports the module: import-time side effects run in the host's process tree, at HEAD, once per closeout. A module that cannot be imported is inconclusive, never a pass.
- A criterion that carries no check is still bound by class, as before. Content binding is opt-in per expectation, and the drift contracts are the only ones that opt in so far.

## Budget guard (`reg.control.budget-guard.v1`)

Enforced at `host:session_start` (ledger written, or resumed on an attempt already metered), `host:turn_end` (ctx.abort), `host:tool_call`, `loop:runUnit` (close: budget-exhausted attempt) in `../regulator-pi/src/budget.ts`; S3, deterministic-gate.

Not covered:

- Ceilings are checked at turn end and tool call, so the turn that crosses one completes; a single very large response is not cut off mid-stream.
- Tokens and cost are what the provider reports on each assistant message; a provider that reports nothing meters as zero. Tokens sum every message's total, so a long context is paid again on every turn: the default 400,000-token ceiling is about thirty turns of a large context, which the live drift run's memory unit reached on both arms.
- The wall-clock ceiling is measured from the attempt's first session start, not from dispatch; time spent loading extensions or waiting on a rate limit counts against the unit.
- A halt reaches the orchestrator as an aborted session plus the ledger's exhausted marker, and the marker is what says it was a halt (the router reads it before failing over); a session opened on the attempt without the guard — no policy, no lease — records nothing, and the loop sees no-report.
- Attempts are the orchestrator's ceiling (runUnit), not the session's; a unit re-dispatched by hand outside runUnit is not counted.

## Credential canary watch (`reg.audit.canary-watch.v1`)

Enforced at `host:tool_result` (redact), `host:message_end` (record) in `../regulator-pi/src/authority.ts`; S3*, deterministic-gate.

Not covered:

- It watches for known values only: a real secret the harness was not told about is not a canary. This measures whether the exposure path exists, not whether every secret is safe.
- A canary that reaches the model in a form the scan does not match (split across blocks, base64, described rather than quoted) is not redacted.
- By the time message_end records a leak the text has left the process: the finding is evidence of exposure, not prevention. Network egress is not watched at all; the lesson names it as the boundary a container provides.

## Closeout gate (`reg.audit.closeout-gate.v1`)

Enforced at `loop:auditUnit` (after the report check, before reintegration), `loop:closeUnit` (re-audit without an attempt) in `src/controller.ts`; S3*, deterministic-gate.

Not covered:

- Evidence binds to criteria by class, not by content: a passing suite that does not exercise the changed behaviour satisfies a test-class criterion. Criterion-specific checks are a workload's to declare; the software workload declares only run_tests and run_checks.
- The environment recorded is the orchestrator's host; a check that passes here and fails on the target platform is not caught.
- Runtime-class criteria are treated like semantic ones (human acceptance) because no host mechanism observes runtime behaviour yet.
- The audit log is one NDJSON file per instance beside the regulatory log (messages and their obligations); neither is merged with the SQLite regulatory event store the reporting tools write.

## Definition check (`reg.identity.definition-check.v1`)

Enforced at `cli:check` (checkDefinition, under pnpm check), `check:checkDefinition` (a unit type declared contract-less must run under a profile that is read-only by declared effect), `check:checkDefinition` (a unit type that requires a contract must run under a profile that grants report_result, or no unit of the type could ever close), `check:checkDefinition` (advice: a file per declared profile, no file for an undeclared profile, no profile with both inline advice and a file; an advice file over the policy's advice.maxChars is a warning), `check:checkDefinition` (a definition directory in no class of DEFINITION_WRITERS is refused (definition-writers)), `check:checkDefinition` (consent grants (#60): a guarded tool the profile does not grant, a guarded path outside its writable paths, a pattern on a tool without arbitrary execution or one that is not a regular expression, are refused; a guarded write beside bash with no pattern covering the path is a warning naming the profile and the path) in `src/registry-cli.ts`; S5, deterministic-gate.

Not covered:

- Shape and references only: a profile that grants bash to a unit type whose contract forbids writes is a valid definition. Whether the declaration is a good one is the capstone's viability case.
- It runs under `pnpm check` and `regulator check`, not at dispatch: an instance started from an edited definition between checks runs on the edit.
- The identity and advice checked are the definition's seeds; an instance's copies are checked by the identity-untouched check at closeout and reported by `doctor`, not here.
- An advice file is checked for shape and size, not for content: nothing says whether a line is advice or a rule in disguise (docs/DEBT.md row 43).

## Definition writers (the accept-path split) (`reg.identity.definition-writers.v1`)

Enforced at `check:checkDefinition` (a definition directory in no class of DEFINITION_WRITERS is refused (src/, dist/ and node_modules/ are the package's, not the definition's)), `cli:check` (under pnpm check and regulator check), `cli:docs` (renderBoundaryMarkdown: the "Who writes the definition" section from the list) in `../protocol/src/definition-writers.ts`; S5, deterministic-gate.

Not covered:

- The declaration class has no mechanism of its own: a profile grant, a unit type, a check, a policy, a suite or an extension lands as a pull request a person writes with `pnpm check` as the gate, not as a unit of work under the loop with `regulator check` at closeout. BOUNDARY.md's row says so; the mechanism waits for the definition's repository to run as an instance (accept-path note §6; docs/DEBT.md row 45).
- Directories only: a file at the definition root (`settings.json`, `BOUNDARY.md`, `package.json`) is in no class and is not checked, and the fixtures are listed by name in the declaration class rather than derived from the eval suites that use them.
- It names the paths and the commands; it does not check that a class's accept command writes only under its instance path. That is each command's own check (`authorizeWrite` under S5 authority, a closed file list), evidenced on its card.
- A plain proposal's class is read off its subject (the path it names); only a `harness-edit` names its target in a typed payload (`HarnessEditSchema`, #138), and only for the advice class. A typed payload for the identity and declaration classes is not designed.

## Disposition authority (`reg.authority.disposition-authority.v1`)

Enforced at `cli:answer` (authorized() before every write that takes --by (checkDispositionAuthority); the options check and dispositionForAnswer), `cli:obligation ack`, `cli:obligation resolve`, `cli:obligation escalate`, `cli:memory retract`, `cli:unit accept` (at blocking: a criterion has no severity of its own), `cli:identity accept` (as S5), `cli:identity reject` (as S5), `cli:identity promote` (as S5) in `src/cli.ts`; S5, deterministic-gate.

Not covered:

- `--by` is asserted, not authenticated: the check is whether the named person may, not whether the caller is that person. Authentication is the deployment's (an OS user, a signed request) and is out of the lab's scope; the record stays honest about the claim.
- The grants are three booleans and a severity; an obligation-specific grant (bob may answer questions on units he owns) is not expressible, and the policy is one file for the instance.
- The session path (`ask_human` with a dialog) attributes the answer to the session's user and does not run this check: a person at the keyboard of a unit's session is treated as able to answer that unit's question. The CLI path checks; the dialog path trusts the terminal.

## Doctor (the operating check) (`reg.audit.doctor.v1`)

Enforced at `cli:doctor` (every check, ok or not, with its detail; the exit code) in `src/instance.ts`; S3*, deterministic-gate.

Not covered:

- It checks what the definition and the instance say about themselves; a broken model provider, a missing API key or a full disk are Pi's and the deployment's to notice.
- Definition drift is detected by revision, registry count, Pi pin and package version, and doctor says to run `regulator upgrade` when the package is newer; it upgrades nothing, and after an upgrade it reports what the manifest's history says, not what the person did with the note's non-mechanical bullets. A definition changed without a commit (a dirty working tree) reads as unchanged, and a head the version number does not distinguish (the unreleased head) reads as drift by revision alone.
- Exit 1 is the whole enforcement: a CI job that does not run it, or ignores its exit code, is unregulated. Nothing else calls doctor.

## Effect journal (`reg.coordination.effect-journal.v1`)

Enforced at `tool:notify_owner` (execute: begin/commit), `host:session_start` (reconcile) in `../regulator-pi/src/recovery.ts`; S2, deterministic-gate.

Not covered:

- Reconciliation needs an observable world: notify_owner's outbox is keyed so it can be read back. An effect with no observable trace can only be recorded as absent, which is a guess.
- The idempotency key is the unit, the tool and the arguments; the same message sent on purpose twice is refused. Vary the message.
- Only notify_owner is journaled. bash is not: a shell command's side effects are unknown by declaration, and nothing here can journal what it cannot name.
- The journal is per base checkout, on one machine; two harnesses on two machines cannot see each other's intentions.

## Eval harness and graders (`reg.assurance.eval-harness.v1`)

Enforced at `cli:eval` (runSuite: one instance per arm × repetition, the tasks through driveUnit; contractForArm / workloadForArm change only what the definition declares; graders.ts: the fifteen built-in outcome and trajectory graders and the declared graders a suite pre-registers, run after each unit; no judge model; the fingerprint hashes each declared grader's file), `check:checkDefinition` (suites and committed reports validate; ablation arms name their switch; a suite pre-registers only built-in metrics or ones a workload declares with a grader file under the definition, with at most one optimisation target, and a judged metric is refused until its instrument record carries a held-out score) in `src/evals.ts`; S3*, deterministic-gate.

Not covered:

- A scripted unit never runs a session: the session gates (profile grant, write gate, bash watch, canary watch, budget guard) are not exercised, only the loop and the closeout checks. The committed reports say `scripted:` in their fingerprint for that reason; a live run is the drill, and its numbers are the ones that count for retirement. The live path itself is covered headlessly (the dispatcher opens and binds a session with no model, ../regulator-pi/src/dispatcher.test.ts); what a model does under the gates is not.
- The harness throws two kinds of switch — a host check, a checkpoint extension for a live arm. A regulator whose switch is `loop:`, `policy:` or `none` has no ablation arm the harness can run; the lifecycle view says so rather than pretending.
- Repetitions are what the suite declares; at n=3 few intervals separate, and the lift's `separated` flag is a screen, not a test. Contamination (a fixture leaking into a prompt or a model's training data) is not detected; the fixture is small and public.
- Graders are pattern and structure: vocabulary drift is a word list, a rule in prose is a regular expression over added lines. They are validated against three scripted learner-style units, not against a model's actual drift.
- A declared grader is run as the workload declared it, and that is all the harness checks: that its command names a file under the definition (hashed into the fingerprint), that it exits clean, and that its lines name the metric it was declared for. Whether the number it emits measures what the declaration says is the workload's correctness, evidenced by the workload's own tests (the portfolio's turnover by its fixture's), not by this record. A judged metric — one that names an instrument — is refused until the instrument record exists with its held-out score, so no declared metric is a model's judgment yet.

## Evidence preflight (`reg.control.evidence-preflight.v1`)

Enforced at `host:tool_result` (run_tests, run_checks: provenance), `host:tool_call` (report_result: block) in `../regulator-pi/src/evidence.ts`; S3, deterministic-gate.

Not covered:

- It trusts the session's own tool run: the session ran run_tests, and the session is what is being checked. Independence comes from the closeout gate, which reads nothing this extension records.
- Only test and command claims are preflighted; file, runtime, semantic and model claims pass through to the closeout gate.
- A run_tests call with a filter that passes counts as a passing run: the preflight sees the verdict, not the coverage.

## Failure observer (`reg.control.failure-observer.v1`)

Enforced at `host:tool_execution_end` (isError), `host:agent_end` (stopReason error) in `../regulator-pi/src/recovery.ts`; S3, deterministic-gate.

Not covered:

- Normalization is a regular expression over the error text (flattened to one line, first 300 characters); an environment problem phrased unusually is recorded as a plain tool error. Only a refused report_result is typed without the regex, as invalid-report.
- Only errors the tool layer reports as errors are observed: a test that fails is not an error, and a bash command that exits non-zero without the tool flagging it is invisible.
- The observer records; it never rewrites the result the model sees (tool_result), so the model and the router may disagree about what happened.

## Glossary lint (`reg.audit.glossary-lint.v1`)

Enforced at `loop:runHostChecks` (glossary-lint: git diff of added comment lines under the writable prefixes, git log of the branch; parseForbiddenTerms reads the glossary section), `loop:auditUnit` (forbidden terms from the worktree's identity; writable prefixes from the manifest or the conventions) in `../checks/src/verify.ts`; S3*, deterministic-gate.

Not covered:

- A word list with a plural: `tasks` is caught, `tasking` and a synonym are not. Prose in the writable prefixes that is not a comment (a README under src/) is read line by line like a comment when a line carries a comment marker, and otherwise not at all.
- The comment half is blocking wherever the workload declares the check; the commit-message half is blocking unless the workload's check entry says `commitMessages: advisory`, in which case a word there is recorded as evidence and a finding at advisory and refuses nothing. `software-development` declares the attenuation; `personal-finance` does not. A word in a commit message still costs a unit that a workload has not attenuated an attempt.
- The glossary section is parsed from prose; a malformed line is silently not a term. `regulator check` does not validate the section.

## Identity and advice promotion (the release path) (`reg.authority.identity-promotion.v1`)

Enforced at `cli:identity promote` (authorized as S5; identical-content and dirty-definition refusals; trial validation of the seed set; authorizeWrite s5-authority; git commit in the definition), `cli:advice promote` (the same, for advice/<profile>.md: a declared profile, identical-content and dirty-definition refusals, trial validation of the advice set against the declared profiles) in `src/cli.ts`; S5, deterministic-gate.

Not covered:

- It promotes a file, not a decision: the obligation that decided it stays in the instance's ledger, and the commit message names the instance and its revision, not the obligation id. Linking the two across repositories is a convention, not a check.
- The definition's own review (a pull request, `pnpm check`) is outside this command: the commit lands on whatever branch the definition has checked out.
- Instances initialized before the promotion keep their own copy; nothing pushes the new seed into them (an instance's identity and advice are its own, proposed against and decided there). `regulator upgrade` (#53) seeds a file the instance lacks — the advice set of an instance initialized before #110, a profile's file added since — and never overwrites one that exists, so a promotion reaches an older instance only as a bullet of the migration note a person reads (docs/DEBT.md row 44).

## Identity-untouched check (the instance's harness-owned files) (`reg.audit.identity-untouched-check.v1`)

Enforced at `loop:runHostChecks` (identity-untouched), `loop:auditUnit` (before reintegration) in `../checks/src/verify.ts`; S3*, deterministic-gate.

Not covered:

- Its name says identity; it protects every harness-owned directory of the instance (identity and advice), and the check name a workload declares stays `identity-untouched` so no definition has to change for the advice set to be covered.
- It reads the branch at closeout: a protected change is caught after the attempt, not before the commit. Prevention is the write gate's; this is the evidence that the gate was bypassed.
- The base is the branch the unit was created from; a unit whose base moved under it is compared against the base's current tip, so a protected change made on the base by a person is not the unit's finding.
- It binds to the command-class criterion by class, like every host check (docs/DEBT.md row 2); a contract with no command-class expectation records the failure as evidence and the verdict still fails on contradiction only if the report cited a command run.

## Identity write gate (`reg.authority.identity-write-gate.v1`)

Enforced at `host:tool_call` (write, edit: prepareWritePath), `host:tool_call` (bash: snapshot), `host:tool_result` (bash: restore and report) in `../regulator-pi/src/authority.ts`; S5, deterministic-gate.

Not covered:

- A tool-call hook protects calls routed through the hook. It does not sandbox the process: a shell command that commits a protected change, pushes it, or edits a copy of the repository elsewhere is outside it. The bash watch restores the working tree only; a commit made by the same command keeps the change in history, and reintegration would carry it.
- The snapshot-and-restore is not atomic: a command that reads a protected file it has just modified sees the modification before the restore.
- The alias walk is a preflight against a stable filesystem; a link created between the check and the write (TOCTOU) is not seen. Real isolation is the operating system's or a container's.
- Protected paths are the harness-owned directories DEFINITION_WRITERS names (identity, advice), the S5 artifacts and what the project's conventions declare (vendor/); a path the project protects by convention nobody declared is not protected.

## Inherited tests check (`reg.audit.inherited-tests-check.v1`)

Enforced at `loop:runHostChecks` (inherited-tests: git merge-base, then git ls-tree and git show at the branch point, two staged test runs, per-file line counts), `loop:auditUnit` (the base branch from the repository; exemptions from the contract's expectations) in `../checks/src/verify.ts`; S3*, deterministic-gate.

Not covered:

- The shrink half counts test and assertion lines; a kept assertion whose expected value was changed to the current output is not a shrink, and it is a regression only if the base's copy of that test passed. A test weakened inside a file the contract exempted is not seen at all.
- The base's package.json is staged with the base's tests, so a unit that legitimately adds a test dependency or changes the test script fails until the contract exempts package.json or the base takes the change first.
- Only test/ is inherited: a project whose tests live elsewhere (a src/**/*.test.js layout) inherits nothing and the check passes vacuously, with an observation saying so.
- Regressions are matched by test name; two tests with the same name are one, and a renamed test that fails looks like a new failure of a test the base never had.

## Instance manifest (regulator init) (`reg.identity.instance-manifest.v1`)

Enforced at `cli:init` (initInstance: refusals; identity seed; manifest written and validated; commit), `cli:upgrade` (upgradeInstance: the definition check, the clean base, the plan from the changelog's migration notes, the seed and ignore steps, the report fingerprint read from evals/reports/, the manifest rewritten, one commit; --check applies nothing; --by checked as S5), `cli:doctor` (readManifest, schema-validated; drift from the definition revision and the package version; the upgrade history), `host:session_start` (profiles: declared writable prefixes replace the profile's, never widen a read-only one), `loop:auditUnit` (declared protected prefixes and writable prefixes for identity-untouched and glossary-lint) in `src/instance.ts`; S5, deterministic-gate.

Not covered:

- The declaration is trusted as written: a person who declares `/` writable has granted everything; init checks the shape of a prefix, not its wisdom.
- `regulator upgrade` applies two mechanical steps and prints the rest: a decided file is never changed, so a change to the identity seed or an advice seed reaches an instance only as the note's words, and a promoted seed reaches no instance that keeps its own copy. The non-mechanical bullets are a person's to read and act on, and nothing records that they did. The fingerprint it records is read from a committed report whose `harnessRevision` is the target's; a head no report ran at records `none`, which is the shipped definition's state until the live report (#46) is committed.
- Only `write` and `edit` honour the declared prefixes in the session; the shell is granted un-gated by path, as before (docs/DEBT.md row 8).

## Intelligence intake (`reg.intelligence.intelligence-intake.v1`)

Enforced at `tool:report_intelligence` (execute) in `../regulator-pi/src/intelligence.ts`; S4, typed-tool.

Not covered:

- The tool trusts the profile grant to keep it in research units: an implement unit given the tool would be recorded as S4. The intelligence profile is what puts the tool in a session's surface; nothing in the tool checks the unit type.
- Evidence refs are stamped with the revision they were read at, but a ref to something outside the repository (an advisory URL, a registry version) is a claim the closeout gate cannot verify; only file refs are checked at HEAD.
- Expiry is the unit's estimate; the router notes expired intelligence and nothing re-raises a research obligation when a finding an active unit relied on goes stale.
- One question per contract by convention, not by mechanism: a research unit may call the tool as often as it likes within its budget.

## Interaction contract (ask_human) (`reg.algedonic.interaction-contract.v1`)

Enforced at `tool:ask_human` (execute: AskHumanInputSchema, CONTINUES_WITHOUT_ANSWER, attention budget, ledger.openObligation / requestInteraction / answerInteraction / resolve; ctx.ui.confirm / select / input with the policy's timeout; a consent records `call`), `host:tool_call` (the consent gate (../regulator-pi/src/authority.ts, consentGate in src/consent.ts): a call under the profile's consent grant is refused without an accepted consent obligation on the unit whose recorded call covers it; an amended yes rewrites the arguments before the tool runs), `host:tool_result` (a call that ran with amended arguments says which fields changed), `cli:answer` (--amend <json> on a consent given with a yes; refused on a no, another kind or a consent that recorded no call), `check:checkDefinition` (a consent grant names a tool the profile grants and a path it may write; a bash pattern is a regular expression; bash beside a guarded write with no covering pattern warns (the sandbox bypass)) in `../regulator-pi/src/algedonic.ts`; S5, typed-tool.

Not covered:

- The dialog answer is attributed to the OS user of the session (or the `person` option), not to an authenticated identity; in a session run by hand that is the person at the keyboard, which is what the record says.
- A consent grant is enforced on the named tool's calls only. The profile declares which calls need consent (a tool, with path prefixes for write and edit or a command pattern for bash) and the interception refuses those; nothing is derived from a tool's declared effects, so a workload-declared tool with an irreversible effect needs consent only where a profile names it, until #121 derives the grant from the effect on top of this declaration. A profile that grants bash beside a guarded write leaves the path reachable through the shell, which no path gates: `regulator check` warns unless a bash pattern covers the path, and the warning refuses nothing.
- A consent the gate can hold is one that recorded its call: a question asked without `call` is a yes the record holds and the gate cannot match, so the guarded call is refused and the unit told to ask naming the call. The gate matches the arguments the record names and no more; for the shipped grants that is the path, so a yes for a path holds for whatever content is written there.
- The dialog stays yes or no. Pi's confirm takes no structured input, so an answer with amended arguments comes only from `regulator answer --amend`; the gate reads the profile from the `profile` flag at session start, as the profile grant does, and a `/profile` switch in a session run by hand does not move the grant.
- A recap is owed to a person and never delivered by this tool beyond the outbox; a person who never reads the outbox never corrects anything, which is the recap's contract — the work was reversible.

## Operational memory store (`reg.control.memory-store.v1`)

Enforced at `tool:remember` (execute; MemoryStore.record bounds the expiry) in `../regulator-pi/src/identity.ts`; S3, typed-tool.

Not covered:

- A fact is text: nothing checks that it is true, current or about the environment rather than a preference. Expiry bounds how long a wrong fact lives; review is a person's.
- A fact is scoped to unit types only by the writer's claim (`remember`'s `scope`), and an unscoped fact is rendered to every unit of the instance; a large store still crowds the prompt before the 90-day limit retires anything.
- Retraction is by a person the interaction policy names, checked before the write (disposition-authority); the name is asserted, not authenticated.

## Model router (`reg.control.model-router.v1`)

Enforced at `host:dispatcher` (piDispatcher: model choice, failover; attemptEnd: halt vs provider failure, from the ledger), `host:model_select` (ledger) in `../regulator-pi/src/dispatcher.ts`; S3, deterministic-gate.

Not covered:

- Failover starts a fresh session: the fallback model does not see what the primary did, only the contract. The attempt's ledger is resumed, so the primary's spend counts against the same ceiling and the fallback has less to work with.
- Availability means Pi's registry knows the model and an API key is configured, not that the provider still serves it or the account can pay: a retired model (google/gemini-2.5-flash, 2026-09-29) or an account without credits fails on the first call and costs one session; nothing checks the route against the provider before dispatch.
- Failover with a model is exercised only live (the lesson's drill); the headless test covers the open-and-bind path and the halt-versus-failure decision, not a provider failing mid-route.

## Obligation router (`reg.control.obligation-router.v1`)

Enforced at `loop:runUnit` (after the session, after the audit, after the report's signals), `loop:closeUnit` (after the audit), `loop:routeUnit` (before and after the recovery decision), `cli:signals route` in `src/controller.ts`; S3, deterministic-gate.

Not covered:

- Routing runs at the loop's steps and on `regulator signals route`; a message recorded by a session run by hand waits in the log until one of them. Nothing watches the file. A message with no unit opens an obligation that holds nothing, with one exception: an audit finding with no unit holds every dispatch until S3 dispositions it.
- A consumer is a name in the policy (S3, S5, human). What is owed to a person is delivered to the outbox and reminded by `algedonic-delivery`; what is owed to S3 or S5 is exposed by the read model and the control room and delivered to nobody, because S3 is the loop and S5 is a person reading the definition's proposals — a queue for S5 decisions is not built.
- Effective severity is the message's own except for uncertainty, whose reported impact is mapped through the policy, and for the routing policy's floors: a message whose subject or observation names an invariant or the identity path is raised to the floor's severity. A floor is a pattern; a message that concerns an invariant without naming it is not raised.
- Every disposition on the CLI is checked against the interaction policy's people by `disposition-authority`; the name itself is asserted, not authenticated, and the check does not run for a dialog answer inside a session.

## Outbox watcher (`reg.algedonic.outbox-watcher.v1`)

Enforced at `cli:watch` (watchOutbox tick: deliverPending, remindDue, forward from the cursor; the cursor advances only when every forward succeeded; --once, or the loop) in `src/deliver.ts`; S5, deterministic-gate.

Not covered:

- A process, not a service: nothing restarts it, and an instance whose watcher is not running is that instance again. Supervising it is the deployment's (a systemd unit, a CI schedule).
- The channel command gets a line and an exit code; a channel that accepts the line and loses it downstream is forwarded once and never again. Delivery to a person is still not confirmation that a person read it.
- One watcher per instance and one cursor: two watchers on one outbox forward every line twice.

## Pause gate (`reg.algedonic.pause-gate.v1`)

Enforced at `host:tool_call` (paused → block unless read-only effect or report_result), `host:agent_before_settle` (regulator:paused entry, continue: false), `loop:runUnit` (open blocking interaction obligation → attempt outcome paused, status blocked; the progression veto refuses a re-dispatch until it is dispositioned), `loop:routeUnit` (no decision while paused) in `../regulator-pi/src/algedonic.ts`; S3, deterministic-gate.

Not covered:

- The session gate keys on TOOL_EFFECTS by tool name: a tool the effect table does not know is refused (safe), and a read-only tool that lies about its effect runs. The table is the effect declaration; this gate does not inspect what a tool does.
- The pause is per session: a unit dispatched again by hand (`unit dispatch` after a manual `obligation resolve`) starts unpaused, because the obligation is closed; the veto is the only hold across sessions, and it is the obligation's, not this gate's.
- A paused unit holds its lease and its worktree while it waits, and by default nothing expires the wait: a question nobody answers is visible in the read model and the outbox (`algedonic-delivery`), and stays. The interaction policy may declare `waitCeilingMs`; past it the loop routes the unit under the recovery policy's `timeout` cause and releases the lease, but the question stays open with its veto — nothing answers on anyone's behalf, and the worktree is kept for the attempt that follows the answer.

## Post-merge check (`reg.audit.post-merge-check.v1`)

Enforced at `loop:finishUnit` (verifyBase ran after finishUnit: host checks on the base at the merge commit; evidence; the unit-less finding (retired: the step is gone, the trial runs inside finishUnit)), `loop:runUnit` (progressionVeto: an open blocking obligation with no unit holds every dispatch) in `src/controller.ts`; S3*, deterministic-gate.

Not covered:

- It ran after the merge, not before: the base was red for the time it took S3 to decide. The pre-merge trial (0.1.4) refuses instead, at the cost of a second worktree per close — which is why this record is retired.
- Only `run_tests` and `run_checks` are run on the base; the branch-relative checks (identity-untouched, export-signature, glossary-lint) have no meaning there.
- The finding is owed to S3 under the routing policy; a routing policy that routes audit findings elsewhere routes this one elsewhere too.

## Pre-merge trial (`reg.audit.pre-merge-trial.v1`)

Enforced at `loop:finishUnit` (reintegrate with a trial: the temporary worktree under .regulator/trials/, the merge there, the trial, then merge --ff-only to the trial commit; trialMerge in controller.ts runs the workload's checks and binds the evidence), `cli:unit finish` (the same trial with run_tests and run_checks as the conventions discover them) in `src/worktree.ts`; S3*, deterministic-gate.

Not covered:

- Only `run_tests` and `run_checks` run on the merged tree; a coupling those two do not exercise lands. A workload cannot yet name a trial-only check.
- The trial worktree is the merged tree and nothing else: a project whose checks need installed dependencies has the same gap a unit's worktree has, and the conventions' discovery decides what runs there.
- A base that moves between the trial and the landing is refused (`base-moved`), not re-trialed: the next close tries again from the new base. Inside one loop the lease and the veto make this a person's intervention, not a race.
- An inconclusive trial (no test script discovered) lands, recorded as such; only a failing check refuses.

## Prediction resolution (`reg.assurance.prediction-resolution.v1`)

Enforced at `loop:resolvePredictions` (after a unit's status becomes closed (closeVerifiedUnit) or aborted (routeUnit): every open live horizon naming the unit's type gets one reading from unitGrader (src/predictions.ts, the eval harness's graders over one unit); probe horizons from committedReports by SHA-256; a disconfirmed live horizon appends a policy-proposal to S5 and routes it), `cli:advice accept` (a harness-edit is read against the stores first (checkHarnessEdit: units, attempts, trajectory moments, evidence at the revision, signals; the prediction carries the block; the profile is declared); the target is the payload's, a disagreeing --file is refused, the disposition cites the prediction) in `../core/src/predictions.ts`; S3*, deterministic-gate.

Not covered:

- The probe rule is not here: `advice accept` does not refuse a `harness-edit` whose probe horizon has not resolved, because nothing produces a probe report yet. The probe arm (`EvalArmSchema`'s `advice` override) and the refusal are slice 3 of the accept-path split, after the live report (#46); until then a probe horizon resolves only against a report a person committed and named by its fingerprint.
- A live horizon reads one unit's grader value against a committed report's arm mean, with no interval on the unit's side: one value either reaches the baseline moved by the magnitude or it does not. The probe horizon uses the arm's 95% interval. At three repetitions few intervals separate, so a probe resolves inconclusive more often than a live horizon; inconclusive counts against the prediction either way.
- The next N units are counted by the fold over the regulatory log — the resolutions recorded against the horizon — not by a scan of the execution store or an index, so the log is re-read at every close and abort, linear in its length, as the obligation ledger already is. A unit of a named type that closed before the horizon opened (before the harness-edit was accepted) is not a reading, by design: the edit was not in effect.
- A report's fingerprint is the SHA-256 of its committed file, so an interpretation edited after the fact is a different report and a prediction naming the old fingerprint resolves against nothing; `regulator check` does not warn about a prediction whose named report is absent, the resolution's reason does.
- The outcome graders run over the instance from its first commit, as the eval harness runs them from the fixture commit, so on a long-lived instance `boundaryViolations`, `vocabularyDrift` and `memoryRules` are cumulative, not the closing unit's alone; the trajectory counts and a declared grader are per unit or per run as their graders define them. A metric no grader observes here — another workload's declared metric, a name that is neither — is an inconclusive reading with that reason, never a zero.
- Nothing in this slice produces a prediction: a person appends the signal, or the reflector will. `report_intelligence` does not take the block, and no `regulator intelligence report` command exists (open questions §2). A signal's three-valued `confidence` is still recorded and never calibrated; the instrument record kind that would grade it waits on resolved predictions and a live report.

## Profile write grant (`reg.control.profile-write-grant.v1`)

Enforced at `host:session_start`, `host:tool_call` in `../regulator-pi/src/profiles.ts`; S3, deterministic-gate.

Not covered:

- Positive grant covers write and edit only; the implement profile grants bash, which is not path-gated.
- Read-only means declared read-only effects (effects.ts); a tool with an undeclared effect is refused from read-only profiles, not audited.
- Lexical path check only, as for the vendor write gate.

## Progression veto (`reg.control.progression-veto.v1`)

Enforced at `loop:runUnit` (before the lease is taken), `loop:closeUnit` (before the re-audit) in `src/controller.ts`; S3, deterministic-gate.

Not covered:

- Checked at dispatch and at close only. A unit already running when the obligation opens finishes its attempt; the veto meets it at the next step.
- Blocking is a function of severity and the policy's line; the obligation's consumer is not consulted. An S5 proposal at blocking severity on a unit would hold the unit, which may or may not be wanted — the routing policy decides by setting the line.
- The veto names the unit id. Intelligence that affects a unit not yet contracted holds it once it exists; intelligence that affects a file, a dependency or a workload has no unit to hold and is an obligation for S3 to read.

## Project trust rule (`reg.authority.project-trust-rule.v1`)

Enforced at `host:dispatcher` (definitionResourceLoader: extensionsOverride, no project skills/prompts/themes), `host:project_trust` (authority.ts, CLI sessions) in `../regulator-pi/src/dispatcher.ts`; S5, deterministic-gate.

Not covered:

- Trust is an input-loading guard. It keeps a project's own extensions, skills, prompt templates and themes out of the harness; it does nothing about instructions in the project's files, comments, test output or documentation — those are the injection drill, and the answer to them is that authority lives in gates the content cannot reach.
- The loader takes no context files from the worktree (noContextFiles) and the session runs on the definition's settings.json held in memory, so neither AGENTS.md nor .pi/settings.json in a target repository reaches a unit's session. What the model reads with its tools is still the project's to write: the trust rule closes loading, not reading.
- The filter is by resolved path against the definition's list; an operator's user/global extensions are refused too, which is the intended reading of 'declared, not assembled' but surprises anyone who expected their own extensions to ride along.
- The project_trust answer covers the CLI path (`pnpm cp9`); a learner who launches pi by hand with trust remembered as yes has trusted the project themselves.

## Proposal intake (`reg.authority.proposal-intake.v1`)

Enforced at `tool:propose_policy_change` (execute) in `../regulator-pi/src/authority.ts`; S5, typed-tool.

Not covered:

- A proposal is routed into an obligation owed to S5 and decided by a person through `regulator identity accept|reject`, which is the only writer of an identity file; the proposal's requestedChange is text a person turns into a file by hand. What is owed to S5 is not delivered to the outbox (algedonic-delivery delivers what is owed to a person): a person reads the read model for it.
- The proposal's source is S1 by construction; a proposal from S3 or S4 (a router that wants a policy change) has no tool yet.
- Evidence on a proposal is empty: the tool does not let the model attach evidence refs, because a claim about evidence is not evidence.

## Recovery router (`reg.control.recovery-router.v1`)

Enforced at `loop:routeUnit` (after a blocked outcome), `loop:driveUnit` (the autoloop) in `src/controller.ts`; S3, deterministic-gate.

Not covered:

- Classification is a fixed precedence over recorded facts; a failure with two causes is routed by the first the precedence finds. A check-failure whose root cause is environmental is routed as check-failure, because the orchestrator's record wins over the session's observation.
- Remediate, replan, clarify and pause are recorded and the unit waits on an obligation for the consumer the routing policy names; nothing in the loop performs them. A person who resolves the obligation is checked against the interaction policy's people but not authenticated.
- Occurrences are counted per cause per unit, by design: a unit that alternates between two causes never reaches the third action of either rule and is stopped by the attempt ceiling, and the alternation is visible in its decisions and obligations. A policy that wants a global count declares shorter rules.
- Escalation is an algedonic signal in the regulatory log and an obligation owed to a person, delivered to the outbox and reminded under the interaction policy. The outbox is a file: no channel beyond it exists in the lab.

## Regulator lifecycle (`reg.identity.regulator-lifecycle.v1`)

Enforced at `check:checkRegistry` (an active record without ablation or retirement is a problem; so is an overdue review date), `cli:review` (--due: reviewDue), `cli:status` (the lifecycle view of the read model, rendered by the control room) in `../core/src/registry.ts`; S5, deterministic-gate.

Not covered:

- A retirement condition is prose; nothing checks that a committed report satisfies it. The lifecycle view shows coverage (an ablation arm exists for the record), not satisfaction; a person reads the report against the condition.
- Review dates are checked on demand, not scheduled: `regulator review --due` runs when someone runs it, and nothing under CI fails on an overdue record (docs/DEBT.md row 32).
- Most switches the registry names are `loop:`, `policy:` or `none`: named honestly, not runnable by the harness. Two of thirty-six records have a runnable ablation arm in the committed suite.
- Implementation and cited-test paths are verified only in a source checkout (a `src/` beside the registry). An installed package ships `dist/` and no sibling packages' sources, so there `checkRegistry` carries the paths as provenance and `doctor` says it did not verify them; the release's `pnpm check` is where they were verified.

## Reintegration guard (`reg.coordination.reintegration.v1`)

Enforced at `loop:finishUnit`, `cli:unit finish` in `src/worktree.ts`; S2, deterministic-gate.

Not covered:

- Detects file-level conflicts only; two units can change disjoint files and still break each other (the S2 gap analysis's semantic-conflict case).
- Merge commits only; no rebase, squash or fast-forward policy.
- The merge itself verifies nothing: the branch was verified at closeout, and the base at the merge commit is verified afterwards by the post-merge check (reg.audit.post-merge-check.v1), so the base is red while S3 decides a failure there.

## Result report gate (`reg.control.result-report-gate.v1`)

Enforced at `tool:report_result` (execute), `loop:runUnit` (close), `host:session_start` (a loaded contract puts report_result on the active tool surface, whatever the profile lists) in `../regulator-pi/src/contract.ts`; S3, deterministic-gate.

Not covered:

- Evidence is checked by class, not by content: a report can cite a test run it did not make. Host-run verification is what makes evidence independent of the report.
- A unit can describe an unresolved decision as 'preserved' while its diff settles it; the gate reads the report, never the diff, by design — catching that is audit's job.
- Every emergent decision, deviation and residual uncertainty in the report becomes a signal the routing policy routes; which of them opens an obligation is the policy's line, so a low-consequence decision is noted as trace, not read by anyone.
- report_result joins the tool surface when the contract loads at session_start; a profile switched by hand mid-session (/profile) resets the surface to the profile's list and drops it until the session restarts. The dispatcher never switches profiles.

## S5 decision path (`reg.authority.s5-decision.v1`)

Enforced at `cli:identity accept` (authorizeWrite s5-authority, readIdentity, git commit, ledger.resolve accepted), `cli:identity reject` (ledger.resolve rejected) in `src/cli.ts`; S5, deterministic-gate.

Not covered:

- Who may act as S5 is the interaction policy's `actAsS5` grant, checked before the write; the name on `--by` is asserted, not authenticated.
- The proposed content is a file the person supplies; nothing derives it from the proposal's requestedChange, and nothing diffs it against what was asked. The person decides that the file is the proposal.
- It changes the instance's identity, not the definition's seed: a decision accepted in one instance does not propagate to the next fixture. Promoting a decision into the definition is a commit to packages/regulator/identity/ by hand.

## Span projection (OpenTelemetry GenAI) (`reg.assurance.span-projection.v1`)

Enforced at `cli:spans` (projectSpans: a schema-validated SpanRecord per record; redact on every string attribute), `cli:eval` (reportSpans: one span per eval run) in `../core/src/spans.ts`; S3*, type.

Not covered:

- Token usage is what the budget ledger holds — a total per attempt — so `gen_ai.usage.input_tokens` / `output_tokens` are not populated; the projection carries `vsm.usage.tokens` instead and says so by omission.
- Redaction is a value list and a pattern list: a credential with a shape neither knows passes through. The canaries file is the instance's own declaration, and a secret the instance never declared is not a canary.
- The reporting tools' SQLite store (`.regulator/events.db`) is projected as events on the unit its provenance names; an event with no unit in its provenance is not projected anywhere, and the store is opened read-only on every projection.
- Spans are a projection, not an export: nothing ships them to a collector. `regulator spans --json` writes NDJSON a collector can ingest; the wiring is the deployment's.

## Thrash detector (`reg.coordination.thrash-detector.v1`)

Enforced at `host:tool_execution_end` in `../regulator-pi/src/coordination.ts`; S2, deterministic-gate.

Not covered:

- Counts write and edit tool calls only; edits made through bash are invisible to it.
- Memory is per session: a unit resumed in a new session starts counting from zero.
- The threshold is the policy's `coordination.oscillationThreshold` (4 when a policy declares none); it is one number for every file and unit type, not a budget that varies by kind of work.

## Unit lease gate (`reg.coordination.unit-lease.v1`)

Enforced at `host:session_start`, `host:tool_call`, `host:turn_end` in `../regulator-pi/src/coordination.ts`; S2, deterministic-gate.

Not covered:

- Liveness is expiry-only: a live process that stops heartbeating and a dead one look the same until the TTL passes; there is no fencing token yet.
- The lease covers the working directory by path; a tool that writes elsewhere by absolute path is outside the lease — the identity write gate refuses absolute paths, but bash is not path-gated.
- Leases are files on one machine; nothing coordinates across hosts.

## Unit lifecycle (`reg.control.unit-lifecycle.v1`)

Enforced at `loop:runUnit` (ExecutionStore.setStatus: dispatch, dispatch-refused, attempt-failed, verified; the table is UNIT_TRANSITIONS in ../protocol/src/execution.ts), `loop:closeUnit` (re-verified, re-audit-refused), `loop:routeUnit` (routed-waiting, abort), `loop:finishUnit` (reintegrated, reintegration-refused (closeVerifiedUnit, after the trial)), `cli:status` (unitTrajectory (../core/src/trajectory.ts): the fold on every unit view, which the control room steps through) in `../core/src/execution-store.ts`; S3, deterministic-gate.

Not covered:

- The gate is on the pair (from, to), not on the trigger: which row the loop took is read back from the records, not written down with the status. Three rows share blocked → blocked (a resumed dispatch refused, a re-audit refused, a waiting decision) and are told apart by the record beside them.
- The store keeps only the current status, so the history is a reconstruction. Three moves leave no record of their own — reintegrated, reintegration refused, and a dispatch refused before any attempt — and the fold places them at the record that follows (the decision, or the unit record's last write). A status history in the store, one line per transition with its trigger, would make the fold a read; not yet (DEBT row 47).
- The why is what the records say. A record that carries no rationale — an attempt that ended `error`, a verdict with no reasons — gives its step a detail string and nothing more; the fold does not read the transcript to improve on it.
- A status written around the loop is caught only where the fold and the record disagree; a forged history that happens to be a path through the table is not.

## Vendor write gate (`reg.authority.vendor-write-gate.v1`)

Enforced at `host:tool_call` in `lab/src/cp1-trace.ts (in the Viable Agents course repository; retired here)`; S5, deterministic-gate.

Not covered:

- Lexical path check only: no symlink, hard-link or TOCTOU protection. The identity write gate supersedes it with the filesystem walk when both are loaded; this gate stays as the course's lesson 02 baseline.
- Covers the write and edit tools; bash and custom tools bypass it. The identity write gate adds the bash snapshot-and-restore for protected paths.

## Work contract gate (`reg.control.work-contract-gate.v1`)

Enforced at `loop:runUnit` (before createUnit), `host:session_start` (contract), `cli:unit start` (--type: the contract-less path refuses a unit type whose workload declares requiresContract) in `src/controller.ts`; S3, deterministic-gate.

Not covered:

- Checks the contract's shape and internal consistency only; it cannot tell whether the objective genuinely requires settling an unresolved decision — that shows up afterwards as an emergent decision in the report.
- Authority references on fixed decisions resolve — an invariant the instance's identity declares, a regulator the registry declares, an obligation the instance holds, or a named person — but a person's name is trusted as given, and whether that person held the authority is not checked (docs/DEBT.md row 20).
- The contract is loaded from a file path the session was given; the lease gate, not this gate, is what keeps another session from running under it.

## Advice and judgment

These regulators do not enforce; they inform. A rule that only they carry is not enforced.

- Advice context (`reg.identity.advice-context.v1`, prompt): Level 5 by design: what is rendered is advice. A model can ignore it; what keeps the file what a person decided is the write gate (identity-write-gate), the bash watch and the identity-untouched check.
- Contract advice section (`reg.control.contract-advice.v1`, prompt): Prompt text: the model may ignore it, and a long transcript may push it out of attention. Everything it says that matters is also a gate.
- Contract-preserving compaction (`reg.control.contract-preserving-compaction.v1`, model-judgment): The conversation summary is model judgement: it can be wrong, and nothing checks it. Only the deterministic block is guaranteed.
- Identity context (`reg.identity.identity-context.v1`, prompt): Level 5 by design: what is rendered is advice. A model can ignore it; what makes identity binding is the write gate (identity-write-gate) and the identity-untouched check, and the drift suite measures the gap.
