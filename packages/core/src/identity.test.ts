import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { checkAuthorityRefs, parseInvariants, readIdentity, renderIdentitySection } from "./identity.js";
import { MemoryStore, renderMemorySection } from "./memory.js";

const INVARIANTS = `# Identity — invariants

Intro text.

## INV-001 — Identity is write-protected

Operational execution must not mutate identity.

Checked by: the gate.

## INV-002 — A proposal is not policy

Recording a proposal changes nothing.
`;

test("identity: invariants are parsed from their headings with their statements; a missing file, a duplicate id or an empty statement is a problem, not an exception; the section is rebuilt from the files", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-identity-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  assert.deepEqual(parseInvariants(INVARIANTS).map((i) => [i.id, i.title, i.text.split("\n")[0]]), [["INV-001", "Identity is write-protected", "Operational execution must not mutate identity."], ["INV-002", "A proposal is not policy", "Recording a proposal changes nothing."]]);
  assert.deepEqual(parseInvariants("## INV-9 — short\n\nx\n"), [], "an id is three digits");

  await writeFile(path.join(dir, "INVARIANTS.md"), `${INVARIANTS}\n## INV-002 — again\n\n## INV-003 — Empty\n`);
  const set = await readIdentity(dir);
  assert.deepEqual(set.invariants.map((i) => i.id), ["INV-001", "INV-002", "INV-002", "INV-003"]);
  assert.deepEqual(set.problems, ["IDENTITY.md is missing from the identity set", "GLOSSARY.md is missing from the identity set", "BOUNDARIES.md is missing from the identity set", "INVARIANTS.md declares INV-002 twice", "INV-002 has a heading and no statement", "INV-003 has a heading and no statement"]);

  for (const name of ["IDENTITY.md", "GLOSSARY.md", "BOUNDARIES.md"]) await writeFile(path.join(dir, name), `# ${name}\n\ntext\n`);
  await writeFile(path.join(dir, "INVARIANTS.md"), INVARIANTS);
  const whole = await readIdentity(dir);
  assert.deepEqual(whole.problems, []);
  const section = renderIdentitySection(whole);
  assert.match(section, /^This instance's identity \(S5\)\. It is committed, write-protected, and rebuilt from the files each run/);
  assert.match(section, /--- IDENTITY\.md ---[\s\S]*--- INVARIANTS\.md ---[\s\S]*INV-001[\s\S]*--- BOUNDARIES\.md ---[\s\S]*--- GLOSSARY\.md ---/);
  assert.match(renderIdentitySection(whole, { maxChars: 200 }), /\[identity truncated at 200 characters; the files are authoritative\]$/);
});

test("authority references resolve or fail: an invariant the identity declares, a regulator the registry declares, a person, an obligation the instance holds; free text fixes nothing", () => {
  const context = { invariants: ["INV-001", "INV-002"], regulators: ["reg.authority.vendor-write-gate.v1"], obligations: ["0b1ig-1234"] };
  const check = (authorityRef: string) => checkAuthorityRefs([{ id: "f", authorityRef }], context).map((p) => p.message);
  assert.deepEqual(check("INV-001"), []);
  assert.deepEqual(check("reg.authority.vendor-write-gate.v1"), []);
  assert.deepEqual(check("human:alice (S3 planning)"), []);
  assert.deepEqual(check("obligation:0b1ig"), [], "a unique prefix of an obligation the instance holds");
  assert.match(check("INV-009")[0] ?? "", /cites INV-009, which the identity does not declare \(it declares INV-001, INV-002\)/);
  assert.match(check("reg.control.nope.v1")[0] ?? "", /which the registry does not declare/);
  assert.match(check("obligation:zzz")[0] ?? "", /cites obligation zzz, which the instance does not hold/);
  assert.match(check("S3 planning decision P1")[0] ?? "", /is free text; an authority is an invariant \(INV-nnn\), a regulator \(reg\.…\), a person \(human:<name>\) or an obligation/);
  assert.deepEqual(checkAuthorityRefs([{ id: "f", authorityRef: "obligation:anything" }], { invariants: [], regulators: [] }), [], "without the instance's obligations, an obligation reference is accepted by form");
});

test("memory: an entry needs a review-by date in the future within the store's limit; current, expired and retracted are folded from events; only current entries are rendered, as facts", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-memory-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let clock = Date.parse("2026-09-22T12:00:00.000Z");
  const store = new MemoryStore(dir, () => clock, { maxReviewDays: 30 });
  const day = 86_400_000;
  await assert.rejects(store.record({ subject: "s", note: "n", evidence: [], recordedBy: "S1", reviewBy: "2026-09-22T11:00:00.000Z" }), /is not in the future/);
  await assert.rejects(store.record({ subject: "s", note: "n", evidence: [], recordedBy: "S1", reviewBy: new Date(clock + 31 * day).toISOString() }), /more than 30 days out; operational memory is reviewed, not permanent — identity is proposed, not remembered/);
  await assert.rejects(store.record({ subject: "s", note: "n", evidence: [], recordedBy: "S1", reviewBy: "soon" }), /is not a date/);
  const a = await store.record({ subject: "tests", note: "need FOO=1", evidence: [{ class: "command", ref: "npm test" }], unit: "u1", revision: "abc1234", recordedBy: "S1", reviewBy: new Date(clock + 2 * day).toISOString() });
  const b = await store.record({ subject: "runner", note: "lacks docker", evidence: [], recordedBy: "alice", reviewBy: new Date(clock + 10 * day).toISOString() });
  assert.equal(a.recordedAt, "2026-09-22T12:00:00.000Z");
  assert.deepEqual((await store.states()).map((s) => [s.subject, s.status]), [["tests", "current"], ["runner", "current"]]);
  assert.match(renderMemorySection(await store.current()), /^Operational memory \(S3\): what earlier units learned[\s\S]*- tests: need FOO=1 \(recorded 2026-09-22 by S1 in unit u1; review by 2026-09-24\)\n- runner: lacks docker \(recorded 2026-09-22 by alice; review by 2026-10-02\)$/);

  clock += 3 * day;
  assert.deepEqual((await store.states()).map((s) => [s.subject, s.status]), [["tests", "expired"], ["runner", "current"]], "expiry is a function of now, not an edit");
  await store.retract(b.id, "bob", "docker arrived");
  await assert.rejects(store.retract(b.id, "bob", "again"), /already retracted/);
  await assert.rejects(store.retract("nope", "bob", "x"), /no memory entry/);
  const states = await store.states();
  assert.deepEqual(states.map((s) => s.status), ["expired", "retracted"]);
  assert.deepEqual(states[1]?.retraction, { by: "bob", at: "2026-09-25T12:00:00.000Z", reason: "docker arrived" });
  assert.deepEqual(await store.current(), []);
  assert.match(renderMemorySection([]), /nothing current/);
});

test("the glossary's refused words (lesson 15) are parsed from one section with the word to say instead; memory scoped to unit types is rendered to those units only", async (t) => {
  const { parseForbiddenTerms } = await import("./identity.js");
  const { MemoryStore } = await import("./memory.js");
  assert.deepEqual(parseForbiddenTerms("# g\n\n- **Unit** — x\n"), [], "no section, no terms");
  const glossary = "# g\n\n- **Unit** — x\n\n## Words this instance does not use\n\n- task, job, ticket (say unit)\n- TODO list (say obligation ledger)\nnot a bullet\n\n## Later\n\n- ignored (say nothing)\n";
  assert.deepEqual(parseForbiddenTerms(glossary), [{ term: "task", say: "unit" }, { term: "job", say: "unit" }, { term: "ticket", say: "unit" }, { term: "TODO list", say: "obligation ledger" }]);
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-memory-scope-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const clock = Date.parse("2026-09-22T12:00:00.000Z");
  const store = new MemoryStore(dir, () => clock);
  const day = 86_400_000;
  await store.record({ subject: "everyone", note: "n", evidence: [], recordedBy: "alice", reviewBy: new Date(clock + day).toISOString() });
  await store.record({ subject: "research only", note: "n", evidence: [], recordedBy: "alice", reviewBy: new Date(clock + day).toISOString(), scope: ["research"] });
  assert.deepEqual((await store.current()).map((m) => m.subject), ["everyone", "research only"], "unscoped reads see everything");
  assert.deepEqual((await store.current("implement")).map((m) => m.subject), ["everyone"]);
  assert.deepEqual((await store.current("research")).map((m) => m.subject), ["everyone", "research only"]);
  const { renderMemorySection } = await import("./memory.js");
  assert.match(renderMemorySection(await store.current("research")), /research only: n \(recorded 2026-09-22 by alice; review by 2026-09-23; for research units\)/);
});
