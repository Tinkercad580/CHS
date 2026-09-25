import { api } from "@chs/contract";
import { handle } from "../../core/http/bind";
import * as bills from "./bills.service";
import * as heads from "./heads.service";

export const billingBindings = [
  handle(api.billing.heads, (_i, { society }) => heads.listHeads(society.societyId)),
  handle(api.billing.createHead, ({ body }, { society }) => heads.createHead(society, body)),
  handle(api.billing.updateHead, ({ params, body }, { society }) => heads.updateHead(society, params.headId, body)),
  handle(api.billing.setRate, ({ params, body }, { society, actor }) => heads.setRate(society, actor.userId, params.headId, body)),
  handle(api.billing.simulate, ({ params, query }, { society }) => heads.simulate(society, params.headId, query.asOf)),
  handle(api.billing.unitCharges, ({ query }, { society }) => heads.unitCharges(society.societyId, query)),
  handle(api.billing.createUnitCharge, ({ body }, { society }) => heads.createUnitCharge(society, body)),
  handle(api.billing.runs, (_i, { society }) => bills.listRuns(society.societyId)),
  handle(api.billing.createRun, ({ body }, { society, actor }) => bills.createRun(society, actor.userId, body)),
  handle(api.billing.run, ({ params }, { society }) => bills.preview(society.societyId, params.runId)),
  handle(api.billing.recomputeRun, ({ params }, { society }) => bills.recompute(society, params.runId)),
  handle(api.billing.publishRun, ({ params }, { society, actor }) => bills.publishRun(society, actor.userId, params.runId)),
  handle(api.billing.discardRun, ({ params }, { society }) => bills.discard(society, params.runId)),
  handle(api.billing.bills, ({ query }, { society }) => bills.listBills(society.societyId, query)),
  handle(api.billing.bill, ({ params }, { society, actor }) => bills.getBill(society, actor.userId, params.billId)),
  handle(api.billing.cancelBill, ({ params, body }, { society }) => bills.cancelBill(society, params.billId, body.reason)),
  handle(api.billing.adhocBills, ({ body }, { society }) => bills.adhocBills(society, body)),
  handle(api.billing.ledger, ({ params, query }, { society, actor }) => bills.ledger(society, actor.userId, params.unitId, query)),
  handle(api.billing.creditNote, ({ params, body }, { society, actor }) => bills.creditNote(society, actor.userId, params.unitId, body)),
  handle(api.billing.myDues, (_i, { society, actor }) => bills.myDues(society, actor.userId)),
  handle(api.billing.myBills, ({ query }, { society, actor }) => bills.myBills(society, actor.userId, query)),
];
