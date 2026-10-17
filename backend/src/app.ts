import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { pool } from "./db";
import { HttpError } from "./errors";
import { router } from "./routes/shipments";

export function createApp() {
  const app = express();
  const origins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);

  app.use(cors({ origin: origins }));
  app.use(express.json({ limit: "50kb" }));

  app.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.use("/api", router);

  app.use((_req, _res, next) => next(new HttpError(404, "Not found")));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, details: err.details });
      return;
    }
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
