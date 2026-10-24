import { PGlite } from "@electric-sql/pglite";
// Test/preview adapter. Production exclusively uses pg and PostgreSQL.
export async function testDb() {
  const pg = new PGlite();
  await pg.waitReady;
  const wrap = (client) => ({
    async query(text, values) {
      if (text.includes("pg_advisory_xact_lock")) return { rows: [] };
      if (text.includes("CREATE TABLE IF NOT EXISTS settings")) {
        await client.exec(text);
        return { rows: [] };
      }
      try {
        return await client.query(text, values);
      } catch (e) {
        console.error("Consulta de prueba:", text, e.message);
        throw e;
      }
    },
  });
  return {
    ...wrap(pg),
    tx: (fn) => pg.transaction((c) => fn(wrap(c))),
    end: () => pg.close(),
  };
}
