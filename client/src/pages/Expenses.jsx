import React, { useState, useEffect } from "react";
import { Search, Download, Upload, Plus } from "lucide-react";
import {
  Card,
  Field,
  Select,
  Form,
  MoneyField,
  CategorySelect,
  AccountSelect,
  Progress,
  TransactionList,
  Empty,
  Loading,
  Stat,
} from "../components";
import { api, usd, dateNow, download, methods } from "../lib";
export default function Expenses({
  data,
  categories,
  mutate,
  setModal,
  notify,
}) {
  const [section, setSection] = useState("movements"),
    [filters, setFilters] = useState({ page: 1 }),
    [result, setResult] = useState(null),
    [error, setError] = useState(""),
    [recurring, setRecurring] = useState([]);
  useEffect(() => {
    let live = true;
    const q = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== ""),
    );
    setResult(null);
    api("/transactions?" + q)
      .then((r) => {
        if (live) {
          setResult(r);
          setError("");
        }
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [data, filters]);
  useEffect(() => {
    api("/recurring")
      .then(setRecurring)
      .catch((e) => setError(e.message));
  }, [data]);
  const change = (key, value) =>
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  const remove = (t) =>
    setModal({
      title: "Borrar movimiento",
      content: (
        <Form
          submit="Sí, borrar"
          onSubmit={async () => {
            await mutate("/transactions/" + t.id, undefined, "DELETE");
            setModal(null);
            notify("Movimiento eliminado.");
          }}
        >
          <p>
            Se eliminará «{t.note || t.category || "Movimiento"}» por{" "}
            {usd(t.amount)}. El saldo de la cuenta se recalculará.
          </p>
        </Form>
      ),
    });
  const addBudget = (item = null) =>
    setModal({
      title: item ? "Editar presupuesto" : "Definir presupuesto",
      content: (
        <Form
          onSubmit={async (v) => {
            await mutate("/budgets", {
              ...v,
              category_id: v.category_id ? Number(v.category_id) : null,
            });
            setModal(null);
          }}
        >
          <Field
            label="Mes"
            type="month"
            name="month"
            readOnly={!!item}
            defaultValue={item?.month || dateNow().slice(0, 7)}
            required
          />
          <Select
            label="Alcance"
            name="category_id"
            defaultValue={item?.category_id || ""}
            disabled={!!item}
          >
            <option value="">Total mensual</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          {item && (
            <input
              type="hidden"
              name="category_id"
              value={item.category_id || ""}
            />
          )}
          <MoneyField name="amount" defaultValue={item?.amount} />
        </Form>
      ),
    });
  const addRecurring = (item = null) =>
    setModal({
      title: item
        ? "Editar movimiento recurrente"
        : "Nuevo movimiento recurrente",
      content: (
        <Form
          onSubmit={async (v) => {
            await mutate(
              "/recurring" + (item ? "/" + item.id : ""),
              {
                ...v,
                account_id: Number(v.account_id),
                category_id: v.category_id ? Number(v.category_id) : null,
              },
              item ? "PUT" : "POST",
            );
            setModal(null);
          }}
        >
          <Select label="Tipo" name="type" defaultValue={item?.type}>
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </Select>
          <MoneyField name="amount" defaultValue={item?.amount} />
          <Field
            label="Descripción"
            name="note"
            maxLength={500}
            defaultValue={item?.note}
            required
          />
          <AccountSelect
            accounts={data.accounts}
            name="account_id"
            defaultValue={item?.account_id}
          />
          <CategorySelect
            categories={categories}
            name="category_id"
            defaultValue={item?.category_id || ""}
          />
          <Select label="Frecuencia" name="period" defaultValue={item?.period}>
            <option value="monthly">Mensual</option>
            <option value="weekly">Semanal</option>
            <option value="yearly">Anual</option>
          </Select>
          <Field
            label="Primera fecha"
            name="next_date"
            type="date"
            defaultValue={
              item ? String(item.next_date).slice(0, 10) : dateNow()
            }
            required
          />
          <p className="hint">
            Las fechas vencidas se generan automáticamente al iniciar el
            servidor y cada 3 minutos.
          </p>
        </Form>
      ),
    });
  return (
    <>
      <div className="tabs">
        {[
          ["movements", "Movimientos"],
          ["budgets", "Presupuestos"],
          ["recurring", "Recurrentes"],
          ["summary", "Resumen"],
        ].map(([id, n]) => (
          <button
            key={id}
            className={section === id ? "active" : ""}
            onClick={() => setSection(id)}
          >
            {n}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {section === "movements" && (
        <Card
          title="Tu registro"
          action={
            <div className="inline-actions">
              <button
                className="text-button"
                onClick={() =>
                  download("/transactions.csv", "movimientos.csv").catch((e) =>
                    setError(e.message),
                  )
                }
              >
                <Download size={16} /> Exportar
              </button>
              <button
                className="text-button"
                onClick={() =>
                  setModal({
                    title: "Importar movimientos",
                    content: (
                      <ImportForm
                        mutate={mutate}
                        close={() => setModal(null)}
                        notify={notify}
                      />
                    ),
                  })
                }
              >
                <Upload size={16} /> Importar
              </button>
            </div>
          }
        >
          <div className="filters">
            <Field
              label="Buscar"
              type="search"
              value={filters.q || ""}
              onChange={(e) => change("q", e.target.value)}
              placeholder="Nota o categoría"
            />
            <Field
              label="Desde"
              type="date"
              value={filters.from || ""}
              onChange={(e) => change("from", e.target.value)}
            />
            <Field
              label="Hasta"
              type="date"
              value={filters.to || ""}
              onChange={(e) => change("to", e.target.value)}
            />
            <Select
              label="Categoría"
              value={filters.category || ""}
              onChange={(e) => change("category", e.target.value)}
            >
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select
              label="Método"
              value={filters.method || ""}
              onChange={(e) => change("method", e.target.value)}
            >
              <option value="">Todos</option>
              {Object.entries(methods).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
            <Select
              label="Tipo"
              value={filters.type || ""}
              onChange={(e) => change("type", e.target.value)}
            >
              <option value="">Todos</option>
              <option value="expense">Gastos</option>
              <option value="income">Ingresos</option>
            </Select>
            <Field
              label="Mínimo USD"
              type="number"
              min="0"
              value={filters.min || ""}
              onChange={(e) => change("min", e.target.value)}
            />
            <Field
              label="Máximo USD"
              type="number"
              min="0"
              value={filters.max || ""}
              onChange={(e) => change("max", e.target.value)}
            />
          </div>
          {result ? (
            <>
              <TransactionList
                rows={result.rows}
                onEdit={(item) => setModal({ type: "transaction", item })}
                onDelete={remove}
              />
              <div className="pagination">
                <span>{result.total} movimientos</span>
                <button
                  disabled={filters.page <= 1}
                  onClick={() =>
                    setFilters((f) => ({ ...f, page: f.page - 1 }))
                  }
                >
                  Anterior
                </button>
                <span>{filters.page}</span>
                <button
                  disabled={filters.page * 25 >= result.total}
                  onClick={() =>
                    setFilters((f) => ({ ...f, page: f.page + 1 }))
                  }
                >
                  Siguiente
                </button>
              </div>
            </>
          ) : (
            <Loading />
          )}
        </Card>
      )}
      {section === "budgets" && (
        <Card
          title="Presupuestos de este mes"
          action={
            <button className="primary" onClick={() => addBudget()}>
              <Plus size={16} /> Definir
            </button>
          }
        >
          {data.budgets.length ? (
            data.budgets.map((b) => (
              <div className="budget-row" key={b.id}>
                <div>
                  <strong>{b.category || "Presupuesto total"}</strong>
                  <span>
                    {usd(b.spent)} / {usd(b.amount)} · {b.percent.toFixed(0)} %
                  </span>
                </div>
                <Progress value={b.percent} level={b.level} />
                <button className="text-button" onClick={() => addBudget(b)}>
                  Editar presupuesto
                </button>
                <button
                  className="text-button negative"
                  onClick={() =>
                    mutate("/budgets/" + b.id, undefined, "DELETE").catch((e) =>
                      setError(e.message),
                    )
                  }
                >
                  Quitar presupuesto
                </button>
              </div>
            ))
          ) : (
            <Empty title="Ponle un plan a tu mes">
              Define un límite total o por categoría para recibir alertas al
              llegar al 80 %.
            </Empty>
          )}
        </Card>
      )}
      {section === "recurring" && (
        <Card
          title="Pagos que se repiten"
          action={
            <button className="primary" onClick={() => addRecurring()}>
              <Plus size={16} /> Agregar
            </button>
          }
        >
          {recurring.length ? (
            recurring.map((r) => (
              <div className="list-row" key={r.id}>
                <div>
                  <strong>{r.note || "Recurrente"}</strong>
                  <small>
                    {r.account} ·{" "}
                    {r.period === "monthly"
                      ? "Mensual"
                      : r.period === "weekly"
                        ? "Semanal"
                        : "Anual"}{" "}
                    · Próximo: {String(r.next_date).slice(0, 10)}
                  </small>
                </div>
                <strong>{usd(r.amount)}</strong>
                <button className="text-button" onClick={() => addRecurring(r)}>
                  Editar
                </button>
                <button
                  className="text-button negative"
                  onClick={() =>
                    setModal({
                      title: "Eliminar recurrencia",
                      content: (
                        <Form
                          submit="Eliminar"
                          onSubmit={async () => {
                            await mutate(
                              "/recurring/" + r.id,
                              undefined,
                              "DELETE",
                            );
                            setModal(null);
                          }}
                        >
                          <p>
                            Se dejarán de generar nuevos movimientos. Los que ya
                            se registraron se conservan y puedes editarlos o
                            eliminarlos en Movimientos.
                          </p>
                        </Form>
                      ),
                    })
                  }
                >
                  Eliminar
                </button>
                <button
                  onClick={() =>
                    mutate(
                      "/recurring/" + r.id,
                      { active: !r.active },
                      "PATCH",
                    ).catch((e) => setError(e.message))
                  }
                >
                  {r.active ? "Pausar" : "Activar"}
                </button>
              </div>
            ))
          ) : (
            <Empty title="Menos cosas que recordar">
              Agrega tu alquiler, internet o suscripciones.
            </Empty>
          )}
        </Card>
      )}
      {section === "summary" && (
        <>
          <div className="stats-grid">
            <Stat
              label="Promedio diario"
              value={data.daily_average}
              foot="Mes actual"
            />
            <Stat
              label="Proyección al cierre"
              value={data.projection}
              foot="Si mantienes el ritmo actual"
            />
            <Stat
              label="Mes anterior"
              value={data.previous_spent}
              foot="Gastos del mes completo"
            />
            <Stat
              label="Disponible del mes"
              value={data.balance}
              foot="Ingresos menos gastos"
            />
          </div>
          <div className="two-col">
            <Card title="Tus 5 categorías principales">
              {data.categories.slice(0, 5).map((c, i) => (
                <div className="list-row" key={c.name}>
                  <span>
                    {i + 1}. {c.name}
                  </span>
                  <strong>{usd(c.value)}</strong>
                </div>
              ))}
              {!data.categories.length && <Empty />}
            </Card>
            <Card title="Pequeños gastos que suman">
              <p className="hint">
                Compras de hasta $10 repetidas al menos 3 veces este mes,
                agrupadas por nota o categoría.
              </p>
              {data.ants.length ? (
                data.ants.map((a) => (
                  <div className="list-row" key={a.name}>
                    <span>
                      {a.name}
                      <small>{a.count} compras</small>
                    </span>
                    <strong>{usd(a.total)}</strong>
                  </div>
                ))
              ) : (
                <Empty title="Sin patrones frecuentes" />
              )}
            </Card>
            <Card title="Gastos por día">
              {data.daily.map((d) => (
                <div className="list-row" key={d.date}>
                  <span>{d.date}</span>
                  <strong>{usd(d.value)}</strong>
                </div>
              ))}
            </Card>
            <Card title="Resumen semanal">
              {data.weekly.map((w, i) => (
                <div className="list-row" key={i}>
                  <span>
                    Semana del {w.week} ·{" "}
                    {w.type === "income" ? "Ingresos" : "Gastos"}
                  </span>
                  <strong>{usd(w.amount)}</strong>
                </div>
              ))}
            </Card>
            <Card title="Tu año, mes a mes">
              {data.annual.map((a, i) => (
                <div className="list-row" key={i}>
                  <span>
                    {a.month} · {a.type === "income" ? "Ingresos" : "Gastos"}
                  </span>
                  <strong>{usd(a.amount)}</strong>
                </div>
              ))}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
function ImportForm({ mutate, close, notify }) {
  const [csv, setCsv] = useState("");
  return (
    <Form
      submit="Importar filas"
      onSubmit={async () => {
        const result = await mutate("/import", { csv });
        close();
        notify(`${result.imported} movimientos importados.`);
      }}
    >
      <p>
        Usa los encabezados del archivo exportado: type, amount, category_id,
        subcategory, account_id, method, note, date. Fechas AAAA-MM-DD e
        importes con punto decimal.
      </p>
      <p className="hint">
        Máximo 2000 filas. Importar el mismo archivo dos veces duplicará sus
        movimientos. Revisa las cuentas y categorías antes de importarlo.
      </p>
      <Field
        label="Archivo CSV"
        type="file"
        accept=".csv,text/csv"
        required
        onChange={async (e) => {
          const file = e.target.files[0];
          if (file) {
            if (file.size > 800000) {
              e.target.value = "";
              setCsv("");
              return;
            }
            setCsv(await file.text());
          }
        }}
      />
      <small>
        {csv ? "Archivo listo para importar." : "Tamaño máximo: 800 KB."}
      </small>
    </Form>
  );
}
