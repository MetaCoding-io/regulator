/**
 * Project conventions the harness can *determine*, as opposed to what the
 * README *claims*. No Pi dependency: this is the shape of a fact about a
 * project, and it should be readable without knowing any harness API.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export interface Check {
  name: string;
  argv: string[];
  /** How to read the outcome. `exit-zero` is the default contract for a check. */
  okWhen: "exit-zero" | "stdout-empty";
}

export interface ProjectConventions {
  /** How to run the tests, as argv. Empty when nothing was discovered. */
  testCommand: string[];
  testCommandSource: "package.json scripts.test" | "node --test (test/ directory present)" | "none";
  /** Directories that exist among the conventional source locations. */
  sourceDirs: string[];
  /** Paths the project treats as not-to-be-edited. */
  protectedPaths: string[];
  checks: Check[];
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Look at the project and report what can be known mechanically. */
export async function discoverConventions(cwd: string): Promise<ProjectConventions> {
  const conventions: ProjectConventions = {
    testCommand: [],
    testCommandSource: "none",
    sourceDirs: [],
    protectedPaths: [],
    checks: [],
  };

  let scripts: Record<string, unknown> = {};
  try {
    const pkg = JSON.parse(await readFile(path.join(cwd, "package.json"), "utf8")) as { scripts?: Record<string, unknown> };
    scripts = pkg.scripts ?? {};
  } catch {
    // No package.json, or not JSON. Not an error: it is a fact about the project.
  }

  if (typeof scripts.test === "string") {
    conventions.testCommand = ["npm", "test"];
    conventions.testCommandSource = "package.json scripts.test";
  } else if (await exists(path.join(cwd, "test"))) {
    conventions.testCommand = ["node", "--test"];
    conventions.testCommandSource = "node --test (test/ directory present)";
  }

  for (const dir of ["src", "lib"]) {
    if (await exists(path.join(cwd, dir))) conventions.sourceDirs.push(dir);
  }

  if (await exists(path.join(cwd, "vendor"))) conventions.protectedPaths.push("vendor/");

  for (const dir of conventions.sourceDirs) {
    const entries = await readdir(path.join(cwd, dir), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !/\.(m?js)$/.test(entry.name)) continue;
      const file = `${dir}/${entry.name}`;
      conventions.checks.push({ name: `syntax:${file}`, argv: ["node", "--check", file], okWhen: "exit-zero" });
    }
  }

  if (conventions.protectedPaths.length > 0) {
    conventions.checks.push({
      name: "protected-untouched",
      argv: ["git", "status", "--porcelain", "--", ...conventions.protectedPaths],
      okWhen: "stdout-empty",
    });
  }

  return conventions;
}

export interface TestSummary {
  pass: number;
  fail: number;
  failures: string[];
}

/**
 * Read Node's test-runner output. Returns `undefined` when no summary was
 * found, i.e. the tests did not run.
 *
 * Two formats are accepted, because the default reporter is not a stable fact:
 * `tap` prints `# pass N` and `not ok N - name`; `spec` — the default on Node 24
 * even when piped — prints `ℹ pass N` and `✖ name (duration)`. A harness that
 * runs the tests itself should request `--test-reporter=tap`; one that runs a
 * project's own `npm test` script gets whatever that script prints.
 */
export function parseNodeTestSummary(output: string): TestSummary | undefined {
  const pass = /^(?:# |ℹ )pass (\d+)$/m.exec(output);
  const fail = /^(?:# |ℹ )fail (\d+)$/m.exec(output);
  if (!pass || !fail) return undefined;
  const failures = new Set<string>();
  for (const match of output.matchAll(/^not ok \d+ - (.+)$/gm)) failures.add(match[1]!.trim());
  for (const match of output.matchAll(/^✖ (.+?) \([\d.]+ms\)$/gm)) failures.add(match[1]!.trim());
  return { pass: Number(pass[1]), fail: Number(fail[1]), failures: [...failures] };
}

/** Keep the tail of `text` within `maxChars`. Tool output is context the model has to pay for. */
export function boundedTail(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: `[… ${text.length - maxChars} chars omitted]\n${text.slice(-maxChars)}`, truncated: true };
}
