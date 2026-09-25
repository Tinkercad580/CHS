import type { Server as HttpServer } from "node:http";
import { REALTIME_PATH } from "@chs/contract";
import { Server, type Socket } from "socket.io";
import { env } from "../config/env";
import { verifyAccessToken } from "./auth/tokens";
import { prisma } from "./db";
import { events, type DomainEvent } from "./events";
import { logger } from "./logger";

/**
 * Socket.io gateway. A socket authenticates with the access token in its
 * handshake and is joined to the rooms its owner belongs in — user, session,
 * each active society (plus its admin room) and each unit. Clients never ask
 * to join a room, so no one can listen to a society they aren't part of.
 *
 * With REDIS_URL set, the Redis adapter fans events out across instances.
 */

export const rooms = {
  user: (id: string) => `user:${id}`,
  session: (id: string) => `session:${id}`,
  society: (id: string) => `society:${id}`,
  admins: (id: string) => `society:${id}:admins`,
  unit: (id: string) => `unit:${id}`,
};

let io: Server | null = null;
let unsubscribe: (() => void) | null = null;

export async function startRealtime(http: HttpServer): Promise<Server> {
  io = new Server(http, {
    path: REALTIME_PATH,
    cors: { origin: env.CORS_ORIGINS, credentials: true },
    serveClient: false,
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  if (env.REDIS_URL) {
    const [{ createAdapter }, { Redis }] = await Promise.all([import("@socket.io/redis-adapter"), import("ioredis")]);
    const pub = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: false });
    const sub = pub.duplicate();
    io.adapter(createAdapter(pub, sub));
  }

  io.use(async (socket, next) => {
    try {
      const token = String((socket.handshake.auth as { token?: unknown }).token ?? "");
      const claims = await verifyAccessToken(token);
      const session = await prisma.session.findUnique({ where: { id: claims.sid }, include: { user: true } });
      if (!session || session.revokedAt || session.user.tokenVersion !== claims.ver) throw new Error("revoked");
      socket.data.userId = claims.sub;
      socket.data.sessionId = claims.sid;
      next();
    } catch {
      next(new Error("UNAUTHENTICATED"));
    }
  });

  io.on("connection", (socket) => void joinRooms(socket));

  unsubscribe = events.subscribe(broadcast);
  return io;
}

async function joinRooms(socket: Socket) {
  const userId = socket.data.userId as string;
  const sessionId = socket.data.sessionId as string;
  try {
    const memberships = await prisma.societyUser.findMany({
      where: { userId, deletedAt: null, suspendedAt: null },
      select: { societyId: true, role: true, unitId: true },
    });
    const personUnits = await prisma.person.findMany({
      where: { userId, deletedAt: null },
      select: {
        memberships: { where: { cessationDate: null }, select: { unitId: true } },
        tenancies: { where: { endedOn: null }, select: { unitId: true } },
      },
    });
    const list = [rooms.user(userId), rooms.session(sessionId)];
    for (const m of memberships) {
      list.push(rooms.society(m.societyId));
      if (m.role === "ADMIN") list.push(rooms.admins(m.societyId));
      if (m.unitId) list.push(rooms.unit(m.unitId));
    }
    for (const p of personUnits) {
      for (const m of p.memberships) list.push(rooms.unit(m.unitId));
      for (const t of p.tenancies) list.push(rooms.unit(t.unitId));
    }
    await socket.join([...new Set(list)]);
  } catch (err) {
    logger.error({ err }, "realtime: failed to join rooms");
    socket.disconnect(true);
  }
}

function broadcast(event: DomainEvent) {
  if (!io) return;
  const targets: string[] = [];
  if (event.to.user) targets.push(rooms.user(event.to.user));
  if (event.to.society) targets.push(rooms.society(event.to.society));
  if (event.to.admins) targets.push(rooms.admins(event.to.admins));
  if (event.to.unit) targets.push(rooms.unit(event.to.unit));
  if (!targets.length) return;
  let op = io.to(targets);
  if (event.exceptSession) op = op.except(rooms.session(event.exceptSession));
  op.emit(event.name, event.payload);

  // A revoked session's socket should stop receiving anything at once.
  if (event.name === "session.revoked") {
    const room = event.payload.sessionId ? rooms.session(event.payload.sessionId) : rooms.user(event.to.user ?? "");
    const except = event.exceptSession ? rooms.session(event.exceptSession) : undefined;
    setTimeout(() => {
      const target = except ? io?.in(room).except(except) : io?.in(room);
      target?.disconnectSockets(true);
    }, 250).unref();
  }
}

export async function stopRealtime(): Promise<void> {
  unsubscribe?.();
  unsubscribe = null;
  await new Promise<void>((resolve) => (io ? io.close(() => resolve()) : resolve()));
  io = null;
}
