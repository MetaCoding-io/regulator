# Changelog

All notable changes to `@metacoding/regulator` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/). Until 1.0.0, a minor version may change the
CLI or the definition's file formats; a patch version does not.

## [Unreleased]

## [0.1.0] — 2026-09-24

The first versioned release: the course's reference build, relocated from `course/lab`
to `packages/regulator` unchanged, with the `regulator status` read model folded in from
the former `@metacoding/vsm-pi-cli`.

### Added
- The `regulator` CLI: `init`, `doctor`, `unit start|dispatch|drive|route|show|close|accept|evidence|finish|status`, `contract check`, `obligations`, `obligation show|ack|resolve|escalate`, `answer`, `remind`, `memory`, `identity accept|reject|promote`, `signals route`, `effects`, `watch`, `eval`, `spans`, `review`, `status`, `fixture`.
- The host seam (`Host`, `loadHost`): the control plane resolves a host package by name and runs live units through its dispatcher; `@metacoding/regulator-pi` is the Pi host, with the eleven session extensions (`tools`, `profiles`, `coordination`, `contract`, `budget`, `recovery`, `evidence`, `authority`, `intelligence`, `identity`, `algedonic`) loaded by `pi install`, the dispatcher, the write gate and the typed reporting tools folded in from the former `@metacoding/vsm-pi-extension`.
- The definition beside the code: forty-three registry records (forty-two active; the lexical vendor write gate of lesson 02 retired, superseded by the authority extension and the manifest's protected prefixes) with `REGULATORS.md` and `BOUNDARY.md` generated from them, the identity seed, five profiles, five policies, two workloads (software development, personal finance), the drift eval suite with four committed reports, and the contracts the lessons run.
- Host checks at closeout: `run_checks`, `run_tests`, `inherited-tests`, `identity-untouched`, `export-signature`, `glossary-lint`.

[Unreleased]: https://github.com/MetaCoding-io/regulator/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/MetaCoding-io/regulator/releases/tag/v0.1.0
