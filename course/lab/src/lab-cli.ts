/**
 * `regulator` for the course lab.
 *
 *   node dist/lab-cli.js fixture <dest> [--oscillation]   copy a fixture into its own git repo
 *   node dist/lab-cli.js unit start <id> [--ttl <min>]    lease + worktree + branch (run in the base checkout)
 *   node dist/lab-cli.js unit finish <id>                 reintegrate, or surface the conflict
 *   node dist/lab-cli.js unit status                      leases and their liveness
 *   node dist/lab-cli.js contract check <file>            validate a work contract (lesson 06)
 *   node dist/lab-cli.js unit dispatch <contract.json> [--policy <file>]   run one unit through the S3 loop with a live Pi session
 *   node dist/lab-cli.js unit show <id>                   the unit record, attempts, decisions and report
 *   node dist/lab-cli.js unit drive <contract.json>       the autoloop: run, route, and run again while the policy says so (lesson 08)
 *   node dist/lab-cli.js unit route <id>                  route one blocked unit and print the decision
 *   node dist/lab-cli.js effects                          the effect journal
 */
import { hostname, userInfo } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EffectJournal, ExecutionStore, summarizeLedger } from "@metacoding/vsm-pi-core";
import { driveUnit, routeUnit, runUnit } from "./controller.js";
import { loadContract } from "./cp5-contract.js";
import { piDispatcher } from "./dispatch-pi.js";
import { realExec } from "./exec.js";
import { finishUnit, initFixture, startUnit, unitStatus } from "./unit.js";
import { POLICY_PATH, loadPolicy } from "./policy.js";
import { RECOVERY_POLICY_PATH, loadRecoveryPolicy } from "./recovery-policy.js";
import { loadWorkload } from "./workload.js";

const labRoot = fileURLToPath(new URL("../", import.meta.url));
const [command, sub, ...rest] = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const usage = () => {
  console.error("usage: regulator fixture <dest> [--oscillation] | unit start <id> [--ttl <minutes>] | unit finish <id> | unit status | contract check <file> | unit dispatch <contract.json> [--policy <file>] [--quiet] | unit drive <contract.json> [--policy <file>] [--recovery <file>] | unit route <id> | unit show <id> | effects");
  process.exit(2);
};

try {
  if (command === "fixture" && sub) {
    const source = path.join(labRoot, rest.includes("--oscillation") ? "fixture-oscillation" : "fixture");
    const dest = await initFixture(realExec, source, path.resolve(sub));
    console.log(`fixture ready at ${dest} (git repo, one commit, on main)`);
  } else if (command === "unit" && sub === "start" && rest[0]) {
    const unitId = rest[0];
    const ttlMs = flag("ttl") ? Number(flag("ttl")) * 60_000 : undefined;
    const owner = `${userInfo().username}@${hostname()}`;
    const started = await startUnit(realExec, ttlMs ? { repo: process.cwd(), unitId, owner, ttlMs } : { repo: process.cwd(), unitId, owner });
    console.log(`unit ${unitId}: branch ${started.worktree.branch} from ${started.base}, worktree ${started.worktree.path}`);
    console.log(`lease held by ${started.lease.owner} until ${new Date(started.lease.expiresAt).toISOString()}`);
    console.log(`next: cd ${started.worktree.path} && pi -e ${path.join(labRoot, "dist/cp2-typed-tools.js")} -e ${path.join(labRoot, "dist/cp4-coordination.js")} --unit ${unitId}`);
  } else if (command === "unit" && sub === "finish" && rest[0]) {
    const finished = await finishUnit(realExec, { repo: process.cwd(), unitId: rest[0] });
    if (finished.result.merged) {
      console.log(`unit ${rest[0]}: reintegrated as ${finished.result.sha}; worktree and branch removed; lease ${finished.released ? "released" : "was not held"}`);
    } else if (finished.result.reason === "conflict") {
      console.error(`unit ${rest[0]}: conflict in ${finished.result.conflicts.join(", ")} — merge aborted, nothing resolved, coordination signal recorded in .regulator/signals.ndjson`);
      process.exit(1);
    } else {
      console.error(`unit ${rest[0]}: not reintegrated (${finished.result.reason}${"current" in finished.result ? `: on ${finished.result.current}` : ""})`);
      process.exit(1);
    }
  } else if (command === "contract" && sub === "check" && rest[0]) {
    const contract = await loadContract(path.resolve(rest[0]));
    console.log(`contract ${contract.id} v${contract.version} for unit ${contract.unitId} (${contract.unitType}): ${contract.fixed.length} fixed, ${contract.delegated.length} delegated, ${contract.unresolved.length} unresolved; dispatchable`);
  } else if (command === "unit" && sub === "dispatch" && rest[0]) {
    const contract = await loadContract(path.resolve(rest[0]));
    const workload = await loadWorkload();
    const policyPath = path.resolve(flag("policy") ?? POLICY_PATH);
    const policy = await loadPolicy(policyPath);
    const owner = `${userInfo().username}@${hostname()}`;
    console.log(`dispatching unit ${contract.unitId} under ${contract.id} v${contract.version} (${contract.unitType}); policy ${policy.name} v${policy.version}`);
    const outcome = await runUnit(realExec, { repo: process.cwd(), contract, workload, policy, policyPath, owner, dispatcher: piDispatcher({ echo: !rest.includes("--quiet") }) });
    if (outcome.status === "closed") {
      console.log(`unit ${contract.unitId}: closed; reintegrated as ${outcome.sha}; ${outcome.signals} signal(s) for S3`);
    } else if (outcome.status === "refused") {
      for (const problem of outcome.problems) console.error(`✖ ${problem.path}: ${problem.message}`);
      console.error(`unit ${contract.unitId}: contract refused; nothing was dispatched`);
      process.exit(1);
    } else {
      for (const problem of outcome.problems ?? []) console.error(`✖ ${problem.path}: ${problem.message}`);
      console.error(`unit ${contract.unitId}: blocked (${outcome.reason})${outcome.detail ? ` — ${outcome.detail}` : ""}; see \`regulator unit show ${contract.unitId}\``);
      process.exit(1);
    }
  } else if (command === "unit" && sub === "drive" && rest[0]) {
    const contract = await loadContract(path.resolve(rest[0]));
    const workload = await loadWorkload();
    const policyPath = path.resolve(flag("policy") ?? POLICY_PATH);
    const policy = await loadPolicy(policyPath);
    const recovery = await loadRecoveryPolicy(path.resolve(flag("recovery") ?? RECOVERY_POLICY_PATH));
    const owner = `${userInfo().username}@${hostname()}`;
    console.log(`driving unit ${contract.unitId} under ${contract.id} v${contract.version}; budgets ${policy.name} v${policy.version}, recovery ${recovery.name} v${recovery.version}`);
    const { final, decisions } = await driveUnit(realExec, { repo: process.cwd(), contract, workload, policy, policyPath, recovery, owner, dispatcher: piDispatcher({ echo: !rest.includes("--quiet") }) });
    for (const d of decisions) console.log(`  attempt ${d.attempt}: ${d.cause} → ${d.action} (${d.policy.name} v${d.policy.version}, occurrence ${d.occurrence})${d.question ? `\n    question: ${d.question}` : ""}`);
    if (final.status === "closed") console.log(`unit ${contract.unitId}: closed; reintegrated as ${final.sha}`);
    else if (final.status === "refused") { for (const p of final.problems) console.error(`✖ ${p.path}: ${p.message}`); process.exit(1); }
    else { console.error(`unit ${contract.unitId}: ${(await new ExecutionStore(process.cwd()).getUnit(contract.unitId))?.reason ?? final.reason}`); process.exit(1); }
  } else if (command === "unit" && sub === "route" && rest[0]) {
    const policy = await loadPolicy(path.resolve(flag("policy") ?? POLICY_PATH));
    const recovery = await loadRecoveryPolicy(path.resolve(flag("recovery") ?? RECOVERY_POLICY_PATH));
    const decision = await routeUnit(realExec, { repo: process.cwd(), unitId: rest[0], policy, recovery });
    if (!decision) { console.log(`unit ${rest[0]} is not blocked; nothing to route`); }
    else {
      console.log(`unit ${rest[0]}: ${decision.cause} (occurrence ${decision.occurrence}) → ${decision.action} under ${decision.policy.name} v${decision.policy.version}`);
      console.log(`  ${decision.rationale}`);
      for (const e of decision.evidence) console.log(`  evidence: ${e}`);
      if (decision.hint) console.log(`  hint for the next attempt: ${decision.hint}`);
      if (decision.question) console.log(`  question: ${decision.question}`);
    }
  } else if (command === "effects") {
    const states = await new EffectJournal(process.cwd()).states();
    if (!states.length) console.log("no effects journaled");
    for (const s of states) console.log(`${s.status.padEnd(9)} ${s.key}  ${s.tool}  ${s.unitId ?? "-"}  ${s.intendedAt}  ${s.description}${s.result ? ` — ${s.result}` : ""}`);
  } else if (command === "unit" && sub === "show" && rest[0]) {
    const store = new ExecutionStore(process.cwd());
    const unit = await store.getUnit(rest[0]);
    if (!unit) throw new Error(`no unit "${rest[0]}" in ${store.dir}`);
    console.log(`${unit.status.padEnd(10)} ${unit.unitId}  ${unit.unitType}  contract ${unit.contract.id} v${unit.contract.version}  attempts ${unit.attempts}${unit.reason ? `  — ${unit.reason}` : ""}`);
    for (const attempt of await store.listAttempts(unit.unitId)) {
      const ledger = await store.getBudget(unit.unitId, attempt.attempt);
      console.log(`  attempt ${attempt.attempt}: ${attempt.outcome}${attempt.detail ? ` — ${attempt.detail}` : ""}${ledger ? `\n    budget: ${summarizeLedger(ledger)}; models: ${ledger.models.join(" → ") || "—"}; compactions: ${ledger.compactions.length}` : ""}`);
    }
    for (const d of await store.listDecisions(unit.unitId)) console.log(`  decision after attempt ${d.attempt}: ${d.cause} → ${d.action} (${d.policy.name} v${d.policy.version}, occurrence ${d.occurrence})`);
    const report = await store.getReport(unit.unitId, unit.contract.version);
    console.log(report ? `  report: ${report.summary}` : "  report: none");
  } else if (command === "unit" && sub === "status") {
    const statuses = await unitStatus(realExec, process.cwd());
    if (statuses.length === 0) console.log("no leases");
    for (const { lease, live } of statuses) {
      console.log(`${live ? "live   " : "expired"} ${lease.unitId}  ${lease.owner}  ${lease.branch}  until ${new Date(lease.expiresAt).toISOString()}`);
    }
  } else {
    usage();
  }
} catch (error) {
  console.error(`regulator: ${(error as Error).message}`);
  process.exit(1);
}
