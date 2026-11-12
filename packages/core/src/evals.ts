/**
 * Evaluation arithmetic (lesson 14). Small n is the normal case for agent
 * evals, so the interval uses Student's t rather than a normal
 * approximation, and a comparison between arms reports whether the two
 * intervals separate — a screen, not a significance test. Nothing here
 * interprets a number; a person does, in the report.
 */
import { BUILT_IN_METRIC_DIRECTIONS, isBuiltInMetric, isOutcomeMetric, type ArmSummary, type BaselineCheck, type EvalRun, type Lift, type MetricDirection, type MetricSummary, type TaskDifference, type TaskSummary } from "@metacoding.io/regulator-protocol";

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

/** The direction of a metric: a built-in's from the protocol, a declared one's from its declaration, else `none`. */
export function metricDirection(metric: string, declared: Readonly<Record<string, MetricDirection>> = {}): MetricDirection {
  return isBuiltInMetric(metric) ? BUILT_IN_METRIC_DIRECTIONS[metric] : declared[metric] ?? "none";
}

/**
 * The per-task table (#201, eval-driven note §4.1): for each task (in the order the runs name them), each arm's mean over
 * its repetitions per metric, and each non-baseline arm's difference from the baseline on that task, with the arm that
 * leads by the metric's direction. Means only, deliberately: no interval and no `separated` flag, since at three
 * repetitions a per-task mean is three numbers. A metric a run did not observe is left out of that run's mean.
 */
export function taskTable(runs: readonly EvalRun[], metrics: readonly string[], baseline: string, declared: Readonly<Record<string, MetricDirection>> = {}): TaskSummary[] {
  const tasks: string[] = [];
  for (const run of runs) if (!tasks.includes(run.task)) tasks.push(run.task);
  return tasks.map((task) => {
    const arms: string[] = [];
    for (const run of runs) if (run.task === task && !arms.includes(run.arm)) arms.push(run.arm);
    const rows = arms.map((arm) => {
      const mine = runs.filter((r) => r.task === task && r.arm === arm);
      const means: Record<string, number> = {};
      for (const m of metrics) {
        const values = mine.map((r) => r.metrics[m]).filter((v): v is number => v !== undefined && !Number.isNaN(v));
        if (values.length) means[m] = values.reduce((a, b) => a + b, 0) / values.length;
      }
      return { arm, n: mine.length, means };
    });
    const base = rows.find((r) => r.arm === baseline);
    const differences: TaskDifference[] = [];
    if (base) {
      for (const row of rows) {
        if (row.arm === baseline) continue;
        for (const metric of metrics) {
          const mine = row.means[metric], theirs = base.means[metric];
          if (mine === undefined || theirs === undefined) continue;
          const delta = mine - theirs;
          const direction = metricDirection(metric, declared);
          const better = direction === "higher" ? delta > 0 : delta < 0;
          const leads = direction === "none" || delta === 0 ? undefined : better ? row.arm : baseline;
          differences.push({ arm: row.arm, metric, delta, direction, ...(leads ? { leads } : {}) });
        }
      }
    }
    return { task, arms: rows, differences };
  });
}

/**
 * Whether the baseline arm failed at all (#201, eval-driven note §4.2): for each outcome metric the suite pre-registered
 * (`OUTCOME_METRICS`), the baseline's maximum over its runs and whether it is above zero. Undefined when the suite
 * pre-registers no outcome metric or the runs hold no baseline run: the report then cannot say, and says nothing.
 */
export function baselineCheck(runs: readonly EvalRun[], metrics: readonly string[], baseline: string): BaselineCheck | undefined {
  const mine = runs.filter((r) => r.arm === baseline);
  const outcome = metrics.filter(isOutcomeMetric);
  if (!mine.length || !outcome.length) return undefined;
  const rows = outcome.map((metric) => {
    const max = Math.max(0, ...mine.map((r) => r.metrics[metric] ?? 0).filter((v) => !Number.isNaN(v)));
    return { metric, max, failed: max > 0 };
  });
  return { arm: baseline, metrics: rows, discriminates: rows.some((r) => r.failed) };
}

export function formatSummary(s: MetricSummary, digits = 1): string {
  if (s.n === 0) return "—";
  const f = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(digits));
  return s.n < 2 ? `${f(s.mean)} (n=1)` : `${f(s.mean)} [${f(s.ci95[0])}, ${f(s.ci95[1])}] n=${s.n}`;
}
