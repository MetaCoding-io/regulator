# VSM-Pi Architecture Policy

## System boundary

VSM-Pi augments Pi/GSD through supported extension and integration seams. GSD remains authoritative for its workflow lifecycle unless an explicit architectural decision changes that boundary.

## Primary components

- `packages/protocol` — channel vocabulary, schemas, typed messages.
- `packages/core` — authority and policy logic independent of a particular agent runtime.
- `packages/pi-extension` — Pi lifecycle/tool interception.
- `packages/gsd-extension` — GSD-aware phase/unit integration.
- `packages/checks` — deterministic S3* architectural/domain checks.
- `packages/cli` — operator-facing inspection and setup.
- `vsm/` — committed S5 identity and policy.
- `.gsd/vsm-runtime/` — generated runtime evidence when GSD integration is active.

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
pi-extension <--- gsd-extension

cli may depend on protocol/core/checks, but core must not depend on Pi or GSD.
```

Runtime-specific adapters may depend on `core` and `protocol`. `protocol` and `core` must remain usable without Pi/GSD.

## Authority boundary

Committed files under `vsm/` are S5 identity artifacts. Ordinary operational execution may read them but must not directly mutate protected S5 files. Operational discoveries that imply an identity/policy change must be represented as a typed proposal.

## Verification boundary

An S1 executor's assertion of correctness is not audit evidence. Blocking architectural conformance decisions must be produced by host-owned deterministic checks or an explicitly independent S3* path.

## Integration rule

Prefer supported Pi/GSD TypeScript extension APIs and workflow hooks over patching internal runtime code. If an upstream kernel change becomes necessary, document the missing primitive and attempt an upstreamable change before maintaining a long-lived fork.
