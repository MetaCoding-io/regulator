#!/usr/bin/env node
/**
 * regulator status [--definition <dir>] [--instance <dir>] [--json]
 *
 * A read-only projection. There is no subcommand that changes anything, and
 * that is deliberate: the moment this grows a "raise budget" flag it has
 * become an authority surface.
 */
import { readStatus, renderStatusText } from "./status.js";

const argv = process.argv.slice(2);
const command = argv[0];

function flag(name: string): string | undefined {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? undefined : argv[index + 1];
}

if (command !== "status") {
  console.error("usage: regulator status [--definition <dir>] [--instance <dir>] [--json]");
  process.exit(2);
}

const definitionDir = flag("definition");
const instanceDir = flag("instance") ?? (definitionDir ? undefined : process.cwd());
const view = await readStatus({
  ...(definitionDir === undefined ? {} : { definitionDir }),
  ...(instanceDir === undefined ? {} : { instanceDir }),
});
if (argv.includes("--json")) process.stdout.write(`${JSON.stringify(view, null, 2)}\n`);
else process.stdout.write(renderStatusText(view));
