#!/usr/bin/env node
/**
 * Retakes every screenshot the docs and the website carry, from the product as it is.
 *
 *   pnpm build && node scripts/screenshots.mjs                          the docs' images, into docs/
 *   node scripts/screenshots.mjs --website ../regulator-website         the website's as well, into its site/img/control-room/
 *   node scripts/screenshots.mjs --only instances-ledger,spans          some of them
 *   node scripts/screenshots.mjs --list                                 what it takes and where each goes
 *
 * A screenshot is a second copy of what the control room renders, and nothing compared the two: in November the
 * September images still said 42 regulators. This script is the one way an image here is made. It builds the instances
 * the images show with the same scripted behaviours the tests drive (the household ledger closed as its contracts ask
 * and paused on its consent question; the ledger and the portfolio run carelessly; the September portfolio close; a
 * drifter under the drift suite's treatment arm), serves the control room over them, and captures each image by name.
 *
 * It needs the packages built (`pnpm build`) and Playwright with a Chromium it can launch: `playwright` is not a
 * dependency of this repository, so it is resolved from wherever Node finds it (a global install, or NODE_PATH).
 * Nothing here runs a model. The instances are built under a temporary directory and removed afterwards (`--keep`
 * leaves them and prints where); an image shows that directory as `/home/alice`, so a retake on another machine is the
 * same image.
 */
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = path.join(ROOT, "packages", "regulator", "dist");
const LAB = path.join(ROOT, "packages", "regulator");
const DOCS = path.join(ROOT, "docs");

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(`--${name}`); return i === -1 ? undefined : args[i + 1]; };
const WEBSITE = flag("website") ? path.resolve(flag("website"), "site", "img", "control-room") : undefined;
const ONLY = flag("only")?.split(",");
const KEEP = args.includes("--keep");

/** Every image: its name, where it goes (docs paths under docs/, website names under site/img/control-room/), and how it is taken. */
const SHOTS = [
  // the control room as it opens: the definition's topology, and the inspector on the closeout gate's record
  { name: "overview", docs: ["guide/img/control-room-overview.webp"], site: ["overview.webp"], take: (c) => c.viewport("#reg=reg.audit.closeout-gate.v1", 1280, 780) },
  // the household ledger, closed as its contracts ask and paused on its one consent question
  { name: "instances-ledger", docs: ["examples/img/instances-ledger.webp"], site: ["instances-ledger.webp"], take: (c) => c.range("", "#instances", { from: /^definition regulator at /, index: 0, through: "Operational memory" }) },
  { name: "consent-paused", docs: ["concepts/img/consent-paused.webp"], take: (c) => c.range("", "#instances", { from: /^Obligations — /, index: 0, through: "Interactions" }) },
  { name: "inspector-unit-f5", docs: ["examples/img/inspector-unit-f5.webp"], site: ["inspector-unit-f5.webp"], take: (c) => c.inspector("#unit=0/f5-prepare-payment") },
  { name: "map", docs: ["guide/img/control-room-map.webp"], site: ["map.webp"], take: (c) => c.element("#unit=0/f1-ingest", "#map") },
  // the ledger run carelessly: f1 refused, repaired, closed
  { name: "inspector-unit-f1", docs: ["examples/img/inspector-unit-f1.webp"], site: ["inspector-unit-f1.webp"], take: (c) => c.inspector("#unit=1/f1-ingest") },
  { name: "lifecycle-f1", docs: ["examples/img/lifecycle-f1.webp"], site: ["lifecycle-f1.webp"], take: (c) => c.element("#unit=1/f1-ingest@3", "#lifecycle") },
  // the definition view's parts
  { name: "workloads", site: ["workloads.webp"], take: (c) => c.range("", "#definition", { from: /^Workloads$/, through: "Workloads" }) },
  { name: "profiles", site: ["profiles.webp"], take: (c) => c.range("", "#definition", { from: /^Profiles — /, through: "Profiles" }) },
  { name: "assurance", docs: ["concepts/img/assurance-live-report.webp"], take: (c) => c.range("", "#definition", { from: /^drift v1 · 2026-11-08/, throughTag: "TABLE" }) },
  // the September portfolio close, as its contracts ask, and the same close run carelessly
  { name: "portfolio-units", docs: ["examples/img/portfolio-units.webp"], site: ["portfolio-units.webp"], take: (c) => c.table("", 2, 0) },
  { name: "portfolio-consent", docs: ["examples/img/portfolio-consent.webp"], site: ["portfolio-consent.webp"], take: (c) => c.table("", 2, 3) },
  { name: "portfolio-units-careless", docs: ["examples/img/portfolio-units-careless.webp"], site: ["portfolio-units-careless.webp"], take: (c) => c.table("", 3, 0) },
  // `regulator spans` on the drifter under the treatment arm, as a terminal
  { name: "spans", docs: ["guide/img/spans.webp"], take: (c) => c.spans() },
];

if (args.includes("--list")) {
  for (const s of SHOTS) console.log(`${s.name.padEnd(26)} ${[...(s.docs ?? []).map((d) => `docs/${d}`), ...(s.site ?? []).map((d) => `<website>/site/img/control-room/${d}`)].join("  ")}`);
  process.exit(0);
}

const unknown = (ONLY ?? []).filter((n) => !SHOTS.some((s) => s.name === n));
if (unknown.length) { console.error(`no such screenshot: ${unknown.join(", ")} (see --list)`); process.exit(2); }

let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)("playwright"));
} catch {
  console.error("this script needs Playwright (`playwright`, with a Chromium it can launch); it is not a dependency of this repository. Install it globally, or point NODE_PATH at an install.");
  process.exit(2);
}

const dist = (file) => import(pathToFileURL(path.join(DIST, file)).href).catch(() => { console.error(`${path.join("packages/regulator/dist", file)} is missing: run \`pnpm build\` first`); process.exit(2); });

// ---- the instances ---------------------------------------------------------------------------------------------------

// A commit needs an author; the tests rely on the machine's git config, and a clean machine has none.
for (const [k, v] of Object.entries({ GIT_AUTHOR_NAME: "alice", GIT_AUTHOR_EMAIL: "alice@example.com", GIT_COMMITTER_NAME: "alice", GIT_COMMITTER_EMAIL: "alice@example.com" })) process.env[k] ??= v;

const { driveUnit } = await dist("controller.js");
const { loadContract } = await dist("contract-file.js");
const { gitExec } = await dist("git-support.js");
const { initInstance } = await dist("instance.js");
const { loadInteractionPolicy } = await dist("interaction-policy.js");
const { loadPolicy } = await dist("policy.js");
const { loadRecoveryPolicy } = await dist("recovery-policy.js");
const { loadRoutingPolicy } = await dist("routing-policy.js");
const { loadWorkloadFor } = await dist("workload.js");
const { financeDispatcher } = await dist("finance-scripted.js");
const { portfolioDispatcher } = await dist("portfolio-scripted.js");
const { ObligationLedger, dispositionForAnswer } = await import("@metacoding.io/regulator-core").catch(() => import(pathToFileURL(path.join(ROOT, "packages", "core", "dist", "index.js")).href));

/** A fixture as a repository of its own, initialized as an instance with the layout its worked example declares. */
async function instance(dir, fixture, message, layout, clock) {
  await mkdir(dir, { recursive: true });
  await cp(path.join(LAB, fixture), dir, { recursive: true });
  for (const a of [["init", "--quiet", "-b", "main"], ["add", "-A"], ["-c", "commit.gpgsign=false", "commit", "--quiet", "-m", message]]) {
    const r = await gitExec("git", a, { cwd: dir });
    if (r.code !== 0) throw new Error(`git ${a.join(" ")} in ${dir}: ${r.stderr}`);
  }
  await initInstance(gitExec, { repo: dir, ...layout, by: "alice", now: clock });
  return dir;
}

/** Drives units of one workload under one scripted behaviour, in order, as the tests do. */
async function close(repo, { workload, policy, contracts, dispatcherFor }, behaviour, unitIds, clock) {
  const interaction = await loadInteractionPolicy();
  const policyPath = path.join(LAB, "policies", policy);
  const base = { repo, workload: await loadWorkloadFor(workload), policy: await loadPolicy(policyPath), policyPath, recovery: await loadRecoveryPolicy(), routing: await loadRoutingPolicy(), interaction, owner: "alice", now: clock };
  const dispatcher = dispatcherFor(gitExec, { behaviour, repo, interaction, now: clock });
  const out = [];
  for (const unitId of unitIds) out.push((await driveUnit(gitExec, { ...base, contract: await loadContract(path.join(LAB, "contracts", contracts, `${unitId}.json`)), dispatcher })).final);
  return out;
}

/** A person answers yes to the one open consent question on a unit. */
async function consent(repo, unitId, clock) {
  const ledger = new ObligationLedger(repo, clock);
  const [o] = (await ledger.open(unitId)).filter((x) => x.concern === "interaction");
  if (!o) throw new Error(`${unitId}: no consent question is open`);
  const request = (await ledger.interactions()).find((i) => i.request.obligationId === o.id);
  await ledger.answerInteraction({ requestId: request.request.id, outcome: "answered", answer: "yes", by: "alice", channel: "cli" });
  await ledger.resolve(o.id, { by: "alice", disposition: dispositionForAnswer("consent", "yes"), rationale: "yes" });
}

const expect = (finals, statuses, what) => {
  const got = finals.map((f) => f.status);
  if (got.join() !== statuses.join()) throw new Error(`${what}: expected ${statuses.join(", ")} and the units ended ${got.join(", ")}; the scripted behaviours have changed, and so must this script`);
};

const FINANCE = { workload: "personal-finance", policy: "finance.json", contracts: "finance", dispatcherFor: financeDispatcher };
const FINANCE_LAYOUT = { writablePaths: ["ledger/", "reports/", "payments/pending/"], protectedPaths: ["statements/", "payments/executed/"] };
const PORTFOLIO = { workload: "portfolio", policy: "portfolio.json", contracts: "portfolio", dispatcherFor: portfolioDispatcher };
const PORTFOLIO_LAYOUT = { writablePaths: ["lots/", "targets/", "trades/proposed/", "reports/"], protectedPaths: ["positions/", "prices/", "trades/executed/"] };

async function buildInstances(root) {
  let tick = Date.parse("2026-09-23T09:00:00.000Z");
  const clock = () => (tick += 1000);

  // 0: the August close as the contracts ask; the payment asks for consent, nobody answers, and the unit is paused.
  const ledger = await instance(path.join(root, "household-ledger"), "fixture-finance", "the ledger as of the July close", FINANCE_LAYOUT, clock);
  expect(await close(ledger, FINANCE, "bookkeeper", ["f1-ingest", "f2-categorize", "f3-reconcile", "f4-report", "f5-prepare-payment"], clock), ["closed", "closed", "closed", "closed", "blocked"], "the ledger");

  // 1: the careless close: the statement edited and a category invented, each refused and repaired.
  const careless = await instance(path.join(root, "household-ledger-careless"), "fixture-finance", "the ledger as of the July close", FINANCE_LAYOUT, clock);
  expect(await close(careless, FINANCE, "careless", ["f1-ingest", "f2-categorize"], clock), ["closed", "closed"], "the careless ledger");

  // 2: the September portfolio close: two programs, two consent questions answered yes, the review.
  tick = Date.parse("2026-10-01T09:00:00.000Z");
  const portfolio = await instance(path.join(root, "managed-portfolio"), "fixture-portfolio", "the portfolio as of the August close", PORTFOLIO_LAYOUT, clock);
  expect(await close(portfolio, PORTFOLIO, "manager", ["p1-ingest-positions", "p2-propose-target", "p3-plan-rebalance", "p4-confirm-trades"], clock), ["closed", "closed", "closed", "blocked"], "the portfolio, to the first question");
  await consent(portfolio, "p4-confirm-trades", clock);
  expect(await close(portfolio, PORTFOLIO, "manager", ["p4-confirm-trades", "p5-harvest-losses", "p6-plan-harvest", "p7-confirm-harvest"], clock), ["closed", "closed", "closed", "blocked"], "the portfolio, to the second question");
  await consent(portfolio, "p7-confirm-harvest", clock);
  expect(await close(portfolio, PORTFOLIO, "manager", ["p7-confirm-harvest", "p8-review"], clock), ["closed", "closed"], "the portfolio, to the review");

  // 3: the same close run carelessly: the trade placed without asking is refused; the harvest that buys back what it sells is refused and repaired.
  const hasty = await instance(path.join(root, "managed-portfolio-careless"), "fixture-portfolio", "the portfolio as of the August close", PORTFOLIO_LAYOUT, clock);
  expect(await close(hasty, PORTFOLIO, "careless", ["p1-ingest-positions", "p2-propose-target", "p3-plan-rebalance", "p4-confirm-trades"], clock), ["closed", "closed", "closed", "blocked"], "the careless portfolio, to the question");
  await consent(hasty, "p4-confirm-trades", clock);
  expect(await close(hasty, PORTFOLIO, "careless", ["p4-confirm-trades", "p5-harvest-losses", "p6-plan-harvest"], clock), ["closed", "closed", "closed"], "the careless portfolio, to the harvest");

  return [ledger, careless, portfolio, hasty];
}

/** Runs a command to its end; resolves with its stdout, rejects with its stderr on a non-zero exit. */
function run(argv, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${argv.join(" ")} exited ${code}: ${err.slice(-600)}`))));
  });
}

/** The drifter under the treatment arm, kept: where `regulator spans` has something to say. */
async function driftInstance(root) {
  const dir = path.join(root, "eval");
  await mkdir(dir, { recursive: true });
  const cli = path.join(DIST, "cli.js");
  await run([process.execPath, cli, "eval", path.join(LAB, "evals", "drift.json"), "--behaviour", "drifter", "--arm", "treatment", "--reps", "1", "--keep", "--out", path.join(dir, "report.json")], { cwd: dir, env: { ...process.env, TMPDIR: dir } });
  const { readdir } = await import("node:fs/promises");
  const kept = (await readdir(dir)).find((d) => d.startsWith("regulator-eval-treatment-"));
  if (!kept) throw new Error("the eval kept no treatment instance");
  return path.join(dir, kept, "instance");
}

// ---- the camera -----------------------------------------------------------------------------------------------------

const freePort = () => new Promise((resolve, reject) => { const s = createServer(); s.unref(); s.on("error", reject); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

async function serveControlRoom(instances) {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(ROOT, "packages", "control-room", "dist", "cli.js"), "--definition", LAB, ...instances.flatMap((i) => ["--instance", i]), "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    let said = "";
    const fail = setTimeout(() => reject(new Error(`the control room did not start: ${said}`)), 20_000);
    child.stdout.on("data", (d) => { said += d; if (said.includes("control room")) { clearTimeout(fail); resolve(); } });
    child.stderr.on("data", (d) => (said += d));
    child.on("exit", (code) => reject(new Error(`the control room exited ${code}: ${said}`)));
  });
  return { url: `http://127.0.0.1:${port}/`, stop: () => child.kill() };
}

/** What a shot may ask for. Every method returns a PNG buffer at twice the CSS size. */
function camera(browser, base, spansFrom, root) {
  // The instances live under a temporary directory whose name is this machine's; an image shows them under a home.
  const home = (page) => page.evaluate((root) => {
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.nodeValue.includes(root)) n.nodeValue = n.nodeValue.split(root).join("/home/alice");
  }, root).then(() => page.evaluate((repo) => {
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.nodeValue.includes(repo)) n.nodeValue = n.nodeValue.split(repo).join("/home/alice/regulator");
  }, ROOT.replace(/\/$/, "")));
  // The page refreshes every five seconds and its header is sticky; a capture wants neither. The inspector scrolls
  // inside the viewport; a capture wants all of it.
  const still = "header { position: static !important; } aside { position: static !important; max-height: none !important; overflow: visible !important; }";
  const open = async (hash, width, height = 1000) => {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: "light" });
    await page.goto(base + hash);
    await page.waitForFunction(() => document.querySelector("#instances h3") && document.querySelector("#definition h3"), null, { timeout: 20_000 });
    await page.evaluate(() => { for (const b of document.querySelectorAll("button")) if (/pause refresh/.test(b.textContent ?? "")) b.click(); });
    await page.addStyleTag({ content: still });
    await page.waitForTimeout(400);
    await home(page);
    return page;
  };
  // A region of the page, given a function that measures it in page coordinates. The viewport is first made as tall as
  // the region, since a capture cannot reach outside it; that moves whatever is sized by the viewport's height, so the
  // region is measured again afterwards, scrolled to, and captured in the viewport's own coordinates.
  const clip = async (page, measure, pad = 10) => {
    const first = await measure();
    if (!first) return undefined;
    const { width } = page.viewportSize();
    await page.setViewportSize({ width, height: Math.ceil(first.height + 2 * pad) + 40 });
    await page.waitForTimeout(300);
    const box = await measure();
    await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, box.y - pad - 10));
    await page.waitForTimeout(150);
    const scrolled = await page.evaluate(() => ({ y: window.scrollY, width: document.documentElement.clientWidth }));
    const x = Math.max(0, box.x - pad);
    return page.screenshot({ clip: { x, y: box.y - pad - scrolled.y, width: Math.min(box.width + 2 * pad, scrolled.width - x), height: box.height + 2 * pad } });
  };
  return {
    /** The window as a person sees it on opening. */
    async viewport(hash, width, height) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: "light" });
      await page.goto(base + hash);
      await page.waitForFunction(() => document.querySelector("#definition h3") && document.querySelector("#inspector h2")?.textContent !== "Inspector", null, { timeout: 20_000 });
      await page.waitForTimeout(600);
      await home(page);
      const png = await page.screenshot();
      await page.close();
      return png;
    },
    /** One whole section. */
    async element(hash, selector, width = 1500) {
      const page = await open(hash, width);
      const png = await clip(page, () => page.evaluate((selector) => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height };
      }, selector), 0);
      await page.close();
      return png;
    },
    /** The inspector on a unit, laid out at full width, down to the end of its audit section or 1,700 CSS pixels, whichever is first: the record is long, and an image is for its shape. */
    async inspector(hash) {
      const page = await open(hash, 900);
      const png = await clip(page, () => page.evaluate(() => {
        const sections = [...document.querySelectorAll("#inspector > section")];
        const last = sections.find((s) => /^Audit/i.test(s.querySelector("h2")?.textContent ?? "")) ?? sections.at(-1);
        const a = sections[0].getBoundingClientRect(), z = last.getBoundingClientRect();
        return { x: a.left + scrollX, y: a.top + scrollY, width: a.width, height: Math.min(z.bottom - a.top, 1700) };
      }));
      await page.close();
      return png;
    },
    /** Part of a section: from the child whose text matches `from` (the `index`-th such child) through the last child before the next heading that does not start with `through`, or through the next `throughTag`. */
    async range(hash, selector, { from, index = 0, through, throughTag }) {
      const page = await open(hash, 1500);
      const png = await clip(page, () => page.evaluate(({ selector, source, index, through, throughTag }) => {
        const kids = [...document.querySelector(selector).children];
        const text = (e) => (e.textContent ?? "").trim().replace(/\s+/g, " ");
        const starts = kids.map((e, i) => (new RegExp(source).test(text(e)) ? i : -1)).filter((i) => i !== -1);
        const start = starts[index];
        if (start === undefined) return undefined;
        let end = start;
        if (throughTag) { end = kids.findIndex((e, i) => i > start && e.tagName === throughTag); }
        else {
          // run on to the last element before the first heading after the `through` heading's own block
          let seen = text(kids[start]).startsWith(through);
          for (let i = start + 1; i < kids.length; i++) {
            const heading = /^H[23]$/.test(kids[i].tagName);
            if (heading && seen && !text(kids[i]).startsWith(through)) break;
            if (heading && text(kids[i]).startsWith(through)) seen = true;
            if (heading && /^\//.test(text(kids[i]))) break;   // the next instance
            end = i;
          }
        }
        if (end < start) return undefined;
        const rects = kids.slice(start, end + 1).map((e) => e.getBoundingClientRect());
        const left = Math.min(...rects.map((r) => r.left)), right = Math.max(...rects.map((r) => r.right));
        return { x: left + scrollX, y: rects[0].top + scrollY, width: right - left, height: rects.at(-1).bottom - rects[0].top };
      }, { selector, source: from.source, index, through, throughTag }));
      if (!png) throw new Error(`nothing under ${selector} matches ${from}: the control room's page has changed, and so must this script`);
      await page.close();
      return png;
    },
    /** One table of an instance: the `nth` table under the `instance`-th instance heading. */
    async table(hash, instance, nth) {
      const page = await open(hash, 1500);
      const png = await clip(page, () => page.evaluate(({ instance, nth }) => {
        const kids = [...document.querySelector("#instances").children];
        const heads = kids.map((e, i) => (e.tagName === "H3" && /^\//.test((e.textContent ?? "").trim()) ? i : -1)).filter((i) => i !== -1);
        const start = heads[instance];
        if (start === undefined) return undefined;
        const tables = kids.slice(start, heads[instance + 1] ?? kids.length).filter((e) => e.tagName === "TABLE");
        const r = tables[nth]?.getBoundingClientRect();
        return r ? { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height } : undefined;
      }, { instance, nth }), 0);
      if (!png) throw new Error(`instance ${instance} has no table ${nth}: the control room's page has changed, and so must this script`);
      await page.close();
      return png;
    },
    /** `regulator spans` on the first unit's first attempt and the start of its second, and one span as JSON, drawn as a terminal. */
    async spans() {
      const cli = path.join(DIST, "cli.js");
      const listing = (await run([process.execPath, cli, "spans"], { cwd: spansFrom })).split("\n");
      const second = listing.findIndex((l, i) => i > 1 && /invoke_agent/.test(l));
      const shown = listing.slice(0, second + 2);
      const all = (await run([process.execPath, cli, "spans", "--json"], { cwd: spansFrom })).split("\n").filter(Boolean).map((l) => JSON.parse(l));
      const span = all.find((s) => /^execute_tool export-signature/.test(s.name) && s.status === "error");
      if (!span) throw new Error("no failing export-signature span: the drifter no longer changes the signature, and so must this script");
      const keep = ["gen_ai.operation.name", "gen_ai.tool.name", "vsm.system", "vsm.regulator.id", "vsm.unit.id", "vsm.attempt", "vsm.evidence.verdict", "vsm.revision", "observation"];
      const trimmed = { name: span.name, status: span.status, attributes: Object.fromEntries(keep.filter((k) => k in span.attributes).map((k) => [k, span.attributes[k]])) };
      const units = listing.filter((l) => /^\S+\s+unit /.test(l)).map((l) => /unit (\S+)/.exec(l)[1]);
      const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
      const line = (l) => esc(l).replace(/(\s)(ok)(\s)/, '$1<span class="ok">$2</span>$3').replace(/(\s)(error)(\s)/, '$1<span class="err">$2</span>$3');
      const html = `<!doctype html><meta charset="utf-8"><style>
        body { margin: 0; background: #0d1117; font: 15px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #c9d1d9; }
        .bar { background: #161b22; padding: 9px 14px; color: #8b949e; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 13px; }
        .bar i { display: inline-block; width: 11px; height: 11px; border-radius: 50%; background: #30363d; margin-right: 7px; }
        pre { margin: 0; padding: 14px 18px; white-space: pre; } hr { border: 0; border-top: 1px solid #30363d; margin: 0; }
        .p { color: #7ee787; } .ok { color: #7ee787; } .err { color: #ff7b72; } .dim { color: #6e7681; }
      </style><div id="term" style="width:1000px">
        <div class="bar"><i></i><i></i><i></i> a scripted drift run, treatment arm: unit ${esc(units[0] ?? "")}</div>
        <pre><span class="p">$</span> regulator spans\n${shown.map(line).join("\n")}\n<span class="dim">  … the rest of this attempt, and the next, refused the same way; then units ${esc(units.slice(1, 2).join(""))}–${esc(units.at(-1) ?? "")}</span></pre>
        <hr><pre><span class="p">$</span> regulator spans --json <span class="dim"># one span, attributes trimmed</span>\n${esc(JSON.stringify(trimmed, null, 2))}</pre>
      </div>`;
      const page = await browser.newPage({ viewport: { width: 1040, height: 800 }, deviceScaleFactor: 2 });
      await page.setContent(html);
      const png = await page.locator("#term").screenshot();
      await page.close();
      return png;
    },
  };
}

/** PNG to WebP, by the browser that took it: no image library is a dependency here. */
async function toWebp(browser, png) {
  const page = await browser.newPage();
  const data = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = Object.assign(document.createElement("canvas"), { width: img.naturalWidth, height: img.naturalHeight });
    canvas.getContext("2d").drawImage(img, 0, 0);
    return canvas.toDataURL("image/webp", 0.9).split(",")[1];
  }, png.toString("base64"));
  await page.close();
  return Buffer.from(data, "base64");
}

// ---- run -------------------------------------------------------------------------------------------------------------

const wanted = SHOTS.filter((s) => !ONLY || ONLY.includes(s.name));
const root = await mkdtemp(path.join(tmpdir(), "regulator-screenshots-"));
let room, browser;
try {
  console.log("building the instances …");
  const instances = await buildInstances(root);
  const drift = wanted.some((s) => s.name === "spans") ? await driftInstance(root) : undefined;
  room = await serveControlRoom(instances);
  browser = await chromium.launch();
  const cam = camera(browser, room.url, drift, root);
  for (const shot of wanted) {
    const webp = await toWebp(browser, await shot.take(cam));
    const targets = [...(shot.docs ?? []).map((d) => path.join(DOCS, d)), ...(WEBSITE ? (shot.site ?? []).map((d) => path.join(WEBSITE, d)) : [])];
    for (const target of targets) { await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, webp); }
    console.log(`${shot.name.padEnd(26)} ${Math.round(webp.length / 1024)} KB  ${targets.map((t) => path.relative(process.cwd(), t)).join("  ") || "(nowhere: pass --website for the website's images)"}`);
  }
} finally {
  await browser?.close();
  room?.stop();
  if (KEEP) console.log(`instances kept under ${root}`); else await rm(root, { recursive: true, force: true });
}
