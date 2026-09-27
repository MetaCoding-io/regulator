#!/usr/bin/env node
/**
 * `regulator` — the control plane's CLI. The usage table below is the source of the CLI reference in `docs/`.
 *
 * Instance
 *   regulator init [<dir>] [--writable a/,b/] [--protected x/] [--by <who>]   install the definition into an existing repository:
 *                                                         identity seeded and committed, .regulator/ ignored, canaries recorded, the instance manifest written
 *   regulator doctor [--json] [--today <date>]   the operating check: runtime, git, the Pi pin, the definition, review dates, the instance; exit 1 on a problem
 *   regulator status [--definition <dir>] [--instance <dir>] [--json]   a read-only projection of the definition and the instance (what the control room renders)
 *   regulator check [--today <date>]   validate the registry and the rest of the definition; exit 1 on a problem or an overdue review date
 *   regulator docs [--write | --check]   render REGULATORS.md and BOUNDARY.md from the registry records
 *   regulator watch [--once] [--interval <ms>] [--exec <cmd> [args…]]   the outbox watcher: deliver, remind, forward each new line to a channel command
 *   regulator fixture <dest> [--oscillation | --injection | --finance]   copy a fixture into its own git repo (identity seeded, canaries recorded)
 *
 * Units
 *   regulator unit drive <contract.json> [--policy <file>] [--recovery <file>] [--routing <file>]   the autoloop: run, route, and run again while the policy says so
 *   regulator unit dispatch <contract.json> [--policy <file>] [--routing <file>] [--host <package>] [--quiet]   run one unit through the S3 loop with a live host session
 *   regulator unit start <id> [--type <unitType>] [--workload <name>] [--ttl <min>]   lease + worktree + branch by hand (run in the base checkout)
 *   regulator unit finish <id>                 reintegrate a unit started by hand, or surface the conflict
 *   regulator unit status                      leases and their liveness
 *   regulator unit show <id>                   the unit record, attempts, decisions, report and obligations
 *   regulator unit route <id>                  route one blocked unit under the recovery policy and print the decision
 *   regulator unit close <id>                  re-audit a blocked unit without an attempt and close it if the verdict is pass
 *   regulator unit accept <id> <criterion> --by <who> [--reject] [--note <text>]   a human disposition of a criterion no check can observe
 *   regulator unit evidence <id>               replay the unit's audit log: evidence, verdicts, acceptances
 *   regulator contract check <file>            validate a work contract against the schema and the workload
 *
 * Obligations
 *   regulator obligations [--all]              what is owed and to whom; --all includes closed ones
 *   regulator obligation show <id>             one obligation with its history (id or unique prefix)
 *   regulator obligation ack <id> --by <who> [--note <text>]   acknowledge without resolving
 *   regulator obligation resolve <id> --by <who> --disposition <d> --rationale <text>   close it: no-action, accepted-risk, rework, replan, fixed, verified, rejected, research-requested, audit-requested, policy-clarification-requested
 *   regulator obligation escalate <id> --by <who> --to <consumer> --rationale <text>   hand it to another consumer; the successor inherits the veto
 *   regulator answer <obligation> --by <who> --answer <text>   answer a question a unit asked: recorded as the person's disposition; the next attempt carries it
 *   regulator remind                           deliver again every obligation owed to a person that has waited longer than the policy's reminder interval
 *   regulator signals route                    route every unrouted message under the routing policy (for sessions run by hand)
 *
 * Identity and memory
 *   regulator identity accept <obligation> --by <who> --file <IDENTITY|INVARIANTS|GLOSSARY|BOUNDARIES>.md --from <path> --rationale <text>
 *                                                         the S5 decision: write the proposed file into regulator/identity/ under S5 authority,
 *                                                         commit it on the base branch citing the obligation, and resolve the obligation as accepted
 *   regulator identity reject <obligation> --by <who> --rationale <text>   decline a proposal owed to S5
 *   regulator identity promote <IDENTITY|INVARIANTS|GLOSSARY|BOUNDARIES>.md --by <who> --rationale <text>
 *                                                         the release path: copy the instance's accepted identity file into the definition's seed and commit it there
 *   regulator memory [--all]                   operational memory: current facts; --all includes expired and retracted
 *   regulator memory retract <id> --by <who> --reason <text>   retract a fact; the retraction is appended, nothing is deleted
 *
 * Evidence
 *   regulator effects                          the effect journal: every side-effecting tool call, its outcome and its reconciliation
 *   regulator spans [--json]                   the instance's records as OpenTelemetry GenAI spans, redacted (NDJSON with --json)
 *   regulator eval <suite.json> [--behaviour <reference|drifter|sloppy|self-certifier>] [--arm <name>]... [--reps <n>] [--out <file>]
 *                                 [--interpretation <file>] [--by <who>] [--keep]   run a suite: scripted units headlessly, or live units through the host's dispatcher
 *   regulator review [--due] [--within <days>]   the registry's review dates; --due lists what is overdue or due within the window
 *
 * Every `--by` that dispositions something is checked against the interaction policy's people: a name not listed may
 * disposition nothing, and what a listed person may do (severity, accepted-risk, S5) is declared there. `init`,
 * `unit accept` and `eval` record `--by` as provenance without the check. The name itself is asserted, not authenticated.
 * `regulator check` and `regulator docs` (the definition check and the generated registry documents) are implemented in
 * `registry-cli.ts` and reached through this entry point.
 */
import { hostname, userInfo } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { summarizeVerdict } from "@metacoding.io/regulator-checks";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { AuditLog, EffectJournal, ExecutionStore, IDENTITY_FILES, MemoryStore, ObligationLedger, authorizeWrite, checkDispositionAuthority, dispositionForAnswer, formatSummary, loadRegistry, readIdentity, routeMessages, summarizeLedger } from "@metacoding.io/regulator-core";
import { ConsumerSchema, DispositionSchema, UNINTERPRETED_BY, UNINTERPRETED_MARKER, assertValid, type Disposition, type ObligationState, type Severity } from "@metacoding.io/regulator-protocol";
import { deliverPending, remindDue, watchOutbox } from "./deliver.js";
import { doctor, initInstance, readManifest } from "./instance.js";
import { readStatus, renderStatusText } from "./status.js";
import { INTERACTION_POLICY_PATH, loadInteractionPolicy } from "./interaction-policy.js";
import { REPORTS_DIR, ablationCoverage, loadSuite, runSuite } from "./evals.js";
import { loadHost } from "./host.js";
import { isBehaviour, scriptedDispatchers } from "./evals-scripted.js";
import { closeUnit, driveUnit, routeUnit, runUnit } from "./controller.js";
import { loadContract } from "./contract-file.js";
import { realExec } from "./exec.js";
import { IDENTITY_RELATIVE_DIR, finishUnit, initFixture, startUnit, unitStatus } from "./unit.js";
import { currentBranch, headRevision, isClean } from "./worktree.js";
import { POLICY_PATH, loadPolicy } from "./policy.js";
import { RECOVERY_POLICY_PATH, loadRecoveryPolicy } from "./recovery-policy.js";
import { ROUTING_POLICY_PATH, loadRoutingPolicy } from "./routing-policy.js";
import { loadWorkloadFor } from "./workload.js";

const labRoot = fileURLToPath(new URL("../", import.meta.url));
const [command, sub, ...rest] = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const usage = () => {
  console.error("usage: regulator status [--definition <dir>] [--instance <dir>] [--json] | fixture <dest> [--oscillation | --injection | --finance] | unit start <id> [--type <unitType>] [--workload <name>] [--ttl <minutes>] | unit finish <id> | unit status | contract check <file> | unit dispatch <contract.json> [--policy <file>] [--routing <file>] [--host <package>] [--quiet] | unit drive <contract.json> [--policy <file>] [--recovery <file>] [--routing <file>] | unit route <id> | unit show <id> | unit close <id> | unit accept <id> <criterion> --by <who> [--reject] [--note <text>] | unit evidence <id> | effects | obligations [--all] | obligation show <id> | obligation ack <id> --by <who> [--note <text>] | obligation resolve <id> --by <who> --disposition <d> --rationale <text> | obligation escalate <id> --by <who> --to <consumer> --rationale <text> | signals route | memory [--all] | memory retract <id> --by <who> --reason <text> | identity accept <obligation> --by <who> --file <name>.md --from <path> --rationale <text> | identity reject <obligation> --by <who> --rationale <text> | answer <obligation> --by <who> --answer <text> | remind | init [<dir>] [--writable a/,b/] [--protected x/] [--by <who>] | doctor [--json] [--today <date>] | watch [--once] [--interval <ms>] [--exec <cmd>...] | identity promote <file>.md --by <who> --rationale <text> | eval <suite.json> [--behaviour <name>] [--arm <name>] [--reps <n>] [--out <file>] [--interpretation <file>] [--by <who>] [--keep] | spans [--json] | review [--due] [--within <days>] | check [--today <date>] | docs [--write | --check]");
  process.exit(2);
};
const routingP = () => loadRoutingPolicy(path.resolve(flag("routing") ?? ROUTING_POLICY_PATH));
const interactionP = () => loadInteractionPolicy(path.resolve(flag("interaction") ?? INTERACTION_POLICY_PATH));
/** Who may disposition what: the interaction policy's people. Refuses before anything is written. */
async function authorized(by: string | undefined, ask: { severity: Severity; disposition?: Disposition; s5?: boolean }): Promise<string> {
  if (!by) usage();
  const problem = checkDispositionAuthority(await interactionP(), by!, ask);
  if (problem) throw new Error(problem);
  return by!;
}
const regulatorsP = async () => (await loadRegistry(path.join(labRoot, "registry"))).records.map((r) => r.id);

function describe(o: ObligationState): string {
  const delivered = o.deliveries.length ? `  delivered ×${o.deliveries.length} (${o.deliveries.at(-1)!.channel} ${o.deliveries.at(-1)!.at.slice(0, 16)})` : (o.consumer === "human" && (o.status === "open" || o.status === "acknowledged") ? "  not delivered" : "");
  return `${o.status.padEnd(12)} ${o.consumer.padEnd(5)} ${o.severity.padEnd(8)} ${o.blocks ? "veto " : "     "} ${o.id.slice(0, 8)}  ${o.concern}  ${o.subject}${o.unit ? `  (unit ${o.unit})` : ""}${delivered}${o.question ? `\n      question: ${o.question}` : ""}${o.disposition ? `\n      ${o.disposition} by ${o.closedBy}: ${o.rationale}` : o.successor ? `\n      ${o.status} by ${o.closedBy} → ${o.successor.slice(0, 8)}: ${o.rationale}` : ""}`;
}

async function findObligation(ledger: ObligationLedger, ref: string): Promise<ObligationState> {
  const matches = (await ledger.obligations()).filter((o) => o.id === ref || o.id.startsWith(ref));
  if (matches.length === 1) return matches[0]!;
  throw new Error(matches.length ? `"${ref}" matches ${matches.length} obligations; give more of the id` : `no obligation "${ref}"`);
}

try {
  if (command === "init") {
    const dir = sub && !sub.startsWith("--") ? path.resolve(sub) : process.cwd();
    const args = [sub, ...rest].filter((a): a is string => a !== undefined);
    const initFlag = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
    const split = (v: string | undefined) => (v ? v.split(",").map((p) => p.trim()).filter(Boolean) : undefined);
    const writablePaths = split(initFlag("writable"));
    const protectedPaths = split(initFlag("protected"));
    const by = initFlag("by") ?? `${userInfo().username}@${hostname()}`;
    const result = await initInstance(realExec, { repo: dir, by, ...(writablePaths ? { writablePaths } : {}), ...(protectedPaths ? { protectedPaths } : {}), ...(initFlag("definition") ? { definitionRoot: path.resolve(initFlag("definition")!) } : {}) });
    const m = result.manifest;
    console.log(`instance ready at ${dir}: definition ${m.definition.name} at ${m.definition.harnessRevision.slice(0, 7)} (${m.definition.registry} regulators, pi ${m.definition.pi}), initialized by ${m.initializedBy}`);
    console.log(`  writes ${m.writablePaths ? `under ${m.writablePaths.join(", ")} (declared)` : "under the profile's own prefixes"}; protected ${[IDENTITY_RELATIVE_DIR, ...(m.protectedPaths ?? [])].join(", ")} and whatever the conventions discover; ${result.canaries} canar${result.canaries === 1 ? "y" : "ies"}`);
    console.log(result.committed ? `  committed ${result.committed.slice(0, 7)} on the base branch (identity seeded, .regulator/ ignored)` : "  nothing to commit: identity and ignore line were already there");
    console.log("  next: `regulator doctor`, then `regulator unit drive <contract.json>`");
  } else if (command === "status") {
    // A read-only projection of a definition and an instance. There is no subcommand that changes anything, and that
    // is deliberate: the moment this grows a "raise budget" flag it has become an authority surface.
    const args = [sub, ...rest].filter((a): a is string => a !== undefined);
    const statusFlag = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
    const definitionDir = statusFlag("definition");
    const instanceDir = statusFlag("instance") ?? (definitionDir ? undefined : process.cwd());
    const view = await readStatus({ ...(definitionDir === undefined ? {} : { definitionDir }), ...(instanceDir === undefined ? {} : { instanceDir }) });
    if (args.includes("--json")) process.stdout.write(`${JSON.stringify(view, null, 2)}\n`);
    else process.stdout.write(renderStatusText(view));
  } else if (command === "doctor") {
    const manifestHere = await readManifest(process.cwd()).catch(() => undefined);
    const report = await doctor(realExec, { ...(manifestHere || sub === "--instance" || rest.includes("--instance") ? { repo: process.cwd() } : {}), ...(flag("today") ? { today: flag("today")! } : {}), ...(flag("definition") ? { definitionRoot: path.resolve(flag("definition")!) } : {}) });
    if (rest.includes("--json") || sub === "--json") console.log(JSON.stringify(report, null, 2));
    else {
      for (const c of report.checks) console.log(`${c.ok ? "ok      " : "PROBLEM "} ${c.name.padEnd(17)} ${c.detail}`);
      console.log(`${report.problems} problem(s)`);
    }
    process.exit(report.problems ? 1 : 0);
  } else if (command === "watch") {
    const execAt = rest.indexOf("--exec");
    const execCmd = execAt >= 0 ? rest.slice(execAt + 1) : sub === "--exec" ? rest : undefined;
    const once = rest.includes("--once") || sub === "--once";
    const intervalMs = flag("interval") ? Number(flag("interval")) : undefined;
    const ticks = await watchOutbox(process.cwd(), {
      policy: await interactionP(), once, ...(intervalMs === undefined ? {} : { intervalMs }), ...(execCmd?.length ? { exec: execCmd.filter((a) => a !== "--once") } : {}),
      onTick: (t) => console.log(`${t.at}  delivered ${t.delivered}, reminded ${t.reminded}, forwarded ${t.forwarded}${t.failed ? `, FAILED ${t.failed} (cursor not advanced)` : ""}`),
    });
    if (once && ticks.some((t) => t.failed)) process.exit(1);
  } else if (command === "identity" && sub === "promote" && rest[0]) {
    // The release path (lesson 15): an instance's accepted identity file becomes the definition's seed, committed in the definition's repository.
    const file = rest[0];
    const rationale = flag("rationale");
    if (!rationale || !(IDENTITY_FILES as readonly string[]).includes(file)) { console.error(`identity promote needs one of ${IDENTITY_FILES.join(", ")} and --rationale`); usage(); }
    const by = await authorized(flag("by"), { severity: "blocking", s5: true });
    const repo = process.cwd();
    const manifest = await readManifest(repo);
    const definitionRoot = flag("definition") ? path.resolve(flag("definition")!) : manifest?.definition.root ?? labRoot;
    const instanceFile = path.join(repo, IDENTITY_RELATIVE_DIR, file);
    const seedFile = path.join(definitionRoot, "identity", file);
    if (!(await isClean(realExec, definitionRoot))) throw new Error(`the definition at ${definitionRoot} has uncommitted changes; a promotion is committed on its own`);
    const content = await readFile(instanceFile, "utf8");
    if (content === (await readFile(seedFile, "utf8").catch(() => ""))) throw new Error(`${file} in this instance is identical to the definition's seed; nothing to promote`);
    const decision = authorizeWrite(path.posix.join(IDENTITY_RELATIVE_DIR, file), "s5-authority");
    if (!decision.allowed) throw new Error(decision.reason ?? "refused");
    const { readIdentity: readSet } = await import("@metacoding.io/regulator-core");
    const { mkdtemp, cp, rm } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const trial = await mkdtemp(path.join(tmpdir(), "regulator-promote-"));
    try {
      await cp(path.join(definitionRoot, "identity"), trial, { recursive: true });
      await writeFile(path.join(trial, file), content, "utf8");
      const set = await readSet(trial);
      if (set.problems.length) throw new Error(`promoting ${file} would leave the definition's identity invalid (${set.problems.join("; ")}); nothing changed`);
    } finally {
      await rm(trial, { recursive: true, force: true });
    }
    await writeFile(seedFile, content, "utf8");
    const instanceRev = await headRevision(realExec, repo).catch(() => "unknown");
    for (const args of [["add", "--", path.relative(definitionRoot, seedFile)], ["-c", "commit.gpgsign=false", "commit", "-q", "-m", `S5: promote ${file} from instance ${path.basename(repo)}@${instanceRev.slice(0, 7)} into the definition

Decided by ${by} under S5 authority.
${rationale}`]]) {
      const r = await realExec("git", args, { cwd: definitionRoot });
      if (r.code !== 0) throw new Error(`git ${args[0]} failed in the definition: ${r.stderr.trim()}`);
    }
    const sha = await headRevision(realExec, definitionRoot);
    console.log(`${file} promoted by ${by} (S5): the definition's seed at ${definitionRoot} now carries this instance's file, committed as ${sha.slice(0, 7)}; every instance initialized from now on starts from it`);
  } else if (command === "fixture" && sub) {
    const source = path.join(labRoot, rest.includes("--oscillation") ? "fixture-oscillation" : rest.includes("--injection") ? "fixture-injection" : rest.includes("--finance") ? "fixture-finance" : "fixture");
    const dest = await initFixture(realExec, source, path.resolve(sub));
    console.log(`fixture ready at ${dest} (git repo, one commit, on main; identity seeded at regulator/identity/)`);
  } else if (command === "unit" && sub === "start" && rest[0]) {
    const unitId = rest[0];
    // A unit started here runs without a contract (lesson 05). A unit type that requires one is refused: dispatch it under
    // a contract instead. The type is looked up in the named workload (the software workload by default).
    if (flag("type")) {
      const workload = await loadWorkloadFor(flag("workload") ?? "software-development");
      const type = workload.unitTypes.find((t) => t.name === flag("type"));
      if (!type) { console.error(`unit type "${flag("type")}" is not a unit type of workload ${workload.name}`); process.exit(1); }
      if (type.requiresContract) { console.error(`unit type "${type.name}" requires a contract: dispatch it with \`regulator unit dispatch <contract.json>\` instead of starting it bare`); process.exit(1); }
    }
    const ttlMs = flag("ttl") ? Number(flag("ttl")) * 60_000 : undefined;
    const owner = `${userInfo().username}@${hostname()}`;
    const started = await startUnit(realExec, ttlMs ? { repo: process.cwd(), unitId, owner, ttlMs } : { repo: process.cwd(), unitId, owner });
    console.log(`unit ${unitId}: branch ${started.worktree.branch} from ${started.base}, worktree ${started.worktree.path}`);
    console.log(`lease held by ${started.lease.owner} until ${new Date(started.lease.expiresAt).toISOString()}`);
    console.log(`next: cd ${started.worktree.path} && pi -e ${path.join(labRoot, "dist/tools.js")} -e ${path.join(labRoot, "dist/coordination.js")} --unit ${unitId}`);
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
    const workload = await loadWorkloadFor(contract.workload.name);
    const policyPath = path.resolve(flag("policy") ?? POLICY_PATH);
    const policy = await loadPolicy(policyPath);
    const routing = await routingP();
    const owner = `${userInfo().username}@${hostname()}`;
    console.log(`dispatching unit ${contract.unitId} under ${contract.id} v${contract.version} (${contract.unitType}); policy ${policy.name} v${policy.version}; routing ${routing.name} v${routing.version}`);
    const outcome = await runUnit(realExec, { repo: process.cwd(), contract, workload, policy, policyPath, routing, interaction: await interactionP(), regulators: await regulatorsP(), owner, dispatcher: (await loadHost(flag("host"))).host.dispatcher({ echo: !rest.includes("--quiet") }) });
    if (outcome.status === "closed") {
      console.log(`unit ${contract.unitId}: closed; reintegrated as ${outcome.sha}; ${outcome.signals} signal(s) for S3 — see \`regulator obligations\``);
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
    const workload = await loadWorkloadFor(contract.workload.name);
    const policyPath = path.resolve(flag("policy") ?? POLICY_PATH);
    const policy = await loadPolicy(policyPath);
    const recovery = await loadRecoveryPolicy(path.resolve(flag("recovery") ?? RECOVERY_POLICY_PATH));
    const routing = await routingP();
    const owner = `${userInfo().username}@${hostname()}`;
    console.log(`driving unit ${contract.unitId} under ${contract.id} v${contract.version}; budgets ${policy.name} v${policy.version}, recovery ${recovery.name} v${recovery.version}, routing ${routing.name} v${routing.version}`);
    const { final, decisions } = await driveUnit(realExec, { repo: process.cwd(), contract, workload, policy, policyPath, recovery, routing, interaction: await interactionP(), regulators: await regulatorsP(), owner, dispatcher: (await loadHost(flag("host"))).host.dispatcher({ echo: !rest.includes("--quiet") }) });
    for (const d of decisions) console.log(`  attempt ${d.attempt}: ${d.cause} → ${d.action} (${d.policy.name} v${d.policy.version}, occurrence ${d.occurrence})${d.question ? `\n    question: ${d.question}` : ""}`);
    if (final.status === "closed") console.log(`unit ${contract.unitId}: closed; reintegrated as ${final.sha}`);
    else if (final.status === "refused") { for (const p of final.problems) console.error(`✖ ${p.path}: ${p.message}`); process.exit(1); }
    else {
      console.error(`unit ${contract.unitId}: ${(await new ExecutionStore(process.cwd()).getUnit(contract.unitId))?.reason ?? final.reason}`);
      for (const o of await new ObligationLedger(process.cwd()).open(contract.unitId)) console.error(`  owed: ${describe(o)}`);
      process.exit(1);
    }
  } else if (command === "unit" && sub === "route" && rest[0]) {
    const policy = await loadPolicy(path.resolve(flag("policy") ?? POLICY_PATH));
    const recovery = await loadRecoveryPolicy(path.resolve(flag("recovery") ?? RECOVERY_POLICY_PATH));
    const decision = await routeUnit(realExec, { repo: process.cwd(), unitId: rest[0], policy, recovery, routing: await routingP(), interaction: await interactionP() });
    if (!decision) { console.log(`unit ${rest[0]} is not blocked; nothing to route`); }
    else {
      console.log(`unit ${rest[0]}: ${decision.cause} (occurrence ${decision.occurrence}) → ${decision.action} under ${decision.policy.name} v${decision.policy.version}`);
      console.log(`  ${decision.rationale}`);
      for (const e of decision.evidence) console.log(`  evidence: ${e}`);
      if (decision.hint) console.log(`  hint for the next attempt: ${decision.hint}`);
      if (decision.question) console.log(`  question: ${decision.question}`);
      for (const o of await new ObligationLedger(process.cwd()).open(rest[0])) console.log(`  owed: ${describe(o)}`);
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
    console.log(report ? `  report (attempt ${report.attempt}): ${report.summary}` : "  report: none");
    const verdict = (await new AuditLog(process.cwd()).forUnit(unit.unitId)).verdicts.at(-1);
    console.log(verdict ? `  audit: ${summarizeVerdict(verdict)}${verdict.reasons.length ? `\n    ${verdict.reasons.join("\n    ")}` : ""}` : "  audit: no verdict");
    const owed = (await new ObligationLedger(process.cwd()).obligations()).filter((o) => o.unit === unit.unitId);
    console.log(owed.length ? `  obligations:` : "  obligations: none");
    for (const o of owed) console.log(`    ${describe(o)}`);
  } else if (command === "unit" && sub === "close" && rest[0]) {
    const closing = await new ExecutionStore(process.cwd()).getUnit(rest[0]);
    if (!closing) throw new Error(`no unit "${rest[0]}"`);
    const outcome = await closeUnit(realExec, { repo: process.cwd(), unitId: rest[0], workload: await loadWorkloadFor(closing.workload.name), routing: await routingP(), interaction: await interactionP() });
    if (outcome.status === "closed") console.log(`unit ${rest[0]}: closed; reintegrated as ${outcome.sha}; ${outcome.signals} signal(s) for S3`);
    else if (outcome.status === "refused") { for (const p of outcome.problems) console.error(`✖ ${p.path}: ${p.message}`); process.exit(1); }
    else { console.error(`unit ${rest[0]}: blocked (${outcome.reason})${outcome.detail ? ` — ${outcome.detail}` : ""}${outcome.verdict ? `\n  ${outcome.verdict.reasons.join("\n  ")}` : ""}`); process.exit(1); }
  } else if (command === "unit" && sub === "accept" && rest[0] && rest[1]) {
    const by = flag("by");
    if (!by) usage();
    const store = new ExecutionStore(process.cwd());
    const unit = await store.getUnit(rest[0]);
    if (!unit) throw new Error(`no unit "${rest[0]}"`);
    const contract = await store.getContract(unit.unitId, unit.contract.version);
    if (!contract?.expectedEvidence.some((e) => e.id === rest[1])) throw new Error(`"${rest[1]}" is not an evidence expectation of ${unit.contract.id} v${unit.contract.version}`);
    const revision = await headRevision(realExec, path.join(process.cwd(), ".regulator", "worktrees", unit.unitId));
    const note = flag("note");
    const acceptance = {
      id: randomUUID(), unitId: unit.unitId, contract: unit.contract, criterion: rest[1], revision,
      disposition: rest.includes("--reject") ? "rejected" as const : "accepted" as const, by: by!, ...(note ? { note } : {}), at: new Date().toISOString(),
    };
    await new AuditLog(process.cwd()).appendAcceptance(acceptance);
    console.log(`unit ${unit.unitId}: ${acceptance.criterion} ${acceptance.disposition} by ${acceptance.by} at revision ${revision.slice(0, 7)}; run \`regulator unit close ${unit.unitId}\` to re-audit`);
  } else if (command === "unit" && sub === "evidence" && rest[0]) {
    const audit = await new AuditLog(process.cwd()).forUnit(rest[0]);
    if (!audit.evidence.length && !audit.verdicts.length && !audit.acceptances.length) console.log(`no audit entries for unit ${rest[0]}`);
    for (const r of audit.evidence) console.log(`evidence   ${r.verdict.padEnd(12)} attempt ${r.attempt}  ${r.revision.slice(0, 7)}  ${r.check}  [${r.class} → ${r.criteria.join(", ") || "no criterion"}]  ${r.observation.split("\n")[0]}`);
    for (const a of audit.acceptances) console.log(`acceptance ${a.disposition.padEnd(12)} ${a.criterion}  ${a.revision.slice(0, 7)}  by ${a.by}${a.note ? ` — ${a.note}` : ""}`);
    for (const v of audit.verdicts) console.log(`verdict    ${v.verdict.padEnd(12)} attempt ${v.attempt}  ${summarizeVerdict(v)}  (${v.evidence.length} record(s) considered)${v.reasons.length ? `\n    ${v.reasons.join("\n    ")}` : ""}`);
  } else if (command === "unit" && sub === "status") {
    const statuses = await unitStatus(realExec, process.cwd());
    if (statuses.length === 0) console.log("no leases");
    for (const { lease, live } of statuses) {
      console.log(`${live ? "live   " : "expired"} ${lease.unitId}  ${lease.owner}  ${lease.branch}  until ${new Date(lease.expiresAt).toISOString()}`);
    }
  } else if (command === "obligations") {
    const ledger = new ObligationLedger(process.cwd());
    const all = await ledger.obligations();
    const shown = sub === "--all" || rest.includes("--all") ? all : all.filter((o) => o.status === "open" || o.status === "acknowledged");
    const unrouted = await ledger.unrouted();
    if (!shown.length) console.log(all.length ? "nothing open; --all shows what was dispositioned" : "no obligations");
    for (const o of shown) console.log(describe(o));
    console.log(`${shown.length} shown of ${all.length}; ${unrouted.length} unrouted message(s)${unrouted.length ? " — run `regulator signals route`" : ""}`);
  } else if (command === "obligation" && sub === "show" && rest[0]) {
    const ledger = new ObligationLedger(process.cwd());
    const o = await findObligation(ledger, rest[0]);
    console.log(describe(o));
    console.log(`  id ${o.id}; opened ${o.openedAt} by ${o.openedBy}; sources ${o.sources.join(", ")}`);
    for (const h of o.history) console.log(`  ${h.at}  ${h.type.replace("obligation-", "")}  by ${h.by}${"note" in h && h.note ? ` — ${h.note}` : ""}${"rationale" in h ? ` — ${h.rationale}` : ""}${"successor" in h ? ` → ${h.successor}` : ""}`);
  } else if (command === "obligation" && (sub === "ack" || sub === "resolve" || sub === "escalate") && rest[0]) {
    const ledger = new ObligationLedger(process.cwd());
    const o = await findObligation(ledger, rest[0]);
    if (sub === "ack") {
      const by = await authorized(flag("by"), { severity: "info" });
      const note = flag("note");
      await ledger.acknowledge(o.id, by, note);
      console.log(`obligation ${o.id.slice(0, 8)} acknowledged by ${by}: received, not resolved`);
    } else if (sub === "resolve") {
      const disposition = flag("disposition");
      const rationale = flag("rationale");
      if (!disposition || !rationale) usage();
      assertValid(DispositionSchema, disposition, `disposition (one of ${DispositionSchema.anyOf.map((d) => d.const).join(", ")})`);
      const by = await authorized(flag("by"), { severity: o.severity, disposition });
      await ledger.resolve(o.id, { by, disposition, rationale: rationale! });
      console.log(`obligation ${o.id.slice(0, 8)} resolved by ${by} as ${disposition}${o.unit && o.blocks ? `; unit ${o.unit} may proceed if nothing else is owed on it` : ""}`);
    } else {
      const to = flag("to");
      const rationale = flag("rationale");
      if (!to || !rationale) usage();
      assertValid(ConsumerSchema, to, `consumer (one of ${ConsumerSchema.anyOf.map((c) => ("const" in c ? c.const : c.anyOf?.map((x) => x.const).join(", "))).join(", ")})`);
      const by = await authorized(flag("by"), { severity: o.severity });
      const successor = await ledger.escalate(o.id, { by, to, rationale: rationale! });
      console.log(`obligation ${o.id.slice(0, 8)} escalated by ${by} to ${to}: successor ${successor.id.slice(0, 8)} is now what is owed`);
    }
  } else if (command === "memory" && sub === "retract" && rest[0]) {
    const reason = flag("reason");
    if (!reason) usage();
    const by = await authorized(flag("by"), { severity: "info" });
    const store = new MemoryStore(process.cwd());
    const match = (await store.states()).filter((s) => s.id === rest[0] || s.id.startsWith(rest[0]!));
    if (match.length !== 1) throw new Error(match.length ? `"${rest[0]}" matches ${match.length} entries` : `no memory entry "${rest[0]}"`);
    await store.retract(match[0]!.id, by!, reason!);
    console.log(`memory ${match[0]!.id.slice(0, 8)} retracted by ${by}: ${reason}`);
  } else if (command === "memory") {
    const states = await new MemoryStore(process.cwd()).states();
    const shown = sub === "--all" || rest.includes("--all") ? states : states.filter((s) => s.status === "current");
    if (!shown.length) console.log(states.length ? "nothing current; --all shows expired and retracted entries" : "no memory recorded");
    for (const s of shown) console.log(`${s.status.padEnd(9)} ${s.id.slice(0, 8)}  ${s.subject}: ${s.note}  (by ${s.recordedBy}${s.unit ? ` in ${s.unit}` : ""}${s.revision ? ` @${s.revision.slice(0, 7)}` : ""}, ${s.recordedAt.slice(0, 10)} → review ${s.reviewBy.slice(0, 10)})${s.retraction ? `\n          retracted by ${s.retraction.by}: ${s.retraction.reason}` : ""}`);
    console.log(`${shown.length} shown of ${states.length}`);
  } else if (command === "identity" && (sub === "accept" || sub === "reject") && rest[0]) {
    // The S5 decision path (INV-002): the only writer of an identity file, run by a person, citing the obligation it decides.
    const rationale = flag("rationale");
    if (!rationale) usage();
    const ledger = new ObligationLedger(process.cwd());
    const o = await findObligation(ledger, rest[0]);
    if (o.concern !== "policy-proposal" || o.consumer !== "S5") throw new Error(`obligation ${o.id.slice(0, 8)} is ${o.concern} owed to ${o.consumer}; \`identity accept|reject\` decides proposals owed to S5`);
    const by = await authorized(flag("by"), { severity: o.severity, s5: true });
    if (sub === "reject") {
      await ledger.resolve(o.id, { by: by!, disposition: "rejected", rationale: rationale! });
      console.log(`proposal ${o.id.slice(0, 8)} rejected by ${by} (S5): ${rationale}; identity unchanged`);
    } else {
      const file = flag("file");
      const from = flag("from");
      if (!file || !from || !(IDENTITY_FILES as readonly string[]).includes(file)) { console.error(`--file must be one of ${IDENTITY_FILES.join(", ")}`); usage(); }
      const repo = process.cwd();
      if (!(await isClean(realExec, repo))) throw new Error("the base checkout has uncommitted changes; an identity decision is committed on its own");
      const target = path.posix.join(IDENTITY_RELATIVE_DIR, file!);
      const decision = authorizeWrite(target, "s5-authority");
      if (!decision.allowed) throw new Error(decision.reason ?? "refused");
      const content = await readFile(path.resolve(from!), "utf8");
      await writeFile(path.join(repo, target), content, "utf8");
      const identity = await readIdentity(path.join(repo, IDENTITY_RELATIVE_DIR));
      if (identity.problems.length) {
        const r = await realExec("git", ["checkout", "--", target], { cwd: repo });
        throw new Error(`the proposed ${file} leaves the identity set invalid (${identity.problems.join("; ")}); reverted${r.code === 0 ? "" : " (revert failed)"}`);
      }
      const branch = await currentBranch(realExec, repo);
      for (const args of [["add", "--", target], ["-c", "commit.gpgsign=false", "commit", "-q", "-m", `S5: ${sub} proposal ${o.id.slice(0, 8)} into ${target}\n\nDecided by ${by} under S5 authority. Obligation ${o.id}.\n${rationale}`]]) {
        const r = await realExec("git", args, { cwd: repo });
        if (r.code !== 0) throw new Error(`git ${args[0]} failed: ${r.stderr.trim()}`);
      }
      const sha = await headRevision(realExec, repo);
      await ledger.resolve(o.id, { by: by!, disposition: "accepted", rationale: `${rationale}. ${target} changed in ${sha.slice(0, 7)} on ${branch} under S5 authority.` });
      console.log(`proposal ${o.id.slice(0, 8)} accepted by ${by} (S5): ${target} committed as ${sha.slice(0, 7)} on ${branch}; the obligation is resolved as accepted`);
    }
  } else if (command === "signals" && sub === "route") {
    const routed = await routeMessages(new ObligationLedger(process.cwd()), { policy: await routingP() });
    for (const o of routed.opened) console.log(`opened  ${describe(o as ObligationState & { status: "open" })}`);
    for (const n of routed.noted) console.log(`noted   ${n.message.kind}  ${n.message.subject}: ${n.reason}`);
    const delivered = await deliverPending(process.cwd(), { policy: await interactionP() });
    console.log(`${routed.opened.length} obligation(s) opened, ${routed.noted.length} message(s) noted, ${delivered.length} delivered to the outbox`);
  } else if (command === "answer" && sub) {
    // A person answers what a unit asked (lesson 13). The answer is the disposition; the next attempt carries it as the hint.
    const answer = flag("answer");
    if (!answer) usage();
    const ledger = new ObligationLedger(process.cwd());
    const o = await findObligation(ledger, sub);
    if (o.concern !== "interaction") throw new Error(`obligation ${o.id.slice(0, 8)} is ${o.concern}, not a question a unit asked; use \`obligation resolve\``);
    if (o.status !== "open" && o.status !== "acknowledged") throw new Error(`obligation ${o.id.slice(0, 8)} is ${o.status}`);
    const request = (await ledger.interactions()).find((i) => i.request.obligationId === o.id);
    if (!request) throw new Error(`no interaction request recorded for obligation ${o.id.slice(0, 8)}`);
    if (request.request.options && !request.request.options.includes(answer!)) throw new Error(`the question offers ${request.request.options.join(" | ")}; "${answer}" is not one of them`);
    const by = await authorized(flag("by"), { severity: o.severity });
    const disposition = dispositionForAnswer(request.request.kind, answer!);
    await ledger.answerInteraction({ requestId: request.request.id, outcome: "answered", answer: answer!, by, channel: "cli" });
    await ledger.resolve(o.id, { by, disposition, rationale: answer! });
    console.log(`${request.request.kind} answered by ${by} (${disposition}): ${answer}${o.unit ? `; unit ${o.unit} may proceed if nothing else is owed on it, and the next attempt carries the answer` : ""}`);
  } else if (command === "eval" && sub) {
    // Evidence about the regulators (lesson 14). A behaviour names a scripted unit; without one the Pi dispatcher runs live units under each arm's extensions.
    const suite = await loadSuite(path.resolve(sub));
    const behaviour = flag("behaviour");
    if (behaviour !== undefined && !isBehaviour(behaviour)) throw new Error(`no scripted behaviour "${behaviour}" (reference | drifter | sloppy | self-certifier)`);
    const arms = rest.flatMap((a, i) => (a === "--arm" && rest[i + 1] ? [rest[i + 1]!] : []));
    const reps = flag("reps") ? Number(flag("reps")) : undefined;
    const interpretationFile = flag("interpretation");
    const interpretation = interpretationFile ? (await readFile(path.resolve(interpretationFile), "utf8")).trim() : `Run by \`regulator eval\` with ${behaviour ? `the scripted ${behaviour} unit` : "live units"}; ${UNINTERPRETED_MARKER}.`;
    const coverage = ablationCoverage(suite, (await loadRegistry(path.join(labRoot, "registry"))).records.map((r) => r.id));
    if (coverage.unknown.length) throw new Error(`suite ablates ${coverage.unknown.join(", ")}, which the registry does not declare`);
    console.log(`suite ${suite.name} v${suite.version}: ${suite.tasks.length} task(s), ${arms.length ? arms.join(", ") : suite.arms.map((a) => a.name).join(", ")} × ${reps ?? suite.repetitions} repetition(s); ${behaviour ? `scripted ${behaviour}` : "live"}; ablation arms cover ${coverage.covered.length} of ${coverage.covered.length + coverage.uncovered.length} regulators`);
    const live = behaviour ? undefined : await loadHost(flag("host"));
    const report = await runSuite(realExec, {
      suite, ...(arms.length ? { arms } : {}), ...(reps === undefined ? {} : { repetitions: reps }),
      dispatcherFor: behaviour ? scriptedDispatchers(realExec, behaviour) : (arm) => live!.host.dispatcher({ echo: false, extensions: arm.extensions.filter((e) => live!.host.extensions.includes(e)) }),
      owner: `${userInfo().username}@${hostname()}`, dispatcher: behaviour ? `scripted:${behaviour}` : "pi", model: behaviour ? "none" : (await loadPolicy()).models.default.primary,
      interpretation, interpretedBy: flag("by") ?? (interpretationFile ? userInfo().username : UNINTERPRETED_BY), keepInstances: rest.includes("--keep"),
      onRun: (run, instance) => console.log(`  ${run.arm.padEnd(20)} rep ${run.repetition}  ${run.task.padEnd(12)} ${run.outcome.padEnd(8)} ${Object.entries(run.metrics).filter(([k]) => suite.metrics.includes(k as never)).map(([k, v]) => `${k}=${v}`).join(" ")}${rest.includes("--keep") ? `  (${instance})` : ""}`),
    });
    for (const a of report.arms) console.log(`${a.arm}: ${a.runs} run(s); ${Object.entries(a.metrics).map(([m, s]) => `${m} ${formatSummary(s)}`).join("; ")}`);
    for (const l of report.lifts) console.log(`  ${l.arm} vs ${suite.baseline}: ${l.metric} ${l.delta >= 0 ? "+" : ""}${Number.isInteger(l.delta) ? l.delta : l.delta.toFixed(2)}${l.separated ? " (intervals separate)" : ""}`);
    const out = flag("out");
    if (out) {
      await mkdir(path.dirname(path.resolve(out)), { recursive: true });
      await writeFile(path.resolve(out), `${JSON.stringify(report, null, 2)}\n`, "utf8");
      console.log(`report written to ${path.resolve(out)}${path.resolve(out).startsWith(REPORTS_DIR) ? " (committed reports are checked by `regulator check`)" : ""}`);
    }
  } else if (command === "spans") {
    const { projectSpans } = await import("@metacoding.io/regulator-core");
    const spans = await projectSpans(process.cwd());
    if (rest.includes("--json") || sub === "--json") for (const s of spans) console.log(JSON.stringify(s));
    else {
      for (const s of spans) console.log(`${s.startTime.slice(0, 19)}  ${s.parentSpanId ? "  " : ""}${s.name.padEnd(36)} ${s.status.padEnd(6)} ${s.attributes["vsm.regulator.id"] ?? ""}${s.attributes["vsm.redacted"] === true ? "  [redacted]" : ""}`);
      console.log(`${spans.length} span(s), ${new Set(spans.map((s) => s.traceId)).size} trace(s)`);
    }
  } else if (command === "review") {
    const { reviewDue } = await import("@metacoding.io/regulator-core");
    const { records } = await loadRegistry(path.join(labRoot, "registry"));
    const today = new Date().toISOString().slice(0, 10);
    const within = flag("within") ? Number(flag("within")) : 0;
    const due = rest.includes("--due") || sub === "--due" ? reviewDue(records, today, within) : records.filter((r) => r.status === "active").map((r) => ({ record: r, reviewBy: r.ownership.reviewBy, overdueDays: Math.round((Date.parse(today) - Date.parse(r.ownership.reviewBy)) / 86_400_000) }));
    for (const d of due) console.log(`${d.overdueDays > 0 ? `overdue ${d.overdueDays}d` : `due in ${-d.overdueDays}d`}`.padEnd(16) + `  ${d.reviewBy}  ${d.record.id}  ablation ${d.record.ablation?.switch ?? "—"}  retire when: ${d.record.retirement?.condition ?? "—"}`);
    console.log(`${due.length} record(s)${rest.includes("--due") || sub === "--due" ? ` overdue or due within ${within} day(s)` : ""}`);
  } else if (command === "check" || command === "docs") {
    // The definition check and the generated registry documents live in registry-cli.ts; reached from here so
    // `regulator check` and `regulator docs` are the commands the documentation names.
    process.argv = [process.argv[0]!, process.argv[1]!, command, ...[sub, ...rest].filter((a): a is string => a !== undefined)];
    await import("./registry-cli.js");
  } else if (command === "remind") {
    const delivered = await remindDue(process.cwd(), { policy: await interactionP() });
    for (const d of delivered) console.log(`${d.reminder ? "reminded " : "delivered"} ${describe(d.obligation)}`);
    console.log(`${delivered.length} delivered`);
  } else {
    usage();
  }
} catch (error) {
  console.error(`regulator: ${(error as Error).message}`);
  process.exit(1);
}
