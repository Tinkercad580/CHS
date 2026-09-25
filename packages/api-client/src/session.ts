import { api, type LoginResult, type Me } from "@chs/contract";
import type { ApiClient } from "./client";

export type SessionState =
  | { status: "unknown" }
  | { status: "signedOut" }
  | { status: "passwordChange"; restrictedToken: string }
  | { status: "twoFactor"; challengeToken: string }
  | { status: "signedIn"; me: Me };

type Listener = (s: SessionState) => void;

export interface DeviceInput {
  client: "web" | "resident" | "gate" | "admin";
  deviceId?: string;
  deviceName?: string;
}

/**
 * The sign-in state machine — MASTER_SPEC A2.1. Screens call these methods and
 * render whatever `state` says; none of them touch tokens.
 */
export class SessionController {
  private current: SessionState = { status: "unknown" };
  private listeners = new Set<Listener>();

  private readonly client: ApiClient;
  private readonly device: DeviceInput;

  constructor(client: ApiClient, device: DeviceInput) {
    this.client = client;
    this.device = device;
  }

  get state(): SessionState {
    return this.current;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(next: SessionState) {
    this.current = next;
    this.listeners.forEach((l) => l(next));
  }

  /** Restore a stored session at start-up. A network failure keeps the tokens and reports signed-out-for-now as unknown. */
  async restore(): Promise<void> {
    await this.client.tokens.hydrate?.();
    if (!this.client.tokens.get()) return this.set({ status: "signedOut" });
    try {
      const me = await this.client.me.get();
      if (me.mustChangePassword) {
        // A stored full session can't complete a forced change; start sign-in again with the temporary password.
        this.client.tokens.set(null);
        return this.set({ status: "signedOut" });
      }
      this.set({ status: "signedIn", me });
    } catch (err) {
      if ((err as { status?: number }).status === 401) {
        this.client.tokens.set(null);
        this.set({ status: "signedOut" });
      } else {
        throw err;
      }
    }
  }

  lookup(mobile: string) {
    return this.client.auth.lookup({ body: { mobile } });
  }

  async activate(input: { mobile: string; password: string; confirmPassword: string; acceptTerms: true }) {
    return this.apply(await this.client.auth.activate({ body: { ...input, ...this.device } }));
  }

  async login(mobile: string, password: string) {
    return this.apply(await this.client.auth.login({ body: { mobile, password, ...this.device } }));
  }

  async verifyTwoFactor(code: string) {
    if (this.current.status !== "twoFactor") throw new Error("No two-factor challenge in progress");
    return this.apply(
      await this.client.auth.verifyTwoFactor({ body: { challengeToken: this.current.challengeToken, code, ...this.device } }),
    );
  }

  async forcedChange(newPassword: string, confirmPassword: string) {
    if (this.current.status !== "passwordChange") throw new Error("No password change pending");
    const result = await this.client.call(
      api.auth.forcedChange,
      { body: { newPassword, confirmPassword, ...this.device } },
      { token: this.current.restrictedToken },
    );
    return this.apply(result);
  }

  async refreshMe(): Promise<void> {
    const me = await this.client.me.get();
    this.set({ status: "signedIn", me });
  }

  async logout(): Promise<void> {
    const tokens = this.client.tokens.get();
    try {
      if (tokens) await this.client.auth.logout({ body: { refreshToken: tokens.refreshToken } });
    } catch {
      // Signing out locally must succeed even if the server can't be reached.
    }
    this.client.tokens.set(null);
    this.set({ status: "signedOut" });
  }

  /** Called when the server revokes this session or the refresh token dies. */
  expire(): void {
    this.client.tokens.set(null);
    this.set({ status: "signedOut" });
  }

  private apply(result: LoginResult): LoginResult {
    switch (result.status) {
      case "SIGNED_IN":
        this.client.tokens.set(result.tokens);
        this.set({ status: "signedIn", me: result.me });
        break;
      case "PASSWORD_CHANGE":
        this.set({ status: "passwordChange", restrictedToken: result.restrictedToken });
        break;
      case "TWO_FACTOR":
        this.set({ status: "twoFactor", challengeToken: result.challengeToken });
        break;
    }
    return result;
  }
}
