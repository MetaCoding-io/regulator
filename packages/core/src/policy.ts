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
import type { BudgetCeiling, BudgetDimension, BudgetLedger, ModelRoute, PolicyDefinition, TokenUsage, WorkContract } from "@metacoding.io/regulator-protocol";

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
    this.#ledger = {
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
    this.#ledger.consumed.wallClockMs = Math.max(0, this.#now() - Date.parse(this.#ledger.startedAt));
    this.#ledger.updatedAt = new Date(this.#now()).toISOString();
    return structuredClone(this.#ledger);
  }

  get exhausted(): BudgetLedger["exhausted"] {
    return this.#ledger.exhausted;
  }

  recordUsage(usage: TokenUsage): void {
    this.#ledger.consumed.tokens += usage.totalTokens;
    this.#ledger.consumed.cost += usage.cost;
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
  return `${ledger.consumed.tokens}/${ledger.ceiling.tokens} tok (${pct(ledger.consumed.tokens, ledger.ceiling.tokens)}), ${ledger.consumed.turns}/${ledger.ceiling.turns} turns${ledger.exhausted ? `, exhausted: ${ledger.exhausted.dimension}` : ""}`;
}
