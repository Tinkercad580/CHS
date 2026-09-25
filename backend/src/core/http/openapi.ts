import { api, flattenApi, type Endpoint } from "@chs/contract";
import { z } from "zod";
import { env } from "../../config/env";

/**
 * OpenAPI 3.1, generated from the contract on demand. It can't drift from the
 * server because both are the same objects.
 */
export function buildOpenApi(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const e of flattenApi(api as never)) {
    const oaPath = e.path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
    paths[oaPath] ??= {};
    paths[oaPath][e.method.toLowerCase()] = operation(e);
  }
  return {
    openapi: "3.1.0",
    info: { title: "CHS Platform API", version: env.APP_VERSION },
    servers: [{ url: "/api/v1" }],
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    },
    paths,
  };
}

function schema(s: z.ZodType, io: "input" | "output") {
  try {
    return z.toJSONSchema(s, { io, unrepresentable: "any" });
  } catch {
    return {};
  }
}

function operation(e: Endpoint) {
  const params = [...e.path.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => ({
    name: m[1],
    in: "path",
    required: true,
    schema: { type: "string", format: "uuid" },
  }));
  const query = e.query ? (schema(e.query, "input") as { properties?: Record<string, unknown>; required?: string[] }) : null;
  for (const [name, s] of Object.entries(query?.properties ?? {})) {
    params.push({ name, in: "query", required: query?.required?.includes(name) ?? false, schema: s as never });
  }
  const access = e.access;
  return {
    operationId: e.id,
    summary: e.summary,
    tags: [e.id.split(".")[0]],
    security: access.kind === "public" ? [] : [{ bearer: [] }],
    "x-access": access,
    ...(e.idempotent ? { "x-idempotent": true } : {}),
    parameters: params,
    ...(e.body ? { requestBody: { required: true, content: { "application/json": { schema: schema(e.body, "input") } } } } : {}),
    responses: {
      "200": {
        description: "OK",
        content: {
          "application/json": {
            schema: { type: "object", properties: { data: schema(e.response, "output") }, required: ["data"] },
          },
        },
      },
      default: { description: "Error — `{ error: { code, message, details, requestId } }`" },
    },
  };
}
