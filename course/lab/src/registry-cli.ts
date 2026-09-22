/**
 * `regulator check` and `regulator docs` for the lab's registry.
 *
 *   node dist/registry-cli.js check          validate records, exit 1 on problems
 *   node dist/registry-cli.js docs [--write]  render REGULATORS.md (to stdout, or in place)
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkRegistry, renderRegistryMarkdown } from "./registry.js";

const labRoot = fileURLToPath(new URL("../", import.meta.url));
const registryDir = path.join(labRoot, "registry");
const docsPath = path.join(registryDir, "REGULATORS.md");

const [command, ...flags] = process.argv.slice(2);
const registry = await checkRegistry(registryDir, labRoot);

if (command === "check") {
  for (const problem of registry.problems) console.error(`✖ ${problem.file}: ${problem.message}`);
  console.log(`${registry.records.length} regulator(s), ${registry.problems.length} problem(s)`);
  process.exit(registry.problems.length === 0 ? 0 : 1);
} else if (command === "docs") {
  const rendered = renderRegistryMarkdown(registry.records);
  if (flags.includes("--write")) {
    await writeFile(docsPath, rendered, "utf8");
    console.log(`wrote ${path.relative(process.cwd(), docsPath)}`);
  } else if (flags.includes("--check")) {
    const current = await readFile(docsPath, "utf8").catch(() => "");
    if (current !== rendered) {
      console.error("REGULATORS.md is out of date; run `regulator docs --write`");
      process.exit(1);
    }
    console.log("REGULATORS.md is current");
  } else {
    process.stdout.write(rendered);
  }
} else {
  console.error("usage: registry-cli <check | docs [--write | --check]>");
  process.exit(2);
}
