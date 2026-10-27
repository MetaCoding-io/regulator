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
import { UNIT_TRANSITIONS, type UnitStatus, type UnitTransition } from "@metacoding.io/regulator-protocol";

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

/** Every figure the generator draws, by the name `regulator docs --write` files it under. */
export const FIGURES: ReadonlyArray<{ name: string; render: (options?: FigureOptions) => string }> = [
  { name: "unit-lifecycle", render: renderLifecycleFigure },
];
