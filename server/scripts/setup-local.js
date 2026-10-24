import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import { createDb, migrate } from "../src/db/index.js";
import { passwordSchema } from "../src/modules/auth.js";

const envPath = fileURLToPath(new URL("../../.env", import.meta.url));
if (!process.stdin.isTTY) {
  console.error(
    "Abre Conectar-Brisa.cmd para introducir tus datos en privado.",
  );
  process.exit(1);
}

function ask(label, hidden = false) {
  process.stdout.write(label);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    };
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\u0003") {
          finish();
          reject(new Error("CANCELLED"));
          return;
        }
        if (char === "\r" || char === "\n") {
          finish();
          resolve(value);
          return;
        }
        if (char === "\u007f" || char === "\b") {
          if (value) {
            value = [...value].slice(0, -1).join("");
            if (!hidden) process.stdout.write("\b \b");
          }
        } else if (char >= " " && char !== "\u007f") {
          value += char;
          if (!hidden) process.stdout.write(char);
        }
      }
    };
    process.stdin.on("data", onData);
  });
}

let db;
try {
  console.log("\nBRISA · Conectar tu base local\n");
  console.log(
    "Se usara la base brisa en localhost:5432. Tu otro proyecto no se modifica.",
  );
  console.log(
    "Las contrasenas se introducen ocultas y no se envian al chat.\n",
  );
  const user =
    (await ask("Usuario de PostgreSQL [postgres]: ")).trim() || "postgres";
  const password = await ask("Contrasena de PostgreSQL: ", true);
  const databaseUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost:5432/brisa`;
  db = createDb({ DATABASE_URL: databaseUrl, DATABASE_SSL: "false" });
  await db.query("SELECT current_database()");
  console.log("Conexion a brisa comprobada.\n");

  let current = {};
  try {
    current = dotenv.parse(await readFile(envPath, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const exists = (
    await db.query("SELECT to_regclass('public.settings') AS name")
  ).rows[0].name;
  const installed = exists
    ? (await db.query("SELECT password_hash FROM settings WHERE id=1")).rows[0]
    : null;
  let hash = installed?.password_hash;
  if (hash) {
    console.log("Brisa ya tiene una contrasena. Se conserva la existente.");
  } else {
    while (true) {
      const appPassword = await ask(
        "Elige tu contrasena de Brisa (minimo 12 caracteres): ",
        true,
      );
      const parsed = passwordSchema.safeParse(appPassword);
      if (!parsed.success) {
        console.log(parsed.error.issues[0].message);
        continue;
      }
      const confirm = await ask("Repite la contrasena de Brisa: ", true);
      if (confirm !== appPassword) {
        console.log("Las contrasenas no coinciden. Intenta otra vez.");
        continue;
      }
      hash = await bcrypt.hash(appPassword, 12);
      break;
    }
  }
  await migrate(db, hash);
  const env = {
    ...current,
    DATABASE_URL: databaseUrl,
    DATABASE_SSL: "false",
    JWT_SECRET:
      current.JWT_SECRET?.length >= 32
        ? current.JWT_SECRET
        : randomBytes(48).toString("hex"),
    APP_PASSWORD_HASH: hash,
    PORT: "3001",
    APP_ORIGIN: "http://localhost:3001",
    NODE_ENV: "development",
  };
  const content =
    "# Configuracion privada de Brisa. No compartir ni subir a GitHub.\n" +
    Object.entries(env)
      .map(([key, value]) => `${key}=${JSON.stringify(String(value))}`)
      .join("\n") +
    "\n";
  await writeFile(envPath, content, { mode: 0o600 });
  console.log(
    "\nListo: conexion guardada y tablas creadas. La web se abrira en http://localhost:3001",
  );
  console.log(
    "Tus datos reales se guardaran en PostgreSQL, separados de la demostracion.\n",
  );
} catch (e) {
  const messages = {
    "28P01":
      "Contrasena o usuario de PostgreSQL incorrectos. No se cambio la configuracion.",
    "3D000": "No existe la base brisa. Creala primero desde pgAdmin.",
    42501: "El usuario no tiene permisos para crear las tablas de Brisa.",
    ECONNREFUSED: "No se pudo contactar con PostgreSQL en localhost:5432.",
    CANCELLED: "Configuracion cancelada.",
  };
  console.error(
    messages[e.code || e.message] ||
      "No se pudo completar la conexion. Revisa que PostgreSQL este activo y vuelve a intentar.",
  );
  process.exitCode = 1;
} finally {
  if (db) await db.end();
}
