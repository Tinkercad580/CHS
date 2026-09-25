import { REALTIME_EVENTS, REALTIME_PATH, type RealtimeEventName, type RealtimePayload } from "@chs/contract";
import { io, type Socket } from "socket.io-client";

export type ConnectionState = "idle" | "connecting" | "connected" | "disconnected";

export interface Realtime {
  connect(): void;
  disconnect(): void;
  /** Reconnect with the current token — call after sign-in or token refresh. */
  refreshAuth(): void;
  on<N extends RealtimeEventName>(event: N, handler: (payload: RealtimePayload<N>) => void): () => void;
  onAny(handler: (event: RealtimeEventName, payload: unknown) => void): () => void;
  onState(handler: (state: ConnectionState) => void): () => void;
  readonly state: ConnectionState;
}

export interface RealtimeOptions {
  /** Server origin, without `/api/v1`. */
  origin: string;
  getAccessToken(): string | null | undefined;
}

/**
 * One socket per app. The server authenticates the handshake with the access
 * token and joins the socket to the caller's user, society and unit rooms, so
 * the client never subscribes to anything by name.
 */
export function createRealtime(options: RealtimeOptions): Realtime {
  let socket: Socket | null = null;
  let state: ConnectionState = "idle";
  const stateHandlers = new Set<(s: ConnectionState) => void>();
  const anyHandlers = new Set<(event: RealtimeEventName, payload: unknown) => void>();
  const handlers = new Map<string, Set<(p: unknown) => void>>();

  const setState = (s: ConnectionState) => {
    state = s;
    stateHandlers.forEach((h) => h(s));
  };

  function ensure(): Socket {
    if (socket) return socket;
    socket = io(options.origin, {
      path: REALTIME_PATH,
      autoConnect: false,
      transports: ["websocket", "polling"],
      auth: (cb) => cb({ token: options.getAccessToken() ?? "" }),
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 15_000,
    });
    socket.on("connect", () => setState("connected"));
    socket.on("disconnect", () => setState("disconnected"));
    socket.on("connect_error", () => setState("disconnected"));
    socket.onAny((event: string, payload: unknown) => {
      if (!(event in REALTIME_EVENTS)) return;
      handlers.get(event)?.forEach((h) => h(payload));
      anyHandlers.forEach((h) => h(event as RealtimeEventName, payload));
    });
    return socket;
  }

  return {
    connect() {
      if (!options.getAccessToken()) return;
      const s = ensure();
      if (!s.connected) {
        setState("connecting");
        s.connect();
      }
    },
    disconnect() {
      socket?.disconnect();
      setState("idle");
    },
    refreshAuth() {
      if (!socket) return this.connect();
      socket.disconnect();
      if (options.getAccessToken()) {
        setState("connecting");
        socket.connect();
      }
    },
    on(event, handler) {
      const set = handlers.get(event) ?? new Set();
      set.add(handler as (p: unknown) => void);
      handlers.set(event, set);
      return () => set.delete(handler as (p: unknown) => void);
    },
    onAny(handler) {
      anyHandlers.add(handler);
      return () => anyHandlers.delete(handler);
    },
    onState(handler) {
      stateHandlers.add(handler);
      return () => stateHandlers.delete(handler);
    },
    get state() {
      return state;
    },
  };
}
