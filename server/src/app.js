import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import bcrypt from "bcrypt";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import { auth } from "./modules/auth.js";
import { ledgerRouter } from "./modules/ledger.js";
import { investmentRouter } from "./modules/investments.js";
import { savingsRouter } from "./modules/savings.js";
import { advisorRouter } from "./modules/advisor.js";
import { createMarket } from "./modules/market.js";
import { cashRouter } from "./modules/cash.js";
import { dashboard } from "./modules/dashboard.js";
import { fail, monthSchema, csvCell } from "./lib.js";
export function createApp(db, config) {
  const app = express(),
    market = createMarket(db, config);
  app.disable("x-powered-by");
  app.set("trust proxy", config.NODE_ENV === "production" ? 1 : false);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "img-src": ["'self'", "data:", "https:"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "connect-src": ["'self'"],
          "upgrade-insecure-requests":
            config.NODE_ENV === "production" ? [] : null,
        },
      },
    }),
  );
  app.use(cors({ origin: config.APP_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin !== config.APP_ORIGIN
    )
      return next(fail("Origen de la solicitud no permitido.", 403));
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 240,
      message: { error: "Demasiadas solicitudes. Espera un minuto." },
    }),
  );
  const { router, requireAuth } = auth(db, config);
  app.use("/api/auth", router);
  app.use("/api", requireAuth);
  app.get("/api/dashboard", async (req, res) => {
    const v = z
      .object({ month: monthSchema.optional() })
      .strict()
      .parse(req.query);
    const marketUpdate = await market.refresh().catch(() => ({
      message:
        "No se pudieron consultar precios nuevos; se muestra la última cotización guardada.",
    }));
    res.json({
      ...(await dashboard(db, v.month)),
      market_update: marketUpdate,
    });
  });
  app.use(
    "/api",
    ledgerRouter(db),
    investmentRouter(db, market),
    savingsRouter(db),
    cashRouter(db),
    advisorRouter(db, config, market),
  );
  app.get("/api/export", async (req, res) => {
    const { format } = z
      .object({ format: z.enum(["json", "csv"]).default("json") })
      .strict()
      .parse(req.query);
    const data = await db.tx(async (c) => {
      await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      return {
        accounts: (await c.query("SELECT * FROM accounts")).rows,
        savings_entries: (
          await c.query("SELECT *,date::text FROM savings_entries")
        ).rows,
        categories: (await c.query("SELECT * FROM categories")).rows,
        transactions: (await c.query("SELECT *,date::text FROM transactions"))
          .rows,
        transfers: (await c.query("SELECT *,date::text FROM transfers")).rows,
        budgets: (await c.query("SELECT * FROM budgets")).rows,
        recurring_rules: (
          await c.query("SELECT *,next_date::text FROM recurring_rules")
        ).rows,
        trades: (await c.query("SELECT *,date::text FROM trades")).rows,
        initial_holdings: (await c.query("SELECT * FROM initial_holdings"))
          .rows,
        dividends: (await c.query("SELECT *,date::text FROM dividends")).rows,
        watchlist: (await c.query("SELECT * FROM watchlist")).rows,
        goals: (
          await c.query("SELECT *,deadline::text,created_at::text FROM goals")
        ).rows,
        goal_contributions: (
          await c.query("SELECT *,date::text FROM goal_contributions")
        ).rows,
        snapshots: (await c.query("SELECT *,date::text FROM snapshots")).rows,
        quotes: (await c.query("SELECT * FROM quote_cache")).rows,
      };
    });
    if (format === "csv")
      return res
        .type("text/csv")
        .attachment("brisa-completo.csv")
        .send(
          "\uFEFF" +
            [
              "tabla,registro_json",
              ...Object.entries(data).flatMap(([table, rows]) =>
                rows.map((row) =>
                  [csvCell(table), csvCell(JSON.stringify(row))].join(","),
                ),
              ),
            ].join("\r\n"),
        );
    res
      .attachment("brisa-respaldo.json")
      .json({ version: 1, exported_at: new Date().toISOString(), ...data });
  });
  app.delete("/api/data", async (req, res) => {
    const v = z
      .object({
        password: z.string().min(1).max(200),
        confirmation: z.literal("BORRAR MIS DATOS"),
      })
      .strict()
      .parse(req.body);
    const s = (await db.query("SELECT password_hash FROM settings WHERE id=1"))
      .rows[0];
    if (!(await bcrypt.compare(v.password, s.password_hash)))
      throw fail("Contraseña incorrecta.", 403);
    await db.tx((c) =>
      c.query(
        "TRUNCATE goal_contributions,goals,savings_entries,initial_holdings,dividends,trades,transactions,transfers,recurring_rules,budgets,accounts,watchlist,quote_cache,snapshots,news_cache RESTART IDENTITY CASCADE",
      ),
    );
    res.json({ ok: true });
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Ruta no encontrada." }),
  );
  const dist = fileURLToPath(new URL("../../client/dist/", import.meta.url));
  app.use(express.static(dist));
  app.get("/{*path}", (req, res, next) =>
    res.sendFile(dist + "index.html", (e) => e && next(e)),
  );
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof z.ZodError)
      return res.status(400).json({
        error: err.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    if (err.code === "23503")
      return res.status(409).json({
        error: "El registro está en uso o la cuenta/categoría ya no existe.",
      });
    if (err.code === "23505")
      return res
        .status(409)
        .json({ error: "Ya existe un registro con estos datos." });
    if (err.code === "22003")
      return res
        .status(400)
        .json({ error: "El importe supera la precisión permitida." });
    if (err.type === "entity.too.large")
      return res.status(413).json({ error: "El archivo es demasiado grande." });
    if (err instanceof SyntaxError && err.status === 400)
      return res
        .status(400)
        .json({ error: "El formato de la solicitud no es válido." });
    if (!err.status) console.error("Error interno:", err.code || err.name);
    res.status(err.status || 500).json({
      error: err.status
        ? err.message
        : "No pudimos completar la operación. Inténtalo de nuevo.",
    });
  });
  return { app, market };
}
