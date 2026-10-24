import { configFromEnv } from "../src/config.js";
import { createDb, migrate } from "../src/db/index.js";
import { seedData } from "./seed-data.js";
const config = configFromEnv(),
  db = createDb(config);
try {
  await migrate(db, config.APP_PASSWORD_HASH);
  await seedData(db);
  console.log("Datos de ejemplo cargados. No contienen cotizaciones reales.");
} finally {
  await db.end();
}
