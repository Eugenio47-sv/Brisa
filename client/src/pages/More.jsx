import React, { useState, useEffect } from "react";
import {
  ExternalLink,
  Send,
  BookOpen,
  Plus,
  Download,
  Lock,
  Sun,
  Newspaper,
  MessageCircle,
  Settings,
  Calculator,
} from "lucide-react";
import { api, usd, legal, download, timeLabel } from "../lib";
import { Card, Form, Field, Select, Empty, Loading } from "../components";
import { AccountForm } from "../App";
import Insights from "./Insights";
const lessons = [
  [
    "Acción",
    "Una acción representa una pequeña participación en una empresa. Su precio puede subir o bajar. Comprar una acción no garantiza obtener ganancias.",
  ],
  [
    "ETF",
    "Un fondo cotizado reúne varios activos y se compra como una acción. Revisa qué contiene, sus comisiones y su concentración: no todos los ETF están diversificados.",
  ],
  [
    "Diversificación",
    "Repartir tu dinero entre distintos activos, sectores y mercados puede reducir la dependencia de una sola inversión. No elimina las pérdidas posibles.",
  ],
  [
    "Interés compuesto",
    "Los rendimientos reinvertidos pueden producir nuevos rendimientos. El tiempo ayuda, pero las tasas reales cambian y una proyección no es una promesa.",
  ],
  [
    "Inflación",
    "Cuando los precios suben, la misma cantidad de dinero compra menos. Compara el rendimiento de tus ahorros con el cambio en el costo de vida.",
  ],
  [
    "Fondo de emergencia",
    "Es dinero disponible para imprevistos. Una referencia habitual es cubrir entre 3 y 6 meses de gastos esenciales, según tu situación. Prioriza disponibilidad y estabilidad.",
  ],
  [
    "Riesgo",
    "Una inversión puede perder valor o ser difícil de vender cuando necesitas el dinero. Piensa en tu plazo, tus necesidades y cuánto podrías perder sin comprometer gastos básicos.",
  ],
  [
    "Comisiones",
    "Las comisiones de compra, venta, administración y cambio de moneda reducen tu rendimiento. Revisa el costo total antes de operar.",
  ],
  [
    "Impuestos básicos",
    "La tributación depende de tu residencia, del activo y del país de origen. Conserva operaciones, dividendos y retenciones. Consulta fuentes oficiales o un profesional en El Salvador antes de declarar. Esta app no calcula impuestos.",
  ],
  [
    "Glosario",
    "Liquidez: facilidad para convertir un activo en efectivo. Volatilidad: magnitud de los cambios de precio. Dividendo: distribución de una empresa a sus accionistas. Ganancia realizada: resultado de una venta. Ganancia no realizada: cambio de valor de una posición abierta. Costo promedio: costo acumulado dividido entre acciones disponibles.",
  ],
];
export default function More(props) {
  const [section, setSection] = useState("news");
  return (
    <>
      <div className="tabs more-tabs">
        {[
          ["news", "Noticias", Newspaper],
          ["advisor", "Mi resumen", MessageCircle],
          ["learn", "Aprende", BookOpen],
          ["calculators", "Calculadoras", Calculator],
          ["settings", "Ajustes", Settings],
        ].map(([id, label, Icon]) => (
          <button
            key={id}
            className={section === id ? "active" : ""}
            onClick={() => setSection(id)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      {section === "news" && <News />}
      {section === "advisor" && <Insights {...props} />}
      {section === "learn" && (
        <div className="lesson-grid">
          {lessons.map(([title, text], i) => (
            <Card key={title}>
              <span className="lesson-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2>{title}</h2>
              <p>{text}</p>
            </Card>
          ))}
        </div>
      )}
      {section === "calculators" && <Calculators />}
      {section === "settings" && <SettingsPage {...props} />}
    </>
  );
}
function News() {
  const [filter, setFilter] = useState("general"),
    [attempt, setAttempt] = useState(0),
    [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    api("/news?filter=" + filter)
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [filter, attempt]);
  return (
    <>
      <div className="inline-actions section-gap">
        {[
          ["general", "Mercado general"],
          ["portfolio", "Mi portafolio y seguimiento"],
          ["economy", "Economía"],
        ].map(([id, n]) => (
          <button
            key={id}
            className={filter === id ? "selected" : ""}
            onClick={() => setFilter(id)}
          >
            {n}
          </button>
        ))}
      </div>
      <button className="text-button" onClick={() => setAttempt((n) => n + 1)}>
        Volver a consultar noticias
      </button>
      <p className="hint">
        Titulares y resúmenes en el idioma de la fuente. Economía filtra las
        noticias generales por temas económicos.
      </p>
      {error && <p className="error">{error}</p>}
      {!data && !error ? (
        <Loading />
      ) : (
        data && (
          <>
            {data.symbols?.length > 0 && (
              <p className="hint">
                Activos detectados: {data.symbols.join(", ")}
              </p>
            )}
            {data.message && (
              <p className="hint">
                {data.message.includes("FINNHUB_API_KEY")
                  ? "El servicio de noticias no está disponible ahora. Puedes consultar las fuentes directamente."
                  : data.message}
              </p>
            )}
            {data.stale && (
              <p className="hint">
                Se muestra la última información guardada, si está disponible.
              </p>
            )}
            <div className="news-grid">
              {data.data.slice(0, 40).map((n) => (
                <Card key={n.id}>
                  <div className="news-meta">
                    <span>{n.source}</span>
                    <span>{timeLabel(n.datetime * 1000)}</span>
                  </div>
                  <h2>{n.headline}</h2>
                  <p>{n.summary}</p>
                  <a
                    href={/^https?:\/\//.test(n.url) ? n.url : undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="text-button"
                  >
                    Leer en la fuente <ExternalLink size={15} />
                  </a>
                </Card>
              ))}
            </div>
            {!data.data.length && (
              <Card>
                <Empty title="No hay noticias disponibles">
                  El proveedor no devolvió titulares para este filtro. Puedes
                  volver a consultar o leer el mercado en las fuentes.
                  <a
                    className="text-button"
                    href="https://www.reuters.com/markets/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir noticias del mercado <ExternalLink size={15} />
                  </a>
                </Empty>
              </Card>
            )}
          </>
        )
      )}
    </>
  );
}
function Advisor({ data, user }) {
  const [messages, setMessages] = useState([]),
    [input, setInput] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <p className="legal">{legal}</p>
      <div className="two-col">
        <Card title="Consejos para ti">
          <p className="hint">
            Reglas basadas en tus propios registros. Funcionan sin inteligencia
            artificial.
          </p>
          {data.alerts.length ? (
            data.alerts.map((a, i) => (
              <div className={"alert " + a.type} key={i}>
                {a.text}
              </div>
            ))
          ) : (
            <p>
              Empieza por registrar tus ingresos, gastos y saldos. Con un
              historial podrás reconocer hábitos y planificar tus metas.
            </p>
          )}
          <div className="alert good">
            {data.emergency.months
              ? `Tu fondo cubre ${data.emergency.months} meses. Compara tu cobertura con la referencia de 3 a 6 meses.`
              : "Crea una cuenta de fondo de emergencia y registra tus gastos para calcular la cobertura."}
          </div>
        </Card>
        <Card
          title="Hablemos de tus finanzas"
          action={<span className="pill">Asesor educativo</span>}
        >
          {!user.aiEnabled ? (
            <Empty title="El chat está desactivado">
              Agrega ANTHROPIC_API_KEY en el servidor para activar esta función.
              Tus consejos por reglas ya están disponibles.
            </Empty>
          ) : (
            <>
              <label className="consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  Permito enviar a Anthropic un resumen de mis importes,
                  categorías, activos y metas, junto con mis mensajes. No se
                  envían contraseñas, cuentas ni notas de movimientos.
                </span>
              </label>
              <div className="chat" aria-live="polite">
                {!messages.length && (
                  <p className="hint">
                    Prueba: «¿Cómo puedo organizar mi presupuesto?»
                  </p>
                )}
                {messages.map((m, i) => (
                  <div className={"chat-message " + m.role} key={i}>
                    <small>{m.role === "user" ? "Tú" : "Asesor"}</small>
                    <p>{m.content}</p>
                  </div>
                ))}
                {busy && <p>Preparando una explicación…</p>}
              </div>
              {error && <p className="error">{error}</p>}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!input.trim() || busy) return;
                  const next = [
                    ...messages,
                    { role: "user", content: input.trim() },
                  ]
                    .slice(-9)
                    .map((m) => ({ ...m, content: m.content.slice(0, 2000) }));
                  setBusy(true);
                  setError("");
                  try {
                    const r = await api("/advisor", {
                      method: "POST",
                      body: { messages: next, consent },
                    });
                    setMessages([
                      ...next,
                      { role: "assistant", content: r.reply },
                    ]);
                    setInput("");
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Field
                  label="Tu pregunta"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={2000}
                  required
                />
                <button className="primary" disabled={busy || !consent}>
                  <Send size={16} /> Enviar
                </button>
              </form>
              <small className="hint">
                Historial limitado a los últimos intercambios. No se guarda al
                salir de esta pantalla.
              </small>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
function Calculators() {
  const [initial, setInitial] = useState(1000),
    [monthly, setMonthly] = useState(100),
    [rate, setRate] = useState(5),
    [years, setYears] = useState(10),
    [target, setTarget] = useState(10000),
    [goalMonths, setGoalMonths] = useState(24);
  const safe = (v, max) => Math.min(max, Math.max(0, Number(v) || 0)),
    n = Math.round(safe(years, 100) * 12),
    r = safe(rate, 100) / 100 / 12;
  const future =
    r === 0
      ? initial + monthly * n
      : initial * Math.pow(1 + r, n) + (monthly * (Math.pow(1 + r, n) - 1)) / r;
  const needed = Math.max(0, (target - initial) / Math.max(1, goalMonths)),
    time =
      monthly > 0 ? Math.ceil(Math.max(0, target - initial) / monthly) : null;
  return (
    <>
      <p className="legal">
        Simulaciones educativas en USD. Aportes al final de cada mes. No
        incluyen impuestos, inflación ni comisiones. Los rendimientos no están
        garantizados.
      </p>
      <div className="two-col">
        <Card title="Interés compuesto">
          <div className="form-grid">
            <Field
              label="Capital inicial"
              type="number"
              min="0"
              max="1000000000"
              value={initial}
              onChange={(e) => setInitial(safe(e.target.value, 1e9))}
            />
            <Field
              label="Aporte mensual"
              type="number"
              min="0"
              max="1000000"
              value={monthly}
              onChange={(e) => setMonthly(safe(e.target.value, 1e6))}
            />
            <Field
              label="Tasa anual hipotética (%)"
              type="number"
              min="0"
              max="100"
              value={rate}
              onChange={(e) => setRate(safe(e.target.value, 100))}
            />
            <Field
              label="Años"
              type="number"
              min="0"
              max="100"
              value={years}
              onChange={(e) => setYears(safe(e.target.value, 100))}
            />
          </div>
          <div className="calculator-result">
            <small>Valor futuro hipotético</small>
            <strong>{usd(future)}</strong>
            <span>Aportado: {usd(initial + monthly * n)}</span>
          </div>
        </Card>
        <Card title="El camino hacia una meta">
          <Field
            label="Monto objetivo"
            type="number"
            min="0"
            max="1000000000"
            value={target}
            onChange={(e) => setTarget(safe(e.target.value, 1e9))}
          />
          <Field
            label="Plazo en meses"
            type="number"
            min="1"
            max="1200"
            value={goalMonths}
            onChange={(e) =>
              setGoalMonths(Math.max(1, safe(e.target.value, 1200)))
            }
          />
          <p className="hint">
            Usa el capital inicial y aporte mensual de la calculadora de al
            lado. Este cálculo no supone rendimiento.
          </p>
          <div className="calculator-result">
            <small>Ahorro mensual necesario</small>
            <strong>{usd(needed)}</strong>
            <span>
              Con tu aporte actual:{" "}
              {target <= initial
                ? "meta alcanzada"
                : time === null
                  ? "define un aporte mensual"
                  : time + " meses"}
              .
            </span>
          </div>
        </Card>
      </div>
    </>
  );
}
function SettingsPage({
  data,
  categories,
  mutate,
  setModal,
  theme,
  setTheme,
  notify,
}) {
  const [error, setError] = useState("");
  const category = (item) =>
    setModal({
      title: item ? "Editar categoría" : "Nueva categoría",
      content: (
        <Form
          onSubmit={async (v) => {
            await mutate(
              "/categories" + (item ? "/" + item.id : ""),
              v,
              item ? "PUT" : "POST",
            );
            setModal(null);
          }}
        >
          <Field
            label="Nombre"
            name="name"
            defaultValue={item?.name}
            maxLength={60}
            required
          />
          <Field
            label="Ícono o emoji"
            name="icon"
            defaultValue={item?.icon || "•"}
            maxLength={20}
            required
          />
          <Field
            label="Color"
            name="color"
            type="color"
            defaultValue={item?.color || "#198f79"}
          />
          <Select
            label="Grupo 50/30/20"
            name="bucket"
            defaultValue={item?.bucket || "needs"}
          >
            <option value="needs">Necesidad</option>
            <option value="wants">Deseo</option>
            <option value="savings">Ahorro / otros</option>
          </Select>
        </Form>
      ),
    });
  return (
    <>
      {error && <p className="error">{error}</p>}
      <div className="two-col">
        <Card title="Tu espacio, a tu manera">
          <Select
            label="Apariencia"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="system">Automática según el dispositivo</option>
            <option value="light">Clara</option>
            <option value="dark">Oscura</option>
          </Select>
          <p className="hint">
            Moneda: USD · Zona horaria: America/El_Salvador.
          </p>
        </Card>
        <Card title="Cambiar contraseña">
          <Form
            submit="Actualizar contraseña"
            onSubmit={async (v) => {
              await api("/auth/password", { method: "POST", body: v });
              location.reload();
            }}
          >
            <Field
              label="Contraseña actual"
              type="password"
              name="current"
              autoComplete="current-password"
              required
            />
            <Field
              label="Nueva contraseña (12 caracteres como mínimo)"
              type="password"
              name="password"
              minLength={12}
              maxLength={72}
              autoComplete="new-password"
              required
            />
            <p className="hint">
              Se cerrarán todas las sesiones. La nueva contraseña se guarda en
              PostgreSQL.
            </p>
          </Form>
        </Card>
        <Card title="Tus cuentas">
          <p className="hint">
            Editar el saldo inicial recalcula el patrimonio actual. Las fotos
            históricas conservan lo registrado en su día.
          </p>
          {data.accounts.map((a) => (
            <div className="list-row" key={a.id}>
              <strong>{a.name}</strong>
              <button
                className="text-button"
                onClick={() =>
                  setModal({
                    title: "Editar cuenta",
                    content: (
                      <AccountForm
                        item={a}
                        onSave={async (v) => {
                          await mutate("/accounts/" + a.id, v, "PUT");
                          setModal(null);
                        }}
                      />
                    ),
                  })
                }
              >
                Editar
              </button>
              <button
                className="text-button negative"
                onClick={() =>
                  setModal({
                    title: "Eliminar cuenta",
                    content: (
                      <Form
                        submit="Eliminar cuenta"
                        onSubmit={async () => {
                          await mutate(
                            "/accounts/" + a.id,
                            undefined,
                            "DELETE",
                          );
                          setModal(null);
                        }}
                      >
                        <p>
                          Se eliminará la cuenta «{a.name}». Solo es posible si
                          no tiene movimientos, inversiones ni ahorros
                          asociados. El saldo inicial dejará de formar parte de
                          tu patrimonio.
                        </p>
                      </Form>
                    ),
                  })
                }
              >
                Eliminar
              </button>
            </div>
          ))}
        </Card>
        <Card title="Tus datos, contigo">
          <p>
            Descarga un respaldo completo o una tabla de movimientos para abrir
            en una hoja de cálculo.
          </p>
          <div className="export-buttons">
            {[
              [
                "/export?format=json",
                "brisa-respaldo.json",
                "Respaldo completo JSON",
              ],
              [
                "/export?format=csv",
                "brisa-completo.csv",
                "Todas las tablas CSV",
              ],
            ].map(([path, name, label]) => (
              <button
                key={path}
                onClick={() =>
                  download(path, name).catch((e) => setError(e.message))
                }
              >
                <Download size={16} />
                {label}
              </button>
            ))}
          </div>
          <p className="hint">
            Guarda los respaldos en un lugar privado. Para restaurar toda la
            base de datos usa pg_dump y pg_restore como indica el README.
          </p>
        </Card>
      </div>
      <Card
        title="Borrar datos financieros"
        className="danger-zone section-gap"
      >
        <p>
          Elimina tus registros de ahorro, cuentas, inversiones, dividendos,
          metas e historial. Conserva tu acceso. Esta acción no se puede
          deshacer.
        </p>
        <button
          className="danger"
          onClick={() =>
            setModal({
              title: "Borrar todos mis datos",
              content: (
                <Form
                  submit="Borrar permanentemente"
                  onSubmit={async (v) => {
                    await mutate("/data", v, "DELETE");
                    setModal(null);
                    notify("Datos financieros eliminados.");
                  }}
                >
                  <p>Descarga un respaldo antes de continuar.</p>
                  <Field
                    label="Contraseña actual"
                    name="password"
                    type="password"
                    required
                  />
                  <Field
                    label="Escribe BORRAR MIS DATOS"
                    name="confirmation"
                    required
                    pattern="BORRAR MIS DATOS"
                  />
                </Form>
              ),
            })
          }
        >
          Borrar mis datos
        </button>
      </Card>
    </>
  );
}
