import test from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./database.js";
import { migrate } from "../src/db/index.js";
import { investments } from "../src/modules/investments.js";
import { accounts } from "../src/modules/ledger.js";
import { portfolio, today } from "../src/lib.js";
test("tenencia inicial fraccionaria no inventa costo ni mueve efectivo", async (t) => {
  const db = await testDb();
  t.after(() => db.end());
  await migrate(db, "test-hash");
  await db.query(
    "INSERT INTO accounts(name,type,opening_balance) VALUES ('Banco','bank',500)",
  );
  await db.query(
    "INSERT INTO initial_holdings(symbol,quantity,total_cost) VALUES ('VOO',0.94826,NULL)",
  );
  let inv = await investments(db);
  assert.equal(inv.positions[0].quantity, "0.94826000");
  assert.equal(inv.positions[0].cost, null);
  assert.equal(inv.positions[0].unrealized, null);
  assert.equal(inv.positions[0].value, null);
  assert.equal(inv.value_incomplete, true);
  assert.equal((await accounts(db))[0].balance, "500.00");
  await db.query("INSERT INTO quote_cache(symbol,data) VALUES ('VOO',$1)", [
    JSON.stringify({ c: 600 }),
  ]);
  inv = await investments(db);
  assert.equal(inv.positions[0].value, "568.96");
  assert.equal(inv.positions[0].unrealized, null);
  assert.equal(inv.value_incomplete, false);
  await db.query(
    "UPDATE initial_holdings SET total_cost=400 WHERE symbol='VOO'",
  );
  inv = await investments(db);
  assert.equal(inv.positions[0].unrealized, "168.96");
  assert.equal(inv.cost_incomplete, false);
  assert.equal((await accounts(db))[0].balance, "500.00");
  assert.throws(
    () =>
      portfolio([
        {
          symbol: "VOO",
          side: "buy",
          quantity: "0.94826",
          price: "0",
          fee: "0",
          cost_unknown: true,
          date: "0001-01-01",
          id: 0,
        },
        {
          symbol: "VOO",
          side: "sell",
          quantity: "1",
          price: "600",
          fee: "0",
          date: today(),
          id: 1,
        },
      ]),
    /supera/,
  );
});
