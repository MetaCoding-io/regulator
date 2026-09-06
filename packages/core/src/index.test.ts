import assert from "node:assert/strict";
import test from "node:test";

import { authorizeWrite, isProtectedS5Path } from "./index.js";

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
