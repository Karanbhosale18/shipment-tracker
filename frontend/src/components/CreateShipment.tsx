import { FormEvent, InputHTMLAttributes, useState } from "react";
import { api, ApiError } from "../api";
import type { Shipment } from "../types";

export function CreateShipment({ onClose, onCreated }: { onClose: () => void; onCreated: (s: Shipment) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const created = await api.create({
        reference: String(f.get("reference")),
        origin: String(f.get("origin")),
        destination: String(f.get("destination")),
        expectedDelivery: String(f.get("expectedDelivery")),
        description: String(f.get("description") || "") || undefined,
      });
      onCreated(created);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFields(err.fields ?? {});
      }
    } finally {
      setBusy(false);
    }
  }

  const field = (name: string, label: string, props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="field">
      <span>{label}</span>
      <input name={name} required={props.required ?? true} aria-invalid={!!fields[name]} {...props} />
      {fields[name] && <small className="err">{fields[name][0]}</small>}
    </label>
  );

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="new-title">
        <h2 id="new-title">New shipment</h2>
        {field("reference", "Reference number", { placeholder: "NGK-2026-0100", autoFocus: true })}
        <div className="row">
          {field("origin", "Origin", { placeholder: "Mumbai (INBOM)" })}
          {field("destination", "Destination", { placeholder: "Rotterdam (NLRTM)" })}
        </div>
        {field("expectedDelivery", "Expected delivery", { type: "date" })}
        {field("description", "Cargo notes (optional)", { required: false, maxLength: 500 })}
        {error && <p className="banner err" role="alert">{error}</p>}
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? "Creating…" : "Create shipment"}</button>
        </div>
      </form>
    </div>
  );
}
