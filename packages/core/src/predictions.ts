/**
 * Predictions that resolve from the stores (#138: the accept-path split,
 * slice 2; the Harness² note §8; open questions §4 items 1 and 2).
 *
 *   foldPredictions      the fold over the regulatory log: every intelligence
 *                        signal with a prediction block, the harness-edit
 *                        proposals that bet on it and the decision each got,
 *                        each horizon's state (awaiting a decision, open, met,
 *                        declined) and the resolutions recorded against it,
 *                        with a precision that counts inconclusive against
 *   compareWithPrediction the three-valued rule: disconfirmed at or past the
 *                        disconfirming value; confirmed when the observed value
 *                        reaches the baseline moved by the magnitude (and, for a
 *                        probe, its whole interval does); inconclusive otherwise
 *   resolvePredictions   at a unit's close or abort, read the named metric
 *                        with the grader the caller supplies (the harness's,
 *                        never the unit's report), compare, append a
 *                        `prediction-resolution`; a probe horizon resolves from
 *                        the committed report it names. A disconfirmed live
 *                        horizon is a proposal to S5 to revert or re-decide,
 *                        routed under the routing policy into an obligation
 *   checkHarnessEdit     the host's reading of a `harness-edit`: every diagnosis
 *                        reference resolves in the stores, and the prediction
 *                        names a signal that carries the block
 *
 * Pi-free and git-free. Nothing here reads a unit's report, and nothing here
 * reverts an advice file: a disconfirmed horizon opens an obligation, and a
 * person decides. The live horizon's "next N units" is kept by the fold — the
 * count is the number of resolutions recorded against the horizon — so no
 * scan of the execution store and no index are needed.
 */
import { randomUUID } from "node:crypto";
import {
  isHarnessEdit,
  type Disposition, type EvalReport, type GraderVerdict, type HarnessEdit, type IntelligenceSignal, type MetricSummary, type Obligation, type ObligationStatus,
  type PolicyProposal, type Prediction, type PredictionDirection, type PredictionHorizon, type PredictionOutcome, type PredictionResolution, type RegulatoryEntry, type RoutingPolicy, type VsmSystem,
} from "@metacoding.io/regulator-protocol";
import { AuditLog } from "./audit-log.js";
import { ExecutionStore } from "./execution-store.js";
import { ObligationLedger, foldObligations, routeMessages } from "./obligations.js";
import { appendEntry, isMessage, readEntries } from "./signals.js";
import { unitTrajectory } from "./trajectory.js";

export type PredictionSignal = IntelligenceSignal & { prediction: Prediction };

export function isPrediction(entry: RegulatoryEntry): entry is PredictionSignal {
  return isMessage(entry) && entry.kind === "intelligence-signal" && entry.prediction !== undefined;
}

export function isResolution(entry: RegulatoryEntry): entry is PredictionResolution {
  return "type" in entry && entry.type === "prediction-resolution";
}

/** A horizon's state, folded: whether anything can resolve it yet, and what has. */
export type HorizonStatus =
  /** A live horizon of a prediction a harness-edit bets on, before the proposal is decided: nothing is measured yet, because the edit is not in effect. */
  | "awaiting-decision"
  /** The proposal betting on it was declined; the horizon never opens. */
  | "declined"
  | "open"
  /** Every unit it named has resolved, or the report it named was read. */
  | "met";

export interface HorizonState {
  index: number;
  horizon: PredictionHorizon;
  status: HorizonStatus;
  /** When the horizon opened: the signal's timestamp, or the acceptance of the harness-edit that bets on it. */
  openedAt?: string;
  /** Why it is not open, when it is not. */
  note?: string;
  resolutions: PredictionResolution[];
}

/** The decision a harness-edit that bets on the prediction got, read from the obligation the proposal opened. */
export interface PredictionProposal {
  messageId: string;
  profile: string;
  obligationId?: string;
  status?: ObligationStatus;
  disposition?: Disposition;
  decidedAt?: string;
  decidedBy?: string;
}

/** Outcomes counted: inconclusive is in the denominator and never in the numerator. */
export interface PredictionPrecision {
  confirmed: number;
  disconfirmed: number;
  inconclusive: number;
  resolved: number;
  /** confirmed / resolved; undefined until something resolved. */
  precision: number | undefined;
}

export interface PredictionState {
  signal: PredictionSignal;
  prediction: Prediction;
  proposals: PredictionProposal[];
  horizons: HorizonState[];
  summary: PredictionPrecision;
  /** `open` while any horizon is open; `resolved` once every horizon is met; otherwise what the horizons are waiting on. */
  status: "open" | "resolved" | "awaiting-decision" | "declined";
}

export function precisionOf(resolutions: readonly PredictionResolution[]): PredictionPrecision {
  const count = (outcome: PredictionOutcome) => resolutions.filter((r) => r.outcome === outcome).length;
  const confirmed = count("confirmed"), disconfirmed = count("disconfirmed"), inconclusive = count("inconclusive");
  const resolved = confirmed + disconfirmed + inconclusive;
  return { confirmed, disconfirmed, inconclusive, resolved, precision: resolved ? confirmed / resolved : undefined };
}

/** The harness-edit proposals in the log that bet on a prediction, by the id their payload names. */
function proposalsBetting(entries: readonly RegulatoryEntry[], predictionId: string): Array<PolicyProposal & { requestedChange: HarnessEdit }> {
  return entries.filter(isMessage).filter((m): m is PolicyProposal & { requestedChange: HarnessEdit } => m.kind === "policy-proposal" && isHarnessEdit(m.requestedChange) && m.requestedChange.prediction === predictionId);
}

/** Fold the log into every prediction's state, in the order the signals were recorded. */
export function foldPredictions(entries: readonly RegulatoryEntry[]): PredictionState[] {
  const obligations = foldObligations(entries);
  const resolutions = entries.filter(isResolution);
  return entries.filter(isPrediction).map((signal) => {
    const proposals: PredictionProposal[] = proposalsBetting(entries, signal.id).map((p) => {
      // The obligation the proposal opened — or its successor, which carries the message among its sources.
      const owed = obligations.filter((o) => o.concern === "policy-proposal" && o.sources.includes(p.id));
      const decided = owed.find((o) => o.status === "resolved") ?? owed.at(-1);
      return {
        messageId: p.id, profile: p.requestedChange.change.profile,
        ...(decided ? { obligationId: decided.id, status: decided.status, ...(decided.disposition ? { disposition: decided.disposition } : {}), ...(decided.closedAt ? { decidedAt: decided.closedAt } : {}), ...(decided.closedBy ? { decidedBy: decided.closedBy } : {}) } : {}),
      };
    });
    const accepted = proposals.filter((p) => p.disposition === "accepted").sort((a, b) => (a.decidedAt ?? "").localeCompare(b.decidedAt ?? ""))[0];
    const pending = proposals.some((p) => p.status === undefined || p.status === "open" || p.status === "acknowledged");
    const horizons: HorizonState[] = signal.prediction.horizons.map((horizon, index) => {
      const mine = resolutions.filter((r) => r.predictionId === signal.id && r.horizon === index);
      if (horizon.kind === "probe") {
        // A probe runs before anyone decides: open from the signal, met by the report it names.
        return { index, horizon, status: mine.length ? "met" : "open", openedAt: signal.timestamp, resolutions: mine };
      }
      if (mine.length >= horizon.count) return { index, horizon, status: "met", ...(accepted ? { openedAt: accepted.decidedAt! } : { openedAt: signal.timestamp }), resolutions: mine };
      if (!proposals.length) return { index, horizon, status: "open", openedAt: signal.timestamp, note: "no harness-edit bets on this prediction; the horizon is open from the signal", resolutions: mine };
      if (accepted) return { index, horizon, status: "open", openedAt: accepted.decidedAt!, note: `open since ${accepted.decidedBy} accepted proposal ${accepted.messageId.slice(0, 8)} (advice/${accepted.profile}.md)`, resolutions: mine };
      if (pending) return { index, horizon, status: "awaiting-decision", note: "the harness-edit betting on it is owed to S5 and undecided; the edit is not in effect", resolutions: mine };
      const declined = proposals.find((p) => p.disposition !== undefined) ?? proposals[0]!;
      return { index, horizon, status: "declined", note: `proposal ${declined.messageId.slice(0, 8)} was ${declined.disposition ?? declined.status} by ${declined.decidedBy ?? "nobody"}; the edit never took effect`, resolutions: mine };
    });
    const all = horizons.flatMap((h) => h.resolutions);
    const status: PredictionState["status"] = horizons.some((h) => h.status === "open") ? "open" : horizons.every((h) => h.status === "met") ? "resolved" : horizons.some((h) => h.status === "awaiting-decision") ? "awaiting-decision" : "declined";
    return { signal, prediction: signal.prediction, proposals, horizons, summary: precisionOf(all), status };
  });
}

export interface Comparison {
  observed: number;
  /** Absent when no baseline value could be read: confirmed is then out of reach, disconfirmed is not. */
  baseline: number | undefined;
  direction: PredictionDirection;
  magnitude: number;
  disconfirmedBy: number;
  /** A probe's 95% interval on the arm's mean: confirmed only when the whole interval reaches the target. */
  interval?: readonly [number, number];
}

/**
 * The three-valued rule. Disconfirmed comes first: an observed value at or past the disconfirming value counts against
 * the prediction whatever the baseline says. Confirmed needs the observed value to reach the baseline moved by the
 * magnitude in the predicted direction — for a probe, its whole interval. Everything else is inconclusive, which is
 * not neutral: it counts against the prediction's precision and never for the edit.
 */
export function compareWithPrediction(c: Comparison): { outcome: PredictionOutcome; reason: string } {
  const lower = c.direction === "lower";
  const past = lower ? c.observed >= c.disconfirmedBy : c.observed <= c.disconfirmedBy;
  if (past) return { outcome: "disconfirmed", reason: `observed ${c.observed} is at or past the disconfirming value ${c.disconfirmedBy} (predicted ${c.direction})` };
  if (c.baseline === undefined) return { outcome: "inconclusive", reason: `observed ${c.observed} is short of the disconfirming value ${c.disconfirmedBy}, and no baseline value could be read to say whether it reaches the predicted ${c.direction} by ${c.magnitude}` };
  const target = lower ? c.baseline - c.magnitude : c.baseline + c.magnitude;
  const reaches = lower ? c.observed <= target : c.observed >= target;
  if (!reaches) return { outcome: "inconclusive", reason: `observed ${c.observed} neither reaches ${target} (baseline ${c.baseline} ${c.direction} by ${c.magnitude}) nor the disconfirming value ${c.disconfirmedBy}` };
  if (c.interval) {
    const whole = lower ? c.interval[1] <= target : c.interval[0] >= target;
    if (!whole) return { outcome: "inconclusive", reason: `the mean ${c.observed} reaches ${target} (baseline ${c.baseline} ${c.direction} by ${c.magnitude}) but its 95% interval [${c.interval[0]}, ${c.interval[1]}] does not: the effect is too small to see at this budget` };
  }
  return { outcome: "confirmed", reason: `observed ${c.observed} reaches ${target} (baseline ${c.baseline} ${c.direction} by ${c.magnitude})${c.interval ? `, as does its 95% interval [${c.interval[0]}, ${c.interval[1]}]` : ""}` };
}

/** A committed eval report with the fingerprint a prediction names it by: the SHA-256 of its file. */
export interface CommittedReport {
  fingerprint: string;
  report: EvalReport;
  /** The file under the definition, when known. */
  file?: string;
}

function armSummary(report: EvalReport, arm: string, metric: string): MetricSummary | undefined {
  return report.arms.find((a) => a.arm === arm)?.metrics[metric];
}

/** The baseline value a prediction compares against, read from the reports; `problem` says why none could be. */
export function baselineValue(prediction: Prediction, reports: readonly CommittedReport[], probe?: CommittedReport): { value?: number; source?: string; problem?: string } {
  const b = prediction.baseline;
  if ("report" in b) {
    const committed = reports.find((r) => r.fingerprint === b.report);
    if (!committed) return { problem: `no committed report has fingerprint ${b.report.slice(0, 12)}…` };
    const summary = armSummary(committed.report, b.arm, prediction.metric);
    if (!summary || Number.isNaN(summary.mean)) return { problem: `report ${committed.file ?? b.report.slice(0, 12)} has no summary of ${prediction.metric} for arm "${b.arm}"` };
    return { value: summary.mean, source: committed.file ?? `report ${b.report.slice(0, 12)}` };
  }
  if (!probe) return { problem: `the baseline names arm "${b.arm}" of a probe report, and a live horizon has none to read it from` };
  const summary = armSummary(probe.report, b.arm, prediction.metric);
  if (!summary || Number.isNaN(summary.mean)) return { problem: `the probe report has no summary of ${prediction.metric} for arm "${b.arm}"` };
  return { value: summary.mean, source: probe.file ?? `report ${probe.fingerprint.slice(0, 12)}` };
}

export interface ResolvePredictionsOptions {
  /** The unit that just closed or aborted: the live horizons naming its type resolve against it. */
  unit?: { unitId: string; unitType: string; status: "closed" | "aborted" };
  /** The harness's grader for a metric over that unit; undefined when nothing observes the metric. Never the unit's report. */
  measure?: (metric: string) => Promise<GraderVerdict | undefined>;
  /** The definition's committed reports, by fingerprint: what probe horizons and report baselines are read from. */
  reports?: readonly CommittedReport[];
  /** The routing policy a disconfirmed live horizon's proposal is routed under. */
  routing: RoutingPolicy;
  now?: () => number;
  /** The function resolving: the loop, S3. */
  by?: VsmSystem;
}

export interface Resolved {
  resolutions: PredictionResolution[];
  /** The proposals to S5 that disconfirmed live horizons raised. */
  proposals: PolicyProposal[];
  /** The obligations routing opened for them. */
  opened: Obligation[];
}

/**
 * Resolve what can be resolved now: every open live horizon that names the closing unit's type, once per unit, and
 * every open probe horizon whose report is among the committed ones. Each resolution is appended to the regulatory
 * log. A disconfirmed live horizon raises a plain policy-proposal from S3 to S5 — revert or re-decide the advice the
 * prediction was made about, with the prediction's id in its subject — and routes it, so the obligation is the routing
 * policy's, not this function's. Nothing here changes an advice file.
 */
export async function resolvePredictions(root: string, options: ResolvePredictionsOptions): Promise<Resolved> {
  const now = options.now ?? Date.now;
  const by = options.by ?? "S3";
  const stamp = () => new Date(now()).toISOString();
  const reports = options.reports ?? [];
  const resolved: Resolved = { resolutions: [], proposals: [], opened: [] };
  const entries = await readEntries(root);
  for (const state of foldPredictions(entries)) {
    const { prediction, signal } = state;
    for (const h of state.horizons) {
      if (h.status !== "open") continue;
      let resolution: PredictionResolution | undefined;
      if (h.horizon.kind === "live" && options.unit && h.horizon.unitTypes.includes(options.unit.unitType)) {
        const { unitId, unitType, status } = options.unit;
        if (h.resolutions.some((r) => "unit" in r.resolvedBy && r.resolvedBy.unit === unitId)) continue;
        // A grader that fails is a reading that could not be taken: inconclusive, with the failure as the reason. The unit is
        // already closed or aborted; a prediction's resolution never undoes that.
        let verdict: GraderVerdict | undefined;
        let failed: string | undefined;
        try { verdict = await options.measure?.(prediction.metric); } catch (error) { failed = (error as Error).message; }
        const base = baselineValue(prediction, reports);
        const evidence: PredictionResolution["evidence"] = [{ class: "file", ref: `.regulator/units/${unitId}`, observation: verdict ? `${verdict.grader} (${verdict.kind}): ${verdict.observation}` : failed ? `the grader failed: ${failed.split("\n")[0]}` : "no grader ran" }];
        if (base.source) evidence.push({ class: "file", ref: base.source, observation: `baseline ${base.value}` });
        const compared = verdict
          ? compareWithPrediction({ observed: verdict.value, baseline: base.value, direction: prediction.direction, magnitude: prediction.magnitude, disconfirmedBy: h.horizon.disconfirmedBy })
          : failed
            ? { outcome: "inconclusive" as const, reason: `the grader for "${prediction.metric}" failed on unit ${unitId}: ${failed.split("\n")[0]}; nothing was read, so nothing counts for the prediction` }
            : { outcome: "inconclusive" as const, reason: `no grader observes "${prediction.metric}" for unit ${unitId}; nothing was read, so nothing counts for the prediction` };
        resolution = {
          type: "prediction-resolution", id: randomUUID(), at: stamp(), by, predictionId: signal.id, horizon: h.index,
          resolvedBy: { unit: unitId, unitType, status }, metric: prediction.metric, outcome: compared.outcome,
          ...(verdict ? { observed: verdict.value, grader: verdict } : {}), ...(base.value === undefined ? {} : { baseline: base.value }),
          reason: base.problem && verdict ? `${compared.reason}. ${base.problem}` : compared.reason, evidence,
        };
        await appendEntry(root, resolution);
        resolved.resolutions.push(resolution);
        if (compared.outcome === "disconfirmed") {
          const accepted = state.proposals.find((p) => p.disposition === "accepted");
          const target = accepted ? `regulator/advice/${accepted.profile}.md` : signal.subject;
          const proposal: PolicyProposal = {
            id: randomUUID(), timestamp: resolution.at, source: "S3", kind: "policy-proposal", channel: "proposal", destination: "S5", severity: "advisory",
            subject: `prediction ${signal.id} disconfirmed at its live horizon: revert or re-decide ${target}`,
            rationale: `${prediction.metric} for unit ${unitId} (${unitType}, ${status}) read ${verdict!.value}: ${compared.reason}. The prediction staked ${prediction.metric} ${prediction.direction} by ${prediction.magnitude} at probability ${prediction.probability}${accepted ? `, and ${accepted.decidedBy} accepted proposal ${accepted.messageId.slice(0, 8)} on it` : ""}. Resolution ${resolution.id}.`,
            requestedChange: `Revert or re-decide ${target}. The live horizon the decision was made on has a disconfirming reading; the advice is not reverted by this record — an accept path is.`,
            evidence: [{ class: "file", ref: ".regulator/signals.ndjson", observation: `prediction-resolution ${resolution.id}` }, ...evidence],
          };
          await appendEntry(root, proposal);
          resolved.proposals.push(proposal);
        }
      } else if (h.horizon.kind === "probe") {
        const { report: fingerprint, arm } = h.horizon;
        const committed = reports.find((r) => r.fingerprint === fingerprint);
        if (!committed) continue;
        const summary = armSummary(committed.report, arm, prediction.metric);
        const base = baselineValue(prediction, reports, committed);
        const source = committed.file ?? `report ${fingerprint.slice(0, 12)}`;
        const evidence: PredictionResolution["evidence"] = [{ class: "file", ref: source, observation: summary ? `arm "${arm}": ${prediction.metric} mean ${summary.mean} over ${summary.n} run(s), 95% interval [${summary.ci95[0]}, ${summary.ci95[1]}]` : `arm "${arm}" has no summary of ${prediction.metric}` }];
        if (base.source && base.source !== source) evidence.push({ class: "file", ref: base.source, observation: `baseline ${base.value}` });
        const compared = summary && !Number.isNaN(summary.mean)
          ? compareWithPrediction({ observed: summary.mean, baseline: base.value, direction: prediction.direction, magnitude: prediction.magnitude, disconfirmedBy: h.horizon.disconfirmedBy, interval: summary.ci95 })
          : { outcome: "inconclusive" as const, reason: `${source} has no summary of ${prediction.metric} for arm "${arm}"; nothing was read` };
        resolution = {
          type: "prediction-resolution", id: randomUUID(), at: stamp(), by, predictionId: signal.id, horizon: h.index,
          resolvedBy: { report: fingerprint, arm }, metric: prediction.metric, outcome: compared.outcome,
          ...(summary && !Number.isNaN(summary.mean) ? { observed: summary.mean } : {}), ...(base.value === undefined ? {} : { baseline: base.value }),
          reason: base.problem && summary ? `${compared.reason}. ${base.problem}` : compared.reason, evidence,
        };
        await appendEntry(root, resolution);
        resolved.resolutions.push(resolution);
      }
    }
  }
  if (resolved.proposals.length) {
    const ids = new Set(resolved.proposals.map((p) => p.id));
    const routed = await routeMessages(new ObligationLedger(root, now), { policy: options.routing, now, by });
    resolved.opened = routed.opened.filter((o) => o.sources.some((s) => ids.has(s)));
  }
  return resolved;
}

export interface CheckHarnessEditOptions {
  /** The profiles the definition declares; the change's target must be one of them. */
  declaredProfiles?: readonly string[];
}

/**
 * The host's reading of a `harness-edit` against the stores: every diagnosis reference names a unit the execution store
 * holds, an attempt it recorded, a moment its trajectory passed through, evidence records the audit log holds for that
 * unit at that revision, and signals the regulatory log holds; and the prediction names an intelligence signal that
 * carries a prediction block. The schema has already refused a payload missing a part; this refuses one whose parts
 * point at nothing. Returns the problems, in the payload's order; empty means it resolves.
 */
export async function checkHarnessEdit(root: string, edit: HarnessEdit, options: CheckHarnessEditOptions = {}): Promise<string[]> {
  const problems: string[] = [];
  const store = new ExecutionStore(root);
  const audit = new AuditLog(root);
  const entries = await readEntries(root);
  const messages = entries.filter(isMessage);
  const obligations = foldObligations(entries);
  for (const [i, ref] of edit.diagnosis.entries()) {
    const where = `diagnosis[${i}]`;
    const unit = await store.getUnit(ref.unit);
    if (!unit) { problems.push(`${where}: unit "${ref.unit}" is not in the execution store`); continue; }
    const attempts = await store.listAttempts(ref.unit);
    if (!attempts.some((a) => a.attempt === ref.attempt)) problems.push(`${where}: unit "${ref.unit}" has no attempt ${ref.attempt} (${attempts.length} recorded)`);
    const held = await audit.forUnit(ref.unit);
    const trajectory = unitTrajectory({ unit, attempts, decisions: await store.listDecisions(ref.unit), verdicts: held.verdicts, obligations: obligations.filter((o) => o.unit === ref.unit) });
    if (!trajectory.steps.some((s) => s.transition === ref.moment)) problems.push(`${where}: unit "${ref.unit}" never passed through "${ref.moment}" (its trajectory: ${trajectory.steps.map((s) => s.transition).filter(Boolean).join(" → ") || "nothing yet"})`);
    if (!ref.evidence.length && !ref.signals.length) problems.push(`${where}: names no evidence record and no signal; a diagnosis references what was observed`);
    for (const id of ref.evidence) {
      const record = held.evidence.find((r) => r.id === id);
      if (!record) problems.push(`${where}: evidence "${id}" is not in the audit log for unit "${ref.unit}"`);
      else if (record.revision !== ref.revision) problems.push(`${where}: evidence "${id}" was read at revision ${record.revision.slice(0, 7)}, not ${ref.revision.slice(0, 7)}`);
    }
    for (const id of ref.signals) {
      const message = messages.find((m) => m.id === id);
      if (!message) problems.push(`${where}: signal "${id}" is not in the regulatory log`);
      else if (message.unit !== undefined && message.unit !== ref.unit) problems.push(`${where}: signal "${id}" is about unit "${message.unit}", not "${ref.unit}"`);
    }
  }
  if (options.declaredProfiles && !options.declaredProfiles.includes(edit.change.profile)) problems.push(`change: profile "${edit.change.profile}" is not one the definition declares (${options.declaredProfiles.join(", ") || "none"})`);
  const signal = messages.find((m) => m.id === edit.prediction);
  if (!signal) problems.push(`prediction: "${edit.prediction}" names no message in the regulatory log`);
  else if (signal.kind !== "intelligence-signal") problems.push(`prediction: "${edit.prediction}" is ${signal.kind === "policy-proposal" ? "a policy-proposal" : `an ${signal.kind}`}, not an intelligence signal`);
  else if (!signal.prediction) problems.push(`prediction: intelligence signal "${edit.prediction}" carries no prediction block (metric, baseline, direction, magnitude, probability, horizons)`);
  return problems;
}

/** The predictions the log holds, folded; a convenience over `foldPredictions` for callers with a root. */
export async function readPredictions(root: string): Promise<PredictionState[]> {
  return foldPredictions(await readEntries(root));
}

/** The live horizons a unit of this type would resolve against, if it closed now: what the loop owes the stores. */
export function openLiveHorizons(states: readonly PredictionState[], unitType: string): Array<{ state: PredictionState; horizon: HorizonState }> {
  return states.flatMap((state) => state.horizons.filter((h) => h.status === "open" && h.horizon.kind === "live" && h.horizon.unitTypes.includes(unitType)).map((horizon) => ({ state, horizon })));
}
