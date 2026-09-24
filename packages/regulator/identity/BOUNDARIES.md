# Identity — boundaries

Where things live, and what may cross.

## Three kinds of state

- **Execution state** — units, attempts, leases, budgets — lives in `.regulator/units/`
  and `.regulator/leases/`, owned by the orchestrator.
- **Regulatory state** — messages, obligations, evidence, verdicts, memory — lives in
  `.regulator/*.ndjson`, append-only, owned by the regulators.
- **Domain output** — the code — lives in the repository. Nothing reads its own
  progress off the domain.

## What a unit may touch

- A unit writes under `src/` and `test/` through `write` and `edit`, and nowhere else by
  those tools. The shell is granted to the implement profile and is not path-gated;
  the same boundary binds it, and the closeout check reads the branch.
- `vendor/` is protected by the project's convention; `regulator/identity/` is
  protected by this identity. Both are refused to operational authority and both are
  diffed against the base at closeout.
- A unit never edits `.regulator/`: its records are written by the harness's tools.

## What crosses the boundary, and how

- Into a unit: the contract (a typed entry and a prompt section), the profile, the
  identity, current operational memory, and the orchestrator's hint about the previous
  attempt.
- Out of a unit: the result report, evidence provenance, signals, intelligence,
  proposals and memory entries — all typed, all with host-stamped provenance.
- Never out of a unit: a change to identity, a change to policy, a resolved obligation.
