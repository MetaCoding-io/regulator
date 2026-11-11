import { Type, type Static } from "typebox";
import { Value } from "typebox/value";

/**
 * The pathology catalog's rows (#57): the characteristic ways a viable system fails as a
 * whole, each mapped to the regulators that absorb it, the fixture that reproduces it,
 * and what nothing absorbs yet. The rows are the source of `docs/PATHOLOGIES.md`'s
 * tables and of the viability case's residual uncertainty, rendered by `regulator docs`;
 * the prose around the tables stays hand-written.
 *
 * A row names regulators by their registry id, so `checkRegistry` can refuse a row that
 * names a record that is not active, and say which active records no row names.
 */
const NonEmpty = Type.String({ minLength: 1 });

/** The catalog's sections, in the order the page prints them, with the taxonomy each follows. */
export const PATHOLOGY_SECTIONS = {
  structural: { number: 1, title: "Structural pathologies", attribution: "after Pérez Ríos" },
  functional: { number: 2, title: "Functional pathologies", attribution: "after Pérez Ríos" },
  channel: { number: 3, title: "Information and channel pathologies", attribution: "after Pérez Ríos" },
  agent: { number: 4, title: "Agent-specific rows", attribution: "after MAST" },
} as const;
export type PathologySection = keyof typeof PATHOLOGY_SECTIONS;
export const PathologySectionSchema = Type.Union([Type.Literal("structural"), Type.Literal("functional"), Type.Literal("channel"), Type.Literal("agent")]);

/** `M09`: the course module whose "Break it" section reproduces the row or builds the mechanism. */
export const CourseModuleSchema = Type.String({ pattern: "^M\\d{2}$" });
export const InvariantIdSchema = Type.String({ pattern: "^INV-\\d{3}$" });

/**
 * What absorbs a pathology: the regulators (by registry id, each with an optional note on what it
 * does for this row), the invariants, the course modules that build the mechanisms, and free text
 * for what the registry does not name (a tool, a convention, a document, or "nothing yet").
 */
export const AbsorbedBySchema = Type.Object(
  {
    regulators: Type.Array(Type.Object({ id: Type.String({ pattern: "^reg\\.[a-z0-9-]+\\.[a-z0-9-]+\\.v\\d+$" }), note: Type.Optional(NonEmpty) }, { additionalProperties: false })),
    invariants: Type.Array(InvariantIdSchema),
    modules: Type.Array(CourseModuleSchema),
    notes: Type.Array(NonEmpty),
  },
  { additionalProperties: false },
);
export type AbsorbedBy = Static<typeof AbsorbedBySchema>;

export const PathologyRowSchema = Type.Object(
  {
    /** A stable slug: the row's anchor and the id a card or a debt row can cite. */
    id: Type.String({ pattern: "^[a-z0-9]+(-[a-z0-9]+)*$" }),
    section: PathologySectionSchema,
    /** The pathology's name; for an agent-specific row, the MAST category. Markdown, so `S3\*` escapes its star. */
    name: NonEmpty,
    /** One clause after the name: what the pathology is; for an agent-specific row, this project's name for it. A name that says it all has none. */
    summary: Type.Optional(NonEmpty),
    /** What it looks like in an instance: the symptom a person sees. Not on an agent-specific row. */
    looksLike: Type.Optional(NonEmpty),
    absorbedBy: AbsorbedBySchema,
    /** The fixture, test, scripted behaviour or eval arm that reproduces it; absent when the lab has not built one. */
    reproducedBy: Type.Optional(NonEmpty),
    /** What nothing absorbs yet: the catalog's residual, rendered into the viability case. Absent when nothing is owed. */
    notAbsorbed: Type.Optional(NonEmpty),
  },
  { additionalProperties: false },
);
export type PathologyRow = Static<typeof PathologyRowSchema>;

export const PathologiesFileSchema = Type.Object({ rows: Type.Array(PathologyRowSchema) }, { additionalProperties: false });
export type PathologiesFile = Static<typeof PathologiesFileSchema>;

export function isPathologiesFile(value: unknown): value is PathologiesFile {
  return Value.Check(PathologiesFileSchema, value);
}

export function isPathologyRow(value: unknown): value is PathologyRow {
  return Value.Check(PathologyRowSchema, value);
}
