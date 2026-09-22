/**
 * Where an instance keeps its state, relative to the base checkout. The
 * orchestrator's execution state (units, leases) and the regulatory signals
 * it has not yet routed both live under `.regulator/`; the repository itself
 * is domain output and is never read as state.
 */
import path from "node:path";

export const REGULATOR_DIR = ".regulator";
export const UNITS_RELATIVE_DIR = path.join(REGULATOR_DIR, "units");
export const LEASES_RELATIVE_DIR = path.join(REGULATOR_DIR, "leases");
export const WORKTREES_RELATIVE_DIR = path.join(REGULATOR_DIR, "worktrees");
export const SIGNALS_RELATIVE_PATH = path.join(REGULATOR_DIR, "signals.ndjson");
export const TRACE_RELATIVE_PATH = path.join(REGULATOR_DIR, "trace.ndjson");
export const EFFECTS_RELATIVE_PATH = path.join(REGULATOR_DIR, "effects.ndjson");
/** Regulatory state from S3*: evidence records, technical verdicts, human acceptances. Append-only. */
export const AUDIT_RELATIVE_PATH = path.join(REGULATOR_DIR, "audit.ndjson");
