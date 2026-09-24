import assert from "node:assert/strict";
import test from "node:test";
import { slugify, slugSuffix } from "../src/slugify.js";

test("lowercases, collapses and trims", () => {
  assert.equal(slugify("  Hello  World! "), "hello-world");
});

test("suffix pads with zeros using the vendored helper", () => {
  assert.equal(slugSuffix(7, 3), "007");
});
