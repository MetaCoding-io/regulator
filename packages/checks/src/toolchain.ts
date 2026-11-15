/**
 * The toolchain a check ran under (#178): one function that tries the three
 * sources in order and records the first found. No Pi dependency and no exec:
 * it reads the environment variables and the files of one directory.
 *
 * Which directory is the caller's statement: for evidence, the worktree the
 * check ran in (the unit's revision, since evidence binds only to a clean
 * tree); for the eval fingerprint, the definition's repository; for the
 * manifest and `doctor`, the instance's repository.
 */
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { ENVIRONMENT_LOCKS, PACKAGE_LOCKS, type EvidenceEnvironment, type Toolchain } from "@metacoding.io/regulator-protocol";

const sha256 = (data: string | Buffer): string => createHash("sha256").update(data).digest("hex");

async function firstFile(dir: string, names: readonly string[]): Promise<Buffer | undefined> {
  for (const name of names) {
    try {
      return await readFile(path.join(dir, name));
    } catch {
      // Absent, or not a readable file: the next name.
    }
  }
  return undefined;
}

/**
 * The store path a Nix or devenv shell puts the process under, as a string to hash, or undefined outside one.
 * `DEVENV_PROFILE` names the profile (resolved through its symlink to the content-addressed store path); a bare
 * `IN_NIX_SHELL` (`nix develop`, `nix-shell`) names no single path, so the shell's inputs on PATH stand for it: the
 * sorted, deduplicated `/nix/store/` entries, which are content-addressed each.
 */
export async function nixStoreIdentity(env: NodeJS.ProcessEnv = process.env): Promise<string | undefined> {
  const profile = env.DEVENV_PROFILE?.trim();
  if (profile) return realpath(profile).catch(() => profile);
  if (env.IN_NIX_SHELL?.trim()) {
    const entries = [...new Set((env.PATH ?? "").split(path.delimiter).filter((p) => p.startsWith("/nix/store/")))].sort();
    if (entries.length) return entries.join("\n");
  }
  return undefined;
}

/** The first of `nix-store`, `lock` and `package-lock` found for `dir`; undefined when none is. */
export async function discoverToolchain(dir: string, env: NodeJS.ProcessEnv = process.env): Promise<Toolchain | undefined> {
  const store = await nixStoreIdentity(env);
  if (store !== undefined) return { source: "nix-store", hash: sha256(store) };
  const lock = await firstFile(dir, ENVIRONMENT_LOCKS);
  if (lock) return { source: "lock", hash: sha256(lock) };
  const pkg = await firstFile(dir, PACKAGE_LOCKS);
  if (pkg) return { source: "package-lock", hash: sha256(pkg) };
  return undefined;
}

/** The host's environment for evidence about a check that ran in `cwd`: node, platform, arch, and the toolchain when one is found. */
export async function evidenceEnvironment(cwd: string, env: NodeJS.ProcessEnv = process.env): Promise<EvidenceEnvironment> {
  const toolchain = await discoverToolchain(cwd, env);
  return { node: process.version, platform: process.platform, arch: process.arch, ...(toolchain ? { toolchain } : {}) };
}
