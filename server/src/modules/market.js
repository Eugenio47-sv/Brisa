import { fail, today } from "../lib.js";
export function createMarket(db, config, fetcher = fetch) {
  let refreshing = false;
  async function request(path, params = {}) {
    if (!config.FINNHUB_API_KEY)
      throw fail("Configura FINNHUB_API_KEY para consultar el mercado.", 503);
    // A shared DB counter covers quotes, news and multiple server processes.
    await db.tx(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(71623)");
      await c.query(
        "DELETE FROM api_calls WHERE at < now()-interval '1 minute'",
      );
      const n = Number(
        (await c.query("SELECT count(*) FROM api_calls")).rows[0].count,
      );
      if (n >= 50)
        throw fail(
          "Límite preventivo del mercado alcanzado. Intenta en un minuto.",
          429,
        );
      await c.query("INSERT INTO api_calls DEFAULT VALUES");
    });
    const url = new URL("https://finnhub.io/api/v1/" + path);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    let response;
    try {
      response = await fetcher(url, {
        headers: { "X-Finnhub-Token": config.FINNHUB_API_KEY },
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw fail(
        "No se pudo conectar con Finnhub. Se conserva la última información.",
        503,
      );
    }
    if (!response.ok)
      throw fail(
        "Finnhub no está disponible o tu plan no permite esta consulta.",
        503,
      );
    const data = await response.json();
    if (data.error) throw fail("Finnhub no pudo completar esta consulta.", 503);
    return data;
  }
  async function cached(key, ttl, load) {
    const row = (await db.query("SELECT * FROM news_cache WHERE key=$1", [key]))
      .rows[0];
    if (row && Date.now() - new Date(row.updated_at).getTime() < ttl)
      return { data: row.data, updated_at: row.updated_at, stale: false };
    try {
      const data = await load();
      await db.query(
        "INSERT INTO news_cache(key,data) VALUES ($1,$2) ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data,updated_at=now()",
        [key, JSON.stringify(data)],
      );
      return { data, updated_at: new Date().toISOString(), stale: false };
    } catch (e) {
      return {
        data: row?.data || [],
        updated_at: row?.updated_at || null,
        stale: true,
        message: e.message,
      };
    }
  }
  async function news(symbol) {
    const until = today();
    const from = new Date(Date.parse(until) - 7 * 86400000)
      .toISOString()
      .slice(0, 10);
    return cached("news:" + (symbol || "general"), 30 * 60000, () =>
      symbol
        ? request("company-news", { symbol, from, to: until })
        : request("news", { category: "general" }),
    );
  }
  async function refresh() {
    if (refreshing) return { message: "La actualización ya está en curso." };
    refreshing = true;
    try {
      if (!config.FINNHUB_API_KEY)
        return {
          message: "Agrega tu clave de Finnhub para ver precios de mercado.",
        };
      const status = await cached("market-status", 120000, () =>
        request("stock/market-status", { exchange: "US" }),
      );
      if (status.stale)
        return {
          message: status.stale
            ? "No se pudo verificar si el mercado está abierto. Se conservan los precios."
            : "El mercado de EE. UU. está cerrado. Se conservan los últimos precios.",
        };
      const symbols = (
        await db.query(
          "SELECT symbol FROM trades UNION SELECT symbol FROM watchlist UNION SELECT symbol FROM initial_holdings",
        )
      ).rows;
      let updated = 0,
        errors = 0;
      for (const { symbol } of symbols) {
        const old = (
          await db.query("SELECT updated_at FROM quote_cache WHERE symbol=$1", [
            symbol,
          ])
        ).rows[0];
        if (
          old &&
          (!status.data.isOpen ||
            Date.now() - new Date(old.updated_at).getTime() < 180000)
        )
          continue;
        try {
          const q = await request("quote", { symbol });
          if (!(q.c > 0)) throw fail("Sin cotización");
          const profile = await cached("profile:" + symbol, 7 * 86400000, () =>
            request("stock/profile2", { symbol }),
          );
          q.sector = profile.data?.finnhubIndustry || "Sin clasificar";
          q.name = profile.data?.name || symbol;
          await db.query(
            "INSERT INTO quote_cache(symbol,data) VALUES ($1,$2) ON CONFLICT(symbol) DO UPDATE SET data=EXCLUDED.data,updated_at=now()",
            [symbol, JSON.stringify(q)],
          );
          updated++;
        } catch {
          errors++;
        }
      }
      return {
        updated,
        errors,
        message:
          !status.data.isOpen && !updated && !errors
            ? "El mercado de EE. UU. está cerrado. Se conservan los últimos precios."
            : errors
              ? `${updated} precios actualizados; ${errors} consultas no disponibles. Se conserva la caché.`
              : `${updated} precios actualizados.`,
      };
    } finally {
      refreshing = false;
    }
  }
  async function search(query) {
    const result = await request("search", { q: query });
    return (result.result || [])
      .filter((item) => /^[A-Z0-9][A-Z0-9.:-]{0,19}$/.test(item.symbol))
      .slice(0, 12)
      .map((item) => ({
        symbol: item.symbol,
        name: item.description,
        type: item.type,
      }));
  }
  async function quote(symbol) {
    const old = (
      await db.query("SELECT * FROM quote_cache WHERE symbol=$1", [symbol])
    ).rows[0];
    if (old && Date.now() - new Date(old.updated_at).getTime() < 180000)
      return old;
    const q = await request("quote", { symbol });
    if (!(q.c > 0))
      throw fail("No encontramos cotización para ese símbolo.", 404);
    const profile = await cached("profile:" + symbol, 7 * 86400000, () =>
      request("stock/profile2", { symbol }),
    );
    q.name = profile.data?.name || symbol;
    q.sector = profile.data?.finnhubIndustry || "Sin clasificar";
    return (
      await db.query(
        "INSERT INTO quote_cache(symbol,data) VALUES ($1,$2) ON CONFLICT(symbol) DO UPDATE SET data=EXCLUDED.data,updated_at=now() RETURNING *",
        [symbol, JSON.stringify(q)],
      )
    ).rows[0];
  }
  return { refresh, news, search, quote };
}
