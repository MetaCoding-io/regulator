/**
 * Host-run verification (lesson 09): the deterministic layer of S3*.
 *
 *   runHostChecks      run the checks a workload names for a unit type — the
 *                      project's real test command, its deterministic checks,
 *                      the existence of files a report cites — with the
 *                      harness's own process runner, never a model's tool call
 *   bindEvidence       turn each result into an evidence record bound to the
 *                      unit, attempt, contract, revision, environment and the
 *                      contract criteria it speaks to
 *   technicalVerdict   derive pass / fail / inconclusive from the records that
 *                      are *fresh* for the revision under closeout, plus human
 *                      acceptances for criteria no host check can observe.
 *                      The report is consulted for one thing only: to name
 *                      the claims the evidence contradicts.
 *
 * Pi-free. It needs an `Exec` and a working directory; git is used only to
 * ask whether a cited file exists at the revision.
 */
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type {
  EvidenceClass, EvidenceEnvironment, EvidenceExpectation, EvidenceRecord, ExpectationCheck, HumanAcceptance, ResultReport, TechnicalVerdict, Verdict, WorkContract,
} from "@metacoding/vsm-pi-protocol";
import { boundedTail, discoverConventions, parseNodeTestSummary, type ProjectConventions } from "./conventions.js";
import type { Exec } from "./exec.js";

export interface HostCheckResult {
  /** `run_tests`, `run_checks:<name>`, `file:<path>`, `identity-untouched`, `export-signature:<criterion>`, `glossary-lint` or `inherited-tests`. */
  check: string;
  class: EvidenceClass;
  verdict: Verdict;
  command?: string[];
  observation: string;
  /** Set when the check observed one criterion by content (lesson 14): the record binds to that criterion alone, not to every expectation of its class. */
  criterion?: string;
}

export interface RunHostChecksOptions {
  cwd: string;
  /** Check names from the workload's unit type: `run_tests`, `run_checks`. Unknown names are recorded as inconclusive. */
  checks: readonly string[];
  /** Files a report cites as evidence: each becomes a `file:` check against HEAD. */
  fileRefs?: readonly string[];
  /** For `identity-untouched` (lesson 12): the base ref the unit branched from, and the prefixes nothing may have changed. */
  base?: string;
  protectedPaths?: readonly string[];
  /** For `export-signature` (lesson 14): the expectations that carry a check, taken from the contract. Each is observed by running the module. */
  expectations?: readonly EvidenceExpectation[];
  /** For `glossary-lint` (lesson 15): the words the identity's glossary refuses, and the prefixes whose added comment lines are read. */
  forbidden?: ReadonlyArray<{ term: string; say: string }>;
  writablePaths?: readonly string[];
  conventions?: ProjectConventions;
  timeoutMs?: number;
  maxObservationChars?: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_OBSERVATION_CHARS = 2000;

/** Classes no generic host check can observe: they need a human acceptance to count, unless an expectation carries its own content check (lesson 14). */
export const ACCEPTANCE_CLASSES: ReadonlySet<EvidenceClass> = new Set<EvidenceClass>(["semantic", "model", "runtime"]);

/** A module run in a child process that reports what an export actually is: the host observes runtime behaviour, not source text. */
const SIGNATURE_PROBE = `
const [modulePath, name] = process.argv.slice(1);
import(modulePath).then((m) => {
  const v = m[name];
  process.stdout.write(JSON.stringify({ present: name in m, type: typeof v, length: typeof v === "function" ? v.length : null, name: typeof v === "function" ? v.name : null }));
}).catch((e) => { process.stdout.write(JSON.stringify({ error: String(e && e.message || e) })); });
`;

/** Test and assertion lines in a test file, for the shrink half of `inherited-tests`: a coarse count, deliberately — a weakened expectation inside a kept assertion is the registry's stated limitation. */
export function countTestLines(source: string): { tests: number; asserts: number } {
  return { tests: (source.match(/\b(?:test|it)\s*\(/g) ?? []).length, asserts: (source.match(/\bassert\b/g) ?? []).length };
}

/** Write the files of `ref` that `keep` selects into `stage`, read from the repository's objects (never the working tree). */
async function stageTree(exec: Exec, cwd: string, ref: string, stage: string, keep: (file: string) => boolean, timeout: number): Promise<void> {
  const listed = await exec("git", ["ls-tree", "-r", "--name-only", ref], { cwd, timeout });
  if (listed.code !== 0) throw new Error(`git ls-tree ${ref}: ${listed.stderr.trim()}`);
  for (const file of listed.stdout.split("\n").filter(Boolean)) {
    if (!keep(file)) continue;
    const shown = await exec("git", ["show", `${ref}:${file}`], { cwd, timeout });
    if (shown.code !== 0) continue;
    await mkdir(path.dirname(path.join(stage, file)), { recursive: true });
    await writeFile(path.join(stage, file), shown.stdout, "utf8");
  }
}

export async function runHostChecks(exec: Exec, options: RunHostChecksOptions): Promise<HostCheckResult[]> {
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const max = options.maxObservationChars ?? DEFAULT_MAX_OBSERVATION_CHARS;
  const conventions = options.conventions ?? await discoverConventions(options.cwd);
  const results: HostCheckResult[] = [];

  for (const name of options.checks) {
    if (name === "run_tests") {
      if (conventions.testCommand.length === 0) {
        results.push({ check: name, class: "test", verdict: "inconclusive", observation: "no test command discovered: no package.json scripts.test and no test/ directory" });
        continue;
      }
      const argv = [...conventions.testCommand];
      if (argv[0] === "node" && argv.includes("--test")) argv.push("--test-reporter", "tap");
      const result = await exec(argv[0]!, argv.slice(1), { cwd: options.cwd, timeout });
      const output = `${result.stdout}\n${result.stderr}`;
      const summary = parseNodeTestSummary(output);
      if (!summary) {
        results.push({ check: name, class: "test", verdict: "inconclusive", command: argv, observation: `tests did not run (exit ${result.code}): ${boundedTail(output.trim(), max).text}` });
        continue;
      }
      const lines = [`${summary.pass} passed, ${summary.fail} failed`];
      for (const failure of summary.failures) lines.push(`not ok: ${failure}`);
      results.push({ check: name, class: "test", verdict: summary.fail === 0 ? "pass" : "fail", command: argv, observation: boundedTail(lines.join("\n"), max).text });
    } else if (name === "run_checks") {
      if (conventions.checks.length === 0) {
        results.push({ check: name, class: "command", verdict: "inconclusive", observation: "no checks defined for this project" });
        continue;
      }
      for (const check of conventions.checks) {
        const result = await exec(check.argv[0]!, check.argv.slice(1), { cwd: options.cwd, timeout });
        const ok = check.okWhen === "stdout-empty" ? result.code === 0 && result.stdout.trim() === "" : result.code === 0;
        const raw = check.okWhen === "stdout-empty" && result.code === 0 ? result.stdout : `${result.stderr}\n${result.stdout}`;
        results.push({ check: `run_checks:${check.name}`, class: "command", verdict: ok ? "pass" : "fail", command: check.argv, observation: ok ? `exit ${result.code}` : boundedTail(raw.trim() || `exit ${result.code}`, max).text });
      }
    } else if (name === "identity-untouched") {
      // INV-001 in code: nothing under a protected prefix differs between the base and the unit's HEAD — committed or not,
      // by any route. The bash watch (lesson 10) restores the working tree; this reads the branch.
      const prefixes = options.protectedPaths ?? conventions.protectedPaths;
      if (!options.base) {
        results.push({ check: name, class: "command", verdict: "inconclusive", observation: "no base ref given: the branch cannot be compared" });
        continue;
      }
      if (!prefixes.length) {
        results.push({ check: name, class: "command", verdict: "pass", observation: "no protected prefixes declared" });
        continue;
      }
      const argv = ["git", "diff", "--name-only", `${options.base}...HEAD`, "--", ...prefixes];
      const result = await exec(argv[0]!, argv.slice(1), { cwd: options.cwd, timeout });
      if (result.code !== 0) {
        results.push({ check: name, class: "command", verdict: "inconclusive", command: argv, observation: `git diff failed (exit ${result.code}): ${boundedTail(result.stderr.trim(), max).text}` });
        continue;
      }
      const changed = result.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
      results.push({ check: name, class: "command", verdict: changed.length ? "fail" : "pass", command: argv, observation: changed.length ? `protected paths changed on the branch (INV-001): ${changed.join(", ")}` : `no change under ${prefixes.join(", ")} since ${options.base}` });
    } else if (name === "export-signature") {
      // Behaviour by content (lesson 14): an expectation names the module, the export and the arity it must keep; the host
      // imports the module in its own process at HEAD and reads the function. A passing suite that never calls it is not evidence.
      const carrying = (options.expectations ?? []).filter((e) => e.check?.kind === "export-signature");
      if (!carrying.length) {
        results.push({ check: name, class: "runtime", verdict: "inconclusive", observation: "no expectation in the contract carries an export-signature check" });
        continue;
      }
      for (const e of carrying) {
        const spec = e.check as Extract<ExpectationCheck, { kind: "export-signature" }>;
        const argv = [process.execPath, "--input-type=module", "-e", SIGNATURE_PROBE, "--", `./${spec.module.replace(/^\.\//, "")}`, spec.export];
        const result = await exec(argv[0]!, argv.slice(1), { cwd: options.cwd, timeout });
        const shown = ["node", "--input-type=module", "-e", "<signature probe>", "--", spec.module, spec.export];
        let probe: { present?: boolean; type?: string; length?: number | null; error?: string } | undefined;
        try { probe = JSON.parse(result.stdout.trim()); } catch { probe = undefined; }
        if (!probe || probe.error !== undefined || result.code !== 0) {
          results.push({ check: `${name}:${e.id}`, class: "runtime", verdict: "inconclusive", command: shown, criterion: e.id, observation: `could not load ${spec.module}: ${boundedTail((probe?.error ?? result.stderr ?? "").trim() || `exit ${result.code}`, max).text}` });
          continue;
        }
        const ok = probe.present === true && probe.type === "function" && probe.length === spec.arity;
        results.push({
          check: `${name}:${e.id}`, class: "runtime", verdict: ok ? "pass" : "fail", command: shown, criterion: e.id,
          observation: !probe.present ? `${spec.module} does not export ${spec.export}` : probe.type !== "function" ? `${spec.module} exports ${spec.export} as a ${probe.type}, not a function`
            : ok ? `${spec.export}(${spec.arity} parameter${spec.arity === 1 ? "" : "s"}) exported by ${spec.module} at HEAD` : `${spec.export} declares ${probe.length} parameter(s); the contract fixes ${spec.arity}`,
        });
      }
    } else if (name === "glossary-lint") {
      // Vocabulary drift (lesson 15): the identity's glossary names the words this instance does not use; added comment lines
      // under the writable prefixes and the branch's commit messages are read for them. Code identifiers are not: a variable
      // named `task` is the project's business; a comment that calls a unit a task is drift.
      const terms = options.forbidden ?? [];
      if (!options.base) {
        results.push({ check: name, class: "command", verdict: "inconclusive", observation: "no base ref given: the branch cannot be read" });
        continue;
      }
      if (!terms.length) {
        results.push({ check: name, class: "command", verdict: "pass", observation: "the glossary refuses no words" });
        continue;
      }
      const prefixes = options.writablePaths ?? conventions.sourceDirs.map((d) => `${d}/`).concat("test/");
      const diffArgv = ["git", "diff", `${options.base}...HEAD`, "--", ...prefixes];
      const diff = await exec(diffArgv[0]!, diffArgv.slice(1), { cwd: options.cwd, timeout });
      const log = await exec("git", ["log", "--format=%s%n%b", `${options.base}..HEAD`], { cwd: options.cwd, timeout });
      if (diff.code !== 0 || log.code !== 0) {
        results.push({ check: name, class: "command", verdict: "inconclusive", command: diffArgv, observation: `git failed: ${boundedTail((diff.stderr + log.stderr).trim(), max).text}` });
        continue;
      }
      const hits: string[] = [];
      const patterns = terms.map((t) => ({ ...t, re: new RegExp(`\\b${t.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`, "i") }));
      for (const line of diff.stdout.split("\n")) {
        if (!line.startsWith("+") || line.startsWith("+++")) continue;
        const comment = /(\/\/.*|\/\*.*|^\s*\*.*|#.*)$/.exec(line.slice(1))?.[1];
        if (!comment) continue;
        for (const p of patterns) if (p.re.test(comment)) hits.push(`comment "${comment.trim().slice(0, 80)}": ${p.term} (say ${p.say})`);
      }
      for (const message of log.stdout.split("\n")) {
        for (const p of patterns) if (p.re.test(message)) hits.push(`commit "${message.trim().slice(0, 80)}": ${p.term} (say ${p.say})`);
      }
      results.push({ check: name, class: "command", verdict: hits.length ? "fail" : "pass", command: diffArgv, observation: hits.length ? boundedTail(`the glossary's words drifted on the branch: ${hits.join("; ")}`, max).text : `no refused word in added comments under ${prefixes.join(", ")} or in commit messages since ${options.base}` });
    } else if (name === "inherited-tests") {
      // The suite that judges a unit is the one it inherited (lesson 09, revisited): the base's test files and test
      // configuration are run against the unit's committed tree, and compared with the same suite against the base's own
      // tree — a test that fails on both is the project's known issue, a test that passed at the base and fails now is the
      // unit's regression. And the suite the unit leaves behind must be at least the suite it inherited: an inherited test
      // file that was deleted or lost test or assertion lines is a shrink. A unit may add cases; it may not weaken the cases
      // that were there. The contract exempts the files whose expectations it changes on purpose.
      if (!options.base) {
        results.push({ check: name, class: "test", verdict: "inconclusive", observation: "no base ref given: the inherited suite cannot be found" });
        continue;
      }
      const carrying = (options.expectations ?? []).filter((e) => e.check?.kind === "inherited-tests");
      const exempt = new Set(carrying.flatMap((e) => (e.check?.kind === "inherited-tests" ? e.check.exempt : [])));
      const criterion = carrying.length === 1 ? { criterion: carrying[0]!.id } : {};
      const listed = await exec("git", ["ls-tree", "-r", "--name-only", options.base, "--", "test/"], { cwd: options.cwd, timeout });
      if (listed.code !== 0) {
        results.push({ check: name, class: "test", verdict: "inconclusive", observation: `git failed: ${boundedTail(listed.stderr.trim(), max).text}`, ...criterion });
        continue;
      }
      const inheritedFiles = listed.stdout.split("\n").filter(Boolean);
      const judging = inheritedFiles.filter((f) => !exempt.has(f));
      if (!judging.length) {
        results.push({ check: name, class: "test", verdict: "pass", observation: `nothing inherited: no test file under test/ at ${options.base}${exempt.size ? ` outside the exempt ${[...exempt].join(", ")}` : ""}`, ...criterion });
        continue;
      }
      // Shrinkage: each inherited file at HEAD versus the base, by test and assertion lines.
      const shrunk: string[] = [];
      for (const file of judging) {
        const before = await exec("git", ["show", `${options.base}:${file}`], { cwd: options.cwd, timeout });
        const after = await exec("git", ["show", `HEAD:${file}`], { cwd: options.cwd, timeout });
        if (after.code !== 0) { shrunk.push(`${file} deleted`); continue; }
        const b = countTestLines(before.stdout), a = countTestLines(after.stdout);
        if (a.tests < b.tests || a.asserts < b.asserts) shrunk.push(`${file} (tests ${b.tests}→${a.tests}, assertions ${b.asserts}→${a.asserts})`);
      }
      // Regressions: the base's suite (and package.json) against the unit's tree, compared with the same suite against the base's tree.
      const stageBase = await mkdtemp(path.join(tmpdir(), "regulator-inherited-base-"));
      const stageUnit = await mkdtemp(path.join(tmpdir(), "regulator-inherited-unit-"));
      try {
        await stageTree(exec, options.cwd, options.base, stageBase, () => true, timeout);
        await stageTree(exec, options.cwd, "HEAD", stageUnit, (f) => f !== "package.json" && (!f.startsWith("test/") || exempt.has(f)), timeout);
        await stageTree(exec, options.cwd, options.base, stageUnit, (f) => f === "package.json" || (f.startsWith("test/") && !exempt.has(f)), timeout);
        for (const stage of [stageBase, stageUnit]) await symlink(path.join(options.cwd, "node_modules"), path.join(stage, "node_modules"), "dir").catch(() => undefined);
        const command = (await discoverConventions(stageUnit)).testCommand;
        if (!command.length) {
          results.push({ check: name, class: "test", verdict: "inconclusive", observation: `no test command at ${options.base}: nothing inherited can be run`, ...criterion });
          continue;
        }
        const argv = [...command];
        if (argv[0] === "node" && argv.includes("--test")) argv.push("--test-reporter", "tap");
        const runIn = async (cwd: string) => {
          const r = await exec(argv[0]!, argv.slice(1), { cwd, timeout });
          return { summary: parseNodeTestSummary(`${r.stdout}\n${r.stderr}`), output: `${r.stdout}\n${r.stderr}`, code: r.code };
        };
        const base = await runIn(stageBase);
        const unit = await runIn(stageUnit);
        if (!base.summary || !unit.summary) {
          results.push({ check: name, class: "test", verdict: "inconclusive", command: argv, observation: `the inherited suite did not run (base exit ${base.code}, unit exit ${unit.code}): ${boundedTail((unit.summary ? base.output : unit.output).trim(), max).text}`, ...criterion });
          continue;
        }
        const known = new Set(base.summary.failures);
        const regressions = unit.summary.failures.filter((f) => !known.has(f));
        const lines: string[] = [];
        if (regressions.length) lines.push(`regressions against the inherited suite from ${options.base}: ${regressions.map((f) => `not ok: ${f}`).join("; ")}`);
        if (shrunk.length) lines.push(`inherited test files shrunk on the branch: ${shrunk.join("; ")}`);
        const ok = !regressions.length && !shrunk.length;
        const summary = `${unit.summary.pass} passed, ${unit.summary.fail} failed against the ${judging.length} inherited test file(s) from ${options.base} (at the base: ${base.summary.pass} passed, ${base.summary.fail} failed)${exempt.size ? `; exempt: ${[...exempt].join(", ")}` : ""}`;
        results.push({ check: name, class: "test", verdict: ok ? "pass" : "fail", command: argv, observation: boundedTail(ok ? `no regression and no shrink: ${summary}` : `${lines.join("; ")} — ${summary}`, max).text, ...criterion });
      } finally {
        await rm(stageBase, { recursive: true, force: true });
        await rm(stageUnit, { recursive: true, force: true });
      }
    } else {
      results.push({ check: name, class: "command", verdict: "inconclusive", observation: `no host check named "${name}"` });
    }
  }

  for (const ref of options.fileRefs ?? []) {
    const argv = ["git", "cat-file", "-e", `HEAD:${ref}`];
    const result = await exec(argv[0]!, argv.slice(1), { cwd: options.cwd, timeout });
    results.push({ check: `file:${ref}`, class: "file", verdict: result.code === 0 ? "pass" : "fail", command: argv, observation: result.code === 0 ? "present at HEAD" : `not in the tree at HEAD: ${result.stderr.trim()}` });
  }
  return results;
}

export interface BindOptions {
  unitId: string;
  attempt: number;
  contract: { id: string; version: number };
  expectations: readonly EvidenceExpectation[];
  revision: string;
  environment?: EvidenceEnvironment;
  now?: () => number;
}

export function hostEnvironment(): EvidenceEnvironment {
  return { node: process.version, platform: process.platform, arch: process.arch };
}

/**
 * A record per result, bound to the criteria the check speaks to: the one criterion it observed by content, when it names
 * one (lesson 14); otherwise every expectation of the same class that carries no content check of its own.
 */
export function bindEvidence(results: readonly HostCheckResult[], options: BindOptions): EvidenceRecord[] {
  const at = new Date((options.now ?? Date.now)()).toISOString();
  const environment = options.environment ?? hostEnvironment();
  return results.map((r) => ({
    id: randomUUID(), unitId: options.unitId, attempt: options.attempt, contract: options.contract,
    check: r.check, class: r.class, criteria: r.criterion ? [r.criterion] : options.expectations.filter((e) => e.class === r.class && !e.check).map((e) => e.id),
    verdict: r.verdict, ...(r.command ? { command: r.command } : {}), observation: r.observation,
    revision: options.revision, environment, producedBy: "S3*", at,
  }));
}

export interface VerdictInput {
  contract: WorkContract;
  /** The report under closeout, if any: consulted only to name contradicted claims. */
  report?: ResultReport;
  /** Every evidence record the log holds for the unit, any revision. */
  records: readonly EvidenceRecord[];
  acceptances: readonly HumanAcceptance[];
  unitId: string;
  attempt: number;
  revision: string;
  now?: () => number;
}

export function technicalVerdict(input: VerdictInput): TechnicalVerdict {
  const { contract, revision } = input;
  const fresh = input.records.filter((r) => r.revision === revision);
  const satisfied: string[] = [], failed: string[] = [], missing: string[] = [], stale: string[] = [], awaitingAcceptance: string[] = [], reasons: string[] = [];

  for (const e of contract.expectedEvidence) {
    if (!e.required) continue;
    // A class no host check can observe waits for a person — unless a host check observed this criterion by content (lesson 14):
    // runtime behaviour a probe can read is host evidence like any other, and a person is asked only where no probe exists.
    if (ACCEPTANCE_CLASSES.has(e.class) && !input.records.some((r) => r.criteria.includes(e.id))) {
      const disposition = input.acceptances.filter((a) => a.criterion === e.id && a.revision === revision && a.contract.version === contract.version).at(-1);
      if (!disposition) { awaitingAcceptance.push(e.id); reasons.push(`${e.id} (${e.class}) cannot be observed by a host check and has no human acceptance at ${revision.slice(0, 7)}`); }
      else if (disposition.disposition === "accepted") satisfied.push(e.id);
      else { failed.push(e.id); reasons.push(`${e.id} rejected by ${disposition.by}${disposition.note ? `: ${disposition.note}` : ""}`); }
      continue;
    }
    const any = input.records.filter((r) => r.criteria.includes(e.id));
    const mine = fresh.filter((r) => r.criteria.includes(e.id));
    if (any.length === 0) { missing.push(e.id); reasons.push(`${e.id} (${e.class}): no host evidence`); }
    else if (mine.length === 0) { stale.push(e.id); reasons.push(`${e.id} (${e.class}): evidence exists only for ${[...new Set(any.map((r) => r.revision.slice(0, 7)))].join(", ")}, not ${revision.slice(0, 7)}`); }
    else if (mine.some((r) => r.verdict === "fail")) { failed.push(e.id); reasons.push(`${e.id} (${e.class}): ${mine.filter((r) => r.verdict === "fail").map((r) => `${r.check} — ${r.observation.split("\n").slice(0, 4).join("; ")}`).join("; ")}`); }
    else if (mine.every((r) => r.verdict === "inconclusive")) { missing.push(e.id); reasons.push(`${e.id} (${e.class}): ${mine.map((r) => `${r.check} — ${r.observation.split("\n")[0]}`).join("; ")}`); }
    else satisfied.push(e.id);
  }

  const contradicted: string[] = [];
  for (const claim of input.report?.evidence ?? []) {
    const failing = fresh.filter((r) => r.class === claim.class && r.verdict === "fail");
    if (failing.length) { contradicted.push(claim.ref); reasons.push(`report cites ${claim.class} evidence "${claim.ref}" but the host found ${failing.map((r) => r.check).join(", ")} failing at ${revision.slice(0, 7)}`); }
  }

  const verdict: Verdict = failed.length || contradicted.length ? "fail" : missing.length || stale.length || awaitingAcceptance.length ? "inconclusive" : "pass";
  return {
    id: randomUUID(), unitId: input.unitId, attempt: input.attempt, contract: { id: contract.id, version: contract.version }, revision, verdict,
    evidence: fresh.map((r) => r.id), satisfied, failed, missing, stale, contradicted: [...new Set(contradicted)], awaitingAcceptance, reasons,
    decidedBy: "S3*", at: new Date((input.now ?? Date.now)()).toISOString(),
  };
}

export function summarizeVerdict(v: TechnicalVerdict): string {
  const parts: string[] = [];
  if (v.failed.length) parts.push(`failed ${v.failed.join(", ")}`);
  if (v.contradicted.length) parts.push(`contradicted ${v.contradicted.join(", ")}`);
  if (v.missing.length) parts.push(`missing ${v.missing.join(", ")}`);
  if (v.stale.length) parts.push(`stale ${v.stale.join(", ")}`);
  if (v.awaitingAcceptance.length) parts.push(`awaiting acceptance ${v.awaitingAcceptance.join(", ")}`);
  return `${v.verdict}@${v.revision.slice(0, 7)}${parts.length ? ` (${parts.join("; ")})` : ""}`;
}
