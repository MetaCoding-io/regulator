import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { checkRegistry, loadRegistry, renderBoundaryMarkdown, renderRegistryMarkdown } from "@metacoding.io/regulator-core";
import { ENFORCEMENT_POINTS } from "@metacoding.io/regulator-protocol";

const labRoot = fileURLToPath(new URL("../", import.meta.url));
const registryDir = path.join(labRoot, "registry");

test("the committed registry passes check: every record is well-formed, implemented, tested and bounded", async () => {
  const registry = await checkRegistry(registryDir, labRoot);
  assert.deepEqual(registry.problems, []);
  assert.deepEqual(registry.records.map((r) => r.id).sort(), [
    "reg.algedonic.delivery.v1",
    "reg.algedonic.interaction-contract.v1",
    "reg.algedonic.outbox-watcher.v1",
    "reg.algedonic.pause-gate.v1",
    "reg.assurance.eval-harness.v1",
    "reg.assurance.span-projection.v1",
    "reg.audit.behaviour-check.v1",
    "reg.audit.canary-watch.v1",
    "reg.audit.closeout-gate.v1",
    "reg.audit.doctor.v1",
    "reg.audit.glossary-lint.v1",
    "reg.audit.identity-untouched-check.v1",
    "reg.audit.inherited-tests-check.v1",
    "reg.audit.post-merge-check.v1",
    "reg.audit.pre-merge-trial.v1",
    "reg.authority.disposition-authority.v1",
    "reg.authority.identity-promotion.v1",
    "reg.authority.identity-write-gate.v1",
    "reg.authority.project-trust-rule.v1",
    "reg.authority.proposal-intake.v1",
    "reg.authority.s5-decision.v1",
    "reg.authority.vendor-write-gate.v1",
    "reg.control.budget-guard.v1",
    "reg.control.contract-advice.v1",
    "reg.control.contract-preserving-compaction.v1",
    "reg.control.evidence-preflight.v1",
    "reg.control.failure-observer.v1",
    "reg.control.memory-store.v1",
    "reg.control.model-router.v1",
    "reg.control.obligation-router.v1",
    "reg.control.profile-write-grant.v1",
    "reg.control.progression-veto.v1",
    "reg.control.recovery-router.v1",
    "reg.control.result-report-gate.v1",
    "reg.control.work-contract-gate.v1",
    "reg.coordination.effect-journal.v1",
    "reg.coordination.reintegration.v1",
    "reg.coordination.thrash-detector.v1",
    "reg.coordination.unit-lease.v1",
    "reg.identity.definition-check.v1",
    "reg.identity.identity-context.v1",
    "reg.identity.instance-manifest.v1",
    "reg.identity.regulator-lifecycle.v1",
    "reg.intelligence.intelligence-intake.v1",
  ]);
});

test("enforcement points are typed (#76): a record whose point is not in the closed list is refused by name; the loop, cli and check lists are what the code exposes", async (t) => {
  const { mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-registry-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, "regulators"));
  const record = JSON.parse(await readFile(path.join(registryDir, "regulators", "unit-lease.json"), "utf8")) as { mechanism: { enforcementPoints: unknown[] } };
  record.mechanism.enforcementPoints = [{ where: "host", point: "tool_call" }, { where: "host", point: "tool_cal" }, { where: "session", point: "tool_call" }, "tool_call"];
  await writeFile(path.join(dir, "regulators", "bad.json"), JSON.stringify(record));
  const checked = await checkRegistry(dir, labRoot, { verifyFiles: false });
  assert.equal(checked.records.length, 0);
  assert.deepEqual(checked.problems.map((p) => p.message), [
    "unknown enforcement point host:tool_cal; host has dispatcher, session_start, before_agent_start, tool_call, tool_execution_start, tool_execution_end, tool_result, turn_end, message_end, agent_end, agent_before_settle, model_select, project_trust, session_before_compact, session_compact, session_compact_failed; " +
    "unknown enforcement place \"session\"; one of host, tool, loop, cli, check; " +
    "an enforcement point is \"tool_call\", not { where, point, note? }",
  ]);

  // loop: every point is a step the orchestrator (or the checks package) defines as a function.
  const controller = await readFile(new URL("./controller.js", import.meta.url), "utf8");
  const unit = await readFile(new URL("./unit.js", import.meta.url), "utf8");
  const { runHostChecks } = await import("@metacoding.io/regulator-checks");
  for (const point of ENFORCEMENT_POINTS.loop) {
    if (point === "runHostChecks") { assert.equal(typeof runHostChecks, "function"); continue; }
    assert.ok(new RegExp(`function ${point}\\(`).test(controller) || new RegExp(`function ${point}\\(`).test(unit), `${point} is not a function of controller.ts or unit.ts`);
  }
  // cli: the subcommands, exactly as the usage line spells them.
  const cli = await readFile(new URL("./cli.js", import.meta.url), "utf8");
  const usage = /usage: regulator ([^"]+)"/.exec(cli)?.[1];
  assert.ok(usage, "the usage line");
  const commands = usage.split(" | ").map((segment) => segment.trim().split(" ").filter((w) => !/^[<\[-]/.test(w) && !w.startsWith("--")).join(" ")).filter((c) => c && !c.startsWith("-"));
  const spelled = new Set<string>();
  for (const segment of usage.split(" | ")) {
    const words: string[] = [];
    for (const w of segment.trim().split(" ")) { if (/^[<\[-]/.test(w)) break; words.push(w); }
    if (words.length) spelled.add(words.join(" "));
  }
  assert.deepEqual([...ENFORCEMENT_POINTS.cli].sort(), [...spelled].sort(), `the cli list is the usage line's subcommands (${commands.length} segments)`);
  // check: both are what core exports.
  const core = await import("@metacoding.io/regulator-core");
  for (const point of ENFORCEMENT_POINTS.check) assert.equal(typeof (core as Record<string, unknown>)[point], "function", `${point} is a function of core`);
});

test("an overdue review date fails the registry check (lesson 15): every record carries one, and CI reads it", async () => {
  const fine = await checkRegistry(registryDir, labRoot, { today: "2026-09-22" });
  assert.deepEqual(fine.problems, []);
  const late = await checkRegistry(registryDir, labRoot, { today: "2027-01-01" });
  assert.equal(late.problems.length, late.records.filter((r) => r.status === "active").length, "every active record is overdue by then; the retired one is history");
  assert.match(late.problems[0]!.message, /^review overdue since 2026-12-01: review the record, then move ownership\.reviewBy or retire it$/);
});

test("the committed definition passes the definition check: profiles, workload, policies and identity validate and resolve", async () => {
  const { checkDefinition } = await import("@metacoding.io/regulator-core");
  const definition = await checkDefinition(labRoot);
  assert.deepEqual(definition.problems, []);
  assert.deepEqual(definition.profiles.map((p) => p.name), ["auditor", "bookkeeper", "implement", "intelligence", "research"]);
  assert.deepEqual(definition.workloads.map((w) => w.name), ["personal-finance", "software-development"], "two workloads; the loop is generic over them");
  assert.deepEqual(definition.identity.invariants.map((i) => i.id), ["INV-001", "INV-002", "INV-003", "INV-004"]);
  assert.equal(definition.routing[0]?.floors?.length, 1);
  assert.deepEqual(definition.interaction[0]?.people.map((p) => p.name), ["course-lab", "alice", "bob"]);
  assert.deepEqual(definition.evals.map((s) => [s.name, s.arms.length, s.tasks.length]), [["drift", 6, 6]], "the drift suite is part of the declaration");
  assert.deepEqual(definition.reports.map((r) => r.fingerprint.dispatcher).sort(), ["scripted:drifter", "scripted:reference", "scripted:self-certifier", "scripted:sloppy"]);
});

test("REGULATORS.md is generated from the records and has not drifted", async () => {
  const { records } = await loadRegistry(registryDir);
  const committed = await readFile(path.join(registryDir, "REGULATORS.md"), "utf8");
  assert.equal(committed, renderRegistryMarkdown(records), "run `pnpm --filter @metacoding.io/regulator registry:docs`");
  const boundary = await readFile(path.join(labRoot, "BOUNDARY.md"), "utf8");
  assert.equal(boundary, renderBoundaryMarkdown(records), "BOUNDARY.md is generated from the same records");
  assert.match(boundary, /## Identity write gate[\s\S]*Not covered:[\s\S]*- /, "every gate states what it does not cover");
});
