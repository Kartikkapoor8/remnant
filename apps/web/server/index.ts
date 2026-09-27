import { createServer } from "./app.ts";
import { bootstrap, DATA_DIR } from "./bootstrap.ts";

const PORT = Number(process.env.PORT ?? 8787);
const ctx = await bootstrap();
const server = createServer(ctx, PORT);
console.log(`[remnant] api on http://${server.hostname}:${server.port}  data=${DATA_DIR}`);

const shutdown = async () => {
  await ctx.memory.close();
  server.stop(true);
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
