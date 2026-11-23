/**
 * The instances the screenshots and the demo video show, and the control room served over them.
 *
 * Shared by scripts/screenshots.mjs and scripts/demo-video.mjs so an image and a frame of the video are made the same
 * way, from the same scripted behaviours the tests drive. Nothing here runs a model. Needs the packages built.
 */
import { spawn } from "node:child_process";
import { cp, mkdir } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const DIST = path.join(ROOT, "packages", "regulator", "dist");
export const LAB = path.join(ROOT, "packages", "regulator");

const dist = (file) => import(pathToFileURL(path.join(DIST, file)).href).catch(() => { console.error(`${path.join("packages/regulator/dist", file)} is missing: run \`pnpm build\` first`); process.exit(2); });

// ---- the instances ---------------------------------------------------------------------------------------------------

// A commit needs an author; the tests rely on the machine's git config, and a clean machine has none.
for (const [k, v] of Object.entries({ GIT_AUTHOR_NAME: "alice", GIT_AUTHOR_EMAIL: "alice@example.com", GIT_COMMITTER_NAME: "alice", GIT_COMMITTER_EMAIL: "alice@example.com" })) process.env[k] ??= v;

const { driveUnit } = await dist("controller.js");
const { loadContract } = await dist("contract-file.js");
const { gitExec } = await dist("git-support.js");
const { initInstance } = await dist("instance.js");
const { loadInteractionPolicy } = await dist("interaction-policy.js");
const { loadPolicy } = await dist("policy.js");
const { loadRecoveryPolicy } = await dist("recovery-policy.js");
const { loadRoutingPolicy } = await dist("routing-policy.js");
const { loadWorkloadFor } = await dist("workload.js");
const { financeDispatcher } = await dist("finance-scripted.js");
const { portfolioDispatcher } = await dist("portfolio-scripted.js");
const { ObligationLedger, dispositionForAnswer } = await import("@metacoding.io/regulator-core").catch(() => import(pathToFileURL(path.join(ROOT, "packages", "core", "dist", "index.js")).href));

/** A fixture as a repository of its own, initialized as an instance with the layout its worked example declares. */
async function instance(dir, fixture, message, layout, clock) {
  await mkdir(dir, { recursive: true });
  await cp(path.join(LAB, fixture), dir, { recursive: true });
  for (const a of [["init", "--quiet", "-b", "main"], ["add", "-A"], ["-c", "commit.gpgsign=false", "commit", "--quiet", "-m", message]]) {
    const r = await gitExec("git", a, { cwd: dir });
    if (r.code !== 0) throw new Error(`git ${a.join(" ")} in ${dir}: ${r.stderr}`);
  }
  await initInstance(gitExec, { repo: dir, ...layout, by: "alice", now: clock });
  return dir;
}

/** Drives units of one workload under one scripted behaviour, in order, as the tests do. */
async function close(repo, { workload, policy, contracts, dispatcherFor }, behaviour, unitIds, clock) {
  const interaction = await loadInteractionPolicy();
  const policyPath = path.join(LAB, "policies", policy);
  const base = { repo, workload: await loadWorkloadFor(workload), policy: await loadPolicy(policyPath), policyPath, recovery: await loadRecoveryPolicy(), routing: await loadRoutingPolicy(), interaction, owner: "alice", now: clock };
  const dispatcher = dispatcherFor(gitExec, { behaviour, repo, interaction, now: clock });
  const out = [];
  for (const unitId of unitIds) out.push((await driveUnit(gitExec, { ...base, contract: await loadContract(path.join(LAB, "contracts", contracts, `${unitId}.json`)), dispatcher })).final);
  return out;
}

/** A person answers yes to the one open consent question on a unit. */
async function consent(repo, unitId, clock) {
  const ledger = new ObligationLedger(repo, clock);
  const [o] = (await ledger.open(unitId)).filter((x) => x.concern === "interaction");
  if (!o) throw new Error(`${unitId}: no consent question is open`);
  const request = (await ledger.interactions()).find((i) => i.request.obligationId === o.id);
  await ledger.answerInteraction({ requestId: request.request.id, outcome: "answered", answer: "yes", by: "alice", channel: "cli" });
  await ledger.resolve(o.id, { by: "alice", disposition: dispositionForAnswer("consent", "yes"), rationale: "yes" });
}

const expect = (finals, statuses, what) => {
  const got = finals.map((f) => f.status);
  if (got.join() !== statuses.join()) throw new Error(`${what}: expected ${statuses.join(", ")} and the units ended ${got.join(", ")}; the scripted behaviours have changed, and so must this script`);
};

const FINANCE = { workload: "personal-finance", policy: "finance.json", contracts: "finance", dispatcherFor: financeDispatcher };
const FINANCE_LAYOUT = { writablePaths: ["ledger/", "reports/", "payments/pending/"], protectedPaths: ["statements/", "payments/executed/"] };
const PORTFOLIO = { workload: "portfolio", policy: "portfolio.json", contracts: "portfolio", dispatcherFor: portfolioDispatcher };
const PORTFOLIO_LAYOUT = { writablePaths: ["lots/", "targets/", "trades/proposed/", "reports/"], protectedPaths: ["positions/", "prices/", "trades/executed/"] };

export async function buildInstances(root) {
  let tick = Date.parse("2026-09-23T09:00:00.000Z");
  const clock = () => (tick += 1000);

  // 0: the August close as the contracts ask; the payment asks for consent, nobody answers, and the unit is paused.
  const ledger = await instance(path.join(root, "household-ledger"), "fixture-finance", "the ledger as of the July close", FINANCE_LAYOUT, clock);
  expect(await close(ledger, FINANCE, "bookkeeper", ["f1-ingest", "f2-categorize", "f3-reconcile", "f4-report", "f5-prepare-payment"], clock), ["closed", "closed", "closed", "closed", "blocked"], "the ledger");

  // 1: the careless close: the statement edited and a category invented, each refused and repaired.
  const careless = await instance(path.join(root, "household-ledger-careless"), "fixture-finance", "the ledger as of the July close", FINANCE_LAYOUT, clock);
  expect(await close(careless, FINANCE, "careless", ["f1-ingest", "f2-categorize"], clock), ["closed", "closed"], "the careless ledger");

  // 2: the September portfolio close: two programs, two consent questions answered yes, the review.
  tick = Date.parse("2026-10-01T09:00:00.000Z");
  const portfolio = await instance(path.join(root, "managed-portfolio"), "fixture-portfolio", "the portfolio as of the August close", PORTFOLIO_LAYOUT, clock);
  expect(await close(portfolio, PORTFOLIO, "manager", ["p1-ingest-positions", "p2-propose-target", "p3-plan-rebalance", "p4-confirm-trades"], clock), ["closed", "closed", "closed", "blocked"], "the portfolio, to the first question");
  await consent(portfolio, "p4-confirm-trades", clock);
  expect(await close(portfolio, PORTFOLIO, "manager", ["p4-confirm-trades", "p5-harvest-losses", "p6-plan-harvest", "p7-confirm-harvest"], clock), ["closed", "closed", "closed", "blocked"], "the portfolio, to the second question");
  await consent(portfolio, "p7-confirm-harvest", clock);
  expect(await close(portfolio, PORTFOLIO, "manager", ["p7-confirm-harvest", "p8-review"], clock), ["closed", "closed"], "the portfolio, to the review");

  // 3: the same close run carelessly: the trade placed without asking is refused; the harvest that buys back what it sells is refused and repaired.
  const hasty = await instance(path.join(root, "managed-portfolio-careless"), "fixture-portfolio", "the portfolio as of the August close", PORTFOLIO_LAYOUT, clock);
  expect(await close(hasty, PORTFOLIO, "careless", ["p1-ingest-positions", "p2-propose-target", "p3-plan-rebalance", "p4-confirm-trades"], clock), ["closed", "closed", "closed", "blocked"], "the careless portfolio, to the question");
  await consent(hasty, "p4-confirm-trades", clock);
  expect(await close(hasty, PORTFOLIO, "careless", ["p4-confirm-trades", "p5-harvest-losses", "p6-plan-harvest"], clock), ["closed", "closed", "closed"], "the careless portfolio, to the harvest");

  return [ledger, careless, portfolio, hasty];
}

/** Runs a command to its end; resolves with its stdout, rejects with its stderr on a non-zero exit. */
export function run(argv, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${argv.join(" ")} exited ${code}: ${err.slice(-600)}`))));
  });
}

/** The drifter under the treatment arm, kept: where `regulator spans` has something to say. */
export async function driftInstance(root) {
  const dir = path.join(root, "eval");
  await mkdir(dir, { recursive: true });
  const cli = path.join(DIST, "cli.js");
  await run([process.execPath, cli, "eval", path.join(LAB, "evals", "drift.json"), "--behaviour", "drifter", "--arm", "treatment", "--reps", "1", "--keep", "--out", path.join(dir, "report.json")], { cwd: dir, env: { ...process.env, TMPDIR: dir } });
  const { readdir } = await import("node:fs/promises");
  const kept = (await readdir(dir)).find((d) => d.startsWith("regulator-eval-treatment-"));
  if (!kept) throw new Error("the eval kept no treatment instance");
  return path.join(dir, kept, "instance");
}


const freePort = () => new Promise((resolve, reject) => { const s = createServer(); s.unref(); s.on("error", reject); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

export async function serveControlRoom(instances) {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(ROOT, "packages", "control-room", "dist", "cli.js"), "--definition", LAB, ...instances.flatMap((i) => ["--instance", i]), "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    let said = "";
    const fail = setTimeout(() => reject(new Error(`the control room did not start: ${said}`)), 20_000);
    child.stdout.on("data", (d) => { said += d; if (said.includes("control room")) { clearTimeout(fail); resolve(); } });
    child.stderr.on("data", (d) => (said += d));
    child.on("exit", (code) => reject(new Error(`the control room exited ${code}: ${said}`)));
  });
  return { url: `http://127.0.0.1:${port}/`, stop: () => child.kill() };
}
