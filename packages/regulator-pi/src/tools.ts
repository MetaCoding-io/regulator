/**
 * Checkpoint 2 — tools as the variety interface (lesson 03).
 *
 * Three typed tools replace "run whatever shell command seems right":
 *
 *   read_conventions  what the harness can determine about the project
 *   run_tests         the project's real test command, summarized
 *   run_checks        the project's deterministic checks, one verdict each
 *
 * Each has a narrow schema, bounded output, and one error contract:
 * a tool *throws* when it could not do its job (no test command, the
 * command would not start), and *returns normally* when it did its job and
 * the answer is bad news (tests failed, a check did not pass). The model can
 * act on the second; only the harness can act on the first.
 */
import { Type } from "typebox";
import type { ExecOptions, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { boundedTail, discoverConventions, parseNodeTestSummary, type Check } from "@metacoding/regulator-checks";

export const TOOL_NAMES = ["read_conventions", "run_tests", "run_checks"] as const;

export interface TypedToolsOptions {
  /** Upper bound on raw output returned to the model, in characters. */
  maxOutputChars?: number;
  /** Per-command timeout in milliseconds. */
  timeoutMs?: number;
}

const DEFAULT_MAX_OUTPUT_CHARS = 4000;
const DEFAULT_TIMEOUT_MS = 120_000;

export interface CheckResult {
  name: string;
  ok: boolean;
  code: number;
  detail: string;
}

export function createTypedToolsExtension(options: TypedToolsOptions = {}): (pi: ExtensionAPI) => void {
  const maxOutputChars = options.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return (pi) => {
    const execOptions = (cwd: string, signal: AbortSignal | undefined): ExecOptions =>
      signal ? { cwd, timeout: timeoutMs, signal } : { cwd, timeout: timeoutMs };

    pi.registerTool({
      name: "read_conventions",
      label: "Read conventions",
      description:
        "Report what can be determined mechanically about this project: the real test command, " +
        "where source lives, which paths are protected, and which checks exist. Prefer this over " +
        "trusting a README, which may be stale.",
      promptSnippet: "Discover the project's real test command, layout, protected paths and checks",
      promptGuidelines: ["Call read_conventions before running tests or checks for the first time in a project."],
      parameters: Type.Object({}),
      async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
        const conventions = await discoverConventions(ctx.cwd);
        const lines = [
          `test command: ${conventions.testCommand.length ? conventions.testCommand.join(" ") : "(none discovered)"} — ${conventions.testCommandSource}`,
          `source dirs: ${conventions.sourceDirs.join(", ") || "(none of src/, lib/)"}`,
          `protected paths: ${conventions.protectedPaths.join(", ") || "(none)"}`,
          `checks: ${conventions.checks.map((c) => c.name).join(", ") || "(none)"}`,
        ];
        return { content: [{ type: "text", text: lines.join("\n") }], details: conventions };
      },
    });

    pi.registerTool({
      name: "run_tests",
      label: "Run tests",
      description:
        "Run the project's real test command and return a summary: counts, the names of failing " +
        `tests, and at most ${maxOutputChars} characters of output when something failed. ` +
        "Throws only if the tests could not be run at all.",
      promptSnippet: "Run the project's tests and get a bounded, structured summary",
      promptGuidelines: ["Use run_tests instead of invoking a test runner through bash."],
      parameters: Type.Object({
        filter: Type.Optional(Type.String({ description: "Only run tests whose name matches this pattern" })),
      }),
      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        const conventions = await discoverConventions(ctx.cwd);
        if (conventions.testCommand.length === 0) {
          throw new Error("No test command discovered: no package.json scripts.test and no test/ directory.");
        }
        const argv = [...conventions.testCommand];
        if (argv[0] === "node" && argv.includes("--test")) {
          // We own this argv, so pin the reporter: the default changed between Node versions.
          argv.push("--test-reporter", "tap");
          if (params.filter) argv.push("--test-name-pattern", params.filter);
        }
        const result = await pi.exec(argv[0]!, argv.slice(1), execOptions(ctx.cwd, signal));
        if (result.killed) throw new Error(`Test command timed out after ${timeoutMs} ms: ${argv.join(" ")}`);
        const output = `${result.stdout}\n${result.stderr}`;
        const summary = parseNodeTestSummary(output);
        if (!summary) {
          const tail = boundedTail(output.trim(), maxOutputChars);
          throw new Error(`Test command did not produce a test summary (exit ${result.code}): ${argv.join(" ")}\n${tail.text}`);
        }
        const lines = [`${summary.pass} passed, ${summary.fail} failed (${argv.join(" ")})`];
        for (const name of summary.failures) lines.push(`  not ok: ${name}`);
        let truncated = false;
        if (summary.fail > 0) {
          const tail = boundedTail(output.trim(), maxOutputChars);
          truncated = tail.truncated;
          lines.push("", tail.text);
        }
        return {
          content: [{ type: "text", text: lines.join("\n") }],
          details: { command: argv, code: result.code, ...summary, truncated },
        };
      },
    });

    pi.registerTool({
      name: "run_checks",
      label: "Run checks",
      description:
        "Run every deterministic check the project defines (syntax checks, protected paths untouched) " +
        "and return one verdict per check. Throws only if a check command could not start.",
      promptSnippet: "Run the project's deterministic checks and get one verdict per check",
      promptGuidelines: ["Run run_checks before reporting work as done."],
      parameters: Type.Object({}),
      async execute(_toolCallId, _params, signal, _onUpdate, ctx) {
        const conventions = await discoverConventions(ctx.cwd);
        const results: CheckResult[] = [];
        for (const check of conventions.checks) {
          results.push(await runCheck(check, execOptions(ctx.cwd, signal)));
        }
        const lines = results.map((r) => `${r.ok ? "ok  " : "FAIL"} ${r.name}${r.ok ? "" : ` — ${r.detail}`}`);
        if (lines.length === 0) lines.push("(no checks defined)");
        return { content: [{ type: "text", text: lines.join("\n") }], details: { results } };
      },
    });

    async function runCheck(check: Check, options: ExecOptions): Promise<CheckResult> {
      const result = await pi.exec(check.argv[0]!, check.argv.slice(1), options);
      if (result.killed) throw new Error(`Check timed out: ${check.name}`);
      const ok = check.okWhen === "stdout-empty" ? result.code === 0 && result.stdout.trim() === "" : result.code === 0;
      const raw = check.okWhen === "stdout-empty" && result.code === 0 ? result.stdout : `${result.stderr}\n${result.stdout}`;
      return { name: check.name, ok, code: result.code, detail: boundedTail(raw.trim(), maxOutputChars).text };
    }
  };
}

export default createTypedToolsExtension();
