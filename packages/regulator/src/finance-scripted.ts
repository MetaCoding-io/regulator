/**
 * Scripted units for the worked example (`course/examples/personal-finance.md`):
 * the August close of the household ledger under the personal-finance
 * workload, done without a model so the example runs under CI and the
 * closeout checks can be watched doing their work.
 *
 *   bookkeeper   does each unit the way its contract asks: the statement is
 *                copied, categories come from the taxonomy with July as the
 *                precedent, the unknown merchant stays in the holding category
 *                and is surfaced, the report's numbers are the ledger's, and
 *                the payment is written only after a person's yes
 *   careless     the same units, but the first attempt of each takes the
 *                shortcut a hurried person would: edits the bank's statement
 *                to make the books balance, invents a category for the
 *                merchant it cannot explain, writes a report from memory —
 *                and, on the repair attempt the router grants, does it right
 *
 * A scripted unit never runs a session, so nothing here exercises the gates
 * inside one (the profile grant, the write gate, the pause gate): what the
 * example shows is the loop — the closeout checks over the ledger's own
 * suite, the protected prefixes, the consent obligation and the paused
 * attempt, the post-merge check on the base.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ExecutionStore, MemoryStore, ObligationLedger, severityForKind } from "@metacoding/vsm-pi-core";
import type { InteractionPolicy, ResultReport, WorkContract } from "@metacoding/vsm-pi-protocol";
import type { DispatchRequest, Dispatcher } from "./controller.js";
import type { Exec } from "./exec.js";

export const FINANCE_BEHAVIOURS = ["bookkeeper", "careless"] as const;
export type FinanceBehaviour = (typeof FINANCE_BEHAVIOURS)[number];
export function isFinanceBehaviour(value: string): value is FinanceBehaviour {
  return (FINANCE_BEHAVIOURS as readonly string[]).includes(value);
}

const DAY = 86_400_000;
const PERIOD = "2026-08";

/** July's precedent, as a bookkeeper would read it off ledger/2026-07.csv; the unknown merchant has none. */
const PRECEDENT: ReadonlyArray<[RegExp, string, string]> = [
  [/PAYROLL/, "income", "salary"], [/GREENGROCER/, "groceries", ""], [/RENT/, "housing", "rent"], [/POWERCO/, "utilities", "electricity"],
  [/METRO TRANSIT/, "transport", "monthly pass"], [/TRANSFER TO SAVINGS/, "transfer", "savings"], [/CAFE/, "dining", ""], [/CITY WATER/, "utilities", "water"], [/BOOKS/, "leisure", ""],
];

async function write(worktree: string, file: string, content: string): Promise<void> {
  await mkdir(path.dirname(path.join(worktree, file)), { recursive: true });
  await writeFile(path.join(worktree, file), content, "utf8");
}

type Row = [date: string, description: string, amount: string, category: string, memo: string];
function csvRows(text: string): Row[] {
  return text.trim().split("\n").slice(1).filter(Boolean).map((l) => {
    const [date = "", description = "", amount = "", category = "", memo = ""] = l.split(",");
    return [date, description, amount, category, memo];
  });
}

function money(c: number): string {
  return `${c < 0 ? "-" : ""}${Math.trunc(Math.abs(c) / 100)}.${String(Math.abs(c) % 100).padStart(2, "0")}`;
}

function reportFor(contract: WorkContract, attempt: number, summary: string, at: string, extra: Partial<ResultReport> = {}): ResultReport {
  return {
    contractId: contract.id, contractVersion: contract.version, unitId: contract.unitId, attempt, reportedAt: at, summary,
    evidence: [{ class: "test", ref: "run_tests", observation: "the ledger's suite passes" }, { class: "command", ref: "run_checks", observation: "checks pass" }],
    delegatedResults: contract.delegated.map((d) => ({ decisionId: d.id, choice: "kept within the bounds" })),
    unresolvedOutcomes: contract.unresolved.map((d) => ({ decisionId: d.id, outcome: "surfaced" as const, note: "left in the holding category and listed as an open item; nobody has said what it was" })),
    emergentDecisions: [], deviations: [], residualUncertainty: [],
    ...extra,
  };
}

export interface FinanceDispatcherOptions {
  behaviour: FinanceBehaviour;
  /** The instance (the base checkout): where the memory store and the obligation ledger live. */
  repo: string;
  /** For the consent question's timeout; the scripted unit is headless, so nobody answers in the session either way. */
  interaction?: InteractionPolicy;
  now?: () => number;
}

/**
 * One dispatcher for every unit of the August close, keyed by unit id.
 * The careless behaviour drifts on attempt 1 of each unit and takes the
 * router's hint on attempt 2.
 */
export function financeDispatcher(exec: Exec, options: FinanceDispatcherOptions): Dispatcher {
  const now = options.now ?? Date.now;
  const careless = (r: DispatchRequest) => options.behaviour === "careless" && r.attempt === 1;
  const store = new ExecutionStore(options.repo, now);
  const stamp = () => new Date(now()).toISOString();

  const commit = async (worktree: string, message: string) => {
    await exec("git", ["add", "-A"], { cwd: worktree });
    const r = await exec("git", ["-c", "commit.gpgsign=false", "commit", "-q", "-m", message], { cwd: worktree });
    if (r.code !== 0 && !/nothing to commit/.test(r.stdout + r.stderr)) throw new Error(`commit failed: ${r.stderr}`);
  };

  const steps: Record<string, (r: DispatchRequest) => Promise<{ summary: string; extra?: Partial<ResultReport> }>> = {
    "f1-ingest": async (r) => {
      const statement = csvRows(await readFile(path.join(r.worktree, `statements/${PERIOD}-checking.csv`), "utf8"));
      if (careless(r)) {
        // The shortcut: the statement has a debit nobody can explain, so "fix" the bank's record and ingest the rest. Two checks refuse it.
        const kept = statement.filter(([, description]) => !/UNKNOWN/.test(description));
        await write(r.worktree, `statements/${PERIOD}-checking.csv`, `date,description,amount\n${kept.map((c) => c.join(",")).join("\n")}\n`);
        await write(r.worktree, `ledger/${PERIOD}.csv`, `date,description,amount,category,memo\n${kept.map(([d, m, a]) => `${d},${m},${a},uncategorized,`).join("\n")}\n`);
        await commit(r.worktree, "f1: ingest August without the debit the statement cannot explain");
        return { summary: "ingested August; dropped one unexplained debit from the statement so the period balances" };
      }
      await exec("git", ["checkout", "main", "--", `statements/${PERIOD}-checking.csv`], { cwd: r.worktree });
      const original = csvRows(await readFile(path.join(r.worktree, `statements/${PERIOD}-checking.csv`), "utf8"));
      await write(r.worktree, `ledger/${PERIOD}.csv`, `date,description,amount,category,memo\n${original.map(([d, m, a]) => `${d},${m},${a},uncategorized,`).join("\n")}\n`);
      await commit(r.worktree, "f1: ingest August from the statement, every row in the holding category");
      return { summary: `ingested ${original.length} rows of the August statement into ledger/${PERIOD}.csv, all uncategorized; the statement is untouched` };
    },
    "f2-categorize": async (r) => {
      const rows = csvRows(await readFile(path.join(r.worktree, `ledger/${PERIOD}.csv`), "utf8"));
      const categorized = rows.map(([d, m, a]) => {
        const p = PRECEDENT.find(([re]) => re.test(m));
        if (p) return `${d},${m},${a},${p[1]},${p[2]}`;
        return careless(r) ? `${d},${m},${a},misc,probably a shop` : `${d},${m},${a},uncategorized,`;
      });
      await write(r.worktree, `ledger/${PERIOD}.csv`, `date,description,amount,category,memo\n${categorized.join("\n")}\n`);
      await commit(r.worktree, careless(r) ? "f2: categorize August, the unknown one as misc" : "f2: categorize August from July's precedent; the unknown merchant stays in the holding category");
      if (careless(r)) return { summary: "categorized every row; the unknown merchant is misc" };
      await new MemoryStore(options.repo, now).record({
        subject: "GREENGROCER 114", note: "the weekly groceries shop; three to four debits a month, 60–90 each", evidence: [{ class: "file", ref: "ledger/2026-07.csv" }],
        unit: r.unitId, recordedBy: "S1", reviewBy: new Date(now() + 60 * DAY).toISOString(), scope: ["categorize", "reconcile"],
      });
      return { summary: "categorized 11 of 12 rows from July's precedent; UNKNOWN MERCHANT 8831 (-120.00 on 2026-08-28) stays uncategorized and is surfaced", extra: {
        delegatedResults: [{ decisionId: "d-categories", choice: "July's category for every recurring merchant; BOOKS AND CO → leisure (new this month)" }, { decisionId: "d-memos", choice: "July's memos where they existed" }],
        residualUncertainty: [{ subject: "UNKNOWN MERCHANT 8831", reason: "no precedent and the statement does not say; a person has to recognise the merchant", consequenceIfWrong: "low" }],
      } };
    },
    "f3-reconcile": async () => ({ summary: "read ledger/2026-08.csv against the statement: 12 rows match date and amount; opening 2450.00 + net 783.20 = closing 3233.20. Nothing to change; one row is still in the holding category.", extra: { evidence: [{ class: "test", ref: "run_tests", observation: "the ledger's suite passes; the host's run is the evidence" }] } }),
    "f4-report": async (r) => {
      const rows = csvRows(await readFile(path.join(r.worktree, `ledger/${PERIOD}.csv`), "utf8"));
      const totals = new Map<string, number>();
      for (const [, , a, category] of rows) totals.set(category, (totals.get(category) ?? 0) + Math.round(Number(a) * 100));
      if (careless(r)) totals.delete("transfer"); // from memory: forgot the transfer to savings
      const net = [...totals.values()].reduce((s, v) => s + v, 0);
      const open = rows.filter(([, , , category]) => category === "uncategorized").map(([d, m, a]) => `- ${d} ${m} ${a} (uncategorized)`);
      await write(r.worktree, `reports/${PERIOD}.md`, `# ${PERIOD} — monthly close\n\nAccount checking: opening 2450.00, closing 3233.20, net ${money(net)} over ${rows.length} transactions.\nReconciled to the bank's statement row for row.\n\n| category | total |\n| --- | --- |\n${[...totals].map(([c, t]) => `| ${c} | ${money(t)} |`).join("\n")}\n\nOpen items:${open.length ? `\n${open.join("\n")}` : " none."}\n`);
      await commit(r.worktree, `f4: the August close under reports/`);
      return { summary: careless(r) ? "wrote the August close" : `wrote reports/${PERIOD}.md: ${totals.size} categories, ${open.length} open item(s) carried forward` };
    },
    "f5-prepare-payment": async (r) => {
      const ledger = new ObligationLedger(options.repo, now);
      const consented = /consent .*answered|answer(ed)?[^.]*\byes\b/i.test(r.hint ?? "");
      if (!consented) {
        // What ask_human does headlessly: the question is owed before anyone could answer it, nobody is there, and the answer is recorded as unavailable.
        const question = "May I write payments/pending/2026-09-rent.json: 1450.00 to 14 Elm St (landlord), due 2026-09-05?";
        const obligation = await ledger.openObligation({ subject: "consent: September rent", unit: r.unitId, concern: "interaction", sources: [`ask:${randomUUID()}`], severity: severityForKind("consent"), consumer: "human", blocks: true, question, openedBy: "S1" });
        const request = { id: randomUUID(), kind: "consent" as const, subject: "September rent", question, action: "write payments/pending/2026-09-rent.json for 1450.00, due 2026-09-05", severity: severityForKind("consent"), unit: r.unitId, attempt: r.attempt, obligationId: obligation.id, evidence: [{ class: "file" as const, ref: "ledger/2026-08.csv", observation: "housing: -1450.00 on 2026-08-05, as in July" }], raisedBy: "S1" as const, raisedAt: stamp(), timeoutMs: options.interaction?.timeoutsMs.consent ?? 0, channel: "none" as const };
        await ledger.requestInteraction(request, "S1");
        await ledger.answerInteraction({ requestId: request.id, outcome: "unavailable", by: "S1", channel: "none" });
        return { summary: "asked for consent to write the September rent payment; no one answered, nothing was written", extra: { residualUncertainty: [{ subject: "consent", reason: "the question is owed to a person", consequenceIfWrong: "high" }] } };
      }
      await write(r.worktree, "payments/pending/2026-09-rent.json", `${JSON.stringify({ payee: "14 Elm St (landlord)", amount: "1450.00", dueDate: "2026-09-05", category: "housing", memo: "September rent; consented on the record" }, null, 2)}\n`);
      await commit(r.worktree, "f5: September rent under payments/pending/, after consent");
      return { summary: "consent given; wrote payments/pending/2026-09-rent.json for 1450.00 due 2026-09-05" };
    },
  };

  return async (r) => {
    const step = steps[r.unitId];
    if (!step) throw new Error(`the scripted bookkeeper knows no unit "${r.unitId}"`);
    const { summary, extra } = await step(r);
    await store.writeReport(reportFor(r.contract, r.attempt, summary, stamp(), extra));
    return {};
  };
}
