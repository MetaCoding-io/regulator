# Changelog

All notable changes to `@metacoding.io/regulator` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/). Until 1.0.0, a minor version may change the
CLI or the definition's file formats; a patch version does not.

## [Unreleased]

### Fixed
- `regulator unit start` printed a `pi -e` command naming `dist/tools.js` and `dist/coordination.js` under the control plane, where the session extensions have not lived since the host seam split; copied from an install, the command failed. The line now asks the host for its extension paths (`host.extensionPath`), honouring `--host` and `REGULATOR_HOST` as `unit dispatch` does. With no host resolvable the start still takes the lease and makes the worktree, and says a session there needs a host instead of printing a command that cannot work (#79).

## [0.1.3] — 2026-09-29

The second live drift run (issue #46, on 0.1.2) closed ten of twelve units and found
what happens after the budget guard halts one.

### Fixed
- A halt by the budget guard was failed over as a provider failure. The guard aborts the session when a ceiling is crossed and Pi records the abort as an errored assistant message; the dispatcher read the message alone, opened a fresh session on each declared fallback, and reported "every model in the route failed" when the last one did. Each fallback session also started a new ledger for the same attempt, so the primary's spend and the exhausted marker were overwritten and the loop classed the unit as a dispatch error (recovery cause `environment`) instead of `budget-exhausted`, which the recovery policy routes differently. The dispatcher now reads the attempt's ledger before deciding (`attemptEnd`): a halt is returned to the loop as the attempt's end and is never failed over; only an errored message without a halt is a provider failure. A session that opens on an attempt another session already metered resumes that ledger (`BudgetMeter` `resume`), so the attempt has one ledger whichever sessions ran it, the primary's spend counts against the same ceiling, and a halt stays a halt.
- The default policy's last fallback for every route, `google/gemini-2.5-flash`, is retired by Google for new keys and answered every call with a 404; the routes now fall back to `google/gemini-3.8-flash`, which the pinned Pi registry knows. Nothing checks a route against the provider before dispatch; the `model-router` card says so.
- `regulator unit show … | head` crashed the CLI with `EPIPE` once the reader closed the pipe; the CLI now exits cleanly.


## [0.1.2] — 2026-09-28

The first live drift run (issue #46) found the live dispatch path had never been
exercised end to end.

### Fixed
- Live units ran with every session-bound regulator inert. The dispatcher created a Pi session and prompted it, but never called `session.bindExtensions(...)`, which is what emits `session_start` in Pi's own modes. The contract, the profile grant, the budget guard, the identity section and the algedonic path all initialize on that event, so a live unit ran as a plain coding agent: no contract in its prompt, `report_result` refused for want of a contract, nothing metered, every unit blocked as `no-report`. `openUnitSession` now opens and binds the session the way `pi -p` does, emits `session_shutdown` before disposing, and a headless test drives the real path with no model and asserts the contract is bound, the profile's tool surface is set and the ledger is written before the first prompt.
- Binding the session exposed the next gap: the `implement`, `research`, `bookkeeper` and `auditor` profiles did not grant `report_result`, so a bound unit could never close either. Every profile a contracted unit type runs under now grants it, `regulator check` refuses a contracted unit type whose profile does not (the contract extension also puts the tool on the surface when a contract loads, as a backstop), and the effect declarations distinguish a control-plane record (a report, a proposal, intelligence, a fact: the domain untouched, the record reversible) from a domain write, so a read-only profile can still report.

### Changed
- `regulator check` refuses a committed eval report under `evals/reports/` that still carries the placeholder interpretation `regulator eval` writes without `--interpretation` (by "nobody yet", or "not yet interpreted by a person" in the text). The placeholder is exported from the protocol as `UNINTERPRETED_BY`, `UNINTERPRETED_MARKER` and `isUninterpreted`.

## [0.1.1] — 2026-09-25

The first install from npm found two things the workspace never exercised.

### Fixed
- `regulator` on the path: `dist/cli.js` had no shebang, so the `bin` link ran it as a shell script. `node dist/cli.js` was unaffected.
- `regulator doctor` from an installed package reported every registry record's implementation and cited tests as missing: the paths name source files the package does not ship. The registry check now verifies paths only in a source checkout (a `src/` beside the registry) and `doctor` says when it did not; `pnpm check` at the release is where they are verified. The `regulator-lifecycle` card states the limit.

## [0.1.0] — 2026-09-24

The first versioned release: the course's reference build, relocated from `course/lab`
to `packages/regulator` unchanged, with the `regulator status` read model folded in from
the former `@metacoding/vsm-pi-cli`.

### Added
- The package scope `@metacoding.io`: `@metacoding.io/regulator` (this package), `-pi`, `-protocol`, `-core`, `-checks` and `-control-room`, released together from one tag.
- The `regulator` CLI: `init`, `doctor`, `unit start|dispatch|drive|route|show|close|accept|evidence|finish|status`, `contract check`, `obligations`, `obligation show|ack|resolve|escalate`, `answer`, `remind`, `memory`, `identity accept|reject|promote`, `signals route`, `effects`, `watch`, `eval`, `spans`, `review`, `status`, `fixture`.
- The host seam (`Host`, `loadHost`): the control plane resolves a host package by name and runs live units through its dispatcher; `@metacoding.io/regulator-pi` is the Pi host, with the eleven session extensions (`tools`, `profiles`, `coordination`, `contract`, `budget`, `recovery`, `evidence`, `authority`, `intelligence`, `identity`, `algedonic`) loaded by `pi install`, the dispatcher, the write gate and the typed reporting tools folded in from the former `@metacoding/vsm-pi-extension`.
- The definition beside the code: forty-three registry records (forty-two active; the lexical vendor write gate of lesson 02 retired, superseded by the authority extension and the manifest's protected prefixes) with `REGULATORS.md` and `BOUNDARY.md` generated from them, the identity seed, five profiles, five policies, two workloads (software development, personal finance), the drift eval suite with four committed reports, and the contracts the lessons run.
- Host checks at closeout: `run_checks`, `run_tests`, `inherited-tests`, `identity-untouched`, `export-signature`, `glossary-lint`.

[Unreleased]: https://github.com/MetaCoding-io/regulator/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/MetaCoding-io/regulator/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/MetaCoding-io/regulator/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/MetaCoding-io/regulator/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/MetaCoding-io/regulator/releases/tag/v0.1.0
