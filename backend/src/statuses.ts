/**
 * Single source of truth for the status flow.
 * The frontend reads this via GET /api/statuses, so rules are never duplicated.
 */
export const STATUSES = [
  "BOOKED",
  "IN_TRANSIT",
  "CUSTOMS_HOLD",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
] as const;

export type Status = (typeof STATUSES)[number];

export const LABELS: Record<Status, string> = {
  BOOKED: "Booked",
  IN_TRANSIT: "In transit",
  CUSTOMS_HOLD: "Customs hold",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

/** Allowed next statuses. DELIVERED and CANCELLED are terminal. */
export const TRANSITIONS: Record<Status, readonly Status[]> = {
  BOOKED: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["CUSTOMS_HOLD", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
  CUSTOMS_HOLD: ["IN_TRANSIT", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "IN_TRANSIT"],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransition(from: Status, to: Status): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isStatus(value: string): value is Status {
  return (STATUSES as readonly string[]).includes(value);
}
