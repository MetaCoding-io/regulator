import assert from "node:assert/strict";
import test from "node:test";
import { DEFINITION_WRITERS, ENFORCEMENT_POINTS, INSTANCE_STORES, UNIT_TRANSITIONS, UnitStatusSchema } from "@metacoding.io/regulator-protocol";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FIGURES, instanceMapFragment, lifecycleEdges, lifecycleFragment, renderInstanceMapFigure, renderLifecycleFigure } from "./figures.js";
import { readDefinition } from "./status.js";

/** The lab's own definition: this package's directory. */
const LAB = fileURLToPath(new URL("../", import.meta.url));

const statuses = UnitStatusSchema.anyOf.map((s) => s.const as string);

test("the lifecycle figure is drawn from UNIT_TRANSITIONS: one node per status, one numbered edge per pair, waiting edges dashed", () => {
  const svg = renderLifecycleFigure();
  for (const s of statuses) {
    assert.match(svg, new RegExp(`<g class="state[^"]*"[^>]*data-state="${s}"`), `a node for ${s}`);
    assert.match(svg, new RegExp(`data-count="units:${s}"`), `a count line for ${s}`);
  }
  const pairs = new Set(UNIT_TRANSITIONS.map((t) => `${t.from}->${t.to}`));
  assert.equal((svg.match(/<g class="edge/g) ?? []).length, pairs.size, "one edge per pair the table joins");
  for (const t of UNIT_TRANSITIONS) assert.match(svg, new RegExp(`data-from="${t.from}" data-to="${t.to}" data-on="[^"]*\\b${t.on}\\b`), `an edge carries ${t.on}`);
  const edges = lifecycleEdges();
  assert.deepEqual(edges.map((e) => e.number), UNIT_TRANSITIONS.map((_, i) => i + 1), "numbered in table order");
  const selfLoop = /<g class="edge[^"]*"[^>]*data-from="blocked" data-to="blocked"[^>]*data-numbers="([^"]+)"/.exec(svg);
  assert.ok(selfLoop, "the self-loop on blocked");
  assert.equal(selfLoop[1]!.split(" ").length, UNIT_TRANSITIONS.filter((t) => t.from === "blocked" && t.to === "blocked").length, "every row on the pair is numbered on the one edge");
  assert.match(svg, /class="edge waits[^"]*"[^>]*data-from="blocked" data-to="reported"/, "a re-audit waits on something outside the loop");
  assert.match(svg, /class="edge gl fig-hot"[^>]*data-from="dispatched" data-to="reported"/, "verification is the loop's own");
  assert.doesNotMatch(svg, /<script/, "a figure is a picture");
});

test("the figure is its fragment, wrapped: a <g> with the figure's id, its own defs under that prefix, and a viewBox a frame can scale by", () => {
  const fragment = lifecycleFragment();
  assert.equal(fragment.id, "unit-lifecycle");
  assert.ok(fragment.markup.startsWith(`<g id="unit-lifecycle" class="lifecycle-fragment" data-viewbox="0 0 800 480">`), "the fragment is one group, naming its coordinate space");
  assert.ok(fragment.markup.endsWith("</g>"));
  assert.deepEqual(fragment.viewBox, { width: 800, height: 480 });
  assert.match(fragment.markup, /<defs><marker id="unit-lifecycle-arrow"/, "the marker lives inside the fragment, under its prefix");
  assert.doesNotMatch(fragment.markup, /url\(#(?!unit-lifecycle-)/, "every reference inside the fragment is to a prefixed id");
  assert.doesNotMatch(fragment.markup, /<svg/, "a fragment is not a document");
  const svg = renderLifecycleFigure();
  assert.ok(svg.includes(fragment.markup), "the whole figure embeds the fragment unchanged");
  assert.match(svg, /^<svg class="lifecycle" viewBox="0 0 800 480" role="img" aria-label="[^"]+" xmlns="http:\/\/www\.w3\.org\/2000\/svg">/);
  const other = lifecycleFragment({ id: "frame-instance" });
  assert.match(other.markup, /^<g id="frame-instance"/, "a frame may rename the fragment");
  assert.match(other.markup, /marker id="frame-instance-arrow"/, "and every id inside follows, so two fragments share a page without colliding");
  assert.doesNotMatch(other.markup, /unit-lifecycle/);
});

test("ids are stable because they come from the definition: a status per node, a pair of the table per edge, nothing from position or order", () => {
  const first = lifecycleFragment();
  const second = lifecycleFragment();
  assert.deepEqual(first.ids, second.ids, "two renders agree on every id");
  assert.equal(new Set(first.ids).size, first.ids.length, "no id is used twice");
  const pairs = new Set(UNIT_TRANSITIONS.map((t) => `${t.from}-${t.to}`));
  const stateIds = first.ids.filter((id) => id.startsWith("unit-lifecycle-state-")).map((id) => id.slice("unit-lifecycle-state-".length));
  const edgeIds = first.ids.filter((id) => id.startsWith("unit-lifecycle-edge-")).map((id) => id.slice("unit-lifecycle-edge-".length));
  assert.equal(stateIds.length + edgeIds.length, first.ids.length, "every id is a state or an edge");
  assert.deepEqual(new Set(stateIds), new Set(statuses), "the node ids are exactly the statuses");
  assert.deepEqual(new Set(edgeIds), pairs, "the edge ids are exactly the pairs the table joins");
  for (const id of first.ids) assert.match(first.markup, new RegExp(`id="${id}"`), `${id} is on an element`);
  assert.doesNotMatch(first.markup, /id="[^"]*\d{2,}[^"]*"/, "no id carries a coordinate or a counter");
});

test("every node and edge is a hotspot whose card is the table's own words", () => {
  const { markup } = lifecycleFragment({ docsBase: "https://docs.example" });
  const hotspots = markup.match(/<g class="(?:state|edge[^"]*) gl fig-hot"[^>]*>/g) ?? [];
  assert.equal(hotspots.length, statuses.length + new Set(UNIT_TRANSITIONS.map((t) => `${t.from}->${t.to}`)).size, "one hotspot per node and per edge");
  for (const h of hotspots) {
    assert.match(h, /tabindex="0" role="button"/, "focusable, so the keyboard opens the card");
    assert.match(h, /data-label="[^"]+"/);
    assert.match(h, /data-def="[^"]+"/);
    assert.match(h, /data-href="https:\/\/docs\.example\/guide\/control-room#views"/, "the link goes to the page that states the mechanism, under the base the host asked for");
  }
  for (const t of UNIT_TRANSITIONS) {
    const edge = hotspots.find((h) => h.includes(`data-from="${t.from}" data-to="${t.to}"`))!;
    assert.ok(edge, `an edge for ${t.from} → ${t.to}`);
    const def = /data-def="([^"]*)"/.exec(edge)![1]!.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    assert.ok(def.includes(t.description), `the edge's card carries the row's description: ${t.on}`);
    assert.ok(def.includes(`by the loop's ${t.by}`), "and the loop step that takes it");
    if (!t.automatic) assert.ok(def.includes("after a decision outside the loop"), `${t.on} says it waits`);
  }
  const blocked = hotspots.find((h) => h.includes('data-state="blocked"'))!;
  const def = /data-def="([^"]*)"/.exec(blocked)![1]!;
  for (const t of UNIT_TRANSITIONS.filter((t) => t.to === "blocked")) assert.ok(def.includes(t.on), `the node's card names what enters it: ${t.on}`);
  assert.match(def, /Left by/, "and what leaves it");
  assert.match(lifecycleFragment().markup, /data-href="\/guide\/control-room#views"/, "with no base the link is site-relative");
});

test("docs --write files every figure under the name the FIGURES list gives it", async () => {
  assert.deepEqual(FIGURES.map((f) => f.name), ["unit-lifecycle", "instance-map"]);
  const definition = await readDefinition(LAB);
  assert.equal(FIGURES[0]!.render(definition), renderLifecycleFigure());
  assert.equal(FIGURES[1]!.render(definition), renderInstanceMapFigure(definition));
});

test("the one-level map is drawn from the definition: a node per unit type of the workload, the carried files, the loop's steps, the checks the workload names, every store, and nothing hand-placed but the grid", async () => {
  const definition = await readDefinition(LAB);
  const fragment = instanceMapFragment(definition);
  const workload = definition.workloads.find((w) => w.name === "software-development")!;
  assert.match(fragment.markup, /^<g id="instance-map" class="instance-map-fragment" data-viewbox="0 0 720 400" data-workload="software-development">/);
  for (const u of workload.unitTypes) {
    assert.ok(fragment.ids.includes(`instance-map-unit-${u.name}`), `a node for ${u.name}`);
    const profile = definition.profiles.find((p) => p.name === u.profile)!;
    const node = new RegExp(`<g class="unit-type (s1|s4) gl fig-hot" id="instance-map-unit-${u.name}"[^>]*data-unit-type="${u.name}"`).exec(fragment.markup);
    assert.ok(node, `${u.name} is drawn`);
    assert.equal(node![1], profile.tools.includes("report_intelligence") ? "s4" : "s1", `${u.name} is S4 iff its profile reports intelligence`);
    assert.match(fragment.markup, new RegExp(`data-count="units:${u.name}"`), `a count line for ${u.name}, for the control room`);
  }
  for (const store of INSTANCE_STORES) assert.ok(fragment.ids.some((id) => id.startsWith("instance-map-store-") && fragment.markup.includes(`>${store.name}<`)), `a hotspot for ${store.name}`);
  assert.equal(fragment.ids.filter((id) => id.startsWith("instance-map-store-")).length, INSTANCE_STORES.length, "one store hotspot per entry of the closed list");
  const s3 = /<g class="s3 gl fig-hot" id="instance-map-s3"[^>]*data-def="([^"]*)"/.exec(fragment.markup)!;
  for (const step of ENFORCEMENT_POINTS.loop) assert.ok(s3[1]!.includes(step), `the loop's card names ${step}`);
  const checks = new Set(workload.unitTypes.flatMap((u) => u.checks.map((c) => (typeof c === "string" ? c : c.name))));
  const s3star = /<g class="s3star gl fig-hot" id="instance-map-s3star"[^>]*data-def="([^"]*)"/.exec(fragment.markup)!;
  for (const c of checks) assert.ok(s3star[1]!.includes(c), `S3*'s card names ${c}`);
  const s5 = /<g class="s5 gl fig-hot" id="instance-map-s5"[^>]*data-def="([^"]*)"/.exec(fragment.markup)!;
  for (const w of DEFINITION_WRITERS.filter((w) => w.instance)) assert.ok(s5[1]!.includes(w.instance!), `S5's card names ${w.instance}`);
  assert.match(fragment.markup, /id="instance-map-edge-report-intelligence"/, "the research unit's signal edge");
  assert.match(fragment.markup, /id="instance-map-edge-remember"/, "the remember edge");
  assert.doesNotMatch(fragment.markup, /<script/);
});

test("the map's ids are stable and from the definition, every node and edge carries its card, and a workload the definition does not declare is refused", async () => {
  const definition = await readDefinition(LAB);
  const a = instanceMapFragment(definition);
  const b = instanceMapFragment(definition);
  assert.deepEqual(a.ids, b.ids);
  assert.equal(new Set(a.ids).size, a.ids.length);
  assert.doesNotMatch(a.markup, /id="[^"]*\d{2,}[^"]*"/, "no id carries a coordinate or a counter");
  const hotspots = a.markup.match(/<g class="[^"]*\bfig-hot\b[^"]*"[^>]*>/g) ?? [];
  assert.equal(hotspots.length, a.ids.length, "every id is a hotspot");
  for (const h of hotspots) {
    assert.match(h, /tabindex="0" role="button"/);
    assert.match(h, /data-label="[^"]+"/);
    assert.match(h, /data-def="[^"]+"/);
    assert.match(h, /data-href="\/[a-z]/, "a site-relative link by default");
  }
  const other = instanceMapFragment(definition, { id: "frame-instance", docsBase: "https://docs.example", workload: "personal-finance" });
  assert.match(other.markup, /^<g id="frame-instance"[^>]*data-workload="personal-finance"/);
  assert.doesNotMatch(other.markup, /id="instance-map|url\(#instance-map/, "every id and reference follows the frame's prefix");
  assert.match(other.markup, /data-href="https:\/\/docs\.example\/concepts\/identity"/);
  assert.throws(() => instanceMapFragment(definition, { workload: "no-such-workload" }), /declares no workload "no-such-workload"/);
  const svg = renderInstanceMapFigure(definition);
  assert.ok(svg.startsWith(`<svg class="instance-map" viewBox="0 0 720 400" role="img"`));
  assert.ok(svg.includes(a.markup), "the figure is the fragment, wrapped");
});
