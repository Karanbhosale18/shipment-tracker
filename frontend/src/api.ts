import type { ListResponse, Shipment, ShipmentDetail, StatusMeta, StatusValue } from "./types";

const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message: string, public status: number, public fields?: Record<string, string[]>) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? "Something went wrong", res.status, body.details);
  return body as T;
}

export const api = {
  statuses: () => request<{ statuses: StatusMeta[] }>("/api/statuses").then((r) => r.statuses),
  list: (p: { q: string; status: string; page: number }, signal?: AbortSignal) => {
    const qs = new URLSearchParams({ page: String(p.page), limit: "10" });
    if (p.q) qs.set("q", p.q);
    if (p.status) qs.set("status", p.status);
    return request<ListResponse>(`/api/shipments?${qs}`, { signal });
  },
  get: (id: string) => request<ShipmentDetail>(`/api/shipments/${id}`),
  create: (body: {
    reference: string; origin: string; destination: string;
    expectedDelivery: string; description?: string;
  }) => request<Shipment>("/api/shipments", { method: "POST", body: JSON.stringify(body) }),
  updateStatus: (id: string, status: StatusValue, note?: string) =>
    request<ShipmentDetail>(`/api/shipments/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status, note: note || undefined }),
    }),
};
