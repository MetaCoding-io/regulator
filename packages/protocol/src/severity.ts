import { Type, type Static } from "typebox";

/** Effective severity of a message or an obligation: the router's word, not the emitter's claim. */
export const SeveritySchema = Type.Union([
  Type.Literal("info"),
  Type.Literal("advisory"),
  Type.Literal("blocking"),
  Type.Literal("critical"),
]);
export type Severity = Static<typeof SeveritySchema>;

export const SEVERITY_ORDER: Readonly<Record<Severity, number>> = { info: 0, advisory: 1, blocking: 2, critical: 3 };

export function severityAtLeast(severity: Severity, floor: Severity): boolean {
  return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[floor];
}
