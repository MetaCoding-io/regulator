A JSON file here is a list a program computed; not yet agreed. `<date>.json` is the trade
list the workload's `plan-rebalance` program wrote from the target, the band, the lots and
the tax ordering at that date's prices; `harvest-<date>.json` is the `harvest-losses`
program's list of every open lot at an unrealised loss at that date's prices, with no
threshold and no benefit-versus-cost judgment. Nothing here is a commitment: the checks
under `test/` judge a proposed list as they judge a pending one, and a list moves to
`../pending/` only when a person, asked once about every trade in it, says yes, after
which the pending copy must carry the very trades the program computed.
