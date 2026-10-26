import assert from "node:assert/strict";
import test from "node:test";
import { UNIT_TRANSITIONS, UnitStatusSchema } from "@metacoding.io/regulator-protocol";
import { lifecycleEdges, renderLifecycleFigure } from "./figures.js";

test("the lifecycle figure is drawn from UNIT_TRANSITIONS: one node per status, one numbered edge per pair, waiting edges dashed", () => {
  const svg = renderLifecycleFigure();
  const statuses = UnitStatusSchema.anyOf.map((s) => s.const as string);
  for (const s of statuses) {
    assert.match(svg, new RegExp(`<g class="state" data-state="${s}"`), `a node for ${s}`);
    assert.match(svg, new RegExp(`data-count="units:${s}"`), `a count line for ${s}`);
  }
  const pairs = new Set(UNIT_TRANSITIONS.map((t) => `${t.from}->${t.to}`));
  assert.equal((svg.match(/<g class="edge/g) ?? []).length, pairs.size, "one edge per pair the table joins");
  for (const t of UNIT_TRANSITIONS) assert.match(svg, new RegExp(`data-from="${t.from}" data-to="${t.to}" data-on="[^"]*\\b${t.on}\\b`), `an edge carries ${t.on}`);
  const edges = lifecycleEdges();
  assert.deepEqual(edges.map((e) => e.number), UNIT_TRANSITIONS.map((_, i) => i + 1), "numbered in table order");
  const selfLoop = /<g class="edge[^"]*" data-from="blocked" data-to="blocked"[^>]*data-numbers="([^"]+)"/.exec(svg);
  assert.ok(selfLoop, "the self-loop on blocked");
  assert.equal(selfLoop[1]!.split(" ").length, UNIT_TRANSITIONS.filter((t) => t.from === "blocked" && t.to === "blocked").length, "every row on the pair is numbered on the one edge");
  assert.match(svg, /class="edge waits" data-from="blocked" data-to="reported"/, "a re-audit waits on something outside the loop");
  assert.match(svg, /class="edge" data-from="dispatched" data-to="reported"/, "verification is the loop's own");
  assert.doesNotMatch(svg, /<script/, "a figure is a picture");
});
