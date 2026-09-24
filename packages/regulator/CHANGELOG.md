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
- Eleven Pi extensions loaded by `pi install ./packages/regulator`: typed tools with effect contracts, capability profiles, coordination, the work contract, budgets, recovery, evidence, authority, intelligence, identity, and the algedonic path.
- The definition beside the code: forty-three registry records with `REGULATORS.md` and `BOUNDARY.md` generated from them, the identity seed, five profiles, five policies, two workloads (software development, personal finance), the drift eval suite with four committed reports, and the contracts the lessons run.
- Host checks at closeout: `run_checks`, `run_tests`, `inherited-tests`, `identity-untouched`, `export-signature`, `glossary-lint`.

[Unreleased]: https://github.com/MetaCoding-io/vsm-pi/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/MetaCoding-io/vsm-pi/releases/tag/v0.1.0
