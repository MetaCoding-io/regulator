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
    "reg.assurance.prediction-resolution.v1",
    "reg.assurance.span-projection.v1",
    "reg.audit.behavioral-canary.v1",
    "reg.audit.behaviour-check.v1",
    "reg.audit.canary-watch.v1",
    "reg.audit.closeout-gate.v1",
    "reg.audit.doctor.v1",
    "reg.audit.glossary-lint.v1",
    "reg.audit.identity-untouched-check.v1",
    "reg.audit.inherited-tests-check.v1",
    "reg.audit.post-merge-check.v1",
    "reg.audit.pre-merge-trial.v1",
    "reg.authority.advice-decision.v1",
    "reg.authority.disposition-authority.v1",
    "reg.authority.identity-promotion.v1",
    "reg.authority.identity-write-gate.v1",
    "reg.authority.project-trust-rule.v1",
    "reg.authority.proposal-intake.v1",
    "reg.authority.s5-decision.v1",
    "reg.authority.vendor-write-gate.v1",
    "reg.control.budget-guard.v1",
    "reg.control.command-runner.v1",
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
    "reg.control.unit-lifecycle.v1",
    "reg.control.work-contract-gate.v1",
    "reg.coordination.effect-journal.v1",
    "reg.coordination.reintegration.v1",
    "reg.coordination.thrash-detector.v1",
    "reg.coordination.unit-lease.v1",
    "reg.identity.advice-context.v1",
    "reg.identity.definition-check.v1",
    "reg.identity.definition-writers.v1",
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
  assert.deepEqual(definition.profiles.map((p) => p.name), ["auditor", "bookkeeper", "implement", "intelligence", "manager", "research"]);
  assert.deepEqual(definition.warnings.filter((w) => w.file.startsWith("profiles/")), [], "no shipped profile grants a shell beside a guarded write");
  assert.deepEqual(definition.profiles.map((p) => [p.name, p.consent ?? []]), [
    ["auditor", []], ["bookkeeper", [{ tool: "write", paths: ["payments/pending/"] }, { tool: "edit", paths: ["payments/pending/"] }]], ["implement", []], ["intelligence", []],
    ["manager", [{ tool: "write", paths: ["trades/pending/"] }, { tool: "edit", paths: ["trades/pending/"] }]], ["research", []],
  ], "the two shipped grants (#60): the payment and the trade list; every other profile grants none");
  assert.deepEqual(definition.workloads.map((w) => w.name), ["personal-finance", "portfolio", "software-development"], "three workloads; the loop is generic over them");
  assert.deepEqual(definition.identity.invariants.map((i) => i.id), ["INV-001", "INV-002", "INV-003", "INV-004"]);
  assert.equal(definition.routing[0]?.floors?.length, 1);
  assert.deepEqual(definition.interaction[0]?.people.map((p) => p.name), ["course-lab", "alice", "bob"]);
  assert.deepEqual(definition.evals.map((s) => [s.name, s.arms.length, s.tasks.length]), [["drift", 6, 6], ["portfolio-turnover", 2, 2]], "the drift suite and the portfolio's turnover suite are part of the declaration");
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

test("the viability case (#57) is rendered from the records and the pathology rows, deterministically, with every active record in the ledger exactly once", async () => {
  const { renderViabilityMarkdown, checkDefinition } = await import("@metacoding.io/regulator-core");
  const registry = await checkRegistry(registryDir, labRoot);
  assert.deepEqual(registry.problems, []);
  assert.ok(registry.pathologies.length >= 30, "the catalog's rows are loaded beside the records");
  const arms = (await checkDefinition(labRoot)).evals.flatMap((suite) => suite.arms.map((arm) => ({ suite: suite.name, arm: arm.name, ...(arm.ablates ? { ablates: arm.ablates } : {}), ...(arm.switch ? { switch: arm.switch } : {}) })));
  const options = { pathologies: registry.pathologies, shortNames: registry.shortNames, arms };
  const rendered = renderViabilityMarkdown(registry.records, options);
  assert.equal(rendered, renderViabilityMarkdown(registry.records, options), "two renders of the same inputs are byte-identical");
  const committed = await readFile(path.join(labRoot, "VIABILITY.md"), "utf8");
  assert.equal(committed, rendered, "run `pnpm --filter @metacoding.io/regulator registry:docs`");
  // The seven sections, in the capstone's order; two are a team's own.
  assert.deepEqual([...rendered.matchAll(/^## (\d)\. (.+)$/gm)].map((m) => `${m[1]} ${m[2]}`), [
    "1 System map", "2 Channel table", "3 Mechanism ledger", "4 Enforcement boundary", "5 Evidence", "6 Residual uncertainty", "7 Boundary critique",
  ]);
  assert.match(rendered, /## 2\. Channel table\n\n\*A team's own; not rendered\.\*/);
  assert.match(rendered, /## 7\. Boundary critique\n\n\*A team's own; not rendered\.\*/);
  // Every active record is one ledger row and one evidence row; no retired record is anywhere below the map's count line.
  const ledger = rendered.slice(rendered.indexOf("## 3. Mechanism ledger"), rendered.indexOf("### What switches"));
  const evidence = rendered.slice(rendered.indexOf("## 5. Evidence"), rendered.indexOf("## 6. Residual uncertainty"));
  for (const r of registry.records) {
    const short = registry.shortNames.get(r.id)!;
    const rows = ledger.split("\n").filter((line) => line.startsWith(`| \`${short}\` |`)).length;
    assert.equal(rows, r.status === "active" ? 1 : 0, `${short} (${r.status}) appears ${rows} time(s) in the ledger`);
    assert.equal(evidence.split("\n").filter((line) => line.startsWith(`| \`${short}\` |`)).length, r.status === "active" ? 1 : 0, `${short} in the evidence table`);
  }
  assert.equal(registry.records.filter((r) => r.status === "retired").length, 2, "the two retired records are history");
  assert.match(rendered, /2 retired records stay in the registry as history and appear nowhere below/);
  // The evidence says plainly that no ablation result exists yet, and names the arm that would produce one.
  assert.match(rendered, /\*\*No ablation result is reported here\.\*\* The live report over the drift scenario is \[#46\]/);
  assert.match(rendered, /\| `inherited-tests-check` \| [^|]+ \| not stated \| `no-inherited-tests` \(drift\) \|/);
  assert.match(rendered, /\| `closeout-gate` \| [^|]+ \| not stated \| none \|/);
  // The residual uncertainty is the catalog's "not absorbed" column, and the uncatalogued records are named.
  for (const row of registry.pathologies.filter((r) => r.notAbsorbed)) assert.ok(rendered.includes(`| **${row.name}** (`), `${row.id} is in the residual uncertainty`);
  assert.match(rendered, /active regulators absorb a failure class no pathology row names[^\n]*`advice-context` \(`uninformed-unit`\)/);
  assert.match(rendered, /A gate with no stated limitation does not pass `regulator check`/);
});

test("the pathology catalog (#57) is a source file whose rows name active records: a row naming an unknown or retired regulator is refused, an unnamed active record is a warning, and the rendered tables round-trip the source", async (t) => {
  const { mkdtemp, mkdir, rm, writeFile, cp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { PATHOLOGY_END_MARKER, pathologyMarker, renderAbsorbedBy, renderPathologyTable, splicePathologyTables } = await import("@metacoding.io/regulator-core");
  const { PATHOLOGY_SECTIONS } = await import("@metacoding.io/regulator-protocol");
  const registry = await checkRegistry(registryDir, labRoot);
  assert.deepEqual(registry.problems, []);
  assert.equal(registry.warnings.length, 1, "one warning: the active records no row names, in one line");
  assert.match(registry.warnings[0]!.message, /^\d+ active regulator\(s\) absorb a failure class no pathology row names: reg\./);
  for (const row of registry.pathologies) for (const { id } of row.absorbedBy.regulators) assert.equal(registry.records.find((r) => r.id === id)?.status, "active", `${row.id} names ${id}`);
  assert.equal(new Set(registry.pathologies.map((r) => r.id)).size, registry.pathologies.length, "row ids are unique");

  // A copy of the registry with a row that names a retired record, one that names no record, and a duplicate id.
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-pathologies-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, "regulators"));
  await cp(path.join(registryDir, "regulators"), path.join(dir, "regulators"), { recursive: true });
  const first = registry.pathologies[0]!;
  const bad = { rows: [first, { ...first, id: "names-retired", absorbedBy: { ...first.absorbedBy, regulators: [{ id: "reg.audit.post-merge-check.v1" }] } }, { ...first, id: "names-nothing", absorbedBy: { ...first.absorbedBy, regulators: [{ id: "reg.audit.no-such-gate.v1" }] } }, { ...first, absorbedBy: { ...first.absorbedBy, regulators: [] } }] };
  await writeFile(path.join(dir, "pathologies.json"), JSON.stringify(bad));
  const refused = await checkRegistry(dir, labRoot, { verifyFiles: false });
  assert.deepEqual(refused.problems.map((p) => `${p.file}: ${p.message}`), [
    "pathologies.json: row `names-retired` names `reg.audit.post-merge-check.v1`, which is retired: a pathology is absorbed by an active regulator or by nothing",
    "pathologies.json: row `names-nothing` names `reg.audit.no-such-gate.v1`, which is not a registry record",
    `pathologies.json: duplicate row id \`${first.id}\``,
  ]);
  await writeFile(path.join(dir, "pathologies.json"), JSON.stringify({ rows: [first, { id: "Bad Id", section: "structural", name: "x", absorbedBy: first.absorbedBy }] }));
  assert.deepEqual((await checkRegistry(dir, labRoot, { verifyFiles: false })).problems.map((p) => p.message), ["does not match the pathology row schema (row 2, `Bad Id`)"]);
  await writeFile(path.join(dir, "pathologies.json"), "{nope");
  assert.match((await checkRegistry(dir, labRoot, { verifyFiles: false })).problems[0]!.message, /^not valid JSON/);
  await rm(path.join(dir, "pathologies.json"));
  const without = await checkRegistry(dir, labRoot, { verifyFiles: false });
  assert.deepEqual([without.problems, without.warnings, without.pathologies], [[], [], []], "a registry without the file carries no rows, no problem and no warning");

  // The committed page carries every section's tables between its markers, rendered from the rows; the cells say what the rows say.
  const page = await readFile(path.join(labRoot, "../../docs/PATHOLOGIES.md"), "utf8");
  assert.equal(page, splicePathologyTables(page, registry.pathologies, registry.shortNames), "docs/PATHOLOGIES.md's tables are current; run `pnpm --filter @metacoding.io/regulator registry:docs`");
  for (const section of Object.keys(PATHOLOGY_SECTIONS) as Array<keyof typeof PATHOLOGY_SECTIONS>) {
    const table = renderPathologyTable(section, registry.pathologies, registry.shortNames);
    const start = page.indexOf(pathologyMarker(section)) + pathologyMarker(section).length;
    assert.equal(page.slice(start, page.indexOf(PATHOLOGY_END_MARKER, start)), `\n${table}\n`, `the ${section} table is between its markers`);
    const rows = registry.pathologies.filter((r) => r.section === section);
    assert.equal(table.split("\n").length, rows.length + 2, `one line per ${section} row, plus the header and the rule`);
    for (const row of rows) {
      const line = table.split("\n").find((l) => l.includes(`| ${section === "agent" ? row.name : `**${row.name}**`}`))!;
      assert.ok(line, `${row.id} is a line of the ${section} table`);
      for (const text of [row.looksLike, row.reproducedBy, row.notAbsorbed, ...row.absorbedBy.notes, ...row.absorbedBy.regulators.map((g) => `\`${registry.shortNames.get(g.id)}\``)].filter((x): x is string => x !== undefined)) {
        assert.ok(line.includes(text.replaceAll("|", "\\|")), `${row.id}: ${JSON.stringify(text.slice(0, 40))} is in its line`);
      }
      assert.ok(line.includes(renderAbsorbedBy(row.absorbedBy, registry.shortNames)), `${row.id}: the absorbed-by cell`);
    }
  }
  assert.throws(() => splicePathologyTables("# a page with no markers\n", registry.pathologies), /no <!-- pathologies:structural --> marker/);
  // The absorbed-by cell: regulators (with notes) and modules, then invariants, then each free note as a clause.
  assert.equal(renderAbsorbedBy({ regulators: [{ id: "reg.a.b.v1" }, { id: "reg.a.c.v1", note: "n" }, { id: "reg.a.d.v1" }], invariants: ["INV-001", "INV-002"], modules: ["M01", "M02"], notes: ["a note", "another"] }), "`b`, `c` (n) and `d` (M01, M02), and INV-001 and INV-002; a note; another");
  assert.equal(renderAbsorbedBy({ regulators: [], invariants: [], modules: [], notes: [] }), "—");
  assert.equal(renderAbsorbedBy({ regulators: [], invariants: [], modules: [], notes: ["nothing yet"] }), "nothing yet");
});
