import Decimal from "decimal.js";
import { z } from "zod";
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export const D = (v) => new Decimal(v ?? 0);
export const money = (v) => D(v).toFixed(2);
export const sum = (values) => values.reduce((a, v) => a.plus(v), D(0));
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/El_Salvador",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "Fecha inválida",
  );
export const amountSchema = z
  .string()
  .regex(
    /^\d{1,12}(\.\d{1,2})?$/,
    "Usa un importe positivo con hasta 2 decimales",
  )
  .pipe(
    z.string().refine((v) => D(v).gt(0), "El monto debe ser mayor que cero"),
  );
export const nonnegative = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/);
export const idSchema = z.coerce.number().int().positive().max(2147483647);
export const symbolSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9.:-]{0,19}$/);
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const pastDate = dateSchema.refine(
  (v) => v <= today(),
  "No se admiten movimientos futuros; usa una recurrencia.",
);
export function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
export const validate = (schema, value) => schema.parse(value);
export function nextDate(date, period, anchor = Number(date.slice(8))) {
  const d = new Date(date + "T12:00:00Z");
  if (period === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else {
    const month = d.getUTCMonth() + (period === "monthly" ? 1 : 12);
    const year = d.getUTCFullYear();
    const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    d.setUTCFullYear(year, month, Math.min(anchor, last));
  }
  return d.toISOString().slice(0, 10);
}
export function portfolio(trades, quotes = {}) {
  const map = {};
  for (const t of [...trades].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
  )) {
    const p = (map[t.symbol] ||= {
      symbol: t.symbol,
      quantity: D(0),
      cost: D(0),
      realized: D(0),
    });
    if (t.cost_unknown) p.cost_unknown = true;
    const qty = D(t.quantity),
      value = qty.mul(t.price);
    if (t.side === "buy") {
      p.cost = p.cost.plus(value).plus(t.fee);
      p.quantity = p.quantity.plus(qty);
    } else {
      if (qty.gt(p.quantity))
        throw fail(
          `La venta de ${t.symbol} supera las acciones disponibles en esa fecha.`,
        );
      const basis = p.cost.div(p.quantity).mul(qty);
      p.realized = p.realized.plus(value.minus(t.fee).minus(basis));
      p.cost = p.cost.minus(basis);
      p.quantity = p.quantity.minus(qty);
    }
  }
  return Object.values(map).map((p) => {
    const q = quotes[p.symbol];
    const average = p.quantity.gt(0) ? p.cost.div(p.quantity) : D(0);
    const price = q?.data?.c > 0 ? D(q.data.c) : average;
    const value = p.quantity.mul(price);
    return {
      symbol: p.symbol,
      quantity: p.quantity.toFixed(8),
      cost_unknown: !!p.cost_unknown,
      cost: p.cost_unknown ? null : money(p.cost),
      average: p.cost_unknown ? null : money(average),
      value: p.cost_unknown && !q ? null : money(value),
      price: p.cost_unknown && !q ? null : money(price),
      realized: p.cost_unknown ? null : money(p.realized),
      unrealized: p.cost_unknown ? null : money(value.minus(p.cost)),
      percent: p.cost_unknown
        ? null
        : p.cost.gt(0)
          ? value.minus(p.cost).div(p.cost).mul(100).toFixed(2)
          : "0",
      quote: q || null,
      estimated: !q,
    };
  });
}
export function projection(spent, day, days) {
  return money(D(spent).div(day).mul(days));
}
export function budgetProgress(spent, limit) {
  const percent = D(spent).div(limit).mul(100);
  return {
    percent: percent.toNumber(),
    level: percent.gte(100) ? "danger" : percent.gte(80) ? "warning" : "good",
  };
}
export const csvCell = (value) =>
  '"' +
  String(value ?? "")
    .replace(/^[=+@\-\t\r]/, "'$&")
    .replaceAll('"', '""') +
  '"';
