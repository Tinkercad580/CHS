import { afterAll } from "vitest";
import { prisma } from "../src/core/db";
import { resetRateLimits } from "../src/core/http/rate-limit";
import { stopQueue } from "../src/core/queue";

afterAll(async () => {
  resetRateLimits();
  await stopQueue();
  await prisma.$disconnect();
});
