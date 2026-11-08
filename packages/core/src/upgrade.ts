/**
 * A definition upgrade for an instance (#53), Pi-free and file-free:
 *
 *   parseChangelog   the definition's CHANGELOG.md read for its version
 *                    headings and the "### Migration" section under each —
 *                    one bullet per definition change in a closed shape
 *                    (`MigrationBulletSchema`), refused by name when a bullet
 *                    does not fit
 *   planUpgrade      the plan, a pure function of the manifest, the installed
 *                    definition, the parsed changelog and what the instance
 *                    lacks: which versions are crossed (each must carry a
 *                    section, or the plan is refused), the closed list of
 *                    mechanical steps to apply, and the bullets to print for
 *                    a person. Nothing is applied from a bullet's text.
 *
 * The CLI (`regulator upgrade`) reads the files, applies the steps, commits,
 * and rewrites the manifest; this decides what it would do.
 */
import { DEFINITION_WRITERS, MIGRATION_CLASSES, type DefinitionPoint, type DefinitionWriterClass, type InstanceManifest, type MigrationBullet, type MigrationGate, type MigrationNote } from "@metacoding.io/regulator-protocol";

export interface ChangelogVersion {
  /** `unreleased`, or the semver the heading names. Newest first, as the changelog orders them. */
  version: "unreleased" | string;
  /** The "### Migration" section under the heading, when there is one. A version without one cannot be crossed. */
  migration?: MigrationNote;
}

const HEADING = /^## \[([^\]]+)\]/;
const SEMVER = /^\d+\.\d+\.\d+$/;
const BULLET = /^- ([a-z]+) `([^`]+)` — gate: (check|none|scripted [0-9a-f]{64}|live [0-9a-f]{64})\. (.+)$/;

function parseGate(spelled: string): MigrationGate {
  const [kind, report] = spelled.split(" ");
  if (kind === "scripted" || kind === "live") return { kind, report: report! };
  return { kind: kind as "check" | "none" };
}

function parseBullet(version: string, joined: string): MigrationBullet {
  const m = BULLET.exec(joined);
  if (!m) throw new Error(`CHANGELOG.md [${version}] § Migration: a bullet does not fit the shape \`- <class> \`<path>\` — gate: <check | none | scripted <sha256> | live <sha256>>. <text>\`: "${joined.slice(0, 80)}${joined.length > 80 ? "…" : ""}"`);
  const [, cls, path, gate, text] = m;
  if (!(MIGRATION_CLASSES as readonly string[]).includes(cls!)) throw new Error(`CHANGELOG.md [${version}] § Migration: "${cls}" is not a class a migration bullet describes (${MIGRATION_CLASSES.join(", ")})`);
  return { class: cls as MigrationBullet["class"], path: path!, gate: parseGate(gate!), text: text!.trim() };
}

/**
 * Every version heading of a Keep-a-Changelog file, newest first, with its migration note where the section exists.
 * Refuses a heading that is neither `[Unreleased]` nor `[x.y.z]`, and a migration bullet outside the shape.
 */
export function parseChangelog(text: string): ChangelogVersion[] {
  const out: ChangelogVersion[] = [];
  let current: ChangelogVersion | undefined;
  let inMigration = false;
  let bullets: string[] | undefined;
  let open: string | undefined;
  const closeBullet = () => {
    if (open !== undefined && bullets) bullets.push(open);
    open = undefined;
  };
  const closeSection = () => {
    closeBullet();
    if (inMigration && current && bullets) current.migration = { version: current.version as MigrationNote["version"], bullets: bullets.map((b) => parseBullet(current!.version, b)) };
    inMigration = false;
    bullets = undefined;
  };
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const heading = HEADING.exec(line);
    if (heading) {
      closeSection();
      const name = heading[1]!;
      const version = name.toLowerCase() === "unreleased" ? "unreleased" : name;
      if (version !== "unreleased" && !SEMVER.test(version)) throw new Error(`CHANGELOG.md: heading "[${name}]" is neither [Unreleased] nor a semver version`);
      current = { version };
      out.push(current);
      continue;
    }
    if (/^#{1,3} /.test(line)) {
      closeSection();
      if (current && /^### Migration\s*$/.test(line)) {
        if (current.migration) throw new Error(`CHANGELOG.md [${current.version}]: two "### Migration" sections`);
        inMigration = true;
        bullets = [];
      }
      continue;
    }
    if (!inMigration) continue;
    if (line.startsWith("- ")) { closeBullet(); open = line; continue; }
    if (open !== undefined && /^\s+\S/.test(line)) { open = `${open} ${line.trim()}`; continue; }
    closeBullet();
    // Anything else inside the section is prose a person reads (a sentence saying nothing an instance carries changed); it is not a bullet.
  }
  closeSection();
  return out;
}

/** Numeric semver order: negative when a is older than b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** What the instance lacks that upgrade may seed, read by the caller from the two trees: files of each class's seed directory absent from the instance's copy. */
export interface InstanceSnapshot {
  absent: Partial<Record<DefinitionWriterClass, readonly string[]>>;
  /** Whether `.gitignore` already carries the `.regulator/` line. */
  ignored: boolean;
}

export type UpgradeStep =
  /** Copy the named files of the definition's seed directory into the instance's directory; never a file that exists there. */
  | { step: "seed"; class: DefinitionWriterClass; seed: string; instance: string; files: string[]; apply: boolean }
  /** Append `.regulator/` to `.gitignore`. */
  | { step: "ignore"; apply: boolean };

export type UpgradePlan =
  | { outcome: "refused"; reason: string }
  /** Nothing crossed and nothing absent: a second run of upgrade on the same instance. */
  | { outcome: "current"; from: DefinitionPoint; detail: string }
  | {
      outcome: "upgrade";
      from: DefinitionPoint;
      to: DefinitionPoint;
      /** True when the manifest carried no package version and was read as the migration floor. */
      fromUnversioned: boolean;
      /** The versions crossed, oldest first, each with its note: what upgrade prints and never applies. */
      crossed: MigrationNote[];
      steps: UpgradeStep[];
    };

export interface PlanUpgradeOptions {
  manifest: InstanceManifest;
  /** The definition as installed: its package.json version and its git revision. */
  installed: DefinitionPoint;
  definitionRoot: string;
  changelog: readonly ChangelogVersion[];
  instance: InstanceSnapshot;
}

/** The mechanical steps, from the closed list; each is reported whether or not it applies. */
function steps(definitionRoot: string, instance: InstanceSnapshot): UpgradeStep[] {
  const out: UpgradeStep[] = [];
  for (const w of DEFINITION_WRITERS) {
    if (!w.instance) continue;
    const files = [...(instance.absent[w.class] ?? [])].sort();
    out.push({ step: "seed", class: w.class, seed: `${definitionRoot.replace(/\/$/, "")}/${w.seed[0]}`, instance: w.instance, files, apply: files.length > 0 });
  }
  out.push({ step: "ignore", apply: !instance.ignored });
  return out;
}

/**
 * What `regulator upgrade` would do. Refuses an instance ahead of the installed package, an installed version the
 * changelog has no section for, and a version between the two whose heading carries no "### Migration" section. A
 * manifest without a package version is read as the floor: the oldest released version that carries a note.
 */
export function planUpgrade(options: PlanUpgradeOptions): UpgradePlan {
  const { manifest, installed, changelog } = options;
  const refused = (reason: string): UpgradePlan => ({ outcome: "refused", reason });
  if (!SEMVER.test(installed.packageVersion)) return refused(`the installed definition's version "${installed.packageVersion}" is not semver`);
  const released = changelog.filter((v) => v.version !== "unreleased").sort((a, b) => compareVersions(b.version, a.version));
  const latest = released[0];
  if (!latest) return refused("CHANGELOG.md names no released version; nothing to upgrade across");
  const unreleased = changelog.find((v) => v.version === "unreleased");

  let fromVersion = manifest.definition.packageVersion;
  const fromUnversioned = fromVersion === undefined;
  if (fromVersion === undefined) {
    const floor = [...released].reverse().find((v) => v.migration);
    if (!floor) return refused("the manifest carries no package version and CHANGELOG.md carries no migration note to read it as; the floor is the oldest version with a \"### Migration\" section");
    fromVersion = floor.version;
  }
  const from: DefinitionPoint = { packageVersion: fromVersion, harnessRevision: manifest.definition.harnessRevision };
  const to: DefinitionPoint = { packageVersion: installed.packageVersion, harnessRevision: installed.harnessRevision };
  if (compareVersions(from.packageVersion, to.packageVersion) > 0) return refused(`the instance is ahead of the installed definition: initialized or upgraded under ${from.packageVersion}, and the installed package is ${to.packageVersion}; install the newer package before running upgrade`);
  if (!released.some((v) => v.version === to.packageVersion)) return refused(`CHANGELOG.md has no section for the installed version ${to.packageVersion}; a release carries its heading and its migration note`);

  const crossed: MigrationNote[] = [];
  const between = released.filter((v) => compareVersions(v.version, from.packageVersion) > 0 && compareVersions(v.version, to.packageVersion) <= 0).reverse();
  for (const v of between) {
    if (!v.migration) return refused(`CHANGELOG.md [${v.version}] carries no "### Migration" section, and the instance crosses it (${from.packageVersion} → ${to.packageVersion}); the note is written before an instance can be upgraded through the version`);
    crossed.push(v.migration);
  }
  const atHead = to.packageVersion === latest.version && unreleased?.migration !== undefined;
  const samePoint = from.packageVersion === to.packageVersion && from.harnessRevision === to.harnessRevision;
  if (atHead && !samePoint) crossed.push(unreleased!.migration!);

  const planned = steps(options.definitionRoot, options.instance);
  if (crossed.length === 0 && !planned.some((s) => s.apply)) {
    return { outcome: "current", from, detail: samePoint ? `the instance is at ${from.packageVersion} (${from.harnessRevision.slice(0, 7)}), which is the installed definition; nothing to do` : `the instance is at ${from.packageVersion}; the installed definition is ${to.packageVersion} at ${to.harnessRevision.slice(0, 7)} with no migration note between the two; nothing to do` };
  }
  return { outcome: "upgrade", from, to, fromUnversioned, crossed, steps: planned };
}

/** The bullets of every version crossed, as text for a person: a heading per version, the gate each change passed, and the note's words. */
export function renderMigrationNotes(crossed: readonly MigrationNote[], headRevision?: string): string {
  const lines: string[] = [];
  for (const note of crossed) {
    lines.push(`## ${note.version === "unreleased" ? `unreleased${headRevision ? ` (head ${headRevision.slice(0, 7)})` : ""}` : note.version}`);
    if (!note.bullets.length) lines.push("  nothing an instance carries changed");
    for (const b of note.bullets) {
      const gate = b.gate.kind === "scripted" || b.gate.kind === "live" ? `${b.gate.kind} report ${b.gate.report.slice(0, 12)}…` : b.gate.kind === "check" ? "regulator check only" : "none";
      lines.push(`  - ${b.class} ${b.path} [gate: ${gate}]`, `    ${b.text}`);
    }
  }
  return lines.join("\n");
}
