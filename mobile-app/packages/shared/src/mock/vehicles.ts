import type { Vehicle } from "../types/common";
import { FOCUS_UNIT_OWNER, FOCUS_UNIT_TENANT, FOCUS_UNIT_LET_OUT } from "./society";

/**
 * Shared registered-vehicle seed. The gate app's plate lookup and the resident
 * app's vehicle registration screen read the same records — see README.md's
 * cross-product example ("the same flats, people... appear consistently").
 */
export const vehicles: Vehicle[] = [
  {
    id: "veh-1",
    unit: FOCUS_UNIT_OWNER,
    plate: "MH 12 KJ 4471",
    type: "Car",
    ownerName: "Anita Deshpande",
    slot: "B-42",
    model: "Honda City · white",
  },
  {
    id: "veh-2",
    unit: FOCUS_UNIT_OWNER,
    plate: "MH 12 AB 9902",
    type: "Two-wheeler",
    ownerName: "Anita Deshpande",
    slot: "T-18",
    model: "Activa · grey",
  },
  {
    id: "veh-3",
    unit: FOCUS_UNIT_TENANT,
    plate: "MH 14 DX 7781",
    type: "Car",
    ownerName: "Vikram Sethi",
    slot: "B-19",
    model: "Baleno · blue",
  },
  {
    id: "veh-4",
    unit: FOCUS_UNIT_LET_OUT,
    plate: "MH 12 QR 3355",
    type: "Car",
    ownerName: "Prakash Rao",
    slot: "B-07",
    model: "Ertiga · silver",
  },
  {
    id: "veh-5",
    unit: "A-1203",
    plate: "MH 01 ZZ 1188",
    type: "Two-wheeler",
    ownerName: "Vikas Kale",
    slot: "B-51",
    model: "Nexon · red",
  },
];

export function vehicleOwnerForUnit(unit: string): string | undefined {
  return vehicles.find((v) => v.unit === unit)?.ownerName;
}
