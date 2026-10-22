# Todos from the Wintercorn (2026) note

Concrete items this note argues for. Per `AGENTS.md` and `ROADMAP.md` § "How this page is kept", none of these is tracked here: each is a candidate until it has a threads row, a `DEBT.md` row or an issue, and this list is re-checked against `main` before anything is filed. Each item names the mechanism level it is proposed at and the seam it lands on.

## Now (documentation, no code)

- [ ] **Add this note to the table in `docs/research/README.md`** (done in the change that added the note; keep the row's status current).
- [ ] **Add a threads row to `ROADMAP.md`** for the note's next step: "graph outputs under S3\*: asserted, entailed, derived; severity per shape declared", fits beside the knowledge-production workload ([#61](https://github.com/MetaCoding-io/regulator/issues/61)). The convention says a note that names a next step gets its row in the same change; this one was left for the maintainer so the roadmap is not edited from a reading note without review.
- [ ] **Add a row to `docs/PATHOLOGIES.md`**: "A trace across views is read as current when one view has drifted" (sub-forms: a derivation presented as current after its inputs moved; a correspondence whose referenced identifier was renamed). Absorbed by: evidence freshness bound to a revision (`audit.ts`), authority-reference resolution, the generated figures. Cite the note.

## When the knowledge-production workload is designed (#61, the ArticleMiner note)

- [ ] **Specify the three provenance classes for graph outputs in the workload design** (level 3, typed protocol): a unit's emitted graph is *asserted* (S1 claim); a check's materialised consequences are *entailed* and live in their own named graph, never merged into a source graph; a "current view" is *derived*, bound to the graph revision and the step that produced it. Write it into the ArticleMiner note §4 (the domain seam) as the graph-naming rule the RDF row of the isolation table needs.
- [ ] **Shape the `shacl` domain check's observation after the three-condition criterion** (level 2, a declared command with criterion binding): the expectation names a query and its expected rows; the record binds to that criterion; and a second declared check asserts the rows are *absent* over the asserted graphs alone and *present* over asserted plus entailed, so a unit that writes the conclusion into its output directly fails. This is `inherited-tests` for graphs.
- [ ] **Declare severity per shape in the workload definition** (level 2): `sh:Violation` yields `fail`, `sh:Warning` yields a recorded finding with `pass`, absence of a required record yields `inconclusive`. The reject-versus-keep decision the thesis left to judgement is a policy field here, not a prompt.
- [ ] **Require the rule set in the evidence environment** for any check that reasons: the record's environment names the entailment regime it ran under (none, RDFS, OWL 2 RL), because the thesis shows a property-chain leg vanishing silently under a weaker regime, which would read as a clean `inconclusive`.

## When semantic S2 is designed (#14)

- [ ] **Treat an identity-key commitment as an asserted correspondence with an owner, never an inferred one.** Record in #14's design that no terminological rule can join two graphs that share no identifier (the thesis's result), so a commitment over a key is a typed assertion a unit makes and another unit may contest, and the reconciler returns disagreement as data. Cite the note.
