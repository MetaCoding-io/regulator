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

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";
import { ObligationLedger } from "./obligations.js";
import { consentFor, consentGrantFor, matchesConsentedCall, normalizeConsentCall } from "./consent.js";

test("a call falls under a grant by tool and, for write and edit, by normalized path; for bash by the command pattern; a bare entry guards every call", () => {
  const profile: CapabilityProfile = { ...bookkeeper, tools: [...bookkeeper.tools, "bash", "place_trade"], consent: [...bookkeeper.consent!, { tool: "bash", pattern: "payments/pending/" }, { tool: "place_trade" }] };
  for (const p of ["payments/pending/2026-09-rent.json", "./payments/pending/x.json", "@payments/pending/x.json", "payments\\pending\\x.json", "ledger/../payments/pending/x.json"]) {
    assert.deepEqual(consentGrantFor(profile, { tool: "write", arguments: { path: p, content: "" } }), { tool: "write", paths: ["payments/pending/"] }, p);
  }
  assert.equal(consentGrantFor(profile, { tool: "write", arguments: { path: "ledger/2026-08.csv", content: "" } }), undefined, "a write elsewhere needs no consent");
  assert.equal(consentGrantFor(profile, { tool: "read", arguments: { path: "payments/pending/x.json" } }), undefined, "reading is not guarded");
  assert.deepEqual(consentGrantFor(profile, { tool: "edit", arguments: { path: "payments/pending/x.json" } }), { tool: "edit", paths: ["payments/pending/"] });
  assert.deepEqual(consentGrantFor(profile, { tool: "bash", arguments: { command: "echo x > payments/pending/x.json" } }), { tool: "bash", pattern: "payments/pending/" });
  assert.equal(consentGrantFor(profile, { tool: "bash", arguments: { command: "ls" } }), undefined);
  assert.deepEqual(consentGrantFor(profile, { tool: "place_trade", arguments: { ticker: "VTI" } }), { tool: "place_trade" }, "every call");
  assert.equal(consentGrantFor({ ...profile, consent: [] }, { tool: "write", arguments: { path: "payments/pending/x.json" } }), undefined);
});

test("a recorded call covers a proposed one when the tool is the same and every argument it names is equal: a consent naming the path holds for any content there, and a different path, tool or named argument does not", () => {
  const recorded = { tool: "write", arguments: { path: "payments/pending/2026-09-rent.json" } };
  assert.equal(matchesConsentedCall(recorded, { tool: "write", arguments: { path: "./payments/pending/2026-09-rent.json", content: "{}" } }), true);
  assert.equal(matchesConsentedCall(recorded, { tool: "write", arguments: { path: "payments/pending/2026-10-rent.json", content: "{}" } }), false);
  assert.equal(matchesConsentedCall(recorded, { tool: "edit", arguments: { path: "payments/pending/2026-09-rent.json" } }), false);
  assert.equal(matchesConsentedCall({ ...recorded, arguments: { ...recorded.arguments, content: "a" } }, { tool: "write", arguments: { path: "payments/pending/2026-09-rent.json", content: "b" } }), false, "a recorded argument binds");
  assert.equal(matchesConsentedCall({ tool: "bash", arguments: { command: "rm -r build" } }, { tool: "bash", arguments: { command: "rm -r build" } }), true);
  assert.deepEqual(normalizeConsentCall({ tool: "write", arguments: { path: "@./a/../b.txt", n: 1 } }), { tool: "write", arguments: { path: "b.txt", n: 1 } });
});

async function root(t: TestContext): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "regulator-consent-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test("the lookup over the ledger: absent until asked, pending while owed, rejected on a no, accepted on a yes with the person and any amendment — matched on the recorded call and the unit, never on the hint or the attempt, so a yes holds on a later attempt for the same call and a different call is absent", async (t) => {
  let clock = Date.parse("2026-09-23T09:00:00.000Z");
  const ledger = new ObligationLedger(await root(t), () => (clock += 1000));
  const call = { tool: "write", arguments: { path: "payments/pending/2026-09-rent.json", content: "{ \"amount\": \"1450.00\" }" } };
  const ask = async (unit: string, attempt: number, recorded: { tool: string; arguments: Record<string, unknown> } | undefined) => {
    const o = await ledger.openObligation({ subject: "consent: rent", unit, concern: "interaction", sources: [`ask:${attempt}`], severity: "blocking", consumer: "human", blocks: true, question: "May I?", openedBy: "S1" });
    const id = `r-${unit}-${attempt}`;
    await ledger.requestInteraction({ id, kind: "consent", subject: "rent", question: "May I?", action: "write the payment", ...(recorded ? { call: recorded } : {}), severity: "blocking", unit, attempt, obligationId: o.id, evidence: [], raisedBy: "S1", raisedAt: new Date(clock).toISOString(), timeoutMs: 1000, channel: "none" }, "S1");
    await ledger.answerInteraction({ requestId: id, outcome: "unavailable", by: "S1", channel: "none" });
    return { obligation: o, requestId: id };
  };
  const verdict = async (unit: string | undefined, c: { tool: string; arguments: Record<string, unknown> } = call) => consentFor(await ledger.obligations(), await ledger.interactions(), unit, c);

  assert.deepEqual(await verdict("f5"), { status: "absent" }, "nothing asked");
  const first = await ask("f5", 1, { tool: "write", arguments: { path: "payments/pending/2026-09-rent.json" } });
  let v = await verdict("f5");
  assert.equal(v.status, "pending");
  assert.equal(v.status === "pending" ? v.obligation.id : "", first.obligation.id);
  assert.deepEqual(await verdict("f4"), { status: "absent" }, "another unit's question is not this unit's consent");
  assert.deepEqual(await verdict(undefined), { status: "absent" });

  await ledger.answerInteraction({ requestId: first.requestId, outcome: "answered", answer: "no, not yet", by: "alice", channel: "cli" });
  await ledger.resolve(first.obligation.id, { by: "alice", disposition: "rejected", rationale: "no, not yet" });
  v = await verdict("f5");
  assert.deepEqual([v.status, v.status === "rejected" ? v.obligation.closedBy : ""], ["rejected", "alice"]);

  // Asked again on a later attempt, answered yes: the latest request for the call decides, and the yes holds for the call however the content differs and whatever attempt proposes it.
  const second = await ask("f5", 2, { tool: "write", arguments: { path: "payments/pending/2026-09-rent.json" } });
  assert.equal((await verdict("f5")).status, "pending", "the second question is owed; the earlier no does not stand in for it");
  await ledger.answerInteraction({ requestId: second.requestId, outcome: "answered", answer: "yes", by: "alice", channel: "cli", amendedArguments: { content: "{ \"amount\": \"1400.00\" }" } });
  await ledger.resolve(second.obligation.id, { by: "alice", disposition: "accepted", rationale: "yes" });
  v = await verdict("f5");
  assert.equal(v.status, "accepted");
  if (v.status === "accepted") {
    assert.deepEqual([v.obligation.id, v.request.id, v.by, v.amendedArguments], [second.obligation.id, second.requestId, "alice", { content: "{ \"amount\": \"1400.00\" }" }]);
  }
  assert.equal((await verdict("f5", { tool: "write", arguments: { path: "./payments/pending/2026-09-rent.json", content: "something else entirely" } })).status, "accepted", "the path was consented to, not one content: a repair attempt writes without asking again");
  assert.deepEqual(await verdict("f5", { tool: "write", arguments: { path: "payments/pending/2026-10-rent.json", content: "{}" } }), { status: "absent" }, "a different action asks again");
  assert.deepEqual(await verdict("f5", { tool: "edit", arguments: { path: "payments/pending/2026-09-rent.json" } }), { status: "absent" }, "a different tool on the same path is a different action");

  // A consent that recorded no call matches nothing: the gate cannot read a yes off prose.
  const prose = await ask("f6", 1, undefined);
  await ledger.answerInteraction({ requestId: prose.requestId, outcome: "answered", answer: "yes", by: "alice", channel: "cli" });
  await ledger.resolve(prose.obligation.id, { by: "alice", disposition: "accepted", rationale: "yes" });
  assert.deepEqual(await verdict("f6"), { status: "absent" });
});
