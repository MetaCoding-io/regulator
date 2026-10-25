import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { CapabilityProfile } from "@metacoding.io/regulator-protocol";
import { ADVICE_CONTEXT_MAX_CHARS, adviceContextBudget, adviceFileName, adviceMaxChars, profileOfAdviceFile, readAdviceSet, renderAdvice } from "./advice.js";
import { renderProfileSection } from "./profiles.js";

const implement: CapabilityProfile = {
  name: "implement", description: "Change src/ and test/.", tools: ["read", "write", "edit", "bash"], writablePaths: ["src/", "test/"],
  advice: ["Smallest change.", "Run the tests before reporting; report what ran."],
};

test("advice as a file set (#110): a file per declared profile, no file for an undeclared one, no profile carrying the text twice; an empty file is a profile told nothing beyond its grant", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-advice-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  assert.equal(adviceFileName("implement"), "implement.md");
  assert.equal(profileOfAdviceFile("implement.md"), "implement");
  assert.equal(profileOfAdviceFile("README.md"), undefined, "a profile name is lower-case");
  assert.equal(profileOfAdviceFile("implement.txt"), undefined);

  const none = await readAdviceSet(path.join(dir, "advice"), [{ name: "implement", inline: false }, { name: "research", inline: true }]);
  assert.deepEqual(none.problems, [{ file: "advice/implement.md", message: 'is missing: profile "implement" declares no advice; every profile has an advice file (an empty one says the profile is told nothing beyond its grant)' }], "a profile still carrying inline advice is not asked for a file during the overlap release");

  await mkdir(path.join(dir, "advice"));
  await writeFile(path.join(dir, "advice", "implement.md"), "- Smallest change.\n");
  await writeFile(path.join(dir, "advice", "research.md"), "- Report; do not change.\n");
  await writeFile(path.join(dir, "advice", "auditor.md"), "");
  await writeFile(path.join(dir, "advice", "skills.md"), "- x\n");
  await writeFile(path.join(dir, "advice", "notes.txt"), "x");
  const set = await readAdviceSet(path.join(dir, "advice"), [{ name: "implement", inline: false }, { name: "research", inline: true }, { name: "auditor", inline: false }]);
  assert.deepEqual(Object.keys(set.files).sort(), ["auditor", "implement", "research"]);
  assert.deepEqual(set.problems.map((p) => `${p.file}: ${p.message}`), [
    "advice/notes.txt: names no declared profile (declared: implement, research, auditor); an advice file is `<profile>.md` for a profile under profiles/",
    "profiles/research.json: carries advice inline and advice/research.md exists: move the text into the file, do not carry two copies",
    "advice/skills.md: names no declared profile (declared: implement, research, auditor); an advice file is `<profile>.md` for a profile under profiles/",
  ]);
});

test("the advice file renders byte for byte as the inline lines did, and is cut at the budget policy's advice.maxChars with a marker; the cut is measured and named, and refuses nothing", () => {
  const file = `${implement.advice!.map((l) => `- ${l}`).join("\n")}\n`;
  const { advice: _inline, ...bare } = implement;
  assert.equal(renderProfileSection(implement, { advice: file }), renderProfileSection(implement), "moving the text into a file changes nothing a unit is told");
  assert.equal(renderProfileSection(bare, { advice: file }), renderProfileSection(implement), "with the inline field gone the file alone renders the same section");
  assert.equal(renderProfileSection(bare, { advice: "" }), renderProfileSection({ ...implement, advice: [] }), "an empty file renders the grant alone");
  assert.equal(renderProfileSection(bare), renderProfileSection({ ...implement, advice: [] }), "no file and no field: the grant alone, not a crash");

  assert.equal(adviceMaxChars(), ADVICE_CONTEXT_MAX_CHARS);
  assert.equal(adviceMaxChars({ advice: { maxChars: 500 } }), 500);
  assert.equal(adviceMaxChars({ identity: { maxChars: 500 } } as { advice?: { maxChars: number } }), ADVICE_CONTEXT_MAX_CHARS, "the identity's limit is not the advice's");
  const within = adviceContextBudget("implement", file);
  assert.deepEqual([within.truncated, within.warning, within.max, within.chars], [false, undefined, ADVICE_CONTEXT_MAX_CHARS, file.trim().length]);
  const over = adviceContextBudget("implement", file, 20);
  assert.equal(over.truncated, true);
  assert.equal(over.warning, `the advice for profile "implement" renders to ${file.trim().length} characters and a unit's prompt carries 20: ${file.trim().length - 20} character(s) of implement.md are advice the model never sees. Shorten the file, or raise \`advice.maxChars\` in the budget policy; the file is authoritative either way.`);
  assert.equal(renderAdvice(file, 20), `${file.trim().slice(0, 20)}\n[advice truncated at 20 characters; the file is authoritative]`);
  assert.match(renderProfileSection(implement, { advice: file, maxChars: 20 }), /\n- Smallest change\.\n-\n\[advice truncated at 20 characters; the file is authoritative\]$/);
  assert.doesNotMatch(renderProfileSection(implement, { advice: file, maxChars: 4000 }), /truncated/);
});
