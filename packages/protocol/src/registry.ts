import { Type, type Static } from "typebox";
import { Value } from "typebox/value";
import { AblationSwitchSchema } from "./evals.js";
import { VsmSystemSchema } from "./vsm-systems.js";

/**
 * A regulator's identity card: what failure it absorbs, at which level of the
 * mechanism hierarchy, implemented where, evidenced by which tests, bounded
 * how, owned by whom, reviewed when. Closed: unknown fields are rejected so
 * that the record grows deliberately, lesson by lesson.
 */
const isoDate = Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" });
export const MechanismLevelSchema = Type.Union([
  Type.Literal("type"), Type.Literal("deterministic-gate"), Type.Literal("typed-tool"), Type.Literal("model-judgment"), Type.Literal("prompt"),
]);
export type MechanismLevel = Static<typeof MechanismLevelSchema>;

/**
 * Where a regulator bites: a closed list per place, so a record can be placed on the path a unit takes and a figure
 * can be drawn from the registry (the loop, the session's gates, who writes where). The definition check refuses a
 * point that is not here. Each list is what the code exposes, held by a test against it, not a transcription of the
 * cards; a host that subscribes to a new event, a tool that is registered, a step the loop grows, adds it here in the
 * same change. A function name is not a point: it belongs in `mechanism.implementation` or the point's note.
 */
export const ENFORCEMENT_POINTS = {
  /** The Pi host: the session lifecycle events its extensions subscribe to, and `dispatcher`, the host's dispatcher that opens, binds and routes the session (model choice, failover, the loader's trust rule). */
  host: [
    "dispatcher",
    "session_start", "before_agent_start", "tool_call", "tool_execution_start", "tool_execution_end", "tool_result", "turn_end", "message_end",
    "agent_end", "agent_before_settle", "model_select", "project_trust", "session_before_compact", "session_compact", "session_compact_failed",
  ],
  /** A tool the host's extensions register for a unit session: the gate is the tool's execute. */
  tool: ["report_result", "report_intelligence", "ask_human", "notify_owner", "remember", "propose_policy_change", "read_conventions", "run_tests", "run_checks"],
  /** The orchestrator: the S3 loop's steps and the unit lifecycle around them (`packages/regulator/src/controller.ts`, `unit.ts`; `runHostChecks` in `packages/checks`). */
  loop: ["runUnit", "auditUnit", "runHostChecks", "routeUnit", "closeUnit", "driveUnit", "routeAndDeliver", "startUnit", "finishUnit"],
  /** A `regulator` subcommand, as the usage line spells it. */
  cli: [
    "status", "fixture", "unit start", "unit finish", "unit status", "contract check", "unit dispatch", "unit drive", "unit route", "unit show", "unit close",
    "unit accept", "unit evidence", "effects", "obligations", "obligation show", "obligation ack", "obligation resolve", "obligation escalate", "signals route",
    "memory", "memory retract", "identity accept", "identity reject", "answer", "remind", "init", "doctor", "watch", "identity promote", "eval", "spans",
    "review", "check", "docs",
  ],
  /** The definition check, under `regulator check`, `doctor` and `pnpm check`. */
  check: ["checkRegistry", "checkDefinition"],
} as const;
export type EnforcementWhere = keyof typeof ENFORCEMENT_POINTS;
export type EnforcementPoint = { [W in EnforcementWhere]: { where: W; point: (typeof ENFORCEMENT_POINTS)[W][number]; note?: string } }[EnforcementWhere];

export const EnforcementPointSchema = Type.Union(
  (Object.keys(ENFORCEMENT_POINTS) as EnforcementWhere[]).map((where) =>
    Type.Object({
      where: Type.Literal(where),
      point: Type.Union(ENFORCEMENT_POINTS[where].map((point) => Type.Literal(point))),
      /** What the gate does there, in a phrase: the branch, the function, the rule. */
      note: Type.Optional(Type.String({ minLength: 1 })),
    }, { additionalProperties: false }),
  ),
);

/** A point's name as the documents and the control room print it: `host:tool_call`. */
export function enforcementPointName(point: Pick<EnforcementPoint, "where" | "point">): string {
  return `${point.where}:${point.point}`;
}

/** Whether `{ where, point }` names a known point; the message names what is unknown. */
export function unknownEnforcementPoint(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return `an enforcement point is ${JSON.stringify(value)}, not { where, point, note? }`;
  const { where, point } = value as { where?: unknown; point?: unknown };
  if (typeof where !== "string" || !(where in ENFORCEMENT_POINTS)) return `unknown enforcement place ${JSON.stringify(where)}; one of ${Object.keys(ENFORCEMENT_POINTS).join(", ")}`;
  const points: readonly string[] = ENFORCEMENT_POINTS[where as EnforcementWhere];
  if (typeof point !== "string" || !points.includes(point)) return `unknown enforcement point ${where}:${String(point)}; ${where} has ${points.join(", ")}`;
  return undefined;
}

export const RegulatorRecordSchema = Type.Object(
  {
    id: Type.String({ pattern: "^reg\\.[a-z0-9-]+\\.[a-z0-9-]+\\.v\\d+$" }),
    name: Type.String({ minLength: 1 }),
    status: Type.Union([Type.Literal("proposed"), Type.Literal("active"), Type.Literal("retired")]),
    vsmFunction: VsmSystemSchema,
    purpose: Type.String({ minLength: 1 }),
    absorbs: Type.Object(
      { failureClass: Type.String({ minLength: 1 }), description: Type.String({ minLength: 1 }) },
      { additionalProperties: false },
    ),
    mechanism: Type.Object(
      {
        level: MechanismLevelSchema,
        implementation: Type.String({ minLength: 1 }),
        enforcementPoints: Type.Array(EnforcementPointSchema),
      },
      { additionalProperties: false },
    ),
    authority: Type.Optional(
      Type.Object({ may: Type.Array(Type.String()), mayNot: Type.Array(Type.String()) }, { additionalProperties: false }),
    ),
    evidence: Type.Object(
      { tests: Type.Array(Type.String({ minLength: 1 })), lastVerifiedRevision: Type.Optional(Type.String()) },
      { additionalProperties: false },
    ),
    /** Lesson 05: what the regulator consumes and emits, by message kind or channel. */
    channels: Type.Optional(
      Type.Object({ consumes: Type.Array(Type.String({ minLength: 1 })), emits: Type.Array(Type.String({ minLength: 1 })) }, { additionalProperties: false }),
    ),
    /** Lesson 05: what the regulator coordinates — the subjects it applies to and the resources it claims. */
    scope: Type.Optional(
      Type.Object({ subjects: Type.Array(Type.String({ minLength: 1 })), resources: Type.Array(Type.String({ minLength: 1 })) }, { additionalProperties: false }),
    ),
    /** Lesson 07: what the regulator costs to run, stated so it can be weighed against what it absorbs. */
    cost: Type.Optional(
      Type.Object({ description: Type.String({ minLength: 1 }), measured: Type.Optional(Type.String({ minLength: 1 })) }, { additionalProperties: false }),
    ),
    limitations: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    ownership: Type.Object(
      { owner: Type.String({ minLength: 1 }), introduced: isoDate, reviewBy: isoDate },
      { additionalProperties: false },
    ),
    /** Lesson 14: the eval arm with this regulator switched off, and what the harness can and cannot switch. */
    ablation: Type.Optional(Type.Object({ switch: AblationSwitchSchema, note: Type.String({ minLength: 1 }) }, { additionalProperties: false })),
    /** Lesson 14: when this regulator may be retired — typically no significant regression in ablation across N model versions and M suites. */
    retirement: Type.Optional(Type.Object({ condition: Type.String({ minLength: 1 }) }, { additionalProperties: false })),
    /**
     * The package version that first shipped the record (semver). A record added between releases says `unreleased`
     * until the release commit rewrites it to the version being tagged; the release workflow refuses to publish while
     * any record still says so (#92), so nothing on npm ever carries the word.
     */
    introducedIn: Type.Optional(Type.String({ pattern: "^(\\d+\\.\\d+\\.\\d+|unreleased)$" })),
  },
  { additionalProperties: false },
);
export type RegulatorRecord = Static<typeof RegulatorRecordSchema>;

export function isRegulatorRecord(value: unknown): value is RegulatorRecord {
  return Value.Check(RegulatorRecordSchema, value);
}
