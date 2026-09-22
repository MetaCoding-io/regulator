#!/usr/bin/env node
/**
 * regulator-control-room [--definition <dir>] [--instance <dir>]... [--port <n>] [--host <addr>]
 *
 * Serves the read-only control room. Defaults: the current directory as the
 * one instance, port 4321, loopback only.
 */
import path from "node:path";
import { createControlRoomServer } from "./server.js";

const argv = process.argv.slice(2);
const values = (name: string): string[] => argv.flatMap((arg, i) => (arg === `--${name}` && argv[i + 1] !== undefined ? [argv[i + 1]!] : []));
if (argv.includes("--help") || argv.includes("-h")) {
  console.log("usage: regulator-control-room [--definition <dir>] [--instance <dir>]... [--port <n>] [--host <addr>]");
  process.exit(0);
}
const definitionDir = values("definition")[0];
const instanceDirs = values("instance").map((d) => path.resolve(d));
const port = Number(values("port")[0] ?? 4321);
const host = values("host")[0] ?? "127.0.0.1";
const server = createControlRoomServer({
  ...(definitionDir === undefined ? {} : { definitionDir: path.resolve(definitionDir) }),
  instanceDirs: instanceDirs.length ? instanceDirs : definitionDir ? [] : [process.cwd()],
});
server.listen(port, host, () => {
  console.log(`control room (read-only) at http://${host}:${port}/`);
  if (definitionDir) console.log(`  definition: ${path.resolve(definitionDir)}`);
  for (const dir of instanceDirs.length ? instanceDirs : definitionDir ? [] : [process.cwd()]) console.log(`  instance:   ${dir}`);
});
