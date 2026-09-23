import assert from "node:assert/strict";
import test from "node:test";
import { categories, cents, hasLedger, hasReport, ledger, money, pendingPayments, reportOpenItems, reportTotals, statement, statementPeriods, totals } from "../lib/ledger.js";

const taxonomy = categories();

test("every ledger row is dated in its period and categorized from the taxonomy", () => {
  for (const period of statementPeriods().filter(hasLedger)) {
    for (const row of ledger(period)) {
      assert.ok(row.date.startsWith(period), `${period}: row dated ${row.date} does not belong here`);
      assert.ok(taxonomy.categories.includes(row.category), `${period}: "${row.category}" (${row.description}) is not in categories.json`);
    }
  }
});

test("every period with a ledger balances to its statement: row for row, and in total", () => {
  for (const period of statementPeriods().filter(hasLedger)) {
    const s = statement(period);
    const rows = ledger(period);
    const key = (r) => `${r.date} ${cents(r.amount)}`;
    const wanted = s.rows.map(key).sort();
    const got = rows.map(key).sort();
    assert.deepEqual(got, wanted, `${period}: the ledger's rows are not the statement's`);
    const net = rows.reduce((sum, r) => sum + cents(r.amount), 0);
    assert.equal(money(cents(s.opening) + net), money(cents(s.closing)), `${period}: opening ${s.opening} + net ${money(net)} is not the closing balance ${s.closing}`);
  }
});

test("a period's report states the ledger's totals and carries every holding-category row as an open item", () => {
  for (const period of statementPeriods().filter(hasReport)) {
    assert.ok(hasLedger(period), `${period}: a report without a ledger`);
    const rows = ledger(period);
    const stated = reportTotals(period);
    for (const [category, total] of totals(rows)) assert.equal(stated.get(category), total, `${period}: the report says ${money(stated.get(category) ?? 0)} for ${category}; the ledger says ${money(total)}`);
    assert.equal(stated.size, totals(rows).size, `${period}: the report states a category the ledger does not have`);
    const openItems = reportOpenItems(period);
    for (const row of rows.filter((r) => r.category === taxonomy.holding)) {
      assert.ok(openItems.some((line) => line.includes(row.date) && line.includes(row.description)), `${period}: ${row.date} ${row.description} is still ${taxonomy.holding} and the report's open items do not carry it`);
    }
  }
});

test("a pending payment names its payee, amount, due date and a category from the taxonomy", () => {
  for (const p of pendingPayments()) {
    assert.match(p.payee ?? "", /\S/, `${p.file}: no payee`);
    assert.ok(cents(p.amount) > 0, `${p.file}: amount must be positive`);
    assert.match(p.dueDate ?? "", /^\d{4}-\d{2}-\d{2}$/, `${p.file}: no due date`);
    assert.ok(taxonomy.categories.includes(p.category) && p.category !== taxonomy.holding, `${p.file}: category "${p.category}" is not one a payment can carry`);
  }
});
