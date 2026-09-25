# Changelog

All notable changes to `@metacoding.io/regulator` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/). Until 1.0.0, a minor version may change the
CLI or the definition's file formats; a patch version does not.

## [Unreleased]

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

[Unreleased]: https://github.com/MetaCoding-io/regulator/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/MetaCoding-io/regulator/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/MetaCoding-io/regulator/releases/tag/v0.1.0
