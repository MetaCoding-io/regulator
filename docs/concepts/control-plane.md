# The control plane

`regulator` treats an agent harness as a control problem, not a cast of
characters. Stafford Beer's Viable System Model names five functions any organization
needs to stay viable; here each is a *responsibility with an authority boundary*, held
by a mechanism wherever a mechanism can hold it, and by a model's judgment only where it
cannot. The [architecture](/ARCHITECTURE) is the long version; this page is the map.

## The prime directive

> **Prompts advise. Types describe. Gates enforce.**

Every rule is implemented at the strongest level that can carry it, in this order:

1. a TypeScript type or compile-time invariant;
2. a deterministic runtime check or gate;
3. a typed tool or protocol with runtime schema validation;
4. a model's judgment;
5. prompt and context engineering.

A prompt may *also* say what a gate enforces, so the model is not surprised. It is never
the only place a rule lives. Every regulator carries its level on its
[registry record](/reference/regulators), so the level is a fact about the system and
not a hope.

## The five functions

| Function | In `regulator` | Held by |
| --- | --- | --- |
| **S1 Operations** | A unit: one session under a capability profile, in its own worktree, under a work contract. | The profile is a grant over declared tool effects; the writable paths, the tool set and the budget are enforced by the host, not by the profile's advice. |
| **S2 Coordination** | Leases with a TTL, worktree isolation, reintegration, the thrash detector, the effect journal reconciled on restart. | Mechanisms. There is no coordinator persona. |
| **S3 Control** | The loop: contract → dispatch → verify → route → close, with budgets, model routes and a recovery policy. | The orchestrator is the only execution authority. Regulators never schedule. |
| **S3\* Audit** | Host-run checks at a revision, the technical verdict, the canary watch, the closeout gate over protected paths. | Independent evidence the host owns. A model's review is an additional layer. |
| **S4 Intelligence** | The research unit type under a read-only profile, `report_intelligence`, routed into obligations. | Intelligence raises an obligation; it never replans. |
| **S5 Identity** | `IDENTITY.md`, `INVARIANTS.md`, `GLOSSARY.md`, `BOUNDARIES.md` under `regulator/identity/`, seeded by the definition, protected by the write gate and the `identity-untouched` check. | Files. A unit may propose; only a person with `actAsS5` in the interaction policy may accept, and the S5 decision path is the only writer. |

## The loop

<figure>
<svg viewBox="0 0 760 250" role="img" aria-label="The S3 loop: a contract is dispatched to a session, the host verifies the result at a revision, a failure is routed under the recovery policy back to dispatch or out to an obligation, and a pass closes the unit." style="max-width:100%;height:auto;font-family:inherit;font-size:12px">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M0 0L10 5L0 10z" fill="currentColor"/>
    </marker>
  </defs>
  <g fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="20" y="60" width="110" height="44" rx="6"/>
    <rect x="180" y="60" width="110" height="44" rx="6"/>
    <rect x="340" y="60" width="110" height="44" rx="6"/>
    <rect x="500" y="60" width="110" height="44" rx="6"/>
    <rect x="640" y="60" width="100" height="44" rx="6"/>
    <rect x="340" y="176" width="270" height="44" rx="6" stroke-dasharray="5 4"/>
  </g>
  <g fill="currentColor" text-anchor="middle">
    <text x="75" y="86">contract</text>
    <text x="235" y="86">dispatch</text>
    <text x="395" y="86">verify</text>
    <text x="555" y="86">route</text>
    <text x="690" y="86">close</text>
    <text x="475" y="202">obligation owed to S3, S5 or a person</text>
  </g>
  <g fill="none" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)">
    <line x1="130" y1="82" x2="178" y2="82"/>
    <line x1="290" y1="82" x2="338" y2="82"/>
    <line x1="450" y1="82" x2="498" y2="82"/>
    <line x1="610" y1="82" x2="638" y2="82"/>
    <path d="M555 104 V140 H235 V106"/>
    <path d="M580 104 V174"/>
    <path d="M400 176 V106" stroke-dasharray="5 4"/>
  </g>
  <g fill="currentColor" font-size="11">
    <text x="150" y="78" text-anchor="middle">lease, worktree</text>
    <text x="314" y="78" text-anchor="middle">host checks</text>
    <text x="474" y="52" text-anchor="middle">verdict: fail</text>
    <text x="624" y="52" text-anchor="middle">verdict: pass</text>
    <text x="300" y="156" text-anchor="middle">retry, repair (spends an attempt)</text>
    <text x="588" y="144" text-anchor="start">clarify, escalate, pause</text>
    <text x="408" y="168" text-anchor="start">dispositioned: run again</text>
  </g>
</svg>
<figcaption>The S3 loop. The host, not the session, decides whether a unit passed; a failure the policy cannot absorb by itself becomes an obligation that holds the unit until someone dispositions it.</figcaption>
</figure>

Three things about the loop are deliberate:

- **The orchestrator owns execution state; regulators own regulatory state; neither
  infers the other.** Units, attempts, leases and budgets live in the execution store.
  Findings, obligations, evidence and escalations live in the append-only regulatory
  log. The code lives in the repository. Nothing reads its own progress off the domain.
- **Recovery is data.** The recovery policy maps a normalized cause and its occurrence
  count to an action; the routing policy says who a unit waits on for each action it
  cannot apply. Changing how the loop recovers is a policy change under review, not a
  code change.
- **Progression can be vetoed.** An open obligation at or above the routing policy's
  line, naming a unit, refuses that unit's dispatch and close until it is dispositioned.
  The veto is deterministic; the disposition is a person's, checked against the
  interaction policy.

## Typed channels

Messages between functions carry control semantics, and the type says which:

| Kind | From | Means | Routed to |
| --- | --- | --- | --- |
| `operational-signal` | S1 | something about the work: a blocker, a deviation | S3 |
| `uncertainty-signal` | S1 | residual uncertainty with a reported impact; the routing policy maps the claim to a severity | S3 |
| `coordination-signal` | S2 | a lease expired, a conflict, oscillation | S3 |
| `audit-finding` | S3\* | evidence contradicts a claim or an invariant | S3 |
| `intelligence-signal` | S4 | the environment changed, or will | S3 |
| `policy-proposal` | any | a request to change identity or policy; never a mutation | S5 |
| `algedonic-signal` | any | exceptional escalation that bypasses the hierarchy | a person |
| `constraint` | S5, S3 | a boundary a unit runs under, stated ahead of the work | the unit |

A signal is not an audit; an audit is not a policy decision; a proposal does not mutate
policy. The [routing policy](/reference/definition#routing-policy) declares, per kind,
the severity at which a message opens an obligation and for whom.

## The regulators

A *regulator* is one mechanism that absorbs one class of failure. Each has a registry
record — purpose, failure absorbed, mechanism level, implementation, enforcement points,
tests, limitations, owner, review date, the eval arm that switches it off, and the
condition under which it may be retired. `regulator check` refuses a record without a
stated limitation and fails when a review date passes. The
[regulators page](/reference/regulators) is rendered from the records; the
[enforcement boundary](/reference/boundary) lists, for every gate, the routes around it.

The [glossary](/GLOSSARY) maps each cybernetic term to what it means in a harness and
where it is mechanism; the [pathologies](/PATHOLOGIES) catalog the ways the whole
arrangement fails and which regulator absorbs each.
