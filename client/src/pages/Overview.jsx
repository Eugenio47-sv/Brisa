import React, { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  TrendingUp,
  ArrowDownLeft,
  ArrowUp,
  ChevronRight,
  Leaf,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Card,
  Stat,
  Empty,
  Progress,
  TransactionList,
  Form,
} from "../components";
import { api, usd, dateLabel } from "../lib";
export function WealthChart({ snapshots, field = "net_worth" }) {
  if (!snapshots.length)
    return (
      <Empty title="Tu evolución empieza hoy">
        La primera foto se guardará automáticamente. Las siguientes mostrarán tu
        progreso real.
      </Empty>
    );
  return (
    <div
      className="chart"
      role="img"
      aria-label="Evolución del patrimonio en dólares"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={snapshots.map((s) => ({ ...s, [field]: Number(s[field]) }))}
          margin={{ top: 15, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={"fill-" + field} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#198f79" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#198f79" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 5"
            stroke="var(--border)"
          />
          <XAxis
            dataKey="date"
            tickFormatter={dateLabel}
            tickLine={false}
            axisLine={false}
            minTickGap={35}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
          />
          <YAxis
            tickFormatter={(n) =>
              "$" + (Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + "k" : n)
            }
            tickLine={false}
            axisLine={false}
            width={60}
            tick={{ fontSize: 11, fill: "var(--muted)" }}
          />
          <Tooltip
            formatter={(v) => usd(v)}
            labelFormatter={dateLabel}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
            }}
          />
          <Area
            name={field === "profit" ? "Ganancia acumulada" : "Valor"}
            type="monotone"
            dataKey={field}
            stroke="#198f79"
            strokeWidth={2.5}
            fill={`url(#fill-${field})`}
            dot={snapshots.length === 1}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function Donut({ items, total, label = "Total" }) {
  return items.length ? (
    <div className="donut-wrap">
      <div
        className="donut"
        role="img"
        aria-label={items.map((c) => `${c.name}: ${usd(c.value)}`).join(", ")}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={items.map((c) => ({ ...c, value: Number(c.value) }))}
              dataKey="value"
              innerRadius={66}
              outerRadius={84}
              paddingAngle={3}
              stroke="none"
            >
              {items.map((c, i) => (
                <Cell
                  key={c.name}
                  fill={
                    c.color ||
                    ["#137e6b", "#6bae95", "#b7d3bd", "#dfb46c", "#748eb3"][
                      i % 5
                    ]
                  }
                />
              ))}
            </Pie>
            <Tooltip formatter={usd} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <small>{label}</small>
          <strong>{usd(total)}</strong>
        </div>
      </div>
      <div className="legend">
        {items.slice(0, 5).map((c, i) => (
          <div key={c.name}>
            <span
              className="legend-dot"
              style={{
                background:
                  c.color ||
                  ["#137e6b", "#6bae95", "#b7d3bd", "#dfb46c", "#748eb3"][
                    i % 5
                  ],
              }}
            />
            <span>{c.name}</span>
            <strong>{usd(c.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  ) : (
    <Empty title="Aún sin distribución">
      Tus registros darán forma a esta gráfica.
    </Empty>
  );
}
export default function Overview({ data, setTab, setModal, mutate }) {
  const [recent, setRecent] = useState([]),
    [err, setErr] = useState("");
  useEffect(() => {
    api("/transactions")
      .then((r) => {
        setRecent(r.rows.slice(0, 5));
        setErr("");
      })
      .catch((e) => setErr(e.message));
  }, [data]);
  return (
    <>
      <div className="overview-top">
        <section className="wealth-card">
          <div className="wealth-top">
            <span>
              <Wallet size={19} /> PATRIMONIO TOTAL
            </span>
            <span className="live-dot">Tu balance actual</span>
          </div>
          <h2>{usd(data.net_worth)}</h2>
          <p>
            {data.month_change === null ? (
              <span>Construyendo tu historial mensual</span>
            ) : (
              <>
                <span className="change">
                  <ArrowUpRight size={15} />
                  {usd(data.month_change)}
                </span>{" "}
                frente al cierre del mes anterior
              </>
            )}
          </p>
          <div className="wealth-breakdown">
            <div>
              <small>Inversiones</small>
              <strong>{usd(data.investments.value)}</strong>
            </div>
            <div>
              <small>Ahorros</small>
              <strong>
                {usd(
                  data.accounts
                    .filter((a) => ["savings", "emergency"].includes(a.type))
                    .reduce((s, a) => s + Number(a.balance), 0),
                )}
              </strong>
            </div>
            <div>
              <small>Efectivo y cuentas netas</small>
              <strong>
                {usd(
                  data.accounts
                    .filter((a) => !["savings", "emergency"].includes(a.type))
                    .reduce((s, a) => s + Number(a.balance), 0),
                )}
              </strong>
            </div>
          </div>
          <div className="wealth-decoration" />
        </section>
        <section className="insight-card">
          <span className="insight-icon">
            <Leaf size={25} />
          </span>
          <p className="eyebrow">UN PASO A LA VEZ</p>
          <h2>
            La tranquilidad
            <br />
            también se construye.
          </h2>
          <p>
            {data.emergency.months
              ? `Tu fondo de emergencia cubre ${data.emergency.months} meses de gastos. Sigue a tu ritmo.`
              : "Empieza por un fondo de emergencia. Un pequeño aporte puede ser un gran comienzo."}
          </p>
          <button onClick={() => setTab("savings")}>
            Ver mis metas <ArrowUpRight size={17} />
          </button>
        </section>
      </div>
      <div className="stats-grid">
        <Stat
          label="Ingresos del mes"
          value={data.income}
          foot="Lo que entró a tus cuentas"
          icon={<ArrowDownLeft size={19} />}
          positive
        />
        <Stat
          label="Gastos del mes"
          value={data.spent}
          foot={
            data.expense_change === null
              ? "Tu primer mes de referencia"
              : `${data.expense_change}% frente al mes anterior`
          }
          icon={<ArrowUpRight size={19} />}
        />
        <Stat
          label="Balance del mes"
          value={data.balance}
          foot="Ingresos menos gastos"
          positive={Number(data.balance) >= 0}
          icon={<Wallet size={19} />}
        />
        <Stat
          label="Resultado de inversiones"
          value={
            Number(data.investments.realized) +
            Number(data.investments.unrealized)
          }
          foot="Ganancia realizada + no realizada"
          positive={
            Number(data.investments.realized) +
              Number(data.investments.unrealized) >=
            0
          }
          icon={<TrendingUp size={19} />}
        />
      </div>
      <div className="chart-grid">
        <Card
          title="Así crece tu patrimonio"
          action={<span className="pill">Últimos 12 meses</span>}
        >
          <p className="section-caption">
            Cada día cuenta. Esta es tu evolución.
          </p>
          <WealthChart snapshots={data.snapshots} />
        </Card>
        <Card
          title="¿A dónde va tu dinero?"
          action={<span className="muted">Este mes</span>}
        >
          <Donut items={data.categories} total={data.spent} label="Gastado" />
        </Card>
      </div>
      <div className="chart-grid">
        <Card
          title="Últimos movimientos"
          action={
            <button className="text-button" onClick={() => setTab("expenses")}>
              Ver todos <ChevronRight size={15} />
            </button>
          }
        >
          {err ? (
            <p className="error">{err}</p>
          ) : (
            <TransactionList
              rows={recent}
              onEdit={(item) => setModal({ type: "transaction", item })}
              onDelete={(item) =>
                setModal({
                  title: "Eliminar movimiento",
                  content: (
                    <Form
                      submit="Eliminar"
                      onSubmit={async () => {
                        await mutate(
                          "/transactions/" + item.id,
                          undefined,
                          "DELETE",
                        );
                        setModal(null);
                      }}
                    >
                      <p>
                        Se eliminará este movimiento de {usd(item.amount)} y se
                        recalculará el saldo de tu cuenta.
                      </p>
                    </Form>
                  ),
                })
              }
            />
          )}
        </Card>
        <Card
          title="Tus metas, más cerca"
          action={
            <button className="text-button" onClick={() => setTab("savings")}>
              Ver metas <ChevronRight size={15} />
            </button>
          }
        >
          {data.goals.length ? (
            data.goals.slice(0, 3).map((g) => (
              <div className="goal-mini" key={g.id}>
                <div>
                  <strong>{g.name}</strong>
                  <span>{Math.round(g.percent)} %</span>
                </div>
                <Progress value={g.percent} />
                <small>
                  {usd(g.saved)} de {usd(g.target)}
                </small>
              </div>
            ))
          ) : (
            <Empty title="¿Qué te gustaría lograr?">
              <button className="text-button" onClick={() => setTab("savings")}>
                Crear mi primera meta →
              </button>
            </Empty>
          )}
        </Card>
      </div>
      <section id="alerts">
        <div className="section-title">
          <h2>Para tener en cuenta</h2>
          <span className="muted">Pequeñas señales, mejores decisiones</span>
        </div>
        {data.alerts.length ? (
          <div className="alerts-grid">
            {data.alerts.map((a, i) => (
              <div className={"alert " + a.type} key={i}>
                <span>↗</span>
                {a.text}
              </div>
            ))}
          </div>
        ) : (
          <div className="calm-note">
            ✓ Sin alertas por ahora. Sigue registrando tus movimientos para
            recibir información útil.
          </div>
        )}
      </section>
    </>
  );
}
