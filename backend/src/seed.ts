import { migrate, pool } from "./db";

const demo = [
  ["NGK-2026-0001", "Mumbai (INBOM)", "Rotterdam (NLRTM)", ["BOOKED", "IN_TRANSIT", "CUSTOMS_HOLD", "IN_TRANSIT", "DELIVERED"], "Auto components, 4 pallets"],
  ["NGK-2026-0002", "Chennai (INMAA)", "Singapore (SGSIN)", ["BOOKED", "IN_TRANSIT"], "Textiles, 1x20ft container"],
  ["NGK-2026-0003", "Nhava Sheva (INNSA)", "Jebel Ali (AEJEA)", ["BOOKED"], "Machinery parts"],
  ["NGK-2026-0004", "Delhi (INDEL)", "Frankfurt (DEFRA)", ["BOOKED", "IN_TRANSIT", "OUT_FOR_DELIVERY"], "Pharma, temperature controlled"],
  ["NGK-2026-0005", "Kolkata (INCCU)", "Hamburg (DEHAM)", ["BOOKED", "CANCELLED"], "Jute products"],
] as const;

async function main() {
  await migrate();
  for (const [ref, origin, dest, path, desc] of demo) {
    const exists = await pool.query("SELECT 1 FROM shipments WHERE reference = $1", [ref]);
    if (exists.rowCount) continue;
    const eta = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
    const { rows } = await pool.query(
      `INSERT INTO shipments (reference, origin, destination, status, expected_delivery, description)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [ref, origin, dest, path[path.length - 1], eta, desc]
    );
    // Space events 6h apart so the history looks realistic.
    for (let i = 0; i < path.length; i++) {
      await pool.query(
        `INSERT INTO shipment_events (shipment_id, from_status, to_status, note, created_at)
         VALUES ($1,$2,$3,$4, now() - ($5 || ' hours')::interval)`,
        [rows[0].id, i ? path[i - 1] : null, path[i], i ? null : "Shipment created", String((path.length - i) * 6)]
      );
    }
  }
  console.log("Seeded demo shipments");
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
