/**
 * The instance manifest (lesson 15): what `regulator init` writes into a
 * repository so the harness knows which definition runs it and what a
 * person declared about the project's layout. Harness-owned, under
 * `.regulator/`, written by a person at init — never project content, so
 * the trust rule (lesson 10) is intact: the project's own files still say
 * nothing to the harness.
 */
import { Type, type Static } from "typebox";
import { Value } from "typebox/value";

const NonEmpty = Type.String({ minLength: 1 });
const Prefix = Type.String({ pattern: "^[^/\\\\][^\\\\]*/$" });

export const InstanceManifestSchema = Type.Object({
  version: Type.Literal(1),
  definition: Type.Object({
    /** Absolute path of the definition this instance runs under. */
    root: NonEmpty,
    name: NonEmpty,
    /** Registry records and the harness revision at init: what "the definition" meant that day. */
    registry: Type.Integer({ minimum: 0 }),
    harnessRevision: NonEmpty,
    /** The Pi version the definition pins. */
    pi: NonEmpty,
  }, { additionalProperties: false }),
  /** Prefixes a unit may write under in this project, when the profile's defaults do not fit its layout. Declared by a person, not discovered. */
  writablePaths: Type.Optional(Type.Array(Prefix)),
  /** Prefixes protected in this project beyond the identity and what the conventions discover. */
  protectedPaths: Type.Optional(Type.Array(Prefix)),
  initializedAt: NonEmpty,
  initializedBy: NonEmpty,
}, { additionalProperties: false });
export type InstanceManifest = Static<typeof InstanceManifestSchema>;

export function isInstanceManifest(value: unknown): value is InstanceManifest {
  return Value.Check(InstanceManifestSchema, value);
}
