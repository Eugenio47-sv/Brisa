import React, { useEffect, useState } from "react";
import { Form, Field, Select, MoneyField, AccountSelect } from "./components";
import { api, dateNow, usd, timeLabel } from "./lib";

export default function TradeForm({ accounts, item, quotesEnabled, onSave }) {
  const [query, setQuery] = useState(item?.symbol || "");
  const [selected, setSelected] = useState(
    item ? { symbol: item.symbol, name: item.symbol } : null,
  );
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [quote, setQuote] = useState(null);
  const [quantity, setQuantity] = useState(item?.quantity || "");
  const [side, setSide] = useState(item?.side || "buy");
  const [fee, setFee] = useState(item?.fee || "0");
  const [total, setTotal] = useState(
    item
      ? (
          Number(item.quantity) * Number(item.price) +
          (item.side === "buy" ? 1 : -1) * Number(item.fee)
        ).toFixed(2)
      : "",
  );

  useEffect(() => {
    if (!quotesEnabled || selected || query.trim().length < 2) {
      setMatches([]);
      setSearching(false);
      return;
    }
    let live = true;
    setSearching(true);
    const timer = setTimeout(() => {
      api("/stocks/search?q=" + encodeURIComponent(query.trim()))
        .then((items) => {
          if (live) {
            setMatches(items);
            setMessage(
              items.length
                ? ""
                : "No encontramos resultados. Prueba el símbolo del activo.",
            );
          }
        })
        .catch((e) => {
          if (live) setMessage(e.message);
        })
        .finally(() => {
          if (live) setSearching(false);
        });
    }, 500);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, selected, quotesEnabled]);

  useEffect(() => {
    setQuote(null);
    if (!selected || !quotesEnabled) return;
    let live = true;
    api("/stocks/" + encodeURIComponent(selected.symbol) + "/quote")
      .then((q) => {
        if (live) {
          setQuote(q);
          setMessage("");
        }
      })
      .catch((e) => {
        if (live)
          setMessage(
            e.message + " Puedes registrar el importe real de tu operación.",
          );
      });
    return () => {
      live = false;
    };
  }, [selected, quotesEnabled]);

  const q = Number(quantity),
    gross = Number(total) + (side === "buy" ? -1 : 1) * Number(fee);
  return (
    <Form
      onSubmit={async (values) => {
        if (!selected)
          throw new Error(
            "Selecciona una acción de la búsqueda o confirma su símbolo.",
          );
        await onSave({
          ...values,
          symbol: selected.symbol,
          account_id: Number(values.account_id),
        });
      }}
    >
      <Field
        label={
          quotesEnabled
            ? "Busca por nombre o símbolo (Apple, Tesla, AAPL…)"
            : "Símbolo de la acción o ETF"
        }
        value={query}
        maxLength={80}
        autoComplete="off"
        required
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
          setMessage("");
        }}
      />
      {searching && (
        <p role="status" className="hint">
          Buscando acciones…
        </p>
      )}
      {matches.length > 0 && (
        <div
          className="stock-search-results"
          aria-label="Resultados de acciones"
        >
          {matches.map((match) => (
            <button
              type="button"
              key={match.symbol}
              onClick={() => {
                setSelected(match);
                setQuery(match.name + " · " + match.symbol);
                setMatches([]);
              }}
            >
              <strong>{match.symbol}</strong>
              <span>{match.name}</span>
              <small>{match.type}</small>
            </button>
          ))}
        </div>
      )}
      {!selected && /^[A-Za-z0-9][A-Za-z0-9.:-]{0,19}$/.test(query.trim()) && (
        <button
          type="button"
          className="text-button"
          onClick={() => {
            const symbol = query.trim().toUpperCase();
            setSelected({ symbol, name: symbol });
            setQuery(symbol);
          }}
        >
          Usar símbolo {query.trim().toUpperCase()}
        </button>
      )}
      {selected && (
        <p className="hint">
          Activo seleccionado:{" "}
          <strong>
            {selected.name} ({selected.symbol})
          </strong>
        </p>
      )}
      {!quotesEnabled && (
        <p className="hint">
          Configura Finnhub en Render para buscar por nombre y verificar
          precios. Puedes registrar el símbolo y el costo mientras tanto.
        </p>
      )}
      {message && (
        <p role="status" className="alert warning">
          {message}
        </p>
      )}
      {quote && (
        <p className="alert">
          Último precio disponible: <strong>{usd(quote.data.c)}</strong> ·{" "}
          {timeLabel(quote.updated_at)}. Es una referencia; tu costo se calcula
          con el importe que pagaste.
        </p>
      )}
      <div className="form-grid">
        <Select
          label="Operación"
          name="side"
          value={side}
          onChange={(e) => setSide(e.target.value)}
        >
          <option value="buy">Compra</option>
          <option value="sell">Venta</option>
        </Select>
        <Field
          label="Cantidad de acciones (por ejemplo, 1 o 0.94)"
          name="quantity"
          type="number"
          inputMode="decimal"
          step="0.00000001"
          min="0.00000001"
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <MoneyField
          label={
            side === "buy"
              ? "Total que pagaste, incluida comisión (USD)"
              : "Total que recibiste, descontada comisión (USD)"
          }
          name="total"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
        />
        <MoneyField
          label="Comisión incluida en ese total (USD)"
          name="fee"
          min="0"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
        />
        <Field
          label="Fecha de la operación"
          name="date"
          type="date"
          max={dateNow()}
          defaultValue={item?.date || dateNow()}
          required
        />
      </div>
      <AccountSelect
        accounts={accounts}
        name="account_id"
        label={
          side === "buy"
            ? "Cuenta de donde salió el dinero"
            : "Cuenta donde recibiste el dinero"
        }
        defaultValue={item?.account_id || ""}
      />
      {q > 0 && gross > 0 && (
        <div className="trade-summary" aria-live="polite">
          <p>
            Precio de {side === "buy" ? "compra" : "venta"} calculado:{" "}
            <strong>{usd(gross / q)}</strong> por acción.
          </p>
          <p>
            Se {side === "buy" ? "descontarán" : "abonarán"}{" "}
            <strong>{usd(total)}</strong> en la cuenta elegida.
          </p>
          {quote && (
            <p>
              Valor de estas unidades al último precio:{" "}
              <strong>{usd(q * quote.data.c)}</strong>.
            </p>
          )}
        </div>
      )}
      <p className="hint">
        Brisa calcula el costo promedio y recalcula tu cartera y el saldo al
        guardar. Al editar se reemplaza esta operación, sin duplicar cargos.
      </p>
    </Form>
  );
}
