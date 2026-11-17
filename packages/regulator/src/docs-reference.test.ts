/**
 * The definition reference, held against the schemas (the docs currency audit, §6).
 *
 * `docs/reference/definition.md` is a hand-written page of field tables over schemas that are closed: a file written
 * from a table that omits a field is refused, and a field added to a schema without a row is a field nobody can find.
 * This test reads each schema's property names, one level into its nested objects and arrays, and requires every one
 * of them to appear in a code span inside the page's section for that schema. It holds the first half of "every
 * property named, no property invented": a page may still describe a field that no longer exists.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  CapabilityProfileSchema, EvalReportSchema, EvalSuiteSchema, IntelligencePolicySchema, InteractionPolicySchema, PolicyDefinitionSchema,
  RecoveryPolicySchema, RegulatorRecordSchema, ResultReportSchema, RoutingPolicySchema, WorkContractSchema, WorkloadDefinitionSchema,
} from "@metacoding.io/regulator-protocol";

const labRoot = fileURLToPath(new URL("../", import.meta.url));
const page = path.join(labRoot, "../../docs/reference/definition.md");

type Node = { properties?: Record<string, Node>; items?: Node; anyOf?: Node[]; allOf?: Node[]; additionalProperties?: Node | boolean; patternProperties?: Record<string, Node> };

/** A schema's property names, and those of the objects one level under them: through an array's items, a union's members and a record's values. */
function propertyNames(schema: Node, depth: number): Set<string> {
  const out = new Set<string>();
  const visit = (node: Node | undefined, left: number): void => {
    if (!node || typeof node !== "object") return;
    for (const member of [...(node.anyOf ?? []), ...(node.allOf ?? [])]) visit(member, left);
    if (node.items) visit(node.items, left);
    for (const value of Object.values(node.patternProperties ?? {})) visit(value, left);
    if (typeof node.additionalProperties === "object") visit(node.additionalProperties, left);
    for (const [name, value] of Object.entries(node.properties ?? {})) {
      out.add(name);
      if (left > 0) visit(value, left - 1);
    }
  };
  visit(schema, depth);
  return out;
}

/** The page's text under a `## <heading>`, up to the next `## `. */
function section(text: string, heading: string): string {
  const start = text.indexOf(`\n## ${heading}\n`);
  assert.notEqual(start, -1, `docs/reference/definition.md has a "## ${heading}" section`);
  const rest = text.slice(start + 1);
  const end = rest.indexOf("\n## ", 1);
  return end === -1 ? rest : rest.slice(0, end);
}

const SECTIONS: { heading: string; schemas: { name: string; schema: unknown; depth: number }[] }[] = [
  { heading: "Workload", schemas: [{ name: "WorkloadDefinitionSchema", schema: WorkloadDefinitionSchema, depth: 2 }] },
  { heading: "Capability profiles", schemas: [{ name: "CapabilityProfileSchema", schema: CapabilityProfileSchema, depth: 1 }] },
  { heading: "Budget and model policy", schemas: [{ name: "PolicyDefinitionSchema", schema: PolicyDefinitionSchema, depth: 1 }] },
  { heading: "Recovery policy", schemas: [{ name: "RecoveryPolicySchema", schema: RecoveryPolicySchema, depth: 1 }] },
  { heading: "Routing policy", schemas: [{ name: "RoutingPolicySchema", schema: RoutingPolicySchema, depth: 1 }] },
  { heading: "Interaction policy", schemas: [{ name: "InteractionPolicySchema", schema: InteractionPolicySchema, depth: 1 }] },
  { heading: "Intelligence policy", schemas: [{ name: "IntelligencePolicySchema", schema: IntelligencePolicySchema, depth: 1 }] },
  { heading: "Work contracts", schemas: [{ name: "WorkContractSchema", schema: WorkContractSchema, depth: 1 }, { name: "ResultReportSchema", schema: ResultReportSchema, depth: 1 }] },
  { heading: "Eval suites", schemas: [{ name: "EvalSuiteSchema", schema: EvalSuiteSchema, depth: 1 }, { name: "EvalReportSchema", schema: EvalReportSchema, depth: 0 }] },
  { heading: "Registry records", schemas: [{ name: "RegulatorRecordSchema", schema: RegulatorRecordSchema, depth: 1 }] },
];

test("every field a definition schema declares is named in its section of the definition reference", async () => {
  const text = await readFile(page, "utf8");
  const missing: string[] = [];
  let read = 0;
  for (const { heading, schemas } of SECTIONS) {
    const spans = [...section(text, heading).matchAll(/`([^`\n]+)`/g)].map((m) => m[1]!);
    const named = (field: string): boolean => spans.some((span) => new RegExp(`(^|[^A-Za-z0-9_])${field}([^A-Za-z0-9_]|$)`).test(span));
    for (const { name, schema, depth } of schemas) {
      for (const field of propertyNames(schema as Node, depth)) {
        read += 1;
        if (!named(field)) missing.push(`"## ${heading}" does not name \`${field}\` (${name})`);
      }
    }
  }
  assert.deepEqual(missing, [], "add a row or a sentence for the field to docs/reference/definition.md, in the section named");
  assert.ok(read > 100, `the schemas still yield their fields (read ${read})`);
});
