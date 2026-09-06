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

function normalizeRepoPath(input: string): string {
  return input
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
}

export function isProtectedS5Path(input: string): input is ProtectedS5Path {
  const normalized = normalizeRepoPath(input);
  return (PROTECTED_S5_PATHS as readonly string[]).includes(normalized);
}

/**
 * Decide whether a write should be allowed by the VSM control plane.
 *
 * This function deliberately does not ask an LLM. Authority is mechanical.
 */
export function authorizeWrite(
  inputPath: string,
  authority: WriteAuthority = "operational",
): WriteDecision {
  const normalizedPath = normalizeRepoPath(path.posix.normalize(normalizeRepoPath(inputPath)));

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
