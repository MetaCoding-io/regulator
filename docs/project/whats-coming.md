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
    <g transform="translate(-16 0)">
    <rect x="30" y="20" width="722" height="96" rx="6" fill="none" stroke-width="1.5"/>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-definition" aria-label="The definition" data-label="The definition" data-def="A versioned package of files: the registry, the identity seed, the profiles, the policies, the workloads and the evals. &lt;code&gt;regulator check&lt;/code&gt; holds it against the code, only people change it, and &lt;code&gt;regulator init&lt;/code&gt; seeds an instance from it." data-href="/concepts/definition-and-instance">
      <text x="46" y="42" font-weight="600" stroke="none">DEFINITION</text>
      <text x="140" y="42" stroke="none" fill="var(--vp-c-text-2)">versioned, checked by <tspan font-family="var(--vp-font-family-mono)">regulator check</tspan>, changed by people</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-registry" aria-label="Registry" data-label="Registry" data-def="One record per regulator: what it absorbs, its mechanism level, its evidence, its limitation, its ablation switch and its retirement condition. &lt;code&gt;REGULATORS.md&lt;/code&gt; and &lt;code&gt;BOUNDARY.md&lt;/code&gt; are rendered from the records." data-href="/concepts/control-plane#the-regulators">
      <rect x="46" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
      <text x="100" y="79" stroke="none" text-anchor="middle" font-size="11.5">registry (43)</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-identity-seed" aria-label="Identity seed" data-label="Identity seed" data-def="The &lt;code&gt;IDENTITY&lt;/code&gt;, &lt;code&gt;INVARIANTS&lt;/code&gt;, &lt;code&gt;GLOSSARY&lt;/code&gt; and &lt;code&gt;BOUNDARIES&lt;/code&gt; files an instance starts from. Copied into &lt;code&gt;regulator/identity/&lt;/code&gt; at init and write-protected from then on." data-href="/concepts/identity">
      <rect x="162" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
      <text x="216" y="79" stroke="none" text-anchor="middle" font-size="11.5">identity seed</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-profiles" aria-label="Capability profiles" data-label="Capability profiles" data-def="A named, bounded grant of tools and writable paths a unit runs under. Specialisation by grant, never by persona." data-href="/reference/definition">
      <rect x="278" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
      <text x="332" y="79" stroke="none" text-anchor="middle" font-size="11.5">profiles</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-policies" aria-label="Policies" data-label="Policies" data-def="Routing, budgets, recovery and interaction: the declared rules the loop and the router apply, each versioned so a decision can cite the version it used." data-href="/reference/definition">
      <rect x="394" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
      <text x="448" y="79" stroke="none" text-anchor="middle" font-size="11.5">policies</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-workloads" aria-label="Workloads" data-label="Workloads" data-def="A declared set of unit types for one kind of job, each a profile, a grant, a budget and a route. The loop stays the same; only the workload changes." data-href="/guide/authoring-a-workload">
      <rect x="510" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
      <text x="564" y="79" stroke="none" text-anchor="middle" font-size="11.5">workloads</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-evals" aria-label="Evals" data-label="Evals" data-def="The suites, arms and graders the eval harness runs, and the fifteen pre-registered metric names a report may use." data-href="/concepts/evidence-about-the-regulators">
      <rect x="626" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
      <text x="680" y="79" stroke="none" text-anchor="middle" font-size="11.5">evals</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-init" aria-label="regulator init seeds" data-label="&lt;code&gt;regulator init&lt;/code&gt; seeds" data-def="The one write from the definition into an instance: the identity files, the manifest and the stores are created from the package. From then on the instance's records are its own." data-href="/guide/getting-started">
      <line x1="80" y1="116" x2="80" y2="176" stroke-width="1.5" marker-end="url(#b-arrow)"/>
      <text x="86" y="150" stroke="none" font-size="10" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">regulator init</tspan> seeds</text>
      <path d="M 80 116 L 80 176" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-identity-promote" aria-label="identity promote" data-label="&lt;code&gt;identity promote&lt;/code&gt;" data-def="Carries an accepted identity change in an instance back into the definition's seed, so the next instance starts from it. Run by a person; a proposal never reaches the seed on its own." data-href="/concepts/identity#the-only-way-to-change-identity">
      <line x1="236" y1="212" x2="236" y2="94" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#b-arrow)"/>
      <text x="242" y="150" stroke="none" font-size="10" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">identity promote</tspan></text>
      <path d="M 236 212 L 236 94" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <rect x="30" y="176" width="722" height="424" rx="6" fill="none" stroke-width="1.5"/>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-instance" aria-label="An instance" data-label="An instance" data-def="One repository under the control plane: a &lt;code&gt;.regulator/&lt;/code&gt; directory of append-only records, an identity set, a manifest naming the definition version it was seeded from, and the loop running units against it." data-href="/reference/instance">
      <text x="46" y="198" font-weight="600" stroke="none">INSTANCE</text>
      <text x="126" y="198" stroke="none" fill="var(--vp-c-text-2)">one repository under the control plane</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-s5" aria-label="S5: identity files" data-label="S5: identity files" data-def="What the instance is: &lt;code&gt;IDENTITY&lt;/code&gt;, &lt;code&gt;INVARIANTS&lt;/code&gt;, &lt;code&gt;GLOSSARY&lt;/code&gt; and &lt;code&gt;BOUNDARIES&lt;/code&gt; under &lt;code&gt;regulator/identity/&lt;/code&gt;, rendered into every session and protected by three layers: the write gate, the bash watch and the identity-untouched check at closeout." data-href="/concepts/identity">
      <rect x="46" y="212" width="330" height="40" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
      <text x="56" y="229" stroke="none" font-weight="600">S5</text>
      <text x="80" y="229" stroke="none">identity files, write-protected</text>
      <text x="80" y="244" stroke="none" font-size="11" fill="var(--vp-c-text-2)">write gate · bash watch · identity-untouched at closeout</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-person" aria-label="A person acting as S5" data-label="A person acting as S5" data-def="The interaction policy names who may act as S5. That person is the only writer of an identity file, through &lt;code&gt;identity accept&lt;/code&gt;. &lt;code&gt;reject&lt;/code&gt; changes nothing, and silence is never consent." data-href="/concepts/asking-a-person">
      <rect x="430" y="212" width="190" height="40" rx="20" fill="none" pointer-events="all" stroke-width="1.5"/>
      <text x="525" y="236" stroke="none" text-anchor="middle">a person (<tspan font-family="var(--vp-font-family-mono)">actAsS5</tspan>)</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-accept" aria-label="accept" data-label="accept" data-def="&lt;code&gt;regulator identity accept &lt;obligation&gt; --by …&lt;/code&gt;: the authority check, then the write. The only path by which a proposal becomes identity." data-href="/concepts/identity#the-only-way-to-change-identity">
      <line x1="430" y1="232" x2="378" y2="232" stroke-width="1.5" marker-end="url(#b-arrow)"/>
      <text x="404" y="226" stroke="none" font-size="10" text-anchor="middle" fill="var(--vp-c-text-2)">accept</text>
      <text x="404" y="262" stroke="none" font-size="10" text-anchor="middle" fill="var(--vp-c-text-2)">the only writer</text>
      <path d="M 430 232 L 378 232" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-s3" aria-label="S3: the loop" data-label="S3: the loop" data-def="Contract, dispatch, verify, route, close. The orchestrator never edits code itself: it dispatches a session under a contract and a budget, verifies the work with host-run checks, routes by the versioned recovery policy and closes on the ledger." data-href="/concepts/control-plane#the-loop">
      <rect x="46" y="290" width="574" height="40" rx="3" fill="none" pointer-events="all" stroke-width="1.5"/>
      <text x="56" y="314" stroke="none" font-weight="600">S3</text>
      <text x="80" y="314" stroke="none">the loop: contract → dispatch → verify → route → close; budgets; recovery policy</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-s1" aria-label="S1: a unit" data-label="S1: a unit" data-def="The work that touches the repository: one contract, one session, one verdict. It runs in its own worktree under the &lt;code&gt;implement&lt;/code&gt; profile, and what it reports about itself is never evidence." data-href="/concepts/contracts">
      <rect x="46" y="372" width="130" height="44" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
      <text x="56" y="389" stroke="none" font-weight="600">S1</text><text x="78" y="389" stroke="none">unit u1</text>
      <text x="56" y="405" stroke="none" font-size="11" fill="var(--vp-c-text-2)">implement · worktree</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-s1" aria-label="S1: a unit" data-label="S1: a unit" data-def="The work that touches the repository: one contract, one session, one verdict. It runs in its own worktree under the &lt;code&gt;implement&lt;/code&gt; profile, and what it reports about itself is never evidence." data-href="/concepts/contracts">
      <rect x="190" y="372" width="130" height="44" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
      <text x="200" y="389" stroke="none" font-weight="600">S1</text><text x="222" y="389" stroke="none">unit u2</text>
      <text x="200" y="405" stroke="none" font-size="11" fill="var(--vp-c-text-2)">implement · worktree</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-s4-unit" aria-label="S4: a research unit" data-label="S4: a research unit" data-def="Intelligence at the instance level: a read-only profile, one question, a budget. It reports with &lt;code&gt;report_intelligence&lt;/code&gt; and cannot change anything itself." data-href="/concepts/intelligence-and-memory#intelligence">
      <rect x="334" y="372" width="160" height="44" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2" stroke-dasharray="4 3"/>
      <text x="344" y="389" stroke="none" font-weight="600">S4</text><text x="366" y="389" stroke="none">research unit</text>
      <text x="344" y="405" stroke="none" font-size="11" fill="var(--vp-c-text-2)">read-only · one question</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-s2" aria-label="S2: coordination" data-label="S2: coordination" data-def="Damping between units, as mechanism: leases, worktree isolation, reintegration checked on the merged tree, and a thrash detector that names an oscillation for S3 to decide." data-href="/concepts/coordination">
      <text x="46" y="440" stroke="none" font-size="11" fill="var(--vp-c-text-2)">S2: leases, worktree isolation, reintegration, thrash detector</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-dispatch" aria-label="dispatch" data-label="dispatch" data-def="A unit starts as an attempt: one claimed run against a revision, under its profile's grant, its budget ceilings and a lease on its worktree." data-href="/guide/running-units">
      <line x1="111" y1="330" x2="111" y2="370" stroke-width="1.2" marker-end="url(#b-arrow)"/>
      <line x1="255" y1="330" x2="255" y2="370" stroke-width="1.2" marker-end="url(#b-arrow)"/>
      <line x1="409" y1="330" x2="409" y2="370" stroke-width="1.2" marker-end="url(#b-arrow)"/>
      <text x="118" y="352" stroke="none" font-size="10" fill="var(--vp-c-text-2)">dispatch</text>
      <path d="M 111 330 L 111 370 M 255 330 L 255 370 M 409 330 L 409 370" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-router" aria-label="The router" data-label="The router" data-def="Turns a signal into obligations by the routing policy: which consumers it is owed to, the severity floors, and the veto that holds the units it names." data-href="/concepts/obligations">
      <rect x="520" y="372" width="176" height="44" rx="3" fill="none" pointer-events="all" stroke-width="1.5"/>
      <text x="608" y="389" stroke="none" text-anchor="middle">router → obligations</text>
      <text x="608" y="405" stroke="none" text-anchor="middle" font-size="11" fill="var(--vp-c-text-2)">routing policy · floors · veto</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-report" aria-label="report_intelligence" data-label="report_intelligence" data-def="The typed tool a research unit reports with. The signal lands in the regulatory log and goes to the router; it never goes straight to a unit." data-href="/concepts/intelligence-and-memory#intelligence">
      <line x1="494" y1="394" x2="518" y2="394" stroke-width="1.5" marker-end="url(#b-arrow)"/>
      <text x="506" y="366" stroke="none" font-size="10" text-anchor="middle" fill="var(--vp-c-text-2)">report_intelligence</text>
      <path d="M 494 394 L 518 394" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-holds" aria-label="obligation holds the unit" data-label="obligation holds the unit" data-def="At blocking severity an obligation pauses the units it names until S3 or a person dispositions it. Intelligence can stop work; it never replans on its own." data-href="/concepts/obligations">
      <path d="M 608 372 L 608 330" stroke-width="1.5" marker-end="url(#b-arrow)"/>
      <text x="616" y="352" stroke="none" font-size="10" fill="var(--vp-c-text-2)">obligation holds the unit</text>
      <path d="M 608 372 L 608 330" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-propose" aria-label="propose_policy_change" data-label="propose_policy_change" data-def="The tool a unit proposes a change to identity with. It opens an obligation owed to S5 and changes nothing by itself (INV-002)." data-href="/concepts/identity#the-only-way-to-change-identity">
      <path d="M 255 416 L 255 470 L 732 470 L 732 232 L 622 232" stroke-width="1.2" stroke-dasharray="5 4" fill="none" marker-end="url(#b-arrow)"/>
      <text x="262" y="462" stroke="none" font-size="10" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">propose_policy_change</tspan> → obligation owed to S5; changes nothing</text>
      <path d="M 255 416 L 255 470 L 732 470 L 732 232 L 622 232" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-remember" aria-label="remember" data-label="remember" data-def="The tool a unit records a fact with: provenance, scope and an expiry of at most ninety days. A fact is never identity, however often it is repeated." data-href="/concepts/intelligence-and-memory#operational-memory">
      <path d="M 300 416 L 300 448 L 600 448 L 600 498" stroke-width="1.2" stroke-dasharray="5 4" fill="none" marker-end="url(#b-arrow)"/>
      <text x="606" y="444" stroke="none" font-size="10" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">remember</tspan></text>
      <path d="M 300 416 L 300 448 L 600 448 L 600 498" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-s3star" aria-label="S3*: host checks" data-label="S3*: host checks" data-def="Independent verification: the host runs the checks itself at the exact revision and the closeout gate reads that evidence, never the unit's claim. Named here: the inherited tests, identity-untouched, the export signature and the glossary lint." data-href="/reference/host-checks">
      <rect x="46" y="500" width="450" height="40" rx="3" fill="none" pointer-events="all" stroke-width="1.5"/>
      <text x="56" y="517" stroke="none" font-weight="600">S3*</text>
      <text x="84" y="517" stroke="none">host checks at the revision → evidence → closeout gate</text>
      <text x="84" y="532" stroke="none" font-size="11" fill="var(--vp-c-text-2)">inherited-tests · identity-untouched · export-signature · glossary-lint</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-branch" aria-label="branch at HEAD" data-label="branch at HEAD" data-def="What S3* verifies is the unit's branch at the revision it reported, so the evidence is tied to a commit, not to a transcript." data-href="/reference/host-checks">
      <line x1="111" y1="416" x2="111" y2="498" stroke-width="1.2" marker-end="url(#b-arrow)"/>
      <text x="118" y="482" stroke="none" font-size="10" fill="var(--vp-c-text-2)">branch at HEAD</text>
      <path d="M 111 416 L 111 498" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-memory" aria-label="Operational memory" data-label="Operational memory" data-def="Facts for later units, each with provenance and an expiry, read into a session as advice. Retractable, and never promoted to identity by repetition." data-href="/concepts/intelligence-and-memory#operational-memory">
      <rect x="520" y="500" width="200" height="40" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
      <text x="620" y="517" stroke="none" text-anchor="middle">operational memory</text>
      <text x="620" y="532" stroke="none" text-anchor="middle" font-size="11" fill="var(--vp-c-text-2)">facts, provenance, expiry ≤ 90 d</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-typed" aria-label="Every edge is typed" data-label="Every edge is typed" data-def="Each channel inside the instance is a message kind in &lt;code&gt;protocol&lt;/code&gt; with a stated authority and destination, stamped by the host and recorded on a registry card with its limitation." data-href="/concepts/control-plane#typed-channels">
      <text x="46" y="584" stroke="none" font-size="11" fill="var(--vp-c-text-2)">Every edge inside the instance is typed, stamped by the host, and recorded on a card with its limitations.</text>
    </g>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-writes" aria-label="writes" data-label="writes" data-def="Every store is written by the host from inside the loop and the session's gates, never by a unit directly." data-href="/reference/instance">
      <line x1="736" y1="300" x2="794" y2="300" stroke-width="1.5" marker-end="url(#b-arrow)"/>
      <text x="765" y="292" stroke="none" font-size="10" text-anchor="middle" fill="var(--vp-c-text-2)">writes</text>
      <path d="M 734 300 L 796 300" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <g transform="translate(16 0)">
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-slot-today" aria-label="The definition's S4 today" data-label="The definition's S4 today" data-def="Watching how the system behaves and what it should do differently is a checklist a person runs: the Pi upgrade, the review dates, the open questions. Nothing models what the instances did." data-href="/project/whats-coming">
      <rect x="780" y="20" width="230" height="96" rx="6" fill="none" pointer-events="all" stroke-width="1.5" stroke-dasharray="5 4"/>
      <text x="792" y="42" font-weight="600" stroke="none">THE DEFINITION'S S4</text>
      <text x="792" y="62" stroke="none" font-size="10.5" fill="var(--vp-c-text-2)">today: a checklist a person runs</text>
      <text x="792" y="78" stroke="none" font-size="10.5" fill="var(--vp-c-text-2)">(the Pi upgrade, the review dates)</text>
      <text x="792" y="94" stroke="none" font-size="10.5" fill="var(--vp-c-text-2)">nothing models what the instance did</text>
    </g>
    <rect x="780" y="176" width="230" height="290" rx="6" fill="none" stroke-width="1.5" stroke-dasharray="1 4" stroke-linecap="round"/>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-records" aria-label="The records" data-label="The records" data-def="&lt;code&gt;.regulator/&lt;/code&gt;: append-only stores the host writes from inside the loop and the session's gates. The only thing &lt;code&gt;status&lt;/code&gt;, the control room and the eval harness read." data-href="/reference/instance">
      <text x="796" y="198" font-weight="600" stroke="none">RECORDS</text>
      <text x="796" y="214" stroke="none" font-size="11" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">.regulator/</tspan>, append-only</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-execution-store" aria-label="Execution store" data-label="Execution store" data-def="Units, attempts, leases and contracts: the authoritative work state, with the lifecycle transitions the store itself enforces." data-href="/reference/instance">
      <text x="796" y="246" stroke="none">execution store</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-regulatory-log" aria-label="Regulatory log" data-label="Regulatory log" data-def="Signals, the obligations they became, and every disposition, with the policy version each decision cited." data-href="/concepts/obligations">
      <text x="796" y="268" stroke="none">regulatory log (signals)</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-audit-log" aria-label="Audit log" data-label="Audit log" data-def="Host-run evidence and the verdicts drawn from it, each tied to the revision it was produced at." data-href="/reference/host-checks">
      <text x="796" y="290" stroke="none">audit log (evidence)</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-memory-outbox" aria-label="Memory and outbox" data-label="Memory and outbox" data-def="Facts with provenance and expiry; and what is owed to a person, delivered and reminded until answered." data-href="/concepts/intelligence-and-memory#operational-memory">
      <text x="796" y="312" stroke="none">memory · outbox</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-effect-journal" aria-label="Effect journal" data-label="Effect journal" data-def="An effect that cannot be taken back is intended before, committed after and reconciled against the world on restart, so a crash in between neither repeats it nor forgets it." data-href="/concepts/recovery">
      <text x="796" y="334" stroke="none">effect journal</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-spans" aria-label="Spans" data-label="Spans" data-def="Every store read as OpenTelemetry spans, so a trace viewer shows a unit's run without a second database." data-href="/reference/instance">
      <text x="796" y="356" stroke="none">spans (OpenTelemetry)</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-eval-reports" aria-label="Eval reports and interpretation" data-label="Eval reports and interpretation" data-def="A report from the eval harness and the interpretation a person wrote for it. A report without an interpretation adopts nothing." data-href="/concepts/evidence-about-the-regulators#reports">
      <text x="796" y="378" stroke="none">eval reports + interpretation</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-read-by" aria-label="Who reads the records" data-label="Who reads the records" data-def="&lt;code&gt;status&lt;/code&gt;, the control room, the eval harness and a person. No mechanism carries what the records say back into the definition." data-href="/guide/control-room">
      <text x="796" y="430" stroke="none" font-size="11" fill="var(--vp-c-text-2)">read by <tspan font-family="var(--vp-font-family-mono)">status</tspan>, the control room,</text>
      <text x="796" y="445" stroke="none" font-size="11" fill="var(--vp-c-text-2)">the eval harness, a person.</text>
      <text x="796" y="460" stroke="none" font-size="11" fill="var(--vp-c-danger-1)">Nothing carries them back up.</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-person-reads" aria-label="a person reads the reports" data-label="a person reads the reports" data-def="The one path from the records to the level above today: an eval report with a person's interpretation, acted on by hand." data-href="/concepts/evidence-about-the-regulators#the-interpretation-rule">
      <path d="M 850 176 L 850 118" stroke-width="1.2" stroke-dasharray="2 4" marker-end="url(#b-arrow)"/>
      <text x="856" y="150" stroke="none" font-size="10" fill="var(--vp-c-text-2)">a person reads the reports</text>
      <path d="M 850 176 L 850 118" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-eval" aria-label="The eval harness" data-label="The eval harness" data-def="S3* one level up: suites run under declared arms with deterministic graders, ablation per regulator, and intervals. A report needs a person's interpretation before anything is adopted from it." data-href="/concepts/evidence-about-the-regulators">
      <rect x="780" y="496" width="230" height="104" rx="6" fill="none" pointer-events="all" stroke-width="1.5"/>
      <text x="792" y="520" font-weight="600" stroke="none">EVAL HARNESS</text>
      <text x="888" y="520" stroke="none" font-size="10.5" fill="var(--vp-c-text-2)">S3* one level up</text>
      <text x="792" y="544" stroke="none" font-size="10.5" fill="var(--vp-c-text-2)">arms · ablation · graders · intervals</text>
      <text x="792" y="562" stroke="none" font-size="10.5" fill="var(--vp-c-text-2)">a report needs a person's interpretation</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-reports" aria-label="reports" data-label="reports" data-def="An eval report is appended to the records like any other, with its interpretation beside it." data-href="/concepts/evidence-about-the-regulators#reports">
      <line x1="900" y1="496" x2="900" y2="468" stroke-width="1.2" marker-end="url(#b-arrow)"/>
      <text x="906" y="486" stroke="none" font-size="10" fill="var(--vp-c-text-2)">reports</text>
      <path d="M 900 496 L 900 468" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    </g>
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
    <g transform="translate(-16 0)">
    <rect x="30" y="20" width="722" height="96" rx="6" fill="none" stroke-width="1.5"/>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-definition" aria-label="The definition" data-label="The definition" data-def="A versioned package of files: the registry, the identity seed, the profiles, the policies, the workloads and the evals. &lt;code&gt;regulator check&lt;/code&gt; holds it against the code, only people change it, and &lt;code&gt;regulator init&lt;/code&gt; seeds an instance from it." data-href="/concepts/definition-and-instance">
      <text x="46" y="42" font-weight="600" stroke="none">DEFINITION</text>
      <text x="140" y="42" stroke="none" fill="var(--vp-c-text-2)">versioned, checked by <tspan font-family="var(--vp-font-family-mono)">regulator check</tspan>, changed by people</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-registry" aria-label="Registry" data-label="Registry" data-def="One record per regulator: what it absorbs, its mechanism level, its evidence, its limitation, its ablation switch and its retirement condition. &lt;code&gt;REGULATORS.md&lt;/code&gt; and &lt;code&gt;BOUNDARY.md&lt;/code&gt; are rendered from the records." data-href="/concepts/control-plane#the-regulators">
      <rect x="46" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
      <text x="100" y="79" stroke="none" text-anchor="middle" font-size="11.5">registry (43)</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-identity-seed" aria-label="Identity seed" data-label="Identity seed" data-def="The &lt;code&gt;IDENTITY&lt;/code&gt;, &lt;code&gt;INVARIANTS&lt;/code&gt;, &lt;code&gt;GLOSSARY&lt;/code&gt; and &lt;code&gt;BOUNDARIES&lt;/code&gt; files an instance starts from. Copied into &lt;code&gt;regulator/identity/&lt;/code&gt; at init and write-protected from then on." data-href="/concepts/identity">
      <rect x="162" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
      <text x="216" y="79" stroke="none" text-anchor="middle" font-size="11.5">identity seed</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-profiles" aria-label="Capability profiles" data-label="Capability profiles" data-def="A named, bounded grant of tools and writable paths a unit runs under. Specialisation by grant, never by persona." data-href="/reference/definition">
      <rect x="278" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
      <text x="332" y="79" stroke="none" text-anchor="middle" font-size="11.5">profiles</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-policies" aria-label="Policies" data-label="Policies" data-def="Routing, budgets, recovery and interaction: the declared rules the loop and the router apply, each versioned so a decision can cite the version it used." data-href="/reference/definition">
      <rect x="394" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
      <text x="448" y="79" stroke="none" text-anchor="middle" font-size="11.5">policies</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-workloads" aria-label="Workloads" data-label="Workloads" data-def="A declared set of unit types for one kind of job, each a profile, a grant, a budget and a route. The loop stays the same; only the workload changes." data-href="/guide/authoring-a-workload">
      <rect x="510" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
      <text x="564" y="79" stroke="none" text-anchor="middle" font-size="11.5">workloads</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-evals" aria-label="Evals" data-label="Evals" data-def="The suites, arms and graders the eval harness runs, and the fifteen pre-registered metric names a report may use." data-href="/concepts/evidence-about-the-regulators">
      <rect x="626" y="58" width="108" height="34" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
      <text x="680" y="79" stroke="none" text-anchor="middle" font-size="11.5">evals</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-advice-seed" aria-label="Advice seed" data-label="Advice seed" data-def="&lt;code&gt;advice/&lt;profile&gt;.md&lt;/code&gt; in the definition: the text a profile's units are advised with, under &lt;code&gt;advice.maxChars&lt;/code&gt;. Advice is proposable and lands only through &lt;code&gt;advice accept&lt;/code&gt;; it is the one kind of file a reflector's edit targets." data-href="/project/whats-coming#the-reflector-the-definitions-s4">
      <text x="278" y="109" stroke="none" font-size="10" fill="var(--vp-c-brand-1)">+ <tspan font-family="var(--vp-font-family-mono)">advice/&lt;profile&gt;.md</tspan>, the seed of the instance's advice files</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-init" aria-label="regulator init seeds" data-label="&lt;code&gt;regulator init&lt;/code&gt; seeds" data-def="The one write from the definition into an instance: the identity files, the manifest and the stores are created from the package. From then on the instance's records are its own." data-href="/guide/getting-started">
      <line x1="80" y1="116" x2="80" y2="176" stroke-width="1.5" marker-end="url(#a-arrow)"/>
      <text x="86" y="150" stroke="none" font-size="10" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">regulator init</tspan> seeds</text>
      <path d="M 80 116 L 80 176" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-identity-promote" aria-label="identity promote" data-label="&lt;code&gt;identity promote&lt;/code&gt;" data-def="Carries an accepted identity change in an instance back into the definition's seed, so the next instance starts from it. Run by a person; a proposal never reaches the seed on its own." data-href="/concepts/identity#the-only-way-to-change-identity">
      <line x1="236" y1="212" x2="236" y2="94" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#a-arrow)"/>
      <text x="242" y="150" stroke="none" font-size="10" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">identity promote</tspan></text>
      <path d="M 236 212 L 236 94" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-advice-promote" aria-label="advice promote" data-label="&lt;code&gt;advice promote&lt;/code&gt;" data-def="The same path for an accepted advice file: a person carries it from the instance's &lt;code&gt;regulator/advice/&lt;/code&gt; into the definition's advice seed." data-href="/project/whats-coming#what-a-person-sees">
      <line x1="356" y1="212" x2="356" y2="118" stroke="var(--vp-c-brand-1)" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#a-arrow-accent)"/>
      <text x="362" y="150" stroke="none" font-size="10" fill="var(--vp-c-brand-1)"><tspan font-family="var(--vp-font-family-mono)">advice promote</tspan></text>
      <path d="M 356 212 L 356 118" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <rect x="30" y="176" width="722" height="424" rx="6" fill="none" stroke-width="1.5"/>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-instance" aria-label="An instance" data-label="An instance" data-def="One repository under the control plane: a &lt;code&gt;.regulator/&lt;/code&gt; directory of append-only records, an identity set, a manifest naming the definition version it was seeded from, and the loop running units against it." data-href="/reference/instance">
      <text x="46" y="198" font-weight="600" stroke="none">INSTANCE</text>
      <text x="126" y="198" stroke="none" fill="var(--vp-c-text-2)">one repository under the control plane</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-s5-after" aria-label="S5: identity and advice files" data-label="S5: identity and advice files" data-def="The identity files, protected by the write gate, the bash watch and the identity-untouched check, with the advice files beside them under the same protection. Both are proposable; each lands through its own accept command." data-href="/concepts/identity">
      <rect x="46" y="212" width="330" height="40" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
      <text x="56" y="229" stroke="none" font-weight="600">S5</text>
      <text x="80" y="229" stroke="none">identity files <tspan fill="var(--vp-c-brand-1)">+ advice files</tspan>, write-protected</text>
      <text x="80" y="244" stroke="none" font-size="11" fill="var(--vp-c-text-2)">write gate · bash watch · identity-untouched at closeout</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-person" aria-label="A person acting as S5" data-label="A person acting as S5" data-def="The interaction policy names who may act as S5. That person is the only writer of an identity file, through &lt;code&gt;identity accept&lt;/code&gt;. &lt;code&gt;reject&lt;/code&gt; changes nothing, and silence is never consent." data-href="/concepts/asking-a-person">
      <rect x="430" y="212" width="190" height="40" rx="20" fill="none" pointer-events="all" stroke-width="1.5"/>
      <text x="525" y="236" stroke="none" text-anchor="middle">a person (<tspan font-family="var(--vp-font-family-mono)">actAsS5</tspan>)</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-accept-after" aria-label="accept · advice accept" data-label="accept · advice accept" data-def="&lt;code&gt;identity accept&lt;/code&gt; for an identity file and &lt;code&gt;advice accept&lt;/code&gt; for an advice file after its probe: the authority check, then the write. Each is the only writer of its kind of file." data-href="/project/whats-coming#what-a-person-sees">
      <line x1="430" y1="232" x2="378" y2="232" stroke-width="1.5" marker-end="url(#a-arrow)"/>
      <text x="404" y="226" stroke="none" font-size="10" text-anchor="middle" fill="var(--vp-c-text-2)">accept</text>
      <text x="404" y="262" stroke="none" font-size="10" text-anchor="middle" fill="var(--vp-c-text-2)">the only writer</text>
      <text x="404" y="276" stroke="none" font-size="10" text-anchor="middle" fill="var(--vp-c-brand-1)">+ <tspan font-family="var(--vp-font-family-mono)">advice accept</tspan></text>
      <path d="M 430 232 L 378 232" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-s3" aria-label="S3: the loop" data-label="S3: the loop" data-def="Contract, dispatch, verify, route, close. The orchestrator never edits code itself: it dispatches a session under a contract and a budget, verifies the work with host-run checks, routes by the versioned recovery policy and closes on the ledger." data-href="/concepts/control-plane#the-loop">
      <rect x="46" y="290" width="574" height="40" rx="3" fill="none" pointer-events="all" stroke-width="1.5"/>
      <text x="56" y="314" stroke="none" font-weight="600">S3</text>
      <text x="80" y="314" stroke="none">the loop: contract → dispatch → verify → route → close; budgets; recovery policy</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-s1" aria-label="S1: a unit" data-label="S1: a unit" data-def="The work that touches the repository: one contract, one session, one verdict. It runs in its own worktree under the &lt;code&gt;implement&lt;/code&gt; profile, and what it reports about itself is never evidence." data-href="/concepts/contracts">
      <rect x="46" y="372" width="130" height="44" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
      <text x="56" y="389" stroke="none" font-weight="600">S1</text><text x="78" y="389" stroke="none">unit u1</text>
      <text x="56" y="405" stroke="none" font-size="11" fill="var(--vp-c-text-2)">implement · worktree</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-s1" aria-label="S1: a unit" data-label="S1: a unit" data-def="The work that touches the repository: one contract, one session, one verdict. It runs in its own worktree under the &lt;code&gt;implement&lt;/code&gt; profile, and what it reports about itself is never evidence." data-href="/concepts/contracts">
      <rect x="190" y="372" width="130" height="44" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
      <text x="200" y="389" stroke="none" font-weight="600">S1</text><text x="222" y="389" stroke="none">unit u2</text>
      <text x="200" y="405" stroke="none" font-size="11" fill="var(--vp-c-text-2)">implement · worktree</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-s4-unit" aria-label="S4: a research unit" data-label="S4: a research unit" data-def="Intelligence at the instance level: a read-only profile, one question, a budget. It reports with &lt;code&gt;report_intelligence&lt;/code&gt; and cannot change anything itself." data-href="/concepts/intelligence-and-memory#intelligence">
      <rect x="334" y="372" width="160" height="44" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2" stroke-dasharray="4 3"/>
      <text x="344" y="389" stroke="none" font-weight="600">S4</text><text x="366" y="389" stroke="none">research unit</text>
      <text x="344" y="405" stroke="none" font-size="11" fill="var(--vp-c-text-2)">read-only · one question</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-s2" aria-label="S2: coordination" data-label="S2: coordination" data-def="Damping between units, as mechanism: leases, worktree isolation, reintegration checked on the merged tree, and a thrash detector that names an oscillation for S3 to decide." data-href="/concepts/coordination">
      <text x="46" y="440" stroke="none" font-size="11" fill="var(--vp-c-text-2)">S2: leases, worktree isolation, reintegration, thrash detector</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-dispatch" aria-label="dispatch" data-label="dispatch" data-def="A unit starts as an attempt: one claimed run against a revision, under its profile's grant, its budget ceilings and a lease on its worktree." data-href="/guide/running-units">
      <line x1="111" y1="330" x2="111" y2="370" stroke-width="1.2" marker-end="url(#a-arrow)"/>
      <line x1="255" y1="330" x2="255" y2="370" stroke-width="1.2" marker-end="url(#a-arrow)"/>
      <line x1="409" y1="330" x2="409" y2="370" stroke-width="1.2" marker-end="url(#a-arrow)"/>
      <text x="118" y="352" stroke="none" font-size="10" fill="var(--vp-c-text-2)">dispatch</text>
      <path d="M 111 330 L 111 370 M 255 330 L 255 370 M 409 330 L 409 370" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-router" aria-label="The router" data-label="The router" data-def="Turns a signal into obligations by the routing policy: which consumers it is owed to, the severity floors, and the veto that holds the units it names." data-href="/concepts/obligations">
      <rect x="520" y="372" width="176" height="44" rx="3" fill="none" pointer-events="all" stroke-width="1.5"/>
      <text x="608" y="389" stroke="none" text-anchor="middle">router → obligations</text>
      <text x="608" y="405" stroke="none" text-anchor="middle" font-size="11" fill="var(--vp-c-text-2)">routing policy · floors · veto</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-report" aria-label="report_intelligence" data-label="report_intelligence" data-def="The typed tool a research unit reports with. The signal lands in the regulatory log and goes to the router; it never goes straight to a unit." data-href="/concepts/intelligence-and-memory#intelligence">
      <line x1="494" y1="394" x2="518" y2="394" stroke-width="1.5" marker-end="url(#a-arrow)"/>
      <text x="506" y="366" stroke="none" font-size="10" text-anchor="middle" fill="var(--vp-c-text-2)">report_intelligence</text>
      <path d="M 494 394 L 518 394" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-holds" aria-label="obligation holds the unit" data-label="obligation holds the unit" data-def="At blocking severity an obligation pauses the units it names until S3 or a person dispositions it. Intelligence can stop work; it never replans on its own." data-href="/concepts/obligations">
      <path d="M 608 372 L 608 330" stroke-width="1.5" marker-end="url(#a-arrow)"/>
      <text x="616" y="352" stroke="none" font-size="10" fill="var(--vp-c-text-2)">obligation holds the unit</text>
      <path d="M 608 372 L 608 330" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-harness-edit" aria-label="harness-edit" data-label="harness-edit" data-def="The new proposal kind, routed like every proposal: a diagnosis (what was observed, by reference), a change (a diff against one advice file) and a prediction (which metric, against which baseline, over which horizon, and which value would count against it)." data-href="/project/whats-coming#what-changes-at-what-level">
      <text x="508" y="432" stroke="none" font-size="10" fill="var(--vp-c-brand-1)">+ a <tspan font-family="var(--vp-font-family-mono)">harness-edit</tspan>: an obligation owed to S5</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-propose" aria-label="propose_policy_change" data-label="propose_policy_change" data-def="The tool a unit proposes a change to identity with. It opens an obligation owed to S5 and changes nothing by itself (INV-002)." data-href="/concepts/identity#the-only-way-to-change-identity">
      <path d="M 255 416 L 255 470 L 732 470 L 732 232 L 622 232" stroke-width="1.2" stroke-dasharray="5 4" fill="none" marker-end="url(#a-arrow)"/>
      <text x="262" y="462" stroke="none" font-size="10" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">propose_policy_change</tspan> → obligation owed to S5; changes nothing</text>
      <path d="M 255 416 L 255 470 L 732 470 L 732 232 L 622 232" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-remember" aria-label="remember" data-label="remember" data-def="The tool a unit records a fact with: provenance, scope and an expiry of at most ninety days. A fact is never identity, however often it is repeated." data-href="/concepts/intelligence-and-memory#operational-memory">
      <path d="M 300 416 L 300 448 L 600 448 L 600 498" stroke-width="1.2" stroke-dasharray="5 4" fill="none" marker-end="url(#a-arrow)"/>
      <text x="606" y="444" stroke="none" font-size="10" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">remember</tspan></text>
      <path d="M 300 416 L 300 448 L 600 448 L 600 498" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-s3star" aria-label="S3*: host checks" data-label="S3*: host checks" data-def="Independent verification: the host runs the checks itself at the exact revision and the closeout gate reads that evidence, never the unit's claim. Named here: the inherited tests, identity-untouched, the export signature and the glossary lint." data-href="/reference/host-checks">
      <rect x="46" y="500" width="450" height="40" rx="3" fill="none" pointer-events="all" stroke-width="1.5"/>
      <text x="56" y="517" stroke="none" font-weight="600">S3*</text>
      <text x="84" y="517" stroke="none">host checks at the revision → evidence → closeout gate</text>
      <text x="84" y="532" stroke="none" font-size="11" fill="var(--vp-c-text-2)">inherited-tests · identity-untouched · export-signature · glossary-lint</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-branch" aria-label="branch at HEAD" data-label="branch at HEAD" data-def="What S3* verifies is the unit's branch at the revision it reported, so the evidence is tied to a commit, not to a transcript." data-href="/reference/host-checks">
      <line x1="111" y1="416" x2="111" y2="498" stroke-width="1.2" marker-end="url(#a-arrow)"/>
      <text x="118" y="482" stroke="none" font-size="10" fill="var(--vp-c-text-2)">branch at HEAD</text>
      <path d="M 111 416 L 111 498" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-memory" aria-label="Operational memory" data-label="Operational memory" data-def="Facts for later units, each with provenance and an expiry, read into a session as advice. Retractable, and never promoted to identity by repetition." data-href="/concepts/intelligence-and-memory#operational-memory">
      <rect x="520" y="500" width="200" height="40" rx="3" fill="var(--vp-c-bg-soft)" stroke-width="1.2"/>
      <text x="620" y="517" stroke="none" text-anchor="middle">operational memory</text>
      <text x="620" y="532" stroke="none" text-anchor="middle" font-size="11" fill="var(--vp-c-text-2)">facts, provenance, expiry ≤ 90 d</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-typed" aria-label="Every edge is typed" data-label="Every edge is typed" data-def="Each channel inside the instance is a message kind in &lt;code&gt;protocol&lt;/code&gt; with a stated authority and destination, stamped by the host and recorded on a registry card with its limitation." data-href="/concepts/control-plane#typed-channels">
      <text x="46" y="584" stroke="none" font-size="11" fill="var(--vp-c-text-2)">Every edge inside the instance is typed, stamped by the host, and recorded on a card with its limitations.</text>
    </g>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-writes" aria-label="writes" data-label="writes" data-def="Every store is written by the host from inside the loop and the session's gates, never by a unit directly." data-href="/reference/instance">
      <line x1="736" y1="300" x2="794" y2="300" stroke-width="1.5" marker-end="url(#a-arrow)"/>
      <text x="765" y="292" stroke="none" font-size="10" text-anchor="middle" fill="var(--vp-c-text-2)">writes</text>
      <path d="M 734 300 L 796 300" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-never" aria-label="What the reflector cannot do" data-label="What the reflector cannot do" data-def="It has no tool that writes under &lt;code&gt;regulator/&lt;/code&gt; or the definition, none that dispatches a unit and none that dispositions an obligation. The crossed edge is refused by mechanism, not by instruction." data-href="/project/whats-coming#what-changes-at-what-level">
      <path d="M 796 68 L 741 68" stroke="var(--vp-c-danger-1)" stroke-width="1.5" fill="none" marker-end="url(#a-x)"/>
      <text x="736" y="138" stroke="none" font-size="10" text-anchor="end" fill="var(--vp-c-danger-1)">never writes a definition file · never dispatches a unit</text>
      <path d="M 798 68 L 736 68" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <g transform="translate(16 0)">
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-reflector" aria-label="The reflector" data-label="The reflector" data-def="The definition's S4: a package that reads every instance's records and emits three record kinds that already exist, a memory fact, an intelligence signal and a proposal owed to S5. Registered as an instrument, graded on whether the proposals a person accepted moved the metric they named." data-href="/project/whats-coming#the-reflector-the-definitions-s4">
      <rect x="780" y="20" width="230" height="96" rx="6" fill="var(--vp-c-brand-soft)" stroke="var(--vp-c-brand-1)" stroke-width="2"/>
      <text x="792" y="42" font-weight="600" stroke="none" fill="var(--vp-c-brand-1)">S4</text>
      <text x="814" y="42" font-weight="600" stroke="none">REFLECTOR</text>
      <text x="792" y="62" stroke="none" font-size="10.5">reads the records; adopts nothing</text>
      <text x="792" y="78" stroke="none" font-size="10.5">writes only record kinds that exist:</text>
      <text x="792" y="94" stroke="none" font-size="10.5">proposal · intelligence · memory</text>
      <text x="792" y="110" stroke="none" font-size="10.5" fill="var(--vp-c-text-2)">an instrument, graded on calibration</text>
    </g>
    <rect x="780" y="176" width="230" height="290" rx="6" fill="none" stroke-width="1.5" stroke-dasharray="1 4" stroke-linecap="round"/>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-records" aria-label="The records" data-label="The records" data-def="&lt;code&gt;.regulator/&lt;/code&gt;: append-only stores the host writes from inside the loop and the session's gates. The only thing &lt;code&gt;status&lt;/code&gt;, the control room and the eval harness read." data-href="/reference/instance">
      <text x="796" y="198" font-weight="600" stroke="none">RECORDS</text>
      <text x="796" y="214" stroke="none" font-size="11" fill="var(--vp-c-text-2)"><tspan font-family="var(--vp-font-family-mono)">.regulator/</tspan>, append-only</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-execution-store" aria-label="Execution store" data-label="Execution store" data-def="Units, attempts, leases and contracts: the authoritative work state, with the lifecycle transitions the store itself enforces." data-href="/reference/instance">
      <text x="796" y="246" stroke="none">execution store</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-regulatory-log" aria-label="Regulatory log" data-label="Regulatory log" data-def="Signals, the obligations they became, and every disposition, with the policy version each decision cited." data-href="/concepts/obligations">
      <text x="796" y="268" stroke="none">regulatory log (signals)</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-audit-log" aria-label="Audit log" data-label="Audit log" data-def="Host-run evidence and the verdicts drawn from it, each tied to the revision it was produced at." data-href="/reference/host-checks">
      <text x="796" y="290" stroke="none">audit log (evidence)</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-memory-outbox" aria-label="Memory and outbox" data-label="Memory and outbox" data-def="Facts with provenance and expiry; and what is owed to a person, delivered and reminded until answered." data-href="/concepts/intelligence-and-memory#operational-memory">
      <text x="796" y="312" stroke="none">memory · outbox</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-effect-journal" aria-label="Effect journal" data-label="Effect journal" data-def="An effect that cannot be taken back is intended before, committed after and reconciled against the world on restart, so a crash in between neither repeats it nor forgets it." data-href="/concepts/recovery">
      <text x="796" y="334" stroke="none">effect journal</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-spans" aria-label="Spans" data-label="Spans" data-def="Every store read as OpenTelemetry spans, so a trace viewer shows a unit's run without a second database." data-href="/reference/instance">
      <text x="796" y="356" stroke="none">spans (OpenTelemetry)</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-eval-reports" aria-label="Eval reports and interpretation" data-label="Eval reports and interpretation" data-def="A report from the eval harness and the interpretation a person wrote for it. A report without an interpretation adopts nothing." data-href="/concepts/evidence-about-the-regulators#reports">
      <text x="796" y="378" stroke="none">eval reports + interpretation</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-predictions" aria-label="Predictions" data-label="Predictions" data-def="A harness-edit's bet, kept as its own record: the probe resolves the first horizon, the next units after acceptance resolve the second, and a bet that fails there opens an obligation to revert or re-decide." data-href="/project/whats-coming#what-changes-at-what-level">
      <text x="796" y="396" stroke="none" font-size="10" fill="var(--vp-c-brand-1)">+ predictions, resolved at their horizons</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-read-by-after" aria-label="Who reads the records" data-label="Who reads the records" data-def="&lt;code&gt;status&lt;/code&gt;, the control room, the eval harness, a person, and now the reflector, read-only." data-href="/guide/control-room">
      <text x="796" y="430" stroke="none" font-size="11" fill="var(--vp-c-text-2)">read by <tspan font-family="var(--vp-font-family-mono)">status</tspan>, the control room,</text>
      <text x="796" y="445" stroke="none" font-size="11" fill="var(--vp-c-text-2)">the eval harness, a person.</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-reads" aria-label="reads, read-only" data-label="reads, read-only" data-def="The reflector's read of the records, under a read-only grant like a research unit's. It depends on &lt;code&gt;protocol&lt;/code&gt;, &lt;code&gt;core&lt;/code&gt; and the status read model; nothing depends on it." data-href="/project/whats-coming#the-reflector-the-definitions-s4">
      <line x1="850" y1="176" x2="850" y2="118" stroke="var(--vp-c-brand-1)" stroke-width="2" marker-end="url(#a-arrow-accent)"/>
      <text x="856" y="150" stroke="none" font-size="10" fill="var(--vp-c-brand-1)">reads, read-only</text>
      <path d="M 850 176 L 850 118" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-appends" aria-label="appends" data-label="appends" data-def="What the reflector writes lands in record kinds that exist: a memory fact, an intelligence signal the router turns into an obligation, a proposal owed to S5." data-href="/project/whats-coming#the-reflector-the-definitions-s4">
      <line x1="960" y1="116" x2="960" y2="174" stroke="var(--vp-c-brand-1)" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#a-arrow-accent)"/>
      <text x="966" y="150" stroke="none" font-size="10" fill="var(--vp-c-brand-1)">appends</text>
      <path d="M 960 116 L 960 174" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-eval" aria-label="The eval harness" data-label="The eval harness" data-def="S3* one level up: suites run under declared arms with deterministic graders, ablation per regulator, and intervals. A report needs a person's interpretation before anything is adopted from it." data-href="/concepts/evidence-about-the-regulators">
      <rect x="780" y="496" width="230" height="104" rx="6" fill="none" pointer-events="all" stroke-width="1.5"/>
      <text x="792" y="520" font-weight="600" stroke="none">EVAL HARNESS</text>
      <text x="888" y="520" stroke="none" font-size="10.5" fill="var(--vp-c-text-2)">S3* one level up</text>
      <text x="792" y="544" stroke="none" font-size="10.5" fill="var(--vp-c-text-2)">arms · ablation · graders · intervals</text>
      <text x="792" y="562" stroke="none" font-size="10.5" fill="var(--vp-c-text-2)">a report needs a person's interpretation</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-probe" aria-label="The probe" data-label="The probe" data-def="An eval arm per proposed advice edit, run against the workload's fixture before anyone decides. It resolves the proposal's first horizon." data-href="/concepts/evidence-about-the-regulators#arms">
      <text x="792" y="582" stroke="none" font-size="10.5" fill="var(--vp-c-brand-1)">+ the probe: an arm per advice edit</text>
    </g>
    <g class="gl fig-hot" tabindex="0" role="button" data-term="fig-reports" aria-label="reports" data-label="reports" data-def="An eval report is appended to the records like any other, with its interpretation beside it." data-href="/concepts/evidence-about-the-regulators#reports">
      <line x1="900" y1="496" x2="900" y2="468" stroke-width="1.2" marker-end="url(#a-arrow)"/>
      <text x="906" y="486" stroke="none" font-size="10" fill="var(--vp-c-text-2)">reports</text>
      <path d="M 900 496 L 900 468" stroke="transparent" stroke-width="14" fill="none" pointer-events="stroke"/>
    </g>
    </g>
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

They are drawn by a hand-written script,
[`2026-10-18-reflector-figures.py`](https://github.com/MetaCoding-io/regulator/blob/main/docs/research/figures/2026-10-18-reflector-figures.py),
not generated from the definition, which the project otherwise avoids: the docs never
carry a second copy of what the code states, and the [figures
thread](../research/2026-09-25-open-questions.md#1-the-control-room-should-show-how-the-declared-system-connects)
decided that a generator over the definition is the only author of a figure. The
"before" figure is the first one that generator must reproduce, from the registry's
channels, enforcement points and stores. When it does, this page shows the generated
figure and the script's output becomes history in the research note.

Every box and edge in both figures is a hotspot. Hover, focus or tap one for what it
is, in a sentence or two, and a link to the page that states the mechanism. The same
script writes the card text and the labels, so the two cannot drift apart.
