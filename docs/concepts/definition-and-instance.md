# Definition, instance, domain

Three things with three owners. Keeping them apart is what lets one control plane run
against many repositories, and what stops a run's traces from becoming a second source
of truth.

<figure>
<svg viewBox="0 0 1100 440" role="img" aria-label="Three stores. Left: the execution store, owned by the orchestrator, holding units, contracts, reports, attempts, budgets, observations, decisions and leases. Centre: the domain, the repository with a base checkout and one worktree per unit, written by the session's tools and merged by the orchestrator. Right: regulatory state, the audit log and the signal sink, written by S3-star and S2 and read by the router and the read model. Arrows show who writes and reads each; no arrow goes from the domain to either store." style="max-width:100%;height:auto;font-family:inherit">
  <defs><marker id="stores-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>
  <g font-size="12" font-weight="700" text-anchor="middle" fill="none" stroke="currentColor" stroke-width="1.4">
    <rect x="60" y="20" width="220" height="40" rx="4"/>
    <rect x="440" y="20" width="220" height="40" rx="4" stroke-dasharray="5 4"/>
    <rect x="820" y="20" width="220" height="40" rx="4" stroke-dasharray="1 4" stroke-linecap="round"/>
  </g>
  <g font-size="12" font-weight="700" text-anchor="middle" fill="currentColor">
    <text x="170" y="45">ORCHESTRATOR (S3)</text>
    <text x="550" y="45">SESSION (S1 + gates)</text>
    <text x="930" y="45">AUDIT · ROUTER (S3*, S2)</text>
  </g>
  <g font-size="11.5" fill="none" stroke="currentColor" stroke-width="1.4">
    <rect x="20" y="200" width="330" height="200" rx="6"/>
    <rect x="385" y="200" width="330" height="200" rx="6" stroke-dasharray="5 4"/>
    <rect x="750" y="200" width="330" height="200" rx="6" stroke-dasharray="1 4" stroke-linecap="round"/>
  </g>
  <g fill="currentColor">
    <text x="185" y="224" text-anchor="middle" font-weight="700" font-size="12.5">EXECUTION STORE</text>
    <text x="185" y="240" text-anchor="middle" font-size="10" opacity="0.65">.regulator/units · leases · trace</text>
    <g font-size="9.5" opacity="0.85">
      <text x="36" y="264">unit.json — status, attempt count</text>
      <text x="36" y="281">contract.v&lt;N&gt;.json · report.v&lt;N&gt;.a&lt;M&gt;.json — immutable</text>
      <text x="36" y="298">attempts · observations · decisions — append-only</text>
      <text x="36" y="315">budget.a&lt;M&gt;.json — a counter</text>
      <text x="36" y="332">leases/&lt;unit&gt;.json — TTL, owner, resource</text>
      <text x="36" y="370" font-size="10" opacity="0.75">owner: the orchestrator. Regulators never write here.</text>
    </g>
    <text x="550" y="224" text-anchor="middle" font-weight="700" font-size="12.5">THE DOMAIN</text>
    <text x="550" y="240" text-anchor="middle" font-size="10" opacity="0.65">the repository</text>
    <g font-size="9.5" opacity="0.85">
      <text x="401" y="264">base checkout on main</text>
      <text x="401" y="281">.regulator/worktrees/u1 — branch unit/u1</text>
      <text x="401" y="298">regulator/identity/ — write-protected, diffed at closeout</text>
      <text x="401" y="315">vendor/ — protected by convention</text>
      <text x="401" y="332">src/ test/ — the unit's writable grant</text>
      <text x="401" y="358" font-size="10" opacity="0.75">the output: read as code, tested as code;</text>
      <text x="401" y="372" font-size="10" opacity="0.75">never read as "how far along is the unit".</text>
    </g>
    <text x="915" y="224" text-anchor="middle" font-weight="700" font-size="12.5">REGULATORY STATE</text>
    <text x="915" y="240" text-anchor="middle" font-size="10" opacity="0.65">.regulator/*.ndjson, append-only</text>
    <g font-size="9.5" opacity="0.85">
      <text x="766" y="264">audit.ndjson — evidence, verdicts, acceptances</text>
      <text x="766" y="281">signals.ndjson — every typed message, and the</text>
      <text x="766" y="298">  obligation events that say what became of each</text>
      <text x="766" y="315">effects.ndjson — intended / committed / confirmed</text>
      <text x="766" y="332">memory.ndjson — facts with provenance + expiry; not identity</text>
      <text x="766" y="349">outbox — what is owed to a person, delivered once; reminded</text>
      <text x="766" y="370" font-size="10" opacity="0.75">owner: the regulators; the orchestrator only reads.</text>
    </g>
  </g>
  <g fill="none" stroke="currentColor" stroke-width="1.3">
    <line x1="120" y1="60" x2="120" y2="198" marker-end="url(#stores-arrow)"/>
    <line x1="230" y1="60" x2="230" y2="198" stroke-dasharray="3 3" marker-end="url(#stores-arrow)"/>
    <path d="M 280 40 C 360 40, 380 130, 430 198" marker-end="url(#stores-arrow)"/>
    <line x1="550" y1="60" x2="550" y2="198" marker-end="url(#stores-arrow)"/>
    <path d="M 460 60 C 400 100, 330 130, 300 198" marker-end="url(#stores-arrow)"/>
    <path d="M 640 60 C 700 100, 770 130, 800 198" marker-end="url(#stores-arrow)"/>
    <line x1="930" y1="60" x2="930" y2="198" marker-end="url(#stores-arrow)"/>
    <path d="M 840 60 C 780 90, 720 120, 680 170 L 668 188" stroke-dasharray="3 3" marker-end="url(#stores-arrow)"/>
  </g>
  <g font-size="10.5" fill="currentColor" opacity="0.85" paint-order="stroke" stroke="var(--vp-c-bg)" stroke-width="5" stroke-linejoin="round">
    <text x="126" y="92">writes units, attempts, decisions</text>
    <text x="126" y="186">reads the report</text>
    <text x="306" y="186">report_result · budget ledger</text>
    <text x="292" y="76">merges unit/u1 into main; runs the checks at HEAD</text>
    <text x="556" y="150">write · edit · bash · commit</text>
    <text x="724" y="172">signals · effects · observations</text>
    <text x="936" y="92">evidence, verdicts,</text>
    <text x="936" y="105">findings, decisions</text>
    <text x="690" y="100">reads the worktree at HEAD — as code</text>
  </g>
  <text x="550" y="428" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.65">no arrow leaves the domain for either store: state is written down, never inferred from the diff</text>
</svg>
<figcaption><b>INV-005 — nothing reads its own progress off the domain.</b> The orchestrator owns the execution store and is the only thing that merges into the base. The session writes the domain through gated tools and writes its report and ledger into the store. S3* and S2 write regulatory state; the router and the read model consume it. The one thing missing on purpose is an arrow from the repository back into either store.</figcaption>
</figure>

## The definition

The definition is what the control plane *is*: versioned, checked, shipped with the
package. It is declared, not assembled.

| Part | Where | What it declares |
| --- | --- | --- |
| Registry | `registry/regulators/*.json` | one record per regulator |
| Identity seed | `identity/*.md` | the four S5 files every instance starts from |
| Profiles | `profiles/*.json` | what a unit type may use and write |
| Policies | `policies/*.json` | budgets and model routes, recovery, routing, interaction |
| Workloads | `workload/*.json` | unit types, their profiles and their checks |
| Evals | `evals/*.json` | suites with declared arms and ablations |
| Contracts and fixtures | `contracts/`, `fixture*/` | the examples the package runs against itself |
| Settings | `settings.json` | the Pi settings a unit's session runs under |

`regulator check` validates all of it together: every profile a workload names exists,
every tool a profile grants is declared with its effect, a contract-less unit type runs
under a read-only profile, every registry record cites tests that exist and states a
limitation, no review date has passed. The check runs under `pnpm check`, so the
definition cannot drift from the code that enforces it. The
[definition reference](/reference/definition) documents each file.

A change to the definition is a pull request. The identity seed has one more path: an
identity decision accepted in an instance is promoted into the seed with
`regulator identity promote`, so every later `init` starts from it.

## The instance

An instance is one repository running under one definition at one revision. `regulator
init` creates it; the [instance layout](/reference/instance) lists what it holds. Two
kinds of state live there, in different stores, and neither infers the other:

- **Execution state** — units, attempts, leases, budgets consumed, worktrees — in the
  orchestrator's store. Only the loop writes it.
- **Regulatory state** — trace, signals, obligations, evidence, verdicts, memory, the
  effect journal — in append-only logs and the event store. Regulators write it; the
  loop reads it to decide what a unit may do next.

Nothing in `.regulator/` is configuration and a person edits none of it by hand. What a
person *declares* about an instance — the writable and protected prefixes, who
initialized it — is in the manifest, written by `init` and read by the profile grant
and the closeout. The manifest also pins the definition's revision: an instance
initialized under an older revision shows `definition-drift` in `doctor` until a person
reads the upgrade note and runs the next unit.

The repository's own files — `.pi/`, `AGENTS.md`, extensions, skills — say nothing to
the harness. That is the trust rule: the project is the domain, and the domain does not
configure its regulator.

## The domain

The domain is the repository: the code, the tests, the ledger, whatever the workload is
about. Units change it, in worktrees, on branches, and the loop reintegrates what
verified. The harness reads it as evidence at a revision (the host checks) and never as
state. Two files are the exception, and they are the domain's only harness-owned
content: `regulator/identity/` — the instance's copy of the S5 files, committed, and
protected by the write gate, the bash snapshot-and-restore and the `identity-untouched`
check — and the `.regulator/` line in `.gitignore`.

## Why the split matters

- A run's trace under `.regulator/` can be deleted and the definition still says exactly
  what the control plane does.
- Two repositories under the same definition behave the same way, differing only in
  what their manifests declare.
- The eval harness can run the same suite against a fixture under different arms
  because an arm is a definition-level choice — which extensions load, which checks
  run, whether identity is seeded — not a property of an instance.
- Promotion has a direction: instance → definition, by a person, with a rationale,
  committed in the definition's repository. Nothing flows the other way by itself.
