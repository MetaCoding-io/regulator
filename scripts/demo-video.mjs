#!/usr/bin/env node
/**
 * Records the regulator demo video from the product as it is: the control room over the household ledger, captioned.
 *
 *   pnpm build && node scripts/demo-video.mjs                       writes regulator-demo.mp4 in the current directory
 *   node scripts/demo-video.mjs --out ~/Videos/regulator-demo.mp4   somewhere else
 *   node scripts/demo-video.mjs --keep                              keeps the instances and the raw frames, and says where
 *
 * The story is two units of the ledger workload. f1-ingest, run carelessly: the agent reports that its checks pass, the
 * host runs them itself, finds a failing test and a protected bank statement edited, and refuses closeout; the repair
 * hint routes a second attempt, which closes. f5-prepare-payment, run as its contract asks: before writing a payment it
 * asks a person, nobody answers, and the unit waits. Every frame is the control room rendering the same instances
 * `scripts/screenshots.mjs` builds (scripts/instances.mjs), so the video cannot show something the product does not do.
 *
 * Needs the packages built, Playwright with a Chromium it can launch (resolved from NODE_PATH or a global install, as
 * for the screenshots), and ffmpeg on the PATH. Nothing here runs a model. Frames come from Chromium's screencast at
 * 1920×1080 and are encoded to H.264 at 30 fps.
 */
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

import { buildInstances, ROOT, serveControlRoom } from "./instances.mjs";

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(`--${name}`); return i === -1 ? undefined : args[i + 1]; };
const OUT = path.resolve(flag("out") ?? "regulator-demo.mp4");
const KEEP = args.includes("--keep");
const W = 1920, H = 1080;

let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)("playwright"));
} catch {
  console.error("this script needs Playwright (`playwright`, with a Chromium it can launch); it is not a dependency of this repository. Install it globally, or point NODE_PATH at an install.");
  process.exit(2);
}

// ---- the overlay: title cards, captions, a spotlight and a cursor, drawn above the page -------------------------------

const OVERLAY_CSS = `
  html, body { overflow: hidden !important; }
  header { position: static !important; }
  /* the recording is one column, narrower than a desk: the camera can come closer, so the text reads at phone size */
  aside#inspector { display: none !important; }
  main { grid-template-columns: minmax(0, 1fr) !important; max-width: 980px !important; }
  #stepper .why { font-size: 17px; line-height: 1.45; }
  #stepper .why li { margin: 5px 0; }
  body { transform-origin: 0 0; transition: transform 1.3s cubic-bezier(.45,0,.2,1); will-change: transform; }
  #demo-layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; font-family: Inter, "Segoe UI", system-ui, -apple-system, sans-serif; }
  #demo-card { position: absolute; inset: 0; background: #0f172a; color: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px; text-align: center; padding: 0 160px; opacity: 1; transition: opacity .7s ease; }
  #demo-card.off { opacity: 0; }
  #demo-card .big { font-size: 68px; font-weight: 700; line-height: 1.15; letter-spacing: -.01em; }
  #demo-card .mid { font-size: 44px; font-weight: 500; color: #fbbf24; }
  #demo-card .small { font-size: 32px; color: #cbd5e1; line-height: 1.5; }
  #demo-card .url { font-size: 38px; font-weight: 600; color: #f8fafc; margin-top: 12px; }
  #demo-cap { position: absolute; left: 50%; bottom: 56px; transform: translateX(-50%) translateY(12px); max-width: 1560px; padding: 22px 38px; border-radius: 14px; background: rgba(15,23,42,.92); color: #f8fafc; font-size: 44px; font-weight: 600; line-height: 1.25; text-align: center; opacity: 0; transition: opacity .45s ease, transform .45s ease; box-shadow: 0 10px 40px rgba(0,0,0,.25); }
  #demo-cap.on { opacity: 1; transform: translateX(-50%) translateY(0); }
  #demo-cap em { font-style: normal; color: #fbbf24; }
  #demo-hl { position: absolute; border: 5px solid #f59e0b; border-radius: 10px; box-shadow: 0 0 0 9999px rgba(15,23,42,.38); opacity: 0; transition: opacity .4s ease, left .6s ease, top .6s ease, width .6s ease, height .6s ease; }
  #demo-hl.on { opacity: 1; }
  #demo-cursor { position: absolute; width: 34px; height: 34px; left: ${W / 2}px; top: ${H + 40}px; transition: left .8s cubic-bezier(.45,0,.2,1), top .8s cubic-bezier(.45,0,.2,1), transform .12s ease; filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
  #demo-cursor.press { transform: scale(.82); }
`;

const CURSOR_SVG = `<svg viewBox="0 0 24 24" width="34" height="34"><path d="M4 2 L4 20 L9 15.5 L12.5 22.5 L15.5 21 L12 14 L19 14 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

/** Puts the overlay on a freshly loaded page, a title card up so the load itself is never seen. */
async function dress(page, root) {
  await page.addStyleTag({ content: OVERLAY_CSS });
  await page.evaluate(({ cursor }) => {
    const layer = document.createElement("div");
    layer.id = "demo-layer";
    layer.innerHTML = `<div id="demo-hl"></div><div id="demo-cap"></div><div id="demo-cursor">${cursor}</div><div id="demo-card"></div>`;
    document.documentElement.appendChild(layer);   // outside <body>, so the camera's transform does not move it
    window.__cam = { tx: 0, ty: 0, s: 1 };
  }, { cursor: CURSOR_SVG });
  // The page refreshes every five seconds; a shot wants it held.
  await page.evaluate(() => { for (const b of document.querySelectorAll("button")) if (/pause refresh/.test(b.textContent ?? "")) b.click(); document.activeElement?.blur(); window.scrollTo(0, 0); });
  await tidy(page, root);
}

/** The instances live under a temporary directory named for this machine; the video shows them under a home. */
const tidy = (page, root) => page.evaluate(({ root, repo }) => {
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (n.nodeValue.includes(root)) n.nodeValue = n.nodeValue.split(root).join("/home/alice");
    if (n.nodeValue.includes(repo)) n.nodeValue = n.nodeValue.split(repo).join("/home/alice/regulator");
  }
}, { root, repo: ROOT.replace(/\/$/, "") });

/** Spans of wall-clock time (screencast timestamps are seconds since the epoch) whose frames are left out. */
const cuts = [];

function director(page, root) {
  const wait = (ms) => page.waitForTimeout(ms);
  return {
    wait,
    /** A full-screen card; `html` is its content, or nothing to lift it. */
    async card(html, { hold = 0 } = {}) {
      await page.evaluate((html) => {
        const c = document.getElementById("demo-card");
        if (html === null) c.classList.add("off"); else { c.innerHTML = html; c.classList.remove("off"); }
      }, html);
      await wait(800 + hold);
    },
    async caption(html, hold = 0) {
      await page.evaluate((html) => {
        const c = document.getElementById("demo-cap");
        if (!html) { c.classList.remove("on"); return; }
        c.classList.remove("on");
        setTimeout(() => { c.innerHTML = html; c.classList.add("on"); }, c.textContent ? 250 : 0);
      }, html);
      await wait(700 + hold);
    },
    /**
     * Frames the camera on an element: scales the page so the element fills `fill` of the frame (capped at `max`), and
     * centres it, leaving room for the caption underneath. `selector` may be a CSS selector or a function source run in
     * the page that returns an element.
     */
    async frame(target, { fill = 0.86, max = 2.2, min = 0.5, top = 0.5 } = {}) {
      await page.evaluate(({ target, fill, max, min, top, W, H }) => {
        const el = target.startsWith("=>") ? new Function("return (" + target.slice(2) + ")()")() : document.querySelector(target);
        if (!el) throw new Error("frame: nothing at " + target);
        // a focused button scrolls the page under the camera; the camera's sums assume it never moves
        window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0;
        const cam = window.__cam, r = el.getBoundingClientRect();
        // back to untransformed page coordinates
        const x = (r.left - cam.tx) / cam.s, y = (r.top - cam.ty) / cam.s, w = r.width / cam.s, h = r.height / cam.s;
        const usable = H - 230;                                   // the caption band at the bottom
        const s = Math.max(min, Math.min(max, (W * fill) / w, (usable * fill) / h));
        const tx = (W - w * s) / 2 - x * s;
        const ty = Math.min(usable - h * s, Math.max(40, (usable - h * s) * top)) - y * s;
        Object.assign(cam, { tx, ty, s });
        document.body.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
      }, { target: typeof target === "function" ? "=>" + target.toString() : target, fill, max, min, top, W, H });
      await wait(1400);
    },
    /** The spotlight on an element (same targets as `frame`), or off. */
    async spot(target, pad = 10) {
      await page.evaluate(({ target, pad }) => {
        const hl = document.getElementById("demo-hl");
        if (!target) { hl.classList.remove("on"); return; }
        const el = target.startsWith("=>") ? new Function("return (" + target.slice(2) + ")()")() : document.querySelector(target);
        if (!el) throw new Error("spot: nothing at " + target);
        const r = el.getBoundingClientRect();
        Object.assign(hl.style, { left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + 2 * pad + "px", height: r.height + 2 * pad + "px" });
        hl.classList.add("on");
      }, { target: target ? (typeof target === "function" ? "=>" + target.toString() : target) : null, pad });
      await wait(600);
    },
    /** Moves the cursor to a control and presses it. */
    async click(selector) {
      const box = await page.evaluate((selector) => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, selector);
      await page.evaluate(({ x, y }) => Object.assign(document.getElementById("demo-cursor").style, { left: x - 6 + "px", top: y - 4 + "px" }), box);
      await wait(950);
      await page.evaluate(() => document.getElementById("demo-cursor").classList.add("press"));
      await wait(140);
      await page.evaluate((selector) => { const b = document.querySelector(selector); b.click(); b.blur(); window.scrollTo(0, 0); }, selector);
      await page.evaluate(() => document.getElementById("demo-cursor").classList.remove("press"));
      await tidy(page, root);
      await wait(500);
    },
    async cursorAway() {
      await page.evaluate(({ W, H }) => Object.assign(document.getElementById("demo-cursor").style, { left: W - 120 + "px", top: H + 60 + "px" }), { W, H });
    },
    /** Loads the control room on a unit's first step, behind a card. */
    async open(url, cardHtml) {
      const from = Date.now() / 1000;
      await page.goto(url);
      await page.reload();
      await page.waitForFunction(() => document.querySelector("#stepper .why") && document.querySelector("#instances h3"), null, { timeout: 20_000 });
      await dress(page, root);
      await page.evaluate((html) => { document.getElementById("demo-card").innerHTML = html; }, cardHtml);
      await wait(300);
      // the reload paints a bare page before the card is back: the frames in between are cut, and the card before holds
      cuts.push([from, Date.now() / 1000]);
    },
  };
}

/** The `li` in the step's "why" list whose text starts with `text`. */
/** The lifecycle figure and the step bar under it, as one region. */
const figure = () => { const a = document.querySelector("svg.lifecycle"), b = document.querySelector("#stepper .stepper"); return { getBoundingClientRect() { const p = a.getBoundingClientRect(), q = b.getBoundingClientRect(); return { left: Math.min(p.left, q.left), top: p.top, width: Math.max(p.right, q.right) - Math.min(p.left, q.left), height: q.bottom - p.top }; } }; };

const why = (text) => new Function(`return () => [...document.querySelectorAll("#stepper .why li")].find((l) => l.textContent.trim().startsWith(${JSON.stringify(text)}))`)();

// ---- the story -------------------------------------------------------------------------------------------------------

const OPENING = `<div class="big">An AI agent is closing your household books.</div><div class="mid">What stops it from cheating?</div>`;

async function story(d, base) {
  // 1. the question (the page is already loaded behind this card when the recording starts)
  await d.wait(3000);

  // 2. the careless run's units: f1 took two attempts
  await d.frame(() => { const hs = [...document.querySelectorAll("#instances > h3")]; const h = hs.find((e) => /household-ledger-careless$/.test(e.textContent.trim())); let n = h.nextElementSibling; while (n && n.tagName !== "TABLE") n = n.nextElementSibling; return n; }, { fill: 0.96, max: 1.9 });
  await d.card(null);
  await d.spot(() => [...document.querySelectorAll("#instances tr")].filter((r) => /f1-ingest/.test(r.textContent)).at(-1));
  await d.caption("Unit f1: import the August bank statement into the ledger.", 1300);
  await d.caption("It <em>closed</em> — but it took <em>two attempts</em>. Here's why.", 1500);
  await d.spot(null);

  // 3. attempt 1, stepped on the lifecycle
  await d.caption("");
  await d.frame(figure, { fill: 0.96, max: 2 });
  await d.click("#stepper [data-step=next]");
  await d.caption("Attempt 1: the agent does the work and reports <em>all checks pass</em>.", 900);
  await d.click("#stepper [data-step=next]");
  await d.caption("The harness doesn't take its word for it. It runs the checks itself.", 1200);
  await d.cursorAway();
  await d.frame("#stepper .why", { fill: 0.94, max: 1.9, top: 0.2 });
  await d.spot(why("e-ledger-checks (test)"));
  await d.caption("One test fails: <em>the ledger doesn't balance</em> against the statement.", 1900);
  await d.spot(why("e-checks (command): identity-untouched"));
  await d.caption("And the agent had <em>edited the bank statement</em> — a protected file.", 2300);
  await d.spot(why("report cites test evidence"));
  await d.caption("Its report claimed otherwise. <em>Closeout refused.</em>", 1900);
  await d.spot(null);

  // 4. the refusal holds the unit, and is routed to a repair
  await d.caption("");
  await d.frame(figure, { fill: 0.96, max: 2 });
  await d.click("#stepper [data-step=next]");
  await d.caption("The refusal opens a <em>blocking obligation</em>: nothing moves until it's dealt with.", 2000);
  await d.click("#stepper [data-step=next]");
  await d.cursorAway();
  await d.frame("#stepper .why", { fill: 0.94, max: 1.9, top: 0.2 });
  await d.spot(why("hint for the next attempt"));
  await d.caption("The loop sends it back with the evidence: <em>the checks decide, not the report.</em>", 2400);
  await d.spot(null);

  // 5. attempt 2, step by step, to the close
  await d.caption("");
  await d.frame(figure, { fill: 0.96, max: 2 });
  await d.click("#stepper [data-step=next]");
  await d.caption("With a repair routed, the obligation is resolved and <em>the veto lifts</em>.", 1700);
  await d.click("#stepper [data-step=next]");
  await d.caption("Attempt 2 starts — and the agent is <em>told exactly what failed</em>.", 1900);
  await d.click("#stepper [data-step=next]");
  await d.cursorAway();
  await d.frame("#stepper .why", { fill: 0.94, max: 1.9, top: 0.2 });
  await d.spot(why("satisfied:"));
  await d.caption("This time the harness runs the checks again, and <em>they pass</em>.", 2200);
  await d.spot(null);
  await d.caption("");
  await d.frame(figure, { fill: 0.96, max: 2 });
  await d.click("#stepper [data-step=next]");
  await d.cursorAway();
  await d.caption("The branch lands on the ledger. Attempt 2: <em>closed</em>.", 2000);

  // 6. the payment waits on a person
  await d.card(`<div class="big">Now the agent wants to pay the rent.</div>`, { hold: 600 });
  await d.open(base + "#unit=0/f5-prepare-payment@2", `<div class="big">Now the agent wants to pay the rent.</div>`);
  await d.frame(figure, { fill: 0.96, max: 2 });
  await d.card(null);
  await d.caption("Unit f5: prepare the September rent payment.", 1000);
  await d.click("#stepper [data-step=next]");
  await d.cursorAway();
  await d.frame("#stepper .why", { fill: 0.94, max: 1.9, top: 0.2 });
  await d.spot(why("question:"));
  await d.caption("Before moving money, it <em>has to ask a person</em>.", 2100);
  await d.spot(why("interaction at blocking"));
  await d.caption("The open question is a <em>veto</em>: nothing dispatches or closes past it.", 2200);
  await d.spot(null);
  await d.caption("");
  await d.frame(figure, { fill: 0.96, max: 2 });
  await d.click("#stepper [data-step=next]");
  await d.cursorAway();
  await d.caption("Nobody answered. <em>No answer, no payment</em> — the unit waits.", 2200);

  // 7. the line, and where to find it
  await d.caption("");
  await d.card(`<div class="big">Prompts advise. Types describe.<br>Gates enforce.</div>`, { hold: 1800 });
  await d.card(`<div class="big" style="font-size:60px">regulator</div><div class="small">an open-source agent harness with a cybernetic control plane</div><div class="mid" style="margin-top:20px">Viable Agents</div><div class="small">the course that builds it, lesson by lesson</div><div class="url">metacoding.io</div>`, { hold: 3800 });
}

// ---- the recording ---------------------------------------------------------------------------------------------------

/** Chromium's screencast: a JPEG each time the page paints, with its timestamp. */
async function screencast(page) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    frames.push({ data, t: metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  return { frames, stop: async () => { const end = Date.now() / 1000; await cdp.send("Page.stopScreencast"); return end; } };
}

function run(argv) {
  return new Promise((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${argv[0]} exited ${code}: ${err.slice(-800)}`))));
  });
}

/** The frames, each held until the next one, to a constant-rate H.264 file. */
async function encode(frames, end, dir, out) {
  // A repaint between two story beats can land before the card lifts; only frames from the first card on count.
  const lines = ["ffconcat version 1.0"];
  for (let i = 0; i < frames.length; i++) {
    const name = `f${String(i).padStart(5, "0")}.jpg`;
    await writeFile(path.join(dir, name), Buffer.from(frames[i].data, "base64"));
    const next = i + 1 < frames.length ? frames[i + 1].t : end;
    lines.push(`file ${name}`, `duration ${Math.max(0.001, next - frames[i].t).toFixed(4)}`);
  }
  lines.push(`file f${String(frames.length - 1).padStart(5, "0")}.jpg`);   // the concat demuxer drops the last duration otherwise
  await writeFile(path.join(dir, "frames.ffconcat"), lines.join("\n") + "\n");
  await mkdir(path.dirname(out), { recursive: true });
  await run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(dir, "frames.ffconcat"),
    "-vf", `scale=${W}:${H}:flags=lanczos,format=yuv420p`, "-r", "30", "-fps_mode", "cfr",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-movflags", "+faststart", out]);
}

const root = await mkdtemp(path.join(tmpdir(), "regulator-demo-"));
let room, browser;
try {
  console.log("building the instances …");
  const [ledger, careless] = await buildInstances(root);
  room = await serveControlRoom([ledger, careless]);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: "light" });
  const d = director(page, root);
  // The first load happens before the screencast starts, so the video opens on the title card, not a blank page.
  await d.open(room.url + "#unit=1/f1-ingest@1", OPENING);
  cuts.length = 0;                                   // that load happened before the recording; nothing to cut
  console.log("recording …");
  const cast = await screencast(page);
  await story(d, room.url);
  const end = await cast.stop();
  const frames = cast.frames.filter((f, i) => (i === 0 || f.t > cast.frames[i - 1].t) && !cuts.some(([a, b]) => f.t >= a && f.t <= b));
  console.log(`${frames.length} frames over ${(end - frames[0].t).toFixed(1)}s; encoding …`);
  const raw = path.join(root, "frames");
  await mkdir(raw, { recursive: true });
  await encode(frames, end, raw, OUT);
  console.log(`wrote ${path.relative(process.cwd(), OUT) || OUT}`);
} finally {
  await browser?.close();
  room?.stop();
  if (KEEP) console.log(`instances and frames kept under ${root}`); else await rm(root, { recursive: true, force: true });
}
