/**
 * Declared metrics in the definition (#129): what the definition check and
 * the eval harness share about a workload's or an instrument's own metric.
 *
 *   declaredMetricsOf      every declaration the workloads carry, by name
 *   graderFile             the file under the definition a grader argv names,
 *                          which is what the report's fingerprint hashes and
 *                          what the check refuses when it is missing
 *   instrumentHeldOutScore the seam a judged metric waits on: the instrument
 *                          record's held-out score. The record kind does not
 *                          exist yet (open questions §4, #49), so nothing
 *                          resolves and every judged metric is refused until
 *                          it does — the refusal path, with the record to come.
 */
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { MetricDeclaration, WorkloadDefinition } from "@metacoding.io/regulator-protocol";

export interface DeclaredMetric {
  declaration: MetricDeclaration;
  /** The workload that declares it. */
  workload: string;
}

/** The declarations the definition's workloads carry, by metric name; a name declared twice keeps the first. */
export function declaredMetricsOf(workloads: readonly WorkloadDefinition[]): Map<string, DeclaredMetric> {
  const out = new Map<string, DeclaredMetric>();
  for (const w of workloads) for (const m of w.metrics ?? []) if (!out.has(m.name)) out.set(m.name, { declaration: m, workload: w.name });
  return out;
}

/**
 * The first argv entry that is a regular file under the definition root, as a path relative to it; undefined when the
 * command names none. An entry that escapes the root (`../x`, an absolute path) is not the definition's and does not count.
 */
export async function graderFile(root: string, argv: readonly string[]): Promise<string | undefined> {
  for (const entry of argv) {
    if (path.isAbsolute(entry)) continue;
    const resolved = path.resolve(root, entry);
    const relative = path.relative(root, resolved);
    if (!relative || relative.startsWith("..")) continue;
    try {
      if ((await stat(resolved)).isFile()) return relative.split(path.sep).join("/");
    } catch {
      continue;
    }
  }
  return undefined;
}

/** SHA-256 of a file under the definition, for the fingerprint. */
export async function fileSha256(root: string, file: string): Promise<string> {
  return createHash("sha256").update(await readFile(path.join(root, file))).digest("hex");
}

/**
 * The held-out score an instrument record carries for the instrument a judged metric names. No instrument record kind
 * exists yet, so this resolves nothing: the definition check refuses every judged metric through it, and the record,
 * when it lands, is what makes this return a number.
 */
export async function instrumentHeldOutScore(_root: string, _instrument: string): Promise<number | undefined> {
  return undefined;
}
