/**
 * Cards for a figure's hotspots. A generated figure marks each component and edge as
 * `<g class="gl fig-hot" tabindex="0" role="button" data-label data-def data-href>`,
 * carrying its own card, so the explanation lives in the figure like its labels do and
 * this file holds only the behaviour: hover or focus shows the card, a tap toggles it,
 * Escape closes it, and the link goes to the page that states the mechanism. This is
 * the website's glossary popover, ported, so a reader meets one behaviour on both.
 */
type Mode = "hover" | "focus" | "tap";
let pop: HTMLDivElement | null = null;
let openEl: Element | null = null;
let mode: Mode = "tap";

function ensurePop(): HTMLDivElement {
  if (pop) return pop;
  pop = document.createElement("div");
  pop.className = "fig-pop";
  pop.id = "fig-pop-live";
  pop.setAttribute("role", "tooltip");
  pop.hidden = true;
  document.body.appendChild(pop);
  return pop;
}

function closePop(): void {
  if (!pop) return;
  pop.hidden = true;
  if (openEl) {
    openEl.setAttribute("aria-expanded", "false");
    openEl.removeAttribute("aria-describedby");
  }
  openEl = null;
}

function openPop(el: Element, how: Mode = "tap"): void {
  const def = el.getAttribute("data-def");
  if (!def) return;
  const p = ensurePop();
  if (openEl === el && how === "tap") { closePop(); return; }
  mode = how;
  const label = el.getAttribute("data-label") ?? el.getAttribute("aria-label") ?? "";
  const href = el.getAttribute("data-href");
  // The card text is authored in the figure's generator, not taken from a reader.
  p.innerHTML =
    `<div class="fig-pop-term">${label}</div><div class="fig-pop-def">${def}</div>` +
    (href ? `<a class="fig-pop-more" href="${href}">In the docs →</a>` : "");
  p.hidden = false;
  el.setAttribute("aria-expanded", "true");
  el.setAttribute("aria-describedby", p.id);
  openEl = el;

  const r = el.getBoundingClientRect();
  const pw = Math.min(320, window.innerWidth - 24);
  p.style.width = `${pw}px`;
  let left = r.left + window.scrollX;
  left = Math.max(12 + window.scrollX, Math.min(left, window.scrollX + window.innerWidth - pw - 12));
  p.style.left = `${left}px`;
  const ph = p.offsetHeight || 90;
  const spaceBelow = window.innerHeight - r.bottom;
  p.style.top = spaceBelow < ph + 16 && r.top > ph + 16
    ? `${r.top + window.scrollY - ph - 8}px`
    : `${r.bottom + window.scrollY + 8}px`;
}

const hot = (t: EventTarget | null): Element | null =>
  t instanceof Element ? t.closest(".fig-hot") : null;

let installed = false;

/** Installs the document-level handlers once; idempotent across client navigations. */
export function installFigureTooltips(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;

  document.addEventListener("click", (e) => {
    const el = hot(e.target);
    if (el) { e.preventDefault(); openPop(el); return; }
    if (pop && !pop.hidden && !(e.target instanceof Element && e.target.closest(".fig-pop"))) closePop();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closePop(); return; }
    const el = hot(e.target);
    if (el && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openPop(el); }
  });
  // Keyboard: a focused hotspot shows its card; leaving it closes the card. Focusing
  // may scroll the page, so a scroll closes only a hovered card (the card is positioned
  // on the document and stays with its element).
  document.addEventListener("focusin", (e) => {
    const el = hot(e.target);
    if (el && openEl !== el) openPop(el, "focus");
  });
  document.addEventListener("focusout", (e) => {
    if (openEl && mode === "focus" && hot(e.target) === openEl && !(e.relatedTarget instanceof Node && pop?.contains(e.relatedTarget))) closePop();
  });
  window.addEventListener("resize", closePop);
  window.addEventListener("scroll", () => { if (mode === "hover") closePop(); }, { passive: true });

  if (window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) {
    document.addEventListener("mouseover", (e) => {
      const el = hot(e.target);
      if (el && openEl !== el) openPop(el, "hover");
    });
    document.addEventListener("mouseout", (e) => {
      if (!openEl || mode !== "hover") return;
      const to = e.relatedTarget;
      if (to instanceof Node && (openEl.contains(to) || pop?.contains(to))) return;
      if (hot(e.target) === openEl) closePop();
    });
    document.addEventListener("mouseleave", (e) => {
      if (e.target === pop && mode === "hover") closePop();
    }, true);
  }
}
