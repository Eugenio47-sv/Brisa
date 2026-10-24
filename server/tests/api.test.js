import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import bcrypt from "bcrypt";
import { testDb } from "./database.js";
import { migrate } from "../src/db/index.js";
import { createApp } from "../src/app.js";
import { runRecurring, snapshot } from "../src/jobs.js";
import { today } from "../src/lib.js";
test("flujo completo de API con PostgreSQL embebido", async (t) => {
  const db = await testDb();
  t.after(() => db.end());
  const password = "Mi-Prueba-Segura-2026",
    hash = await bcrypt.hash(password, 4);
  await migrate(db, hash);
  await migrate(db, hash);
  const config = {
    JWT_SECRET: "test-secret-at-least-thirty-two-characters",
    NODE_ENV: "test",
    APP_ORIGIN: "http://localhost:5173",
    FINNHUB_API_KEY: "",
    ANTHROPIC_API_KEY: "",
  };
  const { app } = createApp(db, config),
    agent = request.agent(app);
  const send = (method, path, body) =>
    agent[method]("/api" + path)
      .set("Origin", config.APP_ORIGIN)
      .send(body);
  await request(app).get("/api/dashboard").expect(401);
  await request(app).post("/api/auth/login").send({ password }).expect(403);
  const login = await send("post", "/auth/login", { password }).expect(200);
  assert.match(login.headers["set-cookie"][0], /HttpOnly/);
  assert.match(login.headers["set-cookie"][0], /SameSite=Strict/);
  await agent.get("/api/auth/me").expect(200);
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
      opening_balance: "0",
    }).expect(201)
  ).body;
  const cats = (await agent.get("/api/categories").expect(200)).body;
  const expense = {
    type: "expense",
    amount: "10.10",
    category_id: cats[0].id,
    account_id: bank.id,
    method: "cash",
    note: "Café",
    date: today(),
  };
  const tr = (await send("post", "/transactions", expense).expect(201)).body;
  await send("post", "/transactions", { ...expense, amount: "-1" }).expect(400);
  for (const amount of ["", "abc", "NaN", "1e3"]) {
    await send("post", "/transactions", { ...expense, amount }).expect(400);
  }
  await send("post", "/transactions", {
    ...expense,
    date: "2026-02-30",
  }).expect(400);
  await send("put", "/transactions/" + tr.id, {
    ...expense,
    amount: "20.10",
  }).expect(200);
  await send("post", "/transfers", {
    from_id: bank.id,
    to_id: savings.id,
    amount: "200",
    date: today(),
  }).expect(201);
  const goal = (
    await send("post", "/goals", {
      name: "Viaje",
      target: "500",
      deadline: "2027-12-31",
    }).expect(201)
  ).body;
  await send("post", `/goals/${goal.id}/contributions`, {
    account_id: savings.id,
    amount: "300",
    date: today(),
  }).expect(400);
  await send("post", `/goals/${goal.id}/contributions`, {
    account_id: savings.id,
    amount: "150",
    date: today(),
  }).expect(201);
  const trade = {
    symbol: "AAPL",
    side: "buy",
    quantity: "2",
    price: "100",
    fee: "1",
    date: today(),
    account_id: bank.id,
  };
  await send("post", "/trades", { ...trade, quantity: "abc" }).expect(400);
  await send("post", `/goals/${goal.id}/contributions`, {
    account_id: savings.id,
    amount: "abc",
    date: today(),
  }).expect(400);
  const buy = (await send("post", "/trades", trade).expect(201)).body;
  await send("post", "/trades", {
    ...trade,
    side: "sell",
    quantity: "3",
  }).expect(400);
  const sale = (
    await send("post", "/trades", {
      ...trade,
      side: "sell",
      quantity: "1",
      price: "120",
    }).expect(201)
  ).body;
  await send("delete", "/trades/" + buy.id).expect(400);
  await send("post", "/budgets", {
    month: today().slice(0, 7),
    category_id: null,
    amount: "100",
  }).expect(200);
  await send("post", "/budgets", {
    month: today().slice(0, 7),
    category_id: null,
    amount: "120",
  }).expect(200);
  await send("post", "/recurring", {
    type: "expense",
    amount: "5",
    category_id: cats[0].id,
    account_id: bank.id,
    note: "Suscripción",
    period: "monthly",
    next_date: today(),
  }).expect(201);
  await runRecurring(db);
  await runRecurring(db);
  const count = (
    await db.query(
      "SELECT count(*) FROM transactions WHERE recurring_id IS NOT NULL",
    )
  ).rows[0].count;
  assert.equal(Number(count), 1);
  const dash = (await agent.get("/api/dashboard").expect(200)).body;
  assert.equal(dash.spent, "25.10");
  assert.equal(dash.investments.realized, "18.50");
  assert.equal(dash.net_worth, "993.40");
  assert.equal(dash.budgets.length, 1);
  await snapshot(db);
  await snapshot(db);
  assert.equal(
    Number((await db.query("SELECT count(*) FROM snapshots")).rows[0].count),
    1,
  );
  await agent.get("/api/transactions?q=Caf&min=10").expect(200);
  await agent.get("/api/goals").expect(200);
  await agent.get("/api/transfers").expect(200);
  await agent.get("/api/investments").expect(200);
  await send("post", "/watchlist", {
    symbol: "MSFT",
    target: "100",
    direction: "below",
  }).expect(200);
  await agent.get("/api/watchlist").expect(200);
  await agent.get("/api/stocks/MSFT").expect(200);
  await agent.get("/api/news?filter=portfolio").expect(200);
  const exported = (await agent.get("/api/export?format=json").expect(200))
    .body;
  assert.ok(exported.transactions);
  assert.equal(exported.settings, undefined);
  await agent.get("/api/export?format=csv").expect(200);
  await agent.get("/api/transactions.csv").expect(200);
  const csv = `type,amount,category_id,subcategory,account_id,method,note,date\nincome,10,, ,${bank.id},bank,Importado,${today()}`;
  await send("post", "/import", { csv }).expect(200);
  await send("post", "/advisor", {
    messages: [{ role: "user", content: "Hola" }],
    consent: true,
  }).expect(503);
  await send("post", "/auth/password", {
    current: password,
    password: "Nueva-Contrasena-2026",
  }).expect(200);
  await agent.get("/api/dashboard").expect(401);
  await send("post", "/auth/login", {
    password: "Nueva-Contrasena-2026",
  }).expect(200);
  await send("delete", "/data", {
    password: "incorrecta",
    confirmation: "BORRAR MIS DATOS",
  }).expect(403);
  await send("delete", "/data", {
    password: "Nueva-Contrasena-2026",
    confirmation: "BORRAR MIS DATOS",
  }).expect(200);
  assert.equal(
    (await agent.get("/api/dashboard").expect(200)).body.net_worth,
    "0.00",
  );
  await send("post", "/auth/logout", {}).expect(200);
  await agent.get("/api/auth/me").expect(401);
});
