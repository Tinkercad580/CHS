import { createServer } from "node:http";
import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./core/db";
import { logger } from "./core/logger";
import { startQueue, stopQueue } from "./core/queue";
import { startRealtime, stopRealtime } from "./core/realtime";
import { scheduleJobs } from "./jobs";

async function main() {
  await prisma.$queryRaw`SELECT 1`;
  const app = createApp();
  const http = createServer(app);
  http.keepAliveTimeout = 65_000; // longer than common load-balancer idle timeouts
  http.headersTimeout = 66_000;

  await startRealtime(http);
  const queueMode = await startQueue();
  if (env.RUN_JOBS) await scheduleJobs();

  await new Promise<void>((resolve) => http.listen(env.PORT, env.HOST, resolve));
  logger.info({ port: env.PORT, queue: queueMode, jobs: env.RUN_JOBS }, `CHS API listening on http://${env.HOST}:${env.PORT}/api/v1`);

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    logger.info({ signal }, "shutting down");
    const force = setTimeout(() => process.exit(1), 15_000);
    force.unref();
    await new Promise<void>((resolve) => http.close(() => resolve()));
    await stopRealtime();
    await stopQueue();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("unhandledRejection", (err) => logger.error({ err }, "unhandled rejection"));
}

main().catch((err) => {
  logger.fatal({ err }, "failed to start");
  process.exit(1);
});
