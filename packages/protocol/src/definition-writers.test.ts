import assert from "node:assert/strict";
import test from "node:test";
import { DEFINITION_WRITERS, HARNESS_OWNED_INSTANCE_DIRS, definitionClassOf, definitionWriter, definitionWriterCommands, seedDirFor } from "./definition-writers.js";
import { ENFORCEMENT_POINTS } from "./registry.js";

test("the accept-path split is a closed list held against the CLI (#110): every command a class names to accept or promote is an enforcement point of the cli, and the three classes are identity, advice and the declaration", () => {
  assert.deepEqual(DEFINITION_WRITERS.map((w) => w.class), ["identity", "advice", "declaration"]);
  const cli: readonly string[] = ENFORCEMENT_POINTS.cli;
  const commands = definitionWriterCommands();
  assert.deepEqual(commands, ["identity accept", "identity promote", "advice accept", "advice promote"]);
  for (const command of commands) assert.ok(cli.includes(command), `${command} is not in ENFORCEMENT_POINTS.cli`);
  // The reject half of each decision path is a subcommand too, beside its accept.
  for (const command of commands.filter((c) => c.endsWith(" accept"))) assert.ok(cli.includes(command.replace(/ accept$/, " reject")), `${command} has no reject in the cli list`);
  // The declaration lands by a merge, not a command: it names none, and says what it still lacks.
  const declaration = definitionWriter("declaration");
  assert.equal(declaration.instance, undefined);
  assert.equal(declaration.promotedBy, undefined);
  assert.ok(declaration.gap, "the declaration's row states its gap: the definition's repository does not run under the loop yet");
});

test("the instance's harness-owned directories are derived from the list, one per seeded class, and a definition directory is placed in its class or in none", () => {
  assert.deepEqual(HARNESS_OWNED_INSTANCE_DIRS, ["regulator/identity/", "regulator/advice/"]);
  assert.equal(seedDirFor("identity"), "identity/");
  assert.equal(seedDirFor("advice"), "advice/");
  assert.throws(() => seedDirFor("declaration"), /not seeded into an instance/);
  assert.equal(definitionClassOf("identity"), "identity");
  assert.equal(definitionClassOf("advice/"), "advice");
  assert.equal(definitionClassOf("profiles/"), "declaration");
  assert.equal(definitionClassOf("skills/"), undefined, "a directory nobody declared a writer for");
  for (const w of DEFINITION_WRITERS) for (const seed of w.seed) assert.match(seed, /^[a-z][a-z0-9-]*\/$/, `${seed} is a directory prefix under the definition root`);
  for (const dir of HARNESS_OWNED_INSTANCE_DIRS) assert.match(dir, /^regulator\/[a-z]+\/$/);
});
