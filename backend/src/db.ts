import "dotenv/config";
import { Pool, types } from "pg";

// Keep DATE columns as plain "YYYY-MM-DD" strings (no timezone shifting).
types.setTypeParser(1082, (v: string) => v);

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/shipments",
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS shipments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference         text NOT NULL UNIQUE,
  origin            text NOT NULL,
  destination       text NOT NULL,
  status            text NOT NULL,
  expected_delivery date NOT NULL,
  description       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Append-only log: one row per status change, plus one for creation (from_status = NULL).
CREATE TABLE IF NOT EXISTS shipment_events (
  id          bigserial PRIMARY KEY,
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  from_status text,
  to_status   text NOT NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipments_status_idx     ON shipments (status);
CREATE INDEX IF NOT EXISTS shipments_created_at_idx ON shipments (created_at DESC, id);
CREATE INDEX IF NOT EXISTS events_shipment_idx      ON shipment_events (shipment_id, created_at, id);
`;

export async function migrate(): Promise<void> {
  await pool.query(SCHEMA);
}
