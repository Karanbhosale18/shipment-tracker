import { createApp } from "./app";
import { migrate, pool } from "./db";

async function main() {
  await migrate();
  const port = Number(process.env.PORT ?? 4000);
  const server = createApp().listen(port, () => console.log(`API listening on :${port}`));

  const shutdown = () => server.close(() => pool.end().then(() => process.exit(0)));
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((e) => {
  console.error("Failed to start:", e);
  process.exit(1);
});
