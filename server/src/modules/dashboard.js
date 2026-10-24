import { D, sum, money, today, projection, budgetProgress } from "../lib.js";
import { accounts } from "./ledger.js";
import { investments } from "./investments.js";
import { getGoals } from "./savings.js";
export async function dashboard(db, month = today().slice(0, 7)) {
  const start = month + "-01";
  const end = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1),
  )
    .toISOString()
    .slice(0, 10);
  const prev = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 2, 1),
  )
    .toISOString()
    .slice(0, 10);
  const [acc, inv, goalRows] = await Promise.all([
    accounts(db),
    investments(db),
    getGoals(db),
  ]);
  const rows = (
    await db.query(
      "SELECT t.*,t.date::text,c.name AS category,c.color,c.bucket FROM transactions t LEFT JOIN categories c ON c.id=t.category_id WHERE date >= $1 AND date < $2 ORDER BY t.date",
      [start, end],
    )
  ).rows;
  const before = (
    await db.query(
      "SELECT COALESCE(sum(amount),0)::text AS total FROM transactions WHERE type='expense' AND date >= $1 AND date < $2",
      [prev, start],
    )
  ).rows[0].total;
  const monthlyDividends = (
    await db.query(
      "SELECT COALESCE(sum(amount),0)::text AS total FROM dividends WHERE date >= $1 AND date < $2 AND date <= $3",
      [start, end, today()],
    )
  ).rows[0].total;
  const expenses = rows.filter((t) => t.type === "expense"),
    spent = sum(expenses.map((t) => t.amount)),
    income = sum(
      rows.filter((t) => t.type === "income").map((t) => t.amount),
    ).plus(monthlyDividends);
  const categoryMap = {};
  for (const t of expenses) {
    const key = t.category_id || 0;
    categoryMap[key] ||= {
      id: t.category_id,
      name: t.category || "Sin categoría",
      color: t.color || "#91a3a0",
      value: D(0),
    };
    categoryMap[key].value = categoryMap[key].value.plus(t.amount);
  }
  const categories = Object.values(categoryMap)
    .map((c) => ({ ...c, value: money(c.value) }))
    .sort((a, b) => D(b.value).cmp(a.value));
  const budgets = (
    await db.query(
      "SELECT b.*,c.name AS category FROM budgets b LEFT JOIN categories c ON c.id=b.category_id WHERE month=$1",
      [month],
    )
  ).rows.map((b) => {
    const amount = b.category_id
      ? categories.find((c) => c.id === b.category_id)?.value || "0"
      : money(spent);
    return { ...b, spent: amount, ...budgetProgress(amount, b.amount) };
  });
  const days = new Date(Date.parse(end) - 86400000).getUTCDate();
  const day = month === today().slice(0, 7) ? Number(today().slice(8)) : days;
  const net = sum(acc.map((a) => a.balance)).plus(inv.value);
  const snapshots = (
    await db.query(
      "SELECT *,date::text FROM snapshots ORDER BY snapshots.date DESC LIMIT 366",
    )
  ).rows.reverse();
  const base = (
    await db.query(
      "SELECT net_worth FROM snapshots WHERE date < $1 ORDER BY date DESC LIMIT 1",
      [start],
    )
  ).rows[0];
  const avg = (
    await db.query(
      "SELECT COALESCE(sum(amount),0)/3 AS average FROM transactions WHERE type='expense' AND date >= ($1::date - interval '3 months') AND date < $1",
      [today().slice(0, 7) + "-01"],
    )
  ).rows[0].average;
  const emergency = sum(
    acc.filter((a) => a.type === "emergency").map((a) => a.balance),
  );
  const ants = Object.create(null);
  for (const t of expenses.filter((t) => D(t.amount).lte(10))) {
    const key = t.note.trim().toLowerCase() || t.category || "Sin nota";
    ants[key] ||= { name: key, count: 0, total: D(0) };
    ants[key].count++;
    ants[key].total = ants[key].total.plus(t.amount);
  }
  const alerts = [];
  for (const b of budgets.filter((b) => b.percent >= 80))
    alerts.push({
      type: b.level,
      text: `${b.category || "Presupuesto total"}: has usado ${b.percent.toFixed(0)} %.`,
    });
  for (const g of goalRows.filter((g) => g.behind))
    alerts.push({
      type: "warning",
      text: `Tu meta «${g.name}» va por debajo del ritmo previsto.`,
    });
  for (const p of inv.positions) {
    if (p.weight > 30)
      alerts.push({
        type: "warning",
        text: `${p.symbol} representa ${p.weight.toFixed(0)} % de tu portafolio.`,
      });
    if (p.quote?.data?.dp <= -5 && D(p.quantity).gt(0))
      alerts.push({
        type: "danger",
        text: `${p.symbol} cayó ${p.quote.data.dp.toFixed(2)} % en la última cotización.`,
      });
  }
  const watches = (
    await db.query(
      "SELECT w.*,q.data FROM watchlist w JOIN quote_cache q ON q.symbol=w.symbol WHERE target IS NOT NULL",
    )
  ).rows;
  for (const w of watches)
    if (
      w.data.c > 0 &&
      (w.direction === "below"
        ? D(w.data.c).lte(w.target)
        : D(w.data.c).gte(w.target))
    )
      alerts.push({
        type: "good",
        text: `${w.symbol} alcanzó tu precio objetivo de $${w.target} según la última cotización.`,
      });
  for (const g of goalRows)
    if (
      (g.last_contribution || g.created_at) <
      new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
    )
      alerts.push({
        type: "warning",
        text: `Llevas al menos 3 meses sin aportar a «${g.name}».`,
      });
  const allocation = (
    await db.query(
      "SELECT account_id,sum(amount)::text AS amount FROM goal_contributions GROUP BY account_id",
    )
  ).rows;
  for (const a of allocation)
    if (D(a.amount).gt(acc.find((x) => x.id === a.account_id)?.balance || 0))
      alerts.push({
        type: "danger",
        text: "Retiraste dinero de una cuenta asignada a metas. Revisa y reduce las asignaciones.",
      });
  const daily = Object.entries(
    expenses.reduce((a, t) => {
      a[t.date] = D(a[t.date] || 0)
        .plus(t.amount)
        .toString();
      return a;
    }, {}),
  ).map(([date, value]) => ({ date, value }));
  const annual = (
    await db.query(
      "SELECT to_char(date,'YYYY-MM') AS month,type,sum(amount)::text AS amount FROM transactions WHERE date >= $1 AND date < $2 GROUP BY 1,2 ORDER BY 1",
      [
        month.slice(0, 4) + "-01-01",
        String(Number(month.slice(0, 4)) + 1) + "-01-01",
      ],
    )
  ).rows;
  const weekly = (
    await db.query(
      "SELECT to_char(date_trunc('week',date),'YYYY-MM-DD') AS week,type,sum(amount)::text AS amount FROM transactions WHERE date >= $1 AND date < $2 GROUP BY 1,2 ORDER BY 1",
      [start, end],
    )
  ).rows;
  const previousCategories = (
    await db.query(
      "SELECT category_id,sum(amount)::text AS total FROM transactions WHERE type='expense' AND date >= $1 AND date < $2 GROUP BY category_id",
      [prev, start],
    )
  ).rows;
  for (const c of categories) {
    const old = previousCategories.find((p) => p.category_id === c.id);
    if (old && D(old.total).gt(0) && D(c.value).gt(D(old.total).mul(1.2)))
      alerts.push({
        type: "warning",
        text: `Gastaste ${D(c.value).div(old.total).minus(1).mul(100).toFixed(0)} % más en ${c.name} que el mes anterior completo.`,
      });
  }
  return {
    month,
    accounts: acc,
    net_worth: money(net),
    month_change: base ? money(net.minus(base.net_worth)) : null,
    income: money(income),
    spent: money(spent),
    balance: money(income.minus(spent)),
    previous_spent: before,
    expense_change: D(before).gt(0)
      ? spent.div(before).minus(1).mul(100).toFixed(1)
      : null,
    projection: projection(spent, day, days),
    daily_average: money(spent.div(day)),
    categories,
    budgets,
    investments: inv,
    goals: goalRows,
    snapshots,
    alerts,
    daily,
    weekly,
    annual,
    ants: Object.values(ants)
      .filter((a) => a.count >= 3)
      .map((a) => ({ ...a, total: money(a.total) }))
      .sort((a, b) => D(b.total).cmp(a.total)),
    emergency: {
      balance: money(emergency),
      average: money(avg),
      months: D(avg).gt(0) ? emergency.div(avg).toFixed(1) : null,
      target3: money(D(avg).mul(3)),
      target6: money(D(avg).mul(6)),
    },
    rule: {
      needs: money(
        sum(
          expenses
            .filter((t) => t.bucket === "needs" || !t.bucket)
            .map((t) => t.amount),
        ),
      ),
      wants: money(
        sum(expenses.filter((t) => t.bucket === "wants").map((t) => t.amount)),
      ),
      remaining: money(income.minus(spent)),
      income: money(income),
    },
  };
}
