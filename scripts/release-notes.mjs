#!/usr/bin/env node
/**
 * Prints one version's section of the changelog, as the body of its GitHub release.
 *
 *   node scripts/release-notes.mjs 0.1.3        the section under `## [0.1.3] — <date>`
 *   node scripts/release-notes.mjs v0.1.3       the same; a tag name is accepted
 *
 * The changelog (`packages/regulator/CHANGELOG.md`) is the one place a release is described; the GitHub release
 * is that section and a link back to it, never a second account. Exits 1, naming the version, when the changelog
 * has no section for it, so a release is not published with an empty body.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const CHANGELOG = fileURLToPath(new URL("../packages/regulator/CHANGELOG.md", import.meta.url));
const REPO = "https://github.com/MetaCoding-io/regulator";

/** The section's text between its heading and the next `## [`, trimmed; undefined when the version has no heading. */
export function sectionOf(changelog, version) {
  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
  if (start === -1) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## ["));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = (process.argv[2] ?? "").replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+$/.test(version)) { console.error("usage: release-notes.mjs <version>   (0.1.3 or v0.1.3)"); process.exit(2); }
  const section = sectionOf(await readFile(CHANGELOG, "utf8"), version);
  if (!section) { console.error(`the changelog has no section for ${version}: add "## [${version}] — <date>" to packages/regulator/CHANGELOG.md in the release commit`); process.exit(1); }
  console.log(`${section}\n\n---\n\nAll six packages are published to npm at ${version}. The full changelog: ${REPO}/blob/v${version}/packages/regulator/CHANGELOG.md`);
}
