import type { Me, Permission } from "@chs/contract";
import type { Tx } from "../../core/db";
import { notFound } from "../../core/errors";

export function unitLabel(unit: { number: string; building: { name: string } } | null | undefined): string | null {
  return unit ? `${unit.building.name}-${unit.number}` : null;
}

/** The signed-in user with every society they can act in. */
export async function loadMe(db: Tx, userId: string): Promise<Me> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      societyUsers: {
        where: { deletedAt: null, suspendedAt: null, society: { status: { not: "SUSPENDED" } } },
        include: {
          society: { select: { id: true, name: true, code: true, city: true, _count: { select: { units: true } } } },
          unit: { select: { number: true, building: { select: { name: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!user) throw notFound("User");
  return {
    id: user.id,
    name: user.name,
    mobile: user.mobile,
    email: user.email,
    language: user.language === "mr" ? "mr" : "en",
    isPlatformAdmin: user.isPlatformAdmin,
    twoFactorEnabled: !!user.totpEnabledAt,
    mustChangePassword: user.mustChangePassword,
    memberships: user.societyUsers.map((su) => ({
      societyId: su.society.id,
      societyName: su.society.name,
      societyCode: su.society.code,
      city: su.society.city,
      unitCount: su.society._count.units,
      role: su.role,
      userType: su.userType,
      permissions: su.permissions as Permission[],
      unitId: su.unitId,
      unitLabel: unitLabel(su.unit),
    })),
  };
}
