import React, { useState, useEffect } from "react";
import { Plus, ArrowLeftRight, Target, ShieldCheck } from "lucide-react";
import {
  Card,
  Form,
  Field,
  MoneyField,
  AccountSelect,
  Empty,
  Progress,
} from "../components";
import { api, usd, dateNow, types } from "../lib";
export default function Savings({ data, mutate, setModal }) {
  const [transfers, setTransfers] = useState([]),
    [error, setError] = useState("");
  useEffect(() => {
    api("/transfers")
      .then(setTransfers)
      .catch((e) => setError(e.message));
  }, [data]);
  const addGoal = (item) =>
    setModal({
      title: item ? "Editar meta" : "Una nueva meta",
      content: (
        <Form
          onSubmit={async (v) => {
            await mutate(
              "/goals" + (item ? "/" + item.id : ""),
              v,
              item ? "PUT" : "POST",
            );
            setModal(null);
          }}
        >
          <Field
            label="¿Qué quieres lograr?"
            name="name"
            maxLength={80}
            defaultValue={item?.name}
            required
          />
          <MoneyField
            label="Monto objetivo (USD)"
            name="target"
            defaultValue={item?.target}
          />
          <Field
            label="Fecha límite"
            name="deadline"
            type="date"
            defaultValue={item?.deadline}
            required
          />
        </Form>
      ),
    });
  const transfer = () =>
    setModal({
      title: "Mover dinero entre cuentas",
      content: (
        <Form
          onSubmit={async (v) => {
            await mutate("/transfers", {
              ...v,
              from_id: Number(v.from_id),
              to_id: Number(v.to_id),
            });
            setModal(null);
          }}
        >
          <p className="hint">
            Una transferencia cambia dónde está tu dinero, sin contar como
            ingreso o gasto.
          </p>
          <AccountSelect
            accounts={data.accounts}
            label="Desde"
            name="from_id"
          />
          <AccountSelect accounts={data.accounts} label="Hacia" name="to_id" />
          <MoneyField name="amount" />
          <Field
            label="Fecha"
            name="date"
            type="date"
            defaultValue={dateNow()}
            max={dateNow()}
            required
          />
        </Form>
      ),
    });
  const allocate = (g) =>
    setModal({
      title: "Asignar dinero a " + g.name,
      content: (
        <Form
          onSubmit={async (v) => {
            await mutate("/goals/" + g.id + "/contributions", {
              ...v,
              account_id: Number(v.account_id),
            });
            setModal(null);
          }}
        >
          <p>
            Asigna una parte del saldo existente de una cuenta de ahorro. Para
            agregar dinero nuevo, transfiérelo primero. Un monto negativo libera
            una asignación.
          </p>
          <AccountSelect accounts={data.accounts} savings name="account_id" />
          <MoneyField
            label="Monto a asignar o liberar (USD)"
            name="amount"
            min="-999999999999.99"
          />
          <Field
            label="Fecha"
            name="date"
            type="date"
            max={dateNow()}
            defaultValue={dateNow()}
            required
          />
        </Form>
      ),
    });
  return (
    <>
      {error && <p className="error">{error}</p>}
      <div className="section-title">
        <h2>Tus cuentas</h2>
        <div className="inline-actions">
          <button className="text-button" onClick={transfer}>
            <ArrowLeftRight size={17} /> Transferir
          </button>
          <button
            className="primary"
            onClick={() => setModal({ type: "account" })}
          >
            <Plus size={17} /> Nueva cuenta
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
                  ? "Saldo negativo = deuda pendiente"
                  : "Saldo disponible"}
              </small>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Empty title="Un lugar para cada parte de tu dinero">
            Agrega tus cuentas y sus saldos iniciales para empezar.
          </Empty>
        </Card>
      )}
      <div className="section-title">
        <h2>Tus próximas metas</h2>
        <button className="text-button" onClick={() => addGoal()}>
          <Plus size={17} /> Crear meta
        </button>
      </div>
      <div className="goals-grid">
        {data.goals.map((g) => (
          <Card key={g.id} className="goal-card">
            <div className="goal-icon">
              <Target />
            </div>
            <div className="card-heading">
              <h2>{g.name}</h2>
              <span className={"pill " + (g.behind ? "warning-text" : "")}>
                {g.behind ? "Revisa tu ritmo" : "En camino"}
              </span>
            </div>
            <div className="goal-amount">
              <strong>{usd(g.saved)}</strong>
              <span> de {usd(g.target)}</span>
            </div>
            <Progress value={g.percent} />
            <div className="goal-meta">
              <span>{g.percent.toFixed(0)} % completado</span>
              <span>{g.deadline}</span>
            </div>
            <p className="hint">
              Para llegar a tiempo: <strong>{usd(g.weekly)}/semana</strong> o{" "}
              <strong>{usd(g.monthly)}/mes</strong>.
            </p>
            <div className="inline-actions">
              <button onClick={() => allocate(g)}>Asignar ahorro</button>
              <button className="text-button" onClick={() => addGoal(g)}>
                Editar
              </button>
              <button
                className="text-button negative"
                onClick={() =>
                  setModal({
                    title: "Eliminar meta",
                    content: (
                      <Form
                        submit="Eliminar meta"
                        onSubmit={async () => {
                          await mutate("/goals/" + g.id, undefined, "DELETE");
                          setModal(null);
                        }}
                      >
                        <p>
                          Se elimina la meta y sus asignaciones. El dinero
                          permanece en tus cuentas.
                        </p>
                      </Form>
                    ),
                  })
                }
              >
                Eliminar
              </button>
            </div>
          </Card>
        ))}
        {!data.goals.length && (
          <Card>
            <Empty title="Un viaje, un hogar, tranquilidad">
              <button className="text-button" onClick={() => addGoal()}>
                Ponle nombre a tu primera meta →
              </button>
            </Empty>
          </Card>
        )}
      </div>
      <div className="two-col section-gap">
        <Card title="Tu red de tranquilidad" action={<ShieldCheck size={22} />}>
          <p>Fondo de emergencia</p>
          <div className="big-number">{usd(data.emergency.balance)}</div>
          <p className="hint">
            {data.emergency.months
              ? `${data.emergency.months} meses cubiertos`
              : "Registra gastos para calcular tu cobertura"}
            . Basado en los 3 meses completos anteriores, incluidos los meses
            sin gastos.
          </p>
          <Progress
            value={
              Number(data.emergency.target3) > 0
                ? (Number(data.emergency.balance) /
                    Number(data.emergency.target3)) *
                  100
                : 0
            }
          />
          <div className="list-row">
            <span>Meta de 3 meses</span>
            <strong>{usd(data.emergency.target3)}</strong>
          </div>
          <div className="list-row">
            <span>Meta de 6 meses</span>
            <strong>{usd(data.emergency.target6)}</strong>
          </div>
        </Card>
        <Card title="Una guía: 50 / 30 / 20">
          <p className="hint">
            Una referencia flexible para tus ingresos del mes. El remanente no
            equivale a ahorro depositado.
          </p>
          {[
            ["Necesidades", "needs", 50],
            ["Deseos", "wants", 30],
            ["Remanente disponible", "remaining", 20],
          ].map(([name, key, pct]) => (
            <div className="budget-row" key={key}>
              <div>
                <strong>{name}</strong>
                <span>{usd(data.rule[key])}</span>
              </div>
              <Progress
                value={
                  Number(data.income) > 0
                    ? (Number(data.rule[key]) / Number(data.income)) * 100
                    : 0
                }
              />
              <small>
                Referencia {pct} %: {usd((Number(data.income) * pct) / 100)}
              </small>
            </div>
          ))}
        </Card>
      </div>
      <Card title="Transferencias recientes">
        {transfers.length ? (
          transfers.map((t) => (
            <div className="list-row" key={t.id}>
              <div>
                <strong>
                  {t.from_name} → {t.to_name}
                </strong>
                <small>{String(t.date).slice(0, 10)}</small>
              </div>
              <strong>{usd(t.amount)}</strong>
              <button
                className="text-button negative"
                onClick={() =>
                  setModal({
                    title: "Eliminar transferencia",
                    content: (
                      <Form
                        submit="Eliminar"
                        onSubmit={async () => {
                          await mutate(
                            "/transfers/" + t.id,
                            undefined,
                            "DELETE",
                          );
                          setModal(null);
                        }}
                      >
                        <p>Los saldos de ambas cuentas se recalcularán.</p>
                      </Form>
                    ),
                  })
                }
              >
                Borrar
              </button>
            </div>
          ))
        ) : (
          <Empty title="Aún no hay transferencias" />
        )}
      </Card>
    </>
  );
}
