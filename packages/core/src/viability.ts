/**
 * The viability case (#57): the document a team hands to whoever must trust an
 * instance, rendered from the registry so that what it claims is what the records
 * state. It follows the course capstone's seven items in order. Five are rendered
 * here — the system map, the mechanism ledger, the enforcement boundary (by link and
 * count), the evidence and the residual uncertainty — and two, the channel table and
 * the boundary critique, are a team's own judgment and stay as headed placeholders.
 *
 * `REGULATORS.md` is the cards; `BOUNDARY.md` is what the gates do not cover. This is
 * the third rendering, the argument: which function each mechanism serves, what would
 * switch it off, what evidence stands behind it, and what nothing absorbs yet.
 */
import { PATHOLOGY_SECTIONS, enforcementPointName, type MechanismLevel, type PathologyRow, type RegulatorRecord, type VsmSystem } from "@metacoding.io/regulator-protocol";
import { regulatorShortName } from "./pathologies.js";

/** An eval arm that switches one regulator off, as a suite declares it (`ablates`, `switch`). */
export interface AblationArm {
  suite: string;
  arm: string;
  ablates?: string;
  switch?: string;
}

export interface ViabilityOptions {
  /** The pathology catalog's rows: the residual uncertainty is their "not absorbed" column. */
  pathologies: readonly PathologyRow[];
  /** Record id → card file stem, from `loadRegistry`; the id's own name segment when absent. */
  shortNames?: ReadonlyMap<string, string>;
  /** The arms every suite under `evals/` declares, so the evidence section can name the arm that ablates a record. */
  arms?: readonly AblationArm[];
}

const FUNCTIONS: ReadonlyArray<{ id: VsmSystem; role: string }> = [
  { id: "S1", role: "operations: the units that do the work" },
  { id: "S2", role: "coordination between units" },
  { id: "S3", role: "operational control: the loop, its contracts, budgets and routing" },
  { id: "S3*", role: "audit: evidence the unit does not control" },
  { id: "S4", role: "intelligence: the environment and the future" },
  { id: "S5", role: "identity and policy: who may change what the system is" },
];
const MECHANISM_LEVELS: readonly MechanismLevel[] = ["type", "deterministic-gate", "typed-tool"];
const JUDGMENT_LEVELS: readonly MechanismLevel[] = ["model-judgment", "prompt"];
const LEVEL_ORDER: readonly MechanismLevel[] = [...MECHANISM_LEVELS, ...JUDGMENT_LEVELS];

const escape = (text: string): string => text.replaceAll("|", "\\|").replace(/\s+/g, " ").trim();

function byLevel(records: readonly RegulatorRecord[], levels: readonly MechanismLevel[], short: (id: string) => string): string {
  const groups = levels
    .map((level) => ({ level, ids: records.filter((r) => r.mechanism.level === level).map((r) => `\`${short(r.id)}\``) }))
    .filter((g) => g.ids.length);
  return groups.map((g) => `${g.level}: ${g.ids.join(", ")}`).join(" · ") || "—";
}

/** The viability case, from the active records and the pathology rows. Retired records are history and appear in the ledger's count only. */
export function renderViabilityMarkdown(records: readonly RegulatorRecord[], options: ViabilityOptions): string {
  const short = (id: string): string => regulatorShortName(id, options.shortNames);
  const active = records.filter((r) => r.status === "active");
  const retired = records.filter((r) => r.status === "retired");
  const rows = options.pathologies;
  const arms = options.arms ?? [];
  const lines: string[] = [
    "# Viability case",
    "",
    "Generated from `registry/regulators/*.json` and `registry/pathologies.json` by `regulator docs`. Do not edit by hand.",
    "",
    "This is the case for trusting an instance of the reference build: not what the harness can do, but how it is regulated,",
    "where each rule is enforced, what evidence stands behind each regulator, and what nothing absorbs yet. It is the",
    "artifact the course's capstone asks a team to produce for a harness of their own, in the capstone's order: a system",
    "map, a channel table, a mechanism ledger, an enforcement boundary statement, the evidence, the residual uncertainty and",
    "a boundary critique. Five of the seven are rendered from the registry below. The channel table and the boundary",
    "critique are a team's own judgment, so they stand as headed placeholders: a deployment copies this file beside its",
    "instance, completes those two sections there, and regenerates the rest when its definition changes.",
    "",
    "[`REGULATORS.md`](registry/REGULATORS.md) is the cards and [`BOUNDARY.md`](BOUNDARY.md) is what the gates do not cover; this",
    "page cites both rather than repeating them. The pathologies behind section 6 are catalogued in",
    "[`docs/PATHOLOGIES.md`](../../docs/PATHOLOGIES.md), rendered from the same rows.",
    "",
  ];

  // 1. System map.
  lines.push("## 1. System map", "",
    "Where each VSM function lives, and whether it is held by mechanism (a type, a deterministic gate or a typed tool) or by",
    "judgment (a model's judgment or prompt advice). A function held only by judgment is advised, not regulated.", "",
    "| Function | Mechanism | Judgment |", "| --- | --- | --- |");
  for (const fn of FUNCTIONS) {
    const own = active.filter((r) => r.vsmFunction === fn.id);
    const note = fn.id === "S1" && own.length === 0 ? "none: the units are S1, and what regulates them is listed under S2, S3 and S3\\*" : byLevel(own, MECHANISM_LEVELS, short);
    lines.push(`| **${fn.id.replace("*", "\\*")}** — ${fn.role} | ${note} | ${fn.id === "S1" && own.length === 0 ? "—" : byLevel(own, JUDGMENT_LEVELS, short)} |`);
  }
  const mechanismCount = active.filter((r) => MECHANISM_LEVELS.includes(r.mechanism.level)).length;
  lines.push("", `${active.length} active regulators: ${mechanismCount} mechanism, ${active.length - mechanismCount} judgment.${retired.length ? ` ${retired.length} retired record${retired.length === 1 ? "" : "s"} stay${retired.length === 1 ? "s" : ""} in the registry as history and appear${retired.length === 1 ? "s" : ""} nowhere below.` : ""}`, "");

  // 2. Channel table: a team's own.
  lines.push("## 2. Channel table", "",
    "*A team's own; not rendered.* The capstone asks for every message that crosses a boundary of the system, with its type,",
    "the authority it carries, its destination, and whether it can mutate policy. The registry holds what each regulator",
    "consumes and emits, not the system's channels, so this table is written by hand.", "",
    "| Message | Type | Authority | Destination | Mutates policy |", "| --- | --- | --- | --- | --- |", "| — | — | — | — | — |", "");

  // 3. Mechanism ledger.
  lines.push("## 3. Mechanism ledger", "",
    "Each regulator, the failure class it absorbs, the level of the mechanism hierarchy it holds that rule at, and where it",
    "bites; the last column counts the limitations its card states, which section 4 reads. The capstone also asks why a rule",
    "is not enforced one level higher; the registry has no field for that, so the card's purpose and limitations are where",
    "the reasoning lives, and a team states it here for its own rules.", "",
    "| Regulator | Absorbs | Level | Enforced at | Switch | Limitations |", "| --- | --- | --- | --- | --- | --- |");
  for (const r of active) {
    const points = r.mechanism.enforcementPoints.map((p) => `\`${enforcementPointName(p)}\``).join(", ") || "not stated";
    lines.push(`| \`${short(r.id)}\` | \`${r.absorbs.failureClass}\` | ${r.mechanism.level} | ${points} | ${r.ablation ? `\`${r.ablation.switch}\`` : "not stated"} | ${r.limitations?.length ?? 0} |`);
  }
  lines.push("", "### What switches each one off, and when it may go", "",
    "The ablation switch is the eval arm that runs with the regulator off, and the retirement condition is the evidence under",
    "which it would be removed. A regulator whose switch is `none` cannot be shown to help by ablation; its note says why.", "");
  for (const r of active) {
    const ablation = r.ablation ? `\`${r.ablation.switch}\` — ${escape(r.ablation.note)}` : "not stated";
    lines.push(`- **${r.name}** (\`${short(r.id)}\`). Ablation: ${ablation} Retirement condition: ${r.retirement ? escape(r.retirement.condition) : "not stated"}`);
  }
  lines.push("");

  // 4. Enforcement boundary.
  const limitationCount = active.reduce((n, r) => n + (r.limitations?.length ?? 0), 0);
  const enforcing = active.filter((r) => MECHANISM_LEVELS.includes(r.mechanism.level));
  lines.push("## 4. Enforcement boundary", "",
    `The statement is [\`BOUNDARY.md\`](BOUNDARY.md), rendered from the same records: for every mechanical regulator, where it is`,
    "enforced and the routes around it, with the accept paths of the definition. This case carries the count, not a second",
    `copy: ${limitationCount} stated limitations across ${active.length} active regulators, of which ${enforcing.length} enforce and ${active.length - enforcing.length} advise or judge,`,
    "counted per regulator in the ledger's last column. A gate with no stated limitation does not pass `regulator check`, so a",
    "count of zero there is an advice or judgment record, and a limitation that names later work has a row in",
    "[`docs/DEBT.md`](../../docs/DEBT.md).", "");

  // 5. Evidence.
  const suites = [...new Set(arms.map((a) => a.suite))];
  const armSummary = suites.map((suite) => {
    const own = arms.filter((a) => a.suite === suite);
    const ablating = own.filter((a) => a.ablates);
    return `the \`${suite}\` suite declares ${own.length} arms, ${ablating.length} of them ablation arms`;
  });
  lines.push("## 5. Evidence", "",
    "Two kinds of evidence stand behind the registry. The tests a card cites run under `pnpm check` at every revision and show",
    "the mechanism does what the card says, without a model. The eval harness compares arms over a scenario — control",
    "against treatment, and a treatment with one regulator off against the full treatment — and that is the evidence that a",
    `regulator helps.${armSummary.length ? ` In the definition, ${armSummary.join("; ")}.` : ""}`, "",
    "**No ablation result is reported here.** The live report over the drift scenario is [#46](https://github.com/MetaCoding-io/regulator/issues/46)'s",
    "work and is not yet committed. The committed reports ran scripted units, so they validate the graders and say nothing",
    "about a model ([`docs/DEBT.md`](../../docs/DEBT.md) row 33). When the live report lands, the ablation column below is where",
    "its per-arm lift belongs; until then the honest entry is that the arm exists and has not been run live.", "",
    "| Regulator | Tests cited | Last verified revision | Ablation arm |", "| --- | --- | --- | --- |");
  for (const r of active) {
    const tests = r.evidence.tests.map((t) => `\`${t}\``).join(", ") || "not stated";
    const own = arms.filter((a) => a.ablates === r.id);
    let arm: string;
    if (own.length) arm = own.map((a) => `\`${a.arm}\` (${a.suite})`).join(", ");
    else if (!r.ablation) arm = "not stated";
    else if (r.ablation.switch === "none") arm = "none";
    else arm = `switch \`${r.ablation.switch}\`; no arm declares it`;
    lines.push(`| \`${short(r.id)}\` | ${tests} | ${r.evidence.lastVerifiedRevision ? `\`${r.evidence.lastVerifiedRevision}\`` : "not stated"} | ${arm} |`);
  }
  const unverified = active.filter((r) => !r.evidence.lastVerifiedRevision).length;
  if (unverified) lines.push("", `${unverified === active.length ? "No record" : `${active.length - unverified} of ${active.length} records`} states a last verified revision; the tests run at every revision under \`pnpm check\`, and the field is where a record would name the one a person verified.`);
  lines.push("");

  // 6. Residual uncertainty.
  const residual = rows.filter((r) => r.notAbsorbed);
  const unabsorbed = rows.filter((r) => r.absorbedBy.regulators.length === 0);
  const named = new Set(rows.flatMap((r) => r.absorbedBy.regulators.map((g) => g.id)));
  const uncatalogued = active.filter((r) => !named.has(r.id));
  lines.push("## 6. Residual uncertainty", "",
    "What nothing absorbs yet, from the pathology catalog's \"not absorbed\" column: for each characteristic way a viable",
    "system fails, the part of it the registry does not cover. Where a row names an issue or a debt row, that is what would",
    "resolve it; a row that names none is unscheduled. The open rows of [`docs/DEBT.md`](../../docs/DEBT.md) are the scheduled",
    "part of this list and are linked, not copied: a debt row is what the build owes, and the catalog says what it costs.", "",
    "| Pathology | Not absorbed |", "| --- | --- |");
  for (const r of residual) lines.push(`| **${escape(r.name)}** (${PATHOLOGY_SECTIONS[r.section].title.toLowerCase()}) | ${escape(r.notAbsorbed!)} |`);
  lines.push("");
  if (unabsorbed.length) {
    lines.push(`${unabsorbed.length === 1 ? "One row has" : `${unabsorbed.length} rows have`} no regulator at all: ${unabsorbed.map((r) => `**${escape(r.name)}**`).join(", ")}. By the catalog's reading order that is a failure the lab can name and reproduce but has not built the mechanism for.`, "");
  }
  if (uncatalogued.length) {
    lines.push(`${uncatalogued.length} active regulator${uncatalogued.length === 1 ? "" : "s"} absorb${uncatalogued.length === 1 ? "s" : ""} a failure class no pathology row names, so the catalog does not say what each would cost to lose: ${uncatalogued.map((r) => `\`${short(r.id)}\` (\`${r.absorbs.failureClass}\`)`).join(", ")}. \`regulator check\` warns on each until a row names it.`, "");
  }

  // 7. Boundary critique: a team's own.
  lines.push("## 7. Boundary critique", "",
    "*A team's own; not rendered.* The capstone asks who defined \"viable\" and who pays for it, in four answers of a sentence",
    "each after Ulrich's critical systems heuristics: who may define or amend the system's purpose, and by which path in the",
    "definition; who is affected by its decisions but cannot challenge one; what work its success metric conceals; and under",
    "what condition the system itself, not a regulator, should be retired.", "",
    "- Who may define or amend the purpose, and by which path: —",
    "- Who is affected but cannot challenge a decision: —",
    "- What the success metric conceals: —",
    "- When the system itself should be retired: —");
  return `${lines.join("\n").trimEnd()}\n`;
}
