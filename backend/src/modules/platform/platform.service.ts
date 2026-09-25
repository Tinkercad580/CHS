import { DEFAULT_PERMISSION_TEMPLATES, schemas } from "@chs/contract";
import type { z } from "zod";
import { audit } from "../../core/audit";
import { toIso } from "../../core/dates";
import { isUniqueViolation, prisma, transaction, type Tx } from "../../core/db";
import { conflict } from "../../core/errors";
import { contains, paginate } from "../../core/pagination";
import { DEFAULT_SETTINGS } from "../society/society.service";

/** Every society starts with the platform's permission templates, then edits its own copies. */
export async function seedSocietyDefaults(tx: Tx, societyId: string): Promise<void> {
  await tx.permissionTemplate.createMany({
    data: DEFAULT_PERMISSION_TEMPLATES.map((t) => ({
      societyId,
      code: t.code,
      name: t.name,
      role: t.role,
      userType: t.userType,
      permissions: [...t.permissions],
    })),
    skipDuplicates: true,
  });
}

export async function createSociety(actorUserId: string, body: z.output<typeof schemas.platform.CreateSocietyBody>) {
  try {
    return await transaction(prisma, async (tx) => {
      const society = await tx.society.create({
        data: { name: body.name, code: body.code, type: body.type, city: body.city ?? null, settings: DEFAULT_SETTINGS },
      });
      await seedSocietyDefaults(tx, society.id);
      const secretary = DEFAULT_PERMISSION_TEMPLATES.find((t) => t.code === "SECRETARY")!;
      const user =
        (await tx.user.findUnique({ where: { mobile: body.firstAdmin.mobile } })) ??
        (await tx.user.create({ data: { mobile: body.firstAdmin.mobile, name: body.firstAdmin.name } }));
      await tx.societyUser.create({
        data: { societyId: society.id, userId: user.id, role: "ADMIN", userType: "COMMITTEE", permissions: [...secretary.permissions] },
      });
      await audit(tx, { action: "platform.society_create", entity: "society", entityId: society.id, societyId: society.id, after: { ...body, createdBy: actorUserId } });
      return { id: society.id, code: society.code, name: society.name, status: society.status, city: society.city, unitCount: 0, userCount: 1, createdAt: toIso(society.createdAt) };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict(`Society code ${body.code} is taken.`);
    throw err;
  }
}

export async function listSocieties(q: { limit: number; cursor?: string | undefined; q?: string | undefined }) {
  return paginate(
    q.limit,
    q.cursor,
    (p) =>
      prisma.society.findMany({
        where: q.q ? { OR: [{ name: contains(q.q) }, { code: contains(q.q) }] } : {},
        include: { _count: { select: { units: true, societyUsers: true } } },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        ...p,
      }),
    (s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      status: s.status,
      city: s.city,
      unitCount: s._count.units,
      userCount: s._count.societyUsers,
      createdAt: toIso(s.createdAt),
    }),
  );
}
