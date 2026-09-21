import type { Society, Unit } from "../types/common";

/** The reference deployment used across all mock data — see README.md "Overview". */
export const society: Society = {
  id: "shanti-vihar",
  name: "Shanti Vihar CHS",
  shortCode: "SV",
  city: "Pune",
  unitCount: 248,
};

const BUILDINGS = ["A", "B", "C", "D"] as const;

/** Deterministically generates the society's 248 units so every mock module shares the same set. */
export function generateUnits(): Unit[] {
  const units: Unit[] = [];
  let remaining = society.unitCount;
  let bIdx = 0;
  while (remaining > 0 && bIdx < BUILDINGS.length) {
    const building = BUILDINGS[bIdx];
    const unitsInBuilding = bIdx === BUILDINGS.length - 1 ? remaining : Math.ceil(society.unitCount / BUILDINGS.length);
    for (let i = 0; i < unitsInBuilding && remaining > 0; i++) {
      const floor = Math.floor(i / 4) + 1;
      const flatOnFloor = (i % 4) + 1;
      units.push({
        code: `${building}-${floor}${String(flatOnFloor).padStart(2, "0")}`,
        building,
        floor,
        carpetAreaSqft: [850, 980, 1180, 1420][flatOnFloor - 1] ?? 1000,
      });
      remaining--;
    }
    bIdx++;
  }
  return units;
}

export const units = generateUnits();

export function unitByCode(code: string): Unit | undefined {
  return units.find((u) => u.code === code);
}

/** The two "focus" units the resident-app and gate-app seed data centre on, per README's cross-product example. */
export const FOCUS_UNIT_OWNER = "A-1204";
export const FOCUS_UNIT_TENANT = "B-0702";
export const FOCUS_UNIT_LET_OUT = "C-0405";
