import React, { useState, useEffect } from "react";
import { Plus, RefreshCw, ArrowUpRight } from "lucide-react";
import {
  Card,
  Form,
  Field,
  Select,
  MoneyField,
  AccountSelect,
  Empty,
  Stat,
  Loading,
} from "../components";
import { api, usd, dateNow, timeLabel } from "../lib";
import { WealthChart, Donut } from "./Overview";
export default function Investments({ data, mutate, setModal, notify, user }) {
  const [watch, setWatch] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [chart, setChart] = useState("assets");
  useEffect(() => {
    api("/watchlist")
      .then(setWatch)
      .catch((e) => setError(e.message));
  }, [data]);
  const inv = data.investments,
    positions = inv.positions.filter((p) => Number(p.quantity) > 0),
    sectors = Object.create(null);
  for (const p of positions) {
    const key = p.quote?.data?.sector || "Sin clasificar";
    sectors[key] = (sectors[key] || 0) + Number(p.value);
  }
  const addTrade = () =>
    setModal({
      title: "Registrar operación",
      content: (
        <Form
          onSubmit={async (v) => {
            await mutate("/trades", { ...v, account_id: Number(v.account_id) });
            setModal(null);
            notify("Operación registrada.");
          }}
        >
          <div className="form-grid">
            <Field
              label="Símbolo de la acción"
              name="symbol"
              placeholder="AAPL"
              maxLength={20}
              required
            />
            <Select label="Operación" name="side">
              <option value="buy">Compra</option>
              <option value="sell">Venta</option>
            </Select>
            <Field
              label="Cantidad de acciones"
              name="quantity"
              type="number"
              step="0.00000001"
              min="0.00000001"
              required
            />
            <MoneyField label="Precio por acción (USD)" name="price" />
            <MoneyField
              label="Comisión (USD)"
              name="fee"
              min="0"
              defaultValue="0"
            />
            <Field
              label="Fecha"
              name="date"
              type="date"
              max={dateNow()}
              defaultValue={dateNow()}
              required
            />
          </div>
          <AccountSelect accounts={data.accounts} name="account_id" />
          <p className="hint">
            La compra descuenta dinero de esta cuenta y la venta lo devuelve.
            Registra primero tu saldo inicial. Se usa costo promedio ponderado,
            incluyendo comisiones.
          </p>
        </Form>
      ),
    });
  const addWatch = () =>
    setModal({
      title: "Seguir una acción",
      content: (
        <Form
          onSubmit={async (v) => {
            await mutate("/watchlist", { ...v, target: v.target || null });
            setModal(null);
          }}
        >
          <Field label="Símbolo" name="symbol" maxLength={20} required />
          <MoneyField
            label="Precio objetivo (opcional)"
            name="target"
            required={false}
          />
          <Select label="Avisarme cuando esté" name="direction">
            <option value="below">Por debajo del objetivo</option>
            <option value="above">Por encima del objetivo</option>
          </Select>
        </Form>
      ),
    });
  const stock = (symbol) =>
    setModal({ title: symbol, content: <Stock symbol={symbol} /> });
  return (
    <>
      {!user.quotesEnabled && (
        <div className="alert warning">
          Precios de mercado desactivados. Configura tu clave de Finnhub.
          Mientras tanto, los activos sin cotización se valoran al costo
          promedio.
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <div className="stats-grid">
        <Stat
          label="Valor del portafolio"
          value={inv.value}
          foot="Último precio disponible o costo"
        />
        <Stat
          label="Capital invertido"
          value={inv.cost}
          foot="Costo de las posiciones abiertas"
        />
        <Stat
          label="Ganancia no realizada"
          value={inv.unrealized}
          positive={Number(inv.unrealized) >= 0}
          foot="Posiciones abiertas"
        />
        <Stat
          label="Ganancia realizada"
          value={inv.realized}
          positive={Number(inv.realized) >= 0}
          foot="Operaciones de venta"
        />
      </div>
      <Card
        title="Tu portafolio"
        action={
          <div className="inline-actions">
            <button
              disabled={busy}
              className="text-button"
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await mutate("/quotes/refresh", {});
                  notify(r.message);
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RefreshCw size={16} className={busy ? "spin" : ""} /> Actualizar
            </button>
            <button className="primary" onClick={addTrade}>
              <Plus size={16} /> Operación
            </button>
          </div>
        }
      >
        {positions.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Activo</th>
                  <th>Cantidad / costo medio</th>
                  <th>Precio</th>
                  <th>Valor</th>
                  <th>Resultado</th>
                  <th>Peso</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.symbol}>
                    <td>
                      <button
                        className="symbol"
                        onClick={() => stock(p.symbol)}
                      >
                        {p.symbol} <ArrowUpRight size={13} />
                      </button>
                      <small>{p.quote?.data?.name || "Acción / ETF"}</small>
                    </td>
                    <td>
                      {Number(p.quantity).toLocaleString("es-SV", {
                        maximumFractionDigits: 8,
                      })}
                      <small>{usd(p.average)}</small>
                    </td>
                    <td>
                      {usd(p.price)}
                      <small>
                        {p.estimated
                          ? "Estimado al costo"
                          : timeLabel(p.quote.updated_at)}
                      </small>
                      {p.quote &&
                        Date.now() - new Date(p.quote.updated_at).getTime() >
                          5 * 60000 && (
                          <small className="warning-text">
                            Último precio guardado
                          </small>
                        )}
                    </td>
                    <td>{usd(p.value)}</td>
                    <td
                      className={
                        Number(p.unrealized) >= 0 ? "positive" : "negative"
                      }
                    >
                      {usd(p.unrealized)}
                      <small>{p.percent} %</small>
                    </td>
                    <td>
                      {p.weight.toFixed(1)} %
                      {p.weight > 30 && (
                        <small className="warning-text">
                          Concentración alta
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Tu primera inversión empieza con un registro">
            Agrega tus compras para ver el portafolio y su distribución.
          </Empty>
        )}
      </Card>
      <div className="two-col section-gap">
        <Card
          title="Distribución"
          action={
            <select
              aria-label="Agrupar distribución"
              value={chart}
              onChange={(e) => setChart(e.target.value)}
            >
              <option value="assets">Por activo</option>
              <option value="sectors">Por sector</option>
            </select>
          }
        >
          <Donut
            total={inv.value}
            items={
              chart === "assets"
                ? positions.map((p) => ({ name: p.symbol, value: p.value }))
                : Object.entries(sectors).map(([name, value]) => ({
                    name,
                    value,
                  }))
            }
          />
        </Card>
        <Card title="Resultado acumulado">
          <p className="hint">
            Ganancias realizadas + no realizadas. Los aportes no se confunden
            con rendimientos. No incluye dividendos.
          </p>
          <WealthChart snapshots={data.snapshots} field="profit" />
        </Card>
      </div>
      <Card
        title="Tu lista de seguimiento"
        action={
          <button className="text-button" onClick={addWatch}>
            <Plus size={17} /> Seguir acción
          </button>
        }
      >
        {watch.length ? (
          watch.map((w) => (
            <div className="list-row" key={w.symbol}>
              <button className="symbol" onClick={() => stock(w.symbol)}>
                {w.symbol}
              </button>
              <span>
                {w.data ? usd(w.data.c) : "Sin cotización"}
                <small>{timeLabel(w.updated_at)}</small>
              </span>
              <span>
                {w.target
                  ? `${w.direction === "below" ? "≤" : "≥"} ${usd(w.target)}`
                  : "Sin objetivo"}
              </span>
              <button
                className="text-button negative"
                onClick={() =>
                  mutate("/watchlist/" + w.symbol, undefined, "DELETE").catch(
                    (e) => setError(e.message),
                  )
                }
              >
                Quitar
              </button>
            </div>
          ))
        ) : (
          <Empty title="Observa antes de decidir">
            Sigue acciones sin necesidad de comprarlas.
          </Empty>
        )}
      </Card>
      <Card title="Historial de operaciones" className="section-gap">
        {inv.trades.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Activo</th>
                  <th>Operación</th>
                  <th>Cantidad</th>
                  <th>Precio</th>
                  <th>Comisión</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...inv.trades].reverse().map((t) => (
                  <tr key={t.id}>
                    <td>{t.date}</td>
                    <td>{t.symbol}</td>
                    <td>{t.side === "buy" ? "Compra" : "Venta"}</td>
                    <td>{Number(t.quantity)}</td>
                    <td>{usd(t.price)}</td>
                    <td>{usd(t.fee)}</td>
                    <td>
                      <button
                        className="text-button negative"
                        onClick={() =>
                          setModal({
                            title: "Eliminar operación",
                            content: (
                              <Form
                                submit="Eliminar"
                                onSubmit={async () => {
                                  await mutate(
                                    "/trades/" + t.id,
                                    undefined,
                                    "DELETE",
                                  );
                                  setModal(null);
                                }}
                              >
                                <p>
                                  Se recalcularán las posiciones y el saldo de
                                  la cuenta. No podrás eliminar una compra si
                                  deja ventas sin acciones suficientes.
                                </p>
                              </Form>
                            ),
                          })
                        }
                      >
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </Card>
    </>
  );
}
function Stock({ symbol }) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    api("/stocks/" + encodeURIComponent(symbol))
      .then(setData)
      .catch((e) => setError(e.message));
  }, [symbol]);
  if (error) return <p className="error">{error}</p>;
  if (!data) return <Loading />;
  const q = data.quote?.data;
  return (
    <>
      {q ? (
        <>
          <div className="stock-price">
            {usd(q.c)}{" "}
            <small className={q.dp >= 0 ? "positive" : "negative"}>
              {q.dp}%
            </small>
          </div>
          <p>
            Máximo: {usd(q.h)} · Mínimo: {usd(q.l)} · Apertura: {usd(q.o)}
          </p>
          <p className="hint">
            Último precio: {timeLabel(data.quote.updated_at)}. Puede estar
            retrasado.
          </p>
        </>
      ) : (
        <p>
          No hay cotización guardada. Los precios se consultan en horario de
          mercado de EE. UU.
        </p>
      )}
      <h3>Noticias de la empresa</h3>
      {data.news.message && (
        <p className="alert warning">{data.news.message}</p>
      )}
      {data.news.data.slice(0, 8).map((n) => (
        <a
          className="news-link"
          key={n.id}
          href={/^https?:\/\//.test(n.url) ? n.url : undefined}
          target="_blank"
          rel="noreferrer"
        >
          {n.headline}
          <small>{n.source}</small>
        </a>
      ))}
    </>
  );
}
