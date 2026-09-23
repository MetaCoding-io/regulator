# `regulator` — the reference build

One source file per checkpoint under `src/` (`cp0-event-log.ts` … `cp12-algedonic.ts`),
headless tests beside them, and the definition beside the code: `registry/`,
`identity/`, `profiles/`, `policies/`, `workload/`, `evals/`, `contracts/`,
`settings.json`. `BOUNDARY.md` and `registry/REGULATORS.md` are generated from the
registry records.

- **Run it:** [`OPERATING.md`](OPERATING.md) — install (`pi install ./course/lab`),
  install into a repository (`regulator init`), the CI entry point (`regulator
  doctor`), upgrading, the security posture, and who owns what.
- **Learn it:** the course under [`../modules/`](../modules/), one lesson per checkpoint.
- **Check it:** `pnpm check` from the repository root; `node dist/registry-cli.js
  check` for the definition alone.
- **Second workload:** `workload/personal-finance.json` over `fixture-finance/`, with
  the `bookkeeper` and `auditor` profiles, `policies/finance.json` and
  `contracts/finance/`; the worked example is
  [`../examples/personal-finance.md`](../examples/personal-finance.md) and
  `src/finance.test.ts` runs its August close scripted.
