/**
 * The portfolio workload's `place_trade` tool (#121): the program behind the
 * one tool the workload declares, run by the host in the unit's worktree
 * when a session calls the tool, with the call's arguments on stdin as JSON.
 * It takes `{ "proposed": "trades/proposed/<date>.json" }`, the list the
 * plan-rebalance program computed and a person was asked about, checks that
 * it is a trade list, and writes `trades/pending/<date>.json` byte for byte
 * the same: a file there is a commitment the household executes, and this
 * program is the only way one comes to exist. "Copied unchanged" is a
 * property of the tool, not advice to the model; the suite's assertion that
 * the pending list carries the proposed trades guards a bug here, not a
 * model's shortcut.
 *
 * The tool's declared effect is irreversible, so the harness refuses a call
 * until a person's yes for that call is on the record; nothing here asks,
 * and nothing here moves money. The last line of stdout is what the model is
 * told. The program decides nothing the host trusts: the suite under test/
 * judges the pending list at closeout as it judges any list.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

let args;
try {
  args = JSON.parse(readFileSync(0, "utf8"));
} catch {
  fail("place_trade takes its arguments on stdin as one JSON object, and none was readable");
}
const proposed = args?.proposed;
const named = typeof proposed === "string" ? /^trades\/proposed\/(\d{4}-\d{2}-\d{2})\.json$/.exec(proposed) : null;
if (!named) fail(`proposed must name a list the plan-rebalance program wrote, trades/proposed/<date>.json; got ${JSON.stringify(proposed)}`);
const date = named[1];
if (!existsSync(proposed)) fail(`${proposed} does not exist: there is no list to place`);
const bytes = readFileSync(proposed);
let list;
try {
  list = JSON.parse(bytes.toString("utf8"));
} catch {
  fail(`${proposed} is not JSON: not a trade list`);
}
if (typeof list !== "object" || list === null || Array.isArray(list)) fail(`${proposed} is not a trade list: not an object`);
if (list.date !== date) fail(`${proposed} says date ${JSON.stringify(list.date)}; the file is named for ${date}`);
if (!Array.isArray(list.trades) || !list.trades.length) fail(`${proposed} carries no trades: nothing to place`);
for (const [i, trade] of list.trades.entries()) {
  const at = `${proposed} trades[${i}]`;
  if (typeof trade !== "object" || trade === null) fail(`${at} is not a trade`);
  if (typeof trade.ticker !== "string" || !trade.ticker) fail(`${at} names no ticker`);
  if (trade.side !== "buy" && trade.side !== "sell") fail(`${at} has side ${JSON.stringify(trade.side)}; a trade is a buy or a sell`);
  if (!Number.isInteger(trade.shares) || trade.shares <= 0) fail(`${at} has shares ${JSON.stringify(trade.shares)}; a trade is a whole, positive number of shares`);
  if (trade.side === "sell") {
    if (!Array.isArray(trade.lots) || !trade.lots.length) fail(`${at} sells ${trade.ticker} from no lot`);
    for (const from of trade.lots) if (typeof from?.lot !== "string" || !Number.isInteger(from.shares) || from.shares <= 0) fail(`${at} names a lot without a name or a whole number of shares`);
  }
}

const file = `trades/pending/${date}.json`;
const said = (summary) => process.stdout.write(`${JSON.stringify({ summary, evidence: [{ class: "file", ref: file, observation: `byte for byte ${proposed}: ${list.trades.length} trade(s)` }] })}\n`);
if (existsSync(file)) {
  if (readFileSync(file).equals(bytes)) {
    said(`${file} already carries ${proposed}, byte for byte; nothing written`);
    process.exit(0);
  }
  fail(`${file} exists and is not ${proposed}: a file under trades/pending/ is a commitment, and this tool never replaces one`);
}
mkdirSync(path.dirname(file), { recursive: true });
writeFileSync(file, bytes);
said(`wrote ${file}, byte for byte the list under ${proposed}: ${list.trades.map((t) => `${t.side} ${t.shares} ${t.ticker}`).join("; ")}. A commitment the household executes; the suite judges it at closeout.`);
