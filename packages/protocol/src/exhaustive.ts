/**
 * Exhaustive matches over closed unions (#160).
 *
 * A `switch` over a union lists every member and ends in `default: return assertNever(x, "…")`. The parameter is
 * `never`, so the call compiles only when the cases before it have narrowed the union to nothing: a literal added
 * to the union fails `pnpm typecheck` at every switch that does not yet say what it means there, instead of taking
 * a fallback nobody chose for it. Where a switch only maps one value to another, a `Record<Union, …>` table is the
 * same check with less code (`CONTINUES_WITHOUT_ANSWER`).
 *
 * The throw is for what the type does not hold: a value read from disk or sent by a model that was never
 * validated against the union's schema.
 */
export function assertNever(x: never, what: string): never {
  throw new Error(`unhandled ${what}: ${JSON.stringify(x) ?? String(x)}`);
}
