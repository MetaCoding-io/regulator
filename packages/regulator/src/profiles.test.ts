import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { renderProfileSection } from "@metacoding.io/regulator-core";
import { ADVICE_SEED_DIR } from "./unit.js";
import { PROFILES, loadProfilesSync } from "./profiles.js";

/**
 * The five profiles' advice as it was declared inline, before #110 moved it into `advice/<profile>.md`. Frozen here so the
 * move is provably a move: the section a unit of each profile is told renders byte for byte as it did.
 */
const INLINE_BEFORE: Record<string, string[]> = {
  "implement": [
    "You are in the implement profile: you may change files under src/ and test/ only.",
    "When the README and the code disagree, trust the code and say so in your summary.",
    "Prefer the smallest change that makes the tests pass; do not restructure what you were not asked to change.",
    "Run run_checks and run_tests before reporting work as done. Report what you ran, not what you assume.",
    "When you learn something about this environment that a later unit would need — a flag, a missing tool, a command that only works one way — record it with remember, with a review-by date.",
    "Before anything irreversible — deleting data, publishing, paying, changing an account — ask_human with kind=consent and do nothing without a yes. For decisions you can undo, offer a recap and keep going."
  ],
  "research": [
    "You are in the research profile: you can read the project and run its static checks, but not change it or run its code.",
    "Report what you find with file paths and line numbers. If asked to change something, say what you would change and why; do not attempt it."
  ],
  "intelligence": [
    "You are in the intelligence profile: you answer one question about the project's environment and report what you found with report_intelligence, then close the contract with report_result.",
    "Cite what you read: file paths, versions, dates. Say how sure you are and as of when. Name the units your finding affects; the orchestrator decides what to do about them — you do not.",
    "You cannot change the project. If the answer calls for a change, say so in the claim; do not attempt it and do not ask for the tools."
  ],
  "bookkeeper": [
    "You are in the bookkeeper profile: you may change files under ledger/, reports/ and payments/pending/ only. The statement under statements/ is the bank's and is never edited; if the ledger does not balance to it, the ledger is wrong.",
    "A category comes from categories.json. A merchant you cannot explain stays in the holding category and is surfaced in your report as unresolved; do not guess.",
    "Run run_tests before reporting: the ledger's checks are the reconciliation. Report what they printed, not what you expect.",
    "Writing a file under payments/pending/ is a commitment the household will act on: ask_human with kind=consent naming the payee, the amount and the due date, and write nothing without a yes. Silence is not consent.",
    "When you learn something about this ledger that a later unit would need — a merchant's real name, a recurring amount — record it with remember, scoped to the unit types it serves, with a review-by date."
  ],
  "auditor": [
    "You are in the auditor profile: you can read the ledger, the statements and the reports, and run the static checks, but not change anything or run the suite.",
    "Compare the period's ledger to its statement row by row and say what does not match, with file and line. If something needs changing, say what and why; do not attempt it."
  ]
};

test("moving the shipped profiles' advice into advice/<profile>.md changes nothing a unit is told (#110): for every profile the section rendered from the file is byte-identical to the one rendered from the inline advice[] it replaced, and no profile carries the text inline any more", async () => {
  const profiles = loadProfilesSync();
  assert.deepEqual(Object.keys(profiles).sort(), Object.keys(INLINE_BEFORE).sort(), "every shipped profile has its before-text frozen here");
  for (const [name, inline] of Object.entries(INLINE_BEFORE)) {
    const profile = profiles[name]!;
    assert.equal(profile.advice, undefined, `${name} no longer carries advice inline`);
    const file = await readFile(path.join(ADVICE_SEED_DIR, `${name}.md`), "utf8");
    const before = renderProfileSection({ ...profile, advice: inline });
    const after = renderProfileSection(profile, { advice: file });
    assert.equal(after, before, `${name}: the rendered section is byte-identical before and after the move`);
    assert.equal(renderProfileSection(profile), before.split("\n").slice(0, before.split("\n").length - inline.length).join("\n"), `${name}: without the file the grant alone renders`);
  }
  assert.equal(PROFILES.implement.advice, undefined);
});
