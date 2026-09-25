import { api } from "@chs/contract";
import { handle } from "../../core/http/bind";
import * as users from "./users.service";

export const usersBindings = [
  handle(api.users.list, ({ query }, { society }) => users.listUsers(society.societyId, query)),
  handle(api.users.get, ({ params }, { society }) => users.getUser(society.societyId, params.userId)),
  handle(api.users.create, ({ body }, { society }) => users.createUser(society, body)),
  handle(api.users.update, ({ params, body }, { society, actor }) => users.updateUser(society, actor.userId, params.userId, body)),
  handle(api.users.issueTempPassword, ({ params }, { society, actor }) => users.issueTempPassword(society, actor, params.userId)),
  handle(api.users.unlock, ({ params }, { society, actor }) => users.unlock(society, actor.userId, params.userId)),
  handle(api.users.suspend, ({ params, body }, { society, actor }) => users.suspend(society, actor.userId, params.userId, body.reason)),
  handle(api.users.reactivate, ({ params }, { society, actor }) => users.reactivate(society, actor.userId, params.userId)),
  handle(api.users.logoutAll, ({ params }, { society, actor }) => users.forceLogout(society, actor.userId, params.userId)),
  handle(api.users.sessions, ({ params }, { society }) => users.userSessions(society, params.userId)),
  handle(api.users.authEvents, ({ params, query }, { society }) => users.authEvents(society, params.userId, query)),
  handle(api.users.import, ({ body }, { society, actor }) => users.importUsers(society, actor.userId, body)),
  handle(api.users.templates, (_i, { society }) => users.templates(society.societyId)),
  handle(api.users.upsertTemplate, ({ params, body }, { society }) => users.upsertTemplate(society, params.code, body)),
];
