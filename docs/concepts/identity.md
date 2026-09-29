# Protecting identity

S5 is not an agent. An instance's identity is four committed files under
`regulator/identity/`:

| File | Holds |
| --- | --- |
| `IDENTITY.md` | what the system is and is for |
| `INVARIANTS.md` | the rules that hold for every unit, each under a `## INV-nnn — title` heading |
| `BOUNDARIES.md` | what the system does not do |
| `GLOSSARY.md` | what its words mean, and the words it does not use |

The shipped seed declares four invariants. The first two are about identity itself:

- **INV-001:** identity is write-protected.
- **INV-002:** a proposal is not policy.
- **INV-003:** audit is independent of self-report.
- **INV-004:** memory is not identity.

Because identity is files, it survives what a transcript does not. Compaction cannot
drop it, a forked session cannot diverge from it, and a new model version cannot
reinterpret it from memory. The cost is that a unit with a shell and a working tree can
reach those files. Keeping it from changing them is a layered design, because no single
mechanism can hold on its own.

## The layers

Each layer catches what gets past the one before it. The last column is why the next
layer exists.

| Layer | When | What it does | What gets past it |
| --- | --- | --- | --- |
| **Trust rule** | building the session | loads only the extensions the definition declares; a project's own `.pi/` extensions, skills, prompt templates and context files (`AGENTS.md`) never reach a unit's session | instructions inside the project's ordinary files, which the unit reads with its tools |
| **Identity in context** | every run (`before_agent_start`) | renders the identity from the files into the system prompt | everything: it is advice (level 5) |
| **Write gate** | every `write` and `edit` | refuses the identity, the committed S5 artifacts, the project's protected paths and their parents, through any spelling, traversal or filesystem alias (symbolic link, hard link, non-directory parent); the tool writes exactly the normalized path it checked; fails closed | the shell, which no hook can sandbox |
| **Bash watch** | around every `bash` call | snapshots the protected files before the command and compares after; a change is restored from the snapshot, reported in the tool result, and recorded as an audit finding under INV-001 | a commit the command made, a copy of the repository elsewhere, and a link swapped in between check and write |
| **`identity-untouched`** | closeout, before reintegration | the host diffs the unit's branch against its base under every protected prefix; any change, by any route, is failing evidence and the unit does not close | nothing on the branch. It is detection after the attempt, not prevention |

After closeout, reintegration merges only what passed. A protected change that reached a
branch therefore stops there: it costs the unit an attempt, and it never lands on the
base.

Two more mechanisms stand beside the layers:

- **The routing floor.** Any message that names an invariant (`INV-nnn`) or
  `regulator/identity/` is raised to at least `blocking` by the
  [routing policy](/reference/definition#routing-policy), whatever severity its emitter
  claimed. Anything about S5 holds the unit it concerns until a consumer dispositions it.
- **`glossary-lint`.** The glossary lists the words the instance does not use, with the
  word to say instead. At closeout the host reads the branch's added comments and its
  commit messages for them. A hit in a comment is failing evidence; a hit in a commit
  message is too, unless the workload declares that half advisory, in which case it is
  recorded as evidence and a finding at `advisory` and refuses nothing — the software
  workload does, after the drift suite showed a correct unit refused three times for one
  word in a commit message. Identity covers vocabulary as well as files.

## Which paths each layer protects

| Path | Write gate and bash watch | `identity-untouched` at closeout |
| --- | --- | --- |
| `regulator/identity/` | yes | yes |
| committed S5 artifacts under `vsm/` | yes | not unless the manifest lists them |
| `vendor/`, when the project has one | yes | yes |
| further prefixes the [instance manifest](/reference/instance#the-manifest) declares as protected | no | yes |

A manifest-declared protected prefix is still out of reach of `write` and `edit` if it
lies outside the profile's writable prefixes, which is the usual case. Inside the
session nothing restores it after a shell command, though, so closeout is the first
place a shell change to it is caught.

## The only way to change identity

A unit may ask for a change. It may never make one. The right to ask and the right to
change are separate mechanisms (INV-002):

1. **Propose.** The unit calls `propose_policy_change` with the change it wants and why.
   The tool records a `policy-proposal` for S5 and changes nothing: no file, no policy,
   no grant. The routing policy opens an obligation owed to S5 for every proposal, at
   any severity.
2. **Decide.** A person the interaction policy lets act as S5 (`actAsS5`) accepts the
   proposal with `regulator identity accept`, naming the obligation, the file, where the
   new content is, and a rationale. This is the only writer of an identity file. It
   writes the file under S5 authority, refuses a result that would leave the identity
   set invalid, commits on the base branch citing the obligation, and resolves the
   obligation as accepted. `regulator identity reject` resolves it as rejected and
   changes nothing.
3. **Promote.** A decision changes that instance's copy. Every later `regulator init`
   starts from the definition's seed instead, so `regulator identity promote` copies the
   instance's file into the seed and commits it in the definition's repository, citing
   the instance and its revision. It refuses a promotion that changes nothing, would
   leave the seed invalid, or lands on a dirty definition. Instances initialized earlier
   keep their own copy.

The [CLI reference](/reference/cli) has the exact arguments. Decisions flow from
instance to definition, by a person, on the record. Nothing flows the other way by
itself.

## Protected values: the canary watch

The same checkpoint protects one other kind of state. `regulator init` records canary
values: credential-looking values from a committed `.env`. The canary watch looks for
them in every tool result and in the model's own text. A canary in a tool result is
redacted before the model sees it and recorded as a critical audit finding. A canary
the model writes cannot be unsaid, so it is recorded. This measures whether an exposure
path exists; it does not guarantee that every secret is safe.

## What is not there yet

The [registry records](/reference/regulators) for each layer state its limitations, and
the [enforcement boundary](/reference/boundary) lists the routes around every gate. The
ones that matter most:

- **A hook is not a sandbox.** The write gate and the bash watch protect calls that go
  through the host's hooks. A shell command that commits a protected change, pushes it,
  or edits a copy of the repository elsewhere is outside them, and the bash watch
  restores the working tree only. Real isolation is the operating system's or a
  container's; `identity-untouched` is what makes a bypass visible.
- **The snapshot is not atomic, and the alias walk has a race.** A command that reads a
  protected file right after changing it sees the change before the restore, and a link
  created between the check and the write is not seen.
- **The rendered identity is the worktree's copy.** A unit's shell can change it before
  the next run reads it; the closeout diff turns that into a failing check, not a
  changed rule.
- **Rendering is capped at 6000 characters.** Past that, part of the identity is advice
  the model never sees. The cut is reported, never refused: `regulator check` and
  `regulator doctor` warn with the size, the limit and the files cut, the session's
  status line says so, and one advisory `operational-signal` per session records on the
  unit that it ran with part of its identity unseen. The limit is a constant in the
  code, not a policy field.
- **The person deciding supplies the file.** `identity accept` writes the file the
  person points to; nothing derives it from the proposal's requested change or diffs it
  against the request.
- **Names are asserted, not authenticated.** `--by` is checked against the interaction
  policy's grants, not against who is typing (`docs/DEBT.md` row 28).
- **Canaries are known values only.** A secret the harness was not told about is not
  watched; an encoded or paraphrased canary is not redacted; network egress is not
  watched at all.
