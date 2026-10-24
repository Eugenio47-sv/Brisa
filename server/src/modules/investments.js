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
  dateSchema,
  fail,
  today,
} from "../lib.js";
async function initialTrades(db) {
  return (
    await db.query("SELECT * FROM initial_holdings ORDER BY symbol")
  ).rows.map((h, i) => ({
    symbol: h.symbol,
    quantity: h.quantity,
    price: h.total_cost ? D(h.total_cost).div(h.quantity).toString() : "0",
    fee: "0",
    side: "buy",
    date: "0001-01-01",
    id: -2147483647 + i,
    cost_unknown: !h.total_cost,
  }));
}
export async function investments(db) {
  const initialHoldings = (
    await db.query("SELECT * FROM initial_holdings ORDER BY symbol")
  ).rows;
  const dividends = (
    await db.query(
      "SELECT d.*,d.date::text,a.name AS account FROM dividends d JOIN accounts a ON a.id=d.account_id ORDER BY d.date DESC,d.id DESC",
    )
  ).rows.map((d) => ({ ...d, paid: d.date <= today() }));
  const paidDividends = sum(
    dividends.filter((d) => d.paid).map((d) => d.amount),
  );
  const trades = (
    await db.query("SELECT *,date::text FROM trades ORDER BY trades.date,id")
  ).rows;
  const quotes = Object.fromEntries(
    (await db.query("SELECT * FROM quote_cache")).rows.map((q) => [
      q.symbol,
      q,
    ]),
  );
  const positions = portfolio(
    [...(await initialTrades(db)), ...trades],
    quotes,
  );
  const value = sum(positions.map((p) => p.value ?? "0"));
  return {
    positions: positions.map((p) => ({
      ...p,
      weight: value.gt(0) ? D(p.value).div(value).mul(100).toNumber() : 0,
    })),
    trades,
    initial_holdings: initialHoldings,
    cost_incomplete: positions.some((p) => p.cost_unknown),
    value_incomplete: positions.some((p) => p.value === null),
    dividends,
    dividends_total: money(paidDividends),
    dividends_pending: money(
      sum(dividends.filter((d) => !d.paid).map((d) => d.amount)),
    ),
    value: money(value),
    realized: money(
      sum(positions.map((p) => p.realized ?? "0")).plus(paidDividends),
    ),
    unrealized: money(sum(positions.map((p) => p.unrealized ?? "0"))),
    cost: money(sum(positions.map((p) => p.cost ?? "0"))),
  };
}
export function investmentRouter(db, market) {
  const r = Router();
  r.put("/initial-holdings/:symbol", async (req, res) => {
    const symbol = symbolSchema.parse(req.params.symbol);
    const v = z
      .object({
        quantity: z
          .string()
          .regex(/^\d{1,12}(\.\d{1,8})?$/)
          .pipe(z.string().refine((v) => D(v).gt(0))),
        total_cost: amountSchema.nullable(),
      })
      .strict()
      .parse(req.body);
    await db.tx(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(71622)");
      await c.query(
        "INSERT INTO initial_holdings(symbol,quantity,total_cost) VALUES ($1,$2,$3) ON CONFLICT(symbol) DO UPDATE SET quantity=EXCLUDED.quantity,total_cost=EXCLUDED.total_cost",
        [symbol, v.quantity, v.total_cost],
      );
      portfolio([
        ...(await initialTrades(c)),
        ...(
          await c.query(
            "SELECT *,date::text FROM trades ORDER BY trades.date,id",
          )
        ).rows,
      ]);
    });
    res.json({ ok: true });
  });
  r.delete("/positions/:symbol", async (req, res) => {
    const symbol = symbolSchema.parse(req.params.symbol);
    await db.tx(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(71622)");
      await c.query("DELETE FROM trades WHERE symbol=$1", [symbol]);
      await c.query("DELETE FROM dividends WHERE symbol=$1", [symbol]);
      await c.query("DELETE FROM initial_holdings WHERE symbol=$1", [symbol]);
      await c.query("DELETE FROM watchlist WHERE symbol=$1", [symbol]);
      await c.query("DELETE FROM quote_cache WHERE symbol=$1", [symbol]);
    });
    res.json({ ok: true });
  });
  const dividendSchema = z
    .object({
      symbol: symbolSchema,
      amount: amountSchema,
      date: dateSchema,
      account_id: idSchema,
      note: z.string().trim().max(500).default(""),
    })
    .strict();
  async function saveDividend(req, res) {
    const v = dividendSchema.parse(req.body);
    const id = req.params.id ? idSchema.parse(req.params.id) : null;
    const q = id
      ? await db.query(
          "UPDATE dividends SET symbol=$1,amount=$2,date=$3,account_id=$4,note=$5 WHERE id=$6 RETURNING *",
          [v.symbol, v.amount, v.date, v.account_id, v.note, id],
        )
      : await db.query(
          "INSERT INTO dividends(symbol,amount,date,account_id,note) VALUES ($1,$2,$3,$4,$5) RETURNING *",
          [v.symbol, v.amount, v.date, v.account_id, v.note],
        );
    if (!q.rows.length) throw fail("Dividendo no encontrado.", 404);
    res.status(id ? 200 : 201).json(q.rows[0]);
  }
  r.post("/dividends", saveDividend);
  r.put("/dividends/:id", saveDividend);
  r.delete("/dividends/:id", async (req, res) => {
    const q = await db.query("DELETE FROM dividends WHERE id=$1 RETURNING id", [
      idSchema.parse(req.params.id),
    ]);
    if (!q.rows.length) throw fail("Dividendo no encontrado.", 404);
    res.json({ ok: true });
  });
  r.get("/stocks/search", async (req, res) => {
    const query = z.string().trim().min(2).max(80).parse(req.query.q);
    res.json(await market.search(query));
  });
  r.get("/stocks/:symbol/quote", async (req, res) => {
    res.json(await market.quote(symbolSchema.parse(req.params.symbol)));
  });
  r.get("/investments", async (req, res) => res.json(await investments(db)));
  async function saveTrade(req, res) {
    const id = req.params.id ? idSchema.parse(req.params.id) : null;
    const v = z
      .object({
        symbol: symbolSchema,
        side: z.enum(["buy", "sell"]),
        quantity: z
          .string()
          .regex(/^\d{1,12}(\.\d{1,8})?$/)
          .pipe(z.string().refine((v) => D(v).gt(0))),
        price: z
          .string()
          .regex(/^\d{1,18}(\.\d{1,12})?$/)
          .pipe(z.string().refine((v) => D(v).gt(0)))
          .optional(),
        total: amountSchema.optional(),
        fee: nonnegative,
        account_id: idSchema,
        date: pastDate,
      })
      .strict()
      .parse(req.body);
    if (v.total) {
      const gross =
        v.side === "buy" ? D(v.total).minus(v.fee) : D(v.total).plus(v.fee);
      if (!gross.gt(0))
        throw fail("El total de compra debe superar la comisión.");
      v.price = gross.div(v.quantity).toFixed(24);
    }
    if (!v.price || !D(v.price).gt(0))
      throw fail("Indica el importe total de la operación.");
    const result = await db.tx(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(71622)");
      const rows = (
        await c.query("SELECT *,date::text FROM trades ORDER BY trades.date,id")
      ).rows;
      if (id && !rows.some((t) => t.id === id))
        throw fail("Operación no encontrada.", 404);
      portfolio([
        ...(await initialTrades(c)),
        ...rows.filter((t) => t.id !== id),
        { ...v, id: id || 2147483647 },
      ]);
      if (id)
        return (
          await c.query(
            "UPDATE trades SET symbol=$1,side=$2,quantity=$3,price=$4,fee=$5,date=$6,account_id=$7 WHERE id=$8 RETURNING *",
            [
              v.symbol,
              v.side,
              v.quantity,
              v.price,
              v.fee,
              v.date,
              v.account_id,
              id,
            ],
          )
        ).rows[0];
      return (
        await c.query(
          "INSERT INTO trades(symbol,side,quantity,price,fee,date,account_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
          [v.symbol, v.side, v.quantity, v.price, v.fee, v.date, v.account_id],
        )
      ).rows[0];
    });
    res.status(id ? 200 : 201).json(result);
  }
  r.post("/trades", saveTrade);
  r.put("/trades/:id", saveTrade);
  r.delete("/trades/:id", async (req, res) => {
    const id = idSchema.parse(req.params.id);
    await db.tx(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(71622)");
      const rows = (
        await c.query("SELECT *,date::text FROM trades ORDER BY trades.date,id")
      ).rows;
      if (!rows.some((t) => t.id === id))
        throw fail("Operación no encontrada.", 404);
      portfolio([
        ...(await initialTrades(c)),
        ...rows.filter((t) => t.id !== id),
      ]);
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
