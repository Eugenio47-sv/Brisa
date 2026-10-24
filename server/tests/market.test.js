import test from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./database.js";
import { migrate } from "../src/db/index.js";
import { createMarket } from "../src/modules/market.js";

test("mercado: caché, fallos del proveedor y horario cerrado", async (t) => {
  const db = await testDb();
  t.after(() => db.end());
  await migrate(db, "test-only-hash");
  await db.query("INSERT INTO watchlist(symbol) VALUES ('AAPL')");
  let calls = [],
    unavailable = false,
    open = true;
  const market = createMarket(
    db,
    { FINNHUB_API_KEY: "test-key" },
    async (url, options) => {
      assert.equal(options.headers["X-Finnhub-Token"], "test-key");
      calls.push(url.pathname);
      if (unavailable) throw new Error("Proveedor temporalmente caído");
      let data;
      if (url.pathname.endsWith("/market-status")) data = { isOpen: open };
      else if (url.pathname.endsWith("/quote"))
        data = { c: 150, dp: -2, h: 155, l: 148 };
      else if (url.pathname.endsWith("/profile2"))
        data = { name: "Apple", finnhubIndustry: "Technology" };
      else
        data = [
          {
            id: 1,
            headline: "Noticia de prueba",
            datetime: 1,
            url: "https://example.com",
          },
        ];
      return { ok: true, json: async () => data };
    },
  );
  assert.equal((await market.refresh()).updated, 1);
  assert.equal((await market.refresh()).updated, 0);
  assert.equal(calls.filter((p) => p.endsWith("/quote")).length, 1);
  const first = await market.news("AAPL");
  assert.equal(first.stale, false);
  await market.news("AAPL");
  assert.equal(calls.filter((p) => p.endsWith("/company-news")).length, 1);
  await db.query(
    "UPDATE news_cache SET updated_at=now()-interval '1 hour' WHERE key='news:AAPL'",
  );
  unavailable = true;
  const stale = await market.news("AAPL");
  assert.equal(stale.stale, true);
  assert.equal(stale.data[0].id, 1);
  await db.query("DELETE FROM news_cache WHERE key='market-status'");
  const statusFailure = await market.refresh();
  assert.match(statusFailure.message, /verificar/);
  assert.equal(
    (await db.query("SELECT data FROM quote_cache")).rows[0].data.c,
    150,
  );
  unavailable = false;
  open = false;
  const closed = await market.refresh();
  assert.match(closed.message, /cerrado/);
  await db.query("DELETE FROM news_cache");
  for (let i = 0; i < 50; i++)
    await db.query("INSERT INTO api_calls DEFAULT VALUES");
  const limited = await market.news();
  assert.equal(limited.stale, true);
  assert.match(limited.message, /Límite preventivo/);
});
