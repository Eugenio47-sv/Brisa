import { Router } from "express";
import { z } from "zod";
import {
  amountSchema,
  dateSchema,
  pastDate,
  idSchema,
  fail,
  D,
  money,
  today,
} from "../lib.js";
import { accounts } from "./ledger.js";
function goalView(g) {
  const left = D(g.target).minus(g.saved);
  const days = Math.max(
    1,
    Math.ceil((Date.parse(g.deadline) - Date.parse(today())) / 86400000),
  );
  const remaining = left.gt(0) ? left : D(0);
  const elapsed = Math.max(0, Date.parse(today()) - Date.parse(g.created_at));
  const total = Math.max(
    86400000,
    Date.parse(g.deadline) - Date.parse(g.created_at),
  );
  return {
    ...g,
    weekly: money(remaining.mul(7).div(days)),
    monthly: money(remaining.mul(30.4375).div(days)),
    percent: D(g.saved).div(g.target).mul(100).toNumber(),
    behind: D(g.saved).lt(D(g.target).mul(Math.min(1, elapsed / total))),
  };
}
export async function getGoals(db) {
  return (
    await db.query(
      "SELECT g.*,g.deadline::text,g.created_at::text,COALESCE(sum(c.amount),0)::text AS saved,max(c.date)::text AS last_contribution FROM goals g LEFT JOIN goal_contributions c ON c.goal_id=g.id GROUP BY g.id ORDER BY g.deadline",
    )
  ).rows.map(goalView);
}
export function savingsRouter(db) {
  const r = Router();
  const schema = z
    .object({
      name: z.string().trim().min(1).max(80),
      target: amountSchema,
      deadline: dateSchema,
    })
    .strict();
  r.get("/goals", async (req, res) => res.json(await getGoals(db)));
  r.get("/contributions", async (req, res) =>
    res.json(
      (
        await db.query(
          "SELECT c.*,c.date::text,a.name AS account,g.name AS goal FROM goal_contributions c JOIN accounts a ON a.id=c.account_id JOIN goals g ON g.id=c.goal_id ORDER BY c.date DESC,c.id DESC",
        )
      ).rows,
    ),
  );
  async function changeContribution(req, res) {
    const id = idSchema.parse(req.params.id);
    const v =
      req.method === "DELETE"
        ? null
        : z
            .object({
              amount: z
                .string()
                .regex(/^-?\d{1,12}(\.\d{1,2})?$/)
                .pipe(z.string().refine((v) => !D(v).eq(0))),
              account_id: idSchema,
              date: pastDate,
            })
            .strict()
            .parse(req.body);
    await db.tx(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(71624)");
      const old = (
        await c.query("SELECT * FROM goal_contributions WHERE id=$1", [id])
      ).rows[0];
      if (!old) throw fail("Aporte no encontrado.", 404);
      if (v) {
        const account = (await accounts(c)).find((a) => a.id === v.account_id);
        if (!account || !["savings", "emergency"].includes(account.type))
          throw fail("Elige una cuenta de ahorro o fondo de emergencia.");
        await c.query(
          "UPDATE goal_contributions SET amount=$1,account_id=$2,date=$3 WHERE id=$4",
          [v.amount, v.account_id, v.date, id],
        );
      } else await c.query("DELETE FROM goal_contributions WHERE id=$1", [id]);
      const groups = (
        await c.query(
          "SELECT account_id,goal_id,sum(amount)::text AS total FROM goal_contributions GROUP BY account_id,goal_id",
        )
      ).rows;
      if (groups.some((g) => D(g.total).lt(0)))
        throw fail(
          "Esta corrección dejaría retiros mayores que los aportes. Corrige primero los retiros relacionados.",
        );
      for (const account of (await accounts(c)).filter((a) =>
        [old.account_id, v?.account_id].includes(a.id),
      )) {
        const allocated = groups
          .filter((g) => g.account_id === account.id)
          .reduce((s, g) => s.plus(g.total), D(0));
        if (allocated.gt(account.balance))
          throw fail("No hay saldo suficiente en la cuenta para este cambio.");
      }
    });
    res.json({ ok: true });
  }
  r.put("/contributions/:id", changeContribution);
  r.delete("/contributions/:id", changeContribution);
  r.post("/goals", async (req, res) => {
    const v = schema.parse(req.body);
    res
      .status(201)
      .json(
        (
          await db.query(
            "INSERT INTO goals(name,target,deadline,created_at) VALUES ($1,$2,$3,$4) RETURNING *",
            [v.name, v.target, v.deadline, today()],
          )
        ).rows[0],
      );
  });
  r.put("/goals/:id", async (req, res) => {
    const v = schema.parse(req.body);
    await db.query(
      "UPDATE goals SET name=$1,target=$2,deadline=$3 WHERE id=$4",
      [v.name, v.target, v.deadline, idSchema.parse(req.params.id)],
    );
    res.json({ ok: true });
  });
  r.delete("/goals/:id", async (req, res) => {
    await db.query("DELETE FROM goals WHERE id=$1", [
      idSchema.parse(req.params.id),
    ]);
    res.json({ ok: true });
  });
  r.post("/goals/:id/contributions", async (req, res) => {
    const v = z
      .object({
        amount: z
          .string()
          .regex(/^-?\d{1,12}(\.\d{1,2})?$/)
          .pipe(z.string().refine((v) => !D(v).eq(0))),
        account_id: idSchema,
        date: pastDate,
      })
      .strict()
      .parse(req.body);
    const id = idSchema.parse(req.params.id);
    await db.tx(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(71624)");
      const a = (await accounts(c)).find((a) => a.id === v.account_id);
      if (!a || !["savings", "emergency"].includes(a.type))
        throw fail("Elige una cuenta de ahorro o fondo de emergencia.");
      const allocated = (
        await c.query(
          "SELECT COALESCE(sum(amount),0)::text AS total FROM goal_contributions WHERE account_id=$1",
          [v.account_id],
        )
      ).rows[0].total;
      const own = (
        await c.query(
          "SELECT COALESCE(sum(amount),0)::text AS total FROM goal_contributions WHERE account_id=$1 AND goal_id=$2",
          [v.account_id, id],
        )
      ).rows[0].total;
      if (D(own).plus(v.amount).lt(0))
        throw fail("No puedes retirar más de lo asignado a esta meta.");
      if (D(v.amount).gt(0) && D(allocated).plus(v.amount).gt(a.balance))
        throw fail(
          "No hay saldo libre suficiente. Transfiere dinero a la cuenta primero.",
        );
      await c.query(
        "INSERT INTO goal_contributions(goal_id,account_id,amount,date) VALUES ($1,$2,$3,$4)",
        [id, v.account_id, v.amount, v.date],
      );
    });
    res.status(201).json({ ok: true });
  });
  return r;
}
