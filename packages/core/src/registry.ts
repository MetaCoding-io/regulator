/**
 * The regulator registry: one committed, machine-readable record per
 * regulator the harness runs.
 *
 * A record is a regulator's identity card — what failure it absorbs, at which
 * level of the mechanism hierarchy, implemented where, evidenced by which
 * tests, with which limitations, owned by whom, reviewed when. Live state is
 * a projection of the event store, never kept here.
 *
 * `checkRegistry` is the mechanism behind the documentation: a record that
 * points at a missing implementation, cites a test that does not exist, or
 * claims enforcement without stating a boundary fails the check.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { isRegulatorRecord, type RegulatorRecord } from "@metacoding/vsm-pi-protocol";

export interface RegistryProblem {
  file: string;
  message: string;
}

export interface LoadedRegistry {
  records: RegulatorRecord[];
  problems: RegistryProblem[];
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Load every `regulators/*.json` record under `registryDir`, validating shape only. */
export async function loadRegistry(registryDir: string): Promise<LoadedRegistry> {
  const dir = path.join(registryDir, "regulators");
  const records: RegulatorRecord[] = [];
  const problems: RegistryProblem[] = [];
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  for (const file of files) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(path.join(dir, file), "utf8"));
    } catch (error) {
      problems.push({ file, message: `not valid JSON: ${(error as Error).message}` });
      continue;
    }
    if (!isRegulatorRecord(parsed)) {
      problems.push({ file, message: "does not match the regulator record schema" });
      continue;
    }
    records.push(parsed);
  }
  return { records, problems };
}

/**
 * Shape plus substance. `root` is the directory that `mechanism.implementation`
 * and `evidence.tests` paths are relative to.
 */
export async function checkRegistry(registryDir: string, root: string): Promise<LoadedRegistry> {
  const loaded = await loadRegistry(registryDir);
  const seen = new Map<string, string>();
  for (const record of loaded.records) {
    const file = record.id;
    if (seen.has(record.id)) loaded.problems.push({ file, message: `duplicate id (also in ${seen.get(record.id)})` });
    seen.set(record.id, file);
    if (record.status === "retired") continue;
    if (!(await exists(path.join(root, record.mechanism.implementation)))) {
      loaded.problems.push({ file, message: `implementation not found: ${record.mechanism.implementation}` });
    }
    if (record.status === "active" && record.evidence.tests.length === 0) {
      loaded.problems.push({ file, message: "active regulator cites no tests" });
    }
    for (const test of record.evidence.tests) {
      if (!(await exists(path.join(root, test)))) loaded.problems.push({ file, message: `cited test not found: ${test}` });
    }
    if (record.mechanism.level === "deterministic-gate" && !record.limitations?.length) {
      loaded.problems.push({ file, message: "a gate must state at least one limitation (its enforcement boundary)" });
    }
  }
  return loaded;
}

/** Human-readable view, generated so it can never drift from the records. */
export function renderRegistryMarkdown(records: readonly RegulatorRecord[]): string {
  const lines: string[] = [
    "# Regulators",
    "",
    "Generated from `registry/regulators/*.json` by `regulator docs`. Do not edit by hand.",
    "",
    "| ID | Name | Function | Level | Status | Review by |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const r of records) {
    lines.push(`| \`${r.id}\` | ${r.name} | ${r.vsmFunction} | ${r.mechanism.level} | ${r.status} | ${r.ownership.reviewBy} |`);
  }
  for (const r of records) {
    lines.push("", `## ${r.name}`, "", `\`${r.id}\` · ${r.vsmFunction} · ${r.mechanism.level} · ${r.status}${r.introducedIn ? ` · introduced in ${r.introducedIn}` : ""}`, "");
    lines.push(`**Purpose.** ${r.purpose.trim()}`, "");
    lines.push(`**Absorbs.** \`${r.absorbs.failureClass}\` — ${r.absorbs.description.trim()}`, "");
    lines.push(`**Mechanism.** \`${r.mechanism.implementation}\` at ${r.mechanism.enforcementPoints.map((p) => `\`${p}\``).join(", ") || "(none)"}`, "");
    if (r.channels) lines.push(`**Channels.** consumes ${r.channels.consumes.map((c) => `\`${c}\``).join(", ") || "nothing"} · emits ${r.channels.emits.map((c) => `\`${c}\``).join(", ") || "nothing"}`, "");
    if (r.scope) lines.push(`**Scope.** subjects ${r.scope.subjects.join(", ") || "—"} · resources ${r.scope.resources.join(", ") || "—"}`, "");
    if (r.cost) lines.push(`**Cost.** ${r.cost.description.trim()}${r.cost.measured ? ` (measured: ${r.cost.measured})` : ""}`, "");
    if (r.authority) {
      lines.push("**May.**", ...r.authority.may.map((m) => `- ${m}`), "", "**May not.**", ...r.authority.mayNot.map((m) => `- ${m}`), "");
    }
    lines.push(`**Evidence.** ${r.evidence.tests.map((t) => `\`${t}\``).join(", ") || "(none)"}${r.evidence.lastVerifiedRevision ? ` · last verified at \`${r.evidence.lastVerifiedRevision}\`` : ""}`, "");
    if (r.limitations?.length) lines.push("**Limitations.**", ...r.limitations.map((l) => `- ${l}`), "");
    lines.push(`**Ownership.** ${r.ownership.owner} · introduced ${r.ownership.introduced} · review by ${r.ownership.reviewBy}`, "");
    if (r.retirement) lines.push(`**Retirement condition.** ${r.retirement.condition.trim()}`, "");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * The enforcement boundary statement: for every regulator that enforces
 * something, where it enforces and what it does not cover. Generated so a
 * gate cannot gain a limitation the statement does not carry.
 */
export function renderBoundaryMarkdown(records: readonly RegulatorRecord[]): string {
  const gates = records.filter((r) => r.mechanism.level === "deterministic-gate" || r.mechanism.level === "typed-tool" || r.mechanism.level === "type");
  const others = records.filter((r) => !gates.includes(r));
  const lines: string[] = [
    "# Enforcement boundary",
    "",
    "Generated from `registry/regulators/*.json` by `regulator docs`. Do not edit by hand.",
    "",
    "A gate protects the calls that reach it. This statement lists, for every mechanical regulator, where it is",
    "enforced and what it does not cover — the routes around it. A route that is not named here is not known",
    "to be covered. Nothing below is a sandbox: real isolation comes from the operating system or a container.",
    "",
  ];
  for (const r of gates) {
    lines.push(`## ${r.name} (\`${r.id}\`)`, "");
    lines.push(`Enforced at ${r.mechanism.enforcementPoints.map((p) => `\`${p}\``).join(", ") || "(nowhere)"} in \`${r.mechanism.implementation}\`; ${r.vsmFunction}, ${r.mechanism.level}.`, "");
    lines.push("Not covered:", "", ...(r.limitations?.length ? r.limitations.map((l) => `- ${l}`) : ["- (no limitation stated: this record would not pass `regulator check`)"]), "");
  }
  if (others.length) {
    lines.push("## Advice and judgment", "", "These regulators do not enforce; they inform. A rule that only they carry is not enforced.", "");
    for (const r of others) lines.push(`- ${r.name} (\`${r.id}\`, ${r.mechanism.level}): ${r.limitations?.[0] ?? "no limitation stated"}`);
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
