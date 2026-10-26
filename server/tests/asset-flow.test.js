import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import express from "express";
import bcrypt from "bcrypt";
import { testDb } from "./database.js";
import { migrate } from "../src/db/index.js";
import { createApp } from "../src/app.js";
import { advisorRouter } from "../src/modules/advisor.js";
import { today } from "../src/lib.js";

test("ahorros, compras adicionales y metas comparten efectivo sin duplicarlo", async (t) => {
  const db = await testDb();
  t.after(() => db.end());
  const password = "Una-prueba-segura-2026";
  await migrate(db, await bcrypt.hash(password, 4));
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
  const entry = {
    account_id: bank.id,
    direction: "deposit",
    amount: "200",
    date: today(),
    note: "Ahorro del mes",
  };
  await send("post", "/cash-entries", entry).expect(201);
  const saved = (await agent.get("/api/cash-entries").expect(200)).body[0];
  await send("put", "/cash-entries/" + saved.id, {
    ...entry,
    amount: "150",
  }).expect(200);
  await send("post", "/cash-entries", {
    ...entry,
    direction: "withdraw",
    amount: "50",
  }).expect(201);
  let d = (await agent.get("/api/dashboard").expect(200)).body;
  assert.equal(d.cash_total, "1100.00");
  const goal = (
    await send("post", "/goals", {
      name: "Carro",
      target: "5000",
      deadline: "2030-12-31",
    }).expect(201)
  ).body;
  await send("post", `/goals/${goal.id}/contributions`, {
    account_id: bank.id,
    amount: "1000",
    date: today(),
  }).expect(201);
  await send("post", "/cash-entries", {
    ...entry,
    direction: "withdraw",
    amount: "200",
  }).expect(400);
  await send("post", "/trades", {
    symbol: "VOO",
    side: "buy",
    quantity: "0.5",
    total: "100",
    fee: "0",
    date: today(),
    account_id: bank.id,
  }).expect(201);
  d = (await agent.get("/api/dashboard").expect(200)).body;
  assert.equal(d.cash_total, "1000.00");
  assert.equal(d.investments.value, "100.00");
  assert.equal(d.investments.purchases_total, "100.00");
  assert.equal(d.saved_for_goals, "1000.00");
  assert.equal(d.net_worth, "1100.00");
  await send("delete", "/cash-entries/" + saved.id).expect(400);
  await send("delete", "/goals/" + goal.id).expect(200);
  await send("delete", "/cash-entries/" + saved.id).expect(200);
  assert.equal((await agent.get("/api/dashboard")).body.cash_total, "850.00");
  assert.ok((await agent.get("/api/export?format=json")).body.savings_entries);
  await send("post", "/cash-entries", { ...entry, amount: "-1" }).expect(400);
  await send("delete", "/data", {
    password,
    confirmation: "BORRAR MIS DATOS",
  }).expect(200);
  assert.equal((await agent.get("/api/cash-entries")).body.length, 0);
});

test("noticias incluyen VOO como tenencia inicial y usan mercado si no hay titulares del ETF", async (t) => {
  const db = await testDb();
  t.after(() => db.end());
  await migrate(db, "test-hash");
  await db.query(
    "INSERT INTO initial_holdings(symbol,quantity,total_cost) VALUES ('VOO',0.94826,662.44)",
  );
  await db.query("INSERT INTO watchlist(symbol) VALUES ('VOO')");
  const calls = [];
  let companyNews = [];
  const general = [
    {
      id: 1,
      headline: "Titular de mercado de prueba",
      datetime: 10,
      url: "https://example.com/news",
    },
  ];
  const app = express();
  app.use(
    advisorRouter(
      db,
      {},
      {
        news: async (symbol) => {
          calls.push(symbol || "general");
          return { data: symbol ? companyNews : general, stale: false };
        },
      },
    ),
  );
  const fallback = (
    await request(app).get("/news?filter=portfolio").expect(200)
  ).body;
  assert.deepEqual(fallback.symbols, ["VOO"]);
  assert.equal(fallback.fallback, true);
  assert.equal(fallback.data[0].id, 1);
  assert.deepEqual(calls, ["VOO", "general"]);
  companyNews = [{ id: 2, headline: "Titular VOO de prueba", datetime: 11 }];
  const specific = (
    await request(app).get("/news?filter=portfolio").expect(200)
  ).body;
  assert.equal(specific.data[0].id, 2);
  assert.equal(specific.message, null);
});
