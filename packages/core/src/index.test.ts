import assert from "node:assert/strict";
import test from "node:test";
import { channelCanMutateS5 } from "@metacoding/vsm-pi-protocol";

import { authorizeWrite, isProtectedS5Path, PROTECTED_S5_PATHS } from "./index.js";

test("operational writes to committed S5 artifacts are blocked", () => {
  const decision = authorizeWrite("vsm/INVARIANTS.md");
  assert.equal(decision.allowed, false);
  assert.match(decision.reason ?? "", /policy proposal/i);
});

test("explicit S5 authority may update committed identity", () => {
  const decision = authorizeWrite("vsm/INVARIANTS.md", "s5-authority");
  assert.equal(decision.allowed, true);
});

test("ordinary source writes are allowed", () => {
  const decision = authorizeWrite("src/orders/service.ts");
  assert.deepEqual(decision, {
    allowed: true,
    normalizedPath: "src/orders/service.ts",
  });
});

test("path traversal fails closed", () => {
  const decision = authorizeWrite("../vsm/INVARIANTS.md", "s5-authority");
  assert.equal(decision.allowed, false);
  assert.match(decision.reason ?? "", /project root/i);
});

test("protected path recognition uses normalized repo-relative paths", () => {
  assert.equal(isProtectedS5Path("./vsm/IDENTITY.md"), true);
  assert.equal(isProtectedS5Path("vsm\\IDENTITY.md"), true);
  assert.equal(isProtectedS5Path("../vsm/IDENTITY.md"), false);
});

test("every protected artifact requires explicit authority, including normalized aliases", () => {
  for (const artifact of PROTECTED_S5_PATHS) {
    for (const input of [artifact, `./${artifact}`, artifact.replaceAll("/", "\\"), artifact.replace("vsm/", "vsm//./"), `src/../${artifact}`]) {
      assert.equal(authorizeWrite(input).allowed, false, input);
      assert.equal(authorizeWrite(input, "operational").allowed, false, input);
      assert.equal(authorizeWrite(input, "s5-authority").allowed, true, input);
      assert.equal(authorizeWrite(input).normalizedPath, artifact);
    }
  }
});

test("absolute and escaping paths fail closed for both authorities", () => {
  for (const input of ["/tmp/file.ts", "/vsm/IDENTITY.md", "C:\\vsm\\IDENTITY.md", "C:/src/file.ts", "C:relative.ts", "\\\\server\\share\\file.ts", "\\vsm\\IDENTITY.md", "../src/file.ts", "..", "src/../../vsm/IDENTITY.md", "..\\vsm\\IDENTITY.md"]) {
    for (const authority of ["operational", "s5-authority"] as const) {
      const decision = authorizeWrite(input, authority);
      assert.equal(decision.allowed, false, input);
      assert.match(decision.reason ?? "", /project root/i);
    }
  }
});

test("a proposal channel does not authorize an operational S5 write", () => {
  assert.equal(channelCanMutateS5("proposal"), false);
  assert.equal(authorizeWrite("vsm/IDENTITY.md").allowed, false);
});
