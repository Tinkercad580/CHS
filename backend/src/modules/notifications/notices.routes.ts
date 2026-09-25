import { api } from "@chs/contract";
import { handle } from "../../core/http/bind";
import * as svc from "./notices.service";

export const noticeBindings = [
  handle(api.notices.list, ({ query }, { society }) => svc.list(society.societyId, query)),
  handle(api.notices.feed, ({ query }, { society, actor }) => svc.feed(society, actor.userId, query)),
  handle(api.notices.get, ({ params }, { society, actor }) => svc.get(society, actor.userId, params.noticeId)),
  handle(api.notices.create, ({ body }, { society, actor }) => svc.create(society, actor.userId, body)),
  handle(api.notices.update, ({ params, body }, { society }) => svc.update(society, params.noticeId, body)),
  handle(api.notices.publish, ({ params }, { society, actor }) => svc.publish(society, actor.userId, params.noticeId)),
  handle(api.notices.discard, ({ params }, { society }) => svc.discard(society, params.noticeId)),
  handle(api.notices.markRead, ({ params }, { society, actor }) => svc.markRead(society, actor.userId, params.noticeId)),
  handle(api.notices.acknowledge, ({ params }, { society, actor }) => svc.acknowledge(society, actor.userId, params.noticeId)),
  handle(api.notices.report, ({ params }, { society, actor }) => svc.report(society, actor.userId, params.noticeId)),
];
