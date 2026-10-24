import React, { useEffect, useRef, useState } from "react";
import {
  X,
  ArrowUpRight,
  ArrowDownLeft,
  Inbox,
  LoaderCircle,
} from "lucide-react";
import { usd, types } from "./lib";
export function Empty({ title = "Todavía no hay datos", children }) {
  return (
    <div className="empty">
      <Inbox size={30} />
      <strong>{title}</strong>
      <p>{children || "Agrega tu primer registro para empezar."}</p>
    </div>
  );
}
export function Loading() {
  return (
    <div className="empty" role="status">
      <LoaderCircle className="spin" />
      <p>Cargando tus finanzas…</p>
    </div>
  );
}
export function Card({ title, action, children, className = "" }) {
  return (
    <section className={"card " + className}>
      {title && (
        <div className="card-heading">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Field({ label, children, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children || <input {...props} />}
    </label>
  );
}
export function Select({ label, children, ...props }) {
  return (
    <Field label={label}>
      <select {...props}>{children}</select>
    </Field>
  );
}
export function AccountSelect({ accounts, savings = false, ...props }) {
  return (
    <Select label="Cuenta" {...props} required>
      <option value="">Selecciona una cuenta</option>
      {accounts
        .filter((a) => !savings || ["savings", "emergency"].includes(a.type))
        .map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} · {types[a.type]}
          </option>
        ))}
    </Select>
  );
}
export function CategorySelect({ categories, nullable = true, ...props }) {
  return (
    <Select label="Categoría" {...props}>
      {nullable && <option value="">Sin categoría</option>}
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.icon} {c.name}
        </option>
      ))}
    </Select>
  );
}
export function MoneyField(props) {
  return (
    <Field
      label="Monto (USD)"
      type="number"
      step="0.01"
      min="0.01"
      max="999999999999.99"
      inputMode="decimal"
      required
      {...props}
    />
  );
}
export function Submit({ busy, children = "Guardar" }) {
  return (
    <button className="primary" type="submit" disabled={busy}>
      {busy ? "Guardando…" : children}
    </button>
  );
}
export function Form({ onSubmit, children, submit = "Guardar" }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        try {
          await onSubmit(Object.fromEntries(new FormData(e.currentTarget)));
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Submit busy={busy}>{submit}</Submit>
      </div>
    </form>
  );
}
export function Modal({ title, onClose, children }) {
  const ref = useRef();
  useEffect(() => {
    const d = ref.current;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Progress({ value = 0, level = "good" }) {
  return (
    <div
      className={"progress " + level}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: Math.max(0, Math.min(100, value)) + "%" }} />
    </div>
  );
}
export function Stat({ label, value, valueLabel, foot, positive, icon }) {
  return (
    <Card className="stat">
      <div className="stat-label">
        {label}
        {icon}
      </div>
      <strong
        className={
          positive === true ? "positive" : positive === false ? "negative" : ""
        }
      >
        {valueLabel ?? usd(value)}
      </strong>
      <small>{foot}</small>
    </Card>
  );
}
export function TransactionList({ rows, onEdit, onDelete }) {
  return rows.length ? (
    <div className="transaction-list">
      {rows.map((t) => (
        <div className="transaction" key={t.id}>
          <span
            className={
              "transaction-icon " + (t.type === "income" ? "income" : "")
            }
          >
            {t.type === "income" ? (
              <ArrowDownLeft size={20} />
            ) : (
              t.icon || <ArrowUpRight size={20} />
            )}
          </span>
          <div className="transaction-info">
            <strong>{t.note || t.category || "Ingreso"}</strong>
            <small>
              {t.category || "Sin categoría"} · {t.account} ·{" "}
              {String(t.date).slice(0, 10)}
            </small>
          </div>
          <strong className={t.type === "income" ? "positive" : ""}>
            {t.type === "income" ? "+" : "−"}
            {usd(t.amount)}
          </strong>
          {onEdit && (
            <button className="text-button" onClick={() => onEdit(t)}>
              Editar
            </button>
          )}
          {onDelete && (
            <button
              className="text-button negative"
              onClick={() => onDelete(t)}
            >
              Borrar
            </button>
          )}
        </div>
      ))}
    </div>
  ) : (
    <Empty title="Tu historia financiera empieza aquí">
      Registra un ingreso o un gasto y aparecerá en esta lista.
    </Empty>
  );
}
