import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { ListResponse, StatusMeta } from "./types";
import { StatusBadge } from "./components/StatusBadge";
import { ShipmentDetail } from "./components/ShipmentDetail";
import { CreateShipment } from "./components/CreateShipment";

const idFromHash = () => (location.hash.startsWith("#/shipments/") ? location.hash.slice(12) : null);

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export default function App() {
  const [meta, setMeta] = useState<StatusMeta[]>([]);
  const [list, setList] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(idFromHash());
  const [creating, setCreating] = useState(false);
  const [tick, setTick] = useState(0); // bump to refetch the list
  const dq = useDebounced(q);

  useEffect(() => { api.statuses().then(setMeta).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    const on = () => setSelected(idFromHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  useEffect(() => { setPage(1); }, [dq, status]);

  useEffect(() => {
    const ctl = new AbortController();
    api.list({ q: dq, status, page }, ctl.signal)
      .then((r) => { setList(r); setError(null); })
      .catch((e) => { if (e.name !== "AbortError") setError(e.message); });
    return () => ctl.abort();
  }, [dq, status, page, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const open = (id: string) => { location.hash = `/shipments/${id}`; };
  const close = () => { history.pushState(null, "", location.pathname + location.search); setSelected(null); };
  const label = (v: string) => meta.find((m) => m.value === v)?.label ?? v;
  const pages = list ? Math.max(1, Math.ceil(list.total / list.limit)) : 1;

  return (
    <>
      <header className="top">
        <div className="brand">
          <span className="mark" aria-hidden />
          <h1>Shipment tracker</h1>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>New shipment</button>
      </header>

      <main className={selected ? "layout with-detail" : "layout"}>
        <section className="list" aria-label="Shipments">
          <div className="filters">
            <input
              type="search"
              placeholder="Search by reference, origin or destination"
              aria-label="Search shipments"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {meta.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          {error && <p className="banner err" role="alert">{error}</p>}
          {!list && !error && <p className="muted pad">Loading shipments…</p>}

          {list && list.data.length === 0 && (
            <div className="empty">
              {q || status ? (
                <p>No shipments match these filters. Try a different reference or clear the status filter.</p>
              ) : (
                <p>No shipments yet. Create the first one to start tracking.</p>
              )}
            </div>
          )}

          {list && list.data.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Reference</th><th>Route</th><th>Status</th><th>Expected delivery</th></tr>
                </thead>
                <tbody>
                  {list.data.map((s) => (
                    <tr key={s.id} className={s.id === selected ? "sel" : ""}>
                      <td><button className="link" onClick={() => open(s.id)}>{s.reference}</button></td>
                      <td>{s.origin} to {s.destination}</td>
                      <td><StatusBadge status={s.status} label={label(s.status)} /></td>
                      <td>{s.expectedDelivery}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {list && list.total > list.limit && (
            <nav className="pager" aria-label="Pagination">
              <button className="btn ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span>Page {page} of {pages} ({list.total} shipments)</span>
              <button className="btn ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
            </nav>
          )}
        </section>

        {selected && <ShipmentDetail id={selected} meta={meta} onClose={close} onChanged={refresh} />}
      </main>

      {creating && (
        <CreateShipment
          onClose={() => setCreating(false)}
          onCreated={(s) => { setCreating(false); refresh(); open(s.id); }}
        />
      )}
    </>
  );
}
