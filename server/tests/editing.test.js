import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import bcrypt from "bcrypt";
import { testDb } from "./database.js";
import { migrate } from "../src/db/index.js";
import { createApp } from "../src/app.js";
import { createMarket } from "../src/modules/market.js";
import { today, D } from "../src/lib.js";

test("compras fraccionarias por total y correcciones recalculan saldos sin duplicar", async (t) => {
  const db = await testDb();
  t.after(() => db.end());
  const password = "Prueba-segura-edicion";
  await migrate(db, await bcrypt.hash(password, 4));
  await migrate(db, "ignored");
  const config = {
    JWT_SECRET: "test-secret-at-least-thirty-two-characters",
    NODE_ENV: "test",
    APP_ORIGIN: "http://localhost:5173",
    FINNHUB_API_KEY: "",
    ANTHROPIC_API_KEY: "",
  };
  const agent = request.agent(createApp(db, config).app);
  const send = (method, path, body) =>
    agent[method]("/api" + path)
      .set("Origin", config.APP_ORIGIN)
      .send(body);
  await send("post", "/auth/login", { password }).expect(200);
  const bank = (
    await send("post", "/accounts", {
      name: "Banco",
      type: "bank",
      opening_balance: "1000",
    }).expect(201)
  ).body;
  const savings = (
    await send("post", "/accounts", {
      name: "Ahorro",
      type: "savings",
      opening_balance: "1000",
    }).expect(201)
  ).body;
  const balances = async () => (await agent.get("/api/accounts")).body;
  const trade = {
    symbol: "AAPL",
    side: "buy",
    quantity: "0.94",
    total: "200.00",
    fee: "1.00",
    date: today(),
    account_id: bank.id,
  };
  const buy = (await send("post", "/trades", trade).expect(201)).body;
  assert.equal(
    (await balances()).find((a) => a.id === bank.id).balance,
    "800.00",
  );
  assert.equal(
    D(buy.price).mul(buy.quantity).plus(buy.fee).toFixed(2),
    "200.00",
  );
  await send("put", "/trades/" + buy.id, {
    ...trade,
    total: "150.00",
    account_id: savings.id,
  }).expect(200);
  assert.equal(
    (await balances()).find((a) => a.id === bank.id).balance,
    "1000.00",
  );
  assert.equal(
    (await balances()).find((a) => a.id === savings.id).balance,
    "850.00",
  );
  const sell = (
    await send("post", "/trades", {
      ...trade,
      side: "sell",
      quantity: "0.5",
      total: "120.00",
    }).expect(201)
  ).body;
  await send("put", "/trades/" + buy.id, { ...trade, quantity: "0.4" }).expect(
    400,
  );
  await send("delete", "/trades/" + buy.id).expect(400);
  await send("post", "/trades", { ...trade, total: "0.50" }).expect(400);
  await send("put", "/trades/2147483647", trade).expect(404);
  await send("delete", "/trades/" + sell.id).expect(200);
  await send("delete", "/trades/" + buy.id).expect(200);
  assert.equal(
    (await balances()).find((a) => a.id === savings.id).balance,
    "1000.00",
  );
  const transfer = (
    await send("post", "/transfers", {
      from_id: bank.id,
      to_id: savings.id,
      amount: "30",
      date: today(),
    }).expect(201)
  ).body;
  await send("put", "/transfers/" + transfer.id, {
    from_id: bank.id,
    to_id: savings.id,
    amount: "50",
    date: today(),
  }).expect(200);
  assert.equal(
    (await balances()).find((a) => a.id === bank.id).balance,
    "950.00",
  );
  await send("delete", "/accounts/" + bank.id).expect(400);
  await send("delete", "/transfers/" + transfer.id).expect(200);
  const rule = {
    type: "expense",
    amount: "10",
    category_id: null,
    account_id: bank.id,
    note: "Internet",
    period: "monthly",
    next_date: today(),
  };
  const recurring = (await send("post", "/recurring", rule).expect(201)).body;
  await send("put", "/recurring/" + recurring.id, {
    ...rule,
    amount: "20",
  }).expect(200);
  assert.equal(Number((await agent.get("/api/recurring")).body[0].amount), 20);
  await send("delete", "/recurring/" + recurring.id).expect(200);
  const goal = (
    await send("post", "/goals", {
      name: "Viaje",
      target: "500",
      deadline: today(),
    }).expect(201)
  ).body;
  await send("post", `/goals/${goal.id}/contributions`, {
    amount: "100",
    account_id: savings.id,
    date: today(),
  }).expect(201);
  const contribution = (await agent.get("/api/contributions").expect(200))
    .body[0];
  await send("put", "/contributions/" + contribution.id, {
    amount: "2000",
    account_id: savings.id,
    date: today(),
  }).expect(400);
  await send("put", "/contributions/" + contribution.id, {
    amount: "150",
    account_id: savings.id,
    date: today(),
  }).expect(200);
  await send("delete", "/contributions/" + contribution.id).expect(200);
  const bankAport = await send("post", `/goals/${goal.id}/contributions`, {
    amount: "100",
    account_id: bank.id,
    date: today(),
  }).expect(201);
  assert.equal(
    (await balances()).find((a) => a.id === bank.id).balance,
    "1000.00",
  );
  const bankRecord = (await agent.get("/api/contributions")).body.find(
    (c) => c.account_id === bank.id,
  );
  await send("put", "/contributions/" + bankRecord.id, {
    amount: "125",
    account_id: bank.id,
    date: today(),
  }).expect(200);
  await send("post", `/goals/${goal.id}/contributions`, {
    amount: "900",
    account_id: bank.id,
    date: today(),
  }).expect(400);
  const credit = (
    await send("post", "/accounts", {
      name: "Tarjeta",
      type: "credit",
      opening_balance: "1000",
    }).expect(201)
  ).body;
  await send("post", `/goals/${goal.id}/contributions`, {
    amount: "10",
    account_id: credit.id,
    date: today(),
  }).expect(400);
  await send("delete", "/contributions/" + bankRecord.id).expect(200);
  await send("delete", "/accounts/" + bank.id).expect(200);
});

test("búsqueda por nombre y última cotización incluso fuera de horario", async (t) => {
  const db = await testDb();
  t.after(() => db.end());
  await migrate(db, "test-hash");
  const calls = [];
  const market = createMarket(
    db,
    { FINNHUB_API_KEY: "test-key" },
    async (url) => {
      calls.push(url.pathname);
      const data = url.pathname.endsWith("/search")
        ? {
            result: [
              {
                symbol: "AAPL",
                description: "APPLE INC",
                type: "Common Stock",
              },
            ],
          }
        : url.pathname.endsWith("/quote")
          ? { c: 200, t: 12345 }
          : { name: "Apple", finnhubIndustry: "Technology" };
      return { ok: true, json: async () => data };
    },
  );
  assert.equal((await market.search("Apple"))[0].symbol, "AAPL");
  assert.equal((await market.quote("AAPL")).data.c, 200);
  await market.quote("AAPL");
  assert.equal(calls.filter((c) => c.endsWith("/quote")).length, 1);
  assert.equal(
    calls.some((c) => c.endsWith("/market-status")),
    false,
  );
});
