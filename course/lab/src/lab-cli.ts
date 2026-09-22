/**
 * `regulator` for the course lab.
 *
 *   node dist/lab-cli.js fixture <dest> [--oscillation]   copy a fixture into its own git repo
 *   node dist/lab-cli.js unit start <id> [--ttl <min>]    lease + worktree + branch (run in the base checkout)
 *   node dist/lab-cli.js unit finish <id>                 reintegrate, or surface the conflict
 *   node dist/lab-cli.js unit status                      leases and their liveness
 */
import { hostname, userInfo } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { realExec } from "./exec.js";
import { finishUnit, initFixture, startUnit, unitStatus } from "./unit.js";

const labRoot = fileURLToPath(new URL("../", import.meta.url));
const [command, sub, ...rest] = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const usage = () => {
  console.error("usage: regulator fixture <dest> [--oscillation] | unit start <id> [--ttl <minutes>] | unit finish <id> | unit status");
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
