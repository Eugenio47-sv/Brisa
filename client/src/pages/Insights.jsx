import React, { useState } from "react";
import { Card, Progress, Empty } from "../components";
import { usd } from "../lib";
export default function Insights({ data, setTab }) {
  const [question, setQuestion] = useState("total");
  const inv = data.investments;
  const remaining = data.goals.reduce(
    (s, g) => s + Math.max(0, Number(g.target) - Number(g.saved)),
    0,
  );
  const answers = {
    total: `Tienes ${usd(data.net_worth)} registrados: ${usd(inv.value)} en inversiones y ${usd(data.cash_total)} en banco y efectivo. Lo reservado para metas ya está dentro de tus cuentas y no se suma dos veces.`,
    investments: `Tus inversiones valen ${usd(inv.value)} según la última cotización. Las compras que has registrado suman ${usd(inv.purchases_total || 0)}. Tu tenencia inicial usa una base de ${usd(inv.initial_basis || 0)}; esa base no cuenta como una compra nueva. El resultado desde tu punto de partida es ${usd(Number(inv.realized) + Number(inv.unrealized))}, incluidos dividendos.`,
    goals: data.goals.length
      ? `Tienes ${data.goals.length} metas y ${usd(data.saved_for_goals)} reservados. Para completar todas faltan ${usd(remaining)}. Puedes aportar desde una cuenta con saldo libre, sin duplicar el dinero.`
      : "Todavía no tienes metas. Crea una con un importe objetivo y una fecha; después podrás reservar parte de tus ahorros.",
    dividends: `Has registrado ${usd(inv.dividends_total)} de dividendos cobrados y ${usd(inv.dividends_pending)} con fecha futura. Los cobrados ya se incluyen en el saldo de la cuenta elegida. No los registres otra vez como dinero agregado.`,
  };
  return (
    <>
      <Card title="Entiende tus números">
        <p className="hint">
          Elige una pregunta. Las respuestas se calculan con tus registros, sin
          un servicio de chat externo.
        </p>
        <div className="inline-actions section-gap">
          {[
            ["total", "¿Cuánto tengo?"],
            ["investments", "¿Cómo van mis inversiones?"],
            ["goals", "¿Cómo van mis metas?"],
            ["dividends", "¿Y mis dividendos?"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={question === id ? "selected" : ""}
              onClick={() => setQuestion(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="insight-answer" role="status">
          {answers[question]}
        </p>
      </Card>
      <div className="two-col section-gap">
        <Card
          title="Tus activos"
          action={
            <button
              className="text-button"
              onClick={() => setTab("investments")}
            >
              Ver inversiones
            </button>
          }
        >
          {inv.positions
            .filter((p) => Number(p.quantity) > 0)
            .map((p) => (
              <div className="list-row" key={p.symbol}>
                <div>
                  <strong>{p.symbol}</strong>
                  <small>
                    {Number(p.quantity)} unidades · {p.weight.toFixed(1)} % de
                    la cartera registrada
                  </small>
                </div>
                <strong>
                  {p.value === null ? "Sin cotización" : usd(p.value)}
                </strong>
              </div>
            ))}
          {!inv.positions.some((p) => Number(p.quantity) > 0) && (
            <Empty title="Aún no hay inversiones">
              Registra una compra para seguir su evolución.
            </Empty>
          )}
        </Card>
        <Card
          title="Avance de tus metas"
          action={
            <button className="text-button" onClick={() => setTab("goals")}>
              Ver metas
            </button>
          }
        >
          {data.goals.map((g) => (
            <div className="goal-mini" key={g.id}>
              <div>
                <strong>{g.name}</strong>
                <span>
                  {usd(g.saved)} de {usd(g.target)}
                </span>
              </div>
              <Progress value={g.percent} />
              <small>
                Faltan {usd(Math.max(0, Number(g.target) - Number(g.saved)))} ·
                Fecha objetivo: {g.deadline}
              </small>
            </div>
          ))}
          {!data.goals.length && (
            <Empty title="Dale un destino a tus ahorros">
              Crea tu primera meta cuando quieras.
            </Empty>
          )}
        </Card>
      </div>
    </>
  );
}
