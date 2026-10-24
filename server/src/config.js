import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";
dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });
export function configFromEnv(env = process.env) {
  const schema = z.object({
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    APP_PASSWORD_HASH: z.string().regex(/^\$2[aby]\$\d\d\$.{53}$/),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    FINNHUB_API_KEY: z.string().default(""),
    ANTHROPIC_API_KEY: z.string().default(""),
    ANTHROPIC_MODEL: z.string().default("claude-sonnet-5-5"),
    APP_ORIGIN: z.string().url().optional(),
    DATABASE_SSL: z.enum(["true", "false"]).default("false"),
  });
  const result = schema.safeParse(env);
  if (!result.success)
    throw new Error(
      "Revisa las variables: " +
        result.error.issues.map((i) => i.path.join(".")).join(", "),
    );
  const c = result.data;
  c.APP_ORIGIN ||= env.RENDER_EXTERNAL_URL || "http://localhost:5173";
  if (c.NODE_ENV === "production" && !c.APP_ORIGIN.startsWith("https://"))
    throw new Error("APP_ORIGIN debe usar HTTPS en producción.");
  return c;
}
