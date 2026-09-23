/**
 * The ledger's own vocabulary: how a period's files are read. Used by the
 * checks under test/ and by nothing the harness dispatches — a unit reads
 * and writes the CSV files, and these functions decide whether it did so
 * correctly.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../", import.meta.url));

function parseCsv(text) {
  const [header, ...lines] = text.trim().split("\n");
  const keys = header.split(",");
  return lines.filter(Boolean).map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(keys.map((k, i) => [k, (cells[i] ?? "").trim()]));
  });
}

export function cents(amount) {
  const n = Math.round(Number(amount) * 100);
  if (!Number.isInteger(n)) throw new Error(`"${amount}" is not an amount`);
  return n;
}

export function money(c) {
  return `${c < 0 ? "-" : ""}${Math.trunc(Math.abs(c) / 100)}.${String(Math.abs(c) % 100).padStart(2, "0")}`;
}

/** Periods that have a statement: `["2026-07", "2026-08"]`. */
export function statementPeriods() {
  return readdirSync(path.join(ROOT, "statements")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, 7)).sort();
}

export function statement(period) {
  const summary = JSON.parse(readFileSync(path.join(ROOT, "statements", `${period}-checking.json`), "utf8"));
  const rows = parseCsv(readFileSync(path.join(ROOT, "statements", `${period}-checking.csv`), "utf8"));
  return { ...summary, rows };
}

export function hasLedger(period) {
  return existsSync(path.join(ROOT, "ledger", `${period}.csv`));
}

/** The period's ledger rows: date, description, amount, category, memo. */
export function ledger(period) {
  return parseCsv(readFileSync(path.join(ROOT, "ledger", `${period}.csv`), "utf8"));
}

export function categories() {
  return JSON.parse(readFileSync(path.join(ROOT, "categories.json"), "utf8"));
}

/** Totals by category, in cents. */
export function totals(rows) {
  const out = new Map();
  for (const row of rows) out.set(row.category, (out.get(row.category) ?? 0) + cents(row.amount));
  return out;
}

export function hasReport(period) {
  return existsSync(path.join(ROOT, "reports", `${period}.md`));
}

/** The totals table a report states, in cents by category. */
export function reportTotals(period) {
  const text = readFileSync(path.join(ROOT, "reports", `${period}.md`), "utf8");
  const out = new Map();
  for (const m of text.matchAll(/^\| ([a-z]+) \| (-?\d+\.\d{2}) \|$/gm)) out.set(m[1], cents(m[2]));
  return out;
}

/** The lines under the report's "Open items" heading: what the close carries forward rather than settles. */
export function reportOpenItems(period) {
  const text = readFileSync(path.join(ROOT, "reports", `${period}.md`), "utf8");
  const after = text.split(/^Open items:/m)[1] ?? "";
  return after.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("- "));
}

export function pendingPayments() {
  const dir = path.join(ROOT, "payments", "pending");
  return readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => ({ file: f, ...JSON.parse(readFileSync(path.join(dir, f), "utf8")) }));
}
