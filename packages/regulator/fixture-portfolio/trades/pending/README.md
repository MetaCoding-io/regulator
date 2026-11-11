A JSON file here is a trade list the household has agreed to execute, rebalance or
harvest: the date it was planned on, its kind, and every trade with its ticker, side,
shares and, for a sell, the lots it comes from. Writing one is a commitment, so a unit
asks for consent first — one question naming every leg, its lots and the tax it
realises — and writes nothing without a yes; the file is written by the workload's
`place_trade` tool, byte for byte from the proposed list of the same name. The person
executes the list at the custodian and records the fills under `../executed/`.
