import { Router } from "express";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import {
  amountSchema,
  nonnegative,
  idSchema,
  pastDate,
  dateSchema,
  monthSchema,
  fail,
  csvCell,
  today,
  D,
} from "../lib.js";
export const transactionSchema = z
  .object({
    type: z.enum(["expense", "income"]),
    amount: amountSchema,
    category_id: idSchema.nullable().default(null),
    subcategory: z.string().trim().max(80).default(""),
    account_id: idSchema,
    method: z.enum(["cash", "card", "bank", "transfer"]).default("bank"),
    note: z.string().trim().max(500).default(""),
    date: pastDate,
  })
  .strict();
export async function insertTransaction(c, v, recurring = null) {
  return (
    await c.query(
      "INSERT INTO transactions(type,amount,category_id,subcategory,account_id,method,note,date,recurring_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(recurring_id,date) DO NOTHING RETURNING *",
      [
        v.type,
        v.amount,
        v.category_id,
        v.subcategory || "",
        v.account_id,
        v.method || "bank",
        v.note,
        v.date,
        recurring,
      ],
    )
  ).rows[0];
}
export async function accounts(db) {
  return (
    await db.query(
      `SELECT a.*, (a.opening_balance
    + COALESCE((SELECT sum(CASE WHEN type='income' THEN amount ELSE -amount END) FROM transactions WHERE account_id=a.id),0)
    + COALESCE((SELECT sum(amount) FROM transfers WHERE to_id=a.id),0)
    - COALESCE((SELECT sum(amount) FROM transfers WHERE from_id=a.id),0)
    + COALESCE((SELECT sum(CASE WHEN side='sell' THEN round(quantity*price-fee,2) ELSE -round(quantity*price+fee,2) END) FROM trades WHERE account_id=a.id),0)
    + COALESCE((SELECT sum(amount) FROM dividends WHERE account_id=a.id AND date <= $1::date),0))::text AS balance
    FROM accounts a ORDER BY a.id`,
      [today()],
    )
  ).rows;
}
export function ledgerRouter(db) {
  const r = Router();
  r.get("/accounts", async (req, res) => res.json(await accounts(db)));
  const accountSchema = z
    .object({
      name: z.string().trim().min(1).max(80),
      type: z.enum(["bank", "cash", "savings", "emergency", "credit"]),
      opening_balance: z.string().regex(/^-?\d{1,12}(\.\d{1,2})?$/),
    })
    .strict();
  r.post("/accounts", async (req, res) => {
    const v = accountSchema.parse(req.body);
    res
      .status(201)
      .json(
        (
          await db.query(
            "INSERT INTO accounts(name,type,opening_balance) VALUES ($1,$2,$3) RETURNING *",
            [v.name, v.type, v.opening_balance],
          )
        ).rows[0],
      );
  });
  r.put("/accounts/:id", async (req, res) => {
    const v = accountSchema.parse(req.body);
    const q = await db.query(
      "UPDATE accounts SET name=$1,type=$2,opening_balance=$3 WHERE id=$4 RETURNING *",
      [v.name, v.type, v.opening_balance, idSchema.parse(req.params.id)],
    );
    if (!q.rows.length) throw fail("Cuenta no encontrada.", 404);
    res.json(q.rows[0]);
  });
  r.delete("/accounts/:id", async (req, res) => {
    const id = idSchema.parse(req.params.id);
    try {
      const q = await db.query(
        "DELETE FROM accounts WHERE id=$1 RETURNING id",
        [id],
      );
      if (!q.rows.length) throw fail("Cuenta no encontrada.", 404);
    } catch (e) {
      if (e.code === "23503")
        throw fail(
          "Esta cuenta tiene movimientos, inversiones o ahorros asociados. Edita o elimina esos registros primero; no se borrará tu historial automáticamente.",
        );
      throw e;
    }
    res.json({ ok: true });
  });
  async function saveTransfer(req, res) {
    const v = z
      .object({
        from_id: idSchema,
        to_id: idSchema,
        amount: amountSchema,
        date: pastDate,
      })
      .strict()
      .refine((v) => v.from_id !== v.to_id, "Elige dos cuentas diferentes")
      .parse(req.body);
    if (req.params.id) {
      const q = await db.query(
        "UPDATE transfers SET from_id=$1,to_id=$2,amount=$3,date=$4 WHERE id=$5 RETURNING *",
        [v.from_id, v.to_id, v.amount, v.date, idSchema.parse(req.params.id)],
      );
      if (!q.rows.length) throw fail("Transferencia no encontrada.", 404);
      return res.json(q.rows[0]);
    }
    res
      .status(201)
      .json(
        (
          await db.query(
            "INSERT INTO transfers(from_id,to_id,amount,date) VALUES ($1,$2,$3,$4) RETURNING *",
            [v.from_id, v.to_id, v.amount, v.date],
          )
        ).rows[0],
      );
  }
  r.post("/transfers", saveTransfer);
  r.put("/transfers/:id", saveTransfer);
  r.get("/transfers", async (req, res) =>
    res.json(
      (
        await db.query(
          "SELECT t.*,a.name AS from_name,b.name AS to_name FROM transfers t JOIN accounts a ON a.id=t.from_id JOIN accounts b ON b.id=t.to_id ORDER BY date DESC,id DESC LIMIT 500",
        )
      ).rows,
    ),
  );
  r.delete("/transfers/:id", async (req, res) => {
    const q = await db.query("DELETE FROM transfers WHERE id=$1 RETURNING id", [
      idSchema.parse(req.params.id),
    ]);
    if (!q.rows.length) throw fail("Transferencia no encontrada.", 404);
    res.json({ ok: true });
  });
  r.get("/categories", async (req, res) =>
    res.json((await db.query("SELECT * FROM categories ORDER BY id")).rows),
  );
  const catSchema = z
    .object({
      name: z.string().trim().min(1).max(60),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      icon: z.string().min(1).max(20),
      bucket: z.enum(["needs", "wants", "savings"]),
    })
    .strict();
  r.post("/categories", async (req, res) => {
    const v = catSchema.parse(req.body);
    res
      .status(201)
      .json(
        (
          await db.query(
            "INSERT INTO categories(name,color,icon,bucket) VALUES ($1,$2,$3,$4) RETURNING *",
            [v.name, v.color, v.icon, v.bucket],
          )
        ).rows[0],
      );
  });
  r.put("/categories/:id", async (req, res) => {
    const v = catSchema.parse(req.body);
    const q = await db.query(
      "UPDATE categories SET name=$1,color=$2,icon=$3,bucket=$4 WHERE id=$5 RETURNING *",
      [v.name, v.color, v.icon, v.bucket, idSchema.parse(req.params.id)],
    );
    if (!q.rows.length) throw fail("Categoría no encontrada.", 404);
    res.json(q.rows[0]);
  });
  r.delete("/categories/:id", async (req, res) => {
    const q = await db.query(
      "DELETE FROM categories WHERE id=$1 RETURNING id",
      [idSchema.parse(req.params.id)],
    );
    if (!q.rows.length) throw fail("Categoría no encontrada.", 404);
    res.json({ ok: true });
  });
  r.get("/transactions", async (req, res) => {
    const v = z
      .object({
        page: z.coerce.number().int().min(1).max(100000).default(1),
        q: z.string().max(200).default(""),
        from: dateSchema.optional(),
        to: dateSchema.optional(),
        category: idSchema.optional(),
        min: nonnegative.optional(),
        max: nonnegative.optional(),
        method: z.enum(["cash", "card", "bank", "transfer"]).optional(),
        type: z.enum(["income", "expense"]).optional(),
      })
      .strict()
      .parse(req.query);
    const params = [
      v.q ? `%${v.q}%` : null,
      v.from || null,
      v.to || null,
      v.category || null,
      v.min || null,
      v.max || null,
      v.method || null,
      v.type || null,
    ];
    const where = `WHERE ($1::text IS NULL OR t.note ILIKE $1 OR c.name ILIKE $1 OR t.subcategory ILIKE $1) AND ($2::date IS NULL OR t.date >= $2) AND ($3::date IS NULL OR t.date <= $3) AND ($4::int IS NULL OR t.category_id=$4) AND ($5::numeric IS NULL OR t.amount >= $5) AND ($6::numeric IS NULL OR t.amount <= $6) AND ($7::text IS NULL OR t.method=$7) AND ($8::text IS NULL OR t.type=$8)`;
    const rows = await db.query(
      `SELECT t.*,c.name AS category,c.icon,c.color,a.name AS account FROM transactions t LEFT JOIN categories c ON c.id=t.category_id JOIN accounts a ON a.id=t.account_id ${where} ORDER BY t.date DESC,t.id DESC LIMIT 25 OFFSET $9`,
      [...params, (v.page - 1) * 25],
    );
    const count = await db.query(
      `SELECT count(*) FROM transactions t LEFT JOIN categories c ON c.id=t.category_id ${where}`,
      params,
    );
    res.json({
      rows: rows.rows,
      total: Number(count.rows[0].count),
      page: v.page,
    });
  });
  r.post("/transactions", async (req, res) =>
    res
      .status(201)
      .json(await insertTransaction(db, transactionSchema.parse(req.body))),
  );
  r.put("/transactions/:id", async (req, res) => {
    const v = transactionSchema.parse(req.body);
    const q = await db.query(
      "UPDATE transactions SET type=$1,amount=$2,category_id=$3,subcategory=$4,account_id=$5,method=$6,note=$7,date=$8 WHERE id=$9 RETURNING *",
      [
        v.type,
        v.amount,
        v.category_id,
        v.subcategory,
        v.account_id,
        v.method,
        v.note,
        v.date,
        idSchema.parse(req.params.id),
      ],
    );
    if (!q.rows.length) throw fail("Movimiento no encontrado.", 404);
    res.json(q.rows[0]);
  });
  r.delete("/transactions/:id", async (req, res) => {
    const q = await db.query(
      "DELETE FROM transactions WHERE id=$1 RETURNING id",
      [idSchema.parse(req.params.id)],
    );
    if (!q.rows.length) throw fail("Movimiento no encontrado.", 404);
    res.json({ ok: true });
  });
  r.get("/budgets", async (req, res) => {
    const month = monthSchema.parse(req.query.month || today().slice(0, 7));
    res.json(
      (
        await db.query(
          "SELECT b.*,c.name AS category FROM budgets b LEFT JOIN categories c ON c.id=b.category_id WHERE month=$1",
          [month],
        )
      ).rows,
    );
  });
  r.post("/budgets", async (req, res) => {
    const v = z
      .object({
        month: monthSchema,
        category_id: idSchema.nullable(),
        amount: amountSchema,
      })
      .strict()
      .parse(req.body);
    res.json(
      (
        await db.query(
          "INSERT INTO budgets(month,category_id,amount) VALUES ($1,$2,$3) ON CONFLICT(month,COALESCE(category_id,0)) DO UPDATE SET amount=EXCLUDED.amount RETURNING *",
          [v.month, v.category_id, v.amount],
        )
      ).rows[0],
    );
  });
  r.delete("/budgets/:id", async (req, res) => {
    await db.query("DELETE FROM budgets WHERE id=$1", [
      idSchema.parse(req.params.id),
    ]);
    res.json({ ok: true });
  });
  r.get("/recurring", async (req, res) =>
    res.json(
      (
        await db.query(
          "SELECT r.*,a.name AS account FROM recurring_rules r JOIN accounts a ON a.id=r.account_id ORDER BY r.next_date",
        )
      ).rows,
    ),
  );
  async function saveRecurring(req, res) {
    const v = transactionSchema
      .omit({ date: true, method: true, subcategory: true })
      .extend({
        next_date: dateSchema,
        period: z.enum(["weekly", "monthly", "yearly"]),
      })
      .parse(req.body);
    if (req.params.id) {
      const q = await db.query(
        "UPDATE recurring_rules SET type=$1,amount=$2,category_id=$3,account_id=$4,note=$5,period=$6,next_date=$7,anchor_day=$8 WHERE id=$9 RETURNING *",
        [
          v.type,
          v.amount,
          v.category_id,
          v.account_id,
          v.note,
          v.period,
          v.next_date,
          Number(v.next_date.slice(8)),
          idSchema.parse(req.params.id),
        ],
      );
      if (!q.rows.length) throw fail("Recurrencia no encontrada.", 404);
      return res.json(q.rows[0]);
    }
    res
      .status(201)
      .json(
        (
          await db.query(
            "INSERT INTO recurring_rules(type,amount,category_id,account_id,note,period,next_date,anchor_day) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
            [
              v.type,
              v.amount,
              v.category_id,
              v.account_id,
              v.note,
              v.period,
              v.next_date,
              Number(v.next_date.slice(8)),
            ],
          )
        ).rows[0],
      );
  }
  r.post("/recurring", saveRecurring);
  r.put("/recurring/:id", saveRecurring);
  r.delete("/recurring/:id", async (req, res) => {
    const q = await db.query(
      "DELETE FROM recurring_rules WHERE id=$1 RETURNING id",
      [idSchema.parse(req.params.id)],
    );
    if (!q.rows.length) throw fail("Recurrencia no encontrada.", 404);
    res.json({ ok: true });
  });
  r.patch("/recurring/:id", async (req, res) => {
    const v = z.object({ active: z.boolean() }).strict().parse(req.body);
    await db.query("UPDATE recurring_rules SET active=$1 WHERE id=$2", [
      v.active,
      idSchema.parse(req.params.id),
    ]);
    res.json({ ok: true });
  });
  r.get("/transactions.csv", async (req, res) => {
    const rows = (
      await db.query(
        "SELECT type,amount,category_id,subcategory,account_id,method,note,date::text FROM transactions ORDER BY date,id",
      )
    ).rows;
    const headers = [
      "type",
      "amount",
      "category_id",
      "subcategory",
      "account_id",
      "method",
      "note",
      "date",
    ];
    res
      .type("text/csv")
      .attachment("movimientos.csv")
      .send(
        "\uFEFF" +
          [
            headers.join(","),
            ...rows.map((v) => headers.map((h) => csvCell(v[h])).join(",")),
          ].join("\r\n"),
      );
  });
  r.post("/import", async (req, res) => {
    const { csv } = z
      .object({ csv: z.string().min(1).max(800000) })
      .strict()
      .parse(req.body);
    let rows;
    try {
      rows = parse(csv, {
        columns: true,
        bom: true,
        skip_empty_lines: true,
        max_record_size: 2000,
      });
    } catch {
      throw fail("CSV inválido. Revisa el formato y los encabezados.");
    }
    if (rows.length > 2000)
      throw fail("Importa como máximo 2000 filas a la vez.");
    const items = rows.map((v, i) => {
      const p = transactionSchema.safeParse({
        ...v,
        category_id: v.category_id || null,
      });
      if (!p.success) throw fail(`Fila ${i + 2}: ${p.error.issues[0].message}`);
      return p.data;
    });
    await db.tx(async (c) => {
      for (const v of items) await insertTransaction(c, v);
    });
    res.json({ imported: items.length });
  });
  return r;
}
