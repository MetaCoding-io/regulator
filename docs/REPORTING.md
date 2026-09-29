# Typed reporting and the VSM event store

regulator registers three reporting tools alongside its native write/edit gate. The
division of responsibility between model and host is fixed. Model inputs contain
observations and requests. A trusted host supplies everything that carries authority or
provenance: the grants, the source, destination and channel, the UUID, the UTC timestamp,
the session and unit provenance, and the source revision. Every successful call commits
one event to the separate `.regulator/events.db` before it returns a `persisted` receipt.
That database has lived beside the instance's other records since lesson 15; the GSD-era
`.gsd/vsm-runtime/vsm.db` path is gone.

## Default authority and explicit host binding

These three tools make up the generic reporting extension, and they sit outside a unit's
session: the eleven extensions the Pi host declares do not include them, and a unit
reports through `report_result` instead ([session tools](reference/tools.md)). The
repository's root `pnpm pi` script registers all three but grants no reporting
capabilities, so under that script every reporting call is denied. An unmapped context
fails closed. A trusted host that wants to grant something loads an explicit wrapper,
using the same `pi -e /absolute/path/to/wrapper.js` mechanism:

```js
import { createRegulatorPiExtension } from "/absolute/path/to/vsm-pi/packages/regulator-pi/dist/write-gate.js";

// Example for a host session deliberately designated as operational S1.
// These values are host configuration, never model input or inferred from prose.
export default createRegulatorPiExtension({
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

Load this wrapper in place of the default extension; do not load both. The resolver runs
on every tool invocation, so a host can look up a grant by session ID on each call and
revoke it later, and no capability ever has to be kept in model input. The host must
establish the provenance of that lookup itself. Never derive grants from tool payloads,
conversation text, or a model-selected role name.

The closed host capability object supports only these grants:

| Grant | Resulting message authority |
| --- | --- |
| `proposePolicyAs: "S1"`, `"S3"`, or `"S4"` | That source sends a `proposal` to S5 |
| `reportOperationalSignal: true` | S1 sends an uncertainty `signal` to S3 |
| `reportIndependentAudit: true` | An explicitly designated independent S3* context sends an `audit` to S3 |

An empty capability object denies all reporting, and no capability grants permission to
mutate S5. The authority ID and the grant snapshot are stored with each event, so the
record shows under which grant it was made. A host that runs units (the course lab's
orchestrator) supplies grants through this seam. The tools themselves add no routing.

## Payloads and internal messages

The examples below are fixture reports; they make no actual finding about the repository.
Complete accepted payloads, with the host grants that accept them, live in
[`fixtures/reporting/examples.json`](../fixtures/reporting/examples.json).
Every model-facing object is closed, including each evidence ref, so an unknown field is
a validation failure rather than an extra. The only model-facing evidence fields are
`class`, `ref`, and an optional `observation`. Evidence may be an empty array, except for
audit findings at blocking or critical severity. The requested policy change is plain
text, which keeps arbitrary nested objects away from the provider schema boundary.

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
`source: "S1"`, `channel: "proposal"`, and `destination: "S5"`, and adds the UUID,
timestamp, content, and provenance. The existing protocol field `severity` holds the
severity the reporter claimed; an effective regulatory severity would be a separate
judgment, and this tool does not make it. No policy file is written and no approval is
implied.

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

An ordinary S1 or unmapped context is denied. With the explicit independent audit grant,
the host creates `kind: "audit-finding"`, `source: "S3*"`, `channel: "audit"`, and
`destination: "S3"`. Empty evidence at blocking or critical reported severity is rejected
before the event store is opened. The grant establishes the reporting context and nothing
more: it does not verify the model's claims. This tool records evidence refs; it neither
executes nor certifies them.

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
`channel: "signal"`, and `destination: "S3"`. Even `impact: "critical"` does not make
this an algedonic signal; it stays on the `signal` channel. There is no numeric confidence
field and no effective severity field. The follow-up remains a recommendation. The tool
names no authoritative consumer, sets no resolution boundary, and makes no escalation or
retry/pause decision.

Adding `source`, `destination`, `channel`, `functions`, `capabilities`, `authority`,
`requiredConsumers`, `effectiveSeverity`, `sourceRevision`, or a similar unknown field
fails schema validation, including inside evidence. The execute handler revalidates its
input even when the host's initial validation was bypassed. The internal event the host
constructs is validated again, against the runtime schemas and against the corresponding
host grant, before it is inserted.

## SQLite events and receipts

Core uses Node's built-in `node:sqlite`, which is available in the supported Node runtime,
with WAL, `synchronous=FULL`, a 5-second busy timeout, and explicit transactions. Node may
print an experimental SQLite warning. No native third-party database package is required.
See [Node's SQLite API](https://nodejs.org/api/sqlite.html).

The `regulatory_events` table has an increasing `sequence` primary key, a unique
`event_id`, columns for timestamp, kind, channel, source, destination and subject, and a
canonical `event_json`. That JSON preserves the complete validated internal message,
including its evidence, together with the host authority snapshot, the provenance, and the
tool name and call ID. Object keys are sorted when the JSON is stored, so the same event
always serializes the same way. `PRAGMA user_version=1` identifies the schema. Update and
delete triggers enforce append-only use at the SQL level, and the API exposes only append,
deterministic replay, and close.

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
  "provenance": { "host": "@earendil-works/pi-coding-agent@0.87.0", "sessionId": "<Pi session ID>" },
  "tool": { "name": "vsm_report_uncertainty", "callId": "<Pi tool call ID>" }
}
```

The optional host unit and source revision are stored in provenance. The unit also appears
on the message, and the source revision is attached to each evidence ref. If the host does
not supply a revision, the adapter attempts `git rev-parse HEAD` in the project root. A
revision that cannot be found is omitted; the adapter never invents one.

Only after `COMMIT` does the tool return this receipt, in both text and details:

```json
{
  "status": "persisted", "eventId": "<same host UUID>", "sequence": 3,
  "timestamp": "<same host UTC timestamp>",
  "kind": "uncertainty-signal", "channel": "signal"
}
```

`RegulatoryEventStore.readAll()` returns `{sequence, event, receipt}` rows in ascending
sequence order after the store is reopened. That ordering comes from the sequence column
and does not depend on timestamps. Receipts keep the same event ID and sequence during
replay. Separate successful tool invocations create separate events, because a tool call
ID is provenance and the store does not use it as an idempotency key. The store does
reject duplicate event IDs. A failure to open, insert or commit throws, and a call that
throws cannot return a success receipt. Transactions roll back on failure, and no JSONL or
other competing history is maintained.

The path is fixed relative to the trusted project root. Symlink and hard-link aliases of
the runtime directory, the database, and the SQLite sidecar files are rejected before the
database is opened. The directory must remain host-controlled while the store operates.
The preflight path checks and the SQLite triggers are not a sandbox: they do not defend
against a malicious concurrent filesystem writer or a process that can change the database
schema. This store does not expand the native write/edit gate into complete filesystem
enforcement.

The store never changes S5 artifacts. Routing, obligations, and retry/pause control are
not implemented here. The control plane's router and obligation ledger fold the
instance's regulatory log, `.regulator/signals.ndjson`, and they do not read this store.
The span projection (lesson 14) reads both into one set of spans, so the two histories are
correlated without being merged (`docs/DEBT.md` rows 1 and 31, paid).

## Reproduce the evidence without a model

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm --filter @metacoding.io/regulator-protocol test
pnpm --filter @metacoding.io/regulator-core test
pnpm --filter @metacoding.io/regulator-pi test
pnpm test
pnpm check
pnpm smoke:reporting
```

The smoke command uses the real supported Pi SDK, explicit test-only grants, and a
temporary project. For each of the three tools it prints the accepted model payload, the
host-derived message as read back from its reopened SQLite event, and the matching
receipt. Before it records those three events it asserts that an ordinary context is
denied an audit and that a payload carrying `source: "S5"` is rejected. The temporary
database is removed afterward. No live model or credentials are used, and the same smoke
function runs in CI.

The trusted `HostReportingContext.runtimeRoot` optionally selects the canonical project
root that `.regulator/events.db` lives under. For generic Pi it defaults to `ctx.cwd`. Git
revision discovery still uses the execution `ctx.cwd` (or the explicit host
`sourceRevision`), independently of the runtime root. Hosts that run isolated units should
bind the same canonical runtime root across contexts, so that every unit's events land in
the one store. Model payloads cannot select this root. Directory creation tolerates
concurrent creators and keeps the post-create symlink checks.
