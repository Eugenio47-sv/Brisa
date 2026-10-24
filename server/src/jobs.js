import { today, nextDate, money, D } from "./lib.js";
import { insertTransaction } from "./modules/ledger.js";
import { dashboard } from "./modules/dashboard.js";
export async function runRecurring(db) {
  await db.tx(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(71625)");
    const rules = (
      await c.query(
        "SELECT *,next_date::text FROM recurring_rules WHERE active=true AND next_date <= $1 FOR UPDATE",
        [today()],
      )
    ).rows;
    for (const r of rules) {
      let date = r.next_date,
        count = 0;
      while (date <= today() && count < 500) {
        await insertTransaction(c, { ...r, date }, r.id);
        date = nextDate(date, r.period, r.anchor_day);
        count++;
      }
      await c.query("UPDATE recurring_rules SET next_date=$1 WHERE id=$2", [
        date,
        r.id,
      ]);
    }
    await c.query("DELETE FROM sessions WHERE expires_at<now()");
  });
}
export async function snapshot(db) {
  const d = await dashboard(db);
  await db.query(
    "INSERT INTO snapshots(date,net_worth,portfolio,cost_basis,profit) VALUES ($1,$2,$3,$4,$5) ON CONFLICT(date) DO UPDATE SET net_worth=EXCLUDED.net_worth,portfolio=EXCLUDED.portfolio,cost_basis=EXCLUDED.cost_basis,profit=EXCLUDED.profit",
    [
      today(),
      d.net_worth,
      d.investments.value,
      d.investments.cost,
      money(D(d.investments.realized).plus(d.investments.unrealized)),
    ],
  );
}
export function startJobs(db, market) {
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try {
      await runRecurring(db);
      await market.refresh();
      await snapshot(db);
    } catch {
      console.error("Una tarea automática falló; se reintentará en 3 minutos.");
    } finally {
      busy = false;
    }
  };
  void run();
  const timer = setInterval(run, 180000);
  timer.unref();
  return () => clearInterval(timer);
}
