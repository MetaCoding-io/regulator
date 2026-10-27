import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityProfile } from "@metacoding.io/regulator-protocol";
import { checkConsentGrants, consentBypassWarnings, describeConsentGrant } from "./consent.js";
import { renderProfileSection } from "./profiles.js";

const bookkeeper: CapabilityProfile = {
  name: "bookkeeper", description: "d", tools: ["read", "write", "edit", "ask_human", "report_result"], writablePaths: ["ledger/", "payments/pending/"],
  consent: [{ tool: "write", paths: ["payments/pending/"] }, { tool: "edit", paths: ["payments/pending/"] }],
};

test("consent grants are checked against the profile's own grant: a guarded tool must be granted, a guarded path writable, a pattern a regular expression on a tool with arbitrary execution, and one entry guards one way", () => {
  assert.deepEqual(checkConsentGrants(bookkeeper), []);
  const { consent: _none, ...ungranted } = bookkeeper;
  assert.deepEqual(checkConsentGrants(ungranted), []);
  const bad: CapabilityProfile = {
    ...bookkeeper, tools: [...bookkeeper.tools, "bash"],
    consent: [
      { tool: "pay" },
      { tool: "write", paths: ["payments/executed/"] },
      { tool: "bash", pattern: "(" },
      { tool: "read", pattern: "x" },
      { tool: "ask_human", paths: ["ledger/"] },
      { tool: "bash", paths: ["ledger/"], pattern: "ledger/" },
    ],
  };
  assert.deepEqual(checkConsentGrants(bad).map((p) => p.message), [
    'consent[0] needs consent for "pay", which the profile does not grant: a grant guards calls the profile can make',
    'consent[1] needs consent for write under "payments/executed/", which is outside the profile\'s writable paths (ledger/, payments/pending/): a write there is refused before consent could be asked',
    'consent[2] pattern "(" is not a regular expression',
    'consent[3] gives "read" a pattern; a command pattern applies to a tool with arbitrary execution (bash), which no path gates',
    'consent[4] narrows "ask_human" by paths; a path applies to write and edit, whose argument the profile grant gates',
    'consent[5] narrows "bash" by paths; a path applies to write and edit, whose argument the profile grant gates',
    "consent[5] carries both paths and a pattern; one entry guards one tool one way",
  ]);
});

test("the sandbox bypass is a warning, not a refusal: a guarded write beside bash with no pattern covering the path is named, per path and per shell, and a bash entry whose pattern matches the path (or a bare bash entry) closes it", () => {
  assert.deepEqual(consentBypassWarnings(bookkeeper), [], "no shell, no hole");
  const withShell: CapabilityProfile = { ...bookkeeper, tools: [...bookkeeper.tools, "bash"] };
  assert.deepEqual(consentBypassWarnings(withShell).map((w) => w.message), [
    'profile "bookkeeper" needs consent for write under "payments/pending/" and grants bash, which is not path-gated: a shell command can write there with no consent asked. Declare {"tool":"bash","pattern":"payments\\/pending\\/"} beside it, or the grant is enforced on write calls only',
    'profile "bookkeeper" needs consent for edit under "payments/pending/" and grants bash, which is not path-gated: a shell command can write there with no consent asked. Declare {"tool":"bash","pattern":"payments\\/pending\\/"} beside it, or the grant is enforced on edit calls only',
  ]);
  assert.deepEqual(consentBypassWarnings({ ...withShell, consent: [...withShell.consent!, { tool: "bash", pattern: "payments/pending/" }] }), []);
  assert.deepEqual(consentBypassWarnings({ ...withShell, consent: [...withShell.consent!, { tool: "bash" }] }), [], "every bash call needs consent: nothing slips past");
  assert.equal(consentBypassWarnings({ ...withShell, consent: [...withShell.consent!, { tool: "bash", pattern: "ledger/" }] }).length, 2, "a pattern that does not match the path does not cover it");
});

test("the profile section describes the grant and says the refusal is the harness's; a profile without grants says nothing about consent", () => {
  assert.deepEqual([describeConsentGrant({ tool: "write", paths: ["payments/pending/", "x/"] }), describeConsentGrant({ tool: "bash", pattern: "rm " }), describeConsentGrant({ tool: "place_trade" })], ["write under payments/pending/, x/", "bash matching /rm /", "every place_trade call"]);
  assert.match(renderProfileSection(bookkeeper), /^Consent is required before: write under payments\/pending\/; edit under payments\/pending\/\. Ask first with ask_human kind=consent, naming the call \(the tool and the arguments it will run with\); the harness refuses such a call until a person's yes for it is on the record, and holds that yes across attempts\.$/m);
  assert.doesNotMatch(renderProfileSection({ ...bookkeeper, consent: [] }), /Consent is required/);
});
