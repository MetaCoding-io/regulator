/**
 * The host seam. The loop runs a unit through a `Dispatcher`; a *host* is the package that supplies one for a
 * particular agent runtime, and the session-side extensions that enforce the control plane inside it. Pi's is
 * `@metacoding.io/regulator-pi`. The control plane never imports a host: it resolves one by name at run time — from the
 * project the operator is in, then from beside itself — so that headless runs, `doctor`, `status` and CI need none.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { Dispatcher } from "./controller.js";

export const DEFAULT_HOST = "@metacoding.io/regulator-pi";

export interface HostDispatcherOptions {
  /** Echo the model's text to stdout as it streams. */
  echo?: boolean;
  /** The extensions to load instead of the host's full list, by name: an eval arm (lesson 14). */
  extensions?: readonly string[];
}

/** What a host package exports as `host`. */
export interface Host {
  name: string;
  /** The agent runtime the host binds to, and the version it pins (`@earendil-works/pi-coding-agent` for Pi). */
  runtime: { name: string; pin: string };
  /** The session extensions the host loads for a unit, by name, in load order. */
  extensions: readonly string[];
  /** The absolute path of a named extension's built module. */
  extensionPath(name: string): string;
  dispatcher(options?: HostDispatcherOptions): Dispatcher;
}

export interface ResolvedHost {
  host: Host;
  /** Where the host package was found. */
  packageDir: string;
  /** The runtime's installed version beside the host, when it is. */
  installed?: string;
}

function tryResolve(spec: string, from: string): string | undefined {
  try { return createRequire(from).resolve(spec); } catch { return undefined; }
}

/** A package's package.json, whether or not the package exports it: the manifest under a node_modules on the way up from `from`. */
function packageManifest(name: string, from: string): string | undefined {
  const direct = tryResolve(`${name}/package.json`, from);
  if (direct) return direct;
  const start = from.startsWith("file:") ? path.dirname(fileURLToPath(from)) : path.dirname(from);
  for (let dir = start; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, "node_modules", ...name.split("/"), "package.json");
    if (existsSync(candidate)) return candidate;
    if (dir === path.dirname(dir)) return undefined;
  }
}

/** Where a host package lives: `--host` or REGULATOR_HOST first, then the operator's project, then beside the control plane. */
export function resolveHostPackage(name: string = process.env.REGULATOR_HOST ?? DEFAULT_HOST, cwd: string = process.cwd()): string | undefined {
  if (name.startsWith("/") || name.startsWith(".")) return path.resolve(cwd, name, "package.json");
  return packageManifest(name, path.join(cwd, "noop.js")) ?? packageManifest(name, import.meta.url);
}

/** Load a host, or say plainly that none is installed. */
export async function loadHost(name?: string, cwd?: string): Promise<ResolvedHost> {
  const pkgFile = resolveHostPackage(name, cwd);
  if (!pkgFile) {
    throw new Error(`no host installed: the control plane needs one to run live units. Install ${name ?? DEFAULT_HOST} (the Pi host: \`pnpm add ${DEFAULT_HOST}\`) in the project or beside regulator, or name one with --host / REGULATOR_HOST. Scripted runs, doctor, status and check need none.`);
  }
  const packageDir = path.dirname(pkgFile);
  const pkg = JSON.parse(await readFile(pkgFile, "utf8")) as { name: string; exports?: unknown; main?: string };
  const mod = (await import(createRequire(pkgFile).resolve(pkg.name))) as { host?: Host };
  if (!mod.host) throw new Error(`${pkg.name} is not a regulator host: it exports no \`host\``);
  let installed: string | undefined;
  try {
    const runtimePkg = JSON.parse(await readFile(packageManifest(mod.host.runtime.name, pkgFile) ?? "", "utf8")) as { version?: string };
    installed = runtimePkg.version;
  } catch { /* the runtime is not installed beside the host */ }
  return { host: mod.host, packageDir, ...(installed === undefined ? {} : { installed }) };
}

/** The runtime pin a host declares, without loading it: what the manifest and the eval fingerprint record. */
export async function hostPin(name?: string, cwd?: string): Promise<{ host: string; runtime: string; pin: string; installed?: string } | undefined> {
  const pkgFile = resolveHostPackage(name, cwd);
  if (!pkgFile) return undefined;
  const pkg = JSON.parse(await readFile(pkgFile, "utf8")) as { name: string; peerDependencies?: Record<string, string> };
  const [runtime, pin] = Object.entries(pkg.peerDependencies ?? {})[0] ?? ["none", "none"];
  let installed: string | undefined;
  try {
    const runtimePkg = JSON.parse(await readFile(packageManifest(runtime, pkgFile) ?? "", "utf8")) as { version?: string };
    installed = runtimePkg.version;
  } catch { /* not installed */ }
  return { host: pkg.name, runtime, pin, ...(installed === undefined ? {} : { installed }) };
}
