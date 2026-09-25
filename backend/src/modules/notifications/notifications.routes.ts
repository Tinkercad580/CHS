import { api } from "@chs/contract";
import { prisma } from "../../core/db";
import { AppError } from "../../core/errors";
import { handle } from "../../core/http/bind";
import { mailStatus } from "../../core/mail";
import { pushStatus } from "../../core/push";
import * as svc from "./notifications.service";
import { notify } from "./notify";

export const notificationBindings = [
  handle(api.notifications.registerDevice, ({ body }, { actor }) => svc.registerDevice(actor.userId, body)),
  handle(api.notifications.unregisterDevice, ({ body }, { actor }) => svc.unregisterDevice(actor.userId, body.token)),
  handle(api.notifications.list, ({ query }, { actor }) => svc.inbox(actor.userId, query)),
  handle(api.notifications.unreadCount, (_i, { actor }) => svc.unreadCount(actor.userId)),
  handle(api.notifications.markRead, ({ params }, { actor }) => svc.markRead(actor.userId, params.notificationId)),
  handle(api.notifications.markAllRead, ({ body }, { actor }) => svc.markAllRead(actor.userId, body.societyId)),
  handle(api.notifications.preferences, (_i, { actor }) => svc.preferences(actor.userId)),
  handle(api.notifications.updatePreferences, ({ body }, { actor }) => svc.updatePreferences(actor.userId, body)),

  handle(api.notifications.test, async (_i, { actor }) => {
    const [user, devices] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { email: true } }),
      prisma.deviceToken.count({ where: { userId: actor.userId, app: { in: ["resident", "gate"] } } }),
    ]);
    if (pushStatus() === "misconfigured" && mailStatus() === "misconfigured") {
      throw new AppError("SERVICE_UNAVAILABLE", "Neither push nor email is configured on the server.");
    }
    await notify({ societyId: null, userIds: [actor.userId], category: "ACCOUNT", title: "Test notification", body: "If you can read this, notifications reach you.", data: { route: "/notifications" } });
    return {
      push: pushStatus() === "misconfigured" ? ("disabled" as const) : devices ? ("sent" as const) : ("no_devices" as const),
      email: mailStatus() === "misconfigured" ? ("disabled" as const) : user.email ? ("sent" as const) : ("no_email" as const),
    };
  }),
];
