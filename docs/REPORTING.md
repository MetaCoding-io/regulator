# Typed reporting and the VSM event store (M0.3)

VSM-Pi registers three reporting tools alongside its native write/edit gate.
Model inputs contain observations and requests. A trusted host supplies grants,
source/destination/channel, UUID, UTC timestamp, session/unit provenance, and
source revision. Every successful call commits one event to the separate
`.gsd/vsm-runtime/vsm.db` before returning a `persisted` receipt.

## Default authority and explicit host binding

`pnpm pi` registers all three tools but grants **no reporting capabilities**.
An unmapped context fails closed. A trusted host can load an explicit wrapper
using the same `pi -e /absolute/path/to/wrapper.js` mechanism:

```js
import { createVsmPiExtension } from "/absolute/path/to/vsm-pi/packages/pi-extension/dist/index.js";

// Example for a host session deliberately designated as operational S1.
// These values are host configuration, never model input or inferred from prose.
export default createVsmPiExtension({
  resolveReportingContext: (ctx) => ({
    authority: {
      id: "owner-designated-s1",
      capabilities: {
        proposePolicyAs: "S1",
        reportOperationalSignal: true,
      },
    },
    // Optional trusted unit and sourceRevision may also be supplied.
  }),
});
```

Load this wrapper instead of also loading the default extension. The resolver
runs on every tool invocation; a host can look up a grant using the session ID
and revoke it without retaining a capability in model input. The host must
establish the provenance of that lookup. Never derive grants from tool payloads,
conversation text, or a model-selected role name.

The closed host capability object supports only:

| Grant | Resulting message authority |
| --- | --- |
| `proposePolicyAs: "S1"`, `"S3"`, or `"S4"` | That source sends a `proposal` to S5 |
| `reportOperationalSignal: true` | S1 sends an uncertainty `signal` to S3 |
| `reportIndependentAudit: true` | An explicitly designated independent S3* context sends an `audit` to S3 |

An empty capability object denies all reporting. No capability grants S5
mutation permission. The authority ID and grant snapshot are stored with each
event. A later GSD adapter may supply trusted grants through this seam; this
issue adds no functional projection or GSD lifecycle logic.

## Payloads and internal messages

The examples below are fixture reports, not actual findings about the repository.
Complete accepted payloads and host grants live in
[`fixtures/reporting/examples.json`](../fixtures/reporting/examples.json).
Every model-facing object is closed, including each evidence ref. The only
model-facing evidence fields are `class`, `ref`, and optional `observation`.
Evidence may be an empty array except for blocking/critical audit findings.
The requested policy change is text, avoiding arbitrary nested objects at the
provider schema boundary.

### Policy proposal

```json
{
  "subject": "Dependency boundary clarification",
  "rationale": "The existing rule does not explain test-only dependencies.",
  "requestedChange": "Clarify whether test-only adapters may depend on the host SDK.",
  "reportedSeverity": "advisory",
  "evidence": []
}
```

Under `proposePolicyAs: "S1"`, the host creates `kind: "policy-proposal"`,
`source: "S1"`, `channel: "proposal"`, and `destination: "S5"`, with a UUID,
timestamp, content, and provenance. The existing protocol field `severity`
preserves **reported** severity; it is not an effective regulatory severity.
No policy file is written and no approval is implied.

### Independent audit finding

```json
{
  "subject": "Architecture boundary fixture",
  "reportedSeverity": "blocking",
  "invariant": "INV-007",
  "observation": "The fixture describes a forbidden host dependency in core.",
  "evidence": [{ "class": "file", "ref": "fixture/core-example.ts" }]
}
```

An ordinary S1 or unmapped context is denied. With the explicit independent
audit grant, the host creates `kind: "audit-finding"`, `source: "S3*"`,
`channel: "audit"`, and `destination: "S3"`. Empty evidence at blocking/critical
reported severity is rejected before opening the event store. The grant
establishes the reporting context; it does not independently verify the model's
claims. Evidence refs are recorded, not executed or certified by this tool.

### Uncertainty signal

```json
{
  "subject": "Cache invalidation choice",
  "decision": "Use a short TTL while invalidation requirements are unclear.",
  "reason": "The expected freshness bound is unspecified.",
  "alternatives": ["Invalidate on each update", "Disable caching"],
  "consequence": "Users could see stale state.",
  "impact": "high",
  "evidence": [],
  "recommendedFollowUp": "clarification"
}
```

The operational grant produces `kind: "uncertainty-signal"`, `source: "S1"`,
`channel: "signal"`, and `destination: "S3"`. Even `impact: "critical"` does not
make this an algedonic signal. There is no numeric confidence or effective
severity field. Follow-up remains a recommendation; no authoritative consumer,
resolution boundary, escalation, or retry/pause decision is made.

Adding `source`, `destination`, `channel`, `functions`, `capabilities`,
`authority`, `requiredConsumers`, `effectiveSeverity`, `sourceRevision`, or
similar unknown fields fails schema validation, including inside evidence.
The execute handler revalidates input even if the host's initial validation
was bypassed. Constructed internal events also validate against runtime schemas
and the corresponding host grant before insertion.

## SQLite events and receipts

Core uses Node's built-in `node:sqlite` (available in the supported Node runtime),
with WAL, `synchronous=FULL`, a 5-second busy timeout, and explicit transactions.
Node may print an experimental SQLite warning; no native third-party database
package is required. See [Node's SQLite API](https://nodejs.org/api/sqlite.html).

`regulatory_events` has an increasing `sequence` primary key, unique `event_id`,
timestamp/kind/channel/source/destination/subject columns, and canonical
`event_json`. That JSON preserves the complete validated internal message
(including evidence), the host authority snapshot, provenance, and tool name/call
ID. Object keys are sorted when storing JSON. `PRAGMA user_version=1` identifies
the schema. Update/delete triggers enforce append-only use through SQL; the API
exposes only append, deterministic replay, and close.

A stored event has this shape (content abbreviated):

```json
{
  "schemaVersion": 1,
  "message": {
    "id": "<host UUID>", "timestamp": "<host UTC timestamp>",
    "kind": "uncertainty-signal", "source": "S1", "channel": "signal",
    "destination": "S3", "subject": "Cache invalidation choice",
    "decision": "...", "reason": "...", "alternatives": [],
    "consequence": "...", "impact": "high", "evidence": []
  },
  "authority": { "id": "owner-designated-s1", "capabilities": { "reportOperationalSignal": true } },
  "provenance": { "host": "@earendil-works/pi-coding-agent@0.85.1", "sessionId": "<Pi session ID>" },
  "tool": { "name": "vsm_report_uncertainty", "callId": "<Pi tool call ID>" }
}
```

Optional host unit/source revision are stored in provenance; unit also appears
on the message, and source revision is attached to evidence refs. If the host
does not supply a revision, the adapter attempts `git rev-parse HEAD` in the
project root. An unavailable revision is omitted, never invented.

Only after `COMMIT` does the tool return this receipt in both text and details:

```json
{
  "status": "persisted", "eventId": "<same host UUID>", "sequence": 3,
  "timestamp": "<same host UTC timestamp>",
  "kind": "uncertainty-signal", "channel": "signal"
}
```

`RegulatoryEventStore.readAll()` returns `{sequence, event, receipt}` rows in
ascending sequence order after reopening. Ordering does not depend on timestamps.
Receipts keep the same event ID and sequence during replay. Separate successful
tool invocations create separate events; a tool call ID is provenance, not an
idempotency key. The store rejects duplicate event IDs. An open/insert/commit
failure throws and cannot return a success receipt. Transactions roll back on
failure; no JSONL or other competing history is maintained.

The path is fixed relative to the trusted project root. Runtime directory,
database, and SQLite sidecar symlink/hard-link aliases are rejected before open.
The directory must remain host-controlled during operations; preflight path
checks and SQLite triggers are not a sandbox against malicious concurrent
filesystem writers or a process that can change the database schema. This issue
does not expand the native write/edit gate into complete filesystem enforcement.

The store never opens `.gsd/gsd.db`, reads GSD workflow state, or changes S5
artifacts. Later obligation projections can consume these events without adding
another authoritative history. Routing, obligations, and retry/pause control are
not implemented here.

## Reproduce the evidence without a model

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm --filter @metacoding/vsm-pi-protocol test
pnpm --filter @metacoding/vsm-pi-core test
pnpm --filter @metacoding/vsm-pi-extension test
pnpm test
pnpm check
pnpm smoke:reporting
```

The smoke command uses the real supported Pi SDK, explicit test-only grants,
and a temporary project. It prints each accepted model payload, host-derived
message in its reopened SQLite event, and matching receipt. It asserts ordinary
context audit denial and `source: "S5"` payload rejection before recording the
three events. The temporary database is removed afterward. No live model,
credentials, or real GSD database are used. The same smoke function runs in CI.

The trusted `HostReportingContext.runtimeRoot` optionally selects the canonical project root for `.gsd/vsm-runtime/vsm.db`. It defaults to `ctx.cwd` for generic Pi. Git revision discovery continues to use execution `ctx.cwd` (or the explicit host `sourceRevision`), independently of the runtime root. Hosts running isolated units should bind the same canonical runtime root across contexts. Model payloads cannot select this root. Directory creation tolerates concurrent creators and retains post-create symlink checks.
