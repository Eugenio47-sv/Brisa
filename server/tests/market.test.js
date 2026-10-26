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
    open = true,
    statusUnavailable = false,
    quotePrice = 150;
  const market = createMarket(
    db,
    { FINNHUB_API_KEY: "test-key" },
    async (url, options) => {
      assert.equal(options.headers["X-Finnhub-Token"], "test-key");
      calls.push(url.pathname);
      if (unavailable) throw new Error("Proveedor temporalmente caído");
      if (statusUnavailable && url.pathname.endsWith("/market-status"))
        throw new Error("Estado del mercado no disponible");
      let data;
      if (url.pathname.endsWith("/market-status")) data = { isOpen: open };
      else if (url.pathname.endsWith("/quote"))
        data = { c: quotePrice, dp: -2, h: 155, l: 148 };
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
  await db.query("UPDATE quote_cache SET updated_at=now()-interval '1 hour'");
  const statusFailure = await market.refresh();
  assert.equal(statusFailure.errors, 1);
  assert.equal(
    (await db.query("SELECT data FROM quote_cache")).rows[0].data.c,
    150,
  );
  unavailable = false;
  open = false;
  quotePrice = 151;
  const closed = await market.refresh();
  assert.equal(closed.updated, 1);
  assert.equal(closed.market_open, false);
  assert.equal(
    (await db.query("SELECT data FROM quote_cache")).rows[0].data.c,
    151,
  );
  await db.query("DELETE FROM news_cache WHERE key='market-status'");
  await db.query("UPDATE quote_cache SET updated_at=now()-interval '1 hour'");
  statusUnavailable = true;
  quotePrice = 152;
  const withoutStatus = await Promise.all([market.refresh(), market.refresh()]);
  assert.equal(withoutStatus[0].updated, 1);
  assert.equal(withoutStatus[0].market_open, null);
  assert.deepEqual(withoutStatus[0], withoutStatus[1]);
  assert.equal(
    (await db.query("SELECT data FROM quote_cache")).rows[0].data.c,
    152,
  );
  await db.query("DELETE FROM news_cache");
  for (let i = 0; i < 50; i++)
    await db.query("INSERT INTO api_calls DEFAULT VALUES");
  const limited = await market.news();
  assert.equal(limited.stale, true);
  assert.match(limited.message, /Límite preventivo/);
});
