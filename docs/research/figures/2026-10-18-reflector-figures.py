# Draws figures 1 and 2 of docs/research/2026-10-18-harness2-recursive-harnessing.md from one
# skeleton: the "after" figure is the "before" with the additions overlaid in the accent colour.
# Usage: python3 2026-10-18-reflector-figures.py <out-dir>  (writes before.svg and after.svg with CSS vars;
# the research files, the docs page and the website carry colour-mapped variants of the same output).
"""Generate the before/after reflector figures from one skeleton.

The two figures share every box and edge; `after` adds an accent overlay on the same
positions. Output: the master HTML's two SVGs (CSS-variable colours), and variants for
the research directory (literal colours), the docs site (VitePress tokens) and the
website (the site's tokens).
"""
import re, pathlib, sys

W, H = 1040, 640
M = "var(--mono)"

def mono(s): return f'<tspan font-family="{M}">{s}</tspan>'

def figure(after: bool) -> str:
    p = "a" if after else "b"            # marker id prefix per figure
    acc = "var(--accent)"; alarm = "var(--alarm)"; muted = "var(--muted)"; soft = "var(--soft)"
    o = []
    add = o.append
    label = ("A second level drawn onto the same picture: the definition's S4 slot holds a reflector that reads the instance's records and appends proposals, intelligence and memory facts, none of which change a file; a person accepts advice as they accept identity; the eval harness probes a proposed edit; crossed marks show what the reflector can never write or schedule."
             if after else
             "One recursion level is regulated: inside the instance every channel is typed and every writer is named, the definition above is changed only by people, the records flow out to a column nothing reads back up, and the slot for the definition's own S4 holds a checklist a person runs.")
    add(f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="{label}" style="max-width:100%;height:auto;font-family:inherit">')
    add(f'  <defs>')
    add(f'    <marker id="{p}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker>')
    if after:
        add(f'    <marker id="{p}-arrow-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="{acc}"/></marker>')
        add(f'    <marker id="{p}-x" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="10" markerHeight="10" orient="auto"><path d="M2 2L8 8M8 2L2 8" stroke="{alarm}" stroke-width="1.8" fill="none"/></marker>')
    add(f'  </defs>')
    add(f'  <g font-size="12" fill="currentColor" stroke="currentColor">')
    AR = f"url(#{p}-arrow)"; AA = f"url(#{p}-arrow-accent)"; X = f"url(#{p}-x)"

    # ---- DEFINITION band ----
    add(f'    <rect x="30" y="20" width="730" height="96" rx="6" fill="none" stroke-width="1.5"/>')
    add(f'    <text x="46" y="42" font-weight="600" stroke="none">DEFINITION</text>')
    add(f'    <text x="140" y="42" stroke="none" fill="{muted}">versioned, checked by {mono("regulator check")}, changed by people</text>')
    chips = ["registry (43)", "identity seed", "profiles", "policies", "workloads", "evals"]
    for i, c in enumerate(chips):
        x = 46 + i * 116
        add(f'    <rect x="{x}" y="58" width="108" height="34" rx="3" fill="{soft}" stroke-width="1.2"/>')
        add(f'    <text x="{x+54}" y="79" stroke="none" text-anchor="middle" font-size="11.5">{c}</text>')
    if after:
        add(f'    <text x="278" y="109" stroke="none" font-size="10" fill="{acc}">+ {mono("advice/&lt;profile&gt;.md")}, the seed of the instance\'s advice files</text>')

    # ---- top-right slot: the definition's S4 ----
    if not after:
        add(f'    <rect x="780" y="20" width="230" height="96" rx="6" fill="none" stroke-width="1.5" stroke-dasharray="5 4"/>')
        add(f'    <text x="792" y="42" font-weight="600" stroke="none">THE DEFINITION\'S S4</text>')
        add(f'    <text x="792" y="62" stroke="none" font-size="10.5" fill="{muted}">today: a checklist a person runs</text>')
        add(f'    <text x="792" y="78" stroke="none" font-size="10.5" fill="{muted}">(the Pi upgrade, the review dates)</text>')
        add(f'    <text x="792" y="94" stroke="none" font-size="10.5" fill="{muted}">nothing models what the instance did</text>')
    else:
        add(f'    <rect x="780" y="20" width="230" height="96" rx="6" fill="var(--accent-soft)" stroke="{acc}" stroke-width="2"/>')
        add(f'    <text x="792" y="42" font-weight="600" stroke="none" fill="{acc}">S4</text>')
        add(f'    <text x="814" y="42" font-weight="600" stroke="none">REFLECTOR</text>')
        add(f'    <text x="792" y="62" stroke="none" font-size="10.5">reads the records; adopts nothing</text>')
        add(f'    <text x="792" y="78" stroke="none" font-size="10.5">writes only record kinds that exist:</text>')
        add(f'    <text x="792" y="94" stroke="none" font-size="10.5">proposal · intelligence · memory</text>')
        add(f'    <text x="792" y="110" stroke="none" font-size="10.5" fill="{muted}">an instrument, graded on calibration</text>')

    # ---- definition <-> instance edges ----
    add(f'    <line x1="80" y1="116" x2="80" y2="176" stroke-width="1.5" marker-end="{AR}"/>')
    add(f'    <text x="86" y="150" stroke="none" font-size="10" fill="{muted}">{mono("regulator init")} seeds</text>')
    add(f'    <line x1="236" y1="212" x2="236" y2="94" stroke-width="1.5" stroke-dasharray="5 4" marker-end="{AR}"/>')
    add(f'    <text x="242" y="150" stroke="none" font-size="10" fill="{muted}">{mono("identity promote")}</text>')
    if after:
        add(f'    <line x1="356" y1="212" x2="356" y2="118" stroke="{acc}" stroke-width="1.5" stroke-dasharray="5 4" marker-end="{AA}"/>')
        add(f'    <text x="362" y="150" stroke="none" font-size="10" fill="{acc}">{mono("advice promote")}</text>')
        # never writes the definition
        add(f'    <path d="M 780 68 L 766 68" stroke="{alarm}" stroke-width="1.5" fill="none" marker-end="{X}"/>')
        add(f'    <text x="756" y="138" stroke="none" font-size="10" text-anchor="end" fill="{alarm}">never writes a definition file · never dispatches a unit</text>')

    # ---- INSTANCE ----
    add(f'    <rect x="30" y="176" width="730" height="424" rx="6" fill="none" stroke-width="1.5"/>')
    add(f'    <text x="46" y="198" font-weight="600" stroke="none">INSTANCE</text>')
    add(f'    <text x="126" y="198" stroke="none" fill="{muted}">one repository under the control plane</text>')
    # S5
    add(f'    <rect x="46" y="212" width="330" height="40" rx="3" fill="{soft}" stroke-width="1.2"/>')
    add(f'    <text x="56" y="229" stroke="none" font-weight="600">S5</text>')
    if after:
        add(f'    <text x="80" y="229" stroke="none">identity files <tspan fill="{acc}">+ advice files</tspan>, write-protected</text>')
    else:
        add(f'    <text x="80" y="229" stroke="none">identity files, write-protected</text>')
    add(f'    <text x="80" y="244" stroke="none" font-size="11" fill="{muted}">write gate · bash watch · identity-untouched at closeout</text>')
    # person
    add(f'    <rect x="430" y="212" width="190" height="40" rx="20" fill="none" stroke-width="1.5"/>')
    add(f'    <text x="525" y="236" stroke="none" text-anchor="middle">a person ({mono("actAsS5")})</text>')
    add(f'    <line x1="430" y1="232" x2="378" y2="232" stroke-width="1.5" marker-end="{AR}"/>')
    add(f'    <text x="404" y="226" stroke="none" font-size="10" text-anchor="middle" fill="{muted}">accept</text>')
    add(f'    <text x="404" y="262" stroke="none" font-size="10" text-anchor="middle" fill="{muted}">the only writer</text>')
    if after:
        add(f'    <text x="404" y="276" stroke="none" font-size="10" text-anchor="middle" fill="{acc}">+ {mono("advice accept")}</text>')
    # S3 loop
    add(f'    <rect x="46" y="290" width="574" height="40" rx="3" fill="none" stroke-width="1.5"/>')
    add(f'    <text x="56" y="314" stroke="none" font-weight="600">S3</text>')
    add(f'    <text x="80" y="314" stroke="none">the loop: contract → dispatch → verify → route → close; budgets; recovery policy</text>')
    # S1 units
    add(f'    <rect x="46" y="372" width="130" height="44" rx="3" fill="{soft}" stroke-width="1.2"/>')
    add(f'    <rect x="190" y="372" width="130" height="44" rx="3" fill="{soft}" stroke-width="1.2"/>')
    add(f'    <rect x="334" y="372" width="160" height="44" rx="3" fill="{soft}" stroke-width="1.2" stroke-dasharray="4 3"/>')
    add(f'    <text x="56" y="389" stroke="none" font-weight="600">S1</text><text x="78" y="389" stroke="none">unit u1</text>')
    add(f'    <text x="56" y="405" stroke="none" font-size="11" fill="{muted}">implement · worktree</text>')
    add(f'    <text x="200" y="389" stroke="none" font-weight="600">S1</text><text x="222" y="389" stroke="none">unit u2</text>')
    add(f'    <text x="200" y="405" stroke="none" font-size="11" fill="{muted}">implement · worktree</text>')
    add(f'    <text x="344" y="389" stroke="none" font-weight="600">S4</text><text x="366" y="389" stroke="none">research unit</text>')
    add(f'    <text x="344" y="405" stroke="none" font-size="11" fill="{muted}">read-only · one question</text>')
    add(f'    <text x="46" y="440" stroke="none" font-size="11" fill="{muted}">S2: leases, worktree isolation, reintegration, thrash detector</text>')
    for x in (111, 255, 409):
        add(f'    <line x1="{x}" y1="330" x2="{x}" y2="370" stroke-width="1.2" marker-end="{AR}"/>')
    add(f'    <text x="118" y="352" stroke="none" font-size="10" fill="{muted}">dispatch</text>')
    # router
    add(f'    <rect x="520" y="372" width="200" height="44" rx="3" fill="none" stroke-width="1.5"/>')
    add(f'    <text x="620" y="389" stroke="none" text-anchor="middle">router → obligations</text>')
    add(f'    <text x="620" y="405" stroke="none" text-anchor="middle" font-size="11" fill="{muted}">routing policy · floors · veto</text>')
    add(f'    <line x1="494" y1="394" x2="518" y2="394" stroke-width="1.5" marker-end="{AR}"/>')
    add(f'    <text x="506" y="366" stroke="none" font-size="10" text-anchor="middle" fill="{muted}">report_intelligence</text>')
    add(f'    <path d="M 620 372 L 620 330" stroke-width="1.5" marker-end="{AR}"/>')
    add(f'    <text x="628" y="352" stroke="none" font-size="10" fill="{muted}">obligation holds the unit</text>')
    if after:
        add(f'    <text x="520" y="432" stroke="none" font-size="10" fill="{acc}">+ a {mono("harness-edit")}: an obligation owed to S5</text>')
    # proposal path and remember path
    add(f'    <path d="M 255 416 L 255 470 L 740 470 L 740 232 L 622 232" stroke-width="1.2" stroke-dasharray="5 4" fill="none" marker-end="{AR}"/>')
    add(f'    <text x="262" y="462" stroke="none" font-size="10" fill="{muted}">{mono("propose_policy_change")} → obligation owed to S5; changes nothing</text>')
    add(f'    <path d="M 300 416 L 300 448 L 600 448 L 600 498" stroke-width="1.2" stroke-dasharray="5 4" fill="none" marker-end="{AR}"/>')
    add(f'    <text x="606" y="444" stroke="none" font-size="10" fill="{muted}">{mono("remember")}</text>')
    # S3* and memory
    add(f'    <rect x="46" y="500" width="450" height="40" rx="3" fill="none" stroke-width="1.5"/>')
    add(f'    <text x="56" y="517" stroke="none" font-weight="600">S3*</text>')
    add(f'    <text x="84" y="517" stroke="none">host checks at the revision → evidence → closeout gate</text>')
    add(f'    <text x="84" y="532" stroke="none" font-size="11" fill="{muted}">inherited-tests · identity-untouched · export-signature · glossary-lint</text>')
    add(f'    <line x1="111" y1="416" x2="111" y2="498" stroke-width="1.2" marker-end="{AR}"/>')
    add(f'    <text x="118" y="482" stroke="none" font-size="10" fill="{muted}">branch at HEAD</text>')
    add(f'    <rect x="520" y="500" width="200" height="40" rx="3" fill="{soft}" stroke-width="1.2"/>')
    add(f'    <text x="620" y="517" stroke="none" text-anchor="middle">operational memory</text>')
    add(f'    <text x="620" y="532" stroke="none" text-anchor="middle" font-size="11" fill="{muted}">facts, provenance, expiry ≤ 90 d</text>')
    add(f'    <text x="46" y="584" stroke="none" font-size="11" fill="{muted}">Every edge inside the instance is typed, stamped by the host, and recorded on a card with its limitations.</text>')

    # ---- RECORDS column ----
    add(f'    <rect x="780" y="176" width="230" height="290" rx="6" fill="none" stroke-width="1.5" stroke-dasharray="1 4" stroke-linecap="round"/>')
    add(f'    <text x="796" y="198" font-weight="600" stroke="none">RECORDS</text>')
    add(f'    <text x="796" y="214" stroke="none" font-size="11" fill="{muted}">{mono(".regulator/")}, append-only</text>')
    for i, l in enumerate(["execution store", "regulatory log (signals)", "audit log (evidence)", "memory · outbox", "effect journal", "spans (OpenTelemetry)", "eval reports + interpretation"]):
        add(f'    <text x="796" y="{246 + 22*i}" stroke="none">{l}</text>')
    if after:
        add(f'    <text x="796" y="{246 + 22*7 - 4}" stroke="none" font-size="10" fill="{acc}">+ predictions, resolved at their horizons</text>')
    add(f'    <text x="796" y="430" stroke="none" font-size="11" fill="{muted}">read by {mono("status")}, the control room,</text>')
    add(f'    <text x="796" y="445" stroke="none" font-size="11" fill="{muted}">the eval harness, a person.</text>')
    if not after:
        add(f'    <text x="796" y="460" stroke="none" font-size="11" fill="{alarm}">Nothing carries them back up.</text>')
    add(f'    <line x1="760" y1="300" x2="778" y2="300" stroke-width="1.5" marker-end="{AR}"/>')
    add(f'    <text x="769" y="292" stroke="none" font-size="10" text-anchor="middle" fill="{muted}">writes</text>')
    # records -> the S4 slot
    if after:
        add(f'    <line x1="850" y1="176" x2="850" y2="118" stroke="{acc}" stroke-width="2" marker-end="{AA}"/>')
        add(f'    <text x="856" y="150" stroke="none" font-size="10" fill="{acc}">reads, read-only</text>')
        add(f'    <line x1="960" y1="116" x2="960" y2="174" stroke="{acc}" stroke-width="1.5" stroke-dasharray="5 4" marker-end="{AA}"/>')
        add(f'    <text x="966" y="150" stroke="none" font-size="10" fill="{acc}">appends</text>')
    else:
        add(f'    <path d="M 850 176 L 850 118" stroke-width="1.2" stroke-dasharray="2 4" marker-end="{AR}"/>')
        add(f'    <text x="856" y="150" stroke="none" font-size="10" fill="{muted}">a person reads the reports</text>')

    # ---- EVAL HARNESS ----
    add(f'    <rect x="780" y="496" width="230" height="78" rx="6" fill="none" stroke-width="1.5"/>')
    add(f'    <text x="792" y="518" font-weight="600" stroke="none">EVAL HARNESS</text>')
    add(f'    <text x="888" y="518" stroke="none" font-size="10.5" fill="{muted}">S3* one level up</text>')
    add(f'    <text x="792" y="536" stroke="none" font-size="10.5" fill="{muted}">arms · ablation · graders · intervals</text>')
    add(f'    <text x="792" y="552" stroke="none" font-size="10.5" fill="{muted}">a report needs a person\'s interpretation</text>')
    if after:
        add(f'    <text x="792" y="568" stroke="none" font-size="10.5" fill="{acc}">+ the probe: an arm per advice edit</text>')
    add(f'    <line x1="900" y1="496" x2="900" y2="468" stroke-width="1.2" marker-end="{AR}"/>')
    add(f'    <text x="906" y="486" stroke="none" font-size="10" fill="{muted}">reports</text>')

    add('  </g>')
    add('</svg>')
    return "\n".join(o)


DOCS = {"var(--muted)": "var(--vp-c-text-2)", "var(--faint)": "var(--vp-c-text-3)", "var(--soft)": "var(--vp-c-bg-soft)", "var(--accent-soft)": "var(--vp-c-brand-soft)", "var(--accent)": "var(--vp-c-brand-1)", "var(--alarm)": "var(--vp-c-danger-1)", "var(--mono)": "var(--vp-font-family-mono)"}
SITE = {"var(--muted)": "var(--ink-dim)", "var(--faint)": "var(--ink-faint)", "var(--soft)": "var(--surface-2)", "var(--accent-soft)": "var(--signal-soft)", "var(--accent)": "var(--signal)", "var(--alarm)": "var(--alarm)", "var(--mono)": "var(--mono)"}
RESEARCH = {"var(--muted)": "#5c574f", "var(--faint)": "#8a847a", "var(--soft)": "#f0ede6", "var(--accent-soft)": "#d9ecee", "var(--accent)": "#136e79", "var(--alarm)": "#b4532a", "var(--mono)": "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"}

def variant(svg, cmap, root_attrs=None, strip=False):
    for k, v in cmap.items(): svg = svg.replace(k, v)
    assert "var(--muted)" not in svg
    if root_attrs is not None:
        svg = re.sub(r'<svg viewBox="[^"]*" role="img" aria-label="([^"]*)" style="[^"]*">', lambda m: f'<svg {root_attrs} viewBox="0 0 {W} {H}" role="img" aria-label="{m.group(1)}">', svg, count=1)
    if strip: svg = "\n".join(l for l in svg.split("\n") if l.strip())
    return svg

def research_file(svg):
    s = svg
    for k, v in RESEARCH.items(): s = s.replace(k, v)
    label = re.search(r'aria-label="([^"]+)"', s).group(1)
    s = re.sub(r'<svg viewBox="[^"]*" role="img" aria-label="[^"]*" style="[^"]*">',
               f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="title" color="#1c1b19" font-family="ui-sans-serif,system-ui,-apple-system,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif">\n<title id="title">{label}</title>\n<rect fill="#fbfaf6" x="0" y="0" width="{W}" height="{H}"/>', s, count=1)
    return s + "\n"

if __name__ == "__main__":
    before, after = figure(False), figure(True)
    out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(".")
    (out / "before.svg").write_text(before); (out / "after.svg").write_text(after)
    print("generated", len(before), len(after))
