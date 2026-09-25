import { api } from "@chs/contract";
import { handle } from "../../core/http/bind";
import * as svc from "./members.service";

export const membersBindings = [
  handle(api.members.list, ({ query }, { society }) => svc.listMembers(society.societyId, query)),
  handle(api.members.unitOverview, ({ params }, { society, actor }) => svc.unitOverview(society, actor.userId, params.unitId)),
  handle(api.members.addMembership, ({ params, body }, { society }) => svc.addMembership(society, params.unitId, body)),
  handle(api.members.ceaseMembership, ({ params, body }, { society }) => svc.ceaseMembership(society, params.membershipId, body)),
  handle(api.members.setNominees, ({ params, body }, { society, actor }) => svc.setNominees(society, actor.userId, params.membershipId, body)),
  handle(api.members.setOccupancy, ({ params, body }, { society }) => svc.setOccupancy(society, params.unitId, body)),
  handle(api.members.createTenancy, ({ params, body }, { society, actor }) => svc.createTenancy(society, actor.userId, params.unitId, body)),
  handle(api.members.updateTenancy, ({ params, body }, { society }) => svc.updateTenancy(society, params.tenancyId, body)),
  handle(api.members.endTenancy, ({ params, body }, { society, actor }) => svc.endTenancy(society, actor.userId, params.tenancyId, body)),
  handle(api.members.addFamily, ({ params, body }, { society, actor }) => svc.addFamily(society, actor.userId, params.unitId, body)),
  handle(api.members.removeFamily, ({ params }, { society, actor }) => svc.removeFamily(society, actor.userId, params.familyMemberId)),
  handle(api.members.vehicles, ({ query }, { society }) => svc.vehicles(society.societyId, query)),
  handle(api.members.addVehicle, ({ params, body }, { society, actor }) => svc.addVehicle(society, actor.userId, params.unitId, body)),
  handle(api.members.removeVehicle, ({ params }, { society, actor }) => svc.removeVehicle(society, actor.userId, params.vehicleId)),
  handle(api.members.addPet, ({ params, body }, { society, actor }) => svc.addPet(society, actor.userId, params.unitId, body)),
  handle(api.members.removePet, ({ params }, { society, actor }) => svc.removePet(society, actor.userId, params.petId)),
  handle(api.members.approvals, ({ query }, { society }) => svc.approvals(society.societyId, query)),
  handle(api.members.decideApproval, ({ params, body }, { society, actor }) => svc.decideApproval(society, actor.userId, params.approvalId, body)),
  handle(api.members.myHome, (_i, { society, actor }) => svc.myHome(society, actor.userId)),
  handle(api.members.reportCorrection, ({ body }, { society, actor }) => svc.reportCorrection(society, actor.userId, body.message)),
  handle(api.members.directory, ({ query }, { society }) => svc.directory(society, query)),
  handle(api.members.directoryPreference, ({ body }, { society, actor }) => svc.setDirectoryPreference(society, actor.userId, body)),
];
