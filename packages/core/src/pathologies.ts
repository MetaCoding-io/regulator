/**
 * The pathology catalog (#57): `registry/pathologies.json`, one row per characteristic
 * failure of the whole arrangement, naming the regulators that absorb it by registry id.
 * The rows render into `docs/PATHOLOGIES.md` between marker comments and into the
 * viability case's residual uncertainty, so "what nothing absorbs yet" is stated once.
 *
 * `checkPathologies` is the mechanism: a row that names a regulator the registry does
 * not hold, or holds as retired, fails the registry check; an active record no row
 * names is a warning, since a new regulator's failure class may still be a row to add.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PATHOLOGY_SECTIONS, isPathologiesFile, isPathologyRow, type AbsorbedBy, type PathologyRow, type PathologySection, type RegulatorRecord } from "@metacoding.io/regulator-protocol";
import type { RegistryProblem } from "./registry.js";

export const PATHOLOGIES_FILE = "pathologies.json";

export interface LoadedPathologies {
  rows: PathologyRow[];
  problems: RegistryProblem[];
}

/** Load `registry/pathologies.json`, validating shape only. A registry without the file carries no rows and no problem. */
export async function loadPathologies(registryDir: string): Promise<LoadedPathologies> {
  const file = PATHOLOGIES_FILE;
  let text: string;
  try {
    text = await readFile(path.join(registryDir, file), "utf8");
  } catch {
    return { rows: [], problems: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { rows: [], problems: [{ file, message: `not valid JSON: ${(error as Error).message}` }] };
  }
  if (!isPathologiesFile(parsed)) {
    // Name the first row that fails, since a catalog is edited one row at a time.
    const rows = (parsed as { rows?: unknown })?.rows;
    const at = Array.isArray(rows) ? rows.findIndex((r) => !isPathologyRow(r)) : -1;
    const id = at >= 0 ? (rows as Array<{ id?: unknown }>)[at]?.id : undefined;
    const where = at >= 0 ? ` (row ${at + 1}${typeof id === "string" ? `, \`${id}\`` : ""})` : "";
    return { rows: [], problems: [{ file, message: `does not match the pathology row schema${where}` }] };
  }
  return { rows: parsed.rows, problems: [] };
}

/**
 * Substance: every regulator a row names is an active record (a retired or proposed one is named as such), row ids
 * are unique, and — as a warning — every active record is named by some row.
 */
export function checkPathologies(rows: readonly PathologyRow[], records: readonly RegulatorRecord[]): { problems: RegistryProblem[]; warnings: RegistryProblem[] } {
  const file = PATHOLOGIES_FILE;
  const problems: RegistryProblem[] = [];
  const warnings: RegistryProblem[] = [];
  const byId = new Map(records.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const named = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) problems.push({ file, message: `duplicate row id \`${row.id}\`` });
    seen.add(row.id);
    for (const { id } of row.absorbedBy.regulators) {
      const record = byId.get(id);
      if (!record) problems.push({ file, message: `row \`${row.id}\` names \`${id}\`, which is not a registry record` });
      else if (record.status !== "active") problems.push({ file, message: `row \`${row.id}\` names \`${id}\`, which is ${record.status}: a pathology is absorbed by an active regulator or by nothing` });
      else named.add(id);
    }
  }
  const unnamed = records.filter((r) => r.status === "active" && !named.has(r.id)).map((r) => r.id);
  if (rows.length && unnamed.length) {
    warnings.push({ file, message: `${unnamed.length} active regulator(s) absorb a failure class no pathology row names: ${unnamed.join(", ")}` });
  }
  return { problems, warnings };
}

/** `closeout-gate`: a record's short name, as the prose names it — its card's file stem, or the id's own name segment when no file is known. */
export function regulatorShortName(id: string, shortNames?: ReadonlyMap<string, string>): string {
  return shortNames?.get(id) ?? id.split(".")[2] ?? id;
}

function listed(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** The "Absorbed by" cell: the regulators (with their notes) and the modules that build them, then the invariants, then each free note as a clause of its own. */
export function renderAbsorbedBy(absorbedBy: AbsorbedBy, shortNames?: ReadonlyMap<string, string>): string {
  let head = listed(absorbedBy.regulators.map((r) => `\`${regulatorShortName(r.id, shortNames)}\`${r.note ? ` (${r.note})` : ""}`));
  if (absorbedBy.modules.length) head += `${head ? " " : ""}(${absorbedBy.modules.join(", ")})`;
  if (absorbedBy.invariants.length) head += `${head ? ", and " : ""}${listed(absorbedBy.invariants)}`;
  return [head, ...absorbedBy.notes].filter(Boolean).join("; ") || "—";
}

const cell = (text: string | undefined): string => (text ?? "—").replaceAll("|", "\\|");

/** One section's table, rows in file order. The agent-specific section has the MAST shape; the other three the catalog's five columns. */
export function renderPathologyTable(section: PathologySection, rows: readonly PathologyRow[], shortNames?: ReadonlyMap<string, string>): string {
  const own = rows.filter((r) => r.section === section);
  const lines: string[] = [];
  if (section === "agent") {
    lines.push("| MAST category | This project's name for it | Absorbed by | Reproduced by |", "| --- | --- | --- | --- |");
    for (const r of own) lines.push(`| ${cell(r.name)} | ${cell(r.summary)} | ${cell(renderAbsorbedBy(r.absorbedBy, shortNames))} | ${cell(r.reproducedBy)} |`);
  } else {
    lines.push(`| Pathology (${PATHOLOGY_SECTIONS[section].attribution}) | In an instance it looks like | Absorbed by | Reproduced by (course module) | Not absorbed |`, "| --- | --- | --- | --- | --- |");
    for (const r of own) {
      lines.push(`| **${cell(r.name)}**${r.summary ? `: ${cell(r.summary)}` : ""} | ${cell(r.looksLike)} | ${cell(renderAbsorbedBy(r.absorbedBy, shortNames))} | ${cell(r.reproducedBy)} | ${cell(r.notAbsorbed)} |`);
    }
  }
  return lines.join("\n");
}

/** The marker pair a page carries around each rendered table: `<!-- pathologies:structural -->` … `<!-- /pathologies -->`. */
export function pathologyMarker(section: PathologySection): string {
  return `<!-- pathologies:${section} -->`;
}
export const PATHOLOGY_END_MARKER = "<!-- /pathologies -->";

/**
 * Re-render every marked table in `markdown` from `rows`, leaving the prose around them as it is. A page missing a
 * section's marker pair is refused by name, so a table cannot quietly stop being rendered.
 */
export function splicePathologyTables(markdown: string, rows: readonly PathologyRow[], shortNames?: ReadonlyMap<string, string>): string {
  let out = markdown;
  for (const section of Object.keys(PATHOLOGY_SECTIONS) as PathologySection[]) {
    const begin = pathologyMarker(section);
    const start = out.indexOf(begin);
    if (start < 0) throw new Error(`no ${begin} marker in the page`);
    const end = out.indexOf(PATHOLOGY_END_MARKER, start + begin.length);
    if (end < 0) throw new Error(`no ${PATHOLOGY_END_MARKER} after ${begin}`);
    out = `${out.slice(0, start + begin.length)}\n${renderPathologyTable(section, rows, shortNames)}\n${out.slice(end)}`;
  }
  return out;
}
