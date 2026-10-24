import { configFromEnv } from "../src/config.js";
import { createDb, migrate } from "../src/db/index.js";
const config = configFromEnv(),
  db = createDb(config);
try {
  await migrate(db, config.APP_PASSWORD_HASH);
  console.log("Migraciones aplicadas.");
} finally {
  await db.end();
}
