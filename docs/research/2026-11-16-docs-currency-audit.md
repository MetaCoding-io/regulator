# Are the docs keeping up? A currency audit

- **Status:** open. No issue yet; §7 is the work list in the order to take it, and §2
  holds four findings that are decisions about the product before they are edits to a page.
  All four were decided and done on 2026-11-16; each row says how.
- **Source:** an audit on 2026-11-16 of every hand-written page against `main` at
  `a0706e7`: the docs site's guides, concepts, reference pages, examples and project
  pages; `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `OPERATING.md`, the changelog and
  the package READMEs; and the five live pages of the product website
  (`regulator-website/site/`). The course repository was not audited.
- **Method.** Three passes. Mechanical: the docs build, `regulator docs --check`,
  `regulator check`, and every count a page states held against the code. By page: four
  reviewers each took a group of pages and checked every claim the code can confirm or
  refute (field names, enum values, defaults, paths, commands, counts, "not yet"
  statements), and one of them ran the getting-started and running-units command
  sequences in a scratch instance. By change: each merge since 0.1.3 looked up in the
  pages that should carry it. The findings marked *verified* were re-checked by hand
  after the reviewers reported; the rest are the reviewers', each with a file and line.
- **Why a note:** the [earlier audit](2026-09-25-docs-and-site-gaps.md) asked whether
  the docs *cover* the product and closed on 2026-11-11. This one asks whether they are
  still *true*, seven weeks and about forty merges later. They are two different ways
  for a page to fail, and the second has a cause the first did not.

## 1. The answer

Where a page is generated or checked, it is current. Where a person keeps it, it is
current for the feature the last change was about and stale for everything that page
says in passing.

**Current, and held there by a mechanism:**

- The docs site builds with no dead link.
- `regulator docs --check` passes: `REGULATORS.md`, `BOUNDARY.md`, `VIABILITY.md`,
  `PATHOLOGIES.md` and the two figures are what the registry and the definition render.
- The CLI reference, the roadmap, the changelog, the operating guide and the
  contributing page are copied from their sources at build time
  (`docs/scripts/generate.mjs`), so the site cannot disagree with them.
- The changelog's Unreleased section has an entry for every code-changing merge since
  0.1.3 but one (§4).
- The sidebar lists every hand-written page and links none that is missing.

**Current, by hand, and well kept:** `docs/examples/portfolio.md` (every path, number
and sensor output matched, through #181), `docs/REPORTING.md`, `docs/concepts/coordination.md`,
`CONTRIBUTING.md`, and the parts of the definition reference, the recovery page and
the evidence page that the changes of the last two weeks touched directly.

**Stale:** about ninety findings across the rest, in five kinds (§3 to §5). None is a
page nobody maintains. Most are a sentence in a maintained page that a change elsewhere
made false.

## 2. Four findings that are decisions first

Each of these is a place where a page and the code disagree and it is not obvious the
page is the one that is wrong.

| Finding | Evidence | The decision |
| --- | --- | --- |
| **The Pi host's manifest lists eleven extensions and the dispatcher loads twelve.** `declared-tools` is in `EXTENSIONS` and absent from `pi.extensions`, so a session loaded by `pi install` has no workload-declared tool (`place_trade`), while a unit the loop dispatches has it. *Verified.* | `packages/regulator-pi/package.json` (`pi.extensions`); `packages/regulator-pi/src/dispatcher.ts:44` | **Decided (2026-11-16, James): a bug, fixed.** `./dist/declared-tools.js` is in `pi.extensions` after `tools`, a test in `enforcement-points.test.ts` holds the manifest against `EXTENSIONS`, and the package README says twelve. The three pages that said "every session extension" are now right |
| **A blocking deviation does not hold the unit's close.** Three sentences say it does; the loop closes the unit, merges it, and raises the blocking signal afterwards. The test's title says so. *Verified.* | `docs/concepts/contracts.md:153`, `docs/concepts/obligations.md:14` and `:88`; `packages/regulator/src/controller.ts:315-342`; `controller.test.ts:131` | **Decided (2026-11-16, James): the code is the intent.** A deviation is reported, not hidden, and does not hold the close. The three sentences are corrected: `contracts.md` says the unit lands and the obligation stays open against it, and that a check covering the fixed decision is what keeps a deviation off the base; `obligations.md` says the veto runs at dispatch and at a re-audit, not when a verified attempt closes, and no longer cites the retired post-merge check as its instance-level example |
| **Two documented commands fail on a hand-started unit.** `regulator unit start u2 --type implement` is refused (the type requires a contract), and `unit close u2` and `unit show u2` answer `no unit "u2"`, since a hand-started unit has a lease and a worktree and no execution record. *Run in a scratch instance.* | `docs/guide/running-units.md:68` and `:77`; `packages/regulator/src/cli.ts:354` | **Decided (2026-11-16, James): by hand is supported, and the code already supports it.** `unit start <id>` with no type (or a type that needs no contract) and `unit finish` work; the refusal of a contracted type is deliberate (`cli.ts:348`). The guide had the wrong commands: it now starts the unit without `--type`, runs the session command `unit start` prints, and says that `unit finish`'s trial on the merged tree is what verifies a hand-run unit, since it has no execution record for `unit close` to re-audit |
| **The repository disagrees with itself about 0.1.4.** Every `package.json`, npm, the changelog and the latest tag say 0.1.3. `docs/project/packages.md:108` and the website say 0.1.4 is current, a registry card says "Retired in 0.1.4", and `OPERATING.md:232` and two code comments say "as 0.1.4 wrote it". *Verified.* | `packages/regulator/registry/regulators/post-merge-check.json`; `packages/protocol/src/execution.ts:165` | **Settled from the record (2026-11-16): 0.1.3 is current and 0.1.4 was never cut.** The tags are `v0.1.0` to `v0.1.3`, npm has the same four, every `package.json` and `ROADMAP.md` say 0.1.3. The pre-merge trial's change of 2026-09-29 wrote "0.1.4" expecting the next release (`1c29449`: "names 0.1.4 as the version the next release cuts"); #92 later corrected the card's `introducedIn` to `unreleased` and its changelog entry says so, and the prose was left. The Unreleased section changes the definition's formats, which the changelog's own rule makes a minor version, so the next release is 0.2.0 and there will be no 0.1.4. Every "0.1.4" outside a test fixture now reads 0.1.3 or "after 0.1.3". The website's "0.1.4 is current" is in §5 |

## 3. Wrong: a page states something the code refutes

### Counts

The registry has 53 records, 51 active and 2 retired. The definition has three
workloads, six profiles and seven policy files in five kinds. The Pi host loads twelve
session extensions. There are 28 built-in eval metrics and eight committed reports.

| Page | Says | Is |
| --- | --- | --- |
| `docs/index.md:23` | forty-two active regulators | 51 |
| `README.md:55`; `docs/examples/personal-finance.md:379` | forty-nine records | 53 |
| `docs/project/whats-coming.md:75`, `:288` | registry (43) | 53 |
| `docs/concepts/hosts.md:82` | 22 in the control plane, 21 in the host | 28 and 23, with eleven records missing from the two lists |
| `README.md:95` | four committed drift reports | 8; `AGENTS.md:39` says three |
| `docs/reference/definition.md:327`; `whats-coming.md:43` | fifteen built-in metrics | 28 |
| `packages/regulator-pi/README.md:3` | eleven session extensions | 12 |
| `OPERATING.md:311` | the four policy files | seven files, five kinds |
| `docs/examples/personal-finance.md:371` | two workloads, five profiles | three and six |
| `docs/PATHOLOGIES.md:100` | four scripted behaviours | five |

### "Not yet", after it landed

- `docs/concepts/evidence-about-the-regulators.md:412`: "None has been committed yet",
  of a live report. The first live report is committed and the same page cites it at
  lines 52 and 331. *Verified.* `docs/concepts/hosts.md:144` says the same of the
  session gates.
- `docs/concepts/intelligence-and-memory.md:267`: "Only a research unit can report
  intelligence", and line 290 calls declared sensors a design note. Sensors landed in
  #123. *Verified.*
- `docs/project/whats-coming.md:8`: "only the first row of the last table has shipped".
  Slices 2 and 3 (#138, #200) have landed, so three rows of that table, the "next"
  paragraph and most of the After figure describe shipped things as proposed. The page
  has not changed since 2026-10-27. *Verified.*
- `AGENTS.md:41` (Next): lists the #201 suite changes and the #49 graders, both landed.
- `docs/examples/personal-finance.md:164`: "nothing reads a tool's effects for it
  (#121)", against its own §5.

### A mechanism that was retired or moved

- The post-merge check, retired for the pre-merge trial, is still described as current
  in `AGENTS.md:39`, `docs/examples/personal-finance.md:115` and `:397`, and
  `docs/concepts/obligations.md:90`.
- `docs/examples/personal-finance.md:219`: the `bookkeeper.json` excerpt shows an inline
  `advice` array. Advice has been a file per profile since #110, and the real profile
  has a `consent` block and `report_result`. Line 233 lists the auditor's tools without
  `report_result` and `propose_policy_change`.
- `docs/project/packages.md:63`: gives `checks` the audit log and the write preflight,
  which are in `core`; the dependency diagram shows `checks` depending on `core`, and it
  depends only on `protocol`.
- `AGENTS.md:39`: the read model "in `packages/cli`". There is no such package.
- `README.md:61-77`: the layout block lists `agents/`, `experiments/` and `vsm/example/`.
  None exists. `AGENTS.md:55` sends prompts to `agents/`. *Verified.*
- `docs/GLOSSARY.md:27`, `:32`: two rows point at documents now under `docs/archive/`;
  line 59 gives a capability profile a model and a context, which the schema does not.

### Behaviour described imprecisely enough to mislead

- `docs/reference/host-checks.md:14`: `run_checks` runs "lint, typecheck, build". It
  runs `node --check` on each file under `src/` and `lib/`, and `protected-untouched`.
- `docs/concepts/asking-a-person.md:72`: while paused "only pure reads remain".
  `report_result` is let through, by design (`regulator-pi/src/algedonic.ts:118`).
- `docs/concepts/identity.md:79`: the bash watch covers `vsm/`. Only the write gate does.
- `docs/concepts/obligations.md:77`: the shipped floors raise to `critical`. The one
  floor raises to `blocking`, as the same page says five lines later. Line 113: the loop
  supersedes an obligation; nothing calls `supersede` outside its test.
- `docs/concepts/recovery.md:147`: a paused unit "is not routed at all". It is, once
  `waitCeilingMs` is declared; `asking-a-person.md` has this right.
- `docs/reference/definition.md:72`: `intelligence` is "read-only plus
  `report_intelligence`". It also grants `ask_human`, whose effect is irreversible.
- `docs/reference/tools.md:16-20`: three tools' "granted by" columns omit `manager`;
  `intelligence-and-memory.md:26` does the same for `remember`.
- `docs/concepts/evidence-about-the-regulators.md:386`: the sloppy treatment "refuses
  every unit". The committed report closes five of seven.
- `docs/guide/running-units.md:100`: `regulator remind` runs the sensors. Only `watch` does.

## 4. Missing: landed work a page of that kind should carry

| Work | Where it is absent |
| --- | --- |
| #200, the probe arm | `docs/reference/definition.md`: the arm's `advice` and `route`, the suite's `heldOut`, `evals/advice/`, `evals/interpretations/`; `docs/reference/instance.md:29`: `obligation-accept-refused` and `prediction-resolution` in the regulatory log; `docs/concepts/obligations.md:110`: `advice accept` and `reject` as S5 decisions |
| #201, #49, the report's shape | `definition.md:331`: the fingerprint's `toolchain`, `adviceByArm`, `modelsByArm`, `modelsObserved`; the per-task table, the baseline check and the cost-only label. The evidence page explains them; the reference does not list them |
| #178, the toolchain | The three places that describe `doctor` and the manifest (`getting-started.md:58`, `OPERATING.md:50`, `definition-and-instance.md:133`): `environment-drift` and four other checks of the fifteen `doctor` prints; `docs/concepts/identity.md:75` and `tools.md:39`: the five environment files as protected conventions |
| #123, sensors | `control-plane.md:35` and `:124`, `definition-and-instance.md:91` (the fifth policy kind), `OPERATING.md:128` (`watch` runs them; `--workload`), `docs/ARCHITECTURE.md:130` |
| #121, #122, #129 | `definition-and-instance.md:91`: a workload's `tools[]` and `metrics[]`; `control-plane.md:31`: a unit is "one session"; `contracts.md:174`: the dispatch gate refuses a delegating contract for a program-run type; `portfolio.md:375`: the example never shows its own `metrics[]` |
| #60, consent grants on a profile | The changelog. It is the one code-changing merge since 0.1.3 with no entry and no migration bullet (PR #155, forty-one files) |
| #153, the map | `docs/guide/control-room.md` and `packages/control-room/README.md` ("four questions"): the page's fifth section, and the read model's `predictions`, `evals`, `lifecycle` and `intelligence` |
| The variables a session and a program read | `instance.md:82` says three and "nothing else"; the host reads `REGULATOR_POLICY`, `REGULATOR_CONTRACT`, `REGULATOR_UNIT` and `REGULATOR_DEBUG`, and a command runner and a declared tool are passed four each |
| Required fields | `definition.md`: `metrics[].description`, `sensors[].description`, three fields of the result report, the registry's `introducedIn`. The schemas are closed, so a file written from the table is refused |
| `availableModels()` on the host | `hosts.md:46`, `packages.md:80` |
| Everything since late September | `AGENTS.md:39` ("Exists today" names no portfolio, command runner, declared tool, live report, `upgrade`, viability case or pre-merge trial); `README.md:53`; `docs/ARCHITECTURE.md` (unchanged since 2026-09-29; no sensors, programs, declared tools, or the definition and instance split) |
| Vocabulary | `docs/GLOSSARY.md` (unchanged since 2026-10-22) has no row for definition, instance, workload, host, command runner, declared tool, sensor, metric, grader, probe, `harness-edit`, prediction, toolchain, `context-degradation`, instrument or advice. `packages/regulator/registry/pathologies.json`: twelve active regulators absorb a failure no row names, which `regulator check` already warns about |

## 5. The website

The product page was last brought level with the product around 0.1.1 and states as
fact several things that have since changed. All *verified*.

| Page | Says | Is |
| --- | --- | --- |
| `product.html`, status | "A live eval report is still owed" | committed 2026-11-08 |
| `product.html`, status | 0.1.4 is current | 0.1.3 |
| `product.html`, status and three figures | 44 records, 42 active; "registry (43)" | 53 and 51 |
| `product.html`, status | forty-one debt rows | 51, of which 29 are paid |
| `product.html`, `how-it-works.html` | eleven session extensions | 12 |
| `how-it-works.html` | drawn from the build at 0.1.1; one workload | three workloads |
| `product.html` throughout | two workloads | no mention of the portfolio, sensors, program-run steps, declared tools, the probe or the toolchain |
| `product.html`, the control-room screenshot | 44 regulators | retake |

`one-process.html`, added today, was written against the current code.

## 6. Why it drifts, and what would hold it

Every stale finding is one of five kinds, and each kind has a cause.

1. **A number written in prose.** Ten places state a count of regulators, and they give
   five different numbers. Nothing compares a number in a sentence with the registry.
2. **A "not yet".** A sentence that says something is owed is true when written and has
   no link to the thing that will make it false. The change that lands the feature
   updates the page about the feature and not the pages that said it was missing.
3. **An inventory.** "Exists today", "Where it is", a package's contents, the list of
   profiles: each is a second copy of something the code enumerates.
4. **A page with no owner in the change.** A change updates the page nearest to it (the
   changelog, the example, the definition reference) reliably. It does not reach the
   concept page that mentions the mechanism in one row of a table. `ARCHITECTURE.md`,
   `GLOSSARY.md` and `whats-coming.md` have not been touched by any of the last forty
   merges.
5. **A second repository.** The website is in another repository, so no pull request
   that changes the product can fail on it.

The project's own rule applies: prefer a check to advice. `AGENTS.md` item 7 already
says to keep the tracking current, and it is advice.

- **Counts from the registry, not from memory.** `generate.mjs` already runs at every
  build. Have it write a small facts file (active and retired regulators, workloads,
  profiles, policy kinds, extensions, built-in metrics, committed reports, the package
  version) and have the pages interpolate it. For `README.md`, `AGENTS.md` and the
  website, where nothing interpolates, a test that reads each number beside the word
  "regulators", "records" or "extensions" and holds it against the facts. Level 2.
- **Inventories generated.** The package inventory in `packages.md` and the two host
  lists in `hosts.md` are derivable from `package.json` and
  `mechanism.implementation`. `REGULATORS.md` is the precedent.
- **A "not yet" cites what pays it.** A sentence in the built docs that says something
  is owed carries the debt row or the issue, as registry limitations already must. Then
  the change that strikes the row can grep for the sentences that cite it, and a check
  can refuse a page that cites a struck row. Level 2 over a convention.
- **The website checked against the product.** The same facts file, published with the
  docs site, and one script in the website's CI that fails when a page states a
  different number or version.
- **A reference page checked against its schema.** `definition.md`'s field tables could
  be held against the schemas' property names by a test, as `ENFORCEMENT_POINTS` is
  held against the code: every property named, no property invented. That would have
  caught eleven of the findings in §4.

## 7. The work, in order

1. **The four decisions in §2.** Two may be product bugs, and one changes what three
   pages should say.
2. **The wrong statements a reader acts on:** the two failing commands in
   `running-units.md`; the "no live report" sentences (the evidence page, `hosts.md`,
   the website); "only a research unit" in `intelligence-and-memory.md`; `run_checks`
   in `host-checks.md`; the required fields in `definition.md`.
3. **The website's status block and counts**, since it is the public statement.
4. **`whats-coming.md`**, rewritten from the roadmap: it presents three landed slices
   as proposals.
5. **The counts**, once, with the facts file of §6 so they do not need doing again.
6. **`AGENTS.md`'s "Exists today" and "Next"**, and `README.md`'s layout block and
   inventory. An agent reads these first, so a stale one is acted on.
7. **The missing coverage in §4**, a page at a time, the reference pages first.
8. **The glossary rows and the twelve pathology rows.**
9. **The schema test for the reference pages**, the "not yet" convention and the
   website check, as the mechanisms that keep 2 to 8 from recurring.

The reviewers' full findings, with a file and line for each, are the source for every
row above; a finding not *verified* here is re-checked before its page is changed.
