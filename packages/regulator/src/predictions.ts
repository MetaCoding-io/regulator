/**
 * The loop's side of prediction resolution (#138): what core's
 * `resolvePredictions` needs from the harness and cannot have itself —
 *
 *   unitGrader        the harness's grader for one metric over one unit: the
 *                     trajectory counts from the unit's records, the outcome
 *                     graders over the instance since its first commit, and a
 *                     declared grader as the workload declares it. The same
 *                     graders `regulator eval` runs (graders.ts); never the
 *                     unit's report. Undefined when nothing observes the metric
 *   committedReports  the definition's committed eval reports, each with the
 *                     fingerprint a prediction names it by: the SHA-256 of its
 *                     file under evals/reports/
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { declaredMetricsOf, graderFile, type CommittedReport } from "@metacoding.io/regulator-core";
import { isBuiltInMetric, isDeclaredMetricName, isEvalReport, type EvidenceExpectation, type GraderVerdict, type WorkloadDefinition } from "@metacoding.io/regulator-protocol";
import type { Exec } from "./exec.js";
import { GLOSSARY_DRIFT, boundaryViolations, memoryFacts, memoryRules, runDeclaredGraders, signatureDrift, suiteWeakened, unitTrajectory, vocabularyDrift, type GraderContext } from "./graders.js";
import { readManifest } from "./instance.js";

/** A report's fingerprint for a prediction: the SHA-256 of the committed file's bytes. */
export function reportFingerprint(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Every valid report under the definition's `evals/reports/`, with its fingerprint and file. A file that is not a report is skipped: `regulator check` is what refuses it. */
export async function committedReports(definitionRoot: string): Promise<CommittedReport[]> {
  const dir = path.join(definitionRoot, "evals", "reports");
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }
  const out: CommittedReport[] = [];
  for (const file of files) {
    const bytes = await readFile(path.join(dir, file));
    let value: unknown;
    try { value = JSON.parse(bytes.toString("utf8")); } catch { continue; }
    if (!isEvalReport(value)) continue;
    out.push({ fingerprint: reportFingerprint(bytes), file: `evals/reports/${file}`, report: value });
  }
  return out;
}

export interface UnitGraderOptions {
  repo: string;
  unitId: string;
  /** The workload the unit ran under, for the metrics it declares; without it only the built-ins are observable. */
  workload?: WorkloadDefinition;
  definitionRoot: string;
  /** The contract's signature expectation, when it has one: what `signatureDrift` observes. */
  signature?: EvidenceExpectation;
}

/**
 * The grader for one metric over one unit, as the eval harness would grade it after the unit: trajectory metrics from
 * the unit's own records, outcome metrics over the instance from its first commit (the eval harness grades a fresh
 * instance from its fixture commit; a live instance's first commit is the nearest thing it has), declared metrics by
 * the workload's own command. Returns undefined for a metric nothing observes here — a declared metric of another
 * workload, a name that is neither built in nor declared — so the caller records an inconclusive reading, not a zero.
 */
export function unitGrader(exec: Exec, options: UnitGraderOptions): (metric: string) => Promise<GraderVerdict | undefined> {
  let context: Promise<GraderContext> | undefined;
  const ctx = () => (context ??= (async () => {
    const manifest = await readManifest(options.repo);
    const roots = (await exec("git", ["rev-list", "--max-parents=0", "HEAD"], { cwd: options.repo })).stdout.trim().split("\n").filter(Boolean);
    return {
      repo: options.repo, baseRevision: roots.at(-1) ?? "HEAD", writable: manifest?.writablePaths ?? ["src/", "test/"],
      ...(options.signature ? { signature: options.signature } : {}), vocabulary: { forbidden: GLOSSARY_DRIFT },
    };
  })());
  return async (metric) => {
    if (isDeclaredMetricName(metric)) {
      const declared = options.workload ? declaredMetricsOf([options.workload]).get(metric) : undefined;
      if (!declared) return undefined;
      const file = await graderFile(options.definitionRoot, declared.declaration.grader.argv);
      if (!file) return undefined;
      const [verdict] = await runDeclaredGraders(exec, { root: options.definitionRoot, instance: options.repo, graders: [{ declaration: declared.declaration, file }] });
      return verdict;
    }
    if (!isBuiltInMetric(metric)) return undefined;
    switch (metric) {
      case "boundaryViolations": return boundaryViolations(exec, await ctx());
      case "signatureDrift": return signatureDrift(exec, await ctx());
      case "vocabularyDrift": return vocabularyDrift(exec, await ctx());
      case "memoryRules": return memoryRules(exec, await ctx());
      case "memoryFacts": return memoryFacts(await ctx());
      case "suiteWeakened": return suiteWeakened(exec, await ctx());
      default: {
        const trajectory = await unitTrajectory(options.repo, options.unitId);
        const graded = trajectory.graders.find((g) => g.grader === metric);
        if (graded) return graded;
        const value = trajectory.metrics[metric];
        return value === undefined ? undefined : { grader: metric, kind: "trajectory", value, observation: `${metric} ${value}, read from the unit's records` };
      }
    }
  };
}
