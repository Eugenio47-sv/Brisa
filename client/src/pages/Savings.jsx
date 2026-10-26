import React, { useEffect, useState } from "react";
import { Plus, ArrowLeftRight, Target } from "lucide-react";
import {
  Card,
  Form,
  Field,
  Select,
  MoneyField,
  AccountSelect,
  Empty,
  Progress,
} from "../components";
import { api, usd, dateNow, types } from "../lib";
import { AccountForm } from "../App";
import MoneyEntryForm from "../MoneyEntryForm";

export default function Savings({ data, mutate, setModal, notify, view }) {
  const [localSection, setSection] = useState("accounts");
  const section = view || localSection;
  const [transfers, setTransfers] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [cashEntries, setCashEntries] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    Promise.all([
      api("/transfers"),
      api("/contributions"),
      api("/cash-entries"),
    ])
      .then(([t, c, e]) => {
        if (live) {
          setTransfers(t);
          setContributions(c);
          setCashEntries(e);
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [data]);
  const fundingAccounts = data.accounts.filter((a) => a.type !== "credit");
  const finish = (message) => {
    setModal(null);
    notify(message);
  };
  const confirmDelete = (title, description, path) =>
    setModal({
      title,
      content: (
        <Form
          submit="Eliminar"
          onSubmit={async () => {
            await mutate(path, undefined, "DELETE");
            finish("Registro eliminado.");
          }}
        >
          <p>{description}</p>
        </Form>
      ),
    });
  const accountForm = (item = null) =>
    setModal({
      title: item ? "Editar cuenta" : "Agregar cuenta",
      content: (
        <>
          <AccountForm
            item={item}
            onSave={async (v) => {
              await mutate(
                "/accounts" + (item ? "/" + item.id : ""),
                v,
                item ? "PUT" : "POST",
              );
              finish("Cuenta guardada.");
            }}
          />
          {item && (
            <button
              className="text-button negative section-gap"
              onClick={() =>
                confirmDelete(
                  "Eliminar cuenta",
                  `Se eliminará «${item.name}» si no tiene registros asociados. Su saldo inicial dejará de formar parte de tu patrimonio.`,
                  "/accounts/" + item.id,
                )
              }
            >
              Eliminar esta cuenta
            </button>
          )}
        </>
      ),
    });
  const goalForm = (item = null) =>
    setModal({
      title: item ? "Editar meta" : "Crear meta",
      content: (
        <>
          <Form
            onSubmit={async (v) => {
              await mutate(
                "/goals" + (item ? "/" + item.id : ""),
                v,
                item ? "PUT" : "POST",
              );
              finish("Meta guardada.");
            }}
          >
            <Field
              label="¿Qué quieres lograr?"
              name="name"
              maxLength={80}
              defaultValue={item?.name}
              placeholder="Mi próximo viaje"
              required
            />
            <MoneyField
              label="¿Cuánto necesitas? (USD)"
              name="target"
              defaultValue={item?.target}
            />
            <Field
              label="¿Para cuándo?"
              name="deadline"
              type="date"
              defaultValue={item?.deadline}
              required
            />
          </Form>
          {item && (
            <button
              className="text-button negative section-gap"
              onClick={() =>
                confirmDelete(
                  "Eliminar meta",
                  "Se eliminarán la meta y sus aportes. El dinero permanece en tus cuentas.",
                  "/goals/" + item.id,
                )
              }
            >
              Eliminar esta meta
            </button>
          )}
        </>
      ),
    });
  const transferForm = (item = null) =>
    setModal({
      title: item ? "Editar transferencia" : "Transferir entre cuentas",
      content: (
        <Form
          onSubmit={async (v) => {
            await mutate(
              "/transfers" + (item ? "/" + item.id : ""),
              { ...v, from_id: Number(v.from_id), to_id: Number(v.to_id) },
              item ? "PUT" : "POST",
            );
            finish("Transferencia guardada.");
          }}
        >
          <AccountSelect
            accounts={data.accounts}
            label="Desde"
            name="from_id"
            defaultValue={item?.from_id}
          />
          <AccountSelect
            accounts={data.accounts}
            label="Hacia"
            name="to_id"
            defaultValue={item?.to_id}
          />
          <MoneyField name="amount" defaultValue={item?.amount} />
          <Field
            label="Fecha"
            name="date"
            type="date"
            defaultValue={item ? String(item.date).slice(0, 10) : dateNow()}
            max={dateNow()}
            required
          />
          <p className="hint">
            Solo cambia dónde está tu dinero. No se cuenta como ingreso ni
            gasto.
          </p>
        </Form>
      ),
    });
  const contributionForm = (goal, item = null) =>
    setModal({
      title: item ? "Editar aporte o retiro" : "Ahorrar para " + goal.name,
      content: fundingAccounts.length ? (
        <Form
          onSubmit={async (v) => {
            const amount =
              v.direction === "withdraw" ? "-" + v.amount : v.amount;
            await mutate(
              item
                ? "/contributions/" + item.id
                : "/goals/" + goal.id + "/contributions",
              { amount, account_id: Number(v.account_id), date: v.date },
              item ? "PUT" : "POST",
            );
            finish("Ahorro actualizado.");
          }}
        >
          <Select
            label="¿Qué quieres hacer?"
            name="direction"
            defaultValue={item && Number(item.amount) < 0 ? "withdraw" : "add"}
          >
            <option value="add">Agregar ahorro a esta meta</option>
            <option value="withdraw">Retirar ahorro de esta meta</option>
          </Select>
          <AccountSelect
            accounts={fundingAccounts}
            label="Cuenta donde está ese dinero"
            name="account_id"
            defaultValue={item?.account_id}
          />
          <MoneyField
            label="Monto (USD)"
            name="amount"
            defaultValue={
              item ? Math.abs(Number(item.amount)).toFixed(2) : undefined
            }
          />
          <Field
            label="Fecha"
            name="date"
            type="date"
            max={dateNow()}
            defaultValue={item?.date || dateNow()}
            required
          />
          <p className="hint">
            Reservas dinero que ya tienes en esa cuenta. Su saldo no cambia y el
            mismo dinero no puede asignarse a dos metas. Retirar lo deja
            disponible otra vez.
          </p>
        </Form>
      ) : (
        <Empty title="Primero agrega una cuenta">
          Elige dónde guardarás el dinero de tus metas.
          <button className="primary" onClick={() => accountForm()}>
            Agregar cuenta
          </button>
        </Empty>
      ),
    });
  const moneyEntry = (item = null) =>
    setModal({
      title: item ? "Editar ahorro registrado" : "Agregar o retirar dinero",
      content: (
        <MoneyEntryForm
          accounts={data.accounts}
          item={item}
          onAccount={() => accountForm()}
          onSave={async (v) => {
            await mutate(
              "/cash-entries" + (item ? "/" + item.id : ""),
              v,
              item ? "PUT" : "POST",
            );
            finish("Ahorro actualizado.");
          }}
        />
      ),
    });
  const goalHistory = (goal) => {
    const rows = contributions.filter((c) => c.goal_id === goal.id);
    setModal({
      title: "Aportes de " + goal.name,
      content: (
        <>
          <p>
            <strong>{usd(goal.saved)}</strong> ahorrados de {usd(goal.target)}.
          </p>
          <button className="primary" onClick={() => contributionForm(goal)}>
            Agregar ahorro
          </button>
          {rows.length ? (
            rows.map((c) => (
              <div className="list-row" key={c.id}>
                <div>
                  <strong>
                    {Number(c.amount) < 0 ? "Retiro" : "Aporte"} ·{" "}
                    {usd(Math.abs(Number(c.amount)))}
                  </strong>
                  <small>
                    {c.account} · {c.date}
                  </small>
                </div>
                <button
                  className="text-button"
                  onClick={() => contributionForm(goal, c)}
                >
                  Editar
                </button>
                <button
                  className="text-button negative"
                  onClick={() =>
                    confirmDelete(
                      "Eliminar aporte o retiro",
                      "Se corregirá lo reservado a esta meta. El dinero de tu cuenta no cambia.",
                      "/contributions/" + c.id,
                    )
                  }
                >
                  Eliminar
                </button>
              </div>
            ))
          ) : (
            <Empty title="Todavía no hay aportes">
              Agrega tu primer ahorro cuando quieras.
            </Empty>
          )}
        </>
      ),
    });
  };
  return (
    <>
      {!view && (
        <div className="tabs" aria-label="Organizar ahorros">
          <button
            aria-pressed={section === "accounts"}
            className={section === "accounts" ? "active" : ""}
            onClick={() => setSection("accounts")}
          >
            Cuentas
          </button>
          <button
            aria-pressed={section === "goals"}
            className={section === "goals" ? "active" : ""}
            onClick={() => setSection("goals")}
          >
            Metas
          </button>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {section === "accounts" ? (
        <>
          <div className="section-title">
            <div>
              <h2>Mis cuentas</h2>
              <p className="hint">
                Dónde está tu dinero y cuánto tienes disponible.
              </p>
            </div>
            <div className="inline-actions">
              {data.accounts.some((a) => a.type !== "credit") && (
                <button className="primary" onClick={() => moneyEntry()}>
                  <Plus size={16} /> Agregar dinero
                </button>
              )}
              {data.accounts.length > 1 && (
                <button className="text-button" onClick={() => transferForm()}>
                  <ArrowLeftRight size={16} /> Transferir
                </button>
              )}
              <button
                className={data.accounts.length ? "text-button" : "primary"}
                onClick={() => accountForm()}
              >
                <Plus size={16} /> Agregar cuenta
              </button>
            </div>
          </div>
          {data.accounts.length ? (
            <div className="account-grid">
              {data.accounts.map((a) => (
                <Card key={a.id} className="account-card">
                  <span className="eyebrow">{types[a.type]}</span>
                  <h3>{a.name}</h3>
                  <strong className={Number(a.balance) < 0 ? "negative" : ""}>
                    {usd(a.balance)}
                  </strong>
                  <small>
                    {a.type === "credit"
                      ? "Saldo negativo = deuda"
                      : "Saldo actual"}
                  </small>
                  <button
                    className="text-button section-gap"
                    onClick={() => accountForm(a)}
                  >
                    Editar cuenta
                  </button>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <Empty title="Agrega tu primera cuenta">
                Puede ser tu banco, tu ahorro o el dinero que llevas en
                efectivo.
              </Empty>
            </Card>
          )}
          {cashEntries.length > 0 && (
            <details className="savings-history section-gap">
              <summary>Historial de ahorros ({cashEntries.length})</summary>
              {cashEntries.map((e) => (
                <div className="list-row" key={e.id}>
                  <div>
                    <strong>
                      {e.note ||
                        (Number(e.amount) > 0 ? "Dinero agregado" : "Retiro")}
                    </strong>
                    <small>
                      {e.account} · {e.date}
                    </small>
                  </div>
                  <strong>{usd(e.amount)}</strong>
                  <button className="text-button" onClick={() => moneyEntry(e)}>
                    Editar
                  </button>
                  <button
                    className="text-button negative"
                    onClick={() =>
                      confirmDelete(
                        "Eliminar registro de ahorro",
                        "Se recalculará el saldo de la cuenta. No se borrarán otros registros.",
                        "/cash-entries/" + e.id,
                      )
                    }
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </details>
          )}
          {transfers.length > 0 && (
            <details className="savings-history section-gap">
              <summary>Ver transferencias ({transfers.length})</summary>
              {transfers.map((t) => (
                <div className="list-row" key={t.id}>
                  <div>
                    <strong>
                      {t.from_name} → {t.to_name}
                    </strong>
                    <small>{String(t.date).slice(0, 10)}</small>
                  </div>
                  <strong>{usd(t.amount)}</strong>
                  <button
                    className="text-button"
                    onClick={() => transferForm(t)}
                  >
                    Editar
                  </button>
                  <button
                    className="text-button negative"
                    onClick={() =>
                      confirmDelete(
                        "Eliminar transferencia",
                        "Se recalcularán los saldos de ambas cuentas.",
                        "/transfers/" + t.id,
                      )
                    }
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </details>
          )}
        </>
      ) : (
        <>
          <div className="section-title">
            <div>
              <h2>Mis metas</h2>
              <p className="hint">
                Elige un objetivo y guarda dinero a tu ritmo.
              </p>
            </div>
            <button className="primary" onClick={() => goalForm()}>
              <Plus size={16} /> Crear meta
            </button>
          </div>
          <div className="goals-grid">
            {data.goals.map((g) => (
              <Card key={g.id} className="goal-card">
                <div className="card-heading">
                  <h2>{g.name}</h2>
                  <Target size={20} />
                </div>
                <div className="goal-amount">
                  <strong>{usd(g.saved)}</strong>
                  <span> de {usd(g.target)}</span>
                </div>
                <Progress value={g.percent} />
                <div className="goal-meta">
                  <span>{Math.round(g.percent)} % completado</span>
                  <span>Hasta {g.deadline}</span>
                </div>
                <div className="inline-actions section-gap">
                  <button
                    className="primary"
                    onClick={() => contributionForm(g)}
                  >
                    Agregar ahorro
                  </button>
                  <button
                    className="text-button"
                    onClick={() => goalHistory(g)}
                  >
                    Ver aportes
                  </button>
                  <button className="text-button" onClick={() => goalForm(g)}>
                    Editar meta
                  </button>
                </div>
              </Card>
            ))}
          </div>
          {!data.goals.length && (
            <Card>
              <Empty title="¿Qué quieres lograr?">
                Un viaje, una compra o un fondo para el futuro. Crea tu primera
                meta para empezar.
              </Empty>
            </Card>
          )}
        </>
      )}
    </>
  );
}
