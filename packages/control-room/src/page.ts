/**
 * The page. One HTML document with its styles and script inline, so the
 * server ships nothing but this string. It renders three things from
 * `/api/status`, and nothing it renders is derived from the repository:
 *
 *   Definition   the registry as a topology (S5 → S1 columns, one card per
 *                regulator, declared channels on each card) and the workloads
 *   Instances    units, leases and unrouted signals per instance
 *   Inspector    the whole record for a regulator or a unit — the record, not
 *                a summary of it
 */
export function renderPage(): string {
  return PAGE;
}

const PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>regulator control room</title>
<style>
  :root {
    --bg: #f6f7f8; --panel: #ffffff; --ink: #1c2126; --muted: #5d6673; --line: #d9dee4; --accent: #2f6db5;
    --ok: #2e7d4f; --warn: #b26a00; --bad: #b3261e; --info: #2f6db5; --idle: #6b7480; --chip: #eef1f4; --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #14171a; --panel: #1d2126; --ink: #e6e9ec; --muted: #9aa4b0; --line: #2f353c; --accent: #7fb0e8; --ok: #6fc28e; --warn: #e0a54a; --bad: #ef7a72; --info: #7fb0e8; --idle: #8c95a1; --chip: #262b31; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
  header { display: flex; flex-wrap: wrap; gap: 12px 20px; align-items: baseline; padding: 14px 16px; border-bottom: 1px solid var(--line); background: var(--panel); position: sticky; top: 0; z-index: 2; }
  header h1 { font-size: 16px; margin: 0; font-weight: 600; }
  header .meta { color: var(--muted); font-size: 12px; }
  .badge { display: inline-block; padding: 1px 8px; border-radius: 999px; background: var(--chip); color: var(--muted); font-size: 11px; letter-spacing: .02em; text-transform: uppercase; }
  main { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 420px); gap: 16px; padding: 16px; max-width: 1600px; margin: 0 auto; }
  @media (max-width: 900px) { main { grid-template-columns: 1fr; } aside { position: static; } }
  section { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; }
  section h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin: 0 0 10px; }
  section h2 .banner, section h2 .mono { text-transform: none; letter-spacing: 0; font-weight: 400; }
  section h3 { font-size: 13px; margin: 14px 0 6px; }
  .topology { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
  @media (max-width: 1100px) { .topology { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 600px) { .topology { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .column { border: 1px dashed var(--line); border-radius: 6px; padding: 8px; min-height: 60px; }
  .column h4 { margin: 0 0 8px; font-size: 12px; color: var(--muted); display: flex; justify-content: space-between; }
  .card { border: 1px solid var(--line); border-radius: 6px; padding: 7px 8px; margin-bottom: 6px; cursor: pointer; background: var(--bg); }
  .card:hover, .card.selected, tr.row:hover, tr.row.selected { outline: 2px solid var(--accent); outline-offset: -2px; }
  .card .id { font-family: var(--mono); font-size: 11px; color: var(--muted); word-break: break-all; }
  .card .name { font-weight: 600; }
  .card .flow { font-size: 11px; color: var(--muted); margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { color: var(--muted); font-weight: 500; font-size: 12px; }
  tr.row { cursor: pointer; }
  code, .mono { font-family: var(--mono); font-size: 12px; }
  .chip { display: inline-block; padding: 0 7px; border-radius: 4px; font-size: 11px; font-weight: 600; color: #fff; }
  .chip.closed, .chip.live, .chip.active { background: var(--ok); }
  .chip.blocked, .chip.expired, .chip.blocking, .chip.critical { background: var(--bad); }
  .chip.dispatched, .chip.info { background: var(--info); }
  .chip.reported, .chip.advisory, .chip.proposed, .chip.warning { background: var(--warn); }
  .chip[class*="exhausted"] { background: var(--bad); }
  .chip.contracted, .chip.retired, .chip.prompt, .chip.type, .chip.deterministic-gate, .chip.typed-tool, .chip.model-judgment, .chip.pause, .chip.aborted { background: var(--idle); }
  .chip.retry, .chip.repair { background: var(--info); }
  .chip.replan, .chip.remediate, .chip.clarify { background: var(--warn); }
  .chip.abort, .chip.escalate { background: var(--bad); }
  .problem { color: var(--bad); font-size: 12px; }
  .empty { color: var(--muted); font-style: italic; }
  aside { position: sticky; top: 64px; align-self: start; max-height: calc(100vh - 80px); overflow: auto; }
  aside dl { margin: 0; }
  aside dt { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin-top: 10px; }
  aside dd { margin: 2px 0 0; }
  aside ul { margin: 2px 0 0; padding-left: 18px; }
  aside li { margin: 2px 0; }
  .decision { border-left: 3px solid var(--line); padding-left: 8px; margin: 4px 0; }
  .decision.fixed { border-color: var(--idle); } .decision.delegated { border-color: var(--info); } .decision.unresolved { border-color: var(--warn); }
  .decision .k { font-family: var(--mono); font-size: 11px; color: var(--muted); }
  button { font: inherit; background: var(--chip); color: var(--ink); border: 1px solid var(--line); border-radius: 4px; padding: 2px 8px; cursor: pointer; }
  .banner { font-size: 12px; color: var(--muted); }
</style>
</head>
<body>
<header>
  <h1>regulator control room</h1>
  <span class="badge">read-only</span>
  <span class="meta" id="meta">loading…</span>
  <button id="toggle" type="button">pause refresh</button>
</header>
<main>
  <div>
    <section id="definition"><h2>Definition</h2><p class="empty">loading…</p></section>
    <section id="instances"><h2>Instances</h2><p class="empty">loading…</p></section>
  </div>
  <aside id="inspector"><section><h2>Inspector</h2><p class="empty">Select a regulator or a unit. The inspector shows the record, not a summary of it.</p></section></aside>
</main>
<script>
(() => {
  const FUNCTIONS = ["S5", "S4", "S3", "S3*", "S2", "S1"];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const chip = (v) => '<span class="chip ' + esc(String(v).replace(/[^a-z0-9-]/gi, "-")) + '">' + esc(v) + "</span>";
  const budgetCell = (b) => {
    if (!b) return "—";
    const pct = Math.min(999, Math.round((b.consumed.tokens / b.ceiling.tokens) * 100));
    return "<span class='mono'>" + b.consumed.tokens + "/" + b.ceiling.tokens + " tok · " + b.consumed.turns + "/" + b.ceiling.turns + " turns</span>" + (b.exhausted ? " " + chip("exhausted: " + b.exhausted.dimension) : pct >= 80 ? " " + chip("warning") : "");
  };
  const routedCell = (ds) => {
    if (!ds || !ds.length) return "—";
    const d = ds[ds.length - 1];
    return "<span class='mono'>" + esc(d.cause) + "</span> → " + chip(d.action) + (ds.length > 1 ? " <span class='banner'>(+" + (ds.length - 1) + ")</span>" : "");
  };
  const verdictCell = (audit) => {
    const v = audit && audit.verdicts && audit.verdicts[audit.verdicts.length - 1];
    if (!v) return "—";
    return chip(v.verdict) + " <span class='mono'>@" + esc(v.revision.slice(0, 7)) + "</span>" + (v.verdict === "pass" ? "" : " <span class='banner'>" + esc([v.failed.length && "failed " + v.failed.join(", "), v.contradicted.length && "contradicted " + v.contradicted.join(", "), v.missing.length && "missing " + v.missing.join(", "), v.stale.length && "stale " + v.stale.join(", "), v.awaitingAcceptance.length && "awaiting " + v.awaitingAcceptance.join(", ")].filter(Boolean).join("; ")) + "</span>");
  };
  const list = (items, f) => items && items.length ? "<ul>" + items.map((i) => "<li>" + f(i) + "</li>").join("") + "</ul>" : '<span class="empty">none</span>';
  let view = null, selected = fromHash(), timer = null, paused = false;
  function fromHash() {
    const h = location.hash.slice(1);
    let m = /^reg=(.+)$/.exec(h); if (m) return { kind: "regulator", id: decodeURIComponent(m[1]) };
    m = /^unit=(\d+)\/(.+)$/.exec(h); if (m) return { kind: "unit", instance: Number(m[1]), id: decodeURIComponent(m[2]) };
    return null;
  }
  function select(next) {
    selected = next;
    history.replaceState(null, "", next ? "#" + (next.kind === "regulator" ? "reg=" + encodeURIComponent(next.id) : "unit=" + next.instance + "/" + encodeURIComponent(next.id)) : location.pathname);
    render();
  }

  function render() {
    if (!view) return;
    document.getElementById("meta").textContent = "as of " + view.generatedAt + (paused ? " · paused" : " · refreshing every 5s");
    renderDefinition(view.definition);
    renderInstances(view.instances);
    renderInspector();
  }

  function renderDefinition(d) {
    const el = document.getElementById("definition");
    if (!d) { el.innerHTML = "<h2>Definition</h2><p class='empty'>no definition directory was given</p>"; return; }
    const byFn = Object.fromEntries(FUNCTIONS.map((f) => [f, []]));
    for (const r of d.registry.records) (byFn[r.vsmFunction] ||= []).push(r);
    let html = "<h2>Definition <span class='banner'>" + esc(d.dir) + "</span></h2>";
    html += "<p class='banner'>declared: " + esc(d.declared.join(", ")) + " · pending: " + esc(d.pending.join(", ")) + " · " + d.registry.records.length + " regulator(s)</p>";
    html += "<h3>Topology — declared regulators by function; channels are what each record declares it consumes → emits</h3><div class='topology'>";
    for (const fn of FUNCTIONS) {
      const records = byFn[fn] || [];
      html += "<div class='column'><h4><span>" + esc(fn) + "</span><span>" + records.length + "</span></h4>";
      for (const r of records) {
        const sel = selected && selected.kind === "regulator" && selected.id === r.id ? " selected" : "";
        const c = r.channels || { consumes: [], emits: [] };
        html += "<div class='card" + sel + "' data-reg='" + esc(r.id) + "'><div class='name'>" + esc(r.name) + "</div><div class='id'>" + esc(r.id) + "</div>" +
          "<div>" + chip(r.mechanism.level) + " " + chip(r.status) + "</div>" +
          "<div class='flow'>← " + esc(c.consumes.length ? c.consumes.join("; ") : "—") + "<br>→ " + esc(c.emits.length ? c.emits.join("; ") : "—") + "</div></div>";
      }
      html += "</div>";
    }
    html += "</div>";
    html += "<h3>Workloads</h3>";
    if (!d.workloads.length) html += "<p class='empty'>no workload declared</p>";
    for (const w of d.workloads) {
      html += "<p><b>" + esc(w.name) + "</b> v" + w.version + " — " + esc(w.description) + "</p><table><tr><th>unit type</th><th>profile</th><th>checks</th><th>contract</th></tr>";
      for (const u of w.unitTypes) html += "<tr><td class='mono'>" + esc(u.name) + "</td><td class='mono'>" + esc(u.profile) + "</td><td class='mono'>" + esc(u.checks.join(", ") || "—") + "</td><td>" + (u.requiresContract ? "required" : "optional") + "</td></tr>";
      html += "</table>";
    }
    html += "<h3>Policies</h3>";
    if (!d.policies || !d.policies.length) html += "<p class='empty'>no policy declared: budgets and model routes are not part of this definition</p>";
    for (const p of d.policies || []) {
      html += "<p><b>" + esc(p.name) + "</b> v" + p.version + " — " + esc(p.description) + "</p><table><tr><th>unit type</th><th>tokens</th><th>cost</th><th>wall-clock</th><th>turns</th><th>attempts</th><th>models</th></tr>";
      const types = ["default", ...new Set([...Object.keys(p.budgets.byUnitType || {}), ...Object.keys(p.models.byUnitType || {})])];
      for (const t of types) {
        const c = t === "default" ? p.budgets.default : Object.assign({}, p.budgets.default, (p.budgets.byUnitType || {})[t] || {});
        const r = t === "default" ? p.models.default : (p.models.byUnitType || {})[t] || p.models.default;
        html += "<tr><td class='mono'>" + esc(t) + "</td><td>" + c.tokens + "</td><td>" + (c.cost === undefined ? "—" : c.cost) + "</td><td>" + Math.round(c.wallClockMs / 60000) + " min</td><td>" + c.turns + "</td><td>" + c.attempts + "</td><td class='mono'>" + esc([r.primary, ...r.fallback].join(" → ")) + "</td></tr>";
      }
      html += "</table>";
    }
    const problems = [...d.registry.problems.map((p) => p.file + ": " + p.message), ...d.problems];
    if (problems.length) html += "<h3>Problems</h3>" + list(problems, (p) => "<span class='problem'>" + esc(p) + "</span>");
    el.innerHTML = html;
    el.querySelectorAll("[data-reg]").forEach((n) => n.addEventListener("click", () => select({ kind: "regulator", id: n.dataset.reg })));
  }

  function renderInstances(instances) {
    const el = document.getElementById("instances");
    let html = "<h2>Instances</h2>";
    if (!instances.length) html += "<p class='empty'>no instance directories were given</p>";
    instances.forEach((inst, i) => {
      html += "<h3 class='mono'>" + esc(inst.dir) + "</h3>";
      html += "<table><tr><th>status</th><th>unit</th><th>type</th><th>contract</th><th>attempts</th><th>last</th><th>budget</th><th>routed</th><th>audit</th><th>report</th><th>reason</th></tr>";
      if (!inst.units.length) html += "<tr><td colspan='11' class='empty'>no units</td></tr>";
      for (const u of inst.units) {
        const last = u.attemptRecords[u.attemptRecords.length - 1];
        const sel = selected && selected.kind === "unit" && selected.instance === i && selected.id === u.unit.unitId ? " selected" : "";
        html += "<tr class='row" + sel + "' data-inst='" + i + "' data-unit='" + esc(u.unit.unitId) + "'><td>" + chip(u.unit.status) + "</td><td class='mono'>" + esc(u.unit.unitId) + "</td><td class='mono'>" + esc(u.unit.unitType) + "</td>" +
          "<td class='mono'>" + esc(u.unit.contract.id) + " v" + u.unit.contract.version + "</td><td>" + u.unit.attempts + "</td><td>" + (last ? esc(last.outcome) : "—") + "</td><td>" + budgetCell(u.budget) + "</td><td>" + routedCell(u.decisions) + "</td><td>" + verdictCell(u.audit) + "</td><td>" + (u.report ? "yes" : "—") + "</td><td>" + esc(u.unit.reason || "") + "</td></tr>";
      }
      html += "</table>";
      html += "<h3>Leases</h3><table><tr><th>state</th><th>unit</th><th>owner</th><th>branch</th><th>until</th></tr>";
      if (!inst.leases.length) html += "<tr><td colspan='5' class='empty'>no leases</td></tr>";
      for (const l of inst.leases) html += "<tr><td>" + chip(l.live ? "live" : "expired") + "</td><td class='mono'>" + esc(l.lease.unitId) + "</td><td>" + esc(l.lease.owner) + "</td><td class='mono'>" + esc(l.lease.branch) + "</td><td class='mono'>" + new Date(l.lease.expiresAt).toISOString() + "</td></tr>";
      html += "</table>";
      html += "<h3>Unrouted signals</h3><table><tr><th>kind</th><th>severity</th><th>route</th><th>subject</th><th>unit</th><th>observation</th></tr>";
      if (!inst.signals.length) html += "<tr><td colspan='6' class='empty'>none</td></tr>";
      for (const s of inst.signals) html += "<tr><td class='mono'>" + esc(s.kind) + "</td><td>" + (s.severity ? chip(s.severity) : "—") + "</td><td class='mono'>" + esc(s.source) + "→" + esc(s.destination) + "</td><td>" + esc(s.subject) + "</td><td class='mono'>" + esc(s.unit || "") + "</td><td>" + esc(s.observation || s.rationale || s.reason || "") + "</td></tr>";
      html += "</table>";
    });
    el.innerHTML = html;
    el.querySelectorAll("tr[data-unit]").forEach((n) => n.addEventListener("click", () => select({ kind: "unit", instance: Number(n.dataset.inst), id: n.dataset.unit })));
  }

  function renderInspector() {
    const el = document.getElementById("inspector");
    if (!selected) return;
    if (selected.kind === "regulator") {
      const r = view.definition && view.definition.registry.records.find((x) => x.id === selected.id);
      if (!r) { el.innerHTML = "<section><h2>Inspector</h2><p class='empty'>record no longer present</p></section>"; return; }
      const a = r.authority || { may: [], mayNot: [] };
      el.innerHTML = "<section><h2>Regulator</h2><p><b>" + esc(r.name) + "</b><br><span class='mono'>" + esc(r.id) + "</span></p>" +
        "<p>" + esc(r.vsmFunction) + " " + chip(r.mechanism.level) + " " + chip(r.status) + (r.introducedIn ? " " + chip(r.introducedIn) : "") + "</p><dl>" +
        "<dt>purpose</dt><dd>" + esc(r.purpose) + "</dd>" +
        "<dt>absorbs</dt><dd><b>" + esc(r.absorbs.failureClass) + "</b> — " + esc(r.absorbs.description) + "</dd>" +
        "<dt>mechanism</dt><dd><span class='mono'>" + esc(r.mechanism.implementation) + "</span><br>enforcement points: " + esc(r.mechanism.enforcementPoints.join(", ") || "—") + "</dd>" +
        "<dt>may</dt><dd>" + list(a.may, esc) + "</dd><dt>may not</dt><dd>" + list(a.mayNot, esc) + "</dd>" +
        "<dt>channels</dt><dd>consumes: " + esc(((r.channels || {}).consumes || []).join("; ") || "—") + "<br>emits: " + esc(((r.channels || {}).emits || []).join("; ") || "—") + "</dd>" +
        "<dt>scope</dt><dd>subjects: " + esc(((r.scope || {}).subjects || []).join(", ") || "—") + "<br>resources: " + esc(((r.scope || {}).resources || []).join(", ") || "—") + "</dd>" +
        "<dt>evidence</dt><dd>" + list(r.evidence.tests, (t) => "<span class='mono'>" + esc(t) + "</span>") + (r.evidence.lastVerifiedRevision ? "<br>last verified: <span class='mono'>" + esc(r.evidence.lastVerifiedRevision) + "</span>" : "") + "</dd>" +
        "<dt>limitations (enforcement boundary)</dt><dd>" + list(r.limitations, esc) + "</dd>" +
        "<dt>ownership</dt><dd>" + esc(r.ownership.owner) + " · introduced " + esc(r.ownership.introduced) + " · review by " + esc(r.ownership.reviewBy) + "</dd>" +
        "<dt>retirement</dt><dd>" + esc(r.retirement ? r.retirement.condition : "no condition stated") + "</dd></dl></section>";
      return;
    }
    const inst = view.instances[selected.instance];
    const u = inst && inst.units.find((x) => x.unit.unitId === selected.id);
    if (!u) { el.innerHTML = "<section><h2>Inspector</h2><p class='empty'>unit no longer present</p></section>"; return; }
    const c = u.contract, rep = u.report;
    const b = u.budget;
    let html = "<section><h2>Unit</h2><p><span class='mono'>" + esc(u.unit.unitId) + "</span> " + chip(u.unit.status) + " · " + esc(u.unit.unitType) + " · " + esc(u.unit.workload.name) + " v" + u.unit.workload.version + "</p>" +
      (u.unit.reason ? "<p class='problem'>" + esc(u.unit.reason) + "</p>" : "") +
      (b ? "<dl><dt>budget (attempt " + b.attempt + ")</dt><dd>" + budgetCell(b) + "<br>cost " + b.consumed.cost.toFixed(4) + (b.ceiling.cost !== undefined ? " / " + b.ceiling.cost : "") + " · " + Math.round(b.consumed.wallClockMs / 1000) + "s / " + Math.round(b.ceiling.wallClockMs / 1000) + "s<br>models: <span class='mono'>" + esc(b.models.join(" → ") || "—") + "</span><br>compactions: " + (b.compactions.length ? b.compactions.map((c) => esc(c.reason) + (c.preserved ? " (contract carried)" : " (NOT carried)")).join(", ") : "none") + "</dd></dl>" : "") +
      "<dl><dt>attempts</dt><dd>" + list(u.attemptRecords, (a) => "#" + a.attempt + " " + esc(a.outcome) + " · " + esc(a.startedAt) + " → " + esc(a.endedAt) + (a.sessionId ? " · session <span class='mono'>" + esc(a.sessionId) + "</span>" : "") + (a.detail ? "<br><span class='problem'>" + esc(a.detail) + "</span>" : "")) + "</dd>" +
      "<dt>recovery decisions</dt><dd>" + list(u.decisions || [], (d) => "after attempt " + d.attempt + ": <span class='mono'>" + esc(d.cause) + "</span> (occurrence " + d.occurrence + ") → " + chip(d.action) + " under <span class='mono'>" + esc(d.policy.name) + " v" + d.policy.version + "</span><br><span class='banner'>" + esc(d.rationale) + "</span>" + (d.question ? "<br><b>question:</b> " + esc(d.question) : "") + (d.hint ? "<br><span class='banner'>hint: " + esc(d.hint) + "</span>" : "")) + "</dd></dl></section>";
    const audit = u.audit || { evidence: [], verdicts: [], acceptances: [] };
    html += "<section><h2>Audit (S3*)</h2><p class='banner'>host-run evidence bound to a revision; the report's claims satisfy nothing</p><dl>" +
      "<dt>verdicts</dt><dd>" + list(audit.verdicts, (v) => "attempt " + v.attempt + ": " + verdictCell({ verdicts: [v] }) + " · " + v.evidence.length + " record(s) considered · " + esc(v.at) + (v.reasons.length ? "<br><span class='problem'>" + v.reasons.map(esc).join("<br>") + "</span>" : "")) + "</dd>" +
      "<dt>evidence</dt><dd>" + list(audit.evidence, (r) => chip(r.verdict) + " attempt " + r.attempt + " <span class='mono'>@" + esc(r.revision.slice(0, 7)) + "</span> <span class='mono'>" + esc(r.check) + "</span> [" + esc(r.class) + " → " + esc(r.criteria.join(", ") || "no criterion") + "] " + esc(r.observation.split("\n")[0]) + (r.command ? "<br><span class='banner mono'>" + esc(r.command.join(" ")) + " · " + esc(r.environment.node) + " " + esc(r.environment.platform) + "/" + esc(r.environment.arch) + "</span>" : "")) + "</dd>" +
      "<dt>human acceptances</dt><dd>" + list(audit.acceptances, (a) => chip(a.disposition) + " <span class='k'>" + esc(a.criterion) + "</span> <span class='mono'>@" + esc(a.revision.slice(0, 7)) + "</span> by " + esc(a.by) + (a.note ? " — " + esc(a.note) : "")) + "</dd></dl></section>";
    html += "<section><h2>Contract " + (c ? "<span class='mono'>" + esc(c.id) + " v" + c.version + "</span>" : "") + "</h2>";
    if (!c) html += "<p class='empty'>contract file missing</p>";
    else {
      html += "<p>" + esc(c.objective) + "</p>" + (c.contribution ? "<p class='banner'>" + esc(c.contribution) + "</p>" : "") +
        "<dl><dt>constraints</dt><dd>" + esc(c.constraintRefs.join(", ") || "—") + "</dd>" +
        "<dt>fixed</dt><dd>" + (c.fixed.length ? c.fixed.map((d) => "<div class='decision fixed'><span class='k'>" + esc(d.id) + "</span> <b>" + esc(d.subject) + "</b><br>" + esc(d.decision) + "<br><span class='banner'>authority: " + esc(d.authorityRef) + "</span></div>").join("") : "<span class='empty'>none</span>") + "</dd>" +
        "<dt>delegated</dt><dd>" + (c.delegated.length ? c.delegated.map((d) => "<div class='decision delegated'><span class='k'>" + esc(d.id) + "</span> <b>" + esc(d.subject) + "</b><br>bounds: " + esc(d.bounds) + "</div>").join("") : "<span class='empty'>none</span>") + "</dd>" +
        "<dt>unresolved</dt><dd>" + (c.unresolved.length ? c.unresolved.map((d) => "<div class='decision unresolved'><span class='k'>" + esc(d.id) + "</span> <b>" + esc(d.subject) + "</b><br>" + esc(d.reason) + "<br><span class='banner'>handling: " + esc(d.handling) + (d.obligationRef ? " · obligation " + esc(d.obligationRef) : "") + "</span></div>").join("") : "<span class='empty'>none</span>") + "</dd>" +
        "<dt>expected evidence</dt><dd>" + list(c.expectedEvidence, (e) => "<span class='k'>" + esc(e.id) + "</span> [" + esc(e.class) + (e.required ? ", required" : "") + "] " + esc(e.description)) + "</dd>" +
        "<dt>provenance</dt><dd>" + esc(c.provenance.createdBy) + " · " + esc(c.provenance.createdAt) + (c.provenance.sourceRevision ? " · <span class='mono'>" + esc(c.provenance.sourceRevision) + "</span>" : "") + "</dd></dl>";
    }
    html += "</section><section><h2>Result report</h2>";
    if (!rep) html += "<p class='empty'>no report: the unit has not called report_result against this contract version</p>";
    else {
      html += "<p>" + esc(rep.summary) + "</p><p class='banner'>reported " + esc(rep.reportedAt) + "</p><dl>" +
        "<dt>evidence</dt><dd>" + list(rep.evidence, (e) => "[" + esc(e.class) + "] <span class='mono'>" + esc(e.ref) + "</span>" + (e.observation ? " — " + esc(e.observation) : "")) + "</dd>" +
        "<dt>delegated choices</dt><dd>" + list(rep.delegatedResults, (d) => "<span class='k'>" + esc(d.decisionId) + "</span> " + esc(d.choice) + (d.rationale ? " — " + esc(d.rationale) : "")) + "</dd>" +
        "<dt>unresolved outcomes</dt><dd>" + list(rep.unresolvedOutcomes, (d) => "<span class='k'>" + esc(d.decisionId) + "</span> <b>" + esc(d.outcome) + "</b> — " + esc(d.note)) + "</dd>" +
        "<dt>emergent decisions (not allocated by the contract)</dt><dd>" + list(rep.emergentDecisions, (d) => "<b>" + esc(d.subject) + "</b>: " + esc(d.choiceOrQuestion) + " · consequence if wrong: " + esc(d.consequenceIfWrong)) + "</dd>" +
        "<dt>deviations</dt><dd>" + list(rep.deviations, (d) => "<b>" + esc(d.kind) + (d.ref ? " (" + esc(d.ref) + ")" : "") + "</b> — " + esc(d.description)) + "</dd>" +
        "<dt>residual uncertainty</dt><dd>" + list(rep.residualUncertainty, (d) => "<b>" + esc(d.subject) + "</b>: " + esc(d.reason) + " · consequence if wrong: " + esc(d.consequenceIfWrong)) + "</dd></dl>";
    }
    html += "</section>";
    el.innerHTML = html;
  }

  async function refresh() {
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      if (!res.ok) throw new Error("status " + res.status);
      view = await res.json();
      render();
    } catch (error) {
      document.getElementById("meta").textContent = "could not read status: " + error.message;
    }
  }
  function schedule() { clearInterval(timer); timer = paused ? null : setInterval(refresh, 5000); }
  document.getElementById("toggle").addEventListener("click", (e) => { paused = !paused; e.target.textContent = paused ? "resume refresh" : "pause refresh"; schedule(); render(); });
  refresh(); schedule();
})();
</script>
</body>
</html>
`;
