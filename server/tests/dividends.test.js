import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import bcrypt from "bcrypt";
import { testDb } from "./database.js";
import { migrate } from "../src/db/index.js";
import { createApp } from "../src/app.js";
import { today } from "../src/lib.js";
import { snapshot } from "../src/jobs.js";

test("dividendos aplican por fecha una sola vez, permiten correcciones y se borran sin perder acceso", async (t) => {
  const db = await testDb();
  t.after(() => db.end());
  const password = "Mi-Clave-Segura-Dividendos";
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
  const account = (
    await send("post", "/accounts", {
      name: "Banco",
      type: "bank",
      opening_balance: "1000",
    }).expect(201)
  ).body;
  const other = (
    await send("post", "/accounts", {
      name: "Otro banco",
      type: "bank",
      opening_balance: "0",
    }).expect(201)
  ).body;
  const entry = {
    symbol: "aapl",
    amount: "1.25",
    date: today(),
    account_id: account.id,
    note: "Importe neto",
  };
  const paid = (await send("post", "/dividends", entry).expect(201)).body;
  assert.equal(paid.symbol, "AAPL");
  const futureDate = new Date(Date.parse(today()) + 5 * 86400000)
    .toISOString()
    .slice(0, 10);
  const pending = (
    await send("post", "/dividends", {
      ...entry,
      date: futureDate,
      amount: "5.00",
    }).expect(201)
  ).body;
  for (let i = 0; i < 2; i++) {
    const dashboard = (await agent.get("/api/dashboard").expect(200)).body;
    assert.equal(dashboard.net_worth, "1001.25");
    assert.equal(dashboard.income, "1.25");
    assert.equal(dashboard.investments.dividends_total, "1.25");
    assert.equal(dashboard.investments.dividends_pending, "5.00");
    assert.equal(dashboard.investments.realized, "1.25");
  }
  await snapshot(db);
  assert.equal(
    (await db.query("SELECT profit::text FROM snapshots")).rows[0].profit,
    "1.25",
  );
  await send("put", "/dividends/" + paid.id, {
    ...entry,
    amount: "2.50",
    account_id: other.id,
  }).expect(200);
  const accounts = (await agent.get("/api/accounts").expect(200)).body;
  assert.equal(accounts.find((a) => a.id === account.id).balance, "1000.00");
  assert.equal(accounts.find((a) => a.id === other.id).balance, "2.50");
  await send("put", "/dividends/" + pending.id, {
    ...entry,
    amount: "5.00",
  }).expect(200);
  assert.equal(
    (await agent.get("/api/investments")).body.dividends_total,
    "7.50",
  );
  await send("delete", "/dividends/" + paid.id).expect(200);
  assert.equal((await agent.get("/api/investments")).body.realized, "5.00");
  const exported = (await agent.get("/api/export?format=json").expect(200))
    .body;
  assert.equal(exported.dividends.length, 1);
  await send("post", "/dividends", { ...entry, amount: "-1" }).expect(400);
  await send("put", "/dividends/2147483647", entry).expect(404);
  await send("delete", "/data", {
    password,
    confirmation: "BORRAR MIS DATOS",
  }).expect(200);
  const clean = (await agent.get("/api/dashboard").expect(200)).body;
  assert.equal(clean.net_worth, "0.00");
  assert.equal(clean.investments.dividends.length, 0);
  await send("post", "/auth/logout", {}).expect(200);
  await send("post", "/auth/login", { password }).expect(200);
});
