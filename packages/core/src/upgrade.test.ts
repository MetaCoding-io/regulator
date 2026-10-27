import assert from "node:assert/strict";
import test from "node:test";
import type { InstanceManifest } from "@metacoding.io/regulator-protocol";
import { compareVersions, parseChangelog, planUpgrade, renderMigrationNotes, type ChangelogVersion } from "./upgrade.js";

const sha = "b".repeat(64);

const CHANGELOG = `# Changelog

Prose about the format.

## [Unreleased]

### Added
- Something.

### Migration

A sentence a person reads before the bullets; it is not a bullet.

- advice \`advice/<profile>.md\` — gate: check. Advice is a file set (#110); an instance initialized before
  carries no \`regulator/advice/\`, and upgrade seeds it.
- policy \`policies/default.json\` — gate: check. The behavioral canary (#132). Nothing for an instance to do.
- registry \`registry/regulators/prediction-resolution.json\` — gate: scripted ${sha}. A record.

### Changed
- Not a migration bullet.

## [0.1.5] — 2026-11-20

### Fixed
- A thing.

## [0.1.4] — 2026-11-01

### Migration

- workload \`workload/portfolio.json\` — gate: live ${sha}. The portfolio workload.

## [0.1.3] — 2026-09-29

### Migration

Nothing an instance carries changed between 0.1.0 and 0.1.3; a manifest without a package version is read as 0.1.3.

## [0.1.2] — 2026-09-28

### Fixed
- Older.
`;

test("parseChangelog (#53): every version heading, newest first, with its migration note read in the bullet shape — class, path, gate from the closed vocabulary, text with continuation lines joined; prose in the section is not a bullet; other sections are not read", () => {
  const versions = parseChangelog(CHANGELOG);
  assert.deepEqual(versions.map((v) => [v.version, v.migration !== undefined]), [["unreleased", true], ["0.1.5", false], ["0.1.4", true], ["0.1.3", true], ["0.1.2", false]]);
  const head = versions[0]!.migration!;
  assert.equal(head.version, "unreleased");
  assert.deepEqual(head.bullets, [
    { class: "advice", path: "advice/<profile>.md", gate: { kind: "check" }, text: "Advice is a file set (#110); an instance initialized before carries no `regulator/advice/`, and upgrade seeds it." },
    { class: "policy", path: "policies/default.json", gate: { kind: "check" }, text: "The behavioral canary (#132). Nothing for an instance to do." },
    { class: "registry", path: "registry/regulators/prediction-resolution.json", gate: { kind: "scripted", report: sha }, text: "A record." },
  ]);
  assert.deepEqual(versions[2]!.migration!.bullets[0]!.gate, { kind: "live", report: sha });
  assert.deepEqual(versions[3]!.migration, { version: "0.1.3", bullets: [] }, "a section with prose and no bullet is a note with nothing an instance meets");
  assert.deepEqual(parseChangelog("# Changelog\n\nno versions yet\n"), []);
});

test("parseChangelog refuses what it cannot read by name: a bullet outside the shape, a class not in the list, a gate not in the vocabulary or without its fingerprint, a heading that is neither Unreleased nor semver, two Migration sections", () => {
  const under = (body: string) => `## [0.2.0] — 2026-12-01\n\n### Migration\n\n${body}\n`;
  assert.throws(() => parseChangelog(under("- advice: the files moved")), /\[0\.2\.0\] § Migration: a bullet does not fit the shape/);
  assert.throws(() => parseChangelog(under("- fixture `fixture/` — gate: check. Moved.")), /"fixture" is not a class a migration bullet describes \(identity, policy, workload, profile, advice, registry\)/);
  assert.throws(() => parseChangelog(under("- advice `advice/x.md` — gate: eval. Moved.")), /does not fit the shape/);
  assert.throws(() => parseChangelog(under("- advice `advice/x.md` — gate: scripted. Moved.")), /does not fit the shape/, "scripted and live name the report");
  assert.throws(() => parseChangelog(under("- advice `advice/x.md` — gate: scripted abc. Moved.")), /does not fit the shape/);
  assert.throws(() => parseChangelog(under("- advice `advice/x.md` — gate: check.")), /does not fit the shape/, "a bullet says what changed");
  assert.throws(() => parseChangelog("## [v0.2.0]\n"), /heading "\[v0\.2\.0\]" is neither \[Unreleased\] nor a semver version/);
  assert.throws(() => parseChangelog(`${under("- advice `advice/x.md` — gate: check. A.")}\n### Migration\n\n- advice \`advice/y.md\` — gate: check. B.\n`), /\[0\.2\.0\]: two "### Migration" sections/);
  assert.equal(compareVersions("0.1.10", "0.1.9") > 0, true);
  assert.equal(compareVersions("0.2.0", "0.10.0") < 0, true);
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
});

const changelog: ChangelogVersion[] = parseChangelog(CHANGELOG);
const REV = (n: string) => n.repeat(40);
function manifest(packageVersion: string | undefined, harnessRevision = REV("0")): InstanceManifest {
  return { version: 1, definition: { root: "/srv/def", name: "regulator", registry: 43, harnessRevision, pi: "0.87.0", ...(packageVersion ? { packageVersion } : {}) }, initializedAt: "2026-09-29T12:00:00.000Z", initializedBy: "alice" };
}
const seeded = { absent: {}, ignored: true };
const unseeded = { absent: { advice: ["implement.md", "auditor.md"] }, ignored: false };

test("planUpgrade (#53): one version behind crosses one note, and nothing else is read; the steps are the closed list, each reported whether it applies or not", () => {
  const released = changelog.filter((v) => v.version !== "unreleased").map((v) => v.version === "0.1.5" ? { ...v, migration: { version: "0.1.5", bullets: [] } } : v);
  const one = planUpgrade({ manifest: manifest("0.1.4"), installed: { packageVersion: "0.1.5", harnessRevision: REV("5") }, definitionRoot: "/srv/def", changelog: released, instance: seeded });
  assert.equal(one.outcome, "upgrade");
  if (one.outcome !== "upgrade") return;
  assert.deepEqual([one.from, one.to, one.fromUnversioned], [{ packageVersion: "0.1.4", harnessRevision: REV("0") }, { packageVersion: "0.1.5", harnessRevision: REV("5") }, false]);
  assert.deepEqual(one.crossed.map((n) => n.version), ["0.1.5"], "0.1.4's note is behind the instance and 0.1.5 is the installed version");
  assert.deepEqual(one.steps.map((s) => [s.step, s.apply]), [["seed", false], ["seed", false], ["ignore", false]]);
});

test("planUpgrade: a version between from and to whose heading carries no Migration section is refused by name; an installed version the changelog has no section for is refused; an instance ahead of the installed package is refused", () => {
  const noSection = planUpgrade({ manifest: manifest("0.1.3"), installed: { packageVersion: "0.1.5", harnessRevision: REV("5") }, definitionRoot: "/srv/def", changelog, instance: seeded });
  assert.deepEqual(noSection, { outcome: "refused", reason: 'CHANGELOG.md [0.1.5] carries no "### Migration" section, and the instance crosses it (0.1.3 → 0.1.5); the note is written before an instance can be upgraded through the version' });
  const unknown = planUpgrade({ manifest: manifest("0.1.3"), installed: { packageVersion: "0.1.6", harnessRevision: REV("6") }, definitionRoot: "/srv/def", changelog, instance: seeded });
  assert.deepEqual(unknown, { outcome: "refused", reason: "CHANGELOG.md has no section for the installed version 0.1.6; a release carries its heading and its migration note" });
  const ahead = planUpgrade({ manifest: manifest("0.1.5"), installed: { packageVersion: "0.1.4", harnessRevision: REV("4") }, definitionRoot: "/srv/def", changelog, instance: seeded });
  assert.deepEqual(ahead, { outcome: "refused", reason: "the instance is ahead of the installed definition: initialized or upgraded under 0.1.5, and the installed package is 0.1.4; install the newer package before running upgrade" });
  assert.equal(planUpgrade({ manifest: manifest("0.1.3"), installed: { packageVersion: "0.1", harnessRevision: REV("4") }, definitionRoot: "/srv/def", changelog, instance: seeded }).outcome, "refused");
  assert.equal(planUpgrade({ manifest: manifest("0.1.3"), installed: { packageVersion: "0.1.4", harnessRevision: REV("4") }, definitionRoot: "/srv/def", changelog: [], instance: seeded }).outcome, "refused");
});

test("planUpgrade: two versions behind, with the unreleased head on top — the notes come oldest first, the seed step names the absent files and the ignore step applies; a manifest without a package version is read as the floor (the oldest version with a note) and the plan says so", () => {
  const released = changelog.map((v) => v.version === "0.1.5" ? { ...v, migration: { version: "0.1.5", bullets: [] } } : v);
  const two = planUpgrade({ manifest: manifest("0.1.3"), installed: { packageVersion: "0.1.5", harnessRevision: REV("5") }, definitionRoot: "/srv/def/", changelog: released, instance: unseeded });
  assert.equal(two.outcome, "upgrade");
  if (two.outcome !== "upgrade") return;
  assert.deepEqual(two.crossed.map((n) => [n.version, n.bullets.length]), [["0.1.4", 1], ["0.1.5", 0], ["unreleased", 3]], "0.1.5 is the latest release and the head beyond it carries a note, so the head is crossed too");
  assert.deepEqual(two.steps, [
    { step: "seed", class: "identity", seed: "/srv/def/identity/", instance: "regulator/identity/", files: [], apply: false },
    { step: "seed", class: "advice", seed: "/srv/def/advice/", instance: "regulator/advice/", files: ["auditor.md", "implement.md"], apply: true },
    { step: "ignore", apply: true },
  ]);
  const floor = planUpgrade({ manifest: manifest(undefined), installed: { packageVersion: "0.1.4", harnessRevision: REV("4") }, definitionRoot: "/srv/def", changelog: released, instance: seeded });
  assert.equal(floor.outcome, "upgrade");
  if (floor.outcome !== "upgrade") return;
  assert.deepEqual([floor.from.packageVersion, floor.fromUnversioned, floor.crossed.map((n) => n.version)], ["0.1.3", true, ["0.1.4"]]);
  assert.deepEqual(floor.steps.map((s) => s.apply), [false, false, false], "nothing absent: the steps are reported and none applies");
  const noFloor = planUpgrade({ manifest: manifest(undefined), installed: { packageVersion: "0.1.4", harnessRevision: REV("4") }, definitionRoot: "/srv/def", changelog: released.map((v) => ({ version: v.version })), instance: seeded });
  assert.equal(noFloor.outcome, "refused");
  assert.match((noFloor as { reason: string }).reason, /carries no package version and CHANGELOG.md carries no migration note to read it as/);
  assert.equal(renderMigrationNotes(two.crossed, REV("5")), [
    "## 0.1.4",
    "  - workload workload/portfolio.json [gate: live report bbbbbbbbbbbb…]",
    "    The portfolio workload.",
    "## 0.1.5",
    "  nothing an instance carries changed",
    "## unreleased (head 5555555)",
    "  - advice advice/<profile>.md [gate: regulator check only]",
    "    Advice is a file set (#110); an instance initialized before carries no `regulator/advice/`, and upgrade seeds it.",
    "  - policy policies/default.json [gate: regulator check only]",
    "    The behavioral canary (#132). Nothing for an instance to do.",
    "  - registry registry/regulators/prediction-resolution.json [gate: scripted report bbbbbbbbbbbb…]",
    "    A record.",
  ].join("\n"));
});

test("planUpgrade: current — the instance is at the installed version and revision with nothing absent, so a second run changes nothing and says so; at the same version with the head moved and no unreleased note, also current; at the same version with the head moved and a note, the head is crossed once per head", () => {
  const released = changelog.map((v) => v.version === "0.1.5" ? { ...v, migration: { version: "0.1.5", bullets: [] } } : v);
  const same = planUpgrade({ manifest: manifest("0.1.5", REV("5")), installed: { packageVersion: "0.1.5", harnessRevision: REV("5") }, definitionRoot: "/srv/def", changelog: released, instance: seeded });
  assert.deepEqual(same, { outcome: "current", from: { packageVersion: "0.1.5", harnessRevision: REV("5") }, detail: "the instance is at 0.1.5 (5555555), which is the installed definition; nothing to do" });
  const moved = planUpgrade({ manifest: manifest("0.1.5", REV("5")), installed: { packageVersion: "0.1.5", harnessRevision: REV("6") }, definitionRoot: "/srv/def", changelog: released.filter((v) => v.version !== "unreleased"), instance: seeded });
  assert.equal(moved.outcome, "current");
  assert.match((moved as { detail: string }).detail, /no migration note between the two; nothing to do/);
  const head = planUpgrade({ manifest: manifest("0.1.5", REV("5")), installed: { packageVersion: "0.1.5", harnessRevision: REV("6") }, definitionRoot: "/srv/def", changelog: released, instance: seeded });
  assert.equal(head.outcome, "upgrade");
  if (head.outcome !== "upgrade") return;
  assert.deepEqual(head.crossed.map((n) => n.version), ["unreleased"]);
  // A seed file absent at the same point is still seeded: the step is idempotent and never overwrites, so the plan applies it and the history records a same-point entry.
  const absent = planUpgrade({ manifest: manifest("0.1.5", REV("5")), installed: { packageVersion: "0.1.5", harnessRevision: REV("5") }, definitionRoot: "/srv/def", changelog: released, instance: { absent: { advice: ["manager.md"] }, ignored: true } });
  assert.equal(absent.outcome, "upgrade");
  if (absent.outcome !== "upgrade") return;
  assert.deepEqual([absent.crossed, absent.steps.filter((s) => s.apply)], [[], [{ step: "seed", class: "advice", seed: "/srv/def/advice/", instance: "regulator/advice/", files: ["manager.md"], apply: true }]]);
});
