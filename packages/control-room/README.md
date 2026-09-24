# @metacoding/vsm-pi-control-room

The maintainer's control room: one read-only page over the `regulator status` read model
(`packages/regulator`). It answers three questions and owns no state:

- **Definition** — the registry as a topology (S5 → S1 columns, one card per regulator,
  the channels each record declares it consumes and emits) and the workloads.
- **Instances** — every instance's units, leases and unrouted signals.
- **Inspector** — the whole record for a regulator or a unit (contract, result report,
  attempts): the record, not a summary of it.

```
pnpm build
node packages/control-room/dist/cli.js --definition packages/regulator --instance /path/to/repo [--instance ...] [--port 4321]
```

Then open `http://127.0.0.1:4321/`. The page refreshes every five seconds; `#reg=<id>` and
`#unit=<instance index>/<unit id>` deep-link the inspector. Every non-GET request is
refused with 405 — the moment this grows a button that changes anything it has become an
authority surface, and it will not (the rule is from the archived
[CONTROL-REGISTRY.md](../../docs/archive/2026-09/CONTROL-REGISTRY.md) §6).

Nothing here reads the repository: units come from the execution store, leases from the
lease store, signals from the signal sink, regulators from the registry files.
