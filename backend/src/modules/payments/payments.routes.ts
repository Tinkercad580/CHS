import { api } from "@chs/contract";
import { handle } from "../../core/http/bind";
import * as svc from "./payments.service";

export const paymentBindings = [
  handle(api.payments.start, ({ body }, { society, actor }) => svc.start(society, actor.userId, body)),
  handle(api.payments.completeDummyCheckout, ({ params, body }, { society, actor }) => svc.completeDummy(society, actor.userId, params.paymentId, body)),
  handle(api.payments.cancelCheckout, ({ params }, { society, actor }) => svc.cancelCheckout(society, actor.userId, params.paymentId)),
  handle(api.payments.mine, ({ query }, { society, actor }) => svc.mine(society, actor.userId, query)),
  handle(api.payments.get, ({ params }, { society, actor }) => svc.get(society, actor.userId, params.paymentId)),
  handle(api.payments.list, ({ query }, { society }) => svc.list(society, query)),
  handle(api.payments.record, ({ body }, { society, actor }) => svc.record(society, actor.userId, body)),
  handle(api.payments.chequeAction, ({ params, body }, { society }) => svc.chequeAction(society, params.paymentId, body)),
  handle(api.payments.cancelReceipt, ({ params, body }, { society }) => svc.cancelReceipt(society, params.paymentId, body.reason)),
  handle(api.payments.webhook, ({ params, body }, { req }) =>
    svc.webhook(params.gateway, (req as { rawBody?: string }).rawBody ?? "", req.header("x-gateway-signature"), body),
  ),
];
