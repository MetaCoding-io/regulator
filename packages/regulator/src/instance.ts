/**
 * Instances (lesson 15): installing the definition into a repository and
 * checking that the installation can run.
 *
 *   initInstance   seed the identity, ignore `.regulator/`, record canaries,
 *                  and write the instance manifest — which definition, at
 *                  which revision, under which Pi, with the layout a person
 *                  declared for this project. Committed on the base branch,
 *                  so the base is clean and the identity is protected from
 *                  the first unit on.
 *   readManifest   what init wrote, validated; nothing else reads project
 *                  files to learn about the harness
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
import { INSTANCE_MANIFEST_RELATIVE_PATH, ObligationLedger, checkDefinition, checkRegistry, loadRegistry, reviewDue, undelivered } from "@metacoding.io/regulator-core";
import { InstanceManifestSchema, assertValid, type InstanceManifest } from "@metacoding.io/regulator-protocol";
import type { Exec } from "./exec.js";
import { CANARIES_RELATIVE_PATH, IDENTITY_RELATIVE_DIR, IDENTITY_SEED_DIR, canariesFromEnv } from "./unit.js";
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
  /** What init committed: the identity seed, the ignore line — or nothing, when both were already there. */
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
  const identityDir = path.join(repo, IDENTITY_RELATIVE_DIR);
  let identitySeeded = false;
  try {
    await readFile(path.join(identityDir, "INVARIANTS.md"));
  } catch {
    const { cp } = await import("node:fs/promises");
    await cp(IDENTITY_SEED_DIR, identityDir, { recursive: true, force: false });
    staged.push(IDENTITY_RELATIVE_DIR);
    identitySeeded = true;
  }
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
  const manifest: InstanceManifest = {
    version: 1,
    definition: { root: definitionRoot, name: DEFINITION_NAME, registry: registry.records.length, harnessRevision: rev.code === 0 ? rev.stdout.trim() : "unknown", pi: await definitionPin(definitionRoot) },
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
}

export interface DoctorReport {
  at: string;
  checks: DoctorCheck[];
  problems: number;
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
  const check = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });

  const node = (options.nodeVersion ?? process.version).replace(/^v/, "").split(".").map(Number) as [number, number, number];
  const nodeOk = node[0] > MIN_NODE[0] || (node[0] === MIN_NODE[0] && (node[1] > MIN_NODE[1] || (node[1] === MIN_NODE[1] && node[2] >= MIN_NODE[2])));
  check("node", nodeOk, `${options.nodeVersion ?? process.version}${nodeOk ? "" : ` is below the engines floor ${MIN_NODE.join(".")}`}`);
  const git = await exec("git", ["--version"], { cwd: definitionRoot });
  check("git", git.code === 0, git.code === 0 ? git.stdout.trim() : `git not runnable: ${git.stderr.trim()}`);

  const pin = await definitionPin(definitionRoot);
  const installed = (await hostPin(undefined, definitionRoot))?.installed ?? "not installed";
  check("pi", installed === pin, `definition pins ${pin}; installed ${installed}${installed === pin ? "" : " — an upgrade is a change with evidence (OPERATING.md)"}`);

  const registry = await checkRegistry(path.join(definitionRoot, "registry"), definitionRoot, { today });
  check("registry", registry.problems.length === 0, `${registry.records.length} record(s), ${registry.problems.length} problem(s)${registry.problems.length ? `: ${registry.problems.map((p) => `${p.file}: ${p.message}`).join("; ")}` : ""}`);
  const definition = await checkDefinition(definitionRoot);
  check("definition", definition.problems.length === 0, `${definition.profiles.length} profile(s), ${definition.workloads.length} workload(s), ${definition.policies.length + definition.recovery.length + definition.routing.length + definition.interaction.length} policy file(s), ${definition.identity.invariants.length} invariant(s), ${definition.evals.length} eval suite(s), ${definition.reports.length} report(s)${definition.problems.length ? `; problems: ${definition.problems.map((p) => `${p.file}: ${p.message}`).join("; ")}` : ""}`);
  const due = reviewDue((await loadRegistry(path.join(definitionRoot, "registry"))).records, today, 30);
  check("reviews", !due.some((d) => d.overdueDays > 0), due.length ? due.map((d) => `${d.record.id} ${d.overdueDays > 0 ? `overdue ${d.overdueDays}d` : `due in ${-d.overdueDays}d`}`).join(", ") : "nothing due within 30 days");

  if (options.repo) {
    const repo = path.resolve(options.repo);
    let manifest: InstanceManifest | undefined;
    try {
      manifest = await readManifest(repo);
      check("manifest", manifest !== undefined, manifest ? `definition ${manifest.definition.name} at ${manifest.definition.harnessRevision.slice(0, 7)}, ${manifest.definition.registry} regulators, pi ${manifest.definition.pi}; initialized ${manifest.initializedAt.slice(0, 10)} by ${manifest.initializedBy}${manifest.writablePaths ? `; writable ${manifest.writablePaths.join(", ")}` : ""}${manifest.protectedPaths ? `; protected ${manifest.protectedPaths.join(", ")}` : ""}` : `no ${INSTANCE_MANIFEST_RELATIVE_PATH}: run \`regulator init\``);
    } catch (error) {
      check("manifest", false, (error as Error).message);
    }
    if (manifest) {
      const rev = await exec("git", ["rev-parse", "HEAD"], { cwd: definitionRoot });
      const current = rev.code === 0 ? rev.stdout.trim() : "unknown";
      const same = manifest.definition.harnessRevision === current && manifest.definition.registry === registry.records.length && manifest.definition.pi === pin;
      check("definition-drift", same, same ? "the instance was initialized under this definition revision" : `initialized under ${manifest.definition.harnessRevision.slice(0, 7)} (${manifest.definition.registry} regulators, pi ${manifest.definition.pi}); the definition is now ${current.slice(0, 7)} (${registry.records.length}, pi ${pin}) — read OPERATING.md § Upgrading before the next unit`);
    }
    let identityOk = false;
    try {
      await readFile(path.join(repo, IDENTITY_RELATIVE_DIR, "INVARIANTS.md"));
      identityOk = true;
    } catch { /* missing */ }
    check("identity", identityOk, identityOk ? `${IDENTITY_RELATIVE_DIR} present` : `${IDENTITY_RELATIVE_DIR} missing: run \`regulator init\``);
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
  return { at: new Date(now()).toISOString(), checks, problems: checks.filter((c) => !c.ok).length };
}
