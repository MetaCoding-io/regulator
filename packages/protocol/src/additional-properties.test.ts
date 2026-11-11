import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Type } from "typebox";
import { Value } from "typebox/value";
import { isWorkContract } from "./contracts.js";
import { isUnitTransitionRecord } from "./execution.js";

/**
 * `additionalProperties: false` refuses every undeclared key (#191). typebox 1.0.0 tested an undeclared key against an
 * unanchored, unescaped pattern of the declared names, so a key whose name contained a declared one passed: `xstatus`
 * beside `status`, `reason` beside `on`. Fixed upstream in 1.0.50; this pins the dependency the protocol validates with.
 */
test("additionalProperties: false refuses an undeclared key whose name contains a declared key's name (#191)", () => {
  const plain = Type.Object({ status: Type.String() }, { additionalProperties: false });
  assert.equal(Value.Check(plain, { status: "a" }), true);
  assert.equal(Value.Check(plain, { status: "a", xstatus: 1 }), false, "a superstring of a declared key is undeclared");
  assert.equal(Value.Check(plain, { status: "a", zzz: 1 }), false);
  const withOptional = Type.Object({ status: Type.String(), on: Type.Optional(Type.String()) }, { additionalProperties: false });
  assert.equal(Value.Check(withOptional, { status: "a", on: "b" }), true);
  assert.equal(Value.Check(withOptional, { status: "a", reason: "r" }), false, "`reason` contains `on` and is undeclared");
});

test("the protocol's own validators refuse such a key: a real contract with an extra field, a history line with a reason it cannot carry", () => {
  const contract: unknown = JSON.parse(readFileSync(new URL("../../regulator/contracts/finance/f1-ingest.json", import.meta.url), "utf8"));
  assert.equal(isWorkContract(contract), true, "the committed finance contract validates");
  assert.equal(isWorkContract({ ...(contract as object), overrideApproval: true }), false, "`overrideApproval` contains `id` and is undeclared");
  assert.equal(isUnitTransitionRecord({ from: "contracted", to: "dispatched", on: "dispatch", at: "2026-11-11T00:00:00.000Z" }), true);
  assert.equal(isUnitTransitionRecord({ from: "contracted", to: "dispatched", on: "dispatch", at: "2026-11-11T00:00:00.000Z", reason: "r" }), false, "a row that does not block carries no reason");
  assert.equal(isUnitTransitionRecord({ from: "dispatched", to: "blocked", on: "attempt-failed", at: "2026-11-11T00:00:00.000Z", reason: "r" }), true);
});
