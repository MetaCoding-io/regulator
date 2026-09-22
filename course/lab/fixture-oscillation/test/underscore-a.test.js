import assert from "node:assert/strict";
import test from "node:test";
import { slugify } from "../src/slugify.js";

test("identifiers keep their underscores", () => {
  assert.equal(slugify("snake_case_name"), "snake_case_name");
});
