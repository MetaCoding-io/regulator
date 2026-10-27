/**
 * The portfolio workload's `harvest-losses` program (#122): the unit type's
 * declared command, run by the control plane in the unit's worktree with no
 * session and no model. It reads the open lots and the latest custodian's
 * export through the portfolio's own library and writes every lot at an
 * unrealised loss at that date's prices, with the loss per lot, to
 * `trades/proposed/harvest-<date>.json`: candidates a program found, not
 * yet judged and not yet agreed.
 *
 * Deliberately not here: no threshold, and no benefit-versus-cost check. The
 * book's harvest evaluation — the tax benefit against the trading cost and
 * the opportunity cost, with the volatility input a person fixes — is the
 * harvest contract's arithmetic (#124), which also turns a candidate into a
 * sell and a replacement from the ticker's exchangeable set. This program
 * only says where the losses are. The last line of stdout is the unit's
 * report; the suite under test/ checks every candidate against the lots and
 * the prices at closeout.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const lib = await import(pathToFileURL(path.resolve("lib/portfolio.js")).href);

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const dates = lib.positionDates();
const date = dates[dates.length - 1];
const ledger = lib.lots();
if (ledger.asOf !== date) fail(`lots/ are current to ${ledger.asOf}, not to the latest export ${date}: ingest the fills first`);
const px = lib.prices(date);
const taxRules = lib.tax();

const candidates = [];
for (const lot of [...ledger.open].sort((a, b) => a.lot.localeCompare(b.lot))) {
  const price = px.get(lot.ticker);
  if (price === undefined) fail(`prices/${date}.csv carries no price for ${lot.ticker}`);
  const loss = lib.unrealised(lot, price);
  if (loss >= 0) continue;
  candidates.push({
    lot: lot.lot, ticker: lot.ticker, acquired: lot.acquired, shares: lot.shares,
    costPerShare: lib.money(lot.costPerShare), price: lib.money(price), unrealised: lib.money(loss),
    longTerm: lib.daysBetween(lot.acquired, date) > taxRules.longTermAfterDays,
  });
}

const file = `trades/proposed/harvest-${date}.json`;
mkdirSync(path.dirname(file), { recursive: true });
writeFileSync(file, `${JSON.stringify({
  date,
  note: "Every open lot at an unrealised loss at this date's prices, found by the workload's harvest-losses program. Candidates only: no threshold and no benefit-versus-cost judgment, which are the harvest contract's (#124); nothing here is a trade.",
  candidates,
}, null, 2)}\n`);

process.stdout.write(`${JSON.stringify({
  summary: `wrote ${file}: ${candidates.length} lot(s) at an unrealised loss on ${date}${candidates.length ? ` — ${candidates.map((c) => `${c.lot} ${c.unrealised}`).join(", ")}` : ""}. Candidates only; whether any is worth harvesting is the harvest contract's arithmetic.`,
  evidence: [{ class: "file", ref: file, observation: `${candidates.length} candidate(s) against lots/lots.csv at prices/${date}.csv` }],
})}\n`);
