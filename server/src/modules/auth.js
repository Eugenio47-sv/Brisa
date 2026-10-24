import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { fail } from "../lib.js";
export const passwordSchema = z
  .string()
  .min(12, "Usa al menos 12 caracteres")
  .refine((p) => Buffer.byteLength(p) <= 72, "Máximo 72 bytes");
export function auth(db, config) {
  const router = Router();
  const cookie = {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  };
  const requireAuth = async (req, res, next) => {
    try {
      const token = jwt.verify(req.cookies.session || "", config.JWT_SECRET, {
        algorithms: ["HS256"],
        issuer: "brisa",
        audience: "personal",
      });
      const r = await db.query(
        "SELECT s.id FROM sessions s, settings a WHERE s.id=$1 AND s.expires_at>now() AND a.id=1 AND a.session_version=$2",
        [token.sid, token.version],
      );
      if (!r.rows.length)
        throw fail("Tu sesión venció. Vuelve a ingresar.", 401);
      req.sessionId = token.sid;
      next();
    } catch (e) {
      if (
        e instanceof jwt.JsonWebTokenError ||
        e instanceof jwt.NotBeforeError
      ) {
        next(fail("Inicia sesión para continuar.", 401));
      } else {
        next(e);
      }
    }
  };
  router.post(
    "/login",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 8,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "Demasiados intentos. Espera 15 minutos." },
    }),
    async (req, res) => {
      const { password } = z
        .object({ password: z.string().min(1).max(200) })
        .strict()
        .parse(req.body);
      const {
        rows: [s],
      } = await db.query("SELECT * FROM settings WHERE id=1");
      if (!(await bcrypt.compare(password, s.password_hash)))
        throw fail("Contraseña incorrecta.", 401);
      const sid = randomUUID();
      await db.query(
        "INSERT INTO sessions(id,expires_at) VALUES ($1,now()+interval '7 days')",
        [sid],
      );
      const token = jwt.sign(
        { sid, version: s.session_version },
        config.JWT_SECRET,
        {
          expiresIn: "7d",
          algorithm: "HS256",
          issuer: "brisa",
          audience: "personal",
        },
      );
      res
        .cookie("session", token, { ...cookie, maxAge: 7 * 86400000 })
        .json({ ok: true });
    },
  );
  router.get("/me", requireAuth, (req, res) =>
    res.json({
      authenticated: true,
      aiEnabled: !!config.ANTHROPIC_API_KEY,
      quotesEnabled: !!config.FINNHUB_API_KEY,
      demo: !!config.DEMO,
    }),
  );
  router.post("/logout", requireAuth, async (req, res) => {
    await db.query("DELETE FROM sessions WHERE id=$1", [req.sessionId]);
    res.clearCookie("session", cookie).json({ ok: true });
  });
  router.post("/password", requireAuth, async (req, res) => {
    const data = z
      .object({ current: z.string().min(1).max(200), password: passwordSchema })
      .strict()
      .parse(req.body);
    const s = (await db.query("SELECT password_hash FROM settings WHERE id=1"))
      .rows[0];
    if (!(await bcrypt.compare(data.current, s.password_hash)))
      throw fail("La contraseña actual es incorrecta.", 403);
    const hash = await bcrypt.hash(data.password, 12);
    await db.tx(async (c) => {
      await c.query(
        "UPDATE settings SET password_hash=$1,session_version=session_version+1 WHERE id=1",
        [hash],
      );
      await c.query("DELETE FROM sessions");
    });
    res.clearCookie("session", cookie).json({ ok: true });
  });
  return { router, requireAuth };
}
