# Identity — glossary

The words this instance uses with a fixed meaning. A unit that reads "obligation" and
means "task" is drifting.

- **Unit** — one dispatched piece of work under a contract, in its own worktree, with a
  lease, a budget and an attempt count. Execution state; the orchestrator's.
- **Work contract** — the allocation of decisions before dispatch: fixed (preserve),
  delegated (choose within bounds, report), unresolved (never settle; surface).
- **Attempt** — one session against a contract version. Attempts are immutable records;
  a further attempt is the same unit, not a new one.
- **Evidence** — an observation the harness produced, bound to a unit, attempt, revision,
  environment and criterion. A unit's report is a claim, not evidence.
- **Verdict** — pass, fail or inconclusive, derived from fresh evidence only.
- **Obligation** — something the metasystem has not yet shown it absorbed, owed to a
  named consumer. Not a task; it holds a unit, it does not run one.
- **Intelligence** — S4's typed finding about the environment: advice to S3, never a
  decision.
- **Operational memory** — a fact about the environment with provenance and an expiry.
  Not identity.
- **Identity** — these files. Committed, write-protected, proposed against, never edited
  by a unit.
