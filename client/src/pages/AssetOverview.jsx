import React from "react";
import { Card, Stat, Empty, Progress } from "../components";
import { usd } from "../lib";
import { WealthChart, Donut } from "./Overview";
export default function AssetOverview({ data, setTab, setModal }) {
  const inv = data.investments;
  const gain = Number(inv.realized) + Number(inv.unrealized);
  return (
    <>
      <Card className="wealth-card">
        <span className="eyebrow">INVERSIONES + DINERO AHORRADO</span>
        <h2>{usd(data.net_worth)}</h2>
        <p>
          Tu patrimonio registrado. Lo reservado para metas ya está incluido en
          tus cuentas.
        </p>
        {inv.value_incomplete && (
          <small>
            El total todavía no incluye las inversiones sin cotización.
          </small>
        )}
      </Card>
      <div className="stats-grid section-gap">
        <Stat
          label="Inversiones"
          value={inv.value}
          foot="Última cotización disponible"
        />
        <Stat
          label="Banco y efectivo"
          value={data.cash_total}
          foot="Saldo de tus cuentas"
        />
        <Stat
          label="Resultado de inversiones"
          value={gain}
          valueLabel={inv.cost_incomplete ? "Base pendiente" : undefined}
          positive={gain >= 0}
          foot={
            inv.uses_reference_basis
              ? "Desde tu base inicial, incluidos dividendos"
              : "Ventas, dividendos y cambio de valor"
          }
        />
        <Stat
          label="Reservado para metas"
          value={data.saved_for_goals}
          foot="Parte de tu saldo, no dinero adicional"
        />
      </div>
      <div className="two-col section-gap">
        <Card title="Evolución de tu patrimonio">
          <WealthChart snapshots={data.snapshots} />
        </Card>
        <Card title="Cómo está distribuido">
          <Donut
            total={data.net_worth}
            items={[
              { name: "Inversiones", value: inv.value },
              { name: "Banco y efectivo", value: data.cash_total },
            ].filter((i) => Number(i.value) > 0)}
          />
        </Card>
      </div>
      <div className="two-col section-gap">
        <Card
          title="Tus inversiones"
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
                  <small>{Number(p.quantity)} unidades</small>
                </div>
                <strong>
                  {p.value === null ? "Sin cotización" : usd(p.value)}
                </strong>
              </div>
            ))}
          {!inv.positions.some((p) => Number(p.quantity) > 0) && (
            <Empty title="Registra tu primera inversión">
              Agrega una compra para seguir su valor y tus aportes.
            </Empty>
          )}
        </Card>
        <Card
          title="Dinero ahorrado"
          action={
            <button className="text-button" onClick={() => setTab("savings")}>
              Ver cuentas
            </button>
          }
        >
          {data.accounts.map((a) => (
            <div className="list-row" key={a.id}>
              <strong>{a.name}</strong>
              <strong>{usd(a.balance)}</strong>
            </div>
          ))}
          {!data.accounts.length && (
            <Empty title="Agrega tu banco o efectivo">
              Registra el dinero que ya tienes ahorrado.
            </Empty>
          )}
          <button
            className="primary section-gap"
            onClick={() => setModal({ type: "saving-entry" })}
          >
            Agregar dinero
          </button>
        </Card>
      </div>
      <Card
        title="Tus metas"
        action={
          <button className="text-button" onClick={() => setTab("goals")}>
            Gestionar metas
          </button>
        }
      >
        {data.goals.length ? (
          data.goals.map((g) => (
            <div className="goal-mini" key={g.id}>
              <div>
                <strong>{g.name}</strong>
                <span>
                  {usd(g.saved)} de {usd(g.target)}
                </span>
              </div>
              <Progress value={g.percent} />
            </div>
          ))
        ) : (
          <Empty title="¿Qué quieres lograr?">
            <button className="text-button" onClick={() => setTab("goals")}>
              Crear mi primera meta
            </button>
          </Empty>
        )}
      </Card>
    </>
  );
}
