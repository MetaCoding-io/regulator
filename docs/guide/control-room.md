# The control room

The control room is a read-only page over the `regulator status` read model. It shows
what the definition declares, what each instance holds, and what one unit did, in time
order. It only renders: it has no command that changes anything, and that is
deliberate. Everything it shows can also be read from the CLI.

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
| `--definition <dir>` | the definition to render. Without it, only the instance views are shown |
| `--instance <dir>` | an instance to render. The flag is repeatable, and it defaults to the current directory when no definition is given |
| `--port <n>` | the port to listen on; the default is `4321` |
| `--host <addr>` | the address to bind; the default is `127.0.0.1`, loopback only |

The server reads the definition's files and the instance's records on every request, so
the page is current on every refresh. Nothing is cached and nothing is written.

## Views

The definition view shows what is declared:

- *Topology* lists the registry's records by function, from S5 to S1, each with the
  channels it consumes and emits.
- *Workloads* lists each unit type with its profile and the host checks that verify it.
- *Profiles* lists each grant, with its tools and its writable prefixes, and says
  whether it is read-only by effect.
- *Identity* shows the seed's files and invariants, with any parse problem.
- *Policies* shows the budgets and routes per unit type, the recovery rules, the
  routing rules and floors, and the interaction policy's people.
- *Assurance* shows what the committed eval reports say, per arm.
- *Lifecycle* shows, per regulator, the review date, the ablation switch, the arm and
  report that cover it, and the retirement condition.
- *Problems* lists whatever the definition check refuses.

The instances view shows, for each `--instance`, the manifest line (the definition, the
revision, the Pi pin, when the instance was initialized and by whom, and the declared
prefixes). Below that it shows the units, each with its status, attempts, budget
consumed and verdict; the live leases; the obligations, with whom each is owed to and
whether it vetoes; the interactions, meaning what units asked a person and what came
back; the operational memory with its scope; and the signals recorded but not yet
routed.

The inspector shows one regulator, as its card, or one unit, with the contract as
written, the report as written, the audit evidence bound to each revision, the
obligations that name it, and the *replay*: every record about the unit in time order,
contract → attempt → evidence → verdict → obligation → delivery → answer → next
attempt → close.

The [worked example](/examples/personal-finance#_4-what-the-control-room-shows) shows
each view over the household ledger.

## The read model

The page renders `regulator status`, and the same projection is available as JSON:

```sh
regulator status --definition node_modules/@metacoding.io/regulator --instance . --json
```

The object has two parts. `definition` holds the registry (its records and its
problems), the profiles, the policies, the workloads, the identity seed, the eval
reports, and which parts are declared as files. `instance` holds the manifest,
the units, the leases, the obligations, the interactions, the memory and the unrouted
signals. All of it is read from the execution store and the regulatory logs, and none
of it is inferred from the repository. Anything that wants to render the instance
another way (a dashboard, a bot, a diagram) starts from this object rather than from
the files under `.regulator/`.
