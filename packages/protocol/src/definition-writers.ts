/**
 * Who writes the definition: the accept-path split as data (the accept-path note, §4).
 *
 * Every definition file is proposable, because a proposal changes nothing (INV-002).
 * What differs is the path an accepted proposal takes, and this list declares those
 * paths once, in three classes. `checkDefinition` refuses a definition directory in no
 * class, `regulator docs` renders the list into `BOUNDARY.md` ("Who writes the
 * definition"), and the instance's protected set — the write gate, the bash watch, the
 * closeout's diffed prefixes — is derived from the `instance` paths below, never
 * restated. A test holds every command named here against `ENFORCEMENT_POINTS.cli`.
 */

export type DefinitionWriterClass = "identity" | "advice" | "declaration";

export interface DefinitionWriter {
  readonly class: DefinitionWriterClass;
  /** Directories of the definition, as prefixes under its root, that this class lands in. */
  readonly seed: readonly string[];
  /** The instance's copy, seeded by `regulator init` and protected there; absent for files an instance reads from the definition. */
  readonly instance?: string;
  /** How a proposal against a file of this class is raised. */
  readonly proposedBy: string;
  /** The `regulator` subcommand that writes the instance's copy, or, for the declaration, the path a change takes. */
  readonly acceptedBy: string;
  /** The `regulator` subcommand that carries the instance's copy into the seed. */
  readonly promotedBy?: string;
  /** How a proposed change of this class is tried before it is decided. */
  readonly probedBy: string;
  /** What may not write a file of this class. */
  readonly refusedTo: string;
  /** What the path still lacks, when the row names a mechanism that does not exist yet. */
  readonly gap?: string;
}

export const DEFINITION_WRITERS: readonly DefinitionWriter[] = [
  {
    class: "identity",
    seed: ["identity/"],
    instance: "regulator/identity/",
    proposedBy: "`propose_policy_change`",
    acceptedBy: "identity accept",
    promotedBy: "identity promote",
    probedBy: "an eval arm's `identity` switch toggles the whole set; no per-file probe",
    refusedTo: "every tool; `advice accept` (closed file list)",
  },
  {
    class: "advice",
    seed: ["advice/"],
    instance: "regulator/advice/",
    proposedBy: "a `harness-edit` (diagnosis, change, prediction) or a plain proposal",
    acceptedBy: "advice accept",
    promotedBy: "advice promote",
    probedBy: "an eval arm's `advice` field, once the prediction record exists (accept-path note §8, slice 3)",
    refusedTo: "every tool; `identity accept` (closed file list)",
  },
  {
    class: "declaration",
    seed: ["profiles/", "workload/", "policies/", "evals/", "contracts/", "registry/", "drift/", "fixture/", "fixture-finance/", "fixture-injection/", "fixture-oscillation/", "fixture-portfolio/"],
    proposedBy: "a plain proposal, `requestedChange` as text",
    acceptedBy: "a merged change to the definition's repository",
    probedBy: "the definition's own CI",
    refusedTo: "`identity accept` and `advice accept`, by construction",
    gap: "a unit of work against the definition's repository under a contract, with `regulator check` and the tests at closeout and a merge by a person, waits for the definition's repository to run under the loop (accept-path note §6); until then the path is a pull request a person writes",
  },
] as const;

/** One class of the list, by name. */
export function definitionWriter(cls: DefinitionWriterClass): DefinitionWriter {
  const writer = DEFINITION_WRITERS.find((w) => w.class === cls);
  if (!writer) throw new Error(`no definition writer class "${cls}"`);
  return writer;
}

/**
 * The instance directories the harness owns: seeded by `regulator init` from the class's seed, written only by the
 * class's accept command, and protected by the write gate, the bash watch and the closeout's diff. Derived, so the
 * three cannot drift from the list.
 */
export const HARNESS_OWNED_INSTANCE_DIRS: readonly string[] = DEFINITION_WRITERS.flatMap((w) => (w.instance ? [w.instance] : []));

/** The definition directory (a prefix under the root) a class seeds into the instance directory, or undefined for the declaration. */
export function seedDirFor(cls: DefinitionWriterClass): string {
  const writer = definitionWriter(cls);
  const seed = writer.seed[0];
  if (!writer.instance || !seed || writer.seed.length !== 1) throw new Error(`class "${cls}" is not seeded into an instance`);
  return seed;
}

/** The class a definition directory (as `name/`) belongs to, or undefined when no class declares it. */
export function definitionClassOf(dir: string): DefinitionWriterClass | undefined {
  const prefix = dir.endsWith("/") ? dir : `${dir}/`;
  return DEFINITION_WRITERS.find((w) => w.seed.includes(prefix))?.class;
}

/** The `regulator` subcommands the list names: every `acceptedBy` and `promotedBy` that is a command, not a path. */
export function definitionWriterCommands(): string[] {
  return DEFINITION_WRITERS.flatMap((w) => [...(w.instance ? [w.acceptedBy] : []), ...(w.promotedBy ? [w.promotedBy] : [])]);
}
