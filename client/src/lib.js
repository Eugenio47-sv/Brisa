export const usd = (v) =>
  new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD" }).format(
    Number(v || 0),
  );
export const dateNow = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/El_Salvador",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const dateLabel = (d) =>
  new Intl.DateTimeFormat("es-SV", { day: "numeric", month: "short" }).format(
    new Date(String(d).slice(0, 10) + "T12:00:00Z"),
  );
export const timeLabel = (d) =>
  d
    ? new Intl.DateTimeFormat("es-SV", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/El_Salvador",
      }).format(new Date(d))
    : "Sin actualizar";
export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch("/api" + path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...options,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(40000),
    });
  } catch {
    throw new Error(
      "No se pudo conectar. Comprueba tu conexión y vuelve a intentar.",
    );
  }
  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data.error || "Ocurrió un error.");
    err.status = response.status;
    throw err;
  }
  return data;
}
export async function download(path, name) {
  const r = await fetch("/api" + path, { credentials: "same-origin" });
  if (!r.ok) throw new Error("No se pudo exportar. Vuelve a iniciar sesión.");
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const types = {
  bank: "Banco",
  cash: "Efectivo",
  savings: "Ahorro",
  emergency: "Fondo de emergencia",
  credit: "Tarjeta de crédito",
};
export const methods = {
  bank: "Banco",
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
};
export const legal =
  "Información educativa. No constituye asesoría financiera personalizada ni una recomendación de compra o venta. Invertir implica riesgos, incluida la pérdida del capital.";
