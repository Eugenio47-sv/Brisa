import { today, money, D } from "../src/lib.js";
import { insertTransaction } from "../src/modules/ledger.js";
export async function seedData(db) {
  await db.tx(async (c) => {
    if (
      Number((await c.query("SELECT count(*) FROM accounts")).rows[0].count) > 0
    )
      throw new Error(
        "Los ejemplos solo se cargan en una base sin cuentas. No se modificaron tus datos.",
      );
    const bank = (
      await c.query(
        "INSERT INTO accounts(name,type,opening_balance) VALUES ('Mi cuenta principal','bank',6500) RETURNING id",
      )
    ).rows[0].id;
    const cash = (
      await c.query(
        "INSERT INTO accounts(name,type,opening_balance) VALUES ('Mi billetera','cash',150) RETURNING id",
      )
    ).rows[0].id;
    const savings = (
      await c.query(
        "INSERT INTO accounts(name,type,opening_balance) VALUES ('Próximos planes','savings',1800) RETURNING id",
      )
    ).rows[0].id;
    await c.query(
      "INSERT INTO accounts(name,type,opening_balance) VALUES ('Mi tranquilidad','emergency',2500)",
    );
    const cats = (await c.query("SELECT id,name FROM categories")).rows;
    const cat = (n) => cats.find((c) => c.name === n)?.id || null;
    const now = today(),
      current = now.slice(0, 7);
    for (let offset = 0; offset < 3; offset++) {
      const start = new Date(now + "T12:00:00Z");
      start.setUTCDate(1);
      start.setUTCMonth(start.getUTCMonth() - offset);
      const month = start.toISOString().slice(0, 7);
      await insertTransaction(c, {
        type: "income",
        amount: "2200",
        category_id: null,
        account_id: bank,
        method: "bank",
        note: "Ingreso mensual",
        date: month + "-01",
      });
      for (const [day, amount, category, note] of [
        [2, "520", "Vivienda", "Alquiler"],
        [3, "65", "Servicios", "Internet y teléfono"],
        [5, "82.35", "Comida", "Supermercado"],
        [7, "24.50", "Transporte", "Gasolina"],
        [9, "35", "Gym", "Mensualidad gym"],
        [11, "18.90", "Ocio", "Café con amigos"],
        [14, "46.20", "Comida", "Compra de la semana"],
        [17, "12.99", "Suscripciones", "Música y entretenimiento"],
        [19, "29", "Salud", "Farmacia"],
      ]) {
        const date = month + "-" + String(day).padStart(2, "0");
        if (date <= now)
          await insertTransaction(c, {
            type: "expense",
            amount,
            category_id: cat(category),
            account_id: bank,
            method: "card",
            note,
            date,
          });
      }
      for (const day of [6, 10, 15, 20]) {
        const date = month + "-" + String(day).padStart(2, "0");
        if (date <= now)
          await insertTransaction(c, {
            type: "expense",
            amount: "3.50",
            category_id: cat("Comida"),
            account_id: cash,
            method: "cash",
            note: "Café de la mañana",
            date,
          });
      }
    }
    await c.query(
      "INSERT INTO budgets(month,category_id,amount) VALUES ($1,NULL,1200),($1,$2,200)",
      [current, cat("Comida")],
    );
    const deadline = new Date(Date.parse(now) + 180 * 86400000)
      .toISOString()
      .slice(0, 10);
    const g = (
      await c.query(
        "INSERT INTO goals(name,target,deadline,created_at) VALUES ('Mi próximo viaje',3000,$1,$2) RETURNING id",
        [deadline, now],
      )
    ).rows[0].id;
    await c.query(
      "INSERT INTO goal_contributions(goal_id,account_id,amount,date) VALUES ($1,$2,1200,$3)",
      [g, savings, now],
    );
    await c.query(
      "INSERT INTO goals(name,target,deadline,created_at) VALUES ('Un nuevo comienzo',5000,$1,$2)",
      [deadline, now],
    );
    await c.query(
      "INSERT INTO trades(symbol,side,quantity,price,fee,date,account_id) VALUES ('AAPL','buy',5,180,1,$1,$2),('VTI','buy',8,250,1,$1,$2),('MSFT','buy',3,400,1,$1,$2)",
      [current + "-01", bank],
    );
    await c.query(
      "INSERT INTO watchlist(symbol,target,direction) VALUES ('GOOGL',150,'below')",
    );
  });
}
