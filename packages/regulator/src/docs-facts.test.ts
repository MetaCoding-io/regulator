/**
 * Counts in prose, held against the code (the docs currency audit, §6).
 *
 * A hand-written page that says how many regulators, session extensions, built-in metrics or committed reports
 * there are is a second copy of something the repository enumerates, and nothing compared the two: ten places
 * gave five different regulator counts. This test reads every count of those kinds in the pages a person keeps
 * and refuses one that is not what the registry, the Pi host's manifest, `EVAL_METRICS` and `evals/reports/` say.
 *
 * The pages read are the ones that describe the present. The roadmap, the changelog, the debt ledger and the
 * research and archive directories are records of a time and are not read; the generated pages cannot disagree.
 */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { EVAL_METRICS } from "@metacoding.io/regulator-protocol";

const labRoot = fileURLToPath(new URL("../", import.meta.url));
const repoRoot = path.join(labRoot, "../..");

const UNITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** A count as a page writes it: digits, or a number word up to ninety-nine. Undefined for any other word. */
export function countOf(word: string): number | undefined {
  const w = word.toLowerCase();
  if (/^\d+$/.test(w)) return Number(w);
  const unit = UNITS.indexOf(w);
  if (unit !== -1) return unit;
  const [tens, ones] = w.split("-");
  const t = TENS.indexOf(tens ?? "");
  if (t < 2) return undefined;
  if (ones === undefined) return t * 10;
  const o = UNITS.indexOf(ones);
  return o >= 1 && o <= 9 ? t * 10 + o : undefined;
}

async function markdownUnder(dir: string, skip: readonly string[]): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (skip.includes(entry.name) || entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await markdownUnder(full, skip)));
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

async function pagesAPersonKeeps(): Promise<string[]> {
  const packages = (await readdir(path.join(repoRoot, "packages"), { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => path.join(repoRoot, "packages", e.name, "README.md"));
  const candidates = [
    path.join(repoRoot, "README.md"), path.join(repoRoot, "AGENTS.md"), path.join(repoRoot, "CONTRIBUTING.md"), path.join(labRoot, "OPERATING.md"), ...packages,
    ...(await markdownUnder(path.join(repoRoot, "docs"), ["research", "archive", "generated", "decisions", "DEBT.md"])),
  ];
  const present = await Promise.all(candidates.map((file) => readFile(file, "utf8").then(() => file, () => undefined)));
  return present.filter((file): file is string => file !== undefined).sort();
}

test("a count a page states is the count the repository has: regulators, registry records, session extensions, built-in metrics and committed reports", async () => {
  const records = await Promise.all((await readdir(path.join(labRoot, "registry", "regulators"))).filter((f) => f.endsWith(".json")).map(async (f) => JSON.parse(await readFile(path.join(labRoot, "registry", "regulators", f), "utf8")) as { status: string }));
  const total = records.length;
  const active = records.filter((r) => r.status === "active").length;
  const manifest = JSON.parse(await readFile(path.join(repoRoot, "packages", "regulator-pi", "package.json"), "utf8")) as { pi: { extensions: string[] } };
  const extensions = manifest.pi.extensions.length;
  const builtIns = EVAL_METRICS.length;
  const reports = (await readdir(path.join(labRoot, "evals", "reports"))).filter((f) => f.endsWith(".json")).length;

  // Each rule: what a sentence must look like to be a count of that thing, and the numbers it may state. A count
  // below ten beside "regulators" is prose about a few of them ("two regulators disagree"), not the registry's size.
  const N = "(\\d+|[A-Za-z]+(?:-[a-z]+)?)";
  const rules: { what: string; pattern: RegExp; allowed: number[]; floor: number }[] = [
    { what: "active regulators", pattern: new RegExp(`\\b${N} active regulators?\\b`, "g"), allowed: [active], floor: 10 },
    { what: "regulators", pattern: new RegExp(`\\b${N} regulators?\\b`, "g"), allowed: [total, active], floor: 10 },
    { what: "registry records", pattern: new RegExp(`\\bregistry of ${N} records\\b|\\b${N} records in the registry\\b|\\bregistry \\(${N}(?: records)?\\)`, "g"), allowed: [total], floor: 10 },
    { what: "session extensions", pattern: new RegExp(`\\b${N} session extensions\\b`, "g"), allowed: [extensions], floor: 2 },
    { what: "built-in metrics", pattern: new RegExp(`\\b${N} built-ins\\b|\\b${N} built-in (?:eval |trajectory )?metrics\\b`, "g"), allowed: [builtIns], floor: 2 },
    { what: "committed reports", pattern: new RegExp(`\\b${N} committed (?:drift |eval |drift-scenario )?reports\\b`, "g"), allowed: [reports], floor: 2 },
  ];

  const wrong: string[] = [];
  let read = 0;
  for (const file of await pagesAPersonKeeps()) {
    const lines = (await readFile(file, "utf8")).split("\n");
    for (const [i, line] of lines.entries()) {
      for (const rule of rules) {
        for (const match of line.matchAll(rule.pattern)) {
          const word = match.slice(1).find((g) => g !== undefined);
          const count = word === undefined ? undefined : countOf(word);
          if (count === undefined || count < rule.floor) continue;
          read += 1;
          if (!rule.allowed.includes(count)) wrong.push(`${path.relative(repoRoot, file)}:${i + 1} says ${word} ${rule.what}; the repository has ${rule.allowed.join(" or ")}`);
        }
      }
    }
  }
  assert.deepEqual(wrong, [], "every count a page states is the repository's; correct the page (or, when the count is of something else, reword the sentence so it does not read as this one)");
  assert.ok(read >= 5, `the rules still read counts off the pages (read ${read}); a rule that matches nothing guards nothing`);
});

test("a number word reads as its number", () => {
  assert.deepEqual(["53", "twelve", "forty-two", "fifty", "twenty-eight", "ninety-nine"].map(countOf), [53, 12, 42, 50, 28, 99]);
  assert.deepEqual(["active", "the", "twenty-zero", "one-two"].map(countOf), [undefined, undefined, undefined, undefined]);
});
