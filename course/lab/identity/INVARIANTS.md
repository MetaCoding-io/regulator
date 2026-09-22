# Identity — invariants

This directory is the harness's identity: what the system is, and what it must never
be able to change about itself. `regulator fixture` seeds a copy of it into every
instance at `regulator/identity/`, and the identity write gate (checkpoint 9) refuses
every write under that path from operational code. The set is deliberately small; an
invariant that nothing checks is a wish, and each one below names where it is checked.

## INV-001 — Identity is write-protected

Operational execution (a unit, its tools, its shell) must not mutate the files under
`regulator/identity/`. A change to identity is requested through a typed proposal on the
proposal channel and made by an explicit S5-authority path. A proposal is not policy.

Checked by: the identity write gate on `write` and `edit` (checkpoint 9); the bash
snapshot-and-restore for the working tree (checkpoint 9); and the `identity-untouched`
host check at closeout, which diffs the unit's branch against its base under every
protected prefix, so a change that was committed around the gate does not close
(checkpoint 11).

## INV-002 — A proposal is not policy

The right to ask for a change to identity or policy is mechanically separate from the
right to make one. Recording a proposal changes nothing; only `regulator identity accept`,
run by a person under S5 authority, changes an identity file, and it cites the obligation
it decided.

Checked by: `propose_policy_change` appends and returns (checkpoint 9); the write gate
refuses identity paths to operational authority; the S5 decision path is the only writer
(checkpoint 11).

## INV-003 — Audit is independent of self-report

A unit's claim that its work is correct cannot, by itself, close the unit. Closeout rests
on evidence the harness produced against the committed revision.

Checked by: the closeout gate (checkpoint 8); the evidence preflight on `report_result`
(checkpoint 8).

## INV-004 — Memory is not identity

What a unit learns about the environment is recorded in operational memory with
provenance and a review-by date, and rendered to later units as facts that expire. It is
never written into identity, and identity is never inferred from it.

Checked by: `remember` writes only to the memory store, refuses an entry without an
expiry within the store's limit, and the write gate keeps every route to identity closed
(checkpoint 11).
