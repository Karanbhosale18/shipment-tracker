import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../api";
import type { ShipmentDetail as Detail, StatusMeta, StatusValue } from "../types";
import { StatusBadge } from "./StatusBadge";

const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

interface Props {
  id: string;
  meta: StatusMeta[];
  onClose: () => void;
  onChanged: () => void;
}

export function ShipmentDetail({ id, meta, onClose, onChanged }: Props) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const label = (v: StatusValue) => meta.find((m) => m.value === v)?.label ?? v;

  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    api.get(id).then((d) => live && setData(d)).catch((e: ApiError) => live && setError(e.message));
    return () => { live = false; };
  }, [id]);

  async function update(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError(null);
    try {
      setData(await api.updateStatus(id, f.get("status") as StatusValue, String(f.get("note") || "")));
      form.reset();
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const next = data ? meta.find((m) => m.value === data.status)?.next ?? [] : [];

  return (
    <aside className="detail" aria-label="Shipment details">
      <button className="close" onClick={onClose} aria-label="Close details">×</button>
      {!data && !error && <p className="muted">Loading shipment…</p>}
      {error && !data && <p className="banner err" role="alert">{error}</p>}
      {data && (
        <>
          <h2>{data.reference}</h2>
          <StatusBadge status={data.status} label={label(data.status)} />
          <dl className="facts">
            <dt>Route</dt><dd>{data.origin} to {data.destination}</dd>
            <dt>Expected delivery</dt><dd>{fmtDate(data.expectedDelivery)}</dd>
            {data.description && (<><dt>Cargo</dt><dd>{data.description}</dd></>)}
          </dl>

          <h3>Update status</h3>
          {next.length === 0 ? (
            <p className="muted">This shipment is {label(data.status).toLowerCase()}. No further changes are possible.</p>
          ) : (
            <form className="update" onSubmit={update}>
              <label className="field">
                <span>Move to</span>
                <select name="status" required defaultValue={next[0]}>
                  {next.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Note (optional)</span>
                <input name="note" maxLength={500} placeholder="e.g. Cleared by customs" />
              </label>
              <button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Update status"}</button>
            </form>
          )}
          {error && <p className="banner err" role="alert">{error}</p>}

          <h3>History</h3>
          <ol className="timeline">
            {[...data.history].reverse().map((ev, i) => (
              <li key={ev.id} className={i === 0 ? "current" : ""}>
                <div className="ev-title">{label(ev.toStatus)}</div>
                <time dateTime={ev.createdAt}>{fmtTime(ev.createdAt)}</time>
                {ev.note && <p>{ev.note}</p>}
              </li>
            ))}
          </ol>
        </>
      )}
    </aside>
  );
}
