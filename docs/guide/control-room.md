# The control room

A read-only page over the `regulator status` read model: what the definition declares,
what each instance holds, and what one unit did, in time order. It renders; it has no
command that changes anything, and that is deliberate. Everything it shows can also be
read from the CLI.

## Launch

The page is its own package with its own bin:

```sh
pnpm add -D @metacoding.io/regulator-control-room
regulator-control-room                                   # this directory as the instance, port 4321
regulator-control-room --definition node_modules/@metacoding.io/regulator \
                       --instance . --instance ../other-repo --port 8080
```

| Flag | Meaning |
| --- | --- |
| `--definition <dir>` | the definition to render; without it, only the instance views are shown |
| `--instance <dir>` | an instance to render; repeatable; defaults to the current directory when no definition is given |
| `--port <n>` | default `4321` |
| `--host <addr>` | default `127.0.0.1`, loopback only |

The server reads the definition's files and the instance's records on every request, so
the page is current on refresh. Nothing is cached and nothing is written.

## Views

**Definition** — what is declared:

- *Topology*: the registry's records by function, S5 to S1, each with the channels it
  consumes and emits.
- *Workloads*: each unit type with its profile and the host checks that verify it.
- *Profiles*: each grant, with its tools and writable prefixes, and whether it is
  read-only by effect.
- *Identity*: the seed's files and invariants, with any parse problem.
- *Policies*: budgets and routes per unit type, the recovery rules, the routing rules
  and floors, the interaction policy's people.
- *Assurance*: what the committed eval reports say, per arm.
- *Lifecycle*: per regulator, the review date, the ablation switch, the arm and report
  that cover it, and the retirement condition.
- *Problems*: whatever the definition check refuses.

**Instances** — for each `--instance`: the manifest line (definition, revision, Pi pin,
initialized when and by whom, declared prefixes); the units with status, attempts,
budget consumed and verdict; the live leases; the obligations, whom each is owed to and
whether it vetoes; the interactions (what units asked a person, and what came back);
the operational memory with its scope; and the signals recorded but not yet routed.

**Inspector** — one regulator (its card) or one unit: the contract as written, the report
as written, the audit evidence bound to each revision, the obligations that name it, and
the *replay*: every record about the unit in time order, contract → attempt → evidence →
verdict → obligation → delivery → answer → next attempt → close.

The [worked example](/examples/personal-finance#_4-what-the-control-room-shows) shows
each view over the household ledger.

## The read model

The page renders `regulator status`, and the same projection is available as JSON:

```sh
regulator status --definition node_modules/@metacoding.io/regulator --instance . --json
```

The object has two parts. `definition` is the registry (records and problems), the
profiles, the policies, the workloads, the identity seed, the eval reports and which
parts are declared as files. `instance` is the manifest, the units, the leases, the
obligations, the interactions, the memory and the unrouted signals, read from the
execution store and the regulatory logs and never inferred from the repository. Anything
that wants to render the instance another way — a dashboard, a bot, a diagram — starts
from this object, not from the files under `.regulator/`.
