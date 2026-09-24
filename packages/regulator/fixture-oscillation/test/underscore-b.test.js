import assert from "node:assert/strict";
import test from "node:test";
import { slugify } from "../src/slugify.js";

test("an underscore is a word separator", () => {
  assert.equal(slugify("snake_case_name"), "snake-case-name");
});
