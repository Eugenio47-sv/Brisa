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
import TradeForm from "../TradeForm";
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
  const addTrade = (item = null) =>
    setModal({
      title: item ? "Editar operación" : "Registrar compra o venta",
      content: !data.accounts.length ? (
        <Empty title="Primero agrega una cuenta">
          <p>
            Registra tu banco o efectivo para indicar de dónde sale esta compra.
          </p>
          <button
            className="primary"
            onClick={() => setModal({ type: "account" })}
          >
            Agregar cuenta
          </button>
        </Empty>
      ) : (
        <TradeForm
          accounts={data.accounts}
          item={item}
          quotesEnabled={user.quotesEnabled}
          onSave={async (v) => {
            await mutate(
              "/trades" + (item ? "/" + item.id : ""),
              v,
              item ? "PUT" : "POST",
            );
            setModal(null);
            notify(
              item
                ? "Operación actualizada. Saldos recalculados."
                : "Operación registrada.",
            );
          }}
        />
      ),
    });
  const dividendForm = (item = null) =>
    setModal({
      title: item ? "Editar dividendo" : "Registrar dividendo",
      content: (
        <Form
          onSubmit={async (v) => {
            await mutate(
              "/dividends" + (item ? "/" + item.id : ""),
              { ...v, account_id: Number(v.account_id) },
              item ? "PUT" : "POST",
            );
            setModal(null);
            notify(
              "Dividendo guardado. Se aplica automáticamente en su fecha de cobro.",
            );
          }}
        >
          <Field
            label="Símbolo de la acción o ETF"
            name="symbol"
            defaultValue={item?.symbol}
            placeholder="AAPL"
            maxLength={20}
            required
            list="dividend-symbols"
          />
          <datalist id="dividend-symbols">
            {inv.positions.map((p) => (
              <option key={p.symbol} value={p.symbol} />
            ))}
          </datalist>
          <MoneyField
            label="Importe neto que recibes, después de retenciones (USD)"
            name="amount"
            defaultValue={item?.amount}
          />
          <Field
            label="Fecha de cobro"
            type="date"
            name="date"
            defaultValue={item?.date || dateNow()}
            required
          />
          <AccountSelect
            accounts={data.accounts}
            label="Cuenta donde recibes el dividendo"
            name="account_id"
            defaultValue={item?.account_id}
          />
          <Field
            label="Nota (opcional)"
            name="note"
            maxLength={500}
            defaultValue={item?.note}
          />
          <p className="hint">
            Al llegar la fecha indicada, se suma una sola vez al saldo de la
            cuenta, a los ingresos del mes y al rendimiento realizado. Un pago
            futuro queda programado. Brisa no verifica el depósito con tu
            bróker; registra el importe real y corrige la fecha si cambia. No lo
            registres además como otro ingreso.
          </p>
        </Form>
      ),
    });
  const editPosition = (p) => {
    const initial = inv.initial_holdings?.find((h) => h.symbol === p.symbol);
    setModal({
      title: "Editar posición de " + p.symbol,
      content: initial ? (
        <Form
          onSubmit={async (v) => {
            await mutate(
              "/initial-holdings/" + p.symbol,
              {
                quantity: v.quantity,
                total_cost: v.total_cost || null,
                basis_is_reference: !!initial.basis_is_reference,
              },
              "PUT",
            );
            setModal(null);
          }}
        >
          <Field
            label="Unidades de la tenencia inicial"
            name="quantity"
            type="number"
            min="0.00000001"
            step="0.00000001"
            defaultValue={initial.quantity}
            required
          />
          <MoneyField
            label={
              initial.basis_is_reference
                ? "Valor inicial de referencia (USD)"
                : "Costo total original (opcional, USD)"
            }
            name="total_cost"
            defaultValue={initial.total_cost || ""}
            required={false}
          />
          <p className="hint">
            {initial.basis_is_reference
              ? "El seguimiento del rendimiento comienza desde este valor inicial. "
              : "Deja el costo vacío si todavía no lo conoces. "}
            Esta tenencia no descuenta dinero de tus cuentas. Las compras y
            ventas posteriores se corrigen en el historial de operaciones.
          </p>
        </Form>
      ) : (
        <>
          <p>
            Esta posición se calcula con tus operaciones. Elige cuál quieres
            corregir:
          </p>
          {inv.trades
            .filter((t) => t.symbol === p.symbol)
            .map((t) => (
              <div className="list-row" key={t.id}>
                <span>
                  {t.date} · {t.side === "buy" ? "Compra" : "Venta"} ·{" "}
                  {Number(t.quantity)} unidades
                </span>
                <button className="text-button" onClick={() => addTrade(t)}>
                  Editar operación
                </button>
              </div>
            ))}
        </>
      ),
    });
  };
  const removePosition = (p) =>
    setModal({
      title: "Eliminar posición de " + p.symbol,
      content: (
        <Form
          submit="Eliminar posición y registros"
          onSubmit={async () => {
            await mutate("/positions/" + p.symbol, undefined, "DELETE");
            setModal(null);
            notify("Posición eliminada y saldos recalculados.");
          }}
        >
          <p>
            Se borrarán la tenencia inicial, las compras, ventas y dividendos de{" "}
            {p.symbol}, y se quitará de seguimiento. Los saldos de las cuentas
            se recalcularán. Esta acción no se puede deshacer.
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
      {user.quotesEnabled && data.market_update?.message && (
        <p className="hint" role="status">
          {data.market_update.message}
        </p>
      )}
      <div className="stats-grid">
        <Stat
          label="Valor del portafolio"
          value={inv.value}
          valueLabel={
            inv.value_incomplete ? "Pendiente de cotización" : undefined
          }
          foot="Último precio disponible o costo"
        />
        <Stat
          label="Capital invertido"
          value={inv.cost}
          valueLabel={inv.cost_incomplete ? "Pendiente de costo" : undefined}
          foot={
            inv.uses_reference_basis
              ? "Base inicial + compras posteriores"
              : "Costo de las posiciones abiertas"
          }
        />
        <Stat
          label="Ganancia no realizada"
          value={inv.unrealized}
          valueLabel={inv.cost_incomplete ? "Pendiente de costo" : undefined}
          positive={Number(inv.unrealized) >= 0}
          foot="Posiciones abiertas"
        />
        <Stat
          label="Ganancia realizada"
          value={inv.realized}
          valueLabel={
            inv.realized_incomplete ? "Pendiente de costo" : undefined
          }
          positive={Number(inv.realized) >= 0}
          foot={
            inv.uses_reference_basis
              ? "Ventas desde el inicio + dividendos"
              : "Ventas + dividendos cobrados"
          }
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
            <button className="primary" onClick={() => addTrade()}>
              <Plus size={16} /> Agregar inversión
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
                  <th>Editar / eliminar</th>
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
                      <small>
                        {p.cost_unknown ? "Costo pendiente" : usd(p.average)}
                      </small>
                    </td>
                    <td>
                      {p.price === null ? "Pendiente" : usd(p.price)}
                      <small>
                        {p.price === null
                          ? "Sin cotización disponible"
                          : p.estimated
                            ? "Estimado al costo"
                            : "Cotización: " +
                              timeLabel(
                                p.quote.data?.t
                                  ? new Date(p.quote.data.t * 1000)
                                  : p.quote.updated_at,
                              )}
                      </small>
                      {p.quote &&
                        Date.now() - new Date(p.quote.updated_at).getTime() >
                          5 * 60000 && (
                          <small className="warning-text">
                            Consultado: {timeLabel(p.quote.updated_at)}
                          </small>
                        )}
                    </td>
                    <td>{p.value === null ? "Pendiente" : usd(p.value)}</td>
                    <td
                      className={
                        Number(p.unrealized) >= 0 ? "positive" : "negative"
                      }
                    >
                      {p.cost_unknown ? "Costo pendiente" : usd(p.unrealized)}
                      {!p.cost_unknown && <small>{p.percent} %</small>}
                    </td>
                    <td>
                      {p.weight.toFixed(1)} %
                      {p.weight > 30 && (
                        <small className="warning-text">
                          Concentración alta
                        </small>
                      )}
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => editPosition(p)}
                      >
                        Editar
                      </button>
                      <button
                        className="text-button negative"
                        onClick={() => removePosition(p)}
                      >
                        Eliminar
                      </button>
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
            con rendimientos. Incluye dividendos cobrados.
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
      <Card
        title="Dividendos"
        className="section-gap"
        action={
          <button className="primary" onClick={() => dividendForm()}>
            <Plus size={16} /> Registrar dividendo
          </button>
        }
      >
        <p>
          Cobrados: <strong>{usd(inv.dividends_total || 0)}</strong> ·
          Programados: <strong>{usd(inv.dividends_pending || 0)}</strong>
        </p>
        <p className="hint">
          Los pagos que registres se aplican automáticamente en su fecha de
          cobro. No se consultan ni se confirman depósitos en tu bróker.
        </p>
        {inv.dividends?.length ? (
          inv.dividends.map((d) => (
            <div className="list-row" key={d.id}>
              <div>
                <strong>{d.symbol}</strong>
                <small>
                  {d.date} · {d.account} ·{" "}
                  {d.paid ? "Aplicado al saldo" : "Programado"}
                </small>
                {d.note && <small>{d.note}</small>}
              </div>
              <strong>{usd(d.amount)}</strong>
              <button className="text-button" onClick={() => dividendForm(d)}>
                Editar
              </button>
              <button
                className="text-button negative"
                onClick={() =>
                  setModal({
                    title: "Eliminar dividendo",
                    content: (
                      <Form
                        submit="Eliminar"
                        onSubmit={async () => {
                          await mutate(
                            "/dividends/" + d.id,
                            undefined,
                            "DELETE",
                          );
                          setModal(null);
                        }}
                      >
                        <p>
                          Se quitará este dividendo de {usd(d.amount)}. Se
                          recalcularán la cuenta, los ingresos y el rendimiento.
                        </p>
                      </Form>
                    ),
                  })
                }
              >
                Eliminar
              </button>
            </div>
          ))
        ) : (
          <Empty title="Aún no has registrado dividendos">
            Agrega un pago recibido o programa uno con la fecha de cobro
            confirmada por tu bróker.
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
                  <th>Cuenta / total</th>
                  <th>Acciones</th>
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
                      {data.accounts.find((a) => a.id === t.account_id)?.name ||
                        "Cuenta"}
                      <small>
                        {usd(
                          Number(t.quantity) * Number(t.price) +
                            (t.side === "buy" ? 1 : -1) * Number(t.fee),
                        )}
                      </small>
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => addTrade(t)}
                      >
                        Editar
                      </button>
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
