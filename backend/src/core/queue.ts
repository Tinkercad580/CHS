import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { env } from "../config/env";
import { runWithContext, systemContext } from "./context";
import { events } from "./events";
import { logger } from "./logger";

/**
 * Background jobs. With REDIS_URL set, jobs go through BullMQ: durable,
 * retried with exponential backoff, shared across API instances, repeatable
 * jobs scheduled once cluster-wide. Without it (local development, tests) the
 * same handlers run in-process with the same retry policy, so code never
 * branches on which backend is live.
 */

export type JobHandler<T> = (data: T, meta: { attempt: number; jobId: string }) => Promise<void>;

interface JobDef<T> {
  name: string;
  handler: JobHandler<T>;
  attempts: number;
}

const QUEUE = "chs";
const defs = new Map<string, JobDef<unknown>>();
let queue: Queue | null = null;
let worker: Worker | null = null;
const timers: NodeJS.Timeout[] = [];
let stopped = false;

function connection(): ConnectionOptions | null {
  if (!env.REDIS_URL) return null;
  const u = new URL(env.REDIS_URL);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username || undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: u.pathname && u.pathname !== "/" ? Number(u.pathname.slice(1)) : 0,
    tls: u.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

export function defineJob<T>(name: string, handler: JobHandler<T>, opts: { attempts?: number } = {}) {
  defs.set(name, { name, handler: handler as JobHandler<unknown>, attempts: opts.attempts ?? 5 });
  return {
    name,
    enqueue: (data: T, o: { delayMs?: number; jobId?: string } = {}) => enqueue(name, data, o),
  };
}

/** Run a handler with a system context, then publish whatever events it raised. */
async function runHandler(def: JobDef<unknown>, data: unknown, meta: { attempt: number; jobId: string }) {
  const ctx = systemContext(`job:${def.name}:${meta.jobId}`);
  await runWithContext(ctx, () => def.handler(data, meta));
  events.flush(ctx.pendingEvents);
}

async function enqueue(name: string, data: unknown, o: { delayMs?: number; jobId?: string }): Promise<void> {
  const def = defs.get(name);
  if (!def) throw new Error(`Unknown job ${name}`);
  if (queue) {
    await queue.add(name, data, {
      attempts: def.attempts,
      backoff: { type: "exponential", delay: 5_000 },
      delay: o.delayMs,
      jobId: o.jobId,
      removeOnComplete: { age: 24 * 3600, count: 5_000 },
      removeOnFail: { age: 14 * 24 * 3600 },
    });
    return;
  }
  runInProcess(def, data, 1, o.jobId ?? `${name}-${Date.now()}`, o.delayMs ?? 0);
}

function runInProcess(def: JobDef<unknown>, data: unknown, attempt: number, jobId: string, delayMs: number) {
  if (stopped) return;
  const t = setTimeout(async () => {
    try {
      await runHandler(def, data, { attempt, jobId });
    } catch (err) {
      if (attempt < def.attempts && !stopped) {
        const backoff = 5_000 * 2 ** (attempt - 1);
        logger.warn({ err, job: def.name, attempt }, "job failed, retrying");
        runInProcess(def, data, attempt + 1, jobId, backoff);
      } else {
        logger.error({ err, job: def.name, attempt }, "job failed permanently");
      }
    }
  }, delayMs);
  t.unref();
  timers.push(t);
}

/** Schedule a job to repeat. Under BullMQ one instance of it runs cluster-wide. */
export async function repeat(name: string, everyMs: number, data: unknown = {}): Promise<void> {
  if (queue) {
    await queue.upsertJobScheduler(`repeat:${name}`, { every: everyMs }, { name, data });
    return;
  }
  const def = defs.get(name);
  if (!def) throw new Error(`Unknown job ${name}`);
  const t = setInterval(() => runInProcess(def, data, 1, `${name}-${Date.now()}`, 0), everyMs);
  t.unref();
  timers.push(t);
}

export async function startQueue(): Promise<"bullmq" | "in-process"> {
  stopped = false;
  const conn = connection();
  if (!conn) return "in-process";
  queue = new Queue(QUEUE, { connection: conn });
  worker = new Worker(
    QUEUE,
    async (job) => {
      const def = defs.get(job.name);
      if (!def) throw new Error(`No handler for job ${job.name}`);
      await runHandler(def, job.data, { attempt: job.attemptsMade + 1, jobId: job.id ?? "" });
    },
    { connection: conn, concurrency: 5 },
  );
  worker.on("failed", (job, err) => logger.warn({ err, job: job?.name, attempts: job?.attemptsMade }, "job failed"));
  return "bullmq";
}

export async function stopQueue(): Promise<void> {
  stopped = true;
  timers.splice(0).forEach((t) => clearTimeout(t));
  await worker?.close();
  await queue?.close();
  worker = null;
  queue = null;
}

export async function queueHealthy(): Promise<"ok" | "down" | "disabled"> {
  if (!queue) return "disabled";
  try {
    // A cheap round-trip through whichever backend BullMQ is using, bounded so a hung Redis can't hang the health check.
    await Promise.race([
      queue.getJobCounts("waiting"),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2_000).unref()),
    ]);
    return "ok";
  } catch {
    return "down";
  }
}
