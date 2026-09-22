/** Test helper: a throwaway git repository with one commit. Not part of any checkpoint. */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";
import { realExec, type Exec } from "./exec.js";

const IDENTITY = ["-c", "user.name=lab", "-c", "user.email=lab@example.invalid", "-c", "commit.gpgsign=false"];

/** git with a fixed identity, so commits work in CI containers with no global config. */
export const gitExec: Exec = (command, args, options) =>
  command === "git" ? realExec(command, [...IDENTITY, ...args], options) : realExec(command, args, options);

export async function initRepo(t: TestContext, files: Record<string, string> = { "README.md": "fixture\n", "src.txt": "one\n" }): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-git-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) await writeFile(path.join(dir, name), content);
  await writeFile(path.join(dir, ".gitignore"), ".regulator/\n");
  for (const args of [["init", "--quiet", "-b", "main"], ["add", "-A"], ["commit", "--quiet", "-m", "init"]]) {
    const r = await gitExec("git", args, { cwd: dir });
    if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  }
  return dir;
}
