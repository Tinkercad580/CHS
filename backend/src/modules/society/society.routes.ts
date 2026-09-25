import { api } from "@chs/contract";
import { handle } from "../../core/http/bind";
import * as svc from "./society.service";

export const societyBindings = [
  handle(api.society.get, async (_i, { society }) => {
    const s = await svc.getSociety(society.societyId);
    // The gate needs the society's name, not its tax and registration identifiers.
    return society.userType === "GUARD" ? { ...s, pan: null, tan: null, gstin: null, registrationNumber: null, registrationDate: null } : s;
  }),
  handle(api.society.update, ({ body }, { society }) => svc.updateSociety(society, body)),
  handle(api.society.settings, (_i, { society }) => svc.getSettings(society.societyId)),
  handle(api.society.updateSettings, ({ body }, { society }) => svc.updateSettings(society, body)),
  handle(api.society.onboarding, (_i, { society }) => svc.onboarding(society.societyId)),
  handle(api.society.goLive, (_i, { society }) => svc.goLive(society)),
  handle(api.society.billingConfig, (_i, { society }) => svc.getBillingConfig(society.societyId)),
  handle(api.society.updateBillingConfig, ({ body }, { society }) => svc.updateBillingConfig(society, body)),
  handle(api.society.bankAccounts, (_i, { society }) => svc.bankAccounts(society.societyId)),
  handle(api.society.createBankAccount, ({ body }, { society }) => svc.createBankAccount(society, body)),
  handle(api.society.updateBankAccount, ({ params, body }, { society }) => svc.updateBankAccount(society, params.accountId, body)),
  handle(api.society.statutoryConfig, ({ query }, { society }) => svc.statutoryConfig(society.societyId, query.asOf)),
  handle(api.society.setStatutoryConfig, ({ body }, { society, actor }) => svc.setStatutoryConfig(society, actor.userId, body)),
  handle(api.society.auditLogs, ({ query }, { society }) => svc.auditLogs(society.societyId, query)),
];
