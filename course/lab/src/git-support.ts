/** Test helper: a throwaway git repository with one commit. Not part of any checkpoint. */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";
import { realExec, type Exec } from "./exec.js";

const IDENTITY = ["-c", "user.name=lab", "-c", "user.email=lab@example.invalid", "-c", "commit.gpgsign=false"];

/** git with a fixed identity, so commits work in CI containers with no global config. */
export const gitExec: Exec = (command, args, options) =>
  command === "git" ? realExec(command, [...IDENTITY, ...args], options) : realExec(command, args, options);

/** The default throwaway project: a README, a source file the tests edit, and a real (passing) test suite so host-run verification has something to run. */
export const DEFAULT_REPO_FILES: Record<string, string> = {
  "README.md": "fixture\n",
  "src.txt": "one\n",
  "package.json": "{ \"name\": \"throwaway\", \"private\": true, \"type\": \"module\" }\n",
  "src/index.js": "export const answer = 42;\n",
  "test/index.test.js": "import test from \"node:test\";\nimport assert from \"node:assert/strict\";\nimport { answer } from \"../src/index.js\";\ntest(\"answer\", () => { assert.equal(answer, 42); });\n",
};

export async function initRepo(t: TestContext, files: Record<string, string> = DEFAULT_REPO_FILES): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-git-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
    await writeFile(path.join(dir, name), content);
  }
  await writeFile(path.join(dir, ".gitignore"), ".regulator/\n");
  for (const args of [["init", "--quiet", "-b", "main"], ["add", "-A"], ["commit", "--quiet", "-m", "init"]]) {
    const r = await gitExec("git", args, { cwd: dir });
    if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  }
  return dir;
}
