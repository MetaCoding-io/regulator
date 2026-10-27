/**
 * Figures generated from the definition (`docs/research/2026-09-25-open-questions.md` §1):
 * drawn from what the product declares, never by hand, so the control room, the docs
 * and the website show one system. The first figure is the unit lifecycle: one node
 * per `UnitStatus`, one edge per row of `UNIT_TRANSITIONS`, numbered in table order.
 *
 * Every figure comes in two shapes. The *fragment* is a `<g>` with an id, carrying its
 * own `<defs>` under prefixed ids, so a hand-drawn frame can place it beside other
 * things (the thread's third clause, refined 2026-10-26: a figure that spans more than
 * the definition describes embeds the generated part and draws the rest). The *figure*
 * is the fragment wrapped in `<svg>`. Ids are stable because they come from the
 * definition: a node's id is its status, an edge's id is the pair it joins, and nothing
 * is derived from position or render order, so a frame placed on one render still fits
 * the next.
 *
 * The SVG is plain and self-describing: every node carries `data-state`, every edge
 * `data-from`/`data-to`/`data-on`, and the count lines `data-count`, so a page can
 * place live records on it (units per state, a unit's visits, the step it is on)
 * without redrawing anything. Every node and edge is also a hotspot in the shape the
 * docs and the website already open cards on (`class="gl fig-hot"`, `data-label`,
 * `data-def`, `data-href`), with the card text taken from the table's own fields, so a
 * card can never say what the table does not. Colours are CSS variables with
 * fallbacks, so the figure follows whichever theme embeds it; a host's own rules on
 * the classes override them.
 */
import { DEFINITION_WRITERS, ENFORCEMENT_POINTS, INSTANCE_STORES, UNIT_TRANSITIONS, instanceStoreFor, type CapabilityProfile, type RegulatorRecord, type UnitStatus, type UnitTransition, type WorkloadDefinition } from "@metacoding.io/regulator-protocol";
import type { DefinitionView } from "./status.js";

const STATES: ReadonlyArray<{ id: UnitStatus; kind: string; title: string; note: string; x: number; y: number }> = [
  { id: "contracted", kind: "S3 state", title: "Contracted", note: "checked, recorded; no attempt yet", x: 20, y: 30 },
  { id: "dispatched", kind: "S3 state · S1 at work", title: "Dispatched", note: "lease held, worktree open, a session running", x: 300, y: 30 },
  { id: "reported", kind: "S3 state · S3* passed", title: "Reported", note: "checks passed at HEAD; merging", x: 580, y: 30 },
  { id: "aborted", kind: "terminal", title: "Aborted", note: "policy gave up; lease and worktree gone", x: 20, y: 270 },
  { id: "blocked", kind: "S3 state · waits on a decision", title: "Blocked", note: "this attempt did not close", x: 300, y: 270 },
  { id: "closed", kind: "terminal", title: "Closed", note: "landed on the base; lease gone", x: 580, y: 270 },
];
const W = 200;
const H = 130;
const VIEW = { width: 800, height: 480 } as const;

type Point = [number, number];
interface EdgeGeometry { d: string; badge: Point; label?: Point }

/** Where each edge runs, by the pair it joins; several rows of the table may share an edge. */
const GEOMETRY: Readonly<Record<string, EdgeGeometry>> = {
  "contracted->dispatched": line([220, 75], [298, 75]),
  "contracted->blocked": curve([210, 160], [210, 240], [250, 290], [298, 290]),
  "dispatched->reported": line([500, 75], [578, 75]),
  "dispatched->blocked": line([370, 160], [370, 268]),
  "blocked->dispatched": line([430, 268], [430, 162]),
  "reported->closed": line([680, 160], [680, 268]),
  "reported->blocked": curve([600, 160], [600, 225], [470, 215], [470, 268]),
  "blocked->reported": curve([500, 285], [530, 285], [620, 235], [620, 162]),
  "blocked->blocked": curve([360, 400], [360, 450], [440, 450], [440, 400]),
  "blocked->aborted": curve([310, 400], [310, 440], [230, 440], [220, 400]),
};

function line(from: Point, to: Point): EdgeGeometry {
  return { d: `M${from[0]},${from[1]} L${to[0]},${to[1]}`, badge: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2] };
}
function curve(p0: Point, c1: Point, c2: Point, p3: Point): EdgeGeometry {
  // The badge sits at t = 0.5 of the cubic: (P0 + 3·C1 + 3·C2 + P3) / 8.
  return { d: `M${p0[0]},${p0[1]} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p3[0]},${p3[1]}`, badge: [(p0[0] + 3 * c1[0] + 3 * c2[0] + p3[0]) / 8, (p0[1] + 3 * c1[1] + 3 * c2[1] + p3[1]) / 8] };
}

const esc = (v: string): string => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface LifecycleEdge {
  /** 1-based, in table order; the badge on the figure. */
  number: number;
  transition: UnitTransition;
}

/** The edges in the order the figure numbers them: the table's order. */
export function lifecycleEdges(): LifecycleEdge[] {
  return UNIT_TRANSITIONS.map((transition, i) => ({ number: i + 1, transition }));
}

/** A generated figure as a part another figure can place. */
export interface FigureFragment {
  /** The `<g>`'s id; every id inside is prefixed with it. */
  id: string;
  /** `<g id="…" data-viewbox="0 0 w h">…</g>`, with its own `<defs>` inside. */
  markup: string;
  /** The coordinate space the fragment is drawn in. */
  viewBox: { width: number; height: number };
  /** The ids of its nodes and edges, in render order: stable across renders because each comes from the definition. */
  ids: string[];
}

export interface FigureOptions {
  /** The fragment's id and the prefix of every id inside it. */
  id?: string;
  /** Where a hotspot's "In the docs" link points: the docs site's origin, or "" for a site-relative link. */
  docsBase?: string;
}

/** The docs page that states the mechanism, for the hotspots' links. */
const LIFECYCLE_DOC = "/guide/control-room#views";

/** A row of the table in a card's words. */
function rowSentence(e: LifecycleEdge): string {
  return `#${e.number} ${e.transition.on}, by the loop's ${e.transition.by}${e.transition.automatic ? "" : ", after a decision outside the loop"}: ${e.transition.description}.`;
}

/**
 * The unit lifecycle as a fragment. Solid edges the loop takes on its own; dashed ones wait on something outside it
 * (the table's `automatic`). A pair with more than one row shows every number on one edge.
 */
export function lifecycleFragment(options: FigureOptions = {}): FigureFragment {
  const id = options.id ?? "unit-lifecycle";
  const docsBase = options.docsBase ?? "";
  const edges = lifecycleEdges();
  const byPair = new Map<string, LifecycleEdge[]>();
  for (const e of edges) {
    const key = `${e.transition.from}->${e.transition.to}`;
    byPair.set(key, [...(byPair.get(key) ?? []), e]);
  }
  for (const key of byPair.keys()) if (!GEOMETRY[key]) throw new Error(`the lifecycle figure has no geometry for ${key}: UNIT_TRANSITIONS grew a pair the figure does not draw`);
  const ids: string[] = [];
  const href = esc(`${docsBase}${LIFECYCLE_DOC}`);
  const hot = (elementId: string, label: string, def: string): string => {
    ids.push(elementId);
    return `id="${elementId}" tabindex="0" role="button" data-label="${esc(label)}" data-def="${esc(def)}" data-href="${href}"`;
  };
  const parts: string[] = [];
  parts.push(`<g id="${id}" class="lifecycle-fragment" data-viewbox="0 0 ${VIEW.width} ${VIEW.height}">`);
  parts.push(`<defs><marker id="${id}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>`);
  for (const [key, group] of byPair) {
    const g = GEOMETRY[key]!;
    const first = group[0]!.transition;
    const numbers = group.map((e) => e.number);
    const automatic = group.some((e) => e.transition.automatic);
    const label = `${first.from} → ${first.to}`;
    const def = `${group.length === 1 ? "One row" : `${group.length} rows`} of UNIT_TRANSITIONS, ${automatic ? "taken by the loop on its own" : "taken only after a decision outside the loop"}. ${group.map(rowSentence).join(" ")}`;
    parts.push(`<g class="edge${automatic ? "" : " waits"} gl fig-hot" ${hot(`${id}-edge-${first.from}-${first.to}`, label, def)} data-from="${first.from}" data-to="${first.to}" data-on="${esc(group.map((e) => e.transition.on).join(" "))}" data-numbers="${numbers.join(" ")}">`);
    parts.push(`<path d="${g.d}" fill="none" stroke="currentColor" stroke-width="1.4"${automatic ? "" : ' stroke-dasharray="5 4"'} marker-end="url(#${id}-arrow)"/>`);
    parts.push(`<path class="active-path" d="${g.d}" fill="none" stroke="var(--fig-accent, currentColor)" stroke-width="2.6" stroke-dasharray="6 5" opacity="0"/>`);
    parts.push(`<path class="hit" d="${g.d}" fill="none" stroke="transparent" stroke-width="14" pointer-events="stroke"/>`);
    const r = numbers.length > 1 ? 13 : 10;
    parts.push(`<g class="badge" transform="translate(${g.badge[0]},${g.badge[1]})"><circle r="${r}" fill="var(--fig-bg, #fff)" stroke="var(--fig-line, currentColor)" stroke-width="1.2"/><text text-anchor="middle" dominant-baseline="central" font-size="10" font-family="var(--fig-mono, ui-monospace, monospace)" fill="var(--fig-muted, currentColor)">${numbers.join("·")}</text></g>`);
    parts.push(`</g>`);
  }
  for (const s of STATES) {
    const into = edges.filter((e) => e.transition.to === s.id).map((e) => `#${e.number} ${e.transition.on}`);
    const outOf = edges.filter((e) => e.transition.from === s.id).map((e) => `#${e.number} ${e.transition.on}`);
    const def = `${s.kind}: ${s.note}. ${into.length ? `Entered by ${into.join(", ")}.` : "The status a unit starts in."} ${outOf.length ? `Left by ${outOf.join(", ")}.` : "A unit never leaves it."}`;
    parts.push(`<g class="state gl fig-hot" ${hot(`${id}-state-${s.id}`, s.title, def)} data-state="${s.id}" transform="translate(${s.x},${s.y})">`);
    parts.push(`<rect width="${W}" height="${H}" rx="8" fill="var(--fig-bg, #fff)" stroke="var(--fig-line, currentColor)" stroke-width="1.4"/>`);
    parts.push(`<text class="kind" x="14" y="22" font-size="9" letter-spacing=".06em" fill="var(--fig-muted, currentColor)">${esc(s.kind.toUpperCase())}</text>`);
    parts.push(`<text class="title" x="14" y="46" font-size="15" font-weight="600" fill="var(--fig-ink, currentColor)">${esc(s.title)}</text>`);
    parts.push(`<text class="note" x="14" y="64" font-size="10.5" fill="var(--fig-muted, currentColor)">${esc(s.note)}</text>`);
    parts.push(`<text class="count" x="14" y="92" font-size="10.5" font-family="var(--fig-mono, ui-monospace, monospace)" fill="var(--fig-muted, currentColor)" data-count="units:${s.id}"></text>`);
    parts.push(`<text class="count" x="14" y="110" font-size="10.5" font-family="var(--fig-mono, ui-monospace, monospace)" fill="var(--fig-muted, currentColor)" data-count="visits:${s.id}"></text>`);
    parts.push(`</g>`);
  }
  parts.push(`</g>`);
  return { id, markup: parts.join(""), viewBox: { ...VIEW }, ids };
}

/** The unit lifecycle as inline SVG: the fragment, wrapped. */
export function renderLifecycleFigure(options: FigureOptions = {}): string {
  const fragment = lifecycleFragment(options);
  const edges = lifecycleEdges();
  return `<svg class="lifecycle" viewBox="0 0 ${fragment.viewBox.width} ${fragment.viewBox.height}" role="img" aria-label="The unit lifecycle: ${STATES.length} states and ${edges.length} transitions, from UNIT_TRANSITIONS" xmlns="http://www.w3.org/2000/svg">${fragment.markup}</svg>`;
}

// ---------------------------------------------------------------------------------------------------------------
// The one-level map (#153): one regulated level as the definition declares it. Every box is a kind the definition
// has (a writer class, the loop's steps, the workload's unit types, the routing policy, the records of a function,
// the checks a workload names, the stores), every edge an enforcement point or a command, and every card the
// registry record or list entry behind it. The layout grid is the one hand-placed thing.

const MAP_VIEW = { width: 720, height: 400 } as const;

export interface InstanceMapOptions extends FigureOptions {
  /** The workload whose unit types the map draws; `software-development` when the definition declares it, else the first declared. */
  workload?: string;
}

const sentence = (text: string): string => text.split(/(?<=[.;])\s/)[0] ?? text;
const names = (records: readonly RegulatorRecord[]): string => records.map((r) => r.name).join(", ") || "no record";
const slug = (p: string): string => p.replace(/^\.regulator\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

/** A record's enforcement points as plain pairs, whatever list each came from. */
const pointsOf = (r: RegulatorRecord): Array<{ where: string; point: string }> => r.mechanism.enforcementPoints as unknown as Array<{ where: string; point: string }>;
/** The records whose enforcement points name `point` under `where`. */
function recordsAt(records: readonly RegulatorRecord[], where: string, point: string): RegulatorRecord[] {
  return records.filter((r) => pointsOf(r).some((e) => e.where === where && e.point === point));
}

/**
 * The one-level map as a fragment. Unit types are drawn in the workload's order with the ones that report
 * intelligence last, so the edge to the router is short; a type reports intelligence when its profile grants the tool.
 */
export function instanceMapFragment(definition: DefinitionView, options: InstanceMapOptions = {}): FigureFragment {
  const id = options.id ?? "instance-map";
  const docsBase = options.docsBase ?? "";
  const records = definition.registry.records;
  const workload: WorkloadDefinition | undefined = options.workload
    ? definition.workloads.find((w) => w.name === options.workload)
    : definition.workloads.find((w) => w.name === "software-development") ?? definition.workloads[0];
  if (!workload) throw new Error(options.workload ? `the definition declares no workload "${options.workload}"` : "the definition declares no workload");
  const profile = (name: string): CapabilityProfile | undefined => definition.profiles.find((p) => p.name === name);
  const grants = (name: string, tool: string): boolean => profile(name)?.tools.includes(tool) ?? false;
  const unitTypes = [...workload.unitTypes].sort((a, b) => Number(grants(a.profile, "report_intelligence")) - Number(grants(b.profile, "report_intelligence")));
  const ids: string[] = [];
  const href = (page: string): string => esc(`${docsBase}/${page}`);
  const hot = (elementId: string, label: string, def: string, page: string): string => {
    ids.push(elementId);
    return `id="${elementId}" tabindex="0" role="button" data-label="${esc(label)}" data-def="${esc(def)}" data-href="${href(page)}"`;
  };
  const box = (x: number, y: number, w: number, h: number): string => `data-box="${x} ${y} ${w} ${h}"`;
  const parts: string[] = [];
  const AR = `url(#${id}-arrow)`;
  parts.push(`<g id="${id}" class="instance-map-fragment" data-viewbox="0 0 ${MAP_VIEW.width} ${MAP_VIEW.height}" data-workload="${esc(workload.name)}">`);
  parts.push(`<defs><marker id="${id}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>`);
  const edge = (elementId: string, label: string, def: string, page: string, d: string, text: { x: number; y: number; s: string; anchor?: string }, dashed = false): void => {
    parts.push(`<g class="edge${dashed ? " waits" : ""} gl fig-hot" ${hot(elementId, label, def, page)}>`);
    parts.push(`<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.3"${dashed ? ' stroke-dasharray="5 4"' : ""} marker-end="${AR}"/>`);
    parts.push(`<path class="hit" d="${d}" fill="none" stroke="transparent" stroke-width="14" pointer-events="stroke"/>`);
    parts.push(`<text x="${text.x}" y="${text.y}" font-size="9" fill="var(--fig-muted, currentColor)"${text.anchor ? ` text-anchor="${text.anchor}"` : ""}>${esc(text.s)}</text>`);
    parts.push(`</g>`);
  };
  const node = (elementId: string, cls: string, label: string, def: string, page: string, x: number, y: number, w: number, h: number, lines: Array<{ s: string; bold?: boolean; mono?: boolean; muted?: boolean; size?: number; dx?: number }>, extra = "", rx = 4): void => {
    parts.push(`<g class="${cls} gl fig-hot" ${hot(elementId, label, def, page)} ${box(x, y, w, h)}${extra}>`);
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="var(--fig-bg, #fff)" stroke="var(--fig-line, currentColor)" stroke-width="1.2"/>`);
    let ty = y + 15;
    for (const l of lines) {
      parts.push(`<text x="${x + 8 + (l.dx ?? 0)}" y="${ty}" font-size="${l.size ?? 10.5}"${l.bold ? ' font-weight="600"' : ""}${l.mono ? ' font-family="var(--fig-mono, ui-monospace, monospace)"' : ""} fill="${l.muted ? "var(--fig-muted, currentColor)" : "var(--fig-ink, currentColor)"}">${esc(l.s)}</text>`);
      ty += (l.size ?? 10.5) + 3;
    }
    parts.push(`</g>`);
  };

  // ---- S5: the writer classes the instance carries, and the gates on them ----
  const carried = DEFINITION_WRITERS.filter((w) => w.instance);
  const s5Gates = records.filter((r) => r.vsmFunction === "S5" && (r.scope?.resources ?? []).some((res) => carried.some((w) => res === w.instance)));
  node(`${id}-s5`, "s5", "S5: the files the instance carries from the definition",
    `${carried.map((w) => `${w.class}: seeded from ${w.seed.join(", ")} into ${w.instance}, accepted by \`${w.acceptedBy}\`${w.promotedBy ? `, carried back by \`${w.promotedBy}\`` : ""}`).join("; ")}. Protected by ${names(s5Gates)}.`,
    "concepts/identity", 10, 10, 300, 46,
    [{ s: `S5  ${carried.map((w) => w.class).join(" · ")} files, write-protected`, bold: true }, { s: carried.map((w) => w.instance).join(" · "), mono: true, muted: true, size: 9.5 }]);
  // ---- a person ----
  const people = definition.interaction.flatMap((p) => p.people.filter((x) => x.actAsS5).map((x) => x.name));
  const commands = carried.map((w) => w.acceptedBy);
  node(`${id}-person`, "person", "A person acting as S5",
    `${people.length ? `${people.join(", ")} may act as S5 under the interaction policy` : "nobody in the interaction policy may act as S5"}; the only writer of a carried file, through ${commands.map((c) => `\`${c}\``).join(" and ")}. Rejecting changes nothing.`,
    "concepts/asking-a-person", 350, 10, 170, 46, [{ s: "a person", bold: true, dx: 44 }, { s: "actAsS5", mono: true, muted: true, size: 9.5, dx: 48 }], "", 23);
  edge(`${id}-edge-accept`, commands.join(" · "), `The authority check, then the write: ${commands.map((c) => `\`${c}\``).join(" and ")} are the only writers of the instance's carried files (${names(records.filter((r) => pointsOf(r).some((e) => e.where === "cli" && commands.includes(e.point))))}).`,
    "concepts/identity#the-only-way-to-change-identity", "M350,33 L312,33", { x: 331, y: 27, s: "accept", anchor: "middle" });
  // ---- the router ----
  const routing = definition.routing[0];
  const routerRecords = records.filter((r) => pointsOf(r).some((e) => e.where === "loop" && (e.point === "routeUnit" || e.point === "closeUnit")) && /router|veto/.test(r.id));
  node(`${id}-router`, "router", "The router: a signal becomes an obligation",
    routing ? `${routing.name} v${routing.version}: ${routing.rules.length} rule(s) saying what each message kind opens and for whom (${routing.rules.map((r) => `${r.kind} → ${r.consumer} at ${r.minSeverity}`).join("; ")}); an open obligation at or above ${routing.blocksAtOrAbove} vetoes the unit; ${(routing.floors ?? []).length} severity floor(s). Mechanism: ${names(routerRecords)}.` : "no routing policy is declared.",
    "concepts/obligations", 560, 10, 150, 46,
    [{ s: "router → obligations", bold: true }, { s: routing ? `veto ≥ ${routing.blocksAtOrAbove} · ${routing.rules.length} rules` : "no routing policy", muted: true, size: 9.5 }]);
  // ---- S3: the loop ----
  const steps = ENFORCEMENT_POINTS.loop;
  const stepCounts = steps.map((st) => `${st} (${recordsAt(records, "loop", st).length})`);
  node(`${id}-s3`, "s3", "S3: the loop",
    `The orchestrator's steps, as ENFORCEMENT_POINTS.loop declares them, with the number of regulators that bite at each: ${stepCounts.join(", ")}. The loop never edits code; it dispatches a session under a contract and a budget, verifies with host-run checks, routes by the recovery policy and closes on the ledger.`,
    "concepts/control-plane#the-loop", 10, 80, 700, 40,
    [{ s: "S3  the loop", bold: true }, { s: steps.join(" · "), mono: true, muted: true, size: 8.5 }]);
  edge(`${id}-edge-veto`, "obligation holds the unit", `An open obligation at or above the routing policy's line, naming a unit, vetoes that unit's dispatch and close until a consumer dispositions it (${names(records.filter((r) => /progression-veto|pause-gate/.test(r.id)))}).`,
    "concepts/obligations", "M635,56 L635,78", { x: 641, y: 70, s: "veto" });
  // ---- the unit types ----
  const rowX = 10, rowW = 560, gap = 8, n = unitTypes.length;
  const uw = (rowW - gap * (n - 1)) / n;
  const centres = new Map<string, number>();
  unitTypes.forEach((u, i) => {
    const x = rowX + i * (uw + gap);
    centres.set(u.name, x + uw / 2);
    const p = profile(u.profile);
    const s4 = grants(u.profile, "report_intelligence");
    const checks = u.checks.map((c) => (typeof c === "string" ? c : c.name));
    const def = `${u.description} Runs under the \`${u.profile}\` profile${p ? ` (${p.tools.length} tools${p.writablePaths.length ? `, writes under ${p.writablePaths.join(", ")}` : ", read-only by effect"})` : ""}${u.requiresContract ? ", under a work contract" : ", without a contract"}${checks.length ? `; verified by ${checks.join(", ")}` : "; no host check"}. ${s4 ? "It reports intelligence, so it is S4 at this level." : "It touches the repository, so it is S1."}`;
    node(`${id}-unit-${u.name}`, `unit-type ${s4 ? "s4" : "s1"}`, `${s4 ? "S4" : "S1"}: ${u.name}`, def, "guide/authoring-a-workload", x, 150, uw, 50,
      [{ s: `${s4 ? "S4" : "S1"}  ${u.name}`, bold: true }, { s: u.profile, mono: true, muted: true, size: 9.5 }], ` data-unit-type="${esc(u.name)}"`);
    parts.splice(parts.length - 1, 0, `<text class="count" x="${x + 8}" y="${150 + 44}" font-size="9" font-family="var(--fig-mono, ui-monospace, monospace)" fill="var(--fig-muted, currentColor)" data-count="units:${esc(u.name)}"></text>`);
  });
  edge(`${id}-edge-dispatch`, "dispatch", `The loop's runUnit: a unit starts as an attempt under its profile's grant, its budget ceilings and a lease on its worktree. Regulators at runUnit: ${names(recordsAt(records, "loop", "runUnit"))}.`,
    "guide/running-units", unitTypes.map((u) => `M${centres.get(u.name)},122 L${centres.get(u.name)},148`).join(" "), { x: (centres.get(unitTypes[0]!.name) ?? 0) + 6, y: 140, s: "dispatch" });
  const s4Types = unitTypes.filter((u) => grants(u.profile, "report_intelligence"));
  if (s4Types.length) {
    const last = s4Types[s4Types.length - 1]!;
    const xr = rowX + (n - 1) * (uw + gap) + uw;
    edge(`${id}-edge-report-intelligence`, "report_intelligence", `The typed tool ${s4Types.map((u) => u.name).join(", ")} report(s) with; the signal lands in the regulatory log and goes to the router, never straight to a unit. Mechanism: ${names(recordsAt(records, "tool", "report_intelligence"))}.`,
      "concepts/intelligence-and-memory#intelligence", `M${xr + 2},175 L598,175`, { x: (xr + 600) / 2, y: 167, s: "signal", anchor: "middle" });
    void last;
  }
  node(`${id}-router-slot`, "router-slot", "The router, at the units' level", routing ? `Where a signal from a unit arrives: the routing policy ${routing.name} opens an obligation for the consumer it names, or notes the message as trace.` : "no routing policy is declared.",
    "concepts/obligations", 600, 150, 110, 50, [{ s: "→ obligations", bold: true }, { s: "routed by policy", muted: true, size: 9.5 }]);
  edge(`${id}-edge-obligations-up`, "obligations", "An obligation opened on a unit is read back by the loop at its next step: the veto, the recovery decision, the person's answer.", "concepts/obligations", "M655,148 L655,122", { x: 661, y: 138, s: "owed" });
  // ---- S2 ----
  const s2 = records.filter((r) => r.vsmFunction === "S2");
  parts.push(`<g class="s2 gl fig-hot" ${hot(`${id}-s2`, "S2: coordination", `Damping between units, as mechanism, with no coordinator persona: ${s2.map((r) => `${r.name} (${r.absorbs.failureClass})`).join("; ")}.`, "concepts/coordination")}>`);
  parts.push(`<text x="10" y="216" font-size="9.5" fill="var(--fig-muted, currentColor)">S2: ${esc(s2.map((r) => r.name.toLowerCase()).join(" · ") || "no S2 record")}</text>`);
  parts.push(`</g>`);
  // ---- S3*: the host checks the workload names ----
  const checksNamed = [...new Set(unitTypes.flatMap((u) => u.checks.map((c) => (typeof c === "string" ? c : c.name))))];
  const hostCheckRecords = recordsAt(records, "loop", "runHostChecks");
  node(`${id}-s3star`, "s3star", "S3*: host checks at the revision",
    `The host runs the checks itself at the unit's revision and the closeout gate reads that evidence, never the unit's claim. This workload names ${checksNamed.join(", ") || "no check"}. Regulators at runHostChecks and auditUnit: ${names([...new Set([...hostCheckRecords, ...recordsAt(records, "loop", "auditUnit")])])}.`,
    "reference/host-checks", 10, 250, 455, checksNamed.length > 4 ? 58 : 46,
    [{ s: "S3*  host checks at the revision → evidence → closeout gate", bold: true }, { s: checksNamed.slice(0, 4).join(" · ") || "no host check named", mono: true, muted: true, size: 9 }, ...(checksNamed.length > 4 ? [{ s: checksNamed.slice(4).join(" · "), mono: true, muted: true, size: 9 }] : [])]);
  edge(`${id}-edge-branch`, "branch at HEAD", `What S3* verifies is the unit's branch at the revision it reported, so the evidence is tied to a commit, not a transcript (${names(records.filter((r) => /closeout-gate/.test(r.id)))}).`,
    "reference/host-checks", `M${centres.get(unitTypes[0]!.name)},202 L${centres.get(unitTypes[0]!.name)},248`, { x: (centres.get(unitTypes[0]!.name) ?? 0) + 6, y: 240, s: "branch at HEAD" });
  // ---- operational memory ----
  const memoryStore = INSTANCE_STORES.find((s) => s.name === "operational memory")!;
  node(`${id}-memory`, "memory", "Operational memory",
    `${memoryStore.description}; ${sentence(records.find((r) => /memory-store/.test(r.id))?.purpose ?? "facts for later units")}`,
    "concepts/intelligence-and-memory#operational-memory", 480, 250, 120, 46,
    [{ s: "operational memory", bold: true }, { s: memoryStore.path, mono: true, muted: true, size: 9 }]);
  const remembering = unitTypes.filter((u) => grants(u.profile, "remember"));
  if (remembering.length) {
    const cx = centres.get(remembering[0]!.name)!;
    edge(`${id}-edge-remember`, "remember", `The tool ${remembering.map((u) => u.name).join(", ")} record(s) a fact with: provenance, scope and an expiry; a fact is never identity (${names(recordsAt(records, "tool", "remember"))}).`,
      "concepts/intelligence-and-memory#operational-memory", `M${cx + 24},202 L${cx + 24},236 L540,236 L540,248`, { x: cx + 30, y: 233, s: "remember" }, true);
  }
  // ---- the units' way to a person: propose_policy_change and ask_human ----
  const personTools = (["propose_policy_change", "ask_human"] as const).filter((t) => unitTypes.some((u) => grants(u.profile, t)));
  if (personTools.length) {
    edge(`${id}-edge-person-tools`, personTools.join(" · "), `${personTools.map((t) => `\`${t}\` (${unitTypes.filter((u) => grants(u.profile, t)).map((u) => u.name).join(", ")}; ${names(recordsAt(records, "tool", t))})`).join("; ")}: each opens an obligation owed to a person and changes nothing by itself.`,
      "concepts/asking-a-person", "M550,202 L550,210 L716,210 L716,68 L435,68 L435,58", { x: 712, y: 206, s: personTools.join(" · "), anchor: "end" }, true);
  }
  // ---- the records ----
  const writers = (store: string): RegulatorRecord[] => records.filter((r) => (r.scope?.resources ?? []).some((res) => instanceStoreFor(res)?.path === store));
  node(`${id}-records`, "records", "The records",
    `${INSTANCE_STORES.length} paths under .regulator/, a closed list (INSTANCE_STORES): ${INSTANCE_STORES.filter((s) => s.kind === "record").length} records, ${INSTANCE_STORES.filter((s) => s.kind === "workspace").length} workspaces and the manifest. Written by the host from inside the loop and the session's gates, never by a unit directly; read by status, the control room, the eval harness and a person.`,
    "reference/instance", 10, 320, 700, 70, [{ s: "RECORDS  .regulator/, append-only", bold: true }]);
  INSTANCE_STORES.forEach((store, i) => {
    const col = i % 5, row = Math.floor(i / 5);
    const w = writers(store.path);
    parts.push(`<g class="store gl fig-hot" ${hot(`${id}-store-${slug(store.path)}`, store.name, `${store.path}: ${store.description}. ${w.length ? `Claimed by ${names(w)}.` : "No registry record claims it as a resource."}`, "reference/instance")}>`);
    parts.push(`<text x="${20 + col * 138}" y="${346 + row * 16}" font-size="9.5" fill="var(--fig-${store.kind === "workspace" ? "muted" : "ink"}, currentColor)">${esc(store.name)}</text>`);
    parts.push(`</g>`);
  });
  edge(`${id}-edge-writes`, "the host writes", `Every store is written by the host: the loop's steps and the session's gates append to the records, a unit writes only in its worktree. ${records.filter((r) => (r.scope?.resources ?? []).some((res) => res.startsWith(".regulator/"))).length} records claim a store as a resource.`,
    "reference/instance", "M230,298 L230,318", { x: 236, y: 312, s: "writes" });
  parts.push(`</g>`);
  return { id, markup: parts.join(""), viewBox: { ...MAP_VIEW }, ids };
}

/** The one-level map as inline SVG: the fragment, wrapped. */
export function renderInstanceMapFigure(definition: DefinitionView, options: InstanceMapOptions = {}): string {
  const fragment = instanceMapFragment(definition, options);
  return `<svg class="instance-map" viewBox="0 0 ${fragment.viewBox.width} ${fragment.viewBox.height}" role="img" aria-label="One regulated level, drawn from the definition: the carried files and their gates, a person as their only writer, the loop's steps, the workload's unit types under their profiles, the router, the coordination mechanisms, the host checks, operational memory and the records the host writes" xmlns="http://www.w3.org/2000/svg">${fragment.markup}</svg>`;
}

/** Every figure the generator draws, by the name `regulator docs --write` files it under. */
export const FIGURES: ReadonlyArray<{ name: string; render: (definition: DefinitionView, options?: FigureOptions) => string }> = [
  { name: "unit-lifecycle", render: (_definition, options) => renderLifecycleFigure(options) },
  { name: "instance-map", render: (definition, options) => renderInstanceMapFigure(definition, options) },
];
