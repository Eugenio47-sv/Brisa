import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { testDb } from "../tests/database.js";
import { migrate } from "../src/db/index.js";
import { createApp } from "../src/app.js";
import { snapshot } from "../src/jobs.js";
import { seedData } from "./seed-data.js";
const db = await testDb();
const password = "Brisa-Demo-2026!";
const hash = await bcrypt.hash(password, 10);
await migrate(db, hash);
await seedData(db);
await snapshot(db);
const { app } = createApp(db, {
  JWT_SECRET: randomBytes(48).toString("hex"),
  APP_ORIGIN: "http://127.0.0.1:3000",
  NODE_ENV: "development",
  ANTHROPIC_API_KEY: "",
  FINNHUB_API_KEY: "",
  DEMO: true,
});
app.listen(3000, "127.0.0.1", () =>
  console.log(
    "Vista de demostración temporal: http://127.0.0.1:3000 | Contraseña: " +
      password +
      " | No usar para datos reales: se borran al cerrar.",
  ),
);
