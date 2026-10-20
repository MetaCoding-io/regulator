# The accept-path split on `BOUNDARY.md`

- **Status:** graduated: slice 1 is [#110](https://github.com/MetaCoding-io/regulator/issues/110)
  (`roadmap:0.2`); slices 2 to 4 of §8 stay designed here until each becomes an issue.
- **Source:** the [Harness² note](2026-10-18-harness2-recursive-harnessing.md), §4 item 5
  (the split), §7 (the reflector) and §8 (a proposal's three records), and the code the
  split has to sit on, cited by file below.
- **Why a note:** every row of the reflector's change table takes "the proposable set" as
  an input, and the Harness² note left that set as prose. This note makes it data: which
  definition files land through which accept path, declared once, checked by
  `regulator check`, rendered into `BOUNDARY.md`, and read by the intake, the accept
  command and the probe. Reading the code for it turned up one fact the earlier note had
  not seen (§2), and that fact is most of the design.

Claims about what the code does today cite the file. The rest is proposal.

## 1. The question, and the answer in one paragraph

Every definition file is proposable, because INV-002 already makes a proposal change
nothing. What differs is the path an accepted proposal takes, and the split is the
declaration of those paths. There are three. **Identity** lands through
`identity accept` and reaches the seed through `identity promote`, both of which exist.
**Advice** lands through a sibling command that writes one advice file in the instance
and a sibling promote that carries it to the seed. **Everything that executes or grants**
(a profile's tools and writable paths, a unit type, a check, a policy, an eval suite, an
extension) lands only as a merged change to the definition's repository, verified by
`regulator check` and the tests before the merge, by a person. The split is a closed
list in `protocol`, tested against the CLI the way the enforcement points are, and
`BOUNDARY.md` gains a section that renders it. The one thing the code does not yet
allow is the middle path, because today advice is not a file.

## 2. What writes the definition today

| Files | Where they live | Who writes them today | Kept from units by |
| --- | --- | --- | --- |
| Identity: `IDENTITY.md`, `INVARIANTS.md`, `GLOSSARY.md`, `BOUNDARIES.md` | the seed under the definition's `identity/`; the instance's copy under `regulator/identity/`, which `init` seeds and the session renders (`packages/regulator/src/unit.ts`, `IDENTITY_RELATIVE_DIR`) | `regulator identity accept` writes the instance's copy on an obligation owed to S5; `identity promote` carries it to the seed (`packages/regulator/src/cli.ts`) | the write gate and the bash snapshot-and-restore in the session, `identity-untouched` at closeout |
| Capability profiles: `profiles/<name>.json` | the definition only. An instance reads them from the manifest's `definition.root` at run time; nothing is copied in | a commit to the definition's repository | they are not in the domain; a unit cannot reach them |
| Workloads, policies, eval suites, contracts, the registry | the definition only | a commit to the definition's repository | the same |
| The instance manifest `.regulator/instance.json` | the instance | `init`, once; never rewritten (`instance-manifest` card) | it is under `.regulator/`, outside every writable prefix |

Two things follow.

First, **advice is a field, not a file.** `CapabilityProfileSchema`
(`packages/protocol/src/profiles.ts`) holds `tools[]`, `writablePaths[]`,
`thinkingLevel` and `advice[]` in one object, and the profiles extension renders
`advice[]` into the system prompt at `before_agent_start`
(`packages/regulator-pi/src/profiles.ts`). The grant and the advice are one JSON file.
An accept command in this project is a file writer: `identity accept` takes a file name
from a closed list, writes that file, validates the set, commits, resolves. A command
that may write advice and may not write grants cannot be a file writer while both live
in one file. So the split forces a choice the Harness² note did not see: either advice
becomes a file of its own, or the accept command becomes a JSON editor that proves only
one field changed.

Second, **the instance has no copy of anything but identity.** An advice decision that
is "accepted in the instance" has nowhere to land unless the instance carries advice the
way it carries identity. The alternative is for every advice decision to be a commit to
the definition, which is the third path with a different name, and which loses the
cheap, local, instance-scoped decision that the reflector's live horizon (Harness² note
§8) is measured over.

## 3. Decision 1: advice becomes a file set, seeded like identity

**Proposed.** Advice leaves the profile file and becomes one Markdown file per profile:

| | Identity today | Advice, proposed |
| --- | --- | --- |
| Seed in the definition | `identity/<FILE>.md` | `advice/<profile>.md` |
| Copy in the instance | `regulator/identity/<FILE>.md` | `regulator/advice/<profile>.md` |
| Seeded by | `regulator init` | `regulator init`, the same step |
| Rendered by | `identity-context`, under `identity.maxChars` | the profiles extension, from the instance's copy, under a new `advice.maxChars` in the budget policy (same cut-and-warn behaviour: `check`, `doctor` and the status line say what was cut) |
| Kept from units by | the write gate, the bash watch, `identity-untouched` | the same three, with `regulator/advice/` added to each one's protected set |
| Written by | `identity accept`; `identity promote` to the seed | `advice accept`; `advice promote` to the seed (§5) |
| Validated as | a complete, well-formed identity set (`readIdentity`) | a file per declared profile and no file for an undeclared one; non-empty; under the cap |

The profile schema drops `advice[]`. For one release the field stays optional and the
definition check refuses a profile that has both inline advice and an advice file, so a
definition migrates by moving text, never by carrying two copies. Every shipped profile
(`implement`, `research`, `intelligence`, `bookkeeper`, `auditor`) gets its advice file
with the text it has today; a profile may have an empty file, and must have one.

Why a file per profile and not per unit type: a unit type names a profile and the
profiles extension renders by profile today; the unit type adds nothing the advice
needs. Why Markdown and not JSON: the identity files are Markdown, people read and
write them, and the point of advice is that a person can read what a unit was told.

Why per instance: for the same reason identity is. An instance's advice is proposed
against and decided there; the reflector's live horizon is the next N units of *this*
instance; and `identity promote` already models how a local decision becomes the next
instance's seed. The cost is the one identity already pays: instances initialized
earlier keep their own copy (`identity-promotion` card, limitation 3; DEBT row 39 and
#53 are where a definition upgrade would carry it).

**Alternatives considered.**

- *A field-level accept.* `advice accept` parses the profile JSON, applies the file the
  person supplies, and refuses unless the only difference is `advice[]`. Mechanical and
  small. But the write lands in the definition, since the instance has no profile copy,
  so every advice decision is a definition commit, which is path 3 with a shortcut
  around its review. Rejected for collapsing the paths it exists to separate.
- *An instance overlay without a seed.* `regulator/advice/<profile>.md` overrides the
  profile's inline `advice[]` when present. Two sources of truth for one rendered
  section, and a reader of the profile file cannot tell what a unit is told. Rejected;
  the seed-and-copy shape is the one the project already explains.

## 4. Decision 2: the split is a closed list in `protocol`, rendered into `BOUNDARY.md`

**Proposed.** `packages/protocol` gains a constant beside `ENFORCEMENT_POINTS`:

```ts
export const DEFINITION_WRITERS = [
  { class: "identity",    seed: "identity/",  instance: "regulator/identity/",
    acceptedBy: "identity accept", promotedBy: "identity promote" },
  { class: "advice",      seed: "advice/",    instance: "regulator/advice/",
    acceptedBy: "advice accept",   promotedBy: "advice promote" },
  { class: "declaration", seed: ["profiles/", "workload/", "policies/", "evals/", "contracts/", "registry/"],
    acceptedBy: "a merged change to the definition's repository" },
] as const;
```

Three things hold it against the code, the way #76 holds the enforcement points:

- a test that every `acceptedBy` and `promotedBy` naming a command is in
  `ENFORCEMENT_POINTS.cli`;
- `checkDefinition` (`packages/core/src/definition.ts`) refuses a file under the
  definition root that falls in no class, so a new directory is declared before it is
  read;
- the write gate's protected set, the bash watch's snapshot set and the closeout's
  diffed prefixes are derived from the `instance` paths of the non-declaration classes,
  not restated, so the three cannot drift from the list.

`regulator docs` renders it as a new section of `BOUNDARY.md`, **Who writes the
definition**, with one row per class:

| Class | Paths | Proposed by | Lands through | Probed by | Refused to |
| --- | --- | --- | --- | --- | --- |
| identity | `identity/`, `regulator/identity/` | `propose_policy_change` | `identity accept`, then `identity promote` | an eval arm's `identity` switch toggles the whole set; no per-file probe | every tool; `advice accept` (closed file list) |
| advice | `advice/`, `regulator/advice/` | a `harness-edit` (diagnosis, change, prediction; Harness² note §8) or a plain proposal | `advice accept`, then `advice promote` | an eval arm's `advice` field, once the prediction record exists (§8, slice 3) | every tool; `identity accept` (closed file list) |
| declaration | the rest of the definition | a plain proposal, `requestedChange` as text | a unit of work against the definition's repository under a contract, `regulator check` and the tests at closeout, merged by a person (§6) | the definition's own CI | `identity accept` and `advice accept`, by construction |

The section carries the same closing line the rest of `BOUNDARY.md` does: a path not
named here is not known to be covered.

The instance manifest does not change. Its `writablePaths` and `protectedPaths` are the
*domain's* declaration; the definition's writers are the definition's, and a constant is
the right place for a list that must agree with the CLI.

## 5. Decision 3: the commands

**Proposed.** The Harness² note called the command `definition accept`. That name says it
may write any definition file, which is the opposite of the point. The command is
`advice accept`, and it mirrors `identity accept` line for line
(`packages/regulator/src/cli.ts`, the `identity accept|reject` branch):

```
regulator advice accept <obligation> --by <who> --file <profile>.md --from <path> --rationale <text>
regulator advice reject <obligation> --by <who> --rationale <text>
regulator advice promote <profile>.md --by <who> --rationale <text> [--definition <dir>]
```

`advice accept` refuses, in order: an obligation that is not a `policy-proposal` owed to
S5; a `--by` the interaction policy does not let act as S5; a dirty base checkout; a
`--file` that is not a declared profile's advice file; content that is empty or over
`advice.maxChars`. Then it writes the instance's copy under S5 authority, commits on the
base branch citing the obligation, and resolves the obligation as accepted with the
revision. `advice reject` resolves it as rejected and changes nothing. `advice promote`
mirrors `identity promote`: identical-content and dirty-definition refusals, a trial
validation of the seed set, a commit in the definition.

Two rules that are not in `identity accept`:

- **A `harness-edit` is accepted only after its probe horizon resolves.** When the
  prediction record lands (Harness² note §8; slice 2 below), `advice accept` refuses a
  `harness-edit` whose prediction has no probe-horizon resolution, and records the
  prediction's live horizon as open at acceptance. A plain proposal against an advice
  file has no prediction and is accepted on the person's judgment, as identity is. Until
  slice 2 lands, every advice proposal is plain.
- **The file must be the one proposed against.** `identity accept` lets the person point
  at any of the four files (`s5-decision` card, limitation 2). `advice accept` requires
  `--file` to equal the profile the proposal's `subject` names, because a `harness-edit`
  names its target and there is no reason to let the decision drift to another file.

Who may accept: `actAsS5` in the interaction policy, as for identity. Advice is what
every unit of a profile is told, which is policy, not operations. A narrower grant
(`acceptAdvice`) is an interaction-policy decision for later and is listed in §9.

## 6. The third path: a merged change, under the loop

**Proposed, for a later slice.** A proposal whose `requestedChange` would alter a grant,
a unit type, a check, a policy, a suite or an extension is a plain `policy-proposal`
today, and it stays one. What changes is how it is answered. The person who dispositions
it does not copy a file into place; they open a unit of work against the definition's
repository: a contract whose provenance cites the proposal's obligation
(`ContractProvenanceSchema` gains an optional `obligation` field), an implement unit in
a worktree, `regulator check` and the package tests as closeout checks, reintegration,
and a merge by a person. The obligation resolves as `accepted` citing the merge
revision, or `rejected`.

The mechanism this needs is not new. It is the definition's repository running as an
instance of regulator, with a workload whose implement unit type runs `run_checks` over
the definition check. That is the *missing recursion* row of `docs/PATHOLOGIES.md` paid
for one more function, and it belongs with the second host and the third workload
(0.3), not with slice 1. Until then the third path is what it is today: a pull request
a person writes, with `pnpm check` as the gate. The split still says so, and
`BOUNDARY.md` still renders the row, with "under the loop" as the row's stated gap.

## 7. Registry and debt

New records, each with purpose, failure absorbed, level, tests, limitations, owner,
review date, ablation and retirement, as every record has:

| Record | Mirrors | Level | Absorbs |
| --- | --- | --- | --- |
| `advice-decision` | `s5-decision` | deterministic gate | *proposal-with-no-decider*, for advice |
| `advice-context` | `identity-context` | prompt | *uninformed-unit*: the profile's advice reaches the session from a file a person can read and a proposal can target |
| `definition-writers` | `definition-check` | deterministic gate | *assembled-not-declared*: a definition directory nobody declared a writer for |

Records that change: `identity-promotion` generalizes to carry both file sets, or gains
a sibling `advice-promotion` (one card, two commands, is the smaller change);
`identity-write-gate`, and the bash watch it carries, gain `regulator/advice/` in scope;
`identity-untouched-check` gains it too and is renamed on the card to say it protects
the instance's harness-owned files, not identity alone; `definition-check` gains three
checks (a file per profile, no file for an undeclared profile, no profile with both
inline and file advice) and the class check of §4; `profile-write-grant` loses the
sentence that says it renders advice.

Limitations that become `DEBT.md` rows:

- An advice file is text. Nothing checks that an edit is advice rather than a rule in
  disguise; the `glossary-lint` analogue for advice does not exist. The live horizon
  (§8 of the Harness² note) and the person are the only pressure.
- Advice accepted in one instance does not reach another. This is identity's row and
  shares its fate with #53 (`regulator upgrade`).
- The third path has no mechanism until the definition's repository runs under the
  loop (§6); the `BOUNDARY.md` row says so.
- `advice.maxChars` cuts and warns, as `identity.maxChars` does; past the cap, part of
  the advice is text the model never sees.

## 8. Slices, in order, with what "done" means

1. **Advice as files, the split as data, the commands.** Everything in §3, §4, §5 and
   §7 except the probe rule. Done when: `regulator check` refuses a profile with inline
   advice beside an advice file, and a definition with an advice file for no profile;
   `init` seeds `regulator/advice/`; in a live session a `write` to
   `regulator/advice/implement.md` is refused by the gate and a `bash` edit is restored
   and recorded; a changed advice file on a unit's branch fails closeout;
   `advice accept` on a fixture proposal commits the file and resolves the obligation,
   and `advice reject` changes nothing; `advice promote` carries the file to the seed
   and refuses a dirty definition; `BOUNDARY.md` carries the new section and
   `regulator docs --check` is clean; the test holding `DEFINITION_WRITERS` against
   `ENFORCEMENT_POINTS.cli` passes; the committed eval reports are unchanged (scripted
   units read no advice).
2. **The prediction record** (Harness² note §8), its own issue: the record, its
   resolution from the stores, and the `harness-edit` payload that carries it.
3. **The probe arm and the probe rule.** `EvalArmSchema` gains an optional `advice`
   override (a map from profile to file); `advice accept` refuses an unprobed
   `harness-edit`. Waits on the live report (#46), since a probe with no live baseline
   resolves as inconclusive by construction.
4. **The definition's repository as an instance** (§6), with the second host and the
   third workload.

Slice 1 is one issue in 0.2 and pays nothing in `DEBT.md`; it opens the four rows of
§7.

## 9. Open questions

- Should accepting advice need a grant narrower than `actAsS5`? The case for a separate
  `acceptAdvice`: advice is level 5 and a team may want to delegate it. The case
  against: what every unit is told is policy, and a second grant is a second thing to
  audit. Default is `actAsS5`; the policy file can grow the field when someone asks.
- Should an instance's advice be reported by `doctor` as drift from the seed, the way the
  definition revision is? Identity is not reported that way today; if advice is, identity
  should be too, in the same change.
- Contract advice (the `contract-advice` card) is rendered from the contract S3 wrote
  for one unit. It is per unit and ephemeral, so it is not in the proposable set; a
  reflector that wants a contract shape changed proposes against the workload, which is
  path 3. Record this so nobody files it as a gap.
- Whether `regulator/advice/` should be per unit type as well as per profile when a
  workload has two unit types on one profile with different needs. Not today: the
  shipped workloads have no such pair.

## 10. What this asks of the reader

Two decisions, then an issue:

1. §3: advice becomes a file set seeded like identity, and the profile schema drops
   `advice[]` after one release of overlap.
2. §5: the commands are `advice accept | reject | promote`, and `definition accept` in
   the Harness² note and the "What's coming" figures is read as this command until the
   generator redraws them.

With those two taken, slice 1 of §8 is filed as a `roadmap:0.2` issue with its "done
when" list as the acceptance criteria, and this note's status changes to `graduated`.

**Decided (2026-10-19).** Both, as proposed. Advice becomes a file set seeded like
identity (§3), and the commands are `advice accept | reject | promote` (§5);
`definition accept` in the Harness² note and the "What's coming" figures reads as
`advice accept` until slice 1 redraws them. Slice 1 is filed as
[#110](https://github.com/MetaCoding-io/regulator/issues/110), a sub-issue of the
engineering handoff [#108](https://github.com/MetaCoding-io/regulator/issues/108), with
§8's done-when list as its acceptance criteria.
