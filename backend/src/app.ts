import { randomUUID } from "node:crypto";
import compression from "compression";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env";
import { mountApi } from "./core/http/bind";
import { errorHandler, notFoundHandler } from "./core/http/error-handler";
import { buildOpenApi } from "./core/http/openapi";
import { logger } from "./core/logger";
import { authBindings } from "./modules/auth/auth.routes";
import { billingBindings } from "./modules/billing/billing.routes";
import { membersBindings } from "./modules/members/members.routes";
import { noticeBindings } from "./modules/notifications/notices.routes";
import { notificationBindings } from "./modules/notifications/notifications.routes";
import { paymentBindings } from "./modules/payments/payments.routes";
import { reportBindings } from "./modules/reports/reports.routes";
import { platformBindings } from "./modules/platform/platform.routes";
import { societyBindings } from "./modules/society/society.routes";
import { structureBindings } from "./modules/structure/structure.routes";
import { usersBindings } from "./modules/users/users.routes";

export const API_PREFIX = "/api/v1";

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);
  app.set("query parser", "simple");

  app.use((req, res, next) => {
    const incoming = req.header("x-request-id");
    res.setHeader("x-request-id", incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID());
    next();
  });
  app.use(
    pinoHttp({
      logger,
      genReqId: (_req, res) => String(res.getHeader("x-request-id")),
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
      serializers: {
        req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      autoLogging: { ignore: (req) => req.url === `${API_PREFIX}/health` },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.CORS_ORIGINS.includes(origin) || (!env.isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))),
      credentials: true,
      exposedHeaders: ["x-request-id", "RateLimit-Remaining", "Retry-After", "Idempotent-Replay"],
      maxAge: 600,
    }),
  );
  app.use(compression());
  // 8 MB: import uploads arrive as base64 JSON (5 MB file ≈ 6.7 MB encoded).
  app.use(
    express.json({
      limit: "8mb",
      // Webhook signatures are over the exact bytes received, so keep them.
      verify: (req, _res, buf) => {
        if (req.url?.startsWith(`${API_PREFIX}/webhooks/`)) (req as { rawBody?: string }).rawBody = buf.toString("utf8");
      },
    }),
  );

  app.get(`${API_PREFIX}/openapi.json`, (_req, res) => void res.json(buildOpenApi()));
  if (!env.isProd) {
    app.get("/api/docs", (_req, res) => {
      res.setHeader("Content-Security-Policy", "default-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; img-src * data:");
      res.send(`<!doctype html><html><head><title>CHS API</title><meta charset="utf-8"/></head><body>
<script id="api-reference" data-url="${API_PREFIX}/openapi.json"></script>
<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script></body></html>`);
    });
  }

  app.use(
    API_PREFIX,
    mountApi([
      ...platformBindings,
      ...authBindings,
      ...notificationBindings,
      ...usersBindings,
      ...societyBindings,
      ...structureBindings,
      ...membersBindings,
      ...noticeBindings,
      ...billingBindings,
      ...paymentBindings,
      ...reportBindings,
    ]),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
