import { EventEmitter } from "node:events";
import type { RealtimeEventName, RealtimePayload } from "@chs/contract";
import { currentContext } from "./context";
import { logger } from "./logger";

/** Who a realtime event is for. Any combination; the union of rooms receives it. */
export interface Audience {
  user?: string;
  society?: string;
  /** Only the society's admins. */
  admins?: string;
  unit?: string;
}

export type DomainEvent = {
  [N in RealtimeEventName]: { name: N; to: Audience; payload: RealtimePayload<N>; exceptSession?: string | undefined };
}[RealtimeEventName];

type Listener = (event: DomainEvent) => void;

/**
 * In-process event bus. Modules raise events; subscribers (the realtime
 * gateway, jobs) react. During a request, events wait in the request context
 * and publish only after the handler succeeds — a rolled-back change never
 * tells a client it happened.
 */
class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  emit(event: DomainEvent): void {
    const ctx = currentContext();
    if (ctx) ctx.pendingEvents.push(event);
    else this.publish(event);
  }

  publish(event: DomainEvent): void {
    try {
      this.emitter.emit("event", event);
    } catch (err) {
      logger.error({ err, event: event.name }, "event listener failed");
    }
  }

  flush(pending: DomainEvent[]): void {
    for (const e of pending.splice(0)) this.publish(e);
  }

  subscribe(listener: Listener): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }
}

export const events = new EventBus();
