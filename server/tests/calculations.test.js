import test from "node:test";
import assert from "node:assert/strict";
import {
  portfolio,
  projection,
  budgetProgress,
  nextDate,
  money,
  D,
  csvCell,
} from "../src/lib.js";
test("costo promedio y ganancia incluyen comisiones y ventas parciales", () => {
  const p = portfolio(
    [
      {
        id: 1,
        symbol: "AAPL",
        side: "buy",
        quantity: "10",
        price: "100",
        fee: "2",
        date: "2026-01-01",
      },
      {
        id: 2,
        symbol: "AAPL",
        side: "buy",
        quantity: "10",
        price: "120",
        fee: "2",
        date: "2026-01-02",
      },
      {
        id: 3,
        symbol: "AAPL",
        side: "sell",
        quantity: "5",
        price: "130",
        fee: "1",
        date: "2026-01-03",
      },
    ],
    { AAPL: { data: { c: 140 } } },
  )[0];
  assert.equal(p.average, "110.20");
  assert.equal(p.realized, "98.00");
  assert.equal(p.quantity, "15.00000000");
  assert.equal(p.unrealized, "447.00");
});
test("no se permiten ventas sin acciones ni ventas retroactivas sin saldo", () => {
  assert.throws(
    () =>
      portfolio([
        {
          id: 1,
          symbol: "X",
          side: "sell",
          quantity: "1",
          price: "5",
          fee: "0",
          date: "2026-01-01",
        },
      ]),
    /supera/,
  );
});
test("decimales sin error binario, proyección y umbrales de presupuesto", () => {
  assert.equal(money(D("0.1").plus("0.2")), "0.30");
  assert.equal(projection("100", 10, 31), "310.00");
  assert.equal(budgetProgress("80", "100").level, "warning");
  assert.equal(budgetProgress("100", "100").level, "danger");
});
test("recurrencias conservan día 31 y años bisiestos", () => {
  assert.equal(nextDate("2026-01-31", "monthly", 31), "2026-02-28");
  assert.equal(nextDate("2026-02-28", "monthly", 31), "2026-03-31");
  assert.equal(nextDate("2024-02-29", "yearly", 29), "2025-02-28");
  assert.equal(nextDate("2026-12-31", "weekly"), "2027-01-07");
});
test("CSV neutraliza fórmulas y escapa comillas", () => {
  assert.equal(csvCell("=1+2"), '"\'=1+2"');
  assert.equal(csvCell('a"b'), '"a""b"');
});
