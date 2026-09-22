/**
 * Write authority as a mechanism (lesson 10; promoted from the Pi extension).
 *
 * `prepareWritePath` is everything a write gate must do before it lets a
 * `write` or `edit` through: refuse malformed input, expand the forms Pi
 * itself expands, refuse home expansion, file URLs and parent traversal,
 * refuse protected S5 artifacts and any protected prefix the caller declares
 * (and any path that would replace one of their parents), then walk the
 * filesystem for the aliases a lexical check cannot see — symbolic links,
 * hard links, non-directory parents — and hand back the one normalized path
 * that was checked, so the tool executes exactly that.
 *
 * It is a preflight, not a sandbox. A process that writes through a route
 * the hook does not see is outside it; the registry card says so.
 */
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

/**
 * S5 artifacts are committed project identity. Operational agents may read
 * them and may propose changes, but direct mutation is reserved for an
 * explicit S5-authority workflow.
 */
export const PROTECTED_S5_PATHS = [
  "vsm/IDENTITY.md",
  "vsm/ARCHITECTURE.md",
  "vsm/INVARIANTS.md",
  "vsm/channels.yaml",
  "vsm/domain.ttl",
  "vsm/shapes.ttl",
] as const;

export type ProtectedS5Path = (typeof PROTECTED_S5_PATHS)[number];

export type WriteAuthority = "operational" | "s5-authority";

export interface WriteDecision {
  allowed: boolean;
  normalizedPath: string;
  reason?: string;
}

function slashify(input: string): string {
  return input.replaceAll("\\", "/");
}

function normalizeRepoPath(input: string): string {
  return path.posix.normalize(slashify(input)).replace(/^\.\//, "");
}

function isUnsafeRepoRelativePath(input: string): boolean {
  const slashed = slashify(input);
  const normalized = normalizeRepoPath(slashed);
  return (
    path.posix.isAbsolute(slashed) ||
    path.win32.isAbsolute(input) ||
    /^[a-z]:/i.test(slashed) ||
    normalized === ".." ||
    normalized.startsWith("../")
  );
}

export function isProtectedS5Path(input: string): input is ProtectedS5Path {
  if (isUnsafeRepoRelativePath(input)) return false;
  const normalized = normalizeRepoPath(input);
  return (PROTECTED_S5_PATHS as readonly string[]).includes(normalized);
}

/**
 * Decide whether a repo-relative write should be allowed by the VSM control
 * plane. Absolute and parent-traversing paths fail closed; the Pi/GSD adapter
 * is responsible for converting tool inputs to a repo-relative path first.
 *
 * This function deliberately does not ask an LLM. Authority is mechanical.
 */
export function authorizeWrite(
  inputPath: string,
  authority: WriteAuthority = "operational",
): WriteDecision {
  const normalizedPath = normalizeRepoPath(inputPath);

  if (isUnsafeRepoRelativePath(inputPath)) {
    return {
      allowed: false,
      normalizedPath,
      reason: "Write authorization requires a path contained within the project root.",
    };
  }

  if (!isProtectedS5Path(normalizedPath)) {
    return { allowed: true, normalizedPath };
  }

  if (authority === "s5-authority") {
    return { allowed: true, normalizedPath };
  }

  return {
    allowed: false,
    normalizedPath,
    reason:
      "Direct mutation of committed S5 identity is not permitted from an operational context. Emit a typed policy proposal instead.",
  };
}

export type WriteRefusal = "malformed" | "traversal" | "protected" | "alias";

export type PreparedWrite =
  | { allowed: true; normalizedPath: string; path: string }
  | { allowed: false; cause: WriteRefusal; reason: string };

export interface PrepareWriteOptions {
  authority?: WriteAuthority;
  /** Project-relative paths that are protected besides the S5 artifacts: a prefix ending in `/`, or an exact file. */
  protectedPaths?: readonly string[];
}

/** Match Pi 0.87.0's @ prefix / Unicode-space expansion before authorization. */
export function expandToolPath(input: string): string {
  return (input.startsWith("@") ? input.slice(1) : input)
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replaceAll("\\", "/");
}

/** Whether a normalized project-relative path is, or lies under, a protected path. */
export function isUnderProtectedPath(normalizedPath: string, protectedPaths: readonly string[]): string | undefined {
  for (const p of protectedPaths) {
    const prefix = p.replace(/^\.\//, "");
    if (prefix.endsWith("/")) {
      if (normalizedPath === prefix.slice(0, -1) || normalizedPath.startsWith(prefix)) return p;
    } else if (normalizedPath === prefix) return p;
  }
  return undefined;
}

/**
 * A lexical policy check cannot see symlink or hard-link aliases. Reject them
 * conservatively, including dangling links and links in existing parents.
 * This is a preflight check, not an atomic filesystem sandbox.
 */
export async function checkFilesystemPath(cwd: string, relativePath: string): Promise<void> {
  if (!path.isAbsolute(cwd)) throw new Error("Project root must be absolute.");
  let current = await realpath(cwd);
  if (!(await lstat(current)).isDirectory()) throw new Error("Invalid project root.");
  const segments = relativePath.split("/");
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    let info;
    try {
      info = await lstat(current);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        // Pi write creates missing parents. No further existing aliases can
        // occur below this missing component in a stable filesystem.
        return;
      }
      throw error;
    }
    if (info.isSymbolicLink()) throw new Error("Symbolic-link paths are not authorized.");
    if (index < segments.length - 1 && !info.isDirectory()) {
      throw new Error("A parent component is not a directory.");
    }
    if (index === segments.length - 1 && (!info.isFile() || info.nlink > 1)) {
      throw new Error("Only regular files with a single link are authorized.");
    }
  }
}

export async function prepareWritePath(cwd: string, input: unknown, options: PrepareWriteOptions = {}): Promise<PreparedWrite> {
  const authority = options.authority ?? "operational";
  const protectedPaths = options.protectedPaths ?? [];
  if (typeof input !== "string" || input.length === 0 || input.includes("\0")) {
    return { allowed: false, cause: "malformed", reason: "write/edit requires a non-empty project-relative file path without NUL bytes." };
  }
  const expanded = expandToolPath(input);
  if (expanded === "~" || expanded.startsWith("~/") || expanded.startsWith("file://") || expanded.split("/").includes("..")) {
    return { allowed: false, cause: "traversal", reason: "Use a project-relative file path without home expansion, file URLs, or parent traversal." };
  }

  // Operational authority is host-owned and fixed by the caller. Tool arguments,
  // channels, prompts, and proposals cannot opt into s5-authority.
  let decision = authorizeWrite(expanded, authority);
  if (decision.allowed) {
    // write creates parents too: a missing protected file must not be
    // replaced with a directory by writing a child beneath its path.
    const segments = decision.normalizedPath.split("/");
    for (let length = 1; length < segments.length; length++) {
      const parent = authorizeWrite(segments.slice(0, length).join("/"), authority);
      if (!parent.allowed) {
        decision = parent;
        break;
      }
    }
  }
  if (!decision.allowed) return { allowed: false, cause: "protected", reason: decision.reason ?? "Protected path." };
  const normalizedPath = decision.normalizedPath;
  if (normalizedPath === "." || normalizedPath === "") return { allowed: false, cause: "malformed", reason: "A file path is required, not the project root." };

  const hit = isUnderProtectedPath(normalizedPath, protectedPaths);
  if (hit) return { allowed: false, cause: "protected", reason: `"${normalizedPath}" is under the protected path "${hit}".` };
  // A file written where a protected directory's parent should be would replace that parent.
  for (const p of protectedPaths) {
    const prefix = p.replace(/^\.\//, "").replace(/\/$/, "");
    if (prefix.startsWith(`${normalizedPath}/`)) return { allowed: false, cause: "protected", reason: `"${normalizedPath}" is a parent of the protected path "${p}".` };
  }

  try {
    await checkFilesystemPath(cwd, normalizedPath);
  } catch {
    return { allowed: false, cause: "alias", reason: "Cannot safely authorize this filesystem path. Use a regular project-local file with no symbolic links or hard-link aliases and accessible parent directories." };
  }
  // Execute exactly the normalized path that was checked. The ./ prefix
  // prevents Pi from interpreting a resulting leading @ or ~ a second time.
  return { allowed: true, normalizedPath, path: `./${normalizedPath}` };
}
