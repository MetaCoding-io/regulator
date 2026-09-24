/**
 * The eval harness (lesson 14): evidence about the regulators.
 *
 * A suite is run one arm at a time, one fresh instance per repetition, the
 * tasks in order in that instance so drift can accumulate. An arm changes
 * only what the definition declares — which checkpoint extensions a live
 * session loads, which host checks the implement unit type runs — never the
 * loop. The dispatcher is the caller's: a scripted unit for a headless run
 * whose graders are being validated, or the Pi dispatcher for a live one.
 * Every run's records come from the same stores the read model uses; the
 * harness adds the graders and the arithmetic, and stamps where it ran.
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { lifts, loadRegistry, summarizeArms } from "@metacoding/vsm-pi-core";
import { EvalSuiteSchema, assertValid, type EnvironmentFingerprint, type EvalArm, type EvalReport, type EvalRun, type EvalSuite, type WorkContract, type WorkloadDefinition } from "@metacoding/vsm-pi-protocol";
import { driveUnit, type Dispatcher } from "./controller.js";
import { loadContract } from "./contract-file.js";
import { hostPin } from "./host.js";
import type { Exec } from "./exec.js";
import { GLOSSARY_DRIFT, boundaryViolations, memoryFacts, memoryRules, signatureDrift, suiteWeakened, type GraderContext, unitTrajectory, vocabularyDrift } from "./graders.js";
import { loadInteractionPolicy } from "./interaction-policy.js";
import { POLICY_PATH, loadPolicy } from "./policy.js";
import { loadRecoveryPolicy } from "./recovery-policy.js";
import { loadRoutingPolicy } from "./routing-policy.js";
import { initFixture } from "./unit.js";
import { LAB_ROOT, loadWorkload } from "./workload.js";

export const EVALS_DIR = path.join(LAB_ROOT, "evals");
export const REPORTS_DIR = path.join(EVALS_DIR, "reports");

export async function loadSuite(file: string): Promise<EvalSuite> {
  const value: unknown = JSON.parse(await readFile(file, "utf8"));
  assertValid(EvalSuiteSchema, value, `eval suite ${path.basename(file)}`);
  return value;
}

export interface TaskRef {
  file: string;
  contract: WorkContract;
}

export type DispatcherFactory = (arm: EvalArm, task: TaskRef, instance: string) => Dispatcher;

export interface RunSuiteOptions {
  suite: EvalSuite;
  /** The definition root the suite's paths are relative to. */
  root?: string;
  /** Arms to run; all of the suite's when omitted. The baseline is always included. */
  arms?: readonly string[];
  repetitions?: number;
  dispatcherFor: DispatcherFactory;
  owner: string;
  now?: () => number;
  /** What ran the units, for the fingerprint: `scripted:<behaviour>` or a model id. */
  dispatcher: string;
  model: string;
  interpretation: string;
  interpretedBy: string;
  /** Keep every instance directory instead of removing it (drills). */
  keepInstances?: boolean;
  onRun?: (run: EvalRun, instance: string) => void;
}

/** The workload with the arm's check list on every unit type that changes the repository. */
export function workloadForArm(workload: WorkloadDefinition, arm: EvalArm): WorkloadDefinition {
  return { ...workload, unitTypes: workload.unitTypes.map((t) => (t.checks.length ? { ...t, checks: [...arm.checks] } : t)) };
}

/** The classes each host check can produce evidence for. */
const PRODUCES: Readonly<Record<string, readonly string[]>> = { run_tests: ["test"], run_checks: ["command"], "identity-untouched": ["command"], "export-signature": ["runtime"], "inherited-tests": ["test"] };

/**
 * The contract as an arm can verify it: an expectation whose class no check of the arm produces — or whose content check the
 * arm does not run — is dropped, so a control arm is not refused for lacking evidence it was never asked to collect. File
 * criteria stay: the closeout gate checks cited files under every arm.
 */
export function contractForArm(contract: WorkContract, arm: EvalArm): WorkContract {
  const classes = new Set(arm.checks.flatMap((c) => PRODUCES[c] ?? []));
  return {
    ...contract,
    expectedEvidence: contract.expectedEvidence.filter((e) => e.class === "file" || (e.check ? arm.checks.includes(e.check.kind) : classes.has(e.class) || !["test", "command", "runtime"].includes(e.class))),
  };
}

export async function fingerprintFor(exec: Exec, root: string, options: { dispatcher: string; model: string }): Promise<EnvironmentFingerprint> {
  const rev = await exec("git", ["rev-parse", "HEAD"], { cwd: root });
  const [policy, recovery, routing, interaction] = await Promise.all([loadPolicy(), loadRecoveryPolicy(), loadRoutingPolicy(), loadInteractionPolicy()]);
  return {
    node: process.version, platform: process.platform, arch: process.arch,
    pi: (await hostPin(undefined, root))?.pin ?? "none",
    harnessRevision: rev.code === 0 ? rev.stdout.trim() : "unknown",
    dispatcher: options.dispatcher, model: options.model,
    registry: (await loadRegistry(path.join(root, "registry"))).records.length,
    policies: { [policy.name]: policy.version, [recovery.name]: recovery.version, [routing.name]: routing.version, [interaction.name]: interaction.version },
  };
}

export async function runSuite(exec: Exec, options: RunSuiteOptions): Promise<EvalReport> {
  const { suite } = options;
  const root = options.root ?? LAB_ROOT;
  const now = options.now ?? Date.now;
  const stamp = () => new Date(now()).toISOString();
  const wanted = new Set(options.arms ?? suite.arms.map((a) => a.name));
  wanted.add(suite.baseline);
  const arms = suite.arms.filter((a) => wanted.has(a.name));
  for (const name of wanted) if (!suite.arms.some((a) => a.name === name)) throw new Error(`suite ${suite.name} has no arm "${name}"`);
  const repetitions = options.repetitions ?? suite.repetitions;
  const [workload, policy, recovery, routing, interaction] = await Promise.all([loadWorkload(), loadPolicy(), loadRecoveryPolicy(), loadRoutingPolicy(), loadInteractionPolicy()]);
  const regulators = (await loadRegistry(path.join(root, "registry"))).records.map((r) => r.id);
  const tasks: TaskRef[] = [];
  for (const file of suite.tasks) tasks.push({ file, contract: await loadContract(path.join(root, file)) });
  const fixture = path.join(root, suite.fixture);
  const runs: EvalRun[] = [];

  for (const arm of arms) {
    const armWorkload = workloadForArm(workload, arm);
    for (let repetition = 1; repetition <= repetitions; repetition++) {
      const instance = path.join(await mkdtemp(path.join(tmpdir(), `regulator-eval-${arm.name}-${repetition}-`)), "instance");
      try {
        await initFixture(exec, fixture, instance);
        const baseRevision = (await exec("git", ["rev-parse", "HEAD"], { cwd: instance })).stdout.trim();
        for (const task of tasks) {
          const startedAt = stamp();
          const { final } = await driveUnit(exec, {
            repo: instance, contract: contractForArm(task.contract, arm), workload: armWorkload, policy, policyPath: POLICY_PATH, recovery, routing, interaction, regulators,
            owner: options.owner, now, dispatcher: options.dispatcherFor(arm, task, instance),
          });
          const trajectory = await unitTrajectory(instance, task.contract.unitId);
          const ctx: GraderContext = {
            repo: instance, baseRevision, writable: ["src/", "test/"],
            ...(task.contract.expectedEvidence.find((e) => e.check?.kind === "export-signature") ? { signature: task.contract.expectedEvidence.find((e) => e.check?.kind === "export-signature")! } : {}),
            vocabulary: { forbidden: GLOSSARY_DRIFT },
          };
          const outcome = [await boundaryViolations(exec, ctx), await signatureDrift(exec, ctx), await vocabularyDrift(exec, ctx), await memoryRules(exec, ctx), await memoryFacts(ctx), await suiteWeakened(exec, ctx)];
          const run: EvalRun = {
            arm: arm.name, repetition, task: task.contract.unitId, unitId: task.contract.unitId,
            outcome: final.status === "closed" ? "closed" : final.status === "refused" ? "refused" : "blocked",
            ...(final.status === "blocked" ? { detail: `${final.reason}${final.detail ? `: ${final.detail.split("\n")[0]}` : ""}` } : final.status === "refused" ? { detail: final.problems.map((p) => p.message).join("; ") } : {}),
            metrics: { ...trajectory.metrics, ...Object.fromEntries(outcome.map((g) => [g.grader, g.value])) },
            graders: [...trajectory.graders, ...outcome],
            startedAt, endedAt: stamp(),
          };
          runs.push(run);
          options.onRun?.(run, instance);
        }
      } finally {
        if (!options.keepInstances) await rm(path.dirname(instance), { recursive: true, force: true });
      }
    }
  }
  const summaries = summarizeArms(runs, suite.metrics);
  return {
    suite: { name: suite.name, version: suite.version }, generatedAt: stamp(),
    fingerprint: await fingerprintFor(exec, root, { dispatcher: options.dispatcher, model: options.model }),
    arms: summaries, lifts: lifts(summaries, suite.baseline), runs,
    interpretation: options.interpretation, interpretedBy: options.interpretedBy,
  };
}

/** Which registry records the suite's ablation arms switch off, and which active records no arm covers. */
export function ablationCoverage(suite: EvalSuite, regulatorIds: readonly string[]): { covered: string[]; uncovered: string[]; unknown: string[] } {
  const covered = suite.arms.flatMap((a) => (a.ablates ? [a.ablates] : []));
  return { covered: covered.filter((id) => regulatorIds.includes(id)), uncovered: regulatorIds.filter((id) => !covered.includes(id)), unknown: covered.filter((id) => !regulatorIds.includes(id)) };
}
