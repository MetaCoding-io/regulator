/**
 * Budgets and model routes as mechanisms (lesson 07).
 *
 * `ceilingFor` / `routeFor` resolve a policy for a unit type. `chooseModels`
 * orders a route by what is actually available — the fallback is declared,
 * not improvised. `BudgetMeter` is the S3 ceiling: it counts what an attempt
 * consumed and says which dimension crossed first; the session halts on
 * that answer, it never argues with it. `renderPreservedContext` is what a
 * compaction must carry regardless of how the summary turns out: the
 * contract's identity and allocation, the evidence gathered so far, and the
 * files touched — losing any of these breaks the loop.
 */
import type { BudgetCeiling, BudgetConsumed, BudgetDimension, BudgetLedger, ModelRoute, PolicyDefinition, TokenUsage, WorkContract } from "@metacoding.io/regulator-protocol";

export function ceilingFor(policy: PolicyDefinition, unitType: string): BudgetCeiling {
  return { ...policy.budgets.default, ...(policy.budgets.byUnitType?.[unitType] ?? {}) };
}

export function routeFor(policy: PolicyDefinition, unitType: string): ModelRoute {
  return policy.models.byUnitType?.[unitType] ?? policy.models.default;
}

/** The route's models in order, keeping only those in `available` (as `provider/modelId`). Empty means nothing to run on. */
export function chooseModels(route: ModelRoute, available: readonly string[]): string[] {
  const set = new Set(available);
  return [route.primary, ...route.fallback].filter((ref, i, all) => set.has(ref) && all.indexOf(ref) === i);
}

/**
 * The ledger an attempt opens on when it continues an earlier attempt's budget (#133): a retry under
 * `context-degradation` is a fresh session, not a fresh allowance. Consumption starts from what the earlier attempt
 * spent, under the same ceiling; `carried` says how much of it is that attempt's and which attempt, so the ledger
 * shows where the attempt stands against the ceiling and a sum over a unit's ledgers still counts each token once
 * (`ownConsumption`). The halt marker, the models and the compactions are the earlier attempt's and are not carried:
 * if nothing is left, the guard halts the new session at its first check. S3 writes this before dispatch; the
 * session's meter resumes it the way a fallback session resumes an attempt's ledger.
 */
export function carriedLedger(prior: BudgetLedger, attempt: number, now: () => number = Date.now): BudgetLedger {
  const at = new Date(now()).toISOString();
  return {
    unitId: prior.unitId, attempt, ceiling: { ...prior.ceiling }, consumed: { ...prior.consumed }, startedAt: at, updatedAt: at,
    models: [], compactions: [], carried: { attempt: prior.attempt, consumed: { ...prior.consumed } },
  };
}

/** What an attempt consumed itself: its ledger less what it carried from an earlier attempt. The unit's cost is the sum of these. */
export function ownConsumption(ledger: BudgetLedger): BudgetConsumed {
  const carried = ledger.carried?.consumed;
  if (!carried) return { ...ledger.consumed };
  const cache = (key: "cacheRead" | "cacheWrite") => (ledger.consumed[key] === undefined ? {} : { [key]: Math.max(0, ledger.consumed[key]! - (carried[key] ?? 0)) });
  return {
    tokens: Math.max(0, ledger.consumed.tokens - carried.tokens), cost: Math.max(0, ledger.consumed.cost - carried.cost),
    wallClockMs: Math.max(0, ledger.consumed.wallClockMs - carried.wallClockMs), turns: Math.max(0, ledger.consumed.turns - carried.turns),
    ...cache("cacheRead"), ...cache("cacheWrite"),
  };
}

/** The names of the model routes a budget policy declares: `default`, and each unit type it routes under `models.byUnitType`. */
export function routeNames(policy: PolicyDefinition): string[] {
  return ["default", ...Object.keys(policy.models.byUnitType ?? {}).filter((n) => n !== "default")];
}

/** The route a policy declares under a name (`routeNames`), or undefined when it declares none by that name. */
export function namedRoute(policy: PolicyDefinition, name: string): ModelRoute | undefined {
  return name === "default" ? policy.models.default : policy.models.byUnitType?.[name];
}

export interface EvidencePointer {
  tool: string;
  at: string;
  summary: string;
}

export interface BudgetMeterOptions {
  unitId: string;
  attempt: number;
  ceiling: BudgetCeiling;
  now?: () => number;
  model?: string;
  /**
   * The attempt's ledger so far, when a session opens on an attempt another session already metered (a fallback
   * after a provider failure) or that S3 opened on an earlier attempt's consumption (`carriedLedger`). Consumption,
   * models, compactions and an exhausted marker carry over: the attempt is one attempt whichever session runs it,
   * and a halted attempt stays halted.
   */
  resume?: BudgetLedger;
}

/** Counts consumption per attempt and reports the first ceiling crossed. Pi-free. */
export class BudgetMeter {
  readonly #now: () => number;
  readonly #ledger: BudgetLedger;
  readonly evidence: EvidencePointer[] = [];

  constructor(options: BudgetMeterOptions) {
    this.#now = options.now ?? Date.now;
    const at = new Date(this.#now()).toISOString();
    const { attempts: _attempts, ...ceiling } = options.ceiling;
    const prior = options.resume && options.resume.unitId === options.unitId && options.resume.attempt === options.attempt ? structuredClone(options.resume) : undefined;
    this.#ledger = prior
      ? { ...prior, ceiling, updatedAt: at, models: options.model && prior.models.at(-1) !== options.model ? [...prior.models, options.model] : prior.models }
      : {
          unitId: options.unitId,
          attempt: options.attempt,
          ceiling,
          consumed: { tokens: 0, cost: 0, wallClockMs: 0, turns: 0 },
          startedAt: at,
          updatedAt: at,
          models: options.model ? [options.model] : [],
          compactions: [],
        };
  }

  get ledger(): BudgetLedger {
    // A carried ledger's clock starts when this attempt's ledger was opened; the earlier attempt's time is added, not re-measured.
    this.#ledger.consumed.wallClockMs = (this.#ledger.carried?.consumed.wallClockMs ?? 0) + Math.max(0, this.#now() - Date.parse(this.#ledger.startedAt));
    this.#ledger.updatedAt = new Date(this.#now()).toISOString();
    return structuredClone(this.#ledger);
  }

  get exhausted(): BudgetLedger["exhausted"] {
    return this.#ledger.exhausted;
  }

  recordUsage(usage: TokenUsage): void {
    this.#ledger.consumed.tokens += usage.totalTokens;
    this.#ledger.consumed.cost += usage.cost;
    this.#ledger.consumed.cacheRead = (this.#ledger.consumed.cacheRead ?? 0) + usage.cacheRead;
    this.#ledger.consumed.cacheWrite = (this.#ledger.consumed.cacheWrite ?? 0) + usage.cacheWrite;
  }

  recordTurn(): void {
    this.#ledger.consumed.turns += 1;
  }

  recordModel(model: string): void {
    if (this.#ledger.models.at(-1) !== model) this.#ledger.models.push(model);
  }

  recordCompaction(reason: string, preserved: boolean): void {
    this.#ledger.compactions.push({ at: new Date(this.#now()).toISOString(), reason, preserved });
  }

  recordEvidence(pointer: EvidencePointer): void {
    this.evidence.push(pointer);
  }

  /** The first dimension over its ceiling, or undefined. Sticky: once exhausted, stays exhausted. */
  check(): BudgetDimension | undefined {
    if (this.#ledger.exhausted) return this.#ledger.exhausted.dimension;
    const { ceiling, consumed } = this.ledger;
    const order: Array<[BudgetDimension, boolean]> = [
      ["tokens", consumed.tokens >= ceiling.tokens],
      ["cost", ceiling.cost !== undefined && consumed.cost >= ceiling.cost],
      ["wallClockMs", consumed.wallClockMs >= ceiling.wallClockMs],
      ["turns", consumed.turns >= ceiling.turns],
    ];
    const crossed = order.find(([, over]) => over)?.[0];
    if (crossed) this.#ledger.exhausted = { dimension: crossed, at: new Date(this.#now()).toISOString() };
    return crossed;
  }
}

/**
 * The block a compaction summary must begin with. Deterministic: nothing in
 * it comes from a model, so it survives a bad summary and a missing one.
 */
export function renderPreservedContext(contract: WorkContract, ledger: BudgetLedger, evidence: readonly EvidencePointer[], modifiedFiles: readonly string[]): string {
  const lines = [
    "## Regulator context (preserved across compaction — do not drop)",
    `Unit ${contract.unitId}, attempt ${ledger.attempt}, under work contract ${contract.id} v${contract.version}.`,
    `Objective: ${contract.objective}`,
    "",
    "Fixed (preserve; deviation is reported, never silent):",
    ...(contract.fixed.length ? contract.fixed.map((d) => `- ${d.id}: ${d.decision}`) : ["- (none)"]),
    "",
    "Delegated (yours to choose within bounds; report the choice in report_result):",
    ...(contract.delegated.length ? contract.delegated.map((d) => `- ${d.id}: ${d.subject} — ${d.bounds}`) : ["- (none)"]),
    "",
    "Unresolved (do not settle; report as preserved or surfaced):",
    ...(contract.unresolved.length ? contract.unresolved.map((d) => `- ${d.id}: ${d.subject} (${d.handling})`) : ["- (none)"]),
    "",
    "Evidence gathered so far (cite these in report_result; do not re-run what is already evidenced unless the code changed since):",
    ...(evidence.length ? evidence.map((e) => `- ${e.at} ${e.tool}: ${e.summary}`) : ["- (none yet)"]),
    "",
    `Files modified so far: ${modifiedFiles.length ? modifiedFiles.join(", ") : "(none)"}`,
    `Budget: ${ledger.consumed.tokens}/${ledger.ceiling.tokens} tokens, ${ledger.consumed.turns}/${ledger.ceiling.turns} turns used.`,
    "The unit ends by calling report_result exactly once.",
  ];
  return lines.join("\n");
}

/** What the `regulator status` read model and the control room show per unit. */
export function summarizeLedger(ledger: BudgetLedger): string {
  const pct = (a: number, b: number) => `${Math.min(999, Math.round((a / b) * 100))}%`;
  const { cacheRead, cacheWrite, cost } = ledger.consumed;
  // Cache read and write are part of the token count, shown beside it once the ledger keeps them (#201); cost once there is any.
  const cache = cacheRead === undefined && cacheWrite === undefined ? "" : `, cache ${cacheRead ?? 0} read / ${cacheWrite ?? 0} write`;
  return `${ledger.consumed.tokens}/${ledger.ceiling.tokens} tok (${pct(ledger.consumed.tokens, ledger.ceiling.tokens)})${cache}, ${cost > 0 ? `cost ${Number(cost.toFixed(4))}, ` : ""}${ledger.consumed.turns}/${ledger.ceiling.turns} turns${ledger.carried ? `, ${ledger.carried.consumed.tokens} tok and ${ledger.carried.consumed.turns} turns carried from attempt ${ledger.carried.attempt}` : ""}${ledger.exhausted ? `, exhausted: ${ledger.exhausted.dimension}` : ""}`;
}
