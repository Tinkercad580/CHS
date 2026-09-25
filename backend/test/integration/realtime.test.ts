import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { api, REALTIME_PATH } from "@chs/contract";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startRealtime, stopRealtime } from "../../src/core/realtime";
import { addUser, app, call, login, makeSociety, mobile, resetDb } from "../helpers";

let server: Server;
let origin: string;
let S: Awaited<ReturnType<typeof makeSociety>>;
let adminToken: string;

beforeAll(async () => {
  await resetDb();
  S = await makeSociety("RT");
  adminToken = (await login(S.admin.mobile)).token;
  server = createServer(app);
  await startRealtime(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await stopRealtime();
  await new Promise<void>((r) => server.close(() => r()));
});

function open(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = connect(origin, { path: REALTIME_PATH, transports: ["websocket"], auth: { token }, reconnection: false });
    s.on("connect", () => resolve(s));
    s.on("connect_error", (e) => reject(e));
  });
}

const next = <T>(s: Socket, event: string, ms = 3000) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`no ${event} within ${ms}ms`)), ms);
    s.once(event, (p: T) => {
      clearTimeout(t);
      resolve(p);
    });
  });

describe("realtime", () => {
  it("refuses a socket without a valid token", async () => {
    await expect(open("not-a-token")).rejects.toThrow(/UNAUTHENTICATED/);
  });

  it("tells admins when a user is added, and only after it committed", async () => {
    const socket = await open(adminToken);
    await new Promise((r) => setTimeout(r, 150)); // room joins are async
    const got = next<{ userId: string }>(socket, "users.changed");
    const r = await call(api.users.create, { params: { societyId: S.society.id }, body: { name: "Live Person", mobile: mobile(), userType: "OWNER", templateCode: "OWNER" } }, adminToken);
    expect((await got).userId).toBe(r.body.data.userId);
    socket.close();
  });

  it("a failed request raises no event", async () => {
    const socket = await open(adminToken);
    await new Promise((r) => setTimeout(r, 150));
    let fired = false;
    socket.on("users.changed", () => (fired = true));
    await call(api.users.create, { params: { societyId: S.society.id }, body: { name: "X", mobile: "123", userType: "OWNER", templateCode: "OWNER" } }, adminToken);
    await new Promise((r) => setTimeout(r, 300));
    expect(fired).toBe(false);
    socket.close();
  });

  it("residents of another society hear nothing", async () => {
    const other = await makeSociety("RT2");
    const outsider = await addUser(other.society.id, "OWNER");
    const socket = await open((await login(outsider.mobile)).token);
    await new Promise((r) => setTimeout(r, 150));
    let fired = false;
    socket.onAny(() => (fired = true));
    await call(api.users.create, { params: { societyId: S.society.id }, body: { name: "Quiet", mobile: mobile(), userType: "OWNER", templateCode: "OWNER" } }, adminToken);
    await new Promise((r) => setTimeout(r, 300));
    expect(fired).toBe(false);
    socket.close();
  });

  it("revoking a session notifies and disconnects its socket", async () => {
    const u = await addUser(S.society.id, "OWNER");
    const { token } = await login(u.mobile);
    const socket = await open(token);
    await new Promise((r) => setTimeout(r, 150));
    const revoked = next<{ sessionId: string | null }>(socket, "session.revoked");
    const disconnected = next<string>(socket, "disconnect");
    await call(api.users.logoutAll, { params: { societyId: S.society.id, userId: u.societyUser.id } }, adminToken);
    expect((await revoked).sessionId).toBeNull();
    await disconnected;
  });
});
