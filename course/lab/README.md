# The course lab

What the course keeps for itself. The reference build is the product,
[`packages/regulator`](../../packages/regulator/) (the control plane) and
[`packages/regulator-pi`](../../packages/regulator-pi/) (the Pi host); the lessons cite
them there. This package holds the two checkpoints that exist only as lessons — `cp0`,
the event log of lesson 01, and `cp1`, the first trace and the lexical write gate of
lesson 02, superseded by the product's `identity` and `authority` extensions — and the
drill scripts (`pnpm cp0` … `pnpm cp12`) that load the product's extensions one lesson
at a time over the fixture repository.
