import { z } from "zod";
import { endpoint } from "../define";
import { Page } from "../schemas/common";
import * as T from "../schemas/structure";
import * as U from "../schemas/users";
import { inSociety, sp } from "./_shared";

export const structure = {
  buildings: endpoint({ method: "GET", path: sp("/buildings"), summary: "Buildings", access: inSociety(), response: z.array(T.Building) }),
  createBuilding: endpoint({
    method: "POST",
    path: sp("/buildings"),
    summary: "Add a building",
    access: inSociety("society.configure"),
    body: T.CreateBuildingBody,
    response: T.Building,
    invalidates: ["structure.buildings", "society.onboarding"],
  }),
  updateBuilding: endpoint({
    method: "PATCH",
    path: sp("/buildings/:buildingId"),
    summary: "Edit a building",
    access: inSociety("society.configure"),
    body: T.UpdateBuildingBody,
    response: T.Building,
    invalidates: ["structure.buildings"],
  }),
  units: endpoint({
    method: "GET",
    path: sp("/units"),
    summary: "Units",
    access: inSociety(["society.configure", "members.manage", "billing.generate", "gate.operate", "gate.manage"]),
    surface: "common",
    query: T.UnitListQuery,
    response: Page(T.Unit),
  }),
  createUnit: endpoint({
    method: "POST",
    path: sp("/units"),
    summary: "Add a unit",
    access: inSociety("society.configure"),
    body: T.CreateUnitBody,
    response: T.Unit,
    invalidates: ["structure.units", "structure.buildings", "society.onboarding"],
  }),
  bulkCreateUnits: endpoint({
    method: "POST",
    path: sp("/units/bulk"),
    summary: "Lay out a building's units by floor and pattern",
    access: inSociety("society.configure"),
    body: T.BulkCreateUnitsBody,
    response: T.BulkCreateUnitsResult,
    invalidates: ["structure.units", "structure.buildings", "society.onboarding"],
  }),
  updateUnit: endpoint({
    method: "PATCH",
    path: sp("/units/:unitId"),
    summary: "Edit a unit",
    access: inSociety("society.configure"),
    body: T.UpdateUnitBody,
    response: T.Unit,
    invalidates: ["structure.units", "members.unitOverview"],
  }),
  importUnits: endpoint({
    method: "POST",
    path: sp("/units/import"),
    summary: "Import units from CSV/XLSX; dry run first",
    access: inSociety("society.configure"),
    body: U.ImportBody,
    response: U.ImportReport,
    invalidates: ["structure.units", "structure.buildings", "society.onboarding"],
  }),
  parking: endpoint({
    method: "GET",
    path: sp("/parking-slots"),
    summary: "Parking slot register",
    access: inSociety(["society.configure", "members.manage"]),
    response: z.array(T.ParkingSlot),
  }),
  createParkingSlot: endpoint({
    method: "POST",
    path: sp("/parking-slots"),
    summary: "Add a parking slot",
    access: inSociety("society.configure"),
    body: T.CreateParkingSlotBody,
    response: T.ParkingSlot,
    invalidates: ["structure.parking"],
  }),
  allotParkingSlot: endpoint({
    method: "POST",
    path: sp("/parking-slots/:slotId/allot"),
    summary: "Allot a slot to a unit, or free it",
    access: inSociety("members.manage"),
    body: T.AllotParkingBody,
    response: T.ParkingSlot,
    invalidates: ["structure.parking", "members.unitOverview"],
  }),
};
