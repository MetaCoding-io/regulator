/**
 * Figures generated from the definition (`docs/research/2026-09-25-open-questions.md` §1):
 * drawn from what the product declares, never by hand, so the control room, the docs
 * and the website show one system. The first figure is the unit lifecycle: one node
 * per `UnitStatus`, one edge per row of `UNIT_TRANSITIONS`, numbered in table order.
 *
 * The SVG is plain and self-describing: every node carries `data-state`, every edge
 * `data-from`/`data-to`/`data-on`, and the count lines `data-count`, so a page can
 * place live records on it (units per state, a unit's visits, the step it is on)
 * without redrawing anything. Colours are CSS variables with fallbacks, so the figure
 * follows whichever theme embeds it.
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

/**
 * The unit lifecycle as inline SVG. Solid edges the loop takes on its own; dashed ones wait on something outside it
 * (the table's `automatic`). A pair with more than one row shows every number on one edge.
 */
export function renderLifecycleFigure(): string {
  const edges = lifecycleEdges();
  const byPair = new Map<string, LifecycleEdge[]>();
  for (const e of edges) {
    const key = `${e.transition.from}->${e.transition.to}`;
    byPair.set(key, [...(byPair.get(key) ?? []), e]);
  }
  for (const key of byPair.keys()) if (!GEOMETRY[key]) throw new Error(`the lifecycle figure has no geometry for ${key}: UNIT_TRANSITIONS grew a pair the figure does not draw`);
  const parts: string[] = [];
  parts.push(`<svg class="lifecycle" viewBox="0 0 800 480" role="img" aria-label="The unit lifecycle: ${STATES.length} states and ${edges.length} transitions, from UNIT_TRANSITIONS" xmlns="http://www.w3.org/2000/svg">`);
  parts.push(`<defs><marker id="lc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>`);
  for (const [key, group] of byPair) {
    const g = GEOMETRY[key]!;
    const first = group[0]!.transition;
    const numbers = group.map((e) => e.number);
    const automatic = group.some((e) => e.transition.automatic);
    parts.push(`<g class="edge${automatic ? "" : " waits"}" data-from="${first.from}" data-to="${first.to}" data-on="${esc(group.map((e) => e.transition.on).join(" "))}" data-numbers="${numbers.join(" ")}">`);
    parts.push(`<path d="${g.d}" fill="none" stroke="currentColor" stroke-width="1.4"${automatic ? "" : ' stroke-dasharray="5 4"'} marker-end="url(#lc-arrow)"/>`);
    parts.push(`<path class="active-path" d="${g.d}" fill="none" stroke-width="2.6" stroke-dasharray="6 5"/>`);
    const r = numbers.length > 1 ? 13 : 10;
    parts.push(`<g class="badge" transform="translate(${g.badge[0]},${g.badge[1]})"><circle r="${r}"/><text text-anchor="middle" dominant-baseline="central">${numbers.join("·")}</text></g>`);
    parts.push(`</g>`);
  }
  for (const s of STATES) {
    parts.push(`<g class="state" data-state="${s.id}" transform="translate(${s.x},${s.y})">`);
    parts.push(`<rect width="${W}" height="${H}" rx="8"/>`);
    parts.push(`<text class="kind" x="14" y="22">${esc(s.kind.toUpperCase())}</text>`);
    parts.push(`<text class="title" x="14" y="46">${esc(s.title)}</text>`);
    parts.push(`<text class="note" x="14" y="64">${esc(s.note)}</text>`);
    parts.push(`<text class="count" x="14" y="92" data-count="units:${s.id}"></text>`);
    parts.push(`<text class="count" x="14" y="110" data-count="visits:${s.id}"></text>`);
    parts.push(`</g>`);
  }
  parts.push(`</svg>`);
  return parts.join("");
}
