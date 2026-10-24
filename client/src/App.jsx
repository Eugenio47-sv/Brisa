import React, { useEffect, useState, useCallback } from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  ChartNoAxesCombined,
  PiggyBank,
  Ellipsis,
  Plus,
  ArrowUpRight,
  LogOut,
  Leaf,
  ShieldCheck,
  ChevronRight,
  Bell,
  Wallet,
} from "lucide-react";
import { api, dateNow, usd } from "./lib";
import {
  Card,
  Form,
  Field,
  Empty,
  Loading,
  Modal,
  MoneyField,
  AccountSelect,
  CategorySelect,
  Select,
} from "./components";
import Overview from "./pages/Overview";
import Expenses from "./pages/Expenses";
import Investments from "./pages/Investments";
import Savings from "./pages/Savings";
import More from "./pages/More";
const tabs = [
  ["home", "Inicio", LayoutDashboard],
  ["expenses", "Gastos", ArrowLeftRight],
  ["investments", "Inversiones", ChartNoAxesCombined],
  ["savings", "Ahorros", PiggyBank],
  ["more", "Más", Ellipsis],
];
export default function App() {
  const [user, setUser] = useState(null),
    [checking, setChecking] = useState(true),
    [authError, setAuthError] = useState(""),
    [tab, setTab] = useState("home"),
    [data, setData] = useState(null),
    [categories, setCategories] = useState([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [modal, setModal] = useState(null),
    [refreshing, setRefreshing] = useState(false),
    [theme, setTheme] = useState(
      localStorage.getItem("brisa-theme") || "system",
    );
  useEffect(() => {
    api("/auth/me")
      .then(setUser)
      .catch((e) => {
        if (e.status !== 401) setAuthError(e.message);
      })
      .finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        theme === "system" ? (mq.matches ? "dark" : "light") : theme);
    apply();
    mq.addEventListener("change", apply);
    localStorage.setItem("brisa-theme", theme);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      const [d, c] = await Promise.all([api("/dashboard"), api("/categories")]);
      setData(d);
      setCategories(c);
      setError("");
    } catch (e) {
      if (e.status === 401) setUser(null);
      else setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    if (user) {
      void reload();
      const t = setInterval(reload, 180000);
      return () => clearInterval(t);
    }
  }, [user, reload]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 6500);
      return () => clearTimeout(t);
    }
  }, [notice]);
  const mutate = async (path, body, method = "POST") => {
    const result = await api(path, { method, body });
    await reload();
    return result;
  };
  const done = async (path, body, method) => {
    await mutate(path, body, method);
    setModal(null);
    setNotice("Guardado correctamente.");
  };
  const ctx = {
    data,
    categories,
    mutate,
    reload,
    notify: setNotice,
    setModal,
    user,
    theme,
    setTheme,
    setTab,
  };
  if (checking)
    return (
      <main className="login">
        <Loading />
      </main>
    );
  if (!user)
    return (
      <main className="login">
        <div className="login-art">
          <div className="brand">
            <span>
              <Leaf />
            </span>
            brisa<span className="brand-dot">.</span>
          </div>
          <p className="eyebrow">FINANZAS CON CALMA</p>
          <h1>
            Tu dinero.
            <br />
            Tus planes.
            <br />
            <em>Más claridad.</em>
          </h1>
          <p>
            Un espacio para cuidar lo que tienes
            <br />y construir lo que viene.
          </p>
          <div className="login-orbit">
            <PiggyBank size={85} />
          </div>
        </div>
        <div className="login-form">
          <span className="secure">
            <ShieldCheck size={17} /> TU ESPACIO PERSONAL
          </span>
          <h2>Qué bueno verte.</h2>
          <p>Ingresa para continuar con tus finanzas.</p>
          <Form
            submit="Entrar a mi espacio →"
            onSubmit={async (v) => {
              await api("/auth/login", { method: "POST", body: v });
              setUser(await api("/auth/me"));
            }}
          >
            <Field
              label="Contraseña"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
            />
          </Form>
          {authError && <p className="error">{authError}</p>}
          <small className="login-note">
            Privado por diseño. Un paso a la vez.
          </small>
        </div>
      </main>
    );
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("home");
          }}
        >
          <span>
            <Leaf />
          </span>
          brisa<span className="brand-dot">.</span>
        </a>
        <p className="sidebar-label">MI ESPACIO</p>
        <nav>
          {tabs.map(([id, label, Icon]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
            >
              <Icon size={21} />
              {label}
              {tab === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="private-box">
            <ShieldCheck size={21} />
            <div>
              <strong>Solo para ti</strong>
              <small>Tus finanzas, en privado</small>
            </div>
          </div>
          <button
            className="logout"
            onClick={async () => {
              try {
                await api("/auth/logout", { method: "POST", body: {} });
                setUser(null);
                setData(null);
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            <LogOut size={17} /> Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="breadcrumb">
            Mi espacio <ChevronRight size={14} />{" "}
            <strong>{tabs.find((t) => t[0] === tab)[1]}</strong>
          </span>
          <div className="topbar-right">
            <span className="currency">
              USD <span>·</span> El Salvador
            </span>
            <button
              className="notification"
              aria-label="Ver alertas"
              onClick={() => {
                setTab("home");
                setTimeout(
                  () =>
                    document
                      .getElementById("alerts")
                      ?.scrollIntoView({ behavior: "smooth" }),
                  100,
                );
              }}
            >
              <Bell size={19} />
              {data?.alerts.length > 0 && <i />}
            </button>
            <span className="avatar">YO</span>
          </div>
        </header>
        <main className="main">
          {user.demo && (
            <div className="demo-banner">
              DEMOSTRACIÓN · Datos ficticios y temporales. No ingreses
              información real.
            </div>
          )}
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {new Intl.DateTimeFormat("es-SV", {
                  month: "long",
                  year: "numeric",
                  timeZone: "America/El_Salvador",
                })
                  .format(new Date())
                  .toUpperCase()}
              </p>
              <h1>
                {
                  {
                    home: "Tu panorama, más claro.",
                    expenses: "Cada movimiento cuenta.",
                    investments: "Invierte con perspectiva.",
                    savings: "Dale forma a tus planes.",
                    more: "Un poco más de claridad.",
                  }[tab]
                }
              </h1>
              <p>
                {
                  {
                    home: "Todo lo que necesitas para dar tu próximo paso.",
                    expenses:
                      "Conoce a dónde va tu dinero y decide con intención.",
                    investments: "Sigue tus activos, entiende tus resultados.",
                    savings: "Pequeños pasos hoy. Más posibilidades mañana.",
                    more: "Información, herramientas y un espacio a tu medida.",
                  }[tab]
                }
              </p>
            </div>
            <button
              className="primary desktop-add"
              onClick={() => setModal({ type: "transaction" })}
            >
              <Plus size={18} /> Nuevo movimiento
            </button>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={reload}>Reintentar</button>
            </div>
          )}
          {!data ? (
            <Loading />
          ) : (
            <>
              <div aria-live="polite" className="sr-only">
                {refreshing ? "Actualizando" : ""}
              </div>
              {tab === "home" && <Overview {...ctx} />}
              {tab === "expenses" && <Expenses {...ctx} />}
              {tab === "investments" && <Investments {...ctx} />}
              {tab === "savings" && <Savings {...ctx} />}
              {tab === "more" && <More {...ctx} />}
            </>
          )}
          <footer>
            Hecho para tus planes. <span>Un día a la vez.</span>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav">
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <button
        className="fab"
        aria-label="Registrar movimiento"
        onClick={() => setModal({ type: "transaction" })}
      >
        <Plus />
      </button>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {modal && (
        <Modal
          title={
            modal.type === "transaction"
              ? modal.item
                ? "Editar movimiento"
                : "Nuevo movimiento"
              : modal.type === "account"
                ? "Nueva cuenta"
                : modal.title || "Confirmar"
          }
          onClose={() => setModal(null)}
        >
          {modal.type === "transaction" ? (
            <TransactionForm
              data={data}
              categories={categories}
              item={modal.item}
              onSave={(v) =>
                done(
                  "/transactions" + (modal.item ? "/" + modal.item.id : ""),
                  v,
                  modal.item ? "PUT" : "POST",
                )
              }
              onAccount={() => setModal({ type: "account" })}
            />
          ) : modal.type === "account" ? (
            <AccountForm onSave={(v) => done("/accounts", v)} />
          ) : (
            modal.content
          )}
        </Modal>
      )}
    </div>
  );
}
export function AccountForm({ onSave, item }) {
  return (
    <Form onSubmit={onSave}>
      <Field
        label="Nombre de la cuenta"
        name="name"
        maxLength={80}
        defaultValue={item?.name}
        required
      />
      <Select label="Tipo" name="type" defaultValue={item?.type || "bank"}>
        <option value="bank">Banco</option>
        <option value="cash">Efectivo</option>
        <option value="savings">Ahorro</option>
        <option value="emergency">Fondo de emergencia</option>
        <option value="credit">Tarjeta de crédito</option>
      </Select>
      <MoneyField
        label="Saldo inicial (deuda como número negativo)"
        name="opening_balance"
        min="-999999999999.99"
        defaultValue={item?.opening_balance || "0"}
      />
      <p className="hint">
        Usa el saldo anterior a tus primeros movimientos registrados. Una
        tarjeta con deuda debe tener saldo negativo.
      </p>
    </Form>
  );
}
export function TransactionForm({ data, categories, item, onSave, onAccount }) {
  if (!data?.accounts.length)
    return (
      <Empty title="Primero, crea una cuenta">
        <button className="primary" onClick={onAccount}>
          Crear mi primera cuenta
        </button>
      </Empty>
    );
  return (
    <Form
      onSubmit={(v) =>
        onSave({
          ...v,
          account_id: Number(v.account_id),
          category_id: v.category_id ? Number(v.category_id) : null,
        })
      }
    >
      <div className="form-grid">
        <Select label="Tipo" name="type" defaultValue={item?.type || "expense"}>
          <option value="expense">Gasto</option>
          <option value="income">Ingreso</option>
        </Select>
        <MoneyField name="amount" defaultValue={item?.amount} autoFocus />
        <CategorySelect
          categories={categories}
          name="category_id"
          defaultValue={item?.category_id || ""}
        />
        <AccountSelect
          accounts={data.accounts}
          name="account_id"
          defaultValue={item?.account_id || data.accounts[0]?.id}
        />
        <Field
          label="Fecha"
          name="date"
          type="date"
          max={dateNow()}
          required
          defaultValue={item?.date?.slice(0, 10) || dateNow()}
        />
        <Select
          label="Método de pago"
          name="method"
          defaultValue={item?.method || "bank"}
        >
          <option value="bank">Banco</option>
          <option value="cash">Efectivo</option>
          <option value="card">Tarjeta</option>
          <option value="transfer">Transferencia</option>
        </Select>
      </div>
      <Field
        label="Nota"
        name="note"
        maxLength={500}
        defaultValue={item?.note}
      />
      <Field
        label="Subcategoría (opcional)"
        name="subcategory"
        maxLength={80}
        defaultValue={item?.subcategory}
      />
    </Form>
  );
}
