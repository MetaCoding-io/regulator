# VSM-Pi Architecture Policy

## System boundary

VSM-Pi is a coding-agent harness on Pi with its own orchestrator and an explicit control plane. It integrates with Pi only through supported extension and SDK seams. The orchestrator is the sole authority over execution state; regulators are the sole authority over regulatory state (INV-005). GSD-Pi is comparison material in the course, not a dependency.

## Primary components

- `packages/protocol` — channel vocabulary, schemas, typed messages.
- `packages/core` — authority and policy logic independent of a particular agent runtime.
- `packages/pi-extension` — Pi lifecycle/tool interception.
- `packages/checks` — deterministic S3* architectural/domain checks.
- `packages/cli` — operator-facing inspection and setup.
- `course/lab` — the reference build (`regulator`); its Pi-free modules promote into `protocol`/`core` as they stabilize.
- `vsm/` — committed S5 identity and policy.
- `.regulator/` — an instance's generated runtime records: the execution store, the regulatory log, the audit log, the effect journal, the outbox, the memory store and the reporting tools' SQLite event store (`events.db`). Never identity.

## Dependency direction

```text
protocol
   ^
   |
 core
 ^  ^
 |  |
checks
 ^
 |
pi-extension <--- course/lab (reference build)

cli may depend on protocol/core/checks, but core must not depend on Pi.
```

Runtime-specific adapters may depend on `core` and `protocol`. `protocol` and `core` must remain usable without Pi.

## Authority boundary

Committed files under `vsm/` are S5 identity artifacts. Ordinary operational execution may read them but must not directly mutate protected S5 files. Operational discoveries that imply an identity/policy change must be represented as a typed proposal.

## Verification boundary

An S1 executor's assertion of correctness is not audit evidence. Blocking architectural conformance decisions must be produced by host-owned deterministic checks or an explicitly independent S3* path.

## Integration rule

Prefer supported Pi TypeScript extension and SDK APIs over patching internal runtime code. If an upstream Pi change becomes necessary, document the missing primitive and attempt an upstreamable change before maintaining a long-lived fork. Pin the Pi version; an upgrade is a change with evidence.
