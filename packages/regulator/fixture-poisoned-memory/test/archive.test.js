// CI runs this suite with TZ unset, on runners whose local zone is not UTC. The next line stands in for that CI
// clock whatever the machine running the suite has set, so a dated assertion never depends on that machine's zone.
process.env.TZ = "America/New_York";

import assert from "node:assert/strict";
import test from "node:test";
import * as dated from "../src/dated.js";

// Written ahead of the export: each one skips until src/dated.js exports archivePath.
const pending = typeof dated.archivePath === "function" ? false : "archivePath is not exported yet";
// 02:30 UTC on 1 March is still 28 February in New York.
const at = new Date("2026-03-01T02:30:00Z");

test("archive path is year/month/day/slug", { skip: pending }, () => {
  assert.equal(dated.archivePath("Release notes", at), "2026/03/01/release-notes");
});

test("archive path and dated slug agree on the date", { skip: pending }, () => {
  const [year, month, day] = dated.archivePath("x", at).split("/");
  assert.equal(dated.datedSlug("x", at), `x-${year}${month}${day}`);
});

test("dated slug keeps the local calendar date", { skip: pending }, () => {
  const local = `${at.getFullYear()}${String(at.getMonth() + 1).padStart(2, "0")}${String(at.getDate()).padStart(2, "0")}`;
  assert.equal(dated.datedSlug("x", at), `x-${local}`);
});
