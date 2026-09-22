# Identity — invariants

This directory is the harness's identity: what the system is, and what it must never
be able to change about itself. `regulator fixture` seeds a copy of it into every
instance at `regulator/identity/`, and the identity write gate (checkpoint 9) refuses
every write under that path from operational code. Lesson 12 completes the set; until
then it holds exactly one invariant, so that the gate enforces the file that declares
the gate.

## INV-001 — Identity is write-protected

Operational execution (a unit, its tools, its shell) must not mutate the files under
`regulator/identity/`. A change to identity is requested through a typed proposal on the
proposal channel and made by an explicit S5-authority path. A proposal is not policy.
