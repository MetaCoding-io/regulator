# `regulator` — the reference build

The control plane: the `regulator` CLI (`src/cli.ts`), the S3 loop (`src/controller.ts`),
the stores and the host seam (`src/host.ts`), headless tests beside them, and the
definition beside the code: `registry/`,
`identity/`, `profiles/`, `policies/`, `workload/`, `evals/`, `contracts/`,
`settings.json`. `BOUNDARY.md` and `registry/REGULATORS.md` are generated from the
registry records.

- **Run it:** [`OPERATING.md`](OPERATING.md) — install (this package for the CLI, `pi install ./packages/regulator-pi` for the Pi host),
  install into a repository (`regulator init`), the CI entry point (`regulator
  doctor`), upgrading, the security posture, and who owns what.
- **Learn it:** the course, [Viable Agents](https://github.com/MetaCoding-io/viable-agents-course), one lesson per module; the [glossary](../../docs/GLOSSARY.md) and the [pathology catalog](../../docs/PATHOLOGIES.md) are public.
- **Check it:** `pnpm check` from the repository root; `node dist/registry-cli.js
  check` for the definition alone.
- **Second workload:** `workload/personal-finance.json` over `fixture-finance/`, with
  the `bookkeeper` and `auditor` profiles, `policies/finance.json` and
  `contracts/finance/`; the worked example is
  [`docs/examples/personal-finance.md`](../../docs/examples/personal-finance.md) and
  `src/finance.test.ts` runs its August close scripted.
