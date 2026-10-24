import { Router } from "express";
import { z } from "zod";
import {
  D,
  money,
  sum,
  portfolio,
  idSchema,
  symbolSchema,
  amountSchema,
  nonnegative,
  pastDate,
  fail,
  today,
} from "../lib.js";
export async function investments(db) {
  const trades = (
    await db.query("SELECT *,date::text FROM trades ORDER BY trades.date,id")
  ).rows;
  const quotes = Object.fromEntries(
    (await db.query("SELECT * FROM quote_cache")).rows.map((q) => [
      q.symbol,
      q,
    ]),
  );
  const positions = portfolio(trades, quotes);
  const value = sum(positions.map((p) => p.value));
  return {
    positions: positions.map((p) => ({
      ...p,
      weight: value.gt(0) ? D(p.value).div(value).mul(100).toNumber() : 0,
    })),
    trades,
    value: money(value),
    realized: money(sum(positions.map((p) => p.realized))),
    unrealized: money(sum(positions.map((p) => p.unrealized))),
    cost: money(sum(positions.map((p) => p.cost))),
  };
}
export function investmentRouter(db, market) {
  const r = Router();
  r.get("/investments", async (req, res) => res.json(await investments(db)));
  r.post("/trades", async (req, res) => {
    const v = z
      .object({
        symbol: symbolSchema,
        side: z.enum(["buy", "sell"]),
        quantity: z
          .string()
          .regex(/^\d{1,12}(\.\d{1,8})?$/)
          .pipe(z.string().refine((v) => D(v).gt(0))),
        price: amountSchema,
        fee: nonnegative,
        account_id: idSchema,
        date: pastDate,
      })
      .strict()
      .parse(req.body);
    const result = await db.tx(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(71622)");
      const rows = (
        await c.query("SELECT *,date::text FROM trades ORDER BY trades.date,id")
      ).rows;
      portfolio([...rows, { ...v, id: 2147483647 }]);
      return (
        await c.query(
          "INSERT INTO trades(symbol,side,quantity,price,fee,date,account_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
          [v.symbol, v.side, v.quantity, v.price, v.fee, v.date, v.account_id],
        )
      ).rows[0];
    });
    res.status(201).json(result);
  });
  r.delete("/trades/:id", async (req, res) => {
    const id = idSchema.parse(req.params.id);
    await db.tx(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(71622)");
      const rows = (
        await c.query("SELECT *,date::text FROM trades ORDER BY trades.date,id")
      ).rows;
      if (!rows.some((t) => t.id === id))
        throw fail("Operación no encontrada.", 404);
      portfolio(rows.filter((t) => t.id !== id));
      await c.query("DELETE FROM trades WHERE id=$1", [id]);
    });
    res.json({ ok: true });
  });
  r.get("/watchlist", async (req, res) =>
    res.json(
      (
        await db.query(
          "SELECT w.*,q.data,q.updated_at FROM watchlist w LEFT JOIN quote_cache q ON q.symbol=w.symbol ORDER BY w.symbol",
        )
      ).rows,
    ),
  );
  r.post("/watchlist", async (req, res) => {
    const v = z
      .object({
        symbol: symbolSchema,
        target: amountSchema.nullable(),
        direction: z.enum(["below", "above"]),
      })
      .strict()
      .parse(req.body);
    await db.query(
      "INSERT INTO watchlist(symbol,target,direction) VALUES ($1,$2,$3) ON CONFLICT(symbol) DO UPDATE SET target=EXCLUDED.target,direction=EXCLUDED.direction",
      [v.symbol, v.target, v.direction],
    );
    res.json({ ok: true });
  });
  r.delete("/watchlist/:symbol", async (req, res) => {
    await db.query("DELETE FROM watchlist WHERE symbol=$1", [
      symbolSchema.parse(req.params.symbol),
    ]);
    res.json({ ok: true });
  });
  r.post("/quotes/refresh", async (req, res) =>
    res.json(await market.refresh()),
  );
  r.get("/stocks/:symbol", async (req, res) => {
    const symbol = symbolSchema.parse(req.params.symbol);
    const quote =
      (await db.query("SELECT * FROM quote_cache WHERE symbol=$1", [symbol]))
        .rows[0] || null;
    res.json({ symbol, quote, news: await market.news(symbol) });
  });
  return r;
}
