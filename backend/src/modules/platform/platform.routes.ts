import { api } from "@chs/contract";
import { env } from "../../config/env";
import { prisma } from "../../core/db";
import { handle } from "../../core/http/bind";
import { mailStatus } from "../../core/mail";
import { pushStatus } from "../../core/push";
import { queueHealthy } from "../../core/queue";
import * as svc from "./platform.service";

const started = Date.now();
const channelHealth = (s: "ok" | "log" | "misconfigured") => (s === "ok" ? ("ok" as const) : s === "log" ? ("disabled" as const) : ("down" as const));

export const platformBindings = [
  handle(api.platform.societies, ({ query }) => svc.listSocieties(query)),
  handle(api.platform.createSociety, ({ body }, { actor }) => svc.createSociety(actor.userId, body)),

  handle(api.health.live, async (_i, { res }) => {
    let db: "ok" | "down" = "ok";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = "down";
    }
    const queue = await queueHealthy();
    const status = db === "ok" && queue !== "down" ? ("ok" as const) : ("degraded" as const);
    // Load balancers read the status code; a degraded instance should be taken out of rotation.
    if (status !== "ok") res.status(503);
    return {
      status,
      version: env.APP_VERSION,
      uptimeSeconds: Math.round((Date.now() - started) / 1000),
      checks: {
        database: db,
        queue,
        redis: env.REDIS_URL ? queue : "disabled",
        // "disabled" = the log provider (development); "down" = configured but unusable.
        push: channelHealth(pushStatus()),
        email: channelHealth(mailStatus()),
      },
    };
  }),
];
