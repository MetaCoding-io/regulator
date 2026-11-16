/**
 * The environment as a named input to evidence (#178; the Nix note §3.1 and §3.2).
 *
 * An evidence record and an eval fingerprint name the harness revision, the
 * policies, the Pi pin and the graders' hashes; the toolchain the checks ran
 * under was the one input with no name. `toolchain` is a content hash of it
 * and where the hash came from, a closed list tried in order:
 *
 *   nix-store     the process runs inside a devenv or Nix shell: the SHA-256 of
 *                 the store path `DEVENV_PROFILE` resolves to, or, with only
 *                 `IN_NIX_SHELL` set, of the sorted `/nix/store/` entries on PATH
 *   lock          the directory declares an environment the process is not
 *                 running under: the SHA-256 of `flake.lock`, else `devenv.lock`
 *   package-lock  nothing else: the SHA-256 of the package lock,
 *                 `pnpm-lock.yaml` first
 *
 * Absent all three, the field is absent, and a record reads as "not recorded".
 * Naming the environment is not matching the target's: the matrix stays CI's.
 */
import { Type, type Static } from "typebox";

export const TOOLCHAIN_SOURCES = ["nix-store", "lock", "package-lock"] as const;
export type ToolchainSource = (typeof TOOLCHAIN_SOURCES)[number];

export const ToolchainSchema = Type.Object({
  source: Type.Union([Type.Literal("nix-store"), Type.Literal("lock"), Type.Literal("package-lock")]),
  /** SHA-256, hex: of the store path's string (nix-store) or of the file's bytes (lock, package-lock). */
  hash: Type.String({ pattern: "^[0-9a-f]{64}$" }),
}, { additionalProperties: false });
export type Toolchain = Static<typeof ToolchainSchema>;

/**
 * The files that define an environment, when a repository has them: discovered protected conventions beside `vendor/`
 * (a unit that changes the toolchain its own checks run under is the self-certifier with a new target). A contract that
 * means to change one exempts it by name on an `identity-untouched` expectation, and no other path can be exempted.
 */
export const ENVIRONMENT_FILES = ["flake.nix", "flake.lock", "devenv.nix", "devenv.lock", "devenv.yaml"] as const;
export type EnvironmentFile = (typeof ENVIRONMENT_FILES)[number];

/** The `lock` source's files, in the order tried. */
export const ENVIRONMENT_LOCKS = ["flake.lock", "devenv.lock"] as const;
/** The `package-lock` source's files, in the order tried. */
export const PACKAGE_LOCKS = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"] as const;

/** Two toolchains are the same environment when source and hash agree; two absent ones are both "not recorded". */
export function sameToolchain(a: Toolchain | undefined, b: Toolchain | undefined): boolean {
  return a?.source === b?.source && a?.hash === b?.hash;
}

/** How a toolchain reads in a message: the source and the first twelve characters of the hash. */
export function describeToolchain(t: Toolchain | undefined): string {
  return t ? `${t.source} ${t.hash.slice(0, 12)}…` : "not recorded";
}

// The schemas spell the two lists as literals (typebox infers a union only from a tuple of literals); these keep them equal.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _sources: Same<Toolchain["source"], ToolchainSource> = true;
void _sources;
