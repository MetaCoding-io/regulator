# What's coming

This page is a picture of one thing the project has designed and not yet built, so a
reader can see what would change before it changes. The order of work is the
[roadmap](/project/roadmap); the design, with its sources and its hazards, is the
research note [*Harness² read through the control
plane*](../research/2026-10-18-harness2-recursive-harnessing.md). Nothing here is
shipped, and nothing here is a promise of a date.

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
person accepts it with a `definition accept` command that is the only writer of an
advice file. The reflector never writes a definition file, never dispatches a unit and
never dispositions an obligation, because it has no tool that does.

It is registered as an **instrument**, not a regulator: a record kind for things that
inform rather than refuse, graded on calibration. Its question is whether the proposals
a person accepted moved the metric they named. `regulator check` refuses an instrument
without a calibration report the way it refuses a regulator without a limitation.

The name was chosen over "improver" because the card has to be able to say "did not
improve" without contradicting itself. The nearest published system, Google's Harness²,
has the same component under the same name; what it does with the component's output is
the difference the figures below draw.

## Before

<figure>
<svg style="max-width:100%;height:auto;font-family:inherit;min-width:860px" viewBox="0 0 1040 640" role="img" aria-label="The instance is regulated: S3 loop dispatches units, host checks produce evidence, a research unit reports intelligence into an obligation, a person is the only writer of identity, and a person promotes decisions back into the definition. The definition above it is changed only by people, and nothing reads the instance's records back into it except an eval report a person interprets.">
  <defs>
    <marker id="a1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker>
  </defs>
  <g font-size="12" fill="currentColor" stroke="currentColor">
    <!-- DEFINITION band -->
    <rect x="30" y="20" width="980" height="96" rx="6" fill="none" stroke-width="1.5"/>
    <text x="46" y="42" font-weight="600" stroke="none">DEFINITION</text>
    <text x="140" y="42" stroke="none" fill="var(--vp-c-text-2)">versioned, checked by <tspan font-family="var(--vp-font-family-mono)">regulator check</tspan>, changed by people, shipped as a package</text>
    <g stroke-width="1.2">
      <rect x="46" y="58" width="128" height="34" rx="3" fill="var(--vp-c-bg-soft)"/>
      <rect x="186" y="58" width="128" height="34" rx="3" fill="var(--vp-c-bg-soft)"/>
      <rect x="326" y="58" width="128" height="34" rx="3" fill="var(--vp-c-bg-soft)"/>
      <rect x="466" y="58" width="128" height="34" rx="3" fill="var(--vp-c-bg-soft)"/>
      <rect x="606" y="58" width="128" height="34" rx="3" fill="var(--vp-c-bg-soft)"/>
      <rect x="746" y="58" width="128" height="34" rx="3" fill="var(--vp-c-bg-soft)"/>
    </g>
    <g stroke="none" text-anchor="middle">
      <text x="110" y="79">registry (43 cards)</text>
      <text x="250" y="79">identity seed</text>
      <text x="390" y="79">profiles</text>
      <text x="530" y="79">policies</text>
      <text x="670" y="79">workloads</text>
      <text x="810" y="79">evals</text>
    </g>
    <text x="886" y="72" stroke="none" font-size="11" fill="var(--vp-c-text-2)">its own S4 today:</text>
    <text x="886" y="86" stroke="none" font-size="11" fill="var(--vp-c-text-2)">a person's checklist</text>

    <!-- init arrow -->
    <line x1="110" y1="116" x2="110" y2="176" stroke-width="1.5" marker-end="url(#a1)"/>
    <text x="118" y="150" stroke="none" font-size="11" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">regulator init</tspan> seeds</text>
    <!-- promote arrow -->
    <line x1="250" y1="212" x2="250" y2="94" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#a1)"/>
    <text x="258" y="150" stroke="none" font-size="11" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">identity promote</tspan> (a person)</text>

    <!-- INSTANCE box -->
    <rect x="30" y="176" width="730" height="444" rx="6" fill="none" stroke-width="1.5"/>
    <text x="46" y="198" font-weight="600" stroke="none">INSTANCE</text>
    <text x="126" y="198" stroke="none" fill="var(--vp-c-text-2)">one repository under the control plane</text>

    <!-- S5 -->
    <rect x="46" y="212" width="330" height="40" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
    <text x="56" y="229" stroke="none" font-weight="600">S5</text>
    <text x="80" y="229" stroke="none">identity files, write-protected</text>
    <text x="80" y="244" stroke="none" font-size="11" fill="var(--vp-c-text-2)">write gate · bash watch · identity-untouched at closeout</text>
    <!-- person -->
    <rect x="430" y="212" width="190" height="40" rx="20" fill="none" stroke-width="1.5"/>
    <text x="525" y="236" stroke="none" text-anchor="middle">a person (<tspan font-family="var(--vp-font-family-mono)">actAsS5</tspan>)</text>
    <line x1="430" y1="232" x2="378" y2="232" stroke-width="1.5" marker-end="url(#a1)"/>
    <text x="404" y="226" stroke="none" font-size="10" text-anchor="middle" fill="var(--vp-c-text-2)">accept</text>
    <text x="404" y="262" stroke="none" font-size="10" text-anchor="middle" fill="var(--vp-c-text-2)">the only writer</text>

    <!-- S3 loop -->
    <rect x="46" y="290" width="574" height="40" rx="3" fill="none" stroke-width="1.5"/>
    <text x="56" y="314" stroke="none" font-weight="600">S3</text>
    <text x="80" y="314" stroke="none">the loop: contract → dispatch → verify → route → close; budgets; recovery policy</text>

    <!-- S1 units -->
    <g stroke-width="1.2">
      <rect x="46" y="372" width="130" height="44" rx="3" fill="var(--vp-c-bg-soft)"/>
      <rect x="190" y="372" width="130" height="44" rx="3" fill="var(--vp-c-bg-soft)"/>
      <rect x="334" y="372" width="160" height="44" rx="3" fill="var(--vp-c-bg-soft)" stroke-dasharray="4 3"/>
    </g>
    <g stroke="none">
      <text x="56" y="389" font-weight="600">S1</text><text x="78" y="389">unit u1</text>
      <text x="56" y="405" font-size="11" fill="var(--vp-c-text-2)">implement · worktree</text>
      <text x="200" y="389" font-weight="600">S1</text><text x="222" y="389">unit u2</text>
      <text x="200" y="405" font-size="11" fill="var(--vp-c-text-2)">implement · worktree</text>
      <text x="344" y="389" font-weight="600">S4</text><text x="366" y="389">research unit</text>
      <text x="344" y="405" font-size="11" fill="var(--vp-c-text-2)">read-only · one question</text>
    </g>
    <text x="46" y="440" stroke="none" font-size="11" fill="var(--vp-c-text-2)">S2: leases, worktree isolation, reintegration, thrash detector</text>
    <!-- dispatch arrows -->
    <line x1="111" y1="330" x2="111" y2="370" stroke-width="1.2" marker-end="url(#a1)"/>
    <line x1="255" y1="330" x2="255" y2="370" stroke-width="1.2" marker-end="url(#a1)"/>
    <line x1="409" y1="330" x2="409" y2="370" stroke-width="1.2" marker-end="url(#a1)"/>
    <text x="118" y="352" stroke="none" font-size="10" fill="var(--vp-c-text-2)">dispatch</text>

    <!-- router -->
    <rect x="520" y="372" width="200" height="44" rx="3" fill="none" stroke-width="1.5"/>
    <text x="620" y="389" stroke="none" text-anchor="middle">router → obligations</text>
    <text x="620" y="405" stroke="none" text-anchor="middle" font-size="11" fill="var(--vp-c-text-2)">routing policy · floors · veto</text>
    <line x1="494" y1="394" x2="518" y2="394" stroke-width="1.5" marker-end="url(#a1)"/>
    <text x="506" y="366" stroke="none" font-size="10" text-anchor="middle" fill="var(--vp-c-text-2)">report_intelligence</text>
    <path d="M 620 372 L 620 330" stroke-width="1.5" marker-end="url(#a1)"/>
    <text x="628" y="352" stroke="none" font-size="10" fill="var(--vp-c-text-2)">obligation holds the unit</text>
    <!-- proposal -->
    <path d="M 255 416 L 255 470 L 740 470 L 740 232 L 622 232" stroke-width="1.2" stroke-dasharray="5 4" fill="none" marker-end="url(#a1)"/>
    <text x="262" y="462" stroke="none" font-size="10" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">propose_policy_change</tspan> → obligation owed to S5; changes nothing</text>

    <!-- S3* -->
    <rect x="46" y="500" width="450" height="40" rx="3" fill="none" stroke-width="1.5"/>
    <text x="56" y="517" stroke="none" font-weight="600">S3*</text>
    <text x="84" y="517" stroke="none">host checks at the revision → evidence → closeout gate</text>
    <text x="84" y="532" stroke="none" font-size="11" fill="var(--vp-c-text-2)">inherited-tests · identity-untouched · export-signature · glossary-lint</text>
    <line x1="111" y1="416" x2="111" y2="498" stroke-width="1.2" marker-end="url(#a1)"/>
    <text x="118" y="482" stroke="none" font-size="10" fill="var(--vp-c-text-2)">branch at HEAD</text>
    <!-- memory -->
    <rect x="520" y="500" width="200" height="40" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
    <text x="620" y="517" stroke="none" text-anchor="middle">operational memory</text>
    <text x="620" y="532" stroke="none" text-anchor="middle" font-size="11" fill="var(--vp-c-text-2)">facts, provenance, expiry ≤ 90 d</text>
    <path d="M 300 416 L 300 448 L 600 448 L 600 498" stroke-width="1.2" stroke-dasharray="5 4" fill="none" marker-end="url(#a1)"/>
    <text x="606" y="444" stroke="none" font-size="10" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">remember</tspan></text>
    <text x="46" y="600" stroke="none" font-size="11" fill="var(--vp-c-text-2)">Every edge inside the instance is typed, stamped by the host, and recorded on a card with its limitations.</text>

    <!-- RECORDS column -->
    <rect x="790" y="176" width="220" height="300" rx="6" fill="none" stroke-width="1.5" stroke-dasharray="1 4" stroke-linecap="round"/>
    <text x="806" y="198" font-weight="600" stroke="none">RECORDS</text>
    <text x="806" y="214" stroke="none" font-size="11" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">.regulator/</tspan>, append-only</text>
    <g stroke="none" font-size="12">
      <text x="806" y="246">execution store</text>
      <text x="806" y="268">regulatory log (signals)</text>
      <text x="806" y="290">audit log (evidence)</text>
      <text x="806" y="312">memory · outbox</text>
      <text x="806" y="334">effect journal</text>
      <text x="806" y="356">spans (OpenTelemetry)</text>
      <text x="806" y="378">eval reports + interpretation</text>
    </g>
    <line x1="760" y1="300" x2="788" y2="300" stroke-width="1.5" marker-end="url(#a1)"/>
    <text x="774" y="292" stroke="none" font-size="10" text-anchor="middle" fill="var(--vp-c-text-2)">writes</text>
    <text x="806" y="420" stroke="none" font-size="11" fill="var(--vp-c-text-2)">read by: <tspan font-family="var(--vp-font-family-mono)">status</tspan>, the control room,</text>
    <text x="806" y="435" stroke="none" font-size="11" fill="var(--vp-c-text-2)">the eval harness, a person.</text>
    <text x="806" y="458" stroke="none" font-size="11" fill="var(--vp-c-danger-1)">Nothing reads them to change</text>
    <text x="806" y="472" stroke="none" font-size="11" fill="var(--vp-c-danger-1)">the definition.</text>
    <!-- report to definition by hand -->
    <path d="M 900 176 L 900 118" stroke-width="1.2" stroke-dasharray="2 4" marker-end="url(#a1)"/>
    <text x="906" y="150" stroke="none" font-size="10" fill="var(--vp-c-text-2)">a person edits a card</text>
  </g>
</svg>
<figcaption><b>Today.</b> One recursion level is regulated. Inside the instance every edge is typed, stamped by the host and recorded on a card. The level above has people for S3, S3* and S5, and a checklist for S4. The records flow out and are read for status, evals and audit; no mechanism carries what they say back up.</figcaption>
</figure>

## After

<figure>
<svg style="max-width:100%;height:auto;font-family:inherit;min-width:860px" viewBox="0 0 1040 720" role="img" aria-label="A second level is drawn above the instances. Its S1 units are instances, its S3* is the existing eval harness, its S5 is the maintainers with the identity seed and a boundary split, and its S4 is a new reflector that reads every instance's records and emits three existing record kinds: memory facts, intelligence signals, and harness-edit proposals owed to S5. A proposed edit is probed as an eval arm before a person accepts it into an advice file. Crossed edges show the reflector never writing identity, grants or checks and never scheduling a unit.">
  <defs>
    <marker id="a2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker>
    <marker id="a2acc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--vp-c-brand-1)"/></marker>
    <marker id="x2" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="10" markerHeight="10" orient="auto"><path d="M2 2L8 8M8 2L2 8" stroke="var(--vp-c-danger-1)" stroke-width="1.8" fill="none"/></marker>
  </defs>
  <g font-size="12" fill="currentColor" stroke="currentColor">
    <!-- level frame -->
    <rect x="30" y="20" width="980" height="440" rx="6" fill="none" stroke-width="1.5"/>
    <text x="46" y="42" font-weight="600" stroke="none">LEVEL n+1</text>
    <text x="128" y="42" stroke="none" fill="var(--vp-c-text-2)">the definition as a viable system</text>

    <!-- probe edge, over the top row -->
    <path d="M 330 66 L 330 54 L 830 54 L 830 64" stroke="var(--vp-c-brand-1)" stroke-width="2" stroke-dasharray="5 4" fill="none" marker-end="url(#a2acc)"/>
    <text x="820" y="46" stroke="none" font-size="10" text-anchor="end" fill="var(--vp-c-brand-1)">probe: the proposed edit runs as an eval arm against the fixture</text>

    <!-- S5 -->
    <rect x="46" y="66" width="320" height="78" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
    <text x="56" y="84" stroke="none" font-weight="600">S5</text>
    <text x="80" y="84" stroke="none">maintainers · identity seed · <tspan font-family="var(--vp-font-family-mono)">BOUNDARY.md</tspan></text>
    <text x="56" y="102" stroke="none" font-size="11" fill="var(--vp-c-text-2)">never editable by a loop: identity, profile grants, checks</text>
    <text x="56" y="117" stroke="none" font-size="11" fill="var(--vp-c-text-2)">proposable: advice files, skills, memory</text>
    <text x="56" y="132" stroke="none" font-size="11" fill="var(--vp-c-text-2)">declared, not learned: unit types, extensions</text>

    <!-- S3 -->
    <rect x="386" y="66" width="260" height="78" rx="3" fill="none" stroke-width="1.5"/>
    <text x="396" y="84" stroke="none" font-weight="600">S3</text>
    <text x="420" y="84" stroke="none">maintainers</text>
    <text x="396" y="102" stroke="none" font-size="11" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">regulator doctor</tspan> under CI</text>
    <text x="396" y="117" stroke="none" font-size="11" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">review --due</tspan>, releases, <tspan font-family="var(--vp-font-family-mono)">init</tspan> / <tspan font-family="var(--vp-font-family-mono)">upgrade</tspan></text>
    <text x="396" y="132" stroke="none" font-size="11" fill="var(--vp-c-text-2)">dispositions on what the reflector raises</text>

    <!-- S3* -->
    <rect x="666" y="66" width="328" height="78" rx="3" fill="none" stroke-width="1.5"/>
    <text x="676" y="84" stroke="none" font-weight="600">S3*</text>
    <text x="706" y="84" stroke="none">eval harness (exists)</text>
    <text x="676" y="102" stroke="none" font-size="11" fill="var(--vp-c-text-2)">arms · ablation · deterministic graders · intervals</text>
    <text x="676" y="117" stroke="none" font-size="11" fill="var(--vp-c-text-2)">report refused without a person's interpretation</text>
    <text x="676" y="132" stroke="none" font-size="11" fill="var(--vp-c-brand-1)">+ an arm may differ in an advice file</text>

    <!-- report returns to S5 -->
    <path d="M 690 144 L 690 172 L 236 172 L 236 146" stroke="var(--vp-c-brand-1)" stroke-width="1.2" fill="none" marker-end="url(#a2acc)"/>
    <text x="700" y="186" stroke="none" font-size="10" text-anchor="end" fill="var(--vp-c-brand-1)">report + interpretation</text>
    <!-- accept: S5 -> definition files -->
    <line x1="206" y1="144" x2="206" y2="196" stroke="var(--vp-c-brand-1)" stroke-width="2" marker-end="url(#a2acc)"/>
    <text x="198" y="162" stroke="none" font-size="10" text-anchor="end" fill="var(--vp-c-brand-1)"><tspan font-family="var(--vp-font-family-mono)">definition accept</tspan> (a person)</text>
    <text x="198" y="176" stroke="none" font-size="10" text-anchor="end" fill="var(--vp-c-brand-1)">writes an advice file</text>
    <!-- proposal: reflector -> S5 -->
    <path d="M 386 212 L 320 212 L 320 146" stroke="var(--vp-c-brand-1)" stroke-width="2" fill="none" marker-end="url(#a2acc)"/>
    <text x="326" y="192" stroke="none" font-size="10" fill="var(--vp-c-brand-1)"><tspan font-family="var(--vp-font-family-mono)">harness-edit</tspan> proposal → obligation owed to S5</text>

    <!-- definition files (domain of this level) -->
    <rect x="46" y="198" width="320" height="78" rx="3" fill="none" stroke-width="1.5" stroke-dasharray="5 4"/>
    <text x="56" y="218" stroke="none" font-weight="600">DEFINITION FILES</text>
    <text x="180" y="218" stroke="none" fill="var(--vp-c-text-2)">the domain</text>
    <text x="56" y="238" stroke="none" font-size="11">advice files: profile advice, contract advice, skills</text>
    <text x="56" y="256" stroke="none" font-size="11" fill="var(--vp-c-text-2)">identity seed, grants, checks, registry cards</text>
    <text x="56" y="270" stroke="none" font-size="11" fill="var(--vp-c-text-2)">written only by <tspan font-family="var(--vp-font-family-mono)">identity promote</tspan> or a release</text>

    <!-- S4 reflector -->
    <rect x="386" y="198" width="608" height="78" rx="3" fill="var(--vp-c-brand-soft)" stroke="var(--vp-c-brand-1)" stroke-width="2"/>
    <text x="396" y="218" stroke="none" font-weight="600" fill="var(--vp-c-brand-1)">S4</text>
    <text x="422" y="218" stroke="none" font-weight="600">reflector</text>
    <text x="490" y="218" stroke="none" fill="var(--vp-c-text-2)">a package beside <tspan font-family="var(--vp-font-family-mono)">checks</tspan>; or a <tspan font-family="var(--vp-font-family-mono)">reflect</tspan> unit with a contract, a budget and a lease</text>
    <text x="396" y="238" stroke="none" font-size="11">reads the records of every instance; writes three record kinds that already exist; adopts nothing</text>
    <text x="396" y="256" stroke="none" font-size="11" fill="var(--vp-c-text-2)">registered as an <tspan font-weight="600">instrument</tspan>, not a regulator: <tspan font-family="var(--vp-font-family-mono)">regulator check</tspan> refuses it without a calibration report</text>
    <text x="396" y="270" stroke="none" font-size="11" fill="var(--vp-c-text-2)">(did the proposals a person accepted move the metric they named?)</text>
    <!-- never writes a definition file -->
    <path d="M 386 262 L 372 262" stroke="var(--vp-c-danger-1)" stroke-width="1.5" fill="none" marker-end="url(#x2)"/>
    <text x="236" y="292" stroke="none" font-size="10" fill="var(--vp-c-danger-1)">never writes a definition file</text>

    <!-- S1 instances -->
    <text x="136" y="310" stroke="none" font-weight="600">S1</text>
    <text x="158" y="310" stroke="none" fill="var(--vp-c-text-2)">instances, each the whole of the figure above</text>
    <g stroke-width="1.2">
      <rect x="46" y="320" width="290" height="64" rx="3" fill="var(--vp-c-bg-soft)"/>
      <rect x="356" y="320" width="290" height="64" rx="3" fill="var(--vp-c-bg-soft)"/>
      <rect x="666" y="320" width="328" height="64" rx="3" fill="var(--vp-c-bg-soft)"/>
    </g>
    <g stroke="none">
      <text x="58" y="340">instance A</text><text x="58" y="357" font-size="11" fill="var(--vp-c-text-2)">S3 loop · units · router · memory</text><text x="58" y="373" font-size="11" fill="var(--vp-c-text-2)">identity files · host checks</text>
      <text x="368" y="340">instance B</text><text x="368" y="357" font-size="11" fill="var(--vp-c-text-2)">S3 loop · units · router · memory</text><text x="368" y="373" font-size="11" fill="var(--vp-c-text-2)">identity files · host checks</text>
      <text x="678" y="340">instance C</text><text x="678" y="357" font-size="11" fill="var(--vp-c-text-2)">S3 loop · units · router · memory</text><text x="678" y="373" font-size="11" fill="var(--vp-c-text-2)">identity files · host checks</text>
    </g>
    <!-- init/upgrade: definition files -> instances -->
    <line x1="120" y1="276" x2="120" y2="318" stroke-width="1.2" marker-end="url(#a2)"/>
    <text x="114" y="302" stroke="none" font-size="10" text-anchor="end" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">init</tspan> / <tspan font-family="var(--vp-font-family-mono)">upgrade</tspan></text>
    <!-- reflector -> instances -->
    <path d="M 440 276 L 440 318" stroke="var(--vp-c-brand-1)" stroke-width="1.5" stroke-dasharray="5 4" fill="none" marker-end="url(#a2acc)"/>
    <text x="446" y="292" stroke="none" font-size="10" fill="var(--vp-c-brand-1)"><tspan font-family="var(--vp-font-family-mono)">remember</tspan>: a fact, scoped, expiring</text>
    <text x="446" y="304" stroke="none" font-size="10" fill="var(--vp-c-brand-1)">rendered as advice to later units</text>
    <path d="M 640 276 L 640 318" stroke="var(--vp-c-danger-1)" stroke-width="1.5" fill="none" marker-end="url(#x2)"/>
    <text x="646" y="292" stroke="none" font-size="10" fill="var(--vp-c-danger-1)">never dispatches</text>
    <text x="646" y="304" stroke="none" font-size="10" fill="var(--vp-c-danger-1)">never dispositions</text>
    <path d="M 790 276 L 790 318" stroke="var(--vp-c-brand-1)" stroke-width="1.5" stroke-dasharray="5 4" fill="none" marker-end="url(#a2acc)"/>
    <text x="796" y="292" stroke="none" font-size="10" fill="var(--vp-c-brand-1)"><tspan font-family="var(--vp-font-family-mono)">intelligence-signal</tspan> → the router</text>
    <text x="796" y="304" stroke="none" font-size="10" fill="var(--vp-c-brand-1)">→ an obligation that may hold a unit</text>

    <!-- records strip -->
    <rect x="46" y="412" width="948" height="34" rx="3" fill="none" stroke-width="1.5" stroke-dasharray="1 4" stroke-linecap="round"/>
    <text x="56" y="433" stroke="none" font-weight="600">RECORDS</text>
    <text x="130" y="433" stroke="none" font-size="11" fill="var(--vp-c-text-2)">per instance, append-only: execution store · regulatory log · audit log · memory · effect journal · spans · eval reports</text>
    <line x1="191" y1="384" x2="191" y2="410" stroke-width="1.2" marker-end="url(#a2)"/>
    <line x1="501" y1="384" x2="501" y2="410" stroke-width="1.2" marker-end="url(#a2)"/>
    <line x1="830" y1="384" x2="830" y2="410" stroke-width="1.2" marker-end="url(#a2)"/>
    <text x="197" y="402" stroke="none" font-size="10" fill="var(--vp-c-text-2)">writes</text>
    <!-- records -> reflector (the new read) -->
    <path d="M 994 429 C 1024 429, 1024 237, 996 237" stroke="var(--vp-c-brand-1)" stroke-width="2" fill="none" marker-end="url(#a2acc)"/>
    <text x="1006" y="340" stroke="none" font-size="10" fill="var(--vp-c-brand-1)" transform="rotate(-90 1006 340)">reads, read-only</text>
    <!-- records -> S3* (exists) -->
    <path d="M 994 420 C 1016 420, 1016 118, 996 118" stroke-width="1.2" stroke-dasharray="2 4" fill="none" marker-end="url(#a2)"/>

    <!-- below the frame -->
    <text x="46" y="490" stroke="none" font-weight="600">What a person sees</text>
    <text x="46" y="510" stroke="none" font-size="12"><tspan font-family="var(--vp-font-family-mono)">regulator obligations</tspan>: a harness-edit proposal, the trajectory moment it cites, the arm it was probed in, and the report's interpretation.</text>
    <text x="46" y="530" stroke="none" font-size="12"><tspan font-family="var(--vp-font-family-mono)">regulator definition accept &lt;obligation&gt; --file … --by …</tspan>: the only writer of an advice file. <tspan font-family="var(--vp-font-family-mono)">reject</tspan> changes nothing.</text>
    <text x="46" y="550" stroke="none" font-size="12"><tspan font-family="var(--vp-font-family-mono)">regulator check</tspan>: the reflector's instrument card, its level (<tspan font-family="var(--vp-font-family-mono)">model-judgment</tspan>), and the date of its last calibration report.</text>

    <text x="46" y="594" stroke="none" font-weight="600">What Harness² does here that this refuses</text>
    <text x="46" y="614" stroke="none" font-size="12" fill="var(--vp-c-text-2)">Its composer adopts: the person's edge above is a model's. Its guardrails are an editable component: the identity row here.</text>
    <text x="46" y="632" stroke="none" font-size="12" fill="var(--vp-c-text-2)">Its lessons are edits to the harness: here they are memory or a proposal. Its judge is the executor's own model family:</text>
    <text x="46" y="650" stroke="none" font-size="12" fill="var(--vp-c-text-2)">here the probe's graders are deterministic and the interpretation is a person's.</text>
    <text x="46" y="684" stroke="none" font-size="11" fill="var(--vp-c-text-3)">Dependency direction: reflector → protocol, core, the status read model. Nothing depends on the reflector. Same posture as control-room.</text>
  </g>
</svg>
<figcaption><b>Proposed.</b> The same instances, with the level above drawn in. Four things are new, in the accent colour: the reflector, its read of the records, the <code>harness-edit</code> proposal kind, and an eval arm that may differ in an advice file. Crossed edges are refused by mechanism. Everything the reflector emits lands in a record kind that exists, and every write to the definition still goes through a person.</figcaption>
</figure>

## What changes, at what level

| Change | Mechanism level | Seam | Refuses |
| --- | --- | --- | --- |
| The advice split on `BOUNDARY.md`: never editable by a loop (identity, grants, checks); proposable (advice files, skills, memory); declared, not learned (unit types, extensions) | 2, the definition check | `regulator check` over the registry and the instance manifest | a proposal against a file outside the proposable set, at intake |
| The `harness-edit` proposal kind | 3, typed tool and schema | `protocol`; routed like every proposal | a proposal whose observation (unit, revision, moment) does not resolve |
| A proposed edit probed as an eval arm | 2, deterministic graders | an eval suite's arms gain an `advice` field | adoption from a report without an interpretation |
| `regulator definition accept` | 2, the authority check, then the write | beside `identity accept`; disposition authority per person | any file but an advice file |
| The instrument record kind | 2, the registry check | the registry, a second record kind beside regulators | an instrument without a calibration report |
| The reflector package | 4, model judgment | reads `.regulator/` and the reports; depends on `protocol` and `core`; nothing depends on it | dispatching, dispositioning, writing under `regulator/` |

The boundary split comes first, because every other row names it. The probe arm and
the instrument card wait on the first live eval report, since a calibration report needs
live numbers to calibrate against. The thread's current step is on the
[roadmap](/project/roadmap#threads--designed-not-yet-scheduled).

## About these figures

They are drawn by hand, which the project otherwise avoids: the docs never carry a
second copy of what the code states, and the [figures
thread](../research/2026-09-25-open-questions.md#1-the-control-room-should-show-how-the-declared-system-connects)
decided that a generator over the definition is the only author of a figure. The
"before" figure is the first one that generator must reproduce, from the registry's
channels, enforcement points and stores. When it does, this page shows the generated
figure and the hand-drawn one becomes history in the research note.
