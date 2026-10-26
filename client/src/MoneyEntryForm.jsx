import React from "react";
import {
  Form,
  Select,
  Field,
  MoneyField,
  AccountSelect,
  Empty,
} from "./components";
import { dateNow } from "./lib";
export default function MoneyEntryForm({
  accounts,
  item,
  accountId,
  onSave,
  onAccount,
}) {
  const choices = accounts.filter((a) => a.type !== "credit");
  if (!choices.length)
    return (
      <Empty title="Primero agrega una cuenta">
        Puedes registrar tu banco o tu dinero en efectivo.
        <button className="primary" onClick={onAccount}>
          Agregar cuenta
        </button>
      </Empty>
    );
  return (
    <Form onSubmit={(v) => onSave({ ...v, account_id: Number(v.account_id) })}>
      <Select
        label="¿Qué quieres registrar?"
        name="direction"
        defaultValue={item && Number(item.amount) < 0 ? "withdraw" : "deposit"}
      >
        <option value="deposit">Dinero que agregué a mis ahorros</option>
        <option value="withdraw">Dinero que retiré</option>
      </Select>
      <AccountSelect
        accounts={choices}
        label="Cuenta o efectivo"
        name="account_id"
        defaultValue={item?.account_id || accountId || choices[0].id}
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
      <Field
        label="Nota (opcional)"
        name="note"
        maxLength={500}
        defaultValue={item?.note}
      />
      <p className="hint">
        Úsalo para dinero nuevo o retiros. Si solo lo cambias de cuenta, usa
        Transferir. Las compras de inversiones ya descuentan su importe
        automáticamente.
      </p>
    </Form>
  );
}
