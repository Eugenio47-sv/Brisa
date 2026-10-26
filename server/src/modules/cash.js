import { Router } from "express";
import { z } from "zod";
import { amountSchema, pastDate, idSchema, D, fail } from "../lib.js";
import { accounts } from "./ledger.js";

export function cashRouter(db) {
  const r = Router();
  r.get("/cash-entries", async (req, res) =>
    res.json(
      (
        await db.query(
          "SELECT e.*,e.date::text,a.name AS account FROM savings_entries e JOIN accounts a ON a.id=e.account_id ORDER BY e.date DESC,e.id DESC LIMIT 500",
        )
      ).rows,
    ),
  );
  const schema = z
    .object({
      account_id: idSchema,
      direction: z.enum(["deposit", "withdraw"]),
      amount: amountSchema,
      date: pastDate,
      note: z.string().trim().max(500).default(""),
    })
    .strict();
  async function save(req, res) {
    const id = req.params.id ? idSchema.parse(req.params.id) : null;
    const v = req.method === "DELETE" ? null : schema.parse(req.body);
    await db.tx(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(71624)");
      let old;
      if (id) {
        old = (
          await c.query(
            "SELECT * FROM savings_entries WHERE id=$1 FOR UPDATE",
            [id],
          )
        ).rows[0];
        if (!old) throw fail("Registro de ahorro no encontrado.", 404);
      }
      if (v) {
        const account = (await accounts(c)).find((a) => a.id === v.account_id);
        if (!account || account.type === "credit")
          throw fail("Elige una cuenta bancaria o de efectivo.");
        const amount =
          v.direction === "withdraw"
            ? D(v.amount).negated().toFixed(2)
            : D(v.amount).toFixed(2);
        if (id)
          await c.query(
            "UPDATE savings_entries SET account_id=$1,amount=$2,date=$3,note=$4 WHERE id=$5",
            [v.account_id, amount, v.date, v.note, id],
          );
        else
          await c.query(
            "INSERT INTO savings_entries(account_id,amount,date,note) VALUES ($1,$2,$3,$4)",
            [v.account_id, amount, v.date, v.note],
          );
      } else await c.query("DELETE FROM savings_entries WHERE id=$1", [id]);
      for (const a of (await accounts(c)).filter((a) =>
        [old?.account_id, v?.account_id].includes(a.id),
      )) {
        const reserved = (
          await c.query(
            "SELECT COALESCE(sum(amount),0)::text AS amount FROM goal_contributions WHERE account_id=$1",
            [a.id],
          )
        ).rows[0].amount;
        if (D(a.balance).lt(0) || D(a.balance).lt(reserved))
          throw fail(
            "El cambio supera el saldo disponible o usa dinero reservado para metas. Libera ese ahorro primero.",
          );
      }
    });
    res.status(id ? 200 : 201).json({ ok: true });
  }
  r.post("/cash-entries", save);
  r.put("/cash-entries/:id", save);
  r.delete("/cash-entries/:id", save);
  return r;
}
