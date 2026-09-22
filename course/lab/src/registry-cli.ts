/**
 * `regulator check` and `regulator docs` for the lab's definition.
 *
 *   node dist/registry-cli.js check          validate the registry records and the rest of the definition
 *                                            (profiles, workload, policies, identity; lesson 12), exit 1 on problems
 *   node dist/registry-cli.js docs [--write]  render REGULATORS.md and BOUNDARY.md (to stdout, or in place)
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkDefinition, checkRegistry, renderBoundaryMarkdown, renderRegistryMarkdown } from "@metacoding/vsm-pi-core";

const labRoot = fileURLToPath(new URL("../", import.meta.url));
const registryDir = path.join(labRoot, "registry");
const docsPath = path.join(registryDir, "REGULATORS.md");
const boundaryPath = path.join(labRoot, "BOUNDARY.md");

const [command, ...flags] = process.argv.slice(2);
const registry = await checkRegistry(registryDir, labRoot);

if (command === "check") {
  for (const problem of registry.problems) console.error(`✖ ${problem.file}: ${problem.message}`);
  console.log(`${registry.records.length} regulator(s), ${registry.problems.length} problem(s)`);
  const definition = await checkDefinition(labRoot);
  for (const problem of definition.problems) console.error(`✖ ${problem.file}: ${problem.message}`);
  console.log(`definition: ${definition.profiles.length} profile(s), ${definition.workloads.length} workload(s), ${definition.policies.length + definition.recovery.length + definition.routing.length + definition.interaction.length} policy file(s), ${definition.identity.invariants.length} invariant(s), ${definition.problems.length} problem(s)`);
  process.exit(registry.problems.length + definition.problems.length === 0 ? 0 : 1);
} else if (command === "docs") {
  const outputs: Array<[string, string]> = [[docsPath, renderRegistryMarkdown(registry.records)], [boundaryPath, renderBoundaryMarkdown(registry.records)]];
  if (flags.includes("--write")) {
    for (const [file, rendered] of outputs) {
      await writeFile(file, rendered, "utf8");
      console.log(`wrote ${path.relative(process.cwd(), file)}`);
    }
  } else if (flags.includes("--check")) {
    for (const [file, rendered] of outputs) {
      const current = await readFile(file, "utf8").catch(() => "");
      if (current !== rendered) {
        console.error(`${path.basename(file)} is out of date; run \`regulator docs --write\``);
        process.exit(1);
      }
      console.log(`${path.basename(file)} is current`);
    }
  } else {
    for (const [, rendered] of outputs) process.stdout.write(rendered);
  }
} else {
  console.error("usage: registry-cli <check | docs [--write | --check]>");
  process.exit(2);
}
