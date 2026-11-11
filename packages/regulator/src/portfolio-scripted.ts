/**
 * Scripted units for the worked example (`docs/examples/portfolio.md`): the
 * September close of the managed portfolio under the portfolio workload,
 * done without a model so the example runs under CI and the closeout checks
 * can be watched doing their work.
 *
 *   manager    does each session unit the way its contract asks: the lots
 *              are brought up to date from the person's fills and reconciled
 *              to the custodian, the report's return is the positions'
 *              time-weighted one, the target is a reported tilt inside the
 *              benchmark's tolerances, the harvest list takes every candidate
 *              worth taking with its replacement from the set and accounts
 *              for the rest, and each trade list — the program's rebalance,
 *              the harvest — is placed with place_trade, the workload's
 *              declared tool, which copies it under trades/pending/
 *              unchanged, only after a person's yes to one question naming
 *              every leg
 *   careless   the same units, but the confirmation takes the shortcut a
 *              hurried person would: calls place_trade without asking
 *              anyone. The gate derives the consent from the tool's declared
 *              effect and refuses the call before anything exists, and the
 *              unit then asks. Its harvest list buys back what it sells
 *              within a set — the harvested ticker as its own replacement,
 *              the wash sale the sets exist to avoid — and is refused by the
 *              suite at closeout by name; on the repair attempt it writes
 *              the list the manager would. What the careless unit of #120
 *              also did — write a list that was not the one the person was
 *              asked about — it can no longer do: a session does not write
 *              the pending file, the tool does, byte for byte from the
 *              proposed one
 *
 * Two unit types of this workload run a program and not a session (#122):
 * `plan-rebalance` and `harvest-losses` are the control plane's to run, from
 * the argv the workload declares, so nothing here stands in for them. What
 * the stand-in scripts is the sessions around them: the ingest, the target,
 * the two confirmations, the harvest plan, the review.
 *
 * The arithmetic is the domain's own: the stand-in imports `lib/portfolio.js`
 * from the unit's worktree — the file the suite judges it by — for the lots
 * the fills imply (with an executed wash sale's basis adjustment, #124), the
 * time-weighted return, and the harvest's evaluation, so the ingest and the
 * reconciliation check share one derivation and the harvest plan and the
 * harvest check share another. Nothing reads its own progress off the tree;
 * the unit reads the files its contract names and writes the ones its grant
 * allows.
 *
 * A scripted unit never runs a session, so nothing here exercises most of
 * the gates inside one (the profile grant, the write gate, the pause gate):
 * what the example shows is the loop — the closeout checks over the
 * portfolio's own suite, the protected prefixes, the consent obligation and
 * the paused attempt, the pre-merge trial on the merged tree. The one
 * session gate it does run is the consent gate (#60, #121): the place_trade
 * call goes through the same `consentGate` the host's interception runs,
 * with the workload's declared effects, so the consent is derived from the
 * tool's declaration here exactly as in a session, the yes given on one
 * attempt is read off the ledger on the next, and the stand-in never reads
 * the ledger or the hint for it. The tool itself runs through the same
 * `runDeclaredTool` the host's extension calls.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ExecutionStore, MemoryStore } from "@metacoding.io/regulator-core";
import type { InteractionPolicy, ResultReport, WorkContract } from "@metacoding.io/regulator-protocol";
import { askConsentHeadless, consentGate } from "./consent.js";
import type { DispatchRequest, Dispatcher } from "./controller.js";
import { declaredEffects, declaredToolArgumentProblems, loadDeclaredToolsSync, runDeclaredTool } from "./declared-tools.js";
import type { DispatcherFactory } from "./evals.js";
import type { Exec } from "./exec.js";
import { PROFILES } from "./profiles.js";
import { LAB_ROOT } from "./workload.js";

export const PORTFOLIO_BEHAVIOURS = ["manager", "careless"] as const;
export type PortfolioBehaviour = (typeof PORTFOLIO_BEHAVIOURS)[number];
export function isPortfolioBehaviour(value: string): value is PortfolioBehaviour {
  return (PORTFOLIO_BEHAVIOURS as readonly string[]).includes(value);
}

const DAY = 86_400_000;
/** The September close's date: what its contracts name. The ingest reads the latest export off the tree instead, so it serves any period. */
const DATE = "2026-09-30";
/** September's target: the benchmark tilted toward international equity, inside every subset's tolerance (the contract's d-inputs). */
const TARGET: Record<string, number> = { VTI: 0.36, VXUS: 0.31, BND: 0.33 };

// ---------------------------------------------------------------- the domain's library, as the worktree carries it

interface Positions { date: string; holdings: Map<string, number>; cash: number; externalFlows: number }
interface Lot { lot: string; ticker: string; acquired: string; shares: number; costPerShare: number; basisAdjustment: number; washedFrom: string[] }
interface WashSale { lot: string; soldOn: string; shares: number; disallowed: number; replacement: string }
interface Trade { ticker: string; side: "buy" | "sell"; shares: number; lots?: Array<{ lot: string; shares: number }> }
/** A sell in a proposed list: each lot with the gain and the tax the planner computed, which is what the question names; a harvest's legs name what replaces what. */
interface ProposedTrade extends Trade { lots?: Array<{ lot: string; shares: number; gain: string; longTerm: boolean; tax: string }>; benefit?: string; tradingCost?: string; opportunityCost?: string; replacement?: string; replaces?: string }
interface TradeList { file: string; name: string; date: string; kind?: string; trades: ProposedTrade[]; realisedTax: string; cashAfter: string }
interface Candidate { lot: string; ticker: string; shares: number; unrealised: string; longTerm: boolean }
interface TaxRules { shortTermRate: number; longTermRate: number; longTermAfterDays: number; washSaleWindowDays: number }
interface HarvestInputs { tradingCostRate: number; trackingVolatility: number }
interface Evaluation { value: number; loss: number; longTerm: boolean; benefit: number; tradingCost: number; opportunityCost: number; net: number }
interface HarvestContext { list: { file: string; name: string; date: string; trades: Trade[] }; lists: TradeList[]; executed: unknown[]; ledger: Lot[]; sets: Array<{ name: string; tickers: string[] }>; taxRules: TaxRules; inputs: HarvestInputs; px: Map<string, number>; date: string; windowDays?: number }

/** The exports of `lib/portfolio.js` the stand-in uses: the fixture's own vocabulary, read from the worktree so the arithmetic is the suite's. */
interface PortfolioLib {
  money(c: number): string;
  percent(r: number): string;
  positionDates(): string[];
  periodDates(period: string): string[];
  positions(date: string): Positions;
  prices(date: string): Map<string, number>;
  valuation(pos: Positions, px: Map<string, number>): { values: Map<string, number>; total: number };
  timeWeightedReturn(dates: string[]): number;
  universe(): { sets: Array<{ name: string; tickers: string[] }>; tickers: string[] };
  tax(): TaxRules;
  harvest(): HarvestInputs;
  lots(): { asOf: string; open: Lot[]; washSales: WashSale[] };
  replayLedger(date: string): { open: Lot[]; washSales: WashSale[] };
  renderLotsCsv(open: Lot[]): string;
  renderLotsJson(ledger: { asOf: string; washSales: WashSale[] }): string;
  executedTrades(): unknown[];
  harvestCandidates(): Array<{ file: string; date: string; candidates: Candidate[] }>;
  harvestEvaluation(lot: Lot, price: number, date: string, taxRules: TaxRules, inputs: HarvestInputs): Evaluation;
  harvestObstacles(lot: Lot, context: HarvestContext): Array<{ reason: string; detail: string }>;
  replacementsFor(ticker: string, context: HarvestContext): string[];
  otherListsWithin(list: { name: string; date: string }, windowDays: number): TradeList[];
  harvestBaseline(date: string, px: Map<string, number>): Positions;
  applyTrades(pos: Positions, trades: Trade[], px: Map<string, number>): Positions;
}

async function loadLib(worktree: string): Promise<PortfolioLib> {
  return (await import(pathToFileURL(path.join(worktree, "lib", "portfolio.js")).href)) as PortfolioLib;
}

async function read(worktree: string, file: string): Promise<string> {
  return readFile(path.join(worktree, file), "utf8");
}
async function write(worktree: string, file: string, content: string): Promise<void> {
  await mkdir(path.dirname(path.join(worktree, file)), { recursive: true });
  await writeFile(path.join(worktree, file), content, "utf8");
}

function reportFor(contract: WorkContract, attempt: number, summary: string, at: string, extra: Partial<ResultReport> = {}): ResultReport {
  return {
    contractId: contract.id, contractVersion: contract.version, unitId: contract.unitId, attempt, reportedAt: at, summary,
    evidence: [{ class: "test", ref: "run_tests", observation: "the portfolio's suite passes" }, { class: "command", ref: "run_checks", observation: "checks pass" }],
    delegatedResults: contract.delegated.map((d) => ({ decisionId: d.id, choice: "kept within the bounds" })),
    unresolvedOutcomes: contract.unresolved.map((d) => ({ decisionId: d.id, outcome: "surfaced" as const, note: "not traded and listed as an open item; nobody has said what it is" })),
    emergentDecisions: [], deviations: [], residualUncertainty: [],
    ...extra,
  };
}

/** How the consent question names a leg: each sell per lot with its gain or loss, its term and its tax; each buy with what it replaces, when it replaces something. */
function nameLegs(list: TradeList): string[] {
  return list.trades.map((t) => (t.side === "sell"
    ? (t.lots ?? []).map((l) => `sell ${l.shares} ${t.ticker} from lot ${l.lot} (${l.gain.startsWith("-") ? "loss" : "gain"} ${l.gain.replace(/^-/, "")}, ${l.longTerm ? "long-term" : "short-term"}, tax ${l.tax})${t.replacement ? `, replaced by ${t.replacement}` : ""}`).join("; ")
    : `buy ${t.shares} ${t.ticker}${t.replaces ? ` in place of ${t.replaces}` : ""}`));
}

export interface PortfolioDispatcherOptions {
  behaviour: PortfolioBehaviour;
  /** The instance (the base checkout): where the memory store and the obligation ledger live. */
  repo: string;
  /** For the consent question's timeout; the scripted unit is headless, so nobody answers in the session either way. */
  interaction?: InteractionPolicy;
  /** The definition the declared tools are read from and their programs resolved under; the lab's by default. */
  definitionRoot?: string;
  now?: () => number;
}

/**
 * One dispatcher for every unit of the September close, keyed by unit id.
 * The careless behaviour drifts on the first trade list it writes and takes
 * the router's hint on the repair attempt.
 */
export function portfolioDispatcher(exec: Exec, options: PortfolioDispatcherOptions): Dispatcher {
  const now = options.now ?? Date.now;
  const store = new ExecutionStore(options.repo, now);
  const stamp = () => new Date(now()).toISOString();
  const definitionRoot = options.definitionRoot ?? LAB_ROOT;
  // The workload's declared tools (#121), read as the host reads them: what the gate derives consent from, and what runs.
  const declared = loadDeclaredToolsSync(definitionRoot);
  const effects = declaredEffects(declared);
  const careless = options.behaviour === "careless";

  const commit = async (worktree: string, message: string) => {
    await exec("git", ["add", "-A"], { cwd: worktree });
    const r = await exec("git", ["-c", "commit.gpgsign=false", "commit", "-q", "-m", message], { cwd: worktree });
    if (r.code !== 0 && !/nothing to commit/.test(r.stdout + r.stderr)) throw new Error(`commit failed: ${r.stderr}`);
  };

  type Step = (r: DispatchRequest) => Promise<{ summary: string; extra?: Partial<ResultReport> }>;

  /**
   * A confirmation: one consent question naming every leg of a proposed list, then place_trade after the yes. The same
   * step for the rebalance (p4) and the harvest (p7): the list's kind is the tool's and the suite's concern, not this unit's.
   */
  const confirm = (name: string, subject: string, commitMessage: string): Step => async (r) => {
    const proposed = `trades/proposed/${name}`;
    const file = `trades/pending/${name}`;
    const placeTrade = declared.find((d) => d.tool.name === "place_trade")?.tool;
    if (!placeTrade) throw new Error("the portfolio workload declares no place_trade tool; the confirmation has nothing to place with");
    // The list is the planner's: read for the question, never copied by this unit — the tool copies it, byte for byte.
    const list = JSON.parse(await read(r.worktree, proposed)) as TradeList;
    const named = nameLegs(list);
    const call = { tool: "place_trade", arguments: { proposed } };
    const paused = { summary: `asked for consent to ${subject}, naming every trade, its lots and its tax; no one answered, nothing was placed`, extra: { residualUncertainty: [{ subject: "consent", reason: "the question is owed to a person", consequenceIfWrong: "high" as const }] } };
    const ask = () => askConsentHeadless(options.repo, {
      unitId: r.unitId, attempt: r.attempt, subject, question: `May I place ${proposed} as ${file} with place_trade: ${named.join("; ")}? Realised tax ${list.realisedTax} in all; ${list.cashAfter} cash left.`,
      action: `place_trade with proposed ${proposed}: ${list.trades.length} trades written to ${file}, byte for byte as proposed`, call,
      evidence: [{ class: "file", ref: proposed, observation: "the list the person is asked about" }, { class: "file", ref: "lots/lots.csv", observation: "the lots each sell comes from, current to the export" }], timeoutMs: options.interaction?.timeoutsMs.consent ?? 0, now,
    });
    // The manager asks before it calls the tool, on its first attempt. Whether the call may run is never its reading of the
    // hint, the attempt or the ledger: the gate below decides on every attempt, from the record — which is how the yes
    // given on attempt 1 holds on attempt 2 without a second question.
    if (!careless && r.attempt === 1) {
      await ask();
      return paused;
    }
    // The call, through the gate the host's interception runs, with the workload's declared effects: no profile grant
    // names place_trade, and the gate derives the consent from the tool's irreversible effect. Refused without a yes for
    // this call on the record — which is what the careless unit, calling first, meets — and then the unit asks; allowed on
    // the yes, whichever attempt proposes it.
    const decision = await consentGate({ repo: options.repo, unitId: r.unitId, profile: PROFILES[r.profile]!, call, now, declared: effects, validate: (a) => declaredToolArgumentProblems(placeTrade, a) });
    if (!decision.allowed) {
      await ask();
      return { ...paused, summary: `called place_trade for ${proposed} and was refused (${decision.reason}); asked for consent, no one answered, nothing was placed` };
    }
    // The tool: the same program the host runs, in the worktree, with the arguments the gate handed back (a person's
    // amendment in place, were there one). The pending file is the tool's doing; the unit never writes it.
    const run = await runDeclaredTool(exec, { root: definitionRoot, tool: placeTrade, arguments: decision.guarded ? decision.arguments : call.arguments, cwd: r.worktree, env: { REGULATOR_UNIT: r.unitId, REGULATOR_ATTEMPT: String(r.attempt), REGULATOR_PROFILE: r.profile } });
    await commit(r.worktree, commitMessage);
    return { summary: `consent given; place_trade ${run.summary} (${named.join("; ")}; realised tax ${list.realisedTax})`, extra: {
      evidence: [{ class: "test", ref: "run_tests", observation: "the portfolio's suite passes" }, { class: "command", ref: "run_checks", observation: "checks pass" }, ...run.evidence.map((e) => ({ class: e.class, ref: e.ref, ...(e.observation ? { observation: `${e.observation}; placed by ${run.program.file} (${run.program.sha256.slice(0, 12)}), exit ${run.program.exit}` } : {}) }))],
    } };
  };

  const steps: Record<string, Step> = {
    "p1-ingest-positions": async (r) => {
      // The lots the fills imply through the latest export, derived by the domain's own library — the one derivation the
      // suite's reconciliation check also runs, wash-sale adjustments included — then the ledger is current to that export.
      const lib = await loadLib(r.worktree);
      const dates = lib.positionDates();
      const date = dates[dates.length - 1]!;
      const period = date.slice(0, 7);
      const was = lib.lots();
      const ledger = lib.replayLedger(date);
      await write(r.worktree, "lots/lots.csv", lib.renderLotsCsv(ledger.open));
      await write(r.worktree, "lots/lots.json", lib.renderLotsJson({ asOf: date, washSales: ledger.washSales }));
      // The period review: the valuation, the time-weighted return chained over the period's exports, the holdings, the open items.
      const periodDates = lib.periodDates(period);
      const twr = lib.timeWeightedReturn(periodDates);
      let flows = 0;
      for (const d of periodDates.slice(1)) flows += lib.positions(d).externalFlows;
      const pos = lib.positions(date);
      const px = lib.prices(date);
      const { total: value } = lib.valuation(pos, px);
      const universe = lib.universe().tickers;
      const rows = [...pos.holdings].map(([t, n]) => `| ${t} | ${n} | ${lib.money(px.get(t)!)} | ${lib.money(n * px.get(t)!)} | ${((n * px.get(t)!) / value * 100).toFixed(1)}% |`);
      const openItems = [...pos.holdings].filter(([t]) => !universe.includes(t)).map(([t, n]) => `- ${t} ${n} shares (${lib.money(n * px.get(t)!)} on ${date}) is not in universe.json: transferred in before the opening purchases, with no confirmation and no basis; not traded, carried until a person says what it is`);
      const previous = lib.valuation(lib.positions(periodDates[0]!), lib.prices(periodDates[0]!)).total;
      const washed = ledger.washSales.filter((w) => w.soldOn > was.asOf);
      const washedLines = washed.map((w) => `- the ${w.soldOn} sale of ${w.shares} share(s) of lot ${w.lot} at a loss was a wash sale against the buy that opened lot ${w.replacement} inside the window: ${lib.money(w.disallowed)} of the loss is disallowed and carried into that lot's basis`);
      await write(r.worktree, `reports/${period}.md`, `# ${period} — period review\n\nAccount brokerage: value ${lib.money(value)} on ${date}, from ${lib.money(previous)} on ${periodDates[0]}; external flows ${lib.money(flows)}.\nTime-weighted return: ${lib.percent(twr)}.\n\n| ticker | shares | price | value | weight |\n| --- | --- | --- | --- | --- |\n${rows.join("\n")}\n| cash | | | ${lib.money(pos.cash)} | ${(pos.cash / value * 100).toFixed(1)}% |\n${washedLines.length ? `\nWash sales this period:\n${washedLines.join("\n")}\n` : ""}\nOpen items:${openItems.length ? `\n${openItems.join("\n")}` : " none."}\n`);
      await commit(r.worktree, `p1: the lots current to ${date} from the fills since ${was.asOf}, and the ${period} review`);
      await new MemoryStore(options.repo, now).record({
        subject: "VNQ, 2 shares", note: "in the account since before the opening purchases; the custodian has no confirmation for it and nobody has given its basis — a person has to say what it is before anything trades it", evidence: [{ class: "file", ref: `positions/${date}.csv` }],
        unit: r.unitId, recordedBy: "S1", reviewBy: new Date(now() + 60 * DAY).toISOString(), scope: ["ingest-positions", "confirm-trades", "review"],
      });
      return { summary: `replayed the fills since ${was.asOf} into the lots, now current to ${date} and reconciled to the custodian${washed.length ? `, with ${washed.length} wash sale(s) carried into the replacement lot's basis` : ""}; wrote reports/${period}.md with the time-weighted return ${lib.percent(twr)} over ${periodDates.join(" → ")}; VNQ stays an open item`, extra: {
        delegatedResults: [{ decisionId: "d-prose", choice: `one sentence; the numbers are the custodian's, the return chains the ${periodDates.length} exports with ${lib.money(flows)} of flows valued on their day` }],
        residualUncertainty: [{ subject: "VNQ", reason: "no fill and no basis; a person has to say where it came from", consequenceIfWrong: "low" }],
      } };
    },
    "p2-propose-target": async (r) => {
      await write(r.worktree, `targets/${DATE}.json`, `${JSON.stringify({ asOf: DATE, weights: TARGET }, null, 2)}\n`);
      await commit(r.worktree, `p2: the September target, the benchmark tilted toward international equity`);
      return { summary: `wrote targets/${DATE}.json: VTI 0.36, VXUS 0.31, BND 0.33; equity 0.67 against the benchmark's 0.65 and fixed income 0.33 against 0.35, inside the 0.05 tolerances`, extra: {
        delegatedResults: [{ decisionId: "d-inputs", choice: "the benchmark's weights as the equilibrium, with no view raised this period; tilted 0.06 toward international equity after its September fall, taken 0.04 from US equity and 0.02 from bonds" }],
      } };
    },
    "p4-confirm-trades": confirm(`${DATE}.json`, "the September trade list", "p4: the September trade list placed under trades/pending/ after consent, by place_trade: the program's list, unchanged"),
    "p6-plan-harvest": async (r) => {
      // The harvest (#124): every candidate the program listed, taken when the arithmetic says it is worth it and nothing
      // stands in the way, with its replacement from the set; the rest accounted for. Planned over the positions after the
      // agreed rebalance list of the date, which is why that list's buys count as recent buys here.
      const lib = await loadLib(r.worktree);
      const candidates = lib.harvestCandidates().find((c) => c.date === DATE);
      if (!candidates) throw new Error(`no trades/proposed/harvest-${DATE}.json: the harvest-losses program has not run`);
      const ledger = lib.lots();
      const px = lib.prices(DATE);
      const taxRules = lib.tax();
      const inputs = lib.harvest();
      const { sets } = lib.universe();
      const name = `harvest-plan-${DATE}.json`;
      const file = `trades/proposed/${name}`;
      const list: { file: string; name: string; date: string; trades: Trade[] } = { file, name, date: DATE, trades: [] };
      const context: HarvestContext = { list, lists: lib.otherListsWithin(list, taxRules.washSaleWindowDays), executed: lib.executedTrades(), ledger: ledger.open, sets, taxRules, inputs, px, date: DATE, windowDays: taxRules.washSaleWindowDays };
      const lotOf = (c: Candidate) => ledger.open.find((l) => l.lot === c.lot)!;
      const evaluate = (c: Candidate) => lib.harvestEvaluation(lotOf(c), px.get(c.ticker)!, DATE, taxRules, inputs);
      const ordered = [...candidates.candidates].sort((a, b) => evaluate(b).net - evaluate(a).net || a.lot.localeCompare(b.lot));
      const sells: ProposedTrade[] = [];
      const buys: ProposedTrade[] = [];
      const dispositions: Array<{ lot: string; ticker: string; reason: string; detail: string }> = [];
      const said: string[] = [];
      const replacements: string[] = [];
      let taxTotal = 0;
      for (const c of ordered) {
        const lot = lotOf(c);
        const obstacles = lib.harvestObstacles(lot, context);
        if (obstacles.length) {
          dispositions.push({ lot: lot.lot, ticker: lot.ticker, reason: obstacles[0]!.reason, detail: obstacles[0]!.detail });
          said.push(`${lot.lot} left: ${obstacles[0]!.reason} (${obstacles[0]!.detail})`);
          continue;
        }
        const e = evaluate(c);
        // The careless unit buys back the ticker it sells — the fund itself as its own "replacement", which is the wash
        // sale the sets exist to avoid; the suite refuses it by name. The repair takes the set's other ticker.
        const replacement = careless && r.attempt === 1 ? lot.ticker : lib.replacementsFor(lot.ticker, context)[0]!;
        const bought = Math.floor(e.value / px.get(replacement)!);
        sells.push({ ticker: lot.ticker, side: "sell", shares: lot.shares, lots: [{ lot: lot.lot, shares: lot.shares, gain: lib.money(e.loss), longTerm: e.longTerm, tax: lib.money(-e.benefit) }], benefit: lib.money(e.benefit), tradingCost: lib.money(e.tradingCost), opportunityCost: lib.money(e.opportunityCost), replacement });
        buys.push({ ticker: replacement, side: "buy", shares: bought, replaces: lot.ticker });
        list.trades = [...sells, ...buys];
        taxTotal -= e.benefit;
        replacements.push(`${replacement} for ${lot.ticker}: ${replacement === lot.ticker ? "the fund itself" : `the other ticker of the ${sets.find((s) => s.tickers.includes(lot.ticker))!.name} set`}, ${bought} shares with the ${lib.money(e.value)} the sell frees`);
        said.push(`sell ${lot.shares} ${lot.ticker} from lot ${lot.lot} (loss ${lib.money(-e.loss)}, ${e.longTerm ? "long-term" : "short-term"}, benefit ${lib.money(e.benefit)} against trading ${lib.money(e.tradingCost)} and opportunity ${lib.money(e.opportunityCost)}), buy ${bought} ${replacement}`);
      }
      const after = lib.applyTrades(lib.harvestBaseline(DATE, px), list.trades, px);
      await write(r.worktree, file, `${JSON.stringify({
        date: DATE, kind: "harvest", candidates: candidates.file, baseline: `trades/pending/${DATE}.json`,
        note: "A harvest list the plan-harvest unit wrote from the candidates the harvest-losses program found, over the positions after the agreed rebalance list of the date; not yet agreed. Every sell is a whole candidate lot worth taking by harvest.json's arithmetic, each buy its replacement from the sold ticker's exchangeable set, and every candidate left is under dispositions with its reason.",
        trades: list.trades, dispositions, realisedTax: lib.money(taxTotal), cashAfter: lib.money(after.cash),
      }, null, 2)}\n`);
      await commit(r.worktree, `p6: the September harvest list${careless && r.attempt === 1 ? "" : ", every candidate taken or accounted for"}`);
      return { summary: `wrote ${file}: ${said.join("; ")}; tax saved ${lib.money(-taxTotal)}; ${lib.money(after.cash)} cash left. Not yet agreed: consent and the copy under trades/pending/ are the confirmation's.`, extra: {
        delegatedResults: [
          { decisionId: "d-harvest", choice: `${sells.length} of ${candidates.candidates.length} candidate(s) harvested, in order of benefit net of costs: ${said.join("; ")}` },
          { decisionId: "d-replacement", choice: replacements.join("; ") || "nothing harvested, nothing replaced" },
        ],
        unresolvedOutcomes: [{ decisionId: "u-unnamed", outcome: "preserved", note: "none arose this period: every candidate's ticker is in a set of universe.json" }],
        evidence: [{ class: "test", ref: "run_tests", observation: "the portfolio's suite passes" }, { class: "command", ref: "run_checks", observation: "checks pass" }, { class: "file", ref: file, observation: `${sells.length} sell(s), ${buys.length} buy(s), ${dispositions.length} candidate(s) left with a reason` }],
      } };
    },
    "p7-confirm-harvest": confirm(`harvest-plan-${DATE}.json`, "the September harvest list", "p7: the September harvest list placed under trades/pending/ after consent, by place_trade: the plan's list, unchanged"),
    "p8-review": async () => ({ summary: `read lots/, targets/${DATE}.json, trades/proposed/${DATE}.json, trades/pending/${DATE}.json, trades/proposed/harvest-${DATE}.json, trades/proposed/harvest-plan-${DATE}.json, trades/pending/harvest-plan-${DATE}.json and reports/${DATE.slice(0, 7)}.md against the ${DATE} export: the lots hold what the custodian holds, the target is inside every subset tolerance, the pending rebalance is the proposed one and lands every position inside the band selling only from held lots with no wash sale, every harvest candidate is at a loss, the pending harvest is the proposed one and exchanges within its set with every candidate accounted for, and the return is the positions' own. One open item: VNQ, 2 shares, carried.`, extra: { evidence: [{ class: "test", ref: "run_tests", observation: "the portfolio's suite passes; the host's run is the evidence" }] } }),
  };

  return async (r) => {
    const step = steps[r.unitId];
    if (!step) throw new Error(`the scripted manager knows no unit "${r.unitId}"`);
    const { summary, extra } = await step(r);
    await store.writeReport(reportFor(r.contract, r.attempt, summary, stamp(), extra));
    return {};
  };
}

/** The portfolio behaviours as the eval harness dispatches them: one scripted close per instance, keyed by the unit each task names. */
export function portfolioDispatchers(exec: Exec, behaviour: PortfolioBehaviour, now: () => number = Date.now): DispatcherFactory {
  const byInstance = new Map<string, Dispatcher>();
  return (_arm, _task, instance): Dispatcher => {
    let dispatcher = byInstance.get(instance);
    if (!dispatcher) {
      dispatcher = portfolioDispatcher(exec, { behaviour, repo: instance, now });
      byInstance.set(instance, dispatcher);
    }
    return dispatcher;
  };
}
