import { configFromEnv } from "./config.js";
import { createDb, migrate } from "./db/index.js";
import { createApp } from "./app.js";
import { startJobs } from "./jobs.js";
try {
  const config = configFromEnv(),
    db = createDb(config);
  await migrate(db, config.APP_PASSWORD_HASH);
  const { app, market } = createApp(db, config);
  const stop = startJobs(db, market);
  const server = app.listen(config.PORT, "0.0.0.0", () =>
    console.log(`Brisa disponible en el puerto ${config.PORT}`),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      stop();
      server.close(() => db.end().then(() => process.exit(0)));
      setTimeout(() => process.exit(1), 10000).unref();
    });
} catch (e) {
  console.error(
    "No se pudo iniciar Brisa:",
    e.message.includes("variables")
      ? e.message
      : "Revisa PostgreSQL y las variables de entorno.",
  );
  process.exit(1);
}
