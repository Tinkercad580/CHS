import type { ApiErrorBody } from "@chs/contract";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { Prisma } from "../db";
import { AppError } from "../errors";
import { logger } from "../logger";

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => ({ path: i.path, message: i.message, code: i.code }));
    return new AppError("VALIDATION_FAILED", issues[0]?.message ?? "Some fields need attention.", issues);
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") return new AppError("NOT_FOUND", "Not found.");
    if (err.code === "P2002") return new AppError("CONFLICT", "That already exists.", { target: err.meta?.target });
    if (err.code === "P2003") return new AppError("CONFLICT", "A related record is missing or still in use.");
  }
  const e = err as { type?: string; status?: number };
  if (e?.type === "entity.too.large") return new AppError("BAD_REQUEST", "The request is too large.");
  if (e?.type === "entity.parse.failed") return new AppError("BAD_REQUEST", "The request body isn't valid JSON.");
  return new AppError("INTERNAL", "Something went wrong on our side. Nothing was changed.");
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const appErr = toAppError(err);
  const requestId = String(res.getHeader("x-request-id") ?? "");
  if (appErr.status >= 500) logger.error({ err, requestId, path: req.path }, "request failed");
  else if (appErr.status !== 401 && appErr.status !== 404) logger.info({ code: appErr.code, requestId, path: req.path }, "request refused");
  const body: ApiErrorBody = {
    error: { code: appErr.code, message: appErr.message, details: appErr.details, requestId },
  };
  if (!res.headersSent) res.status(appErr.status).json(body);
};

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError("NOT_FOUND", "No such endpoint."));
};
