# Documentation and website gaps

- **Status:** open, a work list. Strike items as they land.
- **Source:** a coverage audit (2026-09-25) of the docs site (`docs/`, every built
  page and every generated source) and the product website
  (`regulator-website/site/`, the four live pages) against an inventory of what the
  product exposes: the typed tools a session gets, the eight message kinds, obligations
  and dispositions, every CLI command, the forty-three registry cards, the definition
  files, contracts and reports, and the concepts. Coverage was graded *explained*
  (a sentence or more on what it is and how it behaves), *mentioned* (a name in a
  table or list) or *absent*.
- **Method note.** The generated regulators page carries a full prose card per
  regulator, so every mechanism is *explained* there; the gaps below are about whether
  it is explained anywhere a reader would look first, in product vocabulary rather
  than course vocabulary.

## 1. Verified against the code first

These were checked by hand after the audit, because a work list that starts with a
wrong claim is worse than none.

| Finding | Verified | Where |
| --- | --- | --- |
| ~~**Probable product bug: a live `implement`, `research`, `bookkeeper` or `auditor` unit cannot call `report_result`.**~~ *Fixed: the contract extension adds `report_result` to the surface when a contract loads.* Only `profiles/intelligence.json` lists it, and the profiles extension sets the session's active tools to exactly the profile's list (`regulator-pi/src/profiles.ts:106`). Every live attempt under those profiles would end `no-report`. The scripted evals and the finance test never run a session, so nothing catches it; the live report (DEBT row 33) is still owed, so no live run has contradicted it. | yes | fix in the profiles, or grant `report_result` (and `remember`) by the contract extension regardless of profile, since a contracted unit *must* report; add a definition-check rule that a contracted unit type's profile grants `report_result` |
| `regulator check` and `regulator docs` are not commands of the installed `regulator` bin. They live in `registry-cli.js`; `regulator doctor` runs the same checks. About eleven passages on the site tell a user to run them. | yes | `packages/regulator/package.json` `bin`; `src/cli.ts` has no branch; `src/registry-cli.ts:23` |
| The disposition list in the CLI usage (and so the generated CLI reference and `guide/running-units.md`) is wrong: it says `accepted, rejected, accepted-risk, remediated, superseded`; the schema has `no-action, accepted-risk, rework, replan, fixed, verified, rejected, accepted, research-requested, audit-requested, policy-clarification-requested`. | yes | `src/cli.ts:30`; `protocol/src/obligations.ts:34` |
| "Every `--by` is checked against the interaction policy" is false for `init`, `unit accept` and `eval`; the other seven `--by` sites go through `authorized()`. | yes | `src/cli.ts` (`authorized` at 163, 356, 365, 373, 380, 399, 445; not at `init`, `unit accept`, `eval`) |

## 2. Docs site: largest gaps, ranked

1. **Nobody but `alice`, `bob` and `course-lab` may disposition anything, and declaring
   your own people is undocumented.** Getting started works only because `alice`
   ships. The override is a copied `interaction.json` passed as `--interaction` to
   every command, and `REGULATOR_INTERACTION_POLICY` for sessions. → "Declare who may
   answer" in `guide/getting-started.md`; a "Customizing the definition" section in the
   operating guide covering `--policy`, `--recovery`, `--routing`, `--interaction`,
   `init --definition`.
2. **Obligations have no concept page.** Severity semantics, the lifecycle (open → ack
   → resolve / escalate → successor), the instance-wide veto (an audit finding with no
   unit holds every dispatch), and what each disposition means are nowhere; the
   disposition list is wrong in two places (§1). → `concepts/obligations.md`; fix
   `cli.ts:30`.
3. **The tools a unit session gets have no reference.** `report_result` and its
   preflight; `ask_human` per kind and how an answer becomes a disposition (consent
   yes → `accepted`, uat yes → `verified`, else `fixed`; `core/src/interaction.ts:32`);
   `notify_owner` with the effect journal and idempotency; `propose_policy_change`;
   `read_conventions`; the session tools `run_tests`/`run_checks` versus the host
   checks of the same name; and that the `vsm_*` tools are a separate generic
   extension not loaded into a unit's session. → `reference/tools.md`: per tool, the
   input fields, the effect, which profiles grant it, what it records.
4. **`reference/instance.md` is wrong about the stores.** `events.db` holds only the
   `vsm_*` reporting-tool events, not obligations; obligations fold from
   `signals.ndjson`, which also holds interaction events and is append-only, not a
   queue to drain; `canaries` and `outbox.cursor` are missing; "re-run `init`" is
   refused by the code. → fix the rows in place, against
   `concepts/definition-and-instance.md`, which is right.
5. **Typed channels: nothing says what emits each kind.** In the code: coordination =
   the thrash detector and `unit.ts`; audit-finding = the bash watch, closeout, post-
   merge; algedonic = the `escalate` recovery action; operational and uncertainty =
   report fields (`residualUncertainty`), not a tool. **`constraint` has no emitter**
   yet the table lists it. → an "emitted by" column in `concepts/control-plane.md`;
   drop or flag `constraint`.
6. **The post-merge check is missing from the loop narrative** (running-units step 5
   and the control-plane figure caption) though it holds the whole instance.
7. **The control room has no page**: how to launch it (`regulator-control-room`, the
   port, `--definition`/`--instance`), what each view shows, the `status --json` read
   model. → `guide/control-room.md`.
8. **Identity seed format is undocumented and one claim is false.** The `## INV-001 —
   Title` heading form, the refused-word line form, the seed's own INV-001…004 (no
   page lists them), and "`BOUNDARIES.md` is generated from the registry" (nothing
   generates it). → `reference/definition.md` § Identity seed.
9. **The host seam.** The `Host` interface a second host must export
   (`regulator/src/host.ts`) and how it is resolved are absent. → "Writing a host" in
   `project/packages.md` (issue #58 needs it anyway).
10. **The regulators page has no introduction**: it opens with "Generated … do not
    edit" and a 43-row table. → an introduction in the renderer
    (`core/src/registry.ts`), and render "introduced in M07" as a version.
11. **`authorityRef` and report fields.** The reference says "an invariant, an accepted
    decision, a planning record"; the code accepts `INV-nnn`, `reg.…`, `human:<name>`,
    `obligation:<id>` and refuses free text. The report's field names and enums
    (`unresolvedOutcomes` preserved/surfaced; deviation kinds; consequence) and the
    `policy-clarification` handling are absent. → rewrite § Work contracts.
12. **Smaller:** the workload's unit-type → profile mapping is never explained
    (`research` runs under `intelligence`; `plan`, `verify`, `close` under `research`);
    identity context's 6000-character limit, the evidence preflight and the failure
    observer are card-only; lease TTL and liveness are card-only; `unit start`'s
    `--contract`/`--unit`, `init --definition`, `identity promote --definition`, `eval
    --host` are undocumented; `fixture`'s three fixtures are never described.

## 3. Website: largest gaps, ranked

1. **No link to the docs site anywhere, and no install path.** → a "Get started" block
   on `product.html` (`pnpm add -D @metacoding.io/regulator @metacoding.io/regulator-pi`,
   `init`, `doctor`, `unit drive`) linking `guide/getting-started`; a Docs link in
   every nav and footer; the deep-link table in §5.
2. **Operating is barely shown.** Obligations, dispositions, `answer`, `watch`,
   `remind`, `identity accept/reject/promote`, `review --due`, `doctor` in CI appear
   only as words. → an "Operating an instance" section: what a person does day to day.
3. **Typed channels and the routing policy are absent**: the eight kinds, the severity
   line, the floors, "a signal is not an audit; a proposal does not mutate policy". →
   a `how-it-works` #channels section from the control-plane table.
4. **The algedonic path is thin**: only consent is explained; recap is mentioned;
   choice, clarification and uat, the attention budget, and `people` /
   `resolveUpTo` / `actAsS5` are absent. → a `how-it-works` #algedonic section with a
   small ask_human → pause gate → outbox → answer figure.
5. **S5 identity has no section of its own**: the four files, INV-nnn, refused words,
   write gate + bash restore + identity-untouched, and the proposal → accept →
   promote direction. → "Identity you cannot prompt away" on `product.html`.
6. **Definition versus instance versus domain** is drawn as three stores but the
   direction (the definition is the product; an instance is one repository; promotion
   flows instance → definition by a person) is not stated.
7. **Budgets and routes:** the five ceilings and `primary` + `fallback[]` are never
   listed. **Evals:** pre-registered metrics, outcome versus trajectory graders and the
   interpretation rule are only gestured at. **S4 versus memory:** expiry and affected
   units are absent. **Registry card anatomy:** mechanism level, `review --due`,
   retirement by a person. One short section each, linking the concept pages.

## 4. Stale or wrong claims, condensed

Docs site:

- `regulator check` / `regulator docs` as commands (§1), in control-plane,
  definition-and-instance, reference/definition ×3, evidence page, PATHOLOGIES,
  OPERATING, CONTRIBUTING.
- Recovery fallback: the reference says a rule that runs out "falls through to
  `fallback`"; the last action repeats, and `fallback` applies only to a cause with no
  rule (`core/src/recovery.ts:93`).
- Invariant numbers from the project's own `vsm/` (INV-005, INV-006) cited as if they
  were the seed's; the seed has INV-001…004. The finance example reuses INV-005 for a
  different invariant. GLOSSARY's "where it lives" column points at `vsm/` files and
  `vsm_propose_policy_change`; an instance uses `regulator/identity/` and
  `propose_policy_change`.
- The evidence page's switch table omits `tool:`; host-checks says a `verify` unit may
  report an audit finding, but the `research` profile grants no reporting tool.
- GLOSSARY "Recovery action" lists seven actions and omits `escalate`.
- `reference/boundary` (from the algedonic-delivery card) still says "no real channel …
  nothing schedules them"; `regulator watch` paid that (DEBT row 27).
- `DEBT.md`'s table is broken: the "Permanent limits" paragraph sits between rows 30
  and 31, so rows 31–41 render as loose text.
- Broken anchors: running-units → `packages#metacoding-regulator-control-room`
  (VitePress slug is `metacoding-io-…`); PATHOLOGIES → a GitHub-style GLOSSARY anchor.
- getting-started tells the reader to edit `policies/default.json` inside the
  installed package instead of passing `--policy`; the finance example's `regulator
  fixture … && cd ~/ledger` block then uses source-checkout paths.
- REPORTING.md is issue-era prose (`pnpm pi`, "this issue does not expand…", GSD
  history); PATHOLOGIES names a `report_uncertainty` tool that does not exist.
- Course vocabulary a product user cannot follow, by page: GLOSSARY 78 occurrences,
  DEBT 41, regulators page 103 ("introduced in M13", "lesson 08", owner "course-lab"),
  boundary page 28, PATHOLOGIES 20, personal-finance 4. The cards are the source of
  most of it (issue #56 pays part).
- "coding-agent harness" survives in CONTRIBUTING (→ the contributing page), README
  line 1, both package descriptions and keywords, while the site and `docs/index.md`
  say "agents". ARCHITECTURE's S1 profiles "API, data, UI, infrastructure" do not
  exist, and it sends readers to an archived GSD map "for the current mapping".

Website:

- `product.html` status card: "2 packages … 0.1.0". Six packages at 0.1.1.
- `product.html` repository layout lists a `cli/` package (folded into `regulator` at
  0.1.0) and `course/lab/`, `course/modules/` (the course is private and not in this
  repository); S1 row lists profiles that do not exist.
- `how-it-works.html`: "drawn from the reference build at checkpoint 9"; "eight
  extensions" labelled cp1–cp9 (there are eleven, named by concern); the sequence
  diagram's `<text>` uses cp4/cp5/cp6/cp7/cp8/cp9; the tools row omits six tools; the
  contract shown as "unchanged" differs from the file and cites a retired regulator.
- "43 regulators" on the site versus "forty-two active" in the docs: 43 records, 42
  active. The finance example's manifest line says 42; `init` records 43.
- `product.html` says consent before irreversible actions is "still design"; it
  shipped; what is open is narrower (DEBT row 29). Says "all five views ship" and
  lists four; the page renders seven.
- Every "Full glossary ↗" and "the example in the repo ↗" links into the private
  course repository; `glossary.js` deep-links the archive by line number. The navmark
  still reads "VSM · PI".
- `personal-finance.html` "copy-paste order" breaks after `cd ~/ledger`; `regulator
  check` again; "Six questions" heading over eight rows.

## 5. Where the website should link into the docs

| Site location | Docs page |
| --- | --- |
| product status / new install section | `guide/getting-started`, `reference/cli` |
| how-it-works contract, report | `reference/definition#work-contracts` |
| how-it-works recovery | `reference/definition#recovery-policy` |
| how-it-works loop, workload | `reference/host-checks`, `reference/definition#workload` |
| how-it-works stores, disk | `concepts/definition-and-instance`, `reference/instance` |
| product mechanism, architecture | `concepts/control-plane`, `ARCHITECTURE` |
| registry mentions | `reference/regulators`, `reference/boundary` |
| eval mentions | `concepts/evidence-about-the-regulators` |
| intelligence and memory mentions | `concepts/intelligence-and-memory` |
| personal finance | `examples/personal-finance`, `guide/operating` |
| glossary tooltips | `GLOSSARY`; pathology mentions → `PATHOLOGIES` |

Navigation: `how-it-works` does not link to `personal-finance`; the product footer
omits it; the site root is the course page, so a prospective product user has to find
"The product ↗" in the nav; no npm or changelog link.

## 6. Corrections owed to the two new concept pages

`concepts/intelligence-and-memory.md`:

- "A finding that names no unit opens one obligation with no unit" is wrong: the
  router falls back to `message.unit`, which is always the research unit's own id
  (stamped from its lease), so the obligation lands on the research unit and at
  `blocking` vetoes its own close.
- Floors test `subject`, `observation` and `rationale`, not `claim`; an invariant id
  only in the claim is not raised.
- The recovery paragraph omits that a waiting action (remediate, replan, clarify,
  pause, escalate) escalates the unit's open S3 obligations to a `recovery-decision`
  successor instead of resolving them.
- Scope filtering does not apply when the session has no leased unit.

`concepts/evidence-about-the-regulators.md`: add `tool:` to the switch table; replace
`regulator check`; the fingerprint also carries `arch` and records a live dispatcher
as `pi`.

## 7. Suggested order

1. The product bug in §1, with a definition-check rule so it cannot recur.
2. The four wrong facts in §1 (they are one-line fixes and the CLI reference regenerates).
3. Docs gaps 1–5: people, obligations page, tools reference, the instance layout page,
   channel emitters.
4. Website gaps 1–2: the docs link and install path, and the operating section; then
   the checkpoint-label and package-fact corrections, which are search-and-replace.
5. The rest of §2 and §3 as separate small pull requests, one page each.
6. The course-vocabulary sweep last, since the cards are its source and #56 is already
   scheduled to change them.
