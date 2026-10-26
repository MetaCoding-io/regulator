# Draws figures 1 and 2 of docs/research/2026-10-18-harness2-recursive-harnessing.md from one
# skeleton: the "after" figure is the "before" with the additions overlaid in the accent colour.
# Usage: python3 2026-10-18-reflector-figures.py <out-dir>  (writes before.svg and after.svg with CSS vars;
# the research files, the docs page and the website carry colour-mapped variants of the same output).
"""Generate the before/after reflector figures from one skeleton.

The two figures share every box and edge; `after` adds an accent overlay on the same
positions. Every component and edge is a hotspot: a group carrying the card text a
tooltip shows (label, one or two sentences, a link into the docs), so each copy of the
figure carries its own explanations the way it carries its labels. Output: the master
HTML's two SVGs (CSS-variable colours), and variants for the research directory (literal
colours), the docs site (VitePress tokens) and the website (the site's tokens).
"""
import html, re, pathlib, sys

W, H = 1040, 640
M = "var(--mono)"
DOCS_URL = "__DOCS__"   # replaced per variant: "" on the docs site, the docs origin elsewhere

def mono(s): return f'<tspan font-family="{M}">{s}</tspan>'

# ---- hotspot cards: id -> (label, definition, docs path) ----------------------------
# Backticks in a definition render as <code>. Paths are docs-root-relative.
CARDS = {
    "definition": ("The definition",
        "A versioned package of files: the registry, the identity seed, the profiles, the policies, the workloads and the evals. `regulator check` holds it against the code, only people change it, and `regulator init` seeds an instance from it.",
        "concepts/definition-and-instance"),
    "registry": ("Registry",
        "One record per regulator: what it absorbs, its mechanism level, its evidence, its limitation, its ablation switch and its retirement condition. `REGULATORS.md` and `BOUNDARY.md` are rendered from the records.",
        "concepts/control-plane#the-regulators"),
    "identity-seed": ("Identity seed",
        "The `IDENTITY`, `INVARIANTS`, `GLOSSARY` and `BOUNDARIES` files an instance starts from. Copied into `regulator/identity/` at init and write-protected from then on.",
        "concepts/identity"),
    "profiles": ("Capability profiles",
        "A named, bounded grant of tools and writable paths a unit runs under. Specialisation by grant, never by persona.",
        "reference/definition"),
    "policies": ("Policies",
        "Routing, budgets, recovery and interaction: the declared rules the loop and the router apply, each versioned so a decision can cite the version it used.",
        "reference/definition"),
    "workloads": ("Workloads",
        "A declared set of unit types for one kind of job, each a profile, a grant, a budget and a route. The loop stays the same; only the workload changes.",
        "guide/authoring-a-workload"),
    "evals": ("Evals",
        "The suites, arms and graders the eval harness runs, and the fifteen pre-registered metric names a report may use.",
        "concepts/evidence-about-the-regulators"),
    "advice-seed": ("Advice seed",
        "`advice/<profile>.md` in the definition: the text a profile's units are advised with, under `advice.maxChars`. Advice is proposable and lands only through `advice accept`; it is the one kind of file a reflector's edit targets.",
        "project/whats-coming#the-reflector-the-definitions-s4"),
    "slot-today": ("The definition's S4 today",
        "Watching how the system behaves and what it should do differently is a checklist a person runs: the Pi upgrade, the review dates, the open questions. Nothing models what the instances did.",
        "project/whats-coming"),
    "reflector": ("The reflector",
        "The definition's S4: a package that reads every instance's records and emits three record kinds that already exist, a memory fact, an intelligence signal and a proposal owed to S5. Registered as an instrument, graded on whether the proposals a person accepted moved the metric they named.",
        "project/whats-coming#the-reflector-the-definitions-s4"),
    "init": ("`regulator init` seeds",
        "The one write from the definition into an instance: the identity files, the manifest and the stores are created from the package. From then on the instance's records are its own.",
        "guide/getting-started"),
    "identity-promote": ("`identity promote`",
        "Carries an accepted identity change in an instance back into the definition's seed, so the next instance starts from it. Run by a person; a proposal never reaches the seed on its own.",
        "concepts/identity#the-only-way-to-change-identity"),
    "advice-promote": ("`advice promote`",
        "The same path for an accepted advice file: a person carries it from the instance's `regulator/advice/` into the definition's advice seed.",
        "project/whats-coming#what-a-person-sees"),
    "never": ("What the reflector cannot do",
        "It has no tool that writes under `regulator/` or the definition, none that dispatches a unit and none that dispositions an obligation. The crossed edge is refused by mechanism, not by instruction.",
        "project/whats-coming#what-changes-at-what-level"),
    "instance": ("An instance",
        "One repository under the control plane: a `.regulator/` directory of append-only records, an identity set, a manifest naming the definition version it was seeded from, and the loop running units against it.",
        "reference/instance"),
    "s5": ("S5: identity files",
        "What the instance is: `IDENTITY`, `INVARIANTS`, `GLOSSARY` and `BOUNDARIES` under `regulator/identity/`, rendered into every session and protected by three layers: the write gate, the bash watch and the identity-untouched check at closeout.",
        "concepts/identity"),
    "s5-after": ("S5: identity and advice files",
        "The identity files, protected by the write gate, the bash watch and the identity-untouched check, with the advice files beside them under the same protection. Both are proposable; each lands through its own accept command.",
        "concepts/identity"),
    "person": ("A person acting as S5",
        "The interaction policy names who may act as S5. That person is the only writer of an identity file, through `identity accept`. `reject` changes nothing, and silence is never consent.",
        "concepts/asking-a-person"),
    "accept": ("accept",
        "`regulator identity accept <obligation> --by …`: the authority check, then the write. The only path by which a proposal becomes identity.",
        "concepts/identity#the-only-way-to-change-identity"),
    "accept-after": ("accept · advice accept",
        "`identity accept` for an identity file and `advice accept` for an advice file after its probe: the authority check, then the write. Each is the only writer of its kind of file.",
        "project/whats-coming#what-a-person-sees"),
    "s3": ("S3: the loop",
        "Contract, dispatch, verify, route, close. The orchestrator never edits code itself: it dispatches a session under a contract and a budget, verifies the work with host-run checks, routes by the versioned recovery policy and closes on the ledger.",
        "concepts/control-plane#the-loop"),
    "dispatch": ("dispatch",
        "A unit starts as an attempt: one claimed run against a revision, under its profile's grant, its budget ceilings and a lease on its worktree.",
        "guide/running-units"),
    "s1": ("S1: a unit",
        "The work that touches the repository: one contract, one session, one verdict. It runs in its own worktree under the `implement` profile, and what it reports about itself is never evidence.",
        "concepts/contracts"),
    "s4-unit": ("S4: a research unit",
        "Intelligence at the instance level: a read-only profile, one question, a budget. It reports with `report_intelligence` and cannot change anything itself.",
        "concepts/intelligence-and-memory#intelligence"),
    "s2": ("S2: coordination",
        "Damping between units, as mechanism: leases, worktree isolation, reintegration checked on the merged tree, and a thrash detector that names an oscillation for S3 to decide.",
        "concepts/coordination"),
    "report": ("report_intelligence",
        "The typed tool a research unit reports with. The signal lands in the regulatory log and goes to the router; it never goes straight to a unit.",
        "concepts/intelligence-and-memory#intelligence"),
    "router": ("The router",
        "Turns a signal into obligations by the routing policy: which consumers it is owed to, the severity floors, and the veto that holds the units it names.",
        "concepts/obligations"),
    "holds": ("obligation holds the unit",
        "At blocking severity an obligation pauses the units it names until S3 or a person dispositions it. Intelligence can stop work; it never replans on its own.",
        "concepts/obligations"),
    "propose": ("propose_policy_change",
        "The tool a unit proposes a change to identity with. It opens an obligation owed to S5 and changes nothing by itself (INV-002).",
        "concepts/identity#the-only-way-to-change-identity"),
    "harness-edit": ("harness-edit",
        "The new proposal kind, routed like every proposal: a diagnosis (what was observed, by reference), a change (a diff against one advice file) and a prediction (which metric, against which baseline, over which horizon, and which value would count against it).",
        "project/whats-coming#what-changes-at-what-level"),
    "remember": ("remember",
        "The tool a unit records a fact with: provenance, scope and an expiry of at most ninety days. A fact is never identity, however often it is repeated.",
        "concepts/intelligence-and-memory#operational-memory"),
    "s3star": ("S3*: host checks",
        "Independent verification: the host runs the checks itself at the exact revision and the closeout gate reads that evidence, never the unit's claim. Named here: the inherited tests, identity-untouched, the export signature and the glossary lint.",
        "reference/host-checks"),
    "branch": ("branch at HEAD",
        "What S3* verifies is the unit's branch at the revision it reported, so the evidence is tied to a commit, not to a transcript.",
        "reference/host-checks"),
    "memory": ("Operational memory",
        "Facts for later units, each with provenance and an expiry, read into a session as advice. Retractable, and never promoted to identity by repetition.",
        "concepts/intelligence-and-memory#operational-memory"),
    "typed": ("Every edge is typed",
        "Each channel inside the instance is a message kind in `protocol` with a stated authority and destination, stamped by the host and recorded on a registry card with its limitation.",
        "concepts/control-plane#typed-channels"),
    "records": ("The records",
        "`.regulator/`: append-only stores the host writes from inside the loop and the session's gates. The only thing `status`, the control room and the eval harness read.",
        "reference/instance"),
    "execution-store": ("Execution store",
        "Units, attempts, leases and contracts: the authoritative work state, with the lifecycle transitions the store itself enforces.",
        "reference/instance"),
    "regulatory-log": ("Regulatory log",
        "Signals, the obligations they became, and every disposition, with the policy version each decision cited.",
        "concepts/obligations"),
    "audit-log": ("Audit log",
        "Host-run evidence and the verdicts drawn from it, each tied to the revision it was produced at.",
        "reference/host-checks"),
    "memory-outbox": ("Memory and outbox",
        "Facts with provenance and expiry; and what is owed to a person, delivered and reminded until answered.",
        "concepts/intelligence-and-memory#operational-memory"),
    "effect-journal": ("Effect journal",
        "An effect that cannot be taken back is intended before, committed after and reconciled against the world on restart, so a crash in between neither repeats it nor forgets it.",
        "concepts/recovery"),
    "spans": ("Spans",
        "Every store read as OpenTelemetry spans, so a trace viewer shows a unit's run without a second database.",
        "reference/instance"),
    "eval-reports": ("Eval reports and interpretation",
        "A report from the eval harness and the interpretation a person wrote for it. A report without an interpretation adopts nothing.",
        "concepts/evidence-about-the-regulators#reports"),
    "predictions": ("Predictions",
        "A harness-edit's bet, kept as its own record: the probe resolves the first horizon, the next units after acceptance resolve the second, and a bet that fails there opens an obligation to revert or re-decide.",
        "project/whats-coming#what-changes-at-what-level"),
    "read-by": ("Who reads the records",
        "`status`, the control room, the eval harness and a person. No mechanism carries what the records say back into the definition.",
        "guide/control-room"),
    "read-by-after": ("Who reads the records",
        "`status`, the control room, the eval harness, a person, and now the reflector, read-only.",
        "guide/control-room"),
    "writes": ("writes",
        "Every store is written by the host from inside the loop and the session's gates, never by a unit directly.",
        "reference/instance"),
    "person-reads": ("a person reads the reports",
        "The one path from the records to the level above today: an eval report with a person's interpretation, acted on by hand.",
        "concepts/evidence-about-the-regulators#the-interpretation-rule"),
    "reads": ("reads, read-only",
        "The reflector's read of the records, under a read-only grant like a research unit's. It depends on `protocol`, `core` and the status read model; nothing depends on it.",
        "project/whats-coming#the-reflector-the-definitions-s4"),
    "appends": ("appends",
        "What the reflector writes lands in record kinds that exist: a memory fact, an intelligence signal the router turns into an obligation, a proposal owed to S5.",
        "project/whats-coming#the-reflector-the-definitions-s4"),
    "eval": ("The eval harness",
        "S3* one level up: suites run under declared arms with deterministic graders, ablation per regulator, and intervals. A report needs a person's interpretation before anything is adopted from it.",
        "concepts/evidence-about-the-regulators"),
    "probe": ("The probe",
        "An eval arm per proposed advice edit, run against the workload's fixture before anyone decides. It resolves the proposal's first horizon.",
        "concepts/evidence-about-the-regulators#arms"),
    "reports": ("reports",
        "An eval report is appended to the records like any other, with its interpretation beside it.",
        "concepts/evidence-about-the-regulators#reports"),
}

def card_html(s):
    """Backticks to <code>, escaped so the value is legal in an XML attribute too."""
    s = html.escape(s, quote=False)
    s = re.sub(r"`([^`]+)`", r"&lt;code&gt;\1&lt;/code&gt;", s)
    return s.replace('"', "&quot;")

def figure(after: bool) -> str:
    p = "a" if after else "b"            # marker id prefix per figure
    acc = "var(--accent)"; alarm = "var(--alarm)"; muted = "var(--muted)"; soft = "var(--soft)"
    o = []
    add = o.append
    label = ("A second level drawn onto the same picture: the definition's S4 slot holds a reflector that reads the instance's records and appends proposals, intelligence and memory facts, none of which change a file; a person accepts advice as they accept identity; the eval harness probes a proposed edit; crossed marks show what the reflector can never write or schedule."
             if after else
             "One recursion level is regulated: inside the instance every channel is typed and every writer is named, the definition above is changed only by people, the records flow out to a column nothing reads back up, and the slot for the definition's own S4 holds a checklist a person runs.")

    def hot(cid, *lines, hit=None):
        """Wrap lines in a hotspot group carrying its card; `hit` adds a wide invisible stroke for an edge."""
        lab, d, path = CARDS[cid]
        add(f'    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-{cid}" aria-label="{card_html(lab.replace("`", ""))}" data-label="{card_html(lab)}" data-def="{card_html(d)}" data-href="{DOCS_URL}/{path}">')
        for l in lines: add("  " + l)
        if hit: add(f'      <path d="{hit}" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>')
        add('    </g>')

    add(f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="{label}" style="max-width:100%;height:auto;font-family:inherit">')
    add(f'  <defs>')
    add(f'    <marker id="{p}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker>')
    if after:
        add(f'    <marker id="{p}-arrow-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="{acc}"/></marker>')
        add(f'    <marker id="{p}-x" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="10" markerHeight="10" orient="auto"><path d="M2 2L8 8M8 2L2 8" stroke="{alarm}" stroke-width="1.8" fill="none"/></marker>')
    add(f'  </defs>')
    add(f'  <g font-size="12" fill="currentColor" stroke="currentColor">')
    AR = f"url(#{p}-arrow)"; AA = f"url(#{p}-arrow-accent)"; X = f"url(#{p}-x)"

    # ---- left half: the definition band and the instance, shifted 16 left to widen the gutter ----
    add(f'    <g transform="translate(-16 0)">')
    add(f'    <rect x="30" y="20" width="722" height="96" rx="6" fill="none" stroke-width="1.5"/>')
    hot("definition",
        f'    <text x="46" y="42" font-weight="600" stroke="none">DEFINITION</text>',
        f'    <text x="140" y="42" stroke="none" fill="{muted}">versioned, checked by {mono("regulator check")}, changed by people</text>')
    chips = [("registry", "registry (43)"), ("identity-seed", "identity seed"), ("profiles", "profiles"), ("policies", "policies"), ("workloads", "workloads"), ("evals", "evals")]
    for i, (cid, c) in enumerate(chips):
        x = 46 + i * 116
        hot(cid,
            f'    <rect x="{x}" y="58" width="108" height="34" rx="3" fill="{soft}" stroke-width="1.2"/>',
            f'    <text x="{x+54}" y="79" stroke="none" text-anchor="middle" font-size="11.5">{c}</text>')
    if after:
        hot("advice-seed",
            f'    <text x="278" y="109" stroke="none" font-size="10" fill="{acc}">+ {mono("advice/&lt;profile&gt;.md")}, the seed of the instance\'s advice files</text>')

    # ---- definition <-> instance edges ----
    hot("init",
        f'    <line x1="80" y1="116" x2="80" y2="176" stroke-width="1.5" marker-end="{AR}"/>',
        f'    <text x="86" y="150" stroke="none" font-size="10" fill="{muted}">{mono("regulator init")} seeds</text>',
        hit="M 80 116 L 80 176")
    hot("identity-promote",
        f'    <line x1="236" y1="212" x2="236" y2="94" stroke-width="1.5" stroke-dasharray="5 4" marker-end="{AR}"/>',
        f'    <text x="242" y="150" stroke="none" font-size="10" fill="{muted}">{mono("identity promote")}</text>',
        hit="M 236 212 L 236 94")
    if after:
        hot("advice-promote",
            f'    <line x1="356" y1="212" x2="356" y2="118" stroke="{acc}" stroke-width="1.5" stroke-dasharray="5 4" marker-end="{AA}"/>',
            f'    <text x="362" y="150" stroke="none" font-size="10" fill="{acc}">{mono("advice promote")}</text>',
            hit="M 356 212 L 356 118")

    # ---- INSTANCE ----
    add(f'    <rect x="30" y="176" width="722" height="424" rx="6" fill="none" stroke-width="1.5"/>')
    hot("instance",
        f'    <text x="46" y="198" font-weight="600" stroke="none">INSTANCE</text>',
        f'    <text x="126" y="198" stroke="none" fill="{muted}">one repository under the control plane</text>')
    # S5
    hot("s5-after" if after else "s5",
        f'    <rect x="46" y="212" width="330" height="40" rx="3" fill="{soft}" stroke-width="1.2"/>',
        f'    <text x="56" y="229" stroke="none" font-weight="600">S5</text>',
        (f'    <text x="80" y="229" stroke="none">identity files <tspan fill="{acc}">+ advice files</tspan>, write-protected</text>' if after else
         f'    <text x="80" y="229" stroke="none">identity files, write-protected</text>'),
        f'    <text x="80" y="244" stroke="none" font-size="11" fill="{muted}">write gate · bash watch · identity-untouched at closeout</text>')
    # person
    hot("person",
        f'    <rect x="430" y="212" width="190" height="40" rx="20" fill="none" pointer-events="all" stroke-width="1.5"/>',
        f'    <text x="525" y="236" stroke="none" text-anchor="middle">a person ({mono("actAsS5")})</text>')
    accept_lines = [
        f'    <line x1="430" y1="232" x2="378" y2="232" stroke-width="1.5" marker-end="{AR}"/>',
        f'    <text x="404" y="226" stroke="none" font-size="10" text-anchor="middle" fill="{muted}">accept</text>',
        f'    <text x="404" y="262" stroke="none" font-size="10" text-anchor="middle" fill="{muted}">the only writer</text>']
    if after:
        accept_lines.append(f'    <text x="404" y="276" stroke="none" font-size="10" text-anchor="middle" fill="{acc}">+ {mono("advice accept")}</text>')
    hot("accept-after" if after else "accept", *accept_lines, hit="M 430 232 L 378 232")
    # S3 loop
    hot("s3",
        f'    <rect x="46" y="290" width="574" height="40" rx="3" fill="none" pointer-events="all" stroke-width="1.5"/>',
        f'    <text x="56" y="314" stroke="none" font-weight="600">S3</text>',
        f'    <text x="80" y="314" stroke="none">the loop: contract → dispatch → verify → route → close; budgets; recovery policy</text>')
    # S1 units
    hot("s1",
        f'    <rect x="46" y="372" width="130" height="44" rx="3" fill="{soft}" stroke-width="1.2"/>',
        f'    <text x="56" y="389" stroke="none" font-weight="600">S1</text><text x="78" y="389" stroke="none">unit u1</text>',
        f'    <text x="56" y="405" stroke="none" font-size="11" fill="{muted}">implement · worktree</text>')
    hot("s1",
        f'    <rect x="190" y="372" width="130" height="44" rx="3" fill="{soft}" stroke-width="1.2"/>',
        f'    <text x="200" y="389" stroke="none" font-weight="600">S1</text><text x="222" y="389" stroke="none">unit u2</text>',
        f'    <text x="200" y="405" stroke="none" font-size="11" fill="{muted}">implement · worktree</text>')
    hot("s4-unit",
        f'    <rect x="334" y="372" width="160" height="44" rx="3" fill="{soft}" stroke-width="1.2" stroke-dasharray="4 3"/>',
        f'    <text x="344" y="389" stroke="none" font-weight="600">S4</text><text x="366" y="389" stroke="none">research unit</text>',
        f'    <text x="344" y="405" stroke="none" font-size="11" fill="{muted}">read-only · one question</text>')
    hot("s2",
        f'    <text x="46" y="440" stroke="none" font-size="11" fill="{muted}">S2: leases, worktree isolation, reintegration, thrash detector</text>')
    hot("dispatch",
        *[f'    <line x1="{x}" y1="330" x2="{x}" y2="370" stroke-width="1.2" marker-end="{AR}"/>' for x in (111, 255, 409)],
        f'    <text x="118" y="352" stroke="none" font-size="10" fill="{muted}">dispatch</text>',
        hit="M 111 330 L 111 370 M 255 330 L 255 370 M 409 330 L 409 370")
    # router
    hot("router",
        f'    <rect x="520" y="372" width="176" height="44" rx="3" fill="none" pointer-events="all" stroke-width="1.5"/>',
        f'    <text x="608" y="389" stroke="none" text-anchor="middle">router → obligations</text>',
        f'    <text x="608" y="405" stroke="none" text-anchor="middle" font-size="11" fill="{muted}">routing policy · floors · veto</text>')
    hot("report",
        f'    <line x1="494" y1="394" x2="518" y2="394" stroke-width="1.5" marker-end="{AR}"/>',
        f'    <text x="506" y="366" stroke="none" font-size="10" text-anchor="middle" fill="{muted}">report_intelligence</text>',
        hit="M 494 394 L 518 394")
    hot("holds",
        f'    <path d="M 608 372 L 608 330" stroke-width="1.5" marker-end="{AR}"/>',
        f'    <text x="616" y="352" stroke="none" font-size="10" fill="{muted}">obligation holds the unit</text>',
        hit="M 608 372 L 608 330")
    if after:
        hot("harness-edit",
            f'    <text x="508" y="432" stroke="none" font-size="10" fill="{acc}">+ a {mono("harness-edit")}: an obligation owed to S5</text>')
    # proposal path and remember path
    hot("propose",
        f'    <path d="M 255 416 L 255 470 L 732 470 L 732 232 L 622 232" stroke-width="1.2" stroke-dasharray="5 4" fill="none" marker-end="{AR}"/>',
        f'    <text x="262" y="462" stroke="none" font-size="10" fill="{muted}">{mono("propose_policy_change")} → obligation owed to S5; changes nothing</text>',
        hit="M 255 416 L 255 470 L 732 470 L 732 232 L 622 232")
    hot("remember",
        f'    <path d="M 300 416 L 300 448 L 600 448 L 600 498" stroke-width="1.2" stroke-dasharray="5 4" fill="none" marker-end="{AR}"/>',
        f'    <text x="606" y="444" stroke="none" font-size="10" fill="{muted}">{mono("remember")}</text>',
        hit="M 300 416 L 300 448 L 600 448 L 600 498")
    # S3* and memory
    hot("s3star",
        f'    <rect x="46" y="500" width="450" height="40" rx="3" fill="none" pointer-events="all" stroke-width="1.5"/>',
        f'    <text x="56" y="517" stroke="none" font-weight="600">S3*</text>',
        f'    <text x="84" y="517" stroke="none">host checks at the revision → evidence → closeout gate</text>',
        f'    <text x="84" y="532" stroke="none" font-size="11" fill="{muted}">inherited-tests · identity-untouched · export-signature · glossary-lint</text>')
    hot("branch",
        f'    <line x1="111" y1="416" x2="111" y2="498" stroke-width="1.2" marker-end="{AR}"/>',
        f'    <text x="118" y="482" stroke="none" font-size="10" fill="{muted}">branch at HEAD</text>',
        hit="M 111 416 L 111 498")
    hot("memory",
        f'    <rect x="520" y="500" width="200" height="40" rx="3" fill="{soft}" stroke-width="1.2"/>',
        f'    <text x="620" y="517" stroke="none" text-anchor="middle">operational memory</text>',
        f'    <text x="620" y="532" stroke="none" text-anchor="middle" font-size="11" fill="{muted}">facts, provenance, expiry ≤ 90 d</text>')
    hot("typed",
        f'    <text x="46" y="584" stroke="none" font-size="11" fill="{muted}">Every edge inside the instance is typed, stamped by the host, and recorded on a card with its limitations.</text>')

    add(f'    </g>')

    # ---- the gutter: edges that cross between the two halves, in final coordinates ----
    hot("writes",
        f'    <line x1="736" y1="300" x2="794" y2="300" stroke-width="1.5" marker-end="{AR}"/>',
        f'    <text x="765" y="292" stroke="none" font-size="10" text-anchor="middle" fill="{muted}">writes</text>',
        hit="M 734 300 L 796 300")
    if after:
        # the crossed edge runs from the reflector to the definition band's edge, where the cross sits
        hot("never",
            f'    <path d="M 796 68 L 741 68" stroke="{alarm}" stroke-width="1.5" fill="none" marker-end="{X}"/>',
            f'    <text x="736" y="138" stroke="none" font-size="10" text-anchor="end" fill="{alarm}">never writes a definition file · never dispatches a unit</text>',
            hit="M 798 68 L 736 68")

    # ---- right half: the S4 slot, the records and the eval harness, shifted 16 right ----
    add(f'    <g transform="translate(16 0)">')
    # ---- top-right slot: the definition's S4 ----
    if not after:
        hot("slot-today",
            f'    <rect x="780" y="20" width="230" height="96" rx="6" fill="none" pointer-events="all" stroke-width="1.5" stroke-dasharray="5 4"/>',
            f'    <text x="792" y="42" font-weight="600" stroke="none">THE DEFINITION\'S S4</text>',
            f'    <text x="792" y="62" stroke="none" font-size="10.5" fill="{muted}">today: a checklist a person runs</text>',
            f'    <text x="792" y="78" stroke="none" font-size="10.5" fill="{muted}">(the Pi upgrade, the review dates)</text>',
            f'    <text x="792" y="94" stroke="none" font-size="10.5" fill="{muted}">nothing models what the instance did</text>')
    else:
        hot("reflector",
            f'    <rect x="780" y="20" width="230" height="96" rx="6" fill="var(--accent-soft)" stroke="{acc}" stroke-width="2"/>',
            f'    <text x="792" y="42" font-weight="600" stroke="none" fill="{acc}">S4</text>',
            f'    <text x="814" y="42" font-weight="600" stroke="none">REFLECTOR</text>',
            f'    <text x="792" y="62" stroke="none" font-size="10.5">reads the records; adopts nothing</text>',
            f'    <text x="792" y="78" stroke="none" font-size="10.5">writes only record kinds that exist:</text>',
            f'    <text x="792" y="94" stroke="none" font-size="10.5">proposal · intelligence · memory</text>',
            f'    <text x="792" y="110" stroke="none" font-size="10.5" fill="{muted}">an instrument, graded on calibration</text>')

    # ---- RECORDS column ----
    add(f'    <rect x="780" y="176" width="230" height="290" rx="6" fill="none" stroke-width="1.5" stroke-dasharray="1 4" stroke-linecap="round"/>')
    hot("records",
        f'    <text x="796" y="198" font-weight="600" stroke="none">RECORDS</text>',
        f'    <text x="796" y="214" stroke="none" font-size="11" fill="{muted}">{mono(".regulator/")}, append-only</text>')
    stores = [("execution-store", "execution store"), ("regulatory-log", "regulatory log (signals)"), ("audit-log", "audit log (evidence)"),
              ("memory-outbox", "memory · outbox"), ("effect-journal", "effect journal"), ("spans", "spans (OpenTelemetry)"), ("eval-reports", "eval reports + interpretation")]
    for i, (cid, l) in enumerate(stores):
        hot(cid, f'    <text x="796" y="{246 + 22*i}" stroke="none">{l}</text>')
    if after:
        hot("predictions", f'    <text x="796" y="{246 + 22*7 - 4}" stroke="none" font-size="10" fill="{acc}">+ predictions, resolved at their horizons</text>')
    read_lines = [
        f'    <text x="796" y="430" stroke="none" font-size="11" fill="{muted}">read by {mono("status")}, the control room,</text>',
        f'    <text x="796" y="445" stroke="none" font-size="11" fill="{muted}">the eval harness, a person.</text>']
    if not after:
        read_lines.append(f'    <text x="796" y="460" stroke="none" font-size="11" fill="{alarm}">Nothing carries them back up.</text>')
    hot("read-by-after" if after else "read-by", *read_lines)
    # records -> the S4 slot
    if after:
        hot("reads",
            f'    <line x1="850" y1="176" x2="850" y2="118" stroke="{acc}" stroke-width="2" marker-end="{AA}"/>',
            f'    <text x="856" y="150" stroke="none" font-size="10" fill="{acc}">reads, read-only</text>',
            hit="M 850 176 L 850 118")
        hot("appends",
            f'    <line x1="960" y1="116" x2="960" y2="174" stroke="{acc}" stroke-width="1.5" stroke-dasharray="5 4" marker-end="{AA}"/>',
            f'    <text x="966" y="150" stroke="none" font-size="10" fill="{acc}">appends</text>',
            hit="M 960 116 L 960 174")
    else:
        hot("person-reads",
            f'    <path d="M 850 176 L 850 118" stroke-width="1.2" stroke-dasharray="2 4" marker-end="{AR}"/>',
            f'    <text x="856" y="150" stroke="none" font-size="10" fill="{muted}">a person reads the reports</text>',
            hit="M 850 176 L 850 118")

    # ---- EVAL HARNESS ----
    hot("eval",
        f'    <rect x="780" y="496" width="230" height="104" rx="6" fill="none" pointer-events="all" stroke-width="1.5"/>',
        f'    <text x="792" y="520" font-weight="600" stroke="none">EVAL HARNESS</text>',
        f'    <text x="888" y="520" stroke="none" font-size="10.5" fill="{muted}">S3* one level up</text>',
        f'    <text x="792" y="544" stroke="none" font-size="10.5" fill="{muted}">arms · ablation · graders · intervals</text>',
        f'    <text x="792" y="562" stroke="none" font-size="10.5" fill="{muted}">a report needs a person\'s interpretation</text>')
    if after:
        hot("probe", f'    <text x="792" y="582" stroke="none" font-size="10.5" fill="{acc}">+ the probe: an arm per advice edit</text>')
    hot("reports",
        f'    <line x1="900" y1="496" x2="900" y2="468" stroke-width="1.2" marker-end="{AR}"/>',
        f'    <text x="906" y="486" stroke="none" font-size="10" fill="{muted}">reports</text>',
        hit="M 900 496 L 900 468")
    add(f'    </g>')

    add('  </g>')
    add('</svg>')
    return "\n".join(o)

DOCS = {"var(--muted)": "var(--vp-c-text-2)", "var(--faint)": "var(--vp-c-text-3)", "var(--soft)": "var(--vp-c-bg-soft)", "var(--accent-soft)": "var(--vp-c-brand-soft)", "var(--accent)": "var(--vp-c-brand-1)", "var(--alarm)": "var(--vp-c-danger-1)", "var(--mono)": "var(--vp-font-family-mono)"}
SITE = {"var(--muted)": "var(--ink-dim)", "var(--faint)": "var(--ink-faint)", "var(--soft)": "var(--surface-2)", "var(--accent-soft)": "var(--signal-soft)", "var(--accent)": "var(--signal)", "var(--alarm)": "var(--alarm)", "var(--mono)": "var(--mono)"}
RESEARCH = {"var(--muted)": "#5c574f", "var(--faint)": "#8a847a", "var(--soft)": "#f0ede6", "var(--accent-soft)": "#d9ecee", "var(--accent)": "#136e79", "var(--alarm)": "#b4532a", "var(--mono)": "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"}
DOCS_ORIGIN = "https://docs.regulator.metacoding.io"

def variant(svg, cmap, root_attrs=None, strip=False, docs_url=DOCS_ORIGIN):
    for k, v in cmap.items(): svg = svg.replace(k, v)
    assert "var(--muted)" not in svg
    svg = svg.replace(DOCS_URL, docs_url)
    if root_attrs is not None:
        svg = re.sub(r'<svg viewBox="[^"]*" role="img" aria-label="([^"]*)" style="[^"]*">', lambda m: f'<svg {root_attrs} viewBox="0 0 {W} {H}" role="img" aria-label="{m.group(1)}">', svg, count=1)
    if strip: svg = "\n".join(l for l in svg.split("\n") if l.strip())
    return svg

def research_file(svg):
    s = svg
    for k, v in RESEARCH.items(): s = s.replace(k, v)
    s = s.replace(DOCS_URL, DOCS_ORIGIN)
    label = re.search(r'aria-label="([^"]+)"', s).group(1)
    s = re.sub(r'<svg viewBox="[^"]*" role="img" aria-label="[^"]*" style="[^"]*">',
               f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="title" color="#1c1b19" font-family="ui-sans-serif,system-ui,-apple-system,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif">\n<title id="title">{label}</title>\n<rect fill="#fbfaf6" x="0" y="0" width="{W}" height="{H}"/>', s, count=1)
    return s + "\n"

if __name__ == "__main__":
    before, after = figure(False), figure(True)
    out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(".")
    (out / "before.svg").write_text(before); (out / "after.svg").write_text(after)
    print("generated", len(before), len(after))
