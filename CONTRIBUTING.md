# Contributing

`regulator` is a coding-agent harness with a cybernetic control plane. Contributions
that fit are mechanisms, evidence and documentation; the prime directive applies to
every one of them:

> **Prompts advise. Types describe. Gates enforce.**

A rule is implemented at the strongest level that can carry it — a type, then a
deterministic gate, then a typed tool, then a model's judgment, then a prompt — and a
pull request that solves a mechanically enforceable rule with prompt text alone will be
asked to move it down the hierarchy.

## Where to start

- [`ROADMAP.md`](ROADMAP.md) maps the open work to issues. Issues labelled
  `good first issue` are bounded and self-contained.
- [`docs/DEBT.md`](docs/DEBT.md) is what the build knows it has not yet absorbed, one
  row each, with the registry card that records it.
- [`AGENTS.md`](AGENTS.md) is the project's own operating rules — the architectural
  boundaries, the repository conventions, what to confirm before finishing. It is
  written for coding agents and applies to people.
- The documentation site (https://metacoding-io.github.io/regulator/) explains the
  control plane, the definition files and the CLI.

## Setting up

Node 22.19 or later and pnpm 10.12.1 (pinned in `packageManager`).

```sh
pnpm install
pnpm check          # build, typecheck, every package's tests, the registry and definition checks
pnpm --filter regulator-docs dev   # the docs site locally
```

`pnpm check` must pass on both Node versions CI runs (22.19 and 24). Tests use Node's
built-in runner and run without a live model; anything that needs one is a drill or an
eval, not a test.

## What a change carries

1. **A registry record, when it is a regulator.** Every mechanism that absorbs a class
   of failure has a card under `packages/regulator/registry/regulators/`: purpose, the
   failure absorbed, the mechanism level, where it is enforced, the tests that evidence
   it, at least one limitation, an owner and a review date, the eval arm that switches
   it off, and the condition under which it may be retired. `regulator check` refuses a
   card without a limitation. Regenerate the rendered documents:

   ```sh
   pnpm --filter @metacoding/regulator registry:docs
   ```

2. **A debt row, when a limitation names later work.** A new limitation that says
   "not yet", names a milestone or points at another issue gets a row in `docs/DEBT.md`
   in the same change. A change that pays a row strikes it and updates the card.

3. **Tests for the mechanical behaviour**, beside the code, without a model.

4. **Evidence in the pull request:** the exact commands run and their result. A check
   that was not run is reported as not run.

5. **Provenance preserved:** who or what emitted a finding, which revision it refers
   to, and what authority acted on it. Nothing infers a unit's progress from the
   repository.

## Boundaries a change may not cross

- **The orchestrator is the only execution authority.** Regulators observe, verify,
  route and veto; they do not schedule or dispatch.
- **`vsm/` is S5.** The project's identity, architecture and invariants change by a
  proposal and a person's decision, never as a side effect of a code change. A pull
  request that touches `vsm/` says so in its title and why in its body.
- **`packages/regulator` never imports a host.** Pi integration lives in
  `packages/regulator-pi` behind the host seam.
- **The definition is declared, not assembled.** Profiles, policies, workloads and
  the identity seed are files validated by `regulator check`; a change to them is a
  policy change and is reviewed as one.
- **No new prompt-only enforcement** where a typed or mechanical mechanism was
  reasonable.

## Pull requests

- Small and reviewable; one concern per pull request. Do not widen a change because an
  adjacent improvement is attractive.
- If a change reveals an architectural conflict, record it (an ADR under
  `docs/decisions/`, or an issue) rather than fitting the architecture to the code.
- The description states what changed, what it pays (debt rows, cards) and the
  verification commands with their result.
- CI runs `pnpm check` on both Node versions and builds the docs site; all three must be
  green.

## Reporting

- **A bug** — the bug template: what you ran, what the instance recorded
  (`regulator unit show`, `unit evidence`, `doctor --json`), what you expected.
- **A gap a regulator does not cover** — the debt template: the card, the route around
  it, and whether it is the deployment's or the build's.
- **A proposal** — the proposal template: the failure class, the mechanism level you
  think can hold it, and what it would cost. Proposals that would change `vsm/` are
  discussed there first.

## Licence

Contributions are accepted under the repository's Apache-2.0 licence. The course,
Viable Agents, is separate and not open to contribution here.
