/**
 * The instance manifest (lesson 15): what `regulator init` writes into a
 * repository so the harness knows which definition runs it and what a
 * person declared about the project's layout. Harness-owned, under
 * `.regulator/`, written by a person at init — and rewritten by `regulator
 * upgrade` (#53), the only other writer — never project content, so the
 * trust rule (lesson 10) is intact: the project's own files still say
 * nothing to the harness.
 */
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";

const NonEmpty = Type.String({ minLength: 1 });
const Prefix = Type.String({ pattern: "^[^/\\\\][^\\\\]*/$" });
const Semver = Type.String({ pattern: "^\\d+\\.\\d+\\.\\d+$" });
const Sha256 = Type.String({ pattern: "^[0-9a-f]{64}$" });

/** Where an instance stood: the definition's package version and git revision. */
export const DefinitionPointSchema = Type.Object({
  packageVersion: Semver,
  harnessRevision: NonEmpty,
}, { additionalProperties: false });
export type DefinitionPoint = Static<typeof DefinitionPointSchema>;

/**
 * One run of `regulator upgrade` (#53): from where to where, which committed eval report the target revision was
 * checked against (the SHA-256 of its file under `evals/reports/`, the fingerprint convention of #138, or `none`),
 * who ran it and when. Appended by upgrade, read by `doctor`; never edited.
 */
export const UpgradeEntrySchema = Type.Object({
  from: DefinitionPointSchema,
  to: DefinitionPointSchema,
  /** The fingerprint of a committed report whose `fingerprint.harnessRevision` is the target's, or "none" when no report was run at that revision. */
  report: Type.Union([Type.Literal("none"), Sha256]),
  /** The report's file under the definition, when there is one. */
  reportFile: Type.Optional(NonEmpty),
  by: NonEmpty,
  at: NonEmpty,
}, { additionalProperties: false });
export type UpgradeEntry = Static<typeof UpgradeEntrySchema>;

export const InstanceManifestSchema = Type.Object({
  version: Type.Literal(1),
  definition: Type.Object({
    /** Absolute path of the definition this instance runs under. */
    root: NonEmpty,
    name: NonEmpty,
    /** Registry records and the harness revision at init: what "the definition" meant that day. */
    registry: Type.Integer({ minimum: 0 }),
    harnessRevision: NonEmpty,
    /** The Pi version the definition pins. */
    pi: NonEmpty,
    /**
     * The definition's package version at init or at the last upgrade (#53). Absent on a manifest written before the
     * field existed; `regulator upgrade` reads such a manifest as the changelog's migration floor and writes the field.
     */
    packageVersion: Type.Optional(Semver),
  }, { additionalProperties: false }),
  /** Prefixes a unit may write under in this project, when the profile's defaults do not fit its layout. Declared by a person, not discovered. */
  writablePaths: Type.Optional(Type.Array(Prefix)),
  /** Prefixes protected in this project beyond the identity and what the conventions discover. */
  protectedPaths: Type.Optional(Type.Array(Prefix)),
  initializedAt: NonEmpty,
  initializedBy: NonEmpty,
  /** Every upgrade the instance has been through, oldest first. Absent until the first. */
  upgrades: Type.Optional(Type.Array(UpgradeEntrySchema)),
}, { additionalProperties: false });
export type InstanceManifest = Static<typeof InstanceManifestSchema>;

export function isInstanceManifest(value: unknown): value is InstanceManifest {
  return Value.Check(InstanceManifestSchema, value);
}

/**
 * The migration note (#53): a "### Migration" section under a version heading of the definition's CHANGELOG.md, one
 * bullet per definition change, each naming the evidence it landed on in a closed vocabulary. `regulator upgrade`
 * prints the bullets of every version it crosses; it applies nothing read from them. The parser is core's.
 */

/** What kind of definition file a bullet describes. */
export const MIGRATION_CLASSES = ["identity", "policy", "workload", "profile", "advice", "registry", "contract"] as const;
export type MigrationClass = (typeof MIGRATION_CLASSES)[number];

/**
 * The gate a definition change passed before it landed: `check` (`regulator check` only), `scripted` (a committed
 * eval report over scripted units, by fingerprint), `live` (a committed live report, by fingerprint) or `none`.
 */
export const MIGRATION_GATES = ["check", "scripted", "live", "none"] as const;
export type MigrationGateKind = (typeof MIGRATION_GATES)[number];

export const MigrationGateSchema = Type.Union([
  Type.Object({ kind: Type.Union([Type.Literal("check"), Type.Literal("none")]) }, { additionalProperties: false }),
  Type.Object({ kind: Type.Union([Type.Literal("scripted"), Type.Literal("live")]), report: Sha256 }, { additionalProperties: false }),
]);
export type MigrationGate = Static<typeof MigrationGateSchema>;

export const MigrationBulletSchema = Type.Object({
  class: Type.Union(MIGRATION_CLASSES.map((c) => Type.Literal(c))),
  /** The definition file or set the change is to, as the note spells it (`advice/<profile>.md`, `policies/default.json`). */
  path: NonEmpty,
  gate: MigrationGateSchema,
  /** What changed and what an instance does about it, verbatim from the note. */
  text: NonEmpty,
}, { additionalProperties: false });
export type MigrationBullet = Static<typeof MigrationBulletSchema>;

export const MigrationNoteSchema = Type.Object({
  /** The changelog version the section sits under; `unreleased` for the head beyond the last release. */
  version: Type.Union([Type.Literal("unreleased"), Semver]),
  bullets: Type.Array(MigrationBulletSchema),
}, { additionalProperties: false });
export type MigrationNote = Static<typeof MigrationNoteSchema>;

export function isMigrationNote(value: unknown): value is MigrationNote {
  return Value.Check(MigrationNoteSchema, value);
}

/**
 * Where an instance keeps its state: every path under `.regulator/` the harness writes, as a closed list (#153),
 * so a registry record's `scope.resources` can name a store the instance actually keeps and nothing else, a figure
 * can draw the records column from the records, and "who writes where" is a query over the registry rather than a
 * drawing. A workspace is under the directory but is not a record. A new store is added here in the same change
 * that writes it; a test holds the list against the path constants and against a run's `.regulator/`.
 */
export interface InstanceStore {
  /** The path relative to the base checkout; a directory ends in `/` and covers everything under it. */
  readonly path: string;
  readonly name: string;
  readonly kind: "record" | "workspace" | "manifest";
  readonly description: string;
}

export const INSTANCE_STORES: readonly InstanceStore[] = [
  { path: ".regulator/instance.json", name: "the instance manifest", kind: "manifest", description: "what `regulator init` wrote: the definition and its version, the Pi pin, the layout a person declared" },
  { path: ".regulator/units/", name: "the execution store", kind: "record", description: "one directory per unit: the unit record (the only mutable file), the contract, the report, one line per attempt and one per recovery decision" },
  { path: ".regulator/leases/", name: "the leases", kind: "record", description: "one file per held lease on a worktree, with its owner and expiry" },
  { path: ".regulator/signals.ndjson", name: "the regulatory log", kind: "record", description: "signals, the obligations they became, dispositions and prediction resolutions; append-only" },
  { path: ".regulator/audit.ndjson", name: "the audit log", kind: "record", description: "host-run evidence, technical verdicts and human acceptances, each bound to a revision; append-only" },
  { path: ".regulator/memory.ndjson", name: "operational memory", kind: "record", description: "facts a unit recorded with `remember`, each with provenance and an expiry; append-only, never identity" },
  { path: ".regulator/effects.ndjson", name: "the effect journal", kind: "record", description: "a side effect intended before it happens, committed after, reconciled on restart; append-only" },
  { path: ".regulator/trace.ndjson", name: "the trace", kind: "record", description: "the session's gated events as the extension records them" },
  { path: ".regulator/outbox", name: "the outbox", kind: "record", description: "what is owed to a person, one delivery per line, forwarded by the watcher" },
  { path: ".regulator/outbox.cursor", name: "the outbox cursor", kind: "record", description: "how far the watcher has forwarded the outbox" },
  { path: ".regulator/events.db", name: "the event store", kind: "record", description: "the SQLite regulatory event store" },
  { path: ".regulator/worktrees/", name: "the worktrees", kind: "workspace", description: "a unit's isolated checkout: domain output, not a record" },
  { path: ".regulator/trials/", name: "the trial merges", kind: "workspace", description: "the pre-merge trial's checkout of the merged tree, verified before a reintegration lands" },
];

/** The store a path under `.regulator/` belongs to: the file itself, or the directory it is under. */
export function instanceStoreFor(resource: string): InstanceStore | undefined {
  return INSTANCE_STORES.find((s) => (s.path.endsWith("/") ? resource === s.path || resource.startsWith(s.path) : resource === s.path));
}
