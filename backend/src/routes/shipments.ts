import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { pool } from "../db";
import { HttpError } from "../errors";
import { canTransition, isStatus, LABELS, STATUSES, Status, TRANSITIONS } from "../statuses";

export const router = Router();

// Express 4 doesn't catch rejected promises; this wrapper forwards them to the error handler.
const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const statusEnum = z.enum(STATUSES);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date");

const createSchema = z.object({
  reference: z.string().trim().min(3).max(40),
  origin: z.string().trim().min(2).max(120),
  destination: z.string().trim().min(2).max(120),
  expectedDelivery: isoDate,
  status: statusEnum.default("BOOKED"),
  description: z.string().trim().max(500).optional(),
});

const statusUpdateSchema = z.object({
  status: statusEnum,
  note: z.string().trim().max(500).optional(),
});

const listSchema = z.object({
  status: statusEnum.optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const uuid = z.string().uuid();

const SHIPMENT_COLS = `id, reference, origin, destination, status,
  expected_delivery AS "expectedDelivery", description,
  created_at AS "createdAt", updated_at AS "updatedAt"`;

const EVENT_COLS = `id, from_status AS "fromStatus", to_status AS "toStatus", note, created_at AS "createdAt"`;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new HttpError(400, "Validation failed", r.error.flatten().fieldErrors);
  return r.data;
}

// Status metadata for the UI (labels + allowed transitions).
router.get("/statuses", (_req, res) => {
  res.json({
    statuses: STATUSES.map((value) => ({ value, label: LABELS[value], next: TRANSITIONS[value] })),
  });
});

// List + search/filter + pagination
router.get(
  "/shipments",
  wrap(async (req, res) => {
    const { status, q, page, limit } = parse(listSchema, req.query);
    const where: string[] = [];
    const params: unknown[] = [];
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    if (q) {
      params.push(`%${escapeLike(q)}%`);
      const p = `$${params.length}`;
      where.push(`(reference ILIKE ${p} OR origin ILIKE ${p} OR destination ILIKE ${p})`);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows, count] = await Promise.all([
      pool.query(
        `SELECT ${SHIPMENT_COLS} FROM shipments ${clause}
         ORDER BY created_at DESC, id
         LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
        params
      ),
      pool.query(`SELECT count(*)::int AS total FROM shipments ${clause}`, params),
    ]);
    res.json({ data: rows.rows, page, limit, total: count.rows[0].total });
  })
);

// Create
router.post(
  "/shipments",
  wrap(async (req, res) => {
    const body = parse(createSchema, req.body);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `INSERT INTO shipments (reference, origin, destination, status, expected_delivery, description)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${SHIPMENT_COLS}`,
        [
          body.reference.toUpperCase(),
          body.origin,
          body.destination,
          body.status,
          body.expectedDelivery,
          body.description ?? null,
        ]
      );
      await client.query(
        `INSERT INTO shipment_events (shipment_id, from_status, to_status, note)
         VALUES ($1, NULL, $2, 'Shipment created')`,
        [rows[0].id, body.status]
      );
      await client.query("COMMIT");
      res.status(201).json(rows[0]);
    } catch (e: any) {
      await client.query("ROLLBACK");
      if (e?.code === "23505") throw new HttpError(409, `Reference ${body.reference.toUpperCase()} already exists`);
      throw e;
    } finally {
      client.release();
    }
  })
);

// Single shipment + full history (oldest first)
router.get(
  "/shipments/:id",
  wrap(async (req, res) => {
    const id = parse(uuid, req.params.id);
    const [s, e] = await Promise.all([
      pool.query(`SELECT ${SHIPMENT_COLS} FROM shipments WHERE id = $1`, [id]),
      pool.query(`SELECT ${EVENT_COLS} FROM shipment_events WHERE shipment_id = $1 ORDER BY created_at, id`, [id]),
    ]);
    if (!s.rows[0]) throw new HttpError(404, "Shipment not found");
    res.json({ ...s.rows[0], history: e.rows });
  })
);

// Update status (validated transition, atomic with its history row)
router.post(
  "/shipments/:id/status",
  wrap(async (req, res) => {
    const id = parse(uuid, req.params.id);
    const { status: next, note } = parse(statusUpdateSchema, req.body);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Row lock so two concurrent updates can't both pass validation against the same old status.
      const cur = await client.query(`SELECT status FROM shipments WHERE id = $1 FOR UPDATE`, [id]);
      if (!cur.rows[0]) throw new HttpError(404, "Shipment not found");
      const from = cur.rows[0].status as string;
      if (!isStatus(from) || !canTransition(from as Status, next)) {
        throw new HttpError(409, `Cannot move from ${LABELS[from as Status] ?? from} to ${LABELS[next]}`);
      }
      await client.query(`UPDATE shipments SET status = $2, updated_at = now() WHERE id = $1`, [id, next]);
      await client.query(
        `INSERT INTO shipment_events (shipment_id, from_status, to_status, note) VALUES ($1, $2, $3, $4)`,
        [id, from, next, note ?? null]
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    const [s, e] = await Promise.all([
      pool.query(`SELECT ${SHIPMENT_COLS} FROM shipments WHERE id = $1`, [id]),
      pool.query(`SELECT ${EVENT_COLS} FROM shipment_events WHERE shipment_id = $1 ORDER BY created_at, id`, [id]),
    ]);
    res.json({ ...s.rows[0], history: e.rows });
  })
);
