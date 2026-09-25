import { buildPath, DEFAULT_PERMISSION_TEMPLATES, type Endpoint, type EndpointInput } from "@chs/contract";
import request from "supertest";
import { STATUTORY_SEED } from "../prisma/seed/statutory";
import { createApp } from "../src/app";
import { hashPassword } from "../src/core/auth/password";
import { fromIsoDate } from "../src/core/dates";
import { prisma } from "../src/core/db";
import { seedSocietyDefaults } from "../src/modules/platform/platform.service";
import { DEFAULT_SETTINGS } from "../src/modules/society/society.service";

export const app = createApp();
export const PASSWORD = "Sahaj@2026";

/** Empty every table (TRUNCATE doesn't fire the audit log's row trigger) and restore platform defaults. */
export async function resetDb(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  await prisma.statutoryConfig.createMany({
    data: STATUTORY_SEED.map((r) => ({ ...r, societyId: null, effectiveFrom: fromIsoDate("2026-06-30") })),
  });
}

let mobileSeq = 0;
/** A fresh valid mobile number per call. */
export function mobile(): string {
  mobileSeq += 1;
  return `9${String(100000000 + mobileSeq * 7 + Math.floor(Math.random() * 7)).slice(-9)}`;
}

let hash: string | null = null;
async function passwordHash() {
  return (hash ??= await hashPassword(PASSWORD));
}

/** A society with one full admin who has a password, plus one building of `units` flats. */
export async function makeSociety(code = `S${Math.random().toString(36).slice(2, 8).toUpperCase()}`, units = 4) {
  const society = await prisma.society.create({ data: { code, name: `Society ${code}`, type: "SOCIETY_CHS", settings: DEFAULT_SETTINGS } });
  await seedSocietyDefaults(prisma, society.id);
  const building = await prisma.building.create({ data: { societyId: society.id, name: "A", floorCount: 4, liftPresent: true } });
  for (let i = 1; i <= units; i++) {
    await prisma.unit.create({ data: { societyId: society.id, buildingId: building.id, number: `10${i}`, floor: 1, liftServed: true } });
  }
  const unitRows = await prisma.unit.findMany({ where: { societyId: society.id }, orderBy: { number: "asc" } });
  const admin = await addUser(society.id, "SECRETARY", { name: "Admin" });
  return { society, building, units: unitRows, admin };
}

/** Add a user from a template, with a password unless told otherwise. */
export async function addUser(
  societyId: string,
  templateCode: string,
  opts: { name?: string; unitId?: string | null; withPassword?: boolean; permissions?: string[]; mobile?: string } = {},
) {
  const t = DEFAULT_PERMISSION_TEMPLATES.find((x) => x.code === templateCode)!;
  const m = opts.mobile ?? mobile();
  const withPassword = opts.withPassword ?? true;
  const user =
    (await prisma.user.findUnique({ where: { mobile: m } })) ??
    (await prisma.user.create({
      data: { mobile: m, name: opts.name ?? templateCode, ...(withPassword ? { passwordHash: await passwordHash(), activatedAt: new Date() } : {}) },
    }));
  const su = await prisma.societyUser.create({
    data: {
      societyId,
      userId: user.id,
      role: t.role,
      userType: t.userType,
      permissions: opts.permissions ?? [...t.permissions],
      unitId: opts.unitId ?? null,
    },
  });
  return { user, societyUser: su, mobile: m };
}

export async function login(m: string, password = PASSWORD): Promise<{ token: string; refreshToken: string; body: any }> {
  const res = await request(app).post("/api/v1/auth/login").send({ mobile: m, password });
  if (res.body.data?.status !== "SIGNED_IN") throw new Error(`login failed for ${m}: ${JSON.stringify(res.body)}`);
  return { token: res.body.data.tokens.accessToken, refreshToken: res.body.data.tokens.refreshToken, body: res.body.data };
}

/**
 * Call an endpoint through the contract, the same way clients do. Returns the
 * supertest response so tests can assert on status and error codes.
 */
export function call<E extends Endpoint>(endpoint: E, input: EndpointInput<E> | Record<string, unknown>, token?: string, headers: Record<string, string> = {}) {
  const i = input as { params?: Record<string, string>; query?: Record<string, unknown>; body?: unknown };
  const path = `/api/v1${buildPath(endpoint.path, i.params)}`;
  const method = endpoint.method.toLowerCase() as "get" | "post" | "put" | "patch" | "delete";
  let req = request(app)[method](path);
  if (i.query) req = req.query(i.query as Record<string, string>);
  if (token) req = req.set("authorization", `Bearer ${token}`);
  for (const [k, v] of Object.entries(headers)) req = req.set(k, v);
  return i.body !== undefined ? req.send(i.body as object) : req;
}
