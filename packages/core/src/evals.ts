/**
 * Evaluation arithmetic (lesson 14). Small n is the normal case for agent
 * evals, so the interval uses Student's t rather than a normal
 * approximation, and a comparison between arms reports whether the two
 * intervals separate — a screen, not a significance test. Nothing here
 * interprets a number; a person does, in the report.
 */
import type { ArmSummary, EvalRun, Lift, MetricSummary } from "@metacoding.io/regulator-protocol";

/** Two-sided 97.5% quantiles of Student's t by degrees of freedom; beyond the table the normal value is close enough. */
const T_975: Record<number, number> = {
  1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
  11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131, 16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086,
  21: 2.080, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.060, 26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042,
};

export function tQuantile975(df: number): number {
  if (df < 1) return Number.NaN;
  return T_975[df] ?? (df <= 40 ? 2.021 : df <= 60 ? 2.000 : df <= 120 ? 1.980 : 1.960);
}

export function summarize(values: readonly number[]): MetricSummary {
  const n = values.length;
  if (n === 0) return { n, mean: Number.NaN, sd: Number.NaN, ci95: [Number.NaN, Number.NaN], min: Number.NaN, max: Number.NaN };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = n < 2 ? 0 : Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const half = n < 2 ? 0 : tQuantile975(n - 1) * sd / Math.sqrt(n);
  return { n, mean, sd, ci95: [mean - half, mean + half], min: Math.min(...values), max: Math.max(...values) };
}

/** One summary per arm over the pre-registered metrics, in the order the runs name the arms. */
export function summarizeArms(runs: readonly EvalRun[], metrics: readonly string[]): ArmSummary[] {
  const byArm = new Map<string, EvalRun[]>();
  for (const run of runs) byArm.set(run.arm, [...(byArm.get(run.arm) ?? []), run]);
  return [...byArm.entries()].map(([arm, armRuns]) => ({
    arm,
    runs: armRuns.length,
    metrics: Object.fromEntries(metrics.map((m) => [m, summarize(armRuns.map((r) => r.metrics[m] ?? Number.NaN).filter((v) => !Number.isNaN(v)))])),
  }));
}

/** Each non-baseline arm against the baseline, per metric: the delta of means and whether the intervals separate. */
export function lifts(summaries: readonly ArmSummary[], baseline: string): Lift[] {
  const base = summaries.find((s) => s.arm === baseline);
  if (!base) return [];
  const out: Lift[] = [];
  for (const s of summaries) {
    if (s.arm === baseline) continue;
    for (const [metric, mine] of Object.entries(s.metrics)) {
      const theirs = base.metrics[metric];
      if (!theirs || Number.isNaN(mine.mean) || Number.isNaN(theirs.mean)) continue;
      const separated = mine.ci95[0] > theirs.ci95[1] || mine.ci95[1] < theirs.ci95[0];
      out.push({ arm: s.arm, metric, delta: mine.mean - theirs.mean, separated });
    }
  }
  return out;
}

export function formatSummary(s: MetricSummary, digits = 1): string {
  if (s.n === 0) return "—";
  const f = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(digits));
  return s.n < 2 ? `${f(s.mean)} (n=1)` : `${f(s.mean)} [${f(s.ci95[0])}, ${f(s.ci95[1])}] n=${s.n}`;
}
