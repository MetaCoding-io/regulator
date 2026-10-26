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
 * harness adds the graders and the arithmetic, and stamps where it ran. A
 * metric the suite pre-registers is one of the built-ins or one a workload
 * declares with its grader command (#129); a declared grader runs after each
 * unit, in the instance, and its value is folded into the run beside the
 * built-ins and summarized the same way.
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileSha256, graderFile, lifts, loadRegistry, summarizeArms } from "@metacoding.io/regulator-core";
import { EvalSuiteSchema, assertValid, declaredMetrics, optimisedMetrics, parseDeclaredMetric, type EnvironmentFingerprint, type EvalArm, type EvalReport, type EvalRun, type EvalSuite, type GraderFingerprint, type WorkContract, type WorkloadDefinition, checkNames, metricNames } from "@metacoding.io/regulator-protocol";
import { driveUnit, type Dispatcher } from "./controller.js";
import { loadContract } from "./contract-file.js";
import { hostPin } from "./host.js";
import type { Exec } from "./exec.js";
import { GLOSSARY_DRIFT, boundaryViolations, memoryFacts, memoryRules, runDeclaredGraders, signatureDrift, suiteWeakened, type DeclaredGrader, type GraderContext, unitTrajectory, vocabularyDrift } from "./graders.js";
import { initInstance, readManifest } from "./instance.js";
import { loadInteractionPolicy } from "./interaction-policy.js";
import { POLICY_PATH, loadPolicy } from "./policy.js";
import { loadRecoveryPolicy } from "./recovery-policy.js";
import { loadRoutingPolicy } from "./routing-policy.js";
import { initFixture } from "./unit.js";
import { LAB_ROOT, loadWorkloadFor } from "./workload.js";

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
  /** The budget policy the units run under; the definition's default when omitted. */
  policyPath?: string;
  /** The instance layout a person would declare with `regulator init` for the fixture: when given, each instance carries the manifest and the closeout and the graders read it. */
  instance?: { writablePaths?: readonly string[]; protectedPaths?: readonly string[] };
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
  const names = checkNames(arm.checks);
  const classes = new Set(names.flatMap((c) => PRODUCES[c] ?? []));
  return {
    ...contract,
    expectedEvidence: contract.expectedEvidence.filter((e) => e.class === "file" || (e.check ? names.includes(e.check.kind) : classes.has(e.class) || !["test", "command", "runtime"].includes(e.class))),
  };
}

/**
 * The declared graders a suite pre-registers, resolved against the workloads under the definition: the declaration, and
 * the file under the root its command names. A name no workload declares, a command naming no file, or a second
 * optimisation target is refused here as `regulator check` refuses it, since `regulator eval` loads a suite directly.
 */
export async function declaredGradersFor(suite: EvalSuite, root: string): Promise<DeclaredGrader[]> {
  const targets = optimisedMetrics(suite.metrics);
  if (targets.length > 1) throw new Error(`suite ${suite.name} marks ${targets.length} metrics optimise (${targets.join(", ")}); at most one declared metric is the optimisation target`);
  const out: DeclaredGrader[] = [];
  for (const name of declaredMetrics(suite.metrics)) {
    const parsed = parseDeclaredMetric(name)!;
    if (parsed.owner !== "workload") throw new Error(`suite ${suite.name} pre-registers "${name}", an instrument's metric; the instrument record kind does not exist yet`);
    const workload = await loadWorkloadFor(parsed.id, root);
    const declaration = (workload.metrics ?? []).find((m) => m.name === name);
    if (!declaration) throw new Error(`suite ${suite.name} pre-registers "${name}", which workload "${parsed.id}" does not declare`);
    const file = await graderFile(root, declaration.grader.argv);
    if (!file) throw new Error(`metric "${name}" declares the grader \`${declaration.grader.argv.join(" ")}\`, and no argument of it is a file under the definition`);
    out.push({ declaration, file });
  }
  return out;
}

export async function fingerprintFor(exec: Exec, root: string, options: { dispatcher: string; model: string; policyPath?: string; graders?: readonly DeclaredGrader[] }): Promise<EnvironmentFingerprint> {
  const rev = await exec("git", ["rev-parse", "HEAD"], { cwd: root });
  const [policy, recovery, routing, interaction] = await Promise.all([loadPolicy(options.policyPath), loadRecoveryPolicy(), loadRoutingPolicy(), loadInteractionPolicy()]);
  const graders: GraderFingerprint[] = [];
  for (const g of options.graders ?? []) graders.push({ metric: g.declaration.name, argv: [...g.declaration.grader.argv], file: g.file, sha256: await fileSha256(root, g.file) });
  return {
    node: process.version, platform: process.platform, arch: process.arch,
    pi: (await hostPin(undefined, root))?.pin ?? "none",
    harnessRevision: rev.code === 0 ? rev.stdout.trim() : "unknown",
    dispatcher: options.dispatcher, model: options.model,
    registry: (await loadRegistry(path.join(root, "registry"))).records.length,
    policies: { [policy.name]: policy.version, [recovery.name]: recovery.version, [routing.name]: routing.version, [interaction.name]: interaction.version },
    ...(graders.length ? { graders } : {}),
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
  const policyPath = options.policyPath ?? POLICY_PATH;
  const [policy, recovery, routing, interaction] = await Promise.all([loadPolicy(policyPath), loadRecoveryPolicy(), loadRoutingPolicy(), loadInteractionPolicy()]);
  const regulators = (await loadRegistry(path.join(root, "registry"))).records.map((r) => r.id);
  // The workload is the one each task's contract names, loaded from the definition: the loop is generic over workloads.
  const workloads = new Map<string, WorkloadDefinition>();
  const tasks: TaskRef[] = [];
  for (const file of suite.tasks) {
    const contract = await loadContract(path.join(root, file));
    if (!workloads.has(contract.workload.name)) workloads.set(contract.workload.name, await loadWorkloadFor(contract.workload.name, root));
    tasks.push({ file, contract });
  }
  const declared = await declaredGradersFor(suite, root);
  const fixture = path.join(root, suite.fixture);
  const runs: EvalRun[] = [];

  for (const arm of arms) {
    for (let repetition = 1; repetition <= repetitions; repetition++) {
      const instance = path.join(await mkdtemp(path.join(tmpdir(), `regulator-eval-${arm.name}-${repetition}-`)), "instance");
      try {
        await initFixture(exec, fixture, instance);
        if (options.instance) await initInstance(exec, { repo: instance, definitionRoot: root, by: options.owner, now, ...options.instance });
        const manifest = await readManifest(instance);
        const baseRevision = (await exec("git", ["rev-parse", "HEAD"], { cwd: instance })).stdout.trim();
        for (const task of tasks) {
          const startedAt = stamp();
          const { final } = await driveUnit(exec, {
            repo: instance, contract: contractForArm(task.contract, arm), workload: workloadForArm(workloads.get(task.contract.workload.name)!, arm), policy, policyPath, recovery, routing, interaction, regulators,
            owner: options.owner, now, dispatcher: options.dispatcherFor(arm, task, instance),
          });
          const trajectory = await unitTrajectory(instance, task.contract.unitId);
          const ctx: GraderContext = {
            repo: instance, baseRevision, writable: manifest?.writablePaths ?? ["src/", "test/"],
            ...(task.contract.expectedEvidence.find((e) => e.check?.kind === "export-signature") ? { signature: task.contract.expectedEvidence.find((e) => e.check?.kind === "export-signature")! } : {}),
            vocabulary: { forbidden: GLOSSARY_DRIFT },
          };
          const outcome = [await boundaryViolations(exec, ctx), await signatureDrift(exec, ctx), await vocabularyDrift(exec, ctx), await memoryRules(exec, ctx), await memoryFacts(ctx), await suiteWeakened(exec, ctx)];
          // The declared graders run after the unit like the built-in outcome graders, over the instance, never over the report.
          const measured = declared.length ? await runDeclaredGraders(exec, { root, instance, graders: declared }) : [];
          const run: EvalRun = {
            arm: arm.name, repetition, task: task.contract.unitId, unitId: task.contract.unitId,
            outcome: final.status === "closed" ? "closed" : final.status === "refused" ? "refused" : "blocked",
            ...(final.status === "blocked" ? { detail: `${final.reason}${final.detail ? `: ${final.detail.split("\n")[0]}` : ""}` } : final.status === "refused" ? { detail: final.problems.map((p) => p.message).join("; ") } : {}),
            metrics: { ...trajectory.metrics, ...Object.fromEntries([...outcome, ...measured].map((g) => [g.grader, g.value])) },
            graders: [...trajectory.graders, ...outcome, ...measured],
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
  const summaries = summarizeArms(runs, metricNames(suite.metrics));
  const [optimise] = optimisedMetrics(suite.metrics);
  return {
    suite: { name: suite.name, version: suite.version, ...(optimise ? { optimise } : {}) }, generatedAt: stamp(),
    fingerprint: await fingerprintFor(exec, root, { dispatcher: options.dispatcher, model: options.model, policyPath, graders: declared }),
    arms: summaries, lifts: lifts(summaries, suite.baseline), runs,
    interpretation: options.interpretation, interpretedBy: options.interpretedBy,
  };
}

/** Which registry records the suite's ablation arms switch off, and which active records no arm covers. */
export function ablationCoverage(suite: EvalSuite, regulatorIds: readonly string[]): { covered: string[]; uncovered: string[]; unknown: string[] } {
  const covered = suite.arms.flatMap((a) => (a.ablates ? [a.ablates] : []));
  return { covered: covered.filter((id) => regulatorIds.includes(id)), uncovered: regulatorIds.filter((id) => !covered.includes(id)), unknown: covered.filter((id) => !regulatorIds.includes(id)) };
}
