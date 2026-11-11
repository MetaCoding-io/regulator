A JSON file here is a list nobody has agreed to. `<date>.json` is the trade list the
workload's `plan-rebalance` program wrote from the target, the band, the lots and the tax
ordering at that date's prices (kind `rebalance`); `harvest-<date>.json` is the
`harvest-losses` program's list of every open lot at an unrealised loss at that date's
prices, with no threshold and no benefit-versus-cost judgment — candidates, not trades;
and `harvest-plan-<date>.json` is the harvest a `plan-harvest` unit planned from those
candidates over the positions after the agreed rebalance list of the date (kind
`harvest`): every sell a whole candidate lot worth taking by `harvest.json`'s arithmetic,
every buy its replacement from the sold ticker's exchangeable set, and every candidate
left under `dispositions` with its reason. Nothing here is a commitment: the checks under
`test/` judge a proposed list as they judge a pending one, by its kind, and a list moves
to `../pending/` under its own name only when a person, asked once about every leg in it,
says yes, after which the pending copy must carry the very trades the list computed.
