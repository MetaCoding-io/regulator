/**
 * Instances (lesson 15): installing the definition into a repository and
 * checking that the installation can run.
 *
 *   initInstance   seed the identity and the advice, ignore `.regulator/`, record canaries,
 *                  and write the instance manifest — which definition, at
 *                  which revision, under which Pi, with the layout a person
 *                  declared for this project. Committed on the base branch,
 *                  so the base is clean and the identity is protected from
 *                  the first unit on.
 *   readManifest   what init wrote, validated; nothing else reads project
 *                  files to learn about the harness
 *   upgradeInstance  carry an instance to the installed definition (#53):
 *                  plan under core's `planUpgrade`, seed what is absent and
 *                  never overwrite, add the ignore line, print the migration
 *                  notes of every version crossed, record the committed
 *                  report the target revision was checked against, rewrite
 *                  the manifest and commit on the base branch. The only
 *                  writer of the manifest beside init.
 *   doctor         the headless operating check: runtime, git, Pi pin,
 *                  the definition's own check, review dates, the instance's
 *                  base, what is owed and undelivered. Exit 1 on a problem;
 *                  the CI entry point.
 *
 * `regulator init` is the portability drill made mechanical: everything the
 * lab assumed about the fixture's layout — `src/` and `test/` writable,
 * `vendor/` protected — is now a declaration in the manifest, made by the
 * person who knows the project, or the discovered convention where nothing
 * is declared.
 */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { INSTANCE_MANIFEST_RELATIVE_PATH, ObligationLedger, adviceContextBudget, adviceMaxChars, checkDefinition, checkRegistry, compareVersions, declaredToolsOf, guardedOutputsOf, identityContextBudget, identityMaxChars, loadRegistry, parseChangelog, planUpgrade, readAdviceSet, readIdentity, renderMigrationNotes, reviewDue, undelivered, type InstanceSnapshot, type UpgradePlan, type UpgradeStep } from "@metacoding.io/regulator-core";
import { DEFINITION_WRITERS, InstanceManifestSchema, assertValid, type DefinitionPoint, type DefinitionWriterClass, type InstanceManifest, type UpgradeEntry } from "@metacoding.io/regulator-protocol";
import type { Exec } from "./exec.js";
import { ADVICE_RELATIVE_DIR, CANARIES_RELATIVE_PATH, IDENTITY_RELATIVE_DIR, INSTANCE_SEEDS, canariesFromEnv } from "./unit.js";
import { LAB_ROOT } from "./workload.js";
import { hostPin } from "./host.js";
import { currentBranch, headRevision, isClean } from "./worktree.js";

export const DEFINITION_NAME = "regulator";

export async function readManifest(repo: string): Promise<InstanceManifest | undefined> {
  let text: string;
  try {
    text = await readFile(path.join(repo, INSTANCE_MANIFEST_RELATIVE_PATH), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  const value: unknown = JSON.parse(text);
  assertValid(InstanceManifestSchema, value, "instance manifest");
  return value;
}

/** The definition's package version, from the package.json beside it; undefined for a definition directory that ships none (a bare fork). */
export async function definitionVersion(definitionRoot: string = LAB_ROOT): Promise<string | undefined> {
  try {
    const pkg = JSON.parse(await readFile(path.join(definitionRoot, "package.json"), "utf8")) as { version?: unknown };
    return typeof pkg.version === "string" && /^\d+\.\d+\.\d+$/.test(pkg.version) ? pkg.version : undefined;
  } catch {
    return undefined;
  }
}

/** The runtime the host pins (Pi's version for regulator-pi), or "none" when no host is installed: what the manifest records. */
export async function definitionPin(definitionRoot: string = LAB_ROOT): Promise<string> {
  return (await hostPin(undefined, definitionRoot))?.pin ?? "none";
}

export interface InitInstanceOptions {
  repo: string;
  definitionRoot?: string;
  writablePaths?: readonly string[];
  protectedPaths?: readonly string[];
  by: string;
  now?: () => number;
}

export interface InitializedInstance {
  manifest: InstanceManifest;
  /** What init committed: the identity and advice seeds, the ignore line — or nothing, when all were already there. */
  committed: string | undefined;
  canaries: number;
}

/** Install the definition into an existing git repository. Refuses a dirty tree and a second init. */
export async function initInstance(exec: Exec, options: InitInstanceOptions): Promise<InitializedInstance> {
  const repo = path.resolve(options.repo);
  const definitionRoot = path.resolve(options.definitionRoot ?? LAB_ROOT);
  const now = options.now ?? Date.now;
  const inside = await exec("git", ["rev-parse", "--is-inside-work-tree"], { cwd: repo });
  if (inside.code !== 0 || inside.stdout.trim() !== "true") throw new Error(`${repo} is not a git repository; init the repository first — the harness installs into one, it does not create one`);
  if (await readManifest(repo)) throw new Error(`${repo} is already an instance (${INSTANCE_MANIFEST_RELATIVE_PATH} exists); there is no re-init, only a definition upgrade by a person`);
  if (!(await isClean(exec, repo))) throw new Error("the repository has uncommitted changes; init commits the identity on its own and needs a clean tree");
  for (const p of [...(options.writablePaths ?? []), ...(options.protectedPaths ?? [])]) {
    if (!p.endsWith("/") || p.startsWith("/") || p.includes("..")) throw new Error(`"${p}" is not a relative prefix ending in /`);
  }

  // The definition must pass its own check before it is installed anywhere.
  const registry = await checkRegistry(path.join(definitionRoot, "registry"), definitionRoot);
  const definition = await checkDefinition(definitionRoot);
  const problems = [...registry.problems.map((p) => `${p.file}: ${p.message}`), ...definition.problems.map((p) => `${p.file}: ${p.message}`)];
  if (problems.length) throw new Error(`the definition at ${definitionRoot} does not pass its check; nothing installed:\n${problems.join("\n")}`);

  const staged: string[] = [];
  // The harness-owned directories (DEFINITION_WRITERS: identity, advice) are seeded where absent and never overwritten.
  const { cp, readdir } = await import("node:fs/promises");
  for (const { seed, instance } of INSTANCE_SEEDS) {
    const present = await readdir(path.join(repo, instance)).then((entries) => entries.length > 0).catch(() => false);
    if (present) continue;
    await cp(seed, path.join(repo, instance), { recursive: true, force: false });
    staged.push(instance);
  }
  const identitySeeded = staged.includes(IDENTITY_RELATIVE_DIR);
  const ignore = path.join(repo, ".gitignore");
  const current = await readFile(ignore, "utf8").catch(() => "");
  if (!current.split("\n").some((l) => l.trim() === ".regulator/" || l.trim() === ".regulator")) {
    await appendFile(ignore, `${current.length && !current.endsWith("\n") ? "\n" : ""}.regulator/\n`, "utf8");
    staged.push(".gitignore");
  }
  const canaries = await canariesFromEnv(path.join(repo, ".env"));
  await mkdir(path.join(repo, ".regulator"), { recursive: true });
  if (canaries.length) await writeFile(path.join(repo, CANARIES_RELATIVE_PATH), `${canaries.join("\n")}\n`, "utf8");

  const rev = await exec("git", ["rev-parse", "HEAD"], { cwd: definitionRoot });
  const packageVersion = await definitionVersion(definitionRoot);
  const manifest: InstanceManifest = {
    version: 1,
    definition: { root: definitionRoot, name: DEFINITION_NAME, registry: registry.records.length, harnessRevision: rev.code === 0 ? rev.stdout.trim() : "unknown", pi: await definitionPin(definitionRoot), ...(packageVersion ? { packageVersion } : {}) },
    ...(options.writablePaths?.length ? { writablePaths: [...options.writablePaths] } : {}),
    ...(options.protectedPaths?.length ? { protectedPaths: [...options.protectedPaths] } : {}),
    initializedAt: new Date(now()).toISOString(), initializedBy: options.by,
  };
  assertValid(InstanceManifestSchema, manifest, "instance manifest");
  await writeFile(path.join(repo, INSTANCE_MANIFEST_RELATIVE_PATH), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  let committed: string | undefined;
  if (staged.length) {
    for (const args of [["add", "--", ...staged], ["-c", "commit.gpgsign=false", "commit", "-q", "-m", `regulator init: ${identitySeeded ? "identity seeded" : "instance prepared"} by ${options.by}\n\nDefinition ${DEFINITION_NAME} at ${manifest.definition.harnessRevision.slice(0, 7)} (${manifest.definition.registry} regulators, pi ${manifest.definition.pi}).`]]) {
      const r = await exec("git", args, { cwd: repo });
      if (r.code !== 0) throw new Error(`git ${args[0]} failed: ${r.stderr.trim()}`);
    }
    committed = await headRevision(exec, repo);
  }
  return { manifest, committed, canaries: canaries.length };
}

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
  /** True and worth knowing, and not a problem: the check passes with this said. */
  warning?: string;
}

export interface DoctorReport {
  at: string;
  checks: DoctorCheck[];
  problems: number;
  warnings: number;
}

export interface DoctorOptions {
  /** The instance to examine; omit to check the definition only. */
  repo?: string;
  definitionRoot?: string;
  /** ISO date for the review-date check; defaults to today. */
  today?: string;
  /** Node version to require, as `process.version` reports it. */
  nodeVersion?: string;
  now?: () => number;
}

const MIN_NODE = [22, 19, 0] as const;

/** Every check a person would run before trusting an installation, in one pass, machine-readable. */
export async function doctor(exec: Exec, options: DoctorOptions = {}): Promise<DoctorReport> {
  const now = options.now ?? Date.now;
  const today = options.today ?? new Date(now()).toISOString().slice(0, 10);
  const definitionRoot = path.resolve(options.definitionRoot ?? LAB_ROOT);
  const checks: DoctorCheck[] = [];
  const check = (name: string, ok: boolean, detail: string, warning?: string) => checks.push({ name, ok, detail, ...(warning ? { warning } : {}) });

  const node = (options.nodeVersion ?? process.version).replace(/^v/, "").split(".").map(Number) as [number, number, number];
  const nodeOk = node[0] > MIN_NODE[0] || (node[0] === MIN_NODE[0] && (node[1] > MIN_NODE[1] || (node[1] === MIN_NODE[1] && node[2] >= MIN_NODE[2])));
  check("node", nodeOk, `${options.nodeVersion ?? process.version}${nodeOk ? "" : ` is below the engines floor ${MIN_NODE.join(".")}`}`);
  const git = await exec("git", ["--version"], { cwd: definitionRoot });
  check("git", git.code === 0, git.code === 0 ? git.stdout.trim() : `git not runnable: ${git.stderr.trim()}`);

  const pin = await definitionPin(definitionRoot);
  const installed = (await hostPin(undefined, definitionRoot))?.installed ?? "not installed";
  check("pi", installed === pin, `definition pins ${pin}; installed ${installed}${installed === pin ? "" : " — an upgrade is a change with evidence (OPERATING.md)"}`);

  const registry = await checkRegistry(path.join(definitionRoot, "registry"), definitionRoot, { today });
  check("registry", registry.problems.length === 0, `${registry.records.length} record(s), ${registry.problems.length} problem(s)${registry.problems.length ? `: ${registry.problems.map((p) => `${p.file}: ${p.message}`).join("; ")}` : ""}${registry.filesVerified ? "" : "; implementation and test paths not verified here (an installed package ships no sources; they were verified at the release by `pnpm check`)"}`);
  const definition = await checkDefinition(definitionRoot);
  check("definition", definition.problems.length === 0, `${definition.profiles.length} profile(s), ${definition.workloads.length} workload(s), ${definition.policies.length + definition.recovery.length + definition.routing.length + definition.interaction.length} policy file(s), ${definition.identity.invariants.length} invariant(s), ${definition.evals.length} eval suite(s), ${definition.reports.length} report(s)${definition.problems.length ? `; problems: ${definition.problems.map((p) => `${p.file}: ${p.message}`).join("; ")}` : ""}`, definition.warnings.map((w) => `${w.file}: ${w.message}`).join("; ") || undefined);
  const due = reviewDue((await loadRegistry(path.join(definitionRoot, "registry"))).records, today, 30);
  check("reviews", !due.some((d) => d.overdueDays > 0), due.length ? due.map((d) => `${d.record.id} ${d.overdueDays > 0 ? `overdue ${d.overdueDays}d` : `due in ${-d.overdueDays}d`}`).join(", ") : "nothing due within 30 days");

  if (options.repo) {
    const repo = path.resolve(options.repo);
    let manifest: InstanceManifest | undefined;
    try {
      manifest = await readManifest(repo);
      // The package version and the upgrade history (#53): which evidence the instance's definition rests on, read from the manifest.
      const last = manifest?.upgrades?.at(-1);
      const history = manifest ? `; package ${manifest.definition.packageVersion ?? "version not recorded (a manifest written before `regulator upgrade` existed)"}; ${manifest.upgrades?.length ? `upgraded ${manifest.upgrades.length}× — last ${last!.at.slice(0, 10)} by ${last!.by}, ${last!.from.packageVersion}@${last!.from.harnessRevision.slice(0, 7)} → ${last!.to.packageVersion}@${last!.to.harnessRevision.slice(0, 7)}, checked against ${last!.report === "none" ? "no report" : `report ${last!.reportFile ?? last!.report.slice(0, 12)}`}` : "never upgraded"}` : "";
      check("manifest", manifest !== undefined, manifest ? `definition ${manifest.definition.name} at ${manifest.definition.harnessRevision.slice(0, 7)}, ${manifest.definition.registry} regulators, pi ${manifest.definition.pi}; initialized ${manifest.initializedAt.slice(0, 10)} by ${manifest.initializedBy}${manifest.writablePaths ? `; writable ${manifest.writablePaths.join(", ")}` : ""}${manifest.protectedPaths ? `; protected ${manifest.protectedPaths.join(", ")}` : ""}${history}` : `no ${INSTANCE_MANIFEST_RELATIVE_PATH}: run \`regulator init\``);
    } catch (error) {
      check("manifest", false, (error as Error).message);
    }
    if (manifest) {
      const rev = await exec("git", ["rev-parse", "HEAD"], { cwd: definitionRoot });
      const current = rev.code === 0 ? rev.stdout.trim() : "unknown";
      const same = manifest.definition.harnessRevision === current && manifest.definition.registry === registry.records.length && manifest.definition.pi === pin;
      // A newer installed package, or a manifest with no version recorded, is what `regulator upgrade` carries an instance through (#53); doctor says so and upgrades nothing.
      const installedVersion = await definitionVersion(definitionRoot);
      const newer = installedVersion !== undefined && (manifest.definition.packageVersion === undefined || compareVersions(manifest.definition.packageVersion, installedVersion) < 0);
      check("definition-drift", same, same ? "the instance was initialized under this definition revision" : `initialized under ${manifest.definition.harnessRevision.slice(0, 7)} (${manifest.definition.registry} regulators, pi ${manifest.definition.pi}); the definition is now ${current.slice(0, 7)} (${registry.records.length}, pi ${pin})${newer ? ` — the installed package ${installedVersion} is newer than the manifest's ${manifest.definition.packageVersion ?? "(none recorded)"}: run \`regulator upgrade\`` : " — run `regulator upgrade --check` to see whether a migration note applies, and read OPERATING.md § Upgrading before the next unit"}`);
      // The manifest's writable prefixes replace a writing profile's in the session (#121): one that reaches the output of a
      // declared tool whose consent is derived lets a plain write land there with no yes asked. The manifest is a person's
      // declaration, which upgrade never rewrites, so doctor says which line to drop by hand.
      const guarded = guardedOutputsOf([...declaredToolsOf(definition.workloads).values()].map((d) => d.tool));
      const reached = guarded.flatMap(({ tool, output }) => (manifest!.writablePaths ?? []).filter((w) => output.startsWith(w) || w.startsWith(output)).map((prefix) => ({ tool, output, prefix })));
      check("manifest-writable", reached.length === 0, reached.length
        ? `the manifest declares ${reached.map((r) => `"${r.prefix}"`).join(", ")} writable, which reaches ${reached.map((r) => `${r.tool}'s output "${r.output}"`).join(", ")}: a unit's plain write there needs no yes, so the consent the gate derives from the tool's irreversible effect is bypassed. Remove the prefix from ${INSTANCE_MANIFEST_RELATIVE_PATH} by hand (the manifest is a person's declaration; upgrade never rewrites it) and take the trade list, or its like, through the tool`
        : guarded.length ? `no manifest prefix reaches a declared tool's guarded output (${guarded.map((g) => `${g.tool}: ${g.output}`).join(", ")})` : "the definition declares no tool whose consent is derived; nothing for the manifest to reach");
    }
    let identityOk = false;
    try {
      await readFile(path.join(repo, IDENTITY_RELATIVE_DIR, "INVARIANTS.md"));
      identityOk = true;
    } catch { /* missing */ }
    if (identityOk) {
      // The instance's set, as a unit would see it: over the context budget it is partly unseen, and doctor says so (#51).
      const identity = await readIdentity(path.join(repo, IDENTITY_RELATIVE_DIR));
      const budget = identityContextBudget(identity, identityMaxChars(definition.policies.find((p) => p.name === "default") ?? definition.policies[0]));
      check("identity", identity.problems.length === 0, `${IDENTITY_RELATIVE_DIR} present: ${identity.invariants.length} invariant(s), renders to ${budget.chars} of ${budget.max} characters${identity.problems.length ? `; problems: ${identity.problems.join("; ")}` : ""}`, budget.warning);
    } else {
      check("identity", false, `${IDENTITY_RELATIVE_DIR} missing: run \`regulator init\``);
    }
    // The instance's advice (#110), as a unit of each profile would see it: a file per declared profile, and the cut past
    // `advice.maxChars` said, not refused. An instance initialized before advice was a file set has no directory: say so.
    const advice = await readAdviceSet(path.join(repo, ADVICE_RELATIVE_DIR), definition.profiles.map((p) => ({ name: p.name, inline: (p.advice?.length ?? 0) > 0 })));
    const adviceWarnings = Object.entries(advice.files).map(([profile, text]) => adviceContextBudget(profile, text, adviceMaxChars(definition.policies.find((p) => p.name === "default") ?? definition.policies[0])).warning).filter((w): w is string => w !== undefined);
    const adviceFiles = Object.keys(advice.files).sort();
    check("advice", advice.problems.length === 0, adviceFiles.length ? `${ADVICE_RELATIVE_DIR} present: ${adviceFiles.length} file(s) for ${adviceFiles.join(", ")}${advice.problems.length ? `; problems: ${advice.problems.map((p) => p.message).join("; ")}` : ""}` : `${ADVICE_RELATIVE_DIR} missing: seed it from the definition's advice/ (an instance initialized before advice was a file set carries none; OPERATING.md § Upgrading)`, adviceWarnings.join("; ") || undefined);
    const clean = await isClean(exec, repo).catch(() => false);
    const branch = await currentBranch(exec, repo).catch(() => "?");
    check("base", clean, clean ? `clean, on ${branch}` : `the base checkout has uncommitted changes (on ${branch}); nothing dispatches until it is clean`);
    const ledger = new ObligationLedger(repo, now);
    const open = await ledger.open();
    const owedToPeople = open.filter((o) => o.consumer === "human");
    const notDelivered = undelivered(open);
    const baseHeld = open.filter((o) => o.blocks && o.unit === undefined);
    check("obligations", notDelivered.length === 0 && baseHeld.length === 0, `${open.length} open; ${owedToPeople.length} owed to a person, ${notDelivered.length} not delivered${baseHeld.length ? `; ${baseHeld.length} holding the whole instance: ${baseHeld.map((o) => o.subject).join("; ")}` : ""}`);
  }
  return { at: new Date(now()).toISOString(), checks, problems: checks.filter((c) => !c.ok).length, warnings: checks.filter((c) => c.warning).length };
}

export interface UpgradeInstanceOptions {
  repo: string;
  /** The definition to upgrade to; the manifest's by default. */
  definitionRoot?: string;
  /** Who runs it; required to apply, recorded in the manifest and the commit. Checked against the interaction policy by the CLI before this is called. */
  by?: string;
  /** Plan and print; change nothing. */
  check?: boolean;
  now?: () => number;
}

/** The committed report the target revision was checked against, read from `evals/reports/`: never computed, never run. */
export interface UpgradeEvidence {
  report: "none" | string;
  file?: string;
  kind?: "scripted" | "live";
}

export interface UpgradedInstance {
  plan: UpgradePlan;
  /** The steps that applied, in order; empty on a dry run or a current instance. */
  applied: UpgradeStep[];
  /** The migration notes of every version crossed, rendered for a person. Empty when nothing is crossed. */
  notes: string;
  evidence: UpgradeEvidence;
  /** The manifest after the upgrade; the one read when nothing was written. */
  manifest: InstanceManifest;
  /** What upgrade committed on the base branch, or nothing when the tree was already complete (the manifest is under `.regulator/`, ignored). */
  committed: string | undefined;
}

/** The files of each class's seed directory the instance's copy lacks, and whether `.regulator/` is ignored: what the plan may seed. */
async function snapshotInstance(repo: string, definitionRoot: string): Promise<InstanceSnapshot> {
  const { readdir } = await import("node:fs/promises");
  const absent: Partial<Record<DefinitionWriterClass, string[]>> = {};
  for (const w of DEFINITION_WRITERS) {
    if (!w.instance) continue;
    const seedFiles = (await readdir(path.join(definitionRoot, w.seed[0]!), { withFileTypes: true }).catch(() => [])).filter((e) => e.isFile()).map((e) => e.name);
    const have = new Set(await readdir(path.join(repo, w.instance)).catch(() => []));
    const missing = seedFiles.filter((f) => !have.has(f));
    if (missing.length) absent[w.class] = missing;
  }
  const ignore = await readFile(path.join(repo, ".gitignore"), "utf8").catch(() => "");
  return { absent, ignored: ignore.split("\n").some((l) => l.trim() === ".regulator/" || l.trim() === ".regulator") };
}

/** A committed report under `evals/reports/` whose fingerprint names the target revision: live preferred over scripted, then by file name. */
async function evidenceFor(definitionRoot: string, harnessRevision: string): Promise<UpgradeEvidence> {
  const { committedReports } = await import("./predictions.js");
  const at = (await committedReports(definitionRoot)).filter((r) => r.report.fingerprint.harnessRevision === harnessRevision).map((r) => ({ ...r, kind: r.report.fingerprint.dispatcher.startsWith("scripted:") ? "scripted" as const : "live" as const }));
  const chosen = at.sort((a, b) => (a.kind === b.kind ? (a.file ?? "").localeCompare(b.file ?? "") : a.kind === "live" ? -1 : 1))[0];
  return chosen ? { report: chosen.fingerprint, kind: chosen.kind, ...(chosen.file ? { file: chosen.file } : {}) } : { report: "none" };
}

/**
 * Carry an instance to the installed definition (#53). Refuses an instance without a manifest, a definition that fails
 * its own check or ships no version or changelog, and — to apply — a dirty base checkout. Applies only the plan's
 * closed steps: a seed file absent from the instance is copied and a file that exists is never touched, so a decided
 * identity or advice file stays as the person left it; the ignore line is added. Everything the migration notes say is
 * printed, under a heading per version crossed, and nothing in them is acted on. The manifest is rewritten with the
 * version, the revision, the registry count, the pin and one history entry naming the report the target revision was
 * checked against; the tree change is one commit on the base branch citing from and to.
 */
export async function upgradeInstance(exec: Exec, options: UpgradeInstanceOptions): Promise<UpgradedInstance> {
  const repo = path.resolve(options.repo);
  const now = options.now ?? Date.now;
  const manifest = await readManifest(repo);
  if (!manifest) throw new Error(`${repo} is not an instance (no ${INSTANCE_MANIFEST_RELATIVE_PATH}); run \`regulator init\` first — upgrade carries an initialized instance forward`);
  const definitionRoot = path.resolve(options.definitionRoot ?? manifest.definition.root);

  // The definition must pass its own check before an instance is carried to it, as it must before it is installed.
  const registry = await checkRegistry(path.join(definitionRoot, "registry"), definitionRoot);
  const definition = await checkDefinition(definitionRoot);
  const problems = [...registry.problems.map((p) => `${p.file}: ${p.message}`), ...definition.problems.map((p) => `${p.file}: ${p.message}`)];
  if (problems.length) throw new Error(`the definition at ${definitionRoot} does not pass its check; nothing upgraded:\n${problems.join("\n")}`);
  const packageVersion = await definitionVersion(definitionRoot);
  if (!packageVersion) throw new Error(`the definition at ${definitionRoot} ships no package.json version; upgrade reads the installed version from it, and a forked definition carries its own version and CHANGELOG.md`);
  const changelogText = await readFile(path.join(definitionRoot, "CHANGELOG.md"), "utf8").catch(() => undefined);
  if (changelogText === undefined) throw new Error(`the definition at ${definitionRoot} ships no CHANGELOG.md; the migration notes upgrade prints live there`);
  const rev = await exec("git", ["rev-parse", "HEAD"], { cwd: definitionRoot });
  const installed: DefinitionPoint = { packageVersion, harnessRevision: rev.code === 0 ? rev.stdout.trim() : "unknown" };

  const plan = planUpgrade({ manifest, installed, definitionRoot, changelog: parseChangelog(changelogText), instance: await snapshotInstance(repo, definitionRoot) });
  if (plan.outcome === "refused") throw new Error(`upgrade refused: ${plan.reason}`);
  const evidence = await evidenceFor(definitionRoot, installed.harnessRevision);
  if (plan.outcome === "current") return { plan, applied: [], notes: "", evidence, manifest, committed: undefined };
  const notes = renderMigrationNotes(plan.crossed, installed.harnessRevision);
  if (options.check) return { plan, applied: [], notes, evidence, manifest, committed: undefined };

  if (!options.by) throw new Error("upgrade needs --by <who>: the manifest and the commit record who ran it");
  if (!(await isClean(exec, repo))) throw new Error("the base checkout has uncommitted changes; an upgrade is committed on its own");
  const { cp } = await import("node:fs/promises");
  const staged: string[] = [];
  const applied: UpgradeStep[] = [];
  for (const step of plan.steps) {
    if (!step.apply) continue;
    if (step.step === "seed") {
      await mkdir(path.join(repo, step.instance), { recursive: true });
      for (const file of step.files) {
        // `force: false` with an existing target throws rather than overwrites: the step seeds what is absent and nothing else.
        await cp(path.join(step.seed, file), path.join(repo, step.instance, file), { force: false, errorOnExist: true });
        staged.push(path.posix.join(step.instance, file));
      }
    } else {
      const ignore = path.join(repo, ".gitignore");
      const current = await readFile(ignore, "utf8").catch(() => "");
      await appendFile(ignore, `${current.length && !current.endsWith("\n") ? "\n" : ""}.regulator/\n`, "utf8");
      staged.push(".gitignore");
    }
    applied.push(step);
  }

  const entry: UpgradeEntry = { from: plan.from, to: plan.to, report: evidence.report, ...(evidence.file ? { reportFile: evidence.file } : {}), by: options.by, at: new Date(now()).toISOString() };
  const upgraded: InstanceManifest = {
    ...manifest,
    definition: { ...manifest.definition, root: definitionRoot, registry: registry.records.length, harnessRevision: installed.harnessRevision, pi: await definitionPin(definitionRoot), packageVersion: installed.packageVersion },
    upgrades: [...(manifest.upgrades ?? []), entry],
  };
  assertValid(InstanceManifestSchema, upgraded, "instance manifest");
  await writeFile(path.join(repo, INSTANCE_MANIFEST_RELATIVE_PATH), `${JSON.stringify(upgraded, null, 2)}\n`, "utf8");

  let committed: string | undefined;
  if (staged.length) {
    const seeded = applied.flatMap((s) => (s.step === "seed" ? s.files.map((f) => path.posix.join(s.instance, f)) : []));
    const body = [`Definition ${DEFINITION_NAME} ${plan.from.packageVersion}@${plan.from.harnessRevision.slice(0, 7)} → ${plan.to.packageVersion}@${plan.to.harnessRevision.slice(0, 7)} (${registry.records.length} regulators, pi ${upgraded.definition.pi}).`, seeded.length ? `Seeded from the definition, absent here: ${seeded.join(", ")}.` : undefined, applied.some((s) => s.step === "ignore") ? "Added the .regulator/ ignore line." : undefined, `Checked against ${evidence.report === "none" ? "no committed report at this revision" : `${evidence.kind} report ${evidence.file ?? evidence.report}`}.`].filter(Boolean).join("\n");
    for (const args of [["add", "--", ...staged], ["-c", "commit.gpgsign=false", "commit", "-q", "-m", `regulator upgrade: ${plan.from.packageVersion} → ${plan.to.packageVersion} by ${options.by}\n\n${body}`]]) {
      const r = await exec("git", args, { cwd: repo });
      if (r.code !== 0) throw new Error(`git ${args[0]} failed: ${r.stderr.trim()}`);
    }
    committed = await headRevision(exec, repo);
  }
  return { plan, applied, notes, evidence, manifest: upgraded, committed };
}
