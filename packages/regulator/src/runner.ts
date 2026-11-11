/**
 * The command runner (#122): the control plane's own dispatcher for a unit
 * type that runs a program instead of a session. The loop runs a command
 * unit through the same `Dispatcher` seam and the same steps — start, lease,
 * worktree, dispatch, read back the report, route, close — with this as the
 * dispatcher. No host is needed: the program is run here, with the control
 * plane's own process runner, in the unit's worktree, with the contract
 * path and the attempt in its environment, under the policy's wall-clock
 * ceiling for the unit type as its one budget. Tokens, cost and turns are
 * recorded as zero.
 *
 * The program's exit and its output are the report. Exit 0 with a last
 * stdout line that is a JSON object becomes the result report's summary and
 * extra fields, validated against the report schema; a program may not claim
 * delegated decisions or unresolved outcomes it does not have, so those
 * lists are empty by construction. Exit 0 with no JSON line is a report
 * whose summary is "exit 0" and the stdout tail. Either way the report's
 * required evidence is referenced by class for each expectation the
 * contract requires, pointing at the host's check: a program cites no run
 * it did not make, and the closeout's own run is what satisfies or
 * contradicts the reference. A non-zero exit, a run past
 * the ceiling, or a write outside the declared outputs is a dispatch error,
 * routed under the recovery policy as a session's dispatch error is; the
 * stray writes are undone before the error is raised, and the error names
 * them. The program's file is resolved under the definition as a declared
 * grader's is and hashed into the attempt record, so a report can say what
 * produced it.
 *
 * What the runner trusts: the declared command to be the workload's program,
 * as the host trusts `npm test` to be the project's suite. It inspects
 * nothing beyond the effect declaration (the profile, read by the definition
 * check) and the outputs; the closeout re-runs the workload's checks at the
 * revision whether a model or a program produced it.
 */
import { performance } from "node:perf_hooks";
import { rm } from "node:fs/promises";
import path from "node:path";
import { ExecutionStore, fileSha256, graderFile, normalizeOutput } from "@metacoding.io/regulator-core";
import { ResultReportInputSchema, type AttemptProgram, type BudgetCeiling, type BudgetLedger, type CommandRunner, type EvidenceExpectation, type Program, type ResultReport, type ResultReportInput } from "@metacoding.io/regulator-protocol";
import { Value } from "typebox/value";
import type { Dispatcher } from "./controller.js";
import type { Exec, ExecResult } from "./exec.js";

/** A dispatch error from a program, carrying what ran so the attempt record can say so even when the run failed. */
export class ProgramError extends Error {
  constructor(message: string, readonly program?: AttemptProgram) {
    super(message);
    this.name = "ProgramError";
  }
}

export interface CommandDispatcherOptions {
  /** The instance (the base checkout): where the execution store lives. */
  repo: string;
  /** The definition root the program's file is resolved under. */
  definitionRoot: string;
  runner: CommandRunner;
  /** The policy's ceiling for the unit type: `wallClockMs` is the one dimension a program consumes. */
  ceiling: BudgetCeiling;
  now?: () => number;
}

/** The argv as the control plane runs it: the program's file made absolute under the definition, everything else as declared. */
export function commandArgv(root: string, runner: Pick<Program, "argv">, file: string): string[] {
  let replaced = false;
  return runner.argv.map((entry) => {
    if (replaced || path.isAbsolute(entry) || path.relative(root, path.resolve(root, entry)) !== file.split("/").join(path.sep)) return entry;
    replaced = true;
    return path.resolve(root, file);
  });
}

/** The paths `git status` reports changed or untracked in a worktree, as the index spells them (a rename by its new name). */
async function changedPaths(exec: Exec, worktree: string): Promise<Set<string>> {
  const r = await exec("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: worktree });
  if (r.code !== 0) throw new ProgramError(`git status failed in the worktree (exit ${r.code}): ${r.stderr.trim()}`);
  const out = new Set<string>();
  for (const line of r.stdout.split("\n")) {
    if (!line.trim()) continue;
    const spec = line.slice(3);
    const renamed = spec.indexOf(" -> ");
    out.add(normalizeOutput(renamed >= 0 ? spec.slice(renamed + 4) : spec));
  }
  return out;
}

export interface RunProgramOptions {
  /** The definition root the program's file is resolved under. */
  root: string;
  program: Program;
  /** The worktree the program runs in. */
  cwd: string;
  /** The ceiling the run is under; the lesser of it and the program's own `timeoutMs` is the timeout the program runs under. */
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
  /** What the program is handed on stdin: a declared tool's arguments as JSON (#121). A command runner's program gets nothing. */
  input?: string;
}

export interface ProgramRun {
  /** The program that ran: its file under the definition and its hash. The exit is the result's. */
  program: AttemptProgram;
  argv: string[];
  result: ExecResult;
  elapsedMs: number;
  timedOut: boolean;
  /** The paths written under the declared outputs, as the index spells them. */
  written: string[];
  /** The paths written outside the declared outputs: undone before this returns, and named so the caller can refuse the run. */
  outside: string[];
}

/**
 * Run a program the definition declares — a command runner's or a declared tool's (#121) — in a worktree, under its
 * declared outputs: the file is resolved under the definition and hashed, the worktree is diffed against itself before
 * the run, and a write outside the outputs is undone before anything is returned. What the run means — a dispatch error,
 * a refused tool call, a report — is the caller's: this returns what happened and refuses nothing but a program that
 * names no file under the definition, which the definition check refuses first.
 */
export async function runProgram(exec: Exec, options: RunProgramOptions): Promise<ProgramRun> {
  const { root, program: declared } = options;
  const file = await graderFile(root, declared.argv);
  if (!file) throw new ProgramError(`the program \`${declared.argv.join(" ")}\` names no file under the definition (${root}); the definition check refuses this, and the loop does not run what it cannot hash`);
  const program: AttemptProgram = { file, sha256: await fileSha256(root, file) };
  const argv = commandArgv(root, declared, file);
  const outputs = declared.outputs.map(normalizeOutput);
  const before = await changedPaths(exec, options.cwd);
  const timeout = Math.min(declared.timeoutMs ?? Number.POSITIVE_INFINITY, options.timeoutMs);
  const started = performance.now();
  const result = await exec(argv[0]!, argv.slice(1), { cwd: options.cwd, timeout, ...(options.env ? { env: options.env } : {}), ...(options.input === undefined ? {} : { input: options.input }) });
  const elapsedMs = Math.round(performance.now() - started);
  const timedOut = result.code !== 0 && elapsedMs >= timeout;
  // The diff against the worktree before the run: a write outside the declared outputs is undone, whatever the exit.
  const after = await changedPaths(exec, options.cwd);
  const changed = [...after].filter((p) => !before.has(p)).sort();
  const outside = changed.filter((p) => !outputs.some((o) => p.startsWith(o)));
  if (outside.length) {
    const tracked = await exec("git", ["ls-files", "--error-unmatch", "--", ...outside], { cwd: options.cwd });
    const known = new Set(tracked.stdout.split("\n").map((l) => l.trim()).filter(Boolean));
    for (const p of outside) {
      if (known.has(p)) await exec("git", ["checkout", "--", p], { cwd: options.cwd });
      else await rm(path.join(options.cwd, p), { force: true, recursive: true });
    }
  }
  return { program, argv, result, elapsedMs, timedOut, written: changed.filter((p) => !outside.includes(p)), outside };
}

const TAIL_LINES = 3;
const TAIL_CHARS = 400;

/** The last lines of a program's output, bounded, on one line. */
export function tail(text: string): string {
  const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean).slice(-TAIL_LINES);
  const joined = lines.join(" | ");
  return joined.length > TAIL_CHARS ? `…${joined.slice(-TAIL_CHARS)}` : joined;
}

/** What a failed program said: its first lines, where a runtime puts the message, and its last, where it puts the exit; bounded, on one line. */
export function excerpt(text: string): string {
  const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  const kept = lines.length > 2 * TAIL_LINES ? [...lines.slice(0, TAIL_LINES), "…", ...lines.slice(-TAIL_LINES)] : lines;
  const joined = kept.join(" | ");
  return joined.length > 2 * TAIL_CHARS ? `${joined.slice(0, TAIL_CHARS)}…${joined.slice(-TAIL_CHARS)}` : joined;
}

/** The references a program's report carries for the evidence the contract requires: one per required expectation, by class, naming the host's check and claiming no run. */
function hostEvidenceFor(expectations: readonly EvidenceExpectation[], claimed: readonly { class: string }[]): ResultReportInput["evidence"] {
  return expectations
    .filter((e) => e.required && !claimed.some((c) => c.class === e.class))
    .map((e) => ({ class: e.class, ref: e.id, observation: "owed to the host's checks at closeout; a program runs no check of its own" }));
}

/** The report a program's exit 0 and stdout make: the last line as a JSON object, or "exit 0" with the tail; the required evidence referenced by class. */
export function reportFromOutput(stdout: string, expectations: readonly EvidenceExpectation[] = []): ResultReportInput {
  const last = stdout.trim().split("\n").map((l) => l.trim()).filter(Boolean).at(-1);
  let parsed: unknown;
  try { parsed = last === undefined ? undefined : JSON.parse(last); } catch { parsed = undefined; }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    const t = tail(stdout);
    return { summary: t ? `exit 0: ${t}` : "exit 0", evidence: hostEvidenceFor(expectations, []), delegatedResults: [], unresolvedOutcomes: [], emergentDecisions: [], deviations: [], residualUncertainty: [] };
  }
  const claimed = parsed as Record<string, unknown>;
  for (const list of ["delegatedResults", "unresolvedOutcomes"] as const) {
    if (Array.isArray(claimed[list]) && claimed[list].length) throw new ProgramError(`the program's report claims ${list}, which a program does not have: a delegated decision is a judgment, and a program reports its exit and its output`);
  }
  const { delegatedResults: _d, unresolvedOutcomes: _u, ...rest } = claimed;
  const input = { evidence: [], emergentDecisions: [], deviations: [], residualUncertainty: [], ...rest, summary: typeof claimed.summary === "string" && claimed.summary ? claimed.summary : "exit 0", delegatedResults: [], unresolvedOutcomes: [] };
  if (!Value.Check(ResultReportInputSchema, input)) throw new ProgramError(`the program's last line is a JSON object but not a result report (summary, evidence[], emergentDecisions[], deviations[], residualUncertainty[]): ${last!.slice(0, 200)}`);
  return { ...input, evidence: [...input.evidence, ...hostEvidenceFor(expectations, input.evidence)] };
}

/**
 * The dispatcher for a command unit. One per dispatch, built by the loop from the unit type's runner and the policy's
 * ceiling; it never reads the hint, the route or the policy path, which are a session's.
 */
export function commandDispatcher(exec: Exec, options: CommandDispatcherOptions): Dispatcher {
  const now = options.now ?? Date.now;
  const stamp = () => new Date(now()).toISOString();
  const { runner, ceiling, definitionRoot: root } = options;
  const store = new ExecutionStore(options.repo, now);
  return async (request) => {
    const startedAt = stamp();
    const timeout = Math.min(runner.timeoutMs ?? Number.POSITIVE_INFINITY, ceiling.wallClockMs);
    const run = await runProgram(exec, {
      root, program: runner, cwd: request.worktree, timeoutMs: ceiling.wallClockMs,
      env: { REGULATOR_CONTRACT: request.contractPath, REGULATOR_ATTEMPT: String(request.attempt), REGULATOR_UNIT: request.unitId, REGULATOR_PROFILE: request.profile },
    });
    const { program, result, timedOut, written, outside } = run;
    const file = program.file;
    // The ledger: wall-clock is the one dimension a program consumes; the rest is zero by construction.
    const ledger: BudgetLedger = {
      unitId: request.unitId, attempt: request.attempt,
      ceiling: { tokens: ceiling.tokens, ...(ceiling.cost === undefined ? {} : { cost: ceiling.cost }), wallClockMs: ceiling.wallClockMs, turns: ceiling.turns },
      consumed: { tokens: 0, cost: 0, wallClockMs: run.elapsedMs, turns: 0 },
      startedAt, updatedAt: stamp(), models: [], compactions: [],
      ...(timedOut ? { exhausted: { dimension: "wallClockMs", at: stamp() } } : {}),
    };
    await store.writeBudget(ledger);
    // A write outside the declared outputs was undone by the run and is refused here, whatever the exit.
    if (outside.length) {
      throw new ProgramError(`the program wrote outside its declared outputs (${runner.outputs.map(normalizeOutput).join(", ") || "none"}): ${outside.join(", ")}; the writes are undone and nothing of this attempt is committed`, { ...program, ...(timedOut ? {} : { exit: result.code }) });
    }
    if (timedOut) throw new ProgramError(`the program ran past the wall-clock ceiling (${timeout} ms) and was stopped: timed out with nothing reported${result.stderr.trim() ? `; stderr: ${tail(result.stderr)}` : ""}`, program);
    if (result.code !== 0) throw new ProgramError(`the program exited ${result.code}: ${excerpt(result.stderr) || excerpt(result.stdout) || "(no output)"}`, { ...program, exit: result.code });
    const input = reportFromOutput(result.stdout, request.contract.expectedEvidence);
    // The program's writes under its outputs are the attempt's commit; a program that wrote nothing leaves the branch as it was.
    if (written.length) {
      await exec("git", ["add", "-A", "--", ...written], { cwd: request.worktree });
      const commit = await exec("git", ["-c", "commit.gpgsign=false", "commit", "-q", "-m", `${request.unitId}: attempt ${request.attempt} of the program ${path.basename(file)}`], { cwd: request.worktree });
      if (commit.code !== 0) throw new ProgramError(`could not commit the program's outputs: ${tail(commit.stderr)}`, { ...program, exit: result.code });
    }
    const report: ResultReport = { contractId: request.contract.id, contractVersion: request.contract.version, unitId: request.unitId, attempt: request.attempt, reportedAt: stamp(), ...input };
    await store.writeReport(report);
    return { program: { ...program, exit: result.code } };
  };
}
