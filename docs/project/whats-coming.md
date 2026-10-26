# What's coming

This page is a picture of one thing the project has designed and not yet built, so a
reader can see what would change before it changes. The order of work is the
[roadmap](/project/roadmap); the design, with its sources and its hazards, is the
research note [*Harness² read through the control
plane*](../research/2026-10-18-harness2-recursive-harnessing.md). Of what is drawn
below, only the first row of the last table has shipped (the accept-path split, slice 1,
#110); nothing else here is shipped, and nothing here is a promise of a date.

## The reflector: the definition's S4

regulator regulates one recursion level today. Inside an instance every channel is
typed, every writer is named, and the loop, the gates and the host checks hold a unit
inside its boundaries. The level above, the definition the instance was seeded from, is
run by people: `regulator doctor` under CI, `review --due`, releases, and a person who
accepts or rejects every proposal. For S4 at that level, the function that watches how
the system behaves and what it should do differently, there is a checklist a person runs.

The reflector is that S4, proposed as a package beside `checks` or as a `reflect` unit
with a contract, a budget and a lease. It reads the records every instance already
writes (the execution store, the regulatory and audit logs, memory, the eval reports,
the spans) and emits three record kinds that already exist: a memory fact for later
units, an intelligence signal the router turns into an obligation, and a proposal owed
to S5. The new proposal kind, `harness-edit`, carries a diff against one of the
definition's *advice* files and the trajectory moment it traces to. A proposed edit is
probed as an eval arm against the workload's fixture before anyone decides, and a
person accepts it with an `advice accept` command that is the only writer of an
advice file. The reflector never writes a definition file, never dispatches a unit and
never dispositions an obligation, because it has no tool that does.

Every file in the definition is proposable, because a proposal changes nothing by
itself (INV-002) and identity is proposed that way today. What differs is the path an
accepted proposal takes. Identity lands through `identity accept`. An advice file lands
through `advice accept` after its probe. Anything that executes or grants (a unit
type, which is a profile, a grant, a budget and a route; a profile grant; a host check;
an extension under the trust rule) lands as a unit of work against the definition's
repository under a contract, checked at closeout and merged by a person. So the
reflector may propose a new kind of unit and how it joins the workload. It may not
author the code or the grant that the proposal becomes.

A proposal also states its bet before anyone decides: the metric it expects to move,
from one of the eval harness's fifteen pre-registered names, the baseline it is measured
against, the horizon over which it resolves, and the value that would count against it.
The probe resolves the first horizon. The next units after acceptance resolve the
second, and a bet that fails there opens an obligation to revert or re-decide. The
reflector's instrument card is graded on exactly those resolutions.

It is registered as an **instrument**, not a regulator: a record kind for things that
inform rather than refuse, graded on calibration. Its question is whether the proposals
a person accepted moved the metric they named. `regulator check` refuses an instrument
without a calibration report the way it refuses a regulator without a limitation.

The name was chosen over "improver" because the card has to be able to say "did not
improve" without contradicting itself. The nearest published system, Google's Harness²,
has the same component under the same name; what it does with the component's output is
the difference the figures below draw.

## Before

<figure style="overflow-x:auto">
<svg style="max-width:100%;height:auto;font-family:inherit;min-width:860px" viewBox="0 0 1040 640" role="img" aria-label="One recursion level is regulated: inside the instance every channel is typed and every writer is named, the definition above is changed only by people, the records flow out to a column nothing reads back up, and the slot for the definition's own S4 holds a checklist a person runs.">
  <defs>
    <marker id="b-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker>
  </defs>
  <g font-size="12" fill="currentColor" stroke="currentColor">
    <rect x="30" y="20" width="730" height="96" rx="6" fill="none" stroke-width="1.5"/>
    <text x="46" y="42" font-weight="600" stroke="none">DEFINITION</text>
    <text x="140" y="42" stroke="none" fill="var(--vp-c-text-2)">versioned, checked by <tspan font-family="var(--vp-font-family-mono)">regulator check</tspan>, changed by people</text>
    <rect x="46" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
    <text x="100" y="79" stroke="none" text-anchor="middle" font-size="11.5">registry (43)</text>
    <rect x="162" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
    <text x="216" y="79" stroke="none" text-anchor="middle" font-size="11.5">identity seed</text>
    <rect x="278" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
    <text x="332" y="79" stroke="none" text-anchor="middle" font-size="11.5">profiles</text>
    <rect x="394" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
    <text x="448" y="79" stroke="none" text-anchor="middle" font-size="11.5">policies</text>
    <rect x="510" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
    <text x="564" y="79" stroke="none" text-anchor="middle" font-size="11.5">workloads</text>
    <rect x="626" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
    <text x="680" y="79" stroke="none" text-anchor="middle" font-size="11.5">evals</text>
    <rect x="780" y="20" width="230" height="96" rx="6" fill="none" stroke-width="1.5" stroke-dasharray="5 4"/>
    <text x="792" y="42" font-weight="600" stroke="none">THE DEFINITION'S S4</text>
    <text x="792" y="62" stroke="none" font-size="10.5" fill="var(--vp-c-text-2)">today: a checklist a person runs</text>
    <text x="792" y="78" stroke="none" font-size="10.5" fill="var(--vp-c-text-2)">(the Pi upgrade, the review dates)</text>
    <text x="792" y="94" stroke="none" font-size="10.5" fill="var(--vp-c-text-2)">nothing models what the instance did</text>
    <line x1="80" y1="116" x2="80" y2="176" stroke-width="1.5" marker-end="url(#b-arrow)"/>
    <text x="86" y="150" stroke="none" font-size="10" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">regulator init</tspan> seeds</text>
    <line x1="236" y1="212" x2="236" y2="94" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#b-arrow)"/>
    <text x="242" y="150" stroke="none" font-size="10" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">identity promote</tspan></text>
    <rect x="30" y="176" width="730" height="424" rx="6" fill="none" stroke-width="1.5"/>
    <text x="46" y="198" font-weight="600" stroke="none">INSTANCE</text>
    <text x="126" y="198" stroke="none" fill="var(--vp-c-text-2)">one repository under the control plane</text>
    <rect x="46" y="212" width="330" height="40" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
    <text x="56" y="229" stroke="none" font-weight="600">S5</text>
    <text x="80" y="229" stroke="none">identity files, write-protected</text>
    <text x="80" y="244" stroke="none" font-size="11" fill="var(--vp-c-text-2)">write gate · bash watch · identity-untouched at closeout</text>
    <rect x="430" y="212" width="190" height="40" rx="20" fill="none" stroke-width="1.5"/>
    <text x="525" y="236" stroke="none" text-anchor="middle">a person (<tspan font-family="var(--vp-font-family-mono)">actAsS5</tspan>)</text>
    <line x1="430" y1="232" x2="378" y2="232" stroke-width="1.5" marker-end="url(#b-arrow)"/>
    <text x="404" y="226" stroke="none" font-size="10" text-anchor="middle" fill="var(--vp-c-text-2)">accept</text>
    <text x="404" y="262" stroke="none" font-size="10" text-anchor="middle" fill="var(--vp-c-text-2)">the only writer</text>
    <rect x="46" y="290" width="574" height="40" rx="3" fill="none" stroke-width="1.5"/>
    <text x="56" y="314" stroke="none" font-weight="600">S3</text>
    <text x="80" y="314" stroke="none">the loop: contract → dispatch → verify → route → close; budgets; recovery policy</text>
    <rect x="46" y="372" width="130" height="44" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
    <rect x="190" y="372" width="130" height="44" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
    <rect x="334" y="372" width="160" height="44" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2" stroke-dasharray="4 3"/>
    <text x="56" y="389" stroke="none" font-weight="600">S1</text><text x="78" y="389" stroke="none">unit u1</text>
    <text x="56" y="405" stroke="none" font-size="11" fill="var(--vp-c-text-2)">implement · worktree</text>
    <text x="200" y="389" stroke="none" font-weight="600">S1</text><text x="222" y="389" stroke="none">unit u2</text>
    <text x="200" y="405" stroke="none" font-size="11" fill="var(--vp-c-text-2)">implement · worktree</text>
    <text x="344" y="389" stroke="none" font-weight="600">S4</text><text x="366" y="389" stroke="none">research unit</text>
    <text x="344" y="405" stroke="none" font-size="11" fill="var(--vp-c-text-2)">read-only · one question</text>
    <text x="46" y="440" stroke="none" font-size="11" fill="var(--vp-c-text-2)">S2: leases, worktree isolation, reintegration, thrash detector</text>
    <line x1="111" y1="330" x2="111" y2="370" stroke-width="1.2" marker-end="url(#b-arrow)"/>
    <line x1="255" y1="330" x2="255" y2="370" stroke-width="1.2" marker-end="url(#b-arrow)"/>
    <line x1="409" y1="330" x2="409" y2="370" stroke-width="1.2" marker-end="url(#b-arrow)"/>
    <text x="118" y="352" stroke="none" font-size="10" fill="var(--vp-c-text-2)">dispatch</text>
    <rect x="520" y="372" width="200" height="44" rx="3" fill="none" stroke-width="1.5"/>
    <text x="620" y="389" stroke="none" text-anchor="middle">router → obligations</text>
    <text x="620" y="405" stroke="none" text-anchor="middle" font-size="11" fill="var(--vp-c-text-2)">routing policy · floors · veto</text>
    <line x1="494" y1="394" x2="518" y2="394" stroke-width="1.5" marker-end="url(#b-arrow)"/>
    <text x="506" y="366" stroke="none" font-size="10" text-anchor="middle" fill="var(--vp-c-text-2)">report_intelligence</text>
    <path d="M 620 372 L 620 330" stroke-width="1.5" marker-end="url(#b-arrow)"/>
    <text x="628" y="352" stroke="none" font-size="10" fill="var(--vp-c-text-2)">obligation holds the unit</text>
    <path d="M 255 416 L 255 470 L 740 470 L 740 232 L 622 232" stroke-width="1.2" stroke-dasharray="5 4" fill="none" marker-end="url(#b-arrow)"/>
    <text x="262" y="462" stroke="none" font-size="10" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">propose_policy_change</tspan> → obligation owed to S5; changes nothing</text>
    <path d="M 300 416 L 300 448 L 600 448 L 600 498" stroke-width="1.2" stroke-dasharray="5 4" fill="none" marker-end="url(#b-arrow)"/>
    <text x="606" y="444" stroke="none" font-size="10" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">remember</tspan></text>
    <rect x="46" y="500" width="450" height="40" rx="3" fill="none" stroke-width="1.5"/>
    <text x="56" y="517" stroke="none" font-weight="600">S3*</text>
    <text x="84" y="517" stroke="none">host checks at the revision → evidence → closeout gate</text>
    <text x="84" y="532" stroke="none" font-size="11" fill="var(--vp-c-text-2)">inherited-tests · identity-untouched · export-signature · glossary-lint</text>
    <line x1="111" y1="416" x2="111" y2="498" stroke-width="1.2" marker-end="url(#b-arrow)"/>
    <text x="118" y="482" stroke="none" font-size="10" fill="var(--vp-c-text-2)">branch at HEAD</text>
    <rect x="520" y="500" width="200" height="40" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
    <text x="620" y="517" stroke="none" text-anchor="middle">operational memory</text>
    <text x="620" y="532" stroke="none" text-anchor="middle" font-size="11" fill="var(--vp-c-text-2)">facts, provenance, expiry ≤ 90 d</text>
    <text x="46" y="584" stroke="none" font-size="11" fill="var(--vp-c-text-2)">Every edge inside the instance is typed, stamped by the host, and recorded on a card with its limitations.</text>
    <rect x="780" y="176" width="230" height="290" rx="6" fill="none" stroke-width="1.5" stroke-dasharray="1 4" stroke-linecap="round"/>
    <text x="796" y="198" font-weight="600" stroke="none">RECORDS</text>
    <text x="796" y="214" stroke="none" font-size="11" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">.regulator/</tspan>, append-only</text>
    <text x="796" y="246" stroke="none">execution store</text>
    <text x="796" y="268" stroke="none">regulatory log (signals)</text>
    <text x="796" y="290" stroke="none">audit log (evidence)</text>
    <text x="796" y="312" stroke="none">memory · outbox</text>
    <text x="796" y="334" stroke="none">effect journal</text>
    <text x="796" y="356" stroke="none">spans (OpenTelemetry)</text>
    <text x="796" y="378" stroke="none">eval reports + interpretation</text>
    <text x="796" y="430" stroke="none" font-size="11" fill="var(--vp-c-text-2)">read by <tspan font-family="var(--vp-font-family-mono)">status</tspan>, the control room,</text>
    <text x="796" y="445" stroke="none" font-size="11" fill="var(--vp-c-text-2)">the eval harness, a person.</text>
    <text x="796" y="460" stroke="none" font-size="11" fill="var(--vp-c-danger-1)">Nothing carries them back up.</text>
    <line x1="760" y1="300" x2="778" y2="300" stroke-width="1.5" marker-end="url(#b-arrow)"/>
    <text x="769" y="292" stroke="none" font-size="10" text-anchor="middle" fill="var(--vp-c-text-2)">writes</text>
    <path d="M 850 176 L 850 118" stroke-width="1.2" stroke-dasharray="2 4" marker-end="url(#b-arrow)"/>
    <text x="856" y="150" stroke="none" font-size="10" fill="var(--vp-c-text-2)">a person reads the reports</text>
    <rect x="780" y="496" width="230" height="78" rx="6" fill="none" stroke-width="1.5"/>
    <text x="792" y="518" font-weight="600" stroke="none">EVAL HARNESS</text>
    <text x="888" y="518" stroke="none" font-size="10.5" fill="var(--vp-c-text-2)">S3* one level up</text>
    <text x="792" y="536" stroke="none" font-size="10.5" fill="var(--vp-c-text-2)">arms · ablation · graders · intervals</text>
    <text x="792" y="552" stroke="none" font-size="10.5" fill="var(--vp-c-text-2)">a report needs a person's interpretation</text>
    <line x1="900" y1="496" x2="900" y2="468" stroke-width="1.2" marker-end="url(#b-arrow)"/>
    <text x="906" y="486" stroke="none" font-size="10" fill="var(--vp-c-text-2)">reports</text>
  </g>
</svg>
<figcaption><b>Today.</b> One recursion level is regulated. Inside the instance every edge is typed, stamped by the host and recorded on a card. The level above has people for S3, S3* and S5, and the slot for its S4 holds a checklist a person runs. The records flow out and are read for status, evals and audit; nothing carries what they say back up.</figcaption>
</figure>

## After

<figure style="overflow-x:auto">
<svg style="max-width:100%;height:auto;font-family:inherit;min-width:860px" viewBox="0 0 1040 640" role="img" aria-label="A second level drawn onto the same picture: the definition's S4 slot holds a reflector that reads the instance's records and appends proposals, intelligence and memory facts, none of which change a file; a person accepts advice as they accept identity; the eval harness probes a proposed edit; crossed marks show what the reflector can never write or schedule.">
  <defs>
    <marker id="a-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker>
    <marker id="a-arrow-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--vp-c-brand-1)"/></marker>
    <marker id="a-x" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="10" markerHeight="10" orient="auto"><path d="M2 2L8 8M8 2L2 8" stroke="var(--vp-c-danger-1)" stroke-width="1.8" fill="none"/></marker>
  </defs>
  <g font-size="12" fill="currentColor" stroke="currentColor">
    <rect x="30" y="20" width="730" height="96" rx="6" fill="none" stroke-width="1.5"/>
    <text x="46" y="42" font-weight="600" stroke="none">DEFINITION</text>
    <text x="140" y="42" stroke="none" fill="var(--vp-c-text-2)">versioned, checked by <tspan font-family="var(--vp-font-family-mono)">regulator check</tspan>, changed by people</text>
    <rect x="46" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
    <text x="100" y="79" stroke="none" text-anchor="middle" font-size="11.5">registry (43)</text>
    <rect x="162" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
    <text x="216" y="79" stroke="none" text-anchor="middle" font-size="11.5">identity seed</text>
    <rect x="278" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
    <text x="332" y="79" stroke="none" text-anchor="middle" font-size="11.5">profiles</text>
    <rect x="394" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
    <text x="448" y="79" stroke="none" text-anchor="middle" font-size="11.5">policies</text>
    <rect x="510" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
    <text x="564" y="79" stroke="none" text-anchor="middle" font-size="11.5">workloads</text>
    <rect x="626" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
    <text x="680" y="79" stroke="none" text-anchor="middle" font-size="11.5">evals</text>
    <text x="278" y="109" stroke="none" font-size="10" fill="var(--vp-c-brand-1)">+ <tspan font-family="var(--vp-font-family-mono)">advice/&lt;profile&gt;.md</tspan>, the seed of the instance's advice files</text>
    <rect x="780" y="20" width="230" height="96" rx="6" fill="var(--vp-c-brand-soft)" stroke="var(--vp-c-brand-1)" stroke-width="2"/>
    <text x="792" y="42" font-weight="600" stroke="none" fill="var(--vp-c-brand-1)">S4</text>
    <text x="814" y="42" font-weight="600" stroke="none">REFLECTOR</text>
    <text x="792" y="62" stroke="none" font-size="10.5">reads the records; adopts nothing</text>
    <text x="792" y="78" stroke="none" font-size="10.5">writes only record kinds that exist:</text>
    <text x="792" y="94" stroke="none" font-size="10.5">proposal · intelligence · memory</text>
    <text x="792" y="110" stroke="none" font-size="10.5" fill="var(--vp-c-text-2)">an instrument, graded on calibration</text>
    <line x1="80" y1="116" x2="80" y2="176" stroke-width="1.5" marker-end="url(#a-arrow)"/>
    <text x="86" y="150" stroke="none" font-size="10" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">regulator init</tspan> seeds</text>
    <line x1="236" y1="212" x2="236" y2="94" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#a-arrow)"/>
    <text x="242" y="150" stroke="none" font-size="10" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">identity promote</tspan></text>
    <line x1="356" y1="212" x2="356" y2="118" stroke="var(--vp-c-brand-1)" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#a-arrow-accent)"/>
    <text x="362" y="150" stroke="none" font-size="10" fill="var(--vp-c-brand-1)"><tspan font-family="var(--vp-font-family-mono)">advice promote</tspan></text>
    <path d="M 780 68 L 766 68" stroke="var(--vp-c-danger-1)" stroke-width="1.5" fill="none" marker-end="url(#a-x)"/>
    <text x="756" y="138" stroke="none" font-size="10" text-anchor="end" fill="var(--vp-c-danger-1)">never writes a definition file · never dispatches a unit</text>
    <rect x="30" y="176" width="730" height="424" rx="6" fill="none" stroke-width="1.5"/>
    <text x="46" y="198" font-weight="600" stroke="none">INSTANCE</text>
    <text x="126" y="198" stroke="none" fill="var(--vp-c-text-2)">one repository under the control plane</text>
    <rect x="46" y="212" width="330" height="40" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
    <text x="56" y="229" stroke="none" font-weight="600">S5</text>
    <text x="80" y="229" stroke="none">identity files <tspan fill="var(--vp-c-brand-1)">+ advice files</tspan>, write-protected</text>
    <text x="80" y="244" stroke="none" font-size="11" fill="var(--vp-c-text-2)">write gate · bash watch · identity-untouched at closeout</text>
    <rect x="430" y="212" width="190" height="40" rx="20" fill="none" stroke-width="1.5"/>
    <text x="525" y="236" stroke="none" text-anchor="middle">a person (<tspan font-family="var(--vp-font-family-mono)">actAsS5</tspan>)</text>
    <line x1="430" y1="232" x2="378" y2="232" stroke-width="1.5" marker-end="url(#a-arrow)"/>
    <text x="404" y="226" stroke="none" font-size="10" text-anchor="middle" fill="var(--vp-c-text-2)">accept</text>
    <text x="404" y="262" stroke="none" font-size="10" text-anchor="middle" fill="var(--vp-c-text-2)">the only writer</text>
    <text x="404" y="276" stroke="none" font-size="10" text-anchor="middle" fill="var(--vp-c-brand-1)">+ <tspan font-family="var(--vp-font-family-mono)">advice accept</tspan></text>
    <rect x="46" y="290" width="574" height="40" rx="3" fill="none" stroke-width="1.5"/>
    <text x="56" y="314" stroke="none" font-weight="600">S3</text>
    <text x="80" y="314" stroke="none">the loop: contract → dispatch → verify → route → close; budgets; recovery policy</text>
    <rect x="46" y="372" width="130" height="44" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
    <rect x="190" y="372" width="130" height="44" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
    <rect x="334" y="372" width="160" height="44" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2" stroke-dasharray="4 3"/>
    <text x="56" y="389" stroke="none" font-weight="600">S1</text><text x="78" y="389" stroke="none">unit u1</text>
    <text x="56" y="405" stroke="none" font-size="11" fill="var(--vp-c-text-2)">implement · worktree</text>
    <text x="200" y="389" stroke="none" font-weight="600">S1</text><text x="222" y="389" stroke="none">unit u2</text>
    <text x="200" y="405" stroke="none" font-size="11" fill="var(--vp-c-text-2)">implement · worktree</text>
    <text x="344" y="389" stroke="none" font-weight="600">S4</text><text x="366" y="389" stroke="none">research unit</text>
    <text x="344" y="405" stroke="none" font-size="11" fill="var(--vp-c-text-2)">read-only · one question</text>
    <text x="46" y="440" stroke="none" font-size="11" fill="var(--vp-c-text-2)">S2: leases, worktree isolation, reintegration, thrash detector</text>
    <line x1="111" y1="330" x2="111" y2="370" stroke-width="1.2" marker-end="url(#a-arrow)"/>
    <line x1="255" y1="330" x2="255" y2="370" stroke-width="1.2" marker-end="url(#a-arrow)"/>
    <line x1="409" y1="330" x2="409" y2="370" stroke-width="1.2" marker-end="url(#a-arrow)"/>
    <text x="118" y="352" stroke="none" font-size="10" fill="var(--vp-c-text-2)">dispatch</text>
    <rect x="520" y="372" width="200" height="44" rx="3" fill="none" stroke-width="1.5"/>
    <text x="620" y="389" stroke="none" text-anchor="middle">router → obligations</text>
    <text x="620" y="405" stroke="none" text-anchor="middle" font-size="11" fill="var(--vp-c-text-2)">routing policy · floors · veto</text>
    <line x1="494" y1="394" x2="518" y2="394" stroke-width="1.5" marker-end="url(#a-arrow)"/>
    <text x="506" y="366" stroke="none" font-size="10" text-anchor="middle" fill="var(--vp-c-text-2)">report_intelligence</text>
    <path d="M 620 372 L 620 330" stroke-width="1.5" marker-end="url(#a-arrow)"/>
    <text x="628" y="352" stroke="none" font-size="10" fill="var(--vp-c-text-2)">obligation holds the unit</text>
    <text x="520" y="432" stroke="none" font-size="10" fill="var(--vp-c-brand-1)">+ a <tspan font-family="var(--vp-font-family-mono)">harness-edit</tspan>: an obligation owed to S5</text>
    <path d="M 255 416 L 255 470 L 740 470 L 740 232 L 622 232" stroke-width="1.2" stroke-dasharray="5 4" fill="none" marker-end="url(#a-arrow)"/>
    <text x="262" y="462" stroke="none" font-size="10" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">propose_policy_change</tspan> → obligation owed to S5; changes nothing</text>
    <path d="M 300 416 L 300 448 L 600 448 L 600 498" stroke-width="1.2" stroke-dasharray="5 4" fill="none" marker-end="url(#a-arrow)"/>
    <text x="606" y="444" stroke="none" font-size="10" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">remember</tspan></text>
    <rect x="46" y="500" width="450" height="40" rx="3" fill="none" stroke-width="1.5"/>
    <text x="56" y="517" stroke="none" font-weight="600">S3*</text>
    <text x="84" y="517" stroke="none">host checks at the revision → evidence → closeout gate</text>
    <text x="84" y="532" stroke="none" font-size="11" fill="var(--vp-c-text-2)">inherited-tests · identity-untouched · export-signature · glossary-lint</text>
    <line x1="111" y1="416" x2="111" y2="498" stroke-width="1.2" marker-end="url(#a-arrow)"/>
    <text x="118" y="482" stroke="none" font-size="10" fill="var(--vp-c-text-2)">branch at HEAD</text>
    <rect x="520" y="500" width="200" height="40" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
    <text x="620" y="517" stroke="none" text-anchor="middle">operational memory</text>
    <text x="620" y="532" stroke="none" text-anchor="middle" font-size="11" fill="var(--vp-c-text-2)">facts, provenance, expiry ≤ 90 d</text>
    <text x="46" y="584" stroke="none" font-size="11" fill="var(--vp-c-text-2)">Every edge inside the instance is typed, stamped by the host, and recorded on a card with its limitations.</text>
    <rect x="780" y="176" width="230" height="290" rx="6" fill="none" stroke-width="1.5" stroke-dasharray="1 4" stroke-linecap="round"/>
    <text x="796" y="198" font-weight="600" stroke="none">RECORDS</text>
    <text x="796" y="214" stroke="none" font-size="11" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">.regulator/</tspan>, append-only</text>
    <text x="796" y="246" stroke="none">execution store</text>
    <text x="796" y="268" stroke="none">regulatory log (signals)</text>
    <text x="796" y="290" stroke="none">audit log (evidence)</text>
    <text x="796" y="312" stroke="none">memory · outbox</text>
    <text x="796" y="334" stroke="none">effect journal</text>
    <text x="796" y="356" stroke="none">spans (OpenTelemetry)</text>
    <text x="796" y="378" stroke="none">eval reports + interpretation</text>
    <text x="796" y="396" stroke="none" font-size="10" fill="var(--vp-c-brand-1)">+ predictions, resolved at their horizons</text>
    <text x="796" y="430" stroke="none" font-size="11" fill="var(--vp-c-text-2)">read by <tspan font-family="var(--vp-font-family-mono)">status</tspan>, the control room,</text>
    <text x="796" y="445" stroke="none" font-size="11" fill="var(--vp-c-text-2)">the eval harness, a person.</text>
    <line x1="760" y1="300" x2="778" y2="300" stroke-width="1.5" marker-end="url(#a-arrow)"/>
    <text x="769" y="292" stroke="none" font-size="10" text-anchor="middle" fill="var(--vp-c-text-2)">writes</text>
    <line x1="850" y1="176" x2="850" y2="118" stroke="var(--vp-c-brand-1)" stroke-width="2" marker-end="url(#a-arrow-accent)"/>
    <text x="856" y="150" stroke="none" font-size="10" fill="var(--vp-c-brand-1)">reads, read-only</text>
    <line x1="960" y1="116" x2="960" y2="174" stroke="var(--vp-c-brand-1)" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#a-arrow-accent)"/>
    <text x="966" y="150" stroke="none" font-size="10" fill="var(--vp-c-brand-1)">appends</text>
    <rect x="780" y="496" width="230" height="78" rx="6" fill="none" stroke-width="1.5"/>
    <text x="792" y="518" font-weight="600" stroke="none">EVAL HARNESS</text>
    <text x="888" y="518" stroke="none" font-size="10.5" fill="var(--vp-c-text-2)">S3* one level up</text>
    <text x="792" y="536" stroke="none" font-size="10.5" fill="var(--vp-c-text-2)">arms · ablation · graders · intervals</text>
    <text x="792" y="552" stroke="none" font-size="10.5" fill="var(--vp-c-text-2)">a report needs a person's interpretation</text>
    <text x="792" y="568" stroke="none" font-size="10.5" fill="var(--vp-c-brand-1)">+ the probe: an arm per advice edit</text>
    <line x1="900" y1="496" x2="900" y2="468" stroke-width="1.2" marker-end="url(#a-arrow)"/>
    <text x="906" y="486" stroke="none" font-size="10" fill="var(--vp-c-text-2)">reports</text>
  </g>
</svg>
<figcaption><b>Proposed.</b> The same picture. Every box and edge from the first figure is still there, in the same place; what the design adds is drawn in the accent colour and marked with a plus. The S4 slot gains the reflector, which reads the records and appends to them. The definition gains an advice seed; the instance gains advice files beside identity, an <code>advice accept</code> command beside <code>identity accept</code>, and an <code>advice promote</code> edge beside <code>identity promote</code>. The records gain predictions that resolve at their horizons, the eval harness gains a probe arm, and the obligation a proposal becomes gains the <code>harness-edit</code> kind. The two crossed marks are what the reflector can never do: write a definition file, dispatch a unit.</figcaption>
</figure>

## What a person sees

The additions are small on the surface, which is the point: the new work lands in commands and records that already exist.

- `regulator obligations` lists a `harness-edit` proposal like any other obligation, with the trajectory moment it cites, the arm it was probed in and the report's interpretation.
- `regulator advice accept <obligation> --file … --by …` is the only writer of an advice file. `reject` changes nothing. `promote` carries an accepted instance file back into the definition's seed, the way `identity promote` does.
- `regulator check` shows the reflector's instrument card, its mechanism level (model judgment) and the date of its last calibration report.

## What Harness² does here that this refuses

Harness²'s composer adopts: the edge that a person holds in the second figure is a model's there. Its guardrails are an editable component, where here they are the identity row, which no proposal path reaches except through a person. Its lessons are edits to the harness; here a lesson is a memory fact or a proposal. Its judge is the executor's own model family; here the probe's graders are deterministic and the interpretation is a person's. The dependency direction follows: the reflector depends on `protocol`, `core` and the status read model, and nothing depends on the reflector, the same posture the control room has.

## What changes, at what level

| Change | Mechanism level | Seam | Refuses |
| --- | --- | --- | --- |
| **Landed (#110, slice 1).** The accept-path split on `BOUNDARY.md`: every file proposable; identity lands through `identity accept`, advice through `advice accept` (advice is a file set seeded like identity, and `DEFINITION_WRITERS` declares the three classes), code and grants (unit types, profile grants, checks, extensions) through a merged change that a person makes, with the unit-under-a-contract form of that path still to come | 2, the definition check | `regulator check` over the definition's directories; the gates derive their protected set from the list | a definition directory in no class; a `--file` that is not the one a proposal named |
| The `harness-edit` proposal kind: a diagnosis (what was observed, by reference), a change (the diff) and a prediction (which metric, against which baseline, over which horizon, and which value would count against it), kept as three records because a trace that supports a diagnosis is not evidence that the remedy works | 3, typed tool and schema | `protocol`; routed like every proposal | a proposal whose observation does not resolve, or whose prediction is missing a part |
| A proposed edit probed as an eval arm | 2, deterministic graders | an eval suite's arms gain an `advice` field | adoption from a report without an interpretation |
| `regulator advice accept` | 2, the authority check, then the write | beside `identity accept`; disposition authority per person | any file but an advice file |
| The instrument record kind | 2, the registry check | the registry, a second record kind beside regulators | an instrument without a calibration report |
| The reflector package | 4, model judgment | reads `.regulator/` and the reports; depends on `protocol` and `core`; nothing depends on it | dispatching, dispositioning, writing under `regulator/` |

The boundary split came first, because every other row names it; it landed as slice 1
of the [accept-path note](../research/2026-10-18-accept-path-split.md). The prediction
record is next. The probe arm and the instrument card wait on the first live eval
report, since a calibration report needs live numbers to calibrate against. The thread's current step is on the
[roadmap](/project/roadmap#threads--designed-not-yet-scheduled).

## About these figures

They are drawn by hand, which the project otherwise avoids: the docs never carry a
second copy of what the code states, and the [figures
thread](../research/2026-09-25-open-questions.md#1-the-control-room-should-show-how-the-declared-system-connects)
decided that a generator over the definition is the only author of a figure. The
"before" figure is the first one that generator must reproduce, from the registry's
channels, enforcement points and stores. When it does, this page shows the generated
figure and the hand-drawn one becomes history in the research note.
