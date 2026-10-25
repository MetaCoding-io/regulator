import assert from "node:assert/strict";
import test from "node:test";
import { BehavioralCanary, canaryMarker, renderCanarySection } from "./canary.js";

test("the behavioral canary: a reply that begins with the marker is a hit, a run of replies without it is the signal at the declared count and each multiple after, a hit resets the run, and a reply with no text is not a reply", () => {
  const canary = new BehavioralCanary("[u1]", 2);
  assert.deepEqual(canary.observe("[u1] Reading the contract first."), { hit: true, consecutiveMisses: 0, signal: false });
  assert.deepEqual(canary.observe("  \n[u1] leading whitespace is fine"), { hit: true, consecutiveMisses: 0, signal: false });
  assert.equal(canary.observe(""), undefined, "tool calls only: nothing to read");
  assert.equal(canary.observe("   \n"), undefined);
  assert.deepEqual(canary.observe("I'll start by reading the contract."), { hit: false, consecutiveMisses: 1, signal: false }, "one miss is noise");
  assert.deepEqual(canary.observe("Done. Running the tests now."), { hit: false, consecutiveMisses: 2, signal: true }, "two in a row is the signal");
  assert.deepEqual(canary.observe("Tests pass."), { hit: false, consecutiveMisses: 3, signal: false });
  assert.deepEqual(canary.observe("Committing."), { hit: false, consecutiveMisses: 4, signal: true }, "and every multiple while the silence lasts");
  assert.deepEqual(canary.observe("[u1] back"), { hit: true, consecutiveMisses: 0, signal: false }, "a hit resets the run");
  assert.deepEqual(canary.observe("The marker [u1] is in the wrong place"), { hit: false, consecutiveMisses: 1, signal: false }, "the marker must come first");
  assert.deepEqual(canary.counts(), { seen: 8, hits: 3, consecutiveMisses: 1 });

  assert.deepEqual(new BehavioralCanary("x", 1).observe("no"), { hit: false, consecutiveMisses: 1, signal: true }, "misses: 1 signals on the first miss");
  assert.throws(() => new BehavioralCanary("  ", 2), /needs a marker/);
  assert.throws(() => new BehavioralCanary("x", 0), /positive integer/);
  assert.throws(() => new BehavioralCanary("x", 1.5), /positive integer/);
});

test("the marker is the instance's: the policy's template with the unit id substituted, and `no-unit` outside a unit; the rendered rule names the marker and says what it is for", () => {
  assert.equal(canaryMarker("[{unit}]", "u1"), "[u1]");
  assert.equal(canaryMarker("[{unit}]", undefined), "[no-unit]");
  assert.equal(canaryMarker("[{unit}]", ""), "[no-unit]");
  assert.equal(canaryMarker("::", "u1"), "::", "a template without the placeholder is a fixed marker");
  const section = renderCanarySection("[u1]");
  assert.match(section, /^Begin every reply with `\[u1\]` as its first characters/);
  assert.match(section, /behavioral canary \(S3\*\)/);
});
