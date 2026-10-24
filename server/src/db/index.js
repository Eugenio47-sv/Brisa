import pg from "pg";
import { readFile } from "node:fs/promises";
export function createDb(config) {
  const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: 8,
    ssl:
      config.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  });
  pool.on("error", () =>
    console.error("Se perdió una conexión de PostgreSQL."),
  );
  return {
    query: (text, values) => pool.query(text, values),
    async tx(fn) {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const result = await fn(c);
        await c.query("COMMIT");
        return result;
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    },
    end: () => pool.end(),
  };
}
export async function migrate(db, hash) {
  const sql = await readFile(
    new URL("./migrations/001_initial.sql", import.meta.url),
    "utf8",
  );
  await db.tx(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(71621)");
    await c.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz DEFAULT now())",
    );
    if (
      !(
        await c.query(
          "SELECT version FROM schema_migrations WHERE version=$1",
          [1],
        )
      ).rows.length
    ) {
      await c.query(sql);
      await c.query("INSERT INTO schema_migrations(version) VALUES ($1)", [1]);
    }
    await c.query(
      "INSERT INTO settings(id,password_hash) VALUES (1,$1) ON CONFLICT(id) DO NOTHING",
      [hash],
    );
    if (
      !(
        await c.query(
          "SELECT version FROM schema_migrations WHERE version=$1",
          [3],
        )
      ).rows.length
    ) {
      await c.query(
        "ALTER TABLE trades ALTER COLUMN price TYPE numeric(44,24)",
      );
      await c.query("INSERT INTO schema_migrations(version) VALUES ($1)", [3]);
    }
    const names = [
      "Comida",
      "Transporte",
      "Vivienda",
      "Servicios",
      "Salud",
      "Estudios",
      "Gym",
      "Ocio",
      "Ropa",
      "Suscripciones",
      "Regalos",
      "Deudas",
      "Otros",
    ];
    const colors = ["#109b80", "#5489d8", "#8a76ce", "#d5973d", "#d87979"];
    // Defaults are installed once; deleting or renaming a category is respected.
    if (
      !(
        await c.query(
          "SELECT version FROM schema_migrations WHERE version=$1",
          [2],
        )
      ).rows.length
    ) {
      for (const [i, n] of names.entries())
        await c.query(
          "INSERT INTO categories(name,color,icon,bucket) VALUES ($1,$2,$3,$4) ON CONFLICT(name) DO NOTHING",
          [
            n,
            colors[i % 5],
            ["🍽", "↗", "⌂", "☀", "♡"][i % 5],
            ["Gym", "Ocio", "Ropa", "Suscripciones", "Regalos"].includes(n)
              ? "wants"
              : "needs",
          ],
        );
      await c.query("INSERT INTO schema_migrations(version) VALUES ($1)", [2]);
    }
  });
}
