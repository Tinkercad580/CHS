import { api } from "@chs/contract";
import { handle } from "../../core/http/bind";
import * as svc from "./structure.service";

export const structureBindings = [
  handle(api.structure.buildings, (_i, { society }) => svc.buildings(society.societyId)),
  handle(api.structure.createBuilding, ({ body }, { society }) => svc.createBuilding(society, body)),
  handle(api.structure.updateBuilding, ({ params, body }, { society }) => svc.updateBuilding(society, params.buildingId, body)),
  handle(api.structure.units, ({ query }, { society }) => svc.units(society.societyId, query)),
  handle(api.structure.createUnit, ({ body }, { society }) => svc.createUnit(society, body)),
  handle(api.structure.bulkCreateUnits, ({ body }, { society }) => svc.bulkCreateUnits(society, body)),
  handle(api.structure.updateUnit, ({ params, body }, { society }) => svc.updateUnit(society, params.unitId, body)),
  handle(api.structure.importUnits, ({ body }, { society, actor }) => svc.importUnits(society, actor.userId, body)),
  handle(api.structure.parking, (_i, { society }) => svc.parking(society.societyId)),
  handle(api.structure.createParkingSlot, ({ body }, { society }) => svc.createParkingSlot(society, body)),
  handle(api.structure.allotParkingSlot, ({ params, body }, { society }) => svc.allotParkingSlot(society, params.slotId, body.unitId)),
];
