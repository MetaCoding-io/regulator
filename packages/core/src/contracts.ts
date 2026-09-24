/**
 * Deterministic checks on work contracts and result reports (lesson 06).
 *
 * `checkContract` decides whether a contract may be dispatched at all.
 * `checkResultReport` decides whether a report closes the loop against the
 * exact contract version. Neither judges whether the work is good — that is
 * verification (harness-run checks, lesson 09) and audit (S3*). They judge
 * whether the allocation of decisions was honoured: fixed decisions not
 * silently deviated from, delegated choices reported, unresolved decisions
 * never settled by omission.
 */
import {
  ResultReportSchema, WorkContractSchema, assertValid,
  type EvidenceClass, type ResultReport, type WorkContract,
} from "@metacoding/regulator-protocol";

export interface ContractProblem {
  /** Which part of the contract the problem is about. */
  path: string;
  message: string;
}

export function checkContract(contract: WorkContract): ContractProblem[] {
  assertValid(WorkContractSchema, contract, "work contract");
  const problems: ContractProblem[] = [];
  const ids = new Map<string, string>();
  const claim = (id: string, where: string) => {
    const previous = ids.get(id);
    if (previous) problems.push({ path: where, message: `decision id "${id}" is also used in ${previous}` });
    else ids.set(id, where);
  };
  contract.fixed.forEach((d, i) => claim(d.id, `fixed[${i}]`));
  contract.delegated.forEach((d, i) => claim(d.id, `delegated[${i}]`));
  contract.unresolved.forEach((d, i) => {
    claim(d.id, `unresolved[${i}]`);
    if (d.handling === "resolve-before-execution") {
      problems.push({
        path: `unresolved[${i}]`,
        message: `"${d.subject}" must be resolved before execution: resolve it, or reclassify it as delegated with bounds, before dispatch`,
      });
    }
  });
  const evidenceIds = new Set<string>();
  contract.expectedEvidence.forEach((e, i) => {
    if (evidenceIds.has(e.id)) problems.push({ path: `expectedEvidence[${i}]`, message: `duplicate evidence id "${e.id}"` });
    evidenceIds.add(e.id);
  });
  if (contract.provenance.predecessor && contract.provenance.predecessor.version >= contract.version) {
    problems.push({ path: "provenance.predecessor", message: "a predecessor must be an earlier version" });
  }
  return problems;
}

export interface ReportProblem {
  path: string;
  message: string;
}

/** Bind a report to a contract and check that the allocation was honoured. */
export function checkResultReport(contract: WorkContract, report: ResultReport): ReportProblem[] {
  assertValid(ResultReportSchema, report, "result report");
  const problems: ReportProblem[] = [];
  if (report.contractId !== contract.id || report.contractVersion !== contract.version) {
    problems.push({ path: "contractId", message: `report is for ${report.contractId} v${report.contractVersion}, not ${contract.id} v${contract.version}` });
    return problems;
  }
  if (report.unitId !== contract.unitId) problems.push({ path: "unitId", message: `report names unit "${report.unitId}"; the contract is for "${contract.unitId}"` });

  const delegated = new Map(contract.delegated.map((d) => [d.id, d]));
  const reportedDelegated = new Set<string>();
  report.delegatedResults.forEach((r, i) => {
    if (!delegated.has(r.decisionId)) problems.push({ path: `delegatedResults[${i}]`, message: `"${r.decisionId}" is not a delegated decision of this contract` });
    reportedDelegated.add(r.decisionId);
  });
  for (const d of contract.delegated) {
    if (d.requiredReport !== false && !reportedDelegated.has(d.id)) {
      problems.push({ path: "delegatedResults", message: `delegated decision "${d.id}" (${d.subject}) has no reported choice` });
    }
  }

  const unresolved = new Map(contract.unresolved.map((d) => [d.id, d]));
  const reportedUnresolved = new Set<string>();
  report.unresolvedOutcomes.forEach((r, i) => {
    if (!unresolved.has(r.decisionId)) problems.push({ path: `unresolvedOutcomes[${i}]`, message: `"${r.decisionId}" is not an unresolved decision of this contract` });
    reportedUnresolved.add(r.decisionId);
  });
  for (const d of contract.unresolved) {
    if (!reportedUnresolved.has(d.id)) {
      problems.push({
        path: "unresolvedOutcomes",
        message: `unresolved decision "${d.id}" (${d.subject}) is missing from the report: it was either settled silently or forgotten, and neither closes the unit`,
      });
    }
  }

  const fixed = new Set(contract.fixed.map((d) => d.id));
  report.deviations.forEach((dev, i) => {
    if (dev.kind === "fixed-decision" && (!dev.ref || !fixed.has(dev.ref))) {
      problems.push({ path: `deviations[${i}]`, message: "a fixed-decision deviation must reference the fixed decision it deviates from" });
    }
  });

  const present = new Set<EvidenceClass>(report.evidence.map((e) => e.class));
  for (const expectation of contract.expectedEvidence) {
    // An expectation that carries its own host check (lesson 14) is the host's to observe at closeout; the unit is not asked to cite it.
    if (expectation.check) continue;
    if (expectation.required && !present.has(expectation.class)) {
      problems.push({ path: "evidence", message: `required evidence "${expectation.id}" (${expectation.class}: ${expectation.description}) has no reference of that class` });
    }
  }
  return problems;
}

/** The contract as advice: what the gates cannot express, in the system prompt (level 5). */
export function renderContractSection(contract: WorkContract): string {
  const lines = [
    `# Work contract ${contract.id} v${contract.version} (unit ${contract.unitId}, type ${contract.unitType})`,
    "",
    `Objective: ${contract.objective}`,
  ];
  if (contract.contribution) lines.push(`Contribution: ${contract.contribution}`);
  if (contract.constraintRefs.length) lines.push(`Constraints in force: ${contract.constraintRefs.join(", ")}`);
  lines.push("", "FIXED — already decided; preserve these. Deviation is reported, never silent:");
  lines.push(...(contract.fixed.length ? contract.fixed.map((d) => `- ${d.id}: ${d.subject} — ${d.decision} (authority: ${d.authorityRef})`) : ["- (none)"]));
  lines.push("", "DELEGATED — yours to choose, within the bounds; report the choice you made:");
  lines.push(...(contract.delegated.length ? contract.delegated.map((d) => `- ${d.id}: ${d.subject} — bounds: ${d.bounds}`) : ["- (none)"]));
  lines.push("", "UNRESOLVED — nobody has decided. Do not settle these; preserve the boundary and surface what you learn:");
  lines.push(...(contract.unresolved.length ? contract.unresolved.map((d) => `- ${d.id}: ${d.subject} — ${d.reason} (handling: ${d.handling})`) : ["- (none)"]));
  lines.push("", "Expected evidence:");
  lines.push(...(contract.expectedEvidence.length ? contract.expectedEvidence.map((e) => `- ${e.id} [${e.class}${e.required ? ", required" : ""}]: ${e.description}`) : ["- (none)"]));
  lines.push(
    "",
    "Before you finish, call report_result exactly once. It is refused if a delegated choice is unreported, an unresolved decision is missing, or required evidence is absent — fix the report, not the contract. The contract is not yours to change.",
  );
  return lines.join("\n");
}
