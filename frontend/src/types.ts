export type StatusValue =
  | "BOOKED" | "IN_TRANSIT" | "CUSTOMS_HOLD" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";

export interface StatusMeta { value: StatusValue; label: string; next: StatusValue[] }

export interface Shipment {
  id: string;
  reference: string;
  origin: string;
  destination: string;
  status: StatusValue;
  expectedDelivery: string; // YYYY-MM-DD
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentEvent {
  id: string;
  fromStatus: StatusValue | null;
  toStatus: StatusValue;
  note: string | null;
  createdAt: string;
}

export interface ShipmentDetail extends Shipment { history: ShipmentEvent[] }
export interface ListResponse { data: Shipment[]; page: number; limit: number; total: number }
